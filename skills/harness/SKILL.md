---
name: harness
disallowed-tools: NotebookEdit
description: Entry point of the 3-Phase harness (Plan -> Gate -> Generate -> Verify -> Evaluate) with a read-only `doctor` diagnostic. Runs Setup, Convention Scan, Plan and Plan Critic, writes spec.md, then halts at plan_done and hands off to /harness-gate — the spec-confirmation gate lives in that separate, tool-less skill, and /harness-build implements. Plugin-shipped native Workflow segment scripts on the workflow path (ultracode or --mode opt-in) with schema-validated returns; inline single path otherwise. Use for development AND non-development tasks that benefit from structured planning and 3-layer review. (formerly /workflow)
---

# Agent Harness — /harness Orchestrator (v3, plan half)

You are a **state-machine orchestrator** — the ENTRY POINT of a pipeline split across three
skills that share one `state.json` phase machine:

| Skill | Owns | Tools it does NOT have |
|---|---|---|
| `/harness` (this file) | Step 1 → 1.5 → 2 → 2.6, `spec.md`, the Plan Critic, `doctor` | `NotebookEdit` |
| `/harness-gate` | Step 3 — HARD GATE #1 (spec confirmation) only | `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`, `Workflow` — it can change nothing |
| `/harness-build` | Step 3.5 → 3.6 → 4 → 5 → 6 → 7 → 8 | `NotebookEdit` |

**Every session of this skill ends at `plan_done`** and prints `Next → /harness-gate`. The gate
is a separate user message by construction: the turn that renders it holds no write tool, so
nothing can be implemented before the human confirms the spec (SPEC §1 —
`design/harness-ordering-enforcement/SPEC.md`). `/harness-gate` and `/harness-build` cannot be
prevented from being invoked directly; each detects a missing prerequisite and says so.

Your role is:
1. Manage phase transitions via `state.json` up to `plan_done`
2. Resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped native Workflow segment scripts)
3. On the WORKFLOW path: invoke `Workflow {scriptPath}` and receive **schema-validated objects** — no text parsing
4. On the INLINE path: dispatch sub-agents with minimal context and parse 1-line returns (legacy contract, inline only)
5. Halt at `plan_done` with the next command — HARD GATE #1 is rendered by `/harness-gate`, never here, never inside a segment script

**You do NOT**: read intermediate artifacts (proposals, critiques, plans, reviews), accumulate sub-agent output in context, or make quality judgments about code — the exceptions (including `.harness/planner/proposals.json`'s write and Auto-revise re-entry read) are enumerated exhaustively, and ONLY, in §Architecture Principles #1; this line does not restate them. Sub-agents and segment scripts handle all domain work; you handle transitions and writing `spec.md` from returned objects.

<!-- BLOCK-START:hx-preamble-a v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## Sub-agent Return Value Rules (INLINE path only)

When an inline-dispatched sub-agent returns:
1. Read only the **first line** (up to first newline) for state decisions
2. Extract keywords: `"FAIL"`, `"PASS"`, `"generated"`, `"changed"`, `"written"`
3. Use the first line as the progress message — translate the non-keyword portion to `user_lang` per §Output Language Contract — 1-line Return Translation. Glossary keywords (`PASS`/`FAIL`/`Verdict`/`[harness]`/etc.) MUST remain English raw.
4. **Ignore all remaining text** — do not analyze, reference, or include it in subsequent prompts

**1-line return parse failure**: If the return value does not match the expected format (`<keyword> — <summary>`), treat as `confidence: Unknown` and print `[harness] ⚠ 1-line return parse failed — fallback: confidence Unknown`. For Auto-fix Proposer specifically, the expected fallback format is: `auto_fix_patch written — confidence: Unknown — <reason>`.

**WORKFLOW path returns are schema-validated objects** (PlanResult / ChangeSet / VerifyVerdict — see `workflows/_reference/schemas.md`). Branch on object fields directly; none of the parsing rules above apply. If a Workflow run errors or returns an unusable result, apply §Mode Gate graceful fallback (inline path), never halt with an engine error.

## Version & Compatibility

This is **state.json v3** (version `"3.0"`, `skill: "harness"`). When loading an existing state.json:
- If `version` is `"3.0"` **and `skill` is `"harness"`** → run the v3 logic defined in this file. (A `"3.0"` file whose `skill` is another skill's value OR absent is routed by §Session Recovery item 1's branch table to the Session Conflict gate instead — rows 1 and 2. A v3 file is defined as carrying BOTH fields, so a `"3.0"` file missing `skill` is not one.)
- If `version` is missing or `"2.0"` — reached when `skill` is absent, and also when `skill` is `"harness"`, which §Session Recovery item 1's branch table row 4 admits by construction even though an ordinary /harness write never pairs `skill: "harness"` with a non-`"3.0"` `version`; a file carrying ANOTHER skill's `skill` value is routed by that table instead, whatever its `version` — → **do NOT migrate silently.** See §Session Recovery step 2 — Restart is recommended; legacy resume is not supported by /harness.
- **Additive fields within `"3.0"` do not bump `version`**: readers MUST ignore any state.json field they do not recognize and MUST treat any missing field as its documented default (see the new-field table under Step 1 item 11); writers MUST NOT make a field added within `"3.0"` `required` — doing so would leave in-flight `"3.0"` sessions written before that field existed unreadable.

## Zero-Setup Environment Detection

At startup, detect whether the current directory is inside a git repository:
```
git rev-parse --is-inside-work-tree 2>/dev/null
```
- If succeeds → `has_git = true`
- If fails → `has_git = false`
<!-- BLOCK-END:hx-preamble-a v1 -->

<!-- BLOCK-START:hx-user-lang v1 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json.

**All user-facing communication** in `user_lang`: progress updates, questions, confirmations, errors, spec sections, QA narrative, commit messages (if has_git).

**Stays in English:** template instructions, state.json field names, file names, git branch names, Workflow `args` field names.

**Re-detection:** On every user message, check if language changed. If so, update `user_lang`.

**WORKFLOW path:** pass `userLang` in `args` — the segment scripts build schema descriptions from it (`render in <userLang>`), which forces sub-agent free-text output language; enum/identifier fields stay English raw.
<!-- BLOCK-END:hx-user-lang v1 -->

<!-- BLOCK-START:hx-olc-core v1 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
## Output Language Contract

> ⚠ Maintainers: any new `Print:` directive or user-facing output block added below MUST conform to this contract. CI lint enforcement is a TODO (not yet implemented).
> This contract applies to v3 sessions.

### Invariant

All orchestrator output visible to the user MUST be rendered in `user_lang`. Backtick-inline English inside `Print:` directives is a *template format*, not an output language declaration. When `user_lang == "en"`, this contract is a natural no-op (English → English is identity).

### Preserved-English Glossary

The following tokens MUST remain English raw in all output. Translation is forbidden.

| Category | Tokens |
|---|---|
| Status keywords | `PASS`, `FAIL`, `FAIL_L2`, `FAIL_L3`, `Verdict`, `Verdict: PASS`, `Verdict: FAIL` |
| Confidence | `confidence: High`, `confidence: Medium`, `confidence: Low`, `confidence: Unknown` |
| 1-line return verbs (INLINE path only) | `generated`, `changed`, `written`, `conventions written`, `auto_fix_patch written` (only as leading keyword tokens in inline sub-agent 1-line returns; natural-language usage in prose is exempt) |
| Prefix | `[harness]` |
| Status format labels | `Task`, `Mode`, `Path`, `Model`, `Style`, `Phase`, `Round`, `Branch`, `Scope`, `Directory`, `Verifier`, `Language`, `Test`, `Build`, `Lint`, `TypeCheck`, `Output`, `Decision`, `Critic`, `Next cmd` (rendered by `/handoff` — this skill has no `Next cmd` output site of its own) (monospace alignment preservation) |
| Session Boundary Type B `Reason` value | `Epic planned` (a *value*, not a label — see `skills/harness-build/SKILL.md` §Session Boundary Type B) |
| Identifiers | state.json field names (e.g. `verify.layer1_retries`, `runs.plan.runId`), file paths (`{docs_path}verify_report.md`, `.harness/...`), git branch names (`harness/<slug>`), commands (e.g. `./gradlew test`, `npm run lint`), state-machine phase keys (`plan_ready`, `generating`, ...), schema field names (`acceptanceCriteria`, `modifiedFiles`, ...) |

> `Decision`, `Critic`, `Next cmd`, and `Epic planned` are new to this Glossary. The existing `Reason` values (`QA PASS` / `Accept as-is` / `Max rounds reached`) are unchanged and are NOT added here — adding them would newly fix values that are currently translated, changing existing sessions' output. `Decision` (`skills/harness/SKILL.md` §Scale Assessment §3 override display), `Critic` (`skills/harness/SKILL.md` §Step 2.6 gate display), and `Epic planned` (`skills/harness-build/SKILL.md` §Session Boundary Type B epic variant — `skills/harness-build/SKILL.md` §Step 3.6) are now written by this file (this slice). `Next cmd` (rendered by `/handoff` resume Step 5 — see `skills/handoff/SKILL.md` §Sub-command: resume — not this file) is now written there (harness-handoff-coldreview-epic-slice slice-f); this skill still has no `Next cmd` output site of its own — that ownership is unchanged, only the "not yet written" status above was stale.

### Print Translation Pattern

When rendering a `Print:` directive:
- Translate natural-language portions to `user_lang`.
- Glossary tokens above remain English raw.
- Variable substitutions (`{first line}`, `{layer1_retries}`, `{docs_path}...` etc.) follow §1-line Return Translation or §Glossary rules above.
- AskUserQuestion option label/description also follows this rule.
- Note: `(in user_lang)` markers on AskUserQuestion sites refer to UI prompt translation and are a separate context from the label-preservation rule for Status Format / Setup Summary labels.
- Note: When this contract refers to `Print` directives, the token MUST be wrapped in backtick inline code spans to avoid visual collision with column-0 `Print:` directives in the body.
<!-- BLOCK-END:hx-olc-core v1 -->

<!-- BLOCK-START:hx-olc-inline-returns v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
### 1-line Return Translation (INLINE path only)

Inline sub-agent 1-line return (`<keyword> — <summary>`) processing:

- **Parse phase (English raw):** Extract Glossary keywords from the first line for state-machine transitions. String matching uses English raw only.
- **Display phase (force user_lang):** The non-keyword free-text summary portion is force-converted to `user_lang` at display time. If the input is already `user_lang`, the result is identical (idempotent — no language-detection heuristic required). Partial-English or mixed-language text follows the same rule for consistency and predictability.
- **Format:** `<keyword> — <summary>`. Split on first ` — ` (space-em-dash-space). On split failure, apply fallback per §Sub-agent Return Value Rules: treat as `confidence: Unknown`.
- **WORKFLOW path equivalent:** display the object's `summary` field (already rendered in `user_lang` by the schema description) — no parsing, no translation pass.

**Shorthand:** "Print per OLC" = render this directive per the Print Translation Pattern (Glossary tokens stay English raw).
<!-- BLOCK-END:hx-olc-inline-returns v1 -->

<!-- BLOCK-START:hx-preamble-b v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /harness-specific resolution (the mode-selection roundtrip is removed EXCEPT §Ambiguity Prompt, which fires only when opt-in is absent):

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | single | **inline** (engine isolation requires git) |
| `--mode single` or `--mode quick` | single | **inline** |
| `Workflow` tool NOT available this session | single | **inline** (notify only if an explicit `--mode standard/multi` was requested) |
| `--mode standard` | standard | **workflow** |
| `--mode multi` (or `comprehensive`/`thorough`/`deep`) | multi | **workflow** |
| no `--mode` AND session is in ultracode mode | multi | **workflow** |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=workflow` | multi | **workflow** (standing opt-in — §Ambiguity Prompt step 4.5) |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=inline` | single | **inline** |
| no `--mode`, no opt-in | single | **inline** (interactive + engine available → asks first, §Ambiguity Prompt) |

- **Opt-in signals** (any one suffices, per mode_gate.md): ultracode mode is on for the session; the user passed an explicit `--mode standard/multi` (or a deeper alias: `comprehensive`/`thorough`/`deep`); or these skill instructions direct the Workflow call (valid documented opt-in — but /harness only exercises it when one of the first two holds).
- **Graceful fallback:** if a `Workflow` invocation errors at any step (launch failure, script error, schema-invalid result), print `[harness] ⚠ Workflow engine unavailable — falling back to the inline single path.` (in `user_lang`), set `path_resolved → "inline"`, `mode → "single"`, and continue the CURRENT step on the inline path. Never error out. **A permission denial is NOT one of those errors** — route it to the denial branch of `templates/_shared/mode_gate.md` rule 3 (single source: disclose it, never downgrade silently). The /harness banner for that branch is `[harness] ⚠ Workflow denied (not an engine error) — path NOT auto-downgraded.`
- Record `path_resolved` in state.json and show `Path` in the Setup Summary.
- INLINE = the preserved single-agent flow (planner_single → generator_single → verify_layer1 → evaluator). Standard/multi fan-out exists ONLY on the workflow path — the engine replaces the old hand-rolled parallel-dispatch prose.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`.

Mode enum: `<single | standard | multi>`. Additional row: `Path : <inline | workflow>  (<reason>)`.

Phase labels:
- `plan_ready` → "Plan — ready"
- `planning` → "Plan — in progress"
- `plan_done` → "Plan — complete"
- `generate_ready` → "Generate — ready"
- `generating` → "Generate — in progress"
- `generate_done` → "Generate — complete"
- `verify_ready` → "Verify — ready"
- `verifying` → "Verify — running checks"
- `verify_done` → "Verify — complete"
- `evaluate_ready` → "Evaluate — ready"
- `evaluating` → "Evaluate — in progress"
- `evaluate_done` → "Evaluate — complete"
- `completed` → "Completed"
<!-- BLOCK-END:hx-preamble-b v1 -->

## Session Recovery (state.json v3 phase machine)

**doctor carve-out — evaluate this FIRST, before item 1 below, notwithstanding item 1's own "BEFORE anything else in this section" sentence.**
If this invocation's positional arguments are exactly the single token `doctor`, **SKIP this
entire section and jump straight to `## Sub-command: doctor`. Do NOT read `.harness/state.json`,
do NOT fall through to Step 1, and do NOT resolve an execution path** — a read-only diagnostic
must neither resume nor disturb an in-progress session.

**Positional arguments** = the argument list after removing (a) every token that begins with
`--`, and (b) the single token that follows each VALUE-TAKING flag: `--mode`, `--model-config`,
`--verifier-model`, `--lint-cmd`, `--type-check-cmd`, `--output-dir`, `--modify`. The boolean
flags `--epic`, `--no-epic`, `--no-cold-pass`, `--no-prompt`, `--auto-revise` and `--critic`
take no value and consume nothing.
A boolean flag added later needs no edit here; **a VALUE-TAKING flag added later MUST be added
to the list above** — otherwise it would swallow `doctor` as its value and the carve-out would
misfire.

So `/harness --mode single doctor` is the same invocation as `/harness doctor`. A quoted task
that merely CONTAINS the word (`/harness "fix the doctor bug"`) is one positional token that is
not `doctor`, so it is unaffected.

<!-- BLOCK-START:hx-session-entry v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
Cross-session continuity uses the `state.json` phase machine below. Workflow `runId`s are recorded in `state.runs` for audit, and `resumeFromRunId` is **same-session only** — never attempt it across sessions; re-run the segment instead.

Before starting a new task, check if `.harness/state.json` exists:

1. **Read state.json and route on `skill` and `version` together BEFORE anything else in this
   section.** The table below is the execution order, not background reference: find the row that
   matches, then carry out that row's route — the gate paragraph below it, or item 2 — and do NOT
   continue to Step 1 before doing so. Four rows, three distinct routes; the third route is what
   keeps pre-harness sessions recoverable.
   <!-- SYNC-WITH: templates/_shared/session_conflict.md §Gate Procedure -->

   | `skill` | `version` | route |
   |---|---|---|
   | present, `!= "harness"` | any | **Session Conflict gate** (below) |
   | absent | `"3.0"` | **Session Conflict gate** (below) — a v3 file is defined as `version "3.0"` AND `skill: "harness"` (§Version & Compatibility), so a v3.0 file with no `skill` is not a well-formed /harness session |
   | absent | missing or non-`"3.0"` | **item 2's legacy branch** — do NOT gate. This population is identified BY the absent `skill`; gating it would make item 2 unreachable and turn its pre-harness detection message into a dead letter |
   | `"harness"` | any | **no gate** — continue to item 2 |

   **Worked example — the normal case is row 4, not rows 1-2.** Every state.json `/harness` writes
   carries `skill: "harness"` from its first write (`skills/harness/SKILL.md` §Step 1 item 7), so an ordinary resume matches
   row 4 ONLY: rows 1 and 2 both require `skill` to be something other than `"harness"` (a
   different value, or absent). Do not stop scanning at the first two rows and gate a normal
   resume.

   **Session Conflict gate** — fires on the first two rows only. Do NOT fall through to this skill's §Fresh Start,
   which would overwrite the other session ungated. Ask via AskUserQuestion (in `user_lang`):
     header: "Session Conflict"
     question: "A `/{skill|'unknown'}` session exists in this directory (task: `{task}`, phase: `{phase}`, docs: `{docs_path}`). Starting a new session here will delete it. Delete it and start?"
     options:
       - label: "Delete and start" / description: "Delete .harness/ and proceed with this skill's §Fresh Start"
       - label: "Cancel" / description: "Keep existing session and halt"

   If "Cancel" → **halt before any directory creation, `git checkout -b`, or state.json write**;
   nothing under `.harness/` is changed. If "Delete and start" → delete `.harness/`, then proceed
   to this skill's §Fresh Start (defined once per skill — for /harness it is Step 1). A session that **cannot present an interactive prompt** (headless / cron /
   sub-agent) → **halt**, never a silent overwrite. Never emit a `{...}` token verbatim —
   substitute from the conflicting session's own state.json before rendering.
   Full procedure and the rule this gate instantiates:
   `templates/_shared/session_conflict.md` §Gate Procedure, cited by name and not restated here.

2. Check `version` field:
   - **Missing or `"2.0"` (or any non-`"3.0"`)** → pre-harness `/workflow` session. Print per OLC: `[harness] Pre-harness session detected (v{version|1}) — created by /workflow. Restart recommended; legacy resume is not supported.` Ask via AskUserQuestion (in `user_lang`): header "Session", question "Pre-harness session found. Restart fresh or stop?", options: "Restart" / "Delete .harness/ and start fresh", "Stop" / "Keep files and halt". No Resume option for legacy sessions (no silent migration).
   - **`"3.0"`** → v3 session. Continue below.

3. Print status in standard format, prefixed with `[harness] Previous session detected.`
4. Restore `model_config` from state.json. Apply to all subsequent sub-agent launches and Workflow `args.models`.
5. Restore `conventions` from state.json. If value starts with `"file:"`, verify the referenced file exists. If file missing, set `conventions → null` (will trigger Step 1.5 on resume).
6. If `has_git` is not in state.json, re-detect and store. Re-resolve §Mode Gate (the new session may lack the Workflow tool or the opt-in) and update `path_resolved` — a session that started on the workflow path may legitimately resume on the inline path. On resume, do NOT re-fire §Ambiguity Prompt — reuse the stored `mode` + `path_resolved`; only the workflow→inline downgrade (engine now absent) may change `path_resolved`. The stored `mode` already preserves the chosen tier (single/standard/multi).
<!-- BLOCK-END:hx-session-entry v1 -->

6.5. **docs_path drift check** (feeds the resume-suppression check in item 7; does not act by
     itself): if THIS invocation supplies **both** `--output-dir` and a task string, recompute
     a candidate `docs_path` from those two arguments only — never the stored
     `cli_flags.output_dir` — via §Step 1 item 2's normalization (by name) on `--output-dir`
     and item 3's slugify rule (by name) on the task, reassembled per item 7's `docs_path`
     formula (by name), then compare against the stored `docs_path`. Missing either argument →
     **skip entirely** (an incomplete pair risks a false mismatch more than it protects). A
     malformed recomputation is "comparison not possible", never a mismatch, never a halt.
     **Not a contradiction of "do NOT recompute"**: this uses only THIS invocation's own
     arguments, never the stored field — its audit/record-only status (item 10.5, by name) is
     unchanged, and no result here is ever assigned back into state.json.

<!-- BLOCK-START:hx-session-gate-a v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
7. **Resume-suppression check** (priority order, evaluated before any question in this item
   renders):
   - **(a) Epic residue** — `state.epic.boundaries != null AND state.phase == "completed"`: do
     not render "Resume". `completed` is not epic-exit-only — `skills/harness-build/SKILL.md` §Step 7 "If PASS" (and its
     Accept-as-is / Max-rounds-reached siblings) already writes it before Step 8 starts, and
     `skills/harness-build/SKILL.md` §Step 8 "Commit code only" step 3's commit-failure path guarantees resumability from that
     exact state, so this check stays narrowed to the epic case. Print one disclosure line (in
     `user_lang`), then ask via AskUserQuestion with the same header as below, question:
     "[harness] Epic session residue detected. Restart or stop?", options
     `{"Restart" / "Delete .harness/ and start fresh", "Stop" / "Delete .harness/ and halt"}`
     (same labels/actions as below, minus "Resume" and minus "View state only" — this branch
     is unchanged by the new option below; see that option's own scope note). This makes
     `skills/harness-build/SKILL.md` §Step 3.6's
     `phase → "completed"`-before-delete ordering an actual 3rd defense layer — a failed delete
     there leaves exactly this state, which is what this check detects.
<!-- BLOCK-END:hx-session-gate-a v1 -->

   - **(b) docs_path drift** — checked only if (a) did not fire (an epic-exit remnant already
     explains the stale `.harness/`, so the drift framing would be redundant there) — item 6.5
     found a mismatch: do not render "Resume". Ask via AskUserQuestion (in `user_lang`):
     - header: "Session"
     - question: "[harness] docs_path drift detected. Keep the existing session, or restart?"
     - options:
       - "Keep & stop (Recommended)" / "Keep the existing session and halt — `.harness/` is NOT deleted (unlike the usual Stop)"
       - "Restart" / "⚠ Delete `.harness/` and start fresh — the existing session cannot be recovered"
     `Stop` is not a label here. "Keep & stop" halts without deleting `.harness/`; "Restart" acts
     like the "Restart" branch below.
<!-- BLOCK-START:hx-session-gate-b v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
   - Otherwise, ask the user via AskUserQuestion (in `user_lang`) — the first three options are
     unchanged, "View state only" is new (see its Actions entry below for scope):
     - header: "Session"
     - question: "[harness] Previous session detected. [standard status]. Resume, restart, stop, or view state only?"
     - options:
       - "Resume" / "Continue from {phase}"
       - "Restart" / "Delete .harness/ and start fresh"
       - "Stop" / "Delete .harness/ and halt"
       - "View state only" / "Print the recorded session state and halt — `.harness/` is NOT deleted (unlike the usual Stop). Calling `/harness` again re-renders this gate."

   Actions:
   - **Resume**: Before jumping to any step, run Safety Guard re-validation:
     - Read `docs_path` directly from state.json. **Do NOT recompute from `cli_flags.output_dir`** — `cli_flags.output_dir` is for audit/record only (this does NOT generalize to every `cli_flags.*` field — see the Step 1 item 10.5 docs_path usage rule).
     - Run `validate_path(docs_path, kind=output_dir)`: slug validation + relative path + reserved name check.
     - If validation fails: print `[harness] ⚠ Recovered docs_path failed validation: <path>` and treat as Restart.

     Then jump to the state matching `phase` (segments are re-RUN, not runId-resumed, across sessions):
<!-- BLOCK-END:hx-session-gate-b v1 -->

     - `plan_ready` → Step 1.5 (Convention Scan) if `conventions` is `null` (not yet executed), else Step 2 (Plan). Note: `"skipped"` means user already decided — go to Step 2. If `conventions` starts with `"file:"` but the file does not exist, treat as `null` and re-run Step 1.5.
     - `planning` / `plan_done` → **first check `state.epic.boundaries != null`** (meaningful
       only once `phase == "plan_done"` — that combination cannot exist before the boundary
       Q&A completes, so it is itself a Q&A-completion mark): if true, the slice plan was
       interrupted after the gate — print `[harness] Boundary Q&A already answered — run
       /harness-build --epic` and halt. If `epic.boundaries == null`, apply the §Step 2.6 Plan
       Critic routing predicate (defined there as the single source; the three branches are NOT
       restated here): the branches that run Step 2.6 run it here, in this session; every
       branch then ends at §After Plan Phase, which prints `Next → /harness-gate` and halts.
       **This skill never routes into Step 3** — the gate is `/harness-gate`, a separate skill
       reached only by the human typing it (SPEC §2.2). A resume right after an interrupted
       Auto-revise re-synthesis lands on the gate's Pass A stale row in that next session — see
       `skills/harness-gate/SKILL.md` §Step 3 Pass A.
     - `generate_ready` / `generating` / `generate_done` / `verify_ready` / `verifying` /
       `verify_done` / `evaluate_ready` / `evaluating` / `evaluate_done` → **owned by
       `/harness-build`** — print `[harness] This session is past the gate (phase: {phase}) —
       run /harness-build` (with `verify` / `evaluate` when `phase` is `generate_done` /
       `verify_done`, mirroring §Session Boundary Type A's resume column in that skill) and
       halt. Nothing is written.
     - `completed` → no active session, proceed to Step 1
<!-- BLOCK-START:hx-session-actions-tail v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
   - **Restart**: Delete `.harness/` and proceed to this skill's §Fresh Start
   - **Stop**: Delete `.harness/` and halt
   - **View state only** (offered ONLY from the "Otherwise" branch's options list above — (a)
     Epic residue and (b) docs_path drift do NOT offer this option, and are unchanged by it):
     print the standard status block (§Standard Status Format, cited by name — its shape is
     not restated here; that block's `Path` row already carries `path_resolved`, so it is not
     repeated in the list below) plus the fields that block does not carry: `docs_path`,
     `verify.layer1_retries` and `verify.layer2_retries`, `autofix.applied`,
     whether `epic.boundaries` is set (presence only — `set` / `not set`, never the object's
     content), `plan_critic.applied` plus `plan_critic.counts`, and `spec_stamp` plus
     `plan_critic.spec_stamp_at_critic` (both in full — they are two small integer pairs,
     and after the move off mtime they are the ONLY surface on which a wrong stale /
     not-stale verdict can be diagnosed at all: the filesystem no longer carries a second
     opinion a user could check with `ls -l`. The two halves are not equally checkable even
     here: `lines` can be compared against the file itself with `wc -l`, while `generation`
     has no counterpart anywhere outside this record — nothing but the orchestrator's own
     bookkeeping ever produced it, so a wrong `generation` is unfalsifiable from outside). This is strictly more than
     item 3's earlier standard-status print, never a duplicate of it. Any field state.json does
     not currently carry (8.10.0 declared several of these additive-optional, missing = default)
     prints as `(none recorded)` — never invented. If `state.json` itself fails to parse, print
     only its path and the parse error, then halt — do not attempt a partial field-by-field
     recovery. Either way, this action **writes nothing to state.json** and then halts — no
     loop back to this gate. Calling `/harness` again re-renders it from the top.
<!-- BLOCK-END:hx-session-actions-tail v1 -->

If `.harness/state.json` does not exist, proceed to this skill's §Fresh Start.

### Fresh Start

The entry this skill takes when no session exists, or after a Restart / "Delete and start"
deleted one: **Step 1: Setup** (§Workflow Steps). Each skill of the split defines this section
once; the shared §Session Recovery prose above names it and never a Step number, so the same
bytes hold in every copy.

### Gate re-entry flags (`--modify` / `--auto-revise` / `--critic`)

`/harness-gate` cannot edit `spec.md`, dispatch a critic, or re-run a Plan pass; each of those
options ends the gate's turn by printing one of the commands below, which THIS skill executes.
All three require `phase == "plan_done"` (any other phase → `[harness] --{flag} needs a
plan_done session (phase: {phase})` and halt) and all three end at §After Plan Phase, printing
`Next → /harness-gate` — the gate re-renders from Pass A in that next session, seeing the
fresh `spec_stamp` / `plan_critic` state (its Modify Interaction contract).

| Flag | Action (this skill's orchestrator) | Writes |
|---|---|---|
| `--modify "<request>"` (VALUE-TAKING — listed in the doctor carve-out's flag list above) | apply the request to `{docs_path}spec.md` under §Step 2's `spec_stamp` write protocol (invalidate → write → stamp); never a dispatched sub-agent (SPEC decision ③) | `spec.md`, `spec_stamp` |
| `--auto-revise` | §Step 2 — WORKFLOW path's Auto-revise re-entry, exactly as the gate's Pass A row ①-a used to trigger it, including its same-turn Step 2.6 re-run | as that re-entry |
| `--critic` | §Step 2.6's own-critic dispatch, exactly as the gate's "Run Critic anyway" / "Retry Critic" used to trigger it (a fresh single write to `plan_critic`, `source = "own"`; INLINE branch when the recorded failure was a permission denial — `templates/_shared/mode_gate.md` rule 3) | `plan_critic.*` |

`--modify` is listed in the VALUE-TAKING list of §Session Recovery's doctor carve-out above —
otherwise `/harness --modify doctor` would misfire.

<!-- BLOCK-START:hx-run-style v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## run_style (Execution Mode)

Three execution styles control how phases progress:

| Style | Behavior | Session end points |
|-------|----------|-------------------|
| `auto` | Automatic progression WITHIN a skill; the Plan → Gate boundary is a skill boundary and always ends the `/harness` session (SPEC rev.9 (b)). In `/harness-build`, user gates at evaluate_done(FAIL) only | `plan_done` (`/harness`), `completed` (`/harness-build`) |
| `phase` | Stop at each `*_done` state, resume in next session | `plan_done`, `generate_done`, `verify_done`, `evaluate_done` |
| `step` | Execute only the specified step, then stop | Immediately after step |

### CLI Parsing

```
/harness "task description"              → auto (default); ends at plan_done → Next → /harness-gate
/harness plan "task description"         → phase mode, plan step — the same end point (auto and phase are equivalent up to the gate)
/harness --mode single "task"            → auto + single mode (inline forced)
/harness --mode multi "task"             → auto + multi mode (workflow path)
/harness --model-config balanced "task"  → auto + balanced preset
/harness plan "task" --epic              → cli_flags.epic=true (`skills/harness/SKILL.md` §Scale Assessment override); the gate's Pass B leads with "Plan as epic" and prints `/harness-build --epic`, whose Slice Plan (`skills/harness-build/SKILL.md` §Step 3.5) fills its table with no in-context PlanResult
/harness plan "task" --no-epic           → cli_flags.epic=false (`skills/harness/SKILL.md` §Scale Assessment override)
/harness "task" --epic                    → same as the `plan` form — no `run_style` reaches the gate in one call any more
/harness "task" --no-cold-pass           → cli_flags.cold_pass=false — read by `skills/harness-build/SKILL.md` §Step 5 "Cold Review Input Collection" `cold_dispatch_allowed`
/harness --modify "<request>"            → gate re-entry (plan_done only) — `skills/harness/SKILL.md` §Gate re-entry flags
/harness --auto-revise | --critic        → gate re-entry (plan_done only) — same section
/harness doctor                          → read-only diagnostic (`/harness` only); the dispatch condition lives in `skills/harness/SKILL.md` §Session Recovery's carve-out, the read-only contract in `## Sub-command: doctor`
/harness-gate                            → HARD GATE #1 (Pass A / Pass B); prints the next command; writes nothing
/harness-build                           → `phase → "generate_ready"` write, then Step 4 → 8 (auto within this skill)
/harness-build --epic                    → Slice Plan (`skills/harness-build/SKILL.md` §Step 3.5) then Epic Exit (Step 3.6); `phase` stays plan_done
/harness-build generate                  → phase mode, generate step
/harness-build verify                    → step mode, verify only
/harness-build evaluate                  → step mode, evaluate only
```

When state.json exists and `/harness` or `/harness-build` is called with no arguments:
→ §Session Recovery routes by phase; a phase owned by the other skill prints that skill's name
and halts.

### Step Mode Prerequisites

| Step | Required files | Required phase (minimum) | Missing action |
|------|---------------|-------------------------|----------------|
| `/harness plan` | (none) | (new session OK) | Normal start |
| `/harness-gate` | spec.md | `plan_done` exactly | `skills/harness-gate/SKILL.md` §Entry Check redirects to the owner; nothing is written |
| `/harness-build` | spec.md | `plan_done` (performs the `generate_ready` write) or later | Error: "Run /harness first" |
| `/harness-build verify` | changes.md | after `generate_done` | Error: "Run generate first" |
| `/harness-build evaluate` | spec.md + changes.md + verify_report.md | after `verify_done` | Error: "Run verify first" |
<!-- BLOCK-END:hx-run-style v1 -->

---

## Session Boundary

> Single source for the user-facing block printed when a `/harness` session ends. In this skill
> that is exactly ONE site — §After Plan Phase — and it is not optional: every `/harness`
> session ends there (the gate is a separate skill). Type B (task complete) never prints from
> this skill; it belongs to `/harness-build`. Shape + label rules mirror Setup Summary
> (§Output Language Contract — Print Translation Pattern: labels English raw, values per
> Preserved-English Glossary).

<!-- BLOCK-START:hx-boundary-shell v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
### Type A — phase-boundary (mid-task; session can resume next time)

```
[harness] Session boundary — <completed phase> complete.
  Task    : <task>
  Branch  : <state.json.branch>     ← omit if has_git == false
  Phase   : <completed phase label> → <next phase label>
  Output  : <docs_path>
  Resume  : <resume command — see table below>
  Handoff : Run `/handoff generate` to capture this session for cross-session continuity.
```
<!-- BLOCK-END:hx-boundary-shell v1 -->

| Boundary site | Completed → Next | Resume command |
|---|---|---|
| After Plan (Step 2) — the only Type A site in this skill | Plan → Gate | `/harness-gate` (always — `run_style` no longer changes this: `auto` sessions halt here too, SPEC rev.9 (b)). A `/harness` re-entry (`--modify` / `--auto-revise` / `--critic`) also ends here and prints the same line. |

**Residual (After Plan row):** `/harness-build` typed directly still skips the gate — by
design, not by drift (SPEC §8: an explicit choice, detected and disclosed by
`skills/harness-build/SKILL.md` §Entry, never prevented).

<!-- BLOCK-START:hx-handoff-fields v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
### `/handoff generate` field contract (P0-4)

When the `Handoff` row above is followed, `/handoff generate` reads `skill` / `task` / `phase`
/ `mode` / `docs_path` from `.harness/state.json` **read-only** — `/harness` never writes to,
reads from, or relies on any `/handoff` artifact — and records them under its HANDOFF
document's `## In Progress` section using this fixed-label format (parse anchor for its own
`resume` cross-check):
```
Skill : <skill>
Task : <task>
Phase : <phase>
Mode : <mode>
Docs : <docs_path>
```
<!-- SYNC-WITH: skills/handoff/SKILL.md §Fixed Label Record Format -->
See `skills/handoff/SKILL.md` §Fixed Label Record Format / §Live task-state cross-check for the
full contract — this skill has no further obligation beyond being read.
<!-- BLOCK-END:hx-handoff-fields v1 -->

---

> The comparison-operator prohibition below applies to every rendered line in §1–§4 /
> §Signal Domain / §INLINE Fallback of the §Scale Assessment section that follows: never
> phrase a rendered line as a numeric threshold comparison (no ">=", "이상", "초과", "미만").
> This note is placed OUTSIDE that section on purpose — a grep restricted to the section's
> line range must return 0 hits, and stating the prohibition INSIDE the range it governs
> would trip its own grep.

## Scale Assessment

> Single source for the scale/slice recommendation block. **(1) compute** — §Step 2 (Plan
> Phase), immediately after the Plan segment/sub-agent completes on BOTH the INLINE and
> WORKFLOW branches, run exactly once per Plan pass and frozen into `state.scale.*`;
> **(2) render** — §After Plan Phase, which EVERY `/harness` session reaches (the gate is a
> separate skill, so there is no `auto` run-through any more); **(3) render** — `/harness-gate`
> §Workflow Steps Step 3 Pass B, in the NEXT session, from the same frozen values. Renders
> (2) and (3) are therefore both expected in one task — the earlier rule that the two renders
> never both fire in one session described the unsplit file and is withdrawn (SPEC rev.9 (a)). The render
> fragment below (§1 → §INLINE Fallback) is byte-identical with `/harness-gate`'s copy.

### Compute-once / freeze / render-by-reference

Computed exactly ONCE, immediately after Step 2 (Plan Phase) completes — on **both** the
INLINE and WORKFLOW branches, and again on an Auto-revise re-entry (§Step 2 WORKFLOW path
— Auto-revise re-entry re-runs Step 2's shape, so it re-freezes `state.scale.*` from the
fresh return) — before phase advances to `plan_done`. The four elements below are derived
from the in-context `PlanResult` (WORKFLOW) or spec.md (INLINE fallback) at THAT moment and
written to `state.scale.signals` / `state.scale.slice_hint` / `state.scale.override` in a
single read-modify-write. Every render site after that reads `state.scale.*` — it never
re-derives.

**On cross-session resume, do NOT recompute** — the in-context `PlanResult` no longer
exists, so a resume-time recompute would always degrade to the §INLINE Fallback below and
could disagree with the value already shown once this session. **If `state.scale` is
missing entirely** (e.g. a pre-this-slice session resuming into Step 3, or any session that
somehow reaches Step 3 without ever computing it), treat every signal as `absent` and
render per §INLINE Fallback below — never error, never block the gate on a missing block.

<!-- BLOCK-START:hx-scale-render v1 — shared by /harness, /harness-gate; edit every copy in one commit and bump the version -->
### 1. Raw signal counts

Four raw signals, each independently tagged with its own measurement state (`ok` /
`absent` / `malformed` — see §Signal Domain below) rather than a bare number: AC count
(`acceptanceCriteria.length`), steps count (`steps.length`), in-scope count
(`scope.inScope.length`), risks count (`risks.length`).

### 2. Recommendation (verbatim render)

Render `sliceHint.recommendation` and `sliceHint.rationale` **verbatim** — copy the
strings, do not summarize, requote, or re-derive them. **The orchestrator does NOT derive
the recommendation from the counts in §1 above** — §1 is informational context only; the
recommendation comes exclusively from `sliceHint`, which the Synthesis sub-agent already
produced with full qualitative judgment (see `workflows/harness.plan.workflow.js` `##
Scale Hint`, which itself forbids numeric-threshold phrasing). This one rule is what makes
the "no comparison operator next to a count" requirement below structural rather than a
style guideline — there is no code path here that computes a threshold, so there is nothing
for a comparison phrase to attach to.

### 3. Override state

If `cli_flags.epic` is non-null, render the override: `true` → "epic 강제 적용 (사용자
지정 `--epic`)"; `false` → "single-slice 강제 적용 (사용자 지정 `--no-epic`)" (render in
`user_lang` per §Output Language Contract — these are natural-language values, not Glossary
tokens). If `cli_flags.epic == null`, render "override 없음 — 위 권고안이 그대로 유효".

**When an override is active, §1's raw signal counts and §2's verbatim recommendation still
render unchanged** — an override never suppresses the measured signal, it only changes which
choice ultimately wins at Step 3 Pass B. In that case append one more Status-Format-style
line, using the ONE place in this section where `skills/harness/SKILL.md` §Standard Status Format's aligned
`Label     : value` convention (unlike the unaligned `Critic:` gate literals in `skills/harness/SKILL.md` §Step 2.6)
applies literally:
```
Decision : forced by --epic     ← or "forced by --no-epic", matching whichever flag was given
```

### 4. Confirmation ownership

Always render a closing line: the recommendation/override above is informational only —
the actual epic-vs-single decision is confirmed by the user, at Step 3 Pass B (or, for a
`phase`/`step` session, at whichever future `/harness` invocation next reaches Step 3).
§Scale Assessment never itself advances the state machine or makes the epic/single choice.

### Signal Domain (`ok` / `absent` / `malformed`)

Each of the 4 raw signals in §1 is stored in `state.scale.signals` as one of three states —
never collapsed to a bare count:

- **`ok`** — the field is present AND `Array.isArray(field) == true`; render its `.length`.
- **`absent`** — the field is missing (`undefined`/`null`) from `PlanResult`. Render
  "measured: 없음" (never `0` — a plan that omits `steps` and a plan with an empty
  `steps: []` are different facts and must not collapse to the same rendered value).
- **`malformed`** — the field is present but `Array.isArray(field) == false` (e.g. `scope`
  collapsed into the `background` string — the failure actually observed during slice B
  measurement; `PlanResultSchema.required` does not cover `scope`, so this passes schema
  validation). Render "measured: 손상됨 (배열 아님)".

**Rule**: never call `.length` on a field without first confirming `Array.isArray(field) ==
true`. A `malformed` field's `.length` (a string has one too) is NOT an item count and MUST
NOT be rendered as one — that is exactly the failure this rule exists to prevent (a string
that absorbed `scope` would render its character count as an "in-scope item count",
deterministically biasing the assessment toward "epic").

If any of the 4 signals is `absent` or `malformed`, append one closing line: "결측되거나
손상된 신호가 있음 — 위 권고는 그만큼 불완전한 근거에 기반함" (qualitative disclosure
only — no numbers, no comparison).

### INLINE Fallback (degraded, 1-signal mode)

The INLINE path (and any resume that lands in §INLINE Fallback per the rule above) has no
`sliceHint` — `planner_single.md` never produces one — and no structured
`acceptanceCriteria`/`steps`/`scope`/`risks` fields to measure. Render as a **1-signal
degraded mode**, not a silent 3-of-4 failure:

- The ONLY `ok` signal: a language-independent scan of spec.md for GFM checkbox lines
  matching the literal pattern `- [ ]` (used under `### Completion Criteria` — see `skills/harness/SKILL.md` §Step 2
  WORKFLOW path spec.md render mapping) — count occurrences. **Do NOT parse the heading
  TEXT** (`### Completion Criteria` or any other) to locate the section — spec.md headings
  are rendered in `user_lang` per §Output Language Contract, so an English heading match
  silently returns 0 in every non-English session. The checkbox glyph itself is
  language-independent.
- The other 3 signals: `absent` (steps/scope/risks have no INLINE spec.md equivalent to
  scan for).
- Recommendation: render "없음 (INLINE 경로 — 권고를 만드는 sliceHint가 이 경로에는 없음)"
  — state the degradation explicitly, never omit the recommendation line silently.
- Append the closing disclosure line above AND one more: "이 폴백은 독립적인 2차 방어가
  아니라 spec.md 자체(`skills/harness/SKILL.md` §Step 2 INLINE 산출물)의 하류임 — spec.md가 이미 손상된 scope를
  반영했다면 이 신호도 같은 오염을 반영함".
<!-- BLOCK-END:hx-scale-render v1 -->

---

<!-- BLOCK-START:hx-state-machine v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## State Machine

### State Transition Diagram

```
plan_ready → planning → plan_done → [User Gate] → generate_ready
  → generating → generate_done → verify_ready → verifying → verify_done
  → evaluate_ready → evaluating → evaluate_done → [Verdict Gate]
  → completed

plan_done → completed (epic exit only — `skills/harness-build/SKILL.md` §Step 3.6; Steps 4–8 not executed)

Retry loops:
  verify_done(FAIL) + retries<3 → generating → generate_done → verifying → ...
  evaluate_done(FAIL) + user Fix → generating → generate_done → verifying → ...
```

On the WORKFLOW path the same machine applies; `harness.eval` covers verifying→evaluating in one segment run (its returned `layer` tells you where it stopped).

### Transition Rules

- `*_ready` → `*ing`: sub-agent dispatch or segment-script launch (immediate)
- `*ing` → `*_done`: sub-agent / segment completion
- `*_done` → next `*_ready`: auto mode = automatic / phase mode = next session
- Phase mode can end session at: `plan_done`, `generate_done`, `verify_done`, `evaluate_done`
- `plan_done` → `completed` directly, skipping `generate_ready` through `evaluate_done`: the
  one epic-exit exception, taken only via `skills/harness-build/SKILL.md` §Step 3.6 (by name) — never any
  other transition skips a state.
<!-- BLOCK-END:hx-state-machine v1 -->

---

## Workflow Steps

### Step 1: Setup

0. **doctor dispatch.** When §Session Recovery's read-only carve-out at the top of that
   section applies, this step is never reached — that section jumps straight to
   `## Sub-command: doctor`. The condition itself lives there and is not repeated here.

1. **Detect user language** from task description. Store as `user_lang`.
2. **Parse CLI arguments**:
   - Bare task → `run_style: "auto"`
   - `plan|generate` prefix → `run_style: "phase"` (multi-step progression)
   - `verify|evaluate` prefix → `run_style: "step"` (single step only)
   - `--mode single|quick|standard|multi|comprehensive|thorough|deep` → mode/path input for §Mode Gate
   - `--model-config <preset>` → set model config
   - `--lint-cmd <cmd>` → override lint_cmd
   - `--type-check-cmd <cmd>` → override type_check_cmd
   - `--verifier-model <haiku|sonnet|opus>` → override verifier model (default: haiku). **Validation**: if value is not one of `haiku`, `sonnet`, `opus` → halt with error: "Invalid --verifier-model value. Allowed: haiku, sonnet, opus."
   - `--output-dir <path>` → override output base directory (default: `docs/harness`). **Validation** — apply `validate_path(path, kind=output_dir)` (see §Architecture Principles §Path Validator):
     - **Step 0** (before normalization): Empty string → halt with error: "output-dir cannot be empty."
     - **Step 1** Normalize: `\` → `/` (always, OS-independent). UNC pattern (`\\server\…` or `//server/…`) → halt with error: "UNC paths are not allowed."
     - **Step 2** Absolute path: matches `^/` or `^[A-Za-z]:/` → halt with error: "output-dir must be a relative path."
     - **Step 3** Segment `..`: `path.split("/")` — if any segment `== ".."` → halt with error: "output-dir must not contain '..'." (segment-exact check, not substring)
     - **Step 4** Reserved first segment: `path.split("/")[0]` ∈ `{memory, spec, planner, generator, evaluator, verify, harness, .harness}` → halt with error: "output-dir value starts with a reserved directory name." (first segment only — trailing slash stripped first; full-path comparison is NOT performed)
     - **Step 4.5** `docs` first-segment exception for `/spec → /harness` slug-safe handoff: if `path.split("/")[0] == "docs"`, the second segment MUST be `harness` (i.e. path starts with `docs/harness/...`). Otherwise halt with error: "output-dir under docs/ must be docs/harness/..." Rationale: the default `output_base = "docs/harness"` always writes under this tree, so the standard /spec handoff value `docs/harness/<slug>/` is the only legitimate `docs/...` override; any other `docs/<other>/` first-segment override is rejected to prevent accidental writes outside the harness namespace.
     - If valid: normalize with trailing slash stripped, store in `cli_flags.output_dir`.
   - `--epic` / `--no-epic` → store `cli_flags.epic` as `true` / `false` (tri-state; unset stays `null` — §Scale Assessment's own recommendation stands). **Validation**: if BOTH `--epic` AND `--no-epic` are given, halt with error: "Cannot combine --epic and --no-epic." **This halt fires HERE, in item 2 (pure parsing) — before item 7 creates `.harness/`/`{docs_path}` and item 8 creates the git branch** (same placement reasoning as the `--verifier-model` halt above: a halt placed after those side effects would leave a ghost `.harness/` + empty branch for the next Session Recovery to mistakenly offer to Resume). Consumers: §Scale Assessment's override display and `skills/harness-gate/SKILL.md` §Step 3 Pass B's leading-option table — both real as of this slice. Neither `skills/harness-build/SKILL.md` §Step 3.5 nor `skills/harness-build/SKILL.md` §Step 3.6's epic-exit predicate reads this field (that predicate uses `state.epic.boundaries` + `state.phase` only); a `--epic` session can still choose "Proceed as single" at Pass B.
   - `--no-cold-pass` → store `cli_flags.cold_pass = false` (default `true` — cold pass runs unless this flag is given). Consumer: the `cold_dispatch_allowed(skipL1)` predicate defined in `skills/harness-build/SKILL.md` §Step 5 "Cold Review Input Collection" (1st of 3 `--no-cold-pass` gating points, AC-28) — read there (`skills/harness-build/SKILL.md` §Step 5 WORKFLOW args), at `skills/harness-build/SKILL.md` §Step 6's own entry gate (2nd point), and by the segment's own `A.coldPass === true` check in `workflows/harness.eval.workflow.js` (3rd point).
3. **Slugify the task:** lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. Store as `<slug>`.
4. **Auto-detect project language and commands.** Scan the working directory.
5. **Auto-detect lint command** (skip if `--lint-cmd` provided).
6. **Auto-detect type-check command** (skip if `--type-check-cmd` provided).

   Language/test/build/lint/typecheck detection: see `templates/_shared/detection_table.md`.

7. **Determine `docs_path`:**
   ```
   output_base = cli_flags.output_dir ?? "docs/harness"
   docs_path = output_base + "/" + <slug> + "/"
   ```
   **Create directories:** `.harness/`, `.harness/planner/`, `.harness/generator/`, `{docs_path}`

   **Immediately after docs_path is determined**, write partial state.json (crash recovery checkpoint):
   ```json
   { "version": "3.0", "skill": "harness", "task": "<task>", "cli_flags": {...},
     "user_lang": "<lang>", "has_git": <bool>, "created_at": "<ISO8601>",
     "docs_path": "<docs_path>", "slug": "<slug>" }
   ```
   Remaining fields (mode, model_config, etc.) are `null` until Step 1.11 final write.

8. **Create git branch (if has_git):** `git checkout -b harness/<slug>`. Skip if `has_git == false`.
   **(P0-5) On failure** (branch already exists — the common cause): never proceed on an unspecified branch.
   - Check whether the existing `harness/<slug>` has any commits beyond its creation point (e.g. `git log harness/<slug> --oneline -1` vs the base branch).
   - **Empty branch** (no commits ahead — e.g. a stale branch from an aborted prior attempt): reuse it silently (`git checkout harness/<slug>`). Nothing to contaminate; no confirmation needed.
   - **Non-empty branch** (already carries commits — a real prior slice/attempt): **never reuse silently** — silent reuse mixes the prior slice's changes into this session's diff and contaminates Layer 2/3 judgment and any later `/deep-review` scope. Resolve via ONE of:
     - **Suffix**: append `-2`, `-3`, … to `<slug>` and retry `git checkout -b harness/<slug>-N` until it succeeds (no confirmation needed — this always yields a fresh branch).
     - **User confirmation**: ask via AskUserQuestion (in `user_lang`): header "Branch", question "harness/<slug> already has commits — reusing it will mix its changes into this session's diff.", options: "Reuse anyway" / "Continue on the existing branch (diff may include prior commits)", "New branch" / "Create harness/<slug>-2 instead". On "Reuse anyway": print per OLC `[harness] ⚠ Reusing harness/<slug> — N prior commit(s) will appear in this session's diff.` before continuing.
   - Whichever branch name is finally used, record the ACTUAL name in `state.json.branch` (Setup Summary step 12 reads this field — it may differ from the literal `harness/<slug>`).
9. **Mode Gate resolution:** apply §Mode Gate INCLUDING **§Ambiguity Prompt** (single source: `templates/_shared/mode_gate.md`). The mode roundtrip is removed EXCEPT this prompt, which fires only when NO opt-in is present (no `--mode`, ultracode OFF, no project-default `path` (`agent-harness-defaults:` line), `Workflow` tool available, `has_git == true`, interactive session, no `--no-prompt`). Skill modes: single(inline) / standard(workflow) / multi(workflow). ultracode-target (step 4 default): multi. Store `mode` and `path_resolved` in state.json. Then emit **§Path Transparency** — show `Path : <inline | workflow>  (<reason>)`. If a workflow-tier `--mode` was requested but the gate resolved to inline (Workflow tool unavailable or `has_git == false`), notify (in `user_lang`): "<tier> mode requires the native Workflow engine and git — proceeding on the inline path."
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
10. **Model configuration:** If `--model-config` provided, use it. Otherwise, if the resolved project-defaults line (first source wins wholesale: settings.local.json env → project CLAUDE.md → user CLAUDE.md; see `templates/_shared/project_defaults.md`) contains `model-config=<preset>`, use it silently and echo `(project default)` next to the Model line in the Setup Summary. Otherwise, ask via AskUserQuestion (in `user_lang`):
<!-- SYNC-WITH: templates/_shared/project_defaults.md §agent-harness-defaults -->
    - header: "Model"
    - question: "Select model configuration for sub-agents:"
    - options:
      - "default" / "Inherit parent model, no changes"
      - "frontier" / "Sonnet executor + Opus advisor + Fable evaluator (top-model judgment)"
      - "balanced (Recommended)" / "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
      - "economy" / "Haiku executor + Sonnet advisor/evaluator (max savings)"

    If "Other": parse `executor:<model>,advisor:<model>,evaluator:<model>` (or a bare preset name — validated against the preset table: `default` / `all-opus` / `frontier` / `balanced` / `economy`). For the role form, validate — only `fable`, `opus`, `sonnet`, `haiku`. Max 3 retries, then default to `balanced`. Fill missing roles from `balanced` defaults.

    Store as `model_config`: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>", "verifier": "<resolved-verifier>" }`.
    For `default` preset: `{ "preset": "default", "verifier": "<resolved-verifier>" }`.

10.5. **Verifier model determination:** `model_config.verifier = cli_flags.verifier_model ?? project_default.verifier_model ?? "haiku"` (CLI flag > `agent-harness-defaults:` project default > `haiku`; preset default is always `haiku`). Store resolved value in `model_config.verifier`.

    **docs_path usage rule**: Always read `docs_path` directly from state.json. Do NOT recompute from `cli_flags.output_dir`. `cli_flags.output_dir` itself is for audit/record purposes only (this is what this rule is about — it does NOT generalize to every `cli_flags.*` field; `cli_flags.epic`/`cli_flags.cold_pass` are written and read elsewhere in this file starting this slice — see the new-field table note above). Safety Guard in Session Recovery also uses `docs_path` directly (not recomputed).

11. **Write `.harness/state.json`:**

```json
{
  "version": "3.0",
  "skill": "harness",
  "task": "<task>",
  "mode": "single|standard|multi",
  "path_resolved": "inline|workflow",
  "run_style": "auto|phase|step",
  "model_config": {
    "preset": "<name>",
    "executor": "<model|null>",
    "advisor": "<model|null>",
    "evaluator": "<model|null>",
    "verifier": "<haiku|sonnet|opus>"
  },
  "cli_flags": {
    "verifier_model": null,
    "output_dir": null
  },
  "user_lang": "<lang>",
  "has_git": true,
  "repo_name": "<name>",
  "repo_path": "<path>",
  "phase": "plan_ready",
  "round": 1,
  "max_rounds": 3,
  "max_files": 20,
  "scope": "<scope or (no limit)>",
  "branch": "harness/<slug>",
  "lang": "<detected>",
  "build_cmd": "<cmd or null>",
  "test_cmd": "<cmd or null>",
  "lint_cmd": "<cmd or null>",
  "type_check_cmd": "<cmd or null>",
  "verify": {
    "layer1_result": null,
    "layer1_retries": 0,
    "layer2_result": null,
    "layer2_retries": 0,
    "todo_blocking": false,
    "autofix_attempted": false
  },
  "autofix": null,
  "runs": { "plan": null, "build": null, "eval": null },
  "workflow_ctx": null,
  "docs_path": "<output_base>/<slug>/",
  "conventions": null,
  "created_at": "<ISO8601>",
  "updated_at": "<ISO8601>"
}
```

> `cli_flags.verifier_model` and `cli_flags.output_dir` are `null` by default (no CLI override).
> `verify.autofix_attempted` starts `false` each new session (session-wide once-only limit — not reset on round increment).
> `autofix` starts `null`; transitions to `{ "last_patch_path": "...", "applied": "proposed"|"applied"|"rejected"|"stopped", "triggered_at": "<ISO8601>" }` during H2 flow.
> `runs.{plan|build|eval}` records `{ "runId": "<wf_...>" }` after each segment launch — audit + same-session iteration only (cross-session resume re-runs segments; see §Session Recovery).
> `workflow_ctx` stores `{ "planDigest": "...", "advisorDigests": {...} }` returned by `harness.build` — reused verbatim on retry entries (no re-plan, no re-review).

**New in v3 (additive-optional — see the no-bump clause in §Version & Compatibility).** These fields are NOT present in the JSON literal above; a session missing one of them takes the documented default.

| Field | Type | Missing ⇒ default | Written by | Read by |
|---|---|---|---|---|
| `plan_critic.applied` | `"executed"` / `"skipped"` / `"failed"` | `null` | §Step 2.6 (Plan Critic) | §Step 2.6 gate display, §Session Recovery routing, §Session Recovery item 7 "View state only" |
| `plan_critic.round` | integer | `null` | §Step 2.6 | §Step 2.6 gate display |
| `plan_critic.last_findings_path` | string | `null` | §Step 2.6 | §Step 2.6 gate display |
| `plan_critic.failure_reason` | string | `null` | §Step 2.6 | §Step 2.6 gate display |
| `plan_critic.source` | `"own"` / `"carried_over"` | `null` | §Step 2.6 | §Step 2.6 gate display (`carried over from /spec` literal) |
| `plan_critic.counts` | `{ critical, major, minor }` (lowercase — matches `CriticReport.counts` in `workflows/_reference/schemas.md` — cited by name, not line: that file is append-only, so any delta appended above `CriticReport` would silently shift a line citation) | `null` (not yet run / not yet parsed) | §Step 2.6 | §Step 2.6 gate display, §Session Recovery item 7 "View state only" |
| `plan_critic.spec_stamp_at_critic` | `{ generation, lines }` — a copy of `state.spec_stamp` as it stood when this critic pass ran | `null` | §Step 2.6 (all three branches — success copies the current stamp, carried-over and failure branch (iii) write `null`) | `skills/harness-gate/SKILL.md` §Stale Determination, §Session Recovery item 7 "View state only" |
| `spec_stamp` | `{ generation: integer, lines: integer }` | `null` | every site that writes `{docs_path}spec.md`, per §Step 2's `spec_stamp` write protocol (by name) | `skills/harness-gate/SKILL.md` §Stale Determination, §Step 2.6's latch, §Session Recovery item 7 "View state only" |
| `scale.signals` | object | `null` | §Scale Assessment | §Scale Assessment, Step 3 gate |
| `scale.slice_hint` | object — PlanResult `sliceHint` stored verbatim | `null` | §Scale Assessment | `skills/harness-gate/SKILL.md` §Step 3 Pass B (this slice), `skills/harness-build/SKILL.md` §Step 3.5 (Slice Plan) |
| `scale.override` | boolean | `null` | §Scale Assessment (`--epic`/`--no-epic` override) | §Scale Assessment |
| `epic.id` | string | `null` | `skills/harness-build/SKILL.md` §Step 3.5 (Slice Plan) | no reader yet — written for the `Command` column's display; its derivation is defined once, in `skills/harness-build/SKILL.md` §Step 3.5 |
| `epic.boundaries` | object | `null` | `skills/harness-build/SKILL.md` §Step 3.5 (Q&A and no-Q&A paths alike), `skills/harness-gate/SKILL.md` §Step 3 Pass B "Proceed as single" (reset to `null`) | `skills/harness-build/SKILL.md` §Step 3.5 re-entry check, §Session Recovery item 7 (a) + item 7 "View state only" (presence only) + `plan_done` jump-table row, `skills/harness-build/SKILL.md` §Step 3.6's epic-exit predicate |
| `verify.cold_result` | string | `null` | `skills/harness-build/SKILL.md` §Step 5 (WORKFLOW) / `skills/harness-build/SKILL.md` §Step 6 (INLINE); `skills/harness-build/SKILL.md` §Step 7 feedback branch (`retried_dispatching` → `retried_unverified`); §Session Recovery (same transition, on resume) | `skills/harness-build/SKILL.md` §Step 7 cold feedback branch (single definition there), §Session Boundary `Remaining` rule, §Session Recovery re-entry |
| `verify.cold_retries` | integer | `0` | `skills/harness-build/SKILL.md` §Step 5 / `skills/harness-build/SKILL.md` §Step 6 (never changed there, only initialized); `skills/harness-build/SKILL.md` §Step 7 feedback branch (`+= 1`); reset to `0` on round increment (`skills/harness-build/SKILL.md` §Step 7 "If Fix") | `skills/harness-build/SKILL.md` §Step 7 feedback-branch condition |
| `verify.cold_round` | integer | `null` | `skills/harness-build/SKILL.md` §Step 5 / `skills/harness-build/SKILL.md` §Step 6; reset to `null` on round increment (`skills/harness-build/SKILL.md` §Step 7 "If Fix") | `skills/harness-build/SKILL.md` §Step 5 `cold_dispatch_allowed` predicate, `skills/harness-build/SKILL.md` §Step 7 `cold_ran_this_round` derivation, §Session Boundary `Remaining` skip-reason derivation |
| `verify.cold_counts` | `{ Critical, Major, Minor }` (uppercase — matches `CriticReport.items[].severity`; see the cold-review severity delta in `workflows/_reference/schemas.md`) | `null` | `skills/harness-build/SKILL.md` §Step 5 / `skills/harness-build/SKILL.md` §Step 6 | `skills/harness-build/SKILL.md` §Step 7 cold feedback branch (single definition there) |
| `verify.cold_review_path` | string | `null` | `skills/harness-build/SKILL.md` §Step 5 (WORKFLOW, after the file write succeeds) / `skills/harness-build/SKILL.md` §Step 6 (INLINE, sub-agent wrote it directly) | `skills/harness-build/SKILL.md` §Step 7, §Session Boundary `Remaining` rule |
| `cli_flags.epic` | tri-state: `null` / `true` / `false` | `null` (no `--epic`/`--no-epic` given — §Scale Assessment recommendation stands) | §Step 1 CLI Parsing (`--epic`/`--no-epic`) | §Scale Assessment override check, `skills/harness-gate/SKILL.md` §Step 3 Pass B leading-option table (never `skills/harness-build/SKILL.md` §Step 3.5 or the epic-exit predicate — that predicate reads `state.epic.boundaries` + `state.phase` only) |
| `cli_flags.cold_pass` | boolean | `true` (cold pass runs unless `--no-cold-pass`) | §Step 1 CLI Parsing (`--no-cold-pass`) | cold review dispatch gating |

> `plan_critic.counts` (lowercase keys) and `verify.cold_counts` (uppercase keys) follow different upstream schemas (`CriticReport.counts` lowercase keys vs. `CriticReport.items[].severity` uppercase values; the lowercase `FindingSchema.severity` in that same file is a THIRD, unrelated vocabulary) — an intentional difference, NOT normalized to one case.
> `spec_stamp.generation` and `plan_critic.round` are DIFFERENT axes and the word "revision" in this file belongs to the latter: `round` counts Auto-revise **revision rounds** (bounded at 1), while `generation` counts spec.md **writes** (unbounded). A session can advance `generation` many times with `round` still `0` — a Modify loop does exactly that. They are never compared to each other.
> `plan_critic.applied`'s value set (`executed`/`skipped`/`failed`) is harness-local and is NOT interchangeable with /spec `state.critic.applied`'s value set (`approved`/`pending`/`revised`) — the field name is borrowed from /spec `state.critic`, the value set is not.
> `cli_flags.epic` is tri-state (`null`/`true`/`false`) while `cli_flags.cold_pass` is a plain boolean — `--epic`+`--no-epic` given together can halt on that distinction (two explicit, opposite non-null values) rather than collapsing onto one boolean.
> A per-session cold-pass execution cap equal to `max_rounds` (default 3) is not a separate counter — it falls out arithmetically from `verify.cold_round`'s once-per-round execution latch.
> `cli_flags.output_dir` remains audit/record only (see the `docs_path usage rule` note at Step 1 item 10.5) — no section recomputes from it, only `docs_path` itself is read directly (§Session Recovery's docs_path drift check does not read this field either). `cli_flags.epic` and `cli_flags.cold_pass` are NOT audit-only: `cli_flags.epic` is written by §Step 1 CLI Parsing and read by §Scale Assessment's override check and `skills/harness-gate/SKILL.md` §Step 3 Pass B; `cli_flags.cold_pass` is written by §Step 1 CLI Parsing and read by the `cold_dispatch_allowed` predicate (`skills/harness-build/SKILL.md` §Step 5 "Cold Review Input Collection", this slice).
> `plan_critic.*`, `scale.*`, `cli_flags.epic`/`cli_flags.cold_pass`, `epic.*`, and now `verify.cold_*` are all written by the sections named in the table above (this slice).

12. **Print setup summary** per §Output Language Contract — Print Translation Pattern (labels remain English raw; values follow §Output Language Contract — Preserved-English Glossary):
```
[harness] Task started!
  Directory : <path>
  Branch    : <state.json.branch>     ← omit if has_git == false
  Mode      : <single | standard | multi>
  Path      : <inline | workflow>  (<reason per §Path Transparency>)
  Model     : <preset>
  Verifier  : <model_config.verifier>    ← always shown
  Style     : <auto | phase | step>
  Language  : <lang>
  Test      : <test_cmd or "none">
  Build     : <build_cmd or "none">
  Lint      : <lint_cmd or "none">
  TypeCheck : <type_check_cmd or "none">
  Scope     : <scope>
  Output    : <docs_path>
```

If `model_config.verifier` is `sonnet` or `opus`, also print:
```
  ⚠ Verifier set to <model> — high cost for mechanical verification. haiku is usually sufficient.
```

**(P1-3)** If `build_cmd`, `test_cmd`, `lint_cmd`, AND `type_check_cmd` are ALL `null` (nothing was auto-detected or provided), also print:
```
  ⚠ No build/test/lint/type-check command detected — Layer 1 verification is inactive; completion will rely on Layer 2/3 (LLM judgment) alone. Provide --lint-cmd / --type-check-cmd, or verify manually.
```
This is a warning only — it does NOT halt (legitimate git-free/doc-only tasks have no verification commands).

13. **Proceed to Step 1.5** (Convention Scan). If `run_style == "step"` and the CLI step is not `plan`, check prerequisites and jump to the requested step after Step 1.5 completes.

---

### Step 1.5: Convention Scan

*This step runs after Setup and before Plan, in all modes and on both paths.*

**Persisted Spec Artifacts Check:**

Before running CLAUDE.md richness check, look for `{docs_path}conventions.md` (persisted by /spec Phase 3 in slug-matched directory). **(m7)** `{docs_path}` is read from state.json (set by Step 1 step 7 — see §Step 1: Setup, its state.json schema block).

**Evaluation order (explicit decision tree):**

```
IF  state.conventions == "file:.harness/conventions.md"  THEN
    IF  .harness/conventions.md exists  THEN
        // (M2) Skip — live .harness/conventions.md is authoritative on /harness resume.
        skip Persisted Spec Artifacts Check entirely.
        proceed to CLAUDE.md richness flow below.
    ELSE  IF  {docs_path}conventions.md exists  THEN
        // Resume idempotency — re-copy /spec snapshot.
        copy {docs_path}conventions.md → .harness/conventions.md.
        proceed to Step 2 (Plan) — skip rich/sparse/missing trichotomy.
    ELSE
        // Both files missing — reset state and fall through.
        state.conventions = null  (atomic single-write).
        proceed to CLAUDE.md richness flow below (treat as fresh execution).
    END
ELIF  state.conventions IN { null, "skipped" }  THEN
    // Fresh /harness session OR explicitly skipped — fall through.
    IF  {docs_path}conventions.md exists  THEN
        copy {docs_path}conventions.md → .harness/conventions.md.
        set state.conventions = "file:.harness/conventions.md".
        proceed to Step 2 (Plan).
    ELSE
        proceed to CLAUDE.md richness flow below.
    END
END
```

**(M2) Skip condition for resume** (covered by the first IF branch above): If `state.conventions == "file:.harness/conventions.md"` AND `.harness/conventions.md` already exists (e.g., a prior /harness session scanned conventions itself, then the session was paused and resumed), skip this entire Persisted Spec Artifacts Check and proceed directly to the existing CLAUDE.md richness flow below — the live `.harness/conventions.md` is authoritative for resumed /harness sessions and must NOT be overwritten by a possibly-stale `/spec` copy.

**Resume idempotency:** if `state.conventions == "file:.harness/conventions.md"` but `.harness/conventions.md` is missing (e.g., `.harness/` was deleted between sessions) AND the M2 skip condition above did NOT trigger, the persisted check re-copies from `{docs_path}conventions.md` if still present. **If both `.harness/conventions.md` AND `{docs_path}conventions.md` are missing**, reset `state.conventions = null` (atomic single-write read-modify-write — do NOT only update in-memory because the next Session Recovery resume will re-read state.json and find the stale `"file:..."` value, looping the same fallback) and fall through to the existing CLAUDE.md richness flow (treat as fresh execution — no convention context available).

**CLAUDE.md Richness Check:**

1. Check if `CLAUDE.md` exists in the repository root.
2. If it exists, count lines: `wc -l CLAUDE.md` (or read and count).
3. **Richness determination:**
   - Exists AND ≥ 50 lines → **rich** → skip scan, read CLAUDE.md content as conventions.
   - Exists AND < 50 lines → **sparse** → proceed to scan Q&A.
   - Does not exist → **missing** → proceed to scan Q&A.

**`conventions` field contract:** Always stores one of three values:
- `null` → Step 1.5 not yet executed (initial state)
- `"skipped"` → user explicitly chose to skip convention scan
- `"file:<path>"` → conventions available at the given path (e.g., `"file:.harness/conventions.md"`)

**Conventions injection rule (used by Step 2):** When `conventions` starts with `"file:"`, read the file at the path after the prefix. If the file does not exist, treat as `null` and re-run Step 1.5. When `conventions` is `null` or `"skipped"`, pass `{conventions}` / `args.conventions` as empty string. <!-- SYNC-WITH: skills/spec/SKILL.md §Step 1.5 conventions field contract -->

---

**If rich (CLAUDE.md ≥ 50 lines):**

1. Copy CLAUDE.md content to `.harness/conventions.md` (so all convention sources use the same path pattern).
2. Store `conventions → "file:.harness/conventions.md"` in state.json.
3. Print: `  [harness] Conventions: CLAUDE.md detected (rich). Copied to .harness/conventions.md`
Proceed to Step 2 (Plan).

**If sparse or missing:**

Ask via AskUserQuestion (in `user_lang`):
- header: "Convention Scan"
- question: "No rich CLAUDE.md found. Scan codebase to auto-detect project conventions (DB, API, file structure, test patterns)? This helps the Planner align with existing patterns."
- options:
  - "Scan" / "Run convention scanner sub-agent (~1 token overhead)"
  - "Skip" / "Proceed without convention data"

**If "Skip":** Set `conventions → "skipped"` in state.json. Print: `  [harness] Conventions: skipped.` Proceed to Step 2.

**If "Scan":**

1. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/convention_scanner.md`
2. Fill variables: `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}`, `{output_path}` = `.harness/conventions.md`.
3. **Dispatch 1 sub-agent** (convention scanner — always inline, both paths). Model: if preset ≠ "default", use `model_config.advisor` (or haiku for economy).
4. Parse return — first line should contain `"conventions written"`.
5. Verify `.harness/conventions.md` exists.
   - **If file does NOT exist** (sub-agent reported success but file missing): warn user (in `user_lang`): "Convention scan completed but output file not found." Ask via AskUserQuestion: header "Convention Scan Failed", question "Output file missing. Retry or skip?", options: "Retry" / "Re-run scanner", "Skip" / "Proceed without conventions". If "Retry" → re-dispatch sub-agent (max 2 retries). If "Skip" → set `conventions → "skipped"`. Do NOT store a `"file:"` reference to a non-existent file.
6. Store `conventions → "file:.harness/conventions.md"` in state.json.
7. Print: `  [harness] Conventions: scanned and saved to .harness/conventions.md`

Update state.json: `updated_at → now`.
Proceed to Step 2 (Plan).

---

### Step 2: Plan Phase

Update state.json: `phase → "plan_ready"`, `updated_at → now`.

Print: `[harness] Phase: Plan`

**Discovery Notes Injection — both paths:**

Before the plan dispatch/segment, prepare:
- `qa_discovery_notes` = read content of `{docs_path}qa_notes.md`:
  - File missing → empty string `""` (silent — fresh run with no preceding /spec).
  - **(s2) File exists but read fails** (permission, encoding, IO error) → warn user (in `user_lang`): "Failed to read `{docs_path}qa_notes.md`: <error>. Discovery Notes will be empty for planner injection." Then fall back to empty string `""` and proceed (do NOT abort — empty Discovery Notes is harmless).
- `critic_findings` = read content of `{docs_path}critic_findings.md` using the same pattern (missing → empty silently; read failure → warn + empty fallback).

**`spec_stamp` write protocol (single source — every site that writes `{docs_path}spec.md`
cites this by name and none restates it: §Step 2 — INLINE path, §Step 2 — WORKFLOW path,
that path's Auto-revise re-entry, and `skills/harness-gate/SKILL.md` §Step 3's "Modify" option):** three ordered steps,
**invalidate first**.

1. Capture `prev = state.spec_stamp.generation` (`null` stamp → `0`), then write
   `spec_stamp → null` — a small state.json write of that field alone, never folded into a
   neighbouring `state.scale.*` write, because its whole purpose is to land BEFORE the file
   changes.
2. Write (or let the dispatched planner write) `{docs_path}spec.md`.
3. Write `spec_stamp → { "generation": prev + 1, "lines": <line count of the file as it
   now stands on disk> }`.

**Why invalidate first, stated because the obvious order is the wrong one.** `spec.md` is a
file and `spec_stamp` is a state.json field, so "write both at once" does not exist; one of
them is second. If the stamp were second and the session died between steps 2 and 3, the
stamp would still describe the PREVIOUS spec.md while the file on disk is new — and the
`skills/harness-gate/SKILL.md` §Stale Determination would read that as **not stale**, exposing Auto-revise against a spec
the critic never saw. Invalidating first makes that same window resolve to `null`, which
that determination treats as stale (fail closed). The mtime mechanism this replaced had no
such window at all — the filesystem updated the stamp as a side effect of the write itself —
so this ordering rule is not a refinement, it is the repair for a window the replacement
introduced.

**(m4) Scope of injection**: this injection applies ONLY to initial proposal inputs — the inline `planner_single.md` dispatch and the `harness.plan` segment `args` (whose embedded persona templates declare the placeholders). Synthesis runs inside the segment and receives proposals that already incorporate this context — do NOT double-inject downstream.

#### Step 2 — INLINE path (mode: single)

1. Update phase → `"planning"`, and in the same write apply step 1 of the `spec_stamp`
   write protocol above (capture `prev`, set `spec_stamp → null`). It has to happen here
   rather than beside item 5: on this path the file is written by the sub-agent dispatched
   at item 3, so the invalidation must precede the dispatch.
2. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/planner_single.md`
3. **Dispatch 1 sub-agent** with prompt built from: `{task_description}`, `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}`, `{qa_discovery_notes}`, `{critic_findings}`, `{conventions}` (per §Conventions injection rule), plus `{spec_path}` = `{docs_path}spec.md`. Always pass the discovery placeholders — even when empty.
   - Model: if preset ≠ "default", use `model_config.advisor`.
4. Parse return → extract first line. Print: `  ✓ {first line}`
5. Verify `spec.md` exists, then apply step 3 of the `spec_stamp` write protocol
   (`spec_stamp → { generation: prev + 1, lines: <line count of spec.md> }`). If the file
   does not exist, leave `spec_stamp` at `null` — the invalidation from item 1 stands, and
   the gate reads it as stale rather than as a clean spec nobody wrote.
6. **Compute and freeze §Scale Assessment** (that section's compute site) — the INLINE path has no `sliceHint`, so apply its §INLINE Fallback degraded mode against the just-written spec.md. Single read-modify-write into `state.scale.signals` / `state.scale.slice_hint` (`null` on this path) / `state.scale.override` (from `cli_flags.epic`).
7. Update phase → `"plan_done"`, `updated_at → now`.

#### Step 2 — WORKFLOW path (mode: standard | multi)

1. Update phase → `"planning"`.
2. Run the Plan segment via the Workflow tool (script path is plugin-shipped; pass `args` as a JSON object — the script defensively parses):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/harness.plan.workflow.js",
     args: {
       task: <task>, repoPath: <repo_path>, lang: <lang>, scope: <scope>,
       userLang: <user_lang>, conventions: <resolved conventions content or "">,
       qaNotes: <qa_discovery_notes>, criticFindings: <critic_findings>,
       mode: <"standard"|"multi">,
       models: { executor: <model|null>, advisor: <model|null>,
                 evaluator: <model|null>, verifier: <model_config.verifier> }
     }
   }
   ```
3. Record the returned run id: `runs.plan → { "runId": "<id>" }`, `updated_at → now`.
4. The segment returns `{ plan: PlanResult, proposals, stats }` (schema-validated — no file re-reads, no 1-line parsing; this corrects the prior "`{ plan, stats }`" description here — the segment has returned `proposals` since slice B). Print per OLC: `  ✓ Plan segment: {stats.proposalsSucceeded}/{stats.proposalsRequested} proposals → synthesis`
5. **Persist `proposals`**: write `.harness/planner/proposals.json` ← the returned `proposals` array, serialized directly (`.harness/planner/` already exists — Step 1 item 7). A direct serialization of the segment's returned object, not content analysis (§Architecture Principles #1 note). Do this BEFORE phase advances to `plan_done` (item 9 below) — a crash between this write and the phase update leaves `phase != "plan_done"`, so the session simply re-enters Step 2 on resume instead of landing in a half-written re-entry state. This write rule applies only to this first dispatch and to a FULL re-run — the Auto-revise re-entry paragraph below (this same §Step 2 — WORKFLOW path) excludes a `reSynthesisOnly: true` re-entry from it.
6. **Orchestrator writes `{docs_path}spec.md` from the PlanResult object**, under the
   `spec_stamp` write protocol above (by name): step 1 immediately before this write,
   step 3 immediately after item 7 confirms the file. Headings in `user_lang`:
   - `### Goal` ← `goal` ; `### Background` ← `background`
   - `### Scope` ← `scope.inScope` / `scope.outOfScope` bullet lists
   - `### Approach` ← `approach`
   - `### Completion Criteria` ← `acceptanceCriteria[]` as GFM checkboxes `- [ ] AC-n: text`
   - `### Testing Strategy` ← `testingStrategy[]` ; `### Edge Cases` ← `edgeCases[]` (omit if empty)
   - `### Risks` ← `risks[]` as `- (source, likelihood) risk — mitigation`
   - `### Implementation Steps` ← `steps[]` (omit if absent)
7. Verify `spec.md` exists (orchestrator-written), then apply the protocol's step 3.
8. **Compute and freeze §Scale Assessment** (that section's compute site) from the in-context `PlanResult` — §1 raw signals from `acceptanceCriteria`/`steps`/`scope.inScope`/`risks`, each `Array.isArray`-guarded per that section's Signal Domain rule; §2 verbatim `sliceHint.recommendation`/`sliceHint.rationale`; §3 override from `cli_flags.epic`. Single read-modify-write into `state.scale.*`.
9. Update phase → `"plan_done"`, `updated_at → now`.
10. **On Workflow error** (launch failure, script error, schema-invalid result): apply §Mode Gate graceful fallback → re-run this step on the INLINE path.

**Auto-revise re-entry (dispatched only from §Step 2.6 / `skills/harness-gate/SKILL.md` §Step 3 Pass A "Auto-revise")** —
re-runs this same segment in re-synthesis form, skipping Propose:
```
Workflow {
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/harness.plan.workflow.js",
  args: {
    task, repoPath, lang, scope, userLang, conventions,
    qaNotes: <qa_discovery_notes>,
    criticFindings: <the CONTENT of {docs_path}plan_critic_findings.md — read it only when
      plan_critic.applied is a recorded, non-null state AND plan_critic.last_findings_path
      is non-null AND the file exists; never use a bare file-existence check (mirrors
      skills/spec/SKILL.md's re-synthesis criticFindings guard). This is a DIFFERENT
      document from the FIRST dispatch's `criticFindings` above, which carries the CONTENT
      of {docs_path}critic_findings.md (the /spec requirements critique) — both dispatches
      of this one segment pass file CONTENT (never a bare path string) under the same
      `criticFindings` arg name; do not confuse the two source files. `harness.plan.workflow.js`
      substitutes this value directly into the synthesis prompt text via render() — it does
      NOT Read a path itself, so passing a path string here silently ships an unusable
      literal into the prompt instead of the findings.>,
    mode, reSynthesisOnly: true,   ← a REAL boolean; the string "false" is truthy and
                                      silently skips Propose (measured wf_6631e9c1-dcd) —
                                      never stringify this value,
    priorProposals: <JSON.parse() of .harness/planner/proposals.json — passed only after
      the proposals.json validity check below passes>,
    models: { ... as above }
  }
}
```

| Arg | Value | 주의 |
|---|---|---|
| `reSynthesisOnly` | `true` | 진짜 boolean 리터럴 — 문자열 `"false"`는 truthy로 평가되어 Propose를 조용히 건너뛴다(실측 `wf_6631e9c1-dcd`). 절대 stringify하지 않는다. |
| `priorProposals` | `.harness/planner/proposals.json`을 `JSON.parse()`한 배열 | proposals.json validity check를 통과한 뒤에만 전달한다. |
| `criticFindings` | `{docs_path}plan_critic_findings.md`의 **CONTENT**(경로 문자열이 아니다) | 최초 디스패치의 `criticFindings`(= `{docs_path}critic_findings.md`, /spec 요구사항 비평)와는 다른 문서다 — 같은 arg 이름을 공유하지만 서로 다른 소스 파일을 가리킨다. |

Record `runs.plan → { "runId": "<id>" }` (overwrites the first dispatch's runId — one slot,
no separate re-entry slot). Re-render `{docs_path}spec.md` from the returned `plan` (same
step-6 mapping above). **Do NOT rewrite `.harness/planner/proposals.json` on this path** — a
`reSynthesisOnly: true` re-entry is scoped to that narrowing exactly: the FIRST dispatch's
file (§Step 2 — WORKFLOW path item 5, which persists `proposals.json` as a direct
serialization of the segment's returned object) stays the sole authoritative copy for the
whole session. This is deliberately narrower than "never write again on any re-entry" — the FULL
re-run branch (this same §Step 2 — WORKFLOW path's proposals.json validity-check failure path)
is the case where §Step 2 item 5's write rule still applies in full and MUST run. Cited by
name rather than by relative position. (Code-confirmed basis for why skipping the write here loses
nothing: the segment's returned `proposals` on this path is exactly `A.priorProposals` with
only falsy elements removed — `.filter(Boolean)`, not further mutated — so persisting it
would at best re-write the same content the first dispatch already wrote, and at worst
silently drop whatever falsy noise the file already lacks; skipping the write is a no-op
either way, not a loss.) The re-render of `{docs_path}spec.md` on this path follows the
`spec_stamp` write protocol above in full, exactly as item 6 does — this is a spec.md write
like any other, and it is the write the interrupted-Auto-revise case turns on.
Re-freeze `state.scale.*` from the returned `PlanResult` (same
step-8 procedure above — an Auto-revise
re-entry is a fresh Step-2-shaped run, not the cross-session "do NOT recompute" case). Then
immediately re-run §Step 2.6's own-critic dispatch (see §Step 2.6 below) — this bypasses the
skip-vs-run decision inside §Step 2.6 entirely, the same entry point Pass A's "Run Critic
anyway" option uses (`skills/harness-gate/SKILL.md` §Step 3) — in the SAME turn, against the freshly re-rendered spec.md;
this is how a low-cost Auto-revise round actually re-checks the revision, with no separate
user gate in between.

**Before dispatching this re-entry**, the orchestrator runs the proposals.json validity
check itself (named and defined once, at `skills/harness-gate/SKILL.md` §Step 3's Auto-revise Exposure Predicate — applied
HERE by the orchestrator before dispatch, not only as a gate-display condition). If it fails
on ANY point, do NOT dispatch with `reSynthesisOnly: true`; instead dispatch a FULL re-run
(`reSynthesisOnly: false`, no `priorProposals`) and print a warning banner (in `user_lang`):
"[harness] ⚠ proposals.json invalid or unusable — re-running full Plan (Propose + Synthesize)
instead of the low-cost re-synthesis." This failure does NOT degrade the path to inline
single — only a genuine Workflow engine error (item 10 above) does that. **On this FULL
re-run branch, §Step 2 — WORKFLOW path item 5's write rule applies in full and MUST run**:
Propose actually runs and produces genuinely new proposals, so
`.harness/planner/proposals.json` MUST be overwritten with them (the Auto-revise re-entry
paragraph's "Do NOT rewrite `.harness/planner/proposals.json` on this path" narrowing applies
ONLY to the `reSynthesisOnly: true` case — cited by name, not by position) — skipping the write here would
silently strand the session on a stale file instead of the write-loss this paragraph's sibling
rule was written to close.

**If the re-entry dispatch is interrupted** (the session ends before the segment returns —
**a Workflow engine error is NOT this case**: item 10 above owns that trigger and re-runs this
step on the INLINE path, which DOES re-render `{docs_path}spec.md` and re-freeze
`state.scale.*`, so none of the no-change guarantees below apply to it): `{docs_path}spec.md` is NOT re-rendered,
`.harness/planner/proposals.json` is NOT touched (neither branch above has written yet),
`state.spec_stamp` is NOT changed (the write protocol's step 1 fires immediately before the
re-render, which is downstream of the segment returning — so an interrupt that never reaches
the return never reaches the invalidation either), and
`plan_critic.round` is NOT incremented — the session simply resumes at the same gate that
offered Auto-revise, and the Auto-revise Exposure Predicate re-evaluates against the
still-unmodified files. (Observed, not re-derived here: a 2026-08-19 run recorded the
first-dispatch `proposals.json` shrinking from 15,807 bytes to 10,793 bytes across a
resume — the mechanism was never reproduced, so this is cited only as a dated measurement,
not as evidence for how this paragraph's rules behave.)

#### Step 2.6: Plan Critic

*Runs after Step 2, on BOTH paths — a step common to both, not a third path alternative (the
INLINE/WORKFLOW split above is a path branch; this heading sits one level deeper only
because AC-4 fixes its exact text, not because it is a third branch).*

**Plan Critic routing predicate (single source — §Session Recovery's `planning`/`plan_done`
row below cites this by name; it does not restate the conditions):** evaluated in this
fixed order —
- **(a)** `{docs_path}spec.md` does NOT exist → route to Step 2 (nothing to critique yet).
- **(b)** spec.md exists AND `state.plan_critic` has no recorded `applied` value → route to
  Step 2.6, here.
- **(c)** spec.md exists AND `state.plan_critic.applied` IS recorded (`"executed"`,
  `"skipped"`, OR `"failed"` — any of the three, not only success) → route to Step 3.

  **The predicate is "a record exists", never "the record says success"**: using
  `applied == "executed"` here would re-charge a `"failed"` session's critic on every resume;
  using bare file-existence on `plan_critic_findings.md` would reproduce the exact
  "first run permanently skips" failure this predicate exists to prevent (AC-6).

**Skip-vs-run decision (this step's own — separate from the routing predicate above, which
only decides whether to REACH this step):** on entry, check whether
`{docs_path}critic_findings.md` (the **/spec** requirements critique — NOT this step's own
findings file) already exists (a sanctioned read — §Architecture Principles #1 (7)).

- **Exists** → this task was handed off from /spec with its own critique already produced;
  do not spend a second cold-review pass duplicating it. Set `plan_critic.applied =
  "skipped"`, `plan_critic.source = "carried_over"`, `plan_critic.last_findings_path = null`,
  `plan_critic.failure_reason = null`, `plan_critic.counts = null`,
  `plan_critic.spec_stamp_at_critic = null` (this branch ran no critic, so there is no spec
  version it judged), and leave
  `plan_critic.round` UNCHANGED at its existing value — a carried-over skip does not consume
  a revision round (all 7 fields, per the single read-modify-write rule below). Gate display
  (`skills/harness-gate/SKILL.md` §Step 3 Pass A row ③) parses counts FROM `{docs_path}critic_findings.md`'s `## Summary`
  line for this session (Architecture Principles #1 (7)'s "carried-over branch" read) and
  shows the `carried over from /spec` literal.
- **Does not exist** → dispatch this step's own critic below (WORKFLOW or INLINE, per
  `path_resolved`); `plan_critic.source = "own"` in that case.

**Pre-dispatch stamp check (own-critic branch only):** before the delete below, and before
dispatching anything, check `state.spec_stamp`. If it is `null` or malformed, do NOT delete and
do NOT dispatch — take failure branch (iii) with `failure_reason = "spec_stamp_invalid"`. That
state means the §Step 2 write protocol did not finish, so `{docs_path}spec.md` is a partial or
abandoned write and critiquing it spends a dispatch on a document no one intends to keep. The
latch below tests the same condition, but only AFTER the dispatch has already been paid for;
this is the same test moved to where it can still prevent the cost. It also protects the
existing findings file, which the delete below would otherwise destroy on the way to a critic
pass that was going to fail the latch anyway.

**Pre-dispatch delete (own-critic branch only — both WORKFLOW and INLINE):** immediately
before dispatching, delete `{docs_path}plan_critic_findings.md` if it exists. This is what
makes the latch below able to conclude anything from mere existence: the path is fixed and
reused every pass, so without this delete a leftover from an earlier pass is
indistinguishable from a file this pass wrote — the routing predicate above already names
bare file-existence as a trap for exactly that reason. If the delete itself fails (permission,
lock), do NOT dispatch: take failure branch (iii) below with
`failure_reason = "findings_file_stale"`, since a pass that cannot clear the old file cannot
later prove it wrote a new one.

**Crash window this delete opens, and where it lands** — recorded because it changes a claim
made elsewhere in this file. If the delete succeeds and the dispatch is then interrupted, the
previous pass's `plan_critic` record survives while the file its `last_findings_path` names
does not. `skills/harness-gate/SKILL.md` §Well-formedness Determination requires that file to exist, so the record is
**malformed** and `skills/harness-gate/SKILL.md` §Step 3 Pass A renders **row ④**, whose "Retry Critic" option re-runs this
same dispatch. Before this delete existed the old file survived such an interrupt and the same
resume landed on row ①-b instead. Both rows recover by re-running the critic, so the recovery
is unchanged; the row is not, and §Step 2.6's Interruption cost paragraph below is written
against the new one.

**WORKFLOW branch** (`path_resolved == "workflow"`) — reuse `workflows/spec.eval.workflow.js`
with ZERO code changes to this call's own args contract:
<!-- SYNC-WITH: workflows/spec.eval.workflow.js §contract -->
```
Workflow {
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/spec.eval.workflow.js",
  args: {
    task: <task>, userLang: <user_lang>, specContent: <{docs_path}spec.md content>,
    qaNotes: <qa_discovery_notes>,
    criticFindingsPath: "{docs_path}plan_critic_findings.md",
    models: { advisor: <model_config.advisor or null>, evaluator: <model_config.evaluator or null> }
  }
}
```
The segment returns a schema-validated `CriticReport` (`counts`/`items`/`summary` — see
`workflows/_reference/schemas.md`). Print per OLC: `  Critic: workflow (schema-validated) — {report.summary}`.

**INLINE branch** (`path_resolved == "inline"`) — dispatch `templates/spec/critic_inline.md`
with `{spec_path}` = `{docs_path}spec.md` (a PATH, not content — see that template's header),
`{critic_findings_path}` = `{docs_path}plan_critic_findings.md`, `{user_lang}`,
`{task_description}`.
   - Model: if preset ≠ "default", use `model_config.advisor`.

Parse the 1-line return per §Sub-agent Return Value Rules: expect the leading keyword
`critic_findings written` followed by `Critical=N, Major=M, Minor=K`. Print per OLC:
`  Critic: inline (1-line parse) — {first line}`. **Parsing note (a declared gap, not solved
here)**: `critic_findings written` is not one of §OLC's listed 1-line return verbs
(`generated`/`changed`/`written`/`conventions written`/`auto_fix_patch written`) — recorded
in this slice's changes.md, not closed by inventing a new Glossary entry (`name_manifest.md`
§3 reserves only `Decision`/`Critic`/`Next cmd`/`Epic planned` for this epic).

**Latching `applied = "executed"`** (either branch above): only after confirming
`{docs_path}plan_critic_findings.md` (a) exists AND (b) `state.spec_stamp` is non-`null`.
Point (a) closes a WORKFLOW-specific gap: a segment can return a schema-valid `CriticReport`
while the underlying agent never actually wrote the file this pass
(`workflows/spec.eval.workflow.js`'s own contract comment defers that verification to the
orchestrator — "verify existence orchestrator-side before gate display"). Existence carries
that weight **only because of the pre-dispatch delete above** — it did not before, which is
why this check used to be an mtime comparison instead. Point (b) refuses to stamp a critic
verdict onto a spec.md whose own stamp is invalid (a write protocol interrupted mid-flight):
there is nothing coherent to record as `spec_stamp_at_critic`. If either check fails, treat
it exactly like an inline parse failure — see failure branch (iii) below.

**Single read-modify-write** — `plan_critic` (all 7 fields: `applied`, `round`,
`last_findings_path`, `failure_reason`, `source`, `counts`, `spec_stamp_at_critic`) +
`phase` are written together,
once, per Step 2.6 entry (covering the carried-over branch above and each failure branch
below):
- On success: `applied = "executed"`, `source = "own"`, `last_findings_path =
  "{docs_path}plan_critic_findings.md"`, `counts = report.counts` (WORKFLOW) or the parsed
  `{critical, major, minor}` (INLINE), `failure_reason = null`,
  `spec_stamp_at_critic = <the current `state.spec_stamp`, copied by value>` — the latch
  above has already confirmed it is non-`null`.
  `round`: unset (`null`, read as 0) on the FIRST Step 2.6 run this session. On a re-run
  immediately following an Auto-revise re-entry (§Step 2 WORKFLOW path — Auto-revise
  re-entry, same turn), THIS write also carries `round: 0 → 1` — **the only place `round` is
  ever incremented** (mirrors `skills/spec/SKILL.md`'s `critic.round: 0 → 1` precedent:
  prepared logically between re-synthesis and re-critic, written atomically with this
  re-critic transition). `round` is bounded at 1 by design — `skills/harness-gate/SKILL.md` §Step 3 Pass A's Auto-revise
  option disappears once `round == 1` (see the Auto-revise Exposure Predicate, `skills/harness-gate/SKILL.md` §Step 3).
- Gate display (`skills/harness-gate/SKILL.md` §Step 3) null-safe-guards `counts == null` / `last_findings_path == null` /
  file-not-found independently (mirrors `skills/spec/SKILL.md` §Session Recovery — its
  `"approved"` branch's `null-safe guard`) — never
  dereferences without checking first.

**Failure handling — 3-way** (applies to the "own" dispatch only; the carried-over branch
above never reaches this):
- **(i) Workflow engine error** (launch failure, script error, schema-invalid result) →
  apply §Mode Gate graceful fallback (re-attempt inline, same as Step 2's own error
  handling) — a genuine engine fault, not a policy decision. This branch itself does NOT
  write `plan_critic` — only the inline re-attempt's own outcome (success above, or a
  failure branch below) performs the single write.
- **(ii) Permission denial is NOT an engine error** → route to
  `templates/_shared/mode_gate.md` rule 3's denial branch (disclose, never downgrade
  silently) — the same banner this file already uses at §Mode Gate:
  `[harness] ⚠ Workflow denied (not an engine error) — path NOT auto-downgraded.` Step 2.6's
  own denial handling does NOT rewrite `path_resolved` — that field is set once at §Step 1
  item 9 (re-resolved only by §Session Recovery step 6); a mid-Step-2.6 denial leaves it
  exactly as it already was. `plan_critic.applied` is NOT recorded by this branch — the
  record stays unwritten this pass. **Turn control**: this branch does NOT halt — control
  proceeds to §After Plan Phase exactly as failure branch (iii) below does (same "progress is
  not blocked" policy). What happens next depends on `run_style`: under `run_style ==
  "phase"`, §After Plan Phase's own halt fires before Step 3 is ever reached, so the NEXT
  session's §Session Recovery re-enters via routing predicate (b) by name (the routing
  predicate defined above — not restated here) — landing back on Step 2.6, not Step 3. Under
  `run_style == "auto"`, §After Plan Phase does not halt, so Step 3 is reached in THIS SAME
  turn with `plan_critic` still unrecorded — `skills/harness-gate/SKILL.md` §Step 3 Pass A row ④ (failed / unrecorded /
  unknown, defined below) is what renders in that case. If the user then picks "Proceed as-is"
  there instead of "Retry Critic", `phase` advances to `generate_ready` and no later session
  re-enters Step 2.6 for this task — `plan_critic` stays permanently unrecorded for it (a
  disclosed audit gap, not a silent one: row ④'s banner states this).
- **(iii) 1-line parse failure** (INLINE only) or the latching check above fails → set
  `plan_critic.applied = "failed"`, `plan_critic.failure_reason = "parse_failed"` (INLINE
  parse) or `"findings_file_missing"` (latch point (a): no findings file after the dispatch)
  or `"spec_stamp_invalid"` (latch point (b): `spec_stamp` was `null` at latch time) or
  `"findings_file_stale"` (the pre-dispatch delete itself failed, so nothing was dispatched) —
  three distinct causes and therefore three distinct strings, since this field is the only
  thing row ④'s banner has to tell the user which one happened,
  `plan_critic.last_findings_path = null`,
  `plan_critic.source = "own"`, `plan_critic.counts = null`,
  `plan_critic.spec_stamp_at_critic = null` — **`null`, not UNCHANGED**, unlike `round` on
  the same line: a stamp left over from an earlier pass could coincidentally equal the
  current `spec_stamp` and turn a failed critic into a not-stale verdict, which is the one
  outcome this branch must never produce — `plan_critic.round` UNCHANGED
  (all 7 fields, matching the success and carried-over branches' enumeration format above) —
  banner shown (`[harness] ⚠ Plan Critic failed — fallback: skipped, spec unreviewed`).
  **Progress is NOT blocked** — proceed to §After Plan Phase / Step 3 regardless. **Known
  gap**: leaving `round` UNCHANGED means a failed re-critic dispatched right after an
  Auto-revise re-entry does not consume the single increment a successful re-critic would have
  (§Step 2.6's single-write note above) — the Auto-revise Exposure Predicate's point 3 can
  therefore still hold on a later "Retry Critic" attempt. Recorded here as a known gap, not
  closed in this slice.

**Interruption cost**: if the SAME-turn re-critic dispatch this section describes (triggered
from §Step 2 WORKFLOW path's Auto-revise re-entry) is itself interrupted before its write
completes, resume lands on `skills/harness-gate/SKILL.md` §Step 3 Pass A **row ④** (malformed — the pre-dispatch delete
above already removed the file the FIRST pass's `last_findings_path` names, and
`skills/harness-gate/SKILL.md` §Well-formedness Determination requires it to exist). **This used to be row ①-b** and is not
any more: before the pre-dispatch delete, the first pass's file survived the interrupt, the
record stayed well-formed, and the staleness axis decided the row. The staleness the stamps
would have shown is still real — the re-entry advanced `spec_stamp.generation` past the
recorded `spec_stamp_at_critic`, or left `spec_stamp` at `null` — but row ④ is evaluated
first, so it never reaches that axis; choosing "Run Critic anyway" there re-charges one critic
dispatch (idempotent — it simply re-runs this same own-critic dispatch again).

**Why no `runs` slot is recorded here**: `state.runs` has exactly `{plan, build, eval}` — no
reserved fourth slot for Step 2.6. Recording under `runs.eval` would silently clobber Step
5's own record (`runs.eval` is Step 5 — WORKFLOW path item 3, below). Step 2.6's own run id
(WORKFLOW branch only) is therefore NOT persisted in `state.runs` — a known, accepted gap
(recorded in this slice's changes.md), not an oversight.

#### After Plan Phase

Print: `[harness] Plan complete.`

**Every `run_style`** (auto / phase / step) ends the session here — the gate is
`/harness-gate`, a separate skill (SPEC rev.9 (b): an `auto` session no longer runs
straight through to the gate any more; the stop is structural, not a rule). Print the
`## Scale Assessment` block (its After-Plan render site; `skills/harness-gate/SKILL.md` §Step 3
Pass B renders the same frozen `state.scale.*` values again in the next session) using the
values frozen at the end of Step 2. Then print the §Session Boundary block (Type A: After
Plan), whose Resume row is `/harness-gate`, and print `Next → /harness-gate`. Halt. **If this
session carries `cli_flags.epic` or a §Scale Assessment epic recommendation**, the gate's
Pass B leads with "Plan as epic" and prints `/harness-build --epic`;
`skills/harness-build/SKILL.md` §Step 3.5 there fills its table with no in-context
`PlanResult` — see that section's degraded restore order, by name, for how it fills the table
without one.

---

## Sub-command: doctor

`/harness doctor` — read-only environment diagnostic. No arguments, no `.harness/state.json`
(neither read nor written), no git branch, no Mode Gate resolution, no sub-agents, no Workflow
dispatch (orchestrator-inline). Nothing is written anywhere — not `.harness/`, not `docs/`, not
`.gitignore`, not either installed plugin copy.
It does **not** print the §Session Boundary block: doctor is not a session, so no boundary is crossed.
Every path it reads is a fixed constant or a value resolved at run time from `${CLAUDE_PLUGIN_ROOT}` and `git rev-parse --show-toplevel` — never a user-supplied argument.

Reached only through the read-only carve-out at the top of §Session Recovery.

**Known install locations.** Two, and only these two are fixed constants:
`~/.claude/plugins/marketplaces/agent-harness-marketplace/` and
`~/.claude/plugins/cache/agent-harness-marketplace/agent-harness/<version>/`, where `<version>` is
a directory name discovered at run time, never a constant written here. The cache path's
`agent-harness/` segment is load-bearing: drop it and the location never resolves, so items ① and
④ report `⚠` forever even in a healthy environment.

**Output contract.** Follow `templates/_shared/status_format.md` §Label rules and its open-label
rule, with the prefix `[harness doctor]`: labels English raw, values per the Preserved-English
Glossary and remediation in `user_lang`, one `✓` or `⚠` per item. doctor does not read
`.harness/state.json` and does not render that file's session status block.

**No lint checks this section's item-number citations** — `§Step 1.5 items 1–2`, `§Storage
Criteria`, `mode_gate.md` `rule 2`. They are prose pointers into other files, so a renumbering
upstream rots them silently and nothing turns red. Re-read the cited section whenever either file
changes. **Clarification appended 2026-09-03** (the sentence above stays true as written):
`scripts/verify_sync_markers.py`'s `harness-steps` mode compares Step-number citations against this
file's own Step headings, which touches the first citation quoted above in a way worth stating
precisely — the two occurrences of that citation in this section behave differently. The real
pointer, in item ⑤ below, carries a plugin-root path beside it, so the lint recognises it as
another file's and leaves it alone. The occurrence in the sentence above is a bare quoted example
with no path beside it, so the lint compares its number against *this* file's own
`### Step 1.5: Convention Scan` and passes it for the wrong reason. Either way the sentence above
holds: a team-memory renumbering still turns nothing red, and the **item** numbers are checked by
nothing at all. Both directions are recorded in that script's own limits section.

Deliberately, this paragraph introduces no new §-prefixed token of its own — every figure that
script publishes counts the tokens in THIS file, so prose about the count perturbs the count. That
happened three times while this change was being written; it is cheaper to avoid the shape than to
chase the arithmetic.

① **Installed-copy CR contamination.** For each known install location, read every
`*.workflow.js` under it as bytes and count the occurrences of the byte `0x0D`; the verdict is that
count, not the output of a pattern search. Do not build the pattern with an ANSI-C quoted escape —
in this shell that argument reaches the process empty between invocations and every file matches.
Result contract, in this order: the location is absent or unreadable → `⚠`, degraded, never `✓`;
the location resolves but holds no `*.workflow.js` at all → `⚠`, an incomplete install; files are
present and the count is zero → `✓`; files are present and the count is non-zero → `⚠`,
contaminated.
Remediation differs by location, and which one applies is decided at run time, never asserted in
advance. Two tests decide it, in this order, and the first is **not sufficient on its own**:
(1) `git -C <location> rev-parse --is-inside-work-tree` prints exactly `true`, and
(2) `git -C <location> ls-files -- workflows/` prints at least one path. Test (1) alone answers
`true` for a copy that merely sits inside some unrelated repository — a plugin directory under a
version-controlled home directory does — and there those paths are untracked, so a checkout cannot
bring back what a delete removed. Where both hold, the work-tree repair `.gitattributes`
prescribes applies; where either fails, a fresh install of the plugin is the only remedy. A cache
version directory is judged by the same two tests rather than by an assumption about caches.
That repair removes the contaminated files and checks them out again. **Every command is anchored
to the location this item flagged, never to the current directory** — `/harness` runs in arbitrary
projects, so an unanchored `rm workflows/*.workflow.js` deletes the caller's own files while the
install copy stays contaminated:

```
rm <location>/workflows/*.workflow.js && git -C <location> checkout -- workflows/
```

Never offer `git add --renormalize` here. `.gitattributes` records that these index blobs are
already LF, so it is a no-op, and deleting the index first does not make it work — with no index
to match, the re-add stages the entire tree as deleted.

② **Workflow tool availability.** Report what this session's tool list shows, and say in the
output that the finding holds for this session only. Do not run an active probe: the condition
cited from `templates/_shared/mode_gate.md` rule 2 is an observational one, so probing it would
contradict the rule being reported. The tool being absent from that list is not a fault: print
`— (Workflow tool not offered this session)`, which is **not** a `⚠`.

③ **git work tree.** Run `git rev-parse --is-inside-work-tree` and decide on whether stdout is
exactly `true` — not on the exit code, which is zero while `false` is printed inside a `.git/`
directory. `{CLAUDE_PLUGIN_ROOT}/skills/team-memory/SKILL.md` §Step 1.5 item 1 owns this rule; the
deciding clause is repeated here because item ⑤ reuses this item's answer — change it there first.
Not being a work tree is not a fault: print `— (not a git work tree)`, which is **not** a `⚠`,
exactly as ⑤ (iii) does with the same fact.

④ **Version and content drift**, on three axes, over the known install locations above.
   (a) Directory name against the `plugin.json` inside it, **for cache version directories only** —
   that is where the version is part of the name. The marketplace location carries no version in
   its directory name, so on this axis it prints `— (no version in the directory name)` and is not
   a mismatch; reading it as one makes ④ warn forever in a healthy environment. The source of truth
   is that `plugin.json` `$.version`, not the directory name. A directory whose name carries a
   **backup suffix** — a suffix beginning `.backup-` after the version string — is excluded from
   this axis and listed separately. Print the resolved value of
   `${CLAUDE_PLUGIN_ROOT}` as the running copy; if it is empty or cannot be resolved, print
   `— (plugin root unresolved)` and `⚠`.
   (b) Each install copy's `plugin.json` against the repository's `plugin.json`.
   (c) Content identity. The left-hand side is `git ls-files`, run from the tree root resolved by
   `git rev-parse --show-toplevel` — run from a subdirectory it lists only that subtree and every
   drift figure below shrinks silently. The right-hand side is the
   comparison copy's whole file set minus anything under `.git/` and under `.in_use/`; there is no
   whitelist of content directories, because a new top-level one would then go unseen. Do not
   enumerate the left-hand side from disk. Report three figures separately: how many files in the
   intersection differ in content; how many tracked files are missing from the install copy; and,
   as paths rather than a count, every path present only in the install copy that the two
   exclusions do not cover — that listing is the only signal that the exclusion list has aged.
   Classify each differing pair as EOL-only or genuinely different by removing `0x0D` and comparing
   again, because this repository normalises only some file types and a checkout made with
   `core.autocrlf=true` produces EOL-only differences in a copy that is otherwise in sync. Do not
   copy that attributes file's glob list into this document.
   **Choosing the comparison copy**, in order: (i) if `${CLAUDE_PLUGIN_ROOT}` resolved, compare that
   copy and mark it `(loaded copy)` — it is the one actually running; (ii) **in addition**, and not
   only when (i) failed, take the known install locations above — the marketplace copy, and those cache version directories whose
   `plugin.json` `$.version` equals the repository's, after excluding backup-suffixed names by the
   same rule axis (a) uses. If nothing matches, do not skip the comparison: compare against the
   candidate whose internal `plugin.json` `$.version` is highest by semver and print
   `— (no installed copy at the repository's version; compared <dirname>, whose plugin.json reports <version>)`.
   Do not choose by directory name — a copy whose name and contents disagree is a case this axis
   has actually met. A candidate whose `$.version` does not parse as semver is dropped from that
   choice and the fact is printed on one line. On a tie at the highest value, list them all and
   compare each. If more than one candidate matches, list them all and compare each rather than
   picking one. (iii) If the path from (i) is none of the paths from (ii), print `⚠` — the copy
   compared is not the copy running. (ii) is evaluated even when (i) resolved, precisely so (iii)
   has a set to compare against; making (ii) an `otherwise` branch leaves (iii) unreachable on
   every path.
   Axes (b) and (c) run **only when the current working tree is this plugin's own source
   repository**: the tree root holds `.claude-plugin/plugin.json` and its `$.name` equals the
   install copy's. Otherwise print `— (not the plugin source repo)`, which is **not** a `⚠`, and
   judge ④ on axis (a) alone. No count, file list, or version string is written into this document
   as a constant; every one of them is measured at run time and printed.

⑤ **Team-memory store ignore state.** (i) Apply the verdict rules of
`{CLAUDE_PLUGIN_ROOT}/skills/team-memory/SKILL.md` §Step 1.5 items 1–2, together with the
§Storage Criteria table that item 2 itself names, by name — do not restate the slug prefixes or
the category directory names, which is the part that drifts. (ii) That plugin-root path is the read
path, never a repository-relative one, because `/harness` runs in arbitrary projects; if the read
fails, narrow the probe to the store directory and its `README.md`, say in the output that it was
narrowed, and never report a narrowed verdict as `✓`. (iii) Argument-free form: reuse the work-tree
answer item ③ already produced instead of running item 1 again, and when it is not a work tree
print `— (not a git work tree)`, which is **not** a `⚠`. (iv) When it is one, anchor at the
repository root and run item 2's check over every built-in category the cited table lists — the
store directory, its `README.md`, each category directory, and one record-shaped path per category;
do not add `-q`, which fails with several paths. (v) doctor does not create any of those paths: as
that item states, the check matches patterns rather than the file system. (vi) Exit codes, as that
item defines them: `0` = at least one path is ignored → `⚠`; `1` = none → `✓`; `128` = undetermined
→ `⚠`. (vii) A `⚠` here is a report, not a gate — that item's "do not raise the gate" governs a
gate doctor does not have; items 3–6 of that section, which own the gate and the `.gitignore`
repair, do not apply here; and two limits stay uncovered and are printed with the verdict, namely a
user-defined category, which only `save` Step 1's own output can enumerate, and the *Known limit*
that item records for itself, an ignore pattern aimed at the free-form slug that follows a category
prefix.

⑥ **Project defaults.** Apply `templates/_shared/project_defaults.md` by name. Walk its three
sources in its own precedence order, treat the winning source as winning wholesale, and apply that
file's parse rule as that file scopes it rather than restating it here. Report which source won,
what the final resolved reading is, and on the same line that the sources below the winner were
ignored wholesale rather than merged. When no source declares anything — the common case — print
`— (no defaults declared in any source)`; that is **not** a `⚠`, and there is no winner to name.

### Example output

```
[harness doctor]
  ① Installed-copy CR   : ✓
  ② Workflow tool       : ✓  (this session's tool list only)
  ③ git work tree       : ✓
  ④ Install drift       : ⚠  <measured summary>
  ⑤ Memory store ignore : ⚠  <measured summary>
  ⑥ Project defaults    : ✓  <winning source>
```

A green ① or ④ says the copies on disk are current. It does not say the skill body this process is
running was loaded from them.

<!-- BLOCK-START:hx-model-selection v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->
## Model Selection

Preset table + rules: see `templates/_shared/model_config.md`.

Role map: Architect / Senior Developer / QA Specialist / Synthesis → advisor; Lead Developer & Implementation & Generator(single) → executor; Combined / Code Quality / Test & Stability Advisor → advisor; Evaluator → evaluator; Verify (Layer 1) → verifier (haiku default); Cold review → evaluator (same role as Evaluator — it is the same review tier, `skills/harness-build/SKILL.md` §Step 5 "Cold Review Input Collection" / `skills/harness-build/SKILL.md` §Step 6).

- INLINE path: pass `model` per role at sub-agent launch (preset ≠ "default").
- WORKFLOW path: pass the whole resolved map once as `args.models` (`{executor, advisor, evaluator, verifier}`; null role = inherit) — segment scripts apply it per agent.

> **Verifier defaults to haiku across all presets.** Layer 1 only executes commands and parses exit codes — lowest-cost model is always sufficient. Override with `--verifier-model sonnet|opus` for sensitive mechanical verification (e.g., concurrency, complex test failures). Opt-in only. When set to `sonnet` or `opus`, a cost warning is shown in Setup Summary.
<!-- BLOCK-END:hx-model-selection v1 -->

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Architecture Principles

The following principles are invariant constraints for the harness Orchestrator.

1. **Orchestrator reads no intermediate files.** Exceptions — reads only, exactly 7 (writes are a separate category, not counted in this list — see the `>` notes below; three follow, of which the second covers writes):
   - (1) spec.md at plan gate and at the After-Plan boundary (§Scale Assessment signal computation, including the INLINE fallback) — the orchestrator also WRITES spec.md/changes.md/slice_plan.md from returned objects, and `cold_review.md` on the WORKFLOW path only (`skills/harness-build/SKILL.md` §Step 5, from the segment's returned `coldFindings`) — the INLINE path's `cold_review.md` is instead written by the cold-review sub-agent itself (`skills/harness-build/SKILL.md` §Step 6), never by the orchestrator (AC-27); writing final artifacts is not reading intermediates.
   - (2) qa_report.md at verdict gate (INLINE path; WORKFLOW path on session resume — verdict reconstruction)
   - (3) changes.md path-extraction on WORKFLOW-path resume when `workflow_ctx` is null (changedFilesList reconstruction — repo-relative paths only, reasons stripped; no content analysis). See `skills/harness-build/SKILL.md` §Step 5 — WORKFLOW path `changedFilesList` source priority.
   - (4) verify_report.md path (for the user message) and verify_report.md failing-file extraction for Auto-fix Proposer dispatch:
     Orchestrator reads verify_report.md to extract failing file paths only (no content analysis).
     Extracted paths pass through Path Validator (kind=file_reference) and are capped at 5.
     See `skills/harness-build/SKILL.md` §Step 5 — Auto-fix dispatch for the exact procedure.
   - (5) Step 2's Discovery Notes Injection reads (`qa_notes.md` / `critic_findings.md` content passed to the planner). Not a newly introduced exception — this documents an existing read that this list previously omitted; see §Step 2 (Plan Phase) — Discovery Notes Injection.
   - (6) `plan_critic_findings.md` Summary parsing + `.harness/planner/proposals.json` re-entry read.
   - (7) Gate-display critic count parsing (the carried-over branch's `{docs_path}critic_findings.md`; the resume redisplay's `plan_critic_findings.md`) — distinct in purpose from (5)'s planner-injection read.

   > Apply-before `--- a/` / `+++ b/` diff header lines (2 metadata lines per file — hunk body is delegated to Edit tool). This is NOT a violation of this principle.
   > `.harness/planner/proposals.json` write: an intermediate file, but the orchestrator writes it as a direct serialization of the segment's returned proposals object — no content analysis. Writing it is not "reading intermediates" either.
   > §Step 2.6's pre-dispatch delete of `{docs_path}plan_critic_findings.md` is a third category again — neither a read nor a write of content — and does not enlarge this list, on the same footing as `skills/harness-build/SKILL.md` §Step 8's `.harness/` delete, which has never been counted here. Stated because the delete is new and the list's count is quoted in several places: removing a file reads nothing from it.
   > Of entries (1), (6) and (7): `§Scale Assessment`, `§Step 2.6`, `plan_critic_findings.md`, `.harness/planner/proposals.json`, and `slice_plan.md` are now real, written sections/artifacts — those reads fire today. `cold_review.md` is no longer declared only either — `skills/harness-build/SKILL.md` §Step 5 (WORKFLOW) / `skills/harness-build/SKILL.md` §Step 6 (INLINE) write it starting this slice, per the path split in entry (1) above.

2. **Auto-fix Proposer is the only sub-agent that directly Reads SOURCE files among orchestrator-dispatched agents.** (Segment-script agents explore the codebase themselves by design — they run inside the engine's autonomous span.) Other inline sub-agents receive content only through template variables, with one narrower exception: an inline sub-agent MAY instead receive a `{docs_path}` artifact PATH that the orchestrator explicitly hands it (e.g. `templates/spec/critic_inline.md`'s `{spec_path}`) and read that one file itself — this is distinct from "source files" (the Auto-fix Proposer's exclusive carve-out above covers repository source, not `{docs_path}` artifacts) and does not enlarge §Architecture Principles #1's exception list, which stays at 7 items (AC-27).

3. **Paths only to sub-agents; never file contents** (ephemeral digests passed inside a segment run excepted — they never enter the orchestrator's context beyond `workflow_ctx` storage; `specContent` passed as a Build segment arg (`skills/harness-build/SKILL.md` §Step 4 — WORKFLOW path) and as an Eval segment arg (`skills/harness-build/SKILL.md` §Step 5 — WORKFLOW path) is also an explicit exception — spec.md content, not a path, crosses into segment `args` because size, not path-vs-content, is the actual constraint; the same exception now also covers `specContent` passed to `workflows/spec.eval.workflow.js` at §Step 2.6's WORKFLOW branch).

4. **Session-wide invariants** (see §State Machine — Auto-fix State Transition Table):
   - Auto-fix: at most 1 attempt per session (`verify.autofix_attempted` once-only — not reset on round increment).
   - Layer 1 retries: max 3. Do NOT reset after Auto-fix Apply.

5. **All external paths pass through Path Validator before use** (see §Path Validator below).

6. **Gates never enter segment scripts.** The 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) are rendered by this orchestrator between segment runs. `scripts/verify_meta_literal.py` guards this at lint time by rejecting gate-marker tokens — the `<HARD-GATE>` tag form, `AskUserQuestion`, and the `Apply patch` option label — inside any segment script. This is a marker-based tripwire, not a proof of gate-freedom: it deliberately does NOT flag the spaced prose form `HARD GATE #N`, which segment scripts legitimately use in comments to note that gates live here in the orchestrator. The spec-confirm gate (`skills/harness-gate/SKILL.md` §Step 3) renders as up to two sequential passes (Pass A, Pass B) inside ONE `<HARD-GATE>` tag — a pass is not a separate gate, so the count above stays 3.

<!-- BLOCK-START:hx-path-validator v1 — shared by /harness, /harness-gate, /harness-build; edit every copy in one commit and bump the version -->
### Path Validator

Orchestrator internal conceptual function. Call sites: `--output-dir` parsing (Step 1.2), `{failing_files_list}` injection (Step 5), Edit tool unified diff Apply (Step 5), Session Recovery re-validation (Session Recovery), cold-review input list collection (Step 5, `kind=file_reference`), cold `finding.file` validation — WORKFLOW path only (Step 5, `kind=file_reference`).

```
validate_path(path, kind) where kind ∈ {output_dir, file_reference, diff_target}

  0. (kind == output_dir only) Empty string → halt "output-dir cannot be empty."
  1. Normalize: \ → / (OS-independent). UNC (\\server\share or //server/share) → halt.
  2. Absolute path: ^/ or ^[A-Za-z]:/ → halt.
  3. Segment-level ..: path.split("/") — any segment == ".." → halt (exact segment match, not substring).
  4. kind-specific:
     - output_dir:
         First segment (path.split("/")[0]) ∉ {memory, spec, planner, generator,
         evaluator, verify, harness, .harness}.
         Special case: if first segment == "docs", second segment
         MUST == "harness" (path startswith "docs/harness/"). Else halt:
         "output-dir under docs/ must be docs/harness/..." (allows /spec handoff
         path docs/harness/<slug>/ while still blocking other docs/* overrides.)
     - file_reference (failing_files_list):
         (a) relative path, (b) no .. segment, (c) inside repo_path,
         (d) outside .harness/, docs/harness/*, memory/, .git/.
     - diff_target (unified diff --- a/ / +++ b/ headers):
         file_reference conditions + inside scope filter +
         outside .harness/, docs/harness/*, memory/, .git/.
  5. On failure: return specific halt message describing the violation.
```

**Attack vector → Path Validator step mapping:**

| Attack vector | Blocked at step |
|---|---|
| `--output-dir .harness` | Step 4 (kind=output_dir, first segment reserved) |
| `--output-dir docs/../../etc` | Step 3 (segment `..` rejection) |
| `--output-dir \\server\share` | Step 1 (normalization + UNC rejection) |
| `--output-dir /absolute/path` | Step 2 (absolute path rejection) |
| `--output-dir memory/foo` | Step 4 (first segment reserved) |
| `--output-dir ` (empty) | Step 0 (empty string, kind=output_dir) |
<!-- BLOCK-END:hx-path-validator v1 -->

## Key Rules

- **Never skip phases.** Always Plan → Generate → Verify → Evaluate. The `plan_done →
  completed` epic-exit transition (§State Transition Diagram, by name) is a deliberate,
  by-design exception to this rule, not a violation of it.
- **Confirmation gates are non-negotiable.** No implicit approval. Gates live ONLY in this orchestrator — never in a segment script.
- **Stay within scope.** Do not modify files outside scope.
- **Evaluator must be isolated.** Anchor-free input. Never pass Generator reasoning.
- **Planner proposals must be independent.** Never share one persona's work with another during proposal (the plan segment's `parallel()` enforces this).
- **Generator advisors review the plan, not code.** Advisory before implementation.
- **Use available skills.** Search by keyword, not plugin name. Proceed without if none found.
- **User language.** All user-facing output in `user_lang` per §Output Language Contract. Glossary tokens (`PASS`/`FAIL`/`Verdict`/`[harness]`/etc.) preserved English. Inline parser keywords MUST remain English raw — see §Sub-agent Return Value Rules.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill's execution WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **Intermediate outputs are ephemeral.** Only final artifacts preserved in `docs/`.
- **Orchestrator reads no intermediate files.** See §Architecture Principles for full exception list.
- **1-line return parsing (INLINE path only).** Only first line of an inline sub-agent return is used for state decisions. WORKFLOW path branches on schema-validated objects.
- **Workflow args are a JSON object;** segment scripts defensively parse (`args` may arrive as a JSON string — engine behavior). Never put user-gate decisions into args.
- **Graceful engine fallback.** Any Workflow failure degrades to the inline single path with a notice — never a hard error.
