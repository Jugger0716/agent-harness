# /study — Measurement Ledger (hand-sync record, NOT a runtime module)

> **Why this is a separate file.** `skills/study/SKILL.md` is loaded in FULL on every `/study`
> invocation, so every character in it is paid per run. The measurements below are needed by the
> next **editor** of that skill — to stop a rule being "tidied" back into a shape a measurement
> already refuted — and by no runtime step. Nothing here is read during a `/study` run.
>
> **The rules are not here.** They stay in `skills/study/SKILL.md`, and so do the prohibitions:
> an editor who wants to raise a cap or reorder a pattern is stopped by the inline prohibition,
> then comes here for the evidence. Splitting it the other way round — proof inline, rule in a
> side file — is what this file exists to avoid. Same standing as
> `workflows/_reference/schemas.md`: a hand-sync source, not a runtime module.
>
> **Cite this file by SECTION NAME, never by line number.** `skills/study/SKILL.md` retired three
> absolute line pointers into sibling skills for exactly that reason, after one of its own
> self-citations rotted a single edit later.
>
> **Append and correct in place — never delete a repudiated figure.** §Repudiated Figures is the
> only thing standing between a retired number and its restoration as a measurement; that
> restoration has already happened once (`3,611`, below).
>
> **Pin every measurement of THIS repository's own state to a commit SHA.** A figure taken from
> something that keeps changing — a script's line count, a fill result, `git diff main..HEAD` —
> is true only at the commit where it was measured, and a moving range cited in the present tense
> is false the moment the branch grows. This is not hypothetical: an audit found `548 of 550
> lines` broken by the commit made two minutes after it was written, and `199,206 characters`
> already wrong at the commit that introduced it. A pinned figure does not rot; it becomes
> historical, which is what a ledger is for. **A figure with no SHA must be one of two things**:
> a measurement of an external target, or of a file whose content has not changed since — and if
> you cannot say which, pin it. This is the same discipline as §Fill Rule's "never inherit a
> ranking", applied to the record instead of to the run.

## Index

- §Repudiated Figures — every number this skill has retired, and what replaced it
- §Verified Independently — figures re-derived from the real files rather than inherited
- §Basename Recovery — the measurements that make step 3's recovery load-bearing
- §Fill Rule — the worked example, the ranking, and the counterfactual
- §Serialization Cost — why the workflow path pays for evidence per agent
- §Outline Patterns — why the table replaced a single JavaScript-shaped set
- §Named By Name — what the code-span proxy counts, and why tightening it is worse
- §Window Merge — the overlap arithmetic
- §Fallback Cap — why the "last third" needed an upper bound
- §Prose Reservation — the two heading-based rules that failed, in full
- §Reduction Order — why "rung 1 first" is a measured trap
- §Gate Condition — why the first §1.6 dense-target condition was unreachable
- §Dead Escape Clauses — the two clauses proven unreachable on the harness-slug branch
- §C# Target — the third language: what the extension set missed, and what one target measured
- §Citation Resolution — how much of what the documents cite actually exists, across 16 targets

## §Repudiated Figures

Never restore any left-column value as a measurement. Every one of them was published in
`skills/study/SKILL.md` as measured fact and later failed to reproduce.

| Retired | Correct | Why it was wrong | Retired in |
|---|---|---|---|
| `85KB … nearly four times` the code | `47,993` prose vs `23,511` code = **2.04×** | compared the two documents' CRLF **byte** size against the code's **character** size; the cap is a character cap | 3d39129 |
| remainder `2,935` after a 31,945-char fill | `3,055` | `35,000 − 31,945 = 3,055` | 3d39129 |
| name-based reservation `19,655` protected / `13,280` remaining | `17,859` / `17,141` | neither reproduces, and `35,000 − 19,655 = 15,345` ≠ 13,280 either | 3d39129 |
| "the name-based rule admitted ONE file" | it admitted the **same two** | drawn from the bad pair above; freeing 9,232 characters of headroom buys zero extra code there | 3d39129 |
| `coin-washer-review-fix` subtree total `3,479` | `3,475` | included line terminators that the section figures beside it exclude | 3d39129 |
| `11,262` as an **achieved** prose length | it is the **ceiling** (`35,000 − 23,511 − 227`); achieved is `10,895` | nothing in the slack-return rule reaches the ceiling | 3d39129 |
| top-three file characters `3,611 / 13,042 / 13,808` | `3,442 / 12,833 / 13,632` | overstate by 1.6–4.7%; reproduce as neither LF characters, CRLF characters, nor bytes | 3d39129 |
| sum of the first two, `16,653` | `16,275` | follows from the above | 3d39129 |
| "all 16 occurrences of `A` are the English indefinite article" | 15 are the `A` of `Q&A`; the 16th is a code span naming a DIFFERENT skill's segment script | a cross-file collision, not an article — a fifth kind alongside §Named By Name's four | 3d39129 |
| §1.6 gate's `12,238` (= `8,627 + 3,611`) | `12,069` (= `8,627 + 3,442`) | carried the repudiated `3,611` **after** Step 2-W had retired it, so the file asserted and repudiated the same number | 9d25760 |
| zero-code state `48,015` | `47,993` | counted the 22-character `## Cited Source Files` heading that Step 1.3(7) never appends when no file qualifies | 9d25760 |
| `--stat` = 794 characters over **15 files** | **14 files** | 794 characters is right; the `--stat` output is 15 *lines* — 14 file rows plus the summary row — and the line count was read as a file count | 2026-08-05 audit |
| `templates/study/html_shell.html` ≈ **~9,800** characters | **9,962** | never re-measured; the file has not changed, so this was wrong when written, next to a paragraph demanding characters be counted with a script | 2026-08-05 audit |
| `367 characters unused **because** spec.md has a 457-character paragraph` | 367 = spec **200** + changes **167** | the paragraph accounts for 200; `changes.md` independently loses 167 to its own 177-character line at its snap point | 2026-08-05 audit |
| `a 457-character paragraph **with no newline in it**` | 456-character body plus its terminator | 457 includes the line terminator that §Prose Reservation elsewhere pins as INCLUDED — the same boundary described both ways in one file | 2026-08-05 audit |
| room range `10,599-34,978` | **unestablished** | depends on a fill never run for all 10 targets. The upper bound is `35,000 − 22`, and that 22 is the heading constant retired one row above: at `code = 0` Step 1.3(7) appends nothing, so the bound would be 35,000. The clause it supported does not need a room range at all (see §Dead Escape Clauses) | 2026-08-05 audit |
| `git diff main..HEAD` = 2,145 lines / 199,206 characters | true only **at `d8fea6d`** | a moving range cited in the present tense. At `243867b`, the commit that introduced the figure, the range was already 2,377 lines / 221,207 characters; today it is 2,810 / 248,829, i.e. **7.1×** the cap rather than 5.7× | 2026-08-05 audit |
| "alphabetical order truncates `state.json` to `state.js`" — stated as a property of the ORDERING | a property of the ordering **only once the trailing `\b` is gone**; with the anchor present the alphabetical alternation truncates nothing | measured 2026-08-05 on a fixture carrying `state.json`, `html_shell.html`, `GateService.cs`, `Aptner.Pass.Utility.csproj` and `app.css`: the shipped alternation and a fully alphabetical one return **identical, correct** full paths, while dropping the `\b` from the alphabetical one truncates all five at once. The prohibition stands — the attribution was wrong, and it pointed the next editor at the cheaper of the two guards | 2026-08-05 |
| `its own **548-line** fill gathers 23,511` (present tense) | true only **at `a8b97bc`** | `88c2e5f`, made two minutes later on the same branch, grew `verify_sync_markers.py` from 221 to 300 lines; the fill now stops at **498 of 550 lines over 2 files**. The figures are correct at the pinned SHA — the tense was the defect | 2026-08-05 audit |

**One figure is retained deliberately and must not be read as live:** the ranking
`732 / 221 / 198`, with `workflows/study.analyze.workflow.js` on top. It predates step 3's
basename recovery and is false as a ranking (see §Fill Rule), but Step 1.3(4) keeps it under an
explicit *Counterfactual* label because it is the only worked arithmetic for the case where the
top-ranked file is over the per-file cap. Labelled counterfactual, not measurement.

## §Verified Independently

Re-derived 2026-08-05 from the real files by applying Step 2-W's own rule (PROSE_CAP 8,750,
`round_half_up` share on document length, snap DOWN to the last complete line, LF-normalized
characters), rather than inherited from a previous revision:

| Target | `len(spec)` | `len(changes)` | raw share | snapped | reservation |
|---|---|---|---|---|---|
| `pass-monorepo-be` `feature-face-auth-sse-subscribe` | 47,459 | 8,825 | 7,378 / 1,372 | 7,321 / 1,306 | **8,627** |
| `agent-harness` `study-skill` | 42,492 | 5,501 | 7,747 / 1,003 | 7,563 / 1,002 | **8,565** |

The `study-skill` prefix ends at **line 77** of 278, past the `### Approach` heading at line 42
that stopped the old subtree walk. All figures Step 2-W quotes for these two targets reproduce
exactly.

## §Basename Recovery

**Deep-tree elision (`pass-monorepo-be`, `--harness gate-control-sse`, measured 2026-08-04).**
78 tokens matched, 64 dropped as non-existent, of which **57 resolved uniquely by basename and 0
were absent from the repository** — 62 of 78 citation-weight, including all 54 cited `.java`
files, was being discarded. Without this recovery the top-ranked evidence was three
`application*.yml` files and none of the code the spec is about, so the guide would have taught
Spring configuration instead of gate control.

**Bare basename, and a claim that was wrong (`agent-harness`, `--harness study-skill`, measured
2026-08-04).** An earlier revision of `skills/study/SKILL.md` claimed this repository's paths are
too shallow for its documents to abbreviate, so self-targeting could never surface recovery. That
was wrong: these documents cite the verifier scripts by **bare basename**
(`verify_meta_literal.py`, `verify_sync_markers.py`, `check_workflow_syntax.mjs`,
`html_shell.html`) about as often as by path, and 9 tokens recover on this target — of which 5
survive the re-applied exclusions and 4 are dropped as `docs/` output. A bare basename is an
abbreviation with no separator at all, so the tail-match clause never even applies to it.
Recovery is load-bearing on this repository too, enough to reorder the ranking outright.

**Why the exclusions must RE-APPLY to the recovered path (same target, measured 2026-08-04).**
`study_guide.html` (5 citations), `study_guide.json` (4, across two spellings) and
`study_guide_round2.html` (1) all recover uniquely into `docs/harness/study-skill/`.
`study_guide.html` contains a `<script>` block, so §3.4a would classify a previous round's own
report as **`code`**, and at 5 citations it wins the path tie-break (`d` < `w`) against
`workflows/study.analyze.workflow.js`. A bare basename carries no directory, so "everything under
`docs/`" cannot fire at the token stage — it has to fire again after recovery, or a basename
smuggles this skill's own output back in as evidence.

## §Fill Rule

**Worked example (`--harness study-skill`, measured 2026-08-04).** The ranking is
`scripts/verify_meta_literal.py` (10 citations, 198 lines) / `scripts/verify_sync_markers.py`
(9, 221) / `scripts/check_workflow_syntax.mjs` (6, 129) / `templates/study/html_shell.html`
(6, 199) / `workflows/study.analyze.workflow.js` (5, 743). The third and fourth tie at 6
citations and the path tie-break separates them (`s` < `t`). The first three sit under the
300-line per-file cap and enter whole for a total of **548** — inside deep's 550 and quick's 600
alike; the fourth would reach 747 and does not fit, so the fill stops there and the fifth is
never examined. No window, no merge, no drop. **The ranking has five entries and the kept set has
three** — a prefix, which is what the fill rule says it always is. Do not read a worked example
that lists only its kept files as a complete ranking; that misreading is what made an earlier
reachability claim look stronger than it was.

**Never inherit a ranking — re-measure it.** An earlier revision recorded `732 / 221 / 198` with
`workflows/study.analyze.workflow.js` on top. That measurement predates step 3's basename
recovery, which merges bare-basename citations into the small verifier scripts and pushes
`study.analyze.workflow.js` down to **5th, at 5 citations**. A ranking is an output of steps 2-3,
so it changes whenever they do.

**Step 5 does not run on any `--harness` target in this repository — but that is a property of
the KEPT SET, not of the procedure.** Measured across all three candidate slugs, the fill keeps
198/221/129, 221/129/152 and 152/198, and not one KEPT file exceeds the per-file cap. The
rankings themselves DO contain over-cap files — `workflows/study.analyze.workflow.js` (743 lines)
sits 5th on `study-skill` — they are simply never reached, because the fill stops earlier.

**Counterfactual, kept because it is the arithmetic these caps exist for.** Were the ranking
`732 / 221 / 198` in quick with the top file over the cap: its two windows merge to a 151-line
union (measured on the file itself), so 151 + 221 + 198 = 570 of 600 and nothing drops. Had those
same windows been disjoint they would contribute 300, so 300 + 221 = 521, and the third file at
198 would reach 719 — dropped. Same rule, different union, opposite outcome; that is exactly why
the drop test runs last. Naïvely capping the top file at 300 instead of windowing it gives
300 + 221 + 198 = 719, 20% over.

**Why the 12-file ceiling is 12, and why filling replaced a 3-file ceiling.** Measured 2026-08-04
across 8 real slugs, the old 3-file ceiling produced 180 / 358 / 465 / 471 / 513 / 548 / 502 /
350 lines against budgets of 550, while filling produces 549 / 547 / 529 / 496 / 547 / 548 / 502
/ 350 over 11 / 6 / 5 / 4 / 4 / 3 / 3 / 2 files. The worst case was a Java monorepo slug citing
44 files: 3 of them gave **180 of 550**, and filling gives 549 — a 3× increase in evidence for a
budget that was already allocated. The 12 comes from that measurement (the highest fill observed
is 11 files), not from taste.

**Why stopping beats skipping.** Measured 2026-08-04 on `--harness feature-face-auth-sse-subscribe`,
greedy skipping reached 598 of 600 lines but let a 2-citation file in while passing over a
3-citation one, whereas stopping yields 513 of 600 with the ranking intact.

## §Serialization Cost

An earlier revision of `skills/study/SKILL.md` claimed the workflow path pays nothing for
filling, on the ground that the cap holds the total constant. It does not — reserve-first
arithmetic is what a fill order actually produces. Two later revisions then tried to protect the
prose by heading NAME and by heading SUBTREE; both are measured failures (§Prose Reservation).
The composition trade — code displacing the decision ledger's prose — is still the one this skill
wants, but it is bounded, and the bound is a number (8,750 characters) instead of a heading
pattern a document can decline to follow.

Measured 2026-08-04: a filled 550-line gather serializes to 24,923 characters on one Java slug
and **31,945** on another (58 chars/line). Fill-first on that second slug leaves
`35,000 − 31,945 = 3,055` characters for two documents measuring 26,688 together. Under the
previous, larger budget row the combined payload reached ~56,000 characters, which the
orchestrator cannot re-emit in one dispatch call at all — the dispatch itself becomes
unexecutable, and hand-transcribing that much would corrupt the §3.4 quote re-verification the
whole guide rests on.

## §Outline Patterns

**Why the table exists: the single previous set was JavaScript-shaped and silently matched
nothing else.** `^class ` requires `class` at column 0, but Java writes `public class Foo`, has
no `function` keyword and no `const x =`. Measured 2026-08-04 on `pass-monorepo-be`, the old set
found **0** declarations in every Java file tested — including an 864-line class whose
declaration sits at line 142 — so every over-cap Java file fell straight through to the fallback:
no windows, no named-by-name test, no tie-break, no merge. Step 5 was dead code for the one
language this skill had been validated against, and nothing said so, because the fallback is
documented and its output looks plausible. With the table those same files yield
25 / 45 / 1 / 9 / 10 declarations, and the window merge fires on two real targets it could never
reach before (`FaceAuthSseWindowApplication.java` 527 lines → windows 8-157 + 108-257 merge to
8-257 = 250 against a naive 300; `FacilityApplication.java` 940 lines → 44-193 + 81-230 merge to
44-230 = 187). A single-declaration file (a Java enum dictionary: outline 1, qualifying 1)
correctly yields ONE window, not two.

**The two pattern-transcription failures, both measured 2026-08-03/04.** With `js` ahead of
`json` in the extension alternation, `state.json` matches as `state.js`; with `h` ahead of
`html`, `html_shell.html` matches as `html_shell.h`. Both truncations produce paths that do not
exist, so they are dropped silently and the config bucket disappears with no error anywhere.
Replacing the trailing `\b` with `(?![\w])` is semantically identical but ripgrep's default
engine has no look-around and rejects it outright with `regex parse error`. And the `.java` type
pattern copied WITH its GFM table escaping (`\|` left as `\|`) returns **0 matches and no parse
error** on a file where the un-escaped form finds `public class FaceAuthSseWindowApplication` at
line 82 — ripgrep accepts it and silently finds nothing, which is worse than being rejected.

**Correction to the first of those two, measured 2026-08-05 — the ordering was never the guard.**
Re-running both alternations against a fixture holding `state.json`, `templates/study/html_shell.html`,
`Aptner.Pass.Gate/GateService.cs`, `Aptner.Pass.Utility/Aptner.Pass.Utility.csproj` and `src/app.css`:
the shipped longest-first alternation and a fully alphabetical one return the **same six correct full
paths**. Drop the trailing `\b` from the alphabetical one and all five truncate at once
(`state.js`, `html_shell.h`, `GateService.c`, `…Utility.c`, `app.c`). So the truncation is real, but
it is gated on the ANCHOR, not on the order — which inverts which prohibition matters: `(?![\w])`
is the dangerous edit, because the parse error it produces invites an editor to delete the anchor
rather than restore `\b`. Length ordering is kept as insurance that survives that edit; it is no
longer sold as the thing preventing truncation (§Repudiated Figures).

**A third language, and the same anchor trap in the OUTLINE patterns (measured 2026-08-05 on
`AptnerPass`, a C#/.NET Framework 4.7.2 WinForms solution, `v1_develop` @ `1d0705264b8cb405`).**
The `.java` type pattern anchors at column 0, and C# block-scoped namespaces indent every type
declaration, so a `.cs` row ported from it finds **0** types in all six real files tested. Anchoring
with `^\s*` instead recovers them:

| File | lines | col-0 anchor | `^\s*` anchor | member pattern |
|---|---|---|---|---|
| `Aptner.Pass.Kiosk/Presenters/KioskPresenter.cs` | 663 | 0 | 1 | 55 |
| `Aptner.Pass.Pos/Presenters/PosPresenter.cs` | 470 | 0 | 1 | 44 |
| `Aptner.Pass.Services/ApiService/ApiService.cs` | 1,506 | 0 | 2 | 98 |
| `Aptner.Pass.Common/Common/EnumDefine.cs` | 371 | 0 | 22 | 17 |
| `Aptner.Pass.Utility/Common/Messages.cs` | 924 | 0 | 1 | 472 |
| `AptnerPass/Program.cs` | 18 | 0 | 1 | 0 |

The 22 on `EnumDefine.cs` is confirmed by ripgrep, not only by the script, and the 472 on
`Messages.cs` is real rather than over-matching — that file is one-line `public static` factory
methods almost end to end. The C# member pattern differs from the Java one only by adding
`internal`, which contributed **nothing** on any of the six: it is kept for languages-not-repos
correctness, not on the strength of this sample. **The lesson is the one the table already exists
for, one language later: a row ported between languages inherits its anchoring assumption, and the
failure is silent because the fallback output looks plausible.**

## §Named By Name

**What a loose reading would count (measured 2026-08-04 in this repository's own `spec.md` +
`changes.md`).** The identifiers in a segment script are also ordinary English or ordinary domain
words: `topics` 12, `deviations` 8, `render` 3, `buckets` 1 — and none of those four occurrences
refers to the declaration it matches. That is why the test requires a backtick code span or a
fenced block, plus a 3-character floor.

**The cross-file collision that clause (b) already covered.** An earlier revision cited
`const A = …` at line 46 of this repository's segment script as the loose reading's top candidate
and explained its 16 hits as the English indefinite article. Both halves were wrong: 15 of the 16
are the `A` of `Q&A` and the 16th is a code span `` `A.targetFiles` `` naming a DIFFERENT skill's
segment script. So the honest lesson is a cross-file collision — a fifth kind alongside the four
the rule enumerates — and the example never supported the point it was cited for, because clause
(b)'s 3-character floor excludes a one-character identifier under either reading.

**Why clause (c) pins whole-token matching (measured 2026-08-05).** Leaving "occurs" to the
reader is not neutral — the two readings disagree on real output. On this repository's own
`workflows/study.analyze.workflow.js` the substring reading yields **7** qualifying declarations
against the whole-token reading's **6**, the difference being `lenses` matching inside
`lensesRequested`; the 6 is what this ledger and SKILL.md record, so whole-token is the reading
the measurements were taken under. On `pass-monorepo-be`'s `SalesDomainService.java` the readings
pick different declarations and the merged window comes out **264 lines** (substring:
`cancel`/`register`) versus **297** (whole-token: `cancel`/`SalesDomainService`). An unpinned
reading is therefore a determinism violation, not a stylistic choice.

**Why tightening the test makes it worse (measured 2026-08-04, this repository).** `topics`
(line 615) enters the top two on kinds (iii) and (iv) ALONE — six filename occurrences plus two
`topics=N` completion-sentinel attributes, and **zero** references to the declaration. Excluding
filename-stem occurrences flips the top two to `deviations` (line 614) and `mopt` (line **49**),
whose windows are 540-689 and 1-124 — **disjoint**, and one of them centred on exactly the
prologue-and-schemas region the ordering rule exists to keep the window away from. The proxy's
false positives correlate with the code a document is actually discussing, because a document that
explains the reconcile step also names the files that step reads and writes. The correlation is
luck, not a guarantee: a document naming a file whose stem collides with an unrelated declaration
far from the interesting code will pull the window there, and nothing in this skill catches that.

**Kind (iii) is not accidental in one-type-per-file languages — it is the naming convention
(measured 2026-08-05, `AptnerPass`).** C# (like Java) names a file after the type it declares, and
a `--harness` document opens with a table of changed PATHS in code spans. So the type's identifier
is guaranteed a very early code-span occurrence that refers to a filename, and the
first-mention ordering is decided by the file table rather than by the discussion. On
`KioskPresenter.cs`: **4 of 56** outline declarations qualify, and the top two are both
`KioskPresenter` — the class at line 21 and its constructor at line 40, tied at the same
first-mention offset because both matched inside the path `…/Presenters/KioskPresenter.cs`. Their
windows merge to **[1, 115]**: usings, fields, constructor. `StopDevice` (line 485) and
`OnDeviceAuthenticationCallbackAsync` (line 654) — the SSE surface the artifact is entirely about —
rank 3rd and 4th and are never reached. `PosPresenter.cs` behaves identically ([1, 111]).

The measured argument for keeping kinds (iii)/(iv) still stands and is NOT reversed here: it was
taken on JavaScript, where a stem-to-declaration collision is coincidence. What this target shows
is that the *correlation the argument rests on* — false positives landing near the code under
discussion — is a property of the language's file/type convention, not a property of the proxy. On
C#/Java it inverts and lands on the head of the file. Recorded, not repaired: the prohibition on
adding a kind-(iii) exclusion is unchanged, because the JavaScript measurement showing the strict
reading is WORSE has not been re-run here, and swapping one unmeasured rule for another is what
this ledger exists to stop.

## §Window Merge

Measured 2026-08-04 against this repository's own `workflows/study.analyze.workflow.js`
(743 lines): 45 outline declarations, 6 qualify, and the first two under the ordering rule are
`topics` (line 615) and `deviations` (line 614) — **adjacent lines.** Their windows are 541-690
and 540-689, so a naive sum of 300 stands against a union of **151**: 149 duplicated lines and a
99% over-count of the budget. Overlap is the normal case here, not a pathology — the ordering
rule ranks by first mention in the documents, and a document discussing one part of a file names
the declarations that sit next to each other inside it.

That measurement is taken on the FILE, not on a live selection: basename recovery has since moved
this file to 5th, so no `--harness` target in this repository actually windows it — verified
2026-08-05 by reproducing the fill across all three of this repository's slugs, none of which
reaches an over-cap file.

**A reaching target does exist, and it was found (2026-08-05).** Reproducing Step 1.3(2)-(5) over
`pass-monorepo-be`, `--harness feature-coin-operated-washer` fills to `FacilityApplication.java`
(940 lines), windows it, merges 44-193 + 81-230 into 44-230 = **187 lines / 11,595 characters**,
and **adopts that merged window as final evidence under both the quick and the workflow path** —
the character remainder does not displace it. So the merge rule is not merely arithmetic here: a
`/study` invocation on that slug exercises it end to end. (The other candidate,
`--harness feature-face-auth-sse-subscribe`, does NOT qualify on the workflow path: its
reservation of 8,627 leaves 26,373 characters, the first two ranked files take 16,273, and
`FaceAuthSseWindowApplication.java`'s merged window needs 13,632 — so it is dropped whole, exactly
as §Reduction Order already records. A first pass through this audit reported it as adopted; it
had modelled the line budget without the character remainder.)

What remains unrun is therefore narrower than "the merge rule": it is a live `/study` invocation
observing the orchestrator perform the Grep calls, the `\|` un-escaping and the extension ordering
without hitting the failure modes this file warns about.

## §Fallback Cap

An uncapped "last `⌈T/3⌉` lines" breaches the 300-line per-file cap on any file over 900 lines,
and that is reachable in ordinary data rather than in a constructed case. Measured 2026-08-04:
`pass-monorepo-be`'s `--harness face-auth-sse-completion` spec cites `schema-application.sql`
**five times by bare basename**; exactly one candidate survives the §Exclusion List (the `build/`
copy is excluded by it), so basename recovery resolves it to a **974-line** file. `.sql` has no
outline row, so the fallback fires, and an uncapped third is **325 lines — 1.08× the per-file
cap**, 59% of deep's entire 550-line total in one file. The same repository's `schema-facility.sql`
is 1,305 lines, an uncapped 435 (1.45× the cap, 79% of the total).

No measured file breaches the TOTAL budget this way, only the per-file one — but the per-file cap
is what the fill arithmetic and its counterfactual both assume, so an exception to it silently
invalidates them. **Eight of the 25 extensions in the step-2 pattern have no outline row**
(`json`/`yaml`/`yml`/`toml`/`html`/`css`/`sql`/`csproj`), so the fallback is their normal path, not
their exception, and a config or schema file large enough to breach the cap is an ordinary member of
that set.

## §Prose Reservation

Two rules preceded the positional one, and both parsed headings. Both are measured failures with
the same root cause: **a heading is not a contract this skill controls.**

**(a) The NAME test** ("keep `Goal`/`Background`/`Scope`/`Approach`") scores **ZERO on 3 of the
10** real `docs/harness/<slug>/spec.md` files measured 2026-08-04 across two repositories —
including a 51,080-character spec — and **ZERO on all 8 of the 8** `changes.md` files. It cannot
be repaired by lengthening the list: those ten specs carry FIVE different heading vocabularies:
`Goal` (2 targets); `1. Goal` (1); `목표 (Goal)` (3); `목표` alone (1, which does NOT match); and
three sharing no vocabulary at all (`목적`; `변경 이력`; `1. 정확도 판정 요약`). Break the seven
non-zero targets down and not one of them matched by design: 3 only because a bilingual heading
happens to carry the English word in parentheses, 3 only because that spec's headings happen to
be English at all — which neither producer guarantees — and **1 only through a nested `In
Scope`**, an unrelated subsection, while its own top-level headings (`1. 정확도 판정 요약` /
`2. 범위(This PR) vs Defer`) match nothing. A test whose hit rate is decided by a translator's
parenthetical is not a contract.

Both producers of the file render headings in `user_lang` (`skills/spec/SKILL.md` §Phase 2-D
step 6; `skills/harness/SKILL.md` §Step 2 — WORKFLOW path step 5), so an English name list can
never be relied on, and `/spec`'s seven canonical sections contain no `Approach` at all. The
eight `changes.md` files are worse than merely unmatched: their headings vary by producer — and
they vary WITHIN one producer, not merely between producers. Of the three agent-harness ones, two
carry `Modified Files` / `Created Files` / `Advisor Feedback Applied` and the third has no
`Advisor` heading at all, using `Round 1 Changes` / `Deleted Files` / `검증` / `Cold-review fix`
instead. The pass-monorepo-be ones add `Changes by Finding`, `Phase 0~4`,
`에러코드 제거 판단 근거` and `Verify`. So no name list survives the next target, and the sample
proves it twice over.

**(b) The SUBTREE test** ("keep the heading and everything deeper under it, to the next heading
at the same-or-shallower level") fails whenever a section's body is written at a SHALLOWER level
than its heading. Measured on this repository's own `docs/harness/study-skill/spec.md`
(278 lines / 42,492 characters): `### Goal`, `### Background` and `### Scope` capture
287 / 1,325 / 1,809 characters correctly, but `### Approach` at line 42 is followed by `## 1.` …
`## 16.` — sixteen shallower siblings holding the entire design rationale — so its subtree is the
heading ALONE, **12 characters of 42,492**, and the protected total is 3,433 (8.1%). An earlier
revision read "leaf `###` sections with nothing nested under them" as the SAFE case. It is the
EMPTY case; which one it is depends on where the body was written, and nothing in this skill can
constrain that.

**What replaced them, and what it does not promise.** The positional reservation raises the
reserved total on **9 of the 10** measured targets and lowers it on **1**. The three
zero-protection targets become 8,301 / 1,277 / 8,592; the heading-inversion target goes
3,433 → 8,565. The single fall is `feature-face-auth-sse-subscribe`, 17,859 → 8,627 — the
dense-code target where the old reservation starved the code, so that is the intended direction.
It buys no extra code THERE (the same two ranked files fit under both rules), so the rule is sold
on the three targets that reserved nothing at all, not on the dense one.

A head prefix is a PROXY for "where the rationale lives", and measurably not a guarantee.
`/spec` puts a derived `## Review Sheet` ahead of the seven canonical sections
(`skills/spec/SKILL.md` §Spec Output Format), and 2 of the 10 measured specs open on something
else entirely (`## 변경 이력`; `## 1. 정확도 판정 요약`) — so "the first heading is the goal" is 8
of 10, not a rule. One measured target loses a section the name test held: on
`coin-washer-review-fix` the prefix ends at line 72 and never reaches
`## 접근 방식 (Approach)` at line 87 (a 1,950-character subtree), even though its reserved total
rises 3,475 → 8,481.

**`8,750` is a policy ceiling, not a measured threshold.** Its one anchor is the 24,923-character
filled gather in §Serialization Cost, which leaves 10,077 characters; 8,750 sits under that.
Raising it requires a new measurement first, exactly as the 35,000 cap does.

## §Reduction Order

An earlier revision framed the four rungs as "Over the cap, reduce in this fixed order and no
other", and that framing is a measured trap. Under the reserve-first order the assembled payload
satisfies `reserved + filled + overhead ≤ 35,000` by construction, so "over the cap" can only be
reached by comparing UNDIMINISHED demand against the cap — and running rung 1 first on that
comparison drops all the code before any prose is touched.

Measured on `--harness study-skill` **at `a8b97bc`** (198 + 221 + 129 = 548 lines,
8,182 + 9,010 + 6,319 = 23,511 characters — see the pinning rule at the top of this file):
reserved 8,565 + filled code 23,511 + overhead 227 =
**32,303**, inside the cap with all three ranked files intact. But undiminished demand is
`47,993 + 23,511 + 227 = 71,731`, and reducing that by rung 1 first drops file after file to
47,993 with **zero code left**, still over, and only then cuts `spec.md` — landing at 13,064
(= 7,563 reserved prefix + 5,501 whole `changes.md`, with no `## Cited Source Files` heading
because no file qualified) with a prose-only guide and 62% of the cap unspent. Same four rungs,
opposite outcome, and the difference is 23,511 characters of the evidence this skill exists to
quote.

**The slack-return pass count is pinned, and leaving it open cost a round.** Snapping down means
a prefix stops at the last line boundary before its target, so some slack goes unused. Measured
on `--harness study-skill` **at `a8b97bc`**: slack `11,262 − 8,565 = 2,697` targets spec 9,951 /
changes 1,311, which snap to **9,751 / 1,144** — prose lands at **10,895**, returning 2,330 of
2,697 (86.4%) and leaving **367** characters unused. That 367 is **not** all one document's
doing, which an earlier wording implied: `spec.md` contributes **200**, losing them to a single
457-character line at its boundary (456 characters of body plus the terminator this file counts
as included), and `changes.md` independently contributes **167**, losing them to its own
177-character line. Snap loss is a property of both documents, not of one unusually long
paragraph. A tempting second reading — iterate, and hand a document's unusable
share to the other — recovers most of that (about 11,257 on this target) but requires a
redistribution rule the one-pass rule does not state, a termination argument, and a second
competing definition of the split. The two readings differ by 362 characters on this target, and
that number is printed at the §1.6 gate, so an unpinned choice is a determinism violation in a
figure the user approves against. One pass wins; the 367 characters are the price.

**The slack can never instead admit another code file, and the proof has THREE cases** because
the fill has three stop conditions. **Character-bound**: the next ranked file's characters
exceeded the remaining characters, and the slack IS that remainder, so the file is too large by
definition (measured on `--harness feature-face-auth-sse-subscribe`). **Line-bound**: the next
file's lines exceeded the 550-line budget, and no amount of character slack lifts a line cap
(measured on `--harness study-skill` **at `a8b97bc`**, where the fill stops at 548 of 550 lines
and the next ranked file, `templates/study/html_shell.html` at 199 lines, is excluded by lines
while its **9,962** characters would have fit a larger slack — that file is unchanged since, so
only the fill's stopping point is SHA-dependent here). **File-count-bound**: the 12-file ceiling,
which character slack does not lift either — no measured target has reached it (§Fill Rule tops
out at 11 files), but an enumeration that claims completeness has to include it. An earlier
revision stated the first case only; a later one stated two and asserted "do not restate the
claim with only one of them" while itself omitting the third.

**The dense-code target: the cap is smaller than the target needs, and no split fixes it.**
Measured 2026-08-04 on `--harness feature-face-auth-sse-subscribe`: the reservation is 8,627
(§Verified Independently), leaving `35,000 − 8,627 = 26,373` for code before overhead, while the
top three ranked files contribute **3,442 / 12,833 / 13,632** characters (the third is the merged
250-line window 8-257 of the 527-line class) — so the fill takes the first two (16,275) and
stops, and `FaceAuthSseWindowApplication.java`, the class the feature is ABOUT and the one whose
two windows merge, is dropped whole. **This is the one measured case where the CHARACTER
remainder is what stops the fill**: three files are 513 lines, comfortably inside the 550 budget,
but 29,907 characters against a 26,373 remainder. The name-based reservation, re-measured
correctly at 17,859 characters, left 17,141 and admitted the SAME two files — so freeing 9,232
characters of headroom buys **zero** additional code here.

## §Gate Condition

The first condition written for Step 1.6's dense-target line was worse than missing — it was
structurally unreachable. "The prose reservation plus the top-ranked cited file exceed the cap"
can never hold, because the fill stops when the character remainder runs out and therefore
`reserved + kept code + overhead ≤ 35,000` is an **invariant of every completed fill**; any subset
of a kept payload also fits, so the test could only fire when the fill took zero files. Measured on
the dense example: the reservation is 8,627 and the top-ranked file 3,442, so that phrasing yields
**12,069** against 35,000 and stays silent on the very run where the third-ranked file is dropped.

**Why `<a full-line-budget fill>` had to be defined explicitly.** It is the fill with the
CHARACTER-remainder constraint removed — line budget, per-file cap and file ceiling only. On a
character-bound target that differs a lot from what actually ran: measured on
`feature-face-auth-sse-subscribe`, the executed fill is **16,275 characters over 2 files** while
the full-line-budget fill is **29,907 over 3**. So "the arithmetic has already run" is true of the
ranking and the windows but NOT of this sum, which the gate computes from them. The undiminished
quantity is the correct one and its error direction is safe: always ≥ the executed fill, so the
test can over-warn but never stay silent on a real reduction.

## §Dead Escape Clauses

Two escape clauses that once lived in Step 2-W are **structurally dead on the harness-slug
branch** — recorded rather than deleted, so the next round does not re-derive them as missing.
They remain LIVE on `--diff` and `--project`, where PROSE_CAP does not apply and rung 4's own cap
governs instead.

**(a) "If the reserved prefixes alone exceed the room, cut further from the tail of the larger
one."** The fill admits a file only while `code + overhead ≤ 35,000 − reserved`, so
`reserved ≤ 35,000 − code − overhead` holds by construction, with equality the only tight case.
Measured across the 10 targets, reservations run **1,277-8,720** — and since PROSE_CAP is a flat
8,750, no reachable input produces a reservation above it, so the clause can only fire if the
room ever fell below 8,750, which the construction above forbids. (An earlier version of this
paragraph also quoted a room range of `10,599-34,978`. That figure is retired — see
§Repudiated Figures: it depends on a fill never run across all 10 targets, and its upper bound
carries a heading constant this file has already retired. The argument never needed it: the flat
PROSE_CAP is what closes the case.)

**(b) "If the cited block alone still exceeds the cap, proceed over the cap and say so."** Same
inequality, plus the degenerate case closes it from the other side: if even the top-ranked file
exceeds the remainder, the prefix fill takes ZERO files and `code = 0`.

Clause (b) has a useful corollary worth keeping: on a target whose top-ranked file alone exceeds
the remainder, the fill takes zero files and the slack-return rule then hands roughly
`35,000 − PROSE_CAP` characters back to prose, so the cap is spent on the decision ledger rather
than left unused. That is a real benefit of the slack return, not merely a tidiness rule.
**That corollary was observed for the first time on 2026-08-05** — by a target that reached
`code = 0` through the OTHER door (the extraction set matched nothing at all, rather than the top
file being too large). See §C# Target.

## §C# Target

Measured 2026-08-05 against `AptnerPass`, a C#/.NET Framework 4.7.2 WinForms solution
(`v1_develop` @ `1d0705264b8cb405f63e00820171f2e3e48b0852`), `--harness guardtec-sse-review-fixes`,
`spec.md` 30,107 + `changes.md` 6,131 = **36,238** LF-normalized characters. This is the third
language and the first target whose two documents exceed the 35,000 cap **on their own**.

**The extension set matched nothing.** Run against both documents, the shipped pattern returned
**0 tokens**. Not a thin ranking — an empty extraction stage, on a target whose entire subject is
C# code. The documents cite roughly 110 `.cs`/`.csproj` paths. Adding `csproj` and `cs` at their
length positions yields **43 distinct tokens / 108 citations → 9 ranked files / 4,432 lines**:

| # | cites | lines | path |
|---|---|---|---|
| 1 | 6 | 663 | `Aptner.Pass.Kiosk/Presenters/KioskPresenter.cs` |
| 2 | 6 | 470 | `Aptner.Pass.Pos/Presenters/PosPresenter.cs` |
| 3 | 6 | 138 | `Aptner.Pass.Utility/Aptner.Pass.Utility.csproj` |
| 4 | 6 | 214 | `UnitTestProject/UnitTestProject.csproj` |
| 5 | 4 | 128 | `Aptner.Pass.Services/Aptner.Pass.Services.csproj` |
| 6 | 2 | 1,506 | `Aptner.Pass.Services/ApiService/ApiService.cs` |
| 7 | 2 | 18 | `AptnerPass/Program.cs` |
| 8 | 1 | 371 | `Aptner.Pass.Common/Common/EnumDefine.cs` |
| 9 | 1 | 924 | `Aptner.Pass.Utility/Common/Messages.cs` |

**29 tokens still drop, and the dominant cause is not the pattern.** The artifact describes work on
`epic/guardtec-sse` while the working tree sits on `v1_develop`, so most of the feature's files —
`FaceAuthSseService.cs`, `FaceAuthSsePresenterCoordinator.cs`, `ITokenAccessor.cs`,
`FaceAuthMaskingHelper.cs`, `IdVerificationService.cs` — do not exist at scan time and are dropped
correctly. **A `--harness` target is only as good as the checkout it is read against, and nothing
in this skill detects the mismatch**; it surfaces only as a thin `## Cited Source Files` block.
Two bare basenames were ambiguous and correctly never guessed: `Program.cs` across **5** candidates
and `ApiService.cs` across **2** — while the full-path spelling of the latter resolved directly, so
the same file both resolved and dropped depending on how the document happened to spell it.

**Build-output trees are not in the §Exclusion List.** `bin/`, `obj/` and `artifacts/` are absent
from it, and a .NET build populates all three with copies. On this target the ambiguity above is
partly what that produces. Recorded, not repaired: adding exclusions changes every ranking
measured so far, so it needs its own re-measurement round.

**Prose reservation and the slack return, on the pre-fix run (`code = 0`).** The reservation fires
because the two documents alone exceed the cap. Raw shares `7,270 / 1,480` (= PROSE_CAP exactly);
snapped down to line boundaries **`7,144 / 1,420` = 8,564**. Slack `35,000 − 8,564 = 26,436`, split
on the ORIGINAL lengths as `21,963 / 4,473`, snapped again to a final **`29,012 / 5,867` = 34,879
of 35,000** — 99.5% of the slack returned, **121 characters unused** to snapping (95 from `spec.md`,
26 from `changes.md`). The cap is therefore paid entirely from the prose tail: `spec.md` keeps
through line 351 of 377, `changes.md` through line 91 of 95. The §1.6 dense-target condition
(`36,238 + 0 + 0 > 35,000`) fires, as does the `F == 0` warning.

**The post-fix fill, and a stop condition the measured set had not shown before.** With `csproj`/
`cs` extracted and the `.cs` outline row in place, the reservation is unchanged (it depends only on
the two documents), the remainder for code is `35,000 − 8,564 − 22 = 26,414`, and the fill keeps
**3 files / 364 lines / 13,734 characters**: `KioskPresenter.cs` windowed to [1, 115] (3,905),
`PosPresenter.cs` to [1, 111] (3,747), and `Aptner.Pass.Utility.csproj` whole (138 lines, 6,082).
It then stops **line-bound** — `364 + 214 > 550` for `UnitTestProject.csproj` — with 12,680
characters of the remainder still unspent. Every previously measured stop was character-bound;
this is the line cap binding first on a real target, which is the case §Reduction Order's
three-case proof names but had no worked example for. The slack returns to prose
(`10,535 / 2,145`), landing the payload at **34,835 of 35,000**. The §1.6 dense-target line fires
here too: `30,107 + 6,131 + 13,756 = 49,994`, and what the cap drops is 15,159 characters of prose
tail, not code.

**Two windows on a merged head are not the same as evidence about the change.** 226 of the 364
kept lines are the two Presenter file heads (§Named By Name); the 138-line `csproj` is the one
kept file that is squarely about what the artifact did (`<Compile Include>` add/remove). Report
this as the fill working exactly as specified and the SELECTION being weak, not as a fill bug.

**The first executed deep run on a C# target (2026-08-05, `--harness guardtec-sse-device-id-string`).**
The dispatch carried **34,958 characters** of `sharedEvidence` and ran — the cap's first live
exercise, against a documented failure point of ~56,000 that remains unmeasured in between.
7 agents, 3/3 lenses, 8/8 topics, `missingSections` empty, `deviations` empty. Accounting:
`Claims 7 repo-backed / 41 inference`, `Quotes 5 verified / 6 downgraded (path-invalid 6)`,
`Exercises 8/0`, `Q&A 24/0`, `Refs 12 valid / 28 broken`,
`Excerpts 11 code / 0 config / 0 prose / 0 self-doc / 0 unknown`, no topic without a code excerpt.

**The 28 broken references are one defect wearing two coats, and only one of them is about the
external target.** Repo-basis claims, by the `evidenceRef` the author wrote:

| `evidenceRef` | count | resolves |
|---|---|---|
| `spec.md` (bare filename) | 11 | **no** |
| `AptnerPass/…` (solution-dir prefix) | 11 | **no** |
| repo-root-relative path | 7 | yes |

Excerpt paths split the same way: 5 root-relative (verified) against 6 prefixed (downgraded). The
prefix half is an artifact of running against a repository that is not `cwd` — real, but specific
to external-target use. **The bare-`spec.md` half is not, and it would fire on every target**: the
orchestrator labelled the prose sections of the evidence block `# spec.md (kept K of T …)`,
following the shape of Step 2-W's reduction notice, and the authors copied that label into
`evidenceRef` — where §3.5 resolves it against the repository root and finds nothing, because the
file lives at `docs/harness/<slug>/spec.md`. Eleven well-founded claims were relabelled
`inference` by a heading. Fixed by requiring the repo-relative path in the label (Step 1.3(6)).

**`sharedEvidence` is a cost bound, not an evidence boundary.** Topic t4 quoted the real body of
`ExtentionMethods.cs` — `where T : IComparable, IConvertible, IEquatable<T>`, with a line range —
and that file appears nowhere in the 34,958 characters that were sent. The authors kept their own
file tools and used them. This is the better failure mode (a real quote beats an invented one, and
§3.4 re-reads anyway), but every sentence in Step 2-W that reasons from "the authors receive
exactly this" is describing the transmission, not the evidence. Corrected in place rather than
deleted, because the cap's cost argument is unaffected and still holds.

**Two checks were measured against each other, and one of them is weaker than it reads.** §3.6's
`<`-vs-`&lt;` cross-check passed at 34/34 on a render that carried an **unescaped `&`** in the
localized `Interview Q&A` heading label — a string §3.6 itself names as an escape target. The
check counts `<` only. §3.8's non-empty section-key equality caught it, because it matches on the
rendered heading text. And §3.4's fingerprint is **exact-after-trim**, not merely
whitespace-tolerant: a quote that drops a line's trailing comment fails as `content-mismatch`.
"Whitespace-normalized" absorbs indentation and CRLF, nothing else.

**The label fix, measured A/B on a second C# target (`--harness guardtec-sse-d1-v1-compat`,
2026-08-05).** Same skill, same models, same orchestrator; the only change is that the evidence
block now labels the prose sections with their repo-relative paths (Step 1.3(6)).

| | run 1 (bare label) | run 2 (repo-relative label) |
|---|---|---|
| repo-basis claims resolving | 7 / 29 (24%) | **22 / 37 (59%)** |
| broken because the ref was a bare `spec.md` | **11** | **0** |
| a claim citing the new full label | — | **1, and it resolves** |
| broken because of an `AptnerPass/` prefix | 11 | 15 |
| excerpts verified / downgraded | 5 / 6 | 9 / 5 |

The label class went to zero; the prefix class did not move, which is the correct outcome — the
prefix is cwd-relative confusion on an external target and the fix never addressed it. **The
prefix is an unstated contract, not a slip**: the SAME file was cited both ways in one run —
`LocalCommonSection.cs` resolves 8 times root-relative and breaks 9 times prefixed — so
independent bucket authors each guessed a different root. `path`/`evidenceRef` are documented as
"repo-relative" without saying which directory is the repository; when `cwd` is the repository
that is unambiguous, and when it is not, nothing in the payload says so.

Two more things this run showed. The authors again read files that were not in `sharedEvidence`
(`EnumDefine.cs`, `GatePresenter.cs`) and quoted them correctly — those excerpts were downgraded
by the prefix, not by their content. And the evidence block's own labels are cap-consuming
overhead: making them repo-relative added 78 characters, and the assembler that had omitted the
prose headers from the overhead sum put the payload **177 characters over the cap** on this
target. Run 1 had survived the same omission only because its slack was smaller. **A slack return
that fills to the ceiling is exactly when an under-counted overhead becomes a violation** — the
corollary above describes the condition, and this is its first observed cost.

**The auto-detect ranking branch is still unexecuted — the premise that it would run here was
wrong.** `docs/harness/` in this repository is matched by `.gitignore:148` (`**/docs/harness/`);
the only two tracked paths under it sit in a directory that is not a candidate. Of 32 directories,
**16** carry both `spec.md` and `changes.md`, and `git log -1 --format=%cI` returns empty for
**all 16**, so Step 1.2 takes the mtime fallback exactly as it did on the other two repositories.
Three repositories, three mtime fallbacks: the git-tracked ranking branch has never run.
(Independent of that, an explicit `--harness <slug>` bypasses auto-detect altogether, so this
branch cannot be exercised by a flagged invocation at all.)

## §Citation Resolution

Measured 2026-08-05 against `AptnerPass` (`v1_develop` @ `1d0705264b8cb405f63e00820171f2e3e48b0852`),
across **all 16** auto-detect candidate slugs (both `spec.md` and `changes.md` present). Step 1.3(2)
extraction plus Step 1.3(3) exclusions and basename recovery were run as a script, with no repairs:
`bin/`/`obj/`/`artifacts/` stay out of the §Exclusion List, as §C# Target records.

`N` = distinct tokens extracted, `R` = tokens reaching an existing admissible file (recovery
included), `D` = dropped as non-existent, `rcv` = of `R`, how many needed basename recovery.
The two rightmost columns weight the same question by citation count instead of by distinct path.

| slug | N | R | R/N | D | rcv | cites | cites resolved |
|---|---|---|---|---|---|---|---|
| `guardtec-sse-unittest-recovery` | 19 | 14 | **74%** | 5 | 7 | 33 | 25 (76%) |
| `guardtec-sse-device-id-string` | 51 | 26 | 51% | 25 | 2 | 74 | 38 (51%) |
| `guardtec-sse-d1-v1-compat` | 14 | 7 | 50% | 7 | 7 | 40 | 25 (62%) |
| `guardtec-sse-r-bundle` | 18 | 8 | 44% | 10 | 5 | 48 | 23 (48%) |
| `guardtec-sse-b2-relogin` | 23 | 10 | 43% | 13 | 3 | 38 | 19 (50%) |
| `guardtec-sse-integration` | 37 | 16 | 43% | 21 | 4 | 52 | 24 (46%) |
| `guardtec-sse-relogin` | 17 | 7 | 41% | 10 | 3 | 36 | 13 (36%) |
| `cafe-pos-print-race` | 15 | 6 | 40% | 9 | 3 | 25 | 11 (44%) |
| `guardtec-sse-r1-token-errorcode` | 13 | 5 | 38% | 8 | 3 | 23 | 9 (39%) |
| `dining-ticket-print` | 22 | 8 | 36% | 14 | 2 | 31 | 12 (39%) |
| `guardtec-sse-critical-fix` | 20 | 7 | 35% | 13 | 3 | 35 | 14 (40%) |
| `cafe-receipt-dong-ho` | 20 | 7 | 35% | 13 | 7 | 34 | 9 (26%) |
| `guardtec-sse-review-fixes` | 43 | 14 | **33%** | 29 | 6 | 108 | 34 (31%) |
| `guardtec-sse-fast-follow` | 16 | 5 | 31% | 11 | 1 | 34 | 15 (44%) |
| `guardtec-sse-cleanup-2` | 5 | 1 | 20% | 4 | 1 | 13 | 3 (23%) |
| `gate-control-sse` | 30 | 6 | **20%** | 24 | 1 | 49 | 10 (20%) |
| **total** | **363** | **147** | **40%** | 206 | 55 | **673** | **284 (42%)** |

`guardtec-sse-review-fixes` reproduces §C# Target exactly — 43 distinct tokens, 108 citations,
29 dropped, 14 resolved — which is what makes the other 15 rows trustworthy.

**Why this forbids a threshold rather than supplying one.** The band is continuous from 20% to 74%
with no gap. The one target whose checkout mismatch is DOCUMENTED (`review-fixes`, work on
`epic/guardtec-sse` read against `v1_develop` — §C# Target) sits at 33%, and three targets score at
or below it with their checkout status never established either way — undocumented, not sound. Nor
is the low band an artifact of that one epic: the four
slugs outside it (`cafe-pos-print-race`, `dining-ticket-print`, `cafe-receipt-dong-ho`,
`gate-control-sse`) span 20–40%, squarely inside the same range. **A rate this low is the normal
state of a `--harness` target**, because a spec names files the work will create (§C# Target's
config-bucket gap is the same effect seen from the other side), abbreviates deep paths past what
recovery will accept, and spells one file two ways. So every candidate cut-off either fires on the
majority of sound targets or misses the real one. Step 1.6 therefore prints the number and draws
no conclusion from it.

**An ordering trap found while measuring, and it is not hypothetical.** Deciding `resolve ⊆ cwd` by
resolving the token — rather than by looking for a `..` segment — misroutes elision tokens. On
Windows, `Path(".../CommonSection.cs").resolve()` leaves the repository, so the token is dropped as
an escape **before** the recovery paragraph can run, and recovery is precisely what that shape
exists for. Measured: 5 such tokens in `d1-v1-compat` and 3 in `fast-follow`; correcting the order
moved `d1-v1-compat` from 21% to 50% by distinct token (52% → 62% by citation weight) and left
`fast-follow` unchanged, because its elision basenames (`FaceAuthSseService.cs`,
`FaceAuthSsePresenterCoordinator.cs`, `SseLineReader.cs`) do not exist on this branch at all and
are correctly dropped either way. Pinned in Step 1.3(3).

**`§C# Target` cannot be cited from a skill file, and that is a lint limitation, not a naming
choice.** `scripts/verify_sync_markers.py`'s section-reference pattern is
`§[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*`, which stops at the `#` and captures `§C`, then fails because
no `## §C` heading exists. Adding the first such citation to `skills/study/SKILL.md` broke the lint
immediately; the citation was redirected here instead. **Cite this section for anything a skill file
needs from §C# Target** until the pattern admits `#`. Recorded rather than repaired: widening a lint
regex is its own change with its own re-measurement, and no rule currently depends on it.

**Two figures carried in a handoff did not reproduce, and the handoff was the only record.** A
session note quoted this set as `82% d1-v1-compat / 76% unittest-recovery / 64% device-id-string /
31% review-fixes / 20% gate-control-sse`. Three of the five reproduce exactly; `d1-v1-compat`
measures 62% by citation weight (50% by distinct token) and `device-id-string` 51% by both. The
discrepancy is unexplained — the underlying run was never written down here, so there is nothing to
re-derive it from. **This is the case for the ledger, stated by its own absence**: a figure that
lives only in a handoff is a figure that cannot be checked, and per the header rule the reproduced
numbers above supersede it.
