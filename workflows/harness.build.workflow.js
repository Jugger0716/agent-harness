// harness.build.workflow.js — Build segment of /harness (WORKFLOW path).
// Autonomous span: implementation plan -> advisory review -> implementation.
// Returns { changes: ChangeSet, planDigest, advisorDigests }. Runs AFTER HARD GATE #1
// (spec confirmation), BEFORE Verify — gates live in the orchestrator, never here.
// Retry entries (verify/evaluate failures) pass retry=true + the stored digests:
// plan/advise phases are skipped (no re-plan, no re-review — single implementation pass).
//
// Engine shape per docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md
// (top-level body, args JSON-string guard, inlined schemas/templates, no agentType).
export const meta = {
  name: 'harness.build',
  description: '/harness Build segment: implementation plan, advisory review, then implementation that edits source files in this repo. Spawns 2-4 sub-agents.',
  phases: [
    { title: 'Plan', detail: 'lead developer implementation plan' },
    { title: 'Advise', detail: 'advisory plan review (parallel in multi mode)' },
    { title: 'Implement', detail: 'apply the plan to source files' },
  ],
}

// ---- args (SPIKE-F1: defensive parse) -------------------------------------
// contract: { specContent, qaFeedback, repoPath, lang, scope, maxFiles, testCmd,
//             userLang, verifyFailure, verifyReportPath, mode: 'standard'|'multi',
//             models, retry: bool, planDigest?, advisorDigests?: {combined?, quality?, stability?} }
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

// ---- schemas (inlined per C1; canonical: workflows/_reference/schemas.md) ----
const AnalysisResultSchema = {
  type: 'object',
  required: ['persona', 'summary', 'keyPoints'],
  properties: {
    persona: { type: 'string', description: 'identifier, English raw' },
    summary: { type: 'string', description: `render in ${LANG}` },
    keyPoints: { type: 'array', items: { type: 'string', description: `render in ${LANG}` } },
    risks: { type: 'array', items: { type: 'string', description: `render in ${LANG}` } },
    recommendations: { type: 'array', items: { type: 'string', description: `render in ${LANG}` } },
  },
}

const ChangeSetSchema = {
  type: 'object',
  required: ['modifiedFiles', 'summary'],
  properties: {
    modifiedFiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'reason'],
        properties: {
          path: { type: 'string' },
          reason: { type: 'string', description: `brief, render in ${LANG}` },
        },
      },
    },
    createdFiles: { type: 'array', items: { type: 'string' } },
    deletedFiles: { type: 'array', items: { type: 'string' } },
    stepsCompleted: { type: 'integer' },
    stepsTotal: { type: 'integer' },
    advisorFeedbackApplied: { type: 'array', items: { type: 'string', description: `render in ${LANG}` } },
    advisorFeedbackDeclined: { type: 'array', items: { type: 'string', description: `reason included, render in ${LANG}` } },
    summary: { type: 'string', description: `one-line, render in ${LANG}` },
  },
}

// ---- templates (author-time copies) ----------------------------------------
// SYNC-SOURCE: templates/generator/lead_developer.md
// AUTHOR-TIME TRANSFORMS: '## Output' (write plan to {output_path}) + '## Output Contract'
// -> AnalysisResult schema note; constraints line kept.
const TPL_LEAD_DEVELOPER = `# Lead Developer — Implementation Plan

You are the **Lead Developer** translating the spec into a concrete implementation plan following project conventions.

## Task

Create an implementation plan based on the spec below.

## Spec

{spec_content}

## QA Feedback from Previous Round

{qa_feedback}

**Repo:** {repo_path} | **Lang:** {lang} | **Scope:** {scope}

Write all output in **{user_lang}**.

## Instructions

1. **Read the spec carefully.** Understand the goal, scope, approach, and completion criteria.

2. **Explore the codebase.** Read the files in scope. Understand existing patterns, naming conventions, and code style.

3. **Create the implementation plan** with the following sections:

   ### Implementation Order
   Ordered list of files to modify/create, with rationale for the sequence.

   ### File-by-File Plan
   For each file:
   - **Path**: full file path
   - **Action**: create / modify / delete
   - **Summary**: what changes will be made and why
   - **Dependencies**: which other file changes this depends on

   ### Integration Points
   How the changes connect to each other and to existing code.

   ### Risk Mitigation
   How you plan to address the risks identified in the spec.

4. **If this is Round 2 or later:**
   - Review the QA feedback carefully.
   - Only plan fixes for items marked FAIL.
   - Do NOT plan changes for items already marked PASS.

Do NOT write code — plan only. Stay within scope: {scope}. Max files: {max_files}. Be concise.

## Output

Return your plan as a structured object (the dispatching engine enforces the shape):
- \`persona\`: exactly "lead_developer" (English raw)
- \`summary\`: Implementation Order + Integration Points as a short narrative
- \`keyPoints\`: the File-by-File Plan — one string per file: "path — action — what & why — depends on: ..."
- \`risks\`: Risk Mitigation items
- \`recommendations\`: sequencing or review advice for the implementer

All free-text in **{user_lang}**. Do NOT write any file; do NOT emit a 1-line summary.`

// Shared advisor output note.
const FRAG_ADVISOR_OUTPUT = `## Output

Return your review as a structured object (the dispatching engine enforces the shape):
- \`persona\`: exactly "{persona_id}" (English raw)
- \`summary\`: your overall assessment
- \`keyPoints\`: issues/scenarios found — one string per item, prefixed with severity, e.g. "[high] location — issue — suggestion"
- \`risks\`: gaps or failure scenarios that remain if the plan is followed as-is
- \`recommendations\`: prioritized changes to make before implementation

All free-text in **{user_lang}**. Do NOT write any file; do NOT emit a 1-line summary.`

// SYNC-SOURCE: templates/generator/combined_advisor.md (standard mode)
// AUTHOR-TIME TRANSFORMS: Output file-write + Output Contract -> schema note.
const TPL_COMBINED_ADVISOR = `# Combined Advisor — Plan Review

You are a **Combined Advisor** — expert in code quality, anti-patterns, runtime stability, error handling, and testing.

## Spec

{spec_content}

## Implementation Plan to Review

{plan_content}

**Repo:** {repo_path} | **Lang:** {lang} | **Test cmd:** {test_cmd}

Write all output in **{user_lang}**.

## Instructions

1. **Read the implementation plan** carefully.

2. **Explore the existing codebase** — read the files that will be modified to understand current patterns, conventions, and error handling.

3. **Review the plan** from both code quality and stability perspectives:

   **Code Quality:**
   - Does the plan introduce unnecessary complexity or DRY violations?
   - Are there opportunities to reuse existing patterns?
   - Will the changes create inconsistencies with the rest of the codebase?
   - Does the implementation order minimize risk?

   **Stability & Testing:**
   - What runtime failure scenarios are not addressed?
   - Are there operations that could leave inconsistent state if interrupted?
   - Does the plan handle error propagation correctly?
   - Are the planned changes testable? What key test cases are missing?

Do NOT write code. Be specific — reference concrete parts of the plan. Focus on substantive issues, not stylistic nitpicks. Be concise.

${FRAG_ADVISOR_OUTPUT}`

// SYNC-SOURCE: templates/generator/code_quality_advisor.md (multi mode, same transforms)
const TPL_CODE_QUALITY_ADVISOR = `# Code Quality Advisor — Plan Review

You are a **Code Quality Advisor** — expert in code smells, anti-patterns, SOLID violations, and maintainability.

## Spec

{spec_content}

## Implementation Plan to Review

{plan_content}

**Repo:** {repo_path} | **Lang:** {lang}

Write all output in **{user_lang}**.

## Instructions

1. **Read the implementation plan** carefully.

2. **Explore the existing codebase** — read the files that will be modified to understand current patterns and conventions.

3. **Review the plan** from your code quality perspective:
   - Does the file-by-file plan introduce unnecessary complexity?
   - Are there opportunities to reuse existing patterns rather than creating new ones?
   - Will the planned changes create inconsistencies with the rest of the codebase?
   - Are there DRY violations or over-abstractions in the plan?
   - Does the implementation order make sense for minimizing risk?

Do NOT write code. Be specific — reference concrete parts of the plan. Focus on substantive issues, not stylistic nitpicks. Be concise.

${FRAG_ADVISOR_OUTPUT}`

// SYNC-SOURCE: templates/generator/test_stability_advisor.md (multi mode, same transforms)
const TPL_TEST_STABILITY_ADVISOR = `# Test & Stability Advisor — Plan Review

You are a **Test & Stability Advisor** — expert in runtime failures, error handling gaps, and testing blind spots.

## Spec

{spec_content}

## Implementation Plan to Review

{plan_content}

**Repo:** {repo_path} | **Lang:** {lang} | **Test cmd:** {test_cmd}

Write all output in **{user_lang}**.

## Instructions

1. **Read the implementation plan** carefully.

2. **Explore the existing codebase** — read the files that will be modified, paying attention to existing error handling and test patterns.

3. **Review the plan** from your stability perspective:
   - What runtime failure scenarios are not addressed in the plan?
   - Are there operations that could leave inconsistent state if interrupted?
   - Does the plan handle error propagation correctly?
   - What edge cases in input/output are not covered?
   - If tests are available, are the planned changes testable?

Do NOT write code or test code. Focus on substantive reliability risks, not theoretical edge cases. Be actionable and concise.

${FRAG_ADVISOR_OUTPUT}`

// Shared implementation output note.
// AUTHOR-TIME TRANSFORM: replaces 'write changes.md to {changes_path}' + Output Contract —
// the ORCHESTRATOR writes changes.md from the returned ChangeSet.
const FRAG_IMPL_OUTPUT = `## Output

After applying all source edits, return a structured ChangeSet object (the dispatching engine enforces the shape):
- \`modifiedFiles\`: [{path, reason}] — brief reason per file
- \`createdFiles\` / \`deletedFiles\`: paths
- \`stepsCompleted\` / \`stepsTotal\`: plan progress
- \`advisorFeedbackApplied\`: accepted suggestions and how applied
- \`advisorFeedbackDeclined\`: declined suggestions with brief rationale
- \`summary\`: one line

Free-text in **{user_lang}**; paths raw. Do NOT write changes.md yourself — the orchestrator writes it from this object. The source-file edits themselves ARE your job.`

// SYNC-SOURCE: templates/generator/implementation_standard.md (standard mode)
// AUTHOR-TIME TRANSFORMS: 'subagent-driven-development / dispatching-parallel-agents' skill
// search removed (engine nesting is 1-level — no nested fan-out from a workflow agent);
// step 6 changes.md write + Output Contract -> ChangeSet schema note.
const TPL_IMPLEMENTATION_STANDARD = `# Lead Developer — Implementation (Standard Mode)

You are the **Lead Developer** executing the implementation. You have the spec, plan, and advisor feedback.

## Spec

{spec_content}

## Implementation Plan

{plan_content}

## Advisor Feedback

### Combined Advisor Review
{advisor_review}

## QA Feedback from Previous Round

{qa_feedback}

**Repo:** {repo_path} | **Lang:** {lang} | **Scope:** {scope}

Write all output in **{user_lang}**.

## Available Skills

Search installed skills by keyword and invoke matches. Do not require specific plugin names.
Search for "tdd" (if tests available) and invoke if found.
If no matching skill is found, proceed without it.

## Instructions

1. **Review advisor feedback.** Before writing any code, process the feedback:
   - Accept suggestions that are high-severity or improve reliability.
   - Note but deprioritize low-severity style suggestions that conflict with existing patterns.

2. **Pre-implementation scope check** (skip if scope is "(no limit)"):
   - List all files you plan to modify or create.
   - For each file, verify it matches the scope pattern: {scope}
   - If any file falls outside scope, adjust your plan before writing any code.

3. **Implement** — follow the plan, incorporating accepted advisor feedback.

4. **TDD** — if a TDD skill was found above, follow it: write a failing test, then implement, then verify. Run tests after each change.

5. **If this is Round 2 or later:**
   - Review the QA feedback above carefully.
   - **Only fix items marked FAIL** in the QA report.
   - **Do not touch items already marked PASS.**
   - Surgical, minimal changes only.

## Verification Failure (Retry Only)

{verify_failure}

If verification failure information is provided above (not empty), read \`{verify_report_path}\` for detailed errors.
Fix ONLY the items that failed verification. Do NOT rewrite code that already works.

## Constraints

Stay within scope: {scope}. Max files: {max_files}. Keep changes minimal and focused. Follow existing code style and patterns. No new dependencies unless required by spec.

${FRAG_IMPL_OUTPUT}`

// SYNC-SOURCE: templates/generator/implementation.md (multi mode, same transforms)
const TPL_IMPLEMENTATION_MULTI = `# Lead Developer — Implementation

You are the **Lead Developer** executing the implementation. You have the spec, plan, and advisor feedback.

## Spec

{spec_content}

## Implementation Plan

{plan_content}

## Advisor Feedback

### Code Quality Review
{code_quality_review}

### Test & Stability Review
{test_stability_review}

## QA Feedback from Previous Round

{qa_feedback}

**Repo:** {repo_path} | **Lang:** {lang} | **Scope:** {scope}

Write all output in **{user_lang}**.

## Available Skills

Search installed skills by keyword and invoke matches. Do not require specific plugin names.
Search for "tdd" (if tests available) and invoke if found.
If no matching skill is found, proceed without it.

## Instructions

1. **Review advisor feedback.** Before writing any code, process the feedback from both advisors:
   - Accept suggestions that are high-severity or improve reliability.
   - Note but deprioritize low-severity style suggestions that conflict with existing patterns.
   - If advisors contradict each other, favor the position that minimizes runtime risk.

2. **Pre-implementation scope check** (skip if scope is "(no limit)"):
   - List all files you plan to modify or create.
   - For each file, verify it matches the scope pattern: {scope}
   - If any file falls outside scope, adjust your plan before writing any code.

3. **Implement** — follow the plan, incorporating accepted advisor feedback.

4. **TDD** — if a TDD skill was found above, follow it: write a failing test, then implement, then verify. Run tests after each change.

5. **If this is Round 2 or later:**
   - Review the QA feedback above carefully.
   - **Only fix items marked FAIL** in the QA report.
   - **Do not touch items already marked PASS.**
   - Surgical, minimal changes only.

## Verification Failure (Retry Only)

{verify_failure}

If verification failure information is provided above (not empty), read \`{verify_report_path}\` for detailed errors.
Fix ONLY the items that failed verification. Do NOT rewrite code that already works.

## Constraints

Stay within scope: {scope}. Max files: {max_files}. Keep changes minimal and focused. Follow existing code style and patterns. No new dependencies unless required by spec.

${FRAG_IMPL_OUTPUT}`

// ---- digest helpers ---------------------------------------------------------
const fmtList = (title, items) =>
  items && items.length ? `\n\n**${title}:**\n${items.map((s) => `- ${s}`).join('\n')}` : ''
const digest = (r) =>
  r
    ? `${r.summary}${fmtList('Key points', r.keyPoints)}${fmtList('Risks', r.risks)}${fmtList('Recommendations', r.recommendations)}`
    : '(advisor unavailable)'

// ---- Phases 1+2: plan + advise (skipped on retry — no re-plan, no re-review) -
let planDigest = A.planDigest || ''
let advisorDigests = A.advisorDigests || {}

if (!A.retry) {
  phase('Plan')
  const implPlan = await agent(
    render(TPL_LEAD_DEVELOPER, {
      repo_path: A.repoPath,
      lang: A.lang,
      scope: A.scope,
      max_files: A.maxFiles,
      user_lang: A.userLang,
      qa_feedback: A.qaFeedback,
      spec_content: A.specContent,
    }),
    { schema: AnalysisResultSchema, label: 'lead_developer', phase: 'Plan', ...mopt(MODELS.executor) },
  )
  planDigest = digest(implPlan)
  // Fold the File-by-File plan's target paths into the digest as an explicit
  // inventory, so advisors + the implementer (and retry passes, which reuse this
  // digest verbatim) can open those files directly instead of each re-running
  // broad codebase discovery. keyPoints format per TPL_LEAD_DEVELOPER:
  // "path — action — what & why — depends on: ...", so the path is the first
  // ' — '/' - '-delimited segment. Soft hint only — malformed entries are filtered.
  const planFiles =
    implPlan && Array.isArray(implPlan.keyPoints)
      ? implPlan.keyPoints
          .map((kp) => String(kp).split(/\s[—-]\s/)[0].trim())
          .filter((p) => p && p.length <= 200)
      : []
  if (planFiles.length) {
    planDigest +=
      '\n\n**Files the plan targets** (read these directly to ground your work; ' +
      'do not re-run broad codebase discovery to locate them):\n' +
      planFiles.map((p) => `- ${p}`).join('\n')
  }
  log('Plan: implementation plan ready')

  phase('Advise')
  const advisorDefs =
    A.mode === 'multi'
      ? [
          { id: 'code_quality_advisor', tpl: TPL_CODE_QUALITY_ADVISOR, key: 'quality' },
          { id: 'test_stability_advisor', tpl: TPL_TEST_STABILITY_ADVISOR, key: 'stability' },
        ]
      : [{ id: 'combined_advisor', tpl: TPL_COMBINED_ADVISOR, key: 'combined' }]
  const reviews = await parallel(
    advisorDefs.map((d) => () =>
      agent(
        render(d.tpl, {
          repo_path: A.repoPath,
          lang: A.lang,
          test_cmd: A.testCmd,
          user_lang: A.userLang,
          persona_id: d.id,
          plan_content: planDigest,
          spec_content: A.specContent,
        }),
        { schema: AnalysisResultSchema, label: d.id, phase: 'Advise', ...mopt(MODELS.advisor) },
      ),
    ),
  )
  advisorDigests = {}
  advisorDefs.forEach((d, i) => {
    advisorDigests[d.key] = digest(reviews[i])
  })
  log(`Advise: ${reviews.filter(Boolean).length}/${advisorDefs.length} advisory reviews`)
} else {
  log('Retry entry: skipping Plan/Advise (single implementation pass)')
}

// ---- Phase 3: implementation -------------------------------------------------
phase('Implement')
// Structural keys first; model-output digests then user-influenced spec content LAST.
const implVars = {
  repo_path: A.repoPath,
  lang: A.lang,
  scope: A.scope,
  max_files: A.maxFiles,
  user_lang: A.userLang,
  verify_report_path: A.verifyReportPath || '',
  verify_failure: A.verifyFailure || '',
  qa_feedback: A.qaFeedback,
}
const changes =
  A.mode === 'multi'
    ? await agent(
        render(TPL_IMPLEMENTATION_MULTI, {
          ...implVars,
          code_quality_review: advisorDigests.quality || '(advisor unavailable)',
          test_stability_review: advisorDigests.stability || '(advisor unavailable)',
          plan_content: planDigest,
          spec_content: A.specContent,
        }),
        { schema: ChangeSetSchema, label: 'implementation', phase: 'Implement', ...mopt(MODELS.executor) },
      )
    : await agent(
        render(TPL_IMPLEMENTATION_STANDARD, {
          ...implVars,
          advisor_review: advisorDigests.combined || '(advisor unavailable)',
          plan_content: planDigest,
          spec_content: A.specContent,
        }),
        { schema: ChangeSetSchema, label: 'implementation', phase: 'Implement', ...mopt(MODELS.executor) },
      )

log(`Implement: ${(changes.modifiedFiles || []).length} modified, ${(changes.createdFiles || []).length} created`)

// Orchestrator writes changes.md from `changes`, stores the digests in state.json
// (reused verbatim on retry entries), then proceeds to harness.eval.
return { changes, planDigest, advisorDigests }
