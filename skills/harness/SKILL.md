---
name: harness
disallowed-tools: NotebookEdit
description: Entry point of the 3-Phase harness (Plan -> Gate -> Generate -> Verify -> Evaluate) — Setup, Convention Scan, Plan and Plan Critic, writes spec.md, then halts at plan_done and hands off to /harness-gate (the tool-less spec-confirmation gate) and /harness-build (implementation). Plugin-shipped native Workflow segments on the workflow path (ultracode or --mode opt-in), inline single path otherwise; read-only `doctor` diagnostic. Use for development AND non-development tasks that benefit from structured planning and 3-layer review. (formerly /workflow)
---

# Agent Harness — /harness Orchestrator (v3, plan half)

You are a **state-machine orchestrator** — the ENTRY POINT of a pipeline split across three skills that share one `state.json` phase machine:

| Skill | Owns | Tools it does NOT have |
|---|---|---|
| `/harness` (this file) | Step 1 → 1.5 → 2 → 2.6, `spec.md`, the Plan Critic, `doctor`, §Fast Gate | `NotebookEdit` |
| `/harness-gate` | Step 3 — HARD GATE #1 (spec confirmation) only | `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`, `Workflow` — it can change nothing |
| `/harness-build` | Step 3.5 → 3.6 → 4 → 5 → 6 → 7 → 8 | `NotebookEdit` |

**Every non-fast session of this skill ends at `plan_done`** and prints `Next → /harness-gate`. The gate is a separate user message by construction: the turn rendering it holds no write tool, so nothing can be implemented before the human confirms the spec (SPEC §1 — `design/harness-ordering-enforcement/SPEC.md`). `--fast` is the one explicit opt-out — it confirms the spec in-session (§Fast Gate) and chains into `/harness-build` under a state.json approval flag. Neither sibling can be prevented from being invoked directly; each detects a missing prerequisite and says so.

Your role: manage phase transitions via `state.json` up to `plan_done`; resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped segment scripts, branching on schema-validated objects rather than parsed text); and halt at `plan_done` with the next command. **You do NOT** read intermediate artifacts, accumulate sub-agent output, or judge code quality — §Architecture Principles #1 holds the only exceptions. Sub-agents and segment scripts do the domain work; you handle transitions and write `spec.md` from returned objects.

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

<!-- BLOCK-START:hx-mode-gate v2 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
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

Block shape, label rules and the harness phase labels (`plan_ready` → "Plan — ready" … `completed` → "Completed"): `templates/_shared/status_format.md`. Mode enum `<single | standard | multi>`; extra row `Path : <inline | workflow>  (<reason>)`.
<!-- BLOCK-END:hx-mode-gate v2 -->

## Session Recovery (state.json v3 phase machine)

**doctor carve-out — evaluate FIRST.** If this invocation's positional arguments are exactly the single token `doctor`, skip this section and go straight to `## Sub-command: doctor` — read no `.harness/state.json`, resolve no path, resume nothing.

**Positional arguments** = the argument list minus (a) every token beginning `--` and (b) the single token after each VALUE-TAKING flag: `--mode`, `--model-config`, `--verifier-model`, `--lint-cmd`, `--type-check-cmd`, `--output-dir`, `--modify`. The boolean flags (`--epic`, `--no-epic`, `--no-cold-pass`, `--no-prompt`, `--auto-revise`, `--critic`, `--fast`, `--quick`) consume nothing. **A VALUE-TAKING flag added later MUST join that list**, or it would swallow `doctor` as its value. A quoted task merely containing the word is one positional token that is not `doctor`.

**Otherwise follow `templates/_shared/session_recovery.md` in full** — items 1–7, the Session Conflict gate, the legacy-version branch, the `model_config` / `conventions` / `has_git` restores, the resume-suppression checks and the Restart / Stop / View state only actions live there, once, for this skill and `/harness-build` alike. Two things are this skill's own:

**6.5. docs_path drift check** (feeds item 7's check (b); acts on nothing itself): only if THIS invocation supplies **both** `--output-dir` and a task string, recompute a candidate `docs_path` from those two arguments alone — §Step 1 item 2's normalization, item 3's slugify and item 7's formula, by name, never the stored `cli_flags.output_dir` — and compare it with the stored `docs_path`. Either argument missing → skip. A malformed recomputation is "comparison not possible", never a mismatch. Nothing is written back.

**Item 7 Resume — this skill's phase jump table.** Once that file's Safety Guard re-validation passes, jump to the state matching `phase` (segments are re-RUN, never runId-resumed, across sessions):

- `plan_ready` → Step 1.5 if `conventions` is `null` (or a `"file:"` whose file is missing), else Step 2 (`"skipped"` = the user already decided).
- `planning` / `plan_done` → **first check `state.epic.boundaries != null`** (meaningful only at `plan_done`, where the combination is itself a boundary-Q&A-completion mark): if set, print `[harness] Boundary Q&A already answered — run /harness-build --epic` and halt. Otherwise apply the §Step 2.6 Plan Critic routing predicate (single source there): the branches that run Step 2.6 run it now, in this session, and every branch then ends at §After Plan Phase — `Next → /harness-gate` normally, §Fast Gate for a `cli_flags.fast` session. **This skill never routes into Step 3**; the gate is reached only by the human typing `/harness-gate` (SPEC §2.2).
- `generate_ready` … `evaluate_done` → owned by `/harness-build`: print `[harness] This session is past the gate (phase: {phase}) — run /harness-build` (with `verify` / `evaluate` when `phase` is `generate_done` / `verify_done`) and halt. Nothing is written.
- `completed` → no active session; proceed to Step 1.

If `.harness/state.json` does not exist, proceed to §Fresh Start.

### Fresh Start

The entry taken when no session exists, or after a Restart / "Delete and start" deleted one: **Step 1: Setup** (§Workflow Steps). Each skill defines this section once, which is why the shared procedure names it and never a Step number.

### Gate re-entry flags (`--modify` / `--auto-revise` / `--critic`)

`/harness-gate` cannot edit `spec.md`, dispatch a critic or re-run a Plan pass; each of those options ends the gate's turn by printing one of these commands, which THIS skill executes. All three require `phase == "plan_done"` (otherwise `[harness] --{flag} needs a plan_done session (phase: {phase})` and halt), all three refuse a session whose `gate.approved == true` (print §Fast Gate's `[harness] Fast Gate already approved — run /harness-build` and halt — each can rewrite the spec that approval was given for), and all three end at §After Plan Phase, so the gate re-renders from Pass A next session against the fresh `spec_stamp` / `plan_critic` state. `--critic` always STARTS A NEW converge run (§Step 2.6 **Converge loop**), and `--modify` does too outside a loop-skipping session (`templates/harness/converge.md` §Terms), so the gate that follows lands on the record that run's mapping wrote.

| Flag | Action (orchestrator-inline) | Writes |
|---|---|---|
| `--modify "<request>"` (VALUE-TAKING — listed in the doctor carve-out above) | apply the request to `{docs_path}spec.md` orchestrator-inline, never a dispatched sub-agent (SPEC decision ③), as one write event of `templates/harness/converge.md` §Write Events; then a new converge run and its mapping — a delta first round only when, just before the edit, the session's last run had completed (`converge.status` `converged` / `capped`) AND `skills/harness-gate/SKILL.md` §Stale Determination said not stale; a full review otherwise (that file's §Starting a run item 1). A loop-skipping session (that file's §Terms) applies the request under §Step 2's `spec_stamp` write protocol alone and runs nothing | `spec.md`, `spec_stamp`; outside a loop-skipping session also `.harness/converge/*`, `converge.*`, `plan_critic.*` |
| `--auto-revise` | §Step 2 — WORKFLOW path's Auto-revise re-entry, including its same-turn Step 2.6 re-run | as that re-entry |
| `--critic` | §Step 2.6's own-critic dispatch — a new converge run with no spec change, so it starts with a FULL review and its round-1 critic runs (a fresh single write to `plan_critic` at the mapping, `source = "own"`). Round-1 critic on the INLINE branch whenever the recorded failure was a Workflow permission denial OR `plan_critic.applied` is unrecorded — both footprints of §Step 2.6 branch (ii), the two-way condition `skills/harness-gate/SKILL.md` §Step 3 Pass A row ④ states. No `failure_reason` string records that denial: `loop_dispatch_failed` records a refused or erroring INLINE dispatch, never the Workflow denial, so it does not force the INLINE branch. A bare re-entry states no change, so the denied Workflow call is never re-issued (`templates/_shared/mode_gate.md` rule 3) | `plan_critic.*`, `converge.*`, `.harness/converge/*`, and `spec.md` / `spec_stamp` when a round applies |

## run_style (Execution Mode)

The three styles (`auto` / `phase` / `step`), the full CLI surface of all three pipeline skills and the step-mode prerequisite table are `templates/_shared/run_style.md`. Read it when parsing arguments or deciding where a session ends. This skill's end point is fixed regardless of style: **every `/harness` session ends at `plan_done`** (SPEC rev.9 (b)) — `auto` does not run through to the gate, and `--fast` ends at §Fast Gate instead.

---

## Session Boundary

Block shape and the `/handoff generate` field contract: `templates/_shared/session_boundary.md`. This skill has exactly ONE Type A site, §After Plan Phase, and it is not optional; Type B (task complete) belongs to `/harness-build`.

| Boundary site | Completed → Next | Resume command |
|---|---|---|
| After Plan (Step 2) — the only Type A site here | Plan → Gate | `/harness-gate` (always; a `--modify` / `--auto-revise` / `--critic` re-entry prints the same line). A `cli_flags.fast` session prints this block only when the Fast Gate answers "Stop", with Resume `/harness` |

**Residual:** `/harness-build` typed directly still skips the gate — by design (SPEC §8), disclosed by `skills/harness-build/SKILL.md` §Entry, never prevented.

---

## Scale Assessment

> Single source for the scale/slice recommendation. **(1) compute** — §Step 2, immediately after the Plan segment/sub-agent completes on BOTH paths, once per Plan pass; **(2) render** — §After Plan Phase, every non-fast session; **(3) render** — `skills/harness-gate/SKILL.md` §Step 3 Pass B next session, from the same frozen values.

### Compute-once / freeze / render-by-reference

Computed exactly ONCE right after Step 2 completes — on both paths, and again on an Auto-revise re-entry (a fresh Step-2-shaped run) — before phase advances to `plan_done`, from the in-context `PlanResult` (WORKFLOW) or spec.md (INLINE fallback), into `state.scale.signals` / `slice_hint` / `override` in one read-modify-write. Every render site reads `state.scale.*` and never re-derives. **On cross-session resume, do NOT recompute**; if `state.scale` is missing entirely, treat every signal as `absent` and render the INLINE Fallback — never error, never block the gate.

<!-- BLOCK-START:hx-scale-render v2 — shared by /harness, /harness-gate; edit every copy in one commit and bump the version -->
### Render fragment

What a render site prints — the four raw signal counts, the verbatim `sliceHint` recommendation and rationale, the `cli_flags.epic` override line and its `Decision :` row, the confirmation-ownership line, the `ok` / `absent` / `malformed` Signal Domain, and the INLINE Fallback degraded 1-signal mode — is `templates/_shared/scale_assessment.md`. Read it at the render site and follow it verbatim; never restate or summarize it here.

Two rules are repeated because they govern that read: the recommendation is **never** derived from the counts (it comes only from `sliceHint`, which Synthesis produced with full qualitative judgment), and no rendered line may be phrased as a numeric threshold comparison.
<!-- BLOCK-END:hx-scale-render v2 -->

---

<!-- BLOCK-START:hx-state-machine v2 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## State Machine

### State Transition Diagram

```
plan_ready → planning → plan_done → [User Gate] → generate_ready
  → generating → generate_done → verify_ready → verifying → verify_done
  → evaluate_ready → evaluating → evaluate_done → [Verdict Gate]
  → completed

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
- `plan_done` → `completed` directly is the one epic-exit exception, taken only via `skills/harness-build/SKILL.md` §Step 3.6 (by name); no other transition skips a state.
- `[User Gate]` is `/harness-gate` — or, for a `cli_flags.fast` session, `skills/harness/SKILL.md` §Fast Gate, which records `gate.approved` before `/harness-build` performs the `generate_ready` write.
<!-- BLOCK-END:hx-state-machine v2 -->

---

## Workflow Steps

### Step 1: Setup

0. **doctor dispatch.** When §Session Recovery's carve-out applies, this step is never reached.
1. **Detect user language** from the task → `user_lang`.
2. **Parse CLI arguments** — every halt below fires HERE, before item 7 creates directories and item 8 creates the branch, so a rejected invocation leaves no ghost `.harness/` for the next Session Recovery to offer as Resume:
   - Bare task → `run_style: "auto"`; `plan|generate` prefix → `"phase"`; `verify|evaluate` prefix → `"step"`
   - `--mode single|quick|standard|multi|comprehensive|thorough|deep` → mode/path input for §Mode Gate
   - `--fast` / `--quick` → `cli_flags.fast = true`, `cli_flags.cold_pass = false` (`cold_pass_source = "fast"`, or `"flag"` if `--no-cold-pass` is also given — the more specific statement wins): single/inline, no §Ambiguity Prompt, no Model or Convention Scan question, Plan Critic skipped, §Fast Gate instead of `Next → /harness-gate`. With a workflow-tier `--mode` or with `--epic` → halt: "--fast is a single-slice inline shortcut — it cannot be combined with <flag>."
   - `--model-config <preset>`, `--lint-cmd <cmd>`, `--type-check-cmd <cmd>` → overrides
   - `--verifier-model <haiku|sonnet|opus>` (default haiku); any other value → halt: "Invalid --verifier-model value. Allowed: haiku, sonnet, opus."
   - `--output-dir <path>` (default `docs/harness`) → `validate_path(path, kind=output_dir)` (§Path Validator, whose single source carries every rejection message); valid → strip the trailing slash, store in `cli_flags.output_dir`
   - `--epic` / `--no-epic` → `cli_flags.epic = true / false` (tri-state; unset stays `null`, so §Scale Assessment's recommendation stands). Both given → halt: "Cannot combine --epic and --no-epic." Read by §Scale Assessment's override render and `skills/harness-gate/SKILL.md` §Step 3 Pass B — never by `skills/harness-build/SKILL.md` §Step 3.5 or `skills/harness-build/SKILL.md` §Step 3.6's epic-exit predicate, which read `state.epic.boundaries` + `state.phase` only.
   - `--no-cold-pass` → `cli_flags.cold_pass = false` (default `true`), `cold_pass_source = "flag"`; AC-28's three gating points are `skills/harness-build/SKILL.md` §Step 5's `cold_dispatch_allowed` predicate, `skills/harness-build/SKILL.md` §Step 6's entry gate, and `workflows/harness.eval.workflow.js`'s `A.coldPass === true` check. Absent both `--no-cold-pass` and `--fast`, `cold_pass` resolves from the same project-defaults line item 10 already resolved (`templates/_shared/project_defaults.md` §agent-harness-defaults — no second read): its `cold-pass=off` key sets `cli_flags.cold_pass = false` with `cold_pass_source = "default:<source>"`; any other value or an absent key leaves `cold_pass = true`. `cold_pass_source` is `null` whenever `cold_pass == true`.
3. **Slugify the task** → `<slug>` per `templates/_shared/slugify.md` (single source, shared with `/spec` because the two skills share `docs/harness/<slug>/`): non-ASCII is dropped, never transliterated; `/`, `.`, `_` and whitespace become hyphens; 50 chars; an all-non-ASCII task falls back to `task-<YYYYMMDD-HHMM>` with a printed line.
4. **Auto-detect project language and commands** by scanning the working directory.
5–6. **Resolve the lint and type-check commands**, first match wins per command: the `--lint-cmd` / `--type-check-cmd` flag; else the resolved project-defaults line's `lint-cmd` / `type-check-cmd` key (`templates/_shared/project_defaults.md` — the same line item 10 resolves; echo `(project default)` beside the Setup Summary row); else the detection table `templates/_shared/detection_table.md`; else `null`. A declared command is never second-guessed by detection — the 2026-09-18 live probe found that a repository whose lint lives only in its `CLAUDE.md` matches no detection row (`design/harness-prompt-diet/PROBE.md` finding 2).
7. **Determine `docs_path`:** `output_base = cli_flags.output_dir ?? "docs/harness"`; `docs_path = output_base + "/" + <slug> + "/"`. Create `.harness/`, `.harness/planner/`, `.harness/generator/`, `{docs_path}`, then **immediately** write the partial state.json crash-recovery checkpoint (`version`, `skill`, `task`, `cli_flags`, `user_lang`, `has_git`, `created_at`, `docs_path`, `slug`); the rest stays `null` until item 11.
8. **Create the git branch (if has_git):** `git checkout -b harness/<slug>`. **(P0-5) On failure** (the branch exists): never proceed on an unspecified branch. **Empty branch** (no commits beyond its creation point) → reuse it silently. **Non-empty branch** → never reuse silently; it would mix prior commits into this session's diff and contaminate Layer 2/3 judgment (`design/harness-prompt-diet/RATIONALE.md`). Either suffix `-2`, `-3`, … until `git checkout -b harness/<slug>-N` succeeds, or ask the §Branch question in `templates/harness/setup_prompts.md`. Record the ACTUAL name in `state.json.branch`.
9. **Mode Gate resolution:** apply §Mode Gate INCLUDING **§Ambiguity Prompt** (`templates/_shared/mode_gate.md`), which fires only with NO opt-in present: no `--mode`, no `--fast`, ultracode OFF, no project-default `path` (`agent-harness-defaults:` line), `Workflow` available, `has_git == true`, interactive, no `--no-prompt`. Modes single(inline) / standard(workflow) / multi(workflow); ultracode target multi. Store `mode` and `path_resolved`, then emit **§Path Transparency** — `Path : <inline | workflow>  (<reason>)`. If a workflow-tier `--mode` resolved to inline, notify (in `user_lang`): "<tier> mode requires the native Workflow engine and git — proceeding on the inline path."
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
10. **Model configuration**, first match wins: `--model-config` if given; else the resolved project-defaults line's `model-config=<preset>` (first source wins wholesale: settings.local.json env → project CLAUDE.md → user CLAUDE.md; `templates/_shared/project_defaults.md`), echoed `(project default)` beside the Model line; else `balanced` silently when `cli_flags.fast`, echoed `(fast default)`; else ask the §Model question in `templates/harness/setup_prompts.md`, which also defines the "Other" parse and its retry bound.
<!-- SYNC-WITH: templates/_shared/project_defaults.md §agent-harness-defaults -->
    Store `model_config: { preset, executor, advisor, evaluator, verifier }` (`default` preset stores `{ preset: "default", verifier }`).

10.5. **Verifier model:** `model_config.verifier = cli_flags.verifier_model ?? project_default.verifier_model ?? "haiku"` (the preset default is always `haiku`).

    **docs_path usage rule**: always read `docs_path` directly from state.json; never recompute it from `cli_flags.output_dir`, which is audit/record only. This does NOT generalize to every `cli_flags.*` field — `epic`, `cold_pass`, `fast` and `cold_pass_source` are written here and read elsewhere. The Safety Guard in Session Recovery uses `docs_path` directly too.

11. **Write `.harness/state.json`** from the v3 literal in `templates/harness/state_schema.md` — the single source for the field set and the additive-optional defaults (`plan_critic.*`, `converge.*`, `spec_stamp`, `scale.*`, `epic.*`, `verify.cold_*`, `cli_flags.epic` / `cold_pass` / `cold_pass_source` / `fast`, `gate.*`); `workflows/_reference/state_fields.md` maps each additive field to its writer and readers. Substitute this session's values, invent no field it does not list, and never make an additive field required.

12. **Print the setup summary** — block shape plus its two conditional warnings (a `sonnet`/`opus` verifier's cost line, and **(P1-3)**'s "no build/test/lint/type-check command detected" line, which warns and never halts): `templates/harness/setup_summary.md`. Render per §Print Translation Pattern, labels English raw.
13. **Proceed to Step 1.5.** If `run_style == "step"` and the CLI step is not `plan`, check prerequisites and jump to that step once Step 1.5 completes.

---

### Step 1.5: Convention Scan

*Runs after Setup and before Plan, in all modes and on both paths.*

**Persisted Spec Artifacts Check** — before the richness check, look for `{docs_path}conventions.md` (persisted by /spec Phase 3; `{docs_path}` comes from state.json — §Step 1 item 7):

| `state.conventions` | `.harness/conventions.md` | `{docs_path}conventions.md` | Action |
|---|---|---|---|
| `"file:.harness/..."` | exists | any | **(M2)** skip this check — the live file is authoritative on resume and must never be overwritten by a possibly-stale /spec copy. Go to the richness flow |
| `"file:.harness/..."` | missing | exists | copy it to `.harness/conventions.md`; go to Step 2 |
| `"file:.harness/..."` | missing | missing | `state.conventions = null` as one atomic write (an in-memory-only reset loops on the next resume); go to the richness flow |
| `null` or `"skipped"` | any | exists | copy it to `.harness/conventions.md`, set `conventions = "file:.harness/conventions.md"`; go to Step 2 |
| `null` or `"skipped"` | any | missing | go to the richness flow |

**CLAUDE.md Richness Check:** a root `CLAUDE.md` with ≥ 50 lines → **rich**; fewer → **sparse**; absent → **missing**.

**`conventions` field contract** — always one of `null` (Step 1.5 not yet executed), `"skipped"` (the user chose to skip), or `"file:<path>"` (e.g. `"file:.harness/conventions.md"`).

**Conventions injection rule (used by Step 2):** When `conventions` starts with `"file:"`, read the file at the path after the prefix. If the file does not exist, treat as `null` and re-run Step 1.5. When `conventions` is `null` or `"skipped"`, pass `{conventions}` / `args.conventions` as empty string. <!-- SYNC-WITH: skills/spec/SKILL.md §Step 1.5 conventions field contract -->

**If rich:** copy CLAUDE.md to `.harness/conventions.md`, store `conventions → "file:.harness/conventions.md"`, print `  [harness] Conventions: CLAUDE.md detected (rich). Copied to .harness/conventions.md`, go to Step 2.

**If sparse or missing:** with `cli_flags.fast`, set `conventions → "skipped"` without asking and print `  [harness] Conventions: skipped (--fast).` Otherwise ask the §Convention Scan question in `templates/harness/setup_prompts.md`.

**If "Skip":** `conventions → "skipped"`; print `  [harness] Conventions: skipped.`; go to Step 2.

**If "Scan":** read `{CLAUDE_PLUGIN_ROOT}/templates/planner/convention_scanner.md`; fill `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}`, `{output_path}` = `.harness/conventions.md`; **dispatch 1 sub-agent** (always inline on both paths; model `model_config.advisor` when preset ≠ "default", haiku for economy); expect `"conventions written"` on the first line; verify the file exists. If it does not, warn (in `user_lang`) "Convention scan completed but output file not found." and ask the §Convention Scan Failed question in `templates/harness/setup_prompts.md`. Then store `conventions → "file:.harness/conventions.md"`, print `  [harness] Conventions: scanned and saved to .harness/conventions.md`, update `updated_at`, proceed to Step 2.

---

### Step 2: Plan Phase

Update state.json: `phase → "plan_ready"`, `updated_at → now`. Print `[harness] Phase: Plan`

**Discovery Notes Injection — both paths:** before the plan dispatch/segment, read `qa_discovery_notes` (the content of `{docs_path}qa_notes.md`) and `critic_findings` (the content of `{docs_path}critic_findings.md`). Missing → `""` silently — a fresh run with no preceding /spec. **(s2)** Present but unreadable → warn (in `user_lang`) "Failed to read `{path}`: <error>. Discovery Notes will be empty for planner injection.", fall back to `""`, never abort. **(m4)** This applies ONLY to initial proposal inputs — the inline `planner_single.md` dispatch and the `harness.plan` segment `args`. Synthesis already receives proposals that incorporate it; never double-inject downstream.

**`spec_stamp` write protocol (single source — every site that writes `{docs_path}spec.md` cites it by name and none restates it: §Step 2 — INLINE path, §Step 2 — WORKFLOW path and its Auto-revise re-entry, §Gate re-entry flags' `--modify`, §Fast Gate's "Modify spec", `skills/harness-gate/SKILL.md` §Step 3's "Modify" option, and the converge loop's write events — a round apply and a decision apply, `templates/harness/converge.md` §Write Events):** three ordered steps, **invalidate first**.

1. Capture `prev = state.spec_stamp.generation` (`null` stamp → `0`), then write `spec_stamp → null` as a write of that field alone — never folded into a neighbouring `state.scale.*` write, since its whole purpose is to land BEFORE the file changes.
2. Write (or let the dispatched planner write) `{docs_path}spec.md`.
3. Write `spec_stamp → { "generation": prev + 1, "lines": <line count of the file as it now stands on disk> }`.

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

**Plan Critic routing predicate (single source — §Session Recovery's `planning`/`plan_done` row cites it by name):** evaluated in this order — **(a)** `{docs_path}spec.md` does NOT exist → Step 2 (nothing to critique yet); **(b)** spec.md exists AND `state.plan_critic` has no recorded `applied` → Step 2.6, here; **(c)** spec.md exists AND `applied` IS recorded (`"executed"`, `"skipped"` OR `"failed"` — any of the three) → the gate. The predicate is "a record exists", never "the record says success", and never bare file-existence (AC-6).

**Skip-vs-run decision** (separate from the routing predicate): on entry check whether `{docs_path}critic_findings.md` — the **/spec** requirements critique, NOT this step's own findings file — exists; a sanctioned read, §Architecture Principles #1.
- **Exists** → the task came from /spec with its own critique; do not duplicate it. Write `applied = "skipped"`, `source = "carried_over"`, `last_findings_path`/`failure_reason`/`counts`/`spec_stamp_at_critic` all `null` (no critic ran, so there is no spec version it judged), `round` UNCHANGED — a carried-over skip consumes no revision round. The gate (`skills/harness-gate/SKILL.md` §Step 3 Pass A row ③) parses counts from that file's `## Summary` line and shows the `carried over from /spec` literal.
- **Does not exist** → run this step's own critic as one converge run (below); `source = "own"`.

**Converge loop.** The own-critic dispatch is one *run* of the converge loop — `templates/harness/converge.md`, the single source for the run and round procedure, the round budget `R = 5`, the ledger and snapshot under `.harness/converge/`, the exit on the ledger (`converged` / `capped`, plus `failed`), the apply rule, write events, fingerprints and merging, the classification rubric, the once-per-session decision question, the residual, the `git status` comparison and the non-interactive rule. Read it before starting a run; never restate it here. Every citation of "§Step 2.6's own-critic dispatch" — routing predicate (b), `--critic`, `skills/harness-gate/SKILL.md` §Step 3's "Run Critic anyway" / "Retry Critic", the Auto-revise re-entry's same-turn re-critic — starts one run. The stamp check, the delete, the WORKFLOW and INLINE branches and the latch below describe the **round-1 critic** of a full-review run, reused unchanged except that it writes no `plan_critic` record of its own. The loop's own review and verify sub-agents are inline on both paths — no new segment — with the model roles of `templates/_shared/model_config.md` §Harness role map.

**Pre-dispatch stamp check (own-critic only):** if `state.spec_stamp` is `null` or malformed, neither delete nor dispatch — take failure branch (iii) with `failure_reason = "spec_stamp_invalid"`: the §Step 2 write protocol did not finish, so spec.md is a partial write nobody intends to keep.

**Pre-dispatch delete (own-critic only, both branches):** immediately before dispatching, delete `{docs_path}plan_critic_findings.md` if it exists — the path is fixed and reused every pass, so only this delete lets the latch below conclude anything from mere existence. If the delete fails (permission, lock), do NOT dispatch: failure branch (iii) with `failure_reason = "findings_file_stale"`. The crash window this opens, and the gate row it lands on, are recorded in `design/harness-prompt-diet/RATIONALE.md`.

**WORKFLOW branch** (`path_resolved == "workflow"`) — reuse `workflows/spec.eval.workflow.js` with ZERO changes to its args contract; the call is `templates/harness/plan_critic_dispatch.md`. It returns a schema-validated `CriticReport` (`counts` / `items` / `summary` — `workflows/_reference/schemas.md`). Print per OLC `  Critic: workflow (schema-validated) — {report.summary}`.

**INLINE branch** (`path_resolved == "inline"`) — dispatch `templates/spec/critic_inline.md` with `{spec_path}` = `{docs_path}spec.md` (a PATH, not content — see that template's header), `{critic_findings_path}` = `{docs_path}plan_critic_findings.md`, `{user_lang}`, `{task_description}`; model `model_config.advisor` when preset ≠ "default". Expect the leading keyword `critic_findings written` followed by `Critical=N, Major=M, Minor=K`. Print per OLC `  Critic: inline (1-line parse) — {first line}`.

**Latching `applied = "executed"`** (either branch): the round-1 critic's round continues only after confirming (a) `{docs_path}plan_critic_findings.md` exists — a schema-valid `CriticReport` can come back without the file ever being written, and existence carries weight only because of the delete above — AND (b) `state.spec_stamp` is non-`null`. Either failing → branch (iii). The latch itself writes nothing: `applied = "executed"` lands in the mapping at the run's end, after `templates/harness/converge.md` §Mapping has re-rendered that same file as the residual report.

**Single read-modify-write — the mapping** — `plan_critic` (all 7 fields: `applied`, `round`, `last_findings_path`, `failure_reason`, `source`, `counts`, `spec_stamp_at_critic`) + `phase` (+ `converge.status` / `converge.rounds` after a run) are written together, once per Step 2.6 entry (carried-over, fast, run end and each failure branch alike). After a run it is the turn's last spec-related write — a decision question, its apply and the run that follows all come first (`templates/harness/converge.md` §Ending a run):
- **Run end (`converged` / `capped`):** `applied = "executed"`, `source = "own"`, `last_findings_path = "{docs_path}plan_critic_findings.md"`, `counts` = the residual counts (`templates/harness/converge.md` §Residual — open decisions plus unapplied autos, all severities; never a critic's self-reported count), `failure_reason = null`, `spec_stamp_at_critic` = the current `state.spec_stamp` copied by value, `round = 1`. `round` is unset (`null`, read as 0) until a session's first run-end mapping, which writes `1` — **the one place `round` is written**, bounded at 1 because Pass A's Auto-revise option disappears at `round == 1`. Writing it records the Auto-revise opportunity as spent, so the gate never offers a re-synthesis after a run (`skills/harness-gate/SKILL.md` §Step 3's Auto-revise Exposure Predicate, point 3); a hand-typed `/harness --auto-revise` checks only that predicate's point 2 (`templates/harness/auto_revise.md`) and is not stopped by it. The re-critic that ends an Auto-revise re-entry is itself a run and writes the same `1`.
- The gate null-guards `counts` / `last_findings_path` / file-not-found independently — never dereferences without checking.

**Failure handling — 3-way** (the "own" dispatch only; the carried-over and fast branches never reach this). Which loop cause lands on which branch: `templates/harness/converge.md` §Ending a run.
- **(i) Workflow engine error** of the round-1 WORKFLOW critic (launch failure, script error, schema-invalid result) → §Mode Gate graceful fallback (re-attempt the round-1 critic inline, as Step 2 does). Not a failure of the run; this branch writes nothing itself.
- **(ii) Permission denial of the round-1 WORKFLOW `spec.eval` call** (NOT an engine error; a refused loop review or verify dispatch is branch (iii)) → `templates/_shared/mode_gate.md` rule 3's denial branch: banner `[harness] ⚠ Workflow denied (not an engine error) — path NOT auto-downgraded.`, `path_resolved` NOT rewritten (set once at §Step 1 item 9), `plan_critic.applied` NOT recorded this pass — the run ends with `converge.status = "failed"` written alone. It does not halt — control proceeds to §After Plan Phase, and what the user types next decides the rest: `/harness` re-enters through routing predicate (b) and lands back here, while `/harness-gate` renders Pass A row ④ unrecorded, whose "Proceed as-is" leaves it permanently so — a gap that row's banner discloses.
- **(iii) Parse failure / latch failure / pre-dispatch failure, and every other failure of a run** → `applied = "failed"` with one of eight `failure_reason` strings — the round-1 critic's four (`parse_failed` / `findings_file_missing` / `spec_stamp_invalid` / `findings_file_stale`) and the loop's four (`loop_dispatch_failed` / `loop_parse_failed` / `loop_output_missing` / `loop_tree_dirty`; a failed write event lands on `spec_stamp_invalid`) — `last_findings_path = null`, `source = "own"`, `counts = null`, `spec_stamp_at_critic = null`, `round` UNCHANGED. Which string, what each means and why the stamp is nulled rather than left: `templates/harness/plan_critic_failures.md`. Banner `[harness] ⚠ Plan Critic failed — fallback: skipped, spec unreviewed`. **Progress is NOT blocked** — proceed to §After Plan Phase.

**Two recorded limits** (`design/harness-prompt-diet/RATIONALE.md`): a turn whose converge runs were interrupted, with an earlier record behind them, resumes at the gate on the row that record selects for spec.md as it now stands — Pass A row ④ only when a full-review run was interrupted between its round-1 delete and the round-1 critic's write (the record points at a file that is gone); otherwise the findings file exists again (holding the raw round-1 critique, not a residual report), so the record is well-formed and lands on row ①-b / ②-b once a write event of the turn moved or invalidated the stamp (a round, decision or `--modify` apply), or on its own not-stale row when nothing was written. "Retry Critic" / "Run Critic anyway" there starts a new full-review run — not an idempotent re-dispatch, since rounds the interrupted run applied stay in spec.md until a later run reviews them; and Step 2.6's own WORKFLOW run id is never persisted, because `state.runs` has exactly `{plan, build, eval}` and `runs.eval` belongs to `skills/harness-build/SKILL.md` §Step 5.

#### After Plan Phase

Print: `[harness] Plan complete.`

When this turn ended a converge run (§Step 2.6, `--critic`, `--modify`) — in any session, a `cli_flags.fast` one included — print its summary next: `templates/harness/converge.md` §Summary Block, banners and any open decisions included.

**Normal session — every `run_style`** (auto / phase / step) ends here; the gate is `/harness-gate`, a separate skill, so the stop is structural rather than a rule (SPEC rev.9 (b)). Print the §Scale Assessment block from the values frozen at the end of Step 2, then the §Session Boundary block (Type A: After Plan, Resume `/harness-gate`), then `Next → /harness-gate`. Halt. If this session carries `cli_flags.epic` or an epic recommendation, the gate's Pass B leads with "Plan as epic" and prints `/harness-build --epic`, whose `skills/harness-build/SKILL.md` §Step 3.5 fills its table with no in-context `PlanResult` (see its degraded restore order, by name).

**`cli_flags.fast` session:** skip the §Scale Assessment render — the values stay frozen for any later `/harness-gate` visit — and continue to §Fast Gate.

### Fast Gate (`--fast` in-session approval)

The one sanctioned way to cross Plan → Generate in a single session: for small, well-understood changes it trades the tool-less turn `/harness-gate` guarantees for one uninterrupted run, and the trade is explicit because the user typed `--fast`. Preconditions — `cli_flags.fast == true`, `phase == "plan_done"`, `{docs_path}spec.md` exists; otherwise take the normal `Next → /harness-gate` ending above.

Ask via AskUserQuestion (in `user_lang`; text fallback per `templates/_shared/askuserquestion.md`):
- header: "Fast Gate"
- question: "[harness] Plan complete (--fast). Spec: `{docs_path}spec.md` ({n} completion criteria — the `- [ ]` count the INLINE Fallback defines). Plan Critic and cold review are skipped here. Build now?"
- options:
  - "Build now" / "Approve the spec and continue in this session: Generate → Verify (Layer 1) → Evaluate (Layer 2/3) → Cleanup"
  - "Modify spec" / "Describe the change; spec.md is rewritten and this question re-renders"
  - "Stop" / "Keep the session at plan_done and halt (later: /harness re-renders this gate; /harness-gate is also valid)"

Actions:
- **Build now** → one state.json write: `gate.approved = true`, `gate.approved_at = now`, `gate.mode = "fast"`, `updated_at = now`. Print `[harness] Fast Gate approved — chaining into /harness-build.` Then invoke the `harness-build` skill via the Skill tool **in this same turn**, with no arguments — the same chaining `skills/handoff/SKILL.md` performs on "Start next step". Its §Entry `plan_done` route performs the `generate_ready` write and runs Steps 4 → 8 with this session's `cli_flags`; `fast` implies `cold_pass == false`, so `skills/harness-build/SKILL.md` §Step 5's gating table skips the cold pass, while HARD GATEs #2 and #3 still render there. If the Skill tool is unavailable or the invocation is refused, print `Next → /harness-build` and halt — the approval flag persists, so the next message continues.
- **Modify spec** → take the request from the "Other" free text, or ask one follow-up (header "Modify", question "What should change in the spec?"), apply it to `{docs_path}spec.md` orchestrator-inline under §Step 2's `spec_stamp` write protocol — `--modify`'s action exactly — then re-render this gate. No round bound; each loop is one user action.
- **Stop** → write nothing; print the §Session Boundary block (Type A) with Resume `/harness`, and halt.

**Guard on the other side:** `skills/harness-build/SKILL.md` §Entry refuses the `plan_done` route of a `cli_flags.fast` session whose `gate.approved != true`. That flag, written only by "Build now", is the only thing that admits a fast session to Generate. A non-fast session is unchanged — the human typing `/harness-build` after `/harness-gate` remains its proof (SPEC decision A). `/harness-gate` never writes `gate.*` (it holds no write tool); a fast session that visits it anyway sees Pass A row ③ carrying the `skipped by --fast` literal, and must still answer this gate via `/harness`.

**Resume:** a fast session resumed at `plan_done` re-renders this gate rather than printing `Next → /harness-gate`. If `gate.approved == true` while `phase` is still `plan_done` — the chain was interrupted before `/harness-build`'s write — print `[harness] Fast Gate already approved — run /harness-build` and halt.

---

## Sub-command: doctor

`/harness doctor` — read-only environment diagnostic, reached only through the carve-out at the top of §Session Recovery. No arguments; it neither reads nor writes `.harness/state.json`, creates no branch, resolves no Mode Gate, dispatches nothing, prints no §Session Boundary block, and writes nothing anywhere — not `.harness/`, not `docs/`, not `.gitignore`, not either installed plugin copy. Every path it probes is a fixed constant or resolved at run time from `${CLAUDE_PLUGIN_ROOT}` and `git rev-parse --show-toplevel`.

**Procedure:** read `{CLAUDE_PLUGIN_ROOT}/templates/harness/doctor.md` and follow it verbatim — the two known install locations, the six items (① installed-copy CR contamination, ② Workflow tool availability, ③ git work tree, ④ version and content drift, ⑤ team-memory store ignore state, ⑥ project defaults), each item's `✓` / `⚠` / `—` contract and remediation, and the output block. Render per `templates/_shared/status_format.md` with the prefix `[harness doctor]`. A green ① or ④ says the copies on disk are current, not that this process loaded its skill body from them.

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
6. **Gates never enter segment scripts** — the 3 HARD-GATEs render in the orchestrator skills, and `scripts/verify_meta_literal.py` rejects gate-marker tokens inside any segment script. §Fast Gate is an orchestrator-side AskUserQuestion, not a fourth HARD-GATE; the count stays 3.

<!-- BLOCK-START:hx-path-validator v2 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
### Path Validator

`validate_path(path, kind)` with `kind ∈ {output_dir, file_reference, diff_target}` — the five normalization and rejection steps, the reserved first-segment set, the `docs/harness/` carve-out, every halt message and the attack-vector mapping are `templates/_shared/path_validator.md`. Read it before validating a path; never restate it.

Call sites: `--output-dir` parsing (`skills/harness/SKILL.md` §Step 1 item 2, `kind=output_dir`); the Session Recovery Safety Guard re-validation (`kind=output_dir`); `{failing_files_list}` injection, the Edit-tool unified-diff Apply, cold-review input collection and cold `finding.file` validation — WORKFLOW path only (`skills/harness-build/SKILL.md` §Step 5, `kind=file_reference` / `diff_target`).
<!-- BLOCK-END:hx-path-validator v2 -->

## Key Rules

- **Never skip phases.** Plan → Generate → Verify → Evaluate; the `plan_done → completed` epic exit (§State Transition Diagram) is the one by-design exception.
- **Confirmation gates are non-negotiable.** No implicit approval; gates live ONLY in the orchestrator skills, never in a segment script. `--fast` moves HARD GATE #1 into §Fast Gate; it does not remove it.
- **Stay within scope.** Never modify a file outside it.
- **Evaluator must be isolated.** Anchor-free input, never Generator reasoning.
- **Planner proposals must be independent.** Never share one persona's work with another during proposal; the plan segment's `parallel()` enforces this.
- **Generator advisors review the plan, not code.** Advisory before implementation.
- **Use available skills.** Search by keyword, not plugin name; proceed without if none is found.
- **User language.** All user-facing output in `user_lang` per §Output Language Contract; Glossary tokens and parser keywords stay English raw.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — an explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **Intermediate outputs are ephemeral.** Only final artifacts persist in `docs/`, and the orchestrator reads none of them beyond §Architecture Principles #1's list.
- **Workflow args are a JSON object;** segment scripts parse defensively (`args` may arrive as a JSON string). Never put user-gate decisions into args.
- **Graceful engine fallback.** Any Workflow failure degrades to the inline single path with a notice, never a hard error.
