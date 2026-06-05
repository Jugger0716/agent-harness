// harness.eval.workflow.js — Eval segment of /harness (WORKFLOW path).
// Autonomous span: Layer-1 mechanical verify -> Layer-2/3 evaluation. Returns a VerifyVerdict.
// Retry budgeting (L1<=3, L2<=2) and HARD GATES #2/#3 live in the ORCHESTRATOR between
// segment runs — each retry is a fresh harness.build(retry) then harness.eval pass.
// Flags: skipL1=true (user chose "Continue to Evaluator" after L1 max-fail) jumps straight
// to evaluation; onlyL1=true returns after the L1 pass (generic capability for orchestrators
// needing an L1-only recheck — the shipped /harness flow runs ONE full eval after auto-fix
// apply instead of an onlyL1 pre-pass, so L1 is not executed twice).
//
// L1 mechanical failure is encoded as { layer: 'L1', verdict: 'FAIL_L2' } — the verdict
// enum is locked to PASS|FAIL_L2|FAIL_L3; branch on (layer, verdict), not verdict alone.
//
// Engine shape per docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md.
export const meta = {
  name: 'harness.eval',
  description: '/harness Eval segment: runs build/test/lint/typecheck mechanically (Layer 1), then an isolated evaluator review (Layer 2+3). Writes verify/QA reports; does not modify source.',
  phases: [
    { title: 'Verify L1', detail: 'mechanical build/test/lint/typecheck' },
    { title: 'Evaluate', detail: 'Layer 2 structural + Layer 3 judgment' },
  ],
}

// ---- args (SPIKE-F1: defensive parse) -------------------------------------
// contract: { buildCmd, testCmd, lintCmd, typeCheckCmd, changesMdPath, verifyReportPath,
//             todoBlocking, specContent, changedFilesList, testAvailable, roundNum, scope,
//             userLang, qaReportPath, models, skipL1: bool, onlyL1: bool }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const LANG = A.userLang || 'the language of the task description'
const MODELS = A.models || {}
const mopt = (m) => (m ? { model: m } : {})

// Substitution order = vars insertion order. Keep STRUCTURAL keys first and
// user-influenced payload keys LAST: a payload substituted early could otherwise
// hijack later {placeholders} with injected literals.
const render = (tpl, vars) =>
  Object.entries(vars).reduce(
    (t, [k, v]) => t.split('{' + k + '}').join(v == null ? '' : String(v)),
    tpl,
  )

// ---- schema (inlined per C1; canonical: workflows/_reference/schemas.md) ----
const VerifyVerdictSchema = {
  type: 'object',
  required: ['verdict', 'layer', 'failures'],
  properties: {
    verdict: { enum: ['PASS', 'FAIL_L2', 'FAIL_L3'] },
    layer: { enum: ['L1', 'L2', 'L3'] },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'severity', 'fix'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { enum: ['critical', 'major', 'minor'] },
          category: { type: 'string', description: 'short token, English raw' },
          fix: { type: 'string', description: `concrete fix instruction, render in ${LANG}` },
        },
      },
    },
    checks: {
      type: 'object',
      properties: {
        build: { enum: ['PASS', 'FAIL', 'SKIP'] },
        test: { enum: ['PASS', 'FAIL', 'SKIP'] },
        lint: { enum: ['PASS', 'FAIL', 'SKIP'] },
        typecheck: { enum: ['PASS', 'FAIL', 'SKIP'] },
      },
    },
    summary: { type: 'string', description: `one-line, render in ${LANG}` },
  },
}

// ---- templates (author-time copies) ----------------------------------------
// SYNC-SOURCE: templates/verify/verify_layer1.md
// AUTHOR-TIME TRANSFORMS: '## Output Contract' (1-line PASS/FAIL) -> VerifyVerdict schema
// note. The verify_report.md file write is KEPT (user-facing artifact).
const TPL_VERIFY_LAYER1 = `# Mechanical Verification — Layer 1

You are executing Mechanical Verification (Layer 1) for a workflow. Your job is to run commands and report results. Do NOT simulate, predict, or skip any command — execute each one via the Bash tool and capture real output.

## Commands to Execute (in order)

1. **build**: \`{build_cmd}\`
2. **test**: \`{test_cmd}\`
3. **lint**: \`{lint_cmd}\`
4. **type_check**: \`{type_check_cmd}\`

## Changed Files (for completeness scan)

Read \`{changes_md_path}\` and extract the list of changed file paths.
- If \`{changes_md_path}\` does not exist, try \`git diff --name-only\` to get the file list.
- If git is also not available (command fails), skip the completeness scan entirely and mark it as **SKIPPED** in the report.

## Execution Rules

Execute each command strictly in the listed order. Follow these rules exactly:

### For each command:
- If the command value is \`"SKIP"\` or empty, mark it as **SKIPPED** in the report. Do not attempt to run it.
- Run the command via the **Bash tool**. Capture both stdout and stderr.
- Record the exit code, duration, and relevant output.

### Failure criteria:
- **build**: FAIL if exit code != 0. Capture full error output.
- **test**: FAIL if exit code != 0. Extract total/passed/failed/skipped counts from output. List each failing test name.
- **lint**: FAIL only on **errors** (exit code != 0 with error-level issues). Warnings are recorded but do NOT cause FAIL.
- **type_check**: FAIL if exit code != 0. List each type error with file:line.

### Stop-on-failure:
- If **build** fails, skip test/lint/type_check (they depend on a successful build). Still run completeness scan.
- If **test** fails, continue with lint and type_check (they are independent).

### Completeness Scan:
After all commands, scan changed files only for incomplete implementation markers:
\`\`\`
grep -rn "TODO\\|FIXME\\|HACK" <changed_files>
\`\`\`
Report the count and locations. This is a WARNING by default (non-blocking), unless \`{todo_blocking}\` is \`true\`, in which case any finding is a FAIL.

## Output File

Write the verification report to \`{verify_report_path}\` in this exact format:

\`\`\`markdown
# Verify Report

- **timestamp**: {ISO8601 timestamp}
- **result**: PASS | FAIL
- **phase**: layer1_mechanical

## Build
- command: \`{actual command run}\`
- result: PASS | FAIL | SKIPPED
- duration: {X.X}s
- errors: (if FAIL, include error output)

## Test
- command: \`{actual command run}\`
- result: PASS | FAIL | SKIPPED
- total: {N}, passed: {N}, failed: {N}, skipped: {N}
- duration: {X.X}s
- failures: (if FAIL, list each failing test)

## Lint
- command: \`{actual command run}\`
- result: PASS | FAIL | SKIPPED
- errors: {N}, warnings: {N}
- error_details: (if FAIL, list each error with file:line)
- warning_details: (list each warning with file:line)

## Type Check
- command: \`{actual command run}\`
- result: PASS | FAIL | SKIPPED
- errors: (if FAIL, list each error with file:line)

## Completeness Scan
- result: PASS | WARN | FAIL | SKIPPED
- TODO/FIXME/HACK: {N} found in changed files (or "N/A" if SKIPPED)
- locations: (list each with file:line — content)
- blocking: {true|false}
\`\`\`

## Overall Result

- **PASS**: All executed commands passed AND (completeness scan clean OR todo_blocking=false)
- **FAIL**: Any executed command failed OR (completeness scan found items AND todo_blocking=true)
- **SKIPPED commands do not affect the overall result.**

## Output

After writing the report file, return a structured VerifyVerdict object (the dispatching engine enforces the shape):
- \`verdict\`: "PASS" if the Overall Result is PASS, otherwise "FAIL_L2"
- \`layer\`: "L1"
- \`checks\`: {build, test, lint, typecheck} — "PASS" | "FAIL" | "SKIP" each
- \`failures\`: one entry per failing command or blocking scan finding — {file (or command name), line?, severity, category (e.g. "build"/"test"/"lint"/"typecheck"/"todo"), fix}
- \`summary\`: one line, e.g. "build ok, test 12/12, lint 0e/2w, scan 0 TODO"

Fix instructions in **{user_lang}**; enum values English raw. Do NOT emit a 1-line text summary.`

// SYNC-SOURCE: templates/evaluator/evaluator_prompt.md
// AUTHOR-TIME TRANSFORMS: '## Output Contract' (1-line PASS/FAIL L2/FAIL L3) -> VerifyVerdict
// schema note; 'Keep ### Verdict ... Parsed programmatically' constraint dropped (the object is
// the machine-readable result); report destination made explicit ({qa_report_path}).
// The QA report file write is KEPT (user-facing artifact).
const TPL_EVALUATOR = `# Evaluator Phase — Round {round_num}

You are an independent code reviewer. Find defects, spec violations, and quality issues. Assume the code contains defects and prove otherwise — do not assume correctness. Judge the code on its own merits.

## Output Language

Write the QA report in **{user_lang}**. Translate criterion names.

## Spec (Requirements)

{spec_content}

## Files Changed

{changed_files_list}

Read each file directly from the filesystem. Do not rely on summaries.

## Test Availability

Tests: **{test_available}** | Build: \`{build_cmd}\` | Test: \`{test_cmd}\`

## Mechanical Verification (Layer 1) Results

{verify_context}

> If Layer 1 passed, build/test/lint/type-check have already been verified mechanically. Focus your review on logic correctness, spec compliance, and design quality rather than re-running passing checks. If Layer 1 was skipped, run tests as described in Step 2 below.

## Scope

{scope}

## Instructions

### Step 1 — Pre-mortem Analysis

Before reviewing, identify the 2 most likely causes if this code fails in production. Use as investigation targets.

### Step 2 — Run Tests (if available)

**If Layer 1 passed** (verify_context indicates PASSED): Skip build and test execution — they have already been verified mechanically. Proceed to Step 3.

**If Layer 1 was not executed or failed**, and \`{test_available}\` is \`true\`:
1. Run \`{build_cmd}\` (if non-empty) and capture output.
2. Run \`{test_cmd}\` and capture full output including pass/fail counts.
3. Record all failures verbatim — do not summarise or omit error messages.

If any test fails unexpectedly, search installed skills for "systematic-debugging" or "debugging" and invoke if found to diagnose the root cause before reporting.

### Step 3 — Layer 2: Structural Verification

Narrow, checklist-based verification. Each item is a concrete YES/NO — not open-ended judgment.

#### 3a. Acceptance Criteria Check

For EACH acceptance criterion in the spec, answer:
- Does the code satisfy this criterion? **YES / NO**
- Evidence: \`file:line\` reference (mandatory if YES, explanation if NO)

#### 3b. File-to-Spec Mapping

For EACH file in the changed files list, answer:
- Which spec requirement does this change serve? (must map to at least one)
- Any file that maps to **no requirement** → **FAIL** as scope violation
  - Fix instruction: "Revert changes to this file, or add a matching requirement to the spec"

#### 3c. Test Coverage Check

For EACH acceptance criterion in the spec:
- Does a test function exist that validates this criterion? **YES / NO**
- Evidence: \`test_file:line\` reference (mandatory if YES)
- NO → **WARN** (non-blocking, but recorded in report)

#### 3d. Diff-Based Risk Review

Run \`git diff\` on changed files. For each, answer specifically:
- **Error handling gaps**: "Is there an unhandled error path? If yes, file:line"
- **Resource leaks**: "Is there an unclosed resource? If yes, file:line"
- **Security issues**: "Is there an injection/XSS/auth bypass risk? If yes, file:line"

Any finding here is a **FAIL** item.

#### Layer 2 STOP Condition

If **any** acceptance criterion is NO (3a) or **any** scope violation is found (3b) or **any** risk is found (3d):
→ **STOP HERE.** Write the QA report with **FAIL**. Skip Step 4 (Layer 3).
→ In the report, mark Layer 3 section as: \`"Skipped (Layer 2 failed)"\`

If ALL Layer 2 checks pass → proceed to Step 4.

### Step 4 — Layer 3: LLM Judgment

Only reached if ALL Layer 2 checks passed.

Search installed skills for "requesting-code-review" or "code-review" and invoke if found.

Read every changed file directly from the filesystem. For each criterion: identify key risks, then verify with code-level evidence before marking PASS.

1. **Completion** — each spec criterion has corresponding code? Fully implemented, not superficial?
2. **Scope** — only declared-scope files modified? No unnecessary creates/deletes?
3. **Bug-free** — no logic errors, unhandled edges, type mismatches? Check pre-mortem targets.
4. **Consistency** — matches existing code style, naming, patterns?
5. **Minimal changes** — no unrelated refactors, debug prints, unnecessary deps?

Search installed skills for "verification-before-completion" or "verification" and invoke if found. Run verification commands rather than assuming correctness.

### Step 5 — Write QA Report

Write the report (in \`{user_lang}\`) to: \`{qa_report_path}\`

\`\`\`markdown
## QA Report — Round {round_num}
### Verdict: PASS | FAIL

### Layer 2: Structural Verification

#### Acceptance Criteria
| Criterion | Result | Evidence |
|-----------|--------|----------|
| AC1: "(criterion text)" | YES/NO | file:line or explanation |
| AC2: "(criterion text)" | YES/NO | ... |

#### File-to-Spec Mapping
| File | Mapped Requirement | Result |
|------|--------------------|--------|
| path/to/file.ts | AC1, AC2 | OK |
| path/to/other.ts | (none) | FAIL — scope violation |

#### Test Coverage
| Criterion | Test Exists | Evidence |
|-----------|-------------|----------|
| AC1 | YES/NO | test_file:line |

#### Diff Risk Review
(findings with file:line, or "No issues found")

### Layer 3: LLM Judgment

### Pre-mortem Findings
(2 hypothesized failure causes — confirmed or disproven)
### Test Results
(test output, or "N/A", or "Verified by Layer 1 — see verify_report.md" if skipped)
### Review
| Criterion | Result | Evidence |
|-----------|--------|----------|
| Completion | PASS/FAIL | (evidence) |
| Scope | PASS/FAIL | ... |
| Bug-free | PASS/FAIL | ... |
| Consistency | PASS/FAIL | ... |
| Minimal changes | PASS/FAIL | ... |

(If Layer 2 failed: "Skipped (Layer 2 failed)")

### Fix Instructions
(FAIL: specific steps with file paths and line numbers. PASS: "None")
\`\`\`

## Constraints

- **Verdict** is **PASS** only if ALL Layer 2 checks pass AND all Layer 3 criteria are PASS and all tests pass. Any single FAIL makes the verdict FAIL.
- Do not modify source files — your only output is the QA report.
- Fix instructions must be concrete so the implementer can act directly.
- Be concise — evidence over explanation.

## Output

After writing the QA report, return a structured VerifyVerdict object (the dispatching engine enforces the shape):
- \`verdict\`: "PASS" (all layers passed) | "FAIL_L2" (stopped at the Layer 2 STOP condition) | "FAIL_L3" (Layer 2 passed, Layer 3 failed)
- \`layer\`: "L2" if you stopped at Layer 2, otherwise "L3"
- \`failures\`: one entry per failing item — {file, line?, severity, category, fix}
- \`checks\`: only if you ran build/test in Step 2 — {build, test} as "PASS"/"FAIL"/"SKIP"
- \`summary\`: one line, e.g. "{N} items failed: {brief list}" or "all criteria passed"

Fix instructions in **{user_lang}**; enum values English raw. Do NOT emit a 1-line text summary.`

// ---- Phase 1: Layer-1 mechanical verification --------------------------------
let l1 = null
if (!A.skipL1) {
  phase('Verify L1')
  l1 = await agent(
    render(TPL_VERIFY_LAYER1, {
      build_cmd: A.buildCmd || 'SKIP',
      test_cmd: A.testCmd || 'SKIP',
      lint_cmd: A.lintCmd || 'SKIP',
      type_check_cmd: A.typeCheckCmd || 'SKIP',
      changes_md_path: A.changesMdPath,
      verify_report_path: A.verifyReportPath,
      todo_blocking: A.todoBlocking ? 'true' : 'false',
      user_lang: A.userLang,
    }),
    { schema: VerifyVerdictSchema, label: 'verify_l1', phase: 'Verify L1', ...mopt(MODELS.verifier || 'haiku') },
  )
  log(`Verify L1: ${l1.verdict}${l1.summary ? ' — ' + l1.summary : ''}`)
  // L1 fail -> orchestrator handles the retry loop / HARD GATE #2; post-auto-fix
  // re-verify (onlyL1) returns here too.
  if (l1.verdict !== 'PASS' || A.onlyL1) return l1
} else {
  log('Verify L1: skipped (user proceeded to Evaluator after L1 max-fail)')
}

// ---- Phase 2: Layer-2/3 evaluation -------------------------------------------
phase('Evaluate')
const verifyContext = A.skipL1
  ? `Layer 1 FAILED (user proceeded despite failures) — see ${A.verifyReportPath}. Pay extra attention to build/test correctness.`
  : `Layer 1 PASSED — build/test/lint/type-check verified. See ${A.verifyReportPath}`

const verdict = await agent(
  render(TPL_EVALUATOR, {
    test_available: A.testAvailable ? 'true' : 'false',
    build_cmd: A.buildCmd || '',
    test_cmd: A.testCmd || '',
    round_num: A.roundNum,
    scope: A.scope,
    user_lang: A.userLang,
    verify_context: verifyContext,
    qa_report_path: A.qaReportPath,
    changed_files_list: A.changedFilesList,
    spec_content: A.specContent,
  }),
  { schema: VerifyVerdictSchema, label: 'evaluator', phase: 'Evaluate', ...mopt(MODELS.evaluator) },
)
log(`Evaluate: ${verdict.verdict}${verdict.summary ? ' — ' + verdict.summary : ''}`)

// Orchestrator branches on (layer, verdict): retry loops, HARD GATES, verdict gate.
return verdict
