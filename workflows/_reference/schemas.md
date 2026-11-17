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
  shrinks the translation surface (user-lang leak guard, 77c619b).
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

> Phase 2a (spec) additive delta: the inlined copy in the spec skill's plan segment (removed
> in v9; original at the v8.14.0 tag) ADDED
> `hasFindings: { type: 'boolean', description: 'false ONLY for a genuine greenfield/input-ambiguous result with no actionable findings' }`
> and listed it in `required` — it replaced the old `— no findings —` 1-line sentinel scan
> (that skill's orchestrator empty-input contract then checked `proposals.every(p => p.hasFindings === false)`).
> The canonical shape above is unchanged for the other consumers (harness scripts); no script
> in the current tree carries `hasFindings`, so it is a historical spec-only extension, not a
> live one.

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

> Phase 2a (spec) tightening delta: the inlined copy in the spec skill's plan segment (removed
> in v9; original at the v8.14.0 tag) promoted
> `background`/`scope`/`edgeCases` into `required` (and `scope.required =
> [inScope, outOfScope]`) — that skill's seven-section spec.md format made them mandatory,
> and live dry-run wf_75de1836 showed prose-only "populate all seven sections"
> gets skipped for schema-optional fields. No script in the current tree carries this delta.
> The canonical shape above is unchanged
> for /harness (its plan output has no seven-section obligation).

> Phase 2e (refactor) additive delta: the inlined copy in the refactor skill's plan segment
> (removed in v9; original at the v8.14.0 tag; named
> `RefactorPlanSchema` in-script) promoted `steps` into `required` (items gained a required
> `risk: {enum: [low, med, high]}` and `files` became required) and ADDED three
> refactor-only fields — `currentState` (string, Current State Analysis),
> `impactScope` (`{direct[], indirect[]}`, both required), `testCoverage`
> (`[{target, coverage: good|partial|none, gapAction}]`, required; the array could be
> empty — that skill's orchestrator rendered "N/A" for an empty array) — so the orchestrator could
> faithfully reconstruct the seven-section refactor_plan.md (Goal / Current State
> Analysis / Impact Scope / Refactoring Steps / Test Coverage Assessment / Completion
> Criteria / Risks). Same wf_75de1836 lesson: rendered sections must be schema-required.
> No script in the current tree carries this delta. The canonical shape above is unchanged for the other consumers.

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
> `skills/harness-gate/SKILL.md` §Step 3 and `skills/harness-build/SKILL.md` §Step 3.5 read `scale.slice_hint`.
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

`workflows/harness.eval.workflow.js` gives the evaluator a second schema, `EvaluatorVerdictSchema`:
the same shape with `layer` limited to `['L2', 'L3']`. It does not rely on the engine enforcing
either enum and normalizes what it returns:

- a Layer 1 result always carries `layer: 'L1'`;
- an evaluator result carries `layer: 'L2'` when `verdict` is `FAIL_L2`, otherwise `'L3'`;
- an evaluator `PASS` that lists a `critical` or `major` failure becomes `FAIL_L3`, with
  `summary` prefixed `verdict normalized: …` — a Layer 3 failure is shown to the user, a
  Layer 2 failure is retried without asking;
- a literal `{scope}` inside `buildCmd` / `testCmd` / `lintCmd` / `typeCheckCmd` is replaced by
  `scope`, or by `.` when `scope` is empty or `(no limit)`.

## CriticReport

Returned by the plan-critic segment (`harness.critic.workflow.js`). Replaces the
`^critic_findings written — Critical=(\d+)...$` 1-line regex parse and its parse-fail
gate — a schema return cannot be unparseable, so the `parse_failed_*` failure modes are
structurally unreachable. The Critic agent still WRITES `critic_findings.md` (user-facing
artifact + re-synthesis injection source + Phase 3 handoff persistence), mirroring the
pilot evaluator/verify_layer1 kept-file pattern. The orchestrator branches the Critic
Gate on `counts`.

> Count consistency note: `harness.critic.workflow.js` normalizes `counts` from `items[]`
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

## Finding / FindingSet

`Finding` is the item shape carried by `FindingSet.findings[]`. Returned by the
deep-review specialist reviewers AND by the deep-review synthesis step
(`deep-review.review.workflow.js`) — replaces the reviewers' file-write + findings-table
prose contract and the orchestrator's `.harness/code-review/review_*.md` re-reads. The
ORCHESTRATOR writes the round report (`review_report.md` round 1 / `review_round<N>.md` after) from the final (synthesis) FindingSet.

> Count consistency note: the synthesis step in `deep-review.review.workflow.js`
> normalizes `counts` from `findings[]` before returning (harness.critic precedent) and fills
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

## Reserved (added by their owning phases — do not define here yet)

| Schema | Owning phase |
|---|---|
| AutoFixProposal | auto-fix-focused phase (Proposer stays inline-1-line in the pilot — deliberate carve-out) |
| MdEvalVerdict | Phase 3 polish |

> Landed from this queue: `CriticReport` (the plan critic), and `Finding`/`FindingSet` with the
> unplanned-but-needed `CrossVerifyReport` (deep-review). Ten more schemas landed for segments
> that v9 removed with their skills (debug, migrate, codebase-audit, test-gen); their entries
> were deleted here in the same change and remain at the v8.14.0 tag.
> The three PlanResult/AnalysisResult delta notes above (Phase 2a additive, Phase 2a tightening,
> Phase 2e refactor) were corrected in place after v9 removed the spec and refactor skills'
> plan segments: they now name those segments by role instead of by script file, and describe
> the deltas as history (originals at the v8.14.0 tag). No schema fact changed.
