# Mode Gate — Shared Convention (single source, OPT-IN)

> Supersedes the earlier `${CLAUDE_EFFORT}` env-var gate, which is **dead** (see
> ARCHITECTURE COLD-REVIEW CORRECTION C2 / cold-review blocker B5). Raw effort level does
> NOT make the native Workflow engine available, and `${CLAUDE_EFFORT}` is not a real
> variable. **Gate on OPT-IN, not on effort.**

At Setup, resolve the execution path:

1. **Default = INLINE path** (current behavior). The orchestrator runs the skill's existing
   inline sub-agent flow directly — no Workflow engine.
2. **Take the WORKFLOW path only when BOTH hold:**
   - the `Workflow` tool is actually available this session, AND
   - the session opts in — ultracode mode is on, OR the user passed an explicit
     `--mode standard/multi/comprehensive/thorough/deep` (any mode the skill maps to the
     engine path; pilot precedent: /harness routes `standard` and `multi` to the engine),
     OR the skill's own instructions direct the model to call the `Workflow` tool
     (a documented valid opt-in).
3. **Graceful fallback.** If the `Workflow` tool is unavailable (or a Workflow call errors),
   silently fall back to the INLINE path — **never error out**. Optionally tell the user they
   can re-invoke with ultracode / `--mode` for the deeper path.
4. **`has_git == false` forces INLINE** regardless of opt-in (engine `isolation:'worktree'`
   requires git).
5. Record the resolved path in `state.json` (e.g. `path_resolved: "inline" | "workflow"`)
   for audit/resume, and show it in the Setup Summary.

`--mode single/quick` always forces INLINE.

**Phasing note:** the Workflow segment scripts that the workflow path executes are
introduced per-skill in the reframe phases (Phase 1 pilot first, proven by dry-run, then the
replicate phases). Until a skill ships its scripts, that skill stays on the INLINE path even
when opted in — the opt-in simply has no workflow target yet, and the graceful-fallback rule
(3) keeps that non-breaking.

## §Ambiguity Prompt (fires ONLY when opt-in is absent)

Path resolution is silent EXCEPT one case. Resolve in this order (first match wins). This
order matters: the engine/git check (2) precedes honoring a workflow-tier `--mode` (3) so an
impossible request degrades correctly.

1. `--mode <shallow>` (the skill's inline mode: single/quick) → **inline**. No prompt.
2. `Workflow` tool absent **OR** `has_git == false` → **inline**. No prompt. If a workflow-tier
   `--mode` was requested, print the downgrade notice.
3. `--mode <workflow-tier>` → **workflow** (that tier). No prompt.
4. **ultracode ON** (no `--mode`) → **workflow** at the skill's *current ultracode-target* tier
   (the mode its §Mode Gate table already maps ultracode to — NOT necessarily the deepest).
   No prompt — ultracode IS the opt-in. Emit §Path Transparency with reason "ultracode ON".
5. `--no-prompt` flag **OR** the session cannot present an interactive prompt (headless / cron /
   subagent) → **inline** (existing auto-resolution). No prompt. **Default bias: auto-resolve
   UNLESS an interactive session is positively confirmed** — never block an automated run.
6. else (no `--mode` **AND** ultracode OFF **AND** engine available **AND** interactive) → **ASK**
   via AskUserQuestion (in `user_lang`):
   - header: "Path"
   - question: "No mode specified — choose how to run:"
   - options = the skill's modes, each mapping to inline/workflow per its §Mode Gate table.
     Append "(Recommended)" to the scope-advised tier for skills that print a scope advisory
     (deep-review, codebase-audit); otherwise to the shallowest (inline) mode.
   On answer: set `mode` + `path_resolved`, then emit §Path Transparency.

This does NOT reintroduce effort gating. Opt-in signals (ultracode, `--mode`) still resolve
silently; the prompt fires only when NO opt-in is present. Resume never re-fires this prompt —
it reuses the stored `{ mode, path_resolved }` (only the workflow→inline downgrade may change it).

A skill with no Workflow segment (e.g. `team-memory`) never reaches this prompt: step 2 always
resolves it to inline because no workflow path exists for it.

## §Path Transparency (always shown)

In EVERY resolution branch, the Setup Summary / status format MUST show:

    Path : <inline | workflow>  (<reason>)

`<reason>` states WHY, and for inline-by-default also HOW to change it. Canonical reasons:
  - `--mode <m>`                          → "--mode <m>"
  - ultracode ON (step 4)                 → "ultracode ON"
  - engine/git unavailable (step 2)       → "Workflow engine unavailable"
  - no opt-in, resolved inline (step 5)   → "no opt-in — re-run with --mode <wf-tier> for workflow"
  - chosen via §Ambiguity Prompt (step 6) → "you chose <mode>"
