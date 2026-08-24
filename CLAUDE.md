<!-- managed by md-generate -->
# CLAUDE.md

## Project Overview

agent-harness is a **Claude Code plugin repository**, not an application. It ships 17 skills whose
primary artifact is a contract document (`skills/<name>/SKILL.md`), plus the prompt templates,
native Workflow segment scripts, and self-consistency lints those contracts depend on. There is no
application source and no test suite — the contracts *are* the code, and a wrong sentence is a
defect.

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
| Lint wiring equality | `bash .github/scripts/check_lint_wiring.sh` |

Run all five after changing anything under `skills/`, `templates/`, `workflows/`, `scripts/`, or
`.claude-plugin/`. Re-run `check_lint_wiring.sh` as well whenever `.github/workflows/lint.yml`
changes or a file matching `scripts/verify_*.py` or `scripts/*.mjs` is added or removed.

They also run on every push and pull request via `.github/workflows/lint.yml`; `.github/` holds that
workflow, the wiring check under `.github/scripts/`, and the issue and PR templates. The Python
scripts' docstrings state `run manually and on push/PR via .github/workflows/lint.yml (pre-commit
hook wiring is still a later-phase TODO)` — a pre-commit hook is still not wired.

Exit codes: `0` pass, `1` violation found, `2` structural problem. One exception worth knowing:
in `verify_sync_markers.py` a **missing target file is `1`**, and `2` means a declared SYNC group's
marker was found **nowhere** (the single source lost all its sync sites).

There is no build, test, dev, or deploy command.

## Architecture

| Path | Role |
|---|---|
| `skills/<name>/SKILL.md` | one skill = one directory = one contract file |
| `templates/_shared/` | cross-skill single sources (`mode_gate.md`, `status_format.md`, `project_defaults.md`, ...) |
| `templates/<skill>/` | skill-specific prompt templates |
| `templates/planner/` | shared by `/harness` and `/spec` — hence the `verify_block_sync.py` BLOCK groups |
| `templates/{generator,verify,evaluator}/` | `/harness` only, despite the role-based naming |
| `workflows/<skill>.<segment>.workflow.js` | native Workflow segment; the naming pattern is fixed |
| `workflows/_reference/` | reference documents (`schemas.md`, `study_measurements.md`), not scripts |
| `scripts/` | the 5 self-consistency lints |
| `docs/` | gitignored runtime output of 13 skills |
| `README.md` | 1,100+ lines including `### Repository Layout`; keep it in sync when a skill's surface changes |

`skills/{code-review,memory,workflow}/` are deprecation stubs forwarding to
`{deep-review,team-memory,harness}`.

**Mode Gate** — every multi-path skill follows `templates/_shared/mode_gate.md`: the INLINE path is
the default, and the native Workflow path runs only on opt-in (ultracode ON, an explicit
`--mode standard/multi/...`, or an `agent-harness-defaults: path=workflow` project line).
`has_git == false` or an engine failure falls back to INLINE, never a hard error. This is the
repository's largest cross-file contract; `verify_sync_markers.py` enforces it through the
`ambiguity-prompt` (`min_sites=10`) and `project-defaults` (`min_sites=9`) groups.

Skills dispatch their segments as `${CLAUDE_PLUGIN_ROOT}/workflows/<skill>.<segment>.workflow.js` —
a plugin-root path, never a repository-relative one.

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
- Substitute with `split`/`join`, never `String.replace` — a payload containing a `$` substitution
  pattern would corrupt the result. Substitute structural keys first, user-influenced payload
  (`task`, `task_description`) last.
- Never use `Date.now`, `new Date`, or `Math.random`; they break cached-prefix resume.
- Never write `AskUserQuestion`, `HARD-GATE`, or the apply-patch option label into a script. Gates
  belong to SKILL.md only.
- Keep these files LF. A CRLF workflow script is rejected by the permission layer and cannot launch.

### Git

- Branch as `harness/<slug>` (or `feature/<name>`); base is `develop`, releases merge to `main`.
- Write Conventional Commits with a skill scope: `feat(harness): ...`, `fix(handoff,docs): ...`,
  `chore(release): ...`.
- Every recent merge is a merge commit. No `merge.ff` config enforces this — it is convention, so
  pass `--no-ff` deliberately.

## Verification

The five lints under `scripts/`, plus `.github/scripts/check_lint_wiring.sh` and the CI wiring
in `.github/workflows/lint.yml`, are the entire verification layer:

- `verify_sync_markers.py` — SYNC group referential integrity, `min_sites` occurrence floor, and
  token consistency; **plus** a section-reference check that every `§Section` pointer into
  `workflows/_reference/study_measurements.md` resolves to a real `## §Section` heading there
  (renaming a heading in that file breaks the lint). It is a marker-and-token check, **not** a
  semantic diff: it proves tokens coexist, not that the surrounding prose still agrees.
  Add a group by appending to `SYNC_GROUPS`. `min_sites` is pinned to the **measured count with
  zero slack**, so adding a marker site means raising the floor in the same change, and removing
  one fails immediately.
- `verify_meta_literal.py` — `meta` literal purity, module-syntax ban, nondeterministic-API ban,
  gate-token tripwire, and the defensive-args guard.
- `verify_block_sync.py` — SHA256 comparison of BLOCK-delimited content. `GROUPS` declares
  `(tag, version, files, shared_source)`.
- `verify_manifest_sync.py` — `.claude-plugin/plugin.json` and `marketplace.json`: the plugin
  description, the keywords set, and the version string at all three key paths.
  `metadata.description` and `owner` are marketplace-only, and `author` is carried by both files
  but not compared; the script's docstring records each exclusion with its reason, because JSON
  cannot carry a comment.
- `check_workflow_syntax.mjs` — compiles each script through `AsyncFunction` because `node --check`
  false-greens on ESM `export`, then guards CR in both the working tree and the index blob.
- `.github/scripts/check_lint_wiring.sh` — compares the lint scripts that exist against the ones
  `.github/workflows/lint.yml` actually runs, by NAME SET rather than by count. It lives outside
  `scripts/` so it neither matches the glob it counts nor counts itself.

## Important Notes

- `.gitignore` covers `docs/`, `.harness/`, `.claude/`, `.venv/`, `__pycache__/`, `*.pyc`, `.env`,
  and `.idea/`. When citing a `docs/` path from a committed document, mark it
  `(gitignored — not a public link)`.
- **`/team-memory` conflicts with this repository's own `.gitignore`.** It declares its store as
  git-committed, shared, and version-controlled at `docs/harness/memory/`, but `docs/` is ignored
  here — so team-memory records written in this repository are not committed.
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
- `/harness`'s 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) must stay in
  `skills/harness/SKILL.md`; `verify_meta_literal.py` rejects gate tokens inside segment scripts.
- `.gitattributes` covers `*.workflow.js`, `*.sh`, and `*.yml`. Other file types are not
  EOL-normalized by the repository.
