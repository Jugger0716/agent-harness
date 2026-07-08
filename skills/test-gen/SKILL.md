---
name: test-gen
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Automated test generator with mutation-based quality verification — single (inline) or multi (parallel coverage analysts + propose-only mutation skeptics via plugin-shipped native Workflow segments, opt-in gated; test generation and mutation execution stay orchestrator-inline). Generates unit and integration tests, runs them, and validates meaningfulness via simplified mutation testing. Supports coverage-gap detection and regression test generation from debug reports.
---

# Agent Harness Test-Gen

You are orchestrating an **automated test generation workflow** that writes real test code, executes it, and verifies quality through simplified mutation testing.

**Core principle:** Test code only. Never touch production code. Every generated test must be meaningful — mutation testing enforces this.

**Mode-gated.** single (inline) is the default; multi (the workflow path) parallelizes coverage analysis over file buckets and adds a propose-only mutation-skeptic panel — opt-in via `--mode multi` / ultracode (see §Mode Gate). **Test generation (Phase 2) and the mutation mutate/run/revert (Phase 3 Step 2) ALWAYS stay orchestrator-inline on BOTH paths** — only coverage analysis and mutation *proposal* run as Workflow segments.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang` in state.json (e.g. "ko", "en", "ja", "zh", "es", "de", etc.).

**All user-facing communication** must be in the detected language: progress updates, questions, confirmations, error messages, report sections, confirmation gate prompts and options.

**Re-detection:** On every user message, check if the language has changed. If so, update `user_lang` and switch all subsequent communication.

**What stays in English:** Template instructions (this file and templates/*.md), state.json field names, file names (analysis.md, test_changes.md, test_report.md), git branch names.

## Environment Detection

At startup, detect whether the current directory is inside a git repository:
```
git rev-parse --is-inside-work-tree 2>/dev/null
```
- If the command succeeds → `has_git = true`
- If the command fails → `has_git = false`

Store `has_git` in state.json. This flag controls whether git operations (branch creation) are performed.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`. test-gen uses the `[test-gen]` prefix and its own block:
```
[test-gen]
  Target : <target>
  Mode   : <single | multi>
  Path   : <inline | workflow>  (<reason per §Path Transparency>)
  Model  : <preset>
  Phase  : <phase label>
  Branch : <branch>          ← omit this line if has_git == false
```
Phase labels: setup → "Setup", analyzing → "Analysis — identifying coverage gaps", generating → "Generation — writing test code", verifying → "Verification — running tests + mutation check", completed → "Completed"

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /test-gen-specific resolution (replaces the old "V1 — single only"):

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `has_git == false` | single | **inline** (see the `has_git` note below) |
| `--mode single` (or `quick`) | single | **inline** |
| `Workflow` tool NOT available this session | single | **inline** (notify only if an explicit `--mode multi` was requested) |
| `--mode multi` (or `deep`/`thorough`/`comprehensive`) | multi | **workflow** |
| no `--mode` AND session is in ultracode mode | multi | **workflow** |
| no `--mode`, no opt-in | single | **inline** (interactive + engine available → asks first, §Ambiguity Prompt) |

- **multi exists ONLY on the workflow path** — the engine's `parallel()` fan-out runs (a) coverage analysts over file buckets (`test-gen.analyze`) and (b) the propose-only mutation-skeptic panel (`test-gen.judge`). The inline path is the preserved single mode.
- The `deep`/`thorough`/`comprehensive` aliases are deliberate cross-skill deepest-tier synonyms (every reframed skill accepts the others' deepest mode names and collapses them onto its own deepest tier); canonical mode names stay per-skill (single/multi).
- **Workflow-path scope is PROPOSAL + ANALYSIS only.** The two segments are `test-gen.analyze` (coverage → AnalysisResult) and `test-gen.judge` (propose-only mutation skeptics → SkepticVote[], read-only). **Test generation (Phase 2) AND the mutation mutate/run/revert (Phase 3 Step 2) ALWAYS run orchestrator-inline on every path** — mutation-of-production is never scripted (no executor sub-agent, no worktree).
- **`has_git` note:** the propose segment is read-only (git-independent), but the orchestrator's inline mutation run needs a clean revert — with git it reverts via `git checkout -- <source>` and verifies with `git diff --quiet -- <source>`; without git it uses an inline backup-restore. The gate forces inline when `has_git == false` because the multi path's only added value (fan-out) does not change the orchestrator-inline run that follows.
- **Graceful fallback:** if a segment errors, print `[test-gen] ⚠ Workflow engine unavailable — falling back to the inline single path.` (in `user_lang`), set `mode → single`, `path_resolved → inline`, and continue inline. Never error out.
- Record `mode` + `path_resolved` in state.json (`mode` is kept for backward-compat with pre-Workflow sessions).
- **§Ambiguity Prompt.** Apply `templates/_shared/mode_gate.md §Ambiguity Prompt`: when NO opt-in is present (no `--mode`, ultracode OFF, `Workflow` tool available, `has_git == true`, interactive, no `--no-prompt`), ask inline-vs-workflow via AskUserQuestion. Skill modes: single(inline) / multi(workflow); ultracode-target: multi (Recommended default = inline when asked). Then emit **§Path Transparency** — show `Path : <inline | workflow>  (<reason>)`. If `--mode multi` was requested but the engine/git is unavailable, notify and proceed inline. Resume reuses stored `mode`/`path_resolved` — never re-fire the prompt.
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->

## Argument Parsing

Parse `$ARGUMENTS` with the following grammar:

```
/test-gen <target> [--coverage-gap] [--regression <path>]
```

**Flags:**
- `<target>` — file path, directory path, or class/module name to generate tests for
- `--coverage-gap` — auto-find low-coverage areas within the target instead of testing everything
- `--regression <path>` — generate regression tests from an existing debug report at `<path>`

**Mutual exclusion:** `--coverage-gap` and `--regression` cannot be used together. If both are provided, immediately report the error (in `user_lang`) and stop:
```
[test-gen] Error: --coverage-gap and --regression are mutually exclusive. Use one flag at a time.
```

Store parsed values: `target`, `mode_flag` ("coverage-gap" | "regression" | null), `regression_report_path` (if --regression).

## Session Recovery

Before starting a new task, check if `.harness/state.json` already exists **and** `state.json.skill` equals `"test-gen"`:

1. If it exists and matches, print status in the standard format (including Model line from `model_config`), prefixed with `[test-gen] Previous session detected.`
2. Restore `model_config` from state.json. Apply it to all subsequent sub-agent launches and Workflow `args.models`.
2.5. **Re-resolve §Mode Gate** (the new session may lack the Workflow tool or the opt-in) and update `path_resolved`. Cross-session resume re-RUNS segments; `state.runs.*.runId` values are audit + same-session only (`resumeFromRunId` is same-session only — never across sessions). **A pre-Workflow session** (state.json lacks `path_resolved` / `runs`) is from an older schema — recommend **Restart** rather than Resume. On resume, do NOT re-fire §Ambiguity Prompt — reuse the stored `mode`/`path_resolved`; only the existing workflow→inline downgrade (engine now absent) may change the stored path.
3. Ask the user using AskUserQuestion (in `user_lang`):
     header: "Session"
     question: "[test-gen] Previous session detected. [print status in standard format]. Resume, restart, or stop?"
     options:
       - label: "Resume" / description: "Continue from {phase} where the previous session left off"
       - label: "Restart" / description: "Delete .harness/ and start from scratch"
       - label: "Stop" / description: "Delete .harness/ and halt"

   Actions per selection:
   - **Resume**: Jump to the step matching state.json phase:
     `setup` → Step 1 (re-run setup) |
     `analyzing` → Phase 1 |
     `generating` → Phase 2 |
     `verifying` → Phase 3 |
     `completed` → no active session, proceed to Step 1
   - **Restart**: Delete `.harness/` directory and proceed to Step 1
   - **Stop**: Delete `.harness/` directory and halt

If `.harness/state.json` does not exist (or `state.json.skill` is not `"test-gen"`), proceed to Step 1 normally.

## Workflow

### Step 1: Setup

1. **Detect user language** from the target/arguments. Store as `user_lang`.
2. **Check mutual exclusion** — if both `--coverage-gap` and `--regression` are provided, report error and stop (see Argument Parsing above).
3. **Slugify the target:** lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. Store as `<slug>`.
4. **Detect environment** — run `git rev-parse --is-inside-work-tree 2>/dev/null`, store `has_git`.
5. **Auto-detect project language and test framework.** Scan the working directory:

   | Framework | Detection | Test file pattern | Run command | Mock library |
   |-----------|-----------|------------------|-------------|-------------|
   | Jest | `package.json` contains jest dependency | `*.test.ts`, `*.spec.ts` | `npx jest` | `jest.mock` |
   | Vitest | `package.json` contains vitest | `*.test.ts`, `*.spec.ts` | `npx vitest run` | `vi.mock` |
   | pytest | `pyproject.toml` or `conftest.py` present | `test_*.py`, `*_test.py` | `pytest` | `pytest.monkeypatch`, `unittest.mock` |
   | JUnit | `build.gradle` contains junit | `*Test.java` | `./gradlew test` | `Mockito` |
   | Go test | `go.mod` present | `*_test.go` | `go test ./...` | `testify/mock` |
   | RSpec | `Gemfile` contains rspec | `*_spec.rb` | `bundle exec rspec` | `rspec-mocks` |
   | Other | none of the above match | ask user | ask user | ask user |

   **If detection fails:** Ask the user using AskUserQuestion (in `user_lang`):
     header: "Framework"
     question: "Could not auto-detect test framework. Please specify:"
     options:
       - label: "Jest" / description: "JavaScript/TypeScript — npx jest"
       - label: "Vitest" / description: "JavaScript/TypeScript — npx vitest run"
       - label: "pytest" / description: "Python — pytest"
       - label: "JUnit" / description: "Java — ./gradlew test"
       - label: "Go test" / description: "Go — go test ./..."
       - label: "RSpec" / description: "Ruby — bundle exec rspec"
     If user cannot answer either (selects "Other" with no info): report "Cannot detect framework. Please set up a test framework and retry." and stop.

6. **Create directories:** `.harness/test-gen/`, `docs/harness/<slug>/`
7. **Create git branch (if has_git):** `git checkout -b harness/test-gen-<slug>`
8. **Model configuration selection:**
   Preset table + rules: see `templates/_shared/model_config.md`. Role-map (see §Model Selection): Coverage Analyst → executor; mutation skeptic → evaluator. (Test generation is orchestrator-inline; the inline mutation run is orchestrator-owned, so its model role is moot.)

9. **Write `.harness/state.json`** with fields:
   - `skill`: `"test-gen"` ← used for session recovery identification
   - `target`: the target argument
   - `slug`: `<slug>`
   - `mode`: `"single"` | `"multi"` (from §Mode Gate; kept for backward-compat with pre-Workflow sessions)
   - `path_resolved`: `"inline"` | `"workflow"` (from §Mode Gate; re-resolved on resume)
   - `runs`: `{ "analyze": null, "judge": null }` (each records `{ "runId": "<wf_...>" }` after a segment launch — audit + same-session iteration only; cross-session resume re-RUNS segments)
   - `mode_flag`: `"coverage-gap"` | `"regression"` | `null`
   - `regression_report_path`: path string or `null`
   - `framework`: detected framework name
   - `test_file_pattern`: e.g. `"*.test.ts"`
   - `test_cmd`: e.g. `"npx jest"`
   - `mock_library`: e.g. `"jest.mock"`
   - `model_config`: from step 8
   - `user_lang`: from step 1
   - `has_git`: boolean
   - `repo_path`: working directory path
   - `branch`: `"harness/test-gen-<slug>"` or `null`
   - `docs_path`: `"docs/harness/<slug>/"`
   - `phase`: `"setup"`
   - `created_at`: ISO8601 timestamp

10. **Print setup summary** (in `user_lang`):
    ```
    [test-gen] Started!
      Target    : <target>
      Mode      : <single | multi>
      Path      : <inline | workflow>  (<reason per §Path Transparency>)
      Branch    : harness/test-gen-<slug>     ← omit if has_git == false
      Model     : <preset name>
      Framework : <framework>
      Test cmd  : <test_cmd>
      Mock lib  : <mock_library>
      Flag      : <--coverage-gap | --regression <path> | (none)>
    ```

### Phase 1: Analysis

Update state.json: `phase` → `"analyzing"`.

> Steps 1-6 gather inputs (identify target files, coverage tool result, mode-flag handling, dependency/edge-case prep) — the orchestrator does these on BOTH paths (the WORKFLOW path's coverage analysts redo the coverage/dependency/edge-case exploration inside the segment from the same target file list). Step 7 branches on `path_resolved`; the Test Scope HARD GATE (after Phase 1, before judge) stays in this orchestrator on both paths.

**Determine analysis scope:**

1. **Identify target files/functions.**
   - If `<target>` is a directory: collect all source files within it.
   - If `<target>` is a file: use that file.
   - If `<target>` is a class/module name: search for the file containing it.
   - Count unique source files. Store as `target_file_count`.

2. **Run coverage tool if available, else use static analysis fallback:**

   Try to run the framework's built-in coverage command:
   - Jest: `npx jest --coverage --coverageReporters=text`
   - Vitest: `npx vitest run --coverage`
   - pytest: `pytest --cov=<target> --cov-report=term-missing`
   - Go test: `go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out`
   - JUnit/RSpec: skip (static fallback only)

   If coverage tool runs successfully → use its output for gap analysis.

   If coverage tool is unavailable or fails → use **static analysis fallback**:
   - Scan for existing test files matching the source files (using `test_file_pattern`).
   - For each source file: check if a corresponding test file exists.
   - Within each test file: list which functions from the source are referenced.
   - Mark functions with no test references as "untested".
   - Show notice (in `user_lang`): "For accurate coverage analysis, install [coverage tool]. Using static analysis fallback — results may be approximate."

3. **--coverage-gap mode:** Filter analysis to only the lowest-coverage or untested functions. Prioritize functions with 0% coverage first, then those with <50%.

4. **--regression mode:**
   - Read the debug report at `regression_report_path`.
   - If file does not exist: Ask the user using AskUserQuestion (in `user_lang`):
       header: "Regression"
       question: "Debug report not found at {regression_report_path}. Provide bug details manually?"
       options:
         - label: "Describe bug" / description: "I will describe the bug and reproduction steps"
         - label: "Stop" / description: "Halt and locate the debug report first"
     If "Describe bug": collect from user via AskUserQuestion: (a) bug description, (b) reproduction steps, (c) expected vs actual behavior.
     If "Stop": halt.
   - Extract: root cause, reproduction conditions, affected functions.

5. **Dependency analysis + mocking strategy:**
   For each target function, inspect its imports/dependencies.

   Dependency -> mock-approach mapping: defined in `templates/test-gen/coverage_analyst.md` (DB -> repository mock, External API -> HTTP client mock, FS -> temp dir/fs mock). Document the chosen approach per dependency.

6. **Generate edge cases + boundary values list** for each target function:
   - Null / empty / zero inputs
   - Maximum boundary values
   - Invalid type inputs (if applicable)
   - Error/exception paths

7. **Analysis production — branch by `path_resolved`:**

   **INLINE path (mode: single):**
   - If `target_file_count >= 4`, delegate coverage analysis to a sub-agent: read `{CLAUDE_PLUGIN_ROOT}/templates/test-gen/coverage_analyst.md`, fill `{target}`, `{framework}`, `{mock_library}`, `{repo_path}`, `{user_lang}`, `{output_path}`: `.harness/test-gen/analysis.md`; if `model_config.preset` is not `"default"`, pass `model` per Coverage Analyst → executor; launch, wait, verify the file exists.
   - If `target_file_count < 4`: write `.harness/test-gen/analysis.md` directly yourself (steps 1-6 are your analysis).

   **WORKFLOW path (mode: multi):** run the Analyze segment via the Workflow tool (pass `args` as a JSON object — the script defensively parses; the field set below is the 1:1 contract with the script's `// contract` comment — a field missing on either side silently renders as ''):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/test-gen.analyze.workflow.js",
     args: {
       target: <target>, framework: <framework>, mockLibrary: <mock_library>,
       repoPath: <repo_path>, userLang: <user_lang>,
       targetFiles: <list of identified target file paths from step 1, after any coverage-gap filtering>,
       regressionContext: <root cause + repro + affected fns from step 4, else "">,
       models: { executor: <model_config.executor or null>,
                 advisor: <model_config.advisor or null> }
     }
   }
   ```
   Record `runs.analyze → { "runId": "<id>" }`. The script buckets the target files and runs a coverage analyst per bucket in parallel (anchor-free), then synthesizes ONE AnalysisResult. **On Workflow error** (launch failure, script error, schema-invalid result): apply §Mode Gate graceful fallback → notify, set `mode → single` / `path_resolved → inline`, and run the INLINE path above.

8. **Write `.harness/test-gen/analysis.md`** — INLINE path: as produced in step 7. WORKFLOW path: **the orchestrator renders analysis.md from the returned AnalysisResult** (`summary` → Coverage Status; `keyPoints` "[uncovered]"/"[edge]"/"[regression]" → Target Summary + Edge Cases + Test Priority + Regression Scenario; `recommendations` "[mock]" → Mocking Strategy). Sections:
   ### Target Summary
   List of target files and functions to be tested.

   ### Coverage Status
   Existing coverage percentages (or static analysis findings). Mark untested functions.

   ### Mocking Strategy
   For each dependency: type, identified instances, chosen mock approach.

   ### Edge Cases & Boundary Values
   Per function: list of edge/boundary scenarios to test.

   ### Test Priority
   Ordered list: which functions to test first (by risk/complexity/coverage gap).

   (If --regression mode): add section:
   ### Regression Scenario
   Root cause summary, reproduction conditions, target functions.

9. Print status (in `user_lang`):
   ```
   [test-gen] Analysis complete.
     Target files : <N>
     Untested fns : <M>
     Dependencies : <K> identified
     Output       : .harness/test-gen/analysis.md
   ```

### HARD GATE — Test Scope Confirmation

<HARD-GATE>
Show analysis.md to the user and ask for explicit confirmation using AskUserQuestion (in `user_lang`):
  header: "Scope"
  question: "Review the test scope and mocking strategy above. Confirm to generate test code."
  options:
    - label: "Proceed" / description: "Generate tests as analyzed"
    - label: "Modify" / description: "Adjust scope or mocking strategy, then re-confirm"
    - label: "Stop" / description: "Halt the workflow"

If user selects "Modify" or provides modification details via "Other": update analysis.md accordingly and re-present this question.
If user selects "Stop": halt the workflow.
Only "Proceed" advances to the Generation phase.
</HARD-GATE>

### Phase 2: Generation

Update state.json: `phase` → `"generating"`.

> **Generation is orchestrator-inline on BOTH paths** (test files written to the main tree). There is NO generation Workflow segment — the WORKFLOW path also generates inline here, after Phase 1 and before the judge. No double-generation. (The Test Generator sub-agent dispatch below, for large targets, is an inline Agent dispatch, not a Workflow segment.)

1. **Read `.harness/test-gen/analysis.md`** to get the full test scope.

2. **Large target delegation:** If `target_file_count >= 4`, delegate test writing to a sub-agent:
   - Read template: `{CLAUDE_PLUGIN_ROOT}/templates/test-gen/test_generator.md`
   - Fill variables: `{target}`, `{framework}`, `{mock_library}`, `{mocking_strategy}` (mocking section from analysis.md), `{analysis_content}` (full analysis.md content), `{user_lang}`, `{test_file_pattern}`
   - If `model_config.preset` is not `"default"`, pass `model` parameter per the preset table in `templates/_shared/model_config.md` (Test Generator → executor role).
   - Launch sub-agent. Wait for completion.

   If `target_file_count < 4`: write test files directly yourself.

3. **Write test files** following framework conventions:
   - **Happy path tests:** Normal input → expected output for each function.
   - **Edge case tests:** Each edge/boundary scenario from analysis.md.
   - **Error/exception tests:** Invalid inputs, dependency failures.
   - **Regression tests (if --regression mode):** Reproduce the exact bug scenario, assert the fix.
   - Apply the mocking strategy from analysis.md.
   - Place test files at paths matching `test_file_pattern` (alongside source files or in test/ directory, matching existing project conventions).
   - Each test must have at least 1 meaningful assertion. Never write `expect(true).toBe(true)` or equivalent trivial assertions.
   - Import and mock correctly per `mock_library` conventions.

4. **Write `docs/harness/<slug>/test_changes.md`** with sections:
   ### Test Files Created
   - List of created test file paths
   - Number of test cases per file

   ### Test Coverage Targets
   - Functions covered by the new tests
   - Expected coverage improvement

   ### Mocking Applied
   - Summary of mock patterns used

5. Print status (in `user_lang`):
   ```
   [test-gen] Generation complete.
     Test files : <N> created
     Test cases : <M> total
     Output     : docs/harness/<slug>/test_changes.md
   ```

### Phase 3: Verification

Update state.json: `phase` → `"verifying"`.

#### Step 1 — Execution

1. **Run generated tests:**
   Execute `test_cmd` (scoped to the new test files if possible, e.g. `npx jest <test_file>` or `pytest <test_file>`).

2. **If tests pass:** proceed to Step 2 (Meaningfulness).

3. **If tests fail:**
   - Analyze the error output.
   - Fix **TEST CODE ONLY** — never modify production source files.
   - Re-run the tests.
   - If still failing: fix again and re-run (max 2 retries total, i.e. up to 3 runs).
   - After 2 failed retries: report to user using AskUserQuestion (in `user_lang`):
       header: "Test Failure"
       question: "Tests still failing after 2 fix attempts. [error summary]. How to proceed?"
       options:
         - label: "Show errors" / description: "Display full error output for manual inspection"
         - label: "Stop" / description: "Halt — save partial results"
     Halt and write partial test_report.md with failure details.

#### Step 2 — Meaningfulness (Simplified Mutation Testing)

> Both paths produce an equivalent **MutationVerdict** (`workflows/_reference/schemas.md`) — the orchestrator assembles it and renders the same test_report.md sections. **Mutation-of-production is NEVER scripted on either path**: the apply → run → revert is orchestrator-inline, in place, with an immediate revert and a working-tree clean guard. No executor sub-agent, no worktree (a git worktree omits ignored deps, snapshots an uncommitted tree, and is an unverified engine contract — all avoided by the in-place run).

##### INLINE path (mode: single) — single-mutation heuristic

For each **new test** generated, perform mutation testing on its target function:

1. **Identify the key logic** in the production function (e.g. a conditional branch, a return value, a loop boundary).
2. **Apply one mutation** — choose the most impactful type:
   - **Condition inversion:** change `if (a > b)` → `if (a <= b)` (or `if (condition)` → `if (!condition)`)
   - **Return value change:** change `return result` → `return null` (or a wrong constant)
   - **Arithmetic operator change:** `+` → `-`, `*` → `/`
3. **Re-run only the test** targeting this mutated function.
4. **Evaluate:**
   - If the test **fails** after mutation → meaningful (catches the mutation). ✓ caught.
   - If the test **still passes** → trivial (does not catch a key logic change). ⚠ not caught.
     - **Attempt to strengthen (INLINE-only legacy convenience, 1 try):** rewrite the test to add a more specific assertion; re-run with the mutation — now fails → ✓ strengthened; still passes → ⚠ weak. **The strengthened test is KEPT** — it is *test code* (which test-gen owns), so this is an intended INLINE-only test-file write, distinct from the WORKFLOW path which writes nothing during scoring and surfaces the fix as `weakTests[].suggestedAssertion` instead.
5. **Revert the source mutation immediately** after evaluating each test — this reverts the **production source** (NOT the kept strengthened test). Never leave a mutated source in place; the production-source clean guard (WORKFLOW step 4 below) applies to the INLINE path's source mutations too.

**Safety:** If mutation cannot apply (function too short/complex) → ⚪ skipped (not applicable). Then assemble the MutationVerdict (below); the `+1 strengthen` does not change its shape (it may change the score values — see Verdict reduction).

##### WORKFLOW path (mode: multi) — propose segment + orchestrator inline run

1. **Extract targets.** From the Phase 2 output (test_changes.md Coverage Targets + the generated test files), extract up to **N=8** target functions and their covering test(s) — SYNC-SOURCE heuristic = the INLINE "for each new test → identify its target function". Build `targets: [{ targetFunction, file, signature, sourceSnippet, coveringTests: [{ testFile, testName }] }]`. Log any drop beyond N=8 (no silent cap).
2. **Run the Judge segment (propose-only)** via the Workflow tool (1:1 contract with the script's `// contract` comment):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/test-gen.judge.workflow.js",
     args: {
       targets: <the targets[] above>,
       userLang: <user_lang>,
       models: { evaluator: <model_config.evaluator or null> }
     }
   }
   ```
   Record `runs.judge → { "runId": "<id>" }`. The segment returns `{ proposals: SkepticVote[], stats }` — read-only; it applied / ran / reverted NOTHING. **On Workflow error:** fall back to the INLINE heuristic above for this step.
3. **Orchestrator inline run (the authoritative measurement).** For each proposal (`mutationKind == "not-applicable"` → record skipped, do NOT mutate):
   a. **Back up** `proposal.file` (git tracks it, or copy aside if `has_git == false`), then apply the proposed mutation **in place** (the exact before → after from `mutationDescription`).
   b. **Run the scoped test:** map `proposal.expectedCatcherTest.testFile` to the framework command (`npx jest <testFile>` / `npx vitest run <testFile>` / `pytest <testFile>` / `go test <pkg>` / `bundle exec rspec <testFile>`).
   c. **Record the measured result** as an `ExecutedMutation { targetFunction, file, mutationKind, mutationDescription, applied: true, caught, testRun, evidence }`: test **fails** under the mutation → `caught: true` (meaningful); test **passes** → `caught: false` (weak).
   d. **Immediately revert** the mutated file before the next proposal.
   - If `expectedCatcherTest.testFile` does not exist or no real run is possible → record the proposal as **skipped** (`applied: false`), not scored.
4. **Working-tree clean guard for production source (after the loop; applies to the INLINE path's source mutations too).** Verify no source mutation survived — both branches VERIFY, not just restore:
   - `has_git == true`: run `git diff --quiet -- <each mutated source file>`. If dirty → force-revert with `git checkout -- <source>` and warn (in `user_lang`).
   - `has_git == false`: restore each mutated file from its 3a backup, then **read it back and byte-compare to the backup** to confirm the restore matched; on mismatch, re-restore and warn (in `user_lang`). (A partial/failed restore is thus detected, mirroring the git-diff proof.)
5. **Assemble the MutationVerdict from `executions[]` (the measured runs ONLY — never `SkepticVote.predictedCaught`):**
   - `proposals` = the SkepticVote[]; `executions` = the ExecutedMutation[].
   - `weakTests` = one per execution with `applied && !caught` — `{ test: <expectedCatcherTest.testName>, targetFunction, reason, suggestedAssertion }`. The WORKFLOW path does NOT auto-strengthen; it **surfaces** `suggestedAssertion` for the user / a follow-up to apply.
   - `score`: `meaningful` = count(`applied && caught`); `weak` = count(`applied && !caught`); `skipped` = count(proposals not applied: not-applicable / apply-failed / no real run); `totalScored` = count(`applied`) = meaningful + weak.

##### Verdict reduction (deterministic — BOTH paths)

From the assembled `score`, set `MutationVerdict.verdict`:
- `weak > 0` → **WEAK**
- `weak == 0 ∧ meaningful > 0` → **MEANINGFUL**
- `totalScored == 0` (everything skipped / not-applicable) → **TRIVIAL**
- boundary `meaningful == 0 ∧ weak == 0 ∧ skipped > 0` → **TRIVIAL**

`score`/`weakTests` are derived ONLY from `executions[]` (the measured runs), never from `SkepticVote.predictedCaught`. Both paths produce the **same-shape** MutationVerdict, so test_report.md renders the **same sections** on both paths. **The VALUES may differ — and that is intended, not a contradiction:** the INLINE `+1 strengthen` rewrites a weak test and re-measures it, so a strengthened test scores `caught:true` (meaningful) where the WORKFLOW path — which does NOT auto-strengthen — records the original test as weak and surfaces the fix as `weakTests[].suggestedAssertion`. Both scores are caught-derived (measured); INLINE may therefore report a more favorable verdict for the same input. Equivalence is **shape/sections**, not value-isomorphism (INLINE is the preserved legacy single mode — its auto-strengthen behavior is unchanged).

#### Output — Test Report

The orchestrator writes `docs/harness/<slug>/test_report.md` from the assembled **MutationVerdict** (both paths render the same sections): `executions[]` → Mutation Testing Summary table; `score` → Quality Score; `weakTests[]` → Recommendations; `verdict` → the overall assessment line.

### Test Execution Results
- Total tests run: N
- Passed: M
- Failed: K (if any)
- Test command used

### Mutation Testing Summary
| Test (catcher) | Target function | Mutation applied | Result |
|----------------|----------------|-----------------|--------|
| test_foo_returns_sum | add() | Return value → null | ✓ caught (meaningful) |
| test_bar_empty | bar() | Condition inversion | ⚠ not caught (weak) |
| baz() | baz() | — | ⚪ skipped (not applicable) |

(One row per `executions[]` entry; `caught == true` → ✓ meaningful, `applied && !caught` → ⚠ weak, `applied == false` → ⚪ skipped.)

### Quality Score
- **Verdict: MEANINGFUL | WEAK | TRIVIAL** (per the deterministic reduction)
- Meaningful: `score.meaningful` / `score.totalScored`
- Weak (uncaught): `score.weak`
- Skipped (not applicable): `score.skipped`
- **Overall quality: X%** = `score.meaningful / score.totalScored` (or "N/A" when `totalScored == 0`)

### Recommendations
- One per `weakTests[]` entry: the weak test, its target function, the reason, and the `suggestedAssertion` to strengthen it
- Coverage gaps still remaining (if any)

Print final status (in `user_lang`):
```
[test-gen] Verification complete.
  Tests passed  : <N>/<total>
  Verdict       : <MEANINGFUL | WEAK | TRIVIAL>
  Quality score : <X>% meaningful (<score.meaningful>/<score.totalScored>)
  Weak tests    : <score.weak>
  Output        : docs/harness/<slug>/test_report.md
```

### Cleanup & Commit

#### Artifact Cleanup Safety Guard

Cleanup safety rules: see `templates/_shared/safety_guard.md`.

Ask the user using AskUserQuestion (in `user_lang`):
  header: "Commit"
  question: "Test generation complete. Choose how to finish:"
  options:
    - label: "Commit tests only (Recommended)" / description: "Clean up artifacts (.harness/, docs/harness/<slug>/) then commit test files only"
    - label: "Commit all" / description: "Commit everything including artifacts (test_changes.md, test_report.md)"
    - label: "No commit" / description: "Clean up .harness/ only, do not commit (changes remain in working tree)"

Actions per selection (apply Safety Guard before each delete):
- "Commit tests only": delete `.harness/` dir, delete `docs/harness/<slug>/` dir (**only** this slug dir — verify via guard), stage and commit new test files
- "Commit all": delete `.harness/` dir, stage and commit test files + `docs/harness/<slug>/` files
- "No commit": delete `.harness/` dir only

**If has_git == false:** Skip this question entirely. Inform the user (in `user_lang`) that artifacts are saved in `docs/harness/<slug>/`. Clean up `.harness/` directory only. Do not attempt any git operations.

Update state.json: `phase` → `"completed"`.

### Status Check (anytime)

If the user asks for status at any point, print status in the standard format defined above.

## Smart Routing (after completion)

After successful completion, suggest related actions (in `user_lang`):
- **`/team-memory save`** — record testing decisions and patterns for future sessions.
- **If weak tests were found** (uncaught mutations): they are surfaced in test_report.md Recommendations with a `suggestedAssertion` for follow-up.
- **If a production bug was uncovered during testing** (a test exposes a real source defect — never auto-fixed here): suggest **`/deep-review --fix`** to review and gate-apply the fix, and **`/debug`** to investigate the root cause.

## Model Selection

Preset table + rules: see `templates/_shared/model_config.md`.

**Role map (test-gen):** Coverage Analyst (+ in-script coverage synthesis) and Test Generator → `executor` (synthesis → `advisor` on the workflow path); mutation skeptic → `evaluator`. The inline mutation run (apply/run/revert) is orchestrator-owned, so it has no model role.

**WORKFLOW path:** pass the resolved models once per segment run as `args.models` — Analyze segment `{ executor, advisor }`, Judge segment `{ evaluator }` (null = inherit parent model, i.e. the `default` preset) — the segment scripts apply them per agent.

**Applying model config (INLINE path):** when launching any sub-agent (Coverage Analyst / Test Generator), if `model_config.preset` is not `"default"`, pass the `model` parameter per the role map + the preset table. Sub-agents must NOT directly access state.json to read model_config — the orchestrator passes the model parameter at launch time.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Key Rules

- **NEVER modify production code (except a reverted mutation).** Test code only. If a test fails due to a bug in the source, report it — do not fix the source.
- **Production immutability is structurally enforced, never scripted.** The mutation apply/run/revert is **orchestrator-inline, in place** — no executor sub-agent, no worktree. Revert immediately after each mutation, then a working-tree clean guard (applied on BOTH paths) proves zero residual **source** mutation: `git diff --quiet -- <source>` with git; a backup-restore + read-back byte-compare without git. (The INLINE strengthen may KEEP a rewritten *test* — test code, not production — which is an intended INLINE-only write.) The judge segment is propose-only and read-only.
- **Judge-panel.** The WORKFLOW path's value is adversarial diversity (N skeptics propose in parallel); the AUTHORITATIVE caught/not-caught is the orchestrator's inline measured run — never `SkepticVote.predictedCaught`. The verdict reduction is deterministic (weak>0→WEAK; weak==0∧meaningful>0→MEANINGFUL; totalScored==0→TRIVIAL).
- **Generation is inline on both paths.** Test files are written to the main tree by the orchestrator; there is no generation Workflow segment (no double-generation).
- **Mode Gate.** `--mode` flag / ultracode opt-in / Workflow availability / `has_git` derive the mode (§Mode Gate); `has_git == false` forces inline. Fan-out (coverage analysts + skeptic panel) exists ONLY on the workflow path; without the engine or opt-in, the session runs single inline.
- **Workflow args are a JSON object;** segment scripts defensively parse (`args` may arrive as a JSON string). Keep the SKILL args blocks and the scripts' `// contract` comments in 1:1 sync. Never put user-gate decisions into args. Graceful engine fallback: any Workflow failure degrades to the inline path — never a hard error. Gates live ONLY in this orchestrator.
- **--coverage-gap and --regression are mutually exclusive.** Error and stop if both are provided.
- **Confirmation gates are non-negotiable.** The HARD GATE after analysis must receive explicit "Proceed" before generation starts.
- **Trivial assertions are forbidden.** Every test must have at least 1 assertion that would fail if the target function's logic was broken.
- **Framework detection is required.** If the framework cannot be detected and the user cannot specify one, stop with a clear error message.
- **User language.** All user-facing output must be in `user_lang`. Re-detect on every user message. WORKFLOW path: pass `userLang` in `args` — the segment scripts build schema descriptions from it, forcing sub-agent free-text output language; identifiers/paths/enums stay English raw.
- **Intermediate outputs are ephemeral.** `.harness/test-gen/analysis.md` is a working artifact (inline path). On the workflow path the segments return schema-validated objects — no intermediate analysis/proposal files. Final artifacts (test_changes.md, test_report.md) live in `docs/harness/<slug>/`.
