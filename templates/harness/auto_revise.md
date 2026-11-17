# Auto-revise re-entry — `harness.plan` in re-synthesis form (single source)

> The re-entry procedure of `skills/harness/SKILL.md` §Step 2 — WORKFLOW path. Dispatched only
> from §Step 2.6, from `skills/harness-gate/SKILL.md` §Step 3 Pass A "Auto-revise", or from
> `/harness --auto-revise`. Read this file before dispatching one; the forward Plan flow in the
> skill body never needs it.

Re-runs `harness.plan.workflow.js` in re-synthesis form, skipping Propose. Pass the first dispatch's args (`templates/harness/plan_segment_call.md`) with these three changed:

| Arg | Value | Note |
|---|---|---|
| `reSynthesisOnly` | `true` | a REAL boolean — the string `"false"` is truthy and silently skips Propose; never stringify it |
| `priorProposals` | `JSON.parse()` of `.harness/planner/proposals.json` | passed only after the validity check below passes |
| `criticFindings` | the **CONTENT** of `{docs_path}plan_critic_findings.md` — read it only when `plan_critic.applied` is recorded AND `plan_critic.last_findings_path` is non-null AND the file exists (never a bare existence check) | a DIFFERENT document from the first dispatch's `criticFindings` (`{docs_path}critic_findings.md`, a critique placed in the directory before planning); both are file CONTENT under the same arg name — the script substitutes it into the synthesis prompt and never reads a path itself |
| everything else | as the first dispatch | |

Record `runs.plan` (overwriting the first dispatch's runId — one slot). Immediately before the re-render writes — this one, or item 10's inline fallback — take the snapshot copy of `templates/harness/converge.md` §Write Events (its step 1 alone; the re-render is not a write event). Re-render `{docs_path}spec.md` from the returned `plan` (the item 6 mapping) under the full `spec_stamp` write protocol; **do NOT rewrite `proposals.json`** on this `reSynthesisOnly: true` path (the segment returns `priorProposals` with only falsy elements filtered — a no-op rewrite at best). Re-freeze `state.scale.*` (item 8 — a re-entry is a fresh Step-2-shaped run, not the cross-session no-recompute case). Then immediately re-run §Step 2.6's own-critic dispatch in the SAME turn against the re-rendered spec.md — the same entry point Pass A's "Run Critic anyway" uses — with no user gate in between.

**Before dispatching**, run the proposals.json validity check (defined once, at `skills/harness-gate/SKILL.md` §Step 3's Auto-revise Exposure Predicate). If it fails on ANY point, dispatch a FULL re-run instead (`reSynthesisOnly: false`, no `priorProposals`), print (in `user_lang`) "[harness] ⚠ proposals.json invalid or unusable — re-running full Plan (Propose + Synthesize) instead of the low-cost re-synthesis.", and **overwrite `proposals.json`** per item 5 — Propose ran and produced new proposals. This is not an engine error and never downgrades the path.

**If the re-entry is interrupted** before the segment returns: `spec.md`, `proposals.json`, `spec_stamp` and `plan_critic.round` are all untouched (protocol step 1 fires only after the return), so the session resumes at the same gate and the Exposure Predicate re-evaluates against unmodified files. An engine error is NOT this case — item 10 owns it and DOES re-render spec.md on the inline path.
