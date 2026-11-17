---
name: harness
disallowed-tools: NotebookEdit
description: Entry point of the 3-Phase harness (Plan -> Gate -> Generate -> Verify -> Evaluate) — Setup, Convention Scan, Plan, a converge loop over spec.md, then in-session approval that chains into /harness-build (implementation); --separate-gate halts at plan_done for /harness-gate (the tool-less gate) instead. Plugin-shipped native Workflow segments on the workflow path (ultracode or --mode opt-in), inline single path otherwise; read-only `doctor` diagnostic. Use for development AND non-development tasks that benefit from structured planning and 3-layer review.
---

# Agent Harness — /harness Orchestrator (v3, plan half)

You are a **state-machine orchestrator** — the ENTRY POINT of a pipeline split across three skills that share one `state.json` phase machine:

| Skill | Owns | Tools it does NOT have |
|---|---|---|
| `/harness` (this file) | Step 1 → 1.5 → 2 → 2.6, `spec.md`, the Plan Critic and converge loop, `doctor`, §Approval Gate (HARD GATE #1 in-session) | `NotebookEdit` |
| `/harness-gate` | Step 3 — HARD GATE #1 (spec confirmation) for a separate-gate session only | `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`, `Workflow` — it can change nothing |
| `/harness-build` | Step 3.5 → 3.6 → 4 → 5 → 6 → 7 → 8 | `NotebookEdit` |

**This skill never crosses into Generate itself: every session of it ends at `plan_done`.** Where the human confirms the spec depends on the session's **gate mode** (§Approval Gate defines it and its reading rule). **inline** — the default for every new session, `--fast` included (`design/harness-converge/SPEC.md` decision D1) — renders HARD GATE #1 in this session as §Approval Gate: only a label selection approves, the approval is recorded once and bound to `spec_stamp`, and under §Chain Condition this skill then invokes `/harness-build` in the same turn, whose §Entry refuses, fail-closed and writing no gate-crossing field, an inline session whose approval record's stamp or spec.md's live line count no longer matches (an edit outside the orchestrator that keeps the line count passes — `skills/harness-gate/SKILL.md` §Stale Determination's disclosed limits 1–2 apply to it). That is the Fast Gate's assurance grade — a model-written record checked by the next skill, which a model bent on skipping the gate could forge (`design/harness-ordering-enforcement/SPEC.md` §3.3a; its decision ① row records the change). **separate** — `--separate-gate`, or the project default `gate=separate` — prints `Next → /harness-gate` instead: the gate is then a separate user message whose turn holds no write tool, so nothing can be implemented before the human confirms the spec (SPEC §1 of the same file). Neither sibling can be prevented from being invoked directly; each detects a missing prerequisite and says so.

Your role: manage phase transitions via `state.json` up to `plan_done`; resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped segment scripts, branching on schema-validated objects rather than parsed text); and end at `plan_done` — at §Approval Gate in an inline session (chaining into `/harness-build` under §Chain Condition), with the next command in a separate one. **You do NOT** read intermediate artifacts, accumulate sub-agent output, or judge code quality — §Architecture Principles #1 holds the only exceptions. Sub-agents and segment scripts do the domain work; you handle transitions and write `spec.md` from returned objects.

## Orchestrator Contract

Sub-agent return rules, state.json version compatibility and environment detection: `templates/_shared/orchestrator_contract.md`. Read it at Setup. In brief, and not a substitute for reading it — an INLINE sub-agent's **first line only** drives state decisions, the rest is ignored, and a non-conforming return falls back to `confidence: Unknown`, while WORKFLOW returns are schema-validated objects (`workflows/_reference/schemas.md`) branched on directly. This is **state.json v3**: `version: "3.0"` AND `skill: "harness"`, or it is not a v3 file; a non-`"3.0"` file is never migrated silently, and additive fields within `"3.0"` never bump `version` and are never required. At startup `git rev-parse --is-inside-work-tree 2>/dev/null` sets `has_git`.

## User Language Detection

Single source: `templates/_shared/output_language.md` §User Language Detection. Detect `user_lang` from the user's most recent message, store it in state.json and re-check every message. All user-facing output is in `user_lang`; template instructions, state.json field names, file names, git branch names and Workflow `args` field names stay English. On the WORKFLOW path pass `userLang` in `args`.

## Output Language Contract

### Invariant

All orchestrator output visible to the user renders in `user_lang`. Backtick-inline English inside a `Print:` directive is a template format, not an output-language declaration; when `user_lang == "en"` this contract is a no-op. Every new `Print:` directive must conform (CI enforcement is a TODO).

### Preserved-English Glossary

Token table: `templates/_shared/output_language.md`. Cite it, never restate it. Status keywords (`PASS` / `FAIL` / `FAIL_L2` / `FAIL_L3` / `Verdict`), the `confidence: *` values, the INLINE return verbs, the `[harness]` prefix, the Status Format labels, `Epic planned` and every identifier (state.json fields, paths, branch names, commands, phase keys, schema fields) stay English raw.

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

## Session Recovery (state.json v3 phase machine)

**doctor carve-out — evaluate FIRST.** If this invocation's positional arguments are exactly the single token `doctor`, skip this section and go straight to `## Sub-command: doctor` — read no `.harness/state.json`, resolve no path, resume nothing.

**Positional arguments** = the argument list minus (a) every token beginning `--` and (b) the single token after each VALUE-TAKING flag: `--mode`, `--model-config`, `--verifier-model`, `--lint-cmd`, `--type-check-cmd`, `--output-dir`, `--modify`. The boolean flags (`--epic`, `--no-epic`, `--no-cold-pass`, `--no-prompt`, `--auto-revise`, `--critic`, `--fast`, `--quick`, `--separate-gate`) consume nothing. **A VALUE-TAKING flag added later MUST join that list**, or it would swallow `doctor` as its value. A quoted task merely containing the word is one positional token that is not `doctor`.

**Otherwise follow `templates/_shared/session_recovery.md` in full** — items 1–7, the Session Conflict gate, the legacy-version branch, the `model_config` / `conventions` / `has_git` restores, the resume-suppression checks and the Restart / Stop / View state only actions live there, once, for this skill and `/harness-build` alike. Two things are this skill's own:

**6.5. docs_path drift check** (feeds item 7's check (b); acts on nothing itself): only if THIS invocation supplies **both** `--output-dir` and a task string, recompute a candidate `docs_path` from those two arguments alone — §Step 1 item 2's normalization, item 3's slugify and item 7's formula, by name, never the stored `cli_flags.output_dir` — and compare it with the stored `docs_path`. Either argument missing → skip. A malformed recomputation is "comparison not possible", never a mismatch. Nothing is written back.

**Item 7 Resume — this skill's phase jump table.** Once that file's Safety Guard re-validation passes, jump to the state matching `phase` (segments are re-RUN, never runId-resumed, across sessions):

- `setup` — or no `phase` at all beside a `docs_path`, the checkpoint a 9.0.0 Setup wrote → Setup was interrupted after §Step 1 item 7's checkpoint and before item 11. Re-enter §Step 1 at item 8 with these inputs: `task`, `cli_flags`, `user_lang`, `has_git`, `docs_path`, `slug` and `dirty_at_start` from the checkpoint exactly as stored — items 1, 3 and 7 are NOT re-run, so no directory is re-created and no baseline is re-taken on a tree that may have changed since; `run_style` from the checkpoint when it carries one; everything else item 2 parses (`--mode`, `--model-config`, `--lint-cmd`, `--type-check-cmd`, and `run_style` when the checkpoint has none) from THIS invocation's arguments, a bare `/harness` meaning their defaults — the interrupted invocation's values were never stored; and items 4–6 again (detection only — they write nothing). Then items 8–13.
- `plan_ready` → Step 1.5 if `conventions` is `null` (or a `"file:"` whose file is missing), else Step 2 (`"skipped"` = the user already decided).
- `planning` / `plan_done` → the FIRST of these that matches (the order and its reasons: `design/harness-converge/SPEC.md` §재개):
  1. A separate session with `state.epic.boundaries != null` (meaningful only at `plan_done`, where the combination is itself a boundary-Q&A-completion mark) → print `[harness] Boundary Q&A already answered — run /harness-build --epic` and halt. An inline session skips this item — items 2–6 route it by its approval record: one that passes chains or stops as recorded (on the epic route `/harness-build --epic`, whose `skills/harness-build/SKILL.md` §Step 3.5 re-entry reuses the recorded answers), one that fails re-renders §Approval Gate, since `/harness-build --epic` would refuse it and send it back here.
  2. An inline session (§Approval Gate's gate-mode rule) at `phase == "plan_done"` whose approval passes `skills/harness-build/SKILL.md` §Entry's approval check → spec.md has not changed since it was approved, so nothing re-runs: under §Chain Condition chain as recorded (§Approval Gate step 3 — the Skill invocation, `--epic` when `gate.route == "epic"`; no new record is written), otherwise print §Approval Gate's stop output.
  3. An inline session whose `{docs_path}spec.md` exists but whose `spec_stamp` is `null` or malformed, or whose live line count of spec.md (counted as §Step 2's `spec_stamp` write protocol step 3 defines) differs from `spec_stamp.lines` (an edit made in an editor, a write protocol cut off part-way) → **re-stamp**: one write event with no content change (`templates/harness/converge.md` §Write Events), then — without consulting §Stale Determination — item 4 from its second branch: `plan_critic` unrecorded → §Step 2.6 (its fast skip applies), otherwise a new converge run with a full review; a loop-skipping session (that file's §Terms) runs nothing and goes to item 6 — unless `converge.status == "running"` (its `/harness --critic` run was cut off before the mapping that would have ended its loop-skipping), which starts a new converge run with a full review, as item 4 does. §Approval Gate's summary then carries the re-stamp banner.
  4. `{docs_path}spec.md` missing → Step 2 (§Step 2.6's Plan Critic routing predicate (a), single source there). `plan_critic` has no recorded `applied` → §Step 2.6 (predicate (b) — its fast skip included). `converge.status == "running"` (a run was cut off), or — inline only — `skills/harness-gate/SKILL.md` §Stale Determination returns **stale**, its fail-closed outcomes included → a new converge run, full review, ledger kept (§Step 2.6's own-critic dispatch). A session cut off after a decision or Modify apply but before the run that apply starts lands here, since its stamp is then ahead of the record. Each ends at §Step 2.6's mapping and §After Plan Phase. **stale-unknown** (`failed`, or a skip record) and **not stale** run nothing; a separate session's staleness is judged by `/harness-gate`, as before.
  5. The ledger holds an open `decision`, no `answered` item (that file's §Decision Question has applied nothing yet — it never ran, or it asked and received no answer; a Minor decision it defaulted is an `answered` item too), `converge.status` is `"converged"` or `"capped"`, and the session is interactive → `templates/harness/converge.md` §Decision Question, then the run its answers start. So a session that ran non-interactively asks its decisions before the gate when resumed interactively.
  6. Otherwise → §After Plan Phase: §Approval Gate in an inline session, `Next → /harness-gate` in a separate one. A session still at `phase == "planning"` here — a Step 2 pass cut off after its spec.md write, in a session whose critic record items 3–4 leave in place (loop-skipping, stale-unknown or not stale) — first writes `phase → "plan_done"`, `updated_at → now` as one write: the last item of Step 2, which the cut-off never reached (a missing `state.scale` renders absent — §Scale Assessment).

  **This skill never routes into Step 3** (the separate render of HARD GATE #1); `/harness-gate` is reached only by the human typing it (SPEC §2.2).
- `generate_ready` … `evaluate_done`, `finalizing` → owned by `/harness-build`: print `[harness] This session is past the gate (phase: {phase}) — run /harness-build` (with `verify` / `evaluate` when `phase` is `generate_done` / `verify_done`) and halt. Nothing is written.
- `completed` → no active session: delete `.harness/` as Restart does, then proceed to Step 1 — a finished session's leftovers (its `.harness/converge/` ledger above all, which `templates/harness/converge.md` keeps for the session's lifetime) never carry into the new one (a `completed` session keeps `.harness/` when, for one, its `/harness-build` Step 8 commit failed — in a state.json written before `finalizing` existed; since then that session is `finalizing`, and the row above owns it).

If `.harness/state.json` does not exist, proceed to §Fresh Start.

### Fresh Start

The entry taken when no session exists, or after a Restart / "Delete and start" deleted one: **Step 1: Setup** (§Workflow Steps). Each skill defines this section once, which is why the shared procedure names it and never a Step number.

### Gate re-entry flags (`--modify` / `--auto-revise` / `--critic`)

`/harness-gate` cannot edit `spec.md`, dispatch a critic or re-run a Plan pass; each of those options ends the gate's turn by printing one of these commands, which THIS skill executes. A human may also type one in an inline session. All three require `phase == "plan_done"` (otherwise `[harness] --{flag} needs a plan_done session (phase: {phase})` and halt), and all three end at §After Plan Phase — so a separate session's gate re-renders from Pass A next session, and an inline session's §Approval Gate re-renders in this turn, each against the fresh `spec_stamp` / `plan_critic` state. None refuses an approved session: an approval is bound to the `spec_stamp` it was given for (§Approval Gate), so a spec.md write here leaves it unable to pass `skills/harness-build/SKILL.md` §Entry's approval check, and the approval gate that follows is the way back. `--critic` always STARTS A NEW converge run (§Step 2.6 **Converge loop**), and `--modify` does too outside a loop-skipping session (`templates/harness/converge.md` §Terms), so the gate that follows lands on the record that run's mapping wrote.

| Flag | Action (orchestrator-inline) | Writes |
|---|---|---|
| `--modify "<request>"` (VALUE-TAKING — listed in the doctor carve-out above) | apply the request to `{docs_path}spec.md` orchestrator-inline, never a dispatched sub-agent (SPEC decision ③), as one write event of `templates/harness/converge.md` §Write Events; then a new converge run and its mapping — a delta first round only when, just before the edit, the session's last run had completed (`converge.status` `converged` / `capped`) AND `skills/harness-gate/SKILL.md` §Stale Determination said not stale; a full review otherwise (that file's §Starting a run item 1). A loop-skipping session (that file's §Terms) applies the request under §Step 2's `spec_stamp` write protocol alone and runs nothing | `spec.md`, `spec_stamp`; outside a loop-skipping session also `.harness/converge/*`, `converge.*`, `plan_critic.*` |
| `--auto-revise` | §Step 2 — WORKFLOW path's Auto-revise re-entry, including its same-turn Step 2.6 re-run | as that re-entry |
| `--critic` | §Step 2.6's own-critic dispatch — a new converge run with no spec change, so it starts with a FULL review and its round-1 critic runs (a fresh single write to `plan_critic` at the mapping, `source = "own"`). Round-1 critic on the INLINE branch whenever **branch (ii)'s footprint** holds (evaluated on the state found before `templates/harness/converge.md` §Starting a run item 2's write, which overwrites `converge.status`) (single statement — `skills/harness-gate/SKILL.md` §Step 3 Pass A row ④ cites it): `plan_critic.applied` is unrecorded, OR `converge.status == "failed"` while `plan_critic.applied != "failed"` — §Step 2.6 branch (ii) writes the status alone and every other failure writes both in one mapping. **Blind spot, disclosed:** a branch (ii) that follows a branch (iii) record leaves exactly the state (iii) alone leaves (`applied == "failed"`, `converge.status == "failed"`), so the footprint does not hold there — the next round-1 critic takes the Mode Gate path and, on the workflow path, issues the denied call once more, and `templates/harness/converge.md` §Summary Block shows (iii)'s older banner on a resume (ROADMAP). No `failure_reason` string records that denial: `loop_dispatch_failed` records a refused or erroring INLINE dispatch, never the Workflow denial, so it does not force the INLINE branch. A bare re-entry states no change, so — outside that blind spot — the denied Workflow call is never re-issued (`templates/_shared/mode_gate.md` rule 3) | `plan_critic.*`, `converge.*`, `.harness/converge/*`, and `spec.md` / `spec_stamp` when a round applies |

## run_style (Execution Mode)

The three styles (`auto` / `phase` / `step`), the full CLI surface of all three pipeline skills and the step-mode prerequisite table are `templates/_shared/run_style.md`. Read it when parsing arguments or deciding where a session ends. This skill's own end point is fixed regardless of style: **every `/harness` session ends at `plan_done`** (SPEC rev.9 (b)). What happens there depends on the gate mode: an inline session renders §Approval Gate, and only when §Chain Condition holds — `run_style == "auto"` is one of its three parts — does an approval chain into `/harness-build` in the same turn; under `phase` or `step` the session stops after the approval, Resume `/harness-build` (§Approval Gate's stop output). A separate session prints `Next → /harness-gate` under every style.

---

## Session Boundary

Block shape and the `/handoff generate` field contract: `templates/_shared/session_boundary.md`. This skill has exactly ONE Type A site, After Plan, and it is not optional whenever the session stops there; Type B (task complete) belongs to `/harness-build`.

| Boundary site | Completed → Next | Resume command |
|---|---|---|
| After Plan (Step 2) — the only Type A site here | Plan → Gate | separate session: `/harness-gate` (always; a `--modify` / `--auto-revise` / `--critic` re-entry prints the same line). Inline session: printed only by §Approval Gate's stop output, with Resume `/harness-build` (plus ` --epic` when `gate.route == "epic"`) when the recorded approval passes `skills/harness-build/SKILL.md` §Entry's approval check, and `/harness` otherwise. An inline session that chains prints no block here |

**Residual:** `/harness-build` typed directly still skips the gate for a separate session — by design (SPEC §8), disclosed by `skills/harness-build/SKILL.md` §Entry, never prevented. An inline session cannot skip it that way: §Entry refuses it without a matching approval record (the record is model-written, so this is the Fast Gate grade of SPEC §3.3a, not a structural guarantee).

---

## Scale Assessment

> Single source for the scale/slice recommendation. **(1) compute** — §Step 2, immediately after the Plan segment/sub-agent completes on BOTH paths, once per Plan pass; **(2) render** — every non-fast session: §After Plan Phase in a separate session, §Approval Gate in an inline one (not its slice variant, which offers no epic choice); **(3) render** — a separate session's `skills/harness-gate/SKILL.md` §Step 3 Pass B next session, from the same frozen values.

### Compute-once / freeze / render-by-reference

Computed exactly ONCE right after Step 2 completes — on both paths, and again on an Auto-revise re-entry (a fresh Step-2-shaped run) — before phase advances to `plan_done`, from the in-context `PlanResult` (WORKFLOW) or spec.md (INLINE fallback), into `state.scale.signals` / `slice_hint` / `override` in one read-modify-write. Every render site reads `state.scale.*` and never re-derives. **On cross-session resume, do NOT recompute**; if `state.scale` is missing entirely, treat every signal as `absent` and render the INLINE Fallback — never error, never block the gate. In an inline session, §Approval Gate's leading option follows from the same frozen values.

<!-- BLOCK-START:hx-scale-render v2 — shared by /harness, /harness-gate; edit every copy in one commit and bump the version -->
### Render fragment

What a render site prints — the four raw signal counts, the verbatim `sliceHint` recommendation and rationale, the `cli_flags.epic` override line and its `Decision :` row, the confirmation-ownership line, the `ok` / `absent` / `malformed` Signal Domain, and the INLINE Fallback degraded 1-signal mode — is `templates/_shared/scale_assessment.md`. Read it at the render site and follow it verbatim; never restate or summarize it here.

Two rules are repeated because they govern that read: the recommendation is **never** derived from the counts (it comes only from `sliceHint`, which Synthesis produced with full qualitative judgment), and no rendered line may be phrased as a numeric threshold comparison.
<!-- BLOCK-END:hx-scale-render v2 -->

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

---

## Workflow Steps

### Step 1: Setup

0. **doctor dispatch.** When §Session Recovery's carve-out applies, this step is never reached.
1. **Detect user language** from the task → `user_lang`. A task that is a slice id — a slice `Command`'s `"slice-…"`, English raw by `skills/harness-build/SKILL.md` §Step 3.5's format — carries no language: take it from the user's most recent natural-language message instead (`templates/_shared/output_language.md` §User Language Detection), so a slice chained in a Korean turn stays Korean.
2. **Parse CLI arguments** — every halt below fires HERE, before item 7 creates directories and item 8 creates the branch, so a rejected invocation leaves no ghost `.harness/` for the next Session Recovery to offer as Resume:
   - Bare task → `run_style: "auto"`; `plan|generate` prefix → `"phase"`; `verify|evaluate` prefix → `"step"`
   - `--mode single|quick|standard|multi|comprehensive|thorough|deep` → mode/path input for §Mode Gate
   - `--fast` / `--quick` → `cli_flags.fast = true`, `cli_flags.cold_pass = false` (`cold_pass_source = "fast"`, or `"flag"` if `--no-cold-pass` is also given — the more specific statement wins): single/inline, no §Ambiguity Prompt, no Model or Convention Scan question, Plan Critic skipped, and always the inline gate mode — §Approval Gate's fast variant. With a workflow-tier `--mode`, with `--epic` or with `--separate-gate` → halt: "--fast is a single-slice inline shortcut — it cannot be combined with <flag>."
   - `--separate-gate` → `cli_flags.separate_gate = true`: the separate gate mode (§Approval Gate's gate-mode rule) — this skill ends at `plan_done` with `Next → /harness-gate`, and HARD GATE #1 renders in that tool-less skill. Absent the flag, the project-defaults line item 10 resolves (`templates/_shared/project_defaults.md` §agent-harness-defaults — no second read) decides: its `gate=separate` key sets `cli_flags.separate_gate = true` unless `--fast` is given (`--fast` is always inline, so the default yields to it silently); `gate=inline`, any other value or an absent key leaves `false`. Written on every new session, so the field's absence marks a session older than it.
   - `--no-prompt` → this invocation is non-interactive (`templates/_shared/mode_gate.md` §Ambiguity Prompt step 5): no §Ambiguity Prompt, and — the same condition `templates/harness/converge.md` §Non-interactive rule names — no decision question, no approval question, no approval record and no chain (§Approval Gate, non-interactive). It is not stored; a later invocation without it is interactive again.
   - `--model-config <preset>`, `--lint-cmd <cmd>`, `--type-check-cmd <cmd>` → overrides
   - `--verifier-model <haiku|sonnet|opus>` (default haiku); any other value → halt: "Invalid --verifier-model value. Allowed: haiku, sonnet, opus."
   - `--output-dir <path>` (default `docs/harness`) → `validate_path(path, kind=output_dir)` (§Path Validator, whose single source carries every rejection message); valid → strip the trailing slash, store in `cli_flags.output_dir`
   - `--epic` / `--no-epic` → `cli_flags.epic = true / false` (tri-state; unset stays `null`, so §Scale Assessment's recommendation stands). Both given → halt: "Cannot combine --epic and --no-epic." Read by §Scale Assessment's override render and `skills/harness-gate/SKILL.md` §Step 3 Pass B's leading-option table, which §Approval Gate also applies — never by `skills/harness-build/SKILL.md` §Step 3.5 or `skills/harness-build/SKILL.md` §Step 3.6's epic-exit predicate, which read `state.epic.boundaries` + `state.phase` only.
   - `--no-cold-pass` → `cli_flags.cold_pass = false` (default `true`), `cold_pass_source = "flag"`; AC-28's three gating points are `skills/harness-build/SKILL.md` §Step 5's `cold_dispatch_allowed` predicate, `skills/harness-build/SKILL.md` §Step 6's entry gate, and `workflows/harness.eval.workflow.js`'s `A.coldPass === true` check. Absent both `--no-cold-pass` and `--fast`, `cold_pass` resolves from the same project-defaults line item 10 already resolved (`templates/_shared/project_defaults.md` §agent-harness-defaults — no second read): its `cold-pass=off` key sets `cli_flags.cold_pass = false` with `cold_pass_source = "default:<source>"`; any other value or an absent key leaves `cold_pass = true`. `cold_pass_source` is `null` whenever `cold_pass == true`.
   - **Leftover md-optimize backup** — not an argument, but checked here for the same reason, before anything is created: if `.harness/md-optimize/` exists, halt: `[harness] An md-optimize backup is in .harness/md-optimize/ — this session's cleanup deletes .harness/, and that backup with it. Run /md-optimize first (it asks whether to restore or discard the backup), then start again.` Nothing is created or deleted.
3. **Slugify the task** → `<slug>` per `templates/_shared/slugify.md` (single source): non-ASCII is dropped, never transliterated; `/`, `.`, `_` and whitespace become hyphens; 50 chars; an all-non-ASCII task falls back to `task-<YYYYMMDD-HHMM>` with a printed line.
4. **Auto-detect project language and commands** by scanning the working directory.
5–6. **Resolve the lint and type-check commands**, first match wins per command: the `--lint-cmd` / `--type-check-cmd` flag; else the resolved project-defaults line's `lint-cmd` / `type-check-cmd` key (`templates/_shared/project_defaults.md` — the same line item 10 resolves; echo `(project default)` beside the Setup Summary row); else the detection table `templates/_shared/detection_table.md`; else `null`. A declared command is never second-guessed by detection — the 2026-09-18 live probe found that a repository whose lint lives only in its `CLAUDE.md` matches no detection row (`design/harness-prompt-diet/PROBE.md` finding 2). **A literal `{scope}` in a command is resolved before it is stored:** when a resolved build, test, lint or type-check command carries the token `{scope}` (the detection table's `pylint {scope}` row is one), replace it with the session's `scope`, or with `.` when `scope` is `(no limit)`. state.json never holds the literal, so Layer 1 is never handed it on either path.
7. **Determine `docs_path`:** `output_base = cli_flags.output_dir ?? "docs/harness"`; `docs_path = output_base + "/" + <slug> + "/"`. Just before creating anything, and only when this is a slice session (`skills/harness-build/SKILL.md` §Epic Slice Chain's slice-session rule, applied to the `docs_path` just computed — every other session records nothing, and the field stays absent) whose `{docs_path}` does not exist yet, take the working-tree baseline **`dirty_at_start`**: a map from each path in the union of `git -c core.quotePath=false diff HEAD --name-only --no-renames` and the `??` entries of `git -c core.quotePath=false status --porcelain --untracked-files=all` to its `git hash-object` (`null` for a path deleted in the working tree) — `{}` for a clean tree, `null` when `has_git == false` or a git command fails (an unborn HEAD falls back to `git status` alone). It is read by `skills/harness-build/SKILL.md` §Epic Slice Chain's automatic commit, which commits only what changed since and applies only when this is a map — absent or `null`, it asks the commit question instead (and §Approval Gate's slice variant then promises no commit, nor — with `has_git == true` — the next slice). A slice session whose `{docs_path}` already exists is a **retry** — an earlier attempt of the same slice created it (one that stopped or was restarted before its commit, with its `Command` run again) — and records nothing: a baseline taken now would count that attempt's uncommitted edits as already there and leave them out of the commit, so the field stays absent and the slice gets the commit question and a boundary stop instead. Create `.harness/`, `.harness/planner/`, `.harness/generator/`, `{docs_path}`, then **immediately** write the partial state.json crash-recovery checkpoint (`version`, `skill`, `phase: "setup"`, `task`, `run_style`, `cli_flags`, `user_lang`, `has_git`, `created_at`, `docs_path`, `slug`, and `dirty_at_start` when taken); the rest stays `null` until item 11, whose write replaces `phase` with `plan_ready`. A session found at `setup` was interrupted in between; §Session Recovery's `setup` row re-enters at item 8.
8. **Create the git branch (if has_git):** `git checkout -b harness/<slug>`. On a resume from `setup`, when the current branch is already `harness/<slug>` — the interrupted run got this far — skip the creation and record that name. **(P0-5) On failure** (the branch exists): never proceed on an unspecified branch. **Empty branch** (no commits beyond its creation point) → reuse it silently. **Non-empty branch** → never reuse silently; it would mix prior commits into this session's diff and contaminate Layer 2/3 judgment (`design/harness-prompt-diet/RATIONALE.md`). Either suffix `-2`, `-3`, … until `git checkout -b harness/<slug>-N` succeeds, or ask the §Branch question in `templates/harness/setup_prompts.md`. Record the ACTUAL name in `state.json.branch`.
9. **Mode Gate resolution:** apply §Mode Gate INCLUDING **§Ambiguity Prompt** (`templates/_shared/mode_gate.md`), which fires only with NO opt-in present: no `--mode`, no `--fast`, ultracode OFF, no project-default `path` (`agent-harness-defaults:` line), `Workflow` available, `has_git == true`, interactive, no `--no-prompt`. Modes single(inline) / standard(workflow) / multi(workflow); ultracode target multi. Store `mode` and `path_resolved`, then emit **§Path Transparency** — `Path : <inline | workflow>  (<reason>)`. If a workflow-tier `--mode` resolved to inline, notify (in `user_lang`): "<tier> mode requires the native Workflow engine and git — proceeding on the inline path."
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
10. **Model configuration**, first match wins: `--model-config` if given; else the resolved project-defaults line's `model-config=<preset>` (first source wins wholesale: settings.local.json env → project CLAUDE.md → user CLAUDE.md; `templates/_shared/project_defaults.md`), echoed `(project default)` beside the Model line; else `balanced` silently when `cli_flags.fast`, echoed `(fast default)`; else ask the §Model question in `templates/harness/setup_prompts.md`, which also defines the "Other" parse and its retry bound.
<!-- SYNC-WITH: templates/_shared/project_defaults.md §agent-harness-defaults -->
    Store `model_config: { preset, executor, advisor, evaluator, verifier }` (`default` preset stores `{ preset: "default", verifier }`).

10.5. **Verifier model:** `model_config.verifier = cli_flags.verifier_model ?? project_default.verifier_model ?? "haiku"` (the preset default is always `haiku`).

    **docs_path usage rule**: always read `docs_path` directly from state.json; never recompute it from `cli_flags.output_dir`, which is audit/record only. This does NOT generalize to every `cli_flags.*` field — `epic`, `cold_pass`, `fast`, `cold_pass_source` and `separate_gate` are written here and read elsewhere. The Safety Guard in Session Recovery uses `docs_path` directly too.

11. **Write `.harness/state.json`** from the v3 literal in `templates/harness/state_schema.md` — the single source for the field set and the additive-optional defaults (`plan_critic.*`, `converge.*`, `spec_stamp`, `scale.*`, `epic.*`, `verify.cold_*`, `cli_flags.epic` / `cold_pass` / `cold_pass_source` / `fast` / `separate_gate`, `gate.*`, `dirty_at_start`); `workflows/_reference/state_fields.md` maps each additive field to its writer and readers. Substitute this session's values — item 7's `dirty_at_start` carried over unchanged, and left absent when item 7 took none — invent no field it does not list, and never make an additive field required.

12. **Print the setup summary** — block shape plus its two conditional warnings (a `sonnet`/`opus` verifier's cost line, and **(P1-3)**'s "no build/test/lint/type-check command detected" line, which warns and never halts): `templates/harness/setup_summary.md`. Render per §Print Translation Pattern, labels English raw.
13. **Proceed to Step 1.5.** If `run_style == "step"` and the CLI step is not `plan`, check prerequisites and jump to that step once Step 1.5 completes.

---

### Step 1.5: Convention Scan

*Runs after Setup and before Plan, in all modes and on both paths.*

**Persisted Spec Artifacts Check** — before the richness check, look for `{docs_path}conventions.md` (placed there by hand, or written by a run before v9; `{docs_path}` comes from state.json — §Step 1 item 7):

| `state.conventions` | `.harness/conventions.md` | `{docs_path}conventions.md` | Action |
|---|---|---|---|
| `"file:.harness/..."` | exists | any | **(M2)** skip this check — the live file is authoritative on resume and must never be overwritten by a possibly-stale persisted copy. Go to the richness flow |
| `"file:.harness/..."` | missing | exists | copy it to `.harness/conventions.md`; go to Step 2 |
| `"file:.harness/..."` | missing | missing | `state.conventions = null` as one atomic write (an in-memory-only reset loops on the next resume); go to the richness flow |
| `null` or `"skipped"` | any | exists | copy it to `.harness/conventions.md`, set `conventions = "file:.harness/conventions.md"`; go to Step 2 |
| `null` or `"skipped"` | any | missing | go to the richness flow |

**CLAUDE.md Richness Check:** a root `CLAUDE.md` with ≥ 50 lines → **rich**; fewer → **sparse**; absent → **missing**.

**`conventions` field contract** — always one of `null` (Step 1.5 not yet executed), `"skipped"` (the user chose to skip), or `"file:<path>"` (e.g. `"file:.harness/conventions.md"`).

**Conventions injection rule (used by Step 2):** When `conventions` starts with `"file:"`, read the file at the path after the prefix. If the file does not exist, treat as `null` and re-run Step 1.5. When `conventions` is `null` or `"skipped"`, pass `{conventions}` / `args.conventions` as empty string. <!-- SYNC-WITH: skills/harness/SKILL.md §Step 1.5 conventions field contract -->

**If rich:** copy CLAUDE.md to `.harness/conventions.md`, store `conventions → "file:.harness/conventions.md"`, print `  [harness] Conventions: CLAUDE.md detected (rich). Copied to .harness/conventions.md`, go to Step 2.

**If sparse or missing:** with `cli_flags.fast`, set `conventions → "skipped"` without asking and print `  [harness] Conventions: skipped (--fast).` Otherwise ask the §Convention Scan question in `templates/harness/setup_prompts.md`.

**If "Skip":** `conventions → "skipped"`; print `  [harness] Conventions: skipped.`; go to Step 2.

**If "Scan":** read `{CLAUDE_PLUGIN_ROOT}/templates/planner/convention_scanner.md`; fill `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}`, `{output_path}` = `.harness/conventions.md`; **dispatch 1 sub-agent** (always inline on both paths; model `model_config.advisor` when preset ≠ "default", haiku for economy); expect `"conventions written"` on the first line; verify the file exists. If it does not, warn (in `user_lang`) "Convention scan completed but output file not found." and ask the §Convention Scan Failed question in `templates/harness/setup_prompts.md`. Then store `conventions → "file:.harness/conventions.md"`, print `  [harness] Conventions: scanned and saved to .harness/conventions.md`, update `updated_at`, proceed to Step 2.

---

### Step 2: Plan Phase

Update state.json: `phase → "plan_ready"`, `updated_at → now`. Print `[harness] Phase: Plan`

**Discovery Notes Injection — both paths:** before the plan dispatch/segment, read `qa_discovery_notes` (the content of `{docs_path}qa_notes.md`) and `critic_findings` (the content of `{docs_path}critic_findings.md`). Missing → `""` silently — the usual case; nothing in this plugin writes either file. **(s2)** Present but unreadable → warn (in `user_lang`) "Failed to read `{path}`: <error>. Discovery Notes will be empty for planner injection.", fall back to `""`, never abort. **(m4)** This applies ONLY to initial proposal inputs — the inline `planner_single.md` dispatch and the `harness.plan` segment `args`. Synthesis already receives proposals that incorporate it; never double-inject downstream.

**`spec_stamp` write protocol (single source — every site that writes `{docs_path}spec.md` cites it by name and none restates it: §Step 2 — INLINE path, §Step 2 — WORKFLOW path and its Auto-revise re-entry, §Gate re-entry flags' `--modify`, §Approval Gate's "Modify" (every variant), `skills/harness-gate/SKILL.md` §Step 3's "Modify" option, and the converge loop's write events — a round apply, a decision apply and §Session Recovery's re-stamp, `templates/harness/converge.md` §Write Events):** three ordered steps, **invalidate first**.

1. Capture `prev = state.spec_stamp.generation`. A `null` or malformed stamp (no write yet, or one cut off after this step) takes instead the largest integer `generation` held by `gate.spec_stamp` or `plan_critic.spec_stamp_at_critic`, `0` when neither holds one — so a generation never repeats a value a recorded copy was taken at, and an approval or critic record bound to it cannot match a spec.md changed since. Then write `spec_stamp → null` as a write of that field alone — never folded into a neighbouring `state.scale.*` write, since its whole purpose is to land BEFORE the file changes.
2. Write (or let the dispatched planner write) `{docs_path}spec.md`.
3. Write `spec_stamp → { "generation": prev + 1, "lines": <line count of the file as it now stands on disk — counted as every reader of the stamp counts it: the lines a Read of the file shows, a last line without a trailing newline counting as one (never `wc -l`, which counts newline characters and is one short on such a file)> }`.

The order is load-bearing and counter-intuitive; the argument for it is `design/harness-prompt-diet/RATIONALE.md`. Never reverse it.

#### Step 2 — INLINE path (mode: single)

1. Phase → `"planning"`, and in the same write apply protocol step 1 (capture `prev`, `spec_stamp → null`) — on this path the sub-agent dispatched at item 3 writes the file, so the invalidation must precede the dispatch.
2. Read `{CLAUDE_PLUGIN_ROOT}/templates/planner/planner_single.md`.
3. **Dispatch 1 sub-agent** with `{task_description}`, `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}`, `{qa_discovery_notes}`, `{critic_findings}`, `{conventions}` (per §Conventions injection rule) and `{spec_path}` = `{docs_path}spec.md`; always pass the discovery placeholders, even when empty. Model: `model_config.advisor` when preset ≠ "default".
4. Parse the first line; print `  ✓ {first line}`.
5. Verify `spec.md` exists, then apply protocol step 3. If it does not, leave `spec_stamp` at `null` — the gate reads that as stale rather than as a clean spec nobody wrote.
6. **Compute and freeze §Scale Assessment** — this path has no `sliceHint`, so apply the INLINE Fallback against the just-written spec.md; one read-modify-write into `state.scale.signals` / `slice_hint` (`null`) / `override` (from `cli_flags.epic`).
7. Phase → `"plan_done"`, `updated_at → now`.

#### Step 2 — WORKFLOW path (mode: standard | multi)

1. Phase → `"planning"`.
2. Run the Plan segment: the `Workflow` call, its `args` and its return shape are `templates/harness/plan_segment_call.md`.
3. Record `runs.plan → { "runId": "<id>" }` and `updated_at`.
4. The segment returns `{ plan: PlanResult, proposals, stats }`. Print per OLC `  ✓ Plan segment: {stats.proposalsSucceeded}/{stats.proposalsRequested} proposals → synthesis`.
5. **Persist `proposals`**: write `.harness/planner/proposals.json` ← the returned array, serialized directly (not content analysis — §Architecture Principles #1). Do this BEFORE item 9, so a crash between the two leaves `phase != "plan_done"` and resume re-enters Step 2. Applies to this dispatch and to a FULL re-run; a `reSynthesisOnly: true` re-entry is excluded.
6. **Write `{docs_path}spec.md` from the PlanResult** under the `spec_stamp` write protocol (step 1 immediately before this write, step 3 after item 7), using the heading mapping in `templates/harness/spec_render.md`. Headings render in `user_lang`; the `- [ ]` checkbox glyph does not.
7. Verify `spec.md` exists, then apply protocol step 3.
8. **Compute and freeze §Scale Assessment** from the in-context `PlanResult` — raw signals from `acceptanceCriteria` / `steps` / `scope.inScope` / `risks`, each `Array.isArray`-guarded per its Signal Domain; the verbatim `sliceHint`; the override from `cli_flags.epic`. One read-modify-write into `state.scale.*`.
9. Phase → `"plan_done"`, `updated_at → now`.
10. **On Workflow error** (launch failure, script error, schema-invalid result): §Mode Gate graceful fallback → re-run this step on the INLINE path.

**Auto-revise re-entry** — re-runs the same segment in re-synthesis form, skipping Propose. Procedure, arg table and interruption contract: `templates/harness/auto_revise.md`. Dispatched only from §Step 2.6, `skills/harness-gate/SKILL.md` §Step 3 Pass A "Auto-revise", or `/harness --auto-revise`. Three rules are repeated here because getting one wrong fails silently: `reSynthesisOnly` is a REAL boolean (the string `"false"` is truthy and skips Propose); `criticFindings` carries the CONTENT of `{docs_path}plan_critic_findings.md`, a different document from the first dispatch's; and the spec.md re-render follows the `spec_stamp` write protocol in full. The re-entry ends by re-running §Step 2.6's own-critic dispatch in the SAME turn.


#### Step 2.6: Plan Critic

*Runs after Step 2 on BOTH paths — common to both, not a third alternative.* With `cli_flags.fast`, skip everything below: write `plan_critic.applied = "skipped"`, `source = "fast"`, the other five fields `null`, `round` unchanged; print `  Critic: skipped (--fast)`; go to §After Plan Phase.

**Plan Critic routing predicate (single source for (a) and (b) — §Session Recovery's `planning`/`plan_done` row cites them by name):** evaluated in this order — **(a)** `{docs_path}spec.md` does NOT exist → Step 2 (nothing to critique yet); **(b)** spec.md exists AND `state.plan_critic` has no recorded `applied` → Step 2.6, here; **(c)** spec.md exists AND `applied` IS recorded (`"executed"`, `"skipped"` OR `"failed"` — any of the three) → past Step 2.6, where that row's own items decide the rest — the gate (§After Plan Phase) unless a run was cut off, an inline record is stale or a decision is still unasked. The predicate is "a record exists", never "the record says success", and never bare file-existence (AC-6).

**Skip-vs-run decision** (separate from the routing predicate): the only skip is the `cli_flags.fast` one above. Every other session runs this step's own critic as one converge run (below); `source = "own"`. A `{docs_path}critic_findings.md` already sitting in the directory does not skip it — before v9 it did.

**Converge loop.** The own-critic dispatch is one *run* of the converge loop — `templates/harness/converge.md`, the single source for the run and round procedure, the round budget `R = 5`, the ledger and snapshot under `.harness/converge/`, the exit on the ledger (`converged` / `capped`, plus `failed`), the apply rule, write events, fingerprints and merging, the classification rubric, the once-per-session decision question and its triage, the residual, the `git status` comparison and the non-interactive rule. Read it before starting a run; never restate it here. Every citation of "§Step 2.6's own-critic dispatch" — routing predicate (b), `--critic`, `skills/harness-gate/SKILL.md` §Step 3's "Run Critic anyway" / "Retry Critic", the Auto-revise re-entry's same-turn re-critic — starts one run. The stamp check, the delete, the WORKFLOW and INLINE branches and the latch below describe the **round-1 critic** of a full-review run, reused unchanged except that it writes no `plan_critic` record of its own. The loop's own review and verify sub-agents are inline on both paths — no new segment — with the model roles of `templates/_shared/model_config.md` §Harness role map.

**Pre-dispatch stamp check (own-critic only):** if `state.spec_stamp` is `null` or malformed, neither delete nor dispatch — take failure branch (iii) with `failure_reason = "spec_stamp_invalid"`: the §Step 2 write protocol did not finish, so spec.md is a partial write nobody intends to keep.

**Pre-dispatch delete (own-critic only, both branches):** immediately before dispatching, delete `{docs_path}plan_critic_findings.md` if it exists — the path is fixed and reused every pass, so only this delete lets the latch below conclude anything from mere existence. If the delete fails (permission, lock), do NOT dispatch: failure branch (iii) with `failure_reason = "findings_file_stale"`. The crash window this opens, and the gate row it lands on, are recorded in `design/harness-prompt-diet/RATIONALE.md`.

**WORKFLOW branch** (`path_resolved == "workflow"`) — launch `workflows/harness.critic.workflow.js`; the call is `templates/harness/plan_critic_dispatch.md`. It returns a schema-validated `CriticReport` (`counts` / `items` / `summary` — `workflows/_reference/schemas.md`). Print per OLC `  Critic: workflow (schema-validated) — {report.summary}`.

**INLINE branch** (`path_resolved == "inline"`) — dispatch `templates/harness/plan_critic_inline.md` with `{spec_path}` = `{docs_path}spec.md` (a PATH, not content — see that template's header), `{critic_findings_path}` = `{docs_path}plan_critic_findings.md`, `{user_lang}`, `{task_description}`; model `model_config.evaluator` when preset ≠ "default" — the critic is a judgment-type sub-agent (`templates/_shared/model_config.md`), and the WORKFLOW branch's segment already runs it on that role. Expect the leading keyword `critic_findings written` followed by `Critical=N, Major=M, Minor=K`. Print per OLC `  Critic: inline (1-line parse) — {first line}`.

**Latching `applied = "executed"`** (either branch): the round-1 critic's round continues only after confirming (a) `{docs_path}plan_critic_findings.md` exists — a schema-valid `CriticReport` can come back without the file ever being written, and existence carries weight only because of the delete above — AND (b) `state.spec_stamp` is non-`null`. Either failing → branch (iii). The latch itself writes nothing: `applied = "executed"` lands in the mapping at the run's end, after `templates/harness/converge.md` §Mapping has re-rendered that same file as the residual report.

**Single read-modify-write — the mapping** — `plan_critic` (all 7 fields: `applied`, `round`, `last_findings_path`, `failure_reason`, `source`, `counts`, `spec_stamp_at_critic`) + `phase` (+ `converge.status` / `converge.rounds` and the `gate.*` write-back of `templates/harness/converge.md` §Mapping after a run) are written together, once per Step 2.6 entry (fast, run end and each failure branch alike). After a run it is the last spec-related write before §After Plan Phase — a decision question, its apply and the run that follows all come first (`templates/harness/converge.md` §Ending a run):
- **Run end (`converged` / `capped`):** `applied = "executed"`, `source = "own"`, `last_findings_path = "{docs_path}plan_critic_findings.md"`, `counts` = the residual counts (`templates/harness/converge.md` §Residual — open decisions plus unapplied autos, all severities; never a critic's self-reported count), `failure_reason = null`, `spec_stamp_at_critic` = the current `state.spec_stamp` copied by value, `round = 1`. `round` is unset (`null`, read as 0) until a session's first run-end mapping, which writes `1` — **the one place `round` is written**, bounded at 1 because Pass A's Auto-revise option disappears at `round == 1`. Writing it records the Auto-revise opportunity as spent, so the gate never offers a re-synthesis after a run (`skills/harness-gate/SKILL.md` §Step 3's Auto-revise Exposure Predicate, point 3); a hand-typed `/harness --auto-revise` checks only that predicate's point 2 (`templates/harness/auto_revise.md`) and is not stopped by it. The re-critic that ends an Auto-revise re-entry is itself a run and writes the same `1`.
- The gate null-guards `counts` / `last_findings_path` / file-not-found independently — never dereferences without checking.

**Failure handling — 3-way** (the "own" dispatch only; the fast skip never reaches this). Which loop cause lands on which branch: `templates/harness/converge.md` §Ending a run.
- **(i) Workflow engine error** of the round-1 WORKFLOW critic (launch failure, script error, schema-invalid result) → §Mode Gate graceful fallback (re-attempt the round-1 critic inline, as Step 2 does). Not a failure of the run; this branch writes nothing itself.
- **(ii) Permission denial of the round-1 WORKFLOW `harness.critic` call** (NOT an engine error; a refused loop review or verify dispatch is branch (iii)) → `templates/_shared/mode_gate.md` rule 3's denial branch: banner `[harness] ⚠ Workflow denied (not an engine error) — path NOT auto-downgraded.`, `path_resolved` NOT rewritten (set once at §Step 1 item 9), `plan_critic.applied` NOT recorded this pass — the run ends with `converge.status = "failed"` written alone. It does not halt — control proceeds to §After Plan Phase (an inline session's §Approval Gate carries this banner), and what the user types next decides the rest: `/harness` re-enters through §Session Recovery item 4 and lands back here, while a separate session's `/harness-gate` renders Pass A row ④ unrecorded, whose "Proceed as-is" leaves it permanently so — a gap that row's banner discloses.
- **(iii) Parse failure / latch failure / pre-dispatch failure, and every other failure of a run** → `applied = "failed"` with one of eight `failure_reason` strings — the round-1 critic's four (`parse_failed` / `findings_file_missing` / `spec_stamp_invalid` / `findings_file_stale`) and the loop's four (`loop_dispatch_failed` / `loop_parse_failed` / `loop_output_missing` / `loop_tree_dirty`; a failed write event lands on `spec_stamp_invalid`) — `last_findings_path = null`, `source = "own"`, `counts = null`, `spec_stamp_at_critic = null`, `round` UNCHANGED. Which string, what each means and why the stamp is nulled rather than left: `templates/harness/plan_critic_failures.md`. Banner `[harness] ⚠ Plan Critic failed — fallback: skipped, spec unreviewed`. **Progress is NOT blocked** — proceed to §After Plan Phase.

**Two recorded limits** (`design/harness-prompt-diet/RATIONALE.md`): a turn whose converge runs were interrupted, with an earlier record behind them, is resumed by `/harness` with a new full-review run (§Session Recovery item 4 — `converge.status` is still `"running"`); a separate session's `/harness-gate`, typed instead, lands on the row that record selects for spec.md as it now stands — Pass A row ④ only when a full-review run was interrupted between its round-1 delete and the round-1 critic's write (the record points at a file that is gone); otherwise the findings file exists again (holding the raw round-1 critique, not a residual report), so the record is well-formed and lands on row ①-b / ②-b once a write event of the turn moved or invalidated the stamp (a round, decision or `--modify` apply), or on its own not-stale row when nothing was written. "Retry Critic" / "Run Critic anyway" there starts a new full-review run — not an idempotent re-dispatch, since rounds the interrupted run applied stay in spec.md until a later run reviews them; and Step 2.6's own WORKFLOW run id is never persisted, because `state.runs` has exactly `{plan, build, eval}` and `runs.eval` belongs to `skills/harness-build/SKILL.md` §Step 5.

#### After Plan Phase

Print: `[harness] Plan complete.` Then branch on the session's gate mode (§Approval Gate, single source):

**Separate session — every `run_style`** (auto / phase / step) ends here; the gate is `/harness-gate`, a separate skill, so the stop is structural rather than a rule (SPEC rev.9 (b)). When this turn ended a converge run (§Step 2.6, `--critic`, `--modify`), print its summary first: `templates/harness/converge.md` §Summary Block, banners and any open decisions included. Then print the §Scale Assessment block from the values frozen at the end of Step 2, the §Session Boundary block (Type A: After Plan, Resume `/harness-gate`), and `Next → /harness-gate`. Halt. If this session carries `cli_flags.epic` or an epic recommendation, the gate's Pass B leads with "Plan as epic" and prints `/harness-build --epic`, whose `skills/harness-build/SKILL.md` §Step 3.5 fills its table with no in-context `PlanResult` (see its degraded restore order, by name). A non-interactive separate session ends exactly the same way.

**Inline session** — the default, every `cli_flags.fast` session included: continue to §Approval Gate in this turn.

### Approval Gate

HARD GATE #1 rendered in this session (`design/harness-converge/SPEC.md` decision D1, flows 6–9). It is an orchestrator-side AskUserQuestion, never inside a segment script (§Architecture Principles #6); `skills/harness-gate/SKILL.md` §Step 3 is the same gate's other render site, for a separate session. The trade it makes — a model-written approval record checked by the next skill, in place of a turn that holds no write tool — is the one the former Fast Gate made for `--fast` alone; that spec's risk 1 records what it gives up and how it is mitigated.

**Gate mode (single source — `skills/harness-gate/SKILL.md` §Entry Check and `skills/harness-build/SKILL.md` §Entry read it by name).** `cli_flags.separate_gate == true` → **separate**; `false` → **inline**. Absent — a session written before the field existed — → **inline** when `cli_flags.fast == true`, **separate** otherwise. §Step 1 item 2 writes it once per new session and nothing changes it afterwards. It is a different field from `gate.mode`, which records which variant of this gate wrote an approval.

#### Chain Condition (single source)

Holds when ALL three hold: the gate mode is inline; `run_style == "auto"` — the value §Step 1 recorded in state.json, never the style of a later `/harness-build` invocation, so an approval whose description promised no chain is never followed by one at a later point; and the session is interactive — none of the conditions of `templates/harness/converge.md` §Non-interactive rule applies. It is judged at every point that chains and at every option description that promises a chain; where it fails, that point keeps its non-chaining behaviour and the description promises nothing.

#### Rendering

Preconditions: gate mode inline — a separate session takes §After Plan Phase's separate ending instead — and `phase == "plan_done"` and `{docs_path}spec.md` exists; an inline session failing either of the last two prints the §Session Boundary block (Type A: After Plan) with Resume `/harness` and halts, and §Session Recovery routes it from there (a missing spec.md to Step 2) — never to `/harness-gate`, whose §Entry Check sends an inline session back here. By the time this renders, `templates/harness/converge.md` §Decision Question has already run whenever its conditions held — its defaults and answers applied, or nothing applied when a question it asked received no answer — decisions first, approval after (decision D3; on a resume, §Session Recovery item 5) — so the approval question never carries a decision.

1. **Summary**, per OLC. A session that has started a converge run (`converge.runs` ≥ 1) prints `templates/harness/converge.md` §Summary Block — derived from the ledger and `converge.*`, so it renders on a resume too — with the banners that block defines leading it (§Step 2.6 branch (iii)'s failure banner, spec unreviewed; branch (ii)'s `Workflow denied` banner; `Review incomplete` when the run was `capped` or residual Critical + Major is above zero; `Defaulted decision … is now {severity}` for each defaulted decision a later merge raised above Minor). A session without one prints one `Critic:` line from its `plan_critic` record instead — `skipped (--fast)` for `source == "fast"`, `skipped` for a skip record with any other `source` (a state written before v9 can still carry one), §Step 2.6's failure banner for a `"failed"` record. When §Session Recovery item 3 re-stamped this session, add `[harness] ⚠ spec.md re-stamped (an interrupted write or a direct edit)`. Outside the fast and slice variants, then print the §Scale Assessment block from the values frozen at the end of Step 2.
2. **Approval question** — a non-interactive session (`templates/harness/converge.md` §Non-interactive rule, `--no-prompt` included) skips it and goes to step 5. Otherwise ONE AskUserQuestion call that holds the approval alone. It has no text fallback (one of the exceptions `templates/_shared/askuserquestion.md` records): if the call is unavailable or fails, the session is non-interactive from that point — step 5. In `user_lang`:
   - header: "Approval"
   - question: "[harness] Spec: `{docs_path}spec.md` ({n} completion criteria — the `- [ ]` count the INLINE Fallback defines). Approve it?"
   - options, four. Which of the first two leads follows `skills/harness-gate/SKILL.md` §Step 3 Pass B's leading-option table, by name ("Proceed as single" there is "Build now" here, and its plain "Proceed" row leads with "Build now"):
     - "Build now" / "Approve this spec and implement it as one slice: Generate → Verify (Layer 1) → Evaluate (Layer 2/3) → Cleanup" — ending "continues in this session" when §Chain Condition holds, "then run /harness-build" when it does not
     - "Plan as epic" / "Approve this spec and split it into slices: Slice Plan writes slice_plan.md" — ending "continues in this session; the slices then follow one after another here — each asks for its own approval once, and a slice that ends clean is committed without asking" when §Chain Condition holds (`skills/harness-build/SKILL.md` §Epic Slice Chain) — with `has_git == false`, "continues in this session; the first slice then starts here and asks for its own approval once — without git a slice goes on to the next only with its cold review turned off" (that section's clean end) — "then run /harness-build --epic" when it does not
     - "Modify" / "Describe the change; spec.md is edited, re-reviewed, and this question re-renders" — in a loop-skipping session (`templates/harness/converge.md` §Terms), where step 3 runs no review, "Describe the change; spec.md is edited and this question re-renders"
     - "Stop" / "Keep the session at plan_done and halt; /harness re-renders this question later" — or, when the recorded approval already passes `skills/harness-build/SKILL.md` §Entry's approval check (a re-render after a `--critic` or an empty Modify that applied nothing), "Halt at plan_done; the approval already recorded for this spec stays valid — /harness-build, or /harness Resume, proceeds without asking again", its command carrying ` --epic` exactly when `gate.route == "epic"` (step 4's Resume command)
   - **Fast variant** (`cli_flags.fast == true`): three options — no "Plan as epic", since §Step 1 item 2 halts `--fast` with `--epic` — header "Fast Gate", the question prefixed "Plan complete (--fast).", and no §Scale Assessment render (the values stay frozen; the slice variant below skips it too, having no epic choice for it to inform). "Build now"'s description keeps the former Fast Gate notice while `plan_critic.source == "fast"` — "Plan Critic and cold review are skipped" — and reads "cold review is skipped" once a `/harness --critic` run has replaced that record (`templates/harness/converge.md` §Terms); "Modify" takes its loop-skipping description by the same test.
   - **Slice variant** (a slice session — `skills/harness-build/SKILL.md` §Epic Slice Chain's slice-session rule, the `Slice` column read of `templates/_shared/architecture_principles.md` #1 slot (8)): three options — no "Plan as epic", whatever `cli_flags.epic` or the leading-option table says, so an epic never nests; "Build now" leads. When §Chain Condition holds, "Build now"'s description ends "continues in this session; if this slice ends clean it is committed without asking (Commit code only) and the next slice in slice_plan.md starts here" — "…committed without asking — the epic's last slice" on the table's last row — and without the commit clause when `has_git == false` (a clean end then goes on with no commit). With `has_git == true` and `dirty_at_start` not a map (a retried slice included — §Step 1 item 7), it ends with the plain "continues in this session" and promises neither: that section's automatic commit cannot apply, so the slice asks the commit question and ends at a boundary stop. When §Chain Condition fails, the description promises neither. Choosing it is this slice's consent to that commit and that chain (decision E-1) — the table itself consents to nothing, which is why a slice is never approved without this question. Combined with the fast variant (a `--fast` added to a slice `Command` by hand), both apply.
3. **Answers.**
   - **"Build now" / "Plan as epic"** — the only answers that approve, with no exception: "Other" free text, an ambiguous answer and a text-fallback reply, by number or keyword, never approve. If `spec_stamp` is `null` or malformed (a write cut off this turn — §Step 2.6 branch (iii) `spec_stamp_invalid`), or `{docs_path}spec.md` cannot be read or its live line count (counted as §Step 2's `spec_stamp` write protocol step 3 defines) differs from `spec_stamp.lines` (an edit outside the orchestrator that no write since has re-stamped — a `--critic` or empty-Modify run that applied nothing leaves it so), record nothing — `skills/harness-build/SKILL.md` §Entry's approval check would refuse that record at (b), (d) or (e): print `[harness] spec.md's stamp is missing or out of date — run /harness to re-stamp and re-review it`, then step 4. Otherwise write **the approval record** as ONE state.json write: `gate.approved = true`, `gate.approved_at = now`, `gate.mode` = `"fast"` (fast variant) or `"session"`, `gate.spec_stamp` = the current `spec_stamp` copied by value, `gate.route` = `"single"` ("Build now") or `"epic"` ("Plan as epic"), `updated_at = now`. Nothing writes spec.md between this record and the chain. Then, when §Chain Condition holds, print `[harness] Approved — chaining into /harness-build{ --epic}.` and invoke the `harness-build` skill via the Skill tool **in this same turn**, with the argument `--epic` on the epic route and none otherwise — the same chaining `skills/handoff/SKILL.md` performs on "Start next step". Its §Entry checks the record; on the single route it performs the `generate_ready` write and runs Steps 4 → 8 with this session's `cli_flags` (`--fast` implies `cold_pass == false`, so `skills/harness-build/SKILL.md` §Step 5's gating table skips the cold pass), and HARD GATEs #2 and #3 still render there. When §Chain Condition fails — `run_style != "auto"` included — or the Skill tool is unavailable or the invocation is refused, go to step 4. The approval stays recorded either way.
   - **"Modify"** — ask one follow-up (header "Modify", question "What should change in the spec?"). A non-empty request is applied orchestrator-inline exactly as `--modify`'s action (§Gate re-entry flags): one write event, then a new converge run and its mapping — or, in a loop-skipping session (`templates/harness/converge.md` §Terms), the `spec_stamp` write protocol alone. An empty answer applies nothing and starts a new run with a full review, `--critic`'s action; a loop-skipping session only re-renders. Then render this gate again from step 1. No round bound; each loop is one user action.
   - **"Other" free text** is a Modify, never an approval: a change request is applied as the Modify request above; anything else — an approval in words, a question, an ambiguous answer — applies nothing and asks the Modify follow-up instead.
   - **"Stop"** — write nothing; step 4.
4. **Stop output** (flow 8) — whenever an inline session stops at `plan_done` (Stop, §Chain Condition failing, a refused chain, a non-interactive session): print the §Session Boundary block (Type A: After Plan) with Resume `/harness-build` (plus ` --epic` when `gate.route == "epic"`) if the recorded approval passes `skills/harness-build/SKILL.md` §Entry's approval check, and Resume `/harness` otherwise — no separate `Next →` line. Halt. This agrees with `templates/_shared/run_style.md` §run_style: after an approval under `run_style == "phase"`, the next command is `/harness-build`.
5. **Non-interactive** (flow 9) — headless, cron, a sub-agent, `--no-prompt`, or AskUserQuestion unavailable or failing (`templates/harness/converge.md` §Non-interactive rule): no decision question, no approval question, no approval record, no chain. Step 1's summary — open decisions included — is already printed (step 1 always runs first); print step 4's stop output, plus one escape line: `If AskUserQuestion cannot be used here, start a new session with /harness "<task>" --separate-gate and choose Restart at the resume question (item 7) — or, where no question can be answered (headless, cron), delete .harness/ first — the converge results do not carry over, and it cannot be combined with --fast.` In a slice session (§Approval Gate's slice variant) the command in that line is the current row's `Command` with ` --separate-gate` appended, so the new session keeps the epic directory and stays a slice session. `templates/_shared/mode_gate.md` §Ambiguity Prompt step 5's "never block an automated run" governs path selection only: an approval never proceeds without a label selection.

**Guard on the other side:** `skills/harness-build/SKILL.md` §Entry's approval check refuses, writing no gate-crossing field, the `plan_done` route of an inline session whose approval record is missing, not bound to a `spec_stamp`, or no longer matches spec.md or the route typed. A record written before `gate.spec_stamp` existed is no approval: §Session Recovery re-renders this gate, at the cost of one more click. A separate session is unchanged — the human typing `/harness-build` after `/harness-gate` remains its proof (SPEC decision A). `/harness-gate` never writes `gate.*` (it holds no write tool) and redirects an inline session back here (its §Entry Check).

### Fast Gate (`--fast` in-session approval)

A pointer kept for existing citations: a `--fast` session renders §Approval Gate without "Plan as epic" after §Step 2.6's fast branch — step 2's fast variant. Its former resume paragraph and its "Stop" description's "/harness-gate is also valid" are replaced by §Session Recovery's `planning` / `plan_done` row and §Approval Gate's stop output.

---

## Sub-command: doctor

`/harness doctor` — read-only environment diagnostic, reached only through the carve-out at the top of §Session Recovery. No arguments; it neither reads nor writes `.harness/state.json`, creates no branch, resolves no Mode Gate, dispatches nothing, prints no §Session Boundary block, and writes nothing anywhere — not `.harness/`, not `docs/`, not `.gitignore`, not either installed plugin copy. Every path it probes is a fixed constant or resolved at run time from `${CLAUDE_PLUGIN_ROOT}` and `git rev-parse --show-toplevel`.

**Procedure:** read `{CLAUDE_PLUGIN_ROOT}/templates/harness/doctor.md` and follow it verbatim — the two known install locations, the five items (① installed-copy CR contamination, ② Workflow tool availability, ③ git work tree, ④ version and content drift, ⑤ project defaults), each item's `✓` / `⚠` / `—` contract and remediation, and the output block. Render per `templates/_shared/status_format.md` with the prefix `[harness doctor]`. A green ① or ④ says the copies on disk are current, not that this process loaded its skill body from them.

## Model Selection

Preset table, rules and the harness role map: `templates/_shared/model_config.md`. INLINE — pass `model` per role at sub-agent launch (preset ≠ "default"). WORKFLOW — pass the resolved map once as `args.models` (`{executor, advisor, evaluator, verifier}`; a null role inherits). The verifier defaults to haiku on every preset because Layer 1 only runs commands and parses exit codes; `--verifier-model sonnet|opus` overrides it and warns about cost in the Setup Summary.

## User Interaction Rules

`templates/_shared/askuserquestion.md`.

## Architecture Principles

Invariant constraints for the harness orchestrator skills. Full text — principle #1's exhaustive exception list (8 numbered slots, 7 live) and its write/delete carve-outs included — is `templates/_shared/architecture_principles.md`, which `skills/harness-gate/SKILL.md` and `skills/harness-build/SKILL.md` reach through this section.

1. **Orchestrator reads no intermediate files** — 7 live read exceptions in 8 numbered slots, enumerated there. Writing final artifacts from returned objects is not reading intermediates.
2. **The Auto-fix Proposer is the only orchestrator-dispatched sub-agent that directly reads SOURCE files** — others get content through template variables, or one `{docs_path}` artifact PATH handed to them explicitly (AC-27); the converge loop's review and verify sub-agents are the registry's two read-only carve-outs (§Step 2.6).
3. **Paths only to sub-agents; never file contents** — except ephemeral in-segment digests and the `specContent` segment args.
4. **Session-wide invariants** — Auto-fix at most 1 attempt per session; Layer 1 retries max 3, NOT reset after an Auto-fix Apply.
5. **All external paths pass through Path Validator before use** (§Path Validator below).
6. **Gates never enter segment scripts** — the 3 HARD-GATEs render in the orchestrator skills, and `scripts/verify_meta_literal.py` rejects gate-marker tokens inside any segment script. HARD GATE #1 (spec-confirm) renders at §Approval Gate (every variant) in an inline session and at `/harness-gate` in a separate one — one gate, two render sites, not a fourth HARD-GATE; the count stays 3.

<!-- BLOCK-START:hx-path-validator v2 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
### Path Validator

`validate_path(path, kind)` with `kind ∈ {output_dir, file_reference, diff_target}` — the five normalization and rejection steps, the reserved first-segment set, the `docs/harness/` carve-out, every halt message and the attack-vector mapping are `templates/_shared/path_validator.md`. Read it before validating a path; never restate it.

Call sites: `--output-dir` parsing (`skills/harness/SKILL.md` §Step 1 item 2, `kind=output_dir`); the Session Recovery Safety Guard re-validation (`kind=output_dir`); `{failing_files_list}` injection, the Edit-tool unified-diff Apply, cold-review input collection and cold `finding.file` validation — WORKFLOW path only (`skills/harness-build/SKILL.md` §Step 5, `kind=file_reference` / `diff_target`).
<!-- BLOCK-END:hx-path-validator v2 -->

## Key Rules

- **Never skip phases.** Plan → Generate → Verify → Evaluate; the `plan_done → completed` epic exit (§State Transition Diagram) is the one by-design exception.
- **Confirmation gates are non-negotiable.** No implicit approval; gates live ONLY in the orchestrator skills, never in a segment script. HARD GATE #1 renders in-session as §Approval Gate (the default, `--fast` included) or as `/harness-gate` (`--separate-gate`); neither removes it, and in-session only a label selection approves — never free text, a text-fallback reply or a non-interactive run.
- **Stay within scope.** Never modify a file outside it.
- **Evaluator must be isolated.** Anchor-free input, never Generator reasoning.
- **Planner proposals must be independent.** Never share one persona's work with another during proposal; the plan segment's `parallel()` enforces this.
- **Generator advisors review the plan, not code.** Advisory before implementation.
- **User language.** All user-facing output in `user_lang` per §Output Language Contract; Glossary tokens and parser keywords stay English raw.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — an explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **Intermediate outputs are ephemeral.** Only final artifacts persist in `docs/`, and the orchestrator reads none of them beyond §Architecture Principles #1's list.
- **Workflow args are a JSON object;** segment scripts parse defensively (`args` may arrive as a JSON string). Never put user-gate decisions into args.
- **Graceful engine fallback.** Any Workflow failure degrades to the inline single path with a notice, never a hard error.
