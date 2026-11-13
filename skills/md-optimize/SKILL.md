---
name: md-optimize
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Optimize CLAUDE.md and project .md files for token efficiency. Applies Dual-Zone model (Inline/Index), deduplication, and structural compression. Use on any project to reduce context token cost.
---

# MD Optimize

You are a **Markdown Token Optimizer**. You restructure a project's CLAUDE.md and .md files to minimize token consumption while preserving all semantic content.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang`. All user-facing output (confirmations, reports, errors) must be in `user_lang`. Template instructions (this file) stay in English.

- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill's execution WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — explicit output-language directive (schema free-text field descriptions carry `(in {user_lang})`) and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->

## Exclusion List

Never modify: `.git/`, `.harness/`, `node_modules/`, `vendor/`, `dist/`, `build/`, `__pycache__/`, `.venv/`, `*.lock`, `.next/`, `.nuxt/`, `coverage/`, `.turbo/`, `.cache/`, `CHANGELOG.md`, `LICENSE.md`, `LICENSE`.

## Phase 1: Analysis

### 1a. Safety & Environment Check

1. Run `git status` in CWD. If not a git repo, ask the user using AskUserQuestion (in `user_lang`):
     header: "Git Warning"
     question: "This project is not managed by git. md-optimize backs up every file it edits for the length of this run, but nothing protects the result afterwards."
     options:
       - label: "Proceed" / description: "Continue with the run-length backup only"
       - label: "Abort" / description: "Stop and set up git first"
   On "Abort": halt. On "Proceed": continue.
2. Check for uncommitted changes. If found, ask the user using AskUserQuestion (in `user_lang`):
     header: "Uncommitted"
     question: "Uncommitted changes detected."
     options:
       - label: "Continue" / description: "Proceed with uncommitted changes"
       - label: "Abort" / description: "Stop and commit/stash first"
   On "Abort": halt. On "Continue": proceed.
3. Search all `.md` files for the idempotency marker `<!-- managed by md-optimize -->`. If CLAUDE.md contains this marker, inform user: "This project was previously optimized. Re-running will refresh the optimization." Proceed normally (marker ensures idempotency).
4. **Leftover backup.** If `.harness/md-optimize/manifest.txt` exists, an earlier run was interrupted before it could finish or restore, and that backup holds the only pre-run copy of the files it edited. Ask the user using AskUserQuestion (in `user_lang`):
     header: "Backup"
     question: "An interrupted md-optimize run left a backup. Restore the files to their pre-run state first?"
     options:
       - label: "Restore" / description: "Put every backed-up file back, remove files that run created, then continue"
       - label: "Discard" / description: "Keep the files as they are now and delete the old backup"
       - label: "Abort" / description: "Stop; change nothing"
   On "Restore": restore by the manifest exactly as §Phase 3 describes for a failed step, delete `.harness/md-optimize/`, continue. On "Discard": delete `.harness/md-optimize/`, continue. On "Abort": halt. Never start Phase 3 while that manifest exists.

### 1b. Smart Routing & Markdown Inventory

1. Glob `**/*.md` (excluding items in Exclusion List). List all found files with byte sizes.

   **Gitignore filter (sub-step):** After Glob, run `git rev-parse --is-inside-work-tree` to detect whether the current directory is inside a git working tree. If it is, exclude gitignored paths via per-path `git check-ignore --quiet <path>` (canonical method). Interpret exit codes as: `0` = path is ignored (exclude it), `1` = path is not ignored (keep it — this is the normal not-matched case, not a failure), `128` = fatal error (surface to the user; do not retry). If not in a git repo, fall back to the hardcoded Exclusion List only — no `.gitignore` filtering is performed.

   Note (alternatives / Windows): Per-path invocation above is already shell-safe. If batched invocation is needed, `git check-ignore --stdin` works on POSIX shells but stdin piping can be unreliable on some Windows shells (mixed CRLF/encoding). `git ls-files --others --ignored --exclude-standard` is a secondary alternative but only lists *untracked-and-ignored* files — it will NOT flag a tracked file matching an ignore pattern (e.g., a `git add -f` force-tracked file), so prefer `git check-ignore` when correctness for force-tracked files matters.

   Note (ordering): The Phase 1a Step 3 idempotency marker scan was already executed against the full Glob result before this gitignore filter runs, so any gitignored file carrying a stale `<!-- managed by md-optimize -->` marker is still detected upstream. This filter only narrows the inventory used by subsequent Phase 1b/1c/1d steps; it does not invalidate the marker scan output.

2. Check if `CLAUDE.md` exists. If yes, read its content and note current size.
3. Evaluate project state and recommend action:

| State | Recommendation | Action |
|-------|---------------|--------|
| No .md files found | **Nothing to optimize** | Stop without asking: print (in `user_lang`) that there is nothing to optimize and that the built-in `/init` creates a CLAUDE.md |
| Only CLAUDE.md exists and < 500 bytes | **Create CLAUDE.md first** | Use AskUserQuestion with situation context |
| CLAUDE.md exists and is comprehensive, .md files have redundancy | **Optimize** | Proceed with md-optimize (this skill) |
| CLAUDE.md is thin but other .md files are substantial | **Create CLAUDE.md first** | Use AskUserQuestion with situation context |
| No CLAUDE.md but other .md files exist | **Create CLAUDE.md first** | Use AskUserQuestion with situation context |

When the recommendation is "Create CLAUDE.md first", ask the user using AskUserQuestion (in `user_lang`):
  header: "Routing"
  question: "[situation description]. A fuller CLAUDE.md may be needed first."
  options:
    - label: "Stop" / description: "Create CLAUDE.md first (the built-in /init does this), then re-run /md-optimize"
    - label: "Continue" / description: "Proceed with optimization as-is"

If user selects "Stop": halt this skill. The user creates or extends CLAUDE.md (the built-in `/init` does this) and re-runs `/md-optimize`.
If user selects "Continue": proceed with optimization.

4. Estimate token count per file: `bytes / 4` for ASCII, `bytes / 3` for CJK-heavy content. Note: these are rough estimates; actual tokenization varies.

### 1c. Duplication Detection

Use `md5sum` (or `sha256sum` if unavailable) via Bash on each .md file. Group files by hash. Files with identical hashes are exact duplicates. For near-duplicates, compare headings structure only (not full content).

### 1d. CLAUDE.md Dual-Zone Classification

Scan existing CLAUDE.md (if any) and all .md content. Classify each piece of information:

| Zone | Criteria | Examples |
|------|----------|---------|
| **Inline** | Rules, constraints, conventions that MUST be in context at all times | "Never commit .env", "Use snake_case", "All API responses use JSON" |
| **Index** | Reference material, guides, detailed docs that can be loaded on-demand | Architecture overviews, API endpoint lists, setup guides, onboarding docs |

**Inline keyword safety net** — Content containing these keywords MUST stay Inline regardless of length: `never`, `always`, `must`, `forbidden`, `required` and their equivalents in the user's language (e.g., CJK constraint keywords). Apply case-insensitive matching.

## Phase 2: Confirmation Gate

<HARD-GATE>
Present to the user (in `user_lang`):

1. **Inline Zone preview**: Bulleted list of rules/conventions that will remain in CLAUDE.md body
2. **Index Zone preview**: Table of `| File | Path | Summary |` entries that will become index references
3. **Duplicate list**: Files identified as exact/near duplicates — reported only; md-optimize does not delete duplicate files
4. **Estimated savings**: `(current_total_tokens - projected_total_tokens) / current_total_tokens * 100`%

Ask for explicit confirmation using AskUserQuestion (in `user_lang`):
  header: "Optimize"
  question: "Review optimization plan above. This will restructure markdown files."
  options:
    - label: "Proceed" / description: "Apply the optimization plan as shown"
    - label: "Modify" / description: "Adjust zone assignments before proceeding"
    - label: "Stop" / description: "Abort optimization"

If user selects "Modify" or provides modification details via "Other": update zone assignments and re-present this question.
If user selects "Stop": halt.
Only "Proceed" advances to Phase 3.
</HARD-GATE>

## Phase 3: Execution (Sequential with Completion Check)

Execute in strict order. After each step, verify the output file exists and is non-empty. If any step fails, stop and restore from the Step 3.0 backup by its manifest — copy every `modified` path back from `.harness/md-optimize/backup/`, delete every `created` path — then print the restored paths and "Step N failed — files restored to their pre-run state." Delete `.harness/md-optimize/` once the restore has succeeded; if the restore itself fails, keep it and print its path.

### Step 3.0: Backup

Before any write, and with or without git — no `git` command is involved, so untracked and uncommitted files are covered:
- For each file Phase 3 will edit or delete, copy its current bytes to `.harness/md-optimize/backup/<path>` and append `modified <path>` to `.harness/md-optimize/manifest.txt`.
- Each time a later step creates a file that did not exist, append `created <path>` to the manifest.
- Phase 4d fixes follow the same two rules: back up a file before its first edit, record a file when it is created.
- Never overwrite a backup copy. A path that already has a copy under `.harness/md-optimize/backup/` keeps that first copy, and a path already in the manifest is not appended again — the first copy is the pre-run state; a later one would be a half-edited file.

### Step 3a: Create/Update Split Files

For each Index Zone item that needs a dedicated file:
- Create or update the target `.md` file at its designated path
- Preserve any existing frontmatter
- Add `<!-- managed by md-optimize -->` marker at the top of each managed file

### Step 3b: Rewrite CLAUDE.md

Structure the new CLAUDE.md as:

```
<!-- managed by md-optimize -->
# CLAUDE.md

## Rules & Conventions (Inline Zone)
[all Inline content — compressed, imperative style, no redundancy]

## Reference Index
| Topic | Path | Summary |
|-------|------|---------|
| ...   | ...  | ...     |
```

Apply token-efficient writing: short imperative sentences, tables over prose, remove filler words, collapse verbose lists.

### Step 3c: Clean Originals

For files whose content was fully migrated to CLAUDE.md Inline Zone or merged into another file:
- Delete only if 100% of content is preserved elsewhere
- Never delete files that contain non-migrated content

### Step 3d: Report Duplicates

Do NOT delete duplicate files. A copy that looks redundant may be read by a tool or referenced from a non-markdown file this skill never scans. List each group of exact duplicates (and each near-duplicate pair from 1c) for the Phase 5 report and leave every file in place.

## Phase 4: Evaluator (Isolated Sub-Agent)

An independent sub-agent reviews the optimized result **without access to the optimizer's classification reasoning**. This catches content loss, misclassification, and broken references that self-verification tends to miss.

### 4a. Sub-Agent Dispatch

Launch an isolated sub-agent with the following brief:

> You are an independent evaluator. A CLAUDE.md and related .md files have been restructured for token efficiency. Your job is to verify nothing was lost or broken. Assume defects exist — your job is to find them.

The sub-agent receives:
- The optimized CLAUDE.md and all modified/created .md files
- The git diff of all changes (before vs after), and the pre-run bytes of every edited or deleted file under `.harness/md-optimize/backup/` — the diff does not show untracked files
- Full read access to the project files
- No Phase 1 analysis results, no optimizer reasoning

### 4b. Evaluation Criteria

The sub-agent checks each criterion and scores PASS / ISSUE:

| Criterion | Check | Method |
|-----------|-------|--------|
| **Content preservation** | No semantic information was lost during optimization | Compare each file under `.harness/md-optimize/backup/` with its current state (the git diff alone misses untracked files) — every removed line's meaning must exist in the new structure |
| **Zone correctness** | Inline items are truly must-know rules; Index items are truly reference material | Review each Inline item for constraint keywords; review each Index item for reference nature |
| **Path integrity** | Every path in Reference Index exists and is readable | Verify each path |
| **Gitignore safety** | No path in Reference Index or relative `.md`/directory reference inside the Inline Zone is gitignored | Sub-agent runs `git rev-parse --is-inside-work-tree` itself (preserving the isolation contract — no Phase 1 results passed in), then for each path runs `git check-ignore --quiet <path>`, interpreting the result per the gitignore exit-code semantics in the Phase 1b section (0=ignored, 1=not-ignored, 128=fatal): ignored → ISSUE; not-ignored → OK; fatal → surface error. See Phase 1b sub-step for command alternatives. Non-git repo → N/A → PASS |
| **Link integrity** | All internal `[text](path)` links resolve to existing files | Check all links in modified files |
| **Marker consistency** | All managed files contain `<!-- managed by md-optimize -->` | Scan all modified files |
| **Frontmatter integrity** | Files with YAML frontmatter still parse correctly | Validate frontmatter syntax |
| **Keyword safety** | Content with constraint keywords (`never`, `always`, `must`, `forbidden`, `required` and user-language equivalents) is in Inline Zone | Search for keywords in Index files — any match is a misclassification |

### 4c. Evaluation Output

The sub-agent produces a structured report:

```
[md-optimize evaluator]
  PASS : N criteria
  ISSUE: N criteria

Issues found:
  1. [criterion] — [specific problem] — [suggested fix]
  2. ...

Content at risk:
  1. [content that may have been lost or misclassified]
  2. ...

Verdict: PASS | NEEDS_REVISION
```

### 4d. Revision Handling

- **PASS**: Proceed to Phase 5 (Report).
- **NEEDS_REVISION**: Ask the user using AskUserQuestion (in `user_lang`):
    header: "Fixes"
    question: "Evaluator found {N} issues."
    options:
      - label: "Fix all" / description: "Auto-fix all reported issues"
      - label: "Skip" / description: "Proceed without fixing"
    "Other" allows selective fix (user specifies which issues to fix).
  Apply fixes for each confirmed issue. Do not re-run the full evaluator — only verify the specific fixes were applied correctly.

## Phase 5: Report

Print final report (in `user_lang`):

```
[md-optimize] Optimization Complete
  Files scanned    : N
  Files modified   : N
  Files deleted    : N (fully migrated originals)
  Duplicates       : N group(s) reported, none deleted
  Inline rules     : N items
  Index references : N entries
  Evaluator        : PASS | REVISED (N issues fixed)
  Token estimate   : before → after (−X%)
```

If any evaluation criterion has unresolved issues, append warnings. List the duplicate groups Step 3d collected. Then delete `.harness/md-optimize/` — the backup lasts for the run only.

## Safety Rules

- **Git-first**: Always verify git status before any write operation. Recommend commit/stash for dirty trees.
- **Gitignore-aware**: Files matched by `.gitignore` are excluded from scanning, indexing, and migration (see the Phase 1b section for exit-code handling and detection mechanics). Including a gitignored path in the committed CLAUDE.md Reference Index produces broken references for collaborators and CI environments where the file does not exist. When this rule conflicts with the Sub-CLAUDE.md rule below (a gitignored sub-directory contains its own `CLAUDE.md`), Gitignore-aware takes precedence — the gitignored CLAUDE.md is excluded from the Reference Index, since including it would create a broken reference in the committed parent CLAUDE.md. If the project is not a git repo, this rule is N/A and the hardcoded Exclusion List is the only filter.
- **Idempotency**: `<!-- managed by md-optimize -->` marker prevents re-processing conflicts. On re-run, refresh existing optimization rather than duplicating.
- **No data loss**: Never delete content without verifying it exists elsewhere. When in doubt, keep the original.
- **Sequential execution**: Phase 3 steps run in order (3.0→a→b→c→d). Not atomic — on failure, restore from the Step 3.0 backup by its manifest (§Phase 3).
- **Scope boundary**: Only modify `.md` files. Never modify source code, configs, or non-markdown files.
- **Sub-CLAUDE.md**: If subdirectories contain their own `CLAUDE.md`, treat as separate Inline Zones — do not merge into root CLAUDE.md. Add them to the Reference Index instead.
- **Batch sizing**: Process files in batches of min(10, file_count/3). Adjust based on average file size — larger files get smaller batches.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.
