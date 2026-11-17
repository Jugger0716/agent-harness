# Slugify — task string → `<slug>` (single source)

> Cited by name from `skills/harness/SKILL.md` §Step 1 item 3. A later `/harness` run for the same
> task must derive the same `docs/harness/<slug>/` (§Step 1.5's Persisted Spec Artifacts Check
> rests on that), so the rule is defined here once. Other skills' slugs never cross a skill
> boundary and keep their own inline rules.

## Rule

Apply to the task string, in order:

1. Lowercase.
2. **Drop every non-ASCII character.** Never transliterate: romanizing a Korean (or any
   non-Latin) task is not reproducible across sessions or models, and on the 2026-09-18 live
   probe it produced `scriptsverify_sync_markerspy-modyul-docstringui-wh` as a branch name
   (`design/harness-prompt-diet/PROBE.md` finding 1).
3. Treat `/`, `\`, `.`, `_` and every run of whitespace as a separator → `-`. Path-like tokens
   therefore survive as readable words: `scripts/verify_sync_markers.py` →
   `scripts-verify-sync-markers-py`.
4. Drop every remaining character outside `[a-z0-9-]`.
5. Collapse runs of `-` to one; trim leading and trailing `-`.
6. Truncate to 50 characters, then trim a trailing `-` again.
7. **Empty result** (the task carries no ASCII letter or digit at all) → `task-<YYYYMMDD-HHMM>`
   (local time at Setup) and print, in `user_lang`, `[harness] Slug: the task has no ASCII word
   — using <slug>`.

Worked example — the probe's own task, `scripts/verify_sync_markers.py 모듈 docstring의 '§What
this does not check' 항목 1·3의 수치를 …` → `scripts-verify-sync-markers-py-docstring-what-this`.

## What this rule does not do

- It never asks. A slug question under `--fast` would add back the roundtrip `--fast` exists to
  remove; a task that wants a specific name says it in ASCII.
- It does not guarantee uniqueness. `skills/harness/SKILL.md` §Step 1 item 8's branch-collision
  rule owns that.
- It does not relax the reserved-name rule. The slug is the last segment of `docs_path`, so
  `templates/_shared/safety_guard.md` step 3 (not `memory`, no `..`, no `/`) applies to it as
  before.
