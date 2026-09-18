---
name: harness-gate
disallowed-tools: Bash, Write, Edit, Glob, NotebookEdit, WebSearch, WebFetch, Task, Agent, Workflow
description: HARD GATE #1 of the /harness pipeline — spec confirmation only. Holds no Bash, Write, Edit, Glob or sub-agent tools — reads .harness/state.json and spec.md, renders critic status and Scale Assessment, asks once, prints the next command (/harness-build, /harness-build --epic, or a /harness re-entry) and writes nothing. Run after /harness reaches plan_done; any other phase is redirected to its owner.
---

# Agent Harness — /harness-gate (v3, HARD GATE #1)

You are the **spec-confirmation gate** of the `/harness` pipeline and nothing else. This skill
holds `Read` and `AskUserQuestion` only — no `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`,
`Workflow`. **It writes nothing, deletes nothing, dispatches nothing.** Its whole output is the
gate itself and, after the human chooses, ONE next command for the human to type (§Next
command). `phase` is never written here and is never read as proof that this gate ran
(SPEC decision A — `design/harness-ordering-enforcement/SPEC.md`) — the human's typed command
is the only carrier of the decision.

Pipeline: `/harness` (Steps 1–2.6, ends at `plan_done`) → **this skill** (Step 3) →
`/harness-build` (Steps 3.5–8). See `skills/harness/SKILL.md` §Session Recovery for the full
phase machine; this file only needs §Entry Check below.

## User Language Detection

Single source: `templates/_shared/output_language.md` §User Language Detection. Detect `user_lang` from the user's most recent message, store it in state.json and re-check every message. All user-facing output is in `user_lang`; template instructions, state.json field names, file names, git branch names and Workflow `args` field names stay English. On the WORKFLOW path pass `userLang` in `args`.

## Output Language Contract

### Invariant

All orchestrator output visible to the user renders in `user_lang`. Backtick-inline English inside a `Print:` directive is a template format, not an output-language declaration; when `user_lang == "en"` this contract is a no-op. Every new `Print:` directive must conform (CI enforcement is a TODO).

### Preserved-English Glossary

Token table: `templates/_shared/output_language.md`. Cite it, never restate it. Status keywords (`PASS` / `FAIL` / `FAIL_L2` / `FAIL_L3` / `Verdict`), the `confidence: *` values, the INLINE 1-line return verbs, the `[harness]` prefix, the Status Format labels, `Epic planned`, and every identifier (state.json fields, paths, branch names, commands, phase keys, schema fields) stay English raw.

### Print Translation Pattern

When rendering a `Print:` directive: translate natural-language portions to `user_lang`; Glossary tokens stay raw; variable substitutions follow the Glossary; AskUserQuestion labels and descriptions follow the same rule. **Shorthand:** "Print per OLC" = render per this pattern.

## Entry Check (read-only — this skill holds no Bash, Write or Edit; it can delete nothing)

Read `.harness/state.json` with `Read`. Evaluate in order; the first match halts. Every message is
printed per §Output Language Contract (`[harness-gate]` is a Glossary-class prefix — English raw).
**No option is offered at any of the seven points below** — this section contains no
AskUserQuestion: the recovery actions `/harness` offers (deleting or re-creating `.harness/`)
are actions this skill cannot perform, and offering an action one cannot perform is a false
promise, not a contract.

1. `.harness/state.json` absent → `[harness-gate] No /harness session here — run /harness "<task>" first.`
2. Parse failure → print the path and the parse error only. (Same rule as `skills/harness/SKILL.md`
   §Session Recovery "View state only" — no partial recovery.)
3. `skill != "harness"` OR `version != "3.0"` → `[harness-gate] Not a /harness v3 session
   (skill: {skill|absent}, version: {version|absent}). This skill cannot delete or repair it —
   run /harness, which renders the Session Conflict gate.`
4. `epic.boundaries != null AND phase == "completed"` → `[harness-gate] Epic session residue —
   run /harness, which offers the recovery options.`
5. `phase != "plan_done"` → `[harness-gate] phase is {phase}; this gate only reads plan_done.
   Owner: /harness for plan_ready|planning, /harness-build for generate_ready…completed.`
6. `validate_path(docs_path, kind=output_dir)` fails (§Path Validator — this skill's own copy)
   → print the validator's halt message and halt. No recovery is offered; that belongs to /harness.
7. Otherwise → restore the display fields from state.json (`task`, `mode`, `path_resolved`,
   `docs_path`, `plan_critic.*`, `spec_stamp`, `scale.*`, `cli_flags.epic`, `user_lang`), then
   proceed to §Workflow Steps — Step 3. `{docs_path}spec.md` and
   `{docs_path}plan_critic_findings.md` / `critic_findings.md` are read from here on; a missing
   file is detected by the failed `Read` itself (no Glob — SPEC OQ-4 closed).

Never emit a `{...}` token verbatim — substitute from state.json before rendering.

## Next command (the gate's only output after the human chooses)

Every option of Step 3 that used to write state, dispatch a sub-agent, or edit `spec.md` now
ends this turn by printing ONE line the human types next. The mapping is exhaustive over both
passes; a label absent here does not exist in this skill.

| Chosen option | Printed next command | What that skill does with it |
|---|---|---|
| "Proceed as single" / "Proceed" (Pass B) | `/harness-build` | writes `phase → "generate_ready"`, resets `epic.boundaries → null`, runs Step 4 → 8 |
| "Plan as epic" (Pass B) | `/harness-build --epic` | runs `skills/harness-build/SKILL.md` §Step 3.5 (Slice Plan) and then its Epic Exit (Step 3.6) |
| "Modify" (either pass) | `/harness --modify "<the user's change request, quoted>"` | the /harness orchestrator edits `spec.md` under its `spec_stamp` write protocol, then prints `Next → /harness-gate` |
| "Auto-revise" (Pass A row ①-a) | `/harness --auto-revise` | Auto-revise re-entry + a fresh Plan Critic pass, then `Next → /harness-gate` |
| "Run Critic anyway" / "Retry Critic" (Pass A rows ①-b/①-c/②-b/③/④) | `/harness --critic` | a fresh own-critic dispatch (`skills/harness/SKILL.md` §Step 2.6), then `Next → /harness-gate` |
| "Proceed as-is" (Pass A) | (none — Pass B renders in this same turn) | — |
| "Stop" (either pass) | (none — halt; `.harness/` is left exactly as found) | — |

Print the command in a fenced code block on its own, after one line in `user_lang` that names
the option chosen. **Never execute it, never invoke the other skill from here** — the turn
boundary is the mechanism (SPEC §2.2), and this skill has no tool that could.

---

> The comparison-operator prohibition applies to every line §Scale Assessment renders, wherever
> that text now lives: never phrase a rendered line as a numeric threshold comparison (no ">=",
> "이상", "초과", "미만"). It is stated OUTSIDE that section on purpose — a grep restricted
> to the section's line range must return 0 hits, and stating the prohibition INSIDE the range it
> governs would trip its own grep. `templates/_shared/scale_assessment.md` carries it too, for a
> reader who arrives there first.

## Scale Assessment

> **Render-only in this skill.** The four signals, `slice_hint` and `override` were computed
> ONCE by `skills/harness/SKILL.md` §Step 2 and frozen into `state.scale.*`; this skill reads
> them from state.json and never re-derives anything — it has no `PlanResult`, and it must not
> try to rebuild one. **If `state.scale` is missing entirely** (a pre-split session, or one
> that reached `plan_done` without computing it), treat every signal as `absent` and render the
> INLINE Fallback that `templates/_shared/scale_assessment.md` defines — never error, never block
> the gate on a missing block; that fallback's one `ok` signal is counted from the `spec.md` this
> gate already reads (`Read` suffices — no Glob). The pointer below is byte-identical with
> `/harness`'s copy.

<!-- BLOCK-START:hx-scale-render v2 — shared by /harness, /harness-gate; edit every copy in one commit and bump the version -->
### Render fragment

What a render site prints — the four raw signal counts, the verbatim `sliceHint` recommendation and rationale, the `cli_flags.epic` override line and its `Decision :` row, the confirmation-ownership line, the `ok` / `absent` / `malformed` Signal Domain, and the INLINE Fallback degraded 1-signal mode — is `templates/_shared/scale_assessment.md`. Read it at the render site and follow it verbatim; never restate or summarize it here.

Two rules are repeated because they govern that read: the recommendation is **never** derived from the counts (it comes only from `sliceHint`, which Synthesis produced with full qualitative judgment), and no rendered line may be phrased as a numeric threshold comparison.
<!-- BLOCK-END:hx-scale-render v2 -->

---

## Workflow Steps

> This skill owns one Step. Steps 1–2.6 are `skills/harness/SKILL.md`; Steps 3.5–8 are `skills/harness-build/SKILL.md`.

### Step 3: HARD GATE #1 — Spec Confirmation

> Rendered by the orchestrator BETWEEN the `harness.plan` and `harness.build` segment runs
> — never inside a script. This gate renders as up to TWO SEQUENTIAL PASSES (Pass A, then
> Pass B) inside ONE `<HARD-GATE>` tag — see the §Architecture Principles #6 note this
> slice adds: the gate count stays 3, a pass is not a fourth gate.

<HARD-GATE>
Read and show spec.md to the user.

Every AskUserQuestion call in this gate (Pass A and Pass B alike) stays within the
option-count guidance in `templates/_shared/askuserquestion.md` — referenced by name here,
not restated (that file is the single source for the actual limit).

#### Stale Determination (single source — computed fresh every time this gate is about to
render, including on a `skills/harness/SKILL.md` §Session Recovery re-entry into Step 3; never a turn-local fact)

Reads `state.spec_stamp` and `state.plan_critic.spec_stamp_at_critic` (`skills/harness/SKILL.md` §Step 2's
`spec_stamp` write protocol defines the first and `skills/harness/SKILL.md` §Step 2.6's single read-modify-write the
second — both by name, neither restated here), plus the line count of `{docs_path}spec.md`
read **fresh at every Pass A render**, never carried over from an earlier render in the same
turn. That is not a new read site: §Architecture Principles #1's exception list entry (1) is
"spec.md at plan gate", and re-executing a declared read is not declaring another one — the
list keeps its 7 numbered slots (6 live). **The word "fresh" is load-bearing and is why this is spelled out
rather than phrased as reusing what the gate already read.** Every Modify now crosses a
session boundary (`/harness --modify` edits in its own turn; this gate re-renders in the
next), so the count is taken from the file as it stands when THIS session's Pass A renders;
a count carried over from an earlier read — the same-turn Modify loop the one-file layout
had, or any cached read — would describe the pre-edit file, which is precisely the input this
check exists to catch.

Evaluated in this fixed order, first match wins:

- `plan_critic.last_findings_path == null` (no findings file recorded — covers the
  carried-over and failed branches) → render as **stale-unknown**.
- `spec_stamp == null` OR `spec_stamp_at_critic == null` → **fail closed**, treat as
  **stale**. `null` is the documented default of both fields (`skills/harness/SKILL.md` §Step 1 item 11's new-field
  table), so a `"3.0"` session written before they existed lands here rather than comparing
  two absent values into a false match — and so does a session interrupted inside the write
  protocol, which invalidates `spec_stamp` BEFORE spec.md is rewritten for exactly this
  reason.
- either stamp is present but **malformed** — not an object, or missing `generation` or
  `lines`, or carrying a non-integer in either — → **fail closed**, treat as **stale**. Same
  direction as the `null` rule above and stated separately because it is a different state:
  `null` is the documented default a well-behaved reader produces, malformed is a value some
  writer actually put there. Neither may be compared; a `>` or `!=` against a non-integer has
  no defined answer here, and guessing one is how a stale spec reads clean.
- the live line count of spec.md cannot be obtained (the gate's own read of spec.md failed) →
  **fail closed**, treat as **stale**. This is the closest thing left to the mtime mechanism's
  I/O-failure axis, and it is narrower: it fires when the READ fails, never when the count is
  merely wrong.
- `spec_stamp.generation != spec_stamp_at_critic.generation` → **stale**
  ("critic 이후 spec.md가 변경됨" — phrased subject-neutral; this covers BOTH a user Modify
  edit and an Auto-revise re-synthesis that was interrupted before Step 2.6's re-critic pass
  completed — the mechanism cannot and does not need to tell those two apart, since the safe
  action is identical either way).
- `spec_stamp.lines != spec_stamp_at_critic.lines` → **stale**. Redundant with the generation
  check whenever the write protocol ran in full; it is here for the case where it did not — a
  spec.md rewritten by a site that forgot to advance the generation.
- the live line count of spec.md `!=` `spec_stamp.lines` → **stale**. This is the only check
  that sees an edit made OUTSIDE the orchestrator — a user opening spec.md in an editor.
- otherwise → **not stale**.

**Disclosed limits, inline because they bound what a `not stale` verdict may be taken to
mean.** Three, kept separate rather than merged into one sentence, because they fail in
different ways:

1. **Line-count-preserving external edits are not detected.** A word swapped inside one line
   moves nothing this check reads. The mtime comparison this replaced detected every external
   edit; the line count narrows that loss, it does not close it.
2. **The line count is produced by the orchestrator itself**, by counting the content it just
   read — not by a tool that returns a number. It is therefore as reliable as the model doing
   the counting, which is a weaker guarantee than a filesystem timestamp, and the failure is
   silent in both directions: an undercount reads as an edit that did not happen (false
   stale, harmless), an overcount that happens to match reads as no edit at all (false not
   stale, not harmless).
3. **A generation that was simply never advanced is indistinguishable from one that did not
   need to be.** mtime had no such state — the filesystem stamped it whether or not anyone
   remembered to.

All three are the price of the one property the stamp has and mtime does not: **it can be
evaluated by a gate that holds no filesystem tool at all**, which is the whole reason for the
change (`design/harness-ordering-enforcement/SPEC.md` §3, gitignored — not a public link; the
committed copy is at that path in this repository).

This determination applies unchanged whether Pass A is rendered by a first `/harness-gate`
session, by the `/harness-gate` session that follows a `/harness --modify` / `--auto-revise` /
`--critic` re-entry, or reached via `skills/harness/SKILL.md` §Session Recovery routing
predicate (c) after a session boundary — see that predicate's note about the
interrupted-Auto-revise case.

#### Auto-revise Exposure Predicate (single source — Pass A rows ①-a/①-b/①-c and the
pre-dispatch check in `skills/harness/SKILL.md` §Step 2 WORKFLOW path — Auto-revise re-entry both cite this by name;
neither restates it)

Auto-revise is offered ONLY when ALL of:
1. `path_resolved == "workflow"` AND `runs.plan.runId != null` — this session currently has a
   live, resolvable Workflow path AND a WORKFLOW-path Plan run is on record (`runs.plan.runId`
   persists across sessions in state.json, so a non-null value does NOT by itself prove "this
   session" — session-scoping is carried entirely by the `path_resolved` reinterpretation at
   `skills/harness/SKILL.md` §Session Recovery step 6, not by this field; two distinct facts, combined, not substitutes
   for one another). Step 2.6's permission-denial branch does NOT re-record `path_resolved`.
2. **proposals.json validity check** passes — `.harness/planner/proposals.json` (a) exists,
   (b) parses as JSON, (c) parses to an array, (d) the array is non-empty, (e) every element
   has non-empty `persona` and `summary` fields. All 5 points, not merely "the file exists"
   — a present-but-malformed file must NOT expose Auto-revise only to fail at dispatch time.
3. `plan_critic.round` is unset or `0` (below its bound of 1 — see `skills/harness/SKILL.md` §Step 2.6's single-write
   note).
4. The Stale Determination above resolved to **not stale**.

If Auto-revise is not exposed, the gate still functions fully — see Pass A's row-by-row
option sets below, none of which depend on Auto-revise being available.

#### Well-formedness Determination (single source — computed fresh once per gate render,
frozen for the remainder of that render; referenced by NAME — never restated — by every Pass A
row condition below and by §State-Space Derivation just below it)

Applies only when `plan_critic.applied == "executed"` (the carried-over, `"failed"`, and
unrecorded states never reach this check — see §State-Space Derivation). A record is
**well-formed** when ALL of:
- `plan_critic.counts.critical` and `plan_critic.counts.major` are both present and are
  non-negative integers (this is also what makes the dirty condition's literal `>= 1` exactly
  the negation of `== 0` below — no third case is possible), AND
- `plan_critic.last_findings_path != null`, AND
- the file at that path actually exists on disk — an I/O check, evaluated exactly ONCE per
  gate render and never re-checked per row, so a filesystem change mid-render cannot make two
  rows match or none match.

If the existence check's I/O fails for any reason (permission error, path unavailable, tool
error) → **fail closed**, treat as malformed (the same fail-closed direction as the Stale
Determination above — an unreadable "yes it's there" must never be read as a pass). A record
that is `"executed"` but NOT well-formed is **malformed**.

#### State-Space Derivation (single source — Pass A's seven rows below implement exactly what
this table derives; re-run this derivation, don't patch individual rows, if a future change
adds a `plan_critic.applied` value or a new Step 2.6 failure branch)

**Top axis — `plan_critic.applied`, 4 values, exhaustive and mutually exclusive** (slice A
fixed the recorded value set to exactly `"executed"` / `"skipped"` / `"failed"`; the 4th value
is the absence of a record, `unrecorded`):

| `applied` | Reachable via | → Row |
|---|---|---|
| unrecorded | no Step 2.6 write yet, OR `skills/harness/SKILL.md` §Step 2.6 failure branch (ii) (the only branch that leaves `plan_done` without writing `plan_critic`; it reaches this gate when the user types `/harness-gate` — the command §After Plan Phase names — instead of re-running `/harness`, whose routing predicate (b) would land back on Step 2.6) | ④ |
| `"skipped"` | TWO writers, each co-writing its own `source` in the SAME write: `skills/harness/SKILL.md` §Step 2.6 Skip-vs-run's carried-over branch (`source = "carried_over"`), and that step's `cli_flags.fast` skip (`source = "fast"`). `applied == "skipped"` therefore implies `source ∈ {"carried_over", "fast"}` — row ③ splits on which | ③ |
| `"failed"` | failure branch (iii) | ④ |
| `"executed"` | success path, or a fresh "Run Critic anyway" / "Retry Critic" / Auto-revise re-dispatch | split below |

**`"executed"` splits on the Well-formedness Determination** (above): **malformed** → row ④
(joins unrecorded and `"failed"` there via an explicit OR — not a fallthrough default). Row ④
is therefore also expressible as the plain complement: every state that is neither row ③
(`applied == "skipped"`) nor rows ①-a/①-b/①-c/②/②-b (`applied == "executed"` AND
well-formed) — this equivalent phrasing is what keeps row ④ closed even against a future
`applied` value outside today's 3-plus-unrecorded set.

**Well-formed** splits clean/dirty: `counts.critical == 0 AND counts.major == 0` → **clean**;
otherwise → **dirty** (well-formedness already guarantees both counts are non-negative
integers, so "otherwise" here is exactly `critical >= 1 OR major >= 1` — the literal condition
rows ①-a/①-b/①-c use; the two phrasings are equivalent by construction).

- **Clean** then splits on the Stale Determination alone (AC-C22: staleness applies to clean
  exactly as it applies to dirty) — **not stale** → row ②; **stale** → row ②-b.
  (Well-formedness guarantees `last_findings_path != null` and file existence, so the Stale
  Determination's **stale-unknown** outcome — which fires only when `last_findings_path ==
  null` — cannot occur inside "well-formed"; only its stale/not-stale range is reachable here.
  This is a consequence of well-formedness, not a redefinition of the Stale Determination
  itself, which keeps its full 3-value range as the single source.)
- **Dirty** splits on the Stale Determination first — **stale** → row ①-b (Exposure Predicate
  points 1–3 are moot here: point 4 alone already closes Auto-revise, regardless of 1–3).
  **Not stale** then splits on the Auto-revise Exposure Predicate's points 1–3 — **all three
  hold** → row ①-a; **one or more fails** → row ①-c.

**Coverage — 9 cells → 7 rows, 0 overlap · 0 gap** (each axis above is total and mutually
exclusive over its own domain, so this holds independent of evaluation order; first-match-wins
at Pass A below remains the rendering rule but is redundant with, not load-bearing for, this
proof):

| `applied` | well-formed? | clean/dirty | stale? | Exposure pts 1-3 | → Row |
|---|---|---|---|---|---|
| unrecorded | — | — | — | — | ④ |
| `"skipped"` | — | — | — | — | ③ |
| `"failed"` | — | — | — | — | ④ |
| `"executed"` | malformed | — | — | — | ④ |
| `"executed"` | well-formed | clean | not stale | — | ② |
| `"executed"` | well-formed | clean | stale | — | ②-b |
| `"executed"` | well-formed | dirty | stale | — | ①-b |
| `"executed"` | well-formed | dirty | not stale | all 3 hold | ①-a |
| `"executed"` | well-formed | dirty | not stale | ≥1 fails | ①-c |

Row ④ absorbs 3 cells (unrecorded / `"failed"` / malformed); row ③ absorbs 1; the remaining 5
cells are each their own row — 9 cells, 7 rows.

**Latch / staleness asymmetry (by design, both conservative)**: the `applied = "executed"`
latch (`skills/harness/SKILL.md` §Step 2.6 above) asks whether THIS pass wrote a findings file — answered by existence,
which means something only because that section deletes the file before dispatching; a pass
that wrote nothing fails the latch (→ failure branch (iii) → row ④; the record never gets a
chance to be evaluated for well-formedness). The Stale Determination — a separate check,
evaluated at Pass A render time — asks whether the recorded verdict is about the CURRENT
spec.md, by comparing stamps. These are two different questions at two different moments, not
one check reused twice — the asymmetry does not create a gap because each is independently
exhaustive on its own axis. **This paragraph was titled "Equal-mtime asymmetry" and turned on
a same-second tie-break**; integer stamps have no tie case, so that rule is gone rather than
relocated — recorded here because its disappearance is a real narrowing of what the two checks
between them cover, not a simplification.

#### Pass A (conditional — row ② renders NOTHING; row ②-b DOES render)

When `plan_critic.source == "own"` AND `plan_critic.applied == "executed"` AND the record is
well-formed (§Well-formedness Determination above), render this status line immediately before
the table below — never when `source == "carried_over"`, `applied == "failed"`, `applied` is
unrecorded, or the record is malformed (rows ③/④ carry their own literal instead, so this line
never duplicates them and never dereferences a null `counts`):
`Critic: <workflow (schema-validated) | inline (1-line parse)> — C=<counts.critical>
M=<counts.major>` — the bracketed alternative is whichever branch Step 2.6's own dispatch
used (`path_resolved` at that time), and the literal is the exact same string Step 2.6
already prints (`skills/harness/SKILL.md` §Step 2.6's WORKFLOW/INLINE branches above); single space after the colon,
unaligned — do NOT apply `skills/harness/SKILL.md` §Standard Status Format's aligned convention here, or AC-4's
`grep -F` check breaks. This re-render exists because a `run_style == "phase"` session halts
right after `skills/harness/SKILL.md` §Step 2.6's own print, and the session that reaches Step 3 is a DIFFERENT one,
routed here by routing predicate (c) — without this line the assurance-level literal would
never reach the user in that later session.

Rows are evaluated top-to-bottom — **first match wins**.

| Row | Condition | Options |
|---|---|---|
| ①-a dirty, predicate holds | `plan_critic.applied == "executed"` AND well-formed (§Well-formedness Determination) AND (`counts.critical >= 1` OR `counts.major >= 1`) AND the Auto-revise Exposure Predicate holds on ALL 4 points | `{"Auto-revise", "Proceed as-is", "Modify", "Stop"}` |
| ①-b dirty, stale | well-formed (§Well-formedness Determination) AND same counts condition as ①-a, and the Stale Determination says stale (Exposure Predicate point 4 fails — regardless of whether points 1–3 also fail) | `{"Run Critic anyway", "Proceed as-is", "Modify", "Stop"}` — same option swap as row ③; a badge line "⚠ critic 이후 spec.md가 변경됨 — 아래 카운트는 그 이전 spec 기준" precedes the question. **This is how an interrupted Auto-revise loop actually resolves on resume**: `skills/harness/SKILL.md` §Session Recovery routes here per routing predicate (c); this row detects the staleness and offers the equivalent of a fresh Step 2.6 pass via "Run Critic anyway", instead of an automatic phase jump back to Step 2.6. |
| ①-c dirty, not stale, predicate fails on 1/2/3 | well-formed (§Well-formedness Determination) AND same counts condition, the Stale Determination says NOT stale (point 4 holds), but the Exposure Predicate fails on point 1 (no WORKFLOW-path Plan run on record), point 2 (proposals.json invalid or missing), and/or point 3 (`round` already at its bound) | `{"Run Critic anyway", "Proceed as-is", "Modify", "Stop"}` — same option set as row ①-b, but the banner names the actual non-exposure reason instead of staleness: "⚠ Auto-revise unavailable — <no WORKFLOW-path Plan run on record / proposals.json invalid or missing / revision round limit reached>" (never silently blank; required even though the option labels match row ①-b, because the underlying cause differs and a user comparing sessions should be able to tell which one applies). |
| ② clean, not stale | `plan_critic.applied == "executed"` AND well-formed (§Well-formedness Determination) AND `counts.critical == 0` AND `counts.major == 0` AND the Stale Determination says NOT stale | **Pass A does NOT render** — the "clean AND not stale ⇒ exactly one interrupt" case (AC-7's clean case). Go straight to Pass B. Clean AND stale is a DIFFERENT case — see row ②-b, which AC-C22 requires to render even though the record itself is clean. |
| ②-b clean, stale | `plan_critic.applied == "executed"` AND well-formed (§Well-formedness Determination) AND `counts.critical == 0` AND `counts.major == 0` AND the Stale Determination says stale | `{"Run Critic anyway", "Proceed as-is", "Modify", "Stop"}` — badge line reused VERBATIM from row ①-b ("⚠ critic 이후 spec.md가 변경됨 — 아래 카운트는 그 이전 spec 기준"; no separate `(C=0 M=0)` suffix — the status line immediately above this table already prints the current counts, and repeating them in the badge would be a second, driftable copy of the same string). This is AC-C22's clean+stale case: the 0/0 shown is the count as of the PRE-edit spec.md, not the current one — without this row that fact would be silently lost, exactly the gap AC-C22 clause 1 exists to close. |
| ③ carried-over or --fast | `plan_critic.applied == "skipped"` AND `plan_critic.source ∈ {"carried_over", "fast"}`. With `source == "fast"` there is no `{docs_path}critic_findings.md` to parse: render `C=? M=?` and the `skipped by --fast` literal in place of the `carried over from /spec` one, and keep the same option set — a `--fast` session that reaches this gate has left `skills/harness/SKILL.md` §Fast Gate unanswered, so "Proceed as-is" still prints `/harness-build`, which that skill's §Entry refuses until `gate.approved` is set. Everything below describes `source == "carried_over"` | `{"Run Critic anyway", "Proceed as-is", "Modify", "Stop"}`. Counts for display are parsed from `{docs_path}critic_findings.md`'s `## Summary` line — if that parse fails (the file is `(none)`-only, absent from a prior `dispatch_failed`, hand-edited without a `## Summary` line, or a stale leftover from a different `--output-dir` reuse), render `C=? M=?` (never `0`); show the `carried over from /spec` literal either way. |
| ④ failed / unrecorded / unknown | `plan_critic.applied == "failed"` OR `state.plan_critic` has no recorded `applied` value (unrecorded — `skills/harness/SKILL.md` §Step 2.6 failure branch (ii) is the only source of this state; see §State-Space Derivation) OR (`plan_critic.applied == "executed"` AND the record is malformed — §Well-formedness Determination above); equivalently, every state that is neither row ③ (`applied == "skipped"`) nor rows ①-a/①-b/①-c/②/②-b (`applied == "executed"` AND well-formed) | `{"Retry Critic", "Proceed as-is", "Modify", "Stop"}` + a banner showing `plan_critic.failure_reason` if present, or — when `applied` is unrecorded (`failure_reason` is absent-or-null there, since branch (ii) never writes it; null-safe per the guard rule above) — the default banner "critic 미실행 — Workflow 권한 거부 등". A THIRD combination reaches this row and matches neither clause: `applied == "executed"` with a malformed record and no `failure_reason` (the record was written by a successful pass, so nothing set that field; `skills/harness/SKILL.md` §Step 2.6's pre-dispatch delete then removed the file a later interrupted pass was about to replace). Render "critic 기록이 현재 spec에 대해 무효 — 재실행 필요" for it. Never silently blank in any of the three. Counts render as `C=? M=?` (unknown, never `0`). **"Retry Critic" dispatches on the INLINE branch only** whenever `failure_reason` indicates a permission denial OR `applied` is unrecorded (both are footprints of branch (ii), which never leaves a distinguishing `failure_reason` behind) — the `/harness --critic` session it prints never re-issues the denied Workflow call, because a bare re-entry command does not state that anything changed (`templates/_shared/mode_gate.md` rule 3: retry only after the user states in a NEW message that something changed; `skills/harness/SKILL.md` §Gate re-entry flags carries the same two-way condition). When the banner shows `spec_stamp_invalid`, add one line: `spec.md` is a partial write — `/harness --modify "<request>"` completes it, or Restart via `/harness`; no option here re-runs Step 2. Choosing anything other than "Retry Critic" here while `applied` is unrecorded leaves `plan_critic` permanently unrecorded for this task (see failure branch (ii) above). |

**Exhaustiveness**: rows ①-a/①-b/①-c/②/②-b/③/④ — seven rows covering all four `applied`
states (`executed` well-formed: clean × stale-or-not, dirty × stale-or-not × Exposure-points
1–3; `executed` malformed; `skipped`; `failed`; unrecorded). See §State-Space Derivation above
for the full axis-by-axis derivation and the 9-cell → 7-row coverage table proving 0 overlap
and 0 gap — it is not re-derived here.

"Run Critic anyway" / "Retry Critic" (rows ①-b / ①-c / ②-b / ③ / ④): end this turn with the
`/harness --critic` line (§Next command). The fresh own-critic dispatch (a single write to
`plan_critic`, `source = "own"`) runs in `/harness` (`skills/harness/SKILL.md` §Step 2.6); the
NEXT `/harness-gate` session re-presents from Pass A and observes the FRESH `plan_critic` state,
landing on whichever row now matches (typically ①-a or ②). For rows ①-b/②-b/③ it does not
re-land on the same row for the same spec.md, since a completed own dispatch writes a
non-null `last_findings_path` and records `spec_stamp_at_critic` equal to that spec.md's
current `spec_stamp` — row ④ CAN recur if the fresh dispatch itself fails again, e.g. a second permission denial or a second parse failure.

**Exception — row ①-c.** That row's non-exposure cause may be §Auto-revise Exposure Predicate
point 3 (`plan_critic.round` already at its bound), and a critic re-run does not reset it — so
①-c DOES re-land whenever point 3 is the cause, at which point Auto-revise stays unavailable
for that spec.md. The staleness reasoning above closes the stamp axis only. Observed
2026-08-19: the run predicted the re-landing before pressing the option and then saw it. A
full pass over this file's other blanket `never`/`always` claims is tracked separately in
ROADMAP.md rather than done here.

"Auto-revise" (row ①-a only): end this turn with the `/harness --auto-revise` line (§Next
command). `/harness` runs its `skills/harness/SKILL.md` §Step 2 WORKFLOW path Auto-revise
re-entry, which itself re-runs Step 2.6 in that same turn — so the NEXT `/harness-gate` session
renders a fresh Pass A against the revised spec.md (never a stale badge for a revision
Auto-revise itself just produced, since Step 2.6's own write records `spec_stamp_at_critic` as
a copy of the `spec_stamp` belonging to the spec.md it just critiqued — the re-entry advanced
that stamp before the re-critic read it).

"Modify" (every row): end this turn with the `/harness --modify "<request>"` line (§Next
command). **The `/harness` orchestrator itself** updates spec.md — never a dispatched
sub-agent, never this skill — under `skills/harness/SKILL.md` §Step 2's `spec_stamp` write
protocol (by name), so the edit advances `spec_stamp.generation` like any other spec.md write.
The NEXT `/harness-gate` session re-presents **starting at
Pass A** — its condition table is re-evaluated fresh, including the Stale Determination (which
will now find `spec_stamp.generation` ahead of `spec_stamp_at_critic.generation` and render the
row-①-b / row-②-b / row-③ shape as appropriate, depending on which side of the record's
clean/dirty split applies — row ④ is not on this list, since malformed/unrecorded/`"failed"`
records never consult the Stale Determination at all). See Modify Interaction below for the
contract shared with Pass B's own "Modify".

"Proceed as-is" (every row) / "Stop" (every row): same semantics as Pass B's identical
options — "Proceed as-is" writes nothing; control falls through to Pass B in this same turn,
which is where the next command is chosen. "Stop" halts immediately, here, without
reaching Pass B and without printing a command.

#### Pass B (unconditional — always renders exactly once, immediately after Pass A resolves
with "Proceed as-is" or is skipped by row ② — row ②-b does NOT skip: it renders Pass A like
any other row and only reaches Pass B via a subsequent "Proceed as-is")

Which of "Proceed as single" / "Plan as epic" leads is set by §Scale Assessment
(recommendation and/or `cli_flags.epic` override) — never re-derived here:

| Condition | Leading option |
|---|---|
| `cli_flags.epic` is non-null (a `--epic`/`--no-epic` override was given) | the OVERRIDDEN choice — "Plan as epic" if `true`, "Proceed as single" if `false`. Must never contradict the override the user explicitly gave (§Scale Assessment §3). |
| `cli_flags.epic == null` AND `state.scale.slice_hint` is present (a recommendation exists) | whichever of single/epic `sliceHint.recommendation` favors (§Scale Assessment §2, verbatim — never re-derived from counts) |
| `cli_flags.epic == null` AND `state.scale.slice_hint` is absent (INLINE path, or any degraded resume with no recommendation to lead with) | plain "Proceed" — undecorated, no recommendation framing (there is nothing to recommend) |

Print the `## Scale Assessment` block (this skill's render site — §Scale Assessment above;
`skills/harness/SKILL.md` §After Plan Phase already rendered the same frozen values when it halted, and that
is expected, not a duplicate) immediately before this question, using the values frozen in
`state.scale.*` at the end of `skills/harness/SKILL.md` §Step 2.

- "Proceed as single" / "Proceed" / "Continue implementation as one slice" → end this turn
  with the `/harness-build` line (§Next command). `skills/harness-build/SKILL.md` §Entry performs the
  `phase → "generate_ready"` write and, if `epic.boundaries` is currently non-null, the reset
  to `null` in the same write — clearing any boundary Q&A answer a prior
  `skills/harness-build/SKILL.md` §Step 3.5 visit this task recorded, so no ghost boundary
  state survives choosing single-slice (so `skills/harness-build/SKILL.md` §Step 3.6's
  epic-exit predicate cannot fire for a single-slice session). Nothing advances here.
- "Plan as epic" / "Split this task via a dedicated Slice Plan" → end this turn with the
  `/harness-build --epic` line (§Next command); `skills/harness-build/SKILL.md` §Step 3.5
  (Slice Plan) runs there and owns everything from that point. `phase` stays `plan_done`
  (per that section's own entry contract).
- "Modify" / "Edit the spec, then re-confirm" → end this turn with the
  `/harness --modify "<request>"` line (§Next command); the `/harness` orchestrator updates
  spec.md under `skills/harness/SKILL.md` §Step 2's `spec_stamp` write protocol (by name), and
  the next `/harness-gate` session re-presents **starting at Pass A** (not Pass B) — see
  Modify Interaction below.
- "Stop" / "Halt the workflow" → halt, printing no command.

#### Modify Interaction (shared contract — both passes' "Modify" option)

1. Whichever pass is re-presented after a Modify always shows critic-related counts
   (Pass A rows ①-a/①-b/①-c/②-b/③/④) computed against the spec.md version that was current
   BEFORE this Modify's edit, until a fresh Step 2.6 / "Run Critic anyway" dispatch updates
   them — the Stale Determination above is exactly what surfaces this ("critic 이후 spec.md가
   변경됨").
2. Once a Modify has changed spec.md, Auto-revise is NEVER offered on the immediate
   re-presentation — the Stale Determination's stamp comparison (point 4 of the Auto-revise
   Exposure Predicate) already enforces this structurally; no separate flag is needed. This
   holds across the session boundary every Modify now crosses (`/harness --modify` runs in
   its own turn, and this gate re-renders in the next) exactly as it held for the former
   same-turn loop — the stamps live in state.json and the comparison is recomputed fresh at
   every render (see the Stale Determination header note), so the rule cannot silently expire at
   a session boundary. Item 1's "computed against the spec.md version that was current BEFORE
   this Modify's edit" is what `spec_stamp_at_critic` now records literally.
3. Re-presentation after Modify ALWAYS restarts at Pass A (never Pass B directly) — even
   when the edit was made from Pass B's own "Modify" — so the fresh staleness state gets a
   chance to render its row before Pass B is reached again.
</HARD-GATE>

No state.json write follows this gate. The only thing that leaves it is the printed next
command (§Next command); `skills/harness-build/SKILL.md` §Entry owns the `generate_ready`
write, and `/harness` owns every re-entry (`--modify` / `--auto-revise` / `--critic`).

## Architecture Principles

The registry of invariants is `skills/harness/SKILL.md` §Architecture Principles; this skill
exercises the subset below and nothing beyond it.

1. **Orchestrator reads no intermediate files** — of the registry's 6 live read exceptions (7 numbered slots) this skill
   performs **2**: (1) `spec.md` at the plan gate (the line count for the Stale Determination is
   re-read at every Pass A render), and (7) gate-display critic count parsing
   (`plan_critic_findings.md` / `critic_findings.md` `## Summary` line). It performs NO write —
   not `state.json`, not `spec.md`, nothing under `.harness/` (the tool set makes this
   structural, not a rule).
5. **All external paths pass through Path Validator before use** (see §Path Validator below —
   `docs_path` from state.json is validated at §Entry Check 6 before any file under it is read).
6. **Gates never enter segment scripts.** This skill IS the spec-confirm gate (HARD GATE #1 of
   the pipeline's 3); it dispatches no script. The gate renders as up to two sequential passes
   (Pass A, Pass B) inside ONE `<HARD-GATE>` tag — a pass is not a separate gate.

<!-- BLOCK-START:hx-path-validator v2 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
### Path Validator

`validate_path(path, kind)` with `kind ∈ {output_dir, file_reference, diff_target}` — the five normalization and rejection steps, the reserved first-segment set, the `docs/harness/` carve-out, every halt message and the attack-vector mapping are `templates/_shared/path_validator.md`. Read it before validating a path; never restate it.

Call sites: `--output-dir` parsing (`skills/harness/SKILL.md` §Step 1 item 2, `kind=output_dir`); the Session Recovery Safety Guard re-validation (`kind=output_dir`); `{failing_files_list}` injection, the Edit-tool unified-diff Apply, cold-review input collection and cold `finding.file` validation — WORKFLOW path only (`skills/harness-build/SKILL.md` §Step 5, `kind=file_reference` / `diff_target`).
<!-- BLOCK-END:hx-path-validator v2 -->

## Key Rules

- **Confirmation gates are non-negotiable.** No implicit approval. Gates live in the orchestrators — this skill renders #1 — never in a segment script.
- **No writes, ever.** This skill has no Bash, Write or Edit; every decision leaves as a printed command (§Next command).
- **User language.** All user-facing output in `user_lang` per §Output Language Contract. Glossary tokens (`PASS`/`FAIL`/`Verdict`/`[harness]`/etc.) preserved English.
- **Orchestrator reads no intermediate files.** See §Architecture Principles above for the two reads this skill performs.
