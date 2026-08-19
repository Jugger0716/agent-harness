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

> Phase 2e (refactor) additive delta: `refactor.plan.workflow.js`'s inlined copy (named
> `RefactorPlanSchema` in-script) promotes `steps` into `required` (items gain a required
> `risk: {enum: [low, med, high]}` and `files` becomes required) and ADDS three
> refactor-only fields — `currentState` (string, Current State Analysis),
> `impactScope` (`{direct[], indirect[]}`, both required), `testCoverage`
> (`[{target, coverage: good|partial|none, gapAction}]`, required; the array may be
> empty — the orchestrator renders "N/A" for an empty array) — so the orchestrator can
> faithfully reconstruct the seven-section refactor_plan.md (Goal / Current State
> Analysis / Impact Scope / Refactoring Steps / Test Coverage Assessment / Completion
> Criteria / Risks). Same wf_75de1836 lesson: rendered sections must be schema-required.
> The canonical shape above is unchanged for the other consumers.

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

> **Contract delta — `sliceHint` (declared here; not yet produced by any script).**
> `PlanResultSchema` will gain a `sliceHint` field carrying the plan-segment
> synthesis's scale-assessment recommendation for whether/how to split the work: a
> one-line recommendation, the candidate slice groupings the user can choose between,
> and the rationale. Sub-shape (declared here first, per this file's own "append here
> first, then copy into scripts" header discipline above):
>
> ```js
> // sliceHint sub-shape — declared only; NOT yet added to PlanResultSchema.properties
> // or PlanResultSchema.required in the code block above (that block is unedited, per
> // this file's append-only rule).
> sliceHint: { type: 'object', required: ['recommendation', 'candidates', 'rationale'],
>   properties: {
>     recommendation: { type: 'string', description: `one-line scale recommendation, render in ${A.userLang}` },
>     candidates: { type: 'array', items: {
>       type: 'object', required: ['label', 'slices'],
>       properties: {
>         label: { type: 'string', description: 'candidate grouping identifier, English raw' },
>         slices: { type: 'array', items: { type: 'string', description: `one candidate slice description, render in ${A.userLang}` } } } },
>       description: 'candidate slice groupings the user can choose between' },
>     rationale: { type: 'string', description: `why this recommendation, render in ${A.userLang}` }
>   } }
> ```
>
> **Ownership and timing:** this delta declares the `sliceHint` sub-shape only.
> `harness.plan.workflow.js`'s inline copy of `PlanResultSchema` (including the
> `.properties`/`.required` addition), and the consumer that reads
> `PlanResult.sliceHint` on the resume path, are a separate, later change — not part
> of this delta. Until that change lands, `sliceHint` is simply absent from every
> `PlanResult` returned today, and every consumer takes the absence as "no
> scale-assessment recommendation available" (same additive-optional discipline as an
> unwritten state field: declared, not yet backed by a writer).

> **`steps` comment correction — supersedes the "Pilot deltas" note above.** (That
> note is left unmodified, per this file's append-only rule; this is a new, adjacent
> note.) The "Pilot deltas" note's claim that "the synthesis spec deliberately avoids
> implementation detail" is no longer an accurate account of why `steps` stays out of
> `required`. Verified by reading the code: the render side already exists and is
> real — `### Implementation Steps` ← `steps[]` at `skills/harness/SKILL.md:704` —
> and only the **producer** side is missing: `harness.plan.workflow.js`'s
> `FRAG_SYNTHESIS_OUTPUT` template has no `### Implementation Steps` section and no
> mapping into `steps[]`. The accurate description is therefore not "intentional
> omission" but "renderer present, producer absent, so in practice the field is
> always empty." Whether to add the producer mapping (and promote `steps` toward
> `required`) is left to a later change; this note only corrects the record.

> **`steps` producer correction — supersedes the "`steps` comment correction" note above.**
> (That note is left unmodified, per this file's append-only rule; this is a new, adjacent
> note. It also supersedes that note's `skills/harness/SKILL.md:704` line-number citation,
> which had already rotted — line 704 now holds a `state.json` literal. Cite the renderer as
> `skills/harness/SKILL.md` §Step 2 — WORKFLOW path, the `` `### Implementation Steps` ← ``
> `` `steps[]` `` mapping line; quoting that literal survives renumbering, which an item
> ordinal does not.) The superseded note says the **producer** side is missing. Verified by
> reading the code on 2026-08-19, it is present, in two separate places:
>
> - the **mapping** is in `harness.plan.workflow.js`'s `FRAG_SYNTHESIS_OUTPUT` fragment —
>   `` - `steps` ← Implementation Steps, as [{n, description, files, testImpact}, ...] ``.
> - the **`### Implementation Steps` section** is in `TPL_SYNTHESIS_MULTI` and
>   `TPL_SYNTHESIS_STANDARD`, and in their `templates/planner/synthesis.md` /
>   `synthesis_standard.md` source copies.
>
> So "renderer present, producer absent, so in practice the field is always empty" is false
> as of this note. The producer landed in the same epic that wrote the superseded note (the
> note was accurate when written and stopped being accurate a few commits later — recorded
> here rather than silently rewritten). What remains open is narrower and unchanged: whether
> to promote `steps` into `PlanResultSchema.required`.

> **`sliceHint` delta correction — supersedes the "Contract delta — `sliceHint`" note above.**
> (Append-only, as above: that note is left unmodified.) Two of its claims are false as of
> 2026-08-19. Its header says `sliceHint` is "declared here; not yet produced by any script",
> and its body says `sliceHint` is "absent from every `PlanResult` returned today" and that
> adding it to `.properties`/`.required` is "a separate, later change". Verified by reading
> `harness.plan.workflow.js`: `PlanResultSchema.required` lists `sliceHint` alongside `goal`,
> `acceptanceCriteria` and `risks`, and `FRAG_SYNTHESIS_OUTPUT` carries a
> `` `sliceHint` ← Scale Hint `` mapping marked `MANDATORY`. The consumers exist too —
> `skills/harness/SKILL.md` §Step 3 and §Step 3.5 read `scale.slice_hint`.
>
> What is still true, and is the part worth carrying forward: the INLINE path
> (`templates/planner/planner_single.md`) does not produce `sliceHint`, so a consumer still
> has to handle its absence — §Step 3's Scale Assessment gate table has a row for exactly
> that case. ROADMAP.md tracks this note's drift as a deferred item; this correction closes
> the factual half of it and leaves the file-ownership question there.

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

> Phase 2e (refactor) consumer note: `refactor.eval.workflow.js` returns this canonical
> shape unchanged. Mapping — a test regression / build failure (mechanical evidence; the
> evaluator's baseline-comparison test run IS the L1-mechanical check) →
> `{ layer: 'L1', verdict: 'FAIL_L2' }` per the encoding note above; tests green but a
> behavior-preservation criterion fails by judgment → `{ layer: 'L3', verdict: 'FAIL_L3' }`;
> PASS → `{ layer: 'L3', verdict: 'PASS' }`. `layer: 'L2'` is unused by refactor (its
> five criteria are judgment, not checklist-structural). The /refactor orchestrator
> treats ANY non-PASS as FAIL for its Step 6 QA gate (UX unchanged), with
> `failures[].fix` feeding the gate text.

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

## Finding / FindingSet

`Finding` is the item shape carried by `FindingSet.findings[]`. Returned by the
deep-review specialist reviewers AND by the deep-review synthesis step
(`deep-review.review.workflow.js`) — replaces the reviewers' file-write + findings-table
prose contract and the orchestrator's `.harness/code-review/review_*.md` re-reads. The
ORCHESTRATOR writes the round report (`review_report.md` round 1 / `review_round<N>.md` after) from the final (synthesis) FindingSet.

> Count consistency note: the synthesis step in `deep-review.review.workflow.js`
> normalizes `counts` from `findings[]` before returning (spec.eval precedent) and fills
> a missing/short `filesReviewed` from the union of the reviewers' `filesReviewed`
> arrays — consumers can branch/render directly.
>
> `filesReviewed` is REQUIRED: the report's "Files Reviewed" table (which includes
> no-issue files) is reconstructible ONLY from this field — prose-only obligations on
> schema-optional fields get skipped (Phase 2a lesson, wf_75de1836).

```js
const FindingSchema = {
  type: 'object',
  required: ['file', 'severity', 'category', 'title', 'detail'],
  properties: {
    file: { type: 'string', description: 'repo-relative path, raw' },
    line: { type: 'integer', description: 'omit for file-level findings' },
    endLine: { type: 'integer' },
    severity: { enum: ['critical', 'major', 'minor', 'suggestion'] },
    category: { type: 'string', description: 'short token (Correctness/Security/Performance/Maintainability/Testing/Architecture/Design), English raw' },
    title: { type: 'string', description: `short title, render in ${A.userLang}` },
    detail: { type: 'string', description: `what the issue is and why it matters, render in ${A.userLang}` },
    suggestion: { type: 'string', description: `concrete actionable fix, render in ${A.userLang}` }
  }
}

const FindingSetSchema = {
  type: 'object',
  required: ['findings', 'counts', 'filesReviewed', 'summary'],
  properties: {
    findings: { type: 'array', items: FindingSchema },
    counts: { type: 'object', required: ['critical', 'major', 'minor', 'suggestion'],
      properties: { critical: { type: 'integer' }, major: { type: 'integer' },
        minor: { type: 'integer' }, suggestion: { type: 'integer' } } },
    filesReviewed: { type: 'array', items: { type: 'string' }, description: 'every file examined, including no-issue files, raw paths' },
    summary: { type: 'string', description: `one-line, counts English raw, render in ${A.userLang}` }
  }
}
```

> **Contract delta — cold-review Finding severity vocabulary (declared here; not yet
> produced by any script).** A future cold-review extension carries findings shaped
> like `Finding` above but with an **uppercase** severity enum —
> `severity: { enum: ['Critical', 'Major', 'Minor'] }` — matching
> `CriticReport.items[].severity` above, NOT this section's lowercase
> `FindingSchema.severity`. The extension is declared as an optional `coldFindings`
> array carried on a `VerifyVerdict`-shaped return (see `VerifyVerdictSchema` above);
> that field is not yet added to `VerifyVerdictSchema.properties` — this note only
> fixes the vocabulary the eventual field must use.
>
> **Do not normalize — this is an intentional divergence, not drift to clean up.**
> Three different severity vocabularies already coexist in this file by design:
> `VerifyVerdictSchema.failures[].severity` is lowercase (above),
> `CriticReport.items[].severity` is uppercase (above), and `FindingSchema.severity`
> (immediately above) is lowercase plus a `suggestion` grade. The cold-review
> extension deliberately follows `CriticReport`'s uppercase vocabulary, because it
> feeds the same `Critical`/`Major`/`Minor` counts a Critic gate displays. If a later
> "cleanup" commit unifies these into one casing, a branch that gates on something
> like "PASS + cold Critical/Major ≥ 1" would silently stop firing on a
> string-casing mismatch — the cold pass keeps running and keeps costing tokens, but
> its findings stop feeding back. This is the failure mode this note exists to
> prevent.

> **cold-review severity delta correction — supersedes the "Contract delta — cold-review
> Finding severity vocabulary" note above.** (Append-only, as elsewhere in this file: that note
> is left unmodified.) Its header says the vocabulary is "declared here; not yet produced by any
> script", and its body says the optional `coldFindings` field "is not yet added to
> `VerifyVerdictSchema.properties`". Both were accurate when written and are false as of
> 2026-08-19: `workflows/harness.eval.workflow.js` defines `ColdFindingSchema` and
> `ColdFindingSetSchema` and dispatches the cold reviewer with the latter, so the shape is
> produced by a shipped script today.
>
> **The part that has NOT changed is the one the note exists for**: the uppercase
> `Critical`/`Major`/`Minor` enum is still an intentional divergence from this section's
> lowercase `FindingSchema.severity`, and normalising the casing would silently stop the
> "PASS + cold Critical/Major >= 1" feedback branch from firing. Read the "Do not normalize"
> paragraph above as current; read its "not yet produced" framing as historical.

## CrossVerifyReport

Returned by the deep-review thorough-mode cross-verification step
(`deep-review.review.workflow.js`). Unplanned-but-needed (2c `DebugAnalysis` precedent):
preserves the cross-verification template's Confirmed / False-Positive /
severity-adjust / new-finding / disagreement semantics, which a plain FindingSet return
would lose (the pre-correction draft's own flagged lossiness).

> Correlation contract: `verdicts[].findingIndex` is the 1-based `[#N]` index in the
> script-composed digest of `sourceReviewer`'s findings. The script composes each
> reviewer's digest ONCE and reuses it for BOTH the cross-verify prompts and the
> synthesis prompt, so `(sourceReviewer, findingIndex)` dereferences deterministically
> against a single key space.

```js
const CrossVerifyReportSchema = {
  type: 'object',
  required: ['reviewer', 'verdicts', 'newFindings', 'summary'],
  properties: {
    reviewer: { type: 'string', description: 'identifier, English raw' },
    verdicts: { type: 'array', items: {
      type: 'object', required: ['sourceReviewer', 'findingIndex', 'verdict', 'note'],
      properties: {
        sourceReviewer: { type: 'string', description: 'identifier as shown in the digest header, raw' },
        findingIndex: { type: 'integer', description: '1-based [#N] index in that reviewer\'s digest (correlation key)' },
        verdict: { enum: ['Confirmed', 'FalsePositive', 'SeverityAdjusted'] },
        adjustedSeverity: { enum: ['critical', 'major', 'minor', 'suggestion'], description: 'only when verdict=SeverityAdjusted' },
        note: { type: 'string', description: `evidence-based rationale quoting the diff, render in ${A.userLang}` }
      } } },
    newFindings: { type: 'array', items: FindingSchema },
    disagreements: { type: 'array', items: {
      type: 'object', required: ['topic', 'assessment'],
      properties: { topic: { type: 'string', description: `render in ${A.userLang}` },
        assessment: { type: 'string', description: `which position is correct and why, render in ${A.userLang}` } } } },
    summary: { type: 'string', description: `one-line, render in ${A.userLang}` }
  }
}
```

## MigrationPlan

Returned by the `migrate.analyze.workflow.js` synthesis step (in-script name
`MigrationPlanSchema`; owning phase 2d). The ORCHESTRATOR writes `migration_plan.md`
from this object, then renders the Plan Confirmation HARD GATE and sets
`total_steps = steps.length`. Migrate consumer-delta vs the canonical `PlanResult`
(required: goal/acceptanceCriteria/risks): every rendered migration_plan.md section
(Summary / Breaking Changes / Dependency Updates / Configuration Changes / Execution
Order / Risks) is schema-REQUIRED — prose-only "populate all sections" gets skipped for
schema-optional fields (Phase 2a lesson, wf_75de1836). `steps[]` IS the breaking-changes
list. Arrays may be empty — required means present, not non-empty; the orchestrator
renders "None" for an empty `dependencyUpdates`/`configurationChanges`. RefactorPlan
precedent (rendered sections → required). The header `## Migration Plan: <target>
<from> → <to>` is rendered from state.json, not carried in the schema.

```js
const MigrationPlanSchema = {
  type: 'object',
  required: ['summary', 'steps', 'dependencyUpdates', 'configurationChanges', 'executionOrder', 'risks'],
  properties: {
    summary: { type: 'string', description: `1-3 sentence migration overview (### Summary), render in ${A.userLang}` },
    steps: { type: 'array', items: {
      type: 'object', required: ['n', 'description', 'whatChanged', 'files', 'requiredAction', 'verification', 'risk'],
      properties: {
        n: { type: 'integer' },
        description: { type: 'string', description: `breaking-change title, render in ${A.userLang}` },
        whatChanged: { type: 'string', description: `what changed and why, render in ${A.userLang}` },
        files: { type: 'array', items: { type: 'string' }, description: 'affected files, raw paths (may be empty)' },
        requiredAction: { type: 'string', description: `concrete action to apply this step, render in ${A.userLang}` },
        verification: { type: 'string', description: `how to verify this step (build/test expectation), render in ${A.userLang}` },
        risk: { enum: ['low', 'med', 'high'] } } } },
    dependencyUpdates: { type: 'array', items: {
      type: 'object', required: ['name', 'from', 'to'],
      properties: { name: { type: 'string', description: 'dependency name, raw' },
        from: { type: 'string', description: 'current version, raw' },
        to: { type: 'string', description: 'target version, raw' } } } },
    configurationChanges: { type: 'array', items: {
      type: 'object', required: ['file', 'change'],
      properties: { file: { type: 'string', description: 'config file path, raw' },
        change: { type: 'string', description: `key added/removed/renamed/changed and the new value, render in ${A.userLang}` } } } },
    executionOrder: { type: 'array', items: { type: 'string', description: `ordered step reference with dependency notes, e.g. "Step 1 (config) → Step 2 (depends on Step 1)", render in ${A.userLang}` } },
    risks: { type: 'array', items: {
      type: 'object', required: ['risk', 'likelihood', 'mitigation'],
      properties: { risk: { type: 'string', description: `render in ${A.userLang}` },
        likelihood: { enum: ['low', 'med', 'high'] },
        mitigation: { type: 'string', description: `render in ${A.userLang}` },
        source: { type: 'string', description: 'which analyst raised it (external/internal), English raw' } } } },
    notApplicable: { type: 'array', items: {
      type: 'object', required: ['title', 'reason'],
      properties: { title: { type: 'string', description: `breaking change skipped, render in ${A.userLang}` },
        reason: { type: 'string', description: `why it does not affect this codebase, render in ${A.userLang}` } } },
      description: 'optional — guide breaking changes whose pattern is not used here' }
  }
}
```

## AuditAnalysis

Returned by each parameterized lens analyst in `codebase-audit.analysis.workflow.js`
(in-script name `AuditAnalysisSchema`; owning phase 2f). Extends `AnalysisResult`
(persona/summary/keyPoints/risks/recommendations) with a structured `sections{}` so the
synthesis consumes structured data, NOT prose parsing of `keyPoints`.

> **Per-lens required promotion (not sparse-optional).** `sections.*` keys are NOT all
> optional — the SCRIPT clones this schema per lens and sets `sections.required` to the
> keys that lens owns, so an upstream lens cannot silently omit its core output (DebugAnalysis
> pinned `hypotheses` required+minItems:1 by the same reasoning; §3.4 downstream required
> promotion is hollow without it):
> The lenses are **independent `LENS{}` entries** (not a shared base with deep-merge additions):
> - deep-mode **`structure_dependency`** (merged) → `sections.required = ['architecture', 'moduleMap', 'internalDeps', 'circularDeps', 'externalDeps']`
> - deep-mode **`pattern_quality`** → `sections.required = ['designPatterns', 'conventions', 'antiPatterns', 'hotspots']`
> - thorough-mode **`structure`** → `sections.required = ['architecture', 'moduleMap']`
> - thorough-mode **`dependency`** → `sections.required = ['internalDeps', 'circularDeps', 'externalDeps']`
> - thorough-mode **`pattern`** → `sections.required = ['designPatterns', 'conventions', 'antiPatterns', 'hotspots']`
>
> The synthesis reads the structured `sections` AND the correlation-keyed `keyPoints`; it
> does not depend on free-prose parsing.

```js
const AuditAnalysisSchema = {
  type: 'object',
  // keyPoints REQUIRED + minItems:1 — it is the SOLE source of the [#N] correlation keys the
  // CompletenessCritique anchors to (DebugAnalysis hypotheses minItems:1 precedent); without
  // it the required critique-side correlation contract is hollow on the target side.
  required: ['persona', 'summary', 'keyPoints', 'sections'],
  properties: {
    persona: { type: 'string', description: 'lens identifier, English raw' },
    summary: { type: 'string', description: `overall analysis from this lens, render in ${A.userLang}` },
    keyPoints: { type: 'array', minItems: 1, items: { type: 'string', description: `correlation-keyed finding ([#N] anchor), render in ${A.userLang}` } },
    risks: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    recommendations: { type: 'array', items: { type: 'string', description: `render in ${A.userLang}` } },
    sections: {
      type: 'object',
      // `required` is set per-lens by the script (see note above).
      properties: {
        architecture: { type: 'object', properties: {
          language: { type: 'string', description: 'primary language + version, raw' },
          framework: { type: 'string', description: 'framework + version, raw' },
          pattern: { type: 'string', description: 'monorepo|SPA|API|full-stack|library|CLI|other, raw' },
          buildSystem: { type: 'string', description: 'build tool + package manager, raw' },
          testFramework: { type: 'string', description: 'test framework if detected, raw' },
          cicd: { type: 'string', description: 'CI system if detected, raw' } } },
        moduleMap: { type: 'array', items: {
          type: 'object', required: ['module', 'role'],
          properties: { module: { type: 'string', description: 'module name, raw' },
            path: { type: 'string', description: 'module path, raw' },
            role: { type: 'string', description: `responsibility, render in ${A.userLang}` },
            entryPoint: { type: 'string', description: 'entry file, raw' } } } },
        internalDeps: { type: 'array', items: { type: 'string', description: `inter-module dependency relationship, render in ${A.userLang} with paths raw` } },
        circularDeps: { type: 'array', items: { type: 'string', description: 'circular dependency chain, e.g. "a → b → a", raw' } },
        externalDeps: { type: 'array', items: {
          type: 'object', required: ['package', 'purpose'],
          properties: { category: { type: 'string', description: 'short token, English raw' },
            package: { type: 'string', description: 'package name, raw' },
            version: { type: 'string', description: 'version constraint, raw' },
            purpose: { type: 'string', description: `what it is used for, render in ${A.userLang}` } } } },
        designPatterns: { type: 'array', items: {
          type: 'object', required: ['pattern'],
          properties: { pattern: { type: 'string', description: 'pattern name, English raw' },
            evidence: { type: 'string', description: `file example + note, render in ${A.userLang} with paths raw` } } } },
        conventions: { type: 'array', items: {
          type: 'object', required: ['convention', 'value'],
          properties: { convention: { type: 'string', description: 'Naming/Exports/Testing/..., English raw' },
            value: { type: 'string', description: `observed style, render in ${A.userLang}` },
            consistency: { enum: ['high', 'medium', 'low'] } } } },
        antiPatterns: { type: 'array', items: {
          type: 'object', required: ['issue', 'severity'],
          properties: { issue: { type: 'string', description: `anti-pattern description, render in ${A.userLang}` },
            location: { type: 'string', description: 'file path(s), raw' },
            severity: { enum: ['high', 'medium', 'low'] } } } },
        hotspots: { type: 'array', items: {
          type: 'object', required: ['file', 'reason'],
          properties: { file: { type: 'string', description: 'file path, raw' },
            indicator: { type: 'string', description: 'complexity indicator (function count/nesting/length/cyclomatic), English raw' },
            reason: { type: 'string', description: `why it is a hotspot, render in ${A.userLang}` } } } }
      }
    }
  }
}
```

## CompletenessCritique

Returned by the thorough-mode completeness-critic in
`codebase-audit.analysis.workflow.js` (in-script name `CompletenessCritiqueSchema`;
owning phase 2f). Mirrors `CrossVerifyReport`'s correlation contract.

> Correlation contract (required): `accuracy[].targetLens` + `accuracy[].targetIndex` is
> the `(lens, 1-based [#N])` key in the script-composed analyst digest;
> `contradictions[].between` references the same `lens [#N]` key space. The script
> composes each lens's digest ONCE and reuses it for BOTH the critique prompts and the
> synthesis prompt (deep-review digest precedent), so the references dereference
> deterministically against a single key space — without it, synthesis falls back to
> nondeterministic prose matching.

```js
const CompletenessCritiqueSchema = {
  type: 'object',
  required: ['reviewer', 'accuracy', 'gaps', 'synthesisRecommendations'],
  properties: {
    reviewer: { type: 'string', description: 'identifier, English raw' },
    accuracy: { type: 'array', items: {
      type: 'object', required: ['targetLens', 'targetIndex', 'claim', 'verdict'],
      properties: {
        targetLens: { type: 'string', description: 'lens identifier as shown in the digest header (structure/dependency/pattern), raw' },
        targetIndex: { type: 'integer', description: '1-based [#N] index in that lens digest (correlation key)' },
        claim: { type: 'string', description: `the analyst claim assessed, render in ${A.userLang}` },
        verdict: { enum: ['confirmed', 'incorrect', 'unsupported'] },
        evidence: { type: 'string', description: `code-level evidence for the verdict, render in ${A.userLang}` } } } },
    gaps: { type: 'array', items: { type: 'string', description: `analysis the lenses missed, render in ${A.userLang}` } },
    contradictions: { type: 'array', items: {
      type: 'object', required: ['between', 'resolution'],
      properties: {
        between: { type: 'array', items: { type: 'string' }, description: 'the conflicting (lens, [#N]) references, raw — e.g. ["structure [#2]", "dependency [#1]"]' },
        resolution: { type: 'string', description: `which position is correct and why, render in ${A.userLang}` } } } },
    crossDomainInsights: { type: 'array', items: { type: 'string', description: `insights spanning multiple lenses, render in ${A.userLang}` } },
    synthesisRecommendations: { type: 'array', items: { type: 'string', description: `recommendations for the final audit, render in ${A.userLang}` } }
  }
}
```

## AuditResult

Returned by the `codebase-audit.analysis.workflow.js` synthesis step (in-script name
`AuditResultSchema`; owning phase 2f). The ORCHESTRATOR writes `audit_report.md` from
this object (read-only segments never write files — 2b deep-review pattern). Every
rendered section is schema-REQUIRED; arrays may be empty (the orchestrator omits empty
sections from the report — empty-section normalization is orchestrator/synthesis side).

```js
const AuditResultSchema = {
  type: 'object',
  required: ['overview', 'moduleMap', 'dependencyGraph', 'patterns', 'hotspots', 'nextSteps', 'summary'],
  properties: {
    overview: { type: 'object', required: ['language', 'framework', 'architecture'],
      properties: {
        language: { type: 'string', description: 'primary language + version, raw' },
        framework: { type: 'string', description: 'framework + version, raw' },
        architecture: { type: 'string', description: 'architecture pattern, raw' },
        buildSystem: { type: 'string', description: 'build tool + package manager, raw' },
        testFramework: { type: 'string', description: 'test framework, raw' },
        cicd: { type: 'string', description: 'CI system, raw' } } },
    moduleMap: { type: 'array', items: {
      type: 'object', required: ['module', 'role'],
      properties: { module: { type: 'string', description: 'module name, raw' },
        path: { type: 'string', description: 'module path, raw' },
        role: { type: 'string', description: `module responsibility, render in ${A.userLang}` },
        entryPoint: { type: 'string', description: 'entry file, raw' } } } },
    dependencyGraph: { type: 'object', required: ['internal', 'circular', 'external'],
      properties: {
        internal: { type: 'array', items: { type: 'string', description: `inter-module relationship, render in ${A.userLang} with paths raw` } },
        circular: { type: 'array', items: { type: 'string', description: 'circular dependency chain, raw' } },
        external: { type: 'array', items: {
          type: 'object', required: ['package', 'purpose'],
          properties: { category: { type: 'string', description: 'short token, English raw' },
            package: { type: 'string', description: 'package name, raw' },
            version: { type: 'string', description: 'version constraint, raw' },
            purpose: { type: 'string', description: `what it is used for, render in ${A.userLang}` } } } } } },
    patterns: { type: 'object', required: ['design', 'conventions', 'antiPatterns'],
      properties: {
        design: { type: 'array', items: {
          type: 'object', required: ['pattern'],
          properties: { pattern: { type: 'string', description: 'pattern name, English raw' },
            evidence: { type: 'string', description: `file example + note, render in ${A.userLang} with paths raw` } } } },
        conventions: { type: 'array', items: {
          type: 'object', required: ['convention', 'value'],
          properties: { convention: { type: 'string', description: 'Naming/Exports/Testing/..., English raw' },
            value: { type: 'string', description: `observed style, render in ${A.userLang}` },
            consistency: { enum: ['high', 'medium', 'low'] } } } },
        antiPatterns: { type: 'array', items: {
          type: 'object', required: ['issue', 'severity'],
          properties: { issue: { type: 'string', description: `anti-pattern description, render in ${A.userLang}` },
            location: { type: 'string', description: 'file path(s), raw' },
            severity: { enum: ['high', 'medium', 'low'] } } } } } },
    hotspots: { type: 'array', items: {
      type: 'object', required: ['file', 'reason'],
      properties: { file: { type: 'string', description: 'file path, raw' },
        indicator: { type: 'string', description: 'complexity indicator, English raw' },
        reason: { type: 'string', description: `why it is a hotspot, render in ${A.userLang}` } } } },
    nextSteps: { type: 'array', items: {
      type: 'object', required: ['finding', 'suggestion'],
      properties: { finding: { type: 'string', description: `the finding that motivates the step, render in ${A.userLang}` },
        suggestion: { type: 'string', description: `recommended next action (may reference /refactor, /migrate, /md-generate, /harness), render in ${A.userLang}` } } } },
    summary: { type: 'string', description: `one-line, render in ${A.userLang}` }
  }
}
```

## SkepticVote

Returned (one per skeptic) by the `test-gen.judge.workflow.js` Propose phase (in-script
name `SkepticVoteSchema`; owning phase 2g). The judge segment is **propose-only and
read-only** — it never applies or runs a mutation; it proposes the single most lethal
mutation per target and names the test that SHOULD catch it. **The orchestrator's inline
in-place run produces the authoritative `caught` measurement** — `predictedCaught` is an
optional reference field only, never the aggregation authority.

```js
const SkepticVoteSchema = {
  type: 'object',
  required: ['skepticId', 'targetFunction', 'file', 'mutationKind', 'mutationDescription', 'expectedCatcherTest', 'rationale'],
  properties: {
    skepticId: { type: 'string', description: 'identifier, English raw' },
    targetFunction: { type: 'string', description: 'production function to mutate, raw' },
    file: { type: 'string', description: 'source file path of the target function, raw' },
    mutationKind: { enum: ['condition-inversion', 'return-value', 'arithmetic-operator', 'boundary-off-by-one', 'boolean-constant', 'not-applicable'] },
    mutationDescription: { type: 'string', description: `the single most lethal mutation (concrete: which line/expression, before → after), render in ${A.userLang}` },
    expectedCatcherTest: { type: 'object', required: ['testFile', 'testName'],
      properties: {
        testFile: { type: 'string', description: 'test file that SHOULD catch the mutation, raw path (scopes the orchestrator run, e.g. npx jest <testFile>)' },
        testName: { type: 'string', description: 'test case name that should fail under the mutation, raw' } } },
    rationale: { type: 'string', description: `why this mutation is most lethal and why the named test should catch it, render in ${A.userLang}` },
    predictedCaught: { type: 'boolean', description: 'OPTIONAL prediction only — NOT aggregation authority; the orchestrator inline run measures the real caught/not-caught' }
  }
}
```

## MutationVerdict / ExecutedMutation

`MutationVerdict` is **orchestrator-built** (owning phase 2g) — NOT a segment
schema-return. The `test-gen.judge` segment returns `SkepticVote[]`; the orchestrator
then applies each proposal inline (in-place mutate → scoped test run → immediate revert →
`git diff --quiet` clean guard) and assembles this object for the test_report.md render
and the INLINE↔WORKFLOW equivalence contract. It is documented here as canonical (so both
paths render the same shape), but no script inlines it via `agent({schema})`.

> **Determinism locks (§6.4):**
> - **verdict reduction:** `weak>0 → WEAK`; `weak==0 ∧ meaningful>0 → MEANINGFUL`;
>   `totalScored==0` (everything skipped/not-applicable) `→ TRIVIAL`; boundary
>   `meaningful==0 ∧ weak==0 ∧ skipped>0 → TRIVIAL`.
> - `score`/`weakTests` are derived ONLY from `executions[]` (the measured runs) —
>   `SkepticVote.predictedCaught` is never tallied (VerifyVerdict encoding-note discipline).
> - `totalScored = count(executions where applied) = meaningful + weak`.

`ExecutedMutation` is the `MutationVerdict.executions[]` item shape (orchestrator-built
inline; defined as a child of MutationVerdict — required: `targetFunction, applied,
caught, testRun`).

```js
const ExecutedMutationSchema = {
  type: 'object',
  required: ['targetFunction', 'applied', 'caught', 'testRun'],
  properties: {
    targetFunction: { type: 'string', description: 'mutated production function, raw' },
    file: { type: 'string', description: 'source file path, raw' },
    mutationKind: { type: 'string', description: 'mutation kind applied, English raw' },
    mutationDescription: { type: 'string', description: `the mutation that was applied, render in ${A.userLang}` },
    applied: { type: 'boolean', description: 'true if the mutation was actually applied in-place (false = skipped / not-applicable / apply-failed)' },
    caught: { type: 'boolean', description: 'true if the scoped test run FAILED under the mutation (measured); false if it still passed' },
    testRun: { type: 'string', description: 'the scoped test command actually run, raw' },
    evidence: { type: 'string', description: `pass/fail counts or error excerpt from the measured run, render in ${A.userLang}` }
  }
}

const MutationVerdictSchema = {
  type: 'object',
  required: ['verdict', 'executions', 'weakTests', 'score', 'summary'],
  properties: {
    verdict: { enum: ['MEANINGFUL', 'WEAK', 'TRIVIAL'] },
    proposals: { type: 'array', items: SkepticVoteSchema },
    executions: { type: 'array', items: ExecutedMutationSchema },
    weakTests: { type: 'array', items: {
      type: 'object', required: ['test', 'targetFunction', 'reason'],
      properties: {
        test: { type: 'string', description: 'the test that failed to catch the mutation, raw' },
        targetFunction: { type: 'string', description: 'the function whose mutation went uncaught, raw' },
        reason: { type: 'string', description: `why the test is weak, render in ${A.userLang}` },
        suggestedAssertion: { type: 'string', description: `a stronger assertion to add (WORKFLOW path surfaces this instead of auto-strengthening), render in ${A.userLang}` } } } },
    score: { type: 'object', required: ['meaningful', 'weak', 'skipped', 'totalScored'],
      properties: {
        meaningful: { type: 'integer', description: 'executions where applied && caught' },
        weak: { type: 'integer', description: 'executions where applied && !caught' },
        skipped: { type: 'integer', description: 'proposals not applied (not-applicable / apply-failed)' },
        totalScored: { type: 'integer', description: 'count of applied executions (meaningful + weak)' } } },
    summary: { type: 'string', description: `one-line, counts English raw, render in ${A.userLang}` }
  }
}
```

## Reserved (added by their owning phases — do not define here yet)

| Schema | Owning phase |
|---|---|
| AutoFixProposal | auto-fix-focused phase (Proposer stays inline-1-line in the pilot — deliberate carve-out) |
| MdEvalVerdict | Phase 3 polish |

> Landed from this queue: `CriticReport` (Phase 2a spec), `Hypothesis`/`RootCause`
> (Phase 2c debug, plus the unplanned-but-needed `DebugAnalysis` analyst shape),
> `Finding`/`FindingSet` (Phase 2b deep-review, plus the unplanned-but-needed
> `CrossVerifyReport` cross-verification shape), and — Phase 2 session C —
> `MigrationPlan` (2d), `AuditAnalysis`/`CompletenessCritique`/`AuditResult` (2f), and
> `SkepticVote`/`MutationVerdict`/`ExecutedMutation` (2g) — defined above. Debug no longer
> waits on `FindingSet`; the earlier "(also debug)" note on the Finding/FindingSet row is
> superseded.
