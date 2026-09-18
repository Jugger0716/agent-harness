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

1. **Korean task strings slugify to noise.** §Step 1 item 3 (lowercase → transliterate → drop non-word → 50 chars) turned the task into `scriptsverify_sync_markerspy-modyul-docstringui-wh`, which became both the branch name and the `docs_path` segment. The rule was followed exactly; the output is unusable as an identifier. Possible fixes: prefer the first ASCII path-like token when one exists, or ask for a slug under `--fast` (one more question) — not decided here.
2. **The lint detection table has no row for this repository.** `templates/_shared/detection_table.md` detects lint from `package.json` / `pyproject.toml` / `.eslintrc*` / `Cargo.toml` etc.; this repository documents seven lint commands in `CLAUDE.md` and matches none. Result: `lint_cmd = null`, Layer 1 skipped all four commands, and the P1-3 warning fired. The generator and the evaluator each ran the lints themselves, so the outcome was not wrong, but Layer 1 verified nothing. A `CLAUDE.md` "Commands" table row, or a `--lint-cmd` default via the `agent-harness-defaults:` line, would close this; neither exists today.
3. **The generator violated the 1-line Output Contract** (a multi-line report after the contract line). The orchestrator used only the first line, as `templates/_shared/orchestrator_contract.md` prescribes, so no state decision was affected. Worth noting because the same contract on the evaluator is load-bearing (leading-token parse); the evaluator complied.
4. **`gate.approved` refusal path untested** — see verdict 3. A deliberate follow-up: run `/harness --fast`, answer Stop at the Fast Gate, then type `/harness-build` and confirm the `[harness-build] This is a --fast session whose Fast Gate has not been answered` halt.
5. **A `disallowed-tools` scope change was visible at the chain boundary**: `NotebookEdit` was announced unavailable when `/harness-build` loaded, then available again afterwards — consistent with the turn-scoped mechanism `templates/_shared/mode_gate.md` rule 3 records. No effect on this run.

## Not observed / out of scope

- WORKFLOW-path `verify.verdict` write (§Step 5 item 4) — this was an inline run by construction.
- "Modify spec" and "Stop" branches of the Fast Gate.
- Fast Gate re-render on a resumed `plan_done` fast session, and the `gate.approved == true` while `phase == plan_done` interrupted-chain message.
