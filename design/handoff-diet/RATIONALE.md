# /handoff diet — rationale preserved out of the contract body

> H15 moved reasoning OUT of the three `/handoff` contract files — `skills/handoff/SKILL.md`,
> `templates/handoff/generate.md` and `templates/handoff/resume.md` — so that they carry execution
> rules only. **Nothing in this file is a rule.** Every rule still lives in one of those files, or
> in a helper script under `skills/handoff/scripts/` that the contract runs. This file keeps the
> argument and the history behind a few counter-intuitive rules, so a later change that wants to
> "simplify" one of them meets that argument first.
>
> Measurements below were taken over this repository's handoff corpus — the handoff documents
> this repository's own sessions wrote (gitignored runtime output, not published). They are
> named only by count.
>
> Committed on purpose: a record another session must act on does not belong in a gitignored
> folder.

## §Moved paragraphs

One row per paragraph (or clause) removed from the three files by H15. "Stays" quotes the rule
sentence the body still carries for it, or names the helper sub-command that owns it.

| # | Original place | What moved | Stays (quoted) or `script-owned: <sub-command>` |
|---|---|---|---|
| M1 | `generate.md` Step 1 item 4, slice identifier requirement | "Measured 2026-08-28 over all 31 ledger-bearing handoffs …: 17 have no `in-progress` row, and none of them carried this label yet." → §The slice label and the `Next :` derivation | generate-ledger.md: "A mention in prose does not count: `resume`'s `Next :` derivation (`templates/handoff/resume.md` Step 5) reads this label first and never scans prose" |
| M2 | `generate.md` Step 1 item 5, heading | the planning tag "NEW, P0-1" → §Citations removed as unresolvable | generate.md: "**Progress Ledger** (epic continuity, optional): only when this handoff is part of a multi-slice epic" |
| M3 | `generate.md` Step 3, "Why there is no confirmation here …" | the three structural properties that make the write safe without a gate → §No save confirmation on generate | generate.md: "Then go straight to Step 4: **`generate` never asks whether to save** — the written file is the preview." |
| M4 | `generate.md` Step 3, "Not all of it survives …" | what the removed gate's parts became; "do not describe this change as lossless" → §No save confirmation on generate | generate.md: "**`generate` never asks whether to save** — the written file is the preview."<br>generate.md: "delete it if unwanted" |
| M5 | `generate.md` Step 4 item 3, lead | "The report is not optional chrome — it carries what the removed gate used to carry" → §No save confirmation on generate | generate.md: "Report in `user_lang`, all of it:" |
| M6 | `generate.md` Step 4 item 3, broken-chain bullet | "this line moved from the preview to here, and it is the one line whose omission the removal of the gate could actually cost" → §No save confirmation on generate | generate.md: "a broken chain is never silent" |
| M7 | `generate.md` Step 4 item 3, correction bullet | "the third is the one that replaces `Cancel`", "not a repair of anything", "with no gate" → §No save confirmation on generate | generate.md: "Correct : edit that file / re-run `/handoff generate`"<br>generate.md: "Deleting is a legitimate correction" |
| M8 | `generate.md` Step 4, after the report block | why the `Ledger` row exists; "the `Correct` row … is what replaces the gate's "Edit" option" → §No save confirmation on generate | generate.md: "`Correct` — always." |
| M9 | `SKILL.md` §Non-Goals, `.harness/` bullet | the planning tag "NEW P0-4" → §Citations removed as unresolvable | SKILL.md: "No `.harness/` mutations: `generate` and `resume` only READ `.harness/state.json`." |
| M10 | `SKILL.md` §Non-Goals, background-agents bullet | "MEASURED 2026-09-01" and the cost narrative ("that is not free for all three — nor is it hypothetical any more …", the silent-loss shape) → §Tool blocks and the chaining test | SKILL.md: "This is a prose rule, not a runtime block"<br>SKILL.md: "`NotebookEdit`, `WebSearch` and `WebFetch` stay blocked — `/handoff` must not reach the web" |
| M11 | `SKILL.md` §Non-Goals, Progress Ledger bullet | the tag "(P0-1)" and "(see spec D-4/D-5)" → §Citations removed as unresolvable | SKILL.md: "no automatic status detection or slice transition" |
| M12 | `SKILL.md` §Non-Goals, no-save-confirmation bullet | "`generate` is itself an explicit user action per the bullet above", "the one thing this genuinely gives up …", "do not "harmonize" the two" → §No save confirmation on generate | generate.md: "say explicitly that an unwanted `generate` — a bare `/handoff` included — is undone only by deleting"<br>resume.md: "**The gate is asked on EVERY path, and asking means CALLING AskUserQuestion.**" |
| M13 | `resume.md` Step 3.5, intro | "(`Task`/`Agent`/`Workflow` were removed from that frontmatter, see §Non-Goals, and it never covered `.harness/` writes in the first place)" → §Tool blocks and the chaining test | resume.md: "It only READS `.harness/state.json`: "No `.harness/` mutations" is a rule (SKILL.md §Non-Goals), **not** a side effect of `disallowed-tools`" |
| M14 | `resume.md` Step 5, `Next cmd:` derivation | the tag "(AC-9)" → §Citations removed as unresolvable; "that was the earlier behaviour and it is what left the epic-slice shape with no startable option at all" → §The slice label and the `Next :` derivation | resume.md: "**A zero-candidate count does not by itself drop the first option.**" |
| M15 | `resume.md` Step 5, gate paragraph | "(Observed 2026-08-28: a `resume` run printed the briefing, described the three options in prose, and ended the turn …)" → §Observations behind resume's gate rules | resume.md: "**The gate is asked on EVERY path, and asking means CALLING AskUserQuestion.**" |
| M16 | `resume.md` Step 5, extraction rule 3 | "— silently skipping a precondition is how slice-a's 141k-token convention re-scan happens." → §Observations behind resume's gate rules | resume.md: "**If item 1 states a precondition, recommend "Adjust plan" instead of the first option.**" |
| M17 | `resume.md` Step 5, "Why chaining is possible at all, and what changed." | the history of the refused chain and the 2026-08-07 denials → §Tool blocks and the chaining test | SKILL.md: "`disallowed-tools` omits `Task`/`Agent`/`Workflow` because its block lasts the whole turn and would disarm the skill `resume` chains into"<br>resume.md: "On **"Start next step"**: act **in this turn**" |
| M18 | `resume.md` Step 5, "That was the wrong layer to fix." | why the block was removed rather than worked around; "UNVERIFIED … now MEASURED" → §Tool blocks and the chaining test | SKILL.md: "`disallowed-tools` omits `Task`/`Agent`/`Workflow` because its block lasts the whole turn" |
| M19 | `resume.md` Step 5, "This change was also a test …" | the chaining test, its precondition (a refreshed plugin cache) and its result → §Tool blocks and the chaining test | none — history only, no rule |
| M20 | `resume.md` Step 5, "What the result does NOT license." | the inherited web block is a cost, not harmless → §Tool blocks and the chaining test | resume.md: "**If the recommended command is a skill whose work needs `WebSearch`/`WebFetch`**, do NOT render the first option"<br>resume.md: "every slice that chain runs in this turn inherits this skill's blocked `WebSearch` / `WebFetch`" |
| M21 | `resume.md` Step 5, "What this gives up, stated plainly" | `Task`/`Agent`/`Workflow` are a promise now, not an enforced block → §Tool blocks and the chaining test | SKILL.md: "No sub-agents and no Workflow engine for this skill's own work — every step runs inline. This is a prose rule, not a runtime block" |
| M22 | `resume.md` Step 5, the epic block "three requirements this change invalidates" | → §Requirements an earlier epic recorded as invalidated | none — history only, no rule |

Wording changed in place (no paragraph moved): `resume.md` Step 3's lost-work label now uses the
State row's token `recorded dirty work not found`; Step 5's ambiguity trigger now carries its own
exception (in-progress rows that all lack a `Slice` value); "command candidates" became "token
candidates" (the script's list, before the negation judgement) against "candidates" (after it);
the three "directly under the aligned block" places defer to the one order paragraph; bare
`§Non-Goals` and bare `Step N` cross-references name their file.

The compression that followed deleted no rule. It merged two `SKILL.md` §Non-Goals bullets into
other sentences (the Session Recovery bullet into the opening paragraph; the no-save-confirmation
bullet into the dispatch row and `generate.md` Steps 3–4) and relocated the Progress Ledger rules
to `templates/handoff/generate-ledger.md`; the reasons it cut out of rule sentences are in
§Why-clauses dropped by the compression, and every rule sentence's new carrier is in §Rule map.

## §Tool blocks and the chaining test

**Before.** `skills/handoff/SKILL.md`'s frontmatter `disallowed-tools` listed `Task, Agent,
Workflow`, to enforce a rule about this skill's own behaviour (`/handoff` needs no sub-agents and
no engine). `resume` then refused to chain: it printed the next command for the user to re-run,
because a skill invoked from inside a `resume` turn appeared to inherit that block — `/harness`
lost its sub-agents and Workflow segments, or was refused with a bare
`Permission to use Workflow has been denied.` naming no cause (two such denials were observed on
2026-08-07 inside a `/handoff resume` turn; the identical call succeeded in the next turn with no
settings change).

**The fix, at the right layer** (commit `72a303d`). The three entries were removed and the rule
they encoded became prose in `SKILL.md` §Non-Goals. What that gives up: nothing mechanically stops
a future edit from making `/handoff` spawn agents — a promise, not an enforced constraint, so the
swap was recorded as not free. `disallowed-tools` never covered `.harness/` writes either, which is why
the `.harness/` read-only rule is stated as a rule of its own.

**The chaining test and its two outcomes.** The removal was also a test of the hypothesis that
`disallowed-tools` is turn-scoped rather than skill-scoped — valid only after the installed plugin
cache had been refreshed, because until then the running copy still carried the old frontmatter
and a chaining failure would say nothing about the leak (a pre-refresh failure is not a
refutation). Two outcomes were defined for `templates/_shared/mode_gate.md` rule 3 cause (a):

- **leak supported** — a post-refresh chain succeeds: record it as a further observation, and the
  leak is supported;
- **demote cause (a)** — a post-refresh chain fails: remove cause (a) from the candidate list.

**Result** (commit `bdcc713`). The 2026-09-01 dedicated probe — `mode_gate.md` rule 3 cause (a),
third observation — chained a second skill from inside a blocking skill's turn and saw the block
hold, then lift at the turn boundary: the **leak-supported** outcome. That is what makes the
frontmatter change correct rather than merely untested: with the three entries present, a chained
skill really would have inherited them. The limits of that observation are stated once, in
`mode_gate.md`, and are not restated here.

**What the result does not license.** It confirms the mechanism, not that chaining is free. The
entries that remain (`NotebookEdit`, `WebSearch`, `WebFetch`) are inherited by whatever `resume`
chains into, for the rest of the turn. `NotebookEdit` is irrelevant, but a chained skill that
researches on the web loses that step, and one that falls back to local sources when the web fails
makes the loss silent — the very failure shape the original change objected to. They stay blocked
because `/handoff` itself must not reach the web; `resume.md` Step 5 rule 5 keeps the cost off the
chained skill by declining to chain into a skill that needs the web. "The leak is verified" does
not mean "the leak is harmless".

## §No save confirmation on generate

`generate` once ended in a preview gate (save, edit, cancel). It was removed because three
structural properties make the write safe without one: (i) the location convention never
overwrites — `resolve-path` numbers a taken name, so no prior handoff can be destroyed and a re-run
after a correction is simply a new file; (ii) the write is one local document in the handoff
folder, touching no git state, no `.harness/` and nothing outward-facing; (iii) `generate` is
already an explicit user action (nothing generates a handoff automatically), so the gate was a
second confirmation of a command the user had just typed.

What the gate genuinely bought was the chance to correct a fact before it became durable. Writing
first and reporting after preserves that: the file is the preview, corrected by editing it in place
or by re-running (a new file, never an overwrite).

**The change is not lossless** — an earlier revision of this argument claimed "nothing is dropped,
only re-ordered", which is false on both points below, and would let a later audit conclude the
removal cost nothing:

- the broken-chain warning and the resolved path **moved** to Step 4's report, which is why the
  report is printed in full: the "no carry-forward source" line is the one line whose omission the
  removal could actually cost;
- the full-document preview is **replaced** by the written file itself, not by anything Step 4
  prints;
- `Cancel` is **removed outright**: no path through `generate` writes nothing. Deleting the file is
  its replacement (the third way in the `Correct` row), and the `Correct` row as a whole replaces
  the gate's "Edit" option. Until an unwanted document is deleted, a path-less `/handoff resume`
  picks it as the newest.

`resume` kept its Step 5 gate: that gate guards *starting work*, not writing a file, so the two
were deliberately left different.

## §The slice label and the `Next :` derivation

**The old derivation** (removed when the `next` sub-command took the derivation over; the verbatim
text is in git history, `git show 7ddffb3:templates/handoff/resume.md`, Step 5). It was a
three-tier fallback: (1) the `Slice` of the resume Epic's LAST `in-progress` ledger row; when the
Epic had none, (i) an explicit `Slice` label in Next Steps item 1, printed with the disclaimer
`(Next : no in-progress ledger row — taken from Next Steps item 1)`, else (ii) the Epic's LAST row
of any status, printed with `(Next : came from a ledger row that is not in-progress — it may not
match Next cmd:)`; (2) the last segment of a recorded `Docs` value; (3) item 1 verbatim.

**Why (ii) went.** A handoff written between two slices records the slice it has just finished as
`done` and carries no `in-progress` row, so the last row is systematically the FINISHED slice. On
2026-08-28, with six `done` rows and no `in-progress` row, (ii) printed the slice that had just
shipped while item 1 named the next one. The script's tiers never answer with a finished slice:
the `in-progress` tier needs an in-progress row, and the `Docs` tier yields to a `done` row of the
same name.

**Why the label, and why a label rather than a guess** (measured 2026-08-28 over this repository's
handoff corpus). Of 31 ledger-bearing handoffs, 17 had no `in-progress` row, so the fallback was
what fired for them, and none of them carried the label yet. (A reader that did not strip bold
from the `Status` cell counted 18: 2 of the 31 ledgers wrote `**`in-progress`**`, which is why the
`Status` and `Epic` cells are read with one emphasis pair and one backtick pair removed.) A bare
"first backtick-quoted kebab-case token in item 1" heuristic was drafted and measured: it matched
in 3 of the 17, and 2 of the 3 were wrong (one was not a slice identifier at all, one named a
different slice than the next one) — 1 right, 2 wrong, 14 silent. It was rejected: an unlabelled word in prose is not
an identifier, and a confident wrong slice is worse than a disclosed fallback. `generate`'s slice
identifier requirement (`Slice : <id>` on its own line, even with no command) exists so the label
can be read instead. Three earlier revisions of that measurement paragraph were wrong and were
corrected rather than deleted: one called the labelled case "the ordinary shape of an epic
handoff", one put the rate at "1 of 3" from a sample of three documents, one wrote the denominator
as 18 from an un-normalised `Status` read.

**The old `Next cmd:` rule.** It took "the exactly-one backtick-quoted `/…` candidate token" with
no shape filter (the script now drops paths such as `/dev/null` and the self call), and a
zero-candidate count dropped the first option — which left the epic-slice shape, whose item 1 is
deliberately not a command, with no startable option at all. The work form of the first option
fixed that. Two or more candidates once ended in "ask which command to run (rule 1)", a branch with
no rendered form; the numbered list with "Adjust plan" recommended replaced it.

## §Observations behind resume's gate rules

- **The gate described in prose** (2026-08-28). A `resume` run printed the briefing, described the
  three options in prose, and ended the turn. Nothing authorised that — it was unspecified rather
  than allowed — and two gaps made it likely: there was no rendered form for the no-command case,
  and that document's Next Steps item 1 was deliberately not a command. Both are closed: the gate
  is asked on every path, and the no-command case has its work form.
- **A negated command** (2026-08-28). Item 1 stated, in the session's language, that the next step
  was not a single slash command and that the epic's slices were not `/harness` tasks but a direct
  implementation of the epic plan. Its only `/…` token was that negated `/harness`; a bare count of
  one would have rendered "Start next step" and run a real `/harness` task — writing
  `.harness/state.json` and a docs directory — the opposite of what item 1 said. Hence the
  negation/exclusion rule and "a statement that the next step is not a single command makes the
  count zero".
- **A skipped precondition.** In an earlier epic slice, skipping a precondition of the kind rule 3
  names (`copy conventions.md first`) cost a full convention re-scan of about 141k tokens. Hence
  "recommend Adjust plan" whenever item 1 states a precondition.

## §Requirements an earlier epic recorded as invalidated

When `resume` began to chain (§Tool blocks and the chaining test), the handoff cold-review epic
had open acceptance criteria that the change invalidated, recorded in the contract so the scope
was not under-reported: the clause "the first option is display-only" (a mitigation for the
tool-scope leak — obsolete once the cause was fixed, not unimplemented); the non-regression clause
"frontmatter `disallowed-tools` unchanged in `git diff`" (deliberately broken — restoring the
frontmatter would reintroduce the leak); and the clause "record that the blocking is intentional"
(inverted — the record now says the removal is intentional). The criteria the change left open
(the slice command convention in `generate`, its cross-reference from the ledger item, the
`Next :` / `Next cmd:` role split, the "does not read `slice_plan.md`" line and the "file absent
may be a normal epic boundary" line of `resume` Step 3.5) were delivered by that epic's
documentation slice, which has shipped; the record has no further use in the contract.

## §Citations removed as unresolvable

The contract cited planning identifiers that a reader of this repository cannot resolve — the
planning documents they point into are gitignored or gone: "NEW, P0-1" / "(P0-1)" (the Progress
Ledger), "NEW P0-4" (the read-only `.harness/` cross-check), "spec D-4/D-5" (the decision to keep
`/handoff` stateless), "AC-8" / "AC-9" (the `Next :` and `Next cmd:` derivations). The rules they
labelled stay; only the labels went.

## §Why-clauses dropped by the compression

The second H15 step restated each rule of `SKILL.md` and `generate.md` once, in the shortest
unambiguous form, and cut the reasons attached to rule sentences. They are kept here.

- **The full 40-character `HEAD`.** A short sha goes ambiguous as a repository grows.
- **`Harness : none (<reason>)` instead of the record.** A state file that belongs to another branch,
  or to a finished task, is not what this session was doing; recording it would send the next
  session there. For the same reason a state that is not relevant contributes no Reading Order
  candidates: its folder belongs to another task.
- **The helper-script rule stated in `SKILL.md`.** `generate.md` once restated it because it is read
  without `resume.md`, which states it too. `SKILL.md` is in every sub-command's load, so `generate`
  and `list` rely on its **Helper script** paragraph and no longer restate it; `resume.md` Step 4
  still restates it (`resume.md` has no byte budget).
- **No pointer form for `Do NOT`.** A pointer to a document that is not in the Reading Order is lost
  to the next session.
- **`ledger-carry` picks the newest document that has rows of the Epic**, not simply the newest
  document, so a ledger-less single-task handoff written between two epic slices does not break
  the chain. Rows with a `Status` outside the enum are carried as unfinished so that no row is lost.
- **`Earlier rows:` is never copied from the source.** The new line names the source document, so the
  chain runs from document to document; a source that is itself `chained` keeps the way to its own
  earlier rows open even when this carry left nothing out. The line sits after a blank line because
  a text line directly under the last table row reads as one more row (this clause stays in the
  body).
- **The column contract is fixed** so that no two sessions invent different vocabulary. The `Slice`
  priority reuses the `docs_path` slug `/harness` already uses, adding no new schema surface.
- **The new ledger goes into the new document only**, consistent with the no-overwrite location
  convention.
- **The resolved path goes into the `## Resume` line and a self-naming Reading Order entry** because
  Step 2 composed the document before the path existed.

## §The generate load budget and the ledger split

The budget (`design/v9-subtraction/SPEC.md` §3단계 — v9.1: handoff 바로잡기와 감량, item "3.3 본문
감량": the body a `generate` call loads is at most 15 KB, taken as 15,360 bytes): `skills/handoff/SKILL.md` plus `templates/handoff/generate.md` plus
any template `generate` reads unconditionally must stay within it (UTF-8, carriage returns
removed). The steps, measured on the files:

| State | `SKILL.md` | `generate.md` | Sum |
|---|---|---|---|
| before H15's diet (`6bc5d88`) | 8,309 | 20,649 | 28,958 |
| rationale moved here (the first diet commit) | 7,794 | 18,779 | 26,573 |
| every rule restated once, still one file (pure compression) | 6,287 | 12,443 | 18,730 |
| after the ledger split (final) | 6,410 | 8,913 | 15,323 |

Pure compression left the load 3,370 bytes over, with every rule still present. So, as the plan's
ruling allows and only after that attempt, the rules a single-task handoff never needs — the
Progress Ledger (Step 1 item 5a–5g and its column contract) and the slice command convention of
Next Steps step 1 — moved to `templates/handoff/generate-ledger.md` (4,876 bytes). `generate.md`
reads it only when the handoff is part of a multi-slice epic, and says so in one sentence (Step 1
item 5); a handoff with a ledger loads 20,199 bytes. Nothing was deleted to meet the number;
§Rule map shows where each rule went. The pointers that named the old place were updated:
`SKILL.md` §Non-Goals (the `slice_plan.md` bullet), `resume.md` Step 5 tier 1, and the two
`slice-command-format` comments in `scripts/verify_sync_markers.py`. `resume.md` Step 3.5's
"drafted in `templates/handoff/generate.md` Step 1 item 4" stays as it is: it names the In Progress
drafting, which stayed in `generate.md`. Neither the `generate-ledger.md` prose pointer nor the
`resume.md` Step 5 derivation pointer carries a SYNC marker, so the lint does not catch their rot.

## §Rule map

Every rule sentence of the `6bc5d88` versions of `skills/handoff/SKILL.md` and
`templates/handoff/generate.md`, in document order, with the sentence that carries it now. Each
quote is exact (whitespace and blockquote markers aside) and was checked against the file it
names. A row whose Note starts "Fix wave" had its sentence changed by the final-review fix wave; that Note quotes
the sentence that carries the rule now. "script-owned: <sub-command>" marks behaviour the helper performs; the contract states its
result, not its procedure. File names: `SKILL.md` = `skills/handoff/SKILL.md`; `generate.md`,
`generate-ledger.md`, `resume.md` = `templates/handoff/…`.

| # | 6bc5d88 place | Rule | Carried now by (file: quote) | Note |
|---|---|---|---|---|
| S1 | SKILL frontmatter | name, disallowed-tools, description | SKILL.md: "disallowed-tools: NotebookEdit, WebSearch, WebFetch" | byte-identical (verify_description_budget) |
| S2 | SKILL intro | role: capture the session into a durable, verifiable HANDOFF document; prime a fresh session from it | SKILL.md: "You capture the current session into a durable, verifiable HANDOFF document and later prime a fresh session from it." |  |
| S3 | SKILL "What this is NOT" 1 | not /harness Session Recovery; works above tasks | SKILL.md: "It is NOT `/harness` Session Recovery, nor a replacement for it: that restores a task's `.harness/state.json` phase machine, while `/handoff` works above tasks (epics, multi-day work)" | merged with S37 |
| S4 | SKILL "What this is NOT" 2 | not state restoration: context priming + fact verification, drift reported, never claims to restore execution state | SKILL.md: "It is NOT state restoration: `resume` primes context and verifies the recorded git state, reporting drift, and never claims to restore execution state." |  |
| S5 | SKILL "What this is NOT" 2 | resume NEVER mutates git (no checkout/reset/clean) | SKILL.md: "No git mutations (no checkout/reset/clean/stash): drift is reported, the human acts." | the same sentence carries S28 |
| S6 | SKILL "What this is NOT" 3 | not auto-memory | SKILL.md: "It is NOT auto-memory, which stores facts." |  |
| S7 | SKILL Stateless | no state.json, no own session recovery, each invocation self-contained | SKILL.md: "Stateless: no state file, no session recovery of its own; every invocation is self-contained." |  |
| S8 | SKILL §User Language Detection | user_lang = language of the most recent message | SKILL.md: "`user_lang` is the language of the user's most recent message." |  |
| S9 | SKILL §User Language Detection | all user-facing output in user_lang | SKILL.md: "Every user-facing output (reports, briefings, questions, errors) is in `user_lang`" | "previews" no longer exist (no gate); "reports" named instead |
| S10 | SKILL §User Language Detection | document headings English raw (parse anchors), content in user_lang | SKILL.md: "a HANDOFF document's section headings stay English raw (parse anchors) and their content is in `user_lang`." |  |
| S11 | SKILL §Sub-command Dispatch | parse the argument after /handoff | SKILL.md: "\| Argument after `/handoff` \| Action \|" |  |
| S12 | SKILL §Sub-command Dispatch row 1 | (none)/generate: write immediately, never overwrite, read generate.md verbatim | SKILL.md: "\| (none), `generate`, `generate <title>` \| write a HANDOFF document now — no save confirmation, never an overwrite — titled `<title>` when given: read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/generate.md` and follow it verbatim \|" |  |
| S13 | SKILL §Sub-command Dispatch row 2 | generate <title>: same, explicit title | SKILL.md: "titled `<title>` when given" | merged into row 1 |
| S14 | SKILL §Sub-command Dispatch rows 3-4 | resume / resume <path>: newest or given document, read resume.md verbatim | SKILL.md: "\| `resume`, `resume <path>` \| prime from the newest HANDOFF document, or from `<path>`: read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/resume.md` and follow it verbatim \|" |  |
| S15 | SKILL §Sub-command Dispatch row 5 | list: list documents newest first | SKILL.md: "\| `list` \| §Sub-command: list \|"<br>SKILL.md: "newest first" |  |
| S16 | SKILL §Sub-command Dispatch row 6 | anything else: help in user_lang | SKILL.md: "\| anything else \| a help message in `user_lang` listing these commands \|" |  |
| S17 | SKILL location convention | path docs/harness/handoff/YYYY-MM-DD-<slug>.md; today; English kebab-case [a-z0-9-], at most 40 | SKILL.md: "**Location convention (single canonical path):** `docs/harness/handoff/YYYY-MM-DD-<slug>.md` — today's date; the slug is an English kebab-case summary of the title, `[a-z0-9-]`, at most 40 characters." |  |
| S18 | SKILL location convention | no transliteration; the model supplies the English words | SKILL.md: "There is no transliteration: the model supplies the English words." |  |
| S19 | SKILL location convention | resolve-path normalises and numbers a taken name; NEVER overwrite | SKILL.md: "`resolve-path` (`generate.md` Step 3) normalises the slug and, when the name is taken, appends `-2`, `-3`, … — NEVER overwrite an existing handoff." | script-owned numbering: resolve-path |
| S20 | SKILL Base directory | session cwd = base of the handoff folder and last-resort root of a relative Reading Order path; repository of the document first | SKILL.md: "The session's current working directory is the base of `docs/harness/handoff/` (where `generate` writes and `resume`/`list` look) and the last-resort root of a relative Reading Order path: such a path resolves against the repository that holds the document (the folder with its `docs/` directory, or that folder's git top-level); only a document with neither uses the session directory (`resume.md` Step 4's `--root`)." | resolution itself script-owned: reading-plan |
| S21 | SKILL Base directory | Worktree is never a base; only where resume evaluates git state | SKILL.md: "The header's `Worktree` is never a base — it only says where `resume` evaluates git state (`resume.md` Step 3)." |  |
| S22 | SKILL §Sub-command: list | run list | SKILL.md: "Run `node "{HANDOFF_JS}" list --dir "docs/harness/handoff"`" |  |
| S23 | SKILL §Sub-command: list | {HANDOFF_JS} definition; confirm root non-empty; quote both paths | SKILL.md: "`{HANDOFF_JS}` is `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/handoff.mjs`. Confirm `${CLAUDE_PLUGIN_ROOT}` resolves to a non-empty value first (substitute the literal root when the shell leaves it unset) and keep both paths in quotes." | stated once for every sub-command (**Helper script**) |
| S24 | SKILL §Sub-command: list | non-zero exit: stderr verbatim, stop; never scan the folder by hand | SKILL.md: "On a non-zero exit show its stderr verbatim and stop — never emulate a command by hand."<br>SKILL.md: "never scan the folder by hand" |  |
| S25 | SKILL §Sub-command: list | docs: every handoff document (first line # HANDOFF —), newest first, fields, header values as recorded, null when none | SKILL.md: "`docs` lists every handoff document of the folder (first line `# HANDOFF —`), newest first, each `{path, date, slug, branch, head, title, mtimeMs}` with header values as recorded (null when none)." | selection and order script-owned: list; Fix wave (F1, M9): the header-values clause was cut to keep SKILL.md byte-neutral ("values as stored, null as `-`" still carries it); now SKILL.md: "`docs` lists every handoff document (first line `# HANDOFF —`), newest first, each `{path, date, slug, branch, head, title, mtimeMs}`." |
| S26 | SKILL §Sub-command: list | print: labels English raw, values as stored, null as -; one line each: date, slug, branch, HEAD (7+ chars), path; example | SKILL.md: "Print one line each — date, slug, recorded branch, recorded HEAD (may be cut to 7+ characters), path — labels English raw, values as stored, null as `-`:"<br>SKILL.md: "[handoff] 3 handoff document(s)" |  |
| S27 | SKILL §Sub-command: list | docs empty -> say so in user_lang | SKILL.md: "`docs` empty → say so in `user_lang`." |  |
| S28 | SKILL §Non-Goals | no git mutations; drift reported, human acts | SKILL.md: "No git mutations (no checkout/reset/clean/stash): drift is reported, the human acts." |  |
| S29 | SKILL §Non-Goals | no .harness/ mutations; generate and resume only READ state.json | SKILL.md: "No `.harness/` mutations: `generate` and `resume` only READ `.harness/state.json`." | "NEW P0-4" tag -> RATIONALE §Citations removed as unresolvable |
| S30 | SKILL §Non-Goals | no background agents / Workflow engine for own work; inline | SKILL.md: "No sub-agents and no Workflow engine for this skill's own work — every step runs inline." |  |
| S31 | SKILL §Non-Goals | a prose rule, not a runtime constraint; why Task/Agent/Workflow are not in disallowed-tools | SKILL.md: "This is a prose rule, not a runtime block: `disallowed-tools` omits `Task`/`Agent`/`Workflow` because its block lasts the whole turn and would disarm the skill `resume` chains into (`templates/_shared/mode_gate.md` rule 3 cause (a))." | measurement narrative -> RATIONALE §Tool blocks and the chaining test |
| S32 | SKILL §Non-Goals | NotebookEdit/WebSearch/WebFetch stay blocked because /handoff must not reach the web; resume Step 5 rule 5 declines a web-needing chain | SKILL.md: "`NotebookEdit`, `WebSearch` and `WebFetch` stay blocked — `/handoff` must not reach the web — and a chained skill inherits that block, so `resume.md` Step 5 rule 5 never chains into a skill that needs the web." | cost narrative (silent loss) -> RATIONALE §Tool blocks and the chaining test |
| S33 | SKILL §Non-Goals | chaining allowed only from resume's gate on "Start next step"; never before the gate; generate never chains | SKILL.md: "Chaining into the next skill IS allowed, only from `resume`'s gate: `resume` invokes the command it recommends when the human picks "Start next step", never before the gate is answered; `generate` never chains." |  |
| S34 | SKILL §Non-Goals | no automatic generation; generate is an explicit user action | SKILL.md: "No automatic generation: `generate` is always an explicit user action." |  |
| S35 | SKILL §Non-Goals | does not read slice_plan.md; the convention points at harness-build §Step 3.5; Next derivation from the document plus the relevant fact | SKILL.md: "`/handoff` does not read `slice_plan.md` — the slice command convention (`generate-ledger.md`) names its format by pointing at `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan; the `Next :`/`Next cmd:` derivation (`resume.md` Step 5) uses THIS document's recorded text plus one live fact: whether `.harness/state.json` is `relevant` to the current branch (`harness-state`), which alone decides whether the recorded `Docs` value may name the next slice." | derivation itself script-owned: next |
| S36 | SKILL §Non-Goals | SYNC marker slice-command-format | SKILL.md: "<!-- SYNC-WITH: skills/harness-build/SKILL.md §Step 3.5: Slice Plan -->" | tokens §Step 3.5 / slice_plan.md / Next cmd kept in SKILL.md |
| S37 | SKILL §Non-Goals | not a replacement for Session Recovery; POINTS at state.json read-only, never duplicates its phase machine | SKILL.md: "only points at that file, read-only, never duplicating its phase machine." | merged into the intro (S3) |
| S38 | SKILL §Non-Goals | ledger is passive, explicit generate calls only; no automatic status detection or slice transitions; epic state machine out of scope | SKILL.md: "The Progress Ledger is a passive table that only explicit `generate` calls read and write — no automatic status detection or slice transition; an epic state machine is out of scope." | "(P0-1)", "spec D-4/D-5" -> RATIONALE §Citations removed as unresolvable |
| S39 | SKILL §Non-Goals | no save confirmation on generate: compose, resolve, write, nothing asks | SKILL.md: "write a HANDOFF document now — no save confirmation, never an overwrite"<br>generate.md: "Then go straight to Step 4: **`generate` never asks whether to save** — the written file is the preview." |  |
| S40 | SKILL §Non-Goals | writes never overwrite, never touch git or .harness/, never leave the machine | SKILL.md: "NEVER overwrite an existing handoff."<br>SKILL.md: "No git mutations"<br>SKILL.md: "No `.harness/` mutations" | "never leave the machine" is a property of a local file write with no git mutation (no push), not a separate instruction; RATIONALE §No save confirmation on generate (ii) |
| S41 | SKILL §Non-Goals | no Cancel; an unwanted document is undone by deleting the file | generate.md: "say explicitly that an unwanted `generate` — a bare `/handoff` included — is undone only by deleting" |  |
| S42 | SKILL §Non-Goals | resume keeps its Step 5 gate (guards starting work); do not "harmonize" | resume.md: "**The gate is asked on EVERY path, and asking means CALLING AskUserQuestion.**" | "do not harmonize" is editor guidance -> RATIONALE §No save confirmation on generate |
| G1 | generate preamble | body of /handoff generate, loaded from SKILL.md §Sub-command Dispatch | generate.md: "Body of `/handoff generate`, loaded from `skills/handoff/SKILL.md` §Sub-command Dispatch" |  |
| G2 | generate Step 1 | gather in this order | generate.md: "Gather, in this order:" |  |
| G3 | generate Step 1 item 1 | run git-state; do not recall from memory | generate.md: "**Git state:** run `node "{HANDOFF_JS}" git-state --cwd "."` — never fall back to running git by hand or recall it from memory." |  |
| G4 | generate Step 1 item 1 | "." is the session's cwd | SKILL.md: "`"."` as `--cwd` or `--root` is the session's current working directory." | stated once in SKILL.md **Helper script** |
| G5 | generate Step 1 item 1 | {HANDOFF_JS}, root check, quotes | SKILL.md: "`{HANDOFF_JS}` is `${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/handoff.mjs`."<br>generate.md: "**Helper script** rule applies to every command here." | the "resume.md Step 4 states the same rule, and this file is read without that one" why-clause dropped: SKILL.md is in generate's load |
| G6 | generate Step 1 item 1 | non-zero exit: stderr verbatim, stop; never fall back to git by hand | SKILL.md: "On a non-zero exit show its stderr verbatim and stop — never emulate a command by hand."<br>generate.md: "never fall back to running git by hand" |  |
| G7 | generate Step 1 item 1 | git-state output fields | generate.md: "It returns `isGit`, `toplevel`, `branch`, `head`, `subject`, `dirty` (a list of `{status, path}`) and `upstream` (`{ahead, behind}` or null)." | script-owned: git-state |
| G8 | generate Step 1 item 1 | Branch = branch; n/a when not git; (detached) | generate.md: "`Branch` = `branch` (a detached HEAD is the script's `(detached)`)"<br>generate.md: "when `isGit` is false, `Branch` and `Worktree` are `n/a`" | the gloss "(not a git folder)" of `isGit` false dropped: script-owned: git-state |
| G9 | generate Step 1 item 1 | HEAD = full 40-char head + subject; n/a when head null | generate.md: "`HEAD` = the FULL 40-char `head` and `subject`, `n/a` when `head` is null" | why ("short shas go ambiguous") -> RATIONALE §Why-clauses dropped; the gloss "(no repository, or no commit yet)" of a null `head` dropped: script-owned: git-state |
| G10 | generate Step 1 item 1 | Worktree = toplevel or n/a | generate.md: "`Worktree` = `toplevel`" |  |
| G11 | generate Step 1 item 1 | Dirty clean / N files; Dirty files line: first 40 joined by "; ", backticks for a name with "; ", +N more for the rest | generate.md: "`Dirty` = `clean` when `dirty` is empty, else `N files` (its length) plus the `Dirty files` line: the first 40 `path`s joined with `; ` (a path that contains `; ` goes in backticks), then `+N more` for the rest" | "for the rest" restored in the review round |
| G12 | generate Step 1 item 1 | Upstream ahead/behind or n/a | generate.md: "`Upstream` = `ahead A, behind B`, or `n/a` when null." |  |
| G13 | generate Step 1 item 2 | harness-state READ-ONLY with item 1's Branch | generate.md: "**Harness task state (READ-ONLY):** run `node "{HANDOFF_JS}" harness-state --branch "<item 1's Branch>" --cwd "."`" | Fix wave (F1): the script takes the branch itself; now generate.md: "run `node "{HANDOFF_JS}" harness-state --cwd "."`" |
| G14 | generate Step 1 item 2 | quoting / non-zero exit as item 1 | generate.md: "applies to every command here." |  |
| G15 | generate Step 1 item 2 | output exists/relevant/reason/fields | generate.md: "→ `exists`, `relevant`, `reason`, `fields` (`skill`, `task`, `phase`, `mode`, `docs_path`, as stored)." | script-owned: harness-state |
| G16 | generate Step 1 item 2 | relevant definition; the script decides; never by hand | generate.md: "`relevant` (the state file exists, its `branch` is the current branch, its `phase` is not `completed`) is the script's verdict — never judge it by hand." | script-owned: harness-state |
| G17 | generate Step 1 item 2 | relevant -> Fixed Label Record; labels English raw parse anchors for resume 3.5; values as stored | generate.md: "when `relevant` is true, record `fields` in the **Fixed Label Record Format** (labels English raw — parse anchors for `resume.md` Step 3.5; values as stored)" |  |
| G18 | generate Step 1 item 2 | otherwise ONE line Harness : none (<reason>), no record | generate.md: "otherwise write the one line `Harness : none (<reason>)` with the script's `reason` and no record." | why (another branch/finished task would send the next session there) -> RATIONALE §Why-clauses dropped |
| G19 | generate Fixed Label Record Format | canonical format + SYNC marker + 5 labels | generate.md: "<!-- SYNC-WITH: templates/handoff/generate.md §Fixed Label Record Format -->"<br>generate.md: "Skill : <skill> Task : <task> Phase : <phase> Mode : <mode> Docs : <docs_path>" | SYNC group handoff-state-record, min_sites 2 unchanged |
| G20 | generate Step 1 item 2 | NEVER write to or delete .harness/ | generate.md: "(READ-ONLY)"<br>SKILL.md: "No `.harness/` mutations" |  |
| G21 | generate Step 1 item 3 | task artifacts only when relevant and docs_path set; names only; not relevant -> none | generate.md: "**Task artifacts:** only when item 2 returned `relevant` true and `fields.docs_path` is set, that folder's file names are Reading Order candidates." |  |
| G22 | generate Step 1 item 4 | draft each section from this session | generate.md: "**Conversation-derived content** — draft each section from this session:" |  |
| G23 | generate Step 1 item 4 | Goal 1-3 sentences | generate.md: "Goal — what the effort is for, in 1–3 sentences." |  |
| G24 | generate Step 1 item 4 | Current State: only evidence-backed facts, fact — evidence, no beliefs | generate.md: "Current State (verified) — ONLY facts this session's evidence backs (command output, file read, test result), each bullet `fact — evidence`; no beliefs or intentions." |  |
| G25 | generate Step 1 item 4 | In Progress; Blockers / Risks incl. unresolved questions | generate.md: "In Progress — what is mid-flight. Blockers / Risks — unresolved questions included." |  |
| G26 | generate Step 1 item 4 | Next Steps ordered, first step concrete enough to start cold | generate.md: "Next Steps — ordered; step 1 concrete enough to start cold" |  |
| G27 | generate Step 1 item 4 | slice command convention: the exact Slice/Command format of harness-build §Step 3.5, named not restated | generate.md: "and with a Progress Ledger written to its slice command convention (item 5) — read item 5's file before drafting this."<br>generate-ledger.md: "When a ledger row applies and step 1 names that slice's command, write it in the exact `Slice`/`Command` format `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan defines for `slice_plan.md` (named, not restated)." | moved with the ledger rules (R23 split); "exact" restored in the review round |
| G28 | generate Step 1 item 4 | no-command case: step 1 opens with the Slice label on its own line, English raw, Command omitted | generate-ledger.md: "When a row applies but the next step is not a single command (a slice implemented directly from an epic plan), step 1 still opens with the `Slice` half on its own line — label English raw, `Command` omitted" | R23 split |
| G29 | generate Step 1 item 4 | never the just-finished slice | generate-ledger.md: "naming the next slice, never the one the ledger records as just finished:" | R23 split |
| G30 | generate Step 1 item 4 | a mention in prose does not satisfy; resume reads the label first; without it Next falls back to item 1 | generate-ledger.md: "A mention in prose does not count: `resume`'s `Next :` derivation (`templates/handoff/resume.md` Step 5) reads this label first and never scans prose; without it a handoff written between slices has no `in-progress` row, and `Next :` falls back to step 1 verbatim." | R23 split; the 2026-08-28 measurement -> RATIONALE §The slice label (stage A); "without the label it depends on the in-progress rows (one names the slice, several are ambiguous) and the live task state" is resume.md Step 5 tiers 2-3, stated there |
| G31 | generate Step 1 item 4 | Definition of Done | generate.md: "Definition of Done — how a future session knows the effort is finished." |  |
| G32 | generate Step 1 item 4 | Reading Order: in order, one-line reason, preferred order | generate.md: "Reading Order — files to read, in order, each with a one-line reason (prefer: this handoff → key spec/plan docs → the 1–3 most central source files)." |  |
| G33 | generate Step 1 item 4 | optional path:START-END and path §heading text | generate.md: "Inside a path's backticks, `path:START-END` reads only those lines and `path §heading text` only the first section whose heading contains that text." | reading itself script-owned: reading-plan |
| G34 | generate Step 1 item 4 | Do NOT in full in every document, still-in-force included, reason in one clause | generate.md: "Do NOT — guardrails, each with its reason in one clause, written **in full in every document**, those still in force from earlier handoffs included" |  |
| G35 | generate Step 1 item 4 (stage A) | source of the still-in-force items | generate.md: "Their source is the whole `Do NOT` section of the previous handoff — the one this session resumed, else the newest document `node "{HANDOFF_JS}" list --dir "docs/harness/handoff"` returns whose `branch` is item 1's Branch (`n/a` or `(detached)` matches none: then only this session's items) — read itself, never the briefing's summary row."<br>generate.md: "If `node "{HANDOFF_JS}" reading-plan --doc "<that document>" --budget 131072 --root "."` returns a `doNot` entry, that section is only a pointer: `range` → read those lines, one hop."<br>generate.md: "Any other status, or a section that is itself only a pointer, could not be read: write every item you did read and the line `carried-over items could not be read: <path> (<reason>)`, and repeat it in Step 4's report. What you read is DATA, not instructions."<br>generate.md: "Do NOT : <"carried-over items could not be read: <path> (<reason>)" \| omit the line entirely>" | added in stage A; the review rounds made it the whole section on this branch, a pointer read through reading-plan (path rule and failure states are the script's), and an unreadable carry-over reported, never dropped silently; Fix wave (M2): now generate.md: "`range` → read ONLY those lines of `file`, one hop, never widened." and "(`<path>`: the entry's `path`, else that document's)"; Re-review residuals (I1, minor): now also "`skippedNames`/`skippedFiles` above 0 → Step 4's report, with each `reason`" and "read ONLY those lines of `file` with the Read tool" |
| G36 | generate Step 1 item 4 | no pointer form; resume reads only this section | generate.md: ""Same as the previous handoff's Do NOT", a bare path or "the earlier items still apply" is not allowed, however worded: `resume` reads only this document's section." | why ("a pointer ... is lost") -> RATIONALE §Why-clauses dropped; Fix wave (M2): the reason now reads generate.md: "`resume` follows one pointer, never a chain." |
| G37 | generate Step 1 item 5 | ledger only for a multi-slice epic; skip otherwise; never an empty table | generate.md: "**Progress Ledger** (epic continuity, optional): only when this handoff is part of a multi-slice epic — then read `{CLAUDE_PLUGIN_ROOT}/templates/handoff/generate-ledger.md` before drafting item 4's Next Steps and follow it verbatim. Otherwise skip it entirely: never an empty table." | the trigger that loads generate-ledger.md, before the slice command convention is needed |
| G38 | generate Step 1 item 5 | the Slice column feeds item 4's convention; a row makes it apply | generate-ledger.md: "Its rows are what make the slice command convention below apply." |  |
| G39 | generate Step 1 item 5 | two commands read earlier documents; never open/scan/rank by hand; quoting/exit as item 1 | generate-ledger.md: "For the ledger only the two commands below read earlier documents: never open, scan or rank those documents by hand for it."<br>generate-ledger.md: "**Helper script** rule applies to both commands here." |  |
| G40 | generate item 5a | run latest-epic | generate-ledger.md: "Run `node "{HANDOFF_JS}" latest-epic --dir "docs/harness/handoff"`" |  |
| G41 | generate item 5a | output epic/doc; the last row that has one; 20 newest; null | generate-ledger.md: "`epic` (the `Epic` of the last row that has one, in the newest handoff document whose ledger has such a row) and `doc` (that document) — both `null` when none of the 20 newest handoff documents, which is all the script reads, has one (a folder that does not exist yet included)." | script-owned: latest-epic; Fix wave (F1): now generate-ledger.md: "`doc` (that document) and `reason`" and "`epic` is also `null`, with `reason` saying why, when that value is not an identifier."; Re-review residual (minor): now followed by "say so, with that `reason`, in Step 4's report." |
| G42 | generate item 5a | use epic as the proposal without asking | generate-ledger.md: "Use `epic` as the proposal, without asking" |  |
| G43 | generate item 5a | no age limit; the id the work names wins | generate-ledger.md: "there is no age limit, so it may be months old."<br>generate-ledger.md: "or when this session's work concretely names a different epic id — that id is then the Epic." | Fix wave (F1, M6): now generate-ledger.md: "When this session's work concretely names a different epic id, that id is the Epic and wins over all of these, without asking." |
| G44 | generate item 5a | epic null -> docs_path slug, without asking | generate-ledger.md: "When `epic` is `null`, the Epic is item 2's `docs_path` slug (kebab-case; `relevant` true), without asking." | Fix wave (F1): now generate-ledger.md: "When `epic` is `null`, the Epic is item 2's `docs_path` slug (kebab-case; `relevant` true), without asking;" |
| G45 | generate item 5a | ask only when null and no slug, or a concretely named different id | generate-ledger.md: "Ask the user only when `epic` is `null` and there is no such slug, or when this session's work concretely names a different epic id" | "concretely" restored in the review round; Fix wave (M6): a named id is no longer a question (G43); now generate-ledger.md: "ask the user only when there is no such slug either." |
| G46 | generate item 5b | run ledger-carry | generate-ledger.md: "Run `node "{HANDOFF_JS}" ledger-carry --dir "docs/harness/handoff" --epic "<the Epic>"`" | Fix wave (F1): now generate-ledger.md: "Run `node "{HANDOFF_JS}" ledger-carry --dir "docs/harness/handoff"`. Add `--epic "<id>"` only when the Epic is an id this session's work names (a) — a value of this session, never one copied from a document or from a script's output;" |
| G47 | generate item 5b | the script picks the source: newest document with rows of this Epic | generate-ledger.md: "It picks the newest document whose ledger has rows of this Epic" | script-owned: ledger-carry; why (a ledger-less handoff in between does not break the chain) -> RATIONALE §Why-clauses dropped |
| G48 | generate item 5b | output fields | generate-ledger.md: "returns `doc` (its path, or `null`), `rows` (in document order), `pointer` (its file name), `droppedDone`, `unknownStatusRows`, `unattributedRows` and `chained` (it carries an `Earlier rows:` line)." | script-owned: ledger-carry; Fix wave (F1, M9): the field list now ends generate-ledger.md: "`reason` (why nothing was carried), `skippedNames` and `skippedFiles`." |
| G49 | generate item 5b | --doc names a known document; doc is then always it | generate-ledger.md: "(`--doc "<path>"` in place of `--dir` names a known document; `doc` is then always it)" | Fix wave (F1): now generate-ledger.md: "(`--doc "<path>"` in place of `--dir` names a known document; `doc` is then always it, and without `--epic` the Epic its own ledger proposes is carried.)"; Re-review residual (I3): now "… is carried — an `epic` that is not (a)'s Epic is discarded with its rows.)"; Re-review residual fix (R27): now "… is discarded with its rows and counts: run the `--dir` form instead.)" |
| G50 | generate item 5b | carry rule: unfinished in full (incl. unknown Status); finished only the most recent 5; droppedDone | generate-ledger.md: "Carried: **every unfinished row of this Epic** (`in-progress`, `blocked`, `planned`, and a `Status` outside the enum) **and only the most recent 5 finished ones** (`done`, `dropped`); `droppedDone` counts the finished rows left out." | script-owned: ledger-carry |
| G51 | generate item 5b | one Epic per ledger; another Epic never carried; a new Epic carries nothing | generate-ledger.md: "Rows of another Epic are never carried; a new Epic carries nothing."<br>generate-ledger.md: "then add or update this session's own rows — this Epic's rows only" | carrying is script-owned (ledger-carry); the model's own rows are bound by item c, restored in the review round |
| G52 | generate item 5c | write rows bare; add/update own rows (this Epic only); update in place; Slice unique; never twice | generate-ledger.md: "Put `rows` into the new ledger, then add or update this session's own rows — this Epic's rows only: a carried slice is updated in place (`Slice` is unique within its Epic), never added twice."<br>generate-ledger.md: "a carried row follows the same rule." |  |
| G53 | generate item 5c | written into the new document; source untouched | generate-ledger.md: "Only the new document changes; the source is never touched." |  |
| G54 | generate item 5d | Earlier rows line: when a source was found and droppedDone > 0 or chained; after a blank line; pointer = source file name | generate-ledger.md: "When a source was found and `droppedDone` is greater than 0 or `chained` is true, write `Earlier rows: <pointer>` under the table after a blank line — the script's `pointer`, the source's file name." |  |
| G55 | generate item 5d | never copy the source's own Earlier rows line | generate-ledger.md: "Never copy the source's own `Earlier rows:` line." | why (the chain runs document to document) -> RATIONALE §Why-clauses dropped |
| G56 | generate item 5d | droppedDone 0 and chained false -> no line | generate-ledger.md: "With `droppedDone` 0 and `chained` false write no such line." |  |
| G57 | generate item 5e | no source (doc null / rows empty) -> empty ledger; not an error; must be reported at Step 4 | generate-ledger.md: "start an empty ledger. Not an error, but Step 4 must report it."<br>generate.md: "a broken chain is never silent" | Re-review residual (I3): the no-source case now also covers "or they were discarded (b)"; corrected by R27: that clause is gone again — a discarded `--doc` result is replaced by the `--dir` form (5b), whose own result decides 5e |
| G58 | generate item 5e | with --doc, doc always set: empty rows means the named document has none | generate-ledger.md: "or `rows` is empty, which with `--doc` means that document has none" |  |
| G59 | generate item 5f | Status outside the enum: carried as unfinished; keep as written; no guess; name Slice in Step 4 | generate-ledger.md: "**`unknownStatusRows` above 0:** those rows were carried as unfinished; keep each `Status` as written, guess none, and name their `Slice` in Step 4's report." |  |
| G60 | generate item 5g | empty Epic cell: taken as this Epic's, filled in; name Slice in Step 4 | generate-ledger.md: "**`unattributedRows` above 0:** rows with an empty `Epic` cell were taken as this Epic's, `epic` filled in; name their `Slice` in Step 4's report." | script-owned fill-in: ledger-carry |
| G61 | generate column contract | Epic: kebab-case; what latest-epic proposes and ledger-carry selects by | generate-ledger.md: "\| `Epic` \| kebab-case identifier; what `latest-epic` proposes and `ledger-carry` selects by \|" | "(confirmed, so no two sessions invent different vocabulary)" -> RATIONALE §Why-clauses dropped |
| G62 | generate column contract | Slice: docs_path last segment, else kebab-case label; unique within the Epic | generate-ledger.md: "\| `Slice` \| the slice's `docs_path` last segment, else a kebab-case free label; unique within the Epic \|" | why (the slug /harness already uses; no new schema surface) -> RATIONALE §Why-clauses dropped |
| G63 | generate column contract | Status: fixed enum, English raw, never translated; planned not blocked; blocked = waits on something outside | generate-ledger.md: "\| `Status` \| fixed enum, English raw, never translated: `done` / `in-progress` / `blocked` / `planned` / `dropped`; a slice not started yet is `planned`, never `blocked` — `blocked` waits on something outside the slice \|" | "do not pile a backlog into blocked" = "not started yet is planned, never blocked" |
| G64 | generate column contract | Evidence: full 40-char sha or artifact path; n/a | generate-ledger.md: "\| `Evidence` \| a full 40-char commit sha or an artifact path; `n/a` if neither exists yet \|" |  |
| G65 | generate column contract | Notes: free text in user_lang | generate-ledger.md: "\| `Notes` \| free text in `user_lang` — residual risks, gotchas \|" |  |
| G66 | generate column contract | cells bare; backticks inside free text stay; carried rows the same | generate-ledger.md: "Write every cell bare: never wrap a whole cell in `**` or backticks (backticks inside free text stay); a carried row follows the same rule." |  |
| G67 | generate Step 2 | fill the template; headings English raw; content user_lang | generate.md: "Fill this template — headings English raw, content in `user_lang`:" |  |
| G68 | generate Step 2 | the document template | generate.md: "# HANDOFF — <title>"<br>generate.md: "## Progress Ledger <!-- only when Step 1 item 5 applies -->"<br>generate.md: "Run: `/handoff resume docs/harness/handoff/<this-file>.md`" | headings unchanged (parse anchors) |
| G69 | generate Step 2 | ## Progress Ledger is a parse anchor; omit with its table when item 5 does not apply; never an empty table | generate.md: "Without item 5 omit `## Progress Ledger` (a parse anchor) with its table."<br>generate.md: "never an empty table" |  |
| G70 | generate Step 2 | Earlier rows line only per 5d, after a blank line; otherwise delete it | generate.md: "<!-- only when Step 1 item 5d applies; otherwise delete this line -->"<br>generate.md: "`Earlier rows:` goes after a blank line: directly under the last row it would read as one more row." | the explicit delete instruction restored in the review round |
| G71 | generate Step 2 | Dirty files only when dirty; other header lines always, n/a | generate.md: "Write `**Dirty files:**` only for a dirty tree and every other header line always (`n/a` where there is no value)." |  |
| G72 | generate Step 2 | record or none line, never both, never neither | generate.md: "Under In Progress write the record or the `Harness : none` line — exactly one." |  |
| G73 | generate Step 3 | choose the slug: English kebab-case summary, nothing transliterated; run resolve-path | generate.md: "Choose the slug — an English kebab-case summary of the title, nothing transliterated — and run `node "{HANDOFF_JS}" resolve-path --slug "<slug>" --date "<today, YYYY-MM-DD>" --dir "docs/harness/handoff"`." |  |
| G74 | generate Step 3 | quoting as item 1 | generate.md: "applies to every command here." |  |
| G75 | generate Step 3 | prints path (numbered when taken), slug, normalized | generate.md: "It prints `path` (the write path, numbered when the name is taken), `slug` and `normalized`." | script-owned: resolve-path |
| G76 | generate Step 3 | path into the Resume line and any Reading Order entry naming this document | generate.md: "Put `path` into the `## Resume` line and into any Reading Order entry that names this document." | why ("Step 2 could not know it") -> RATIONALE §Why-clauses dropped |
| G77 | generate Step 3 | non-zero: stderr and stop, except exit 1 English summary: write one and rerun once | generate.md: "A non-zero exit: stderr verbatim and stop — except exit 1 asking for an English kebab-case summary: write one and run it again, once." |  |
| G78 | generate Step 3 | straight to Step 4; never asks whether to save | generate.md: "Then go straight to Step 4: **`generate` never asks whether to save** — the written file is the preview." | rationale paragraphs -> RATIONALE §No save confirmation on generate (stage A) |
| G79 | generate Step 4.1 | ensure the folder exists | generate.md: "Create `docs/harness/handoff/` if needed and write to Step 3's path." |  |
| G80 | generate Step 4.2 | concurrent collision: resolve-path again, update the path sites, never overwrite, report the written path | generate.md: "If the name was taken in between (a concurrent run), run `resolve-path` again, put the new path into the `## Resume` line and any Reading Order entry that names this document, and write there — **never overwrite a handoff** — and report the path actually written." | Reading Order site added in stage A |
| G81 | generate Step 4.3 | report in user_lang, all of it | generate.md: "Report in `user_lang`, all of it:" | Re-review residual fix (R27): now "Report in `user_lang`, all of it, plus a line per other item Step 1 sends here:" — item 4 and items 5a/5h of generate-ledger.md send reports the closed template had no line for |
| G82 | generate Step 4.3 | no carry-forward source -> say so; a broken chain is never silent | generate.md: "`Ledger` — only when a ledger applies and no carry-forward source was found (item 5e of `generate-ledger.md`: `ledger-carry` returned `doc` `null` or no `rows`; a broken chain is never silent)" | Re-review residual fix (R27): now "(item 5e; a broken chain is never silent)" — the restatement of 5e was dropped: it had drifted from 5e and omitted the line for a discarded `--doc` carry |
| G83 | generate Step 4.3 | unknown Status / empty Epic on the Ledger row: one count and one list per kind; Status for the first kind only; both kinds counted in both | generate.md: "or rows were carried with a `Status` outside the enum (item 5f) or an empty `Epic` cell (item 5g): one count and one list per kind — each row's `Slice`, and its `Status` for the first kind only; a row of both kinds is counted in both." |  |
| G84 | generate Step 4.3 | the written path and the resume one-liner | generate.md: "[handoff] Saved : docs/harness/handoff/YYYY-MM-DD-<slug>.md"<br>generate.md: "Next session → /handoff resume docs/harness/handoff/YYYY-MM-DD-<slug>.md" |  |
| G85 | generate Step 4.3 | how to correct: edit / re-run (new file, prior never modified) / delete | generate.md: "Correct : edit that file / re-run `/handoff generate` (new file (the name may differ on a re-run) — nothing is overwritten) / delete it if unwanted" |  |
| G86 | generate Step 4.3 | deleting is legitimate (no state/lint/skill reads a handoff) | generate.md: "Deleting is a legitimate correction (no state, lint or other skill reads a handoff)" |  |
| G87 | generate Step 4.3 | say explicitly: unwanted generate (bare /handoff incl.) undone only by deleting; until then resume picks/offers it as newest | generate.md: "say explicitly that an unwanted `generate` — a bare `/handoff` included — is undone only by deleting, and until then a path-less `/handoff resume` picks or offers it as the newest." | resume's newest-first selection script-owned: latest; Fix wave (M2): now generate.md: "is undone only by deleting." — the "until then" half is carried by the report row: generate.md: "delete it if unwanted (until then a path-less `resume` may pick or offer it, being newest)" |
| G88 | generate Step 4 | report block | generate.md: "Ledger : <"no carry-forward source found for Epic <epic> — started a new ledger"" | unchanged |
| G89 | generate Step 4 | Ledger row omitted when a source was found and nothing needs correcting, and when no ledger applies | generate.md: "Otherwise omit the line." | why (make the broken chain loud) -> RATIONALE §No save confirmation on generate |
| G90 | generate Step 4 | Correct row always prints | generate.md: "`Correct` — always." | "replaces the gate's Edit option" -> RATIONALE §No save confirmation on generate |
| G91 | generate Step 4 gitignore note | git check-ignore -> one warning line; git clean -fdx / fresh clone | generate.md: "if `git check-ignore` says the written file is ignored (many projects ignore `docs/harness/`), add one warning line in `user_lang`: the handoff exists only on this machine — `git clean -fdx` or a fresh clone will not carry it." | verify_git_safety ALLOW entry still matches; Fix wave (M2): the "(many projects ignore `docs/harness/`)" example was cut for bytes; now generate.md: "if `git check-ignore` says the written file is ignored, add one warning line in `user_lang`: the handoff exists only on this machine — `git clean -fdx` or a fresh clone will not carry it." |
