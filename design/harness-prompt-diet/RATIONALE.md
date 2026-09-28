# /harness prompt diet — rationale preserved out of the skill body

> The v8.14 prompt diet moved reasoning OUT of `skills/harness/SKILL.md` so that the skill body
> carries execution rules only. **Nothing in this file is a rule.** Every rule still lives in the
> skill, or in the `templates/_shared/` single source the skill cites. This file exists so the
> argument behind three counter-intuitive orderings is not lost, and so a future change that wants
> to "simplify" one of them meets that argument first.
>
> Committed on purpose: `docs/` is gitignored in this repository, and a record another session must
> act on does not belong there.

## §spec_stamp ordering

`spec.md` is a file and `spec_stamp` is a state.json field, so "write both at once" does not exist —
one of them is second. If the stamp were second and the session died between the file write and the
stamp write, the stamp would still describe the PREVIOUS spec.md while the file on disk is new, and
`skills/harness-gate/SKILL.md` §Stale Determination would read that as **not stale**, exposing
Auto-revise against a spec the critic never saw.

Invalidating first makes that same window resolve to `null`, which that determination treats as
stale — it fails closed. The mtime mechanism this replaced had no such window at all: the filesystem
updated the stamp as a side effect of the write itself. So the ordering rule is not a refinement of
the replacement, it is the repair for a window the replacement introduced.

## §Plan Critic crash windows

**Why the pre-dispatch delete exists.** `{docs_path}plan_critic_findings.md` has a fixed path that
every pass reuses, so without deleting it first a leftover from an earlier pass is
indistinguishable from a file this pass wrote. The routing predicate already names bare
file-existence as a trap for exactly that reason; the delete is what lets the latch conclude
anything from existence at all.

**The window it opens.** If the delete succeeds and the dispatch is then interrupted, the previous
pass's `plan_critic` record survives while the file its `last_findings_path` names does not. That
record is **malformed** by `skills/harness-gate/SKILL.md` §Well-formedness Determination, so the
gate renders Pass A **row ④**, whose "Retry Critic" re-runs the same dispatch. Before the delete
existed, the old file survived such an interrupt, the record stayed well-formed, and the same resume
landed on row ①-b instead. Both rows recover by re-running the critic — the row is what changed, not
the recovery.

**Interruption of the same-turn re-critic.** When the re-critic dispatched from an Auto-revise
re-entry is itself interrupted before its write completes, resume lands on row ④ for the same
reason. The staleness the stamps would have shown is still real — the re-entry advanced
`spec_stamp.generation` past the recorded `spec_stamp_at_critic`, or left `spec_stamp` at `null` —
but row ④ is evaluated first, so that axis is never reached. Choosing "Run Critic anyway" there
re-charges one critic dispatch, which is idempotent.

**Why no `runs` slot.** `state.runs` has exactly `{plan, build, eval}` — there is no reserved fourth
slot. Recording Step 2.6's WORKFLOW run id under `runs.eval` would silently clobber the record
`skills/harness-build/SKILL.md` §Step 5 writes, so it is not persisted at all. A known and accepted
gap, not an oversight.

## §Branch collision

A non-empty `harness/<slug>` carries a real prior slice or attempt. Silent reuse mixes that slice's
changes into this session's diff, which contaminates Layer 2/3 judgment and the scope of any later
`/deep-review`. The suffix route always yields a fresh branch and therefore needs no confirmation;
the confirmation route exists only so that a user who knows the prior commits are wanted can say so.

## §What the diet moved, and where

Every row is a move, not a deletion. The skill cites each destination by name.

| Was inline in `skills/harness/SKILL.md` | Now |
|---|---|
| Preserved-English Glossary table, user-language detection, 1-line return translation | `templates/_shared/output_language.md` |
| Sub-agent return rules, version compatibility, environment detection | `templates/_shared/orchestrator_contract.md` |
| Session Recovery items 1–7 (shared verbatim with `/harness-build`) | `templates/_shared/session_recovery.md` |
| run_style table, the full CLI surface, step-mode prerequisites | `templates/_shared/run_style.md` |
| Session Boundary block shape, `/handoff generate` field contract | `templates/_shared/session_boundary.md` |
| Scale Assessment render fragment | `templates/_shared/scale_assessment.md` |
| Path Validator algorithm and attack-vector table | `templates/_shared/path_validator.md` |
| Architecture Principles full text | `templates/_shared/architecture_principles.md` |
| Harness phase labels · role map | `templates/_shared/status_format.md` · `templates/_shared/model_config.md` |
| state.json v3 literal and additive-field defaults | `templates/harness/state_schema.md` |
| Additive-field writer/reader map | `workflows/_reference/state_fields.md` |
| `doctor`'s six-item procedure | `templates/harness/doctor.md` |
| Auto-revise re-entry procedure | `templates/harness/auto_revise.md` |
| Setup Summary output block | `templates/harness/setup_summary.md` |
| spec.md render mapping (PlanResult → headings) | `templates/harness/spec_render.md` |

## §What the diet deliberately did NOT move

These stayed inline because a missed read would change behaviour silently, not merely cost a turn:

- the §Mode Gate resolution table and its graceful-fallback / denial branches;
- §Session Recovery's doctor carve-out, positional-argument rule and phase jump table;
- the whole of Steps 1, 1.5, 2, 2.6 as a flow, including the `spec_stamp` write protocol's three
  ordered steps and Step 2.6's routing predicate, latch and three failure branches;
- §Fast Gate, in full — it is the gate;
- §Key Rules.

The Fast Gate claim above was measured end to end: `--fast` writes the skip reason once, and it
renders at Setup, at `skills/harness-build/SKILL.md` §Step 7 and in that file's Step 8 Type B
block (`PROBE.md`, fourth probe).
