# Artifact Cleanup Safety Guard — Shared (single source)

Canonical guard applied by every skill that deletes an output/artifact directory. Each
consuming skill keeps only its own **delete targets** (e.g. which dirs it removes, its
commit flow); the validation rules below are not restated per skill.

Before deleting any output directory:

1. **Read `docs_path`** from state.json. If missing/null: reconstruct as `"docs/harness/<slug>/"`. Extract `<slug>` = last path segment before the trailing `/`.
2. **Validate slug**: If empty/null/whitespace → **ABORT**, warn user.
3. **Path depth check**: `docs_path` must be a relative path exactly one level below its parent directory. slug must NOT be `memory` (reserved), must NOT contain `..` or `/`, must NOT be `.`. **Always** verify: `Path(docs_path).resolve()` ⊆ `Path.cwd()` (symlink escape prevention — no `has_git` condition). If any fail → **ABORT**.
4. **Display before delete**: Print exact target path before executing.

**Full output base cleanup** (only on explicit user request):
1. List all subdirectories with file counts.
2. If `docs/harness/memory/` exists, warn separately: "Contains team knowledge from /memory skill."
3. Warn: "`docs/` is git-ignored — all artifacts permanently deleted."
4. Confirm via AskUserQuestion (yes/no).
