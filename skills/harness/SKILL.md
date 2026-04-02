---
name: harness
description: 3-Phase (Planner -> Generator -> Evaluator) development workflow. Use when starting feature work, bug fixes, or maintenance tasks that benefit from structured planning, implementation, and review.
---

# Agent Harness Workflow

You are orchestrating a 3-Phase development workflow using the Agent Harness CLI.

## Prerequisites

- Python 3.9+ with PyYAML installed
- Harness initialized: `python {CLAUDE_PLUGIN_ROOT}/harness.py init`
- Target repo registered: `python {CLAUDE_PLUGIN_ROOT}/harness.py repo add --name <name> --path <path> --lang <lang>`

Check registered repos: `python {CLAUDE_PLUGIN_ROOT}/harness.py repo list`

## Workflow

When the user provides a task (via $ARGUMENTS or in conversation), execute this workflow:

### Step 1: Start the task

```bash
python {CLAUDE_PLUGIN_ROOT}/harness.py run \
  --repo <repo-name> \
  --task "$ARGUMENTS" \
  [--scope "<pattern>"] \
  [--max-rounds 3] \
  [--max-files 20] \
  [--dry-run]
```

If the user didn't specify a repo, ask which registered repo to use (show `repo list` output).

### Step 2: Execute Phase 1 (Planner)

Read the rendered planner prompt at `.harness/planner_prompt_rendered.md` in the target repo.
Follow its instructions to:
1. Explore the codebase
2. Write `.harness/spec.md` with: goal, background, scope, approach, completion criteria, risks
3. Use `brainstorming` and `writing-plans` superpowers skills if available

**Show spec.md to the user for confirmation before proceeding.**

### Step 3: Advance to Phase 2

```bash
python {CLAUDE_PLUGIN_ROOT}/harness.py next --repo-path <repo-path>
```

Read `.harness/generator_prompt_rendered.md` and follow its instructions to:
1. Implement the code changes
2. Stay within scope
3. Write `.harness/changes.md` listing all modified/created files
4. Use `test-driven-development` skill if tests are available

### Step 4: Advance to Phase 3

```bash
python {CLAUDE_PLUGIN_ROOT}/harness.py next --repo-path <repo-path>
```

Read `.harness/evaluator_prompt_rendered.md` and follow its instructions to:
1. Run tests if available (build + test commands)
2. Code review all changed files (5 criteria)
3. Write `.harness/qa_report.md` with PASS/FAIL verdict
4. Use `requesting-code-review` and `verification-before-completion` skills if available

### Step 5: Check result

```bash
python {CLAUDE_PLUGIN_ROOT}/harness.py next --repo-path <repo-path>
```

- If PASS: task complete. Inform the user.
- If FAIL and rounds remaining: go back to Step 3 (Generator re-runs with QA feedback).
- If FAIL and max rounds reached: inform the user of remaining issues.

### Step 6: Status check (anytime)

```bash
python {CLAUDE_PLUGIN_ROOT}/harness.py status --repo-path <repo-path>
```

## Key Rules

- **Never skip phases.** Always go Planner -> Generator -> Evaluator.
- **Confirm spec with user** before proceeding to Generator.
- **Stay within scope.** Do not modify files outside the specified scope.
- **Evaluator must be strict.** Do not hand-wave issues as "minor".
- **Git safety.** The harness creates a branch automatically. Each round is committable.

## Sub-commands Reference

| Command | Description |
|---------|-------------|
| `init` | Initialize ~/.agent-harness/ config |
| `repo add` | Register a repository |
| `repo list` | List registered repositories |
| `repo update <name>` | Update repo settings |
| `repo remove <name>` | Unregister a repository |
| `run` | Start a new task (creates .harness/, branch, Phase 1 prompt) |
| `next` | Advance to next phase |
| `status` | Show current phase and round |
