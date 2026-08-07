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
     OR the resolved project-defaults line declares `agent-harness-defaults: path=workflow` (a standing
     per-project opt-in — sources & search order: `templates/_shared/project_defaults.md`),
     OR the skill's own instructions direct the model to call the `Workflow` tool
     (a documented valid opt-in).
3. **Graceful fallback — for genuine engine failure only.** If the `Workflow` tool is
   unavailable, or a Workflow call *errors* (launch failure, script error, schema-invalid
   result), silently fall back to the INLINE path — **never error out**. Optionally tell the
   user they can re-invoke with ultracode / `--mode` for the deeper path.

   **A permission DENIAL is not an engine error, and must not be downgraded SILENTLY.**
   `Permission to use Workflow has been denied.` is a policy or human decision, not a fault,
   so swallowing it strips a path the user explicitly asked for without telling them. What
   this rule requires is **disclosure, not blocking**:
   - **Interactive session** → report the denial plus the candidate causes below and let the
     human choose the path. Do NOT write `path_resolved` before they answer — its enum is
     `"inline" | "workflow"` (rule 5) and there is no third value, so leave the field at its
     previous value (unset on a fresh run) rather than inventing one. §Path Transparency
     prints `Path : (unresolved — Workflow denied)` for this branch only.
   - **Non-interactive** (headless / cron / subagent — §Ambiguity Prompt 5) → fall back to
     INLINE, record it, and print the denial banner anyway. "Never block an automated run"
     outranks "ask the human"; "never downgrade silently" is still honored by the banner.
     Without this branch, rule 3's `never error out`, §Ambiguity Prompt 5, and "ask first"
     would deadlock each other in an automated run.
   - Do **not** re-issue the same call inside the same turn. Retry only after the USER states
     in a NEW message that something changed (permission granted, new session) — the
     orchestrator has no way to observe permission state on its own, so any other retry
     trigger would be unfalsifiable.

   **Candidate causes — offer these as candidates, never as a diagnosis.** The orchestrator
   cannot query permission state and therefore cannot tell them apart:
   - **(a) a preceding skill's `disallowed-tools` may still be in force for this turn** — a
     skill that blocks `Task, Agent, Workflow` (`handoff`, `team-memory`, `memory`) invoking
     another skill from inside its own turn. **UNVERIFIED.** Observed once (2026-08-07: two
     denials inside a `/handoff resume` turn; the identical call succeeded in the next turn
     with no settings change), but **no file in this repository documents the runtime scoping
     of `disallowed-tools`**, so turn-scoped leakage is inference, not established behavior.
     If it does apply, the remedy is the user re-running the command in a NEW message.
   - **(b) the session simply lacks the permission** — then INLINE is the correct resting
     state, and the banner above is all that is owed to the user.
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

   **Detecting "ultracode ON" — without this the step is unusable.** The only authoritative
   signal is a `<system-reminder>` in the CURRENT turn's context saying ultracode is on for
   the session. **Absence of that reminder is UNDETERMINED, not OFF** — it may simply not have
   been surfaced in the turn where this gate runs, and resolving undetermined→OFF silently
   downgrades a session that had in fact opted in.
   - reminder says ON → **workflow**, no prompt (as above);
   - reminder says OFF → continue to step 4.5;
   - **no reminder either way → UNDETERMINED.** For the *entry conditions* of steps 4.5–6,
     undetermined counts as "not ON" and flows through exactly as OFF does — those steps and
     every consumer skill that restates their `ultracode OFF` condition stay correct as
     written. Two things change, and they are the whole point of naming the third state:
     1. **step 6's default flips** — attach "(Recommended)" to the skill's ultracode-target
        tier, NOT to the shallowest mode. An unobserved opt-in must never *default* to a
        downgrade; that is the behavioral difference, not the wording.
     2. the question text says the ultracode state could not be confirmed, and §Path
        Transparency records reason "you chose <mode> (ultracode undetermined)".
   Never report "ultracode OFF" as an observed fact when no reminder was seen.
4.5. **Project default** (no `--mode`, ultracode OFF) — the RESOLVED project-defaults line
   declares a `path` key: `path=workflow` → **workflow** at the skill's ultracode-target tier
   (same tier rule as step 4); `path=inline` → **inline**. No prompt — the `path` key IS a
   standing opt-in. Emit §Path Transparency with reason "project default (<source>)".
   **A resolved defaults line WITHOUT a `path` key is NOT a path signal — continue to steps
   5–6 (its other keys still apply to model-config/verifier resolution).**
   Sources & search order (settings.local.json env → project CLAUDE.md → user CLAUDE.md):
   `templates/_shared/project_defaults.md`.
5. `--no-prompt` flag **OR** the session cannot present an interactive prompt (headless / cron /
   subagent) → **inline** (existing auto-resolution). No prompt. **Default bias: auto-resolve
   UNLESS an interactive session is positively confirmed** — never block an automated run.
6. else (no `--mode` **AND** ultracode OFF **AND** no project-default `path` key **AND** engine available **AND** interactive) → **ASK**
   via AskUserQuestion (in `user_lang`):
   - header: "Path"
   - question: "No mode specified — choose how to run:"
   - options = the skill's modes, each mapping to inline/workflow per its §Mode Gate table.
     Append "(Recommended)" to the scope-advised tier for skills that print a scope advisory
     (deep-review, codebase-audit, migrate, refactor); otherwise to the shallowest (inline) mode.
     **Exception — ultracode UNDETERMINED (step 4):** recommend the skill's ultracode-target
     tier instead, so an unobserved opt-in does not default to a downgrade.
   On answer: set `mode` + `path_resolved`, then emit §Path Transparency.

This does NOT reintroduce effort gating. Opt-in signals (ultracode, `--mode`, the project
defaults line) still resolve
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
  - project default (step 4.5)            → "project default (<source>)" — settings.local.json / CLAUDE.md / ~/.claude/CLAUDE.md
  - engine/git unavailable (step 2)       → "Workflow engine unavailable"
  - no opt-in, resolved inline (step 5)   → "no opt-in — re-run with --mode <wf-tier> for workflow"
  - chosen via §Ambiguity Prompt (step 6) → "you chose <mode>"
  - step 6 with ultracode unobserved      → "you chose <mode> (ultracode undetermined)"

**One exception to the `<inline | workflow>` shape** — rule 3's permission-denial branch in an
interactive session has no resolved path yet (that is the point: nothing was downgraded), and
`path_resolved` has no third enum value to hold it. Print the whole line as:

    Path : (unresolved — Workflow denied; candidate causes reported, awaiting your choice)

The non-interactive branch of rule 3 DID resolve, so it uses the normal shape:
  - denied, auto-resolved inline (rule 3, non-interactive) → "Workflow denied — fell back to
    inline (automated run); cause not diagnosable"
