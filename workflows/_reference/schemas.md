# Canonical Schema Reference — hand-sync source (NOT a runtime module)

> **Why this is a .md, not a .js:** the native Workflow engine runs each
> `*.workflow.js` as a self-contained plain-JS body — `import` of a sibling file is
> a launch-time `SyntaxError` (cold-review correction C1, re-confirmed empirically by
> the engine spike, SPIKE-F2 in
> `docs/superpowers/specs/2026-06-05-ultracode-phase1-engine-spike.md`).
> Therefore every segment script **inlines** the schema objects it needs.
> This file is the single canonical copy that script authors COPY from and keep in
> hand-sync. When a replicate phase adds a schema (Finding/FindingSet, CriticReport,
> AutoFixProposal, ...), append it here first, then copy into the owning scripts.
> **Append/merge only — never reorder or rewrite existing entries.**

## Conventions (apply to every schema)

- `agent(prompt, {schema})` forces StructuredOutput and returns a **validated object**
  (spike-verified). No 1-line parsing, no verdict regex.
- **Free-text fields carry a language directive in their `description`.** Scripts build
  it dynamically from args (spike-verified to control output language ko/en):
  ```js
  const A = typeof args === 'string' ? JSON.parse(args) : (args || {})   // SPIKE-F1 guard
  // inside the schema literal:
  summary: { type: 'string', description: `render in ${A.userLang}` }
  ```
- **Enum/identifier fields stay English raw** (verdicts, severities, personas, paths) —
  shrinks the translation surface (user-lang leak guard, 2a2aa68).
- Verdict enum is fixed: `PASS | FAIL_L2 | FAIL_L3`.

## AnalysisResult

Returned by independent proposal/analyst/advisor sub-agents (architect,
senior_developer, qa_specialist, lead_developer, advisors). Synthesis receives the
array directly — replaces `<persona> proposal written — {path}` 1-lines + file re-reads.

```js
const AnalysisResultSchema = {
  type: 'object',
  required: ['persona', 'summary', 'keyPoints'],
  properties: {
    persona: { type: 'string', description: 'identifier, English raw' },
    summary: { type: 'string', description: `render in ${A.userLang}` },
    keyPoints: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    risks: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    recommendations: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } }
  }
}
```

## PlanResult

Returned by the plan-segment synthesis step. The orchestrator writes `spec.md` from
this object, then renders HARD GATE #1.

> Pilot deltas vs the original locked sketch (recorded, additive/relaxing only):
> `steps` moved out of `required` (the synthesis spec deliberately avoids
> implementation detail — current spec.md has no steps section), and the spec.md
> sections gained dedicated fields: `background`, `scope{inScope,outOfScope}`,
> `approach`, `testingStrategy` — so the orchestrator can reconstruct spec.md
> faithfully (Goal/Background/Scope/Approach/Completion Criteria/Testing
> Strategy/Risks). `risks[].source` added (which persona raised it).

```js
const PlanResultSchema = {
  type: 'object',
  required: ['goal', 'acceptanceCriteria', 'risks'],
  properties: {
    goal: { type: 'string', description: `render in ${A.userLang}` },
    background: { type: 'string', description: `render in ${A.userLang}` },
    scope: { type: 'object', properties: {
      inScope: { type: 'array', items: { type: 'string' } },
      outOfScope: { type: 'array', items: { type: 'string' } } } },
    approach: { type: 'string', description: `render in ${A.userLang}` },
    acceptanceCriteria: { type: 'array', items: {
      type: 'object', required: ['id', 'text'],
      properties: { id: { type: 'string', description: 'e.g. AC-1, English raw' },
        text: { type: 'string', description: `render in ${A.userLang}` } } } },
    steps: { type: 'array', items: {
      type: 'object', required: ['n', 'description'],
      properties: { n: { type: 'integer' },
        description: { type: 'string', description: `render in ${A.userLang}` },
        files: { type: 'array', items: { type: 'string' } },
        testImpact: { type: 'string', description: `render in ${A.userLang}` } } } },
    testingStrategy: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    edgeCases: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    risks: { type: 'array', items: {
      type: 'object',
      properties: { risk: { type: 'string', description: `render in ${A.userLang}` },
        likelihood: { enum: ['low', 'med', 'high'] },
        mitigation: { type: 'string', description: `render in ${A.userLang}` },
        source: { type: 'string', description: 'which persona raised it, English raw' } } } },
    summary: { type: 'string', description: `one-line progress msg, render in ${A.userLang}` }
  }
}
```

## ChangeSet

Returned by the build-segment implementation step. The orchestrator writes
`changes.md` from this object.

```js
const ChangeSetSchema = {
  type: 'object',
  required: ['modifiedFiles', 'summary'],
  properties: {
    modifiedFiles: { type: 'array', items: {
      type: 'object', required: ['path', 'reason'],
      properties: { path: { type: 'string' },
        reason: { type: 'string', description: `render in ${A.userLang}` } } } },
    createdFiles: { type: 'array', items: { type: 'string' } },
    deletedFiles: { type: 'array', items: { type: 'string' } },
    stepsCompleted: { type: 'integer' },
    stepsTotal: { type: 'integer' },
    advisorFeedbackApplied: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    advisorFeedbackDeclined: { type: 'array', items: { type: 'string', description: `reason included, render in ${A.userLang}` } },
    summary: { type: 'string', description: `one-line, render in ${A.userLang}` }
  }
}
```

> Pilot delta: `advisorFeedbackApplied`/`advisorFeedbackDeclined` added (additive) —
> changes.md's "Advisor Feedback Applied/Declined" sections are written by the
> orchestrator from these fields.

## VerifyVerdict

Returned by Verify (L1 mechanical) and Evaluate (L2/L3). The orchestrator branches
retry/gates on `verdict` — replaces the `### Verdict:` regex parse.

> Encoding note: the verdict enum is locked to `PASS|FAIL_L2|FAIL_L3`. An L1
> mechanical failure is `{ layer: 'L1', verdict: 'FAIL_L2' }` — branch on
> **(layer, verdict)**, never on verdict alone.

```js
const VerifyVerdictSchema = {
  type: 'object',
  required: ['verdict', 'layer', 'failures'],
  properties: {
    verdict: { enum: ['PASS', 'FAIL_L2', 'FAIL_L3'] },
    layer: { enum: ['L1', 'L2', 'L3'] },
    failures: { type: 'array', items: {
      type: 'object', required: ['file', 'severity', 'fix'],
      properties: { file: { type: 'string' }, line: { type: 'integer' },
        severity: { enum: ['critical', 'major', 'minor'] },
        category: { type: 'string', description: 'short token, English raw' },
        fix: { type: 'string', description: `concrete fix instruction, render in ${A.userLang}` } } } },
    checks: { type: 'object', properties: {
      build: { enum: ['PASS', 'FAIL', 'SKIP'] }, test: { enum: ['PASS', 'FAIL', 'SKIP'] },
      lint: { enum: ['PASS', 'FAIL', 'SKIP'] }, typecheck: { enum: ['PASS', 'FAIL', 'SKIP'] } } },
    summary: { type: 'string', description: `one-line, render in ${A.userLang}` }
  }
}
```

## Reserved (added by their owning phases — do not define here yet)

| Schema | Owning phase |
|---|---|
| Finding / FindingSet | Phase 2b deep-review (also debug) |
| CriticReport | Phase 2a spec |
| AutoFixProposal | auto-fix-focused phase (Proposer stays inline-1-line in the pilot — deliberate carve-out) |
| MutationVerdict / SkepticVote | Phase 2g test-gen |
| MdEvalVerdict | Phase 3 polish |
