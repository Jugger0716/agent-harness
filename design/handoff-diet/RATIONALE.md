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
| M1 | `generate.md` Step 1 item 4, slice identifier requirement | "Measured 2026-08-28 over all 31 ledger-bearing handoffs …: 17 have no `in-progress` row, and none of them carried this label yet." → §The slice label and the `Next :` derivation | "**A mention in prose does not satisfy this**; the label is the whole point, because `resume`'s `Next :` derivation … reads the labelled value first and never scans prose for a slice name." |
| M2 | `generate.md` Step 1 item 5, heading | the planning tag "NEW, P0-1" → §Citations removed as unresolvable | "**Progress Ledger (epic continuity, optional):** only when this handoff is part of a multi-slice epic" |
| M3 | `generate.md` Step 3, "Why there is no confirmation here …" | the three structural properties that make the write safe without a gate → §No save confirmation on generate | "**`generate` never asks whether to save**: the written file is the preview, and Step 4's report says how to correct it." |
| M4 | `generate.md` Step 3, "Not all of it survives …" | what the removed gate's parts became; "do not describe this change as lossless" → §No save confirmation on generate | the same sentence as M3, and Step 4's `Correct` row "delete it if unwanted" |
| M5 | `generate.md` Step 4 item 3, lead | "The report is not optional chrome — it carries what the removed gate used to carry" → §No save confirmation on generate | "Report (in `user_lang`) — print all of it:" |
| M6 | `generate.md` Step 4 item 3, broken-chain bullet | "this line moved from the preview to here, and it is the one line whose omission the removal of the gate could actually cost" → §No save confirmation on generate | "**A broken chain must never be silent.**" |
| M7 | `generate.md` Step 4 item 3, correction bullet | "the third is the one that replaces `Cancel`", "not a repair of anything", "with no gate" → §No save confirmation on generate | "three ways: edit the file directly; re-run `/handoff generate` …; or **delete the file**, a legitimate correction" |
| M8 | `generate.md` Step 4, after the report block | why the `Ledger` row exists; "the `Correct` row … is what replaces the gate's "Edit" option" → §No save confirmation on generate | "The `Correct` row always prints." |
| M9 | `SKILL.md` §Non-Goals, `.harness/` bullet | the planning tag "NEW P0-4" → §Citations removed as unresolvable | "No `.harness/` mutations, ever — `generate` and `resume` … both only READ `.harness/state.json`" |
| M10 | `SKILL.md` §Non-Goals, background-agents bullet | "MEASURED 2026-09-01" and the cost narrative ("that is not free for all three — nor is it hypothetical any more …", the silent-loss shape) → §Tool blocks and the chaining test | "**This is a prose rule, not a runtime constraint**" and "`NotebookEdit`, `WebSearch` and `WebFetch` stay blocked because `/handoff` itself must not reach the web" |
| M11 | `SKILL.md` §Non-Goals, Progress Ledger bullet | the tag "(P0-1)" and "(see spec D-4/D-5)" → §Citations removed as unresolvable | "no automatic status detection, no automatic slice transitions" |
| M12 | `SKILL.md` §Non-Goals, no-save-confirmation bullet | "`generate` is itself an explicit user action per the bullet above", "the one thing this genuinely gives up …", "do not "harmonize" the two" → §No save confirmation on generate | "There is no `Cancel`: an unwanted document is undone by deleting the file" and "`resume` keeps its Step 5 gate, which guards starting work, not writing a file." |
| M13 | `resume.md` Step 3.5, intro | "(`Task`/`Agent`/`Workflow` were removed from that frontmatter, see §Non-Goals, and it never covered `.harness/` writes in the first place)" → §Tool blocks and the chaining test | "`/handoff` never writes to, deletes, or otherwise touches `.harness/` — a rule (SKILL.md §Non-Goals), **not** a side effect of `disallowed-tools`" |
| M14 | `resume.md` Step 5, `Next cmd:` derivation | the tag "(AC-9)" → §Citations removed as unresolvable; "that was the earlier behaviour and it is what left the epic-slice shape with no startable option at all" → §The slice label and the `Next :` derivation | "**A zero-candidate count does not by itself drop the first option.**" |
| M15 | `resume.md` Step 5, gate paragraph | "(Observed 2026-08-28: a `resume` run printed the briefing, described the three options in prose, and ended the turn …)" → §Observations behind resume's gate rules | "**The gate is asked on EVERY path, and asking means CALLING AskUserQuestion.**" |
| M16 | `resume.md` Step 5, extraction rule 3 | "— silently skipping a precondition is how slice-a's 141k-token convention re-scan happens." → §Observations behind resume's gate rules | "**If item 1 states a precondition, recommend "Adjust plan" instead of the first option.**" |
| M17 | `resume.md` Step 5, "Why chaining is possible at all, and what changed." | the history of the refused chain and the 2026-08-07 denials → §Tool blocks and the chaining test | SKILL.md §Non-Goals "`disallowed-tools` does not list `Task`/`Agent`/`Workflow`, because that block holds for the whole turn and would disarm the skill `resume` chains into"; `resume.md` Step 5 "On **"Start next step"**: act **in this turn**" |
| M18 | `resume.md` Step 5, "That was the wrong layer to fix." | why the block was removed rather than worked around; "UNVERIFIED … now MEASURED" → §Tool blocks and the chaining test | the SKILL.md §Non-Goals sentence quoted in M17 |
| M19 | `resume.md` Step 5, "This change was also a test …" | the chaining test, its precondition (a refreshed plugin cache) and its result → §Tool blocks and the chaining test | none — history only; the rule it validated is the SKILL.md sentence quoted in M17 |
| M20 | `resume.md` Step 5, "What the result does NOT license." | the inherited web block is a cost, not harmless → §Tool blocks and the chaining test | `resume.md` Step 5 rule 5 "If the recommended command is a skill whose work needs `WebSearch`/`WebFetch`, do NOT render the first option" and "every slice that chain runs in this turn inherits this skill's blocked `WebSearch` / `WebFetch`" |
| M21 | `resume.md` Step 5, "What this gives up, stated plainly" | `Task`/`Agent`/`Workflow` are a promise now, not an enforced block → §Tool blocks and the chaining test | SKILL.md §Non-Goals "**No background agents and no Workflow engine for this skill's own work** — every step here runs inline in the orchestrator. **This is a prose rule, not a runtime constraint**" |
| M22 | `resume.md` Step 5, the epic block "three requirements this change invalidates" | → §Requirements an earlier epic recorded as invalidated | none — history only; the slice it addressed has shipped |

Wording changed in place (no paragraph moved): `resume.md` Step 3's lost-work label now uses the
State row's token `recorded dirty work not found`; Step 5's ambiguity trigger now carries its own
exception (in-progress rows that all lack a `Slice` value); "command candidates" became "token
candidates" (the script's list, before the negation judgement) against "candidates" (after it);
the three "directly under the aligned block" places defer to the one order paragraph; bare
`§Non-Goals` and bare `Step N` cross-references name their file.

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
a future edit from making `/handoff` spawn agents — a promise, not an enforced constraint. Do not
describe the swap as free. `disallowed-tools` never covered `.harness/` writes either, which is why
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

`resume` keeps its Step 5 gate: that gate guards *starting work*, not writing a file. Do not
"harmonize" the two.

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
