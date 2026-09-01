# Changelog

All notable changes to agent-harness are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Added

- **GitHub Actions CI — `.github/workflows/lint.yml`.** The self-consistency lints run on every
  push and pull request; until now nothing ran them automatically. The workflow adds no separate
  end-of-line step, because `check_workflow_syntax.mjs` already scans working-tree bytes and index
  blobs. What CI adds is the promotion of that script's index-blob SKIP report to a hard failure,
  plus an assertion that its OK line is present: `bash -e` does not trip errexit on a failing `if`
  condition, so a bare negative grep over a log that was never written would otherwise pass.
- **`scripts/verify_manifest_sync.py`.** Compares `.claude-plugin/plugin.json` against
  `.claude-plugin/marketplace.json` on the plugin description, the keyword set, and the version
  string at every one of its three key paths. The marketplace entry is located by name rather
  than by index, so a second listed plugin cannot shift the comparison onto the wrong entry.
  `metadata.description`, `owner` and `author` are deliberately not compared, and the script's
  docstring records each exclusion with its reason, because JSON carries no comments.
- **`.github/scripts/check_lint_wiring.sh`.** Compares the lints that exist against the ones
  `lint.yml` actually runs, by name set rather than by count. A count is satisfied by duplicates:
  paste the same step twice while adding a lint and the check stays green while that lint executes
  zero times in CI. It lives outside `scripts/` so it neither matches the glob it counts nor
  counts itself.
- **`templates/_shared/session_conflict.md`.** The cross-skill session conflict gate now has a
  single source. It generalises `/spec`'s gate rather than duplicating it, and writes down the
  one place that generalisation must not be applied verbatim: `/harness` and `/ship` both read an
  absent `skill` field as the mark of a pre-skill-field legacy session and keep their own restart
  branch for it, so folding the absent case in would delete that path. The file is also the single
  source for the rule the gate is an instance of — a gate that cannot be answered halts when the
  action is destructive and continues when it is not.
- **`session-conflict` group in `verify_sync_markers.py`.** Nine groups, 48 marker sites at the
  time this entry was written; a later slice in the same batch raised the total to **51**, which
  is what the lint reports today. The
  floor was 4 with zero slack when this entry was written, and S3 raised it to 7 in the same
  change that added three more marker sites (see Changed); both tokens were measured to occur zero times across the four
  skill files before the edit, so neither can pass vacuously — unlike two existing groups whose
  comments record exactly that weakness in themselves.
- **`/harness doctor` — a read-only environment diagnostic.** The failures this plugin
  actually hits are environmental — a CRLF-contaminated installed copy that makes every
  Workflow-path skill refuse to launch, a stale install, a `/team-memory` store sitting under
  a gitignored path — and until now the means of diagnosing them were scattered across four
  documents. `doctor` reports six items with one `✓` or `⚠` each: installed-copy CR
  contamination across both known install locations, `Workflow` tool availability as this
  session observes it, git work-tree status, version and content drift on three axes, the
  team-memory store's ignore state, and how `agent-harness-defaults` resolves. It is reached
  through a carve-out at the top of §Session Recovery, so it never reads or writes
  `.harness/state.json` and never trips the session conflict gate that section owns.
- **`scripts/verify_description_budget.py`.** A sixth lint. It measures every skill's
  frontmatter `description` on a basis its docstring fixes before quoting any number — outer
  YAML quotes removed, `\r` excluded, UTF-8 characters — and enforces a per-skill cap, per-skill
  and total ceilings, lower bounds for the four descriptions this release shortened,
  required and forbidden token lists, frontmatter structure, and third person with a zero-slack
  allowlist. Raising a description past its ceiling requires raising that ceiling in the same
  commit; lowering is free, except below a recorded lower bound. It exists because Claude Code
  caps the skill listing at a share of the context window and, when that overflows, drops the
  descriptions of the least-used skills while keeping every name — a failure that reaches the
  user as nothing at all.
- **A five-minute first-task walkthrough in `README.md`.** It sits between `## Install` and
  `## Quick Start` and says which role each plays: the walkthrough is the one run you read
  start to finish, Quick Start stays the command catalogue. It names every prompt a real run
  shows, in order — the `Model` preset, the `Convention Scan` question, and HARD GATE #1
  (spec confirmation) — and then states the thing the gate count alone hides: **a green run
  answers one gate**, because gates #2 and #3 render only after mechanical verification has
  failed three times and only if auto-fix was chosen. Someone reading "3 HARD-GATEs" and
  expecting three prompts would conclude the run was broken.
- **A CI badge and a fixed-overhead table in `README.md`.** The badge points at
  `.github/workflows/lint.yml`. The table sits beside `### Token Cost vs. Quality` under
  `## At a Glance` and is the only place in the file carrying that figure — the mode
  multipliers are relative to a baseline that is not zero, and the largest part of that
  baseline is `/harness`'s own contract document loading before any work starts. It is
  reported on four bases at one commit (LF index bytes 211,235 / UTF-8 characters 207,239 /
  working-tree bytes / 2,508 lines at `118015d51aa15ee67f409b945fcd43c65a61d4f5`, measured
  2026-08-31) with the command for each, because bytes and characters differ here. **The
  working-tree row needed correcting before it shipped, by this release's own doing**: a Windows
  checkout measured 213,743 bytes, one carriage return per line more than the index, and the
  `*.md text eol=lf` line added below makes that number obsolete for every checkout from here on
  — a file attribute outranks `core.autocrlf`, so a checkout made from this release onward gets
  LF and matches the index at 211,235, while a working tree that already exists keeps CRLF until
  its files are checked out again. (Verified by cloning both commits: the old one measures
  213,743 with `w/crlf`, this one 211,235 with `w/lf`.) The old figure is kept in the table so an older checkout can recognise itself. The
  `### Token Cost vs. Quality Trade-off` table under `## workflow` gets a pointer and no
  number. **The epic plan's own figures for this table (194,572 / 190,805 / 196,865) were
  taken six slices earlier and are superseded, not wrong** — which is the whole reason the
  table ships with a basis, a SHA, a date, and a note that re-running the commands is the only
  trustworthy source.

### Changed

- **`.claude-plugin/marketplace.json` now matches `plugin.json`.** The marketplace copy of the
  plugin description was missing a clause, and its keyword array was missing entries that
  `plugin.json` carries; both are synchronised. The empty `owner.email` is removed. Edited in
  place against key anchors and never re-serialised, so the inline keyword array survives as a
  single line.
- **Four skill descriptions are shorter, and `/spec` loads again.** `study` drops from 1,009 to
  662 characters and the three deprecation stubs (`code-review`, `memory`, `workflow`) collapse
  to one line each, taking the 17-skill total from 7,709 (at `4295156`, before the trim)
  to 6,841 (at `118015d`). What `study` lost is the
  mode clause and the read-only/WebSearch clause: `plugin-shipped native Workflow segment` is
  shared by 9 skills and `opt-in gated` by 8, so neither helps Claude tell `study` apart, while
  everything kept — the seven guide sections, `verified revision material`, the provenance
  wording, `HTML report` — appears in no other skill. `/study`'s description therefore no
  longer states its workflow-path mode clause; that fact is already carried plugin-wide by
  `plugin.json`'s own description, and the other 8 workflow-path skills keep the clause until
  the wider description diet happens. The stubs' forwarding behaviour is unchanged — it lives
  in the body, and slash invocation resolves through `name`.
  Separately, `skills/spec/SKILL.md`'s description was an unquoted YAML plain scalar containing
  `": "`, which YAML cannot parse: **`/spec` was not loading**, and it was the only one of the
  17 skills missing from the session skill list. One character fixes it (`Also: ` → `Also — `),
  and the new lint rejects the pattern so it cannot come back quietly. `harness` keeps S5's
  doctor wording byte for byte — not the shortest string that keeps the literal `doctor`, but
  the criterion is minimum signal loss rather than minimum length.
- **`.gitattributes` normalises `*.sh` and `*.yml` to LF.** Both failure modes were measured on a
  CR-intolerant tool chain and are non-reproducible under Git Bash, which swallows a trailing CR;
  the CI runner is not Git Bash. A line-anchored regex stops matching a CRLF file, and a CRLF
  shell script does not run at all. The CR guards themselves are not new — they already lived in
  `check_workflow_syntax.mjs`; what changed is that they now run in CI and that a skipped
  index-blob guard fails instead of passing quietly. **They do not, however, cover these two file
  types**: that script scans `workflows/*.workflow.js` and nothing else, so for `*.sh` and `*.yml`
  the attribute line added here is the whole protection, not a belt beside an existing brace.
- **Documentation corrected where CI made it false.** The lint docstrings, `CLAUDE.md`,
  `skills/spec/SKILL.md` and the planner templates all said the lints run manually only, and
  `CLAUDE.md` said `.github/` holds issue and PR templates only. Those sentences now name the
  workflow. `README.md`'s Repository Layout gained rows for `.claude-plugin/` and `.github/`,
  and its `scripts/` row now lists the fifth lint. A pre-commit hook is still not wired, and
  the corrected text says so.
- **`/debug`, `/refactor`, `/migrate` and `/test-gen` no longer overwrite another skill's live
  session.** Each previously fell straight through to Setup when `.harness/state.json` belonged
  to a different skill, and Setup creates directories and runs `git checkout -b` before it writes
  any state of its own — so the other session's branch was already gone, with nothing asked and
  nothing printed. All four now evaluate the shared Session Conflict gate at the very top of
  Session Recovery, before any side effect: `Cancel` halts with `.harness/` untouched,
  `Delete and start` deletes it and starts fresh, and a non-interactive session defaults to halt.
  The absence case is deliberately unchanged — a directory with no `.harness/state.json` still
  proceeds to Setup with no prompt. **The gate is enforced as prose, not as code**: the new sync
  group proves the four skills carry the marker and the header and option literals, never that
  the gate actually fires. Only the pre-release live probe can show that.
- **`/harness` now gates a `version: "3.0"` session that carries no `skill` field, and its
  question names what is about to be deleted.** §Session Recovery item 1 was a two-way test where
  "`harness` or missing" both continued; absent `skill` now routes on `version` instead. `"3.0"`
  gates — a v3 file is defined as carrying both `version "3.0"` and `skill: "harness"`, so one
  without the field is not a well-formed session — while a missing or non-`"3.0"` version still
  reaches item 2's pre-harness branch with Restart/Stop and no Resume. **That third route is the
  point**: sending every absent-`skill` file to the gate would have left item 2 intact and
  unreachable, which no byte-comparison can detect. The gate's question now carries the task,
  phase and docs_path of the session being deleted, as `/spec`'s already did.
- **`/ship`'s conflict gate uses the shared labels and halts when nobody can answer.** Its
  question was a bare Yes/No with no header and no reference to the shared source; it is now the
  canonical `Session Conflict` / `Delete and start` / `Cancel` form, promoted to the top of
  Session Recovery so it is evaluated before the `skill` check rather than nested inside it.
  **The legacy branch's unattended behaviour was previously undefined** — not permissive,
  undefined — and is now fixed at halt, matching the shared source's rule that a destructive
  action never proceeds unanswered. `/ship` documents no headless usage anywhere, so no stated
  promise changes.
- **The `session-conflict` group's floor rose from 4 to 7** in the commit that followed the three
  marker-adding commits, because adding sites without raising the floor fails nothing — the
  failure mode is silent slack rather than a red build. **Its coverage claim is narrowed at the same time**,
  to what injection actually shows: the check fires when a literal's last occurrence in a file
  disappears, and it cannot see the gate's wording drifting away from the shared source while
  both literals survive — a limit that applies to all seven sites equally. `/spec` and `/harness`
  additionally already carried both tokens before their markers existed, so there the marker adds
  no coverage their own gate text did not already force. What is proven is that seven markers
  coexist and each site still carries both literals; that the seven gates still agree is not
  proven by any lint here.
- **`/team-memory save` no longer writes into a gitignored store *silently*.** It can still write
  there — `Continue local-only` is an offered answer and the non-interactive default — but it can
  no longer do so without saying so. Before this change the save flow ran no git command at all,
  so a store under an ignored path was written to and reported as `Saved : N records` with nothing
  said; this repository is exactly that case, since `.gitignore` ignores `docs/`. A new §Step 1.5
  evaluates the store's location once per
  invocation, between Step 1 and Step 2; it cannot sit "just before Step 3", because Step 2 is
  the per-item loop and calls Step 3 from inside it. The check covers the store, its README, each
  category directory and one **record-shaped probe per category**, not the store directory alone:
  a file glob under the store, a pattern on one category, and a store with a tracked descendant
  each leave the directory reported as not-ignored while the record about to be written is
  ignored — `git check-ignore` ignores the filesystem but consults the index, so only a new,
  untracked probe path is a trustworthy signal. The multi-path form drops `-q`, which is rejected
  outright once more than one path is passed. The work-tree test reads stdout rather than the exit
  code, because inside a `.git/` directory the command exits 0 and prints `false`.
- **The repair the gate offers is narrow by decision, and the narrowing is the point.** Which
  branch applies is decided by MEASURING the store's ancestors, never by the shape of the reported
  pattern. Only when an ancestor is itself ignored — this repository's `docs/` — is the ignoring
  line replaced with the star cascade, its depth set by the shallowest ignored ancestor. Every
  other shape (`*.md`, `**/memory/`, `docs/harness/memory/` itself, a per-category pattern, a
  nested `.gitignore`, `.git/info/exclude`, a global excludes file, or two different source lines)
  is reported with the exact lines to change and left alone. A delete-the-offending-line branch
  was drafted and dropped: with `*.md` it was measured to newly track every `.md` in a repository,
  and a one-directional side-effect check passes while it happens. Verification after an edit now
  runs in **both** directions — a sample that was ignored and is now tracked fails exactly as the
  reverse does — and any failure restores the line verbatim and re-asks instead of continuing on
  the user's behalf. Rollback never uses `git checkout`/`stash`/`restore`, which would swallow
  unrelated uncommitted work.
- **The unconditional "git-committed" claim is now conditional at all four sites inside the two
  skills that make it** — `/team-memory`'s frontmatter description and opening paragraph, and the
  deprecated `/memory` stub's blockquote and the sentence it PRINTS to the user. The description
  measures 412 UTF-8 characters, up from 400; that basis matters, because `awk length()` and
  `wc -c` report bytes on this shell (414) and confusing the two produced a false "400 is really
  402" correction during this slice. `README.md` (2 sites) and `CLAUDE.md` (1 site) carry the same
  unconditional claim and are deliberately untouched — this batch assigns those files to later
  slices — and are registered in `ROADMAP.md` rather than left to a commit message.
- **Two user-visible contract changes come with it.** The Save Report gains a `Store` line — an
  added label, documented in the skill as `templates/_shared/status_format.md` requires — with
  five states, keeping "not a work tree" separate from "ignored" and from "the check could not
  run", and never asserting that a path is *tracked*, which §Step 1.5 does not measure. And Key
  Rules 1, 2, 3 and 11 are all narrowed: rules 1 and 2 had claimed this skill writes nowhere
  outside `docs/harness/memory/`, which was already untrue of `clean`'s backup under
  `.harness/memory_backup/` and is now also untrue of the approved `.gitignore` edit; rules 3 and
  11 had said every write passes a **per-item** gate, which the new invocation-scoped gate is not.
- **Two limits stated rather than implied.** This repository's own `docs/`-vs-team-memory conflict
  is made *visible* by this change, not resolved: `docs/` is thirteen skills' runtime output path
  and stays ignored. And **no lint verifies any of the above** — `skills/team-memory/` and
  `skills/memory/` carry no SYNC marker and no workflow script, so all five lints plus the wiring
  check pass on these files whatever they say. Marker total is unchanged at 51. The gate's actual
  behaviour is established only by the pre-release live probe, which itself cannot reach the
  not-a-git-repository path (it runs inside this repository) — recorded in `ROADMAP.md`.
- **`doctor` is now reserved when it is the only positional argument to `/harness`.** The
  string was previously a task description like any other, so `/harness doctor` would have
  started a real session and written files. It now dispatches to the read-only sub-command
  instead. Value-taking flags are consumed before the test, so `/harness --mode single doctor`
  is the same invocation, while `/harness doctor xyz` is two positional tokens and stays an
  ordinary task. This is a behaviour
  change, not an addition: anyone who genuinely wants a task named `doctor` has to phrase it
  differently. `doctor` takes no arguments at all — every path it reads is a fixed constant or
  resolved at run time, never user-supplied — and it repairs nothing. A `⚠` points at the
  route that already owns the fix (a reinstall, or the `/team-memory` store gate); it does not
  edit `.gitignore`, re-sync an install copy, or touch either installed plugin directory.

- **`/handoff resume` now always reaches its gate, and `Next :` no longer names the slice that
  just finished.** A `resume` run printed the briefing, described its three options in prose, and
  ended the turn, leaving the human with context and no way to answer. Nothing in §Step 5
  authorised that — it was unspecified rather than allowed — so that section now states the
  invariant it lacked: **every path ends in exactly one `AskUserQuestion` call**, and when the
  first option cannot be constructed the gate is asked with the remaining two. Ending the turn
  after the briefing is named as a defect, not a conservative choice. Three gaps made that
  outcome likely and each is closed. (1) The no-single-command case had no rendered option set at
  all, so the standing instruction to "ask which command to run" had nothing to ask with. The
  first option now has **two defined forms**, the second described by the WORK rather than by a
  command — the epic-slice shape, where a slice is implemented directly from an epic plan instead
  of being invoked as a skill. Picking it still executes nothing extracted from prose: the human's
  selection is the authorisation, and the document never authorises itself. (2) The
  command-extraction count was purely syntactic, so a `/…` token inside a **negation** satisfied
  "exactly one". A handoff whose item 1 said the next step is not a single command, and mentioned
  `/harness` only to say the slices are not `/harness` tasks, would have rendered "Start next
  step" and run a real task, writing `.harness/state.json` and a docs directory. Tokens are now
  filtered to **candidates**, and an explicit statement that the next step is not a command forces
  the count to zero regardless of which tokens the text contains. (3) `Next :`'s tier-1 fallback
  took the ledger's last row when no row is `in-progress` — but a between-slices handoff records
  the slice it just finished as `done` and carries no `in-progress` row, so that fallback named
  the FINISHED slice **by construction**. It now prefers an explicit `Slice` label, and
  `generate`'s Next Steps convention gained the requirement to write one in the no-command case.
- **The obvious version of that last fix was measured and rejected, and the measurement ships with
  it.** The first draft scanned item 1 for the first backtick-quoted kebab-case token. Measured
  over all 31 ledger-bearing handoffs in `docs/harness/handoff/` (gitignored — not a public link),
  17 carry no `in-progress` row, and the heuristic would have matched 3 of them with **2 of the 3
  wrong**: one yielding `disallowed-tools`, which is not a slice identifier at all, and one
  yielding `slice-e-cold-pass` where the next slice was `slice-b-plan-pipeline`. Its real record
  is 1 right, 2 wrong, 14 silent. A confident wrong slice is worse than a disclosed fallback, so
  the labelled read replaced it and the heuristic is recorded as rejected rather than dropped
  silently. Handoffs written before the label keep the disclosed fallback; nothing retroactively
  fixes them. **Three superseded claims are corrected in place inside that paragraph** rather than
  deleted, per this repository's ledger convention — including a denominator of 18 that came from
  the un-normalized `Status` read the same change fixes.
- **A pre-existing `Status` comparison bug, surfaced by that measurement, is fixed in the same
  place.** Tier 1 compared the `Status` cell against the bare word `in-progress`, while 2 of the
  31 ledgers write it as bold-wrapped `` **`in-progress`** ``  — **corrected 2026-08-31: it is
  one ledger, one occurrence** (re-measured over the same directory, which by then held 33
  ledger-bearing handoffs; the population only grew, so no path takes the count from 2 down to 1
  and the original figure was simply wrong). The defect and the fix are unaffected. Note that
  every figure in this paragraph comes from `docs/harness/handoff/`, which this repository
  gitignores, so none of them can be re-derived from a commit — they are dated measurements, not
  reproducible ones; the exact match failed there and
  sent a handoff that HAS an in-progress row down the fallback — the same defect arriving from the
  opposite direction. `Status` is now normalised reader-side (emphasis, then backticks, then trim),
  on the same footing as the existing `Slice` rule. The `Epic` cell's identical wrapping stays a
  ROADMAP deferred item, unchanged.
- **`disallowed-tools` turn scoping gains a second observation that establishes less than it looks
  like.** `templates/_shared/mode_gate.md` rule 3 cause (a) gains a dated record: during a
  `/handoff resume` turn the tools that became unavailable were exactly that skill's whole
  `disallowed-tools` value (`NotebookEdit`, `WebSearch`, `WebFetch`), all three were available
  again in the next turn with no settings change, and `Agent`/`Workflow` — removed from that
  frontmatter in an earlier release — stayed available throughout. **Established:** the block does
  not persist past the turn boundary, and the blocked set tracks the installed frontmatter's
  current value. **Not established:** that the block outlives the skill's own steps *inside* the
  turn. Nothing was chained and the observed turn ended exactly where the skill's own steps ended,
  so the observation cannot separate turn-scoped from skill's-own-steps-scoped, and neither of
  §Step 5's two chaining-test outcomes fired. Cause (a) remains a candidate, not a diagnosis, and
  this is not a verified leak. An earlier draft of these lines asserted the turn scoping as
  established; a cold review caught it and the claim is withdrawn in place.
- **`.gitattributes` now covers `*.md`.** Until now, what this repository *committed* as line
  endings for its primary artifact depended on each machine's `core.autocrlf`. The blobs are
  LF only because this checkout has it set to `true`, and that value comes from the
  Git-for-Windows installation default rather than from anything the repository states; on a
  checkout where it is `false`, a CRLF blob is what gets committed, and the CR-intolerant
  failure modes already recorded for `*.sh` and `*.yml` stop being hypothetical for Markdown.
  **The line renormalises nothing**: all 94 tracked `.md` blobs were measured as `i/lf`
  before it landed. `git add --renormalize .` was therefore **not run** — it would have been a
  no-op that walks the whole tree, opening the same staging surface this batch bans with its
  `git add -A` rule. `CLAUDE.md`'s statement of what the attributes file covers is corrected
  in the same commit, since the old sentence became false the moment the line landed.
- **The unconditional "git-committed" claim is now conditional in `README.md` too** — all
  three sites: the skills overview row, the `## team-memory` opening paragraph, and the
  built-in-memory comparison table. This finishes what an earlier slice started inside
  `skills/team-memory/` and `skills/memory/`; the count is three rather than two because one
  site writes it capitalised and escapes a case-sensitive grep, which is how the earlier
  miscount happened. `CLAUDE.md`'s single site needed no change — it already reported what the
  skill *declares* rather than asserting the fact.
- **The deferrals this batch generated are now in `ROADMAP.md` instead of in a gitignored plan
  document — with one gap, stated because an unqualified "every" would be false.** Eight rows
  were added and seven existing rows amended in place, none deleted. The gap: the carry-over list
  was built from the session handoff document alone, and each slice plan keeps its own deferral
  section that was never swept. Two spot-checked items from those sections are genuinely missing,
  and the sweep itself is registered as its own row rather than guessed at.
  Two of the amendments close findings a prior slice had left open; the third closes a row
  that had itself gone stale — it still claimed a stale marker-site total in this file, which
  a slice had already corrected, so shipping it unamended would have released a deferred-item
  row asserting a defect that no longer existed. **Three items the ledger expected are absent on
  purpose** — the epic plan's item (f), the 500-line body recommendation, and the two
  second-person descriptions: each was already registered by the slice that found it, and
  re-registering would have produced duplicate rows. **Item (f) only partly**: the slice that
  owned it registered the one consequence it could not fix, and left the wording-convergence half
  in its own plan document — which is the same gap the row above records, arriving from the other
  direction. **One is registered against its own slice's
  instruction** — `claude plugin validate`'s exclusion from CI was decided with a reason, and
  that reason lived only in a plan document under the gitignored `docs/` tree, which is
  exactly the disappearing-judgement failure this batch exists to close.
- **A note on how append-only was verified, and on two things an earlier draft of this note got
  wrong.** The acceptance criterion asks that each removed row line survive as a substring of an
  added one. That is not achievable *for an in-row amendment*: a row ends in ` |`, so appending
  inside the last cell breaks contiguity wherever the text goes. **It is achievable by writing
  the correction as a separate line instead** — then no row line is removed at all and the check
  passes vacuously; `ROADMAP.md`'s own table already carries such a line, the `Correction (2026-08-24)` blockquote above its rows (an earlier draft of this sentence said "this file's own table" — CHANGELOG.md contains no table at all). So the two rules are
  incompatible, not the criterion impossible, and this repository's in-row convention was the one
  kept. Preservation was therefore checked **cell-wise**: each cell of the old row, **compared
  with leading and trailing whitespace trimmed**, must be a prefix of the corresponding trimmed
  cell of the new row. The trim is not cosmetic and an earlier draft omitted it while claiming
  "0 characters removed": appending a sentence replaces the cell's trailing space with a full
  stop, so **8 characters across the amended rows are not preserved byte-for-byte, and all 8 are
  that displaced space**. No content character is removed. Both corrections are recorded here
  rather than fixed silently, because swapping in a different test and reporting the original as
  passed is the failure mode this repository keeps auditing for — and the first draft of this
  very paragraph did a smaller version of it.
- **Four changes this batch made that no entry above had claimed.** Found by reading the epic's
  own diff file by file rather than by reading its plan, which is the only direction that can
  find an omission. (1) Two absolute line citations this batch's own edits would otherwise have
  rotted are now `§Section` references — `templates/_shared/askuserquestion.md`'s option-cap
  bullet, and `skills/harness/SKILL.md` §Step 2.6: Plan Critic. `CLAUDE.md` §Conventions makes
  that a contract, not a tidy-up. (2) A `/harness` example in `README.md` advertised a `--scope`
  flag the skill does not define; it is gone. (3) All seven session-conflict gate sites now carry
  the same placeholder-substitution instruction — `/harness` and `/ship` stopped at "never emit a
  `{...}` token verbatim" without saying what to emit instead, so a gate could have printed a
  literal `{task}` to the user. (4) `skills/harness/SKILL.md` §Version & Compatibility had its
  scope narrowed in the same commit.
- **Two claims in this batch's own commit messages are corrected here, because a commit message
  cannot be amended in place.** The correction commit's summary says "Nothing is deleted" — true
  of ROADMAP rows, of which none was removed, but not of prose: six rows that same commit had
  added one commit earlier were rewritten rather than amended, so their original wording is gone
  from the file and survives only in the diff. **Six, not the seven that message's own heading
  claims** — the seventh item it counted is the pre-existing `Correction (2026-08-24)` blockquote,
  which is neither a table row nor something that commit had added. That figure was carried into
  an earlier draft of this very entry without being re-measured, which is the failure this entry
  exists to describe. And its per-file edit counts do not all reproduce:
  its per-file counts sum to 26 while the bullets under those headings number 25 — the README
  heading says six corrections above five bullets, and no attempt is made here to name where the
  missing one went, because that would be another unverified figure. The figure to trust is the
  diff, not either message.
- **Three sentences that pointed at correct numbers incorrectly, found in a fourth review round.**
  Every figure in the overhead table and the ledger reproduces; what was wrong was the prose
  around them. (1) The paragraph under the overhead table split the rows by position — "the first
  three" versus "the last two" — and got both halves wrong: the working-tree byte row is
  clone-dependent and was counted among the commit-fixed ones, while the line count reads the
  committed blob and was counted among the clone-dependent ones. Four lines later the same
  paragraph said the opposite. Rows are now named rather than numbered, and the follow-on sentence
  that omitted the line count is corrected with them. (2) The deferral-sweep row said it failed to
  learn a lesson "from three rows away"; the distance is sixteen, and the commit message that
  introduced the row already said sixteen — the right number was in the immutable place and the
  wrong one in the editable place. (3) The EOL cell told the reader to expect "three tab-separated
  fields", but `git ls-files --eol` pads its three status fields with spaces and emits a single tab
  before the path, so following that instruction yields two fields and the cell's own reference to
  a "middle" field stops making sense.
- **What this release deliberately did NOT do to this file.** The closing slice was scoped to
  reorganise these entries into Added / Changed / Fixed. Added and Changed are used; **there is
  no Fixed section**, and that is a decision rather than an omission: several entries here are
  written as narratives that reference each other across the boundary — one begins "surfaced by
  that measurement, is fixed in the same place" — so splitting bug fixes out would break the
  references that make them readable. The acceptance criterion for this file asks for
  completeness, for the three behaviour changes to be findable under Changed, and for no version
  heading; all three hold.

## [8.11.0] — 2026-08-20

> **Version heading note — follows 8.10.0's actual precedent.** An earlier revision of this
> entry carried a fixed `## [8.11.0] — 2026-08-19` heading and claimed it matched 8.10.0's
> precedent. It did not: 8.10.0 kept `## [Unreleased]` through development and resolved the
> heading **in its release commit**, which bumped the manifest in that same commit
> (`plugin.json` / `marketplace.json`). Pre-fixing the version here would have created two
> problems the fixed heading itself caused: `/ship` Stage 3 has no duplicate-heading check, so
> approving its changelog draft would have produced a second `## [8.11.0]` and Stage 7 — which
> extracts from the FIRST such heading to the next `## [` — would have published the generated
> commit list as the release notes while this 179-line section sat below it, unread. The date
> was wrong too (the batch's commits are dated 2026-08-20). `/ship` resolves this heading to
> `## [8.11.0] — <release date>` and bumps the manifest's 3 key paths in the same commit.

Closes 11 items from `ROADMAP.md`'s deferred tables — 9 from `## Unreleased` and 2 from the
`## v8.8 — Shipped` table (P2-1, whose first half B7 closes, and the P2-3 row whose line-count
figure A3 corrects): 4 stale-row corrections (A1–A4) and 7 contract/script fixes (B1–B7). This repository has no application source or test
suite — the four `scripts/` lints (`verify_sync_markers.py` / `verify_meta_literal.py` /
`verify_block_sync.py` / `check_workflow_syntax.mjs`) are the entire mechanical verification
layer, and none of them check whether contract prose is *true* — only that markers, tokens, and
syntax are internally consistent. All four ran clean before this batch's first edit, again
immediately after B1 (the one lint-affecting change), and again after every edit below;
`docs/harness/roadmap-deferred-v8-11/verify_log.md` (gitignored — not a public link) has the
per-checkpoint exit codes and the 2 voice-test results. **DESIGN-PASS (~18 items) and
RECORD-ONLY (~9 items) rows in `ROADMAP.md`'s deferred table are unchanged and stay
out-of-scope** — this batch closed only the rows its own spec named IMPLEMENTABLE-and-in-scope.

### Added

- **`CLAUDE.md` — new repository-root contract summary (untracked → tracked in this batch).**
  Generated by `/md-generate` during this batch and verified by an isolated evaluator that
  re-read the repository independently (9 accuracy issues + 7 coverage gaps found and applied).
  It documents the Mode Gate opt-in, the `meta.phases` object-literal requirement, the
  zero-slack `min_sites` convention, the `TPL_*`/`FRAG_*` split, the `${CLAUDE_PLUGIN_ROOT}`
  dispatch path, the 3 version key paths, and the `/team-memory`-vs-`.gitignore` conflict this
  repository actually has. It must ship in the same **release** as
  `workflows/harness.plan.workflow.js`, whose new revision-notes section cites
  `CLAUDE.md §Conventions` by name — without it that citation points outside the tracked tree.
  **Correction**: an earlier revision of this bullet said "the same commit" and the batch then
  violated it — the workflow landed in `fe672a5` and this file in `b87354f`, so across
  `fe672a5`..`b1263e4` the citation did point outside the tracked tree. It resolves at the
  branch tip, which is what ships; the intra-branch window is disclosed rather than hidden.

### Fixed

- **`skills/harness/SKILL.md` §Step 2 — WORKFLOW path, Auto-revise re-entry — data loss on
  `.harness/planner/proposals.json`.** The re-entry paragraph instructed the orchestrator to
  overwrite `proposals.json` with the segment's returned `proposals` on every re-entry, "kept
  authoritative even though unchanged on this path" — but the segment returns the caller's
  `priorProposals` with only falsy elements filtered out, so on that path a rewrite can only
  put the orchestrator's own serialisation back over the first dispatch's file. **Evidence level,
  stated to match `skills/harness/SKILL.md`'s own wording**: a 2026-08-19 run recorded that file
  shrinking 15,807 B → 10,793 B across a resume, but **the mechanism was never reproduced**, so
  that figure is cited as a dated one-run observation, not as proof of cause. The fix rests on
  the code fact above (the segment returns `A.priorProposals` with only falsy elements removed),
  not on the measurement. Narrowed to exactly the path that can lose the file: a
  `reSynthesisOnly: true` re-entry no longer rewrites the file — the first dispatch's copy
  (§Step 2 item 5) stays sole-authoritative. The same section also gains a paragraph stating
  what an **interrupted** re-entry leaves untouched (`spec.md` not re-rendered,
  `proposals.json` not written, `plan_critic.round` not incremented) and explicitly hands the
  *Workflow engine error* trigger back to item 10, whose graceful fallback re-runs the step on
  the INLINE path and therefore DOES re-render `spec.md` — the two triggers overlapped in an
  earlier revision of that paragraph and gave opposite instructions. The FULL re-run branch (proposals.json validity check fails) is
  unaffected and still writes in full, since that branch's Propose step produces genuinely new
  proposals. All 5 B4 ripple points (the file's 'You do NOT' summary line, §Architecture
  Principles #1, §Step 3 Auto-revise Exposure Predicate point 2, §Step 2.6's 'interrupted before
  its write', and `workflows/harness.plan.workflow.js`'s args-contract comment) were re-read for
  consistency; none of those five needed edits. A **sixth, cross-file** site did: the same
  script's `proposals` **return** comment stated the orchestrator persists the returned array
  unconditionally, which B4 makes false, so it was narrowed in place to the first dispatch and
  the FULL re-run and now cites `skills/harness/SKILL.md` §Step 2 — WORKFLOW path by name. That
  edit ships in this same release — **correction**: an earlier revision of this bullet said "this
  same commit", which the batch's own 7-way commit split made false. The narrowing landed in
  `fe672a5` (the revision-note relocation commit) and B4's `skills/harness/SKILL.md` change in
  `6e86249`. The `workflows/harness.plan.workflow.js` entry under **Changed** below covers the
  relocation only, not this narrowing.
- **`skills/ship/SKILL.md` §Step 2: Stage — version_bump's `#### Pass 2 — Apply Updates` — an
  unachievable re-serialization instruction.** The step told the orchestrator to re-serialize
  `.claude-plugin/*.json` "preserving key order, indentation … CRLF, BOM and trailing-newline"
  after a parse-mutate-serialize round trip — not achievable with any `json.dumps`-style
  settings, because no such setting preserves a JSON file's existing **inline array**
  formatting. Observed on this release (2026-08-19): following the instruction literally turned
  `plugin.json`'s one-line `keywords` array into 30 lines, so a 3-line version bump became a
  61-line diff. Replaced with a key-path-anchored, single-line in-place edit: parse is now a
  read-only oracle (before AND after the write), the anchor is the key path — never a bare
  `"version":` first match (`marketplace.json`'s `$.metadata.version` /
  `$.plugins[i].version` sharing one literal at different indentation is the concrete
  counter-example) — and a post-write byte assertion (every non-rewritten line plus the total
  line count must match the pre-write original) replaces "it parsed, so it's fine" as the
  correctness check. On assertion failure: restore this Pass 2 run's written files from their
  step-1 raw-byte backups, abort, block every later stage — Stage 3 (`changelog`) onward, not
  only the irreversible ones (`git_ops` / `gh_release`) — and report; if the restore itself
  fails, a new `substep` value (`version_bump_pass2_restore_failed`) halts the whole session
  instead of letting Session Recovery silently re-enter over a partially-mutated file. Step 3's
  4-way branch (key absent / idempotent / normal replace / drift warning) is unmodified; the
  Important regression-blocker paragraph keeps its original text with **one sentence appended**,
  stating that step 4's key-path-anchored, line-scoped edit is not a naive string replace either. **Honestly disclosed, not claimed**: this
  procedure ships unexecuted in this batch — its first real run is the next `/ship` invocation,
  which is also the release that
  ships this very change, and the manifest version bump itself is `/ship`'s job, not this
  batch's.

### Changed

- **`templates/_shared/askuserquestion.md` — the option-cap bullet's `skills/ship/SKILL.md`
  citation replaced with a §section anchor.** B5's Pass 2 rewrite shifted the lines below it, so
  that bullet's absolute line citation rotted **inside this same batch**; it now names
  `§6.5: Stage — merge_to_base`, step 7 "Push outcome handling" instead. The same bullet's
  `skills/test-gen/SKILL.md:142-150` citation is deliberately left alone (this batch's edits do
  not disturb it) and is registered as its own deferred row. The bullet's **self-citation**
  (`` `:7` ``, pointing at a line of this same file) is also replaced — by naming the rule it
  refers to instead, since a self-referential line number rots on any edit above it.
- **`README.md` — §Interactive UX's session-recovery bullet updated for B7.** It listed
  `Resume / Restart / Stop`, which stopped being true for `/harness` once the 4th option landed;
  it now names `View state only` and states that the other skills sharing that gate shape keep
  3 options. `CLAUDE.md` makes README sync part of a skill-surface change, so leaving it stale
  would have violated a convention this same batch commits.

- **`scripts/verify_sync_markers.py` — `conventions-field-contract` group tightened to its
  measured occurrence count.** `min_sites` raised `2` → `3` (slack 0). An inline comment records
  the 3 real sites and names the specific fragility of the third (an SSOT prose sentence that
  quotes the marker as a documented example, not an independent sync site) — rewording that
  sentence drops the count and fails the group with a message that does not name the real
  cause. Total marker sites across all 8 groups unchanged at 44.
- **`skills/handoff/SKILL.md` §Non-Goals — 2 absolute line citations replaced with §section-name
  citations.** `skills/migrate/SKILL.md:246` → `§Step 2: Analysis Phase` (its INLINE-path
  WebSearch-fails-fall-back-to-local-sources rule); `:531` → `§Key Rules`' WebSearch fallback
  bullet. Both heading strings verified present, literally, exactly once, in the target file.
  **Honest limit**: §section citations are not machine-checked in this repository
  (`scripts/verify_sync_markers.py`'s `SECTION_REF_TARGETS` covers one file, not this one) — this
  buys rot-resistance, not verifiability, and other absolute line citations remain elsewhere in
  the tracked tree (see `ROADMAP.md`'s new deferred rows) — this entry does not claim absolute
  line citations were eliminated, only that this batch's edits reduced their count and added
  none.
- **`skills/handoff/SKILL.md` §Step 5 — `Next :` tier-1 rule gains backtick normalization.** If
  the Progress Ledger's `Slice` value is wrapped in one pair of backticks, strip exactly that
  outer pair before printing it; unbalanced backticks are used verbatim, never guessed at.
  Reader-side only — does not change what `generate` writes, and has no effect on the
  `Next cmd:` byte-identical rule. Tier-2 is unaffected (it derives from a `Docs` path segment,
  not a ledger cell). The ledger's `Epic` cell has the same ambiguity and is NOT covered by this
  rule (it is a carry-forward selection key, not a display value) — disclosed in the same
  sentence and tracked as a new `ROADMAP.md` row rather than silently left asymmetric.
- **`workflows/harness.plan.workflow.js` — args-contract comment's 3 revision notes collected
  into one section.** The "An earlier revision of this comment said …" corrections
  (`reSynthesisOnly`/`priorProposals`; `criticFindings` dual-document; both re-entry gates'
  truthy checks) moved, verbatim and unrewritten, to one section at the end of the comment
  block, each keyword-prefixed to identify its original bullet — a pure relocation for
  readability, not a rewrite (this repository's revision-note-beside-the-code practice is
  deliberate anti-rot, not an accident, per `workflows/_reference/schemas.md`'s own append-only
  precedent). `node scripts/check_workflow_syntax.mjs` confirms LF preserved in both the working
  tree and the index blob; the `HARD GATE` (spaced) token, the args parse guard line, and the
  separate `critic-revision-block` SYNC marker were untouched.
- **`skills/harness/SKILL.md` §Session Recovery item 7 — non-destructive `View state only`
  4th option.** The default ("Otherwise") branch of the Resume/Restart/Stop gate gains a 4th
  option (item 7-(b)'s "`.harness/` is NOT deleted (unlike the usual Stop)" description phrasing
  reused; the label itself is new — `View state only`, carrying no `(Recommended)` marker) that prints the standard
  status block (§Standard Status Format, cited by name — its `Path` row already carries
  `path_resolved`, not repeated below) plus fields that block does not carry
  (`docs_path`, `verify.layer1_retries`/`layer2_retries`, `autofix.applied`,
  whether `epic.boundaries` is set, `plan_critic.applied`+`counts`), then halts — no gate loop,
  no `state.json` write. **Scope, stated plainly**: this closes only `/harness`'s own gate. The
  other 6 skills sharing the same 3-option `{Resume, Restart, Stop}` gate shape (`debug`,
  `migrate`, `refactor`, `ship`, `spec`, `test-gen`) are unmodified — this is a deliberate,
  single-skill fix (removing a destructive-only default), not the start of a 7-skill rollout,
  and is recorded as such in `ROADMAP.md`'s new deferred rows. Item 7-(a) Epic residue does not offer the new
  option either. Its **option set** is unmodified (still the same two choices), but its text is
  not: the parenthetical that cross-references this gate (`same labels/actions as below, minus
  "Resume"`) would have become false once a 4th option existed, so it was updated in the same
  commit to also say `minus "View state only"`. Item 7-(b) is unmodified outright.

### Documentation

- **`ROADMAP.md` — 4 stale rows corrected in place (append-only, no row's text deleted).**
  A1 (§Step 3 Pass A "Run Critic anyway"): the ①-c narrowing this row asked for is confirmed
  already implemented; the row's still-open half (a full pass over the file's other blanket
  `never`/`always` claims — 152 raw occurrences measured, 2026-08-19) is now sized rather than
  left vague. A2 (Epic AC-22 `docs_path` drift-detection): the row's "not implemented" verdict
  was itself stale — item 6.5 and item 7-(b) already implement it; the row's own quoted
  guarantee ("do NOT recompute from `cli_flags.output_dir`") remains true, so this is a
  narrowing of the verdict, not a reversal of the guarantee. A3 (`skills/harness/SKILL.md` line
  count): re-measured a second time, after this batch's own B4+B7 edits to that same file —
  2,288 lines (working tree, base `f32c3fb`, 2026-08-19) — both ROADMAP locations (the
  `## Unreleased` mention and the `## v8.8` P2-3 row) now point future readers at `wc -l`
  instead of at a number that this same commit already moved once. **Re-measured a third time,
  after every body edit to that same file landed in this batch — the original B4+B7 edits plus
  this batch's own QA rounds 1–6 fixes (round 3 = the Layer 3 pass, rounds 4–5 = two adversarial re-verification passes, round 6 = the pre-ship cold review) (working tree, base `f32c3fb`, 2026-08-19):
  2,293 lines** — this figure is valid only as of the last body edit to
  `skills/harness/SKILL.md` in this batch and rots the instant that file is edited again, which
  is exactly the mechanism that produced this entry's own prior correction. A4 (`schemas.md`
  orphaned `sliceHint` note): the factual half is closed by that file's own append-only correction note
  (cited by name); only the file-ownership question the row already raised remains open.
- **`ROADMAP.md` — 10 new deferred rows** recording what this batch deliberately left untouched:
  `/spec`'s own byte-parity twin of the B4 issue; the other 6 skills' unmodified recovery gates;
  `templates/_shared/askuserquestion.md`'s remaining `skills/test-gen/SKILL.md:142-150` citation;
  item 7-(a)'s destructive-only branch (option set unmodified; only its cross-reference
  parenthetical was kept true); 3 absolute line citation sites across 2 targets this
  batch's scope excluded; `SECTION_REF_TARGETS`' single-file coverage; the 2 items this batch
  only half-closed (P2-1's priority-rule half, A1's full-audit half); the Progress Ledger
  `Epic`-cell backtick gap surfaced by B3's own `Slice`-only scope; and one absolute line
  citation (the `` `spec.md:407` `` pointer inside `skills/handoff/SKILL.md`'s §Step 3.5
  reduced-check paragraph) discovered while capturing this
  batch's own pre-edit citation baseline, pointing at a `docs/`-gitignored file this repository
  cannot resolve.

## [8.10.0] — 2026-08-19

> **Version heading note**: slices A–E of this epic each landed without their own CHANGELOG entry,
> so this single entry covers the whole epic. The heading was resolved at release time to the
> **8.10.0** minor rather than staying `[Unreleased]`.

### Added — `harness-handoff-coldreview-epic-slice` epic (slices A–F): cold review in Eval + `/handoff` slice-command chaining + cross-reference SYNC groups

- **state.json v3 additive field contracts + `workflows/_reference/schemas.md`** (slice A) —
  `plan_critic.*`, `scale.*`, `epic.*` and `verify.cold_*` were declared as additive-optional
  fields with a documented "missing = default" for each, so state.json `version` stays `"3.0"`
  and in-flight sessions written before the fields existed remain readable. Contracts live in
  `skills/harness/SKILL.md` §Step 1: Setup (its state.json schema block) and `workflows/_reference/schemas.md`.
- **Plan pipeline: `steps`/`sliceHint` actually populated + low-cost re-synthesis re-entry**
  (slice B) — both synthesis templates gained an `### Implementation Steps` section and a
  `sliceHint` mapping, and `workflows/harness.plan.workflow.js` gained a
  `reSynthesisOnly`/`priorProposals` re-entry with proposals persisted to
  `.harness/planner/proposals.json`. Measured caveat: at real proposal sizes the re-entry
  payload exceeds what a dispatch accepts, so the low-cost path is exposed but not usable —
  see `ROADMAP.md`'s deferred table.
- **Plan Critic (§Step 2.6) + §Scale Assessment + 2-pass spec gate** (slice C) — a cold Critic
  pass now runs between Plan and the spec gate by reusing `workflows/spec.eval.workflow.js`
  with zero code changes; §Scale Assessment reports epic-vs-single signals with no threshold
  and no auto-branch; HARD GATE #1 renders as two sequential passes inside one gate (the
  counted gate total stays 3). See `skills/harness/SKILL.md` §Step 2.6 / §Scale Assessment /
  §Step 3.
- **§Step 3.5 Slice Plan + epic-exit branch + `docs_path` drift detection** (slice D) — an epic
  decision writes `{docs_path}slice_plan.md` and ends the session through a dedicated §Step 8
  branch that deletes `.harness/` regardless of any commit outcome (`phase` reuses the existing
  `"completed"` value — no new enum); §Session Recovery gained a `docs_path` drift check that
  recomputes from *this* invocation's own arguments. See `skills/harness/SKILL.md` §Step 3.5 /
  §Step 8 / §Session Recovery.
- **Cold review wired into `/harness`'s Eval stage** (slices C–E) — a 4th, independent review
  pass (`templates/evaluator/cold_reviewer.md`) runs after the Evaluator already returned PASS,
  gated by `--no-cold-pass` / `cold_dispatch_allowed` (WORKFLOW: `workflows/harness.eval.workflow.js`
  3rd segment phase; INLINE: `skills/harness/SKILL.md` §Step 6 item 7). `verify.cold_result`
  carries a 6-value + `null` vocabulary; a Critical/Major finding on a PASS round triggers one
  feedback retry (`verify.cold_retries`, capped at 1) before falling through to PASS with
  disclosure. See `skills/harness/SKILL.md` §Step 5/6/7.
- **`scripts/verify_sync_markers.py` — 3 new SYNC-WITH marker groups** (2 in slice F, 1 added during this release's readiness review) —
  `spec-eval-dual-caller` (`workflows/spec.eval.workflow.js`'s `// contract` comment declares TWO
  callers — `/spec` Phase 2c-D and `/harness` §Step 2.6 — and now both are proven to still carry
  `criticFindingsPath`/`specContent`/`qaNotes`) and `slice-command-format` (`/handoff`'s slice
  command convention now points at `skills/harness/SKILL.md` §Step 3.5: Slice Plan as its single
  format source; the group fails when a marker is removed outright, and does NOT catch a
  pointer whose prose rots while its marker stays -- one of its three tokens is a substring of
  the marker text itself, so the effective token set is two). These two groups' 5 fields
  are literal, with pre-slice-f occurrence counts recorded in-line as comments. The third group,
  `critic-revision-block`, came out of this release's readiness review: the re-entry critic
  paragraph is hand-duplicated across `workflows/harness.plan.workflow.js`'s
  `CRITIC_REVISION_BLOCK` and its two author-time sources (`templates/planner/synthesis.md`,
  `synthesis_standard.md`), and nothing enforced the match — `verify_block_sync.py`'s groups cover
  a different template family, and the `// SYNC-SOURCE:` comments are human notes the marker
  regex does not read. Checked by negative control rather than by the lint merely passing:
  injecting a one-word drift into one copy fails it, reverting passes. Total marker sites
  36 → 44; 5 pre-existing groups unchanged (`conventions-field-contract`=3, `ambiguity-prompt`=10,
  `project-defaults`=9, `adhoc-dispatch`=12, `handoff-state-record`=2).
- **`/handoff` slice-command chaining** (slice F) — `generate` records the next epic slice's
  command using `skills/harness/SKILL.md` §Step 3.5: Slice Plan's own `Slice`/`Command` format
  (named, not restated); `resume`'s briefing gains a `Next cmd:` row (the exact, byte-identical
  `/…` token extracted from Next Steps item 1) alongside a shortened `Next :` row (a 3-tier
  fallback: Progress Ledger `Slice` column → `Docs :` last path segment →, absent both, the
  full item-1 text exactly as before this change). The extraction rule that used to compare
  against the briefing's own printed value now compares against the source document instead —
  closing a self-referential gap a prior draft of this change would have introduced.
- **9-point cross-reference traversal + 3 pre-scan corrections** (slice F) — an after-only,
  5-value-vocabulary diff table covering Session Boundary, State Transition Diagram, Auto-fix
  invariants, Step Mode Prerequisites, Architecture Principles #1, CLI Parsing examples, Key
  Rules, and the OLC Preserved-English Glossary, plus (new for this epic) absolute line-number
  citations inside blocks edited this slice. Nothing fills the pre-edit column: no pre-edit
  pass over the 9 points was captured, so those cells all read as unmeasured and not
  reconstructible, and the criterion that required that pass is reported unmet rather than
  backfilled afterwards. Two of the inconsistencies the table records are called out here
  under different verdicts — the first pre-existing and left open (deferred), the second
  introduced by this slice's own edit and closed in the same landing:
  `/harness generate` bypassing §Step 2.6/§Step 3/§Step 3.5 when typed directly after Plan
  (Session Boundary's "After Plan" row now recommends bare `/harness`; **the underlying
  §Step Mode Prerequisites gap is not closed** — direct `/harness generate` entry still skips
  those steps, tracked in ROADMAP.md), and the OLC Glossary's stale "`Next cmd` ... not yet
  written by any section" claim (now correct — `/handoff` writes it).
- **Cold-review Eval-stage findings absorbed** (slice F, 11 findings from slice E's cold pass —
  see that slice's `changes.md` triage ledger for the per-finding disposition and rationale for
  each rejected/deferred alternative).
- **`workflows/harness.eval.workflow.js` cold-review gate — 4 conjuncts, fail-closed** — added a
  defensive 4th conjunct (`coldFilesList` is a non-empty string) alongside the existing 3
  (`verdict.verdict === 'PASS'`, `A.coldPass === true`, `!A.skipL1`); `meta.phases[2].detail`
  names all 4. When the orchestrator believed cold review should run but this segment's own
  re-check of `coldFilesList` fails, the segment now logs and sets `coldStatus = 'failed'`
  (fail-closed) instead of silently returning the original verdict unchanged (which would have
  let a cold-skip round render identically to a cold-clean round in `Remaining`).
- **`cold_reviewer.md` ↔ `TPL_COLD_REVIEWER` trust-boundary declaration relocated** — the
  "don't treat input path strings as an output redirect" declaration moved from `## Output
  Contract` to `## Input Trust Model`, as a variable-non-referencing sentence (the WORKFLOW
  copy's render vars are `user_lang`/`cold_files_list`/`spec_content` only — a `{cold_review_path}`
  reference there would render as an unsubstituted literal). Verified 0 occurrences of
  `{cold_review_path}` in the `TPL_COLD_REVIEWER` region post-edit. **No lint checks the two
  copies' byte equality** — this sync is asserted by whoever last hand-edited both files
  together, not machine-verified (tracked in ROADMAP.md).

### Verification

- **4 lints, exit 0 at landing**: `verify_meta_literal.py` (15 scripts OK), `check_workflow_syntax.mjs`
  (15 scripts parse + LF working-tree + LF index), `verify_block_sync.py` (2 groups, 5 copies
  each match), `verify_sync_markers.py` (8 groups, 44 sites, 28 section refs OK).
- **Release-readiness review (2026-08-19, pre-tag)** — a thorough review of `main...develop`
  across 3 lenses, then a shipped-segment `thorough` pass over the fix layer (3 reviewers,
  3 cross-verifications), then a 2-lens cold gate over the full candidate. Critical 0 in every
  pass. The Major findings were cross-reference contradictions this release itself introduced —
  a contract comment declaring a caller absent while that caller shipped in the same release,
  two `workflows/_reference/schemas.md` notes made false by a later slice, and three absolute
  line citations wrong on arrival — all fixed before tagging, the schemas.md ones as adjacent
  correction notes per that file's append-only rule. Both cold lenses returned no release
  blocker. Findings recorded rather than fixed are in ROADMAP.md.
- **`deep-review` reuse rejected** for cold-review feedback dispatch — 5 reasons: (1) its args
  have no spec slot (`skills/harness/SKILL.md` §Step 7's rejection table, epic §결정 2 #1); (2)
  its `diffContent` is orchestrator-collected and unbounded, an order of magnitude larger than a
  spec (#2); (3) 2–3 reviewers + synthesis exceeds the 1-pass adversarial budget this stage needs
  (#3); (4) it is read-only and writes no file, but retry feedback needs a file path (#4); (5)
  its `Finding.severity` vocabulary is lowercase + `suggestion`, cold review needs the uppercase
  3-grade vocabulary (`workflows/_reference/schemas.md` severity-vocabulary note) — reason 5 is
  this epic's own addition to the epic spec's 4-reason list, making the current
  `skills/harness/SKILL.md` §Step 7 table a 5-row table.
- **WORKFLOW-path spec serialization, measured (slice E, cited here — not re-measured)**: two
  distinct figures from two distinct runs — `specContent` = 52,084 B at §Step 2.6's Critic round
  1 (`runId wf_ada1d58b-865`); `specContent` = 63,603 B at §Step 5's shipped
  `harness.eval.workflow.js` dispatch (`runId wf_f4f02016-d07`) — these are **not the same
  execution's number**. Per round, `specContent` serializes up to 3 times (Critic dispatch,
  Evaluator dispatch, Cold Reviewer dispatch) — the WORKFLOW path's structural cost this epic's
  slice-f spec-size AC (AC-31) exists to bound.

## [8.9.0] — 2026-08-05

### Added — `/study`: verified study-guide generation (NEW skill)

- **`/study` skill** (`skills/study/SKILL.md`, `workflows/study.analyze.workflow.js`,
  `templates/study/`): turns an already-finished artifact — a `/harness` output directory
  (`--harness <slug>`), a whole project (`--project`), or a git diff (`--diff <range>`) — into a
  **7-section, 3-tier study guide** (concept / code excerpts / interview Q&A / hands-on exercise /
  engineering principle / anti-patterns / glossary + further reading). The finished work is the
  *material*, not the subject: each topic must name a transferable concept that holds outside this
  repository, and the artifact appears only as the example.
- **Machine-checked provenance, computed by the orchestrator and never self-declared by the
  author.** Every `source: 'repo'` excerpt is re-read from the real file and matched by
  whitespace-normalized fingerprint before it earns a `repo` badge; a claim whose `evidenceRef`
  does not resolve is auto-downgraded to `inference`. Completion prints counted (never asserted)
  lines: `Claims` / `Quotes` / `Exercises` / `Q&A` / `Refs` / `Excerpts` / `Topics`.
  **What is NOT checked is stated in the skill itself**: whether an explanation is pedagogically
  sound, whether an answer is correct, whether an external link exists, or whether the reader can
  reproduce the work.
- **External links are unverified by construction** — `WebSearch`/`WebFetch` sit in the skill's
  `disallowed-tools`, so every URL renders with an `[Link unverified]` badge and a canonical
  disclosure line appears at three surfaces. This is a structural fact, not a prompt promise.
- **3-tier mode**: `quick` (inline, no sub-agent, 3–5 topics — a complete path, never a stub, and
  the Windows CRLF safety net) or `deep`/`thorough` (3 evidence lenses → per-bucket topic authors
  → a thorough-only pedagogical critic → assemble, via a plugin-shipped native Workflow segment,
  opt-in gated). **The workflow path budgets LESS serialized evidence than quick, not more** —
  evidence cost is multiplied by agent count there and paid once inline.
- **Output**: a self-contained static HTML report (or `--md`), a `study_guide[_round<N>].json`
  SSOT snapshot, and an append-only `docs/harness/study_index.md`. Re-running the same target
  advances the round number; prior rounds are never deleted or overwritten.
- **Measurement ledger** (`workflows/_reference/study_measurements.md`, NEW): a hand-sync record
  holding every measurement the skill's rules rest on, plus a **Repudiated Figures** table of
  numbers that failed to reproduce. Split on the principle *prohibitions stay inline, proofs
  move out* — `skills/study/SKILL.md` is loaded in full on every invocation, so characters there
  are paid per run, while the evidence is only needed by the next editor. `scripts/verify_sync_markers.py`
  now fails when a `§Section` pointer into that ledger no longer resolves.

### Changed

- **`/handoff generate` writes immediately — the save confirmation is removed**
  (`skills/handoff/SKILL.md` Step 3/4). The gate was guarding a write that is safe by
  construction: the filename convention never overwrites (`-2`/`-3` on collision), the write is
  one local document touching no git state, no `.harness/` and nothing outward-facing, and
  `generate` is already an explicit user action. Step 3 now resolves the path and Step 4 writes.
  **What the gate genuinely bought — a chance to correct a fact before it became durable — is
  preserved by inverting the order**: the file IS the preview, and the write report always prints
  how to correct it (edit in place / re-run, which yields a new `-2` file / delete it).
  **One thing is given up and is documented as given up**: `Cancel` — there is no longer a path
  through `generate` that writes nothing, so an unwanted document is undone by deleting the file.
  The Progress Ledger's "no carry-forward source found" warning moved from the gate preview into
  the write report (a broken epic chain must never be silent). `resume` keeps its Step 5 gate —
  that one guards *starting work*, not writing a file.

### Fixed

- **`/study --diff`: `git diff --stat -- <range>` returned nothing, silently.** The `--` put the
  range after the pathspec separator, so git read it as a PATH and exited 0 with zero lines — on
  the one piece of evidence the cost gate shows the user. Found by executing the `--diff`
  reduction rung for the first time.
- **`/study` extracted zero paths from C# targets.** The extraction pattern carried no
  `cs`/`csproj`, so a C#/.NET target produced an empty evidence stage (0 → 108 citations after
  the fix), and a `.cs` outline row ported from `.java` would have been dead on arrival — C#
  block-scoped namespaces indent every type, so the column-0 anchor finds 0 types in all six real
  files tested. The `.cs` row anchors with `^\s*`.
- **Evidence labels were being copied into citations.** Labelling the prose sections with bare
  filenames (`spec.md`) sent well-founded claims to auto-downgraded `inference`, because
  `spec.md` does not exist at the repository root. Requiring the repo-relative path moved
  repo-basis claim resolution from **24% to 59%** on an A/B measurement, and the bare-filename
  failure class from 11 to 0.
- **Elided source paths were dropped instead of recovered.** Deep package trees make documents
  abbreviate (`app/.../controller/FooController.java`); such tokens cannot exist as written.
  Unique-basename recovery admits them, but ONLY when exactly one candidate exists and the tail
  matches — an ambiguous basename is never guessed, and every exclusion re-applies to the
  recovered path so a basename cannot smuggle this skill's own output back in as evidence.

### Notes — measured limits carried into the release

- **A `--harness` target is only as good as the checkout it is read against, and nothing detects
  the mismatch.** When the artifact describes work this tree does not have, the missing files are
  dropped correctly and every downstream check then passes green against whatever files DO exist.
  The cost gate now discloses `Cited paths : <R> of <N> resolved (<P>%)`. **Deliberately without
  a threshold**: measured across 16 targets the rate runs 20%–74% in a continuous band, the one
  documented-mismatch target sits at 33% with three scoring at or below it, so every candidate
  cut-off fires on the majority of sound targets.
- **The 35,000-character dispatch cap is a cost bound, not an evidence boundary.** Sub-agents keep
  their own file tools and were measured using them — including quoting, correctly and with
  verifying line ranges, two files the `--diff` reduction had dropped from what was sent.
- **`--diff` drop order carries no relevance signal** (it is `--stat` path order), and the
  `--project` branch and the auto-detect git-log ranking branch remain unexecuted. Recorded in the
  ledger rather than repaired: fixing them changes measurements that other rules depend on.

### Maintenance

- `templates/_shared/status_format.md` now covers stateless skills and per-skill identity labels.
- Segment scripts are forced to LF with CR guarded at two surfaces (working tree + index blobs).
- README, ROADMAP, and both `.claude-plugin` manifests updated for `/study` and the `/handoff`
  behavior change.

## [8.8.0] — 2026-07-28

### Added — Epic continuity (Anthropic best-practices gap analysis)

- **`## Session Boundary` single source** (`skills/harness/SKILL.md`): every point where a
  `/harness` session ends now prints one standardized block instead of ad-hoc prose. Type A
  (phase/step-mode boundaries after Plan/Generate/Verify/Evaluate, plus the Layer-1 max-retry
  1st HARD-GATE "Stop") shows the completed→next phase, the exact next-session resume command,
  `{docs_path}`, and a `/handoff generate` recommendation. Type B (Step 8 end-of-session
  summary — all 3 commit branches + `has_git == false`, excluding the commit-failure abort
  path) adds the completion reason (`QA PASS` / `Accept as-is` / `Max rounds reached`, derived
  from existing state — no new field), remaining-issue pointer, and commit sha. Replaces the
  previously unspecified (and inconsistent across 4 sites) "Inform user, halt." family of
  directives.
- **Step 8 "Commit code only" no longer deletes `{docs_path}`** (`skills/harness/SKILL.md`
  §Step 8): the recommended commit option used to stage 3 artifacts (`qa_notes.md` /
  `critic_findings.md` / `conventions.md`) then delete the entire `{docs_path}` working
  directory — including `spec.md` and `qa_report.md`, which were never staged. In a repo where
  `docs/` is `.gitignore`d (this repository's own default), that meant the flagship "Commit
  code only" path silently destroyed the evidence a later session or `/handoff` would need.
  `spec.md` and `qa_report.md` are now added to the staged-file list, and the `{docs_path}`
  deletion step is removed outright (only `.harness/` is ever deleted by Step 8, in any of the
  3 commit branches). Step 8's option description and the `(m2)` commit-first ordering note are
  updated to match; commit-first ordering and the no-delete-on-commit-failure safety rule are
  unchanged.
- **`/harness` → `/handoff` wiring** (`skills/harness/SKILL.md`, `skills/handoff/SKILL.md`):
  `/harness` now recommends `/handoff generate` at every Session Boundary. `/handoff generate`
  records `skill`/`task`/`phase`/`mode`/`docs_path` under a fixed-label parse-anchor format
  (new `<!-- SYNC-WITH: skills/handoff/SKILL.md §Fixed Label Record Format -->` group,
  `verify_sync_markers.py`, `min_sites: 2`). `/handoff resume` gains a new Step 3.5 — a
  read-only, report-only live cross-check of the recorded `phase` and `docs_path` against the
  current `.harness/state.json` (never mutates `.harness/`; `disallowed-tools` unchanged).
- **`/handoff` optional epic Progress Ledger** (`skills/handoff/SKILL.md`): `generate` gains an
  optional `## Progress Ledger` section (`Epic` / `Slice` / `Status` / `Evidence` / `Notes`
  columns; `Status` is a fixed English-raw enum — `done` / `in-progress` / `blocked` /
  `dropped`, never translated) that carries slice history across an epic's sessions inside the
  existing HANDOFF document (no new artifact path). Carry-forward source selection scans
  `docs/harness/handoff/` newest-first (capped at 20 files / 90 days) for the most recent
  document whose ledger's `Epic` matches — a DIFFERENT rule than `resume`'s newest-file-only
  selection, so a ledger-less single-task handoff in between two epic slices doesn't break the
  chain. No source found → starts an empty ledger, surfaced at the Step 3 HARD-GATE preview
  (never silent).
- **`/harness` branch-creation failure handling** (`skills/harness/SKILL.md` §Step 1): `git
  checkout -b harness/<slug>` failing (branch already exists) is no longer undefined behavior.
  An empty pre-existing branch is reused silently; a branch that already carries commits
  requires an explicit suffix (`harness/<slug>-2`) or user confirmation before reuse — silent
  reuse of a non-empty branch would mix a prior slice's commits into the new session's diff and
  contaminate Layer 2/3 judgment and `/deep-review` scope. The actual branch name used is always
  recorded in `state.json.branch`.
- **`/spec` cross-skill session-conflict gate** (`skills/spec/SKILL.md` §Session Recovery):
  `/spec` used to silently fall through to Step 1 and overwrite a live `.harness/state.json`
  owned by another skill (e.g. a paused `/harness` slice) with no confirmation at all — the
  asymmetric counterpart to `/harness`'s own "Session Conflict" gate, which already existed. A
  matching gate is added: if `.harness/state.json` exists and its `skill` field is absent or not
  `"spec"`, `/spec` now asks before deleting it (non-interactive sessions halt instead of
  auto-deleting — the safe default for a destructive, unattended action).
- **`/deep-review --spec <path>` opt-in Spec Conformance pass** (`skills/deep-review/SKILL.md`
  §Step 4.5): an orchestrator-inline pass (all modes) checks the diff against a spec's
  Acceptance Criteria / Scope / Out-of-Scope, producing an independent `## Spec Conformance`
  report section. The 5-perspective (quick) / specialist (deep/thorough) defect reviewers never
  see the spec — the anchoring invariant is unconditional. Conformance findings are excluded
  from `## Statistics` and `## Round Verdict` (no double counting); a `requirement not
  implemented` or `out-of-scope change` finding upgrades `## Assessment` to `REQUEST_CHANGES`
  (added as a row to the existing Assessment Logic table — the line's format and the Round
  Verdict mechanical rule are unchanged).
- **`/harness` L1 max-retry "Stop" now carries a resume-aware output** (`skills/harness/SKILL.md`
  §Step 5): the gate keeps its existing 3 options (`Auto-fix proposal` / `Continue to
  Evaluator` / `Stop` — no new option, no state-machine change) — `Stop`'s description now says
  the session is resumable, and selecting it prints the Session Boundary block plus a
  `/handoff generate` recommendation. `Stop` was already non-destructive (`phase` stays
  `verify_done`, no delete); what was missing was the user-facing signal that it is resumable.
- **`/harness` Setup Summary warns when Layer 1 is fully inactive** (`skills/harness/SKILL.md`
  §Step 1): if `build_cmd`/`test_cmd`/`lint_cmd`/`type_check_cmd` are ALL `null`, Setup Summary
  now prints a `⚠` warning (same position/format as the existing verifier-cost warning) that
  completion will rely on Layer 2/3 (LLM judgment) alone. Warning only — never halts (legitimate
  git-free/doc-only tasks have no verification commands).
- **`/spec` fresh-session recommendation** (`skills/spec/SKILL.md` §Phase 3): the "start
  implementation" prompt now defaults to "New session (Recommended)" — printing the exact
  `/harness --output-dir docs/harness/<slug>/ "..."` command for the user to run in a fresh
  session — alongside "Continue here" (immediate invoke, previous behavior) and "Done". The
  load-bearing `--output-dir` and the persist-then-cleanup-then-invoke/print ordering (C1) are
  unchanged in every branch.

### Not implemented this round (documented, not silently dropped)

- **P2-1** (non-destructive "view state only" Session Recovery option; no-args-vs-Session-Recovery
  priority documentation), **P2-2** (state-machine-level distinction between `completed` via QA
  PASS / Accept-as-is / Max-rounds — the Session Boundary block above only derives a
  display-only label from existing fields), and **P2-3** (a top-of-file invariant summary block
  in `skills/harness/SKILL.md`, given the file's length and compact-survival risk) are deferred.
  See `ROADMAP.md` for tracking.
- **Rejected, with reasons** (carried forward so they are not re-proposed at the next audit):
  skipping the plan phase for one-line diffs (`/harness` is deliberately a heavyweight
  orchestrator; small tasks shouldn't invoke it); reversing the ≥50-line CLAUDE.md "rich"
  threshold (that's `/md-optimize`'s job, not `/harness`'s); moving Key Rules/Architecture
  Principles to the top of `skills/harness/SKILL.md` (real compact-survival risk, but a
  broad reorg is out of scope here — tracked as P2-3); a new `/epic` skill (the 3-actually-used
  skills in practice are `/harness`/`/deep-review`/`/handoff` — extending `/handoff` gives the
  same value far cheaper); an epic state machine inside `/harness` itself (would break the
  `state.json` v3 / "1 task = 1 branch" invariants); strengthening the `verify_*.py` /
  `check_workflow_syntax.mjs` regexes (previously rejected on 6 false-positives — the only
  script touch here is the additive `handoff-state-record` SYNC group registration, not a
  strengthened check); and an auto-convergence loop for `/deep-review` (already scoped out in
  the v8.7 ROADMAP entry — rounds stay user-re-invoked bookkeeping).

### Fixed

- **`README.md` docs/harness File Structure note**: added an explicit statement that
  `docs/harness/<task-slug>/` is never deleted by any `/harness` Step 8 branch (only `.harness/`
  is) — closing the doc-vs-behavior gap the Step 8 fix above addresses, and keeping the existing
  `(preserved)` annotations, `skills/harness/SKILL.md` Key Rules, and the Step 8 commit-option
  description in agreement.

## [8.7.0] — 2026-07-24

### Added
- **`frontier` model preset** (`templates/_shared/model_config.md`): `executor=sonnet, advisor=opus,
  evaluator=fable, verifier=haiku` — top-model judgment with cost-efficient execution. `fable` is now a
  valid model for executor/advisor/evaluator cells and custom `Other` parses (never verifier). The
  interactive picker swaps `all-opus` for `frontier` (AskUserQuestion 4-option limit); `all-opus` stays
  available via `--model-config all-opus` or `Other`.
- **Project defaults** (`templates/_shared/project_defaults.md` NEW single source): one
  `agent-harness-defaults: path=..., model-config=..., verifier-model=...` line acts as a standing
  opt-in. Three sources, first wins wholesale: `.claude/settings.local.json`
  `env.AGENT_HARNESS_DEFAULTS` (personal, uncommitted — recommended for team repos), project root
  `CLAUDE.md` (team-agreed, committed), `~/.claude/CLAUDE.md` (personal global). Mode Gate
  §Ambiguity Prompt gains step 4.5 (reason `project default (<source>)`), the model picker and
  verifier default resolve silently from it, and session flags always win. Wired into all 8
  multi-path skills; `verify_sync_markers.py` gains the `project-defaults` SYNC group (min_sites 8).
- **Ad-hoc Dispatch Contract** (`templates/_shared/adhoc_dispatch.md` NEW single source): every
  sub-agent or Workflow script created during skill execution WITHOUT a shipped template must carry an
  explicit output-language directive (schema free-text field descriptions include `(in {user_lang})`)
  and route models by role (mechanical → executor tier, judgment → evaluator tier, never above the
  skill ceiling). Root-cause fix for the v8.6.0 English-leak (ad-hoc Explore/general-purpose dispatches
  bypassed the template `{user_lang}` wiring). Wired into 11 skills; `verify_sync_markers.py` gains the
  `adhoc-dispatch` SYNC group (min_sites 11).
- **`/handoff` skill** (NEW — `skills/handoff/SKILL.md`): human-gated session handoff.
  `generate` captures git state (verified by running commands), read-only `.harness/state.json`
  pointers, and Goal / Current State (verified) / Blockers / Next Steps / Definition of Done /
  Reading Order / Do NOT sections into `docs/harness/handoff/YYYY-MM-DD-<slug>.md` behind a
  Save/Edit/Cancel gate; `resume` primes a fresh session with git-drift verification (branch/HEAD
  match, commits-since list — report-only, never mutates git) and ends at an explicit gate; `list`
  enumerates handoffs. Inline-only, stateless, no engine escalation (team-memory pattern).

- **`/deep-review` round bookkeeping** (`skills/deep-review/SKILL.md`): re-running the same target
  auto-advances review rounds — standardized numbering (`review_report.md` = round 1,
  `review_round<N>.md` after), orchestrator-only reconciliation of prior findings
  (likely resolved / still open / unverifiable — reviewers stay blind; anchoring prevention intact),
  and an advisory `## Round Verdict` block (PASS / CONDITIONAL PASS / FAIL by mechanical rule).
  No auto-loop: each round is a fresh user invocation; `--fresh` skips reconciliation. The /spec
  Critic oscillation invariant (auto-revise max 1 round) is untouched.
- **`/spec` Review Sheet + `/spec digest`** (`skills/spec/SKILL.md`): every spec now opens with a
  derived `## Review Sheet` (≤5-line TL;DR, decision table, invariants & top risks, open
  `[unconfirmed]` questions, reading order, and — on re-synthesis only — "Changed in this
  revision"); derived at render time, introduces no new facts, ignored by /harness (seven-section
  contract unchanged). New read-only sub-command `/spec digest <path> [--artifact]` produces a
  3-layer briefing (30-second / 5-minute / section-map with `path:line` anchors) plus mermaid
  diagrams where genuinely diagrammable; optional Artifact publish, graceful skip when unavailable.

- **Model fallback chain** (`templates/_shared/model_config.md`): if a dispatch fails because a
  preset cell's model id is unknown/unavailable (model sunset — e.g. a future `fable`
  retirement), the cell downgrades step-by-step (`fable → opus → sonnet → haiku → parent
  inherit`) with a once-per-session warning and a Setup Summary / report echo of the
  actually-used model; the downgrade is remembered for the session. Preset names are
  indirection — a sunset needs only a one-line preset-table patch, and persistent
  `model-config=<preset>` project defaults keep working across model generations.

### Changed
- **Judgment agents remapped advisor → evaluator** (deep-review Cross-Verification, debug Cross
  Verifier, spec Critic, codebase-audit Completeness Critic, refactor Cross-Critique; SKILL.md role maps + `args.models` now
  pass `evaluator`; segment scripts read `MODELS.evaluator || MODELS.advisor` for stale-args resumes).
  Behavior-preserving for pre-8.7 presets — their advisor and evaluator cells are identical; only
  `frontier` differentiates the two roles. Custom `Other` `evaluator:` values — previously
  stored-but-unused in deep-review — are now honored.
- Interactive model pickers accept a bare preset name (e.g. `all-opus`) via `Other`, in addition to
  the `executor:...,advisor:...,evaluator:...` custom format.

## [8.6.0] — 2026-07-08

### Added
- **Mode Gate §Ambiguity Prompt** (`templates/_shared/mode_gate.md` single source, wired into all 8
  multi-path skills — `/harness`, `/spec`, `/debug`, `/deep-review`, `/codebase-audit`, `/migrate`,
  `/refactor`, `/test-gen`): when no `--mode` is given and ultracode is OFF (and the Workflow engine is
  available in an interactive session), skills now explicitly ask inline-vs-workflow instead of resolving
  silently. `--no-prompt` and non-interactive sessions keep the silent auto-resolution.
- **Mode Gate §Path Transparency**: every skill now prints `Path : <inline|workflow> (<reason>)` so the
  chosen execution path and its cause are always visible — including on the auto-resolved and ultracode paths.
- **`scripts/verify_sync_markers.py` §Ambiguity Prompt SYNC group**: the §Ambiguity Prompt marker is now
  tracked as a SYNC group — the linter checks that the single-source target exists and that the marker is
  present across the wired skills (referential integrity + a minimum-site-count floor), so a skill dropping its
  `SYNC-WITH` marker fails the lint. It does NOT diff each skill's wiring against the single-source prose, and
  §Path Transparency has no marker group yet — both are candidate follow-ups.

### Changed
- ultracode ON now prints its workflow reason instead of silently flipping the path (no behavior change to
  the resolved path — transparency only).

### Fixed
- `/migrate` and `/refactor` Setup resolution step now wires §Ambiguity Prompt at the correct anchor (was
  mis-anchored at the summary bullet).
- `harness` / `codebase-audit` status-format Path row now includes the `<reason>` (§Path Transparency
  completeness); `migrate`/`refactor` added to the §Ambiguity Prompt scope-advisory example list.

## [8.5.1] — 2026-06-22

### Fixed (`/harness` adversarial skill audit — 3 medium state/data-safety issues)

- **Session Recovery no longer replays a user-halted max-retry state** (`skills/harness/SKILL.md` §Session Recovery, `verify_done` branch): after Layer 1 fails 3× and the user picks **Stop** at the 1st HARD-GATE, `phase` stays `verify_done` and `autofix` stays `null`. The old resume logic matched only `state.autofix == null`, reset `layer1_retries → 0`, and replayed Step 5 — re-running the entire retry loop against un-regenerated code straight back to the same gate (wasted tokens, lost user decision). Resume now detects `autofix == null AND layer1_result == "FAIL" AND layer1_retries >= 3` and re-enters the 1st HARD-GATE directly without resetting the budget, letting the user re-decide.
- **Artifact cleanup is now commit-first** (`skills/harness/SKILL.md` §Step 8, "Commit code only" + "Commit all"): the prior sequence deleted `.harness/` (state.json) and `{docs_path}` **before** committing, so a `git commit` failure (pre-commit hook, signing, locked index, disk) permanently lost the session state and spec artifacts. The commit now runs before either delete and is success-confirmed; on failure nothing is deleted, so the session stays resumable and artifacts recoverable.
- **INLINE Layer 2 retry now receives the Layer-2 report** (`skills/harness/SKILL.md` §Step 7 Layer 2 retry + §Step 4 retry rules): the INLINE path passed `{verify_report_path}` = `verify_report.md` (the Layer-1 mechanical report, which PASSED) on a structural Layer 2 failure, so the Generator retried without seeing what actually failed (those findings live in `qa_report.md`). INLINE now overrides `{verify_report_path}` = `qa_report.md` for Layer 2 retries, matching the WORKFLOW path (`harness.eval`) which was already correct.

### Fixed (`/harness` adversarial skill audit — low-severity doc/lint consistency)

- **Unified-diff header description corrected** (`skills/harness/SKILL.md` §Step 5 Apply + §Architecture Principles #1): the Auto-fix Apply path-validation step and the Principle #1 exception described the `--- a/` / `+++ b/` headers as "4 header lines per hunk" / "4 lines of metadata". A unified diff carries that header pair **once per file**, not per hunk — corrected to "2 header lines per file".
- **Path Validator exclusion lists made consistent** (`skills/harness/SKILL.md` §Path Validator): `file_reference` now excludes `.git/` (matching `diff_target`, which already did), and `diff_target`'s `docs/harness/` is unified to the starred `docs/harness/*` form. Both kinds now exclude exactly `.harness/, docs/harness/*, memory/, .git/`.
- **`planner_single.md` spec gains an `### Edge Cases` section** (`templates/planner/planner_single.md`): the inline Planner's 1-line return reports `{M} edge cases`, but the written spec had no Edge Cases section to count from. Added the section (between Completion Criteria and Risks, matching the WORKFLOW-path spec structure) so `{M}` has a real source.
- **Conservative FAIL fallback for unparseable verify/evaluate 1-line returns** (`skills/harness/SKILL.md` §Step 5 INLINE parse + §Step 6 parse): both parsers branched only on `PASS` and `FAIL`. A malformed return containing neither keyword left the result state undefined. Added an explicit else branch — Layer 1 → conservative `FAIL`; Layer 2/3 → route to the Layer 3 user Fix/Accept gate (never a silent pass), with Step 7's `qa_report.md` `### Verdict:` line as the authority.
- **`scripts/verify_meta_literal.py` phases-title check scoped to the `phases` chunk**: the `meta.phases entries lack a title` check searched the whole meta body, so a `title:` appearing elsewhere (e.g. a top-level meta key) false-greened the check even when the `phases` entries had no `title`. It now searches only the extracted `phases` chunk. Negative-tested (catches the crafted bad fixture, no false-positive on a good fixture, all 14 real scripts still pass).
- **Gate-leak lint claim made honest** (`skills/harness/SKILL.md` §Architecture Principles #6 + `scripts/verify_meta_literal.py` docstring / `BANNED_GATE` comment): Principle #6 said the linter "enforces" gate-freedom; it is a **marker-based tripwire** (rejects the `<HARD-GATE>` tag form, `AskUserQuestion`, and the `Apply patch` label). The audit-suggested strengthening to also match the spaced prose `HARD GATE #N` was **rejected** — segment scripts legitimately reference it in comments ("Runs AFTER HARD GATE #1"); a `HARD[\s-]*GATE` regex would false-positive on 6 such comments across 3 of the 14 scripts and break the green baseline. The wording is now precise and a code comment records the rationale.
- **SYNC-WITH marker verification implemented** (`scripts/verify_sync_markers.py` NEW + `skills/spec/SKILL.md` §Step 1.5 conventions field contract): the contract promised "a CI lint pass can `grep` the marker and verify all sites declare the same enum", but no such check existed. Added `verify_sync_markers.py` — it validates referential integrity (target file + canonical anchor exists) and enum consistency (every file carrying the `SYNC-WITH` marker declares all of `` `null` `` / `"skipped"` / `"file:.harness/conventions.md"`); exit 1 on drift / broken reference, exit 2 if a group's marker vanished entirely. Negative-tested (injected missing-token, broken-reference, and missing-marker cases all caught). The spec wording now points to the script (run manually; pre-commit/CI wiring remains a stated TODO).
- **`changedFilesList` source priority made explicit for resume after an inline fallback** (`skills/harness/SKILL.md` §Step 5 WORKFLOW + §Architecture Principles #1): the Eval-segment `changedFilesList` arg named only the in-context ChangeSet and `workflow_ctx.changedFiles`. After a WORKFLOW→INLINE graceful fallback the build leaves `workflow_ctx` null, so a later workflow-path resume had no documented source. Added the explicit 3-tier priority (in-context ChangeSet → `workflow_ctx.changedFiles` → extract paths from `{docs_path}changes.md`, reasons stripped), and registered the `changes.md` path-only extraction in the Principle #1 reconstruction-read exception list.
- **Build segment folds a plan file-inventory into the plan digest** (`workflows/harness.build.workflow.js`): the Lead Developer's File-by-File plan already lists each target file in `keyPoints`, but advisors and the implementer were each told to "explore the codebase" from scratch, repeating the broad discovery the planner had done. `planDigest` now appends an explicit "Files the plan targets" list (paths parsed from `keyPoints`), so advisors, the implementer, and retry passes (which reuse the stored digest verbatim) can open those files directly. This is a soft hint that reduces redundant broad *re-discovery* — not a content cache; each sub-agent still reads files in its own context. No schema or orchestrator change; `verify_meta_literal.py` and `check_workflow_syntax.mjs` still pass.

## [8.5.0] — 2026-06-08

### Added

- **`disallowed-tools` frontmatter on every skill** — runtime enforcement of each skill's read-only / no-escalation contract (a verified-safe subset): `/team-memory` blocks `Task`/`Agent`/`Workflow`/`WebSearch`/`WebFetch`; read-only review/audit skills (`/deep-review`, `/codebase-audit`) block `Edit`/`Write`; `/md-generate` & `/md-optimize` block `NotebookEdit`/`WebSearch`/`WebFetch`. The contract is now harness-enforced, not just documented in prose.
- **`/harness` (formerly `/workflow`)** — renamed to end the concept collision with Claude Code's native Workflow engine. The old `/workflow` name is preserved as a ~30-line deprecation alias stub (frontmatter `name: workflow` kept for discovery; AskUserQuestion → Yes delegates to `/harness`).
- **WORKFLOW path (opt-in)**: `/harness` now runs plugin-shipped native Workflow segment scripts via `Workflow {scriptPath: ${CLAUDE_PLUGIN_ROOT}/workflows/...}` — `harness.plan.workflow.js` (persona fan-out → synthesis → `PlanResult`), `harness.build.workflow.js` (plan → advisors → implementation → `ChangeSet`, `retry:true` skips re-plan/re-review), `harness.eval.workflow.js` (L1 mechanical → L2/L3 evaluation → `VerifyVerdict`, `skipL1`/`onlyL1` flags). Schema-validated `agent({schema})` returns replace 1-line parsing, proposal-file re-reads, and the `### Verdict:` regex on this path. The 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) stay in the orchestrator BETWEEN segment runs — `scripts/verify_meta_literal.py` rejects any gate token inside a script.
- **Mode Gate wiring (first consumer of `templates/_shared/mode_gate.md`)**: default = inline single path; workflow path only when the Workflow tool is available AND (ultracode session OR explicit `--mode standard/multi`); `has_git == false` forces inline; any engine failure degrades gracefully to inline single. The mode-selection AskUserQuestion roundtrip is removed (mode is derived, `--model-config` ask kept).
- **`scripts/verify_meta_literal.py` full implementation** (was a Phase-0 stub): meta pure-literal (name/description + `phases` as `[{title, detail?}]` OBJECT literals), ban on `Date.now`/`new Date`/`Math.random`, HARD-GATE-leak ban, **ban on `import` and any `export` beyond the leading meta** (the engine rejects them as SyntaxError), and a required defensive-args-parse guard (`typeof args === 'string'` — the engine delivers `args` as a JSON string). Negative-tested (12 violations on a bad fixture).
- **`scripts/check_workflow_syntax.mjs` (NEW)**: engine-dialect syntax gate. Discovery: `node --check` is a TOTAL false-green for files containing ESM `export` syntax on Node 24 (even `function {{{` passes) — the planned `node --check` gate was useless for these scripts. The checker compiles each script body inside an AsyncFunction (top-level await/return legal, never executed).
- **`workflows/_reference/schemas.md`**: canonical hand-sync schema copies (no runtime `schemas.js` import — engine scripts are self-contained plain JS). Pilot schema deltas recorded there: `PlanResult` gains `background`/`scope{}`/`approach`/`testingStrategy`/`risks[].source` and `steps` is no longer required; `ChangeSet` gains `advisorFeedbackApplied/Declined`; L1 mechanical failure is encoded `{layer:'L1', verdict:'FAIL_L2'}` (branch on layer+verdict).
- **Phase 2a — `/spec` deep mode on the WORKFLOW path**: `spec.plan.workflow.js` (4 analysts via `parallel()` → synthesis → `PlanResult`; `reSynthesisOnly` re-entry skips the analyst fan-out, mirroring harness.build's retry) + `spec.eval.workflow.js` (Critic → `CriticReport`, counts normalized from items; the agent still writes `critic_findings.md` — kept user-facing artifact). The `^critic_findings written — Critical=(\d+)...$` regex, its Parse-Fail Gate, and the `parse_failed_approved/halted` failure modes are structurally retired; the `— no findings —` sentinel scan is replaced by a structured `hasFindings` boolean (additive AnalysisResult delta). Critic Gate / 2nd Critic Gate / Spec Approval HARD-GATE all stay in the orchestrator BETWEEN segment runs. Analyst proposals persist to `.harness/spec/proposals.json` (re-synthesis + resume source); the HARD-GATE/Critic-Gate Modify text travels as `args.modRequest` and is appended inside the C4 sentinel block AFTER placeholder rendering (injection defense preserved in the script).
- **Phase 2c — `/debug` deep mode on the WORKFLOW path**: `debug.analyze.workflow.js` (error_analyst + code_archaeologist via `parallel()`, anchoring-free → ADVERSARIAL cross-verify that tries to refute the surviving hypothesis with a fresh action, max 2 rounds → `RootCause`). New schemas `Hypothesis` (`verification.minItems: 1` — the executable-verification mandate enforced at the schema layer), `DebugAnalysis` (analysts return structured hypotheses instead of lossy keyPoints strings), `RootCause` (+`adversarialAudit`/`conflictsResolved`). The orchestrator writes `root_cause.md` from the returned object; the Fix Decision HARD-GATE stays in the orchestrator.
- **`templates/_shared/falsification_rules.md`**: the 5 falsification rules become a single canonical source (BLOCK-markered). `skills/debug/SKILL.md`'s inline copy and both analyst templates' restatements are deduped to pointers; the segment script appends the canonical block to analyst prompts (author-time embed, SYNC-SOURCE).
- **Phase 2b — `/code-review` → `/deep-review` (rename-with-alias) on the WORKFLOW path**: new canonical `skills/deep-review/SKILL.md` + `deep-review.review.workflow.js` (deep = 2 reviewers, thorough = 3 reviewers + adversarial cross-verification → synthesis, all `parallel()`; returns a `FindingSet`). New schemas `Finding`/`FindingSet` (`filesReviewed` required — the report's Files-Reviewed table is reconstructible only from it) and the unplanned-but-needed `CrossVerifyReport` (preserves Confirmed/FalsePositive/SeverityAdjusted/new-finding/disagreement semantics a plain FindingSet would lose). Each reviewer digest is composed ONCE with stable `[#N]` indices and reused for cross-verify AND synthesis (single correlation key space). Synthesis normalizes `counts` from `findings[]` (spec.eval precedent) and backfills `filesReviewed` from the reviewer union. The old `.harness/code-review/review_*.md` intermediates are gone — the orchestrator writes `review_report.md` from the returned object. **`--comment`/`--fix` parity (NEW)**: `--comment` posts inline PR comments (commit_id = PR head SHA, side = RIGHT, file-level findings fall back to a review-body comment, out-of-hunk lines skip) after an explicit confirm; `--fix` applies critical/major suggestions to the working tree only behind a HARD-GATE, with `validate_path(kind=diff_target)` on every model-authored path, prose→single-Edit (never guess), and never commits/pushes. Live dry-run of `deep-review.review` PASSED (full FindingSet, counts normalized, ko/en language contract, a real argparse exit-code-2 semantic finding caught by two reviewers independently).
- **Phase 2e — `/refactor` multi/comprehensive on the WORKFLOW path**: `refactor.plan.workflow.js` (multi = structural+risk, comprehensive = +feasibility via `parallel()`; comprehensive adds a cross-critique round; synthesis → `RefactorPlan`) + `refactor.eval.workflow.js` (isolated behavior-preservation evaluator → `VerifyVerdict`; still writes `qa_report.md`). New `RefactorPlan` schema (PlanResult + refactor delta: `steps` promoted to required with a per-step `risk` enum; `currentState`/`impactScope`/`testCoverage` added and required so every rendered section is schema-backed). The mechanical-failure verdict maps to `{layer:'L1', verdict:'FAIL_L2'}` per the canonical encoding note; behavior-judgment failure → `{layer:'L3', verdict:'FAIL_L3'}`. **Execution (Step 4) is never scripted** — atomic apply + test-after-each + regression gates + Safety Advisor + auto-fix stay in the orchestrator.
- **Phase 2d — `/migrate` multi on the WORKFLOW path**: `migrate.analyze.workflow.js` (external-research + codebase-impact analysts via `parallel()`, anchor-free; external uses WebSearch/WebFetch → synthesis → `MigrationPlan`) + `migrate.eval.workflow.js` (isolated migration evaluator → `VerifyVerdict`; still writes `qa_report.md`, dual-use). New `MigrationPlan` schema (PlanResult consumer-delta: `steps[]` IS the breaking-changes list with per-step `risk`; `summary`/`dependencyUpdates`/`configurationChanges`/`executionOrder`/`risks` all required so every rendered migration_plan.md section is schema-backed — and per-step `files`/`verification` + per-risk `likelihood`/`mitigation` promoted to required by the cold review). **Step 4 staged execution is never scripted** — per-step apply + build/test verify + failure gates + Migration Advisor stay in the orchestrator. Live dry-run PASSED (2/2 analysts → MigrationPlan, ko output; a non-React repo correctly mapped all 20 React-18 breaking changes to `notApplicable`).
- **Phase 2f — `/codebase-audit` deep|thorough on the WORKFLOW path**: `codebase-audit.analysis.workflow.js` (parameterized lens analysts via `parallel()` — deep = 2 lenses [structure+dependency, pattern+quality], thorough = 3 lenses [structure, dependency, pattern] + a completeness-critic pass → synthesis → `AuditResult`; read-only). New schemas `AuditAnalysis` (per-lens `sections.required` promotion via `lensSchema()` clone — not sparse-optional; `keyPoints` required+minItems:1 = the `[#N]` correlation anchor), `CompletenessCritique` (required `(targetLens, targetIndex)` correlation keys mirroring CrossVerifyReport), `AuditResult` (every rendered section required). **Read-only / report-write resolution (2b pattern)**: the segment writes no files; the ORCHESTRATOR writes `audit_report.md` (+ `.harness/context.md` / `.harness/model_config.json`). The 6 lens templates collapse into one parameterized `analyst.md` (lens instructions live in the script `LENS{}` constant) + `completeness_critic.md` (was `cross_critique.md`); synthesis authored in-script; 6 old lens templates deleted. Live dry-run PASSED (deep → `AuditResult`, ko output, dependency depth equivalent to the former dedicated dependency_analyst).
- **Phase 2g — `/test-gen` multi on the WORKFLOW path**: `test-gen.analyze.workflow.js` (coverage analysts over file buckets via `parallel()` → synthesis → `AnalysisResult`) + `test-gen.judge.workflow.js` (**PROPOSE-ONLY, READ-ONLY** skeptics via `parallel()` — one per target proposes the single most lethal mutation + names the catcher test → `SkepticVote[]`; applies / runs / writes NOTHING). New schemas `SkepticVote` (`expectedCatcherTest{testFile,testName}` run-scoping key; `predictedCaught` optional + explicitly non-authoritative), `MutationVerdict`/`ExecutedMutation` (orchestrator-built; deterministic verdict reduction; `score`/`weakTests` derived ONLY from the measured `executions[]`, never `predictedCaught`). **No worktree anywhere** (the rejected design — omits ignored deps / snapshots an uncommitted tree / unverified engine contract) and **mutation-of-production is never scripted**: the mutate → scoped run → immediate revert → working-tree clean guard is orchestrator-inline (git `diff --quiet` with git; backup-restore + read-back compare without git, on both paths). Test generation stays inline on both paths. Live dry-run of `test-gen.judge` PASSED (2 skeptics → `SkepticVote[]`, propose-only/read-only confirmed, ko output).
- **`/team-memory` (formerly `/memory`)** — renamed to remove trigger ambiguity with Claude Code's built-in personal auto-memory / the `#` shortcut / CLAUDE.md. The old `/memory` name is preserved as a ~33-line deprecation alias stub (frontmatter `name: memory` kept for discovery; AskUserQuestion → Yes delegates to `/team-memory` via the Skill tool). Human-gated CRUD; the no-escalation guard (no Task/Agent/Workflow/Web*) is unchanged. Cross-skill `/memory` references (debug & test-gen Smart-Routing + the shared `templates/_shared/safety_guard.md` cleanup warning) updated to `/team-memory`.

### Changed

- **state.json v3** (`version: "3.0"`, `skill: "harness"`): adds `path_resolved`, `runs.{plan|build|eval}.runId` (audit + same-session only), `workflow_ctx` (plan/advisor digests reused on retries). **Cross-session recovery is the state.json phase machine** — `resumeFromRunId` is same-session only and is never used across sessions. Pre-harness `/workflow` sessions (v1/v2 state.json) get "Restart recommended" — no silent migration, no legacy resume.
- **Inline path preserved verbatim** (deviation from the pre-correction pilot plan, aligned with the corrected mode-gate contract "default = current behavior"): `planner_single.md`, `generator_single.md` keep their file-write + 1-line contracts; `verify_layer1.md` / `evaluator_prompt.md` are dual-use (1-line contract on disk for inline, schema-return variant embedded in `harness.eval.workflow.js`). Hand-rolled standard/multi prose orchestration is REMOVED from the skill — standard/multi now exist only on the workflow path (engine fan-out); without opt-in or tool availability they fall back to inline single with a notice.
- **11 workflow-only templates** (3 personas, 2 syntheses, lead_developer, 3 advisors, 2 implementations) — 1-line `## Output Contract` + file-write directives replaced with schema-return `## Output` notes matching the author-time copies embedded in the segment scripts (`SYNC-SOURCE`/`WORKFLOW-PATH TEMPLATE` headers added). The advisors' detailed review sub-sections (Issues Found severity tables etc.) are deliberately collapsed into the schema-mapped fields. `implementation*.md` no longer instructs sub-agents to invoke parallel-dispatch skills (engine nesting is 1-level). multi-mode `cross_critique` is no longer dispatched (deliberate simplification — `AnalysisResult.risks/recommendations` carry the dissent); the now-dead `templates/planner/cross_critique.md` is deleted (git history provides rollback).
- **`input-trust-model` shared block v1 → v2** (4 planner templates + `templates/_shared/input_trust_model.md` + verifier): drops the literal `{placeholder}` mentions (a mechanical renderer would substitute task content INTO the trust prose) and the dangling `## Output Contract` section name. `scripts/verify_block_sync.py` now supports per-group block versions.
- **`templates/evaluator/evaluator_prompt.md`**: report destination made explicit (`{qa_report_path}` — the variable was passed but never declared in the template).
- **README**: `/workflow` → `/harness` sweep (Skills table row renamed with "formerly /workflow" note; Quick Start reflects the derived Mode Gate — no mode roundtrip; architecture diagram shows segment scripts). Historical v8.1–v8.4 entries keep the `/workflow` token. `plugin.json` keywords gain `harness` (`workflow` kept for alias-period discovery).
- **Auto-fix Proposer carve-out**: still dispatched inline by the orchestrator with its 1-line confidence contract (it Reads source directly — Architecture Principle #2). `AutoFixProposal` schema lands in a later phase.
- **`/spec` + `/debug` Mode Gate wiring** (2nd/3rd consumers of `templates/_shared/mode_gate.md`): quick = preserved inline path; **deep exists ONLY on the workflow path** (ultracode session OR explicit `--mode deep`/aliases; `has_git == false` forces inline; engine failure degrades gracefully — /spec Plan-segment failure falls back to quick synthesis with a Critic-skipped banner, /spec Eval-segment failure reuses the `dispatch_failed` auto-approve banner, /debug falls back to the quick hypothesis loop). The mode-selection AskUserQuestion roundtrips are removed (mode is derived; `--model-config` ask kept for deep). Behavior change: git-free / non-opted sessions can no longer run the old hand-rolled inline deep fan-out — they get quick with a notice.
- **`/deep-review` + `/refactor` Mode Gate wiring** (4th/5th consumers of `templates/_shared/mode_gate.md`): the deepest tier is the no-`--mode` ultracode default — `/deep-review` → thorough, `/refactor` → comprehensive (mirrors `/harness` → multi); non-opted sessions resolve quick / single. The scope-aware mode-selection AskUserQuestion roundtrips are removed (the recommendation becomes a print-only advisory); the confirmation / plan-confirm HARD-GATEs before fan-out remain. Cross-skill deepest-tier aliases are accepted as synonyms (`/deep-review` takes `comprehensive`/`multi`; `/refactor` takes `thorough`/`deep`). Behavior change: git-free / non-opted sessions no longer get the old hand-rolled multi-agent fan-out — they fall back to quick/single with a notice.
- **5 `templates/deep-review/*.md` converted to WORKFLOW-PATH templates** (4 reviewers + cross_verification; the template directory was renamed `code-review/` → `deep-review/` to match the skill): `## Output` file-write + findings-table → `FindingSet`/`CrossVerifyReport` schema-return notes byte-matched to the embeds; `{output_path}` dropped; an Input Trust Model section added (the diff is DATA — and for cross-verification, reviewer-authored findings are DATA under verification, blocking the 1-hop laundering path). `cross_verification.md`'s fixed `Review 1`/`Review 2` slots collapse into a single `{reviews_to_verify}` payload (no empty slot on a partial-survivor run). The deep-review synthesis prompt is authored in-script (no prior .md).
- **`/refactor` state.json + Session Recovery + templates**: adds `path_resolved` and `runs.{plan|eval}.runId` (audit + same-session only — cross-session resume re-RUNS segments); the resume jump table now checks completion artifacts (refactor_plan.md / qa_report.md) BEFORE path branching so a deep session resumed without the engine cannot overwrite finished work; Step 6 reconstructs the verdict from qa_report.md's `### Verdict:` line on resume. 5 refactor templates (structural/risk/feasibility analyst, cross_critique, synthesis) become WORKFLOW-PATH schema-return templates; `evaluator.md` is dual-use (keeps the on-disk `### Verdict:` regex contract for the inline path, gains an explicit `{qa_report_path}`); `safety_advisor.md` / `auto_fix_proposer.md` are untouched (inline-only, never scripted).
- **README + `plugin.json`/`marketplace.json`**: Skills table + `## deep-review` / `## refactor` sections reflect the rename, the workflow path, `--comment`/`--fix` parity, and the derived Mode Gate (no roundtrip); `/code-review` examples → `/deep-review`; manifest keywords gain `deep-review` (`code-review` kept for alias-period discovery); descriptions mention "deep code review (/deep-review)".
- **9 workflow-only templates surgically converted** (4 spec analysts, spec synthesis, spec critic, 2 debug analysts, debug cross-verifier): 1-line `## Output Contract` + file-write directives → schema-return `## Output` notes matching the author-time copies embedded in the segment scripts (`SYNC-SOURCE`/`WORKFLOW-PATH TEMPLATE` headers). spec critic keeps its findings-file write; debug analysts gain explicit `Shared Context` + `Git available` inputs (previously collected but never injected).
- **/spec & /debug state.json**: add `path_resolved` + `runs.{plan|eval}` / `runs.analyze` (runIds audit + same-session only — cross-session recovery re-runs segments per the state phase machine). `/spec` `critic.failure_reason` enum shrinks to `null | "dispatch_failed" | "re_synthesis_failed"`.
- **`/migrate` + `/codebase-audit` + `/test-gen` Mode Gate wiring** (6th–8th consumers of `templates/_shared/mode_gate.md`): `/migrate` single=inline / multi=workflow; `/codebase-audit` quick=inline / deep|thorough=workflow (its cost HARD-GATE kept verbatim; the old Step 1.7 mode AskUserQuestion demoted to a boundary/explicit-override fallback); `/test-gen` single=inline / multi=workflow with `has_git == false` forcing inline (the inline mutation run needs a clean revert; the propose segment is git-independent). No-`--mode` ultracode resolves the deepest workflow tier (migrate → multi, audit → thorough, test-gen → multi); non-opted/git-free sessions fall back to inline. The mode-selection AskUserQuestion roundtrips are removed (mode derived; cost gate / `--model-config` asks kept). state.json (migrate/test-gen) + `.harness/model_config.json` (codebase-audit, stateless) gain `path_resolved` + `runs.{…}` (audit + same-session only); resume re-resolves the Mode Gate and checks completion artifacts before path branching; codebase-audit is stateless (full clean re-run, cost gate re-shown).
- **migrate/codebase-audit/test-gen templates converted**: migrate `external_research_analyst`/`codebase_impact_analyst`/`synthesis` → schema-return WORKFLOW-PATH templates (+ Input Trust Model — fetched web pages and analyst reflow are DATA); `migrate/evaluator.md` dual-use (on-disk keeps the `### Verdict:` regex + gains an explicit `{qa_report_path}`). codebase-audit 6 lens templates collapse into `analyst.md` (+ `completeness_critic.md`, was `cross_critique.md`); synthesis in-script; 6 old templates deleted; per-lens `sections.required` promotion is lossless (former prose-only deliverables fold into `summary`/`recommendations`). test-gen `coverage_analyst.md` dual-use (on-disk keeps `{output_path}`; the script copy is fileless + bucketed + schema-return) and a new propose-only `mutation_skeptic.md`. Each skill's Cleanup now references `templates/_shared/safety_guard.md` (the cwd-containment guard).
- **README + `plugin.json`/`marketplace.json`**: Skills table + `## migrate` / `## codebase-audit` / `## test-gen` sections reflect the workflow path and the derived Mode Gate (no roundtrip); manifest skill descriptions gain the single/multi (migrate, test-gen) and quick/deep/thorough (codebase-audit) mode note; `/code-review --fix` smart-routing in /test-gen → `/deep-review --fix`.
- **BREAKING (alias-mitigated):** canonical command names changed (`/workflow`→`/harness`, `/code-review`→`/deep-review`, `/memory`→`/team-memory`). Old names still resolve via deprecation stubs — existing invocations keep working — but scripts/docs/muscle-memory should migrate. This is a MINOR bump (not MAJOR) precisely because the old names are retained.
- **BREAKING:** the opt-in WORKFLOW path (ultracode OR `--mode`) executes native Workflow segment scripts instead of inline prose orchestration; the resume key on that path is the engine `runId` (same-session) with the `state.json` phase machine for cross-session. Pre-8.5 interrupted sessions should Restart rather than Resume.

### Deprecated

- **`/workflow`, `/code-review`, `/memory` command names are deprecated** in favor of `/harness`, `/deep-review`, `/team-memory`. Invoking an old name still resolves via its deprecation stub (prints a localized notice and redirects). Scheduled for removal no earlier than the next MAJOR release.

### Fixed (session-C adversarial cold reviews — 12 confirmed across 2d/2f/2g)

- **2d migrate (3)**: `MigrationPlan.steps[]` `files`/`verification` and `risks[]` `likelihood`/`mitigation` promoted to schema-required (rendered fields must be required — wf_75de1836 class, else `undefined` leaks into the Plan Confirmation gate doc); `migrate/evaluator.md` inline path gains a `{qa_report_path}` placeholder (workflow/inline DUAL-USE symmetry).
- **2f codebase-audit (5)**: Key Rules read-only count corrected to all three orchestrator writes (`audit_report.md` + `.harness/context.md` + `.harness/model_config.json`); `AuditAnalysis.keyPoints` promoted required+minItems:1 (the `[#N]` correlation anchor was optional, making the required critique correlation hollow); the schemas.md per-lens note reworded to independent LENS entries (not a deep-merge that the code does not implement); the lens-collapse restored two dropped pattern items (logging structured-vs-unstructured + an overall quality summary) and softened the "every item" claim.
- **2g test-gen (4)**: the INLINE↔WORKFLOW equivalence reframed to **shape/sections** (not value-isomorphism — INLINE's `+1 strengthen` re-measures a strengthened test, so its score/verdict can legitimately differ); the INLINE strengthened test documented as an intended INLINE-only kept *test-code* write; the production-source clean guard applied to BOTH paths; the no-git clean guard gained a read-back byte-compare so "proves zero residual mutation" holds on both branches.

### Fixed (Phase-1 adversarial cold review — 4 confirmed should-fix)

- **WORKFLOW-path resume sources**: `workflow_ctx.changedFiles` (repo-relative, reasons stripped) is now persisted by Step 4 and consumed by Step 5 on resume; Step 7 gained a qa_report.md `### Verdict:` reconstruction fallback (mirrors INLINE; sanctioned-read exception extended). Previously a resumed workflow-path session had no source for `changedFilesList` / the final verdict.
- **Step 4 build args gained `testCmd`** — the advisors' `Test cmd:` context was silently empty vs the old standard path (regression).
- **`--mode standard` opt-in made explicit in `templates/_shared/mode_gate.md`** (the single source listed only multi/comprehensive/thorough/deep; /harness's own prose said "deep --mode") — standard is a first-class engine-path mode, as the live dry-run exercised.
- Hardening from optional findings: render() substitution order fixed structural-first/user-payload-last in all three scripts (mechanical placeholder-hijack guard); auto-fix re-verify runs ONE full eval (no duplicate L1); `_reference/schemas.md` now mandates the `LANG` fallback const; synthesis `edgeCases` mapping cites its source; dead `round_num` removed from build implVars; evaluator embed wording realigned to its .md.

> **Engine facts verified by the Phase-1 spike (5/5 PASS):** plugin-cache-rooted `{scriptPath}` resolves and runs; `agent({schema})` returns validated objects (and plain text without a schema — fallback preserved); schema-description language directives (`render in <userLang>`) control output language (ko/en verified); `args` arrives as a JSON string; `export default`/`import` are launch-time SyntaxErrors (top-level body + global hooks only); unregistered `agentType` values fail the call (all `agentType` usage dropped); resume caching is sequential-prefix (editing the first `agent()` call re-runs everything after it).

## [8.4.0] — 2026-05-06

### Added

- **/spec deep mode now dispatches 4 analysts in parallel**: Requirements + UserScenario + RiskAuditor (NEW) + TechConstraint (NEW). Risk and TechConstraint analysts catch security, concurrency, schema, and operational issues that previously surfaced only in /workflow review cycles (coin-washer Critical 5/7 reproducible at spec-time, target verified per Phase 7 smoke test).
- **/spec Critic stage**: cold review of synthesized spec.md classifies findings as Critical/Major/Minor with `[C*]/[M*]/[m*]` IDs. Critical or Major findings trigger a 3-way gate (Auto-revise / Modify / Approve as-is). Auto-revise re-runs synthesis with `{critic_findings}` injection (max 1 round; 2nd round offers Approve/Stop only — no oscillation).
- **/spec Convention Scan (Step 1.5)**: scans CLAUDE.md (has_git=true, mirrors workflow) and 7 candidate files (has_git=false: STYLE_GUIDE.md, CONTRIBUTING.md, conventions.md, guidelines.md, policy.md, docs/style-guide.md, docs/conventions.md, case-insensitive). New `--reference <path>` CLI flag overrides auto-detect.
- **/spec Phase 3 persists `qa_notes.md`, `critic_findings.md`, `conventions.md`** to `{docs_path}` before cleanup. /workflow Step 1.5 auto-reuses persisted conventions; Step 2 injects `{qa_discovery_notes}` + `{critic_findings}` into all 4 planner templates (architect, senior_developer, qa_specialist, planner_single). /workflow Step 8 "Commit code only" preserves the 3 artifacts in the commit.
- **/ship Stage 6.5 (`merge_to_base`)**: merges release branch into base branch BEFORE tag push (closes develop→main lag from 8.1.0/8.2.0/8.3.0). Branch protection detection with PR-creation fallback (Path A) vs standard merge (Path B). Substep-level recovery via 3 new substep enum values. Push-rejection handling: 3-way protected-base gate on Path A entry (Create PR / Skip / Stop), and 5-way push-rejection gate on Path B step 7 (Retry / Manual / Create PR / Skip / Stop) with persistent retry-count cap. HARD-GATEs at merge and push, with branch-protected rollback documentation.

### Changed

- **/spec Phase 3 invokes `/workflow`** with explicit `--output-dir docs/harness/<slug>/ "Implement based on {docs_path}spec.md"` (was: `/workflow "Implement based on docs/harness/<slug>/spec.md"`). The `--output-dir` is required to ensure /workflow's `docs_path` matches /spec's `docs_path` — without it, /workflow re-slugifies the task string and silently picks a different directory.
- **`templates/spec/synthesis.md`** now accepts 5 input variables (was 2): `{requirements_analysis}`, `{scenario_analysis}`, `{risk_analysis}`, `{tech_constraint_analysis}`, `{critic_findings}`. Synthesis Instructions updated from "two analyses" to "four analyses (and Critic findings if revising)".
- **All 4 planner templates** (architect.md, senior_developer.md, qa_specialist.md, planner_single.md) now include `## Discovery Notes from Spec Phase` section with `{qa_discovery_notes}` + `{critic_findings}` placeholders.
- **/spec state.json schema** adds 3 fields: `cli_flags.reference`, `conventions`, `critic`. Pre-8.4 sessions resume with these fields defaulted to `null` via `state.get(field, default)` pattern. **Important**: /spec's backward-compat policy intentionally diverges from /workflow's soft-default — /spec halts at Phase 2a-D step 3 if `state.conventions` is null on resume, forcing user Restart or manual fix (silent degradation would produce lower-quality specs without user awareness).

### Breaking

- **Persona count change in /spec deep mode** (2 → 4 + Critic). Token cost increases approx 1.9x for deep runs (estimated; measured value TBD per Phase 7 smoke test — ROADMAP entry will be updated with the actual multiplier after smoke test). The legacy 2-analyst behavior is no longer accessible in 8.4 (no `--legacy-deep` flag — defer to 8.5 if user feedback warrants).
- **/spec → /workflow handoff CLI contract changed**. Users of automation scripts that wrap /spec output strings should update to expect `--output-dir docs/harness/<slug>/` in the invocation. The task description string also changed from `"Implement based on docs/harness/<slug>/spec.md"` (absolute-looking) to `"Implement based on {docs_path}spec.md"` (placeholder form documenting the assembly contract).
- **Planner templates**: forked custom planner templates that omit the new `{qa_discovery_notes}` / `{critic_findings}` placeholders will silently render an empty Discovery Notes section. Recommended: update fork to include the placeholders (see `templates/planner/architect.md` for reference).

### Fixed

- **Stage 6.5 hardening (audit trail)**: numerous correctness/recovery fixes to `/ship` Stage 6.5 (`merge_to_base`) — closed issues M1, M2, M3, M4, M10, M11, m1, m3, m9, m12, m14, s1, s2, NF2, NF3, NF5, C3, CC5, Sec N1, Sec N3, DX #8, Arch N3. These IDs were formerly inline `(closes …)` annotations in `skills/ship/SKILL.md`; relocated here so the skill prose stays behavior-focused while the audit trail is preserved in its proper home.

## [8.3.0] — 2026-04-30

### Added

- **feat(ship): auto-detect `.claude-plugin/*.json` version fields in Stage 2** — `/ship` Stage 2 (`version_bump`) now identifies version references in `.claude-plugin/plugin.json` (top-level `$.version`) and `.claude-plugin/marketplace.json` (`$.metadata.version` and `$.plugins[*].version` for each plugin entry) alongside the existing standard package manifests (`package.json`, `pyproject.toml`, etc.). Pass 2 applies updates via JSON parsing on these key paths, preserving the original line-ending convention (CRLF vs LF) and avoiding the regression where naive string replace would taint coincidentally-equal version strings in other fields (e.g., `description: "Initial 8.2.0 release notes…"`). Resolves residual gap N1 from v8.2.0.
- **feat(md-optimize): add `.gitignore`-aware exclusion to scan/index/safety** — `/md-optimize` Phase 1b now runs `git rev-parse --is-inside-work-tree` and excludes gitignored paths via per-path `git check-ignore --quiet`, preventing the Reference Index from emitting broken references for files that exist locally but not on teammates' machines or in CI. Phase 4 evaluator gains a "Gitignore safety" row, and Safety Rules adds a "Gitignore-aware" bullet (precedence-resolved against the Sub-CLAUDE.md rule: gitignore-aware wins). Non-git projects fall back to the existing Exclusion List with bit-identical behaviour.

### Documentation

- **docs(readme): add `/ship` skill section and Skills table entry** — README's Skills table now lists all 12 skills (previously 11), and a dedicated `## ship` section documents the 6-stage pipeline, auto-detection signals, HARD-GATE matrix, safety guards (including v8.2.0 hardening), and session-recovery substep model.
- **docs(roadmap)**: rename `v8.2+` → `v8.3+` Planned section and adjust scope (added then resolved the `/ship` version_bump auto-detect item; dropped non-development items).

## [8.2.0] — 2026-04-29

### Fixed

- **fix(ship): align `.harness/` cleanup Safety Guard with `/workflow` parity** — Add explicit symlink-escape verification (`Path('.harness').resolve() ⊆ Path.cwd().resolve()`, unconditional), insert "Display target before delete" step that prints the exact absolute path, route every validation failure through ABORT with a translated user warning, and specify symlink-vs-target deletion semantics in Item 5 (`is_symlink()` short-circuit removes the link itself, regular directories use `follow_symlinks=False`). Adds a `Path(...)` pseudocode-portability note for cross-platform agent execution. Resolves residual gap S1 and review #7 (PARTIAL).
- **fix(ship): bound tag-name regex length to strict 254 characters** — Change `tag_name` validation from `^v?[0-9a-zA-Z][0-9a-zA-Z._-]*$` to `^(v[0-9a-zA-Z][0-9a-zA-Z._-]{0,252}|[0-9a-zA-Z][0-9a-zA-Z._-]{0,253})$` to reject pathological tag inputs (e.g. 10k-char strings). Alternation form enforces a strict 254-char hard cap regardless of optional `v` prefix (the simpler `^v?[0-9a-zA-Z][0-9a-zA-Z._-]{0,253}$` would have allowed 255 chars when `v` is present). Resolves residual gap S2 and review N-8 (length bound only; consecutive-dot / trailing-dot hardening deferred).
