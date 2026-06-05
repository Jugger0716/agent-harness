// refactor.eval.workflow.js — Eval segment of /refactor multi/comprehensive (WORKFLOW path).
// Autonomous span: one isolated behavior-preservation Evaluator. Returns a VerifyVerdict.
// Replaces the orchestrator's qa_report.md '### Verdict:' regex parse on the workflow
// path (the inline single path keeps the on-disk template's regex contract — dual-use,
// pilot evaluator_prompt precedent). The evaluator still WRITES qa_report.md (user-facing
// artifact + the cross-session verdict-reconstruction source). The QA verdict gate and
// all retry decisions live in the orchestrator (skills/refactor/SKILL.md), never here.
//
// Verdict mapping (canonical encoding note, workflows/_reference/schemas.md):
//   test regression / build failure (mechanical)        -> { layer: 'L1', verdict: 'FAIL_L2' }
//   tests green, behavior-preservation judgment failure -> { layer: 'L3', verdict: 'FAIL_L3' }
//   all five criteria pass, no regressions              -> { layer: 'L3', verdict: 'PASS' }
// layer 'L2' is unused by refactor. Branch on (layer, verdict), never verdict alone.
//
// Engine shape per docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md.
export const meta = {
  name: 'refactor.eval',
  description: '/refactor eval segment: one isolated behavior-preservation evaluator runs the test comparison against baseline and reviews the five refactor criteria, writes qa_report.md, and returns a structured verdict. Does not modify source files.',
  phases: [
    { title: 'Evaluate', detail: 'behavior-preservation review vs baseline' },
  ],
}

// ---- args (SPIKE-F1: defensive parse) -------------------------------------
// contract — keep 1:1 with skills/refactor/SKILL.md Step 5 WORKFLOW dispatch (a field
// missing on either side silently renders as ''):
//   { planGoals, changedFilesList, testAvailable: bool, buildCmd, testCmd,
//     baselineTestResults, baselineFailures, roundNum, scope, userLang,
//     qaReportPath, models: {evaluator} }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const LANG = A.userLang || 'the language of the refactoring target description'
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
// SYNC-SOURCE: templates/refactor/evaluator.md (dual-use: the on-disk copy KEEPS its
// '### Verdict: PASS | FAIL' regex contract for the INLINE single path).
// AUTHOR-TIME TRANSFORMS: the 'Keep ### Verdict ... Parsed programmatically' constraint
// is replaced by the VerifyVerdict schema-return '## Output' note WITH an explicit
// verdict/layer classification instruction (the on-disk 2-value contract carries no
// L-classification); the qa_report.md FILE WRITE IS KEPT and its destination is the
// explicit {qa_report_path} placeholder.
const TPL_EVALUATOR = `# Refactor Evaluator — Round {round_num}

You are an independent code reviewer specializing in **behavior preservation verification** for refactoring operations. Your job is to confirm that the refactoring changed structure without changing behavior. Assume the code contains regressions and prove otherwise — do not assume correctness. Judge the code on its own merits.

## Output Language

Write the QA report in **{user_lang}**. Translate criterion names.

## Refactoring Goals (Structural Only)

{refactor_plan_content}

## Files Changed

{changed_files_list}

Read each file directly from the filesystem. Do not rely on summaries.

## Baseline Test Results

{baseline_test_results}

## Known Pre-existing Failures (ignore these)

{baseline_failures}

## Test Availability

Tests: **{test_available}** | Build: \`{build_cmd}\` | Test: \`{test_cmd}\`

## Scope

{scope}

## Instructions

### Step 1 — Pre-mortem Analysis

Before reviewing, identify the 2 most likely ways this refactoring could have broken existing behavior. Use as investigation targets.

### Step 2 — Run Tests and Compare with Baseline

If \`{test_available}\` is \`true\`:
1. Run \`{build_cmd}\` (if non-empty) and capture output.
2. Run \`{test_cmd}\` and capture full output including pass/fail counts.
3. **Compare with baseline results:**
   - Any test that was PASSING in baseline but now FAILS = **regression** (FAIL verdict).
   - Tests in \`{baseline_failures}\` that still fail = **pre-existing** (ignore).
   - New tests that pass = acceptable.
4. Record all regressions verbatim — do not summarize or omit error messages.

If any test fails unexpectedly, search installed skills for "systematic-debugging" or "debugging" and invoke if found to diagnose the root cause before reporting.

### Step 3 — Behavior Preservation Review

Search installed skills for "requesting-code-review" or "code-review" and invoke if found.

Read every changed file directly from the filesystem. For each criterion: identify key risks, then verify with code-level evidence before marking PASS.

1. **Behavior Preserved** — do all existing behaviors (return values, side effects, error handling, event ordering) remain identical? Check pre-mortem targets.
2. **Tests Passing** — do all baseline-passing tests still pass? No regressions?
3. **Structural Improvement** — did the refactoring achieve its stated structural goals? (improved coupling, cohesion, complexity, etc.)
4. **Scope Compliance** — only declared-scope files modified? No unnecessary changes?
5. **Atomicity** — were changes applied as atomic steps? Is each step independently verifiable?

Search installed skills for "verification-before-completion" or "verification" and invoke if found. Run verification commands rather than assuming correctness.

### Step 4 — Write QA Report

Write the report (in \`{user_lang}\`) to: \`{qa_report_path}\`

\`\`\`markdown
## QA Report — Refactor Round {round_num}
### Verdict: PASS | FAIL
### Pre-mortem Findings
(2 hypothesized regression causes — confirmed or disproven)
### Test Comparison
| Metric | Baseline | After Refactor |
|--------|----------|----------------|
| Total tests | N | N |
| Passing | N | N |
| Failing | N | N |
| New failures (regressions) | — | N |
(Or "N/A — no tests available" if test_available is false)
### Review
| Criterion | Result | Evidence |
|-----------|--------|----------|
| Behavior Preserved | PASS/FAIL | (code-level evidence) |
| Tests Passing | PASS/FAIL | (test output comparison) |
| Structural Improvement | PASS/FAIL | (before/after structure comparison) |
| Scope Compliance | PASS/FAIL | (file list verification) |
| Atomicity | PASS/FAIL | (step independence verification) |
### Fix Instructions
(FAIL: specific steps with file paths and line numbers. PASS: "None")
\`\`\`

Keep the report's \`### Verdict: PASS\` / \`### Verdict: FAIL\` line as shown (English) — it is the cross-session reconstruction source for the orchestrator.

## Constraints

- The report **Verdict** is **PASS** only if ALL five criteria are PASS and no test regressions exist. Any single FAIL makes it FAIL.
- **Behavior preservation is the primary criterion.** A refactoring that improves structure but breaks behavior is a FAIL.
- Do not modify source files — your only outputs are the QA report file and the structured return.
- Fix instructions must be concrete so the implementer can act directly.
- Be concise — evidence over explanation.

## Output

After writing the QA report, return a structured VerifyVerdict object (the dispatching engine enforces the shape). Classify verdict and layer as follows:
- A test that was passing in baseline now FAILS, or the build fails (mechanical evidence): \`verdict: "FAIL_L2"\`, \`layer: "L1"\`
- Tests green (or unavailable) but a behavior-preservation criterion fails by judgment: \`verdict: "FAIL_L3"\`, \`layer: "L3"\`
- All five criteria pass and no regressions: \`verdict: "PASS"\`, \`layer: "L3"\`
- \`failures\`: one entry per failing item — {file, line?, severity (critical|major|minor), category (e.g. "regression"/"behavior"/"structure"/"scope"/"atomicity"), fix}
- \`checks\`: {build, test} as "PASS"/"FAIL"/"SKIP" if you ran them in Step 2
- \`summary\`: one line, e.g. "behavior preserved, 0 regressions" or "{N} criteria failed: {brief list}"

Fix instructions in **{user_lang}**; enum values English raw. Do NOT emit a 1-line text summary — the structured object is the result.`

// ---- Phase 1: isolated evaluation ----------------------------------------------
phase('Evaluate')

// Structural keys first; user-influenced payloads last (plan goals are the most
// model/user-shaped text, so they substitute last).
const verdict = await agent(
  render(TPL_EVALUATOR, {
    round_num: A.roundNum,
    test_available: A.testAvailable ? 'true' : 'false',
    build_cmd: A.buildCmd || '',
    test_cmd: A.testCmd || '',
    baseline_test_results: A.baselineTestResults,
    baseline_failures: A.baselineFailures,
    scope: A.scope,
    user_lang: A.userLang,
    qa_report_path: A.qaReportPath,
    changed_files_list: A.changedFilesList,
    refactor_plan_content: A.planGoals,
  }),
  { schema: VerifyVerdictSchema, label: 'evaluator', phase: 'Evaluate', ...mopt(MODELS.evaluator) },
)
log(`Evaluate: ${verdict.verdict} (layer ${verdict.layer})${verdict.summary ? ' — ' + verdict.summary : ''}`)

// The orchestrator branches its QA gate on (layer, verdict); qa_report.md was written
// by the evaluator (verify existence orchestrator-side; it is also the cross-session
// verdict-reconstruction source).
return verdict
