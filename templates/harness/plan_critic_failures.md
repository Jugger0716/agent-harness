# Plan Critic failure branch (iii) — the eight `failure_reason` strings (single source)

> Taken by `skills/harness/SKILL.md` §Step 2.6 failure branch (iii) — for the round-1 critic and
> for every other failure of a converge run (`templates/harness/converge.md` §Ending a run maps
> each cause to its string). Read it when writing that branch's record. `skills/harness-gate/SKILL.md` §Step 3 Pass A row ④ (a separate session) and
> `skills/harness/SKILL.md` §Approval Gate's summary banner (an inline one) render the string it
> wrote, so a wrong value here is the difference between a user who can act and one who cannot.

**The write is the same single read-modify-write as every other Step 2.6 branch**, with all 7
`plan_critic` fields: `applied = "failed"`, `last_findings_path = null`, `source = "own"`,
`counts = null`, `spec_stamp_at_critic = null`, `round` UNCHANGED, and `failure_reason` from the
table below.

| `failure_reason` | Cause | What the user does |
|---|---|---|
| `"parse_failed"` | the INLINE 1-line return did not carry the expected keyword and counts | re-run the critic (`/harness --critic`) |
| `"findings_file_missing"` | latch point (a): no findings file after a dispatch that returned | re-run the critic |
| `"spec_stamp_invalid"` | the pre-dispatch stamp check, or latch point (b) — `spec_stamp` was `null` or malformed; or a converge write event (a round, decision or `--modify` apply) that failed after protocol step 1 (`templates/harness/converge.md` §Write Events) | `spec.md` is a partial write. Inline session: run `/harness` and Resume — it re-stamps the file and reviews it in full (`skills/harness/SKILL.md` §Session Recovery, item 3 of the `planning` / `plan_done` row); approval is refused until then. Separate session: finish it with `/harness --modify "<request>"`, or Restart via `/harness`. No gate option re-runs Step 2 |
| `"findings_file_stale"` | the pre-dispatch delete itself failed, so nothing was dispatched | resolve the permission or lock on `{docs_path}plan_critic_findings.md`, then re-run the critic |
| `"loop_dispatch_failed"` | a converge review or verify dispatch, or the round-1 INLINE critic dispatch, was refused or errored; or the delete of a per-round output file failed so it was never dispatched; or a write event's snapshot copy failed, so nothing was edited; or a tree-check `git status` was refused or errored; or a `.harness/converge/ledger.json` write failed | check the permission prompt or the error, then re-run the critic (a new run, full review); a `/harness --modify` that failed this way was not applied — re-issue it |
| `"loop_parse_failed"` | a converge review or verify 1-line return lacked its leading keyword and counts, or `.harness/converge/verdict.json` did not parse to its documented shape or failed the coverage check (`templates/harness/converge.md` §Round step 2 — a finding ID of the round missing from, or repeated in, its `sources`, or a `merged` entry naming no ledger item), or `.harness/converge/ledger.json` did not parse | re-run the critic (`/harness --critic`). If it fails again with this string, `.harness/converge/ledger.json` itself may not parse — the banner cannot say which file — so rename it (e.g. to `ledger.bad.json`) or delete it, then re-run: the run starts an empty ledger (`templates/harness/converge.md` §Starting a run item 2) with a full review, and a decision question already answered this session may be asked again |
| `"loop_output_missing"` | a converge review or verify dispatch returned but its output file under `.harness/converge/` is absent | re-run the critic |
| `"loop_tree_dirty"` | the `git status --porcelain` comparison around a loop dispatch found a change outside `.harness/` and that dispatch's own output — the paths are printed with the banner, and nothing was reverted | inspect those paths and keep or revert them yourself, then re-run the critic |

Eight strings, some covering several causes: this field is all row ④'s banner has to tell the
user which one happened. `"spec_stamp_invalid"` is written by three sites — the pre-dispatch stamp check,
latch point (b), and a converge write event that failed after invalidating the stamp — and does
not tell them apart, which is acceptable only because the recovery is identical for all three.

**`spec_stamp_at_critic` is set to `null`, never left at its previous value** — unlike `round` on
the same line. A stamp left over from an earlier pass could coincidentally equal the current
`spec_stamp` and turn a failed critic into a not-stale verdict, which is the one outcome this
branch must never produce.

**Known gap.** Leaving `round` UNCHANGED means a failed re-critic dispatched right after an
Auto-revise re-entry does not consume the single increment a successful one would, so the
Auto-revise Exposure Predicate's point 3 can still hold on a later "Retry Critic". Recorded, not
closed. Correction (2026-10-02, converge loop S1): this gap no longer opens — "Retry Critic"
starts a converge run, whose run-end mapping writes `round = 1` (closing point 3) and whose
failure lands on row ④, which offers no Auto-revise.

**Known gap — a run that fails after applying.** A converge run can fail in a round after an
earlier round of the same run already applied `auto` corrections to `spec.md`. Those edits stay
(the loop never reverts), and no later round reviewed them — the banner's "spec unreviewed" is
literally true of them. The next run (`/harness --critic`, "Retry Critic" at the gate, or the
run after a `/harness --modify` — a failed session's Modify run starts with a full review too,
`templates/harness/converge.md` §Starting a run) starts with a full review, which is what covers
them; nothing covers them before that. `loop_tree_dirty` likewise reverts nothing outside the
spec, and it fires only on what `git status --porcelain` can show: a further edit to a file
already modified or untracked before the dispatch, or a change under an ignored path, passes
unseen — and that covers `.harness/state.json`, `.harness/converge/` and, whenever it is
untracked or gitignored, `{docs_path}spec.md` itself (`templates/harness/converge.md` §Round,
Tree check). Recorded, not closed.
