<!-- managed by md-generate -->
# CLAUDE.md

## Project Overview

agent-harness is a **Claude Code plugin repository**, not an application. It ships 6 skills whose
primary artifact is a contract document (`skills/<name>/SKILL.md`), plus the prompt templates,
native Workflow segment scripts, and self-consistency lints those contracts depend on. There is no
application source, and the only behavioural tests are the segment stub tests under
`tests/segment_stubs/` and the `/handoff` helper-script tests under `tests/handoff/` — the
contracts *are* the code, and a wrong sentence is a defect.

## Tech Stack

| Category | Technology | Notes |
|---|---|---|
| Contract docs | Markdown | `skills/*/SKILL.md` — the primary artifact |
| Prompt templates | Markdown | `templates/` |
| Workflow segments | JavaScript, engine-hosted | `workflows/*.workflow.js`; only `export const meta` is allowed as module syntax |
| Lint | Python 3, stdlib only (`pathlib`, `re`, `hashlib`, `argparse`) | `scripts/*.py` |
| Syntax check | Node.js | `scripts/check_workflow_syntax.mjs` |
| Manifest | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | version lives at **3 key paths** — see Important Notes |

## Commands

| Action | Command |
|---|---|
| Marker sync + section-ref lint | `python scripts/verify_sync_markers.py` |
| Manifest sync lint | `python scripts/verify_manifest_sync.py` |
| Workflow meta lint | `python scripts/verify_meta_literal.py` |
| Block sync lint (SHA256) | `python scripts/verify_block_sync.py` |
| Workflow syntax + CR guard | `node scripts/check_workflow_syntax.mjs` |
| Description budget ratchet | `python scripts/verify_description_budget.py` |
| Destructive git command ban | `python scripts/verify_git_safety.py` |
| Cited path existence | `python scripts/verify_cited_paths.py` |
| Skill body budget ratchet | `python scripts/verify_body_budget.py` |
| Lint wiring equality | `bash .github/scripts/check_lint_wiring.sh` |
| Segment stub tests | `node tests/segment_stubs/run.mjs` |
| Handoff script tests | `node tests/handoff/run.mjs` |

The same chain is declared once, below, as this repository's project default so a `/harness`
session runs it as Layer 1 without a `--lint-cmd` flag (`templates/_shared/project_defaults.md`;
the line must start at column 0 and not sit inside a code fence, which is why it is bare prose
here). The `export` covers the cp949 console: `verify_sync_markers.py` prints `§` and dies with
`UnicodeEncodeError` without it.

agent-harness-defaults: lint-cmd=`export PYTHONIOENCODING=utf-8 && python scripts/verify_sync_markers.py && python scripts/verify_manifest_sync.py && python scripts/verify_meta_literal.py && python scripts/verify_block_sync.py && node scripts/check_workflow_syntax.mjs && python scripts/verify_description_budget.py && python scripts/verify_git_safety.py && python scripts/verify_cited_paths.py && python scripts/verify_body_budget.py && bash .github/scripts/check_lint_wiring.sh`

Run the whole chain after changing anything under `skills/`, `templates/`, `workflows/`, `scripts/`, or
`.claude-plugin/`. Re-run `check_lint_wiring.sh` as well whenever `.github/workflows/lint.yml`
changes or a file matching `scripts/verify_*.py` or `scripts/*.mjs` is added or removed.

They also run on every push and pull request via `.github/workflows/lint.yml`; `.github/` holds that
workflow, the wiring check under `.github/scripts/`, and the issue and PR templates. The Python
scripts' docstrings state `run manually and on push/PR via .github/workflows/lint.yml (pre-commit
hook wiring is still a later-phase TODO)` — a pre-commit hook is still not wired.

Exit codes: `0` pass, `1` violation found, `2` structural problem. One exception worth knowing:
in `verify_sync_markers.py` a **missing target file is `1`**, and `2` means a declared SYNC group's
marker was found **nowhere** (the single source lost all its sync sites).

There is no build, dev, or deploy command. The test commands are the two runners in the table
above: the segment stub runner and `node tests/handoff/run.mjs`. Neither is part of the `lint-cmd`
chain; run the first as well after changing anything under `workflows/` and the second after
changing anything under `skills/handoff/` or `templates/handoff/`. Both run in the same CI workflow.

## Architecture

| Path | Role |
|---|---|
| `skills/<name>/SKILL.md` | one skill = one directory = one contract file |
| `skills/harness{,-gate,-build}/SKILL.md` | one contract split three ways (C5, 2026-09-07): `/harness` owns Steps 1–2.6 (the Step 2.6 converge loop included) plus §Approval Gate — HARD GATE #1 rendered in-session, the default for every new session since harness-converge S2, which chains into `/harness-build` (`--fast` is its three-option variant; §Fast Gate is now a pointer) — `/harness-gate` owns Step 3 with no `Bash`/`Write`/`Edit`/`Glob` and gates only a `--separate-gate` session, `/harness-build` owns Steps 3.5–8 and, since harness-converge S3, §Epic Slice Chain — an epic's slices chained in one turn, each still approved at its own §Approval Gate, a clean end committed without asking. Since the v8.14 prompt diet most of what they shared lives in `templates/_shared/` single sources they cite by name; only four `hx-*` BLOCK groups remain byte-identical (`verify_block_sync.py`), for text that must stay inline. §Architecture Principles #3·#5·#6 and §User Interaction Rules are duplicated WITHOUT a sync group — disclosed here, to be blocked the day they drift |
| `skills/handoff/scripts/` | the `/handoff` helper — `handoff.mjs` (one JSON object per sub-command) and its `lib/` modules; a Node script the skill runs instead of describing the procedure in prose; on failure the skill reports the error and stops, with no prose fallback |
| `templates/_shared/` | cross-skill single sources (`mode_gate.md`, `status_format.md`, `project_defaults.md`, `session_conflict.md`, `orchestrator_contract.md`, `output_language.md`, `session_recovery.md`, `session_boundary.md`, `run_style.md`, `scale_assessment.md`, `path_validator.md`, `architecture_principles.md`, `slugify.md`, `segment_launch.md`, ...) |
| `templates/harness/` | `/harness`-only procedures and static payloads read on demand (`doctor.md`, `state_schema.md`, `setup_summary.md`, `setup_prompts.md`, `auto_revise.md`, `spec_render.md`, `plan_segment_call.md`, `plan_critic_dispatch.md`, `plan_critic_failures.md`, and — since harness-converge S1 — `converge.md`, the Step 2.6 converge loop's single source, with its two sub-agent templates `converge_review.md` and `converge_verify.md`) — the v8.14 prompt diet's destination for everything that is not an execution rule |
| `templates/<skill>/` | skill-specific prompt templates |
| `templates/planner/` | `/harness` planner templates; four of them carry the BLOCK groups `verify_block_sync.py` compares against `templates/_shared/` |
| `templates/{generator,verify,evaluator}/` | `/harness` only, despite the role-based naming |
| `workflows/<skill>.<segment>.workflow.js` | native Workflow segment; the naming pattern is fixed |
| `workflows/_reference/` | reference documents (`schemas.md`, `state_fields.md`), not scripts |
| `scripts/` | the 9 self-consistency lints |
| `tests/segment_stubs/` | behavioural tests for the Workflow segments — `engine.mjs` (stand-ins for the engine globals, with the assumptions it encodes in its header), `cases.mjs`, `run.mjs`, and `known_failures.json`, a two-way ratchet: an unlisted failure fails the run, and so does a listed case that starts passing |
| `tests/handoff/` | behavioural tests for the `/handoff` helper scripts — `cases.mjs`, `run.mjs`, `mkrepo.mjs` (throwaway git repositories), invented `fixtures/` and the test-side `corpus/` tools; `cases.mjs` also asserts on the text of the `/handoff` contract files |
| `docs/` | gitignored runtime output of the skills |
| `design/<epic>/` | committed design records for follow-up epics — spec plus the measurement evidence it rests on. Outside `SCAN_DIRS`, so no lint reads them; that is why a forward-looking `§Step` citation here does not turn a lint red |
| `README.md` | about 780 lines including `### Repository Layout`; keep it in sync when a skill's surface changes |

**Mode Gate** — every multi-path skill follows `templates/_shared/mode_gate.md`: the INLINE path is
the default, and the native Workflow path runs only on opt-in (ultracode ON, an explicit
`--mode standard/multi/...`, or an `agent-harness-defaults: path=workflow` project line).
`has_git == false` or an engine failure falls back to INLINE, never a hard error. This is the
repository's largest cross-file contract; `verify_sync_markers.py` enforces it through the
`ambiguity-prompt` (`min_sites=2`) and `project-defaults` (`min_sites=2`) groups — two sites each
since v9 removed the other multi-path skills.

Skills dispatch their segments as `${CLAUDE_PLUGIN_ROOT}/workflows/<skill>.<segment>.workflow.js`,
the plugin-root file — but they LAUNCH it from a copy at `.harness/wf/<skill>.<segment>.workflow.js`
(`templates/_shared/segment_launch.md`): the `Workflow` tool accepts a `scriptPath` only when it
returned that path itself or the file sits under the working directory (or an added directory),
and the plugin-root path was refused on the only recorded attempt (2026-09-18; earlier
successful runs are recorded by `runId` without their launch path). Never write a
repository-relative `workflows/…` path at a dispatch site — that only works in this checkout.

Every `SKILL.md` carries YAML frontmatter with `name`, `description`, and `disallowed-tools`. That
frontmatter is the plugin's exposure contract, so treat it as part of the skill's surface.

## Conventions

### Documents

- Cite by `§Section Name`, never by absolute line number. Line citations have rotted twice here.
- Keep single sources in `templates/_shared/`. Cite one by name; never restate its body.
- Mark a cross-file field contract with `<!-- SYNC-WITH: <file> §<section> -->` and register the
  group in `verify_sync_markers.py`.
- Wrap byte-identical shared blocks in `<!-- BLOCK-START:<tag> <version> -->` /
  `<!-- BLOCK-END:<tag> <version> -->`.
- Correct a stale ROADMAP or CHANGELOG claim by appending the correction **inside the existing
  row**. Never delete it silently.
- Keep Preserved-English Glossary tokens (`PASS`, `FAIL`, `Verdict`, `[harness]`, ...) in English;
  render other user-facing text in the session's `user_lang`.

### Workflow scripts

- Begin with `export const meta = {...}` as a **pure literal** — no calls, spreads, template
  literals, or bare identifiers. `phases` must be an array of **object literals each carrying a
  `title:` string**; a bare array of strings fails the lint.
- Parse args defensively: `const A = typeof args === 'string' ? JSON.parse(args) : (args || {})`.
- Name a whole prompt `TPL_*` and a reusable fragment spliced into several prompts `FRAG_*`.
  Declare schemas per script — each script is self-contained (C1): no shared imports, no runtime
  template reads.
- Substitute only through `render()`, the single-pass implementation in the `wf-prelude` block
  every script carries: it splits the template on its `{snake_case}` tokens once, so a value that
  contains a placeholder is never scanned again and key order carries no meaning. Never write a
  substitution of your own, and never `String.replace` — a payload containing a `$` substitution
  pattern would corrupt the result. The same block holds `requireArgs()` and `must()`; edit all
  five copies in one commit and bump the block version.
- Never use `Date.now`, `new Date`, or `Math.random`; they break cached-prefix resume.
- Never write `AskUserQuestion`, `HARD-GATE`, or the apply-patch option label into a script. Gates
  belong to SKILL.md only.
- Keep these files LF. A CRLF workflow script is rejected by the permission layer and cannot launch.

### Git

- Branch as `harness/<slug>` (or `feature/<name>`); base is `develop`, releases merge to `main` (checklist: `RELEASING.md`).
- Write Conventional Commits with a skill scope: `feat(harness): ...`, `fix(handoff,docs): ...`,
  `chore(release): ...`.
- Every recent merge is a merge commit. No `merge.ff` config enforces this — it is convention, so
  pass `--no-ff` deliberately.

## Verification

The nine lints under `scripts/`, plus `.github/scripts/check_lint_wiring.sh` and the CI wiring
in `.github/workflows/lint.yml`, are the entire **static** verification layer. The behavioural
layer is two separate suites, neither part of the `lint-cmd` chain: the segment stub tests under
`tests/segment_stubs/` cover the Workflow segments only, and the tests under `tests/handoff/` cover
the `/handoff` helper scripts (and assert on the text of the `/handoff` contract files):

- `verify_sync_markers.py` — SYNC group referential integrity, `min_sites` occurrence floor, and
  token consistency; **plus** a section-reference check over `SECTION_REF_TARGETS`, which now
  holds **three files under one mode** (a second mode, `anchor-heading`, lost its only target
  when v9 removed the study-measurements reference file; its code remains, unused):
  mode `harness-steps` (`skills/harness/SKILL.md`, `skills/harness-gate/SKILL.md`,
  `skills/harness-build/SKILL.md` — one entry each since C5) exists because those files have
  **zero** `## §Name` headings, so the anchor rule cannot apply — six layers instead check the
  `§Step N(.N)` citation family and the path-anchored cross-file pointers against zero-slack
  structural pins carried **on each entry** (`step_ids` / `subpaths` / `files` /
  `min_cross_files` / `non_heading_anchors`; `non_heading_anchors` is empty for all three since v9 — its one entry was cited only
  from a removed skill). A `§Step` citation that
  points at another of the three files must carry that file's path anchor — a bare `§Step 4` in
  `skills/harness/SKILL.md` is judged against harness's own ids and fails. Renaming a heading
  breaks the lint **only for some renames** — it checks Step numbers, not section titles. **Just under
  half its in-file citations are deliberately unchecked**, and the scan never reaches the
  repository's root documents at all — the script's own `§What this does not check` docstring
  carries all seven limits with the command that produces each figure. Correction (dated, deliberate
  exception to the "read the docstring" rule below — do not treat this as license to copy other
  numbers here): the "just under half" sentence above has been false for harness and harness-gate
  since the 2026-09-07 C5 re-measurement, not merely since the latest one; the RE-MEASURED
  2026-09-18 line of that docstring's item 1 supplied the shares as of that date — harness 86/102 (84%),
  harness-gate 81/81 (100%), harness-build 86/176 (49%), so "just under half" is now approximate
  only for harness-build, which itself read 113/204 (55%) on 2026-09-07. Correction 2026-10-02:
  harness-converge S1–S3 grew all three files; the docstring's latest RE-MEASURED line supplies
  the current shares, and "just under half" now holds for none of the three. Only one figure is restated
  by an OK line; read the docstring rather than copying a number into this file.
  It is a marker-and-token check, **not** a
  semantic diff: it proves tokens coexist, not that the surrounding prose still agrees.
  Add a group by appending to `SYNC_GROUPS`. `min_sites` is pinned to the **measured count with
  zero slack**, so adding a marker site means raising the floor in the same change, and removing
  one fails immediately.
- `verify_meta_literal.py` — `meta` literal purity, module-syntax ban, nondeterministic-API ban,
  gate-token tripwire, the defensive-args guard, a `meta.description` that starts
  `INTERNAL — launched by /` (segments are listed beside the skills but are never picked from
  that listing), and a `requireArgs('<meta.name>', A, [...])` call placed before the first
  `phase(...)` statement. It checks that the call exists and comes first, not that its keys are
  the right ones — the stub tests do that.
- `verify_block_sync.py` — SHA256 comparison of BLOCK-delimited content. `GROUPS` declares
  `(tag, version, files, shared_source)`. The v8.14 prompt diet cut the `hx-*` groups from 16 to
  4 by PROMOTING the rest to `templates/_shared/` single sources — one copy, nothing to compare,
  which is strictly stronger than byte-identity. A promotion is also the one sanctioned reason a
  `min_sites` floor in `verify_sync_markers.py` may be LOWERED; two were, in that change.
  A seventh group, `wf-prelude`, covers the five `workflows/*.workflow.js` scripts instead of
  Markdown: its markers sit inside a JS line comment, and it has no shared source because a
  script may not import one (C1).
- `verify_manifest_sync.py` — `.claude-plugin/plugin.json` and `marketplace.json`: the plugin
  description, the keywords set, and the version string at all three key paths.
  `metadata.description` and `owner` are marketplace-only, and `author` is carried by both files
  but not compared; the script's docstring records each exclusion with its reason, because JSON
  cannot carry a comment.
- `verify_description_budget.py` — per-skill description caps, per-skill and total ceilings
  (a ratchet: lowering is free, raising needs an explicit ceiling raise in the same commit),
  lower bounds (a length guard only; the current entries and their reasons are in the script's
  comments — the v8.12 batch's bounds were deleted in v9 together with their skills),
  required/forbidden token lists (the mechanism remains but both are empty since v9, because the
  only skill that had entries was deleted), frontmatter structure, and a third-person check with a zero-slack allowlist. The measurement
  basis is fixed in its docstring before any total: quotes removed, `\r` excluded, UTF-8
  characters. It exists because Claude Code caps the skill listing at a share of the context
  window and, when that overflows, drops the descriptions of least-used skills while keeping
  every name — a failure with no message to the user.
- `verify_git_safety.py` — forbids `git checkout -- ` / `git checkout .`, a worktree `git restore`,
  `git stash` (bare, `push`, `drop`), `reset … --hard` and `clean -f` / `--force` in `skills/`,
  `templates/` and `workflows/`: text a model follows must not tell it to
  discard or move uncommitted work. It reads text, not intent, so a sentence that only warns about
  one of them goes in its zero-slack `ALLOW` table with the reason. Two destructive forms passed
  it in 9.0.0 (`git checkout <ref> -- <path>`, `git restore --staged --worktree <path>`), and so
  did any of these commands with `-C <path>` between `git` and the subcommand. Since 9.0.1 all
  of them are matched, together with a forced `checkout` / `switch` (`-f`, `--force`,
  `--discard-changes`); the docstring keeps the correction beside the old claim.
- `verify_cited_paths.py` — every `skills/…`, `templates/…`, `workflows/…` or `scripts/…` file path
  cited from `skills/`, `templates/`, `workflows/`, `CLAUDE.md` or `README.md` must exist. It was
  added with the v9 removal of thirteen skills. Placeholder paths (`templates/<skill>/…`), directory
  citations and paths under `docs/`, `design/` or `tests/` are outside it — its docstring lists the
  limits.
- `verify_body_budget.py` — per-skill `SKILL.md` body ceilings, three named `/handoff` loads
  (`generate`, `generate+ledger`, `resume`) with a hard SPEC cap on `generate` that a ceiling raise
  cannot buy, and a ban on dated measurement markers and planning tags in the `/handoff` contract
  files. Ceilings are measured sizes with zero slack (lowering is free, raising needs an explicit
  raise in the same commit); the measurement basis and figures are in its docstring, not copied here.
- `check_workflow_syntax.mjs` — compiles each script through `AsyncFunction` because `node --check`
  false-greens on ESM `export`, then guards CR in both the working tree and the index blob.
- `.github/scripts/check_lint_wiring.sh` — compares the lint scripts that exist against the ones
  `.github/workflows/lint.yml` actually runs, by NAME SET rather than by count. It lives outside
  `scripts/` so it neither matches the glob it counts nor counts itself.

## Important Notes

- `.gitignore` covers `docs/`, `.harness/`, `.claude/`, `.venv/`, `__pycache__/`, `*.pyc`, `.env`,
  and `.idea/`. When citing a `docs/` path from a committed document, mark it
  `(gitignored — not a public link)`. A document that must SURVIVE — a design spec, a measurement
  record another session will act on — does not belong under `docs/` at all: put it in
  `design/<epic>/`, which is committed.
- `.harness/` is a live session directory holding `state.json`. Do not hand-edit it while a skill
  session is running.
- The plugin is installed in **two** places — `~/.claude/plugins/marketplaces/agent-harness-marketplace/`
  and `~/.claude/plugins/cache/agent-harness-marketplace/agent-harness/<version>/`, the latter
  keeping older versions alongside the current one. Editing a file here updates neither copy: to
  make a SKILL.md change take effect, re-sync both installs and restart the process (a `/clear` is
  not enough — the skill body is already resident in process memory).
- The version string lives at **3 key paths**: `plugin.json` `$.version`, `marketplace.json`
  `$.metadata.version`, and `marketplace.json` `$.plugins[*].version`. A bump that edits only the
  first two is incomplete.
- The pipeline's 3 HARD-GATEs stay in the orchestrator SKILL.md files, never in a segment script:
  #1 (spec-confirm) renders at `skills/harness/SKILL.md` §Approval Gate (every variant) in an
  inline session — the default — and as the whole of `skills/harness-gate/SKILL.md` in a separate
  one (`--separate-gate` or `gate=separate`); #2 (verify-fail) and #3 (auto-fix-apply) are in
  `skills/harness-build/SKILL.md`; `verify_meta_literal.py` rejects gate tokens inside segment
  scripts. The gate skill's `disallowed-tools` line IS the guarantee that a separate session's gate
  turn cannot write — do not add `Bash`, `Write`, `Edit` or `Glob` back, and do not give it a
  scope pattern (patterns are a no-op; only bare tool names are enforced). The inline default has
  no such guarantee: it rests on a model-written approval record bound to `spec_stamp` and on
  `/harness-build` §Entry refusing a mismatch (the Fast Gate grade —
  `design/harness-ordering-enforcement/SPEC.md` §3.3a and its decision ① row's correction).
- `.gitattributes` covers `*.workflow.js`, `*.sh`, `*.yml`, `*.md`, `tests/**/*.mjs`, and
  `skills/handoff/scripts/**/*.mjs`. Other file types —
  `*.py` included — are not EOL-normalized by the repository, so what they commit still
  depends on the machine's `core.autocrlf`. The `*.md` line renormalized nothing when it
  landed (all 94 tracked `.md` blobs were already LF); it fixes what a checkout with
  `core.autocrlf=false` would otherwise commit.
