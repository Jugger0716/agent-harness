# `/harness --fast` — post-diet live probe (2026-09-18)

> Companion to `RATIONALE.md`. This file records one real run of the v8.14 Fast Gate on a fresh
> process, so the claims in `CHANGELOG.md` `[Unreleased]` about `--fast` rest on an observation
> rather than on document consistency alone. Nothing in this file is a rule.

## Setup

| Item | Value |
|---|---|
| Process | fresh `claude` after `exit` (not `--resume`, not `/clear`); both installed plugin copies verified sha256-identical to HEAD `aa4dab2` for the 5 files the probe exercises before the run |
| Entry | `/handoff resume` → "Adjust plan" → the user typed `/harness --fast "<task>"` as a **separate message**, so the run began in its own turn, not chained from the handoff turn |
| Task | re-measure `scripts/verify_sync_markers.py` docstring `§What this does not check` items 1 and 3 and append `RE-MEASURED 2026-09-18` lines (1 file) |
| Pre-existing state | a stale `.harness/state.json` at `plan_done` from the 2026-09-15 multi-mode session |
| Model preset | `balanced` (fast default): planner/advisor opus, executor sonnet, evaluator opus, verifier haiku |

## Observed sequence

1. **Session Recovery gate** rendered (Resume / Restart / Stop / View state only) → Restart deleted `.harness/`.
2. **Step 1 Setup**: `Path : inline (--fast)`, `Model : balanced (fast default)`, `Style : auto (fast)`, no Model question, no Ambiguity Prompt. Lint/build/test/type-check all `null` (see finding 2). Conventions: CLAUDE.md rich → copied without a question.
3. **Step 2 INLINE**: `spec_stamp → null` written before the planner dispatch; planner returned `spec.md generated — 17 acceptance criteria, 10 edge cases`; `spec_stamp {generation: 1, lines: 177}`; Scale Assessment frozen in 1-signal degraded mode (17 checkboxes), not rendered.
4. **Step 2.6**: `plan_critic = {applied: "skipped", source: "fast"}`, printed `Critic: skipped (--fast)`.
5. **Fast Gate** rendered as an AskUserQuestion with exactly the three options `Build now` / `Modify spec` / `Stop` and the checkbox count in the question.
6. **Build now** → single write `gate.approved = true`, `gate.approved_at`, `gate.mode = "fast"` → `[harness] Fast Gate approved — chaining into /harness-build.` → `Skill` tool invoked `agent-harness:harness-build` with no arguments **in the same turn**. The skill body loaded and executed; no permission denial.
7. **`/harness-build` §Entry**: `phase == plan_done`, `cli_flags.fast == true`, `gate.approved == true` → admitted; wrote `phase → generate_ready`, `epic.boundaries → null`. Neither the item 3 status block nor the item 7 Resume question rendered (decision A).
8. **Step 4 INLINE** (sonnet): 1 file, 47 insertions, `changes.md` written.
9. **Step 5 INLINE** (haiku): all four commands `SKIP`, completeness scan `1 TODO` (the docstring's pre-existing "later-phase TODO" sentence), non-blocking → `PASS`.
10. **Step 6 INLINE** (opus): 1-line return began with the leading token `FAIL L3`. `verify.verdict → "FAIL_L3"`, `verify.layer2_result → "PASS"` in one write; `verify.cold_result → "skipped"`, `verify.cold_round → 1` (`cold_pass == false`). `qa_report.md` was never opened by the orchestrator.
11. **Step 7**: printed `Cold review: disabled (--no-cold-pass)`; read `verify.verdict` only; rendered the Layer 3 gate (Fix / Accept as-is) with the return's text after ` — ` as the summary. User chose Accept as-is → `phase → completed`.
12. **Step 8**: Commit gate (3 options) → No commit → Safety Guard passed → `.harness/` deleted → Type B boundary block printed with `Remaining : see …/qa_report.md (cold pass skipped — --no-cold-pass)`.

Total: 3 user messages (`/harness --fast …`, plus the two gates that are the point) and 4 AskUserQuestion answers (Session Recovery, Fast Gate, QA, Commit). Sub-agent cost, from the task notifications: planner 97.8k tokens / 447 s, generator 133.7k / 378 s, verifier 42.5k / 33 s, evaluator 116.5k / 523 s.

## Verdicts on the four things the handoff asked the probe to observe

| # | Question | Result |
|---|---|---|
| 1 | Fast Gate AskUserQuestion renders | **yes** — three options, `{n}` = 17 substituted |
| 2 | "Build now" writes `gate.approved` then chains `/harness-build` via the Skill tool in the same turn | **yes** — the Skill call succeeded and the build skill ran to Step 8 inside that turn |
| 3 | `/harness-build` §Entry admits a fast session only on `gate.approved == true` | **admitting branch observed**; the refusing branch (`gate.approved != true`) was **not** exercised — untested, not falsified |
| 4 | INLINE §Step 6 item 5 records `verify.verdict` from the leading token and §Step 7 reads only that field | **yes** — a real `FAIL L3` return took the Layer 3 gate route without any `qa_report.md` read |

The evaluator's Layer 3 FAIL was genuine: it found two false statements in the generator's new docstring prose (an "earlier in its prose" that was actually later, and a `6 (2 + 3)` that did not sum). Both were fixed by hand after Accept as-is and are in the same commit as this file. That the pipeline caught prose-level factual errors in a docstring edit is the strongest single observation of the run.

## Findings (defects and friction surfaced by the run)

1. **Korean task strings slugify to noise.** §Step 1 item 3 (lowercase → transliterate → drop non-word → 50 chars) turned the task into `scriptsverify_sync_markerspy-modyul-docstringui-wh`, which became both the branch name and the `docs_path` segment. The rule was followed exactly; the output is unusable as an identifier. Possible fixes: prefer the first ASCII path-like token when one exists, or ask for a slug under `--fast` (one more question) — not decided here. **Closed in the commit after 3dc6cdb**: `templates/_shared/slugify.md`
   (drop non-ASCII, path separators → hyphens, `task-<YYYYMMDD-HHMM>` fallback), cited by
   `/harness` and `/spec`.
2. **The lint detection table has no row for this repository.** `templates/_shared/detection_table.md` detects lint from `package.json` / `pyproject.toml` / `.eslintrc*` / `Cargo.toml` etc.; this repository documents seven lint commands in `CLAUDE.md` and matches none. Result: `lint_cmd = null`, Layer 1 skipped all four commands, and the P1-3 warning fired. The generator and the evaluator each ran the lints themselves, so the outcome was not wrong, but Layer 1 verified nothing. A `CLAUDE.md` "Commands" table row, or a `--lint-cmd` default via the `agent-harness-defaults:` line, would close this; neither existed at probe time. **Closed in
   the commit after 3dc6cdb**: `lint-cmd` / `type-check-cmd` keys on the defaults line (backtick
   values), resolved before detection, and this repository's `CLAUDE.md` now declares its lint
   chain that way.
3. **The generator violated the 1-line Output Contract** (a multi-line report after the contract line). The orchestrator used only the first line, as `templates/_shared/orchestrator_contract.md` prescribes, so no state decision was affected. Worth noting because the same contract on the evaluator is load-bearing (leading-token parse); the evaluator complied.
4. **`gate.approved` refusal path untested** — see verdict 3. A deliberate follow-up: run `/harness --fast`, answer Stop at the Fast Gate, then type `/harness-build` and confirm the `[harness-build] This is a --fast session whose Fast Gate has not been answered` halt.
5. **A `disallowed-tools` scope change was visible at the chain boundary**: `NotebookEdit` was announced unavailable when `/harness-build` loaded, then available again afterwards — consistent with the turn-scoped mechanism `templates/_shared/mode_gate.md` rule 3 records. No effect on this run.

## Not observed / out of scope

- WORKFLOW-path `verify.verdict` write (§Step 5 item 4) — this was an inline run by construction.
- "Modify spec" and "Stop" branches of the Fast Gate.
- Fast Gate re-render on a resumed `plan_done` fast session, and the `gate.approved == true` while `phase == plan_done` interrupted-chain message.

---

# Second probe — the refusal path, Stop / resume, and the Fix loop (2026-09-18)

> Same day, same installed copies, a later `claude` process on branch
> `harness/token-performance-optimization` at `a3df2c9` (the commit that closed findings 1 and 2).
> The task was real work — registering HANDOFF_IMPROVEMENT_PLAN Slice 4 as deferred in
> `ROADMAP.md` and appending the unchecked-share correction to `CLAUDE.md` §Verification — so the
> run doubles as the deliberate follow-up finding 4 asked for. Nothing in this file is a rule.

## Setup

| Item | Value |
|---|---|
| Entry | `/harness --fast "<task>"` typed as its own message; no `.harness/` existed |
| Task | 2 root documents, additions only, with the constraint that no new `§` citation may follow a `skills/harness*/SKILL.md` path anywhere in either file |
| Lint | resolved from the `agent-harness-defaults:` line in this repository's `CLAUDE.md` (`lint-cmd`, backtick value) — echoed `(project default)` in the Setup Summary |
| Slug | `1-roadmap-md-v8-3-planned-handoff-improvement-plan` from a Korean task string, per `templates/_shared/slugify.md` |
| Model preset | `balanced` (fast default) |

## Observed sequence

1. **Setup**: `Path : inline (--fast)`, `Lint : … (project default)`, no Model question, no Ambiguity Prompt, conventions copied (CLAUDE.md rich) without a question. The branch was cut from the checked-out branch, not from `develop` — §Step 1 item 8 cuts from wherever HEAD is.
2. **Plan**: planner returned `spec.md generated — 11 acceptance criteria, 8 edge cases`; `spec_stamp {generation: 1, lines: 126}`; `plan_critic = {applied: "skipped", source: "fast"}`. The spec flagged three task claims the code only partly supported, including that "just under half" is approximate only for harness-build **as of 2026-09-18**, while the sentence had been false for harness since the 2026-09-07 re-measurement.
3. **Fast Gate → Stop**: nothing written; the Type A boundary block printed with `Resume : /harness`.
4. **`/harness-build` typed directly**: §Entry read `phase == plan_done`, `cli_flags.fast == true`, `gate.approved == null` and printed `[harness-build] This is a --fast session whose Fast Gate has not been answered — run /harness to answer it.` Nothing written. **This is the refusing branch finding 4 asked for.**
5. **`/harness` typed**: Session Recovery printed the status block and the Resume / Restart / Stop / View state only question → Resume → the Fast Gate **re-rendered** (the routing predicate's branch (c): `plan_critic.applied` recorded) → Build now → `gate.approved = true` → Skill-tool chain into `/harness-build` in the same turn → §Entry admitted, `phase → generate_ready`.
6. **Round 1**: Generator (sonnet) edited both files, 1-line contract obeyed. Verify (haiku) actually ran the seven-script lint chain: `PASS — build SKIPPED, test SKIPPED, lint 0e/0w, scan 0 TODO`. Evaluator (opus) returned `FAIL L3 — 1 item failed`: the `CLAUDE.md` correction dated the onset of the falsehood to 2026-09-18 rather than to the 2026-09-07 re-measurement the spec's fact B8 records. All 11 completion criteria, scope, and the diff-risk checks passed; the path-anchored `§` count was 16 → 16 with `CLAUDE.md` at 0.
7. **Layer 3 gate → Fix**: `round → 2`, layer counters and `cold_round` reset, `phase → generating`. Generator R2 reworded only the correction (now: false for harness and harness-gate since 2026-09-07; current shares re-measured 2026-09-18 = 86/102, 81/81, 86/176; harness-build read 113/204 on 2026-09-07). Verify R2 `PASS` (lint 0e/0w). Evaluator R2 `PASS`, having compared every figure against the docstring's lines and the Layer 1 OK lines.
8. **Step 8**: Commit gate → No commit → `.harness/` deleted → Type B block with `Remaining : none (cold pass skipped — --no-cold-pass)`.

Total: 3 user messages (`/harness --fast …`, `/harness-build`, `/harness`) and 5 AskUserQuestion answers (Fast Gate, Session, Fast Gate, QA, Commit). Sub-agent cost, from the task notifications: planner 102.1k tokens / 299 s; generator 87.1k / 122 s and 87.4k / 67 s; verifier 45.3k / 43 s and 46.0k / 47 s; evaluator 107.1k / 407 s and 98.5k / 310 s — 573k tokens and 21.6 minutes of sub-agent time for an 8-line change.

## Verdicts

| # | Question | Result |
|---|---|---|
| 1 | `/harness-build` §Entry refuses a fast session whose Fast Gate was not answered (first-probe finding 4) | **yes** — halt with the documented message, no write |
| 2 | Fast Gate "Stop" writes nothing and prints the Type A block with `Resume : /harness` | **yes** |
| 3 | A resumed `plan_done` fast session re-renders the Fast Gate instead of printing `Next → /harness-gate` | **yes** — but only after the Session Recovery question, so Stop-then-resume costs two answers |
| 4 | The Layer 3 "Fix" branch runs a full second round and the round-2 evaluator can reach `PASS` | **yes** |
| 5 | The `lint-cmd` project-default key closes first-probe finding 2 | **yes** — Layer 1 ran the chain instead of skipping it |
| 6 | The slugify single source closes first-probe finding 1 | **yes** — usable identifier; the `(1)` in the task survives as a leading `1-`, harmless |

The round-1 Layer 3 FAIL was again genuine, and it is the more interesting of the two probes' catches: the planner had already flagged the date issue in the spec, the generator still wrote the wrong onset, and the evaluator caught it from the docstring. The three layers compensated for a spec-to-generator transfer loss, not just for a generator error.

## Findings

1. **Stop-then-resume costs an extra question.** After "Stop", `/harness` renders the Session Recovery question before the Fast Gate, so the cheapest re-entry is two answers. `/harness`'s Session Recovery has no equivalent of `/harness-build` §Entry's plan_done suppression. Not a defect — the question is the documented resume gate — but it is the first concrete input to the "`--fast` questions 4 → 2" item in the plan review.
2. **Layer 1 now costs ~45k tokens per round to run one command chain.** The first probe's waste (four `SKIP`s dispatched) is gone; what remains is the dispatch itself. Running a declared command inline in the orchestrator and dispatching a verifier only when there is output to interpret would cut both rounds' verify cost to near zero.
3. **The branch is cut from HEAD, not from `develop`.** Not new behavior, but worth stating because a `--fast` run on a feature branch silently stacks on that branch's unpushed commits; here that was the intended base.
4. **Turn-scoped `NotebookEdit` toggling at the chain boundary** was observed again (first-probe finding 5). No effect on the run.

## Still not observed

- Fast Gate "Modify spec" (both the "Other" free-text path and the follow-up question).
- `gate.approved == true` while `phase == plan_done` — the interrupted-chain message.
- WORKFLOW-path `verify.verdict` write (§Step 5 item 4).
- The Layer 2 auto-retry loop (`FAIL L2`); both probes' evaluators returned `FAIL L3` or `PASS`.

---

# Third probe — a nine-file change through the Fix loop, and two 1-line contract breaches (2026-09-18)

> Same day, same process as the second probe, on `harness/token-performance-optimization` at
> `d6e5a30` (the commit that added `SLICE5.md`). The task was the implementation of that design —
> nine files, two of them the `harness-steps` lint targets — so this run is the first `--fast`
> session whose diff is wide enough to exercise the spec's per-file anchors and the round loop
> more than once. Nothing in this file is a rule.

## Setup

| Item | Value |
|---|---|
| Entry | `/harness --fast "<task>"` as its own message; no `.harness/` existed; branch cut from HEAD (`d6e5a30`) |
| Task | implement `design/harness-prompt-diet/SLICE5.md` — 9 files, with the root-document `§` tally constraint and the `harness-steps` pins as stated limits |
| Lint | `lint-cmd` project default, echoed `(project default)` |
| Slug | `implement-slice-5-prime-exactly-as-specified-in-de` — the 50-char cut lands mid-word (`in-de`); usable, ugly |
| Model preset | `balanced` (fast default) |

## Observed sequence

1. **Plan**: planner (opus) returned `spec.md generated — 19 acceptance criteria, 16 edge cases`; 423 lines, one section per file with a verbatim anchor sentence and approximate line for every edit site. `spec_stamp {generation: 1, lines: 423}`; `plan_critic = {applied: "skipped", source: "fast"}`.
2. **Fast Gate → Build now** → `gate.approved` → same-turn chain → §Entry admitted.
3. **Round 1**: Generator (sonnet) edited all nine files in one pass, 47+/9−, and reported the root-document `§` tally 48 → 48 in `changes.md`. Verify (haiku) ran the chain: exit 0 — but its reply was a multi-line markdown report whose first line was `## Layer 1 Mechanical Verification Complete`, carrying neither `PASS` nor `FAIL` (finding 1). Evaluator (opus): `FAIL L3 — 1 item` — `templates/_shared/project_defaults.md` defined `<why>` as the recorded value `"default:<source>"` while the §Step 7 table, README and Setup Summary define it as the rendered `project default (<source>)`; and the §Step 7 reader list named §Step 6 item 7 (never rendered) while omitting the Setup Summary `Cold` row. All 19 Layer 2 criteria passed.
4. **Fix → Round 2**: Generator fixed both (3 files). Verify PASS (one line, as instructed with a stronger contract sentence). Evaluator: `FAIL L3 — 1 item` — the `CHANGELOG.md` entry said `cold-pass=on|off` resolves "exactly as `--no-cold-pass` does", which is false for `on` (an explicit no-op). Two non-blocking WARNs: a wrapped bullet line in `project_defaults.md` beginning with `> ` (CommonMark blockquote), and a two-column `→` misalignment in `run_style.md`.
5. **Fix → Round 3**: Generator fixed all three (3 files) — and returned a multi-line report with the contract line LAST (finding 2). Verify PASS. Evaluator: `PASS` — all 19 criteria, the `<why>` cross-check across four files, the reader list against `state_fields.md`, the root tally 48/48, BLOCK/SYNC unchanged.
6. **Step 8**: Commit code only → `49eec8f`; the two `docs/` artifacts failed to stage (gitignored, warn-and-continue as §Step 8 (s4) prescribes) → `.harness/` deleted → Type B block. Merged `--no-ff` into `harness/token-performance-optimization` as `71c5c02`.

Total: 1 user message and 4 AskUserQuestion answers (Fast Gate, QA Fix ×2, Commit). Sub-agent cost, from the task notifications: planner 147k tokens / 582 s; generator 187k / 556 s, 134k / 334 s, 82k / 118 s; verifier 47k, 45k, 46k (≈ 65 s each); evaluator 136k / 451 s, 179k / 844 s, 156k / 484 s — about 1.16M tokens for a 9-file, 50-line change.

## Verdicts

| # | Question | Result |
|---|---|---|
| 1 | A spec with per-file anchors lets a sonnet generator land a 9-file contract edit in one pass with the lint chain green | **yes** — Round 1 was lint-clean and Layer-2-clean; every later round was a factual-consistency fix |
| 2 | The Layer 3 Fix loop reaches `PASS` within `max_rounds` on a multi-file docs change | **yes** — in exactly 3 of 3; a fourth defect would have hit "Max rounds reached" |
| 3 | The evaluator catches cross-file contradictions the generator cannot see from one hunk | **yes** — both FAILs were one file disagreeing with three others about the same token |
| 4 | Sub-agents honor the 1-line Output Contract | **no, twice** — see findings 1 and 2 |

## Findings

1. **The haiku verifier broke the 1-line contract, and the contract's own fallback would have been wrong.** §Step 5 item 5 says a first line with neither `PASS` nor `FAIL` is a conservative FAIL, which increments `layer1_retries` and re-dispatches the *generator* with a nonsense failure summary. The orchestrator instead sent the same agent one follow-up asking for the contract line alone and parsed that. This is outside the written contract: the skill has no "re-ask the verifier" branch. Two candidates, not decided here: add that branch (one re-ask, then the conservative FAIL), or move the verifier's report into the file only and make the reply schema-forced on the INLINE path too. Round 2 and 3 prompts carried a stronger contract sentence ("your entire reply must be exactly one line") and the same haiku model complied both times — so prompt wording, not the model, was the variable.
2. **The sonnet generator returned a multi-line report with the contract line last** (Round 3). §Orchestrator Contract reads the first line only, so the parse fell to `confidence: Unknown` and the run continued on `changes.md`'s existence — no state effect, same class as first-probe finding 3. The pattern across three probes: sonnet and haiku both drift from a 1-line contract when the prompt gives them a lot to report; opus (planner, evaluator) never has.
3. **Every FAIL in three rounds was factual, none structural.** Layer 2 passed 19/19 every round. On a documentation repository the value of Layer 3 is the cross-file consistency pass — a token defined in four files agreeing — which no lint here checks. The two defects were exactly the kind `SLICE5.md`'s cold review had warned about (recorded value vs rendered string).
4. **The slugify cut lands mid-word.** `…-specified-in-de` from "in design/…" — rule followed, output unlovely. A cut at the last hyphen before 50 would cost nothing.

## Still not observed

- Fast Gate "Modify spec"; `gate.approved == true` while `phase == plan_done`; WORKFLOW-path `verify.verdict`; the Layer 2 auto-retry (`FAIL L2`); "Max rounds reached".
- Live probes A/B/C for `cold-pass` itself (`SLICE5.md` §Acceptance criteria) — they need the installed copies re-synced and a fresh process, since the skill bodies this run executed predate `49eec8f`.

---

# Fourth probe — `cold-pass` live probe A: the `--fast` reason renders end to end (2026-09-18)

> A fresh `claude` process after `exit` (the handoff's precondition), on
> `harness/token-performance-optimization` at `15dfb92`, both installed copies sha-identical to
> HEAD for the four files the probe reads. The injected `/harness` body carried
> `cold_pass_source`, which is the proof the process loaded the post-`49eec8f` copy — the third
> probe could not run this for exactly that reason. The task was the smallest true edit available:
> SLICE5.md's own header still said `designed, not implemented`. Nothing in this file is a rule.

## Setup

| Item | Value |
|---|---|
| Entry | `/handoff resume` → "Briefing only" (the resume turn rendered no "Start next step", because the handoff's Do NOT forbids chaining `/harness` there) → `/harness --fast "<task>"` typed as its own message |
| Task | replace SLICE5.md line 4's status phrase with `implemented (49eec8f, merged 71c5c02); live probes A/B/C pending` — one file under `design/`, outside every lint's scan |
| Defaults line | source 1 absent (`settings.local.json` has no `env` key); source 2 `CLAUDE.md` supplies `lint-cmd` only — no `cold-pass` key, so `--fast` is the sole `cold_pass` writer |
| Slug | `update-the-status-line-in-design-harness-prompt-di` — the 50-char cut lands mid-word again (`prompt-di`), third probe finding 4 unchanged |
| Model preset | `balanced` (fast default) |

## Observed sequence

1. **Step 1 Setup**: `cli_flags = {fast: true, cold_pass: false, cold_pass_source: "fast"}` written in one checkpoint. Setup Summary printed `Cold      : off (--fast)` between `TypeCheck` and `Scope` — **acceptance line 1 of live probe A**. `Lint` echoed `(project default)`; `Language : unknown`, build/test/type-check `none`, and the (P1-3) warning did not fire because `lint_cmd` is set.
2. **Step 1.5**: `CLAUDE.md` 224 lines → rich → copied, no question.
3. **Step 2 INLINE**: `spec_stamp → null` before dispatch; planner (opus) returned `spec.md generated — 8 acceptance criteria, 5 edge cases` (90 lines); `spec_stamp {generation: 1, lines: 90}`; Scale Assessment frozen (8 checkboxes, 1-signal), not rendered; `plan_critic = {applied: "skipped", source: "fast"}` → `Critic: skipped (--fast)`.
4. **Fast Gate → Build now** → `gate = {approved: true, mode: "fast"}` → `[harness] Fast Gate approved — chaining into /harness-build.` → Skill tool → `/harness-build` §Entry admitted on the fast row and wrote `generate_ready` / `epic.boundaries → null`.
5. **Round 1**: Generator (sonnet) `1 files changed — SLICE5.md`; `git diff --numstat` 1/1. Verify (haiku) `PASS — build SKIPPED, test SKIPPED, lint 0e/0w, scan 0 TODO`. Evaluator (opus) `PASS — 완료 기준 8건 전건 YES …` — it re-ran numstat, the byte comparison against `HEAD:` excluding line 4, the LF/BOM check and the lint chain itself, and confirmed the three factual claims (`49eec8f`, `71c5c02`, PROBE.md:174) against the repository.
6. **§Step 6 item 7**: `cli_flags.cold_pass == false` → `verify.cold_result → "skipped"`, `cold_round → 1`, nothing printed there. **§Step 7 preamble** printed `Cold review: disabled (--fast)` — **acceptance line 2**. Verdict from `verify.verdict == "PASS"`; the qa_report was never opened.
7. **Step 8**: the human chose "Commit code only" (the handoff had planned "No commit"; the gate is the human's). `spec.md` / `qa_report.md` failed to stage (gitignored, warn-and-continue), commit `cd6c190`, `.harness/` deleted. Type B block printed `Remaining : none (cold pass skipped — --fast)` — **acceptance line 3**. Merged `--no-ff` as `f08e25c`.

Total: 1 user message and 2 AskUserQuestion answers (Fast Gate, Commit). Sub-agent cost, from the task notifications: planner 84k tokens / 205 s; generator 66k / 27 s; verifier 44k / 39 s; evaluator 78k / 199 s — about 272k tokens for a 1-line change, of which the planner and evaluator are 60%.

## Verdicts

| # | Question | Result |
|---|---|---|
| 1 | Live probe A (`SLICE5.md` §Acceptance criteria): `Cold : off (--fast)` at Setup, `Cold review: disabled (--fast)` at Step 7, `Remaining : none (cold pass skipped — --fast)` in Type B | **yes, all three** — the `--no-cold-pass` literal the first two probes recorded is gone from every rendered line; the checkbox is ticked in this commit |
| 2 | `cold_pass_source` is written once at Setup and only read afterwards | **yes** — three render sites, one state field, no re-derivation from flags in `/harness-build` |
| 3 | Sub-agents honor the 1-line Output Contract when the prompt says "your entire reply must be exactly that one line" | **yes, 4 of 4** (opus, sonnet, haiku, opus) — the third probe's finding 1 hypothesis (wording, not model) holds on this run; no re-ask was needed |

## Findings

1. **`user_lang` detection is under-specified for an ASCII task typed by a non-English speaker.** `templates/_shared/output_language.md` says "the user's most recent message"; that message was the English task string (the slugify rule wants ASCII), so a literal reading yields `en` while every other message in the session was Korean. The orchestrator recorded `ko` — the conversation's language, which the user-level CLAUDE.md also sets as the default — and the sub-agent prompts carried an explicit Korean directive. Recorded as a judgment call, not a defect in the skill: the rule should probably say "the language the user is conversing in, not the task string's script", and it does not.
2. **`Commit code only` on a probe branch leaves a merge to do.** Nothing wrong with it — but a `--fast` session cut from an epic branch ends on `harness/<slug>` at a commit the epic branch does not have, and neither the Type B block nor `/handoff` says so. The first three probes hit the same thing and merged by hand each time.
3. **Cost floor.** A 1-line documentation edit cost 272k sub-agent tokens; the third probe's 9-file change cost 1.16M. The planner (84k) explored git history and PROBE.md to verify two commit shas the task already named; the evaluator (78k) re-ran the whole lint chain the verifier had just run. Both are correct per their templates; the floor is the templates' thoroughness, not the change size.

## Still not observed

- Live probes B and C for `cold-pass` (`settings.local.json` `env.AGENT_HARNESS_DEFAULTS = "cold-pass=off"` → `Cold : off (project default (settings.local.json))` with `Lint : none` from wholesale shadowing; `cold-pass=maybe` → one warning, `Cold : on`, `cold_pass_source == null`).
- The `null` `cold_pass_source` → `source not recorded` branch (needs a pre-`49eec8f` state file resumed with `cold_pass == false`).
- Everything the third probe listed: Fast Gate "Modify spec"; `gate.approved == true` while `phase == plan_done`; WORKFLOW-path `verify.verdict`; the Layer 2 auto-retry; "Max rounds reached".
