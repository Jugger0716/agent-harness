---
name: refactor
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Safe, behavior-preserving code structure improvement with 3-tier mode — single (inline) or multi/comprehensive (2-3 analysts + cross-critique + synthesis via plugin-shipped native Workflow segments, opt-in gated). Atomic changes, test after each step, stop on failure. Use when improving code structure without changing behavior.
---

# Agent Harness Refactor

You are orchestrating a 3-Phase refactoring workflow with **selectable single, multi, or comprehensive mode**.

**Core principle:** Same behavior, better structure. Every change must preserve existing behavior. Tests are the safety net.

**Zero-setup:** No initialization required. Auto-detects language, test commands, and build commands from the current directory.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json (e.g. "ko", "en", "ja", "zh", "es", "de", etc.).

**All user-facing communication** must be in the detected language: progress updates, questions, confirmations, error messages, plan sections, QA report narrative, commit messages, confirmation gate prompts and options.

**Re-detection:** On every user message, check if the language has changed. If so, update `user_lang` and switch all subsequent communication.

**What stays in English:** Template instructions (this file and templates/*.md), state.json field names, file names (refactor_plan.md, changes.md, qa_report.md), git branch names, Workflow `args` field names.

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /refactor-specific resolution (the mode-selection roundtrip is removed EXCEPT §Ambiguity Prompt, which fires only when opt-in is absent):

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | single | **inline** (engine isolation requires git) |
| `--mode single` (or `quick`) | single | **inline** |
| `Workflow` tool NOT available this session | single | **inline** (notify only if an explicit `--mode multi/comprehensive` was requested) |
| `--mode multi` | multi | **workflow** |
| `--mode comprehensive` (or `thorough`/`deep`) | comprehensive | **workflow** |
| no `--mode` AND session is in ultracode mode | comprehensive | **workflow** |
| no `--mode`, no opt-in | single | **inline** (interactive + engine available → asks first, §Ambiguity Prompt) |

- **Multi/comprehensive exist ONLY on the workflow path** — the engine's `parallel()` fan-out replaces the old hand-rolled 2/3-analyst dispatch prose (Steps 2-M/2-C). The inline path is the preserved single mode.
- The `thorough`/`deep` aliases are deliberate cross-skill deepest-tier synonyms (every reframed skill accepts the others' deepest mode names and collapses them onto its own deepest tier); canonical mode names stay per-skill.
- **Scope-aware advisory (print only, no roundtrip):** print the recommendation — < 3 files → single, 3-10 → multi, 10+ or architecture-level → comprehensive — so a non-opted user knows which `--mode` to pass on re-invoke.
- **Workflow-path scope:** ONLY Step 2 (plan synthesis) and Step 5 (evaluation) run as segments. **Step 4 execution stays in this orchestrator on every path** — atomic step apply, test-after-each-step, the regression gates, the Safety Advisor, and the auto-fix flow are never scripted.
- **Graceful fallback:** if the Plan segment errors, print `[harness] ⚠ Workflow engine unavailable — falling back to the inline single path.` (in `user_lang`), set `path_resolved → "inline"`, `mode → "single"`, and continue via Step 2-S. If the Eval segment errors, fall back LOCALLY to the Step 5 inline evaluator dispatch (do not downgrade the rest of the session). Never error out.
- Record `path_resolved` in state.json and show `Path` in the status format.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`. refactor uses the `[harness]` prefix with a `Skill : refactor` identity line and a `Target` label:
```
[harness]
  Skill  : refactor
  Target : <target>
  Mode   : <single | multi | comprehensive>
  Path   : <inline | workflow>  (<reason per §Path Transparency>)
  Model  : <model_config preset name>
  Phase  : <phase label>
  Branch : <branch>          ← omit if has_git == false
  Scope  : <scope>
```
Phase labels: plan_ready → "Analyzer — writing refactor plan", gen_ready → "Executor — applying changes", eval_ready → "Verifier — checking behavior preservation", completed → "Completed"

## Session Recovery

Before starting a new task, check if `.harness/state.json` already exists **and** `state.json.skill` equals `"refactor"`:

1. If it exists and matches, print status in the standard format (including Model line from `model_config`), prefixed with `[harness] Previous refactor session detected.`
2. Restore `model_config` from state.json. Apply it to all subsequent sub-agent launches and Workflow `args.models`.
2.5. **Re-resolve §Mode Gate** (the new session may lack the Workflow tool or the opt-in) and update `path_resolved` — a session that started on the workflow path may legitimately resume on the inline path. Cross-session resume re-RUNS segments; `state.runs.*.runId` values are audit-only (`resumeFromRunId` is same-session only — never attempt it across sessions). This re-resolution reuses the stored `{ mode, path_resolved }` and MUST NOT re-fire **§Ambiguity Prompt** — only the existing workflow→inline downgrade (engine or git now absent) may change the stored path.
3. Ask the user using AskUserQuestion (in `user_lang`):
     header: "Session"
     question: "[harness] Previous refactor session detected. [print status in standard format]. Resume, restart, or stop?"
     options:
       - label: "Resume" / description: "Continue from {phase} where the previous session left off"
       - label: "Restart" / description: "Delete .harness/ and start from scratch"
       - label: "Stop" / description: "Delete .harness/ and halt"

   Actions per selection:
   - **Resume**: Jump to the step matching state.json phase (completion-artifact checks come FIRST, before any path branching — a deep session resumed without the engine must never overwrite completed work):
     - `plan_ready` → **FIRST, on BOTH paths**: if `{docs_path}refactor_plan.md` exists, go to Step 3 (the plan is complete — do not re-run any analysis). Else: inline path → Step 2-S; workflow path → Step 2-W (re-RUN the Plan segment; re-create `.harness/context.md` per Step 1.10 if missing).
     - `gen_ready` → Step 4 (always orchestrator-inline on every path).
     - `eval_ready` → **FIRST, on BOTH paths**: if `{docs_path}qa_report.md` already exists for the current round, skip to Step 6 and reconstruct the verdict from its `### Verdict:` line (sanctioned read — segment returns are in-context only). Else: Step 5 on the re-resolved path.
     - `completed` → no active session, proceed to Step 1
   - **Restart**: Delete `.harness/` directory and proceed to Step 1
   - **Stop**: Delete `.harness/` directory and halt

If `.harness/state.json` does not exist (or belongs to a different skill), proceed to Step 1 normally.

## Smart Routing

Before beginning, evaluate the user's request. If it does not match a refactoring task, suggest a better skill using AskUserQuestion (in `user_lang`):

| Signal | Suggested Skill |
|--------|----------------|
| User describes a new feature or bug fix | `/harness` |
| User mentions version upgrades, dependency changes, or migration | `/migrate` |
| User wants to understand the codebase before refactoring | `/codebase-audit` |

When a mismatch is detected, ask using AskUserQuestion:
  header: "Routing"
  question: "[detected mismatch]. A different skill may be more appropriate."
  options:
    - label: "Switch: /{suggested skill}" / description: "{why the suggested skill fits better}"
    - label: "Continue" / description: "Proceed with refactor anyway"

If the user selects "Continue", proceed with refactoring.

## Workflow

When the user provides a refactoring target (via $ARGUMENTS or in conversation), execute this workflow:

### Step 1: Setup

1. **Detect user language** from the target description. Store as `user_lang`.
2. **Slugify the target:** lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. Store as `<slug>`.
3. **Auto-detect project language and commands.** Scan the repo root:

   Language/test/build detection: see `templates/_shared/detection_table.md`.

   If none match, set language to "unknown", test/build commands to null.

4. **Git safety check:** Run `git status`. If there are uncommitted changes, ask using AskUserQuestion (in `user_lang`):
     header: "Uncommitted"
     question: "Uncommitted changes detected."
     options:
       - label: "Commit first" / description: "Stage and commit current changes before refactoring"
       - label: "Stash first" / description: "Run git stash to save changes temporarily"
       - label: "Proceed anyway" / description: "Continue with dirty working tree (risky)"
   If user selects "Commit first": stage and commit. If "Stash first": `git stash`. If "Proceed anyway": continue with warning noted.

5. **Create directories:** `.harness/`, `.harness/refactor/`, `{docs_path}`
6. **Create git branch:** `git checkout -b harness/refactor-<slug>`

7. **Capture baseline test results:**
   - If `test_cmd` is available, run it and save output to `.harness/refactor/baseline_tests.txt`.
   - Record: total tests, passed, failed, skipped.
   - **If baseline tests are failing:**
     Ask using AskUserQuestion (in `user_lang`):
       header: "Test Fail"
       question: "Baseline tests fail: {N} failures."
       options:
         - label: "Fix first" / description: "Halt refactoring and fix failing tests before proceeding"
         - label: "Proceed anyway" / description: "Continue with known failures (evaluator will ignore them)"
     If user selects "Fix first": halt and suggest `/harness fix failing tests`. If "Proceed anyway": store baseline failures in state.json as `baseline_failures` so the evaluator can distinguish pre-existing failures from regressions.
   - **If no test command detected:**
     Ask using AskUserQuestion (in `user_lang`):
       header: "No Tests"
       question: "No test suite detected. Behavior preservation will be verified by code review only."
       options:
         - label: "Proceed" / description: "Continue without test verification, rely on code review"
         - label: "Abort" / description: "Halt refactoring until tests are available"
     If user selects "Abort": halt. If "Proceed": set `test_available` to false and continue (verification will rely on code review only).

8. **Mode Gate resolution:** apply §Mode Gate INCLUDING **§Ambiguity Prompt** (single source: `templates/_shared/mode_gate.md`) — the mode roundtrip is removed EXCEPT this prompt, which fires only when NO opt-in is present (no `--mode`, ultracode OFF, `Workflow` tool available, `has_git == true`, interactive, no `--no-prompt`). Skill modes: single(inline) / multi(workflow) / comprehensive(workflow); ultracode-target: comprehensive. Store `mode` and `path_resolved` in state.json. Then emit **§Path Transparency** — show `Path : <inline | workflow>  (<reason>)`. Print the scope-aware advisory (< 3 files → single, 3-10 → multi, 10+ or architecture-level → comprehensive). If the user explicitly requested `--mode multi/comprehensive` but the gate resolved to inline (Workflow tool unavailable or `has_git == false`), notify (in `user_lang`): "multi/comprehensive mode requires the native Workflow engine and git — proceeding on the inline single path."
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->

9. **Model configuration selection:**
   If `--model-config <preset>` was passed, use it directly. Otherwise, use AskUserQuestion to ask the user (in `user_lang`):
     header: "Model"
     question: "Select model configuration for sub-agents:"
     options:
       - label: "default" / description: "Inherit parent model, no changes"
       - label: "all-opus" / description: "All sub-agents use Opus (highest quality)"
       - label: "balanced (Recommended)" / description: "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
       - label: "economy" / description: "Haiku executor + Sonnet advisor/evaluator (max savings)"

   **If "Other" selected:** Parse custom format `executor:<model>,advisor:<model>,evaluator:<model>`. Validate each model name — only `opus`, `sonnet`, `haiku` are allowed (case-insensitive). If any model name is invalid, inform the user which value is invalid and re-ask for input (max 3 retries, then apply `balanced` as default). If parsing succeeds but is partial, fill missing roles with the `balanced` defaults (executor=sonnet, advisor=opus, evaluator=opus). Show the parsed result to the user and ask for confirmation before proceeding.

   **Model config is set once at session start and cannot be changed mid-session.** To change, restart the session.

   **Verifier model** (for consistency with /harness): `model_config.verifier = cli_flags.verifier_model ?? "haiku"`. Parse `--verifier-model <haiku|sonnet|opus>` from CLI if provided; reject other values. Note: `/refactor` does not currently dispatch a Verify sub-agent directly (test regression uses `test_cmd` directly), so this field is stored for future extension.

   Store result as `model_config` object: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>", "verifier": "<haiku|sonnet|opus>" }`. For the `default` preset, store `{ "preset": "default", "verifier": "<resolved>" }`.

10. **Shared context collection (multi/comprehensive only — i.e. the workflow path):**
   Collect project context once and save to `.harness/context.md`:
   - Directory structure (top 3 levels)
   - Dependency info (package files content)
   - Tech stack summary
   - Files in scope (list with brief descriptions)
   This avoids duplicate codebase scans by sub-agents.

11. **Write `.harness/state.json`** with fields: `skill` ("refactor"), `target`, `mode` ("single"/"multi"/"comprehensive"), `path_resolved` ("inline"/"workflow" — from §Mode Gate; re-resolved on resume), `runs` (`{ "plan": null, "eval": null }`; each records `{ "runId": "<wf_...>" }` after a segment launch — audit + same-session iteration only, cross-session resume re-RUNS segments per §Session Recovery 2.5), `model_config` (from step 9 — includes `verifier` field), `user_lang`, `repo_name`, `repo_path`, `phase` ("plan_ready"), `round` (1), `max_rounds` (3), `scope` (user-provided or "(no limit)"), `branch` ("harness/refactor-<slug>"), `lang`, `test_cmd`, `build_cmd`, `test_available` (true/false), `baseline_test_results` (summary string), `baseline_failures` (list of known-failing tests, or []), `docs_path` ("docs/harness/<slug>/"), `verify: { autofix_attempted: false }`, `autofix` (null), `created_at` (ISO8601).

> `verify.autofix_attempted`: nested field (aligned with `/harness` schema — not a flat top-level field). Session-wide once-only limit — applies across all steps, not reset on round increment. `/harness` Layer 1/2 fields are absent from `/refactor` `verify` object.
> `autofix` transitions to `{ "last_patch_path": ".harness/refactor/auto_fix_patch.md", "applied": "proposed"|"applied"|"rejected"|"stopped", "triggered_at": "<ISO8601>" }` during H2 flow.
> **Backward compat (reader-union)**: Reader: check `verify.autofix_attempted` first; if missing/null, fall back to top-level `autofix_attempted` (legacy pre-v8.1). Writer: write only to `verify.autofix_attempted`.
> Example — pre-v8.1 session fixture: `{ "autofix_attempted": true, "autofix": null, ... }` → reader-union result: effective `verify.autofix_attempted == true` (fallback hit). Next write: `{ "verify": { "autofix_attempted": true }, "autofix": null, ... }`.

12. **Print setup summary** (in `user_lang`):
    ```
    [harness] Refactor started!
      Repo     : <path>
      Branch   : harness/refactor-<slug>
      Mode     : <single | multi | comprehensive>
      Path     : <inline | workflow>  (<reason per §Path Transparency>)
      Model    : <preset name>
      Verifier : N/A (test_cmd direct — future extension)
      Language : <lang>
      Test     : <test_cmd or "none">
      Build    : <build_cmd or "none">
      Baseline : <N tests passing, M failing or "no tests">
      Scope    : <scope>
    ```

### Step 2: Phase 1 — Impact Analysis

Read `mode` and `path_resolved` from state.json and branch accordingly.

#### If mode == "single": Step 2-S

1. Explore the codebase — read the target files and their dependents/dependencies. Understand the current structure, coupling, and cohesion.
2. Analyze the refactoring target:
   - What structural problems exist? (coupling, cohesion, complexity, duplication)
   - What is the impact scope? (which files depend on the target, which files does the target depend on)
   - What tests cover the target code?
   - What is the safest order of changes?
3. Write `refactor_plan.md` to `{docs_path}refactor_plan.md` with the following sections (translate headings to `user_lang`):

   ### Goal
   What structural improvement is being achieved? One or two sentences.

   ### Current State Analysis
   What structural problems exist in the target code? Be specific with file paths and line ranges.

   ### Impact Scope
   Which files will be directly modified? Which files are indirectly affected (dependents)?

   ### Refactoring Steps
   Ordered list of atomic changes. Each step must:
   - Be independently testable
   - Preserve behavior after completion
   - Include: step number, description, files affected, expected test impact
   Use GitHub-flavored Markdown checkboxes:
   - [ ] Step 1: <description> — files: <list> — test: <expected result>
   - [ ] Step 2: ...

   ### Test Coverage Assessment
   Which tests cover the target? Are there gaps? If gaps exist, recommend writing tests first.

   ### Risks
   What could go wrong? For each risk: likelihood, impact, mitigation.

4. Update state.json: phase → `"plan_ready"`.
5. Print status in the standard format, prefixed with `[harness] Analysis complete.`

#### If mode == "multi" or "comprehensive": Step 2-W (WORKFLOW path)

> Multi/comprehensive exist ONLY on the workflow path (§Mode Gate). The engine's `parallel()` fan-out replaces the old hand-rolled 2/3-analyst dispatch, the `.harness/refactor/analysis_*.md` / `critique_*.md` intermediate files, and the file re-reads. The Plan Confirmation HARD GATE (Step 3) is rendered by THIS orchestrator AFTER the segment returns — never inside the script.

1. **Ensure `.harness/context.md` exists** — if it was not created in Setup (e.g., resuming from session recovery), create it now following the same collection procedure as Step 1.10.

2. **Run the Plan segment** via the Workflow tool (pass `args` as a JSON object — the script defensively parses; the field set below is the 1:1 contract with the script's `// contract` comment — a field missing on either side silently renders as ''):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/refactor.plan.workflow.js",
     args: {
       target: <target>, repoPath: <repo_path>, lang: <lang>, scope: <scope>,
       userLang: <user_lang>,
       context: <content of .harness/context.md>,
       testCmd: <test_cmd or "">, baselineTestResults: <baseline_test_results>,
       mode: <"multi"|"comprehensive">,
       models: { executor: <model_config.executor or null>,
                 advisor: <model_config.advisor or null> }
     }
   }
   ```
   Record `runs.plan → { "runId": "<id>" }`.
   The script runs the analysts in parallel (anchoring-free — none sees another's output), cross-critiques them in comprehensive mode, and synthesizes one structured plan.

3. The segment returns `{ plan: RefactorPlan, stats }` — schema-validated; NO analysis-file re-reads, NO 1-line parsing. Print (in `user_lang`): `  ✓ Plan segment: {stats.analystsSucceeded}/{stats.analystsRequested} analyses → {stats.critiquesSucceeded} critiques → synthesis`
   - If `stats.analystsSucceeded < stats.analystsRequested`, warn (in `user_lang`): `[harness] ⚠ {N} analyst(s) unavailable — synthesis proceeded from the remaining analyses.`

4. **Orchestrator writes `{docs_path}refactor_plan.md` from the RefactorPlan object** (headings in `user_lang`):
   - `### Goal` ← `goal` ; `### Current State Analysis` ← `currentState`
   - `### Impact Scope` ← `impactScope.direct` / `impactScope.indirect` bullet lists
   - `### Refactoring Steps` ← `steps[]` as GFM checkboxes `- [ ] Step {n}: {description} — files: {files} — test: {testImpact} — risk: {risk}`
   - `### Test Coverage Assessment` ← `testCoverage[]` as `- {target}: {coverage} — {gapAction}` (empty array → "N/A — no coverage data")
   - `### Completion Criteria` ← `acceptanceCriteria[]` as GFM checkboxes `- [ ] {id}: {text}`
   - `### Risks` ← `risks[]` as `- {risk} — Likelihood: {likelihood} — Mitigation: {mitigation}` (append `(source)` when present)
   Verify the file exists after writing (rendering is orchestrator-owned and deterministic).

5. Update state.json: phase → `"plan_ready"`.
6. Inform the user (in `user_lang`):
   ```
   [harness] Analysis complete.
     Analyses        : {stats.analystsSucceeded} specialists analyzed independently
     Cross-reviews   : {stats.critiquesSucceeded} cross-critiques    ← omit if multi mode
     Output          : refactor_plan.md synthesized
   ```
7. **On Workflow error** (launch failure, script error, schema-invalid result): apply §Mode Gate graceful fallback → notify, set `path_resolved → "inline"`, `mode → "single"`, and re-run this step via Step 2-S.

### Step 3: HARD GATE — Plan Confirmation

<HARD-GATE>
Show refactor_plan.md to the user and ask for explicit confirmation using AskUserQuestion (in `user_lang`):
  header: "Plan"
  question: "Review the plan. {mode} mode uses ~{N}x tokens."
  options:
    - label: "Proceed" / description: "Start execution as planned"
    - label: "Modify" / description: "Edit the plan, then re-confirm"
    - label: "Switch to single" / description: "Reduce scope to single-agent mode (~1x tokens)"
    - label: "Stop" / description: "Halt the workflow"

If user selects "Modify" or provides modification details via "Other": update refactor_plan.md and re-present this question.
If user selects "Switch to single": update mode in state.json to "single" and re-present this question.
If user selects "Stop": halt the workflow.
Only "Proceed" advances to the Execution phase.
</HARD-GATE>

### Step 4: Phase 2 — Execution

Read `mode` from state.json and branch accordingly.

**Core execution principles (all modes):**
- **Atomic changes:** Execute one refactoring step at a time from the plan.
- **Test after each step:** Run `test_cmd` after every step. Compare with baseline.
- **Stop on failure:** If any test that was passing in baseline now fails, STOP IMMEDIATELY. Do NOT attempt auto-fix. Report the failure and ask the user.
- **No tests available:** If `test_available` is false, perform manual code review of behavior equivalence after each step instead of running tests.

#### If mode == "single": Step 4-S

1. Update state.json: phase → `"gen_ready"`, read current round.
2. For each step in refactor_plan.md (in order):
   a. Announce the step (in `user_lang`): `[harness] Step N: <description>`
   b. Execute the refactoring change.
   c. Run `test_cmd` (if available). Compare results with baseline.
   d. **If new test failure:**

      <HARD-GATE>
      Ask using AskUserQuestion (in `user_lang`):
        header: "Regression"
        question: "Test regression detected (Step {N}). Failed: {test}."
        options:
          - label: "Auto-fix proposal" / description: "Let AI (Opus) analyze the failure and propose a minimal diff (1 attempt only)" ← **HIDE if `verify.autofix_attempted == true OR state.autofix != null`** (session-wide once-only — applies across all steps)
          - label: "Revert step" / description: "Undo this step, mark as failed, continue to next step"
          - label: "Manual fix" / description: "Pause for manual fix, then re-run tests"
          - label: "Abort refactoring" / description: "Stop all refactoring and go to cleanup"
      </HARD-GATE>

      If "Revert step": undo the step, mark it as failed in changes.md, continue to next step.
      If "Manual fix": wait for user to fix, then re-run tests.
      If "Abort refactoring": go to Step 7 (cleanup).

      **If "Auto-fix proposal":**
      1. Update state.json: `autofix → { "last_patch_path": ".harness/refactor/auto_fix_patch.md", "applied": "proposed", "triggered_at": "<ISO8601>" }`
      2. Read template: `{CLAUDE_PLUGIN_ROOT}/templates/refactor/auto_fix_proposer.md`
      3. Fill variables (pass **paths only** — Proposer reads files directly):
         - `{refactor_step_description}` = current step description from refactor_plan.md
         - `{test_output_path}` = path where test output was written (or inline if short)
         - `{changed_files_list}` = list of files modified in this step
         - `{output_path}` = `.harness/refactor/auto_fix_patch.md`
         - `{user_lang}` = from state.json
      4. **Dispatch Auto-fix Proposer sub-agent** with `model: model_config.advisor ?? "opus"`.
      5. Parse return 1-line. Extract `confidence` level.
      6. Verify `.harness/refactor/auto_fix_patch.md` exists.

      <HARD-GATE>
      Show confidence level + 1-line summary.
      Print before question: `[harness] ℹ Auto-fix model: {model_config.advisor ?? 'opus'}`
      Ask via AskUserQuestion (in `user_lang`):
        header: "Auto-fix"
        question: "Proposed fix generated (confidence: {level}). [If confidence == Low: ⚠ Low confidence — review the diff carefully before applying.] Apply the patch?"
        options:
          - label: "Apply patch" / description: "Apply the proposed diff and re-run tests (retry counter unchanged)"
          - label: "Reject" / description: "Discard proposal, return to regression gate (Auto-fix hidden)"
          - label: "Stop" / description: "Halt for manual intervention"
      </HARD-GATE>

      After 2nd HARD-GATE decision: set `verify.autofix_attempted = true` in state.json (session-wide once-only — applies across all steps).

      **If "Apply patch":**
      1. Snapshot: `git stash` (has_git) or copy to `.harness/autofix_pre_apply/` (no git).
      2. Apply unified diff from `.harness/refactor/auto_fix_patch.md`.
         - Apply failure → restore snapshot, warn user, return to regression HARD-GATE (Auto-fix hidden).
      3. Update state.json: `autofix.applied → "applied"`.
      4. Re-run `test_cmd` (retry counter unchanged):
         - **PASS** → mark step as done, continue.
         - **FAIL** → update `autofix.applied → "stopped"`. Return to regression HARD-GATE (Auto-fix hidden).

      **If "Reject":** Update `autofix.applied → "rejected"`. Return to regression HARD-GATE (Auto-fix hidden).
   e. If tests pass (or no tests): mark step as done, continue.
3. After all steps complete, write `{docs_path}changes.md` with sections:
   - Round {round_num} Changes
   - Completed Steps (with checkbox status from plan)
   - Modified Files — path + brief reason
   - Created Files (if any)
   - Deleted Files (if any)
   - Test Results After Each Step (summary)
4. Print status in the standard format, prefixed with `[harness] Execution complete.`

#### If mode == "multi" or mode == "comprehensive": Step 4-MC

##### Step 4a-MC: Execution with Safety Advisor

1. Update state.json: phase → `"gen_ready"`, read current round.
2. For each step in refactor_plan.md (in order):
   a. Announce the step (in `user_lang`): `[harness] Step N: <description>`
   b. Read the safety advisor template: `{CLAUDE_PLUGIN_ROOT}/templates/refactor/safety_advisor.md`
   c. Prepare the safety advisor prompt: `{step_number}`, `{step_description}`, `{files_affected}`, `{refactor_plan_content}` (full plan for context), `{repo_path}`, `{lang}`, `{test_cmd}`, `{user_lang}`, `{previous_steps_summary}` (what was already done)
   d. **Launch 1 subagent** (Safety Advisor) to review the proposed step BEFORE execution. If `model_config.preset` is not `"default"`, pass `model` parameter per the preset table in `templates/_shared/model_config.md` (Safety Advisor → advisor role). The Safety Advisor:
      - Verifies the step preserves behavior
      - Identifies any behavioral side effects
      - Gives GO / CAUTION / STOP recommendation
   e. **If Safety Advisor says STOP:** Report to user with explanation. Ask: (skip step / modify step / abort)
   f. **If Safety Advisor says CAUTION:** Report concerns to user. Ask: (proceed with caution / skip step / abort)
   g. **If Safety Advisor says GO (or user overrides):** Execute the refactoring change.
   h. Run `test_cmd` (if available). Compare results with baseline.
   i. **If new test failure:** Same handling as Step 4-S.2.d.
   j. If tests pass: mark step as done, continue.
3. After all steps complete, write `{docs_path}changes.md` with sections:
   - Round {round_num} Changes
   - Completed Steps (with checkbox status)
   - Safety Advisor Assessments (per step: GO/CAUTION/STOP + brief note)
   - Modified Files — path + brief reason
   - Created Files (if any)
   - Deleted Files (if any)
   - Test Results After Each Step (summary)
4. Inform the user (in `user_lang`):
   ```
   [harness] Execution complete.
     Steps    : N/M completed
     Safety   : Safety Advisor reviewed each step
     Tests    : All passing (or: N regressions detected)
     Output   : changes.md written
   ```

### Step 5: Phase 3 — Verification (Isolated Evaluator)

1. Update state.json: phase → `"eval_ready"`.
2. **Prepare the anchor-free inputs (both paths):** `{refactor_plan_content}` (structural goals only — strip implementation details), `{changed_files_list}` (file paths only from changes.md — **strip all reasoning** to prevent anchoring), `{test_available}`, `{build_cmd}`, `{test_cmd}`, `{baseline_test_results}`, `{baseline_failures}` (pre-existing failures to ignore), `{round_num}`, `{scope}`, `{user_lang}` from state.json, `{qa_report_path}`: `{docs_path}qa_report.md`.
   **Do NOT include:** Execution reasoning, safety advisor assessments, why files were changed, or references to "Generator"/"AI"/"agent" as code author.

#### Step 5 — INLINE path (mode: single)

3. Read the evaluator template: `{CLAUDE_PLUGIN_ROOT}/templates/refactor/evaluator.md` and fill the variables above.
4. **Launch the Evaluator subagent** using the Agent tool. If `model_config.preset` is not `"default"`, pass `model` parameter per the preset table in `templates/_shared/model_config.md` (Evaluator → evaluator role). It writes the QA report to `{qa_report_path}`.
5. When the subagent returns, read `{docs_path}qa_report.md` to get the verdict (the on-disk template's `### Verdict:` regex contract — inline path only).

#### Step 5 — WORKFLOW path (mode: multi | comprehensive)

3. **Run the Eval segment** via the Workflow tool (field set = 1:1 contract with the script's `// contract` comment):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/refactor.eval.workflow.js",
     args: {
       planGoals: <refactor_plan_content (structural goals only)>,
       changedFilesList: <file paths only, reasons stripped>,
       testAvailable: <bool>, buildCmd: <build_cmd or "">, testCmd: <test_cmd or "">,
       baselineTestResults: <baseline_test_results>, baselineFailures: <baseline_failures>,
       roundNum: <round>, scope: <scope>, userLang: <user_lang>,
       qaReportPath: "{docs_path}qa_report.md",
       models: { evaluator: <model_config.evaluator or null> }
     }
   }
   ```
   Record `runs.eval → { "runId": "<id>" }`.
4. The segment returns a **VerifyVerdict** (schema-validated — NO regex parse on this path). The evaluator agent has also WRITTEN `{docs_path}qa_report.md` (user-facing artifact + the cross-session verdict-reconstruction source). **Verify the file exists**; if missing, derive it yourself from the verdict object (orchestrator-derived fallback — one Write, no re-dispatch).
5. **On Workflow error**: fall back LOCALLY to the Step 5 INLINE evaluator dispatch above (do NOT downgrade the rest of the session — the session stays on the workflow path for any later round's Plan segment).

### Step 6: Verdict & Loop

Determine the verdict:
- **INLINE path:** Read qa_report.md and look for `### Verdict: PASS` or `### Verdict: FAIL`.
- **WORKFLOW path:** use the `VerifyVerdict` object from the Eval segment — branch on **(layer, verdict)**, never verdict alone. Refactor mapping (see `workflows/_reference/schemas.md` consumer note): `(L1, FAIL_L2)` = mechanical test regression / build failure; `(L3, FAIL_L3)` = behavior-preservation judgment failure; `(L3, PASS)` = pass. ANY non-PASS verdict is treated as FAIL for the gate below; build the failure summary from `verdict.summary` + top `failures[].fix` lines. **On resume with no in-context VerifyVerdict:** read qa_report.md's `### Verdict:` line — mirrors the INLINE procedure (sanctioned read).

**If PASS:** Update state.json: phase → `"completed"`. Inform user: refactoring complete, behavior preserved. Proceed to Step 7.

**If FAIL and rounds remaining (round < max_rounds):** Do NOT auto-retry. Ask the user using AskUserQuestion (in `user_lang`):
  header: "QA"
  question: "QA result: FAIL. [failure summary]."
  options:
    - label: "Fix" / description: "Run next round to fix FAIL items only"
    - label: "Accept as-is" / description: "Finish without fixing, keep current state"
If user selects "Fix": increment round, go to Step 4. If "Accept as-is": phase → "completed", go to Step 7.

**If FAIL and max rounds reached:** phase → `"completed"`. Inform user of remaining issues. Proceed to Step 7.

### Step 7: Cleanup & Commit

#### Artifact Cleanup Safety Guard

Cleanup safety rules: see `templates/_shared/safety_guard.md`.

Ask the user using AskUserQuestion (in `user_lang`):
  header: "Commit"
  question: "Implementation complete. Choose how to finish:"
  options:
    - label: "Commit code only (Recommended)" / description: "Clean up artifacts (.harness/, {docs_path}) then commit code changes only"
    - label: "Commit all" / description: "Commit everything including artifacts (refactor_plan.md, changes.md, qa_report.md)"
    - label: "No commit" / description: "Clean up .harness/ only, do not commit (changes remain in working tree)"

Actions per selection (apply Safety Guard before each delete):
- "Commit code only": delete `.harness/` dir, delete `{docs_path}` dir (**only** this slug dir — verify via guard), stage and commit remaining code changes
- "Commit all": delete `.harness/` dir, stage and commit `{docs_path}` files + code changes
- "No commit": delete `.harness/` dir only

### Status Check (anytime)

If user asks for status, print status in the standard format defined above.

## Model Selection

Preset table + rules: see `templates/_shared/model_config.md`.

Role-map: Structural / Risk / Feasibility Analyst -> executor; Cross-Critique / Safety Advisor -> advisor; Evaluator -> evaluator.

**WORKFLOW path:** pass the resolved models once per segment run as `args.models` — Plan segment `{ executor, advisor }`, Eval segment `{ evaluator }` (null = inherit parent model, i.e. the `default` preset) — the segment scripts apply them per agent. The Safety Advisor and Auto-fix Proposer are always dispatched inline by the orchestrator (Step 4 is never scripted) and take their `model` parameter at launch as before. Sub-agents must NOT access state.json for model config.

> **Verifier defaults to haiku; override with `--verifier-model sonnet|opus`** (stored in `model_config.verifier`). `/refactor` currently does not dispatch a separate Verify sub-agent — test regression uses `test_cmd` directly. The verifier field is stored for future extension. Auto-fix Proposer uses `model_config.advisor ?? "opus"` instead.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Key Rules

- **Behavior preservation is non-negotiable.** Every change must keep existing tests passing. Stop immediately on regression.
- **Atomic changes only.** One refactoring step at a time. Test between each. Never batch multiple refactoring operations.
- **Confirmation gates are non-negotiable.** No implicit approval, no proceeding on ambiguity.
- **Stay within scope.** Do not modify files outside the specified scope.
- **Evaluator must be isolated.** Always run as a subagent with anchor-free input. Never pass execution reasoning to the Evaluator.
- **Analyst proposals must be independent.** Never share one analyst's findings with another during the analysis phase.
- **Safety Advisor reviews before execution, not after.** Advisory input happens before each step is applied.
- **Use whatever skills are available.** Search by capability keyword, not plugin name. If no match, proceed without it.
- **User language.** All user-facing output must be in `user_lang`. Re-detect on every user message. WORKFLOW path: pass `userLang` in `args` — the segment scripts build schema descriptions from it, which forces sub-agent free-text output language; ids/enums stay English raw.
- **Intermediate outputs are ephemeral.** Only final artifacts (refactor_plan.md, changes.md, qa_report.md) are preserved in `docs/`. On the workflow path there are no intermediate analysis/critique files at all — segments return schema-validated objects.
- **Mode Gate + §Ambiguity Prompt.** The mode roundtrip is removed EXCEPT §Ambiguity Prompt (fires only when opt-in absent: no `--mode`, ultracode OFF, engine available, interactive, no `--no-prompt`). Modes: single(inline) / multi(workflow) / comprehensive(workflow); ultracode-target: comprehensive. The scope advisory stays print-only. Store `mode` + `path_resolved` in state.json; emit §Path Transparency. On session recovery, re-resolve WITHOUT re-firing §Ambiguity Prompt (reuse stored mode/path_resolved; only workflow→inline downgrade may change it).
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
- **Fan-out exists only on the workflow path.** Multi/comprehensive analysis runs as plugin-shipped segment scripts; without the engine or opt-in, the session runs single inline (with a notice on explicit requests).
- **Execution is never scripted.** Step 4 (atomic apply + test-after-each + regression gates + Safety Advisor + auto-fix) stays in this orchestrator on every path.
- **Workflow args are a JSON object;** segment scripts defensively parse (`args` may arrive as a JSON string — engine behavior). Keep the SKILL args blocks and the scripts' `// contract` comments in 1:1 sync. Never put user-gate decisions into args.
- **Graceful engine fallback.** Plan-segment failure degrades the session to the inline single path; Eval-segment failure falls back locally to the inline evaluator dispatch — never a hard error. Gates live ONLY in this orchestrator, never in a segment script.
- **No auto-fix on test failure.** Report the failure, give the user options. Never attempt to fix a regression automatically.
