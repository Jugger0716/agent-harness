---
name: handoff
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Session handoff manager for cross-session continuity. Generate a structured HANDOFF document (git state, verified facts, next steps, reading order) — written immediately, with no save confirmation, because the location convention never overwrites — then prime a fresh session from it with git-drift verification (/handoff resume). Complements /harness Session Recovery (task-internal state.json phase restore) — this covers epic-level, multi-day, cross-session continuity. Inline-only for its own work, stateless, non-overwriting writes; `resume` can chain straight into the next command when you pick it at the gate.
---

# Handoff — Session Handoff Manager

You capture the current session into a durable, verifiable HANDOFF document and later prime a fresh
session from it. Stateless: no state file, no session recovery of its own; every invocation is
self-contained. It is NOT `/harness` Session Recovery, nor a replacement for it: that restores a
task's `.harness/state.json` phase machine, while `/handoff` works above tasks (epics, multi-day
work) and only points at that file, read-only, never duplicating its phase machine. It is NOT
state restoration: `resume` primes context and verifies the recorded git state,
reporting drift, and never claims to restore execution state. It is NOT auto-memory, which stores
facts.

**Language.** `user_lang` is the language of the user's most recent message. Every user-facing
output (reports, briefings, questions, errors) is in `user_lang`; a HANDOFF document's section
headings stay English raw (parse anchors) and their content is in `user_lang`.

## Sub-command Dispatch

| Argument after `/handoff` | Action |
|---|---|
| (none), `generate`, `generate <title>` | write a HANDOFF document now — no save confirmation, never an overwrite — titled `<title>` when given: read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/generate.md` and follow it verbatim |
| `resume`, `resume <path>` | prime from the newest HANDOFF document, or from `<path>`: read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/resume.md` and follow it verbatim |
| `list` | §Sub-command: list |
| anything else | a help message in `user_lang` listing these commands |

**Location convention (single canonical path):** `docs/harness/handoff/YYYY-MM-DD-<slug>.md` —
today's date; the slug is an English kebab-case summary of the title, `[a-z0-9-]`, at most 40 characters. There is no
transliteration: the model supplies the English words. `resolve-path` (`generate.md` Step 3)
normalises the slug and, when the name is taken, appends `-2`, `-3`, … — NEVER overwrite an
existing handoff. This differs on purpose from `templates/_shared/slugify.md`: a non-ASCII
character is a separator, the cap is 40 characters, and an empty result asks for an English
summary.

**Base directory.** The session's current working directory is the base of `docs/harness/handoff/`
(where `generate` writes and `resume`/`list` look) and the last-resort root of a relative Reading
Order path: such a path resolves against the repository that holds the document (the folder with
its `docs/` directory, or that folder's git top-level); only a document with neither uses the
session directory (`resume.md` Step 4's `--root`). The header's `Worktree` is never a base — it
only says where `resume` evaluates git state (`resume.md` Step 3).

**Helper script.** `{HANDOFF_JS}` is `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/handoff.mjs`.
Confirm `${CLAUDE_PLUGIN_ROOT}` resolves to a non-empty value first (substitute the literal root
when the shell leaves it unset) and keep both paths in quotes. `"."` as `--cwd` or `--root` is the
session's current working directory. Each command prints one JSON object. On a non-zero exit show
its stderr verbatim and stop — never emulate a command by hand.

---

## Sub-command: list

Run `node "{HANDOFF_JS}" list --dir "docs/harness/handoff"` — never scan the folder by hand (a
non-zero exit stops, as above). `docs` lists every handoff document of the folder (first line
`# HANDOFF —`), newest first, each `{path, date, slug, branch, head, title, mtimeMs}` with header
values as recorded (null when none). Print one line each — date, slug, recorded branch, recorded
HEAD (may be cut to 7+ characters), path — labels English raw, values as stored, null as `-`:

```
[handoff] 3 handoff document(s)
  2026-07-24  v87-tiering        feature/v8.7-tiering  97ce994  docs/harness/handoff/2026-07-24-v87-tiering.md
```

`docs` empty → say so in `user_lang`.

## Non-Goals

- No git mutations (no checkout/reset/clean/stash): drift is reported, the human acts.
- No `.harness/` mutations: `generate` and `resume` only READ `.harness/state.json`.
- No sub-agents and no Workflow engine for this skill's own work — every step runs inline. This is
  a prose rule, not a runtime block: `disallowed-tools` omits `Task`/`Agent`/`Workflow` because its
  block lasts the whole turn and would disarm the skill `resume` chains into
  (`templates/_shared/mode_gate.md` rule 3 cause (a)). `NotebookEdit`, `WebSearch` and `WebFetch`
  stay blocked — `/handoff` must not reach the web — and a chained skill inherits that block, so
  `resume.md` Step 5 rule 5 never chains into a skill that needs the web.
- Chaining into the next skill IS allowed, only from `resume`'s gate: `resume` invokes the command
  it recommends when the human picks "Start next step", never before the gate is answered;
  `generate` never chains.
- No automatic generation: `generate` is always an explicit user action.
- `/handoff` does not read `slice_plan.md` — the slice command convention (`generate-ledger.md`)
  names its format by pointing at `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan;
  the `Next :`/`Next cmd:` derivation (`resume.md` Step 5) uses THIS document's recorded text plus
  one live fact: whether `.harness/state.json` is `relevant` to the current branch
  (`harness-state`), which alone decides whether the recorded `Docs` value may name the next slice.
  <!-- SYNC-WITH: skills/harness-build/SKILL.md §Step 3.5: Slice Plan -->
- The Progress Ledger is a passive table that only explicit `generate` calls read and write — no
  automatic status detection or slice transition; an epic state machine is out of scope.
