# Releasing

A checklist, not a tool. Until v9 a release skill drove these steps; v9 removed it, and the
steps are few enough to run by hand. Steps marked **confirm** change something outside this
working tree or cannot be undone — get the maintainer's explicit go-ahead for each one, every
time. An earlier go-ahead does not carry over. Pushing the release branch (steps 7 and 10) is
the one outside change that is not marked.

## Before the version commit

1. **Lint chain and tests pass.** Run the `agent-harness-defaults: lint-cmd=` line in
   `CLAUDE.md`, then `node tests/segment_stubs/run.mjs` and `node tests/handoff/run.mjs`
   (about two minutes on Windows). All three exit `0`.
2. **Nothing names a removed path.** `python scripts/verify_cited_paths.py` exits `0` (it is part
   of the chain; this line is here because a release is when a removal lands).
3. **CHANGELOG.** Move the `[Unreleased]` content under a `## [X.Y.Z] — YYYY-MM-DD` heading and
   leave an empty `[Unreleased]` above it. The date is the day the tag is made (step 12), not
   the day of the version commit — set it last if the two differ. A breaking release carries a migration table: what
   was removed, what to use instead.
4. **Version, at all three key paths.** `.claude-plugin/plugin.json` `$.version`,
   `.claude-plugin/marketplace.json` `$.metadata.version`, and
   `.claude-plugin/marketplace.json` `$.plugins[*].version`. `python scripts/verify_manifest_sync.py`
   exits `0` only when all three agree.
5. **Manifest description and keywords** still describe the skills that ship.
6. **Measurements.** If the release belongs to an epic with a `design/<epic>/BASELINE.md`,
   re-measure and append the new figures. Sizes come from `git ls-tree -r -l <commit>`, never from
   the working tree.
7. **Commit** as `chore(release): vX.Y.Z` and push the release branch.

## Verify the release candidate in a real session

8. **confirm — Replace both installed copies** with the release branch
   (`~/.claude/plugins/marketplaces/agent-harness-marketplace/` and
   `~/.claude/plugins/cache/agent-harness-marketplace/agent-harness/<version>/`) and restart
   the Claude Code process. `/clear` is not enough: the skill bodies are already in memory.
9. **The skill listing** shows the shipped skills with their full descriptions and the new
   version. `/harness doctor` reports `✓` for install drift.
10. **One real run of each changed path.** At least: `/harness` on a small, easily reverted task
    through plan, plan critic, approval, build and evaluation; `/handoff generate` and
    `/handoff resume`. Record what was observed next to the measurements of step 6, then commit
    that record to the release branch and push it — the merge of step 11 carries it, so the tag
    sits on a tree that includes what was verified.

## Publish

11. **confirm — Merge** the release branch into `main` with `--no-ff`.
12. **confirm — Tag** `vX.Y.Z` on the merge commit.
13. **confirm — Push** `main` and the tag.
14. **confirm — GitHub release** for the tag, with the CHANGELOG section as its notes.
15. **confirm — Bring `develop` up to date** with `main` and push it.

## If a step fails

Stop at that step. Do not skip ahead, and do not tag a commit whose lint chain or stub tests are
red. A failed real-session check (steps 8–10) sends the work back to the branch, not forward to
the tag.

The one way past a failed step is a named exception: the maintainer accepts it explicitly, and
it is recorded next to the measurements of step 6 together with what will close it.
