---
name: memory
disallowed-tools: NotebookEdit, Task, Agent, Workflow, WebSearch, WebFetch
description: "[DEPRECATED -> use /team-memory] Team knowledge base manager. Renamed to /team-memory to end the trigger ambiguity with Claude Code's built-in personal auto-memory / the # shortcut / CLAUDE.md. This stub forwards to /team-memory."
---

# /memory — DEPRECATED alias for /team-memory

> This skill was renamed. `/memory` (agent-harness) was trigger-ambiguous with Claude Code's
> built-in personal auto-memory (`~/.claude/projects/`), the `#` quick-add shortcut, and
> CLAUDE.md. The reframed skill — the git-committed, team-shared knowledge base at
> `docs/harness/memory/` (save/show/clean/search, human-gated CRUD) — lives at **/team-memory**.

## Behavior

1. Print (in the user's language): "`/memory` (agent-harness) is deprecated and renamed to
   `/team-memory`. It manages the git-committed team knowledge base at `docs/harness/memory/`,
   which is separate from Claude Code's built-in personal auto-memory."
2. Ask via AskUserQuestion (in the user's language):
   - header: "Deprecated"
   - question: "Run /team-memory with these arguments instead?"
   - options:
     - "Yes" / "Delegate to /team-memory with the same args"
     - "No" / "Cancel"
3. If "Yes" → invoke the `team-memory` skill with the identical arguments (save/show/clean/search
   + any keyword), delegating all behavior to `skills/team-memory/SKILL.md`.
4. If "No" → halt.

> **No escalation:** like /team-memory, this stub is human-gated CRUD only — never dispatch
> sub-agents (Task/Agent), never invoke the Workflow engine, never fetch the web. The
> `disallowed-tools` frontmatter enforces this at runtime.

(No CRUD/orchestration logic lives here. /team-memory is the single source of truth.)
