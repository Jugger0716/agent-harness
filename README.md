# Agent Harness

3-Phase (Planner -> Generator -> Evaluator) development workflow for Claude Code.

Inspired by Anthropic's [Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

## What it does

Separates planning, implementation, and review into distinct phases with file-based handoffs. This prevents the "self-evaluation bias" where a single agent rates its own work too favorably, and enforces structured planning before coding.

```
harness run     -> [Phase 1] Planner: analyze task, write spec.md
harness next    -> [Phase 2] Generator: implement code, write changes.md
harness next    -> [Phase 3] Evaluator: test + review, write qa_report.md
harness next    -> PASS -> Done / FAIL -> Back to Phase 2 (max N rounds)
```

## Install as Claude Code Plugin

```bash
claude plugin add https://github.com/Lee-JungGu/agent-harness
```

Then use in any Claude Code session:

```
/agent-harness:harness fix login timeout bug
```

## Manual Setup

```bash
cd /path/to/agent-harness
pip install -r requirements.txt

# Initialize
python harness.py init

# Register repos
python harness.py repo add \
  --name my-backend \
  --path /path/to/my-backend \
  --lang java \
  --test-cmd "./gradlew test" \
  --build-cmd "./gradlew build"
```

## Usage

### Start a task

```bash
python harness.py run --repo my-backend --task "Add rate limiting to login API"
```

### Advance phases

```bash
# After completing each phase:
python harness.py next --repo-path /path/to/my-backend
```

### Check status

```bash
python harness.py status --repo-path /path/to/my-backend
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `init` | Initialize ~/.agent-harness/ config directory |
| `repo add --name --path --lang [--test-cmd] [--build-cmd] [--default-scope]` | Register a repository |
| `repo list` | List registered repositories |
| `repo update <name> [--test-cmd] [--build-cmd] ...` | Update repo settings |
| `repo remove <name>` | Remove a repository |
| `run --repo <name> --task "..." [options]` | Start a new task |
| `run --repo-path <path> --lang <lang> --task "..."` | One-off usage without registration |
| `next --repo-path <path>` | Advance to next phase |
| `status --repo-path <path>` | Show current task status |

### Guardrails

| Option | Default | Description |
|--------|---------|-------------|
| `--scope` | repo config | Restrict file modifications to a glob pattern |
| `--max-rounds` | 3 | Maximum Generator/Evaluator retry cycles |
| `--max-files` | 20 | Maximum number of files that can be modified |
| `--dry-run` | false | Run Planner only, no code changes |

## Configuration Priority

CLI arguments > `.harness.yaml` (repo root) > `~/.agent-harness/repos.yaml`

## How it works

1. `harness run` creates `.harness/` in the target repo, a git branch, and renders the Planner prompt
2. Claude Code reads the prompt, explores the codebase, writes `spec.md`
3. `harness next` advances the state machine, renders the Generator prompt
4. Claude Code implements the code, writes `changes.md`
5. `harness next` renders the Evaluator prompt
6. Claude Code runs tests + code review, writes `qa_report.md` with PASS/FAIL
7. `harness next` parses the verdict: PASS completes, FAIL loops back to Generator

State is tracked in `.harness/state.json`. Each round is a git commit on the `harness/*` branch.

## Project Structure

```
agent-harness/
├── .claude-plugin/
│   └── plugin.json         # Claude Code plugin manifest
├── skills/
│   └── harness/
│       └── SKILL.md        # Plugin skill definition
├── harness.py              # CLI entry point
├── config.py               # ~/.agent-harness/repos.yaml management
├── state.py                # Phase state machine
├── renderer.py             # Template rendering
├── phases/
│   ├── planner.py          # Phase 1 prompt generation
│   ├── generator.py        # Phase 2 prompt generation
│   └── evaluator.py        # Phase 3 prompt generation
├── templates/
│   ├── planner_prompt.md
│   ├── generator_prompt.md
│   └── evaluator_prompt.md
└── tests/                  # 122 tests
```
