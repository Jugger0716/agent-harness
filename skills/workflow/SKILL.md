---
name: workflow
description: 3-Phase (Planner -> Generator -> Evaluator) workflow with selectable single-agent or multi-agent persona mode. Use for development tasks (feature work, bug fixes, maintenance) AND non-development tasks (planning data processing, document generation, analysis) that benefit from structured planning, implementation, and review.
---

# Agent Harness Workflow

You are orchestrating a 3-Phase workflow with **selectable single-agent or multi-agent persona mode**.

**Zero-setup:** No initialization required. Auto-detects language, test commands, and build commands from the current directory. Works with or without a git repository.

## Environment Detection

At startup, detect whether the current directory is inside a git repository:
```
git rev-parse --is-inside-work-tree 2>/dev/null
```
- If the command succeeds → `has_git = true`
- If the command fails → `has_git = false`

Store `has_git` in state.json. This flag controls whether git operations (branch creation, commits) are performed. **All core workflow phases (Planner → Generator → Evaluator) work identically regardless of `has_git`.**

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json (e.g. "ko", "en", "ja", "zh", "es", "de", etc.).

**All user-facing communication** must be in the detected language: progress updates, questions, confirmations, error messages, spec sections, QA report narrative, commit messages (if has_git), confirmation gate prompts and options.

**Re-detection:** On every user message, check if the language has changed. If so, update `user_lang` and switch all subsequent communication.

**What stays in English:** Template instructions (this file and templates/*.md), state.json field names, file names (spec.md, changes.md, qa_report.md), git branch names (if has_git).

## Standard Status Format

When displaying status, read `.harness/state.json` and print (in `user_lang`):
```
[harness]
  Task   : <task>
  Mode   : <single | standard | multi>
  Model  : <model_config preset name>
  Phase  : <phase label>
  Round  : <round> / <max_rounds>
  Branch : <branch>          ← omit this line if has_git == false
  Scope  : <scope>
```
Phase labels: plan_ready → "Planner — writing spec", gen_ready → "Generator — implementing", verify_ready → "Verify — mechanical check", verifying → "Verify — running checks", verify_done → "Verify — checks complete", eval_ready → "Evaluator — reviewing", completed → "Completed"

## Session Recovery

Before starting a new task, check if `.harness/state.json` already exists:

1. If it exists, print status in the standard format (including Model line from `model_config`), prefixed with `[harness] Previous session detected.`
2. Restore `model_config` from state.json. Apply it to all subsequent sub-agent launches.
3. If `has_git` is not present in state.json (pre-existing session from older version), re-detect using the Environment Detection command and store the result.
4. Ask the user using AskUserQuestion (in `user_lang`):
     header: "Session"
     question: "[harness] Previous session detected. [print status in standard format]. Resume, restart, or stop?"
     options:
       - label: "Resume" / description: "Continue from {phase} where the previous session left off"
       - label: "Restart" / description: "Delete .harness/ and start from scratch"
       - label: "Stop" / description: "Delete .harness/ and halt"

   Actions per selection:
   - **Resume**: Jump to the step matching state.json phase:
     `plan_ready` → if spec.md exists go to Step 3, else Step 2 |
     `gen_ready` → Step 4 | `verify_ready` / `verifying` / `verify_done` → Step 4.5 (Auto-Verify) |
     `eval_ready` → Step 5 |
     `completed` → no active session, proceed to Step 1
   - **Restart**: Delete `.harness/` directory and proceed to Step 1
   - **Stop**: Delete `.harness/` directory and halt

If `.harness/state.json` does not exist, proceed to Step 1 normally.

## Workflow

When the user provides a task (via $ARGUMENTS or in conversation), execute this workflow:

### Step 1: Setup

1. **Detect user language** from the task description. Store as `user_lang`.
2. **Slugify the task:** lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. Store as `<slug>`.
3. **Auto-detect project language and commands.** Scan the working directory:

   | File | Language | Test Command | Build Command |
   |------|----------|-------------|---------------|
   | `build.gradle(.kts)` | java | `./gradlew test` | `./gradlew build` |
   | `pom.xml` | java | `mvn test` | `mvn compile` |
   | `pyproject.toml` / `setup.py` | python | `pytest` | (none) |
   | `package.json` | typescript | `npm test` | `npm run build` |
   | `*.csproj` | csharp | `dotnet test` | `dotnet build` |
   | `go.mod` | go | `go test ./...` | `go build ./...` |
   | `Cargo.toml` | rust | `cargo test` | `cargo build` |

   If none match, set language to "unknown", test/build commands to null.

   **3a. Auto-detect lint command.** Check in order, stop at first match:

   | Priority | Detection | Condition | lint_cmd |
   |----------|-----------|-----------|----------|
   | 1 | Read `package.json` | `scripts.lint` key exists | `npm run lint` |
   | 2 | Glob | `.eslintrc` / `.eslintrc.js` / `.eslintrc.json` / `.eslintrc.yml` / `eslint.config.js` / `eslint.config.mjs` exists | `npx eslint .` |
   | 3 | Read `pyproject.toml` | `[tool.ruff]` section exists | `ruff check .` |
   | 4 | Glob + Read | `.pylintrc` exists OR `pyproject.toml` has `[tool.pylint]` | `pylint {scope}` |
   | 5 | Glob | `.golangci.yml` / `.golangci.yaml` exists | `golangci-lint run` |
   | 6 | Glob | `Cargo.toml` exists | `cargo clippy` |

   If none match, set `lint_cmd` to null (will be SKIPPED during verification).

   **3b. Auto-detect type-check command.** Check in order, stop at first match:

   | Priority | Detection | Condition | type_check_cmd |
   |----------|-----------|-----------|----------------|
   | 1 | Glob | `tsconfig.json` exists | `npx tsc --noEmit` |
   | 2 | Glob + Read | `mypy.ini` exists OR `pyproject.toml` has `[tool.mypy]` | `mypy .` |
   | 3 | Glob + Read | `pyrightconfig.json` exists OR `pyproject.toml` has `[tool.pyright]` | `pyright` |
   | 4-6 | — | `*.csproj` / `go.mod` / `Cargo.toml` (build includes type-check) | null |

   If none match, set `type_check_cmd` to null (will be SKIPPED during verification).

   **CLI override:** If `--lint-cmd` or `--type-check-cmd` was passed, use that value directly and skip auto-detection for the respective command.

4. **Create directories:** `.harness/`, `.harness/planner/`, `.harness/generator/`, `docs/harness/<slug>/`
5. **Create git branch (if has_git):** `git checkout -b harness/<slug>`. If `has_git == false`, skip this step entirely.
6. **Mode selection:** If `--mode single`, `--mode standard`, or `--mode multi` was passed, set mode and skip prompt. Otherwise, use AskUserQuestion to ask the user (in `user_lang`):
     header: "Mode"
     question: "Select workflow mode:"
     options:
       - label: "standard (Recommended)" / description: "2 specialists analyze + synthesize. ~1.5x tokens. Balanced depth"
       - label: "single" / description: "1 agent. Fast, token-saving. Best for simple tasks"
       - label: "multi" / description: "3 specialists + cross-critique. ~2-2.5x tokens. Deepest analysis"
7. **Model configuration selection:**
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

   Store result as `model_config` object: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>", "verifier": "haiku" }`. For the `default` preset, store `{ "preset": "default", "verifier": "haiku" }` (executor/advisor/evaluator inherit parent model, but verifier is always explicit).

8. **Write `.harness/state.json`** with fields: `task`, `mode` ("single"/"standard"/"multi"), `model_config` (from step 7 — include `"verifier": "haiku"` in addition to executor/advisor/evaluator), `user_lang`, `has_git` (boolean), `repo_name`, `repo_path` (working directory path), `phase` ("plan_ready"), `round` (1), `max_rounds` (3), `max_files` (20), `scope` (user-provided or "(no limit)"), `branch` (if has_git: "harness/<slug>", else: null), `lang`, `test_cmd`, `build_cmd`, `lint_cmd` (from step 3a, or null), `type_check_cmd` (from step 3b, or null), `verify` (`{ "layer1_result": null, "layer1_retries": 0, "todo_blocking": false }`), `docs_path` ("docs/harness/<slug>/"), `created_at` (ISO8601).
9. **Print setup summary** (in `user_lang`):
   ```
   [harness] Task started!
     Directory : <path>
     Branch    : harness/<slug>     ← omit if has_git == false
     Mode      : <single | multi>
     Model     : <preset name> (e.g. "default", "all-opus", "balanced", "economy")
     Language  : <lang>
     Test      : <test_cmd or "none">
     Build     : <build_cmd or "none">
     Lint      : <lint_cmd or "none">
     TypeCheck : <type_check_cmd or "none">
     Scope     : <scope>
   ```

### Step 2: Planner Phase

Read `mode` from state.json and branch accordingly.

#### If mode == "single": Step 2-S

1. Read the single planner template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/planner_single.md`
2. Interpret it with current context (task, repo_path, lang, scope, user_lang, spec_path=`docs/harness/<slug>/spec.md`). Do NOT write a rendered file — process inline.
3. Follow the planner instructions:
   - Explore the codebase (CLAUDE.md, relevant files)
   - **Invoke a brainstorming skill** — search for "brainstorming" or "ideation", invoke first match
   - **Invoke a planning skill** — search for "writing-plans" or "plan", invoke first match
   - If no matching skill found, proceed without it
   - Write `spec.md` to `docs/harness/<slug>/spec.md` — **all content in `user_lang`**
4. Update state.json: phase → `"plan_ready"`.
5. Print status in the standard format, prefixed with `[harness] Planner complete.`

#### If mode == "standard": Step 2-ST

##### Step 2a-ST: Independent Proposals (Parallel)

1. Read two persona templates from `{CLAUDE_PLUGIN_ROOT}/templates/planner/`: `architect.md`, `senior_developer.md`
2. For each persona, fill template variables: `{task_description}`, `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}` from state.json; `{output_path}`: `.harness/planner/proposal_<persona>.md`
3. **Launch 2 subagents in parallel** using the Agent tool. Each receives its persona template, has no knowledge of the other subagent (anchoring prevention), and writes to its output_path. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Architect, Senior Developer → advisor role).
4. Wait for both to complete. Verify both proposal files exist.

##### Step 2b-ST: Synthesis (No Cross-Critique)

1. Read the standard synthesis template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/synthesis_standard.md`
2. Read both proposal files from Step 2a-ST.
3. Interpret the synthesis template with: `{task_description}`, `{user_lang}`, `{all_proposals}` (concatenated with author labels), `{spec_path}`: `docs/harness/<slug>/spec.md`
4. Follow the synthesis rules to write `spec.md`.
5. Update state.json: phase → `"plan_ready"`.
6. Inform the user (in `user_lang`):
   ```
   [harness] Planner complete.
     Proposals  : 2 specialists analyzed independently
     Output     : spec.md synthesized
   ```

#### If mode == "multi": Step 2-M

##### Step 2a: Independent Proposals (Parallel)

1. Read three persona templates from `{CLAUDE_PLUGIN_ROOT}/templates/planner/`: `architect.md`, `senior_developer.md`, `qa_specialist.md`
2. For each persona, fill template variables: `{task_description}`, `{repo_path}`, `{lang}`, `{scope}`, `{user_lang}` from state.json; `{output_path}`: `.harness/planner/proposal_<persona>.md`
3. **Launch 3 subagents in parallel** using the Agent tool. Each receives its persona template, has no knowledge of other subagents (anchoring prevention), and writes to its output_path. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Architect, Senior Developer, QA Specialist → advisor role).
4. Wait for all 3 to complete. Verify all 3 proposal files exist.

##### Step 2b: Cross-Critique (Parallel)

1. Read the cross-critique template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/cross_critique.md`
2. Read all 3 proposal files from Step 2a.
3. For each persona, prepare the cross-critique prompt with: `{persona_name}`, `{task_description}`, `{user_lang}`, `{proposal_1_author}`, `{proposal_1_content}`, `{proposal_2_author}`, `{proposal_2_content}` (the OTHER two proposals), `{output_path}`: `.harness/planner/critique_<persona>.md`
4. **Launch 3 subagents in parallel.** Each writes to `.harness/planner/critique_<persona>.md`. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (same advisor role as the original persona).
5. Wait for all 3 to complete. Verify all 3 critique files exist.

##### Step 2c: Synthesis

1. Read the synthesis template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/synthesis.md`
2. Read all 6 intermediate files (3 proposals + 3 critiques).
3. Interpret the synthesis template with: `{task_description}`, `{user_lang}`, `{all_proposals}` (concatenated with author labels), `{all_critiques}` (concatenated with author labels), `{spec_path}`: `docs/harness/<slug>/spec.md`
4. Follow the synthesis rules to write `spec.md`.
5. Update state.json: phase → `"plan_ready"`.
6. Inform the user (in `user_lang`):
   ```
   [harness] Planner complete.
     Proposals  : 3 specialists analyzed independently
     Critiques  : 3 cross-reviews completed
     Output     : spec.md synthesized
   ```

### Step 3: HARD GATE — Spec Confirmation

<HARD-GATE>
Show spec.md to the user and ask for explicit confirmation using AskUserQuestion (in `user_lang`):
  header: "Spec"
  question: "Review the spec above. Implementation consumes significant tokens. Confirm to proceed."
  options:
    - label: "Proceed" / description: "Start implementation as specified"
    - label: "Modify" / description: "Edit the spec, then re-confirm"
    - label: "Stop" / description: "Halt the workflow"

If user selects "Modify" or provides modification details via "Other": update spec.md and re-present this question.
If user selects "Stop": halt the workflow.
Only "Proceed" advances to the Generator phase.
</HARD-GATE>

### Step 4: Generator Phase

Read `mode` from state.json and branch accordingly.

#### If mode == "single": Step 4-S

1. Update state.json: phase → `"gen_ready"`, read current round.
2. Read the single generator template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/generator_single.md`
3. Prepare the prompt: `{spec_content}` from spec.md, `{qa_feedback}` from qa_report.md if round > 1 else "(First round — no QA feedback)", `{round_num}`, `{scope}`, `{max_files}`, `{user_lang}` from state.json, `{changes_path}`: `docs/harness/<slug>/changes.md`
4. **Invoke implementation skills** — search and invoke matches: "test-driven-development"/"tdd" (if test_cmd available), "subagent-driven-development"/"parallel-tasks"/"dispatching-parallel-agents". Proceed without if no match.
5. **Launch 1 subagent** to implement the code following the template. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Generator single mode → executor role).
6. Wait for completion. Verify `docs/harness/<slug>/changes.md` exists.
7. Print status in the standard format, prefixed with `[harness] Generator complete.`

#### If mode == "standard": Step 4-ST

##### Step 4a-ST: Implementation Plan

1. Update state.json: phase → `"gen_ready"`, read current round.
2. Read the lead developer template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/lead_developer.md`
3. Prepare the prompt: `{spec_content}` from spec.md, `{qa_feedback}` from qa_report.md if round > 1 else "(First round — no QA feedback)", `{repo_path}`, `{lang}`, `{scope}`, `{max_files}`, `{user_lang}` from state.json, `{output_path}`: `.harness/generator/plan.md`
4. **Launch 1 subagent** (Lead Developer) to create the implementation plan. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Lead Developer → executor role).
5. Wait for completion. Verify `.harness/generator/plan.md` exists.

##### Step 4b-ST: Combined Advisory Review

1. Read the combined advisor template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/combined_advisor.md`
2. Read the plan from `.harness/generator/plan.md`.
3. Prepare the prompt: `{spec_content}`, `{plan_content}`, `{repo_path}`, `{lang}`, `{test_cmd}`, `{user_lang}` from state.json, `{output_path}`: `.harness/generator/review_combined.md`
4. **Launch 1 subagent** (Combined Advisor) to review the plan. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Combined Advisor → advisor role).
5. Wait for completion. Verify `.harness/generator/review_combined.md` exists.

##### Step 4c-ST: Implementation

1. Read the standard implementation template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/implementation_standard.md`
2. Read the plan and combined review from `.harness/generator/`.
3. Prepare the prompt: `{spec_content}`, `{plan_content}`, `{advisor_review}` (from review_combined.md), `{qa_feedback}` (from qa_report.md if round > 1), `{repo_path}`, `{lang}`, `{scope}`, `{max_files}`, `{user_lang}`, `{round_num}` from state.json, `{changes_path}`: `docs/harness/<slug>/changes.md`
4. **Invoke implementation skills** — same as Step 4-S step 4.
5. **Launch 1 subagent** (Lead Developer) to implement the code. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Lead Developer → executor role).
6. Wait for completion. Verify `docs/harness/<slug>/changes.md` exists.
7. Inform the user (in `user_lang`):
   ```
   [harness] Generator complete.
     Plan     : Lead Developer created implementation plan
     Review   : Combined Advisor reviewed the plan
     Code     : Lead Developer implemented with feedback
     Output   : changes.md written
   ```

#### If mode == "multi": Step 4-M

##### Step 4a: Implementation Plan

1. Update state.json: phase → `"gen_ready"`, read current round.
2. Read the lead developer template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/lead_developer.md`
3. Prepare the prompt: `{spec_content}` from spec.md, `{qa_feedback}` from qa_report.md if round > 1 else "(First round — no QA feedback)", `{repo_path}`, `{lang}`, `{scope}`, `{max_files}`, `{user_lang}` from state.json, `{output_path}`: `.harness/generator/plan.md`
4. **Launch 1 subagent** (Lead Developer) to create the implementation plan. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Lead Developer → executor role).
5. Wait for completion. Verify `.harness/generator/plan.md` exists.

##### Step 4b: Advisory Review (Parallel)

1. Read both advisor templates from `{CLAUDE_PLUGIN_ROOT}/templates/generator/`: `code_quality_advisor.md`, `test_stability_advisor.md`
2. Read the plan from `.harness/generator/plan.md`.
3. For each advisor, prepare the prompt: `{spec_content}`, `{plan_content}`, `{repo_path}`, `{lang}`, `{test_cmd}`, `{user_lang}` from state.json, `{output_path}`: `.harness/generator/review_<advisor>.md`
4. **Launch 2 subagents in parallel.** Each writes to its output_path. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Code Quality Advisor, Test & Stability Advisor → advisor role).
5. Wait for both to complete. Verify both review files exist.

##### Step 4c: Implementation

1. Read the implementation template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/implementation.md`
2. Read the plan and both reviews from `.harness/generator/`.
3. Prepare the prompt: `{spec_content}`, `{plan_content}`, `{code_quality_review}`, `{test_stability_review}`, `{qa_feedback}` (from qa_report.md if round > 1), `{repo_path}`, `{lang}`, `{scope}`, `{max_files}`, `{user_lang}`, `{round_num}` from state.json, `{changes_path}`: `docs/harness/<slug>/changes.md`
4. **Invoke implementation skills** — same as Step 4-S step 4.
5. **Launch 1 subagent** (Lead Developer) to implement the code. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Lead Developer → executor role).
6. Wait for completion. Verify `docs/harness/<slug>/changes.md` exists.
7. Inform the user (in `user_lang`):
   ```
   [harness] Generator complete.
     Plan     : Lead Developer created implementation plan
     Reviews  : 2 advisors reviewed the plan
     Code     : Lead Developer implemented with feedback
     Output   : changes.md written
   ```

### Step 4.5: Auto-Verify (Layer 1 — Mechanical Verification)

> **Compatibility:** If state.json has no `verify` field (pre-v7.1 session), skip this entire step and proceed to Step 5.
>
> **Session recovery:** When resuming from `verify_ready`, `verifying`, or `verify_done`, retries reset to 0 (assumes code may have been manually fixed between sessions).

1. Update state.json: phase → `"verify_ready"`, set `verify.layer1_result` → null, `verify.layer1_retries` → 0.
2. Read the verify template: `{CLAUDE_PLUGIN_ROOT}/templates/verify/verify_layer1.md`
3. **Prepare the Verify subagent prompt.** Fill in template variables:
   - `{build_cmd}`: from state.json (`build_cmd` or `"SKIP"` if null)
   - `{test_cmd}`: from state.json (`test_cmd` or `"SKIP"` if null)
   - `{lint_cmd}`: from state.json (`lint_cmd` or `"SKIP"` if null)
   - `{type_check_cmd}`: from state.json (`type_check_cmd` or `"SKIP"` if null)
   - `{changes_md_path}`: `docs/harness/<slug>/changes.md`
   - `{verify_report_path}`: `docs/harness/<slug>/verify_report.md`
   - `{todo_blocking}`: from state.json `verify.todo_blocking` (default false)
4. Update state.json: phase → `"verifying"`.
5. **Launch the Verify subagent** using the Agent tool. If `model_config.preset` is not `"default"`, pass `model: "haiku"` (all presets use haiku for verifier). If `model_config.preset` is `"default"`, also pass `model: "haiku"` — verifier always uses haiku regardless of preset.
6. When the subagent returns, parse the first line of its response:
   - If contains `"PASS"` → set `verify.layer1_result` → `"PASS"` in state.json
   - If contains `"FAIL"` → set `verify.layer1_result` → `"FAIL"` in state.json (do NOT increment retries here — increment happens at retry dispatch)

7. **If PASS:** Update state.json: phase → `"verify_done"`. Print status:
   ```
   [harness] Verify (Layer 1) complete.
     Result : PASS
     {1-line summary from subagent response}
   ```
   Proceed to Step 5.

8. **If FAIL and retries < 3:** Increment `verify.layer1_retries` in state.json. Print status:
   ```
   [harness] Verify (Layer 1) FAIL — retrying Generator (attempt {layer1_retries}/3)
     {1-line error summary from subagent response}
   ```
   Launch a **new Generator subagent** (retry) per the rules below, then return to step 4.5.4 (re-run Verify).

   **Generator retry rules (all modes):**
   Regardless of mode (single/standard/multi), retry launches **one implementation subagent only** — do NOT re-run the plan or advisory review steps. The plan and reviews from the original Step 4 are still valid; only the code needs fixing.
   - **single mode**: use `generator_single.md` template
   - **standard mode**: use `implementation_standard.md` template (with existing plan.md and review_combined.md)
   - **multi mode**: use `implementation.md` template (with existing plan.md, review_code_quality.md, review_test_stability.md)

   Add to the implementation prompt:
   - `{verify_failure}`: the 1-line FAIL summary from the Verify subagent response
   - `{verify_report_path}`: `docs/harness/<slug>/verify_report.md` (so the Generator can read detailed errors)
   - Instruction: `"Fix ONLY the items that failed verification. Do NOT rewrite code that already works. The verification failure was: {verify_failure}"`

   If `model_config.preset` is not `"default"`, pass `model` per the Model Selection table (executor role for implementation subagents).

9. **If FAIL and retries >= 3:** Update state.json: phase → `"verify_done"`. Print status:
   ```
   [harness] Verify (Layer 1) FAIL — max retries reached (3/3)
     Latest error: {1-line error summary}
     See: docs/harness/<slug>/verify_report.md
   ```
   Ask the user using AskUserQuestion (in `user_lang`):
     header: "Verify"
     question: "Mechanical verification failed after 3 attempts. [error summary]"
     options:
       - label: "Continue to Evaluator" / description: "Skip remaining verify issues and proceed to QA evaluation"
       - label: "Stop" / description: "Halt workflow for manual intervention. Review verify_report.md"

   If "Continue to Evaluator": proceed to Step 5.
   If "Stop": halt workflow (do not change phase from verify_done).

### Step 5: Evaluator Phase (Isolated Subagent)

1. Update state.json: phase → `"eval_ready"`.
2. Read the evaluator template: `{CLAUDE_PLUGIN_ROOT}/templates/evaluator/evaluator_prompt.md`
3. **Prepare the subagent prompt.** Fill in: `spec_content` from spec.md, `changed_files_list` (file paths only from changes.md — **strip all "reason" descriptions** to prevent anchoring), `test_available`, `build_cmd`, `test_cmd`, `round_num`, `scope`, `user_lang` from state.json, `qa_report_path`: `docs/harness/<slug>/qa_report.md`.
   **`verify_context`**: Check state.json `verify.layer1_result`:
   - If `"PASS"`: set to `"Layer 1 PASSED — build/test/lint/type-check verified. See docs/harness/<slug>/verify_report.md for details."`
   - If `"FAIL"` (user chose "Continue to Evaluator"): set to `"Layer 1 FAILED (user chose to proceed despite failures) — see docs/harness/<slug>/verify_report.md for error details. Pay extra attention to build/test correctness."`
   - If verify was skipped (no `verify` field in state.json or verify_report.md missing): set to `"Layer 1 was not executed for this session."`
   **Do NOT include:** Generator reasoning, implementation plan, advisor reviews, why files were changed, or references to "Generator"/"AI"/"agent" as code author.
4. **Launch the Evaluator subagent** using the Agent tool. Use `subagent_type: "superpowers:code-reviewer"` if available. If `model_config.preset` is not `"default"`, pass `model` parameter per the Model Selection table (Evaluator → evaluator role). Instruct it to write the QA report to `docs/harness/<slug>/qa_report.md`.
5. When the subagent returns, read `docs/harness/<slug>/qa_report.md` to get the verdict.

### Step 6: Verdict & Loop

Read qa_report.md and determine verdict (look for "Verdict: PASS" or "Verdict: FAIL").

**If PASS:** Update state.json: phase → `"completed"`. Inform user: task complete. Proceed to Step 7.

**If FAIL and rounds remaining (round < max_rounds):** Do NOT auto-retry. Ask the user using AskUserQuestion (in `user_lang`):
  header: "QA"
  question: "QA result: FAIL. [failure summary]."
  options:
    - label: "Fix" / description: "Run next round to fix FAIL items only"
    - label: "Accept as-is" / description: "Finish without fixing, keep current state"

If user selects "Fix": increment round, go to Step 4. If user selects "Accept as-is": phase → "completed", go to Step 7.

**If FAIL and max rounds reached:** phase → `"completed"`. Inform user of remaining issues. Proceed to Step 7.

### Step 7: Cleanup & Finalize

#### Artifact Cleanup Safety Guard

Before deleting any `docs/harness/` subdirectory, these checks are **mandatory**:

1. **Validate slug**: Read `docs_path` from `.harness/state.json`, extract `<slug>` (last path segment). If `<slug>` is empty, null, or whitespace → **ABORT** cleanup and warn user (in `user_lang`): "Cannot determine delete target — slug is empty."
2. **Path depth check**: Delete target must match pattern `docs/harness/<non-empty-slug>/` — exactly one level below `docs/harness/`. **NEVER** delete `docs/harness/` itself during normal cleanup. Additionally: slug must **NOT** be `memory` (reserved for `/memory` skill), must **NOT** contain `..` or `/`, and must **NOT** be a single dot `.`. If any of these conditions fail → **ABORT** and warn user.
3. **Display before delete**: Print the exact delete target path (e.g., `docs/harness/my-task/`) to the user before executing. Do not silently delete.

**Full `docs/harness/` cleanup (only when user explicitly requests):**
If the user explicitly asks to delete the **entire** `docs/harness/` directory:
1. List all subdirectories with their file counts
2. If `docs/harness/memory/` exists, list it **separately** with warning: "This directory contains team knowledge managed by `/memory` skill."
3. Warn (in `user_lang`): "`docs/` is git-ignored — all session artifacts will be permanently deleted and **cannot be recovered**."
4. Ask confirmation via AskUserQuestion (yes/no) — only proceed on explicit "Yes, delete all"

**If has_git == true:**
Ask the user using AskUserQuestion (in `user_lang`):
  header: "Commit"
  question: "Implementation complete. Choose how to finish:"
  options:
    - label: "Commit code only (Recommended)" / description: "Clean up artifacts (.harness/, docs/harness/<slug>/) then commit code changes only"
    - label: "Commit all" / description: "Commit everything including artifacts (spec.md, changes.md, qa_report.md)"
    - label: "No commit" / description: "Clean up .harness/ only, do not commit (changes remain in working tree)"

Actions per selection (apply Safety Guard before each delete):
- "Commit code only": delete `.harness/` dir, delete `docs/harness/<slug>/` dir (**only** this slug dir — verify via guard), stage and commit remaining code changes
- "Commit all": delete `.harness/` dir, stage and commit `docs/harness/<slug>/` files + code changes
- "No commit": delete `.harness/` dir only

**If has_git == false:**
Inform the user that artifacts are saved in `docs/harness/<slug>/` (spec.md, changes.md, qa_report.md).
- Clean up `.harness/` directory (delete state.json, planner/, generator/, and the directory itself)
- Do NOT attempt any git operations.

### Status Check (anytime)

If user asks for status, print status in the standard format defined above.

## Model Selection

Sub-agents can run on different models depending on the selected `model_config` preset. The presets map each role (executor, advisor, evaluator) to a model:

| Preset | executor | advisor | evaluator | verifier |
|--------|----------|---------|-----------|----------|
| default | (parent inherit) | (parent inherit) | (parent inherit) | haiku |
| all-opus | opus | opus | opus | haiku |
| balanced | sonnet | opus | opus | haiku |
| economy | haiku | sonnet | sonnet | haiku |

Each sub-agent is assigned a role. The following table defines the concrete model for every sub-agent under each preset:

### Planner Phase Sub-agents

| Sub-agent | Role | default | all-opus | balanced | economy |
|-----------|------|---------|----------|----------|---------|
| Architect | advisor | (no override) | opus | opus | sonnet |
| Senior Developer | advisor | (no override) | opus | opus | sonnet |
| QA Specialist | advisor | (no override) | opus | opus | sonnet |

### Generator Phase Sub-agents

| Sub-agent | Role | default | all-opus | balanced | economy |
|-----------|------|---------|----------|----------|---------|
| Lead Developer | executor | (no override) | opus | sonnet | haiku |
| Code Quality Advisor | advisor | (no override) | opus | opus | sonnet |
| Test & Stability Advisor | advisor | (no override) | opus | opus | sonnet |
| Combined Advisor | advisor | (no override) | opus | opus | sonnet |
| Generator (single mode) | executor | (no override) | opus | sonnet | haiku |

### Evaluator Phase Sub-agents

| Sub-agent | Role | default | all-opus | balanced | economy |
|-----------|------|---------|----------|----------|---------|
| Evaluator | evaluator | (no override) | opus | opus | sonnet |

### Verify Phase Sub-agents

| Sub-agent | Role | default | all-opus | balanced | economy |
|-----------|------|---------|----------|----------|---------|
| Verify (Layer 1) | verifier | haiku | haiku | haiku | haiku |

> **All presets use haiku for verifier.** Layer 1 Mechanical Verification only executes commands and parses exit codes — no LLM judgment required, so the lowest-cost model is always sufficient.

**Applying model config:** When launching any sub-agent, if `model_config.preset` is not `"default"`, pass the `model` parameter according to the table above for that sub-agent. Sub-agents must NOT directly access state.json to read model_config — the orchestrator passes the model parameter at launch time.

## User Interaction Rules

All user-facing questions MUST use AskUserQuestion tool when available.
- If AskUserQuestion is available → use it (provides numbered selection UI)
- If AskUserQuestion is NOT available or fails → present the same options as text and accept number/keyword responses (case-insensitive)
- Every option must include a `label` (short name) and `description` (specific explanation)
- "Other" (free text input) is automatically appended by the framework
- Translate all question text, labels, and descriptions to `user_lang`

## Key Rules

- **Never skip phases.** Always Planner → Generator → Verify → Evaluator. (Verify is skipped only for pre-v7.1 sessions without `verify` field in state.json.)
- **Confirmation gates are non-negotiable.** No implicit approval, no proceeding on ambiguity.
- **Stay within scope.** Do not modify files outside the specified scope.
- **Evaluator must be isolated.** Always run as a subagent with anchor-free input. Never pass Generator reasoning to the Evaluator.
- **Planner proposals must be independent.** Never share one persona's proposal with another during the proposal phase.
- **Generator advisors review the plan, not the code.** Advisory input happens before implementation.
- **Use whatever skills are available.** Search by capability keyword, not plugin name. If no match, proceed without it.
- **User language.** All user-facing output must be in `user_lang`. Re-detect on every user message.
- **Intermediate outputs are ephemeral.** Only final artifacts (spec.md, changes.md, qa_report.md) are preserved in `docs/`.
- **Mode selection.** If `--mode` provided, use it. Otherwise ask (3 options: single, standard, multi). Store in state.json; preserve across session recovery.
