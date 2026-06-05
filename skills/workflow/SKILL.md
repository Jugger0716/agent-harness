---
name: workflow
disallowed-tools: NotebookEdit
description: "[DEPRECATED -> use /harness] 3-Phase Planner/Generator/Evaluator workflow. Renamed to /harness to end the concept collision with Claude Code's native Workflow engine. This stub forwards to /harness."
---

# /workflow — DEPRECATED alias for /harness

> This skill was renamed. `/workflow` (agent-harness) conceptually collided with Claude Code's
> native Workflow engine (the ultracode fan-out engine). The reframed skill — which now
> *authors and runs* native Workflow segment scripts rather than competing with the engine —
> lives at **/harness**.

## Behavior

1. Print (in the user's language): "`/workflow` is deprecated and renamed to `/harness`. The new
   skill runs plugin-shipped native Workflow segment scripts on the workflow path (ultracode or
   `--mode standard/multi` opt-in) and keeps the inline single path otherwise."
2. Ask via AskUserQuestion (in the user's language):
   - header: "Deprecated"
   - question: "Run /harness with these arguments instead?"
   - options:
     - "Yes" / "Delegate to /harness with the same task/flags"
     - "No" / "Cancel"
3. If "Yes" → invoke the `harness` skill with the identical arguments (task + any --flags),
   delegating all behavior to `skills/harness/SKILL.md`.
4. If "No" → halt.

(No orchestration logic lives here. /harness is the single source of truth. A pre-existing
`.harness/state.json` from an old /workflow session is handled by /harness Session Recovery —
"Pre-harness session detected, Restart recommended".)
