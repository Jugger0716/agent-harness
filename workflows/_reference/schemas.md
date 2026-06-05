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
  it dynamically from args (spike-verified to control output language ko/en) — ALWAYS via
  a fallback const, never bare `A.userLang` (a missing userLang silently renders
  "render in undefined", SPIKE-F1's exact failure mode):
  ```js
  const A = typeof args === 'string' ? JSON.parse(args) : (args || {})   // SPIKE-F1 guard
  const LANG = A.userLang || 'the language of the task description'      // fallback REQUIRED
  // inside the schema literal:
  summary: { type: 'string', description: `render in ${LANG}` }
  ```
  (The `${A.userLang}` forms in the schema blocks below are shorthand — copy them as
  `${LANG}` with the fallback const, exactly as the three shipped scripts do.)
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

> Phase 2a (spec) additive delta: `spec.plan.workflow.js`'s inlined copy ADDS
> `hasFindings: { type: 'boolean', description: 'false ONLY for a genuine greenfield/input-ambiguous result with no actionable findings' }`
> and lists it in `required` — it replaces the old `— no findings —` 1-line sentinel scan
> (the orchestrator's empty-input contract now checks `proposals.every(p => p.hasFindings === false)`).
> The canonical shape above is unchanged for the other consumers (harness scripts); treat
> `hasFindings` as a spec-only extension until another consumer adopts it.

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

> Phase 2a (spec) tightening delta: `spec.plan.workflow.js`'s inlined copy promotes
> `background`/`scope`/`edgeCases` into `required` (and `scope.required =
> [inScope, outOfScope]`) — the seven-section spec.md format makes them mandatory,
> and live dry-run wf_75de1836 showed prose-only "populate all seven sections"
> gets skipped for schema-optional fields. The canonical shape above is unchanged
> for /harness (its plan output has no seven-section obligation).

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

## CriticReport

Returned by the spec eval-segment Critic step (`spec.eval.workflow.js`). Replaces the
`^critic_findings written — Critical=(\d+)...$` 1-line regex parse and its parse-fail
gate — a schema return cannot be unparseable, so the `parse_failed_*` failure modes are
structurally unreachable. The Critic agent still WRITES `critic_findings.md` (user-facing
artifact + re-synthesis injection source + Phase 3 handoff persistence), mirroring the
pilot evaluator/verify_layer1 kept-file pattern. The orchestrator branches the Critic
Gate on `counts`.

> Count consistency note: `spec.eval.workflow.js` normalizes `counts` from `items[]`
> before returning (items are the ground truth the gate displays) — consumers can branch
> on `counts` directly without re-tallying.

```js
const CriticReportSchema = {
  type: 'object',
  required: ['counts', 'items', 'summary'],
  properties: {
    counts: { type: 'object', required: ['critical', 'major', 'minor'],
      properties: { critical: { type: 'integer' }, major: { type: 'integer' },
        minor: { type: 'integer' } } },
    items: { type: 'array', items: {
      type: 'object', required: ['id', 'severity', 'title', 'issue', 'suggestedFix'],
      properties: {
        id: { type: 'string', description: '[C1]/[M1]/[m1], sequential within severity, English raw' },
        severity: { enum: ['Critical', 'Major', 'Minor'] },
        title: { type: 'string', description: `short title, render in ${A.userLang}` },
        issue: { type: 'string', description: `what is wrong with the spec, render in ${A.userLang}` },
        impact: { type: 'string', description: `what breaks at implementation or runtime, render in ${A.userLang}` },
        suggestedFix: { type: 'string', description: `concrete change the spec author can apply, render in ${A.userLang}` } } } },
    summary: { type: 'string', description: `one-line, e.g. "Critical=2, Major=0, Minor=3", counts English raw, render in ${A.userLang}` }
  }
}
```

## Hypothesis

Sub-shape carried by `DebugAnalysis.hypotheses[]` and `RootCause.hypotheses[]`
(debug segment). `verification.minItems: 1` enforces the executable-verification
mandate (`templates/_shared/falsification_rules.md`) at the schema layer — the rule
the prose could only assert.

```js
const HypothesisSchema = {
  type: 'object',
  required: ['claim', 'confidence', 'status', 'verification'],
  properties: {
    claim: { type: 'string', description: `one-sentence hypothesis, render in ${A.userLang}` },
    confidence: { enum: ['High', 'Medium', 'Low'] },
    status: { enum: ['ACTIVE', 'REFUTED', 'CONFIRMED'] },
    falsificationQuestion: { type: 'string', description: `"if this is wrong, what evidence should exist?", render in ${A.userLang}` },
    verification: { type: 'array', minItems: 1, items: {
      type: 'object', required: ['action', 'output', 'conclusion'],
      properties: {
        action: { type: 'string', description: 'exact Grep/file-read/git/test command used — raw, not translated' },
        output: { type: 'string', description: 'captured output, truncated to relevant lines, raw' },
        conclusion: { enum: ['Supports', 'Refutes', 'Inconclusive'] } } } }
  }
}
```

## DebugAnalysis

Returned by the two independent debug analysts (error_analyst, code_archaeologist) in
`debug.analyze.workflow.js`. Carries structured `Hypothesis[]` instead of encoding
hypotheses as `AnalysisResult.keyPoints` strings — the cross-verifier needs
claim/confidence/status/verification[] intact to populate `RootCause.hypotheses[]`
faithfully (the pre-correction draft's own flagged lossiness risk).

```js
const DebugAnalysisSchema = {
  type: 'object',
  required: ['persona', 'summary', 'hypotheses', 'preliminaryRootCause', 'confidence'],
  properties: {
    persona: { type: 'string', description: 'identifier, English raw' },
    summary: { type: 'string', description: `key observations from this analyst's lens, render in ${A.userLang}` },
    hypotheses: { type: 'array', minItems: 1, items: HypothesisSchema },
    preliminaryRootCause: { type: 'string', description: `most likely root cause based on verification evidence only, render in ${A.userLang}` },
    confidence: { enum: ['High', 'Medium', 'Low'] },
    affectedLocation: { type: 'string', description: 'file:line (or commit hash / dependency), raw' },
    keyEvidence: { type: 'string', description: `the verification result that most strongly supports the conclusion, render in ${A.userLang}` },
    openQuestions: { type: 'array', items: { type: 'string', description: `unverifiable angles, render in ${A.userLang}` } }
  }
}
```

## RootCause

Returned by the debug adversarial cross-verify step. The ORCHESTRATOR writes
`root_cause.md` from this object (PlanResult→spec.md pattern), then renders the Fix
Decision HARD-GATE. `hypotheses[]` carries every hypothesis from both analysts at its
final status, including the adversarial verification action(s) appended by the
cross-verifier.

```js
const RootCauseSchema = {
  type: 'object',
  required: ['rootCause', 'confidence', 'affectedLocations', 'hypotheses', 'summary'],
  properties: {
    rootCause: { type: 'string', description: `2-4 sentence actionable root cause citing file:line/function/commit, render in ${A.userLang}` },
    confidence: { enum: ['High', 'Medium', 'Low', 'Unknown'] },
    confidenceRationale: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    errorType: { enum: ['build', 'runtime', 'logic'] },
    reproduction: { type: 'string', description: `reproduction conditions, or state that it was not reproduced (log/environment analysis), render in ${A.userLang}` },
    affectedLocations: { type: 'array', items: {
      type: 'object', required: ['file'],
      properties: { file: { type: 'string' }, line: { type: 'integer' },
        description: { type: 'string', description: `render in ${A.userLang}` } } } },
    agreementPoints: { type: 'array', items: { type: 'string', description: `where both analysts independently converged, render in ${A.userLang}` } },
    conflictsResolved: { type: 'array', items: {
      type: 'object', required: ['topic', 'resolution'],
      properties: {
        topic: { type: 'string', description: `what the analysts disagreed on, render in ${A.userLang}` },
        verificationAction: { type: 'string', description: 'exact command used to resolve, raw' },
        resolution: { type: 'string', description: `which claim won and why, render in ${A.userLang}` } } } },
    adversarialAudit: { type: 'string', description: `the fresh falsification attempt(s) on the surviving hypothesis and the outcome, render in ${A.userLang}` },
    hypotheses: { type: 'array', items: HypothesisSchema },
    recommendedFixDirection: { type: 'string', description: `conceptual fix direction, no code, render in ${A.userLang}` },
    summary: { type: 'string', description: `one-line progress msg, render in ${A.userLang}` }
  }
}
```

## Reserved (added by their owning phases — do not define here yet)

| Schema | Owning phase |
|---|---|
| Finding / FindingSet | Phase 2b deep-review |
| AutoFixProposal | auto-fix-focused phase (Proposer stays inline-1-line in the pilot — deliberate carve-out) |
| MutationVerdict / SkepticVote | Phase 2g test-gen |
| MdEvalVerdict | Phase 3 polish |

> Landed from this queue: `CriticReport` (Phase 2a spec) and `Hypothesis`/`RootCause`
> (Phase 2c debug, plus the unplanned-but-needed `DebugAnalysis` analyst shape) — defined
> above. Debug no longer waits on `FindingSet`; the earlier "(also debug)" note on the
> Finding/FindingSet row is superseded.
