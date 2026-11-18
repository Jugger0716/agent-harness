---
name: handoff
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Session handoff manager for cross-session continuity. Generate a structured HANDOFF document (git state, verified facts, next steps, reading order) — written immediately, with no save confirmation, because the location convention never overwrites — then prime a fresh session from it with git-drift verification (/handoff resume). Complements /harness Session Recovery (task-internal state.json phase restore) — this covers epic-level, multi-day, cross-session continuity. Inline-only for its own work, stateless, non-overwriting writes; `resume` can chain straight into the next command when you pick it at the gate.
---

# Handoff — Session Handoff Manager

You are a **session handoff manager**. You capture the state of the current working session
into a durable, verifiable HANDOFF document, and later prime a fresh session from that document.

**What this is NOT:**
- NOT `/harness` Session Recovery — that restores a task's internal `state.json` phase machine.
  `/handoff` works at the level ABOVE tasks: epics, multi-day efforts, "continue tomorrow".
- NOT state restoration. `resume` performs **context priming + fact verification** — it reads
  documents, verifies the recorded git state against reality, and reports drift. It never
  claims to restore execution state, and it NEVER mutates git (no checkout, no reset, no clean).
- NOT auto-memory — that stores facts; this transfers a working session.

**Stateless:** No state.json, no session recovery of its own. Each invocation is self-contained.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang`. All
user-facing output (previews, briefings, questions, errors) must be in `user_lang`. Document
section headings in the generated HANDOFF file stay English raw (they are parse anchors);
section CONTENT is written in `user_lang`.

## Sub-command Dispatch

Parse the argument immediately after `/handoff`:

| Input | Action |
|-------|--------|
| (none) or `generate` | Capture current session → HANDOFF document (written immediately, never overwrites) — read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/generate.md` and follow it verbatim |
| `generate <title>` | Same, with an explicit title |
| `resume` | Locate the newest HANDOFF document and prime from it — read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/resume.md` and follow it verbatim |
| `resume <path>` | Prime from the given HANDOFF document — read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/resume.md` and follow it verbatim |
| `list` | List existing HANDOFF documents, newest first |
| anything else | Show a help message (in `user_lang`) listing the commands above |

**Location convention (single canonical path):** `docs/harness/handoff/YYYY-MM-DD-<slug>.md`
— date is today, slug is a short kebab-case label derived from the title (lowercase,
transliterate non-ASCII to ASCII, non-word chars removed, max 40 chars). If the exact filename
already exists, append `-2`, `-3`, … — NEVER overwrite an existing handoff.

---

## Sub-command: list

Scan `docs/harness/handoff/*.md` (only files whose first line starts with `# HANDOFF —`), newest first. Print (labels English raw, values as stored):

```
[handoff] 3 handoff document(s)
  2026-07-24  v87-tiering        feature/v8.7-tiering  97ce994  docs/harness/handoff/2026-07-24-v87-tiering.md
  ...
```

(date, slug, recorded branch, recorded HEAD — may be displayed truncated to 7+ chars — path; one line each.) None found → say so in
`user_lang`.

---

## Non-Goals

- No git mutations, ever (no checkout/reset/clean/stash) — drift is reported, the human acts.
- No `.harness/` mutations, ever — `generate` and `resume` (Step 3.5, NEW P0-4) both only READ
  `.harness/state.json`; neither writes to, deletes, nor otherwise touches `.harness/`.
- **No background agents and no Workflow engine for this skill's own work** — every step here
  runs inline in the orchestrator. **This is a prose rule, not a runtime constraint**:
  `Task`/`Agent`/`Workflow` were removed from `disallowed-tools` because that frontmatter
  **is** turn-scoped and did disarm whatever skill `resume` chained into
  (**MEASURED 2026-09-01** — see `templates/handoff/resume.md` §Step 5, and `templates/_shared/mode_gate.md` rule 3 cause (a)
  for the observation and its two limits). `NotebookEdit`, `WebSearch` and `WebFetch` stay
  blocked, and **that is not free for all three** — nor is it hypothetical any more:
  `NotebookEdit` is irrelevant to this skill, but a chained skill that researches on the web
  loses that step for the rest of the turn, and one that falls back to local sources when the
  web fails makes the loss **silent** — the exact failure shape this change objected to. They stay
  blocked because `/handoff` itself must not reach the web; `templates/handoff/resume.md` §Step 5 rule 5 keeps that cost off
  the chained skill by declining to chain into such a skill.
- **Chaining into the next skill IS allowed, and only from `resume`'s gate.** `resume` invokes
  the command it recommends when the human picks "Start next step" — that is the feature. It
  still never invokes anything before the gate is answered, and `generate` never chains at all.
- No automatic generation on session end — generate is always an explicit user action.
- `/handoff` does not read `slice_plan.md` — the slice command convention (generate Step 1
  item 4) names its format by pointing at `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan, it
  never opens that file itself; the `Next :`/`Next cmd:` derivation (resume Step 5) is built
  the same way, entirely from THIS document's own recorded text.
  <!-- SYNC-WITH: skills/harness-build/SKILL.md §Step 3.5: Slice Plan -->
- Not a replacement for `/harness` Session Recovery; when `.harness/state.json` exists, the
  handoff POINTS at it (read-only) rather than duplicating its phase machine.
- The Progress Ledger (P0-1) is a passive table this skill reads/writes on explicit
  `generate` calls only — no automatic status detection, no automatic slice transitions.
  Keeping `/handoff` stateless and inline-only is deliberate; anything more starts to
  re-implement an epic state machine, which is explicitly out of scope (see spec D-4/D-5).
- **No save confirmation on `generate`** — Step 2 composes, Step 3 resolves the path, Step 4
  writes, and nothing in between asks. Writes never overwrite (the `-2`/`-3` collision rule),
  never touch git or `.harness/`, and never leave the machine, and `generate` is itself an
  explicit user action per the bullet above. **The one thing this genuinely gives up is the
  `Cancel` option** — there is no longer a way to invoke `generate` and write nothing, so an
  unwanted document is undone by deleting the file (Step 3, Step 4). `resume` keeps its Step 5
  gate, which guards *starting work*, not writing a file — do not "harmonize" the two.
