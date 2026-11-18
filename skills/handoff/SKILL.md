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
— date is today, slug is an English kebab-case summary of the title: `[a-z0-9-]`, at most 40
characters. There is no transliteration: the model supplies the English words. `resolve-path`
(`generate.md` Step 3) normalises the slug and, when the name is taken, appends `-2`, `-3`, … —
NEVER overwrite an existing handoff. This rule differs on purpose from
`templates/_shared/slugify.md`: a non-ASCII character is a separator, the cap is 40 characters, and
an empty result asks for an English summary.

**Base directory.** The session's current working directory is the base for `docs/harness/handoff/`
(where `generate` writes and `resume` and `list` look) and the last-resort root of a relative Reading
Order path: such a path is resolved against the repository that holds the document (the folder with
its `docs/` directory, or that folder's git top-level), and only a document with neither is read
against the session directory (`resume.md` Step 4's `--root`). The header's `Worktree` is never a
base — it only says where `resume` evaluates git state (`resume.md` Step 3).

---

## Sub-command: list

Run `node "{HANDOFF_JS}" list --dir "docs/harness/handoff"`. `{HANDOFF_JS}` is
`${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/handoff.mjs`: confirm `${CLAUDE_PLUGIN_ROOT}` resolves
to a non-empty value first and keep both paths in quotes. A non-zero exit → show its stderr verbatim
and stop — never scan the folder by hand. The output is one JSON object, `docs`: every handoff
document of the folder (first line `# HANDOFF —`), newest first, each `{path, date, slug, branch,
head, title, mtimeMs}` with the header values as the document records them (null when it records
none). Print (labels English raw, values as stored, a null value as `-`):

```
[handoff] 3 handoff document(s)
  2026-07-24  v87-tiering        feature/v8.7-tiering  97ce994  docs/harness/handoff/2026-07-24-v87-tiering.md
  ...
```

(date, slug, recorded branch, recorded HEAD — may be displayed truncated to 7+ chars — path; one line each.) `docs` empty →
say so in `user_lang`.

---

## Non-Goals

- No git mutations, ever (no checkout/reset/clean/stash) — drift is reported, the human acts.
- No `.harness/` mutations, ever — `generate` and `resume` (`resume.md` Step 3.5) both only READ
  `.harness/state.json`; neither writes to, deletes, nor otherwise touches `.harness/`.
- **No background agents and no Workflow engine for this skill's own work** — every step here
  runs inline in the orchestrator. **This is a prose rule, not a runtime constraint**:
  `disallowed-tools` does not list `Task`/`Agent`/`Workflow`, because that block holds for the
  whole turn and would disarm the skill `resume` chains into (`templates/_shared/mode_gate.md`
  rule 3 cause (a)). `NotebookEdit`, `WebSearch` and `WebFetch` stay blocked because `/handoff`
  itself must not reach the web; a chained skill inherits that block for the rest of the turn,
  so `resume.md` Step 5 rule 5 declines to chain into a skill that needs the web.
- **Chaining into the next skill IS allowed, and only from `resume`'s gate.** `resume` invokes
  the command it recommends when the human picks "Start next step" — that is the feature. It
  still never invokes anything before the gate is answered, and `generate` never chains at all.
- No automatic generation on session end — generate is always an explicit user action.
- `/handoff` does not read `slice_plan.md` — the slice command convention (`generate.md` Step 1
  item 4) names its format by pointing at `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan, it
  never opens that file itself; the `Next :`/`Next cmd:` derivation (`resume.md` Step 5) is built
  the same way, from THIS document's own recorded text — plus one live fact: whether
  `.harness/state.json` is `relevant` to the current branch (`harness-state`), which alone
  decides whether the recorded `Docs` value may name the next slice.
  <!-- SYNC-WITH: skills/harness-build/SKILL.md §Step 3.5: Slice Plan -->
- Not a replacement for `/harness` Session Recovery; when `.harness/state.json` exists, the
  handoff POINTS at it (read-only) rather than duplicating its phase machine.
- The Progress Ledger is a passive table this skill reads/writes on explicit `generate` calls
  only — no automatic status detection, no automatic slice transitions. Keeping `/handoff`
  stateless and inline-only is deliberate; anything more would re-implement an epic state
  machine, which is out of scope.
- **No save confirmation on `generate`** — `generate.md` Step 2 composes, Step 3 resolves the
  path, Step 4 writes, and nothing in between asks. Writes never overwrite (the `-2`/`-3`
  collision rule), never touch git or `.harness/`, and never leave the machine. There is no
  `Cancel`: an unwanted document is undone by deleting the file (`generate.md` Step 4). `resume`
  keeps its Step 5 gate, which guards starting work, not writing a file.
