---
name: debug
disallowed-tools: NotebookEdit
description: Hypothesis-driven debugger with mandatory executable verification. Classifies build/compile vs runtime/logic errors, attempts reproduction, generates falsifiable hypotheses verified by code search, git history, and test execution. Quick mode (orchestrator only, inline) or deep mode (2 specialist analysts + adversarial cross-verification via a plugin-shipped native Workflow segment, opt-in gated). Use when facing a bug, unexpected behavior, or error that needs systematic root cause analysis.
---

# Agent Harness Debug

You are orchestrating a **hypothesis-driven debugging workflow** with mandatory executable verification at every step.

**Core principle:** Every hypothesis must be tested with real actions — code search, git blame, test execution, file reads. Pure reasoning-only conclusions are prohibited.

**Zero-setup:** No initialization required. Works with or without a git repository.

## Environment Detection

At startup, detect whether the current directory is inside a git repository:
```
git rev-parse --is-inside-work-tree 2>/dev/null
```
- If the command succeeds → `has_git = true`
- If the command fails → `has_git = false`

Store `has_git` in state.json. When `has_git == false`, skip all git operations (branch creation, git blame, git log). Use alternative strategies: file reads, Grep, directory traversal.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json (e.g. "ko", "en", "ja", "zh", "es", "de", etc.).

**All user-facing communication** must be in the detected language: progress updates, questions, confirmations, error messages, hypothesis descriptions, report narrative, confirmation gate prompts and options.

**Re-detection:** On every user message, check if the language has changed. If so, update `user_lang` and switch all subsequent communication.

**What stays in English:** Template instructions (this file and templates/*.md), state.json field names, file names (hypotheses.md, root_cause.md, fix_changes.md, debug_report.md), git branch names (if has_git), Workflow `args` field names.

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /debug-specific resolution (the mode-selection roundtrip is removed EXCEPT §Ambiguity Prompt, which fires only when opt-in is absent):

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | quick | **inline** (engine isolation requires git) |
| `--mode quick` | quick | **inline** |
| `Workflow` tool NOT available this session | quick | **inline** (notify only if an explicit `--mode deep` was requested) |
| `--mode deep` (or `comprehensive`/`thorough`/`multi`) | deep | **workflow** |
| no `--mode` AND session is in ultracode mode | deep | **workflow** |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=workflow` | deep | **workflow** (standing opt-in — §Ambiguity Prompt step 4.5) |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=inline` | quick | **inline** |
| no `--mode`, no opt-in | quick | **inline** (interactive + engine available → asks first, §Ambiguity Prompt) |

- **Deep mode exists ONLY on the workflow path** — the engine's `parallel()` fan-out replaces the old hand-rolled "Launch 2 sub-agents in parallel" prose (pilot precedent: /harness standard/multi). The inline path is the preserved quick mode (Phase 1-Q: orchestrator runs the hypothesis loop directly).
- **Mode Gate applies to runtime/logic errors only** — `error_type == "build"` takes the fast path (Phase 0.5) regardless of mode/path; no analysts are dispatched.
- **Graceful fallback:** if a `Workflow` invocation errors at any step, print `[debug] ⚠ Workflow engine unavailable — falling back to the inline quick path.` (in `user_lang`), set `path_resolved → "inline"`, `mode → "quick"`, and continue the CURRENT step on the quick path (Phase 1-Q hypothesis loop). Never error out.
- Record `path_resolved` in state.json and show `Path` in the status format.

## Standard Status Format

When displaying status, read `.harness/state.json` and print (in `user_lang`):
```
[debug]
  Error  : <error description, truncated to 60 chars>
  Mode   : <quick | deep>
  Path   : <inline | workflow>  (<reason per §Path Transparency>)
  Model  : <model_config preset name>
  Phase  : <phase label>
  Branch : <branch>    ← omit this line if has_git == false
```
Phase labels: `setup` → "Setup", `reproducing` → "Reproducing error", `analyzing` → "Root cause analysis", `fixing` → "Applying fix", `completed` → "Completed"

## Session Recovery

Before starting a new debug session, check if `.harness/state.json` already exists **and** `state.json.skill` equals `"debug"`:

1. If it exists and matches, print status in the standard format (including Model line from `model_config`), prefixed with `[debug] Previous debug session detected.`
2. Restore `model_config` from state.json. Apply it to all subsequent sub-agent launches and Workflow `args.models`.
3. If `has_git` is not present in state.json (pre-existing session from older version), re-detect using the Environment Detection command and store the result.
3.5. **Re-resolve §Mode Gate** (the new session may lack the Workflow tool or the opt-in) and update `path_resolved` — a session that started on the workflow path may legitimately resume on the inline path. On resume, do NOT re-fire §Ambiguity Prompt — reuse the stored `mode` + `path_resolved`; only the workflow→inline downgrade (engine now absent) may change `path_resolved`. Cross-session resume re-RUNS the segment; `state.runs.analyze.runId` is audit-only (`resumeFromRunId` is same-session only — never attempt it across sessions).
4. Ask the user using AskUserQuestion (in `user_lang`):
     header: "Session"
     question: "[debug] Previous debug session detected. [print status in standard format]. Resume, restart, or stop?"
     options:
       - label: "Resume" / description: "Continue from {phase} where the previous session left off"
       - label: "Restart" / description: "Delete .harness/ and start from scratch"
       - label: "Stop" / description: "Delete .harness/ and halt"

   Actions per selection:
   - **Resume**: Jump to the phase matching state.json phase:
     `setup` → Step 1 |
     `reproducing` → Phase 0.7 |
     `analyzing` →
       - **FIRST, on BOTH paths**: if `docs/harness/<slug>/root_cause.md` already exists, the analysis completed before the crash — skip directly to the Fix Decision HARD-GATE. Do NOT re-run any loop or segment (a deep session resumed without the engine would otherwise re-enter the quick loop and OVERWRITE the completed adversarial analysis — data loss).
       - else, inline path (quick): Phase 1-Q (if `.harness/debug/hypotheses.md` exists, resume hypothesis loop; else restart Phase 1-Q)
       - else, workflow path (deep): re-RUN the Analyze segment from Phase 1-D step 2 (re-read `.harness/debug/context.md`; if context.md is missing, restart Phase 1-D from step 1). If the re-resolved path is inline (engine/opt-in lost), degrade to Phase 1-Q with a notice. |
     `fixing` → Phase 2 |
     `completed` → no active session, proceed to Step 1
   - **Restart**: Delete `.harness/` directory and proceed to Step 1
   - **Stop**: Delete `.harness/` directory and halt

If `.harness/state.json` does not exist (or `state.json.skill` is not `"debug"`), proceed to Step 1 normally.

## Workflow

When the user describes a bug or error (via $ARGUMENTS or in conversation), execute this workflow:

### Step 1: Setup

1. **Detect user language** from the error description. Store as `user_lang`.
2. **Parse flags** from the user's input:
   - `--mode quick` or `--mode deep` → set mode directly, skip mode prompt
   - `--model-config <preset>` → set model_config directly, skip model prompt
   - `--attach <file>` → read the specified file as additional context (stack trace, log file, etc.)
3. **Slugify the error description:** lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 40 chars. Store as `<slug>`.
4. **Create directories:** `.harness/`, `.harness/debug/`, `docs/harness/<slug>/`
5. **Create git branch (if has_git):** `git checkout -b harness/debug-<slug>`. If `has_git == false`, skip this step entirely.
6. **Mode Gate resolution:** apply §Mode Gate INCLUDING **§Ambiguity Prompt** (single source: `templates/_shared/mode_gate.md`). The mode roundtrip is removed EXCEPT this prompt, which fires only when NO opt-in is present (no `--mode`, ultracode OFF, no project-default `path` (`agent-harness-defaults:` line), `Workflow` tool available, `has_git == true`, interactive session, no `--no-prompt`). Skill modes: quick(inline) / deep(workflow). ultracode-target (step 4 default): deep. Store `mode` and `path_resolved` in state.json. Then emit **§Path Transparency** — show `Path : <inline | workflow>  (<reason>)`. If the user explicitly requested `--mode deep` but the gate resolved to inline (Workflow tool unavailable or `has_git == false`), notify (in `user_lang`): "deep mode requires the native Workflow engine and git — proceeding on the inline quick path."
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
7. **Model configuration selection (deep mode only):**
   If mode is `quick`, skip this step entirely (no sub-agents in quick mode).

   If `--model-config <preset>` was passed, use it directly. Otherwise, if the resolved project-defaults line (first source wins wholesale: settings.local.json env → project CLAUDE.md → user CLAUDE.md; see `templates/_shared/project_defaults.md`) contains `model-config=<preset>`, use it silently and echo `(project default)` in the Setup Summary. Otherwise, use AskUserQuestion to ask the user (in `user_lang`):
<!-- SYNC-WITH: templates/_shared/project_defaults.md §agent-harness-defaults -->
     header: "Model"
     question: "Select model configuration for sub-agents:"
     options:
       - label: "default" / description: "Inherit parent model, no changes"
       - label: "frontier" / description: "Sonnet executor + Opus advisor + Fable evaluator (top-model judgment)"
       - label: "balanced (Recommended)" / description: "Sonnet executor + Opus advisor (cost-efficient)"
       - label: "economy" / description: "Haiku executor + Sonnet advisor (max savings)"

   **If "Other" selected:** Parse custom format `executor:<model>,advisor:<model>,evaluator:<model>` (or a bare preset name — validated against the preset table: `default` / `all-opus` / `frontier` / `balanced` / `economy`). For the role form, validate each model name — only `fable`, `opus`, `sonnet`, `haiku` are allowed (case-insensitive). If any model name is invalid, inform the user which value is invalid and re-ask for input (max 3 retries, then apply `balanced` as default). If parsing succeeds but is partial, fill missing roles with the `balanced` defaults (executor=sonnet, advisor=opus, evaluator=opus). Show the parsed result to the user and ask for confirmation before proceeding.

   **Model config is set once at session start and cannot be changed mid-session.** To change, restart the session.

   Store result as `model_config` object: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>" }`. For the `default` preset, store `{ "preset": "default" }`.

8. **Write `.harness/state.json`** with fields:
   - `skill`: `"debug"`
   - `phase`: `"setup"`
   - `mode`: `"quick"` or `"deep"`
   - `path_resolved`: `"inline"` or `"workflow"` (from §Mode Gate; re-resolved on resume)
   - `runs`: `{ "analyze": null }`; records `{ "runId": "<wf_...>" }` after the segment launch. **Audit + same-session iteration only** — cross-session resume re-RUNS the segment (see §Session Recovery step 3.5).
   - `model_config`: (from step 7; for quick mode: `{ "preset": "default" }`)
   - `user_lang`
   - `has_git` (boolean)
   - `repo_path`: working directory path
   - `branch`: (if has_git: `"harness/debug-<slug>"`, else: null)
   - `error_description`: the user's original error description
   - `error_type`: null (set in Phase 0.5)
   - `slug`: `<slug>`
   - `docs_path`: `"docs/harness/<slug>/"`
   - `created_at`: ISO8601

9. **Print setup summary** (in `user_lang`):
   ```
   [debug] Debug session started!
     Directory : <path>
     Branch    : harness/debug-<slug>     ← omit if has_git == false
     Mode      : <quick | deep>
     Path      : <inline | workflow>  (<reason per §Path Transparency>)
     Model     : <preset name>            ← omit if quick mode
   ```

### Phase 0.5: Error Type Classification

Classify the error into one of three types by examining the error description and any attached files:

| Type | Signals |
|------|---------|
| **build/compile** | Compiler error, syntax error, missing import, type mismatch at build time, linker error |
| **runtime** | Exception/panic at runtime, crash, segfault, unhandled promise rejection, null pointer during execution |
| **logic** | Wrong output, unexpected behavior, test failure, business logic bug, off-by-one |

1. Read the error description (and `--attach` file if provided). Classify the error type.
2. Update state.json: `error_type` → `"build"`, `"runtime"`, or `"logic"`.
3. Inform the user of the classification (in `user_lang`): `[debug] Error classified as: <type>`.

**Fast path for build/compile errors:**

If `error_type == "build"`:
- Skip Phase 0.7 (reproduction attempt) — build errors reproduce deterministically.
- Skip Phase 1 (hypothesis loop) — the compiler output is direct evidence.
- Analyze the compiler output directly: identify the exact line, error code, and cause.
- Write a simplified `docs/harness/<slug>/root_cause.md` with the build error, affected file:line, and proposed fix.
- Present a simplified HARD-GATE:
  <HARD-GATE>
  Ask the user using AskUserQuestion (in `user_lang`):
    header: "Build Fix"
    question: "Build error root cause identified: [brief description]. Proceed to fix?"
    options:
      - label: "Fix it" / description: "Apply the fix directly"
      - label: "Record only" / description: "Save root_cause.md and stop — fix manually"
      - label: "Stop" / description: "Halt without saving"

  - "Fix it" → go to Phase 2
  - "Record only" → write root_cause.md, update state.json phase → "completed", halt
  - "Stop" → halt
  </HARD-GATE>

**If `error_type == "runtime"` or `"logic"`:** Continue to Phase 0.7.

### Phase 0.7: Reproduction Attempt

**Goal:** Confirm the error can be reproduced, and document the exact conditions under which it occurs.

Update state.json: `phase` → `"reproducing"`.

1. **Identify reproduction strategy:**
   - If the project has a test command (detect from project files — see language detection table in Step 1), attempt test execution.
   - If the error comes with a specific input or command, attempt to run it.
   - If neither is available, switch to log/environment analysis strategy.

   **Language detection for test commands:**

   | File | Language | Test Command |
   |------|----------|-------------|
   | `build.gradle(.kts)` | java | `./gradlew test` |
   | `pom.xml` | java | `mvn test` |
   | `pyproject.toml` / `setup.py` | python | `pytest` |
   | `package.json` | typescript | `npm test` |
   | `*.csproj` | csharp | `dotnet test` |
   | `go.mod` | go | `go test ./...` |
   | `Cargo.toml` | rust | `cargo test` |

2. **Attempt reproduction:**
   - Run the test command or reproduction script.
   - Capture full output (stdout + stderr).

3. **Record result:**
   - **Success (error reproduced):** Write reproduction conditions to `.harness/debug/hypotheses.md`:
     ```
     ## Reproduction
     - Reproduction command: <command>
     - Reproduction output: <captured output (truncated if > 50 lines)>
     - Reproduction conditions: <environment, inputs, state>
     ```
     Inform the user (in `user_lang`): `[debug] Error reproduced. Proceeding to root cause analysis.`
   - **Failure (cannot reproduce):** Switch to log/environment analysis strategy:
     - Read available log files, config files, and environment variables.
     - Note in `.harness/debug/hypotheses.md`: "Could not reproduce directly. Proceeding with log/environment analysis."
     - Inform the user (in `user_lang`): `[debug] Could not reproduce directly. Switching to log/environment analysis strategy.`

4. Continue to Phase 1 regardless of reproduction outcome.

### Phase 1: Root Cause Analysis — Hypothesis Verification Loop

Update state.json: `phase` → `"analyzing"`.

---

## Falsification Rules (Core Differentiator)

The canonical 5 falsification rules live in `{CLAUDE_PLUGIN_ROOT}/templates/_shared/falsification_rules.md` (single source — do not duplicate them here or in templates). Read that file once at the start of Phase 1 and apply it to every hypothesis:
- **Quick mode (inline)**: the orchestrator applies the rules directly in the Phase 1-Q hypothesis loop (hypotheses recorded in `.harness/debug/hypotheses.md`).
- **Deep mode (workflow)**: the segment script appends the canonical block to both analyst prompts, and the `Hypothesis.verification` schema enforces ≥1 executable action per hypothesis (`minItems: 1`) at the schema layer.

These rules are non-negotiable.

---

#### If mode == "quick": Phase 1-Q

1. **Generate 3 initial hypotheses** based on the error description, reproduction output, and codebase exploration. Assign each a confidence level: High / Medium / Low.

2. **Write all 3 hypotheses to `.harness/debug/hypotheses.md`** in this format:
   ```
   ## Hypothesis 1 — [ACTIVE] — High confidence
   **Claim:** <one-sentence hypothesis>
   **Falsification question:** If this is wrong, what evidence should exist?
   **Verification actions:** (to be executed)
   **Evidence:** (to be filled after verification)
   **Result:** (to be filled)

   ## Hypothesis 2 — [ACTIVE] — Medium confidence
   ...

   ## Hypothesis 3 — [ACTIVE] — Low confidence
   ...
   ```

3. **For each hypothesis (in confidence order, High first):** apply the canonical rules from `templates/_shared/falsification_rules.md` (see §Falsification Rules). Record each verification action and its output in hypotheses.md; adjust confidence or mark `[REFUTED]` based on evidence only. If a hypothesis is confirmed at High confidence → proceed to write root_cause.md.

4. **Loop termination conditions (max 3 rounds):**
   - **High confidence found:** Write root_cause.md and exit loop.
   - **All refuted, no new hypotheses:** Write root_cause.md with `confidence: "unknown"`, note that cause could not be determined from available evidence.
   - **Max 3 rounds reached:** Write root_cause.md with the highest-confidence surviving hypothesis, note uncertainty.

   Between rounds: generate up to 3 new hypotheses based on refutation evidence. Update hypotheses.md.

5. **Write `docs/harness/<slug>/root_cause.md`:**
   ```markdown
   # Root Cause Analysis

   ## Error Description
   <original error>

   ## Error Type
   <build | runtime | logic>

   ## Reproduction
   <reproduction conditions or "not reproduced — log/environment analysis">

   ## Root Cause
   <clear description of the root cause>

   ## Evidence
   <list of verification actions executed and their results>

   ## Confidence
   <High | Medium | Low | Unknown>

   ## Affected Locations
   <file:line references>

   ## Hypothesis History
   <brief summary of refuted hypotheses and why they were ruled out>
   ```

#### If mode == "deep": Phase 1-D (WORKFLOW path)

> Deep mode exists ONLY on the workflow path (§Mode Gate). The engine's `parallel()` replaces the old hand-rolled 2-sub-agent dispatch, the analysis-file writes/re-reads, and file-existence verification loops. The Fix Decision HARD-GATE stays in THIS orchestrator, immediately after the segment returns — never inside the script.

1. **Collect shared context** and save to `.harness/debug/context.md` (written ONCE here and not mutated afterward — it is also the resume source for a re-run):
   - Directory structure (top 3 levels)
   - Relevant file list (based on error description)
   - Reproduction output (from hypotheses.md)
   - Tech stack summary

2. **Run the Analyze segment** via the Workflow tool (pass `args` as a JSON object — the script defensively parses; the field set below is the 1:1 contract with the script's `// contract` comment — a field missing on either side silently renders as `''`):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/debug.analyze.workflow.js",
     args: {
       errorDescription: <state.error_description>,
       stackTrace: <from the error or --attach file, or "">,
       repoPath: <state.repo_path>,
       userLang: <state.user_lang>,
       hasGit: <state.has_git>,
       contextMd: <content of .harness/debug/context.md>,
       errorType: <state.error_type>,
       models: { advisor: <model_config.advisor or null>,
                 evaluator: <model_config.evaluator or null> }
     }
   }
   ```
   Record `runs.analyze → { "runId": "<id>" }`, `updated_at → now`.
   The script runs both analysts in parallel (anchoring-free — neither sees the other's output) and then an ADVERSARIAL cross-verify (the synthesizer actively tries to refute the surviving hypothesis with a fresh verification action, max 2 rounds).

3. **Persist results.** The segment returns `{ rootCause: RootCause, stats }` — schema-validated; NO analysis-file re-reads, NO 1-line parsing. Every hypothesis carries ≥1 executable verification action (schema-enforced `minItems: 1`).
   a. If `stats.analystsSucceeded < stats.analystsRequested`, warn (in `user_lang`): `[debug] ⚠ 1 analyst unavailable — cross-verify proceeded from the surviving analysis.`
   b. **Write `docs/harness/<slug>/root_cause.md` FROM the returned `RootCause` object** (orchestrator-owned render — the resume source; segment returns are in-context only). Map fields onto the established document structure:
      ```
      # Root Cause Analysis
      ## Error Description        ← state.error_description
      ## Error Type               ← rootCause.errorType
      ## Reproduction             ← rootCause.reproduction
      ## Agreement Points         ← rootCause.agreementPoints (bullets)
      ## Conflicts & Resolution   ← rootCause.conflictsResolved (topic / verificationAction / resolution per item)
      ## Adversarial Audit        ← rootCause.adversarialAudit
      ## Root Cause               ← rootCause.rootCause
      ## Confidence               ← rootCause.confidence + confidenceRationale bullets
      ## Affected Locations       ← table from rootCause.affectedLocations
      ## Hypothesis History       ← rootCause.hypotheses grouped by status (claim, confidence, verification actions)
      ## Recommended Fix Direction ← rootCause.recommendedFixDirection
      ```
      All free-text already arrives in `user_lang` (schema-enforced). Verify the file exists after writing.
   c. Append a brief copy of `rootCause.hypotheses[]` (claim — status — confidence — first action per hypothesis) to `.harness/debug/hypotheses.md` for audit continuity with the quick path.

4. Inform the user (in `user_lang`, one-liner sourced from `rootCause.summary`):
   ```
   [debug] Analysis complete.
     Analysts  : Error Analyst + Code Archaeologist (independent, parallel)
     Synthesis : adversarial cross-verify — {rootCause.summary}
     Output    : root_cause.md written
   ```

### HARD-GATE: Fix Decision

<HARD-GATE>
Read root_cause.md and present a summary to the user. Ask using AskUserQuestion (in `user_lang`):
  header: "Fix"
  question: "Root cause identified: [one-sentence summary from root_cause.md]. What would you like to do?"
  options:
    - label: "Fix it" / description: "Proceed to Phase 2 — apply a fix"
    - label: "Record cause only" / description: "Save root_cause.md and stop — fix manually later"
    - label: "Stop" / description: "Halt without saving anything"

- "Fix it" → Update state.json: phase → "fixing". Go to Phase 2.
- "Record cause only" → Update state.json: phase → "completed". Halt.
- "Stop" → Halt.
</HARD-GATE>

### Phase 2: Fix (Optional)

Update state.json: `phase` → `"fixing"`.

**Assess fix complexity:**

| Complexity | Criteria | Strategy |
|------------|----------|----------|
| Simple | Single file, < 20 lines, no architectural impact | Orchestrator applies directly |
| Complex | Multiple files, architectural change, or touches shared interfaces | Smart Routing → `/harness` |

**Simple fix (orchestrator applies directly):**
1. Read `docs/harness/<slug>/root_cause.md`.
2. Apply the fix directly to the affected files.
3. Run the test command (if available) to verify the fix.
4. Write `docs/harness/<slug>/fix_changes.md`:
   ```markdown
   # Fix Changes

   ## Root Cause (summary)
   <one-sentence root cause from root_cause.md>

   ## Changes Applied
   | File | Lines Changed | Description |
   |------|--------------|-------------|
   | `path/to/file.ts` | 5 | Fixed null check in getUserData() |

   ## Verification
   - Test result: <passed N / failed N / no tests>
   - Verified by: <test execution output summary or manual code review>
   ```

**Complex fix (Smart Routing):**
1. Do NOT apply the fix directly.
2. Inform the user (in `user_lang`) that the fix requires a structured workflow:
   ```
   [debug] This fix is complex (multiple files / architectural change).
   Suggested next step: /harness "Fix based on docs/harness/<slug>/root_cause.md"
   ```
   Translate the quoted suggestion text to `user_lang`.
3. Write `docs/harness/<slug>/fix_changes.md` noting that fix was deferred to `/harness`.
4. Do NOT auto-invoke `/harness`. Suggestion only.

### Phase 3: Prevention (Optional)

After Phase 2 completes (or if the user requests it), offer prevention steps.

Inform the user (in `user_lang`):
```
[debug] Fix applied. Running prevention analysis...
```

1. **Scan for same error pattern in other locations:**
   Use Grep to search the codebase for patterns similar to the root cause (same function, same anti-pattern, same import, etc.). Report any matches to the user.

2. **Suggest Smart Routing actions with concrete commands:**

   | Signal | Suggested Action |
   |--------|-----------------|
   | Root cause is a recurring anti-pattern | `/team-memory save "Anti-pattern: <description> — see docs/harness/<slug>/debug_report.md"`  |
   | Fix involved adding a new code path | `/test-gen --regression docs/harness/<slug>/debug_report.md` |
   | Root cause is a known risk area | Add a note to the project CLAUDE.md |

   These are **suggestions only** — do not auto-invoke other skills.

3. **Write `docs/harness/<slug>/debug_report.md`** (comprehensive final report):
   ```markdown
   # Debug Report

   ## Session Summary
   | Field | Value |
   |-------|-------|
   | Error | <description> |
   | Type  | <build / runtime / logic> |
   | Mode  | <quick / deep> |
   | Date  | <ISO8601> |

   ## Root Cause
   <full content from root_cause.md>

   ## Fix Applied
   <full content from fix_changes.md, or "Fix deferred to /harness">

   ## Prevention
   ### Same Pattern Found Elsewhere
   <list of other locations with the same pattern, or "None found">

   ### Recommended Actions
   - <concrete suggested action 1>
   - <concrete suggested action 2>

   ## Hypothesis History
   <summary of all hypotheses tested, confirmed, and refuted>
   ```

4. Update state.json: `phase` → `"completed"`.

5. Print final summary (in `user_lang`):
   ```
   [debug] Debug session complete.
     Root cause : <one-sentence summary>
     Fix        : <"Applied directly" | "Deferred to /harness" | "Not applied">
     Report     : docs/harness/<slug>/debug_report.md
   ```

### Status Check (anytime)

If the user asks for status, print status in the standard format defined above.

## Model Selection

Preset table + rules: see `templates/_shared/model_config.md`.

**Role map (deep mode segment agents):**
- Error Analyst → advisor
- Code Archaeologist → advisor
- Cross Verifier → evaluator (judgment role — pre-8.7 presets keep identical advisor/evaluator cells, so only `frontier` differentiates)

**Applying model config:** pass the resolved advisor + evaluator models once per segment run as `args.models` (`{ advisor: <model or null>, evaluator: <model or null> }`; null = inherit parent model, i.e. the `default` preset) — the segment script applies it per agent. Sub-agents must NOT directly access state.json to read model_config — the orchestrator passes the resolved value at segment launch.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Key Rules

- **Falsification rules are non-negotiable.** Canonical: `templates/_shared/falsification_rules.md` (see §Falsification Rules). Pure reasoning-only falsification is prohibited in both quick and deep modes — deep mode additionally enforces ≥1 executable action per hypothesis at the schema layer.
- **Never skip reproduction attempt for runtime/logic errors.** Always attempt Phase 0.7 before Phase 1.
- **Hypothesis verification loop is bounded.** Maximum 3 rounds (quick); the deep cross-verifier's adversarial audit is bounded at 2 rounds. If no high-confidence hypothesis survives, write root_cause.md with `Confidence: Unknown`.
- **Fix phase: never auto-chain to /harness.** Only suggest. The user must explicitly invoke `/harness`.
- **Deep mode: analysts are isolated.** Code Archaeologist must NOT see Error Analyst output (anchoring prevention) — the Analyze segment's `parallel()` enforces this.
- **Workflow args are a JSON object;** the segment script defensively parses (`args` may arrive as a JSON string — engine behavior). Keep the SKILL args block and the script's `// contract` comment in 1:1 sync. Never put user-gate decisions into args.
- **Graceful engine fallback.** Any Workflow failure degrades to the inline quick path with a notice — never a hard error. Gates live ONLY in this orchestrator, never in a segment script.
- **All permanent artifacts go to docs/harness/.** Temporary files (.harness/debug/) are ephemeral and cleaned up at session end.
- **Build errors get the fast path.** Skip reproduction and hypothesis loop for build/compile errors. Compiler output is direct evidence.
- **Confirmation gates are non-negotiable.** No implicit approval. The Fix Decision HARD-GATE requires explicit user choice before any code modification.
- **User language.** All user-facing output must be in `user_lang`. Re-detect on every user message.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill's execution WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **has_git == false fallback.** When git is unavailable, replace `git blame`/`git log` verification actions with file reads, Grep pattern searches, and dependency version checks.
- **State persistence.** Always write state.json before starting any phase. If the skill is interrupted, Session Recovery must be able to resume from the last recorded phase.
