# Mode Gate — Shared Convention (single source, OPT-IN)

> Supersedes the earlier `${CLAUDE_EFFORT}` env-var gate, which is **dead** (see
> ARCHITECTURE COLD-REVIEW CORRECTION C2 / cold-review blocker B5). Raw effort level does
> NOT make the native Workflow engine available, and `${CLAUDE_EFFORT}` is not a real
> variable. **Gate on OPT-IN, not on effort.**

At Setup, resolve the execution path:

1. **Default = INLINE path** (current behavior). The orchestrator runs the skill's existing
   single/standard sub-agent flow directly — no Workflow engine.
2. **Take the WORKFLOW path only when BOTH hold:**
   - the `Workflow` tool is actually available this session, AND
   - the session opts in — ultracode mode is on, OR the user passed an explicit
     `--mode multi/comprehensive/thorough/deep`, OR the skill's own instructions direct the
     model to call the `Workflow` tool (a documented valid opt-in).
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
