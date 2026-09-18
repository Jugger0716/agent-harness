# Architecture Principles — harness orchestrators (single source)

> The registry cited by name from `skills/harness/SKILL.md` §Architecture Principles,
> `skills/harness-gate/SKILL.md` and `skills/harness-build/SKILL.md` §Architecture Principles.
> Those files carry the six principle titles inline; the full text, including principle #1's
> exhaustive exception list, lives here and is read when a reader needs the exact wording.

Invariant constraints for the harness orchestrator skills.

1. **Orchestrator reads no intermediate files.** Exactly 7 read exceptions. Writes are a separate category and are not counted — the orchestrator WRITES spec.md / changes.md / slice_plan.md from returned objects, and `cold_review.md` on the WORKFLOW path from the segment's `coldFindings` (`skills/harness-build/SKILL.md` §Step 5; on the INLINE path the cold-review sub-agent writes it itself, `skills/harness-build/SKILL.md` §Step 6, AC-27):
   - (1) spec.md at the plan gate and at the After-Plan boundary (§Scale Assessment signal computation, including the INLINE fallback)
   - (2) qa_report.md at the verdict gate (INLINE path; WORKFLOW path on resume — verdict reconstruction)
   - (3) changes.md path extraction on WORKFLOW-path resume when `workflow_ctx` is null (repo-relative paths only, reasons stripped — the `changedFilesList` source priority of `skills/harness-build/SKILL.md` §Step 5)
   - (4) verify_report.md failing-file extraction for the Auto-fix Proposer (paths only, through Path Validator `kind=file_reference`, capped at 5 — the Auto-fix dispatch of `skills/harness-build/SKILL.md` §Step 5)
   - (5) Step 2's Discovery Notes Injection reads (`qa_notes.md` / `critic_findings.md` content passed to the planner)
   - (6) `plan_critic_findings.md` Summary parsing + the `.harness/planner/proposals.json` re-entry read
   - (7) gate-display critic count parsing (the carried-over `critic_findings.md`; the resume redisplay's `plan_critic_findings.md`) — distinct in purpose from (5)

   > Apply-before `--- a/` / `+++ b/` diff header lines (2 metadata lines per file; the hunk body is delegated to the Edit tool) are not a violation. Writing `proposals.json` as a direct serialization of the segment's return, and §Step 2.6's pre-dispatch delete of `plan_critic_findings.md` (on the same footing as the `.harness/` delete of `skills/harness-build/SKILL.md` §Step 8), are neither reads nor content writes and do not enlarge this list.

2. **The Auto-fix Proposer is the only orchestrator-dispatched sub-agent that directly reads SOURCE files** (segment-script agents explore the codebase themselves, inside the engine's autonomous span). Other inline sub-agents receive content only through template variables — with one narrower carve-out: an inline sub-agent MAY receive a `{docs_path}` artifact PATH the orchestrator explicitly hands it (e.g. `templates/spec/critic_inline.md`'s `{spec_path}`) and read that one file itself. `{docs_path}` artifacts are not source files, and #1's list stays at 7 (AC-27).

3. **Paths only to sub-agents; never file contents** — except ephemeral digests passed inside a segment run (they never enter the orchestrator's context beyond `workflow_ctx`), and `specContent` passed as a segment arg to `harness.build` (`skills/harness-build/SKILL.md` §Step 4 — WORKFLOW path), `harness.eval` (`skills/harness-build/SKILL.md` §Step 5 — WORKFLOW path) and `spec.eval` (§Step 2.6's WORKFLOW branch): size, not path-vs-content, is the actual constraint there. Within `harness.eval` the exception covers the Evaluator only; the cold reviewer receives a 1-line path pointer (from the `specPath` arg) on both paths.

4. **Session-wide invariants** (`skills/harness-build/SKILL.md` §State Machine — Auto-fix State Transition Table): Auto-fix at most 1 attempt per session (`verify.autofix_attempted` once-only, not reset on round increment); Layer 1 retries max 3, NOT reset after Auto-fix Apply.

5. **All external paths pass through Path Validator before use** (§Path Validator below).

6. **Gates never enter segment scripts.** The 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) are rendered by the orchestrator skills between segment runs; `scripts/verify_meta_literal.py` rejects the `<HARD-GATE>` tag form, `AskUserQuestion`, and the `Apply patch` option label inside any segment script — a marker tripwire, not a proof (the spaced prose form `HARD GATE #N` in script comments is allowed). The spec-confirm gate (`skills/harness-gate/SKILL.md` §Step 3) renders as up to two passes (A, B) inside ONE `<HARD-GATE>` tag; §Fast Gate is an orchestrator-side AskUserQuestion, not a fourth HARD-GATE and never inside a script. The count stays 3.
