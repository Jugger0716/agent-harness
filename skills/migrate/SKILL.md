---
name: migrate
disallowed-tools: NotebookEdit
description: Execute framework/library version upgrades, language transitions, and dependency replacements with staged, verified execution — single (inline) or multi (parallel external-research + codebase-impact analysts + synthesis and an isolated evaluator via plugin-shipped native Workflow segments, opt-in gated). WebSearch-based migration guide research, per-step test verification, and session recovery.
---

# Agent Harness Migrate

You are orchestrating a **staged migration workflow** with selectable single-agent or multi-agent mode. You help users upgrade frameworks, transition libraries, and replace dependencies safely — one breaking change at a time.

**Zero-setup:** No initialization required. Auto-detects language, versions, test commands, and build commands from the current directory.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json (e.g. "ko", "en", "ja", "zh", "es", "de", etc.).

**All user-facing communication** must be in the detected language: progress updates, questions, confirmations, error messages, migration plan sections, QA report narrative, commit messages, confirmation gate prompts and options.

**Re-detection:** On every user message, check if the language has changed. If so, update `user_lang` and switch all subsequent communication.

**What stays in English:** Template instructions (this file and templates/*.md), state.json field names, file names (migration_plan.md, changes.md, qa_report.md), git branch names, Workflow `args` field names.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`. migrate uses the `[harness:migrate]` prefix and its own block:
```
[harness:migrate]
  Target : <target> <from_version> → <to_version>
  Mode   : <single | multi>
  Path   : <inline | workflow>  (<reason per §Path Transparency>)
  Model  : <model_config preset name>
  Phase  : <phase label>
  Step   : <current_step> / <total_steps> (if in execution phase)
  Branch : <branch>          ← omit if has_git == false
```
Phase labels: setup → "Setup", analyze_ready → "Analysis — researching migration", plan_ready → "Planning — building migration plan", exec_ready → "Execution — applying changes", eval_ready → "Evaluator — verifying migration", completed → "Completed"

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /migrate-specific resolution (the mode-selection roundtrip is removed EXCEPT §Ambiguity Prompt, which fires only when opt-in is absent):

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | single | **inline** (engine isolation requires git) |
| `--mode single` | single | **inline** |
| `Workflow` tool NOT available this session | single | **inline** (notify only if an explicit `--mode multi` was requested) |
| `--mode multi` (or `deep`/`thorough`/`comprehensive`) | multi | **workflow** |
| no `--mode` AND session is in ultracode mode | multi | **workflow** |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=workflow` | multi | **workflow** (standing opt-in — §Ambiguity Prompt step 4.5) |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=inline` | single | **inline** |
| no `--mode`, no opt-in | single | **inline** (interactive + engine available → asks first, §Ambiguity Prompt) |

- **multi exists ONLY on the workflow path** — the engine's `parallel()` fan-out replaces the old hand-rolled 2-analyst dispatch (Step 2-M). The inline path is the preserved single mode.
- The `deep`/`thorough`/`comprehensive` aliases are deliberate cross-skill deepest-tier synonyms (every reframed skill accepts the others' deepest mode names and collapses them onto its own deepest tier); canonical mode names stay per-skill (single/multi).
- **Scope-aware advisory (print only, no roundtrip):** before analysis the exact breaking-change count is unknown, so advise from heuristics — a simple single-version bump → single; a major version jump, a library replacement, or a wide dependency footprint → multi. (Print so a non-opted user knows which `--mode` to pass on re-invoke.)
- **Workflow-path scope:** ONLY Step 2 (analyze → MigrationPlan) and Step 5 (evaluation) run as segments. **Step 4 staged execution stays in this orchestrator on every path** — the per-step apply, build/test verification, the failure gates, and the Migration Advisor are never scripted.
- **Graceful fallback:** if the Analyze segment errors, print `[harness:migrate] ⚠ Workflow engine unavailable — falling back to the inline single path.` (in `user_lang`), set `path_resolved → "inline"`, `mode → "single"`, and continue via Step 2-S. If the Eval segment errors, fall back LOCALLY to the Step 5 inline evaluator dispatch (do not downgrade the rest of the session). Never error out.
- Record `path_resolved` in state.json and show `Path` in the status format.

## Argument Parsing

Parse `$ARGUMENTS` with the following grammar:

```
/migrate <target> [--from <version>] [--to <version>] [--mode single|multi]
```

**Patterns:**
- Version upgrade: `/migrate react --from 17 --to 18`
- Replacement: `/migrate replace moment with dayjs`
- Implicit latest: `/migrate react --from 17` (auto-detect latest stable as --to)
- Fully implicit: `/migrate react` (auto-detect both --from and --to)

Store parsed values:
- `target`: the framework/library/dependency name (e.g. "react", "moment→dayjs")
- `from_version`: explicit or auto-detected
- `to_version`: explicit or auto-detected
- `migration_type`: "upgrade" | "replacement"

If the target contains "replace ... with ..." or "→", set `migration_type` to "replacement" and parse source/destination libraries.

## Version Auto-Detection

Detect the current version of `target` from project files:

| File | Detection Method |
|------|-----------------|
| `package.json` | `dependencies[target]` or `devDependencies[target]` — strip semver prefix (^, ~, >=) |
| `pyproject.toml` | `[project.dependencies]` or `[tool.poetry.dependencies]` — parse version specifier |
| `requirements.txt` | Line matching `target==<version>` or `target>=<version>` |
| `go.mod` | `require` block — match module path containing target |
| `Cargo.toml` | `[dependencies]` section — parse version string |
| `build.gradle(.kts)` | `implementation`, `api`, `compile` dependency declarations |
| `pom.xml` | `<dependency>` elements matching target in `<artifactId>` |
| `*.csproj` | `<PackageReference Include="target" Version="...">` |
| `Gemfile` | `gem 'target', '~> <version>'` |
| `composer.json` | `require[target]` — strip semver prefix |

**If --from not provided:**
- If auto-detected successfully: Ask the user using AskUserQuestion (in `user_lang`):
    header: "Version"
    question: "Detected current version: {detected_version}."
    options:
      - label: "Use {detected_version}" / description: "Proceed with detected version as the source"
      - label: "Enter manually" / description: "Specify a different source version"
  If user selects "Enter manually" or provides a version via "Other": use that value.
- If detection fails: present as text input (in `user_lang`): "Enter current version of {target}:" (free text required)

**If --to not provided:**
- If WebSearch returns a latest stable version: Ask the user using AskUserQuestion (in `user_lang`):
    header: "Version"
    question: "Latest stable version found: {detected_version}."
    options:
      - label: "Use {detected_version}" / description: "Proceed with this as the target version"
      - label: "Enter manually" / description: "Specify a different target version"
  If user selects "Enter manually" or provides a version via "Other": use that value.
- If WebSearch fails: present as text input (in `user_lang`): "Enter target version of {target}:" (free text required)

**If version is ambiguous** (e.g. multiple packages match target): List candidates and ask the user to choose.

## Session Recovery

Before starting a new task, check if `.harness/state.json` already exists **and** `state.json.skill` equals `"migrate"`:

1. If it exists and matches, print status in the standard format (including Model line from `model_config`), prefixed with `[harness:migrate] Previous session detected.`
2. Restore `model_config` from state.json. Apply it to all subsequent sub-agent launches and Workflow `args.models`.
2.5. **Re-resolve §Mode Gate** (the new session may lack the Workflow tool or the opt-in) and update `path_resolved` — a session that started on the workflow path may legitimately resume on the inline path. Cross-session resume re-RUNS segments; `state.runs.*.runId` values are audit-only (`resumeFromRunId` is same-session only — never attempt it across sessions). This re-resolution reuses the stored `{ mode, path_resolved }` and MUST NOT re-fire **§Ambiguity Prompt** — only the existing workflow→inline downgrade (engine or git now absent) may change the stored path.
3. Ask the user using AskUserQuestion (in `user_lang`):
     header: "Session"
     question: "[harness:migrate] Previous session detected. [print status in standard format]. Resume, restart, or stop?"
     options:
       - label: "Resume" / description: "Continue from {phase} where the previous session left off"
       - label: "Restart" / description: "Delete .harness/ and start from scratch"
       - label: "Stop" / description: "Delete .harness/ and halt"

   Actions per selection:
   - **Resume**: Jump to the step matching state.json phase (completion-artifact checks come FIRST, before any path branching — a multi session resumed without the engine must never overwrite completed work):
     - `setup` → Step 1
     - `analyze_ready` → inline path → Step 2-S; workflow path → Step 2-W (re-RUN the Analyze segment)
     - `plan_ready` → **FIRST, on BOTH paths**: if `{docs_path}migration_plan.md` exists, go to Step 3 (the plan is complete — do not re-run analysis). Else: Step 2 on the re-resolved path.
     - `exec_ready` → Step 4 (always orchestrator-inline on every path; resume from `current_step`).
     - `eval_ready` → **FIRST, on BOTH paths**: if `{docs_path}qa_report.md` already exists, skip to Step 6 and reconstruct the verdict from its `### Verdict:` line (sanctioned read — segment returns are in-context only). Else: Step 5 on the re-resolved path.
     - `completed` → no active session, proceed to Step 1
   - **Restart**: Delete `.harness/` directory and proceed to Step 1
   - **Stop**: Delete `.harness/` directory and halt

If `.harness/state.json` does not exist (or belongs to a different skill), proceed to Step 1 normally.

## Smart Routing

Before proceeding, assess whether this skill is the right tool:

| User Intent | Better Skill | Action |
|-------------|-------------|--------|
| Deprecated patterns cleanup without version change | `/harness` with refactoring task | Suggest switching to `/harness` |
| Code state unclear, needs audit first | `/harness` with audit task | Suggest running audit first |
| Wants to adopt new API features (not upgrading) | `/harness` with feature task | Suggest switching to `/harness` |

When a better skill is identified, ask the user using AskUserQuestion (in `user_lang`):
  header: "Routing"
  question: "[explanation of why the other skill may be better]"
  options:
    - label: "Switch: /{suggested}" / description: "Halt this skill and use /{suggested} instead"
    - label: "Continue" / description: "Proceed with /migrate as requested"

If the user selects "Switch", halt this skill.

## Workflow

When the user provides a migration target (via $ARGUMENTS or in conversation), execute this workflow:

### Step 1: Setup

1. **Detect user language** from the task description. Store as `user_lang`.
2. **Slugify the target:** lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. For replacements, use format `<from>-to-<to>`. Store as `<slug>`.
3. **Auto-detect project language and commands.** Scan the repo root. Language/test/build detection: see `templates/_shared/detection_table.md`.

4. **Detect current version** of the target using the Version Auto-Detection table above. Store as `from_version`.
5. **Determine target version** from `--to` argument or via WebSearch for latest stable. Store as `to_version`.
6. **Validate versions:** If `from_version` == `to_version`, inform user "Already on target version" and halt. If `from_version` > `to_version`, warn about downgrade and ask for confirmation.
7. **Capture baseline test results:** If test command is available, run it and store output in `.harness/migrate/baseline_tests.txt`. Record pass/fail counts. If baseline tests are failing, ask the user using AskUserQuestion (in `user_lang`):
     header: "Test Fail"
     question: "Baseline tests are failing ({N} failures). Proceeding with migration may make it harder to identify migration-caused regressions."
     options:
       - label: "Continue" / description: "Proceed with migration despite failing baseline tests"
       - label: "Fix first" / description: "Halt migration and fix existing test failures first"
       - label: "Abort" / description: "Cancel migration entirely"
   On "Fix first": halt and suggest user fix tests first. On "Abort": halt.

8. **Create directories:** `.harness/`, `.harness/migrate/`, `docs/harness/<slug>/`
9. **Capture original branch and create migration branch:**
   - Run `git rev-parse --abbrev-ref HEAD` and store result as `original_branch`. If the result is `HEAD` (detached HEAD state), use `git rev-parse HEAD` instead to store the full commit hash.
   - `git checkout -b harness/migrate-<slug>`
10. **Mode Gate resolution:** apply §Mode Gate INCLUDING **§Ambiguity Prompt** (single source: `templates/_shared/mode_gate.md`) — the mode roundtrip is removed EXCEPT this prompt, which fires only when NO opt-in is present (no `--mode`, ultracode OFF, no project-default `path` (`agent-harness-defaults:` line), `Workflow` tool available, `has_git == true`, interactive, no `--no-prompt`). Skill modes: single(inline) / multi(workflow); ultracode-target: multi. Store `mode` and `path_resolved` in state.json. Then emit **§Path Transparency** — show `Path : <inline | workflow>  (<reason>)`. Print the scope-aware advisory. If the user explicitly requested `--mode multi` but the gate resolved to inline (Workflow tool unavailable or `has_git == false`), notify (in `user_lang`): "multi mode requires the native Workflow engine and git — proceeding on the inline single path."
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
11. **Model configuration selection:**
   If `--model-config <preset>` was passed, use it directly. Otherwise, if the resolved project-defaults line (first source wins wholesale: settings.local.json env → project CLAUDE.md → user CLAUDE.md; see `templates/_shared/project_defaults.md`) contains `model-config=<preset>`, use it silently and echo `(project default)` in the Setup Summary. Otherwise, use AskUserQuestion to ask the user (in `user_lang`):
<!-- SYNC-WITH: templates/_shared/project_defaults.md §agent-harness-defaults -->
     header: "Model"
     question: "Select model configuration for sub-agents:"
     options:
       - label: "default" / description: "Inherit parent model, no changes"
       - label: "frontier" / description: "Sonnet executor + Opus advisor + Fable evaluator (top-model judgment)"
       - label: "balanced (Recommended)" / description: "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
       - label: "economy" / description: "Haiku executor + Sonnet advisor/evaluator (max savings)"

   **If "Other" selected:** Parse custom format `executor:<model>,advisor:<model>,evaluator:<model>` (or a bare preset name — validated against the preset table: `default` / `all-opus` / `frontier` / `balanced` / `economy`). For the role form, validate each model name — only `fable`, `opus`, `sonnet`, `haiku` are allowed (case-insensitive). If any model name is invalid, inform the user which value is invalid and re-ask for input (max 3 retries, then apply `balanced` as default). If parsing succeeds but is partial, fill missing roles with the `balanced` defaults (executor=sonnet, advisor=opus, evaluator=opus). Show the parsed result to the user and ask for confirmation before proceeding.

   **Model config is set once at session start and cannot be changed mid-session (sole exception: the automatic model fallback chain in `templates/_shared/model_config.md`, which may downgrade a cell on a sunset model id).** To change, restart the session.

   Store result as `model_config` object: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>" }`. For the `default` preset, store `{ "preset": "default" }`.

12. **Write `.harness/state.json`** with fields: `skill` ("migrate"), `target`, `migration_type` ("upgrade"/"replacement"), `from_version`, `to_version`, `mode` ("single"/"multi"), `path_resolved` ("inline"/"workflow" — from §Mode Gate; re-resolved on resume), `runs` (`{ "analyze": null, "eval": null }`; each records `{ "runId": "<wf_...>" }` after a segment launch — audit + same-session iteration only, cross-session resume re-RUNS segments per §Session Recovery 2.5), `model_config` (from step 11), `user_lang`, `repo_name`, `repo_path`, `phase` ("setup"), `current_step` (0), `total_steps` (0), `original_branch` (captured in step 9), `branch` ("harness/migrate-<slug>"), `lang`, `test_cmd`, `build_cmd`, `baseline_test_pass_count`, `baseline_test_fail_count`, `docs_path` ("docs/harness/<slug>/"), `created_at` (ISO8601).
13. **Print setup summary** (in `user_lang`):
    ```
    [harness:migrate] Migration started!
      Target   : <target> <from_version> → <to_version>
      Type     : <upgrade | replacement>
      Repo     : <path>
      Branch   : harness/migrate-<slug>
      Mode     : <single | multi>
      Path     : <inline | workflow>  (<reason per §Path Transparency>)
      Model    : <preset name>
      Language : <lang>
      Test     : <test_cmd or "none">
      Build    : <build_cmd or "none">
      Baseline : <pass_count> pass, <fail_count> fail
    ```

### Step 2: Analysis Phase

Read `mode` and `path_resolved` from state.json and branch accordingly.

#### INLINE path (mode: single) — Step 2-S

1. Update state.json: phase → `"analyze_ready"`.
2. **Research the migration guide.** Use WebSearch to find the official migration guide for `target` from `from_version` to `to_version`. Search queries:
   - `"<target> migration guide <from_version> to <to_version>"`
   - `"<target> upgrade guide <from_version> <to_version> breaking changes"`
   - `"<target> changelog <to_version>"`
3. **If WebSearch succeeds:** Use WebFetch to read the migration guide page(s). Extract:
   - Breaking changes (list each with description)
   - Deprecated APIs and their replacements
   - New required configurations
   - Dependency version requirements (peer deps, minimum versions)
4. **If WebSearch fails or returns no useful results:** Fall back to local sources:
   - Read `CHANGELOG.md`, `MIGRATION.md`, `UPGRADE.md` in the project root or target package directory
   - Read `node_modules/<target>/CHANGELOG.md` (for JS/TS projects)
   - If no local sources available, inform user and ask them to provide migration guide URL or key breaking changes manually
5. **Scan the codebase** for affected code:
   - Search for imports/requires of the target library
   - Search for deprecated API usage patterns (from the breaking changes list)
   - Search for configuration files that reference the target
   - Identify all files that will need changes
6. **Build the migration plan** with breaking changes ordered by dependency (changes that others depend on go first). Write to `docs/harness/<slug>/migration_plan.md`:

   ```markdown
   ## Migration Plan: <target> <from> → <to>

   ### Summary
   <1-2 sentence overview>

   ### Breaking Changes
   For each breaking change:
   #### <N>. <Breaking Change Title>
   - **What changed:** <description>
   - **Affected files:** <list of files>
   - **Required action:** <what needs to change>
   - **Verification:** <how to verify this step>

   ### Dependency Updates
   <list of dependency version changes needed>

   ### Configuration Changes
   <list of config file updates needed>

   ### Execution Order
   <ordered list of steps, with dependencies noted>

   ### Risks
   <identified risks and mitigations>
   ```

7. Update state.json: phase → `"plan_ready"`, `total_steps` → number of breaking changes.
8. Write research notes to `.harness/migrate/research_external.md` and `.harness/migrate/research_internal.md`.
9. Print status in the standard format, prefixed with `[harness:migrate] Analysis complete.`

#### WORKFLOW path (mode: multi) — Step 2-W

> multi exists ONLY on the workflow path (§Mode Gate). The engine's `parallel()` fan-out replaces the old hand-rolled 2-analyst dispatch (Steps 2a/2b), the `.harness/migrate/research_*.md` intermediate files, and the file re-reads + synthesis. The Plan Confirmation HARD GATE (Step 3) is rendered by THIS orchestrator AFTER the segment returns — never inside the script.

1. Update state.json: phase → `"analyze_ready"`.

2. **Run the Analyze segment** via the Workflow tool (pass `args` as a JSON object — the script defensively parses; the field set below is the 1:1 contract with the script's `// contract` comment — a field missing on either side silently renders as ''):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/migrate.analyze.workflow.js",
     args: {
       target: <target>, fromVersion: <from_version>, toVersion: <to_version>,
       migrationType: <migration_type>, repoPath: <repo_path>, lang: <lang>,
       userLang: <user_lang>,
       models: { executor: <model_config.executor or null>,
                 advisor: <model_config.advisor or null> }
     }
   }
   ```
   Record `runs.analyze → { "runId": "<id>" }`.
   The script runs the external-research and codebase-impact analysts in parallel (anchoring-free — neither sees the other's output; external uses WebSearch/WebFetch) and synthesizes one structured MigrationPlan.

3. The segment returns `{ plan: MigrationPlan, stats }` — schema-validated; NO research-file re-reads, NO 1-line parsing. Print (in `user_lang`): `  ✓ Analyze segment: {stats.analystsSucceeded}/{stats.analystsRequested} analyses → synthesis`
   - If `stats.analystsSucceeded < stats.analystsRequested`, warn (in `user_lang`): `[harness:migrate] ⚠ {N} analyst(s) unavailable — synthesis proceeded from the remaining analysis (external={stats.externalResearchOk}, impact={stats.impactAnalysisOk}).`

4. **Orchestrator writes `{docs_path}migration_plan.md` from the MigrationPlan object** (headings in `user_lang`; the title `## Migration Plan: <target> <from_version> → <to_version>` from state.json):
   - `### Summary` ← `summary`
   - `### Breaking Changes` ← `steps[]` as `#### {n}. {description}` with `- **What changed:** {whatChanged}` / `- **Affected files:** {files joined, or "(none specified)" when the array is empty}` / `- **Required action:** {requiredAction}` / `- **Verification:** {verification}` / `- **Risk:** {risk}` (all five step sub-fields are schema-required, so none render as "undefined")
   - `### Dependency Updates` ← `dependencyUpdates[]` as `- {name}: {from} → {to}` (empty array → "None")
   - `### Configuration Changes` ← `configurationChanges[]` as `- {file}: {change}` (empty array → "None")
   - `### Execution Order` ← `executionOrder[]` as an ordered list
   - `### Risks` ← `risks[]` as `- {risk} — Likelihood: {likelihood} — Mitigation: {mitigation}` (append `(source)` when present)
   - `### Not Applicable (Skipped)` ← `notApplicable[]` as `- {title} — {reason}` (omit the whole section when the array is empty)
   Verify the file exists after writing (rendering is orchestrator-owned and deterministic).

5. Update state.json: phase → `"plan_ready"`, `total_steps` → `plan.steps.length`.
6. Inform the user (in `user_lang`):
   ```
   [harness:migrate] Analysis complete.
     Analyses : <stats.analystsSucceeded> specialists analyzed independently
     Plan     : <total_steps> migration steps ordered by dependency
     Output   : migration_plan.md synthesized
   ```
7. **On Workflow error** (launch failure, script error, schema-invalid result): apply §Mode Gate graceful fallback → notify, set `path_resolved → "inline"`, `mode → "single"`, and re-run this step via Step 2-S.

### Step 3: HARD GATE — Migration Plan Confirmation

<HARD-GATE>
Show migration_plan.md to the user and ask for explicit confirmation using AskUserQuestion (in `user_lang`):
  header: "Plan"
  question: "Review the migration plan above. Execution modifies code one breaking change at a time. Confirm to proceed."
  options:
    - label: "Proceed" / description: "Start migration execution as planned"
    - label: "Modify" / description: "Edit the migration plan, then re-confirm"
    - label: "Stop" / description: "Halt the migration workflow"

If user selects "Modify" or provides modification details via "Other": update migration_plan.md and re-present this question.
If user selects "Stop": halt the workflow.
Only "Proceed" advances to the Execution phase.
</HARD-GATE>

### Step 4: Execution Phase (Staged)

Read `mode` and `migration_plan` from state.json / migration_plan.md.

Update state.json: phase → `"exec_ready"`.

Execute each breaking change as an isolated step. For each step N (from `current_step + 1` to `total_steps`):

#### Step 4a: Apply Change

1. Update state.json: `current_step` → N.
2. Read the breaking change details for step N from migration_plan.md.
3. **Apply the changes:**
   - Update dependency version(s) if this step requires it
   - Modify affected source files according to the required action
   - Update configuration files if needed
4. **Log changes** — append to `docs/harness/<slug>/changes.md`:
   ```markdown
   ## Step <N>: <Breaking Change Title>

   ### Modified Files
   - path/to/file.ext — brief reason

   ### Created Files
   - (none, or list)

   ### Deleted Files
   - (none, or list)
   ```

#### Step 4b: Verify Step

1. **Build check:** If build command is available, run it. If build fails:
   - Attempt to fix build errors (up to 2 attempts).
   - If still failing after 2 attempts → stop execution, report to user with error details, and ask using AskUserQuestion (in `user_lang`):
       header: "Build Fail"
       question: "Build failed on step {N} after 2 fix attempts. [error summary]"
       options:
         - label: "Manual fix & resume" / description: "Pause migration — fix the build manually, then resume from this step"
         - label: "Abort" / description: "Stop the migration entirely"
2. **Test check:** If test command is available, run it. Compare results against baseline:
   - New test failures (not in baseline) → migration-caused regression
   - If regressions found → attempt to fix (up to 2 attempts)
   - If still failing after 2 attempts → stop execution, report regressions, and ask user using AskUserQuestion (in `user_lang`):
       header: "Build Fail"
       question: "Test regressions on step {N} after 2 fix attempts. [regression summary]"
       options:
         - label: "Manual fix & resume" / description: "Pause migration — fix the test failures manually, then resume from this step"
         - label: "Abort" / description: "Stop the migration entirely"
3. **Update state.json** with step completion status.

#### Step 4c: Migration Advisor Review (Multi Mode Only)

If `mode == "multi"`:

1. Read the migration advisor template: `{CLAUDE_PLUGIN_ROOT}/templates/migrate/migration_advisor.md`
2. Fill template variables: `{step_number}` (N), `{step_title}`, `{step_changes}` (changes made in this step only), `{build_result}`, `{test_result}`, `{previous_steps_summary}` (one-line summary of each completed step — NOT full details), `{remaining_steps}` (titles only), `{user_lang}`, `{output_path}`: `.harness/migrate/advisor_step_<N>.md`
3. **Launch 1 subagent** (Migration Advisor) to review this step. If `model_config.preset` is not `"default"`, pass `model` parameter per the preset table in `templates/_shared/model_config.md` (Migration Advisor → advisor role). Lightweight review — only current step context + previous results summary.
4. Read advisor output. If advisor flags issues:
   - **Critical:** Stop and fix before proceeding
   - **Warning:** Log and continue, address in next step or during evaluation
   - **Info:** Log only

#### Step 4d: Step Completion

1. Print step completion (in `user_lang`):
   ```
   [harness:migrate] Step <N>/<total> complete: <title>
     Build  : PASS | FAIL
     Tests  : <pass_count> pass, <fail_count> fail (<regression_count> regressions)
     Advisor: <PASS | N issues> (multi mode only)
   ```
2. Proceed to next step, or if all steps complete, proceed to Step 5.

### Step 5: Evaluator Phase (Isolated Subagent)

1. Update state.json: phase → `"eval_ready"`.
2. **Prepare the anchor-free inputs (both paths):** `{migration_plan_content}` (from migration_plan.md — breaking changes list only, no research reasoning), `{changed_files_list}` (file paths only from changes.md — **strip all "reason" descriptions** to prevent anchoring), `{target}`, `{from_version}`, `{to_version}`, `{migration_type}`, `{test_available}`, `{build_cmd}`, `{test_cmd}`, `{baseline_test_pass_count}`, `{baseline_test_fail_count}`, `{user_lang}`, `{qa_report_path}`: `{docs_path}qa_report.md`.
   **Do NOT include:** Research notes, analyst reasoning, advisor reviews, why files were changed, or references to "Generator"/"AI"/"agent" as code author.

#### Step 5 — INLINE path (mode: single)

3. Read the evaluator template: `{CLAUDE_PLUGIN_ROOT}/templates/migrate/evaluator.md` and fill the variables above.
4. **Launch the Evaluator subagent** using the Agent tool. If `model_config.preset` is not `"default"`, pass `model` parameter per the preset table in `templates/_shared/model_config.md` (Evaluator → evaluator role). Instruct it to write the QA report to `{qa_report_path}`.
5. When the subagent returns, read `{docs_path}qa_report.md` to get the verdict (the on-disk template's `### Verdict:` regex contract — inline path only).

#### Step 5 — WORKFLOW path (mode: multi)

3. **Run the Eval segment** via the Workflow tool (field set = 1:1 contract with the script's `// contract` comment):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/migrate.eval.workflow.js",
     args: {
       target: <target>, fromVersion: <from_version>, toVersion: <to_version>,
       migrationType: <migration_type>,
       planContent: <migration_plan_content (breaking changes only)>,
       changedFilesList: <file paths only, reasons stripped>,
       testAvailable: <bool>, buildCmd: <build_cmd or "">, testCmd: <test_cmd or "">,
       baselineTestPassCount: <baseline_test_pass_count>, baselineTestFailCount: <baseline_test_fail_count>,
       userLang: <user_lang>,
       qaReportPath: "{docs_path}qa_report.md",
       models: { evaluator: <model_config.evaluator or null> }
     }
   }
   ```
   Record `runs.eval → { "runId": "<id>" }`.
4. The segment returns a **VerifyVerdict** (schema-validated — NO regex parse on this path). The evaluator agent has also WRITTEN `{docs_path}qa_report.md` (user-facing artifact + the cross-session verdict-reconstruction source). **Verify the file exists**; if missing, derive it yourself from the verdict object (orchestrator-derived fallback — one Write, no re-dispatch).
5. **On Workflow error**: fall back LOCALLY to the Step 5 INLINE evaluator dispatch above (do NOT downgrade the rest of the session — the session stays on the workflow path for any later Plan segment).

### Step 6: Verdict & Resolution

Determine the verdict:
- **INLINE path:** Read qa_report.md and look for `### Verdict: PASS` or `### Verdict: FAIL`.
- **WORKFLOW path:** use the `VerifyVerdict` object from the Eval segment — branch on **(layer, verdict)**, never verdict alone. Migrate mapping (see `workflows/_reference/schemas.md` encoding note): `(L1, FAIL_L2)` = mechanical test regression / build failure; `(L3, FAIL_L3)` = completeness/correctness judgment failure; `(L3, PASS)` = pass. ANY non-PASS verdict is treated as FAIL for the gate below; build the failure summary from `verdict.summary` + top `failures[].fix` lines. **On resume with no in-context VerifyVerdict:** read qa_report.md's `### Verdict:` line (sanctioned read).

**If PASS:** Update state.json: phase → `"completed"`. Inform user: migration complete. Proceed to Step 7.

**If FAIL:** Do NOT auto-retry. Ask the user using AskUserQuestion (in `user_lang`):
  header: "QA"
  question: "Migration verification: FAIL. [failure summary]."
  options:
    - label: "Fix" / description: "Attempt to fix issues based on evaluator feedback, then re-verify"
    - label: "Accept" / description: "Finish without fixing, keep current state with warnings"
    - label: "Rollback" / description: "Revert all changes and restore original branch"

Actions per selection:
- **Fix:** Apply fixes based on evaluator's fix instructions, then re-run Step 5.
- **Accept:** phase → "completed", proceed to Step 7 with warnings.
- **Rollback:** Read `original_branch` from state.json. If `original_branch` is not present (pre-existing session from older version), run `git log --oneline harness/migrate-<slug> --not --all` to identify the branch point, or ask the user for the original branch name. Then `git checkout <original_branch>`, `git branch -D harness/migrate-<slug>`, clean up `.harness/`. Halt.

### Step 7: Cleanup & Commit

#### Artifact Cleanup Safety Guard

Cleanup safety rules: see `templates/_shared/safety_guard.md`.

Ask the user using AskUserQuestion (in `user_lang`):
  header: "Commit"
  question: "Migration complete. Choose how to finish:"
  options:
    - label: "Commit code only (Recommended)" / description: "Clean up artifacts (.harness/, docs/harness/<slug>/) then commit code changes only"
    - label: "Commit all" / description: "Commit everything including artifacts (migration_plan.md, changes.md, qa_report.md)"
    - label: "No commit" / description: "Clean up .harness/ only, do not commit (changes remain in working tree)"

Actions per selection (apply Safety Guard before each delete):
- "Commit code only": delete `.harness/` dir, delete `docs/harness/<slug>/` dir (**only** this slug dir — verify via guard), stage and commit remaining code changes
- "Commit all": delete `.harness/` dir, stage and commit `docs/harness/<slug>/` files + code changes
- "No commit": delete `.harness/` dir only

### Status Check (anytime)

If user asks for status, print status in the standard format defined above.

## Model Selection

Preset table + rules: see `templates/_shared/model_config.md`.

**migrate role-map:** External Research Analyst → executor; Codebase Impact Analyst → executor; Synthesis → advisor; Migration Advisor → advisor; Evaluator → evaluator.

**WORKFLOW path:** pass the resolved models once per segment run as `args.models` — Analyze segment `{ executor, advisor }` (executor → the two research analysts; advisor → synthesis), Eval segment `{ evaluator }` (null = inherit parent model, i.e. the `default` preset) — the segment scripts apply them per agent. The Migration Advisor is always dispatched inline by the orchestrator (Step 4 is never scripted) and takes its `model` parameter (advisor role) at launch as before.

**Applying model config (INLINE path):** When launching any sub-agent, if `model_config.preset` is not `"default"`, pass the `model` parameter per the role-map above combined with the preset table in `templates/_shared/model_config.md`. Sub-agents must NOT directly access state.json to read model_config — the orchestrator passes the model parameter at launch time.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Key Rules

- **Staged execution is non-negotiable.** One breaking change at a time. Verify before proceeding.
- **Never skip the analysis phase.** Always research → plan → confirm → execute.
- **Confirmation gates are non-negotiable.** No implicit approval, no proceeding on ambiguity.
- **Evaluator must be isolated.** Always run as a subagent with anchor-free input. Never pass research reasoning or advisor reviews to the Evaluator.
- **External + Internal analysts must be independent.** Never share one analyst's output with the other during the research phase (multi mode).
- **Migration Advisor is lightweight.** Only receives current step context + one-line summaries of previous steps. Never receives full research or full changes.
- **Baseline tests are the regression benchmark.** Only test failures that are NOT in the baseline count as migration regressions.
- **Stop on unrecoverable failure.** If a step cannot be fixed in 2 attempts, stop and report rather than continuing blindly.
- **Use whatever skills are available.** Search by capability keyword, not plugin name. If no match, proceed without it.
- **User language.** All user-facing output must be in `user_lang`. Re-detect on every user message. WORKFLOW path: pass `userLang` in `args` — the segment scripts build schema descriptions from it, which forces sub-agent free-text output language; ids/enums/paths stay English raw.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill's execution WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **Intermediate outputs are ephemeral.** Only final artifacts (migration_plan.md, changes.md, qa_report.md) are preserved in `docs/`. On the workflow path there are no intermediate research files at all — the Analyze segment returns a schema-validated MigrationPlan.
- **WebSearch fallback.** If WebSearch/WebFetch fail, always fall back to local CHANGELOG/MIGRATION files before asking the user.
- **Mode Gate + §Ambiguity Prompt.** The mode roundtrip is removed EXCEPT §Ambiguity Prompt (fires only when opt-in absent: no `--mode`, ultracode OFF, no project-default `path` (`agent-harness-defaults:` line), engine available, interactive, no `--no-prompt`). Modes: single(inline) / multi(workflow); ultracode-target: multi. The scope advisory stays print-only. Store `mode` + `path_resolved` in state.json; emit §Path Transparency. On session recovery, re-resolve WITHOUT re-firing §Ambiguity Prompt (reuse stored mode/path_resolved; only workflow→inline downgrade may change it).
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->
- **Fan-out exists only on the workflow path.** Multi-mode analysis runs as plugin-shipped segment scripts; without the engine or opt-in, the session runs single inline (with a notice on explicit `--mode multi` requests).
- **Execution is never scripted.** Step 4 (staged apply + per-step build/test + failure gates + Migration Advisor) stays in this orchestrator on every path — the segments cover only Step 2 (analyze) and Step 5 (eval).
- **Workflow args are a JSON object;** segment scripts defensively parse (`args` may arrive as a JSON string — engine behavior). Keep the SKILL args blocks and the scripts' `// contract` comments in 1:1 sync. Never put user-gate decisions into args.
- **Graceful engine fallback.** Analyze-segment failure degrades the session to the inline single path; Eval-segment failure falls back locally to the inline evaluator dispatch — never a hard error. Gates live ONLY in this orchestrator, never in a segment script.
