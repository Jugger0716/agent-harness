// migrate.eval.workflow.js — Eval segment of /migrate multi (WORKFLOW path).
// Autonomous span: one isolated migration completeness-and-correctness Evaluator.
// Returns a VerifyVerdict. Replaces the orchestrator's qa_report.md '### Verdict:' regex
// parse on the workflow path (the inline path keeps the on-disk template's regex contract
// — dual-use, pilot evaluator_prompt precedent). The evaluator still WRITES qa_report.md
// (user-facing artifact + the cross-session verdict-reconstruction source). The QA verdict
// gate and all resolution decisions live in the orchestrator (skills/migrate/SKILL.md).
//
// Verdict mapping (canonical encoding note, workflows/_reference/schemas.md):
//   test regression / build failure (mechanical)            -> { layer: 'L1', verdict: 'FAIL_L2' }
//   tests green, a completeness/correctness criterion fails  -> { layer: 'L3', verdict: 'FAIL_L3' }
//   all six criteria pass, no regressions                    -> { layer: 'L3', verdict: 'PASS' }
// layer 'L2' is unused by migrate. Branch on (layer, verdict), never verdict alone.
//
// Engine shape per docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md.
export const meta = {
  name: 'migrate.eval',
  description: '/migrate eval segment: one isolated migration evaluator runs the full test suite against baseline, scans the whole codebase for residual deprecated patterns, checks version consistency, reviews the six migration criteria, writes qa_report.md, and returns a structured verdict. Does not modify source files.',
  phases: [
    { title: 'Evaluate', detail: 'migration completeness + correctness review vs baseline' },
  ],
}

// ---- args (SPIKE-F1: defensive parse) -------------------------------------
// contract — keep 1:1 with skills/migrate/SKILL.md Step 5 WORKFLOW dispatch (a field
// missing on either side silently renders as ''):
//   { target, fromVersion, toVersion, migrationType, planContent, changedFilesList,
//     testAvailable: bool, buildCmd, testCmd, baselineTestPassCount, baselineTestFailCount,
//     userLang, qaReportPath, models: {evaluator} }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const LANG = A.userLang || 'the language of the migration target description'
const MODELS = A.models || {}
const mopt = (m) => (m ? { model: m } : {})

// Substitution order = vars insertion order. Keep STRUCTURAL keys first and
// user-influenced payload keys LAST: a payload substituted early could otherwise
// hijack later {placeholders}.
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

// ---- evaluator template (author-time copy) -----------------------------------
// SYNC-SOURCE: templates/migrate/evaluator.md (dual-use: the on-disk copy KEEPS its
// '### Verdict: PASS | FAIL' regex contract for the INLINE single path).
// AUTHOR-TIME TRANSFORMS: the "write to the path specified by the caller" instruction is
// pinned to the explicit {qa_report_path}; a VerifyVerdict schema-return '## Output' note
// WITH an explicit verdict/layer classification instruction is appended (the on-disk
// 2-value contract carries no L-classification). The qa_report.md FILE WRITE IS KEPT.
const TPL_EVALUATOR = `# Migration Evaluator — Completeness & Correctness Verification

You are an independent reviewer verifying that a migration has been completed correctly. Assume the migration contains errors and prove otherwise — do not assume correctness. Judge the code on its own merits.

## Migration Details

**Target:** {target} | **From:** {from_version} | **To:** {to_version} | **Type:** {migration_type}

## Output Language

Write the QA report in **{user_lang}**. **Keep \`### Verdict: PASS\` or \`### Verdict: FAIL\` exactly as shown — do not translate.** It is the cross-session reconstruction source for the orchestrator.

## Migration Plan (Breaking Changes Only)

{migration_plan_content}

## Files Changed

{changed_files_list}

Read each file directly from the filesystem. Do not rely on summaries.

## Test Availability

Tests: **{test_available}** | Build: \`{build_cmd}\` | Test: \`{test_cmd}\`
Baseline: {baseline_test_pass_count} pass, {baseline_test_fail_count} fail

## Instructions

### Step 1 — Pre-mortem Analysis

Before reviewing, identify the 2 most likely ways this migration could have gone wrong:
1. A breaking change was applied to some files but missed in others (partial migration).
2. A deprecated API was replaced with the wrong new API (incorrect migration).

Use these as investigation targets.

### Step 2 — Run Full Test Suite

If \`{test_available}\` is \`true\`:
1. Run \`{build_cmd}\` (if non-empty) and capture output.
2. Run \`{test_cmd}\` and capture full output including pass/fail counts.
3. **Compare against baseline:** only failures that are NEW (not in baseline) count as migration regressions.
4. Record all new failures verbatim — do not summarize or omit error messages.

If any test fails unexpectedly, search installed skills for "systematic-debugging" or "debugging" and invoke if found to diagnose the root cause before reporting.

### Step 3 — Deprecated API Scan

Search the ENTIRE codebase (not just changed files) for any remaining usage of deprecated APIs that should have been migrated. For each breaking change in the plan, search for the old patterns; any hit is a **partial migration** — record every instance with file path and line number.

### Step 4 — Version Consistency Check

Read the package manager config file(s); confirm the target is at \`{to_version}\`; check for peer dependency conflicts, version mismatches in lock files, and duplicate versions of the target (especially in monorepos).

### Step 5 — Code Review

Read every changed file directly from the filesystem. For each criterion: identify key risks, then verify with code-level evidence before marking PASS.

1. **Migration completeness** — every breaking change in the plan has corresponding code changes? No steps skipped?
2. **No residual deprecated patterns** — codebase-wide scan found no old API usage? (Step 3 results)
3. **Version consistency** — all package files reference \`{to_version}\`, no conflicts? (Step 4 results)
4. **Code correctness** — new API usage follows the correct patterns? No logic errors?
5. **No collateral damage** — only migration-related changes made? No unrelated modifications?
6. **Test health** — no new test failures beyond baseline? (Step 2 results)

Search installed skills for "verification-before-completion" or "verification" and invoke if found. Run verification commands rather than assuming correctness.

### Step 6 — Write QA Report

Write the report (in \`{user_lang}\`) to: \`{qa_report_path}\`

\`\`\`markdown
## QA Report — Migration: {target} {from_version} → {to_version}
### Verdict: PASS | FAIL
### Pre-mortem Findings
(2 hypothesized failure modes — confirmed or disproven with evidence)
### Test Results
(full test output comparison against baseline, or "N/A — no tests available")
### Deprecated API Scan
(remaining deprecated patterns found, or "Clean — no deprecated patterns found")
### Version Consistency
(dependency version check results)
### Review
| Criterion | Result | Evidence |
|-----------|--------|----------|
| Migration completeness | PASS/FAIL | (evidence) |
| No residual deprecated patterns | PASS/FAIL | (evidence) |
| Version consistency | PASS/FAIL | (evidence) |
| Code correctness | PASS/FAIL | (evidence) |
| No collateral damage | PASS/FAIL | (evidence) |
| Test health | PASS/FAIL | (evidence) |
### Fix Instructions
(FAIL: specific steps with file paths and line numbers. PASS: "None")
\`\`\`

Keep the report's \`### Verdict: PASS\` / \`### Verdict: FAIL\` line as shown (English).

## Constraints

- **Verdict** is **PASS** only if ALL six criteria are PASS and all tests pass (relative to baseline). Any single FAIL makes it FAIL.
- **Codebase-wide scan is mandatory.** Do not only check changed files — deprecated patterns could exist in files missed during migration.
- Do not modify source files — your only outputs are the QA report file and the structured return.
- Fix instructions must be concrete so the implementer can act directly.
- Be concise — evidence over explanation.

## Output

After writing the QA report, return a structured VerifyVerdict object (the dispatching engine enforces the shape). Classify verdict and layer as follows:
- A test that was passing in baseline now FAILS, or the build fails (mechanical evidence): \`verdict: "FAIL_L2"\`, \`layer: "L1"\`
- Tests green (or unavailable) but a completeness/correctness criterion fails by judgment: \`verdict: "FAIL_L3"\`, \`layer: "L3"\`
- All six criteria pass and no regressions: \`verdict: "PASS"\`, \`layer: "L3"\`
- \`failures\`: one entry per failing item — {file, line?, severity (critical|major|minor), category (e.g. "completeness"/"deprecated"/"version"/"correctness"/"collateral"/"regression"), fix}
- \`checks\`: {build, test} as "PASS"/"FAIL"/"SKIP" if you ran them in Step 2
- \`summary\`: one line, e.g. "migration complete, 0 regressions" or "{N} criteria failed: {brief list}"

Fix instructions in **{user_lang}**; enum values English raw. Do NOT emit a 1-line text summary — the structured object is the result.`

// ---- Phase 1: isolated evaluation ----------------------------------------------
phase('Evaluate')

// Structural keys first; user-influenced payloads last (plan content is the most
// model/user-shaped text, so it substitutes last).
const verdict = await agent(
  render(TPL_EVALUATOR, {
    target: A.target,
    from_version: A.fromVersion,
    to_version: A.toVersion,
    migration_type: A.migrationType,
    test_available: A.testAvailable ? 'true' : 'false',
    build_cmd: A.buildCmd || '',
    test_cmd: A.testCmd || '',
    baseline_test_pass_count: A.baselineTestPassCount,
    baseline_test_fail_count: A.baselineTestFailCount,
    user_lang: A.userLang,
    qa_report_path: A.qaReportPath,
    changed_files_list: A.changedFilesList,
    migration_plan_content: A.planContent,
  }),
  { schema: VerifyVerdictSchema, label: 'evaluator', phase: 'Evaluate', ...mopt(MODELS.evaluator) },
)
log(`Evaluate: ${verdict.verdict} (layer ${verdict.layer})${verdict.summary ? ' — ' + verdict.summary : ''}`)

// The orchestrator branches its QA gate on (layer, verdict); qa_report.md was written by
// the evaluator (verify existence orchestrator-side; it is also the cross-session
// verdict-reconstruction source).
return verdict
