---
name: code-review
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: "[DEPRECATED -> use /deep-review] Systematic, bias-free code review. Renamed to /deep-review to end the literal collision with Claude Code's built-in /code-review (2.1.147+, --comment/--fix). This stub forwards to /deep-review."
---

# /code-review — DEPRECATED alias for /deep-review

> This skill was renamed. `/code-review` (agent-harness) literally collided with Claude Code's
> built-in `/code-review` command (2.1.147+, which ships its own `--comment`/`--fix` flags).
> The reframed skill — which keeps the differentiators: multi-perspective specialist reviews,
> adversarial cross-verification, the bias-reduction contract (anchor-free, defect-assumption,
> author-neutral, context-isolated), and the structured report — lives at **/deep-review**,
> with `--comment`/`--fix` parity behind explicit gates.

## Behavior

1. Print (in the user's language): "`/code-review` (agent-harness) is deprecated and renamed to
   `/deep-review`. The new skill runs plugin-shipped native Workflow segment scripts on the
   workflow path (ultracode or `--mode deep/thorough` opt-in) and keeps the inline quick path
   otherwise."
2. Ask via AskUserQuestion (in the user's language):
   - header: "Deprecated"
   - question: "Run /deep-review with these arguments instead?"
   - options:
     - "Yes" / "Delegate to /deep-review with the same target/flags"
     - "No" / "Cancel"
3. If "Yes" → invoke the `deep-review` skill with the identical arguments (target + any
   --flags), delegating all behavior to `skills/deep-review/SKILL.md`.
4. If "No" → halt.

(No orchestration logic lives here. /deep-review is the single source of truth.)
