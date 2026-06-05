// debug.analyze.workflow.js — Analyze segment of /debug deep mode (WORKFLOW path).
// Autonomous span: 2 independent analysts (parallel, anchoring-free) -> ADVERSARIAL
// cross-verify synthesis. Returns { rootCause: RootCause, stats }.
// Runs AFTER Phase 0.7 (reproduction), BEFORE the Fix Decision gate — all human gates
// are rendered by the orchestrator (skills/debug/SKILL.md), never here. The orchestrator
// writes root_cause.md from the returned object, then presents the Fix Decision gate.
//
// Engine shape (per docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md):
//   top-level body, hooks are globals, NO import/export besides the meta literal (SPIKE-F2),
//   args arrives as a JSON string (SPIKE-F1), meta.phases = [{title, detail}] (SPIKE-F5),
//   no agentType (SPIKE-F3), no Date/random (resume), schemas/templates inlined (C1).
export const meta = {
  name: 'debug.analyze',
  description: '/debug deep-mode Analyze segment: 2 independent analysts in parallel, then an adversarial cross-verify that tries to refute the surviving hypothesis. Spawns 3 sub-agents. Read-only — no source files are modified.',
  phases: [
    { title: 'Analyze', detail: 'independent analysts (parallel, anchoring-free)' },
    { title: 'Cross-verify', detail: 'adversarial synthesis into one RootCause' },
  ],
}

// ---- args (SPIKE-F1: defensive parse) -------------------------------------
// contract — keep 1:1 with skills/debug/SKILL.md Phase 1-D WORKFLOW dispatch (a field
// missing on either side silently renders as ''):
//   { errorDescription, stackTrace, repoPath, userLang, hasGit: bool,
//     contextMd, errorType: 'build'|'runtime'|'logic', models: {advisor} }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const LANG = A.userLang || 'the language of the error description'
const MODELS = A.models || {}
const mopt = (m) => (m ? { model: m } : {}) // null/undefined -> inherit parent model

// Substitution order = vars insertion order. Keep STRUCTURAL keys first and
// user-influenced payload keys LAST (error description / stack trace last of all):
// a payload substituted early could otherwise hijack later {placeholders}.
const render = (tpl, vars) =>
  Object.entries(vars).reduce(
    (t, [k, v]) => t.split('{' + k + '}').join(v == null ? '' : String(v)),
    tpl,
  )

// ---- schemas (inlined per C1; canonical: workflows/_reference/schemas.md) ----
// Hypothesis.verification minItems:1 enforces the executable-verification mandate at the
// schema layer — the rule the prose could only assert.
const HypothesisSchema = {
  type: 'object',
  required: ['claim', 'confidence', 'status', 'verification'],
  properties: {
    claim: { type: 'string', description: `one-sentence hypothesis, render in ${LANG}` },
    confidence: { enum: ['High', 'Medium', 'Low'] },
    status: { enum: ['ACTIVE', 'REFUTED', 'CONFIRMED'] },
    falsificationQuestion: { type: 'string', description: `"if this is wrong, what evidence should exist?", render in ${LANG}` },
    verification: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['action', 'output', 'conclusion'],
        properties: {
          action: { type: 'string', description: 'exact Grep/file-read/git/test command used — raw, not translated' },
          output: { type: 'string', description: 'captured output, truncated to relevant lines, raw' },
          conclusion: { enum: ['Supports', 'Refutes', 'Inconclusive'] },
        },
      },
    },
  },
}

const DebugAnalysisSchema = {
  type: 'object',
  required: ['persona', 'summary', 'hypotheses', 'preliminaryRootCause', 'confidence'],
  properties: {
    persona: { type: 'string', description: 'identifier, English raw' },
    summary: { type: 'string', description: `key observations from this analyst's lens, render in ${LANG}` },
    hypotheses: { type: 'array', minItems: 1, items: HypothesisSchema },
    preliminaryRootCause: { type: 'string', description: `most likely root cause based on verification evidence only, render in ${LANG}` },
    confidence: { enum: ['High', 'Medium', 'Low'] },
    affectedLocation: { type: 'string', description: 'file:line (or commit hash / dependency), raw' },
    keyEvidence: { type: 'string', description: `the verification result that most strongly supports the conclusion, render in ${LANG}` },
    openQuestions: { type: 'array', items: { type: 'string', description: `unverifiable angles, render in ${LANG}` } },
  },
}

const RootCauseSchema = {
  type: 'object',
  required: ['rootCause', 'confidence', 'affectedLocations', 'hypotheses', 'summary'],
  properties: {
    rootCause: { type: 'string', description: `2-4 sentence actionable root cause citing file:line/function/commit, render in ${LANG}` },
    confidence: { enum: ['High', 'Medium', 'Low', 'Unknown'] },
    confidenceRationale: { type: 'array', items: { type: 'string', description: `render in ${LANG}` } },
    errorType: { enum: ['build', 'runtime', 'logic'] },
    reproduction: { type: 'string', description: `reproduction conditions, or state that it was not reproduced (log/environment analysis), render in ${LANG}` },
    affectedLocations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          description: { type: 'string', description: `render in ${LANG}` },
        },
      },
    },
    agreementPoints: { type: 'array', items: { type: 'string', description: `where both analysts independently converged, render in ${LANG}` } },
    conflictsResolved: {
      type: 'array',
      items: {
        type: 'object',
        required: ['topic', 'resolution'],
        properties: {
          topic: { type: 'string', description: `what the analysts disagreed on, render in ${LANG}` },
          verificationAction: { type: 'string', description: 'exact command used to resolve, raw' },
          resolution: { type: 'string', description: `which claim won and why, render in ${LANG}` },
        },
      },
    },
    adversarialAudit: { type: 'string', description: `the fresh falsification attempt(s) on the surviving hypothesis and the outcome, render in ${LANG}` },
    hypotheses: { type: 'array', items: HypothesisSchema },
    recommendedFixDirection: { type: 'string', description: `conceptual fix direction, no code, render in ${LANG}` },
    summary: { type: 'string', description: `one-line progress msg, render in ${LANG}` },
  },
}

// ---- shared template fragments (author-time copies) ------------------------
// SYNC-SOURCE: templates/_shared/falsification_rules.md (v1) — HTML BLOCK marker
// comments stripped. The canonical 5 rules; appended to both analyst prompts so the
// analyst templates never carry their own copy.
const FRAG_FALSIFICATION = `## Falsification Rules (Core Differentiator)

Every hypothesis MUST be tested with executable verification actions. Pure reasoning-only falsification is **PROHIBITED**.

1. Record every hypothesis BEFORE verifying it — in \`.harness/debug/hypotheses.md\` on the inline path, or in the \`hypotheses[]\` field of your structured return when running as a workflow-segment analyst.
2. For each hypothesis, formulate: **"If this hypothesis is WRONG, what evidence should exist in the code?"**
3. Execute **at least 1 verification action** per hypothesis:
   - Code search (Grep/Glob): check for specific patterns that should or should not exist
   - \`git blame\`/\`git log\`: check change history of the relevant file/function (only if git is available)
   - Test execution: run specific targeted tests to verify expected behavior
   - File read: check config files, environment variables, dependency versions
4. **Adjust confidence ONLY based on verification action results**, not reasoning.
5. Mark refuted hypotheses as \`[REFUTED]\` with the evidence that refuted them.`

// Shared analyst context + output note.
// AUTHOR-TIME TRANSFORM: replaces the .md '## Output' (file write to {output_path}) —
// dead under schema-enforced returns. The Shared Context section is segment-supplied
// (context.md content collected by the orchestrator in Phase 1-D step 1).
const FRAG_DEBUG_OUTPUT = `## Output

Return your analysis as a structured object (the dispatching engine enforces the shape):
- \`persona\`: exactly "{persona_id}" (English raw)
- \`summary\`: your key observations (error pattern / change history), 3-8 sentences
- \`hypotheses\`: exactly the 3 hypotheses you generated, each with \`claim\`, \`confidence\` (High|Medium|Low), final \`status\` (ACTIVE|REFUTED — CONFIRMED only with direct conclusive evidence), \`falsificationQuestion\`, and \`verification[]\` — at least 1 entry per hypothesis with the exact \`action\` you ran, its \`output\` (truncated to relevant lines), and a \`conclusion\` (Supports|Refutes|Inconclusive)
- \`preliminaryRootCause\`: your most likely root cause, based on verification evidence only
- \`confidence\`: overall confidence in that preliminary conclusion
- \`affectedLocation\`: file:line (or commit hash / dependency), raw
- \`keyEvidence\`: the single verification result that most strongly supports your conclusion
- \`openQuestions\`: angles you could not verify

Free-text in **{user_lang}**; commands, paths, enums, and identifiers English raw.
Do NOT write any file; do NOT emit a 1-line summary.`

// ---- analyst templates (author-time copies) ---------------------------------
// SYNC-SOURCE: templates/debug/error_analyst.md
// AUTHOR-TIME TRANSFORMS: §4 falsification restatement -> pointer to the appended
// canonical block; '## Output' file-write structure -> FRAG_DEBUG_OUTPUT schema note;
// {output_path} dropped; Shared Context + explicit git availability line added.
const TPL_ERROR_ANALYST = `# Error Analyst

## Identity

You are the **Error Analyst** — a specialist in stack traces, error messages, log patterns, and runtime failure signatures. Your job is to analyze the error from its symptoms: what the error says, where it occurs, and what code paths lead to it.

## Assignment

**Error description:** {error_description}

**Stack trace / log output:**
{stack_trace}

**Repository:** {repo_path} | **Git available:** {has_git}

## Shared Context

{shared_context}

## Output Language

Write all output in **{user_lang}**.

## Instructions

### 1. Parse the Error

Examine the error description and stack trace carefully:
- Identify the exact error type (exception class, error code, signal, etc.)
- Identify the entry point of the failure (topmost relevant frame in the stack trace)
- Identify the innermost failure point (lowest frame in the stack trace)
- Note any error codes, HTTP status codes, or errno values

### 2. Explore Relevant Source Files

Navigate to the files identified in the stack trace:
- Read the failing function and its immediate callers
- Check error handling paths around the failure point
- Look for null/undefined checks, bounds checks, type assertions
- Read any config files or constants referenced by the failing code

### 3. Generate 3 Hypotheses

Based on your reading of the error and source code, generate exactly 3 hypotheses. Assign each a confidence level based solely on what you have read so far (before verification):

- **Hypothesis 1:** High confidence — the most likely cause based on the error pattern
- **Hypothesis 2:** Medium confidence — a plausible alternative explanation
- **Hypothesis 3:** Low confidence — a less likely but possible cause

For each hypothesis, immediately formulate the falsification question:
> "If this hypothesis is **WRONG**, what evidence should exist in the code?"

### 4. Execute Verification Actions

Apply the canonical Falsification Rules appended below this template. For each hypothesis, execute at least 1 verification action — symptom-side actions you may use:

- **Grep/Glob search:** Search for specific patterns, function names, variable names that should or should not exist if the hypothesis is true
- **File read:** Read config files, environment variable definitions, dependency version files
- **git blame / git log:** Check when the relevant file or function was last changed and by what commit (only if git is available)
- **Targeted test run:** If a specific test covers the failing code path, note it (do not execute long test suites)

Record the exact command or tool call used, and its output, for each verification action.

### 5. Adjust Confidence Based on Evidence

After executing verification actions:
- If evidence SUPPORTS the hypothesis → maintain or raise confidence
- If evidence CONTRADICTS the hypothesis → mark as \`REFUTED\` with the specific evidence that refuted it
- Do NOT adjust confidence based on reasoning alone — only based on verification action results

## Constraints

- You are running INDEPENDENTLY. You have NO access to the Code Archaeologist's output. Do not attempt to find it — it does not exist in your workspace.
- Do NOT modify any source files. Read-only analysis only.
- Every confidence adjustment MUST cite a specific verification action result. "I believe..." or "It seems likely..." without evidence is not acceptable.
- Mark refuted hypotheses as \`REFUTED\` — do not drop them. The cross-verifier needs your full reasoning.
- If git is not available, skip git blame/log actions and use Grep/file reads instead.
- Be concise in verification output — capture the relevant lines, not entire file dumps.

${FRAG_DEBUG_OUTPUT}`

// SYNC-SOURCE: templates/debug/code_archaeologist.md (same transforms)
const TPL_CODE_ARCHAEOLOGIST = `# Code Archaeologist

## Identity

You are the **Code Archaeologist** — a specialist in git history, code change timelines, dependency evolution, and the archaeology of how code arrived at its current state. Your job is to answer: *what changed recently that could have caused this error?*

## Assignment

**Error description:** {error_description}

**Repository:** {repo_path} | **Git available:** {has_git}

## Shared Context

{shared_context}

## Output Language

Write all output in **{user_lang}**.

## Instructions

### 1. Trace Recent Changes

Navigate the repository's change history to find what was modified recently in areas relevant to the error:

- Run \`git log --oneline -20\` to see recent commits
- Identify commits that touched files related to the error description (search by filename, module name, or keyword in commit messages)
- For each relevant commit, run \`git show <hash> --stat\` to see which files changed
- For the most relevant files, run \`git blame <file>\` to see line-by-line authorship and recency

If git is not available, use Grep to look for recently modified patterns:
- Check modification timestamps via file system where available
- Look for version bumps in lock files (\`package-lock.json\`, \`Cargo.lock\`, \`go.sum\`, etc.)
- Compare dependency versions in manifest files

### 2. Analyze Dependency Changes

Check whether any dependencies changed recently:
- Read \`package.json\` / \`pyproject.toml\` / \`build.gradle\` / \`go.mod\` / \`Cargo.toml\` for version pins
- If a lock file exists, check git log for recent changes to the lock file
- Identify any major version bumps in dependencies related to the error domain

### 3. Generate 3 Independent Hypotheses

Based on your change history and dependency investigation, generate exactly 3 hypotheses. These must be **independent from any other analyst's output** — generate them from your own findings only.

Assign each a confidence level based on the change history evidence:

- **Hypothesis 1:** High confidence — a recent change most likely to have introduced the error
- **Hypothesis 2:** Medium confidence — an alternative recent change that could have caused it
- **Hypothesis 3:** Low confidence — a dependency or config change that might be related

For each hypothesis, immediately formulate the falsification question:
> "If this hypothesis is **WRONG**, what evidence should exist in the change history or code?"

### 4. Execute Verification Actions

Apply the canonical Falsification Rules appended below this template. For each hypothesis, execute at least 1 verification action — change-history actions you may use:

- **git blame:** Verify which commit introduced the specific line or function under suspicion
- **git log -p \`<file>\`:** Check the actual diff of recent changes to a specific file
- **git show \`<hash>\`:** Inspect the full content of a specific commit
- **Grep/Glob:** Search for patterns in the codebase that would be present or absent if the hypothesis is true
- **File read:** Read dependency manifests, config files, changelog files

Record the exact command used and its output.

### 5. Adjust Confidence Based on Evidence

After executing verification actions:
- If a commit is identified that directly introduced the error pattern → raise confidence, cite the commit hash
- If the relevant code has not changed recently → this weakens "recent change" hypotheses
- If a dependency version bump aligns with the error onset → raise confidence
- Mark refuted hypotheses as \`REFUTED\` with specific evidence

## Constraints

- You are running INDEPENDENTLY. You have NO access to the Error Analyst's output. Do NOT attempt to find it — it does not exist in your workspace. Reading another analyst's output would introduce anchoring bias and invalidate the cross-verification phase.
- Do NOT modify any source files. Read-only analysis only.
- Every confidence adjustment MUST cite a specific verification action result (a commit hash, a grep match, a file timestamp). "The code looks like it changed recently" without evidence is not acceptable.
- Mark refuted hypotheses as \`REFUTED\` — do not drop them. The cross-verifier needs your full reasoning trail.
- If git is not available, state this clearly in your summary, then rely entirely on Grep and file reads for your analysis.
- Keep verification output concise — relevant lines only, not full file dumps.

${FRAG_DEBUG_OUTPUT}`

// ---- cross-verification template (author-time copy) --------------------------
// SYNC-SOURCE: templates/debug/cross_verification.md
// AUTHOR-TIME TRANSFORMS: §4 "Determine Final Root Cause" -> ADVERSARIAL verification
// (actively try to refute the surviving hypothesis with a fresh action, max 2 rounds);
// §5 + '## Output' markdown-file block ({root_cause_path}) -> RootCause schema note
// (the ORCHESTRATOR writes root_cause.md from the returned object).
const TPL_CROSS_VERIFICATION = `# Cross Verifier — Adversarial Synthesis

## Identity

You are the **Cross Verifier** — a synthesis specialist who reconciles two independent root cause analyses into a single authoritative conclusion. You were not involved in either analysis. Your job is to find where the analysts agree, where they conflict, resolve conflicts with additional evidence, adversarially audit the surviving conclusion, and return the definitive root cause.

## Error Context

**Error type:** {error_type} | **Repository:** {repo_path} | **Git available:** {has_git}

## Input Analyses

### Error Analyst Output
{error_analyst_output}

### Code Archaeologist Output
{archaeologist_output}

## Output Language

Write all output in **{user_lang}**.

## Instructions

### 1. Compare Hypotheses from Both Analysts

Map out every hypothesis proposed by each analyst:
- List all hypotheses that were ACTIVE (not refuted) at the end of each analyst's work
- List all hypotheses that were REFUTED and note the refuting evidence
- Identify **Agreement Points**: hypotheses or conclusions that both analysts reach independently
- Identify **Conflicts**: hypotheses where the two analysts point to different root causes

### 2. Identify Agreements

Agreements between two independent analysts who used different methods (symptom analysis vs. change history) carry significantly higher confidence than either analysis alone. For each agreement:
- State what both analysts concluded
- Note that convergence from independent methods increases confidence
- Record this as a **high-confidence finding**

### 3. Resolve Conflicts

For each conflict between the analysts:
- State exactly what Analyst A claims vs. what Analyst B claims
- Formulate a resolution question: "What evidence would resolve this conflict?"
- **Execute at least 1 additional verification action** to resolve the conflict:
  - Grep for specific patterns that one hypothesis predicts and the other does not
  - Read the specific file or function both analysts reference
  - Run \`git log\` on the specific commit one analyst cited (if git available)
  - Check config or environment values that differentiate the hypotheses
- Record the verification action, its output, and which hypothesis it supports
- Mark the winning hypothesis and the losing hypothesis (do not leave conflicts unresolved)

### 4. Adversarial Verification (assume the surviving hypothesis is WRONG)

Take the highest-confidence surviving hypothesis and treat it as a defect to disprove:
- Formulate: "If this root cause is WRONG, what evidence would contradict it?"
- Execute at least 1 FRESH verification action (not one either analyst already ran) to attempt falsification.
- If the action fails to refute it → the confidence is justified (cite the surviving evidence).
- If the action refutes it → drop to the next surviving hypothesis and repeat (max 2 adversarial rounds).
- If all hypotheses are refuted under adversarial pressure → \`confidence: "Unknown"\`, document the refuted paths and recommend further investigation.

### 5. Return the Root Cause (structured)

Do NOT write a file. Return a single RootCause object via structured output (the dispatching engine enforces the shape):
- \`rootCause\`: 2-4 sentence actionable description (cite file paths, function names, line numbers, and/or commit hashes — a developer reading only this must know exactly what to fix)
- \`confidence\`: High | Medium | Low | Unknown, with \`confidenceRationale\` — one string per reason
- \`errorType\`: exactly "{error_type}" (English raw)
- \`reproduction\`: reproduction conditions from the Error Analyst, or state that it was not reproduced (log/environment analysis)
- \`affectedLocations\`: [{ file, line, description }] — specific file:line references, not vague module names
- \`agreementPoints\`: where both analysts independently converged (high-confidence signal)
- \`conflictsResolved\`: [{ topic, verificationAction, resolution }] — each analyst conflict + the action that resolved it
- \`adversarialAudit\`: the fresh falsification attempt(s) from Step 4 and the outcome
- \`hypotheses\`: every hypothesis from both analysts at its final status (ACTIVE/REFUTED/CONFIRMED), carrying the analysts' verification actions plus your conflict-resolution and adversarial actions where they apply
- \`recommendedFixDirection\`: 1-3 sentences, conceptual level, NO code — the orchestrator assesses fix complexity from this
- \`summary\`: one-line progress message

Free-text in **{user_lang}**; commands, paths, enums, ids English raw.
The orchestrator writes root_cause.md from this object — you do not write any file.

## Constraints

- You have read BOTH analysts' outputs. This is intentional — your job requires seeing both to find conflicts. However, do NOT synthesize by simply averaging the two. Conflicts must be resolved with additional verification actions, not by splitting the difference.
- Do NOT modify any source files. Read-only analysis only.
- Every conflict resolution MUST include an additional verification action. "Analyst A seems more thorough" is not a resolution.
- If both analysts refuted all their own hypotheses, return \`confidence: "Unknown"\` and document all refuted paths. Do not fabricate a conclusion.
- Be concise. The rootCause field should be 2-4 sentences.`

// ---- Phase 1: independent analysts (anchoring-free fan-out) ------------------
phase('Analyze')

const ANALYSTS = [
  { id: 'error_analyst', tpl: TPL_ERROR_ANALYST },
  { id: 'code_archaeologist', tpl: TPL_CODE_ARCHAEOLOGIST },
]

// Structural keys first; user-influenced payloads last (stack trace + error description
// last of all — they are raw user/runtime text).
const rawAnalyses = await parallel(
  ANALYSTS.map((p) => () =>
    agent(
      render(p.tpl, {
        persona_id: p.id,
        repo_path: A.repoPath,
        has_git: A.hasGit ? 'true' : 'false',
        user_lang: A.userLang,
        shared_context: A.contextMd,
        stack_trace: A.stackTrace,
        error_description: A.errorDescription,
      }) + `\n\n---\n\n${FRAG_FALSIFICATION}`,
      { schema: DebugAnalysisSchema, label: p.id, phase: 'Analyze', ...mopt(MODELS.advisor) },
    ),
  ),
)
const analyses = rawAnalyses.filter(Boolean)
log(`Analyze: ${analyses.length}/${ANALYSTS.length} independent analyses (${ANALYSTS.map((p) => p.id).join(', ')})`)
if (analyses.length === 0) {
  throw new Error('debug.analyze: both analyst agents failed — orchestrator should fall back to the inline quick path')
}

// ---- Phase 2: adversarial cross-verify synthesis ------------------------------
phase('Cross-verify')

const fmtList = (title, items) =>
  items && items.length ? `\n\n**${title}:**\n${items.map((s) => `- ${s}`).join('\n')}` : ''
const fmtHypothesis = (h, i) =>
  `### Hypothesis ${i + 1} — ${h.status} — ${h.confidence} confidence
**Claim:** ${h.claim}
**Falsification question:** ${h.falsificationQuestion || '(not stated)'}
**Verification:**
${(h.verification || []).map((v) => `- \`${v.action}\` → ${v.conclusion} — ${v.output}`).join('\n')}`
const digest = (a) =>
  a
    ? `${a.summary}

**Preliminary root cause (${a.confidence}):** ${a.preliminaryRootCause}${a.affectedLocation ? `
**Affected location:** ${a.affectedLocation}` : ''}${a.keyEvidence ? `
**Key evidence:** ${a.keyEvidence}` : ''}

${(a.hypotheses || []).map(fmtHypothesis).join('\n\n')}${fmtList('Open questions', a.openQuestions)}`
    : '(analyst unavailable — weigh the surviving analysis on its own evidence, and note the missing lens in confidenceRationale)'

const byPersona = {}
analyses.forEach((a) => {
  byPersona[a.persona] = a
})

const rootCause = await agent(
  render(TPL_CROSS_VERIFICATION, {
    error_type: A.errorType,
    repo_path: A.repoPath,
    has_git: A.hasGit ? 'true' : 'false',
    user_lang: A.userLang,
    error_analyst_output: digest(byPersona.error_analyst),
    archaeologist_output: digest(byPersona.code_archaeologist),
  }),
  { schema: RootCauseSchema, label: 'cross_verify', phase: 'Cross-verify', ...mopt(MODELS.advisor) },
)
log(`Cross-verify: ${rootCause.confidence}${rootCause.summary ? ' — ' + rootCause.summary : ''}`)

// RootCause is schema-validated -> NO 1-line parsing, NO file re-read. The orchestrator
// writes root_cause.md from this object (resume source), then renders the Fix Decision
// gate.
return {
  rootCause,
  stats: { analystsRequested: ANALYSTS.length, analystsSucceeded: analyses.length },
}
