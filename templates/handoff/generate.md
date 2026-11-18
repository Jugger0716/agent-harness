> This is the body of `/handoff generate`, loaded from `skills/handoff/SKILL.md` §Sub-command Dispatch.

## Sub-command: generate

### Step 1 — Collect (verified facts first)

Gather, in this order:

1. **Git state (run the commands, do not recall from memory):**
   - `git rev-parse --abbrev-ref HEAD` → branch (skip git items entirely if not a repo)
   - `git rev-parse HEAD` (record the FULL 40-char sha — short shas go ambiguous over time) + `git log -1 --format=%s` → HEAD sha + subject
   - `git status --short` → dirty-file count (list up to 10 paths)
   - Ahead/behind upstream if an upstream exists (`git status --short --branch` first line)
2. **Harness task state (READ-ONLY, if present):** if `.harness/state.json` exists, read
   `skill`, `task`, `phase`, `mode`, `docs_path`. Record them under **In Progress** using the
   **Fixed Label Record Format** below — labels are English raw parse anchors that `resume`'s
   Step 3.5 live cross-check compares against; values are recorded as stored:

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
3. **Task artifacts:** if a `docs_path` was found in 2, list its files (names only) as
   Reading Order candidates.
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
     prose does not satisfy this**; the label is the whole point, because `resume` Step 5's
     `Next :` derivation reads the labelled value and is forbidden from scanning prose for a bare
     token (cited by name, not restated here). Without the label that derivation falls back to
     the ledger's LAST row, which in a between-slices handoff is by construction the slice that
     just SHIPPED. Measured 2026-08-28 over all 31 ledger-bearing handoffs in
     `docs/harness/handoff/`: 17 have no `in-progress` row (18 to a reader that skips `resume`
     Step 5's `Status` normalization), none of them carries this label yet, and a bare-token
     heuristic tried in its place matched 3 of the 17 with 2 of those 3 wrong.
   - Definition of Done — how a future session knows the effort is finished
   - Reading Order — files a fresh session should read, in order, each with a 1-line reason
     (prefer: this handoff → key spec/plan docs → the 1–3 most central source files)
   - Do NOT — guardrails and forbidden actions carried over from this session's decisions
5. **Progress Ledger (epic continuity, optional — NEW, P0-1):** only when this handoff is part
   of a multi-slice epic (skip entirely for a single-task handoff — never force an empty table).
   The `Slice` column below feeds item 4's slice command convention above — a row here is what
   makes that convention apply.

   a. **Confirm the Epic identifier first**, before selecting a carry-forward source: ask the
      user, or carry it forward unchanged from the source document selected in (b) if this
      handoff continues the same epic. `Epic` is a kebab-case identifier (may be derived from
      the current `docs_path` slug when there is no clearer name).
   b. **Select the carry-forward source** — scan `docs/harness/handoff/` newest-first, capped
      at 20 files or 90 days (whichever is reached first). Scan **inline** — never dispatch a
      sub-agent for this (§Non-Goals). The first document that (i) contains
      a `## Progress Ledger` section AND (ii) has an `Epic` column value matching the confirmed
      Epic becomes the carry-forward source. **This is a DIFFERENT selection rule than
      `resume`'s newest-file-only rule** (Sub-command: resume, Step 1) — that rule never looks
      at the ledger or `Epic`; this one requires both, precisely so a ledger-less single-task
      handoff sitting in between two epic slices does not break the chain, and so a different
      `Epic`'s more-recent document is never carried in by mistake.
   c. **No source found** (scan exhausted the cap, or no document anywhere has this Epic's
      ledger): start from an **empty ledger** — this is not an error, but it MUST be surfaced at
      Step 4's write report ("no carry-forward source found — started a new ledger for
      Epic `<epic>`") so a broken chain is never silent.
   d. **Carry rows forward, never overwrite**: copy the source document's ledger rows for THIS
      Epic only (rows for a different `Epic` in the same table are never carried), then
      append/update this session's own row(s). The result is written into the NEW handoff file
      being composed in Step 2 — this does not touch the source document (consistent with the
      no-overwrite location convention above).

   **Progress Ledger — column contract** (confirmed, so no two sessions invent different
   vocabulary):

   | Column | Value rule |
   |---|---|
   | `Epic` | kebab-case identifier; the carry-forward selection key (see (b) above) |
   | `Slice` | identifier for this slice. Priority: (1) the slice's `docs_path` last path segment (the slug already used by `/harness`; no new schema surface), (2) a kebab-case free label if no `docs_path` applies. Unique within the same Epic |
   | `Status` | **fixed enum, English raw, never translated:** `done` / `in-progress` / `blocked` / `dropped` |
   | `Evidence` | a full 40-char commit sha, or an artifact path; `n/a` if neither exists yet |
   | `Notes` | free text in `user_lang` — residual risks, gotchas |

### Step 2 — Compose

Fill the canonical template (English headings raw; content in `user_lang`):

```markdown
# HANDOFF — <title>

**Date:** YYYY-MM-DD  **Project:** <repo or directory name>
**Branch:** <branch>  **HEAD:** <full-sha> <subject>
**Dirty:** <clean | N files (list)>  **Upstream:** <ahead/behind or n/a>

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

## Resume
Run: `/handoff resume docs/harness/handoff/<this-file>.md`
```

`## Progress Ledger` is a parse-anchor heading (English raw, like the other section headings);
omit the whole section (heading + table) when Step 1 item 5 did not apply — never emit an
empty table with no rows just to keep the section present.

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
     (item 5b/5c), say so explicitly — e.g. "No carry-forward source found for Epic `<epic>` —
     started a new ledger." **A broken chain must never be silent**; this line moved from the
     preview to here, and it is the one line whose omission the removal of the gate could
     actually cost.
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
  Ledger  : <"no carry-forward source found for Epic <epic> — started a new ledger" | omit the line entirely>
  Correct : edit that file / re-run `/handoff generate` (writes a new `-2` file — nothing is overwritten) / delete it if unwanted (until then a path-less `resume` picks it, being newest)
  Next session → /handoff resume docs/harness/handoff/YYYY-MM-DD-<slug>.md
```

The `Ledger` row is **omitted when a carry-forward source WAS found, and omitted when no ledger
applies at all** — it exists only to make the broken-chain case loud. The `Correct` row always
prints: it is what replaces the gate's "Edit" option.

> **gitignore note:** many projects gitignore `docs/harness/`. If `git check-ignore` says the
> written file is ignored, append one warning line (in `user_lang`): the handoff exists only on
> this machine — `git clean -fdx` or a fresh clone will not carry it.
