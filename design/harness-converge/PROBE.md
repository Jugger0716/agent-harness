# harness-converge live probe (S4)

> Precondition (done 2026-10-06): both installed copies — `~/.claude/plugins/marketplaces/agent-harness-marketplace/`
> and `~/.claude/plugins/cache/agent-harness-marketplace/agent-harness/8.14.0/` — overwritten with branch
> `harness/harness-converge-flow` at f8a6239 (164 tracked files, byte-identical to the blobs; backups
> `backup_{marketplace,cache}_8.14.0.tgz` in the session scratchpad). A probe is valid only in a NEW
> `claude` process started after `exit` — never `/clear`, never `--resume`.
>
> Restore after the probe (or on abandonment): re-sync both installs from `main`'s tree (`git archive`
> then rewrite each file with its exact blob bytes — `git archive` applies `core.autocrlf` to files the
> `.gitattributes` does not pin, which turned 11 files CRLF on the first sync).

## Where to run

A scratch repository OUTSIDE `C:/workspace/agent-harness` (this repo holds the preserved Stage 1
session in `.harness/`). Check `git status` before and after every scenario.

## Scenarios

| # | Scenario | Checks (AC) | Result |
|---|---|---|---|
| P1 | inline normal path, no decision: `/harness "<small task>"` | one message to Step 8; one AskUserQuestion before Step 8; same-turn chain (AC-1, 2, 10) || **PASS (behaviour) / FAIL (fixed print lines)** — run S1 (2026-10-06, SDK driver). One message reached Step 8 and the commit; the Approval answer chained into `/harness-build` in the same turn; the only questions before Step 8 were Convention Scan, Decisions, Approval. The zero-decision precondition did not hold (3 Major decisions), so the strict P1 branch is UNOBSERVED. See §Findings F1, F2 |
| P2 | path with decisions: triage question → (Accept all / Review individually) → re-run → approval | decision before approval, separate calls; Minor defaulted and listed (AC-1, 7, 9, S3.5) || **PASS (behaviour) / FAIL (F1)** — runs S2, S3 (rerun), S0 (resume variant). Decisions came before Approval in separate calls, exactly 2 triage options, Minor defaulted with `by=default`, one write event then `Converge run 2: delta review`, no second triage. Review individually: ≤4 per call, Other stored verbatim (`by=user`). S3's first attempt asked an uncontracted clarification question after an Other answer (F3); the rerun did not reproduce it |
| P3 | approve → `/harness --modify "..."` → `/harness-build` refused → `/harness` Resume → gate re-render → approve → build passes; variant: edit spec.md in an editor | AC-11, 12, 14 || **PASS** — run S4. `--modify` after approval re-ran delta and re-rendered the gate; `/harness-build` refused with (c), then after a line-count-changing edit with (e); `/harness` Resume re-stamped, ran a full review, re-approved, and the build passed. `--modify` in a session with `.harness/` showed no Session question (F8). Resume via item 6 omitted `[harness] Plan complete.` (F1) |
| P4 | `--separate-gate` session with decisions: 3-message flow, Resume → `Next → /harness-gate`; inline session typing `/harness-gate` → one-line redirect | AC-8, 13 || **PASS** — runs S6, S0. Message 1 of a `--separate-gate` session asked no Approval; `/harness-gate` rendered Pass A (row ①-c) then Pass B; `/harness-build` passed without an approval-record check. Inline `/harness-gate` printed the one-line redirect, no AskUserQuestion, state byte-identical. The `Gate : separate` Setup Summary row was never printed (F1) |
| P5 | interrupt the loop, resume (new run); `run_style=phase` approval stop + Resume → `/harness-build`; chain refused → same output | AC-10, 14 || **PASS** — runs S5 (rerun), S4. Process exit inside converge run 1 (`status running, runs 1`) → Resume started `Converge run 2: full review`; View state only wrote nothing. `run_style=phase` approval stopped with Type A Resume `/harness-build`, no `Next →`. Chain Skill call denied → Type A, `gate.approved` kept; a typed `/harness-build` then passed |
| P6 | WORKFLOW path (ultracode ON): round-1 `spec.eval` + inline verify; inject a failure → row ④ | AC-2, 8, 15 || **PASS (behaviour) / FAIL (F4)** — runs S7 (rerun), S8. Corrupted ledger at the Approval question → Modify → the new run ended `failed`, the gate re-rendered, Other `승인` was not an approval (AC-15). Missing: the `⚠ Plan Critic failed` banner and failure_reason (F4) and the step-1 re-render (F5). P6-v2: denied `spec.eval` was not retried, `/harness-gate` showed row ④. ultracode-ON reason line UNOBSERVED (SDK sessions used `--mode multi`). S7's first attempt declared the session non-interactive without trying AskUserQuestion (F6), not reproduced |
| P7 | tree check: a sub-agent touching a file outside the excluded paths → `failed (loop_tree_dirty)`; designated outputs overwritten → not a failure | AC-17 || **PASS** — runs S9, S10. A file created during the round-1 dispatch → `failed (loop_tree_dirty)`, no rollback, `/harness-gate` row ④ named the reason. `--output-dir probe_out` (not halted after 1d7d38b): a newly created `probe_out/<slug>/plan_critic_findings.md` was excluded and the loop continued. A sub-agent's own stray write is UNOBSERVED (not forceable) |
| P8 | `claude -p` non-interactive: stops at `plan_done`, no approval record, escape line printed | AC-16 | **PASS with deviation** (2026-10-06, claude 2.1.289, inline, 23 turns). `phase=plan_done`, `gate=null`, no chain, no AskUserQuestion attempted, Type A block with Resume `/harness`; `converge` converged runs 1 rounds 1, ledger L1–L8 open `decision` + L9 open Minor `auto`; HEAD and tree unchanged. Deviation: the escape line was paraphrased — the `.harness/` deletion and `--separate-gate` merged into one instruction, "choose Restart at item 7" dropped. Observed: (a) a round-1 Minor-only `auto` is never applied (step 3 ends `converged` before step 4; residual with no question) — contract-consistent, design question; (b) verify returned a `reject` with sources `["C-none"]` on a 0-Critical round, and the orchestrator hand-edited `verdict.json` to drop it — §Round step 2's coverage rule does not say whether an extra non-ID source fails |
| P9 | two-slice toy epic: epic approval → first slice auto-start → slice a approve → auto commit → slice b auto-start → approve → epic complete. Variants: non-clean slice (commit question → boundary stop), Command with `--fast` appended (shape check fails), `run_style≠auto` session, retried slice (no `dirty_at_start`, commit question, left-out list) | AC-18–21, S3.5 || **PASS (chain mechanics) / FAIL (boundary output)** — run E1 (one user message, 12 questions, ~3.7 h, one auto-compaction mid-chain). Epic approval → Slice Plan (2 rows) → slice a auto-start → approve → clean end committed without a question (8cf50ee) → slice b auto-start → approve → commit (07ae2ab, linear) → `Epic : complete`. Skill args equal each row's Command minus `/harness ` byte for byte; epic spec/slice_plan in no commit. The epic Type B and slice a's Type B were not printed before chaining, and neither slice printed the `Clean slice end` disclosure (F7). Variants (non-clean slice, `--fast` shape check, `run_style≠auto`, retried slice) UNOBSERVED — not run |
| P10 | cut the session mid-chain, `/handoff resume` → "Start next step" continues; note whether WebSearch/WebFetch are blocked in the continued turn | AC-21, risk 7 || **UNOBSERVED** — not run. E1 showed a single-turn chain surviving one auto-compaction (output format and language drifted afterwards) |

## Findings (S4, 2026-10-06 → 10-13)

Driven by an Agent SDK driver (`claude-agent-sdk` 0.2.163, CLI 2.1.289; each session a fresh
process, AskUserQuestion answered by scripted label rules, snapshots while each question was
pending) and judged per run by a judge + adversarial-verifier pair. Kit, runs and digests:
`C:/workspace/harness-probe-s4-kit/` (outside the repo). Every item below survived verification.

- **F1 — fixed print lines are skipped systematically** (every run): the `  • [L<n>] …` list
  before the Decisions question (the question still says "listed above" — the user accepts
  decisions they never saw), `  Converge round r/R` lines, the Setup Summary block and the
  `Path :` line, `[harness] Previous session detected.` status, build `  ✓` / `QA PASS` /
  `Evaluate complete` lines, `[harness] Plan complete.` on an item-6 resume. State and flow
  were correct in the same runs: the omission is of rendering, not of logic.
- **F2 — the Approval question carries extra text**: residual-decision notes ("남은 Major 결정
  L14는 Modify로…") and once an "approving also confirms two assumptions" clause, against
  §Approval Gate step 2's fixed question.
- **F3 — Other answer to a decision triggered an uncontracted clarification question** (S3 first
  attempt; not reproduced in the rerun). A related silence: Other text that does not map to a
  spec edit has no handling rule.
- **F4 — a `failed` run after a Modify printed no `⚠ Plan Critic failed` banner / failure_reason**
  (S7); the failure surfaced only inside the re-rendered Approval question's text.
- **F5 — Modify did not re-render the gate from step 1** (S0, S7): Summary Block, Scale
  Assessment and round lines were skipped, so a decision created by that run (S0: L13) was not
  shown before the approval question.
- **F6 — one session declared itself non-interactive without attempting AskUserQuestion** (S7
  first attempt, workflow path): Convention Scan, decisions and approval were all skipped.
- **F7 — epic chain boundaries are silent** (E1): the epic Type B (`Epic planned` / `Next` /
  `Chain`) and slice a's Type B were not printed before chaining; neither slice printed the
  `Clean slice end — committing without asking …` line with its change-set and left-out lines.
- **F8 — contract tension, `--modify` vs Session Recovery**: the run applied `--modify`
  directly with no Session question; read literally, §Session Recovery would ask first and
  Resume's jump table ignores the flag.
- **Text defects**: the Type A `Phase` row ("Plan → Gate") does not fit a stop after approval;
  a Minor `auto` is never applied when no Critical/Major `auto` is open, yet §Round step 4 says
  the next run "picks it up"; the spec line-count rule is ambiguous for a trailing newline; the
  `Convention Scan` header exceeds the AskUserQuestion header limit and renders truncated;
  SPEC §test strategy P5's `Next → /harness-build` contradicts flow 8; the Approval `{n}` (live)
  and the frozen Scale Assessment AC count can differ on the same screen with no disclosure.
- **Also seen once**: one write event raised `spec_stamp.generation` by 2 (S3); a failed write
  was retried within the same event (S1); a cold-retry Evaluator got a spec path instead of
  `specContent` (S1, E1).
- **Environment**: the superpowers plugin injected skills into planners and evaluators.

## Record per scenario

runId(s), the exact AskUserQuestion calls seen (header + options), state.json fields after the
scenario (`phase`, `converge.*`, `gate.*`, `cli_flags.separate_gate`, `dirty_at_start`), commits
made, `git status` before/after, and any branch of the contract NOT observed.
