# Scale Assessment — render fragment (single source)

> Cited by name from `skills/harness/SKILL.md` §Scale Assessment and
> `skills/harness-gate/SKILL.md` §Scale Assessment. Those files own the compute-once / freeze rule
> and the render SITES; this file owns what a render site prints. Read it at a render site.
> "The approval question" below is HARD GATE #1's: `skills/harness/SKILL.md` §Approval Gate in
> an inline session, `skills/harness-gate/SKILL.md` §Step 3 Pass B in a separate one.
>
> **Comparison-operator prohibition.** No rendered line below may be phrased as a numeric
> threshold comparison — no `>=`, `이상`, `초과`, `미만`. There is no code path here that computes
> a threshold, so there is nothing for such a phrase to attach to.

### 1. Raw signal counts

Four raw signals, each tagged with its own measurement state (`ok` / `absent` / `malformed` — §Signal Domain) rather than a bare number: AC count (`acceptanceCriteria.length`), steps count (`steps.length`), in-scope count (`scope.inScope.length`), risks count (`risks.length`).

### 2. Recommendation (verbatim render)

Render `sliceHint.recommendation` and `sliceHint.rationale` **verbatim** — never summarize, requote, or re-derive. **The orchestrator does NOT derive the recommendation from the counts in §1** — they are context only; the recommendation comes exclusively from `sliceHint`, produced with full qualitative judgment by the Synthesis sub-agent (`workflows/harness.plan.workflow.js` `## Scale Hint`, which itself forbids numeric-threshold phrasing). No code path here computes a threshold, so no comparison phrase can attach to one.

### 3. Override state

If `cli_flags.epic` is non-null, render the override: `true` → "epic 강제 적용 (사용자 지정 `--epic`)"; `false` → "single-slice 강제 적용 (사용자 지정 `--no-epic`)" (natural-language values rendered in `user_lang`, not Glossary tokens). If `cli_flags.epic == null`, render "override 없음 — 위 권고안이 그대로 유효".

When an override is active, §1's counts and §2's verbatim recommendation still render unchanged — an override only changes which choice leads at the approval question. Append one more aligned line (the one place here where `templates/_shared/status_format.md`'s `Label     : value` convention applies literally):
```
Decision : forced by --epic     ← or "forced by --no-epic", matching the flag given
```

### 4. Confirmation ownership

Always render a closing line: the recommendation/override above is informational only — the actual epic-vs-single decision is confirmed by the user at the approval question. §Scale Assessment never itself advances the state machine or makes the choice.

### Signal Domain (`ok` / `absent` / `malformed`)

Each of the 4 signals is stored in `state.scale.signals` as one of three states — never collapsed to a bare count:
- **`ok`** — present AND `Array.isArray(field) == true`; render its `.length`.
- **`absent`** — missing (`undefined`/`null`) from `PlanResult`. Render "measured: 없음" (never `0` — an omitted `steps` and an empty `steps: []` are different facts).
- **`malformed`** — present but `Array.isArray(field) == false` (e.g. `scope` collapsed into the `background` string; `PlanResultSchema.required` does not cover `scope`, so this passes validation). Render "measured: 손상됨 (배열 아님)".

**Rule**: never call `.length` before confirming `Array.isArray(field) == true` — a string's character count rendered as an item count would deterministically bias the assessment toward "epic". If any signal is `absent` or `malformed`, append one closing line: "결측되거나 손상된 신호가 있음 — 위 권고는 그만큼 불완전한 근거에 기반함" (qualitative — no numbers, no comparison).

### INLINE Fallback (degraded, 1-signal mode)

The INLINE path (and any resume that lands here) has no `sliceHint` — `planner_single.md` never produces one — and no structured `acceptanceCriteria`/`steps`/`scope`/`risks` to measure. Render as a **1-signal degraded mode**, not a silent 3-of-4 failure:
- The ONLY `ok` signal: a language-independent count of GFM checkbox lines matching the literal `- [ ]` in spec.md (the `### Completion Criteria` render of `skills/harness/SKILL.md` §Step 2 — WORKFLOW path). **Do NOT locate the section by heading text** — headings render in `user_lang`, so an English match silently returns 0; the checkbox glyph is language-independent.
- The other 3 signals: `absent`.
- Recommendation: "없음 (INLINE 경로 — 권고를 만드는 sliceHint가 이 경로에는 없음)" — state the degradation, never omit the line.
- Append the closing disclosure above AND one more: "이 폴백은 독립적인 2차 방어가 아니라 spec.md 자체(`skills/harness/SKILL.md` §Step 2 INLINE 산출물)의 하류임 — spec.md가 이미 손상된 scope를 반영했다면 이 신호도 같은 오염을 반영함".
