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
