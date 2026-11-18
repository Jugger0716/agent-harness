> This is the body of `/handoff generate`, loaded from `skills/handoff/SKILL.md` §Sub-command Dispatch.

## Sub-command: generate

### Step 1 — Collect (verified facts first)

Gather, in this order:

1. **Git state (run the script, do not recall from memory):**

   ```
   node "{HANDOFF_JS}" git-state --cwd "."
   ```

   `.` is the session's current working directory. `{HANDOFF_JS}` is
   `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/handoff.mjs`: confirm `${CLAUDE_PLUGIN_ROOT}`
   resolves to a non-empty value first (substitute the literal root when the shell leaves it unset)
   and keep both paths in quotes — `templates/handoff/resume.md` Step 4 states the same rule, and
   this file is read without that one. If the script exits non-zero, show its stderr verbatim and
   stop — never fall back to running git by hand. The output is one JSON object: `isGit`, `toplevel`, `branch`, `head`, `subject`, `dirty`
   (a list of `{status, path}`) and `upstream` (`{ahead, behind}` or null). Record, for the header
   of Step 2:
   - `Branch` — `branch`; when `isGit` is false (not a git folder) write `n/a`; a detached HEAD is
     `(detached)`, which is what the script returns.
   - `HEAD` — the FULL 40-char `head` (short shas go ambiguous over time) + `subject`; `n/a` when
     `head` is null (no repository, or no commit yet).
   - `Worktree` — `toplevel`, or `n/a` when `isGit` is false.
   - `Dirty` — `clean` when `dirty` is empty, else `N files` (the length of `dirty`) and, only
     then, the `Dirty files` line: the `path` of the first 40 entries joined with `; ` (a path
     whose name contains `; ` is wrapped in a backtick pair), then `+N more` for the rest.
   - `Upstream` — `ahead A, behind B` from `upstream`, or `n/a` when it is null.
2. **Harness task state (READ-ONLY):** run

   ```
   node "{HANDOFF_JS}" harness-state --branch "<the Branch value recorded in item 1>" --cwd "."
   ```

   (`{HANDOFF_JS}`, the quoting and a non-zero exit as in item 1.) The output is one JSON object:
   `exists`, `relevant`, `reason` and `fields` (`skill`, `task`, `phase`, `mode`, `docs_path`, as
   stored). `relevant` is true only when `.harness/state.json` exists, its `branch` equals the
   current branch and its `phase` is not `completed` — the script decides; never judge it by hand.
   Under **In Progress**:
   - `relevant` is true → record `fields` using the **Fixed Label Record Format** below — labels
     are English raw parse anchors that `resume`'s Step 3.5 live cross-check compares against;
     values are recorded as stored.
   - otherwise → write ONE line instead, `Harness : none (<reason>)`, with the script's `reason`,
     and no five-line record: a state file that belongs to another branch, or to a finished task,
     is not what this session was doing, and a record of it would send the next session there.

   **Fixed Label Record Format** (canonical — referenced by `skills/harness/SKILL.md` §Session
   Boundary "`/handoff generate` field contract"):
   <!-- SYNC-WITH: templates/handoff/generate.md §Fixed Label Record Format -->
   ```
   Skill : <skill>
   Task : <task>
   Phase : <phase>
   Mode : <mode>
   Docs : <docs_path>
   ```
   NEVER write to or delete `.harness/` from this skill.
3. **Task artifacts:** only when item 2 returned `relevant` true and `fields.docs_path` is set,
   list that folder's files (names only) as Reading Order candidates. A state that is not
   relevant contributes none: its folder belongs to another task.
4. **Conversation-derived content** (draft each section from the current session):
   - Goal — what this effort is trying to achieve (1–3 sentences)
   - Current State (verified) — ONLY facts you can back with evidence from this session
     (command output, file read, test result). Each bullet: `fact — evidence`. Do not list
     beliefs or intentions here.
   - In Progress — what was mid-flight when the session ends
   - Blockers / Risks — including unresolved questions
   - Next Steps — ordered, first step concrete enough to start cold. **Slice command
     convention**: when item 1 names a specific epic slice's command (a Progress Ledger row
     applies — see item 5 below), write it using the exact `Slice`/`Command` format
     `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan defines for `slice_plan.md` — name
     that format here, do not restate it.
     **Slice identifier requirement — the no-command case.** When a Progress Ledger row applies
     but the next step is NOT a single command (the epic-slice shape, where a slice is
     implemented directly from an epic plan instead of being invoked as a skill), item 1 MUST
     still open with the `Slice` half of that same format on its own line — the label English
     raw, the value the next slice's identifier — and simply omit `Command`:

         Slice : <next slice's kebab-case identifier>

     The value must not be the identifier the ledger records as just finished. **A mention in
     prose does not satisfy this**; the label is the whole point, because `resume`'s `Next :`
     derivation (`templates/handoff/resume.md` Step 5 — cited by name, not restated here) reads
     the labelled value first and never scans prose for a slice name. Without the label it
     depends on the ledger's `in-progress` rows (one names the slice, several are ambiguous) and
     on the live task state; a handoff written between slices has no `in-progress` row, so
     `Next :` ends as item 1 printed verbatim. Measured 2026-08-28 over all 31 ledger-bearing
     handoffs in `docs/harness/handoff/`: 17 have no `in-progress` row, and none of them
     carried this label yet.
   - Definition of Done — how a future session knows the effort is finished
   - Reading Order — files a fresh session should read, in order, each with a 1-line reason
     (prefer: this handoff → key spec/plan docs → the 1–3 most central source files).
     Optional: `path:START-END`, inside the path's backticks, reads only those lines.
     Optional: `path §heading text`, inside the same backticks, reads only the first section
     whose heading contains that text.
   - Do NOT — guardrails and forbidden actions carried over from this session's decisions
5. **Progress Ledger (epic continuity, optional — NEW, P0-1):** only when this handoff is part
   of a multi-slice epic (skip entirely for a single-task handoff — never force an empty table).
   The `Slice` column below feeds item 4's slice command convention above — a row here is what
   makes that convention apply. Two commands read the earlier handoff documents for this item,
   so never open, scan or rank those documents by hand; `{HANDOFF_JS}`, the quoting and a
   non-zero exit are as in item 1 (show the script's stderr verbatim and stop).

   a. **Propose the Epic from the previous ledger.** Run

      ```
      node "{HANDOFF_JS}" latest-epic --dir "docs/harness/handoff"
      ```

      The output is one JSON object, `epic` and `doc`: the `Epic` of the last row that has one,
      in the newest handoff document that has a ledger with such a row, and that document's
      path — both `null` when none of the 20 newest handoff documents, which is all the script
      reads, has one (a folder that does not exist yet included). Use `epic` as the proposal,
      without asking. There is no age limit on that document, so an Epic from months ago can be
      proposed this way; the id this session's work names wins. When `epic` is `null`, the new
      Epic is the `docs_path` slug of item 2 (kebab-case; item 2 returned `relevant` true),
      without asking. Ask the user only when `epic` is `null` and there is no such slug, or when
      this session's work concretely names a different epic id — the id the work names is then
      the Epic.
   b. **Carry the rows forward.** Run

      ```
      node "{HANDOFF_JS}" ledger-carry --dir "docs/harness/handoff" --epic "<the Epic of (a)>"
      ```

      The script picks the carry-forward source — the newest handoff document whose ledger has
      rows of this Epic, so a ledger-less single-task handoff sitting in between two epic slices
      does not break the chain — and returns one JSON object: `doc` (that document's path, or
      `null`), `rows`, `pointer` (its file name), `droppedDone`, `unknownStatusRows` and
      `chained` (true when that document itself carries an `Earlier rows:` line). A document you
      already know can be named instead of searched, `--doc "<path>"` in place of `--dir`; `doc`
      is then always that document. The rows follow one rule: **every unfinished row of this Epic is carried in full**
      — `in-progress`, `blocked`, `planned`, and a row whose `Status` is none of the five enum
      values — **and, of the finished rows (`done`, `dropped`), only the most recent 5**. `rows` is
      in document order; `droppedDone` is how many finished rows were left out.
      A ledger carries the rows of ONE Epic: rows of a different Epic are never carried, and an
      Epic that none of the documents the script reads holds (a new epic) carries nothing.
   c. **Write the rows, then this session's own.** Put `rows` into the new ledger, each cell
      bare by the rule under the column contract, then append or update this session's own
      row(s): a slice that already has a carried row is updated in place (`Slice` is unique
      within its Epic), never added a second time. The result is written into the NEW handoff
      file being composed in Step 2 — this does not touch the source document (consistent with
      the no-overwrite location convention above).
   d. **The earlier rows.** When a source was found (not the empty-ledger case of (e)) and
      `droppedDone` is greater than 0 **or** `chained` is true, write one line under the table,
      after a blank line, `Earlier rows: <pointer>`, with the script's `pointer` value — a file
      name, no folder, always the source document. Never copy the `Earlier rows:` line the source
      document may carry itself: the new line names the source document, so the chain runs from
      document to document, and a source that is `chained` keeps the way to its own earlier rows
      open even when this carry left nothing out. With `droppedDone` 0 and `chained` false write
      no such line.
   e. **No source found** (`doc` is `null` — none of the 20 newest handoff documents the script
      reads has rows of this Epic — or `rows` is empty): start from an **empty ledger** — this is
      not an error, but it MUST be surfaced at Step 4's write report ("no carry-forward source
      found — started a new ledger for Epic `<epic>`") so a broken chain is never silent. With
      `--doc`, `doc` is always set, so an empty `rows` is what tells you the named document holds
      no rows of this Epic.
   f. **A `Status` outside the enum** (`unknownStatusRows` above 0): those rows were carried as
      unfinished so that no row is lost. Keep their `Status` as written, guess no replacement, and
      name their `Slice` values in Step 4's report so the human corrects them.
   g. **A row with an empty `Epic` cell** (`unattributedRows` above 0): the script took it as
      this Epic's row and filled in its `epic`. Name those rows' `Slice` values in Step 4's report
      so the human checks them.

   **Progress Ledger — column contract** (confirmed, so no two sessions invent different
   vocabulary):

   | Column | Value rule |
   |---|---|
   | `Epic` | kebab-case identifier; what `latest-epic` proposes (a) and `ledger-carry` selects rows by (b) |
   | `Slice` | identifier for this slice. Priority: (1) the slice's `docs_path` last path segment (the slug already used by `/harness`; no new schema surface), (2) a kebab-case free label if no `docs_path` applies. Unique within the same Epic |
   | `Status` | **fixed enum, English raw, never translated:** `done` / `in-progress` / `blocked` / `planned` / `dropped`. A slice that has not been started yet is `planned`, never `blocked` — do not pile a backlog into `blocked`; `blocked` is a slice that cannot proceed until something outside it changes |
   | `Evidence` | a full 40-char commit sha, or an artifact path; `n/a` if neither exists yet |
   | `Notes` | free text in `user_lang` — residual risks, gotchas |

   Write every cell bare: never wrap a whole cell in `**` or backticks (backticks inside free
   text, as in `Notes`, stay). A carried row follows the same rule — a `slice`, `evidence` or
   `notes` that came back wrapped is written without the wrapper.

### Step 2 — Compose

Fill the canonical template (English headings raw; content in `user_lang`):

```markdown
# HANDOFF — <title>

**Date:** YYYY-MM-DD  **Project:** <repo or directory name>
**Branch:** <branch | (detached) | n/a>  **HEAD:** <full-sha> <subject>
**Worktree:** <git top-level path | n/a>
**Dirty:** <clean | N files>  **Upstream:** <ahead/behind or n/a>
**Dirty files:** <p1; p2; … (up to 40, then "+N more")>

## Goal
## Current State (verified)
## In Progress
## Blockers / Risks
## Next Steps
## Definition of Done
## Reading Order
## Do NOT

## Progress Ledger        <!-- optional — omit entirely for a single-task handoff, see Step 1 item 5 -->

| Epic | Slice | Status | Evidence | Notes |
|------|-------|--------|----------|-------|

Earlier rows: <file name of the source document>   <!-- only when Step 1 item 5d applies; otherwise delete this line -->

## Resume
Run: `/handoff resume docs/harness/handoff/<this-file>.md`
```

`## Progress Ledger` is a parse-anchor heading (English raw, like the other section headings);
omit the whole section (heading + table) when Step 1 item 5 did not apply — never emit an
empty table with no rows just to keep the section present. The `Earlier rows:` line is written
only under the conditions of Step 1 item 5d, always after a blank line (a text line directly under
the last row would read as one more row of the table).

The `**Dirty files:**` line is written only when the tree is dirty (Step 1 item 1); every other
header line is always written, with `n/a` where the folder has no value for it. Under **In
Progress** write either the five-line record or the one `Harness : none (<reason>)` line, never
both and never neither (Step 1 item 2).

### Step 3 — Resolve the final path (no gate — the write is unconditional)

Resolve the FINAL target path: apply the collision rule from the location convention NOW, so
the resolved path IS the write path. Then go straight to Step 4 — **`generate` never asks
whether to save.**

**Why there is no confirmation here, stated so it is not "restored" as a missing safety net.**
Three properties make the write safe without one, and all three are structural rather than
promised: (i) the location convention **never overwrites** — an existing filename takes `-2`,
`-3`, …, so no prior handoff can be destroyed and a re-run after a correction is simply a new
file; (ii) the write is a single local document under `docs/harness/handoff/`, touching no git
state, no `.harness/`, and nothing outward-facing; and (iii) `generate` is *already* an
explicit user action (§Non-Goals — nothing auto-generates a handoff), so the gate was a second
confirmation of a command the user had just typed. What a preview-gate genuinely bought was the
chance to correct a fact before it became durable; that is preserved by writing first and
reporting after — **the file is the preview**, and correcting it means editing it in place or
re-running (which yields `-2`, never an overwrite). Step 4 says both.

**Not all of it survives, and the difference is written down rather than glossed.** Of what the
gate did: the broken-chain warning and the resolved path **moved** to Step 4's report; the
full-document preview is **replaced** — by the written file itself, not by anything Step 4
prints; and `Cancel` is **removed outright**, so there is no longer any path through `generate`
that writes nothing. A handoff created by mistake is corrected by deleting the file (Step 4).
**Do not describe this change as lossless** — an earlier revision of this paragraph claimed
"nothing is dropped, only re-ordered", which is false on both the preview and `Cancel`, and
would let a later audit conclude the removal cost nothing.

### Step 4 — Write & report

1. Ensure `docs/harness/handoff/` exists.
2. Write to the path resolved in Step 3. If a collision appeared between resolution and write
   (a concurrent run), re-resolve by the same `-2`/`-3` rule and write there — **never
   overwrite an existing handoff**, and name the path actually written in the report below.
3. Report (in `user_lang`). **The report is not optional chrome — it carries what the removed
   gate used to carry**, so print all of it:
   - **If a Progress Ledger applies (Step 1 item 5) and no carry-forward source was found**
     (item 5e: `ledger-carry` returned `doc` `null` or no `rows`), say so explicitly — e.g. "No carry-forward
     source found for Epic `<epic>` — started a new ledger." **A broken chain must never be
     silent**; this line moved from the preview to here, and it is the one line whose omission
     the removal of the gate could actually cost.
   - **If rows were carried with a `Status` outside the enum** (item 5f) **or an empty `Epic`
     cell** (item 5g), name each such row's `Slice` (and the `Status`, for the first kind), so the
     human can correct them.
   - The path that was written, plus the resume one-liner below.
   - One line telling the user how to correct it — **three ways, and the third is the one that
     replaces `Cancel`**: edit the file directly; re-run `/handoff generate` (a re-run writes a
     NEW `-2` file — prior handoffs are never modified); or **delete the file**, which is a
     legitimate correction and not a repair of anything, since a handoff is a plain local
     document that no state, no lint and no other skill reads. **Say so explicitly**: with no
     gate, an unwanted `generate` — including a bare `/handoff`, which IS `generate` per the
     dispatch table — can only be undone by deleting, and until it is deleted a path-less
     `/handoff resume` will select it, because `resume` Step 1 picks the NEWEST document.

```
[handoff] Saved : docs/harness/handoff/YYYY-MM-DD-<slug>.md
  Ledger  : <"no carry-forward source found for Epic <epic> — started a new ledger" | "N row(s) carried with a Status outside the enum or an empty Epic cell: <slice> (<status>), …" | omit the line entirely>
  Correct : edit that file / re-run `/handoff generate` (writes a new `-2` file — nothing is overwritten) / delete it if unwanted (until then a path-less `resume` picks it, being newest)
  Next session → /handoff resume docs/harness/handoff/YYYY-MM-DD-<slug>.md
```

The `Ledger` row is **omitted when a carry-forward source WAS found and no carried row needs
correcting (item 5f, 5g), and omitted when no ledger applies at all** — it exists to make the
broken-chain case loud (and to hand a stray `Status` value or an empty `Epic` cell back to the
human). The `Correct` row always prints: it is what replaces the gate's "Edit" option.

> **gitignore note:** many projects gitignore `docs/harness/`. If `git check-ignore` says the
> written file is ignored, append one warning line (in `user_lang`): the handoff exists only on
> this machine — `git clean -fdx` or a fresh clone will not carry it.
