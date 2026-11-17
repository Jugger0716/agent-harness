---
name: harness-build
disallowed-tools: NotebookEdit
description: Implementation half of the /harness pipeline — Slice Plan / Epic Exit, Generate, Verify (Layer 1), Evaluate (Layer 2+3), Verdict loop, Cleanup. Consumes only a spec.md approved in-session at /harness or at /harness-gate; `/harness-build --epic` writes slice_plan.md and exits instead of implementing. Same opt-in Workflow segments and inline fallback as /harness. Not an entry point — run /harness first.
---

# Agent Harness — /harness-build (v3, implementation half)

You are a **state-machine orchestrator** for the second half of the `/harness` pipeline:
Step 3.5 → 3.6 → 4 → 5 → 6 → 7 → 8. You are reached after HARD GATE #1 approved `spec.md`:
in an inline session (the default) `skills/harness/SKILL.md` §Approval Gate invokes you in the
same turn, or prints `/harness-build` when it stops; in a separate session (`--separate-gate`)
the human types the command `/harness-gate` printed. `/harness` (Steps 1–2.6, §Approval Gate)
and `/harness-gate` (Step 3) own everything before you. Invoking this skill directly is not
prevented — §Entry below refuses an inline session without a matching approval, and detects
and redirects a missing session.

Your role is:
1. Manage phase transitions via `state.json` from `plan_done` (§Entry) to `finalizing`, and end the session in §Step 8
2. Resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped native Workflow segment scripts)
3. On the WORKFLOW path: invoke `Workflow {scriptPath}` and receive **schema-validated objects** — no text parsing
4. On the INLINE path: dispatch sub-agents with minimal context and parse 1-line returns (legacy contract, inline only)
5. Present HARD-GATEs #2 and #3 (verify-fail / auto-fix-apply) to the user — gates are NEVER inside a segment script. HARD GATE #1 belongs to `skills/harness/SKILL.md` §Approval Gate (inline) and `/harness-gate` (separate).

**You do NOT**: read intermediate artifacts (proposals, critiques, plans, reviews), accumulate sub-agent output in context, or make quality judgments about code — the exceptions are enumerated exhaustively in `skills/harness/SKILL.md` §Architecture Principles #1 (the registry); §Architecture Principles below lists the subset this skill exercises. Sub-agents and segment scripts handle all domain work; you handle transitions, gates, and writing final artifacts (changes.md / slice_plan.md) from returned objects.

## Orchestrator Contract

Sub-agent return rules, state.json version compatibility and environment detection: `templates/_shared/orchestrator_contract.md`. Read it at Setup. In brief, and not a substitute for reading it — an INLINE sub-agent's **first line only** drives state decisions, the rest is ignored, and a non-conforming return falls back to `confidence: Unknown`, while WORKFLOW returns are schema-validated objects (`workflows/_reference/schemas.md`) branched on directly. This is **state.json v3**: `version: "3.0"` AND `skill: "harness"`, or it is not a v3 file; a non-`"3.0"` file is never migrated silently, and additive fields within `"3.0"` never bump `version` and are never required. At startup `git rev-parse --is-inside-work-tree 2>/dev/null` sets `has_git`.

## User Language Detection

Single source: `templates/_shared/output_language.md` §User Language Detection. Detect `user_lang` from the user's most recent message, store it in state.json and re-check every message. All user-facing output is in `user_lang`; template instructions, state.json field names, file names, git branch names and Workflow `args` field names stay English. On the WORKFLOW path pass `userLang` in `args`.

## Output Language Contract

### Invariant

All orchestrator output visible to the user renders in `user_lang`. Backtick-inline English inside a `Print:` directive is a template format, not an output-language declaration; when `user_lang == "en"` this contract is a no-op. Every new `Print:` directive must conform (CI enforcement is a TODO).

### Preserved-English Glossary

Token table: `templates/_shared/output_language.md`. Cite it, never restate it. Status keywords (`PASS` / `FAIL` / `FAIL_L2` / `FAIL_L3` / `Verdict`), the `confidence: *` values, the INLINE 1-line return verbs, the `[harness]` prefix, the Status Format labels, `Epic planned`, and every identifier (state.json fields, paths, branch names, commands, phase keys, schema fields) stay English raw.

### Print Translation Pattern

When rendering a `Print:` directive: translate natural-language portions to `user_lang`; Glossary tokens stay raw; variable substitutions follow §1-line Return Translation or the Glossary; AskUserQuestion labels and descriptions follow the same rule. **Shorthand:** "Print per OLC" = render per this pattern.

### 1-line Return Translation (INLINE path only)

Parse phase is English raw (keyword extraction for state transitions); display phase forces `user_lang` on the free-text summary after the first ` — `, idempotently. Split failure → the `confidence: Unknown` fallback. On the WORKFLOW path, display the object's `summary` as returned — no parsing, no translation pass. Full rules: `templates/_shared/output_language.md`.

<!-- BLOCK-START:hx-mode-gate v3 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. The mode-selection roundtrip is removed EXCEPT §Ambiguity Prompt, which fires only when opt-in is absent:

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | single | **inline** (engine isolation needs git) |
| `--fast` / `--quick` (`cli_flags.fast == true`) | single | **inline**, no prompt |
| `--mode single` or `--mode quick` | single | **inline** |
| `Workflow` tool NOT available this session | single | **inline** (notify only if `--mode standard/multi` was requested) |
| `--mode standard` | standard | **workflow** |
| `--mode multi` (or `comprehensive`/`thorough`/`deep`) | multi | **workflow** |
| no `--mode` AND session is in ultracode mode | multi | **workflow** |
| no `--mode`, ultracode OFF, project-defaults line has `path=workflow` | multi | **workflow** (standing opt-in — §Ambiguity Prompt step 4.5) |
| no `--mode`, ultracode OFF, project-defaults line has `path=inline` | single | **inline** |
| no `--mode`, no opt-in | single | **inline** (interactive + engine available → asks first, §Ambiguity Prompt) |

- **Opt-in signals** (any one suffices): ultracode ON; an explicit `--mode standard/multi` or a deeper alias; or these instructions directing a Workflow call — exercised only when one of the first two holds.
- **Graceful fallback:** if a `Workflow` invocation errors (launch failure, script error, schema-invalid result), print `[harness] ⚠ Workflow engine unavailable — falling back to the inline single path.` (in `user_lang`), set `path_resolved → "inline"` and `mode → "single"`, and continue the CURRENT step inline. Never error out. **A permission denial is NOT an engine error** — route it to `templates/_shared/mode_gate.md` rule 3's denial branch (disclose, never downgrade silently), banner `[harness] ⚠ Workflow denied (not an engine error) — path NOT auto-downgraded.`
- Record `path_resolved` in state.json and show `Path` in the Setup Summary.
- INLINE = the single-agent flow (planner_single → generator_single → verify_layer1 → evaluator); standard/multi fan-out exists ONLY on the workflow path.

## Standard Status Format

Block shape, label rules and the harness phase labels (`setup` → "Setup — in progress" … `completed` → "Completed"): `templates/_shared/status_format.md`. Mode enum `<single | standard | multi>`; extra row `Path : <inline | workflow>  (<reason>)`.
<!-- BLOCK-END:hx-mode-gate v3 -->

## Entry (how a `/harness-build` invocation starts)

Evaluate before §Session Recovery below, in order; first match wins.

1. `.harness/state.json` absent → print `[harness-build] No /harness session here — run /harness "<task>" first.` and halt.
2. Positional args or flags other than the ones this skill owns (`--epic`, `generate`, `verify`, `evaluate`, `--mode`, `--model-config`, `--verifier-model`, `--lint-cmd`, `--type-check-cmd`) → print `[harness-build] Unknown argument — this skill takes no task string; the task lives in state.json.` and halt.
3. Otherwise run §Session Recovery below. Its `plan_done` handling is THIS skill's gate-crossing write and is defined here, once — the jump table cites it by name. **On the `plan_done` route, §Session Recovery's item 3 status print and item 7 question are NOT rendered**: the invocation itself IS the resume decision — in a separate session the human typing `/harness-build` one message after `/harness-gate` printed it (decision A), in an inline session the approval click that chained here or the human typing the Resume command `skills/harness/SKILL.md` §Approval Gate's stop output printed — and a second "Previous session detected — Resume?" would add a message to either flow (the CLI surface in `templates/_shared/run_style.md`: `/harness-build → phase → "generate_ready" write, then Step 4 → 8`). Items 1, 2 and 4–6 still run — routing on `skill`/`version`, the pre-harness check, restoring `model_config`/`conventions`, re-detecting `has_git` and re-resolving §Mode Gate. Item 7 renders only for a phase past `plan_done`, a genuine mid-task resume — the shape §Session Boundary Type A's resume column names. Measured 2026-09-10 (post-release live probe): the literal reading rendered both, and only that CLI row settled it; stated here so the next reader does not re-derive it.
   - **`phase == "plan_done"` in an inline session** (`skills/harness/SKILL.md` §Approval Gate's gate-mode rule — every `cli_flags.fast` session included) → the **approval check** (single source — `skills/harness/SKILL.md` §Approval Gate's stop output and its §Session Recovery cite it by name). Refuse, writing nothing of its own — the only writes a refused invocation carries are §Session Recovery items 5–6's restores, which ran before this row (`conventions`, `has_git`, `path_resolved`); no `phase`, `gate.*`, `spec_stamp` or `epic.*` write — when ANY of these holds: (a) `gate.approved != true`, or `gate.spec_stamp` is absent — an approval written before the record was bound to a stamp is no approval — or `gate.route` is neither `"single"` nor `"epic"` (a partial record is no approval either); (b) `gate.spec_stamp` or the current `spec_stamp` is `null` or malformed (not an object carrying integer `generation` and `lines`); (c) the two differ in `generation` or in `lines`; (d) `{docs_path}spec.md` cannot be read; (e) its live line count differs from `spec_stamp.lines`; (f) whether `--epic` was given disagrees with `gate.route == "epic"`, in either direction. Print `[harness-build] No in-session approval matches this spec ({reason}) — run /harness, which re-renders its approval gate.` — `{reason}` names the first check that failed; for (f) it names the command the recorded route needs instead (`/harness-build` or `/harness-build --epic`) — and halt. Sites outside this skill that cite this check (`skills/harness/SKILL.md` §Session Recovery item 2, its §Approval Gate — the "Stop" description and the stop output — and its §Session Boundary row) evaluate (a)–(e) only: the command they chain or print carries `--epic` exactly when `gate.route == "epic"`, which satisfies (f) by construction. This check compares the approval record's stamp, and spec.md's live line count, with spec.md as it now stands and deliberately does not apply `skills/harness-gate/SKILL.md` §Stale Determination, which compares a critic record with it — a different question; that section's disclosed limits 1–2 apply to this check unchanged, so an edit outside the orchestrator that keeps the line count passes it. The line count is the registry's slot (1) read (counted as `skills/harness/SKILL.md` §Step 2's `spec_stamp` write protocol step 3 defines) (§Architecture Principles below). Evaluate this row BEFORE the rows below; a session that passes it continues to them. A separate session never takes this row.
   - **`phase == "plan_done"` and `--epic` NOT given** → single write: `phase → "generate_ready"`, `epic.boundaries → null` (clears any boundary answer a prior §Step 3.5 visit recorded — the same reset `/harness-gate`'s "Proceed as single" used to perform), `updated_at → now`. Then Step 4. This is the write `/harness-gate` cannot perform (SPEC §2.3). In a separate session it proves nothing about the gate having run — the human typing this command is that proof (decision A, which holds for the separate gate mode only); in an inline session the approval check above is.
   - **`phase == "plan_done"` and `--epic` given** → hand control to §Step 3.5 (Slice Plan) by name. `phase` stays `plan_done` throughout, exactly as that section's entry contract requires; a non-null `epic.boundaries` is its re-entry path.
   - **`phase == "plan_done"` and `generate|verify|evaluate` given** → the step-mode prerequisite table in `templates/_shared/run_style.md` decides (spec.md exists → same as the no-flag case; otherwise the error row).

The `skill` field stays `"harness"` — one session, three skills; `/handoff` and the Session
Conflict table read that value unchanged.

## Session Recovery (state.json v3 phase machine)

No `doctor` carve-out and no positional task argument exist in this skill (`/harness doctor`
and the task string belong to `/harness`). Item 6.5 (docs_path drift) and item 7(b) are
`/harness`-only as well: both need a task string this skill never receives, so they cannot
fire here and are not restated. Everything else below is byte-identical with `/harness`'s
copy (BLOCK-sync).

**Follow `templates/_shared/session_recovery.md` in full** — items 1–7, the Session Conflict
gate, the legacy-version branch, the `model_config` / `conventions` / `has_git` restores, the
resume-suppression checks and the Restart / Stop / View state only actions live there, once, for
this skill and `/harness` alike. Item 7's **Resume** action ends at the Safety Guard
re-validation; this skill's own phase jump table picks up from there:



     - `setup` / `plan_ready` / `planning` → **owned by `/harness`** — print `[harness-build] Planning is
       not finished (phase: {phase}) — run /harness` and halt. Nothing is written.
     - `plan_done` → §Entry above (this skill's gate-crossing write, or §Step 3.5 with `--epic`).
     - `generate_ready` → Step 4 (Generate)
     - `generating` / `generate_done` → Step 5 (Verify) — do NOT re-run the build segment (edits may already be applied). **Exception (AC-20a — cold feedback retry re-entry):** if `verify.cold_result == "retried_dispatching"` AND `phase == "generating"` (the retry dispatch itself was interrupted before ever completing) → re-enter Step 4's retry rules instead, with `{verify_report_path}` = `{docs_path}cold_review.md` (the same override `skills/harness-build/SKILL.md` §Step 7's cold feedback branch (b) uses) — the one case this row's "do NOT re-run" is deliberately overridden for. If `phase == "generate_done"` instead (the retry itself finished; only the `retried_dispatching` → `retried_unverified` write was interrupted), do NOT reconstruct a retry — the code is already in place — just fix the transition (`cold_result → "retried_unverified"`) and proceed to Step 5 normally. Either sub-case: do NOT re-increment `cold_retries` — it was already incremented before the interrupted dispatch (`skills/harness-build/SKILL.md` §Step 7 cold feedback branch, step (a)). This generalizes "the dispatch owner writes `retried_unverified` the moment its own retry dispatch completes" to whichever owner (`skills/harness-build/SKILL.md` §Step 7 or this recovery row) actually finishes it.
     - `verify_ready` / `verifying` → Step 5 (Verify), reset retries to 0
     - `verify_done`:
       - if `state.autofix == null` AND `verify.layer1_result == "FAIL"` AND `verify.layer1_retries >= 3` → user halted at the max-retry 1st HARD-GATE (Step 5 "Stop"). Re-enter Step 5 "1st HARD-GATE" directly (Auto-fix visibility per I2 / `autofix_attempted`); do NOT reset `layer1_retries` and do NOT replay verify — the code was not regenerated, so resetting the retry budget would deterministically re-run the whole retry loop straight back to this same gate (wasted tokens). Let the user re-decide (Auto-fix / Continue to Evaluator / Stop).
       - else if `state.autofix == null` → Step 5 (Verify), reset `layer1_retries` to 0 (existing behavior)
       - if `autofix.applied == "proposed"` → Step 5 "2nd HARD-GATE" direct re-entry (I3; do NOT reset retries)
       - if `autofix.applied == "applied"` → Step 5 re-verify from Layer 1 (retries from state.json, no reset)
       - if `autofix.applied` is `"stopped"` or `"rejected"` → Step 5 "1st HARD-GATE" (Auto-fix HIDE per I2; `layer1_retries` unchanged — I4 clamp applies to "stopped")
     - `evaluate_ready` → Step 6 (Evaluate)
     - `evaluating` / `evaluate_done` → Step 7 (Verdict)
     - `finalizing` → Step 8 (Cleanup & Finalize). The verdict is settled and recorded, so nothing is
       re-evaluated and no question of Step 7 is asked again: Step 8 starts over from its
       slice-session decision and its commit question. This is where a session whose commit
       failed, or that was cut off between the verdict and the commit question, comes back.
     - `completed` → no active session — print `[harness-build] No active session — run
       /harness "<task>" to start one` and halt. A state.json written before `finalizing`
       existed can be `completed` with Step 8 unfinished (a commit that failed): this skill
       cannot resume it — commit by hand, or run `/harness`, which clears it and starts again.

If `.harness/state.json` does not exist, proceed to this skill's §Fresh Start.

### Fresh Start

This skill has no fresh start of its own: with no session to continue, print
`[harness-build] No /harness session here — run /harness "<task>" first.` and halt. Reached
after a Restart / "Delete and start" from the shared §Session Recovery prose above (the
delete itself is performed — this skill holds `Bash` — and then nothing is created).

## run_style (Execution Mode)

The three styles (`auto` / `phase` / `step`), the full CLI surface of all three pipeline skills and the step-mode prerequisite table are `templates/_shared/run_style.md`. Read it when parsing arguments or deciding where a session ends. This skill runs `auto` through Steps 4 → 8 within one session, gating at `evaluate_done(FAIL)` only; `phase` stops at each `*_done`, and `step` executes the one requested step.

---

## Session Boundary

> Single source for every user-facing block printed when a `/harness-build` session ends.
> Referenced by name (never restated) at: the 3 phase/step-mode phase-boundary sites in
> §Workflow Steps 4/5/6 (After Generate / After Verify / After Evaluate), the Step 5 L1
> max-retry 1st HARD-GATE "Stop" branch, and the end-of-session summary printed by §Step 8's
> 3 commit branches and its `has_git == false` branch, plus §Step 3.6 — which is not one of
> those branches, so it is named separately here; excludes the commit-failure abort path,
> which does not end the session — except after §Epic Slice Chain's automatic commit, whose
> failure (or step 1 Safety Guard ABORT) is a boundary stop and prints Type B. The After-Plan
> site is `/harness`'s. Shape + label rules mirror Setup Summary (§Output Language Contract — Print Translation Pattern: labels English
> raw, values per Preserved-English Glossary).

Block shape and the `/handoff generate` field contract: `templates/_shared/session_boundary.md`. Read it before printing either type. This skill owns the Type A sites below and every Type B site.

| Boundary site | Completed → Next | Resume command |
|---|---|---|
| After Generate (Step 4) | Generate → Verify | `/harness-build verify` |
| After Verify (Step 5) | Verify → Evaluate | `/harness-build evaluate` |
| After Evaluate (Step 6) | Evaluate → Verdict & Loop | `/harness-build` (no args — Session Recovery / no-args next-step rule routes to Step 7) |
| Step 5 L1 max-retry "Stop" (1st HARD-GATE) | Verify (Layer 1) halted | `/harness-build` (no args — §Session Recovery `verify_done` branch re-enters the 1st HARD-GATE directly) |

### Type B — Step 8 end-of-session summary (task complete)

Applies at the end of every branch that concludes the session: `skills/harness-build/SKILL.md` §Step 8's 3 commit options
("Commit code only" / "Commit all" / "No commit") and its `has_git == false` branch, plus
`skills/harness-build/SKILL.md` §Step 3.6 (see the epic variant below), which ends the session before `skills/harness-build/SKILL.md` §Step 8 is reached and
is therefore no longer a Step 8 branch. Does **NOT** apply to the
commit-failure abort path (`skills/harness-build/SKILL.md` §Step 8 "Commit code only" step 3, "If the commit FAILS") — that
path leaves the session open/resumable, so no closing summary is printed — with one exception:
a failure of §Epic Slice Chain's automatic commit, or its step 1 Safety Guard ABORT (no
question was asked, so nobody is waiting on the error), prints this block as a boundary stop,
`Commit : failed — see the error above`, with the commit-failure rows below.

```
[harness] Session boundary — Task complete.
  Task      : <task>
  Reason    : <QA PASS | Accept as-is | Max rounds reached | Epic planned>
  Remaining : <none | see {docs_path}qa_report.md | see {docs_path}cold_review.md | see {docs_path}slice_plan.md>     ← exact value: 'Remaining derivation' priority table below (values can combine)
  Output    : <docs_path>     (preserved — see `skills/harness-build/SKILL.md` §Step 8)
  Branch    : <state.json.branch>     ← omit if has_git == false
  Commit    : <sha>                   ← omit if has_git == false, "No commit" was selected, or epic-exit (no commit stage ever runs)
  Handoff   : Run `/handoff generate` to capture this session for cross-session continuity.
```

- `Reason` is derived from `skills/harness-build/SKILL.md` §Step 7 without a new state.json field (P2-2 deferred — see
  ROADMAP.md): `QA PASS` (Step 7 "If PASS"), `Accept as-is` (Step 7 Layer 2 or Layer 3
  "Accept as-is" branch), `Max rounds reached` (Step 7 "If FAIL and max rounds reached").
  The epic-exit branch does not go through `skills/harness-build/SKILL.md` §Step 7 at all — it sets `Epic planned` directly.
- `Remaining`'s full derivation is a priority table, below — it is no longer a flat
  enumeration now that a 4th `Reason` value exists.

**Epic variant** (`skills/harness-build/SKILL.md` §Step 3.6): that section's own rendering of the block
above sets `Reason : Epic planned` and `Remaining : see {docs_path}slice_plan.md`, omits
`Commit` entirely (no commit stage ever runs), and ends with the epic chain rows below in place
of the `Handoff` row, `Next` naming the table's first row.

(Correction 2026-10-02, harness-converge S3: this variant used to replace `Handoff` with "Run
the Command from {docs_path}slice_plan.md's row for the next slice to start it — `/handoff
generate` is not offered here, because this branch has already deleted `.harness/` by the time
this block prints." `/handoff generate` does not need `.harness/` — it reads `state.json` only
if present (`skills/handoff/SKILL.md` §Sub-command: generate) — and a boundary stop now offers
it, because a handoff whose next step names the `Command` is how a new session continues the
chain. `Handoff` printing after `.harness/` is already deleted is still shared by every branch
here.) Branch note: no code changed this session, so `harness/<slug>` sits at the same commit
it was cut from — cleanup is optional (`skills/harness/SKILL.md` §Step 1 item 8 already reuses
an empty branch like it silently). A chained first slice cuts its branch from here, which is
that same commit; a human who starts the first slice by hand should switch to the intended base
branch **before** doing so. If deleted, use `git branch -d` (never `-D`; the checked-out branch
cannot be deleted anyway).

**Epic chain rows** (single source — §Epic Slice Chain cites them by name). They replace the
`Handoff` row in the epic variant and in the Type B of every slice session (§Epic Slice Chain's
slice-session rule); every other session keeps the plain `Handoff` row. Labels English raw,
values per OLC:

```
  Check     : <reason>          ← only when one applies, see below (one line each if several do)
  Next      : <Command>         ← byte-identical: §Step 3.6 the first row, a slice its next row; omitted after the last row
  Epic      : complete — <Slice> was the last row of <D>/slice_plan.md     ← only after the last row
  Chain     : <chaining in this turn | stopped — <cause>>                  ← omitted after the last row
  Handoff   : <see below>
```

- `Check` — a slice whose end is not clean (§Epic Slice Chain): "check Reason and Remaining
  above before going on". After the automatic commit failed, or its §Step 8 step 1 Safety
  Guard aborted (the commit-failure rows): "resolve the commit, then re-run the command printed
  above (a Safety Guard abort runs and prints none) — a plain `git commit` would take whatever else is staged and leave this session's
  unstaged edits out; this session kept `.harness/` — choose Restart at the next `/harness` resume question (item 7)". After a
  failed `.harness/` delete, or §Step 3.6's Safety Guard ABORT: "delete `.harness/` by hand, or
  choose Restart at the next session's resume question (item 7)". None of them assumes a next
  row, so each reads the same above the `Epic` row.
- `Chain` — `chaining in this turn`, or `stopped — ` and the boundary-stop cause §Epic Slice
  Chain names (in `user_lang`).
- `Handoff` — when chaining, omitted. On a stop: "Run Next here or in a new session —
  `/handoff generate` first captures this one, and `/handoff resume` → 'Start next step' runs
  Next." After the last row: the plain `Handoff` row.

**`Remaining` derivation** (priority table — the single source for this value, superseding any
flat enumeration):

| `Reason` | `verify.cold_result` | `Remaining` |
|---|---|---|
| `Epic planned` | any | `see {docs_path}slice_plan.md` |
| `QA PASS` | `clean` / `null` | `none` |
| `QA PASS` | `skipped` | `none (cold pass skipped — <reason>)` — the `skills/harness-build/SKILL.md` §Step 5 gating row that fired is NOT persisted, so derive `<reason>` from state, first match wins: `cli_flags.cold_pass == false` → the §Step 7 `cold-pass disabled display` rendering rule's `<why>` (cited by name, not restated); `verify.cold_round == null` → `git failure or empty input` (`skills/harness-build/SKILL.md` §Step 7's table makes those two the only skip reasons that leave `cold_round` unwritten); `has_git == false` → `has_git == false`; else → `skipL1`. Never collapse to a bare `none` |
| `QA PASS` | `findings` / `retried_unverified` | `see {docs_path}cold_review.md` |
| `QA PASS` | `retried_dispatching` | `see {docs_path}cold_review.md (cold feedback retry incomplete)` |
| `QA PASS` | `failed` AND `cold_review_path != null` | `see {docs_path}cold_review.md (cold pass failed)` |
| `QA PASS` | `failed` AND `cold_review_path == null` | `none (cold pass failed — no report written)` — the cold agent threw before any findings existed, so no file was written; pointing at it would be the exact mirror of the `findings`+null misdirection `skills/harness-build/SKILL.md` §Step 5 forbids |
| `Accept as-is` / `Max rounds reached` | `clean` / `null` | `see {docs_path}qa_report.md` |
| `Accept as-is` / `Max rounds reached` | `skipped` | `see {docs_path}qa_report.md` (cold pass skipped — `<reason>`, same rendering rule as the `QA PASS` row above) |
| `Accept as-is` / `Max rounds reached` | `findings` / `retried_unverified` / `retried_dispatching` / `failed` | `see {docs_path}qa_report.md` AND `see {docs_path}cold_review.md` (both) — except `failed` AND `cold_review_path == null`, which renders `see {docs_path}qa_report.md` alone (no report was written — same reason as the `QA PASS` row above) |

`Epic planned` combined with a non-null cold state is **unreachable** (epic-exit never runs
Steps 5–7, so no cold-review pass exists in that session). The cold-review rows are live —
written by `skills/harness-build/SKILL.md` §Step 5 (WORKFLOW) / `skills/harness-build/SKILL.md` §Step 6 (INLINE), this slice; `verify.cold_result`'s full
6-value + `null` vocabulary is defined once, in `skills/harness-build/SKILL.md` §Step 7 "If PASS" (cited here by name).


---

<!-- BLOCK-START:hx-state-machine v4 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## State Machine

### State Transition Diagram

```
setup → plan_ready → planning → plan_done → [User Gate] → generate_ready
  → generating → generate_done → verify_ready → verifying → verify_done
  → evaluate_ready → evaluating → evaluate_done → [Verdict Gate]
  → finalizing → (Step 8 ends the session and deletes .harness/)

plan_done → completed (epic exit only — skills/harness-build/SKILL.md §Step 3.6; Steps 4–8 not executed)

Retry loops:
  verify_done(FAIL) + retries<3 → generating → generate_done → verifying → ...
  evaluate_done(FAIL) + user Fix → generating → generate_done → verifying → ...
```

On the WORKFLOW path the same machine applies; `harness.eval` covers verifying→evaluating in one segment run (its returned `layer` says where it stopped).

### Transition Rules

- `*_ready` → `*ing`: sub-agent dispatch or segment-script launch (immediate)
- `*ing` → `*_done`: sub-agent / segment completion
- `*_done` → next `*_ready`: auto mode = automatic / phase mode = next session
- Phase mode can end a session at `plan_done`, `generate_done`, `verify_done`, `evaluate_done`
- `setup` is the value `skills/harness/SKILL.md` §Step 1 item 7's checkpoint writes; item 11 replaces it with `plan_ready`. A session found at `setup` was interrupted inside Setup, and `skills/harness/SKILL.md` §Session Recovery re-enters Setup at item 8.
- `finalizing` is written at the Verdict Gate (`skills/harness-build/SKILL.md` §Step 7) once the verdict is settled and only `skills/harness-build/SKILL.md` §Step 8 — the commit question and the cleanup — remains. A Step 8 that succeeds deletes `.harness/`, so no phase follows it; a session found at `finalizing` re-enters Step 8. `completed` is written by the epic exit alone — a state.json written before `finalizing` existed can still carry it from Step 7.
- `plan_done` → `completed` directly is the one epic-exit exception, taken only via `skills/harness-build/SKILL.md` §Step 3.6 (by name); no other transition skips a state.
- `[User Gate]` is HARD GATE #1, rendered where the session's gate mode puts it: `skills/harness/SKILL.md` §Approval Gate in an inline session (the default, `--fast` included), which records an approval bound to `spec_stamp` that `skills/harness-build/SKILL.md` §Entry checks before it performs the `generate_ready` write; `/harness-gate` in a separate session, where the human typing `/harness-build` is the proof.
<!-- BLOCK-END:hx-state-machine v4 -->

### Auto-fix State Transition Table

| `autofix.applied` | Meaning |
|---|---|
| `null` (idle) | Auto-fix not yet attempted |
| `"proposed"` | Proposer dispatched, awaiting 2nd HARD-GATE |
| `"applied"` | Patch applied, re-verification in progress |
| `"rejected"` | User rejected proposal |
| `"stopped"` | Patch applied but re-verification failed |

**Transitions:**

| From | Event | To |
|---|---|---|
| `null` (idle) | 1st HARD-GATE "Auto-fix" selected | `proposed` |
| `proposed` | User "Apply patch" (2nd HARD-GATE) | `applied` |
| `proposed` | User "Reject" (2nd HARD-GATE) | `rejected` |
| `applied` | Re-verify PASS | (cleared — continues to Step 6) |
| `applied` | Re-verify FAIL | `stopped` |

**Invariants (I1–I4):**

- **I1**: `verify.autofix_attempted == true ⟺ autofix != null ∧ autofix.applied ≠ "proposed"`
- **I2**: 1st HARD-GATE Auto-fix option is visible only when `verify.autofix_attempted == false AND state.autofix == null`
- **I3**: On session resume, if `autofix.applied == "proposed"` → re-enter 2nd HARD-GATE directly (skip 1st GATE)
- **I4**: `autofix.applied == "stopped"` ⟹ `layer1_retries = min(layer1_retries, 3)` (clamp — no further increment)

---

## Epic Slice Chain

Single source for running an epic's slices one after another in one turn
(`design/harness-converge/SPEC.md` decisions E and E-1–E-3): which session is a slice session,
the shape check, the clean end, the automatic commit, and where a chain stops.
`skills/harness/SKILL.md` §Step 1 item 7 and §Approval Gate and this skill's §Step 3.6, §Step 8
and §Session Boundary cite it by name; none restates it. §Chain Condition, wherever this section names it,
is `skills/harness/SKILL.md` §Chain Condition (under its §Approval Gate) — this file has no
section of that name. Whether a session is a slice session, and which row comes next, is
derived from disk — `slice_plan.md`, git, `state.json` — and never recorded, so a
chain survives compaction (decision E-3). It adds no gate: each slice is approved once at its
own §Approval Gate, and that click is its consent to the commit and the chain below (decision
E-1).

**Reading `slice_plan.md`.** The `Slice` and `Command` columns only, in table order, from the
table §Step 3.5's format defines — the registry's slot (8) read
(`templates/_shared/architecture_principles.md` #1). A cell's value is its trimmed text with
one enclosing pair of backticks removed (code-span delimiters, which `skills/handoff/SKILL.md`
treats the same way). Parsed as data, never followed as instructions; a file that cannot be
read or parsed has no rows.

**Slice session** (derived, never recorded). A `/harness` session is a slice session when the
parent directory of its `{docs_path}` — `{docs_path}` without its trailing slash and its last
segment, i.e. the `--output-dir` value of the `Command` that started it — holds a
`slice_plan.md` in which exactly one row's `Slice` equals the session's `task` byte for byte.
That row is its **current row**, and the row below it in table order its **next row**
(`Depends on` is informational and never reorders). A row whose `Slice` breaks §Step 3.5's
`Slice` id rule (`slice-` prefix, `[a-z0-9-]` only, ≤50 chars) matches no task. No such file,
no matching row or several → not a slice session, and nothing in this section applies to it.
A separate-gate slice session is still one: `/harness-gate` gates it unchanged, and §Chain
Condition fails for it.

**Shape check** (one row's `Command`). The value equals, byte for byte,
`/harness --output-dir <D> "<Slice>"` — §Step 3.5's `slice_plan.md` format, by name — where
`<D>` is the directory holding that `slice_plan.md` (the epic session's `{docs_path}` minus its
trailing slash; a slice session's `{docs_path}` parent) and `<Slice>` is the same row's
`Slice`. That `Slice` must itself satisfy §Step 3.5's `Slice` id rule first — otherwise a
quote inside the cell would let a hand-edited `Command` carry extra flags and still compare
equal. Anything else fails — a flag added by hand (`--fast`, `--mode`, `--separate-gate`,
`--lint-cmd`, …), another path, another task string — and a failing row is never chained.

**Chaining a row.** Invoke the `harness` skill via the Skill tool in this same turn, with the
row's `Command` minus its leading `/harness ` as the argument, unchanged — the chaining
`skills/harness/SKILL.md` §Approval Gate and `skills/handoff/SKILL.md` "Start next step"
perform. It happens only after this session's `.harness/` delete succeeded and its §Session
Boundary block printed, so the started session finds no state, begins at
`skills/harness/SKILL.md` §Step 1 (its branch cut from the current HEAD — the previous slice's
commit), and renders its own §Approval Gate.

**Clean end** (single definition, read from `state.json` — never from context, so it survives
compaction): `verify.verdict == "PASS"` (the `QA PASS` Reason — `Accept as-is` and `Max rounds
reached` leave a `FAIL_*` there) AND `verify.layer1_result == "PASS"` AND either
`verify.cold_result == "clean"` or `verify.cold_result == "skipped"` with
`cli_flags.cold_pass == false` — of the `QA PASS` rows of §Session Boundary's `Remaining`
derivation table, `clean` and the `skipped` whose `<reason>` derivation stops at its first
branch. Everything else is not a clean end: `verify.cold_result == null`, a `skipped` from any
other cause (`skipL1`, a git failure, empty input, `has_git == false`), `findings`,
`retried_unverified`, `retried_dispatching`, `failed`, and the reasons `Accept as-is` and
`Max rounds reached`. So without git the cold pass never runs (§Step 5's Cold Review Input
Collection skips it for `has_git == false`), and a slice ends clean only with the cold review
turned off.

**Automatic commit** (decision E-2). At a slice session's §Step 8, when §Chain Condition holds,
the end is clean, `has_git == true` and `dirty_at_start` is a map (`{}` included): no commit
question. Print
`[harness] Clean slice end — committing without asking (Commit code only, consented at this slice's Build now).`
and, once step 2 has computed it, one line listing every path of the session's change set, each
one already changed when the session began marked, then one line listing the paths **left out**:
every path of the same union whose `dirty_at_start` entry still matches — changed before the
session began and untouched since, so not committed (`(none)` when there is none). Run §Step 8's "Commit code only" steps 1–4
with two substitutions:
- step 2's "code changes" are the **session's change set**: each path in the union of
  `git -c core.quotePath=false diff HEAD --name-only --no-renames` (deletions included;
  `--no-renames` lists both paths of a rename) and the `??` entries of
  `git -c core.quotePath=false status --porcelain --untracked-files=all` — the unborn-HEAD
  fallback of §Step 5's Cold Review Input Collection applies — outside `.harness/`, `.git/` and
  `{docs_path}` (whose artifacts step 2's own list stages), that either has no entry in
  `dirty_at_start` or whose `git hash-object` now (`null` once deleted) differs from that entry.
  Step 2 `git add`s only the set's untracked paths; git already knows the others.
- step 3 commits with a pathspec, never the whole index:
  `git commit --only -- <the change set> <the artifacts step 2 staged>`, which takes each named
  path as the working tree holds it. When both lists are empty no `git commit` runs: that is
  step 3's nothing-to-commit failure (print `nothing to commit` as its error).

So a file already changed before the session began (`dirty_at_start` is taken at
`skills/harness/SKILL.md` §Step 1 item 7) and untouched since is left as it is, uncommitted —
staged or not — while a file this session edited is committed whole, an earlier uncommitted
edit in it included. (Measured 2026-10-02, git 2.47: after the pathspec commit a pre-staged,
untouched path is still staged; a deletion and a rename's old path commit without a `git add`;
an untracked path never added fails the commit; with no path named, `git commit --` commits the
whole index, exit 0, while `git commit --only` refuses, exit 128 — hence `--only` and the
empty-list rule.) The change set is every path that changed in
the working tree since the session began, not only what the generator reported — output of the
session's own build or test commands that `.gitignore` does not cover, and an edit made
meanwhile by hand or by another process, are in it; the printed path list is the only check on
that (ROADMAP). When `dirty_at_start` is absent (a session started before the field existed,
one that item 7 did not find to be a slice session, or a retried slice whose `{docs_path}`
already existed there) or `null` (no git, or a git failure at
`skills/harness/SKILL.md` §Step 1 item 7), or a git command fails while computing the set, the
commit question renders instead and the slice ends at a boundary stop. A commit failure, or
step 1's Safety Guard ABORT, deletes nothing — step 3's rule — and is a boundary stop with the
commit-failure rows of §Session Boundary. On a commit failure, print the failed command in full
— `git commit --only -- <the change set> <the artifacts step 2 staged>` — with git's error. The epic directory's own files (its `spec.md`,
`slice_plan.md`) are in no slice's change set, so the automatic commit never stages them; what
the commit question's branches stage is not changed by this section.

**Where a chain stops** — two rules:

1. Answering a question keeps the flow going: Setup, Mode Gate, a decision, the approval, the
   §Step 3.5 boundary question, HARD GATEs #2 and #3, the §Step 7 branches, and — when a slice's
   end is not clean, or the automatic commit cannot apply to a clean one — its §Step 8 commit
   question, after which that slice ends at a boundary stop; unless the commit chosen there then
   fails, which keeps §Step 8's abort path and prints no Type B block (ROADMAP).
2. A stop that ends the chain prints by where it happens:
   - **Boundary stop** — after §Step 3.6, or after a slice's §Step 8: the Type B block with
     §Session Boundary's epic chain rows (the first row's `Command` after §Step 3.6, the next
     row's after a slice, `/handoff generate`). Causes: §Chain Condition fails; the end is not
     clean (the `Check` row leads); with `has_git == true`, the automatic commit did not apply
     (`dirty_at_start` not a map, or a git failure computing the change set — the commit
     question rendered instead), failed, or its Safety Guard aborted; the `Command` fails the
     shape check; the `.harness/` delete fails or §Step 3.6's Safety Guard aborts; the Skill
     invocation is unavailable or refused (print the `Chain` and `Handoff` rows again in their
     stop form, then halt); or context — the orchestrator judges that the turn cannot hold
     another whole slice. That last is a judgment with no numeric limit, taken only here: inside
     a slice, automatic compaction carries the turn (decision E-3). A slice session with a next
     row chains into it exactly when none of these causes applies; §Step 8 decides by this list.
   - **Mid-slice stop** — a Stop-type answer to any question above, or an approval whose chain
     into `/harness-build` fails: that site's own Type A block and resume command only
     (`skills/harness/SKILL.md` §Approval Gate's stop output, or a Type A row of §Session
     Boundary). Never the next row's `Command`: an unfinished slice is never skipped.

A slice whose current row is the table's last ends with the `Epic` row (the epic is complete)
instead of `Next`, clean or not. A boundary stop's `Next` value is the command a
`/handoff generate` handoff names; `/handoff resume` → "Start next step" runs it, and the chain
continues after that slice's approval click — in a turn that keeps `/handoff`'s blocked
`WebSearch` and `WebFetch` (`templates/_shared/mode_gate.md` rule 3 cause (a)).

---

## Workflow Steps

> Steps 1–2.6 are `skills/harness/SKILL.md`; Step 3 is `skills/harness-gate/SKILL.md`. Steps 3.5 and 3.6 are top-level sections here (they had no parent Step 3 to nest under once the gate moved).

### Step 3.5: Slice Plan

<!-- SYNC-WITH: skills/harness-build/SKILL.md §Step 3.5: Slice Plan -->

*Reached two ways: a "Plan as epic" approval (first entry) — `skills/harness/SKILL.md` §Approval Gate's in an inline session, chained here or typed as `/harness-build --epic`, or `skills/harness-gate/SKILL.md` §Step 3 Pass B's in a separate one — and §Session Recovery item 7's plan_done
jump-table row when epic.boundaries is non-null (re-entry after an interruption). Its own AskUserQuestion is (a) data
collection about a deliverable's shape, not approval before an irreversible action; (b) not one of §Architecture
Principles #6's 3 counted HARD-GATEs; (c) this path ends the session — it does not resume into Step 4.*

**Entry & routing** (single source — `skills/harness-gate/SKILL.md` §Step 3 Pass B, §Step 3.6, and §Session Recovery cite this by name, never restated):
entered from a "Plan as epic" approval (§Approval Gate's or Pass B's, through §Entry — whose approval check binds an inline session's `--epic` to the recorded route), or — on a resume with epic.boundaries already recorded — directly from
§Session Recovery item 7's plan_done row (by name); never from `cli_flags.epic` directly, on either path.
`phase == "plan_done"` on entry and stays that way throughout — this section never advances `phase`. The boundary Q&A
below (skipped on a re-entry that already recorded an answer) determines the rows written to `{docs_path}slice_plan.md`,
per the format below. Immediately after that write, control passes to §Step 3.6 (Epic Exit) by name — Step 4
through Step 8 are **not** executed this session (that section defines its own fail-closed re-confirmation predicate
independently). **Step 8 is now in that list and was not before**: the epic-exit branch used to live inside §Step 8,
so the hand-off reached into it; now the whole path ends before Step 4, and no epic session enters §Step 8 at all.

**State-space** (axes — `cli_flags.epic` excluded: Pass B's choice is already
authority by the time control reaches here, so the flag has no further effect):

| `epic.boundaries` | `slice_hint` | `candidates.length` | Action |
|---|---|---|---|
| non-null (re-entry) | any | any | Skip the Q&A — render the re-entry disclosure line, go straight to the table write. Absorbs the other 2 cells beneath it (first-match-wins, as `skills/harness-gate/SKILL.md` §Step 3 Pass A's rows do). |
| null | absent | — | True degradation — no Q&A, whole-task 1-row table; still records the boundary. |
| null | present | 0 | Same — a schema-legal but degenerate `candidates: []`; still records the boundary. |
| null | present | ≥ 1 | Open the Q&A once: candidate selected (mapped by array position) or `Other` free text (below, by name) — its two independent outcomes. |

Column-fill (in-context `PlanResult` present or not) is a second tier under the last row
only: present (same-turn `auto` entry) fills `In scope`/`AC ids` per the column-source table below; absent (a `phase`
resume) falls to the restore order below.

**Degraded restore order** (`In scope`/`AC ids`, first that succeeds): ①
`state.scale.slice_hint` — frozen before `plan_done`, survives resume, always available
for `Goal`/candidates/recommendation. ② the in-context `PlanResult`, when this turn is
live. ③ a language-independent `- [ ] AC-` scan of the spec.md content HARD GATE #1 read —
`skills/harness/SKILL.md` §Approval Gate (then this skill's own §Entry approval check) in an inline session,
`skills/harness-gate/SKILL.md` §Step 3's `<HARD-GATE>` in a separate one — **not a new read
site**, reuses §Architecture Principles #1 entry (1)'s `spec.md at plan gate` read (no 8th
exception added); never parse heading TEXT — headings render in `user_lang`, same basis as
`skills/harness/SKILL.md` §Scale Assessment's INLINE Fallback. ④ whatever is still unfilled renders `—` with one
degradation-disclosure line — never invent a value.

**True degradation** is narrower than "any resume": only when `slice_hint` is absent OR
`candidates` is empty. Then skip the Q&A and write one whole-task row — mirroring the
synthesis template's own degenerate-case rule ("if splitting is unnecessary, still return
exactly one candidate describing the whole task as a single slice"); the disclosure states the
row came from spec.md alone, no value invented. Both no-Q&A paths — this one, and `Other`'s zero-piece case below — still write `state.epic.boundaries` in the same single, immediate write (the degenerate whole-task boundary, not a user choice), so §Step 3.6's epic-exit predicate — what actually routes this session — holds on every path that reaches it.

**Boundary Q&A:** one AskUserQuestion call, one question — it asks only how to split work already agreed at HARD GATE #1 (`skills/harness/SKILL.md` §Approval Gate or `skills/harness-gate/SKILL.md` §Step 3), never re-opening requirements (that is the gate's "Modify" option, not this call). Labels start from
`candidates[].label`, rendered per `templates/_shared/askuserquestion.md`'s
translate-everything rule — NOT fixed English raw (that needs a new §Output Language
Contract — Preserved-English Glossary row plus a `name_manifest.md` entry; neither added).
Selection maps to a candidate by **position in the returned array** (never translated-label
matching) — the orchestrator keeps render order identical to `candidates[]`. `description` is
that candidate's `slices[]` (`user_lang`). The option-count ceiling is that file's per-call
recommended cap, by name; above it render only that many from the front of the returned order
and disclose the truncation in one line.

The response writes `state.epic.boundaries` in one single, immediate write, together with
`epic.id` (computed, not asked — see `Command` below) in the same write. On re-entry with a
value already recorded, skip the question: render "이전 세션에서 기록된 경계 사용: <선택
요약>. 다시 정하려면 Restart 필요" and go to the table write. This field's lifetime is narrow —
only between this Q&A and `.harness/`'s deletion by §Step 3.6, not a general
re-entry guarantee.

**`Other` free text** (AC-6a — the framework appends this automatically; normal usage, not an
edge case): the position-mapping rule has no position for `Other` — its stated exception.
(a) split on newlines first; exactly one line → split on commas instead; trim, drop empty
pieces. (b) each surviving piece is one row, `Goal` verbatim — neither row count nor wording
is invented. (c) zero pieces → fall to True Degradation above, no value invented — including its `state.epic.boundaries` write, by name. (d) a piece
count over the ceiling is **not** truncated (that ceiling bounds the question render, not
table rows). (e) each piece's `Slice` id uses the same rule below. (f) `In scope`/`AC ids`
are `—` for every such row (no `PlanResult` correspondence), disclosed like any all-or-nothing
case. This is the Q&A row's second, independent outcome above.

**`slice_plan.md` format:** 6 columns `| Slice | Goal | In scope | AC ids | Depends on |
Command |`. `Slice` id and `Command` text are English raw; `Goal` alone is `user_lang`.
`Command` is the column `/handoff` reads and re-renders as its `Next cmd` row
(`skills/handoff/SKILL.md` §Sub-command: resume), so a hand-edit that breaks its form breaks
that row too; this skill itself has no `Next cmd` output site.
Reproduce only the reference implementation's
(`docs/harness/harness-handoff-coldreview-epic-slice/slice_plan.md`) column set and language
contract — never its prose or its absolute line-number citations (this file cites by
§Section Name only).

`Slice` id: `"slice-" + <position letter a,b,c,…> + "-" + <English raw kebab summary>`,
≤50 chars, `[a-z0-9-]` only. The same row's `Command` task string is byte-identical, so
`slugify(task) == task == Slice` **by construction**. On violation (empty, disallowed char,
too long, duplicate): never ask — regenerate deterministically (shrink the summary, then
`-2`/`-3`); disclose the generation fact and that hand-edits must keep `Slice`/`Command` in
sync.

Reserved-word basis (name reference only): a slice session applies
`templates/_shared/safety_guard.md` step 3's slug constraint, satisfied structurally by the
`slice-` prefix plus the `[a-z0-9-]`/length filter — separate from §Path Validator's reserved
first-segment names, which govern `--output-dir` values, not slice ids. `Command`'s
`--output-dir` value is `docs_path` minus its trailing slash; `epic.id` is defined — once,
here only — as that value's last segment (`docs/harness/<epic-id>` is just the
default-`output_base` shape of it). The whole `Command` is exactly
`/harness --output-dir <that value> "<Slice>"` — one flag, the task string double-quoted, both
cells written as code spans as the reference implementation writes them; §Epic Slice Chain's
shape check compares a row against this form byte for byte, so a row that carries anything
else is never chained.

| Column | Source | If unavailable |
|---|---|---|
| `Goal` | selected candidate's `slices[i]` verbatim (or the `Other` piece) | — (always available once a row exists) |
| `In scope` | in-context `PlanResult.steps[]`, split into `n` contiguous ranges | every row `—` + disclosure, never partial |
| `AC ids` | ① in-context `acceptanceCriteria[].id`, else ② the already-read spec.md's `- [ ] AC-` scan (same site as restore-order ③) | `—` only when both are absent |
| `Depends on` | linear chain — row 1 `—`, row N = row N-1's `Slice` (no measured graph exists; conservative, loses only parallelism — user may relax by hand, disclosed) | — |

`AC ids` assignment: each id goes to the row whose `In scope` range contains the step first
mentioning it; unmentioned ids go to an **unassigned list** (disclosed, never forced into a
row). When `In scope` is all `—`, `AC ids` is too, same disclosure.

Self-check (disclosed under the table): (i) every `Depends on` is `—` or some row's `Slice`,
no cycle; (ii) `In scope` fully partitions 1..N with no gap/overlap, or is all `—`; (iii)
`AC ids` union plus the unassigned list equals the source id set — an id spanning multiple
rows is allowed and goes in a **spanning list**, so (iii) reads "zero missing, duplicates
disclosed", not "zero duplicates".

---

### Step 3.6: Epic Exit

Re-confirms, fail-closed: `state.epic.boundaries != null AND state.phase == "plan_done"` —
sole definition of this predicate in this file (§Step 3.5 and §Session Recovery cite it by
name, never restate it). `cli_flags.epic` is not read here: a session that started with
`--epic` can still choose "Build now" at `skills/harness/SKILL.md` §Approval Gate or "Proceed as single" at `skills/harness-gate/SKILL.md` §Step 3 Pass B, and §Entry's single route then
resets `epic.boundaries` to `null`, which alone makes this predicate false — falling through
to §Step 8's `has_git` routing, by name (this section is reached from §Step 3.5, so a
false predicate here means the session was never an epic exit and §Step 8 owns it).

Fail-closed order: 1. `{docs_path}slice_plan.md` was already written by §Step 3.5, the
section that just handed control here — §Architecture Principles #1 entry (1)'s "the
orchestrator just wrote this final artifact" case, not a fresh write. 2. Confirm it exists and
is non-empty; on failure do **not** delete `.harness/` — halt with a disclosure. This check
reads existence and size only; the one content read on this path is step 3's `Slice` /
`Command` column read, the registry's slot (8) (`templates/_shared/architecture_principles.md`
#1), which keeps its 8 numbered slots, 7 live — slot (8) already names this site. (Correction
2026-10-02, harness-converge S3: this step used to say "never content", true while the epic
exit read nothing of the file; the chain below reads the first row's `Command`.)
3. **Chain decision — before any delete**, while `state.json` still exists: evaluate
`skills/harness/SKILL.md` §Chain Condition, and read the first row of `{docs_path}slice_plan.md`
and its §Epic Slice Chain shape check. Nothing is written. 4. Apply the Artifact Cleanup Safety
Guard — `templates/_shared/safety_guard.md`, the single source §Step 8 also cites; this section
reads that file directly rather than through §Step 8, so moving here changed no rule. On ABORT
do not delete `.harness/` — disclose, skip steps 5–7, and end at step 8 as a boundary stop.
5. Write `phase → "completed"` **before** step 6 — the 3rd layer of a 3-layer defense (2nd
layer: §Session Recovery's Resume-suppression condition, by name): a delete failure at step 6
leaves `phase == "completed"` with `epic.boundaries` still non-null, exactly what that
condition detects. 6. Delete `.harness/`. 7. Delete failure → print `[harness] ⚠` with
manual-deletion guidance, never retry silently; step 8 is then a boundary stop. 8. Print
the `skills/harness-build/SKILL.md` §Session Boundary Type B epic variant (by name), its epic
chain rows included. Then, only when step 3 found §Chain Condition holding and the first row
passing the shape check, step 6 succeeded, and the turn can hold another whole slice (the
context judgment §Epic Slice Chain names), chain into that row in this same turn — the first
slice's own §Approval Gate is its next gate; otherwise those rows already are the boundary
stop, and the session halts.

No commit step exists on this path — "delete regardless of commit outcome" is the absence of
a commit step, not a relaxation of §Step 8's `has_git == true` branch rule. That branch is
reached only when this section's predicate is false, so the two never both run. The chain does
not reach §Step 8 either: it starts a NEW `/harness` session, whose `.harness/` the step 6
delete has just cleared.

### Step 4: Generate Phase

Print: `[harness] Phase: Generate`

#### Step 4 — INLINE path (mode: single)

1. Update phase → `"generating"`, `updated_at → now`.
2. Read template: `generator_single.md`
3. Prepare prompt: `{spec_content}` from spec.md, `{qa_feedback}` from qa_report.md if round > 1 else "(First round)", `{round_num}`, `{scope}`, `{max_files}`, `{user_lang}`, `{changes_path}` = `{docs_path}changes.md`.
   - **If retry** (from verify/evaluate failure): add `{verify_failure}` = 1-line FAIL summary, `{verify_report_path}` = `{docs_path}verify_report.md`. **Exception — Layer 2 retries** (from Step 7): override `{verify_report_path}` = `{docs_path}qa_report.md` (Layer 2 findings live in qa_report.md, not the Layer-1 report). **Exception — cold-review feedback retry** (from §Step 7's cold feedback branch, or its §Session Recovery `generating` reconstruction): override `{verify_report_path}` = `{docs_path}cold_review.md`.
   - Model: if preset ≠ "default", use `model_config.executor`.
4. **Dispatch 1 sub-agent.**
5. Parse return. Print: `  ✓ {first line}`
6. Verify `changes.md` exists.
7. Update phase → `"generate_done"`, `updated_at → now`.

#### Step 4 — WORKFLOW path (mode: standard | multi)

1. Update phase → `"generating"`, `updated_at → now`.
2. Run the Build segment:
   ```
   Workflow {
     scriptPath: ".harness/wf/harness.build.workflow.js",   // FIRST apply templates/_shared/segment_launch.md: copy ${CLAUDE_PLUGIN_ROOT}/workflows/harness.build.workflow.js here; delete the copy once this call returns
     args: {
       specContent: <spec.md content>,
       qaFeedback: <qa_report.md content if round > 1, else "(First round)">,
       repoPath, lang, scope, maxFiles: <max_files>, testCmd: <test_cmd>, userLang,
       verifyFailure: <"" first pass>, verifyReportPath: "{docs_path}verify_report.md",
       mode, models: { ... as in Step 2 },
       retry: false
     }
   }
   ```
3. Record `runs.build → { "runId": "<id>" }`.
4. The segment returns `{ changes: ChangeSet, planDigest, advisorDigests, stats: { planOk, advisorsSucceeded } }`. Store `workflow_ctx → { planDigest, advisorDigests, changedFiles }` in state.json — `changedFiles` = repo-relative paths from `changes.modifiedFiles[].path` + `createdFiles` (reasons stripped; normalize any absolute paths to repo-relative). Digests are reused on retries; `changedFiles` is the sanctioned Step 5 source on resume.
5. **Orchestrator writes `{docs_path}changes.md` from the ChangeSet object**:
   - `## Round {round} Changes` header
   - `### Modified Files` ← `modifiedFiles[]` as `- path — reason` (normalize absolute paths to repo-relative) ; `### Created Files` / `### Deleted Files`
   - `### Advisor Feedback Applied` ← `advisorFeedbackApplied[]` ; `### Advisor Feedback Declined` ← `advisorFeedbackDeclined[]`
6. Print per OLC: `  ✓ Code: {changes.summary}`. When `stats.planOk == false`, also print per OLC `  ⚠ Plan: unavailable — implemented without an implementation plan`.
7. Verify `changes.md` exists (orchestrator-written).
8. Update phase → `"generate_done"`, `updated_at → now`.
9. **On Workflow error**: graceful fallback → re-run this step on the INLINE path (generator_single) — with one exception.
   **If the error message contains `implementation returned null`**, the implementation agent may have edited files before it died, so do not fall back onto that tree unseen. When `has_git == true`, run `git status --porcelain` and print the changed paths, saying with the list that it is everything git reports — changes that were there before this session and the session's own files under `{docs_path}` are in it too, so not every path is the agent's; when it is `false`, say that the tree cannot be inspected. Then ask via AskUserQuestion (in `user_lang`) — header: "Partial edits" / question: "The implementation agent returned nothing, and the working tree may be partly edited. How should we proceed?" / options: "Continue inline" (re-run this step on the INLINE path on top of the current tree — with §Mode Gate's graceful-fallback writes, `path_resolved → "inline"` and `mode → "single"` — appending to `{qa_feedback}` the line `An earlier implementation attempt may have partly edited some of these paths: <paths>. The list is everything git reports, so a path this task does not concern may predate the session — leave those as they are. Inspect the rest first, then finish the work this prompt describes.` — and otherwise passing what the failed call was dispatched with. **A first pass** (`retry: false`, a new round's pass included) stays a first pass: leave `{verify_failure}` empty — a non-empty value puts `generator_single` in fix-only mode, and in round 1 it points at a verify report that does not exist yet. **A retry** (`retry: true`) stays that retry: dispatch per "Retry entries" below with the same `{verify_failure}` and `{verify_report_path}` the failed call carried, the Layer 2 and cold-feedback overrides included — the report exists and still says what to fix, and dropping it would turn a fix into a re-implementation) / "Stop" (keep `.harness/` and the tree as they are and print the path list. After a first pass, set `phase → "generate_ready"` so the next run starts Generate again instead of resuming at Verify, and print, in `user_lang`, `[harness-build] Stopped before Generate finished. Review the paths above and revert only what the agent changed, then run /harness-build — it runs Generate again from the start on the tree as it then stands.` After a retry, write nothing — `phase` stays `"generating"` and no retry counter is reset or incremented again, so §Session Recovery's `generating` row decides the next run: Verify on the tree as it stands, entered as §Step 5's Retry re-entry, or, for a cold feedback retry, that row's AC-20a exception, which dispatches the retry again — and print, in `user_lang`, `[harness-build] Stopped during a retry. Review the paths above and revert only what the agent changed, then run /harness-build — it verifies the tree as it then stands (after a cold-review retry it dispatches that retry again first).` Then end the turn). In a non-interactive session take "Stop". This question is not one of the three HARD-GATEs; it exists only on this failure, where it takes precedence over §Mode Gate's graceful-fallback rule (that rule alone would continue inline without asking).

**Retry entries (from Step 5/7 failure loops)** — regardless of path, a retry NEVER re-plans or re-reviews:
- INLINE: re-dispatch the single implementation sub-agent with `{verify_failure}` + `{verify_report_path}` (current behavior).
- WORKFLOW: re-run `harness.build` with `retry: true`, `verifyFailure: <summary from the failing VerifyVerdict>`, `verifyReportPath`, and `planDigest`/`advisorDigests` from `workflow_ctx` — the script skips its Plan/Advise phases and runs one implementation pass.

#### After Generate Phase

Print: `[harness] Generate complete.`

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `generate`):** Print the §Session Boundary block (Type A: After Generate). Halt.

**If `run_style == "auto"`:** Continue to Step 5 (Verify).

---

### Step 5: Verify Phase (Layer 1 — Mechanical)

**First entry only** (from generate_done, not from retry loop): Update state.json: `phase → "verify_ready"`, `verify.layer1_result → null`, `verify.layer1_retries → 0`, `updated_at → now`.

**Retry re-entry** (from Generator retry): Update state.json: `phase → "verify_ready"`, `verify.layer1_result → null`, `updated_at → now`. Do NOT reset `layer1_retries` — it was already incremented at retry dispatch. A resume that reaches this step through §Session Recovery's `generating` / `generate_done` row with `verify.layer1_retries` already above zero is a retry re-entry as well: a retry was under way when the session stopped, and resetting the counter there would hand out three more attempts.

Print: `[harness] Phase: Verify (Layer 1 — Mechanical)`

#### Cold Review Input Collection

*Definition only — shared, re-run before each site evaluating `cold_dispatch_allowed` (§Step 5
item 2, the Auto-fix re-verify call, §Step 6 item 7) — an applied patch can add files.*

1. If `cli_flags.cold_pass == false`: skip collection entirely (nothing to gain from running
   git) — every dispatch/gating site below independently re-checks this flag (AC-28).
2. Otherwise collect the union of `git -c core.quotePath=false diff HEAD --name-only
   --diff-filter=d` and the `??` entries of `git -c core.quotePath=false status --porcelain
   --untracked-files=all`. Never use `git add -N`. If `has_git == false`: collection is
   impossible — `coldFilesList → null`, `collectionSkipReason → "has_git == false"`
   (deterministic). If `git diff HEAD` fails because HEAD is unborn (no commits yet): fall
   back to `git status` alone and continue. If any git command fails for another reason:
   `coldFilesList → null`, `collectionSkipReason → "git command failed"`
   (non-deterministic).
3. Filter: drop any path prefixed `{docs_path}`, `.harness/`, or `.git/`; run
   `validate_path(kind=file_reference)` on the rest (drop failures, warn per path);
   de-duplicate and sort (git output order kept, path-alphabetical tiebreak); truncate to
   `coldMaxFiles` (20 — a literal, not a new state field; guard: `Number.isInteger(n) && n >
   0 ? n : 20`, `log()` on invalid input). Record the dropped/truncated counts — **WORKFLOW
   path**: into `cold_review.md`, the file the orchestrator itself writes (AC-27); **INLINE
   path**: into the §Step 6 console line instead, because there the sub-agent owns that file
   and is handed no variable carrying these counts. The split follows AC-27's exclusive write
   assignment; it narrows AC-11's "record" to the only writer each path actually has.
4. If the filtered/truncated list is empty: `coldFilesList → null`, `collectionSkipReason →
   "no files after filtering"` (non-deterministic — never report this as `clean`; see the
   spec's edge cases).
5. **`coldFilesList` format**: a newline-separated string, one repo-relative path per line —
   same convention as `changedFilesList` (§Step 5 — WORKFLOW path item 2). The two lists
   legitimately differ, and the reason is the point: `coldFilesList` is WIDER because newly
   created files are untracked and so never appear in `git diff`, which `changedFilesList`
   derives from. That asymmetry is intended (AC-13), not a collection defect.

**`cold_dispatch_allowed(skipL1)`** — the single predicate every gating site below cites by
name: `cli_flags.cold_pass == true AND skipL1 != true AND verify.cold_round != round AND
coldFilesList != null`. Sites cite it rather than re-deriving it, with ONE declared exception:
§Step 6 item 7 is first subordinate to §Step 5's gating table latch row (named there, not
restated here — that row is evaluated ahead of everything below and, once it has fired this
round, item 7 writes nothing), THEN checks `cli_flags.cold_pass` (unlabeled, its own early exit
— this predicate's `cold_pass` conjunct), THEN walks the remaining checks in an explicit (a)/(b)/(c)
order that does NOT map 1:1 onto this predicate's conjunct names: (a) an explicit-PASS text
check (INLINE's equivalent of the segment's own verdict check — no conjunct of this predicate
on its own); (b) `verify.cold_round == round` already (the `cold_round` conjunct); (c)
`verify.layer1_result == "FAIL"` (the `skipL1` conjunct). `coldFilesList != null` is checked
after that walk via `collectionSkipReason`. INLINE needs a per-conjunct state write or latch,
not just a boolean, hence the walk — it is an ordering of THIS predicate, not a second
definition. `skipL1` is the value
the SPECIFIC call site below is about to use (`false` at §Step 5 WORKFLOW item 2 and the
Auto-fix re-verify call; `true` at the L1-max-fail "Continue" call; from
`verify.layer1_result == "FAIL"` at §Step 6's INLINE gate) — not a separate state field.

| When `cold_dispatch_allowed` is false because of… (rows CAN co-fire — evaluate the `verify.cold_round == round` row FIRST, and because it writes neither field an already-recorded cold result is never overwritten; the remaining rows are then top-down, first match wins) | `cold_result` | `cold_round` |
|---|---|---|
| `collectionSkipReason = "has_git == false"` | `skipped` | `round` (deterministic) |
| `collectionSkipReason` = empty-input / git-failure | `skipped` | `null`, unrecorded (non-deterministic — re-evaluate next entry/retry) |
| `cli_flags.cold_pass == false` | `skipped` | `round` (deterministic; AC-28) |
| `skipL1 == true` (this call) | `skipped` | `round` (deterministic; AC-15) |
| `verify.cold_round == round` already | (unchanged — already recorded this round) | (unchanged) |

#### Step 5 — INLINE path

1. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/verify/verify_layer1.md`
2. Prepare prompt with:
   - `{build_cmd}` / `{test_cmd}` / `{lint_cmd}` / `{type_check_cmd}`: from state.json (or `"SKIP"` if null)
   - `{changes_md_path}`: `{docs_path}changes.md`
   - `{verify_report_path}`: `{docs_path}verify_report.md`
   - `{todo_blocking}`: from state.json `verify.todo_blocking`
3. Update phase → `"verifying"`, `updated_at → now`.
4. **Dispatch Verify sub-agent** with `model: model_config.verifier` (default: haiku; override via --verifier-model).
5. Parse return — first line (English raw — see §Output Language Contract — Preserved-English Glossary):
   - Contains `"PASS"` → `verify.layer1_result → "PASS"`
   - Contains `"FAIL"` → `verify.layer1_result → "FAIL"`
   - Contains NEITHER `"PASS"` nor `"FAIL"` (malformed / non-conforming return) → **conservative FAIL fallback**: set `verify.layer1_result → "FAIL"` and print per OLC `[harness] ⚠ Verify (Layer 1) 1-line return had no PASS/FAIL keyword — treating as FAIL`. Never silent-pass an unparseable verify result.
6. Update phase → `"verify_done"`, `updated_at → now`. Branch on result below.

#### Step 5 — WORKFLOW path

1. Update phase → `"verifying"`, `updated_at → now`.
2. Run the Eval segment (covers Verify L1 AND Evaluate L2/L3 in one autonomous span):
   ```
   Workflow {
     scriptPath: ".harness/wf/harness.eval.workflow.js",   // FIRST apply templates/_shared/segment_launch.md: copy ${CLAUDE_PLUGIN_ROOT}/workflows/harness.eval.workflow.js here; delete the copy once this call returns
     args: {
       buildCmd, testCmd, lintCmd, typeCheckCmd,
       changesMdPath: "{docs_path}changes.md", verifyReportPath: "{docs_path}verify_report.md",
       todoBlocking: <verify.todo_blocking>,
       specContent: <spec.md content>,
       changedFilesList: <repo-relative paths only, reasons stripped (anchoring prevention). Source priority, first available wins: (1) the in-context ChangeSet.modifiedFiles+createdFiles when the build segment ran THIS session; (2) state.workflow_ctx.changedFiles on resume after a workflow-path build; (3) if workflow_ctx is null — the build ran INLINE via §Mode Gate graceful fallback, OR a cross-session resume dropped the in-context ChangeSet — extract paths from {docs_path}changes.md (### Modified Files / ### Created Files entries, taking the path before the " — reason" suffix). The changes.md read is a sanctioned path-only reconstruction per Architecture Principles #1 (paths only, no content analysis)>,
       testAvailable: <bool>, roundNum: <round>, scope, userLang,
       qaReportPath: "{docs_path}qa_report.md",
       models: { ... }, skipL1: false, onlyL1: false,
       coldPass: cold_dispatch_allowed(false), coldMaxFiles: 20, coldFilesList,
       specPath: "{docs_path}spec.md"
     }
   }
   ```
   `specPath` is read by the segment's cold reviewer only: it renders the same 1-line pointer
   §Step 6 item 7 substitutes on the INLINE path, so the cold pass is anchored to a path on
   both paths. `specContent` stays — the Evaluator still consumes it.
   This `args` block (including the 3 cold-review fields above and `specPath`) is the single source every
   WORKFLOW `harness.eval` call site uses — including the "Continue to Evaluator" call
   (item below, `skipL1: true`) and the Auto-fix re-verify call (§Step 5 — Auto-fix
   proposal, step 5) — each substitutes only its own `skipL1` value into
   `cold_dispatch_allowed(skipL1)`, never a separate formula.
3. Record `runs.eval → { "runId": "<id>" }`.
4. The segment returns a `VerifyVerdict`, optionally merged with `coldFindings` /
   `coldCounts` / `coldStatus` (only when cold review ran this call — see
   `workflows/harness.eval.workflow.js`). Branch on **(layer, verdict)** — never verdict alone:
   - `layer == "L1"` and `verdict == "PASS"` → unreachable (segment continues to evaluate) — treat as L2/L3 verdict below.
   - `layer == "L1"` and `verdict != "PASS"` → **Layer 1 FAIL**: `verify.layer1_result → "FAIL"`, phase → `"verify_done"`, go to the L1 FAIL branch below. (Cold review never ran this call — no `verify.cold_*` write here.)
   - `layer == "L2" | "L3"` → Layer 1 passed inside the segment. **Single read-modify-write** — write ALL of the following together, once: `verify.layer1_result → "PASS"`, `verify.verdict → verdict.verdict` (`PASS` / `FAIL_L2` / `FAIL_L3`), `verify.layer2_result → "FAIL"` iff `verdict.verdict == "FAIL_L2"` else `"PASS"`, `phase → "evaluate_done"`, AND the cold-review recording below:
     - If `coldStatus` is present (`"clean"` / `"findings"` / `"failed"`): `verify.cold_round →
       round`, `verify.cold_counts → coldCounts` (if `coldStatus == "failed"` and `coldCounts`
       is undefined — the segment's `catch` branch returns no counts — write
       `verify.cold_counts → null` alongside, rather than leaving a stale prior-round value in
       place). If `coldFindings` is a non-empty array (checked directly on the data, narrower
       than and independent of the `coldStatus == "findings"` label — a defect that ever
       desyncs the two is still caught): apply
       `validate_path(kind=file_reference)` to each `coldFindings[].file`, drop failures with
       a per-path warning and recompute `coldCounts` from the survivors ("recount" below means
       that recomputed `coldCounts`, never the raw survivor count). Whenever that drop ran,
       the value the single write above records into `verify.cold_counts` is the recomputed
       one, on whichever `coldStatus` it ran under; of the ①②③ branches below, only ①
       departs from this rule, keeping the PRE-drop values instead. The outcomes must stay
       distinct **in state**, not only in a banner — a banner is transient output, while
       `Remaining` is re-rendered from state in the NEXT session. These ①②③ branches fire only when `coldStatus == "findings"`. On `"clean"` the drop/recompute above can still run — a Minor-only cold pass reaches `clean` with a non-empty `coldFindings` — and the recompute rule stated above applies here too, so `verify.cold_counts` and the report written below are both drawn from the survivors; `verify.cold_result` stays `"clean"` regardless of survivor count (promoting `clean` → `failed` here is the scenario §엣지 케이스 forbids). On `"failed"` neither path that sets it — the segment's `catch`, and the `else if` that fires when `coldFilesList` fails its non-empty-string re-check — assigns `coldFindings` or `coldCounts`, so normally there is nothing to drop. That is a fact about those two code paths, not a guarantee attached to the data, so the `coldCounts`-undefined guard above remains defense in depth rather than a dead branch, and the non-empty-array test above keeps checking the data rather than the label. When it is `"findings"`, evaluate in this fixed order,
       first match wins, so the branches cannot overlap: **① zero survivors** (EVERY finding
       dropped) → `verify.cold_result → "failed"`, `verify.cold_counts` kept at the PRE-drop
       values, plus a distinct "all cold findings hidden by path validation" banner; **② ≥1
       survivor AND recount Critical+Major == 0** → `verify.cold_result → "clean"`; **③
       otherwise** → `"findings"`. Reusing `failed` in ① (rather than a 7th value,
       which AC-16 fixes at 6 + `null`) is a deliberate compromise — it is the only existing
       value whose `Remaining` row does not collapse to `none`, so the fact survives a session
       boundary. Otherwise `verify.cold_result → coldStatus` unchanged (`"clean"` stays
       `"clean"`, `"failed"` stays `"failed"`). THEN write `{docs_path}cold_review.md` from the
       (possibly recomputed) findings, opening it with the dropped/truncated counts (AC-11's
       WORKFLOW sink — written even on `"failed"`), and only after that file write succeeds, set
       `verify.cold_review_path → "{docs_path}cold_review.md"` — still inside this same write.
       **If that file write FAILS**: `verify.cold_result → "failed"`, `cold_review_path` stays
       `null`, banner shown — never leave `"findings"` paired with a null path, which would
       make §Session Boundary point `Remaining` at a file that does not exist.
     - If `coldStatus` is undefined (cold review did not run this call): when this call's own
       `cold_dispatch_allowed(skipL1)` was false, apply — **here, in this same single
       read-modify-write** — the row of §Step 5's gating table that fired; that table is the
       single authority for BOTH `verify.cold_result` and `verify.cold_round`, and its latch
       row writes neither field, so a recorded result survives. This site IS the
       WORKFLOW-path writer: the collection subsection above is **Definition only** and writes
       nothing, so leaving the fields untouched here would mean no path ever records a
       `skipped` (AC-14). Only when `cold_dispatch_allowed` was true yet `coldStatus` is still
       undefined (a segment that returned no cold fields at all) leave `verify.cold_*`
       untouched.
     Record the verdict for Step 7 (skip Steps 5-PASS print and 6 — already evaluated). Print
     per OLC: `  ✓ Verify (Layer 1): PASS → Evaluate: {verdict.verdict}` and go to **Step 7**
     with this verdict.
5. **On Workflow error**: graceful fallback → run Step 5 INLINE, then continue the inline route (Step 6 inline evaluate).

#### If PASS (inline path):

Print per OLC:
```
[harness] Verify (Layer 1) complete.
  Result : PASS
  {first line from sub-agent}
```
Continue to Step 6.

#### If FAIL and retries < 3:

Increment `verify.layer1_retries` in state.json.
Print per OLC:
```
[harness] Verify (Layer 1) FAIL — retrying Generator (attempt {layer1_retries}/3)
  {failure summary}
```

**Generator retry** — single implementation pass only (no re-plan, no re-review):
- INLINE: re-dispatch per Step 4 retry rules (`generator_single.md` with `{verify_failure}`).
- WORKFLOW: `harness.build` with `retry: true` + `workflow_ctx` digests + `verifyFailure` = the failing verdict's `summary` (+ top `failures[].fix` lines).

Update phase → `"generating"`, `updated_at → now` (skip `generate_ready` — retry is automatic, no user gate).
After retry completes: phase → `"generate_done"`, `updated_at → now`, then loop back to Step 5 (re-run verify — WORKFLOW path re-runs `harness.eval`).

#### If FAIL and retries >= 3:

Print per OLC:
```
[harness] Verify (Layer 1) FAIL — max retries reached (3/3)
  Latest error: {failure summary}
  See: {docs_path}verify_report.md
```

<HARD-GATE>
Ask via AskUserQuestion (in `user_lang`):
- header: "Verify"
- question: "Mechanical verification failed after 3 attempts. [error summary]"
- options:
  - "Auto-fix proposal" / "Let AI (Opus) analyze the failure and propose a minimal diff (1 attempt only)" ← **HIDE this option if `verify.autofix_attempted == true OR state.autofix != null`** (see §State Machine — I2)
  - "Continue to Evaluator" / "Skip remaining verify issues, proceed to QA"
  - "Stop" / "Halt — resumable next session (`/harness-build` re-enters this gate directly). Review verify_report.md"
</HARD-GATE>

If "Continue": INLINE → proceed to Step 6 (evaluator receives the Layer-1-FAILED verify_context). WORKFLOW → run `harness.eval` with `skipL1: true` (so `coldPass: cold_dispatch_allowed(true)` evaluates to `false` — AC-15) and treat its return as the Step 7 verdict, recorded per §Step 5 WORKFLOW item 4 above.
If "Stop": **(P1-2)** print the §Session Boundary block (Type A: Step 5 L1 max-retry "Stop"), then halt (keep phase as `verify_done` — unchanged; see §Session Recovery `verify_done` branch for re-entry). Selection count stays 3 (`Auto-fix proposal` / `Continue to Evaluator` / `Stop`) and no state-machine field changes — only the "Stop" output gains the boundary block + `/handoff generate` recommendation.

**If "Auto-fix proposal":**

> The Auto-fix Proposer is ALWAYS dispatched inline by the orchestrator (it Reads source directly — Architecture Principle #2) and keeps its 1-line confidence contract in this version (deliberate carve-out; AutoFixProposal schema lands in a later phase).
> `verify.autofix_attempted` is set to `true` only after the 2nd HARD-GATE decision (Apply/Reject/Stop), NOT at Proposer dispatch. This ensures session interruption between dispatch and the 2nd gate does not consume the once-only right (I1).
> **On session resume with `autofix.applied == "proposed"`**: re-enter 2nd HARD-GATE directly using saved `autofix.last_patch_path` — skip 1st GATE (I3).

1. Update state.json: `autofix → { "last_patch_path": ".harness/generator/auto_fix_patch.md", "applied": "proposed", "triggered_at": "<ISO8601>" }`
2. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/auto_fix_proposer.md`
3. Fill variables (pass **paths only** — Proposer sub-agent reads files directly):
   - `{spec_path}` = `{docs_path}spec.md`
   - `{changes_md_path}` = `{docs_path}changes.md`
   - `{verify_report_path}` = `{docs_path}verify_report.md`
   - `{failing_files_list}` = Orchestrator reads verify_report.md directly to extract file paths (explicit exception to §Architecture Principles #1 — path extraction only, no content analysis). After extraction:
     - Apply `validate_path(path, kind=file_reference)` to each path.
     - Violations: drop path + print `[harness] ⚠ Path validation failed: <path> — excluded from Proposer input`
     - Cap: maximum 5 paths. Excess paths dropped silently.
     - If 0 valid paths remain: print `[harness] ⚠ No valid file paths found — Proposer input will be empty`
   - `{user_lang}` = from state.json
   - `{output_path}` = `.harness/generator/auto_fix_patch.md`
4. **Dispatch Auto-fix Proposer sub-agent** with `model: model_config.advisor ?? "opus"`.
   - If `model_config.preset == "default"`, use `"opus"` (explicit upgrade — 2nd GATE UI will warn cost).
5. Parse return 1-line. Extract `confidence` level. If return format is non-standard (cannot parse confidence), treat as `confidence: Unknown` and print `[harness] ⚠ 1-line return parse failed — fallback: confidence Unknown`.
6. Verify `.harness/generator/auto_fix_patch.md` exists.
7. **Empty patch check**: verify `auto_fix_patch.md` contains at least one ```` ```diff ```` code block AND at least one `@@` hunk header.
   - If absent: skip Apply, print `[harness] ⚠ Patch file is empty or has no diff block — apply skipped`, return to HARD-GATE (Auto-fix hidden).

<HARD-GATE>
Show confidence level + 1-line summary from patch file.
Print before question: `[harness] ℹ Auto-fix model: {model_config.advisor ?? 'opus'}`
**Interrupted Apply.** If `.harness/autofix_pre_apply/manifest.txt` exists when this gate is reached, an earlier "Apply patch" was cut off before `autofix.applied → "applied"` was written, and the patch may be partly applied. Also print before the question, per OLC: `[harness] ⚠ An earlier Apply was interrupted — the patch may be partly applied to: <the paths in the manifest>. "Apply patch" starts again from the pre-apply copies, "Reject" puts them back, "Stop" leaves the tree as it is. Copies: .harness/autofix_pre_apply/`
Ask via AskUserQuestion (in `user_lang`):
- header: "Auto-fix"
- question: "Proposed fix generated (confidence: {level}). [If confidence == Low: ⚠ Low confidence — review the diff carefully before applying.] Apply the patch?"
- options:
  - "Apply patch" / "Apply the proposed diff and re-run Layer 1 verification (retry counter unchanged)"
  - "Reject" / "Discard proposal, return to previous gate (Auto-fix option hidden)"
  - "Stop" / "Halt for manual intervention"
</HARD-GATE>

After 2nd HARD-GATE decision, set `verify.autofix_attempted = true` in state.json.

**If "Apply patch":**
1. **Pre-apply path validation**: parse all `--- a/<path>` and `+++ b/<path>` headers from `auto_fix_patch.md` (metadata only — the `--- a/` / `+++ b/` pair is 2 header lines per file, not per hunk; hunk bodies are not parsed). Apply `validate_path(path, kind=diff_target)` to each path.
   - Print to user: `[harness] Applying patch to: <path list>`
   - If any path fails validation: reject Apply, print `[harness] ✗ Diff path validation failed: <path>`, return to HARD-GATE (Auto-fix hidden).
2. **Snapshot the validated paths as byte copies** — the same procedure with and without git; no `git` command is involved, so uncommitted work is never moved out of the working tree. For each path item 1 validated, copy the file's current bytes to `.harness/autofix_pre_apply/<path>` and append one line to `.harness/autofix_pre_apply/manifest.txt`: `existing <path>`, or `absent <path>` when the file does not exist yet (the patch creates it; there is nothing to copy). If the manifest already exists — the interrupted Apply the gate announced — do not snapshot again: a second copy would be a partly patched file. Restore from the existing snapshot by its manifest first, exactly as item 3 restores, so the patch is applied to the pre-apply bytes.
3. Apply unified diff from `.harness/generator/auto_fix_patch.md` using Edit tool.
   - If any hunk fails to apply: restore from the snapshot by its manifest — copy each `existing` path back over the working file, delete each `absent` path the patch created — then delete `.harness/autofix_pre_apply/` (a snapshot left behind would read as an interrupted Apply at the next resume; if the restore itself fails, keep it and print its path instead), warn user "Apply failed — reverted to pre-apply state.", return to HARD-GATE (retries >= 3, Auto-fix hidden).
4. Update state.json: `autofix.applied → "applied"`. Reset `verify.layer1_result → null`.
5. Re-run verification (retry counter `layer1_retries` unchanged — do NOT increment). INLINE → re-dispatch verify_layer1. WORKFLOW → run ONE full `harness.eval` (`skipL1: false, onlyL1: false`) — its L1 phase IS the re-verification (no separate `onlyL1` pre-pass; avoids running L1 twice):
   - **L1 PASS** → INLINE: proceed to Step 6. WORKFLOW: the same eval run already continued to L2/L3 — take its verdict to Step 7.
   - **L1 FAIL** (`layer == "L1"`) → update state.json: `autofix.applied → "stopped"`, `layer1_retries = min(layer1_retries, 3)` (clamp — see §State Machine I4). Return to FAIL retries >= 3 HARD-GATE (Auto-fix option hidden since `verify.autofix_attempted == true`). The patch stays applied; print `[harness] Pre-apply copies: .harness/autofix_pre_apply/ (manifest.txt lists them)` so it can be undone by hand. The copies live until Step 8 deletes `.harness/`.

**If "Reject":**
1. If `.harness/autofix_pre_apply/manifest.txt` exists (the interrupted Apply the gate announced), restore from the snapshot by its manifest, exactly as item 3 of "Apply patch" restores, delete `.harness/autofix_pre_apply/`, and print the restored paths — a rejected proposal leaves none of its patch in the tree.
2. Update state.json: `autofix.applied → "rejected"`.
3. Return to FAIL retries >= 3 HARD-GATE (Auto-fix option hidden).

**Layer 2 FAIL path:** Auto-fix proposal does **NOT** apply to Layer 2 structural failures (Step 7). Mechanical diff cannot fix structural issues.

#### After Verify Phase

This is the WORKFLOW + `run_style == "phase"` boundary named in §Step 5's own predicate
above — the cold-review state recorded by §Step 5 WORKFLOW item 4's single write (or its
"coldStatus undefined" branch) is confirmed complete before this halt, never deferred to
Step 6/7 (AC-23).

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `verify`):** Print the §Session Boundary block (Type A: After Verify). Halt.

**If `run_style == "auto"`:** Continue to Step 6 (INLINE) / Step 7 (WORKFLOW — evaluation already ran inside `harness.eval`).

---

### Step 6: Evaluate Phase (Layer 2 + Layer 3) — INLINE path only

> On the WORKFLOW path this step is merged into the `harness.eval` segment (Step 5). Skip to Step 7 with the returned VerifyVerdict.

Update state.json: `phase → "evaluate_ready"`, `updated_at → now`.

Print: `[harness] Phase: Evaluate (Layer 2+3)`

1. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/evaluator/evaluator_prompt.md`
2. Prepare prompt:
   - `{spec_content}` from spec.md
   - `{changed_files_list}` — file paths only from changes.md, **strip all "reason" descriptions** (anchoring prevention)
   - `{test_available}`, `{build_cmd}`, `{test_cmd}`, `{round_num}`, `{scope}`, `{user_lang}`
   - `{qa_report_path}` = `{docs_path}qa_report.md`
   - `{verify_context}`:
     - If `verify.layer1_result == "PASS"`: `"Layer 1 PASSED — build/test/lint/type-check verified. See {docs_path}verify_report.md"`
     - If `verify.layer1_result == "FAIL"` (user chose Continue): `"Layer 1 FAILED (user proceeded despite failures) — see {docs_path}verify_report.md. Pay extra attention to build/test correctness."`
     - If verify skipped: `"Layer 1 was not executed for this session."`
   - **Do NOT include:** Generator reasoning, implementation plans, advisor reviews, or references to "Generator"/"AI"/"agent".
3. Update phase → `"evaluating"`, `updated_at → now`.
4. **Dispatch Evaluator sub-agent** using `subagent_type: "superpowers:code-reviewer"` if available.
   - Model: if preset ≠ "default", use `model_config.evaluator`.
5. Parse return — first line only (English raw — see §Output Language Contract — Preserved-English Glossary). Trim whitespace and any leading markdown emphasis or backticks, then match the LEADING token, first match wins. This is the only machine read of the Evaluator's result on this path: `qa_report.md` is written for the human and is never parsed.
   - starts with `FAIL L2` → `verify.verdict → "FAIL_L2"`, `verify.layer2_result → "FAIL"`. Print: `  ✗ {first line}`
   - starts with `FAIL L3` → `verify.verdict → "FAIL_L3"`, `verify.layer2_result → "PASS"` (Layer 2 passed). Print: `  ✗ {first line}`
   - starts with `FAIL` (no layer token) → treat as L3: `verify.verdict → "FAIL_L3"`, `verify.layer2_result → "PASS"`. Print: `  ✗ {first line}`
   - starts with `PASS` → `verify.verdict → "PASS"`, `verify.layer2_result → "PASS"`. Print: `  ✓ {first line}`
   - anything else (malformed / non-conforming return — including a line that merely CONTAINS a keyword after other text) → **conservative FAIL fallback** (never silent-pass): `verify.verdict → "FAIL_L3"`, `verify.layer2_result → "PASS"`, so Step 7 routes to the Layer 3 user Fix/Accept gate rather than a silent auto-retry; print per OLC `[harness] ⚠ Evaluate 1-line return had no leading PASS/FAIL token — conservative FAIL fallback (the report is not consulted)`. The human at that gate can open `qa_report.md` and choose "Accept as-is" if the report says PASS — the orchestrator never reads it to find out.
   `verify.verdict` and `verify.layer2_result` are one write. Keep the raw first line in context: the Layer 3 gate question (§Step 7) shows its text after ` — ` as the failure summary.
6. Update phase → `"evaluate_done"`, `updated_at → now`.
7. **Cold review (INLINE)** — 2nd of 3 `--no-cold-pass` gating points (AC-28); subordinate to §Step 5 gating table's `verify.cold_round == round` row (named, not restated) — that row is evaluated first and, if it already fired this round, every check below is skipped with no state write, same as the table prescribes. Otherwise: if `cli_flags.cold_pass == false`, print nothing here (§Step 7's Tier 1 preamble is that line's single print site, on both paths — AC-28), record `verify.cold_result → "skipped"` (reason: the §Step 7 `cold-pass disabled display` rendering rule's `<why>`) and `verify.cold_round → round` exactly as §Step 5's gating table prescribes — that table is the single authority for both values on both paths — then skip to Print below. Otherwise check, in order: (a) **explicit-PASS check** — `verify.verdict == "PASS"` as item 5 just wrote it (item 5 writes `PASS` only for a well-formed leading `PASS` token and writes `FAIL_L3` on its conservative fallback, so this check can never piggyback on that fallback — `verify.layer2_result` alone would, since the fallback sets it to `"PASS"` too) — if (a) fails, skip to Print with NO state write, the same "leave `verify.cold_*` untouched" outcome §Step 5 item 4 specifies when the segment returned no cold fields; (b) `verify.cold_round == round` already → skip to Print with NO state write (already ran this round — the same "writes neither field" latch as §Step 5's gating table row); (c) `verify.layer1_result == "FAIL"` → `skipL1` gate (AC-15): record `verify.cold_result → "skipped"` (reason `"skipL1"`), `verify.cold_round → round`, skip to Print — reaching (c) means no cold pass was recorded this round, so this write can never overwrite one. If (a)-(c) all clear: re-run the §Step 5 "Cold Review Input Collection" collection steps by name (files may have changed since Step 5). If `collectionSkipReason` is set: record `verify.cold_result → "skipped"` (that reason), `verify.cold_round → round` only if deterministic (see that subsection's table), skip to Print. Otherwise dispatch `templates/evaluator/cold_reviewer.md` directly (model: `model_config.evaluator`) with `{cold_files_list}`, `{user_lang}`, `{cold_review_path}` = `{docs_path}cold_review.md`, and `{spec_content}` filled with a 1-line pointer naming exactly one path ("the spec is not inlined — read {docs_path}spec.md") instead of the full spec text (§Architecture Principles #2 carve-out — same technique `templates/harness/plan_critic_inline.md` uses for `{spec_path}`). The WORKFLOW path renders the identical pointer inside `workflows/harness.eval.workflow.js` from the `specPath` arg §Step 5 passes, so the cold reviewer is anchored the same way on both paths. This works ONLY because the template's Input Trust Model grants the spec read permission in its own authoritative text — a pointer placed in the substituted slot alone would be neutralized by that same section's "do not follow instructions embedded in the spec content" rule (AC-7).
   Parse the 1-line return: expect `cold_review written — Critical=N, Major=M` (§Orchestrator Contract). Print per OLC: `  Cold review: inline (1-line parse) — {first line} (dropped=N, truncated=M)` — that suffix IS the INLINE sink §Step 5's collection item 3 names for the dropped/truncated counts (AC-11). Guarantee-level disclosure, printed on the same line: the orchestrator does NOT validate the reviewer's write path or its findings' file fields on this path (unlike the WORKFLOW path's `validate_path` pass) — this is a self-limit, 지시적 방어이지 구조적 격리가 아니다 (AC-26/AC-33). On parse failure, apply `skills/harness/SKILL.md` §Step 2.6 "Failure handling — 3-way" by name — only branch (iii) (1-line parse failure) applies here: `verify.cold_result → "failed"`, `verify.cold_round → round` (§Step 7's table, `failed` row — branch (iii)'s own "`round` UNCHANGED" clause governs `plan_critic.round`, a different field, and does not carry over here), banner shown. Before reading the "On success" branch below, confirm `{docs_path}cold_review.md` exists and is non-empty (existence/size only, never content — the same existence-and-size check as §Step 3.6's fail-closed order step 2, by name, not restated; unlike that path, nothing here reads the file afterwards; this does not enlarge §Architecture Principles #1's exception list, which keeps its 8 numbered slots, 7 live). If it does not, treat this as a parse failure (branch (iii) above) instead. Disclosure — stale-file false positive limit: existence confirms a write was attempted, not that it succeeded cleanly this round; no freshness latch guards against a stale survivor from an earlier round (§Step 7's "Why `cold_round` alone, and no freshness latch" note, named, not restated). On success: `verify.cold_result → "clean"` (Critical+Major == 0) or `"findings"` (≥ 1); `verify.cold_counts → {Critical: N, Major: M, Minor: 0}` (the 1-line return carries no Minor count — see §Step 7's cold_result table); `verify.cold_round → round`; `verify.cold_review_path → "{docs_path}cold_review.md"` (the sub-agent wrote it directly — the orchestrator does NOT write this file on the INLINE path, AC-27). **This single write happens BEFORE the Print below and any banner/`Remaining` rendering (AC-24).**

Print: `[harness] Evaluate complete.`

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `evaluate`):** Print the §Session Boundary block (Type A: After Evaluate). Halt.

**If `run_style == "auto"`:** Continue to Step 7.

---

### Step 7: Verdict & Loop

Determine the verdict from `verify.verdict` in state.json — on BOTH paths, in-session and on resume alike:
- **INLINE path:** §Step 6 item 5 wrote it from the Evaluator's 1-line return. `qa_report.md` is not read — the evaluator writes it for the human, and its `### Verdict:` line carries no authority here.
- **WORKFLOW path:** §Step 5 item 4 wrote it from the `VerifyVerdict` object (`verdict ∈ {PASS, FAIL_L2, FAIL_L3}` with `layer`), together with `verify.layer2_result`. An in-context object carries the same value; the state field is what survives a session boundary, so there is no reconstruction step and no file read on resume.
- **`verify.verdict == null` here** (a session written before the field existed and resumed at `evaluate_done`, or a crash between the Evaluator's return and its write): conservative `FAIL_L3` — print per OLC `[harness] ⚠ verify.verdict is unset — conservative FAIL fallback; run /harness-build evaluate to re-derive it` and continue to the Layer 3 gate. Never read `qa_report.md` to fill it.

**Two-tier evaluation.** Tier 1 (above) settles `verdict` only — `verify.verdict` is authoritative for `verdict` alone. Tier 2 (below, inside `#### If PASS:` only) evaluates the separate cold-review branch and neither reads nor writes `verify.layer2_result` — that field belongs to Tier 1 alone. On resume, `verify.verdict` and `verify.cold_*` never conflict: they are two different authorities over two different questions, not one value with two sources.

**`cold-pass disabled display`** (display ONLY — this is not itself a gating point; AC-28's three defenses are the §Step 5 args construction site, the §Step 6 entry check, and the segment's own `A.coldPass === true` strict test; this paragraph is the single definition site of `<why>` — the other sites cite it by name rather than restating it: §Session Boundary's `Remaining` derivation and `templates/harness/setup_summary.md`'s `Cold` row render it, and §Step 6 item 7 names it in prose only (that reason is never printed and never persisted)): whenever `cli_flags.cold_pass == false`, print `Cold review: disabled (<why>)`, where `<why>` is rendered from `cli_flags.cold_pass_source`:

| `cold_pass_source` | Rendered `<why>` |
|---|---|
| `"flag"` | `--no-cold-pass` |
| `"fast"` | `--fast` |
| `"default:<source>"` | `project default (<source>)` |
| `null` while `cold_pass == false` | `source not recorded` — a state file from before this field existed; never guess between the two legacy writers |

It sits HERE, in Tier 1's preamble rather than inside `#### If PASS:`, precisely so it prints regardless of verdict as AC-28 requires — a FAIL_L2/FAIL_L3 session must not silently omit it. Separately — and on its own line, because a `disabled` line cannot also report how the pass ran — whenever `cold_ran_this_round` holds (defined once under `#### If PASS:` below, cited here by name), print the guarantee level: `Cold review: workflow (schema-validated)` if `path_resolved == "workflow"`, else `Cold review: inline (1-line parse)`, carrying the anchoring literal — this self-limit is instructive, not structural, 지시적 방어이지 구조적 격리가 아니다 (AC-33). The two branches are exclusive. `failed` and `retried_dispatching` sit outside that derivation, so a cold pass that ran and died prints no guarantee line; that gap is disclosed in changes.md rather than closed with a 7th predicate, which would break this slice's own no-new-vocabulary rule.

#### If PASS:

**Cold review feedback branch (Tier 2 — evaluated BEFORE `phase → "finalizing"` is written, AC-19 (f)).** `cold_ran_this_round` (single definition, cited by name elsewhere — never restated): `verify.cold_round == round AND verify.cold_result ∈ {clean, findings, retried_unverified}`. Branch condition (single definition): `verdict == PASS AND cold_ran_this_round AND (cold_counts.Critical + cold_counts.Major) >= 1 AND verify.cold_retries == 0` — cold never reads or writes `verify.layer2_result`.

**Why `cold_round` alone, and no freshness latch (AC-21).** `skills/harness/SKILL.md` §Step 2.6's latch confirms `plan_critic_findings.md` exists after that section deleted it pre-dispatch, so existence alone proves this pass wrote it. Cold review's counterpart baseline, `qa_report.md`, is rewritten by the Evaluator on every L1 retry, every L2 auto-retry and every cold feedback pass, and no section deletes it first — so neither that existence rule nor the mtime comparison this latch used before would carry any freshness meaning there, and the latch is deliberately NOT ported; file existence is used only to confirm a successful write (absent → `failed` + banner). **Correction, recorded rather than rewritten away**: this sentence used to state the latch compares mtimes and that the comparison is sound "because `spec.md` is written once per plan". The mechanism changed; the conclusion — not ported — did not, and it now rests on `qa_report.md` having no pre-dispatch delete rather than on a per-plan single write. **Cost of the non-deterministic `skipped` re-evaluation**: its two reasons (git command failure / empty input) do not write `cold_round`, so re-entering §Step 5 or §Step 6 inside the SAME round can charge one additional cold pass — for those two the ceiling is entry count, not round count.

`verify.cold_result` full vocabulary — 6 values + `null` (extends slice A's already-declared field; not a new field):

| Value | Meaning | `cold_round` written? |
|---|---|---|
| `null` | not yet run this session | — |
| `clean` | ran, 0 Critical/Major findings (Minor-only counts as `clean` — both paths, see the note under this table) | `round` |
| `findings` | ran, ≥1 Critical/Major finding, feedback not yet tried | `round` |
| `retried_dispatching` | feedback retry dispatched, not yet confirmed complete | `round` |
| `retried_unverified` | feedback retry dispatched AND completed; not re-verified by cold | `round` |
| `skipped` | will not run this round — see §Step 5's table for the deterministic/non-deterministic split | see that table |
| `failed` | ran, agent failed (schema error / throw) | `round` |

**Minor-only results are `clean` on BOTH paths.** The split is Critical+Major, never total
finding count: the INLINE 1-line contract (`cold_review written — Critical=N, Major=M`) carries
no Minor count at all, so a total-count rule would make the identical review land as `findings`
on WORKFLOW and `clean` on INLINE — opposite `Remaining` rows for the same facts. The feedback
branch is unaffected either way, since it already tests Critical+Major separately.

If the branch condition holds:
- (a) **Single read-modify-write, BEFORE dispatch**: `cold_retries += 1`, `cold_result → "retried_dispatching"`.
- (b) Retry: INLINE = §Step 4 retry rules with its own `{verify_report_path}` → `{docs_path}cold_review.md` exception clause (by name); WORKFLOW = `harness.build {retry:true}` with `verifyReportPath` → `{docs_path}cold_review.md` (same override pattern as the Layer 2 retry above). Both paths ALSO override `{verify_failure}`/`verifyFailure` — entry requires `verdict == PASS`, so no failing verdict exists to summarize and §Step 4's retry contract would leave it undefined, which strands the generator with a report path and no statement of what to fix: supply `cold review: Critical={cold_counts.Critical}, Major={cold_counts.Major} — see {docs_path}cold_review.md` (placeholders, not the INLINE 1-line return's literal). The same two overrides apply at the other dispatcher, §Session Recovery's `generating` reconstruction (AC-20a).
- (c) `phase → "generating"`. Do NOT reset `layer1_retries`/`layer2_retries`.
- (d) **TWO writes, in this order, immediately after the retry dispatch completes** — first `phase → "generate_done"`, then a SEPARATE write `cold_result → "retried_unverified"`. They are deliberately NOT combined: a single write leaves `(generate_done, retried_dispatching)` unreachable, so a session that dies after the dispatch finished is indistinguishable from one that died before it started, and §Session Recovery re-dispatches the generator retry on top of edits that are already applied. Split this way, `phase == "generate_done"` IS the "retry finished" signal, and §Session Recovery's `generating`/`generate_done` row (AC-20a) only has to finish the `cold_result` transition rather than re-run the retry. That row owns recovery either way — the same rule as here, generalized to whichever dispatcher actually finishes the retry.
- (e) Run the full Verify → Evaluate pipeline (as the Layer 3 "Fix" branch below does).
- (f) If re-evaluation FAILs, the FAIL branch below takes priority; `cold_result` stays `retried_unverified`; mention the cold finding counts in that branch's output too.

**Budget exhausted** (`cold_retries >= 1`, condition still holds): no user gate — proceed to PASS below. Disclosure: `retried_unverified` → "되먹임 수정본은 콜드 재검증을 받지 않았다" (the `retried_dispatching` disclosure moved to the fall-through branch below — see there for why).

**deep-review reuse rejection — 5 reasons, 1:1 with the epic spec's own list (AC-31; item 5 is this slice's own addition):**

| # | reason | basis |
|---|---|---|
| 1 | args have no room for a spec — deep-review declares "reviewer never sees spec" unconditionally | epic §결정 2 #1 |
| 2 | its diffContent is orchestrator-collected, unbounded, an order of magnitude larger than spec | epic §결정 2 #2 |
| 3 | 2-3 reviewers + synthesis exceeds the 1-pass adversarial budget | epic §결정 2 #3 |
| 4 | segment is read-only, writes no files — retry feedback needs a file path | epic §결정 2 #4 |
| 5 | severity vocabulary mismatch — deep-review's `Finding.severity` is lowercase + `suggestion`; cold needs uppercase 3-grade | `workflows/_reference/schemas.md` severity-vocabulary note |

If the branch condition does NOT hold (including after (f) resolves to PASS, or this round already ran clean):

If `cold_result == "retried_dispatching"` at this point (a resume landed here with the cold
feedback retry still mid-flight when the session ended — the single definition of that value
lives in the vocabulary table above, not restated here), disclose: "되먹임 재시도가 완료되지
않았다 — 수정본이 존재하는지 확인되지 않음." This is a narrow window, not the common case:
§Session Recovery's own `generating`/`generate_done` handling normally advances `cold_result`
to `retried_unverified` before Step 7 is reached again, so most resumes never see this branch
fire for this value — disclosed here rather than asserted as a guaranteed-reachable path.

Update state.json: `phase → "finalizing"`, `updated_at → now`.
Print: `[harness] ✓ QA PASS — task complete.`
Proceed to Step 8.

#### If FAIL — Layer 2 (verify.layer2_result == "FAIL") and layer2_retries < 2:

Layer 2 failed. Auto-retry without user gate (same pattern as Layer 1 retry).

Increment `verify.layer2_retries` in state.json.
Print per OLC:
```
[harness] Evaluate FAIL (Layer 2) — retrying Generator (attempt {layer2_retries}/2)
  {failure summary}
```

Single implementation pass (retry, no re-plan/re-review) — INLINE per Step 4 retry rules **but override `{verify_report_path}` = `{docs_path}qa_report.md`** (a Layer 2 failure is structural — its findings live in `qa_report.md`, NOT the Layer-1 `verify_report.md`, which PASSED this pass) with `{verify_failure}` = the 1-line L2 FAIL summary; WORKFLOW `harness.build {retry: true}` with `verifyFailure` = the verdict's `summary` + top `failures[].fix` lines, `verifyReportPath` = `{docs_path}qa_report.md`.

Update phase → `"generating"`, `updated_at → now` (skip `generate_ready`).
After retry completes: phase → `"generate_done"`, `updated_at → now`, then **run the full Verify → Evaluate pipeline** (INLINE: Step 5 → 6 → 7; WORKFLOW: `harness.eval` full → Step 7).

#### If FAIL — Layer 2 and layer2_retries >= 2:

Print per OLC:
```
[harness] Evaluate FAIL (Layer 2) — max retries reached (2/2)
  Failing items: {summary}
```

Ask via AskUserQuestion (in `user_lang`):
- header: "QA"
- question: "Layer 2 structural verification failed after 2 retries. [failing items]"
- options:
  - "Fix" / "Run next round"
  - "Accept as-is" / "Finish without fixing"

If "Fix": same as Layer 3 Fix below.
If "Accept as-is": phase → `"finalizing"`, proceed to Step 8.

#### If FAIL — Layer 3 (verify.layer2_result == "PASS") and rounds remaining (round < max_rounds):

Ask via AskUserQuestion (in `user_lang`):
- header: "QA"
- question: "QA result: FAIL (Layer 3). [failure summary — INLINE: the 1-line return's text after ` — ` (§Step 6 item 5 keeps it in context); WORKFLOW: from verdict.failures[].fix; on resume with neither in context: the literal `see {docs_path}qa_report.md` — the orchestrator does not read the report]."
- options:
  - "Fix" / "Run next round to fix FAIL items"
  - "Accept as-is" / "Finish without fixing"

If "Fix":
- Increment `round`, reset `verify.layer1_retries → 0`, `verify.layer1_result → null`, `verify.layer2_result → null`, `verify.verdict → null`, `verify.layer2_retries → 0`, `verify.cold_retries → 0`, `verify.cold_round → null` (AC-22 — the per-round cold budget/latch resets with every new round, same as the layer retry counters). `verify.cold_result` / `verify.cold_counts` / `verify.cold_review_path` are left UNCHANGED — they keep meaning "the last cold pass that actually ran," not "this round's cold state," until a new cold pass overwrites them (see the state field table's Written-by column). The session cap on cold passes equals `max_rounds` (default 3) (see that same table's note) — not a separate counter.
- Update `updated_at → now`.
- Go to Step 4 (Generate) — a NEW round is a full pass: INLINE normal dispatch with `{qa_feedback}`; WORKFLOW `harness.build {retry: false}` with `qaFeedback` = qa_report.md content (fresh plan + advise + implement).

If "Accept as-is":
- Update phase → `"finalizing"`, `updated_at → now`.
- Proceed to Step 8.

#### If FAIL and max rounds reached:

Update phase → `"finalizing"`, `updated_at → now`.
Print: `[harness] Max rounds reached. Remaining issues in qa_report.md.`
Proceed to Step 8.

---

### Step 8: Cleanup & Finalize

Routing priority (checked in this order): `has_git == true` → `has_git == false`.

**An epic-exit session never reaches this step.** §Step 3.5 hands control to §Step 3.6 (Epic
Exit) by name, and that section owns the whole epic-exit path — its predicate, its fail-closed
order, its `.harness/` delete and its §Session Boundary print. It used to be the first branch
here, and the routing line above used to open with it; both moved, together, so that the
sole edge in this file that skips Steps 4–7 no longer lands in the step those steps lead to.
Nothing about the predicate or the order changed in the move — only where they live.

**A slice session decides first, before any delete** (§Epic Slice Chain, by name — decision
E-2). While `state.json` still exists, determine whether this session is a slice session (its
current and next rows, and the next row's shape check), whether its end is clean, and whether
`skills/harness/SKILL.md` §Chain Condition holds. A session that is not a slice session skips
this paragraph and everything below is unchanged for it. For a slice session:
- the `has_git == true` branch applies §Epic Slice Chain's automatic commit — no question —
  when that section's conditions for it hold; otherwise it asks the commit question below,
  unchanged;
- every branch's Type B block ends with §Session Boundary's epic chain rows. Then the session
  chains into the next row in this same turn unless one of §Epic Slice Chain's boundary-stop
  causes applies, in which case those rows are the boundary stop and the session halts. A
  current row with no next row prints the `Epic` row and halts.

#### Artifact Cleanup Safety Guard

Cleanup safety rules: see `templates/_shared/safety_guard.md`.

#### If has_git == true:

Unless §Epic Slice Chain's automatic commit applies (above), ask via AskUserQuestion (in `user_lang`):
- header: "Commit"
- question: "Implementation complete. Choose how to finish:"
- options:
  - "Commit code only (Recommended)" / "Clean `.harness/` only, commit code + spec/QA evidence, `{docs_path}` preserved on disk"
  - "Commit all" / "Commit everything including artifacts"
  - "No commit" / "Clean .harness/ only, keep changes in working tree"

Actions (apply Safety Guard before each delete):
- "Commit code only": (protect persisted spec/QA artifacts — **`{docs_path}` is never deleted on this path**, P0-2) Apply this exact **commit-first** 4-step sequence:
  1. **(M8) Safety Guard validation** on `{docs_path}` — apply the full Artifact Cleanup Safety Guard per `templates/_shared/safety_guard.md` (slug check + path depth + `Path.cwd()` containment) BEFORE any staging. Retained as defense-in-depth even though this branch no longer deletes `{docs_path}`: it also guards the `.harness/` delete in step 4 by confirming `{docs_path}` (read from the same state.json) is a well-formed, contained path before any cleanup proceeds. If validation fails, **ABORT**: do NOT stage, do NOT delete `.harness/`. Surface the failed check to the user. Both `.harness/` and `{docs_path}` remain intact for manual recovery.
  2. **Stage** the code changes plus the spec/QA-persistence files (only if the source file exists — silently skip missing files):
     - `{docs_path}spec.md`
     - `{docs_path}qa_report.md`
     - `{docs_path}qa_notes.md`
     - `{docs_path}critic_findings.md`
     - `{docs_path}conventions.md`
     - `{docs_path}slice_plan.md`
     - `{docs_path}cold_review.md`
     - `{docs_path}plan_critic_findings.md`

     `{docs_path}slice_plan.md` is always missing from this list on an epic-exit session —
     not because this branch is skipped, but because §Step 3.6 (by name) ends the session
     before §Step 8 is reached at all; that section's own fail-closed order handles that
     artifact on its own. Before the epic-exit path moved out of this step, the reason was
     that the branch never reached a staging step; now the step itself is never entered. `{docs_path}cold_review.md` is now written by
     §Step 5 (WORKFLOW) / §Step 6 (INLINE) (this slice) whenever cold review actually ran that
     round — the silent-skip rule above already covers rounds where it did not. This repository's
     `docs/` is gitignored, so `git add` on any listed `{docs_path}` artifact that does exist will fail —
     that failure is handled by the warn-and-continue rule immediately below, never by the
     silent-skip rule above (which applies only when the source file itself does not exist).

     **(s4) Per-file staging failure handling**: if `git add <file>` fails for a specific artifact file (permission, `.gitignore` conflict, etc.), warn the user (in `user_lang`): "Failed to stage `<file>`: <error>. Artifact may not be in git history — it remains on disk at `{docs_path}` regardless (this path never deletes `{docs_path}`)." Continue with remaining files — do NOT abort the whole sequence on a single staging failure. The code commit (step 3) is more critical than any individual artifact preservation. Because `{docs_path}` is never deleted here, a staging failure can never strand a file — it stays on disk even when `git add` failed for it (e.g. `docs/` is `.gitignore`d, the common case in this repo itself — `.gitignore:7`).
  3. **Commit** the staged code changes plus artifacts, then **confirm the commit succeeded** (git exit 0 / a new commit object exists). **If the commit FAILS** (pre-commit hook rejection, signing failure, locked index, disk error, nothing-to-commit): **STOP without deleting anything** — `.harness/` and `{docs_path}` stay intact so the session is resumable and all artifacts recoverable. Surface the git error (in `user_lang`) and tell the user to resolve it and run `/harness-build` again — the session is at `finalizing`, so §Session Recovery brings it back to this step's commit question — or to commit manually. Do NOT proceed to step 4. **This sub-path does not end the session** — do NOT print the §Session Boundary block here. The one exception is §Epic Slice Chain's automatic commit, whose failure (and whose step 1 ABORT) is a boundary stop: still nothing deleted, but the Type B block prints with the commit-failure rows.
  4. **Delete `.harness/`** — only after a confirmed-successful commit (the Safety Guard already validated the parent context). `{docs_path}` is **never deleted** on this path.

  **(m2) commit-first, no-delete-of-docs_path ordering note**: the commit (step 3) precedes the only delete in this sequence (`.harness/`, step 4), so artifacts physically exist on disk at commit time and are captured normally when staging succeeds. `{docs_path}` itself is never deleted by this branch (P0-2 removes the prior "delete `{docs_path}` working-directory contents" step), so `spec.md` / `qa_report.md` remain on disk even when `docs/` is `.gitignore`d and staging silently fails per (s4). Because nothing is deleted until the commit is confirmed, a commit failure can never strand the session: `state.json` (`.harness/`) and `{docs_path}` survive for resume/manual recovery. (This supersedes the prior stage→delete→commit order, in which a final-step commit failure left state and docs already deleted.)

  On success, print the §Session Boundary block (Type B — `Commit` = the new commit sha).
- "Commit all": **stage + commit** `{docs_path}` + code, **confirm the commit succeeded**, then delete `.harness/` (on commit failure, keep `.harness/` intact and surface the error — same recovery rule as "Commit code only" step 3; that failure sub-path does not end the session, so no boundary block there). On success, print the §Session Boundary block (Type B — `Commit` = the new commit sha).
- "No commit": delete `.harness/` only. Print the §Session Boundary block (Type B — `Commit` row omitted, no commit was made).

#### If has_git == false:

Inform user artifacts are in `{docs_path}`.
Delete `.harness/` only. No git operations. Print the §Session Boundary block (Type B — `Branch`/`Commit` rows omitted).

---

## Model Selection

Preset table, rules and the harness role map: `templates/_shared/model_config.md`. INLINE — pass `model` per role at sub-agent launch (preset ≠ "default"). WORKFLOW — pass the resolved map once as `args.models` (`{executor, advisor, evaluator, verifier}`; a null role inherits). The verifier defaults to haiku on every preset because Layer 1 only runs commands and parses exit codes; `--verifier-model sonnet|opus` overrides it and warns about cost in the Setup Summary.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Architecture Principles

The registry of invariants is `skills/harness/SKILL.md` §Architecture Principles; this skill
exercises the subset below. Numbering follows the registry so a citation such as "#4" means
the same thing in every file.

1. **Orchestrator reads no intermediate files** — of the registry's 7 live read exceptions (8
   numbered slots; slot (2), the `qa_report.md` verdict read, was retired 2026-09-18 when
   `verify.verdict` took over on both paths — §Step 7) this skill performs **4**: (1) spec.md
   at the plan gate — the live line count §Entry's approval check takes in an inline session,
   the gate's own read and not a new site, which §Step 3.5's restore order ③ reuses; (3) changes.md
   path-extraction on WORKFLOW-path resume when
   `workflow_ctx` is null (repo-relative paths only, no content analysis — §Step 5 — WORKFLOW
   path `changedFilesList` source priority); (4) verify_report.md path (for the user message)
   and failing-file extraction for Auto-fix Proposer dispatch (paths only, Path Validator
   `kind=file_reference`, capped at 5 — §Step 5 Auto-fix dispatch); and (8)'s `Slice` /
   `Command` column read of `slice_plan.md` at §Step 3.6 and §Step 8 (§Epic Slice Chain — the
   `.harness/converge/` reads, and this same read at `skills/harness/SKILL.md` §Step 1 item 7
   and §Approval Gate, are `/harness`'s). Writes are a separate
   category: this skill writes `changes.md`, `slice_plan.md`, and — WORKFLOW path only —
   `cold_review.md` from returned objects (the INLINE path's `cold_review.md` is written by the
   cold-review sub-agent itself, §Step 6), plus the Apply-before `--- a/` / `+++ b/` diff header
   lines (2 metadata lines per file — hunk body is delegated to the Edit tool). None of that is
   reading intermediates.
2. **Auto-fix Proposer is the only sub-agent that directly Reads SOURCE files among orchestrator-dispatched agents.** (Segment-script agents explore the codebase themselves by design — they run inside the engine's autonomous span.) Other inline sub-agents receive content only through template variables, with one narrower exception (the registry's two converge-loop carve-outs belong to `/harness` and are never dispatched here): an inline sub-agent MAY instead receive a `{docs_path}` artifact PATH that the orchestrator explicitly hands it and read that one file itself — distinct from "source files", and it does not enlarge the registry's exception list, which keeps its 8 numbered slots, 7 live (AC-27).
3. **Paths only to sub-agents; never file contents** (ephemeral digests passed inside a segment run excepted — they never enter the orchestrator's context beyond `workflow_ctx` storage; `specContent` passed as a Build segment arg (§Step 4 — WORKFLOW path) and as an Eval segment arg (§Step 5 — WORKFLOW path) is also an explicit exception — spec.md content, not a path, crosses into segment `args` because size, not path-vs-content, is the actual constraint. The Eval segment's cold reviewer is NOT covered by that exception: it receives a path pointer built from the `specPath` arg, on both paths).
4. **Session-wide invariants** (see §State Machine — Auto-fix State Transition Table):
   - Auto-fix: at most 1 attempt per session (`verify.autofix_attempted` once-only — not reset on round increment).
   - Layer 1 retries: max 3. Do NOT reset after Auto-fix Apply.
5. **All external paths pass through Path Validator before use** (see §Path Validator below).
6. **Gates never enter segment scripts.** HARD-GATEs #2 (verify-fail) and #3 (auto-fix-apply) are rendered by this orchestrator between segment runs; HARD GATE #1 (spec-confirm) renders at `skills/harness/SKILL.md` §Approval Gate (every variant) in an inline session and at `/harness-gate` in a separate one — one gate, two render sites; the count stays 3. `scripts/verify_meta_literal.py` guards this at lint time by rejecting gate-marker tokens — the `<HARD-GATE>` tag form, `AskUserQuestion`, and the `Apply patch` option label — inside any segment script. This is a marker-based tripwire, not a proof of gate-freedom: it deliberately does NOT flag the spaced prose form `HARD GATE #N`, which segment scripts legitimately use in comments to note that gates live in the orchestrators.

<!-- BLOCK-START:hx-path-validator v2 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
### Path Validator

`validate_path(path, kind)` with `kind ∈ {output_dir, file_reference, diff_target}` — the five normalization and rejection steps, the reserved first-segment set, the `docs/harness/` carve-out, every halt message and the attack-vector mapping are `templates/_shared/path_validator.md`. Read it before validating a path; never restate it.

Call sites: `--output-dir` parsing (`skills/harness/SKILL.md` §Step 1 item 2, `kind=output_dir`); the Session Recovery Safety Guard re-validation (`kind=output_dir`); `{failing_files_list}` injection, the Edit-tool unified-diff Apply, cold-review input collection and cold `finding.file` validation — WORKFLOW path only (`skills/harness-build/SKILL.md` §Step 5, `kind=file_reference` / `diff_target`).
<!-- BLOCK-END:hx-path-validator v2 -->

## Key Rules

- **Never skip phases.** Always Generate → Verify → Evaluate after a confirmed spec. The `plan_done →
  completed` epic-exit transition (§State Transition Diagram, by name) is a deliberate,
  by-design exception to this rule, not a violation of it.
- **Confirmation gates are non-negotiable.** No implicit approval. Gates live ONLY in the orchestrators — this skill renders #2 and #3 — never in a segment script.
- **Stay within scope.** Do not modify files outside scope.
- **Evaluator must be isolated.** Anchor-free input. Never pass Generator reasoning.
- **Generator advisors review the plan, not code.** Advisory before implementation.
- **User language.** All user-facing output in `user_lang` per §Output Language Contract. Glossary tokens (`PASS`/`FAIL`/`Verdict`/`[harness]`/etc.) preserved English. Inline parser keywords MUST remain English raw — see §Orchestrator Contract.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill's execution WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **Intermediate outputs are ephemeral.** Only final artifacts preserved in `docs/`.
- **Orchestrator reads no intermediate files.** See §Architecture Principles for this skill's subset and `skills/harness/SKILL.md` §Architecture Principles for the registry.
- **1-line return parsing (INLINE path only).** Only first line of an inline sub-agent return is used for state decisions. WORKFLOW path branches on schema-validated objects.
- **Workflow args are a JSON object;** segment scripts defensively parse (`args` may arrive as a JSON string — engine behavior). Never put user-gate decisions into args.
- **Graceful engine fallback.** Any Workflow failure degrades to the inline single path with a notice — never a hard error.
