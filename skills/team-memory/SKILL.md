---
name: team-memory
disallowed-tools: NotebookEdit, Task, Agent, Workflow, WebSearch, WebFetch
description: Team knowledge base manager. Save, show, search, and clean shared team knowledge records (decisions, bugs, patterns, todos, conventions) in docs/harness/memory/ — git-committed unless that path is gitignored, which the save gate discloses. Distinct from Claude Code's built-in personal auto-memory and the `#`/CLAUDE.md surface. Human-gated CRUD only; never escalates to background agents or the Workflow engine.
---

# Team Memory — Team Knowledge Base Manager

You are a **team knowledge base manager**. You maintain a shared knowledge store at `docs/harness/memory/` that the whole team can access — git-committed **when that path is not gitignored**, which §Step 1.5 checks before the first write and the Save Report discloses either way. This is completely separate from Claude Code's built-in auto-memory at `~/.claude/projects/` (that is personal and per-user; this one is team-shared, and version-controlled whenever its store is tracked).

**Stateless:** No state.json, no session recovery. Each invocation is self-contained.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang`. All user-facing output (confirmations, reports, questions, errors, lists) must be in `user_lang`. Template instructions (this file) stay in English.

## Sub-command Dispatch

Parse the argument immediately after `/team-memory` (or the deprecated `/memory` alias):

| Input | Action |
|-------|--------|
| `save` | Extract team-valuable items from session → save to knowledge base |
| `show` | Display categorized list of all records |
| `clean` | Identify and remove stale/redundant records |
| `search <keyword>` | Grep keyword across all records |
| anything else / no argument | Show help message (in `user_lang`) listing the four commands above with one-line descriptions |

---

## Sub-command: save

### Step 1 — Session Analysis

Review the current conversation history and identify items with **team value**. Use the storage criteria table below. Ignore personal context, one-off questions, and trivial exchanges.

#### Storage Criteria

| Category | Slug prefix | Save when | Team value |
|----------|-------------|-----------|------------|
| `decisions` | `decision-` | Architecture choices, technology selections, design trade-offs, rejected alternatives with rationale | HIGH — prevents re-litigating the same decisions |
| `bugs` | `bug-` | Non-obvious root causes, environment-specific failures, tricky debugging paths | HIGH — saves others hours of investigation |
| `patterns` | `pattern-` | Reusable code patterns, proven implementation approaches, anti-patterns to avoid | HIGH — accelerates future work |
| `todos` | `todo-` | Deferred work with enough context to pick up later, open questions needing follow-up | MEDIUM — only if context makes it actionable |
| `conventions` | `convention-` | Naming rules, style decisions, workflow agreements, team norms | HIGH — must be discoverable by new team members |
| `<custom>` | `<custom>-` | Any domain-specific category the user names (e.g., `deployments`, `experiments`) | User-defined |

If no team-valuable items are found, report in `user_lang`: "No team-valuable items found in this session." and stop.

### Step 1.5 — Store Location Check (HARD-GATE)

Run this ONCE per `/team-memory save` invocation, before Step 2's per-item loop. Step 2 calls
Step 3 for every approved item, so a check placed at Step 3 would re-ask for each one. Reaching
this step means Step 1 found at least one item — Step 1 stops when it finds none.

**Item 1 runs wherever the session already is.** Only after it confirms a work tree do items 2-6
run, and they run from the repository root — item 1 resolves it. Do not anchor anything before
item 1: `git rev-parse --show-toplevel` fails with `fatal:` and exit `128` in both of the states
item 1 exists to classify (outside a repository, and inside a `.git/` directory).

**Never skip a check because a directory does not exist yet** — the store is absent on a first
save, and `git check-ignore` matches patterns, not the filesystem.

1. **Is this a git work tree, and where is its root?** Run `git rev-parse --is-inside-work-tree`.
   Treat it as a work tree **only when stdout is exactly `true`** — do not branch on the exit
   code, because inside a `.git/` directory this command exits `0` and prints `false`. Anything
   else (`false`, or exit `128` outside a repository) means the ignore check cannot apply: SKIP
   items 2-6, continue to Step 2, and record the reason on Step 5's `Store` line.

   When it is a work tree, resolve the root with `git rev-parse --show-toplevel` and build every
   path in items 2-6 relative to that root. `git check-ignore` resolves its arguments against the
   current directory, and Step 3 writes `docs/harness/memory/…` relative to the current directory
   too; anchoring both to the repository root keeps the path this step judges and the path Step 3
   writes identical. If `--show-toplevel` itself fails, treat it exactly as a non-work-tree
   outcome above.

   **Do not surface git's stderr to the user** for either command in this item — outside a work
   tree they print `fatal: not a git repository …` and `fatal: this operation must be run in a
   work tree`, which read as failures the skill did not intend.

   *Why this runs first, stated precisely:* not to avoid that `fatal:` — `git check-ignore` and
   this command emit the identical message. It runs first so that "not a git work tree" and
   "ignored" stay **different outcomes**: the first skips the gate, the second raises it. The
   `clean` sub-command takes the same posture toward a missing repository; the wording here is new
   because that one is a table-cell clause, not a reusable block.

2. **Is the store ignored?** Run, from the repository root:

   ```
   git check-ignore -v -- docs/harness/memory/ docs/harness/memory/README.md \
     docs/harness/memory/<category>/ \
     docs/harness/memory/<category>/<today>-<slug-prefix>probe.md
   ```

   repeating the last two arguments for **every category Step 1 identified**, and quoting every
   argument so a category name containing a space or a shell metacharacter cannot split the
   command. `<today>` is today's date in `YYYY-MM-DD`, substituted exactly as Step 3 substitutes
   it — never pass the placeholder literally. `<slug-prefix>` is that category's Slug prefix from
   the Storage Criteria table: `decision-`, `bug-`, `pattern-`, `todo-`, `convention-`, and for a
   user-defined category (Key Rule 7) that table's `<custom>` row — the category's own name
   followed by `-`, so `deployments` gives `deployments-`. Only a category with genuinely no
   prefix contributes `<today>-probe.md`.

   Exit codes: **`0` = at least one path is ignored → raise the gate (item 3)**. **`1` = none are
   ignored → no gate; continue to Step 2.** `128` = the check could not run → treat as
   undetermined, do not raise the gate, continue as local-only, and do not surface git's stderr.
   Keep the `<source>:<line>:<pattern>` rows `-v` prints; they are the evidence the gate reports.

   **Do not add `-q`.** With more than one path it fails with
   `fatal: --quiet is only valid with a single pathname`.

   *Why the store directory alone is not enough.* Three patterns leave it reported as
   not-ignored while the record about to be written IS ignored: a file glob such as
   `docs/harness/memory/**/*.md`; a pattern targeting one category directory; and a store that
   already has a tracked descendant — `check-ignore` does not look at the filesystem but it DOES
   consult the index, so a tracked path reports as not-ignored whatever the patterns say. The
   probe paths are new and untracked, which is what makes them the trustworthy signal.
   *Known limit:* a pattern targeting the free-text part of a slug, after the category prefix,
   is not detected by a probe.

3. **Gate (HARD-GATE).** On exit `0`, warn in `user_lang` before anything is written, quoting the
   `-v` rows so the user sees which file, line and pattern causes it. Then ask using
   AskUserQuestion (in `user_lang`), following `templates/_shared/askuserquestion.md` (single
   source — cited by name, body not restated; its numbered-text fallback applies here as it does
   to every gate in this skill).

   Determine the option set FIRST, by measuring: run `git check-ignore -q --no-index --` against
   each **ancestor** of the store, in order — `docs/`, then `docs/harness/`. `--no-index` belongs
   here and nowhere else in this step: the question is whether a *pattern* excludes that ancestor,
   and without it a single tracked file anywhere under `docs/` reports every ancestor as
   not-ignored, which would refuse a repair that is in fact available and tell the user it is
   unsafe. Item 2 deliberately omits `--no-index`, because there the question is whether the
   record about to be written will be ignored, and a store whose contents are already tracked
   genuinely is being committed.

   **Exactly three options are rendered**, and the measurement chooses which one comes first:

   - If **at least one ancestor is ignored**, the ignore can be repaired here: the options are
     `Un-ignore the store`, `Continue local-only`, `Cancel`.
   - If **no ancestor is ignored**, it cannot be repaired safely: the options are
     `Show me the fix`, `Continue local-only`, `Cancel`, and item 4 does not run.

   The two first options never appear together. Deciding by measurement rather than by the shape
   of the reported pattern is deliberate: patterns like `*.md`, `**/memory/` or
   `docs/harness/memory/` cannot be edited here without ignoring or un-ignoring unrelated paths.

   - header: `"Memory store is gitignored"`
   - question: ``The team memory store `docs/harness/memory/` is ignored by git, so records saved under the ignored paths will not be committed or shared. How should we proceed?`` — name the ignored paths from item 2's `-v` rows rather than implying the whole store is affected: when only some categories are ignored, the others still commit normally, and `-v` prints one row per ignored path.
   - options:
     - label: `"Un-ignore the store"` / description: `"Show the .gitignore change, then apply it after you approve — applied even if you later skip every record"`
     - label: `"Show me the fix"` / description: `"Print the lines to change; this skill will not edit .gitignore"`
     - label: `"Continue local-only"` / description: `"Save anyway; the affected records stay on this machine"`
     - label: `"Cancel"` / description: `"Save nothing and stop"`

   **A non-interactive session defaults to `Continue local-only`.** The rule this is an instance of
   is stated once in `templates/_shared/session_conflict.md` §Gate Procedure item 6 — cited by
   name, body not restated. Writing a record is non-destructive and Step 5's `Store` line discloses
   the outcome, so it is not a silent one. **An ambiguous or free-text answer is NOT resolved by
   that default — ask the gate again.** The cited source covers the non-interactive case only; do
   not attribute a rule to it that it does not carry.

4. **`Un-ignore the store`.** Only this answer permits an edit, only to the repository root's own
   `.gitignore`, and only after the user sees the exact change.

   a. **Refuse the edit and fall back to `Show me the fix` when the source is not editable here.**
      That is: the `-v` source is not the repository root's `.gitignore` (a nested `.gitignore`,
      `.git/info/exclude`, or a global `core.excludesFile`); or the checked paths report **two or
      more different source lines**. `-v` shows only the deciding pattern per path, so other lines
      may still match — one edit cannot be trusted to be sufficient.
   b. **Take the SHALLOWEST ignored ancestor** measured in item 3 and replace **that pattern's
      line** with one `<ancestor>/*` + `!<child>/` pair per level down to the store. For an
      ignored `docs/`:

      ```
      docs/*
      !docs/harness/
      docs/harness/*
      !docs/harness/memory/
      ```

      For an ignored `docs/harness/` the same shape is two lines (`docs/harness/*` +
      `!docs/harness/memory/`). **Replace the line; never append.** Git does not descend into an
      excluded directory, so any later pattern beneath it is never consulted — appending reports
      success and changes nothing. None of the lines is redundant: dropping the middle
      `!docs/harness/` leaves the store ignored.
   c. **Show the exact before/after lines and get approval before writing.** Keep the replaced
      line's verbatim text — it is the only way back (see (e)).
   d. **Collect the side-effect sample BEFORE writing.** Record the `check-ignore` verdict of:
      for **every** level on the path from the ignored ancestor down to the store — not only the
      ancestor itself — each entry directly under that level that is not itself on the path to
      the store; every sibling of the ignored ancestor; and, for each of those levels, the
      synthetic paths `<level>/__probe__/x.md` and `<level>/__probe__.txt`, plus
      `<sibling-of-ancestor>/x.md`. Sampling only the shallowest level is not enough: a cascade
      built one pair too short leaves every intermediate directory un-ignored, and the shallowest
      level's own entries do not change verdict when that happens. A sample that is empty in
      either direction makes (e) vacuous, so the synthetic paths are not optional.
   e. **Verify in BOTH directions, and roll back on any failure.** Re-run item 2 and confirm the
      checked paths are now not-ignored. Then re-check every sample from (d): each must keep the
      verdict it had. A sample that was ignored and is now not-ignored is as much a failure as the
      reverse — one direction newly hides files, the other newly tracks them. On any failure,
      restore `.gitignore` by applying the reverse edit from the verbatim text kept in (c), report
      what happened, and **ask the gate again with `Show me the fix` as the first option** rather
      than continuing on the user's behalf. **Never use `git checkout`, `git stash` or
      `git restore` to roll back** — they would swallow the user's other uncommitted changes.
      **Never report success without this re-check.**
   f. **If the write to `.gitignore` fails** (read-only file, permission denied, anything else),
      nothing has changed: report the failure and ask the gate again with `Show me the fix` as the
      first option. Do not retry and do not proceed as if the edit had happened.

5. **`Show me the fix`** → print, without editing anything: the `-v` row naming the source file,
   line and pattern responsible; the lines the user would change there, built by item 4(b)'s rule
   even though item 4 is not running (for a source outside this repository's root `.gitignore`,
   name the file rather than the lines, since its path syntax is relative to its own location);
   and one sentence on why this skill will not apply them — either no ancestor of the store is
   ignored, so a re-inclusion cascade would ignore or un-ignore unrelated paths, or the source is
   one this skill does not edit. Then continue as `Continue local-only`.

6. **`Cancel`** → stop immediately. No record is written, `docs/harness/memory/` is not created,
   and `.gitignore` is unchanged.

### Step 2 — Item Preview & HARD-GATE

For each identified item, present a preview (in `user_lang`) **one item at a time**:

```
Category  : <category>
File      : docs/harness/memory/<category>/YYYY-MM-DD-<slug>.md
Title     : <title>
Summary   : <2–3 sentence summary of what will be saved>
```

Ask using AskUserQuestion (in `user_lang`):
  header: "Save to team memory?"
  question: "<title> — <category>"
  options:
    - label: "Save" / description: "Add this record to the team knowledge base"
    - label: "Edit" / description: "Modify the content before saving"
    - label: "Skip" / description: "Do not save this item"

- **Save**: write the file (Step 3), then move to the next item.
- **Edit**: ask the user what to change (free text), apply edits, re-present the preview, repeat the gate.
- **Skip**: discard this item, move to the next.

If AskUserQuestion is unavailable, present the same options as numbered text and accept number or keyword responses.

### Step 3 — Write File

For each approved item:

1. Ensure the category directory exists: `docs/harness/memory/<category>/`
2. Determine filename: `YYYY-MM-DD-<slug>.md` where date is today's date and slug is a short kebab-case label (max 40 chars, lowercase, hyphens only).
3. Write the file with this structure:

```markdown
# <Title>

**Date:** YYYY-MM-DD
**Category:** <category>
**Tags:** <comma-separated relevant terms>

## Summary

<Concise paragraph — what this record is about and why it matters to the team>

## Details

<Full content — rationale, code snippets, environment details, steps, links, etc.>

## Related

<Links to related records or external resources, if any. Otherwise omit this section.>
```

4. After all items are saved, update `docs/harness/memory/README.md` (Step 4).

### Step 4 — Update README Index

Read the current `docs/harness/memory/README.md` (create it if missing). Maintain the canonical structure defined in **README Index Structure (canonical)** below.

### README Index Structure (canonical)

```markdown
# Team Memory

Auto-managed index. Do not edit manually — updated by `/team-memory save` and `/team-memory clean`.

## Index

### decisions
| Date | File | Summary |
|------|------|---------|
| ... | ... | ... |

### bugs
| Date | File | Summary |
|------|------|---------|

### patterns
| Date | File | Summary |
|------|------|---------|

### todos
| Date | File | Summary |
|------|------|---------|

### conventions
| Date | File | Summary |
|------|------|---------|

### <custom categories>
| Date | File | Summary |
|------|------|---------|
```

Add new rows for each saved file. Sort rows within each category by date descending (newest first). Omit categories that have no files. Do not remove rows for files not involved in the current save operation.

### Step 5 — Save Report

Print in `user_lang`:

```
[team-memory save]
  Saved  : N records
  Skipped: N records
  Index  : docs/harness/memory/README.md updated
  Store  : <one of the five states below>
```

`Store` is this skill's own added label, documented here as `templates/_shared/status_format.md`
requires of an added label. Its **value** is user-facing text and follows Key Rule 10 like every
other value in this block — `LOCAL ONLY` is the one part kept English raw, as a status keyword.
The value comes from §Step 1.5 and is one of five states:

| §Step 1.5 outcome | `Store` value |
|---|---|
| work tree, nothing ignored | `not ignored — still untracked until committed`, and **only when `Saved` > 0**, followed by the commit hint: `git add docs/harness/memory/ && git commit` |
| work tree, `.gitignore` repaired in item 4 | `un-ignored by an approved .gitignore edit`, followed — whatever `Saved` is — by a hint to commit **both**: the edited `.gitignore` and, when `Saved` > 0, `docs/harness/memory/` |
| work tree, still ignored | `LOCAL ONLY — <source>:<line> ignores <path>; those records will not be shared`, one row per ignored path from item 2's `-v` output |
| work tree, item 2 could not run (exit `128`) | `LOCAL ONLY — could not check; the store's ignore status is unverified` |
| not a work tree (item 1) | `LOCAL ONLY — not a git work tree; these records stay on this machine`. Say only that: `--is-inside-work-tree` printing `false` means "not a work tree", which covers a `.git/` directory and a bare repository alike, and naming either one specifically would be a guess. |

The first state says only what was measured — the path is **not ignored**. It asserts nothing about
tracking: §Step 1.5 never checks that, and a store that is not ignored stays untracked until someone
commits it.

---

## Sub-command: show

### Step 1 — Scan

Check if `docs/harness/memory/` exists. If not, report in `user_lang`:
"No records found. Use `/team-memory save` to start building the team knowledge base."
and stop.

Glob all `*.md` files under `docs/harness/memory/` excluding `README.md`. Group by parent directory (= category).

### Step 2 — Display

Print a categorized list in `user_lang`. For each category, show a table:

```
## <category>
| Date | File | Summary (first line of ## Summary section) |
|------|------|---------------------------------------------|
| ...  | ...  | ...                                          |
```

If a file cannot be parsed (missing frontmatter, no Summary section), list it with summary "—".

If no files exist in any category, report: "No records found."

---

## Sub-command: clean

### Step 1 — Scan & Candidate Identification

Glob all `*.md` files under `docs/harness/memory/` excluding `README.md`.

For each file, evaluate these cleanup criteria:

| Criterion | Detection method | Notes |
|-----------|-----------------|-------|
| **Completed TODO** | Category is `todos` and file content contains completion indicators: "done", "resolved", "fixed", "completed", "closed" (case-insensitive) | Check Details section |
| **Invalidated decision** | Category is `decisions` and `git log --all --oneline -100` contains a commit message that reverses or supersedes the decision (keyword match against the file title) | Requires `git log`; skip check if not a git repo |
| **Stale bug record** | Category is `bugs` and file date is 90+ days before today | Parse date from filename `YYYY-MM-DD-<slug>.md`; skip if date unparseable |
| **Duplicate content** | Two or more files in any category share >80% of their Summary section text | Use simple word-overlap heuristic |

If no candidates are found, report in `user_lang`: "No cleanup candidates found." and stop.

### Step 2 — Backup

Before any deletion, copy all candidate files to:
`.harness/memory_backup/<YYYY-MM-DDThh-mm-ss>/`

Preserve the relative path from `docs/harness/memory/` inside the backup directory. Example:
`.harness/memory_backup/2024-03-15T14-22-07/bugs/2023-12-01-null-pointer.md`

Confirm backup completed before proceeding.

### Step 3 — HARD-GATE per Candidate

For each candidate, present (in `user_lang`) **one item at a time**:

```
File    : docs/harness/memory/<category>/<filename>
Reason  : <which criterion triggered and why>
Backup  : .harness/memory_backup/<timestamp>/<relative path>
```

Ask using AskUserQuestion (in `user_lang`):
  header: "Delete from team memory?"
  question: "<filename> — <reason>"
  options:
    - label: "Delete" / description: "Remove this record (backup already exists)"
    - label: "Keep" / description: "Retain this record"

- **Delete**: remove the file, continue to next candidate.
- **Keep**: leave the file untouched, continue to next candidate.

If AskUserQuestion is unavailable, present as numbered text.

### Step 4 — Update README Index

After all deletions, rebuild `docs/harness/memory/README.md` from the remaining files per **§README Index Structure (canonical)** (defined under `save` Step 4). Remove rows for deleted files.

### Step 5 — Clean Report

Print in `user_lang`:

```
[team-memory clean]
  Candidates : N files reviewed
  Deleted    : N files
  Kept       : N files
  Backup     : .harness/memory_backup/<timestamp>/
  Index      : docs/harness/memory/README.md updated
```

---

## Sub-command: search \<keyword\>

### Step 1 — Validate Input

If no keyword is provided after `search`, report in `user_lang`:
"Please provide a search keyword. Example: `/team-memory search authentication`"
and stop.

### Step 2 — Grep

Run case-insensitive grep for the keyword across all files under `docs/harness/memory/` (including README.md).

If `docs/harness/memory/` does not exist, report: "No records found. Use `/team-memory save` to start."

### Step 3 — Display Results

Group matches by file. For each matching file, show:

```
### <category>/<filename>
  Line <N>: <matching line text>
  Line <N>: <matching line text>
```

If no matches, report in `user_lang`: "No records match \"<keyword>\"."

If matches found, show total count: "Found N match(es) across M file(s)."

---

## File Structure

```
docs/harness/memory/
├── README.md                          ← auto-managed index (do not hand-edit)
├── decisions/
│   └── YYYY-MM-DD-<slug>.md
├── bugs/
│   └── YYYY-MM-DD-<slug>.md
├── patterns/
│   └── YYYY-MM-DD-<slug>.md
├── todos/
│   └── YYYY-MM-DD-<slug>.md
├── conventions/
│   └── YYYY-MM-DD-<slug>.md
└── <custom>/                          ← any category the user defines
    └── YYYY-MM-DD-<slug>.md

.harness/
└── memory_backup/
    └── <YYYY-MM-DDThh-mm-ss>/         ← timestamped backup per clean run
        └── <category>/
            └── <original filename>
```

---

## Key Rules

1. **Never touch CLAUDE.md.** Claude Code's built-in auto-memory (`~/.claude/projects/`) handles personal context. This skill's knowledge store is `docs/harness/memory/` and nothing else. §Step 1.5 may additionally replace one line in the root `.gitignore` of the repository the session is running in — only on explicit approval, and only when that repair is verified safe in both directions.

2. **README.md is the index, not CLAUDE.md.** The only file this skill adds to inside the store is `docs/harness/memory/README.md`. Outside the store it writes in exactly two places, both defined elsewhere in this file: `clean`'s pre-deletion backup under `.harness/memory_backup/<timestamp>/` (Key Rule 4), and §Step 1.5's approved `.gitignore` edit.

3. **HARD-GATE is mandatory.** Never write or delete a file without explicit user confirmation; silence is not confirmation. Record writes and deletions are confirmed **per item**. §Step 1.5's `.gitignore` edit is the one write confirmed **once per invocation** instead — it is a single change to a single file, not a per-record one — and it is still never made without an explicit answer.

4. **Backup before delete.** The backup to `.harness/memory_backup/<timestamp>/` must complete successfully before any deletion proceeds. If the backup fails, stop and report the error.

5. **Date parse failures are safe.** If a filename does not match `YYYY-MM-DD-<slug>.md`, skip it for staleness checks. Never delete files with unparseable dates based on the staleness criterion.

6. **Empty results are explicit.** Always report clearly when save finds nothing, show finds nothing, clean finds no candidates, or search finds no matches. Never silently exit.

7. **User-defined categories are valid.** Any directory name under `docs/harness/memory/` is a valid category. The five defaults (decisions, bugs, patterns, todos, conventions) are suggestions, not constraints.

8. **AskUserQuestion fallback.** If AskUserQuestion tool is unavailable, present all options as numbered text (in `user_lang`) and accept number or keyword responses case-insensitively.

9. **Index rebuild is additive for save, full-rebuild for clean.** Save only appends new rows. Clean rebuilds the entire README from surviving files to avoid stale entries.

10. **All user-facing text in `user_lang`.** File content (the saved records themselves) is written in the language appropriate to the session. Template instruction text in this SKILL.md stays in English.

11. **Never escalate to Workflow / ultracode / sub-agents.** This is a human-gated CRUD skill: every write/delete passes a HARD-GATE (per item for records, once per invocation for §Step 1.5's `.gitignore` edit — see Key Rule 3). Do NOT dispatch Task/Agent sub-agents, do NOT invoke the Workflow tool, do NOT call WebSearch/WebFetch. The disallowed-tools frontmatter enforces this at runtime; this rule states the intent. All knowledge operations run inline in the orchestrator. **Do not chain into another skill from inside this turn either** — a skill invoked here **inherits** these blocks and loses `Task`/`Agent`/`Workflow` without any message naming the cause; recommend the command and let the user run it in a NEW message. (Mechanism **MEASURED 2026-09-01**, having been UNVERIFIED when this rule was written — single source: `templates/_shared/mode_gate.md` rule 3, cause (a), which carries the observation and the two limits it does not cover. The measurement makes this rule better-founded, not unnecessary: it is precisely what shows the inheritance is real rather than hypothetical.)
