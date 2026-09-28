# Plan Critic failure branch (iii) — the four `failure_reason` strings (single source)

> Taken by `skills/harness/SKILL.md` §Step 2.6 failure branch (iii). Read it when writing that
> branch's record. `skills/harness-gate/SKILL.md` §Step 3 Pass A row ④ renders the string it
> wrote, so a wrong value here is the difference between a user who can act and one who cannot.

**The write is the same single read-modify-write as every other Step 2.6 branch**, with all 7
`plan_critic` fields: `applied = "failed"`, `last_findings_path = null`, `source = "own"`,
`counts = null`, `spec_stamp_at_critic = null`, `round` UNCHANGED, and `failure_reason` from the
table below.

| `failure_reason` | Cause | What the user does |
|---|---|---|
| `"parse_failed"` | the INLINE 1-line return did not carry the expected keyword and counts | re-run the critic (`/harness --critic`) |
| `"findings_file_missing"` | latch point (a): no findings file after a dispatch that returned | re-run the critic |
| `"spec_stamp_invalid"` | the pre-dispatch stamp check, or latch point (b) — `spec_stamp` was `null` or malformed | `spec.md` is a partial write: finish it with `/harness --modify "<request>"`, or Restart via `/harness`. No gate option re-runs Step 2 |
| `"findings_file_stale"` | the pre-dispatch delete itself failed, so nothing was dispatched | resolve the permission or lock on `{docs_path}plan_critic_findings.md`, then re-run the critic |

Four causes, four strings: this field is all row ④'s banner has to tell the user which one
happened. `"spec_stamp_invalid"` is written by two sites and does not tell them apart, which is
acceptable only because the recovery is identical for both.

**`spec_stamp_at_critic` is set to `null`, never left at its previous value** — unlike `round` on
the same line. A stamp left over from an earlier pass could coincidentally equal the current
`spec_stamp` and turn a failed critic into a not-stale verdict, which is the one outcome this
branch must never produce.

**Known gap.** Leaving `round` UNCHANGED means a failed re-critic dispatched right after an
Auto-revise re-entry does not consume the single increment a successful one would, so the
Auto-revise Exposure Predicate's point 3 can still hold on a later "Retry Critic". Recorded, not
closed.
