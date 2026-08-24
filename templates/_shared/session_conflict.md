# Session Conflict Gate — Shared (single source)

A directory has exactly ONE `.harness/state.json` slot. When a skill starts a new task in a
directory whose slot is already held by a DIFFERENT skill's live session — or by an unmarked
legacy file — falling through to Setup overwrites that session with no warning and no way back.
This file is the single source for the gate that closes it.

**Substitution slots.** `{current_skill}` — the skill applying the gate (e.g. `debug`) — is the
only slot the CITING SKILL supplies, and it is fixed at author time. The question text in step 4
carries four MORE, filled at gate-render time from the CONFLICTING session's own
`.harness/state.json`: `{skill}` (with the `|'unknown'` fallback when that field is absent),
`{task}`, `{phase}`, `{docs_path}`. Everything outside those five is literal. Never emit a
placeholder verbatim.

## §Gate Procedure

1. **When it fires.** Before starting a new task, check whether `.harness/state.json` exists.
   The gate applies when the file exists AND (`skill` is absent OR `skill != "{current_skill}"`).
   A truly-missing `skill` field is treated the SAME as a mismatched one: every state.json
   `/{current_skill}` itself writes carries `skill: "{current_skill}"`, so an absent field can
   only mean another skill's file or a pre-skill-field legacy file. The safe default is to gate,
   not to guess that overwriting is safe.

2. **§Harness exception — the absent case is not universal, and one skill resolves it
   conditionally.** A skill whose own recovery flow uses an absent `skill` field as the
   identifying mark of a pre-skill-field legacy session does NOT route that case here
   unconditionally; it keeps its own legacy branch, either for the whole absent case or for part
   of it. **Exactly two skills carry that pattern today, in two different shapes, and every other
   skill routes the absent case here like any other mismatch** — do not read this exception as
   applying to one skill only:
   - `/harness` — **conditional.** `skills/harness/SKILL.md` §Session Recovery item 1 gates a
     MISMATCHED `skill`, and resolves an ABSENT one against `version`: `"3.0"` gates here (a v3
     file is defined as carrying `skill: "harness"`, so a v3.0 file without it is not
     well-formed), while a missing or non-`"3.0"` version defers to item 2's legacy branch, which
     offers Restart/Stop for a pre-harness session.
   - `/ship` — **whole-case.** `skills/ship/SKILL.md` §Session Recovery treats a MISSING `skill`
     as a legacy session (possibly from `/workflow` v1) and asks to restart or halt.

   Generalising `/spec`'s gate verbatim onto either would delete that legacy path; `/spec` itself
   has no legacy branch to preserve, which is why its own gate folds the absent case in. A skill
   converging onto this source must state which of these shapes it takes — whole-case,
   conditional, or none.

3. **It fires before any side effect.** Evaluate the gate BEFORE directory creation, BEFORE
   `git checkout -b`, and BEFORE any `.harness/state.json` write. Placing it inside Setup makes
   "Cancel leaves no trace" false — the branch already exists by then.

4. **Ask.** Follow `templates/_shared/askuserquestion.md` (single source — cited by name, body
   not restated):

   - header: `"Session Conflict"`
   - question: ``A `/{skill|'unknown'}` session exists in this directory (task: `{task}`, phase: `{phase}`, docs: `{docs_path}`). Starting /{current_skill} here will delete it. Delete it and start /{current_skill}?``
   - options:
     - label: `"Delete and start"` / description: `"Delete .harness/ and proceed with /{current_skill}"`
     - label: `"Cancel"` / description: `"Keep existing session and halt"`

   **Output language.** Every user-facing string this gate renders — the header, the question,
   both labels and both descriptions — is emitted in the session's `user_lang`, per that single
   source. This gate takes no exception to it.

   The literals written above are the ENGLISH SOURCE TEXT of this contract, which is what the
   `session-conflict` sync group matches. That lint reads the CITING files' bytes — this file
   carries no marker and so is never one of its sites — and never a running session's rendered
   output, so rendering in `user_lang` cannot break it. These are NOT Preserved-English Glossary
   tokens either: that Glossary lives in `skills/harness/SKILL.md` §Preserved-English Glossary
   and none of the three appear in it.

5. **Act.**
   - `"Cancel"` → **halt immediately**, before any directory creation, branch creation or
     state.json write. Nothing under `.harness/` is changed or deleted.
   - `"Delete and start"` → delete `.harness/`, then proceed to Setup as a fresh session.

6. **Non-interactive default = halt.** If the session cannot present an interactive prompt
   (headless / cron / sub-agent — no AskUserQuestion available), print the same conflict message
   and stop. Never silently delete-and-overwrite.

   **The general rule this is an instance of, stated once here because other skills cite it:**
   when a gate cannot be answered, a **destructive** action defaults to halt and a
   **non-destructive** action defaults to continue. Deleting a live session's `.harness/` is
   irreversible and unattended, so it halts.

   *Provenance, so this is not mistaken for a restatement of another single source:* this wording
   is generalised from `/spec`'s own gate (`skills/spec/SKILL.md` §Session Recovery), the
   canonical gate THIS file promotes to a shared source. It is **not** taken from
   `templates/_shared/mode_gate.md`, whose own non-interactive rule resolves an execution PATH to
   inline and says nothing about a destructive gate — the two share a phrase describing the same
   environment, not a rule.

7. **When the gate does not apply.** If the file does not exist, OR it exists and
   `skill == "{current_skill}"`, the gate does not fire — continue with the skill's own
   §Session Recovery flow. The absence case keeps its own explicit fall-through sentence in the
   citing skill; do NOT fold it into this gate, or every normal fresh run is blocked.
