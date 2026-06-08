// refactor.plan.workflow.js — Plan segment of /refactor multi/comprehensive (WORKFLOW path).
// Autonomous span: 2-3 independent analysts (parallel, anchoring-free) ->
// (comprehensive only) cross-critique -> synthesis into a RefactorPlan (the
// refactor_plan.md source object). Returns { plan, stats }.
// Ends BEFORE the Plan Confirmation gate — that gate, the per-step regression gates,
// the Safety Advisor, and the auto-fix flow ALL stay in the orchestrator
// (skills/refactor/SKILL.md); execution is never scripted. The ORCHESTRATOR writes
// refactor_plan.md from the returned object.
//
// Engine shape (per docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md):
//   top-level body, hooks are globals, NO import/export besides the meta literal (SPIKE-F2),
//   args arrives as a JSON string (SPIKE-F1), meta.phases = [{title, detail}] (SPIKE-F5),
//   no agentType (SPIKE-F3), no Date/random (resume), schemas/templates inlined (C1).
export const meta = {
  name: 'refactor.plan',
  description: '/refactor plan segment: 2-3 independent analysts in parallel (multi: structural+risk, comprehensive: +feasibility), cross-critique in comprehensive mode, then synthesis into a structured refactoring plan. Read-only — no source files are modified, no files are written.',
  phases: [
    { title: 'Analyze', detail: 'independent analysts (parallel, anchoring-free)' },
    { title: 'Critique', detail: 'cross-critique of the other analyses (comprehensive)' },
    { title: 'Synthesize', detail: 'merge into one RefactorPlan (refactor_plan.md source)' },
  ],
}

// ---- args (SPIKE-F1: defensive parse) -------------------------------------
// contract — keep 1:1 with skills/refactor/SKILL.md Step 2-W WORKFLOW dispatch (a field
// missing on either side silently renders as ''):
//   { target, repoPath, lang, scope, userLang, context, testCmd,
//     baselineTestResults, mode: 'multi'|'comprehensive', models: {executor, advisor} }
// `context` is the CONTENT of .harness/context.md (orchestrator-collected — this script
// never reads a path).
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const LANG = A.userLang || 'the language of the refactoring target description'
const MODELS = A.models || {}
const mopt = (m) => (m ? { model: m } : {}) // null/undefined -> inherit parent model

// Substitution order = vars insertion order. Keep STRUCTURAL keys first and
// user-influenced payload keys LAST (target description last of all): a payload
// substituted early could otherwise hijack later {placeholders}.
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

// Refactor additive delta vs the canonical PlanResult (required: goal/acceptanceCriteria/
// risks): every rendered refactor_plan.md section is schema-REQUIRED (wf_75de1836 lesson —
// prose-only "populate all sections" gets skipped for schema-optional fields). `steps` is
// promoted (+ required risk/files per item); currentState/impactScope/testCoverage are
// refactor-only additions. Arrays may be empty — required means present, not non-empty;
// the orchestrator renders "N/A" for an empty testCoverage.
const RefactorPlanSchema = {
  type: 'object',
  required: ['goal', 'currentState', 'impactScope', 'steps', 'testCoverage', 'acceptanceCriteria', 'risks'],
  properties: {
    goal: { type: 'string', description: `structural improvement being achieved, behavior preserved — render in ${LANG}` },
    currentState: { type: 'string', description: `structural problems in the target code with file paths and line ranges — never empty, render in ${LANG}` },
    impactScope: {
      type: 'object',
      required: ['direct', 'indirect'],
      properties: {
        direct: { type: 'array', items: { type: 'string' }, description: 'files to be directly modified, raw paths' },
        indirect: { type: 'array', items: { type: 'string' }, description: 'dependents indirectly affected, raw paths' },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['n', 'description', 'files', 'risk'],
        properties: {
          n: { type: 'integer' },
          description: { type: 'string', description: `atomic, independently testable, behavior-preserving — render in ${LANG}` },
          files: { type: 'array', items: { type: 'string' } },
          testImpact: { type: 'string', description: `expected test result after this step, render in ${LANG}` },
          risk: { enum: ['low', 'med', 'high'] },
        },
      },
    },
    testCoverage: {
      type: 'array',
      items: {
        type: 'object',
        required: ['target', 'coverage'],
        properties: {
          target: { type: 'string', description: 'file/function under assessment, raw' },
          coverage: { enum: ['good', 'partial', 'none'] },
          gapAction: { type: 'string', description: `write-test-first or manual verification recommendation for gaps, render in ${LANG}` },
        },
      },
    },
    acceptanceCriteria: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', description: 'e.g. C1, English raw' },
          text: { type: 'string', description: `verifiable completion criterion, render in ${LANG}` },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          risk: { type: 'string', description: `render in ${LANG}` },
          likelihood: { enum: ['low', 'med', 'high'] },
          mitigation: { type: 'string', description: `render in ${LANG}` },
          source: { type: 'string', description: 'which analyst raised it, English raw' },
        },
      },
    },
    summary: { type: 'string', description: `one-line progress msg, render in ${LANG}` },
  },
}

// ---- shared template fragments (author-time copies) ------------------------
const FRAG_ANALYST_CONTEXT = `## Refactoring Target

{target_description}

## Repository

**Repo:** {repo_path} | **Lang:** {lang} | **Scope:** {scope}

## Shared Context

{context}

## Output Language

Write all output in **{user_lang}**.`

// Schema-return output note shared by the analyst templates.
// AUTHOR-TIME TRANSFORM: replaces each .md '## Output' (file write to {output_path}) —
// dead under schema-enforced returns.
const FRAG_ANALYST_OUTPUT = `## Output

Return your analysis as a structured AnalysisResult object (the dispatching engine enforces the shape), mapping your sections onto fields:
- \`persona\`: exactly "{persona_id}" (English raw)
- \`summary\`: your overall analysis as integrated prose, 3-8 sentences
- \`keyPoints\`: the most important findings — one string per item, prefixed with the section it came from, e.g. "[{key_point_example}] ..."
- \`risks\`: findings that threaten behavior preservation if left unaddressed
- \`recommendations\`: concrete, ordered suggestions for the refactoring plan

All free-text in **{user_lang}**; file paths and identifiers raw. Do NOT write any file; do NOT emit a 1-line summary.`

// ---- analyst templates (author-time copies) ---------------------------------
// SYNC-SOURCE: templates/refactor/structural_analyst.md
// AUTHOR-TIME TRANSFORMS: '## Output' (Write your analysis to: {output_path}) ->
// FRAG_ANALYST_OUTPUT schema note; section list kept as composition guide.
const TPL_STRUCTURAL_ANALYST = `# Structural Analyst — Independent Analysis

## Identity

You are a **Structural Analyst** focused on code dependencies, coupling, cohesion, and architectural structure.

${FRAG_ANALYST_CONTEXT}

## Instructions

1. **Explore the target code** — read the files identified in the refactoring target. Understand the current structure, imports, dependencies, and how the target integrates with the rest of the codebase.

2. **Analyze from your structural perspective** — evaluate the target through your structural lens. Consider:
   - What are the coupling relationships? (afferent/efferent dependencies)
   - What is the cohesion level of the target modules/classes/functions?
   - Are there circular dependencies or unnecessary transitive dependencies?
   - What is the current complexity? (nesting depth, function length, class size)
   - What structural patterns are in use, and are they consistent?

3. **Compose your analysis** with the following sections (returned as the structured object below):

   ### Structural Assessment
   Current structure of the target code: dependencies, coupling metrics, cohesion assessment.

   ### Dependency Map
   Key dependencies of the target code:
   - **Inbound** (files that depend on the target)
   - **Outbound** (files the target depends on)
   - **Circular** (if any)

   ### Structural Problems
   Specific issues ranked by severity:
   - Problem description
   - Location (file path, line range)
   - Impact on maintainability

   ### Proposed Refactoring Steps
   Ordered list of atomic refactoring operations. Each step must:
   - Be independently testable
   - Preserve behavior
   - Include: description, files affected, expected structural improvement

   ### Risks & Concerns
   Structural risks: what could break if dependencies are restructured? Which interfaces are fragile?

${FRAG_ANALYST_OUTPUT}

## Constraints

Do NOT write code. Analyze independently — you do not know what any other analyst has written. Focus on structure and dependencies, not behavioral logic.
Be concise — focus on key findings, not exhaustive analysis.`

// SYNC-SOURCE: templates/refactor/risk_analyst.md (same transforms)
const TPL_RISK_ANALYST = `# Risk Analyst — Independent Analysis

## Identity

You are a **Risk Analyst** focused on behavioral impact scope, breakage risk, and test coverage gaps for refactoring operations.

${FRAG_ANALYST_CONTEXT}

## Test Information

**Test cmd:** {test_cmd} | **Baseline results:** {baseline_test_results}

## Instructions

1. **Explore the target code and its tests** — read the target files, then find and read the test files that cover the target. Map which behaviors are tested and which are not.

2. **Analyze from your risk perspective** — evaluate the refactoring target through your risk lens. Consider:
   - What is the full impact scope? (direct dependents + transitive dependents)
   - Which behaviors are tested vs. untested? Where are the coverage gaps?
   - What are the highest-risk changes? (most dependents, least test coverage)
   - What runtime assumptions exist that could break silently?
   - Are there implicit behavioral contracts (return types, side effects, ordering) that tests don't verify?

3. **Compose your analysis** with the following sections (returned as the structured object below):

   ### Impact Scope Assessment
   Full scope of potential impact:
   - **Direct impact**: files that import/use the target
   - **Transitive impact**: files that depend on direct dependents
   - **Runtime impact**: behavioral contracts, side effects, event ordering

   ### Test Coverage Analysis
   For each target file/function:
   - Test file(s) that cover it
   - Coverage assessment: good / partial / none
   - Untested behaviors that are at risk during refactoring

   ### Risk Matrix
   Top risks ranked by likelihood x impact, each with a mitigation.

   ### Safe Ordering Recommendation
   Recommended order of refactoring steps to minimize risk. Start with the lowest-risk, most-tested changes first.

   ### Risks & Concerns
   Residual risks that cannot be mitigated by test coverage alone. Behavioral contracts to watch.

${FRAG_ANALYST_OUTPUT}

## Constraints

Do NOT write code or test code. Analyze independently — you do not know what any other analyst has written. Focus on what can go wrong, not what will go right.
Be concise — focus on key findings, not exhaustive analysis.`

// SYNC-SOURCE: templates/refactor/feasibility_analyst.md (same transforms;
// comprehensive-mode analyst)
const TPL_FEASIBILITY_ANALYST = `# Feasibility Analyst — Independent Analysis

## Identity

You are a **Feasibility Analyst** focused on practical blockers, framework constraints, step-by-step transition viability, and hidden internal API dependencies for refactoring operations.

${FRAG_ANALYST_CONTEXT}

## Test Information

**Test cmd:** {test_cmd} | **Baseline results:** {baseline_test_results}

## Instructions

1. **Explore the target code deeply** — read not just the target files but also framework configuration, build files, and any code that uses internal APIs or reflection related to the target. Understand the full ecosystem around the target.

2. **Analyze from your feasibility perspective** — evaluate the refactoring through your practical lens. Consider:
   - Are there framework constraints that prevent certain restructurings? (e.g., annotation-based DI, ORM mappings, serialization contracts)
   - Are there hidden internal API dependencies? (reflection, string-based references, dynamic dispatch, configuration files referencing class/function names)
   - Can each proposed step be completed atomically, or do some require coordinated multi-file changes?
   - Are there database migrations, API version contracts, or wire format constraints?
   - What is the realistic effort for each step? Are any deceptively complex?

3. **Compose your analysis** with the following sections (returned as the structured object below):

   ### Feasibility Assessment
   Overall feasibility rating: straightforward / moderate / complex / impractical.
   Key factors driving the rating.

   ### Framework Constraints
   Framework-specific constraints that affect the refactoring:
   - Constraint description
   - Which refactoring steps are affected
   - Workaround or adaptation needed

   ### Hidden Dependencies
   Internal API dependencies not visible through standard imports:
   - Reflection-based references
   - String-based class/function lookups
   - Configuration file references
   - Serialization/deserialization contracts
   - Dynamic dispatch patterns

   ### Step-by-Step Viability
   For each proposed refactoring direction:
   - Can it be done atomically? (yes / requires coordination)
   - Realistic effort estimate (trivial / moderate / significant)
   - Practical blockers (if any)

   ### Risks & Concerns
   Feasibility risks: practical blockers that could derail the refactoring mid-way.

${FRAG_ANALYST_OUTPUT}

## Constraints

Do NOT write code. Analyze independently — you do not know what any other analyst has written. Focus on practical feasibility, not theoretical structure.
Be concise — focus on key findings, not exhaustive analysis.`

// ---- cross-critique template (author-time copy) -------------------------------
// SYNC-SOURCE: templates/refactor/cross_critique.md
// AUTHOR-TIME TRANSFORMS: '## Output' (Write your critique to: {output_path}) -> schema
// note (persona "<analyst>_critique"); the fixed 'Analysis 1/Analysis 2' slots collapse
// into the single script-composed {analyses_to_review} payload (variable survivor
// count — same pattern as deep-review's {reviews_to_verify}; no empty slot when an
// analyst failed).
const TPL_CROSS_CRITIQUE = `# Cross-Verification — {persona_id}

## Identity

You are the **{persona_id}** (same expertise as in your analysis phase). Now you are reviewing analyses from the other surviving specialists to strengthen the final refactoring plan.

## Focus Areas

Same as your original analysis — evaluate the other analyses through your specific lens.

## Refactoring Target

{target_description}

## Output Language

Write all output in **{user_lang}**.

## Analyses to Review

{analyses_to_review}

## Instructions

Review each analysis from your expert perspective. Be constructive but rigorous.

1. **Identify strengths** — what does each analysis get right?
2. **Identify weaknesses** — what does each analysis miss or get wrong, from your perspective?
3. **Find contradictions** — do the analyses conflict on refactoring approach, risk assessment, or step ordering? Which position is stronger and why?
4. **Surface gaps** — what did neither analysis address that should be considered for safe refactoring?

Compose your critique with the following sections (returned as the structured object below):

### Agreement Points
Key points where the analyses align — these are likely reliable foundations for the refactoring plan.

### Disagreements & Analysis
Where analyses conflict, with your assessment of which direction is safer and why. Favor behavior preservation in disputes.

### Missing Considerations
Important aspects that no analysis addressed, from your expert perspective. Focus on behavioral safety gaps.

### Synthesis Recommendations
Your recommended direction for the final refactoring plan, incorporating the best elements from the analyses and your own expertise.

## Output

Return your critique as a structured AnalysisResult object (the dispatching engine enforces the shape):
- \`persona\`: exactly "{persona_id}_critique" (English raw)
- \`summary\`: your overall critique as integrated prose, 3-8 sentences
- \`keyPoints\`: Agreement Points + Missing Considerations — one string per item, prefixed with its section
- \`risks\`: Disagreements & Analysis items (each with your safety assessment)
- \`recommendations\`: your Synthesis Recommendations

All free-text in **{user_lang}**. Do NOT write any file; do NOT emit a 1-line summary.

## Constraints

- Do NOT write implementation code or explore the codebase — base your critique entirely on the analyses and your prior expertise.
- Be specific — reference concrete points from the analyses. Disagree when warranted; agreement without evidence is not useful.
- In disputes, favor the option that better preserves behavior.
- Be concise — focus on key findings, not exhaustive analysis.`

// ---- synthesis template (author-time copy) ------------------------------------
// SYNC-SOURCE: templates/refactor/synthesis.md
// AUTHOR-TIME TRANSFORMS: 'Write refactor_plan.md to {plan_path}' + the section-format
// output block -> RefactorPlan schema note (the ORCHESTRATOR renders the seven-section
// refactor_plan.md from the returned object); Synthesis Rules kept verbatim. In multi
// mode the script fills {all_critiques} with a literal "(none ...)" marker — never an
// unsubstituted placeholder.
const TPL_SYNTHESIS = `# Refactor Plan Synthesis

## Identity

You are the **Plan Synthesizer** integrating inputs from independent refactoring analysts (and their cross-verifications, if provided) into a single, coherent refactoring plan.

## Refactoring Target

{target_description}

## Output Language

Write all output in **{user_lang}**.

## Test Information

**Test cmd:** {test_cmd} | **Baseline results:** {baseline_test_results}

## Inputs

### Analyses
{all_analyses}

### Cross-Verifications
{all_critiques}

## Synthesis Rules

1. **Consensus (2+ agree)** → Adopt.
2. **Disputed** → Favor the position that better preserves behavior. If tied on safety, choose the more conservative option (fewer changes, smaller steps). Note alternatives in risks.
3. **Unique insight** → Include in risks if actionable, in steps if critical for safety.
4. **Step ordering** → Use the safest ordering from any analysis. Start with lowest-risk changes. If analyses disagree on ordering, prefer the order that tests the most critical behaviors first.

## Plan Sections (compose these; returned as the structured object below)

### Goal
What structural improvement is being achieved? One or two sentences. Emphasize that behavior must be preserved.

### Current State Analysis
Synthesize structural problems from all analyses. Include file paths and specific issues.

### Impact Scope
Which files will be directly modified? Which are indirectly affected? Use the UNION of all analyses' impact assessments (be conservative — include everything flagged by any analyst).

### Refactoring Steps
Ordered list of atomic changes synthesized from all analyses. Each step must:
- Be independently testable
- Preserve behavior after completion
- Be ordered from lowest-risk to highest-risk
Incorporate:
- Structural recommendations from the Structural Analyst
- Risk-aware ordering from the Risk Analyst
- Feasibility constraints from the Feasibility Analyst (if present)

### Test Coverage Assessment
Synthesized test coverage map. Highlight gaps where behavior preservation cannot be verified by tests. For each gap, recommend either writing a test first or a manual verification step.

### Completion Criteria
Verifiable acceptance criteria — always include "all baseline tests still pass" and "no new test failures introduced", plus the structural improvement criteria from the analyses.

### Risks
All identified risks from analyses and critiques: description, likelihood, mitigation, source analyst.

## Output

Return the plan as a structured RefactorPlan object (the dispatching engine enforces the shape) — the orchestrator renders refactor_plan.md from it. ALL required fields must be substantive. Map the sections onto:
- \`goal\` ← Goal ; \`currentState\` ← Current State Analysis
- \`impactScope.direct\` / \`impactScope.indirect\` ← Impact Scope
- \`steps\` ← Refactoring Steps, as [{n, description, files, testImpact, risk: low|med|high}] ordered lowest-risk first
- \`testCoverage\` ← Test Coverage Assessment, as [{target, coverage: good|partial|none, gapAction}]
- \`acceptanceCriteria\` ← Completion Criteria, as [{id: "C1", text}, ...] (ids English raw)
- \`risks\` ← Risks, as [{risk, likelihood, mitigation, source}] (source = which analyst raised it, English raw)
- \`summary\` ← one line: "{N} steps, {M} risks"

Free-text fields in **{user_lang}**; ids, paths, and enum values English raw.
Do NOT write refactor_plan.md or any other file yourself — the orchestrator writes it from this object.

## Constraints

- Do NOT invent requirements not grounded in the analyses or critiques. Do NOT modify any source files.
- **Behavior preservation is the top priority.** When in doubt, choose the safer option.
- The plan must be actionable by an implementer who has NOT seen the individual analyses.
- Be concise — focus on synthesis, not restating analyses.`

// ---- Phase 1: independent analysts (anchoring-free fan-out) -------------------
phase('Analyze')

const ROSTER =
  A.mode === 'comprehensive'
    ? [
        { id: 'structural_analyst', tpl: TPL_STRUCTURAL_ANALYST, kp: 'structural problem' },
        { id: 'risk_analyst', tpl: TPL_RISK_ANALYST, kp: 'coverage gap' },
        { id: 'feasibility_analyst', tpl: TPL_FEASIBILITY_ANALYST, kp: 'hidden dependency' },
      ]
    : [
        { id: 'structural_analyst', tpl: TPL_STRUCTURAL_ANALYST, kp: 'structural problem' },
        { id: 'risk_analyst', tpl: TPL_RISK_ANALYST, kp: 'coverage gap' },
      ]

// Structural keys first; user-influenced payloads last (shared context, then the
// target description last of all).
const rawAnalyses = await parallel(
  ROSTER.map((p) => () =>
    agent(
      render(p.tpl, {
        persona_id: p.id,
        key_point_example: p.kp,
        repo_path: A.repoPath,
        lang: A.lang,
        scope: A.scope,
        user_lang: A.userLang,
        test_cmd: A.testCmd,
        baseline_test_results: A.baselineTestResults,
        context: A.context,
        target_description: A.target,
      }),
      { schema: AnalysisResultSchema, label: p.id, phase: 'Analyze', ...mopt(MODELS.executor) },
    ),
  ),
)
const analyses = []
rawAnalyses.forEach((a, i) => {
  if (a) analyses.push({ id: ROSTER[i].id, result: a })
})
log(`Analyze: ${analyses.length}/${ROSTER.length} independent analyses (${analyses.map((a) => a.id).join(', ')})`)
if (analyses.length === 0) {
  throw new Error('refactor.plan: all analyst agents failed — orchestrator should fall back to the inline single path')
}

// ---- digests (composed once; reused by Critique and Synthesize) ----------------
const fmtList = (title, items) =>
  items && items.length ? `\n\n**${title}:**\n${items.map((s) => `- ${s}`).join('\n')}` : ''
const digestOf = (a) =>
  `### ${a.id}
${a.result.summary}${fmtList('Key points', a.result.keyPoints)}${fmtList('Risks', a.result.risks)}${fmtList('Recommendations', a.result.recommendations)}`
const digests = {}
analyses.forEach((a) => {
  digests[a.id] = digestOf(a)
})

// ---- Phase 2: cross-critique (comprehensive only) ------------------------------
let critiques = []
if (A.mode === 'comprehensive' && analyses.length >= 2) {
  phase('Critique')
  const rawCritiques = await parallel(
    analyses.map((a) => () =>
      agent(
        render(TPL_CROSS_CRITIQUE, {
          persona_id: a.id,
          user_lang: A.userLang,
          analyses_to_review: analyses
            .filter((o) => o.id !== a.id)
            .map((o) => digests[o.id])
            .join('\n\n'),
          target_description: A.target,
        }),
        { schema: AnalysisResultSchema, label: `${a.id}_critique`, phase: 'Critique', ...mopt(MODELS.advisor) },
      ),
    ),
  )
  critiques = rawCritiques.filter(Boolean)
  log(`Critique: ${critiques.length}/${analyses.length} cross-critiques`)
} else if (A.mode === 'comprehensive') {
  log('Critique: skipped (fewer than 2 surviving analyses)')
}

// ---- Phase 3: synthesis into a single RefactorPlan -----------------------------
phase('Synthesize')

const critiqueDigest = (c) =>
  `### ${c.persona}
${c.summary}${fmtList('Agreement points / missing considerations', c.keyPoints)}${fmtList('Disagreements', c.risks)}${fmtList('Synthesis recommendations', c.recommendations)}`

const plan = await agent(
  render(TPL_SYNTHESIS, {
    user_lang: A.userLang,
    test_cmd: A.testCmd,
    baseline_test_results: A.baselineTestResults,
    all_analyses: analyses.map((a) => digests[a.id]).join('\n\n'),
    all_critiques: critiques.length
      ? critiques.map(critiqueDigest).join('\n\n')
      : '(none — multi mode, no cross-critique was run)',
    target_description: A.target,
  }),
  { schema: RefactorPlanSchema, label: 'synthesis', phase: 'Synthesize', ...mopt(MODELS.advisor) },
)
log(`Synthesize: ${plan.steps.length} steps, ${plan.risks.length} risks${plan.summary ? ' — ' + plan.summary : ''}`)

// RefactorPlan is schema-validated -> no analysis-file re-reads, no 1-line parsing.
// The orchestrator writes the seven-section refactor_plan.md from `plan`, then renders
// the Plan Confirmation gate. Execution (atomic steps + per-step tests + Safety
// Advisor + auto-fix) stays in the orchestrator and is never scripted.
return {
  plan,
  stats: {
    mode: A.mode === 'comprehensive' ? 'comprehensive' : 'multi',
    analystsRequested: ROSTER.length,
    analystsSucceeded: analyses.length,
    critiquesSucceeded: critiques.length,
  },
}
