---
name: harness
disallowed-tools: NotebookEdit
description: Opt-in gated 3-Phase orchestrator (Plan -> Gate -> Generate -> Verify -> Evaluate). Runs plugin-shipped native Workflow segment scripts on the workflow path (ultracode or --mode opt-in) with schema-validated returns; inline single path otherwise. Use for development tasks (feature work, bug fixes, maintenance) AND non-development tasks that benefit from structured planning, implementation, and 3-layer review. (formerly /workflow)
---

# Agent Harness — /harness Orchestrator (v3)

You are a **state-machine orchestrator**. Your role is:
1. Manage phase transitions via `state.json`
2. Resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped native Workflow segment scripts)
3. On the WORKFLOW path: invoke `Workflow {scriptPath}` and receive **schema-validated objects** — no text parsing
4. On the INLINE path: dispatch sub-agents with minimal context and parse 1-line returns (legacy contract, inline only)
5. Present the 3 HARD-GATEs to the user — gates are NEVER inside a segment script

**You do NOT**: read intermediate artifacts (proposals, critiques, plans, reviews), accumulate sub-agent output in context, or make quality judgments about code. Sub-agents and segment scripts handle all domain work; you handle transitions, gates, and writing final artifacts (spec.md / changes.md) from returned objects.

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
- If `version` is `"3.0"` → run the v3 logic defined in this file.
- If `version` is missing or `"2.0"` (a pre-harness `/workflow` session) → **do NOT migrate silently.** See §Session Recovery step 2 — Restart is recommended; legacy resume is not supported by /harness.

## Zero-Setup Environment Detection

At startup, detect whether the current directory is inside a git repository:
```
git rev-parse --is-inside-work-tree 2>/dev/null
```
- If succeeds → `has_git = true`
- If fails → `has_git = false`

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json.

**All user-facing communication** in `user_lang`: progress updates, questions, confirmations, errors, spec sections, QA narrative, commit messages (if has_git).

**Stays in English:** template instructions, state.json field names, file names, git branch names, Workflow `args` field names.

**Re-detection:** On every user message, check if language changed. If so, update `user_lang`.

**WORKFLOW path:** pass `userLang` in `args` — the segment scripts build schema descriptions from it (`render in <userLang>`), which forces sub-agent free-text output language; enum/identifier fields stay English raw.

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
| Status format labels | `Task`, `Mode`, `Path`, `Model`, `Style`, `Phase`, `Round`, `Branch`, `Scope`, `Directory`, `Verifier`, `Language`, `Test`, `Build`, `Lint`, `TypeCheck`, `Output` (monospace alignment preservation) |
| Identifiers | state.json field names (e.g. `verify.layer1_retries`, `runs.plan.runId`), file paths (`{docs_path}verify_report.md`, `.harness/...`), git branch names (`harness/<slug>`), commands (e.g. `./gradlew test`, `npm run lint`), state-machine phase keys (`plan_ready`, `generating`, ...), schema field names (`acceptanceCriteria`, `modifiedFiles`, ...) |

### Print Translation Pattern

When rendering a `Print:` directive:
- Translate natural-language portions to `user_lang`.
- Glossary tokens above remain English raw.
- Variable substitutions (`{first line}`, `{layer1_retries}`, `{docs_path}...` etc.) follow §1-line Return Translation or §Glossary rules above.
- AskUserQuestion option label/description also follows this rule.
- Note: `(in user_lang)` markers on AskUserQuestion sites refer to UI prompt translation and are a separate context from the label-preservation rule for Status Format / Setup Summary labels.
- Note: When this contract refers to `Print` directives, the token MUST be wrapped in backtick inline code spans to avoid visual collision with column-0 `Print:` directives in the body.

### 1-line Return Translation (INLINE path only)

Inline sub-agent 1-line return (`<keyword> — <summary>`) processing:

- **Parse phase (English raw):** Extract Glossary keywords from the first line for state-machine transitions. String matching uses English raw only.
- **Display phase (force user_lang):** The non-keyword free-text summary portion is force-converted to `user_lang` at display time. If the input is already `user_lang`, the result is identical (idempotent — no language-detection heuristic required). Partial-English or mixed-language text follows the same rule for consistency and predictability.
- **Format:** `<keyword> — <summary>`. Split on first ` — ` (space-em-dash-space). On split failure, apply fallback per §Sub-agent Return Value Rules: treat as `confidence: Unknown`.
- **WORKFLOW path equivalent:** display the object's `summary` field (already rendered in `user_lang` by the schema description) — no parsing, no translation pass.

**Shorthand:** "Print per OLC" = render this directive per the Print Translation Pattern (Glossary tokens stay English raw).

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /harness-specific resolution (replaces the old mode-selection AskUserQuestion roundtrip):

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | single | **inline** (engine isolation requires git) |
| `--mode single` or `--mode quick` | single | **inline** |
| `Workflow` tool NOT available this session | single | **inline** (notify only if an explicit `--mode standard/multi` was requested) |
| `--mode standard` | standard | **workflow** |
| `--mode multi` (or `comprehensive`/`thorough`/`deep`) | multi | **workflow** |
| no `--mode` AND session is in ultracode mode | multi | **workflow** |
| no `--mode`, no opt-in | single | **inline** |

- **Opt-in signals** (any one suffices, per mode_gate.md): ultracode mode is on for the session; the user passed an explicit `--mode standard/multi` (or a deeper alias: `comprehensive`/`thorough`/`deep`); or these skill instructions direct the Workflow call (valid documented opt-in — but /harness only exercises it when one of the first two holds).
- **Graceful fallback:** if a `Workflow` invocation errors at any step, print `[harness] ⚠ Workflow engine unavailable — falling back to the inline single path.` (in `user_lang`), set `path_resolved → "inline"`, `mode → "single"`, and continue the CURRENT step on the inline path. Never error out.
- Record `path_resolved` in state.json and show `Path` in the Setup Summary.
- INLINE = the preserved single-agent flow (planner_single → generator_single → verify_layer1 → evaluator). Standard/multi fan-out exists ONLY on the workflow path — the engine replaces the old hand-rolled parallel-dispatch prose.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`.

Mode enum: `<single | standard | multi>`. Additional row: `Path : <inline | workflow>`.

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

## Session Recovery (state.json v3 phase machine)

Cross-session continuity uses the `state.json` phase machine below. Workflow `runId`s are recorded in `state.runs` for audit, and `resumeFromRunId` is **same-session only** — never attempt it across sessions; re-run the segment instead.

Before starting a new task, check if `.harness/state.json` exists:

1. Read state.json. Check `skill` field (if present):
   - If `skill` field exists and is NOT `"harness"` → warn user (in detected language): "A `/{skill}` skill session is active in this directory." Ask via AskUserQuestion: header "Session Conflict", question "A `/{skill}` session exists. Delete it and start /harness?", options: "Delete and start" / "Delete .harness/ and proceed with /harness", "Cancel" / "Keep existing session and halt". If "Cancel" → halt. If "Delete and start" → delete `.harness/`, proceed to Step 1.
   - If `skill` field is `"harness"` or missing → continue below.

2. Check `version` field:
   - **Missing or `"2.0"` (or any non-`"3.0"`)** → pre-harness `/workflow` session. Print per OLC: `[harness] Pre-harness session detected (v{version|1}) — created by /workflow. Restart recommended; legacy resume is not supported.` Ask via AskUserQuestion (in `user_lang`): header "Session", question "Pre-harness session found. Restart fresh or stop?", options: "Restart" / "Delete .harness/ and start fresh", "Stop" / "Keep files and halt". No Resume option for legacy sessions (no silent migration).
   - **`"3.0"`** → v3 session. Continue below.

3. Print status in standard format, prefixed with `[harness] Previous session detected.`
4. Restore `model_config` from state.json. Apply to all subsequent sub-agent launches and Workflow `args.models`.
5. Restore `conventions` from state.json. If value starts with `"file:"`, verify the referenced file exists. If file missing, set `conventions → null` (will trigger Step 1.5 on resume).
6. If `has_git` is not in state.json, re-detect and store. Re-resolve §Mode Gate (the new session may lack the Workflow tool or the opt-in) and update `path_resolved` — a session that started on the workflow path may legitimately resume on the inline path.
7. Ask the user via AskUserQuestion (in `user_lang`):
   - header: "Session"
   - question: "[harness] Previous session detected. [standard status]. Resume, restart, or stop?"
   - options:
     - "Resume" / "Continue from {phase}"
     - "Restart" / "Delete .harness/ and start fresh"
     - "Stop" / "Delete .harness/ and halt"

   Actions:
   - **Resume**: Before jumping to any step, run Safety Guard re-validation:
     - Read `docs_path` directly from state.json. **Do NOT recompute from `cli_flags.output_dir`** — `cli_flags` is for audit/record only.
     - Run `validate_path(docs_path, kind=output_dir)`: slug validation + relative path + reserved name check.
     - If validation fails: print `[harness] ⚠ Recovered docs_path failed validation: <path>` and treat as Restart.

     Then jump to the state matching `phase` (segments are re-RUN, not runId-resumed, across sessions):
     - `plan_ready` → Step 1.5 (Convention Scan) if `conventions` is `null` (not yet executed), else Step 2 (Plan). Note: `"skipped"` means user already decided — go to Step 2. If `conventions` starts with `"file:"` but the file does not exist, treat as `null` and re-run Step 1.5.
     - `planning` / `plan_done` → Step 3 (Gate) if spec.md exists, else Step 2
     - `generate_ready` → Step 4 (Generate)
     - `generating` / `generate_done` → Step 5 (Verify) — do NOT re-run the build segment (edits may already be applied)
     - `verify_ready` / `verifying` → Step 5 (Verify), reset retries to 0
     - `verify_done`:
       - if `state.autofix == null` → Step 5 (Verify), reset `layer1_retries` to 0 (existing behavior)
       - if `autofix.applied == "proposed"` → Step 5 "2nd HARD-GATE" direct re-entry (I3; do NOT reset retries)
       - if `autofix.applied == "applied"` → Step 5 re-verify from Layer 1 (retries from state.json, no reset)
       - if `autofix.applied` is `"stopped"` or `"rejected"` → Step 5 "1st HARD-GATE" (Auto-fix HIDE per I2; `layer1_retries` unchanged — I4 clamp applies to "stopped")
     - `evaluate_ready` → Step 6 (Evaluate)
     - `evaluating` / `evaluate_done` → Step 7 (Verdict)
     - `completed` → no active session, proceed to Step 1
   - **Restart**: Delete `.harness/` and proceed to Step 1
   - **Stop**: Delete `.harness/` and halt

If `.harness/state.json` does not exist, proceed to Step 1.

## run_style (Execution Mode)

Three execution styles control how phases progress:

| Style | Behavior | Session end points |
|-------|----------|-------------------|
| `auto` | Automatic progression, user gates at plan_done and evaluate_done(FAIL) only | `completed` |
| `phase` | Stop at each `*_done` state, resume in next session | `plan_done`, `generate_done`, `verify_done`, `evaluate_done` |
| `step` | Execute only the specified step, then stop | Immediately after step |

### CLI Parsing

```
/harness "task description"              → auto (default)
/harness plan "task description"         → phase mode, plan step
/harness generate                        → phase mode, generate step
/harness verify                          → step mode, verify only
/harness evaluate                        → step mode, evaluate only
/harness --mode single "task"            → auto + single mode (inline forced)
/harness --mode multi "task"             → auto + multi mode (workflow path)
/harness --model-config balanced "task"  → auto + balanced preset
```

When state.json exists and `/harness` is called with no arguments:
→ Read phase, suggest next step: e.g. "Plan complete. Run generate?"

### Step Mode Prerequisites

| Step | Required files | Required phase (minimum) | Missing action |
|------|---------------|-------------------------|----------------|
| `/harness plan` | (none) | (new session OK) | Normal start |
| `/harness generate` | spec.md | after `plan_done` | Error: "Run plan first" |
| `/harness verify` | changes.md | after `generate_done` | Error: "Run generate first" |
| `/harness evaluate` | spec.md + changes.md + verify_report.md | after `verify_done` | Error: "Run verify first" |

---

## State Machine

### State Transition Diagram

```
plan_ready → planning → plan_done → [User Gate] → generate_ready
  → generating → generate_done → verify_ready → verifying → verify_done
  → evaluate_ready → evaluating → evaluate_done → [Verdict Gate]
  → completed

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

## Workflow Steps

### Step 1: Setup

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
9. **Mode Gate resolution:** apply §Mode Gate (no AskUserQuestion roundtrip). Store `mode` and `path_resolved` in state.json.
10. **Model configuration:** If `--model-config` provided, use it. Otherwise, ask via AskUserQuestion (in `user_lang`):
    - header: "Model"
    - question: "Select model configuration for sub-agents:"
    - options:
      - "default" / "Inherit parent model, no changes"
      - "all-opus" / "All sub-agents use Opus (highest quality)"
      - "balanced (Recommended)" / "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
      - "economy" / "Haiku executor + Sonnet advisor/evaluator (max savings)"

    If "Other": parse `executor:<model>,advisor:<model>,evaluator:<model>`. Validate — only `opus`, `sonnet`, `haiku`. Max 3 retries, then default to `balanced`. Fill missing roles from `balanced` defaults.

    Store as `model_config`: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>", "verifier": "<resolved-verifier>" }`.
    For `default` preset: `{ "preset": "default", "verifier": "<resolved-verifier>" }`.

10.5. **Verifier model determination:** `model_config.verifier = cli_flags.verifier_model ?? "haiku"` (CLI flag takes priority; preset default is always `haiku`). Store resolved value in `model_config.verifier`.

    **docs_path usage rule**: Always read `docs_path` directly from state.json. Do NOT recompute from `cli_flags.output_dir`. `cli_flags` is for audit/record purposes only. Safety Guard in Session Recovery also uses `docs_path` directly (not recomputed).

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

12. **Print setup summary** per §Output Language Contract — Print Translation Pattern (labels remain English raw; values follow §Output Language Contract — Preserved-English Glossary):
```
[harness] Task started!
  Directory : <path>
  Branch    : harness/<slug>     ← omit if has_git == false
  Mode      : <single | standard | multi>
  Path      : <inline | workflow>
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

13. **Proceed to Step 1.5** (Convention Scan). If `run_style == "step"` and the CLI step is not `plan`, check prerequisites and jump to the requested step after Step 1.5 completes.

---

### Step 1.5: Convention Scan

*This step runs after Setup and before Plan, in all modes and on both paths.*

**Persisted Spec Artifacts Check:**

Before running CLAUDE.md richness check, look for `{docs_path}conventions.md` (persisted by /spec Phase 3 in slug-matched directory). **(m7)** `{docs_path}` is read from state.json (set by Step 1 step 7 — see §state.json schema).

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

**(m4) Scope of injection**: this injection applies ONLY to initial proposal inputs — the inline `planner_single.md` dispatch and the `harness.plan` segment `args` (whose embedded persona templates declare the placeholders). Synthesis runs inside the segment and receives proposals that already incorporate this context — do NOT double-inject downstream.

#### Step 2 — INLINE path (mode: single)

1. Update phase → `"planning"`.
2. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/planner_single.md`
3. **Dispatch 1 sub-agent** with prompt built from: `{task_description}`, `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}`, `{qa_discovery_notes}`, `{critic_findings}`, `{conventions}` (per §Conventions injection rule), plus `{spec_path}` = `{docs_path}spec.md`. Always pass the discovery placeholders — even when empty.
   - Model: if preset ≠ "default", use `model_config.advisor`.
4. Parse return → extract first line. Print: `  ✓ {first line}`
5. Verify `spec.md` exists.
6. Update phase → `"plan_done"`, `updated_at → now`.

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
4. The segment returns `{ plan: PlanResult, stats }` (schema-validated — no file re-reads, no 1-line parsing). Print per OLC: `  ✓ Plan segment: {stats.proposalsSucceeded}/{stats.proposalsRequested} proposals → synthesis`
5. **Orchestrator writes `{docs_path}spec.md` from the PlanResult object** (headings in `user_lang`):
   - `### Goal` ← `goal` ; `### Background` ← `background`
   - `### Scope` ← `scope.inScope` / `scope.outOfScope` bullet lists
   - `### Approach` ← `approach`
   - `### Completion Criteria` ← `acceptanceCriteria[]` as GFM checkboxes `- [ ] AC-n: text`
   - `### Testing Strategy` ← `testingStrategy[]` ; `### Edge Cases` ← `edgeCases[]` (omit if empty)
   - `### Risks` ← `risks[]` as `- (source, likelihood) risk — mitigation`
   - `### Implementation Steps` ← `steps[]` (omit if absent)
6. Verify `spec.md` exists (orchestrator-written).
7. Update phase → `"plan_done"`, `updated_at → now`.
8. **On Workflow error** (launch failure, script error, schema-invalid result): apply §Mode Gate graceful fallback → re-run this step on the INLINE path.

#### After Plan Phase

Print: `[harness] Plan complete.`

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `plan`):** Print spec.md path, inform user session can end. Halt.

**If `run_style == "auto"`:** Continue to Step 3 (Gate).

---

### Step 3: HARD GATE #1 — Spec Confirmation

> Rendered by the orchestrator BETWEEN the `harness.plan` and `harness.build` segment runs — never inside a script.

<HARD-GATE>
Read and show spec.md to the user. Ask via AskUserQuestion (in `user_lang`):
- header: "Spec"
- question: "Review the spec above. Implementation consumes significant tokens. Confirm to proceed."
- options:
  - "Proceed" / "Start implementation as specified"
  - "Modify" / "Edit the spec, then re-confirm"
  - "Stop" / "Halt the workflow"

If "Modify": update spec.md and re-present.
If "Stop": halt.
Only "Proceed" advances.
</HARD-GATE>

Update state.json: `phase → "generate_ready"`, `updated_at → now`.

---

### Step 4: Generate Phase

Print: `[harness] Phase: Generate`

#### Step 4 — INLINE path (mode: single)

1. Update phase → `"generating"`, `updated_at → now`.
2. Read template: `generator_single.md`
3. Prepare prompt: `{spec_content}` from spec.md, `{qa_feedback}` from qa_report.md if round > 1 else "(First round)", `{round_num}`, `{scope}`, `{max_files}`, `{user_lang}`, `{changes_path}` = `{docs_path}changes.md`.
   - **If retry** (from verify/evaluate failure): add `{verify_failure}` = 1-line FAIL summary, `{verify_report_path}` = `{docs_path}verify_report.md`.
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
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/harness.build.workflow.js",
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
4. The segment returns `{ changes: ChangeSet, planDigest, advisorDigests }`. Store `workflow_ctx → { planDigest, advisorDigests, changedFiles }` in state.json — `changedFiles` = repo-relative paths from `changes.modifiedFiles[].path` + `createdFiles` (reasons stripped; normalize any absolute paths to repo-relative). Digests are reused on retries; `changedFiles` is the sanctioned Step 5 source on resume.
5. **Orchestrator writes `{docs_path}changes.md` from the ChangeSet object**:
   - `## Round {round} Changes` header
   - `### Modified Files` ← `modifiedFiles[]` as `- path — reason` (normalize absolute paths to repo-relative) ; `### Created Files` / `### Deleted Files`
   - `### Advisor Feedback Applied` ← `advisorFeedbackApplied[]` ; `### Advisor Feedback Declined` ← `advisorFeedbackDeclined[]`
6. Print per OLC: `  ✓ Code: {changes.summary}`
7. Verify `changes.md` exists (orchestrator-written).
8. Update phase → `"generate_done"`, `updated_at → now`.
9. **On Workflow error**: graceful fallback → re-run this step on the INLINE path (generator_single).

**Retry entries (from Step 5/7 failure loops)** — regardless of path, a retry NEVER re-plans or re-reviews:
- INLINE: re-dispatch the single implementation sub-agent with `{verify_failure}` + `{verify_report_path}` (current behavior).
- WORKFLOW: re-run `harness.build` with `retry: true`, `verifyFailure: <summary from the failing VerifyVerdict>`, `verifyReportPath`, and `planDigest`/`advisorDigests` from `workflow_ctx` — the script skips its Plan/Advise phases and runs one implementation pass.

#### After Generate Phase

Print: `[harness] Generate complete.`

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `generate`):** Inform user, halt.

**If `run_style == "auto"`:** Continue to Step 5 (Verify).

---

### Step 5: Verify Phase (Layer 1 — Mechanical)

**First entry only** (from generate_done, not from retry loop): Update state.json: `phase → "verify_ready"`, `verify.layer1_result → null`, `verify.layer1_retries → 0`, `updated_at → now`.

**Retry re-entry** (from Generator retry): Update state.json: `phase → "verify_ready"`, `verify.layer1_result → null`, `updated_at → now`. Do NOT reset `layer1_retries` — it was already incremented at retry dispatch.

Print: `[harness] Phase: Verify (Layer 1 — Mechanical)`

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
6. Update phase → `"verify_done"`, `updated_at → now`. Branch on result below.

#### Step 5 — WORKFLOW path

1. Update phase → `"verifying"`, `updated_at → now`.
2. Run the Eval segment (covers Verify L1 AND Evaluate L2/L3 in one autonomous span):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/harness.eval.workflow.js",
     args: {
       buildCmd, testCmd, lintCmd, typeCheckCmd,
       changesMdPath: "{docs_path}changes.md", verifyReportPath: "{docs_path}verify_report.md",
       todoBlocking: <verify.todo_blocking>,
       specContent: <spec.md content>,
       changedFilesList: <repo-relative paths only from the in-context ChangeSet.modifiedFiles+createdFiles — strip all "reason" text (anchoring prevention); on resume with no in-context ChangeSet, use state.workflow_ctx.changedFiles>,
       testAvailable: <bool>, roundNum: <round>, scope, userLang,
       qaReportPath: "{docs_path}qa_report.md",
       models: { ... }, skipL1: false, onlyL1: false
     }
   }
   ```
3. Record `runs.eval → { "runId": "<id>" }`.
4. The segment returns a `VerifyVerdict`. Branch on **(layer, verdict)** — never verdict alone:
   - `layer == "L1"` and `verdict == "PASS"` → unreachable (segment continues to evaluate) — treat as L2/L3 verdict below.
   - `layer == "L1"` and `verdict != "PASS"` → **Layer 1 FAIL**: `verify.layer1_result → "FAIL"`, phase → `"verify_done"`, go to the L1 FAIL branch below.
   - `layer == "L2" | "L3"` → Layer 1 passed inside the segment: `verify.layer1_result → "PASS"`, `phase → "evaluate_done"`, record the verdict for Step 7 (skip Steps 5-PASS print and 6 — already evaluated). Print per OLC: `  ✓ Verify (Layer 1): PASS → Evaluate: {verdict.verdict}` and go to **Step 7** with this verdict.
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
  - "Stop" / "Halt for manual intervention. Review verify_report.md"
</HARD-GATE>

If "Continue": INLINE → proceed to Step 6 (evaluator receives the Layer-1-FAILED verify_context). WORKFLOW → run `harness.eval` with `skipL1: true` and treat its return as the Step 7 verdict.
If "Stop": halt (keep phase as `verify_done`).

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
1. Before applying: snapshot current state via `git stash` (if `has_git == true`) or copy changed files to `.harness/autofix_pre_apply/` (if `has_git == false`).
2. **Pre-apply path validation**: parse all `--- a/<path>` and `+++ b/<path>` headers from `auto_fix_patch.md` (metadata only — 4 header lines per hunk; hunk body is not parsed). Apply `validate_path(path, kind=diff_target)` to each path.
   - Print to user: `[harness] Applying patch to: <path list>`
   - If any path fails validation: reject Apply, print `[harness] ✗ Diff path validation failed: <path>`, return to HARD-GATE (Auto-fix hidden).
3. Apply unified diff from `.harness/generator/auto_fix_patch.md` using Edit tool.
   - If any hunk fails to apply: restore from snapshot, warn user "Apply failed — reverted to pre-apply state.", return to HARD-GATE (retries >= 3, Auto-fix hidden).
4. Update state.json: `autofix.applied → "applied"`. Reset `verify.layer1_result → null`.
5. Re-run verification (retry counter `layer1_retries` unchanged — do NOT increment). INLINE → re-dispatch verify_layer1. WORKFLOW → run ONE full `harness.eval` (`skipL1: false, onlyL1: false`) — its L1 phase IS the re-verification (no separate `onlyL1` pre-pass; avoids running L1 twice):
   - **L1 PASS** → INLINE: proceed to Step 6. WORKFLOW: the same eval run already continued to L2/L3 — take its verdict to Step 7.
   - **L1 FAIL** (`layer == "L1"`) → update state.json: `autofix.applied → "stopped"`, `layer1_retries = min(layer1_retries, 3)` (clamp — see §State Machine I4). Return to FAIL retries >= 3 HARD-GATE (Auto-fix option hidden since `verify.autofix_attempted == true`).

**If "Reject":**
1. Update state.json: `autofix.applied → "rejected"`.
2. Return to FAIL retries >= 3 HARD-GATE (Auto-fix option hidden).

**Layer 2 FAIL path:** Auto-fix proposal does **NOT** apply to Layer 2 structural failures (Step 7). Mechanical diff cannot fix structural issues.

#### After Verify Phase

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `verify`):** Inform user of result, halt.

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
5. Parse return — first line (English raw — see §Output Language Contract — Preserved-English Glossary):
   - Contains `"PASS"` → `verify.layer2_result → "PASS"`. Print: `  ✓ {first line}`
   - Contains `"FAIL L2"` → `verify.layer2_result → "FAIL"`. Print: `  ✗ {first line}`
   - Contains `"FAIL L3"` → `verify.layer2_result → "PASS"` (Layer 2 passed). Print: `  ✗ {first line}`
   - Contains `"FAIL"` (no layer indicator) → treat as L3 FAIL. `verify.layer2_result → "PASS"`.
6. Update phase → `"evaluate_done"`, `updated_at → now`.

Print: `[harness] Evaluate complete.`

**If `run_style == "phase"` or (`run_style == "step"` and requested step was `evaluate`):** Inform user, halt.

**If `run_style == "auto"`:** Continue to Step 7.

---

### Step 7: Verdict & Loop

Determine the verdict:
- **INLINE path:** Read `qa_report.md`. Look for `"### Verdict: PASS"` or `"### Verdict: FAIL"`. Also check `verify.layer2_result` from state.json to determine failing layer.
- **WORKFLOW path:** use the `VerifyVerdict` object from `harness.eval` — `verdict ∈ {PASS, FAIL_L2, FAIL_L3}` with `layer`. Set `verify.layer2_result → "FAIL"` iff `verdict == "FAIL_L2"`, else `"PASS"`. The QA report file was still written by the evaluator agent for the user. **On resume with no in-context VerifyVerdict:** read `qa_report.md`'s `### Verdict:` line (PASS/FAIL) and combine it with `verify.layer2_result` from state.json to reconstruct {PASS, FAIL_L2, FAIL_L3} — mirrors the INLINE procedure (sanctioned read, see §Architecture Principles #1).

#### If PASS:

Update state.json: `phase → "completed"`, `updated_at → now`.
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

Single implementation pass (retry, no re-plan/re-review) — INLINE per Step 4 retry rules; WORKFLOW `harness.build {retry: true}` with `verifyFailure` = the verdict's `summary` + top `failures[].fix` lines, `verifyReportPath` = `{docs_path}qa_report.md`.

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
If "Accept as-is": phase → `"completed"`, proceed to Step 8.

#### If FAIL — Layer 3 (verify.layer2_result == "PASS") and rounds remaining (round < max_rounds):

Ask via AskUserQuestion (in `user_lang`):
- header: "QA"
- question: "QA result: FAIL (Layer 3). [failure summary — INLINE: from qa_report.md Fix Instructions; WORKFLOW: from verdict.failures[].fix]."
- options:
  - "Fix" / "Run next round to fix FAIL items"
  - "Accept as-is" / "Finish without fixing"

If "Fix":
- Increment `round`, reset `verify.layer1_retries → 0`, `verify.layer1_result → null`, `verify.layer2_result → null`, `verify.layer2_retries → 0`.
- Update `updated_at → now`.
- Go to Step 4 (Generate) — a NEW round is a full pass: INLINE normal dispatch with `{qa_feedback}`; WORKFLOW `harness.build {retry: false}` with `qaFeedback` = qa_report.md content (fresh plan + advise + implement).

If "Accept as-is":
- Update phase → `"completed"`, `updated_at → now`.
- Proceed to Step 8.

#### If FAIL and max rounds reached:

Update phase → `"completed"`, `updated_at → now`.
Print: `[harness] Max rounds reached. Remaining issues in qa_report.md.`
Proceed to Step 8.

---

### Step 8: Cleanup & Finalize

#### Artifact Cleanup Safety Guard

Cleanup safety rules: see `templates/_shared/safety_guard.md`.

#### If has_git == true:

Ask via AskUserQuestion (in `user_lang`):
- header: "Commit"
- question: "Implementation complete. Choose how to finish:"
- options:
  - "Commit code only (Recommended)" / "Clean artifacts, commit code changes only"
  - "Commit all" / "Commit everything including artifacts"
  - "No commit" / "Clean .harness/ only, keep changes in working tree"

Actions (apply Safety Guard before each delete):
- "Commit code only": (protect persisted spec artifacts) Apply this exact 5-step sequence:
  1. **(M8) Safety Guard validation** on `{docs_path}` — apply the full Artifact Cleanup Safety Guard per `templates/_shared/safety_guard.md` (slug check + path depth + `Path.cwd()` containment) BEFORE any staging or deletion. If validation fails, **ABORT**: do NOT stage, do NOT delete. Surface the failed check to the user. Both `.harness/` and `{docs_path}` remain intact for manual recovery.
  2. **Stage spec-persistence files** for commit (only if the source file exists — silently skip missing files):
     - `{docs_path}qa_notes.md`
     - `{docs_path}critic_findings.md`
     - `{docs_path}conventions.md`

     **(s4) Per-file staging failure handling**: if `git add <file>` fails for a specific file (permission, .gitignore conflict, etc.), warn the user (in `user_lang`): "Failed to stage `<file>`: <error>. Spec artifact may not be in git history." Continue with remaining files — do NOT abort the whole sequence on a single staging failure. The code commit (step 5) is more critical than any individual artifact preservation.
  3. **Delete `.harness/`** (the Safety Guard already validated the parent context).
  4. **Delete `{docs_path}`** working-directory contents.
  5. **Commit** code changes plus the staged spec artifacts.

  **(m2) git index vs working directory note**: between step 2 (stage) and step 4 (delete working dir), the spec artifact files are staged in the git index but then removed from the working directory. This is correct behavior — `git add` captures a snapshot to the index at stage-time; a subsequent working-directory `rm` does NOT mark the staged files as deleted in the index (a working-tree-only delete after index-stage is a no-op for the index — it only changes the working tree, not the staged content). The final commit (step 5) therefore includes the 3 staged artifacts as additions even though they no longer exist on disk; they remain recoverable from git history.
- "Commit all": delete `.harness/`, stage + commit `{docs_path}` + code
- "No commit": delete `.harness/` only

#### If has_git == false:

Inform user artifacts are in `{docs_path}`.
Delete `.harness/` only. No git operations.

---

## Model Selection

Preset table + rules: see `templates/_shared/model_config.md`.

Role map: Architect / Senior Developer / QA Specialist / Synthesis → advisor; Lead Developer & Implementation & Generator(single) → executor; Combined / Code Quality / Test & Stability Advisor → advisor; Evaluator → evaluator; Verify (Layer 1) → verifier (haiku default).

- INLINE path: pass `model` per role at sub-agent launch (preset ≠ "default").
- WORKFLOW path: pass the whole resolved map once as `args.models` (`{executor, advisor, evaluator, verifier}`; null role = inherit) — segment scripts apply it per agent.

> **Verifier defaults to haiku across all presets.** Layer 1 only executes commands and parses exit codes — lowest-cost model is always sufficient. Override with `--verifier-model sonnet|opus` for sensitive mechanical verification (e.g., concurrency, complex test failures). Opt-in only. When set to `sonnet` or `opus`, a cost warning is shown in Setup Summary.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Architecture Principles

The following principles are invariant constraints for the harness Orchestrator.

1. **Orchestrator reads no intermediate files.** Exceptions:
   - spec.md at plan gate (and the orchestrator WRITES spec.md/changes.md from returned objects — writing final artifacts is not reading intermediates)
   - qa_report.md at verdict gate (INLINE path; WORKFLOW path on session resume — verdict reconstruction)
   - verify_report.md path for user message
   - **verify_report.md failing-file extraction for Auto-fix Proposer dispatch**:
     Orchestrator reads verify_report.md to extract failing file paths only (no content analysis).
     Extracted paths pass through Path Validator (kind=file_reference) and are capped at 5.
     See §Step 5 — Auto-fix dispatch for the exact procedure.
   - Apply-before `--- a/` / `+++ b/` diff header lines (4 lines of metadata only — hunk body is delegated to Edit tool). This is NOT a violation of this principle.

2. **Auto-fix Proposer is the only sub-agent that directly Reads source files among orchestrator-dispatched agents.** (Segment-script agents explore the codebase themselves by design — they run inside the engine's autonomous span.) Other inline sub-agents receive content only through template variables.

3. **Paths only to sub-agents; never file contents** (ephemeral digests passed inside a segment run excepted — they never enter the orchestrator's context beyond `workflow_ctx` storage).

4. **Session-wide invariants** (see §State Machine — Auto-fix State Transition Table):
   - Auto-fix: at most 1 attempt per session (`verify.autofix_attempted` once-only — not reset on round increment).
   - Layer 1 retries: max 3. Do NOT reset after Auto-fix Apply.

5. **All external paths pass through Path Validator before use** (see §Path Validator below).

6. **Gates never enter segment scripts.** The 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) are rendered by this orchestrator between segment runs. `scripts/verify_meta_literal.py` enforces this at lint time.

### Path Validator

Orchestrator internal conceptual function. Call sites: `--output-dir` parsing (Step 1.2), `{failing_files_list}` injection (Step 5), Edit tool unified diff Apply (Step 5), Session Recovery re-validation (Session Recovery).

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
         (d) outside .harness/, docs/harness/*, memory/.
     - diff_target (unified diff --- a/ / +++ b/ headers):
         file_reference conditions + inside scope filter +
         outside .harness/, docs/harness/, memory/, .git/.
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

## Key Rules

- **Never skip phases.** Always Plan → Generate → Verify → Evaluate.
- **Confirmation gates are non-negotiable.** No implicit approval. Gates live ONLY in this orchestrator — never in a segment script.
- **Stay within scope.** Do not modify files outside scope.
- **Evaluator must be isolated.** Anchor-free input. Never pass Generator reasoning.
- **Planner proposals must be independent.** Never share one persona's work with another during proposal (the plan segment's `parallel()` enforces this).
- **Generator advisors review the plan, not code.** Advisory before implementation.
- **Use available skills.** Search by keyword, not plugin name. Proceed without if none found.
- **User language.** All user-facing output in `user_lang` per §Output Language Contract. Glossary tokens (`PASS`/`FAIL`/`Verdict`/`[harness]`/etc.) preserved English. Inline parser keywords MUST remain English raw — see §Sub-agent Return Value Rules.
- **Intermediate outputs are ephemeral.** Only final artifacts preserved in `docs/`.
- **Orchestrator reads no intermediate files.** See §Architecture Principles for full exception list.
- **1-line return parsing (INLINE path only).** Only first line of an inline sub-agent return is used for state decisions. WORKFLOW path branches on schema-validated objects.
- **Workflow args are a JSON object;** segment scripts defensively parse (`args` may arrive as a JSON string — engine behavior). Never put user-gate decisions into args.
- **Graceful engine fallback.** Any Workflow failure degrades to the inline single path with a notice — never a hard error.
