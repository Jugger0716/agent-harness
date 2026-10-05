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
| P1 | inline normal path, no decision: `/harness "<small task>"` | one message to Step 8; one AskUserQuestion before Step 8; same-turn chain (AC-1, 2, 10) | |
| P2 | path with decisions: triage question → (Accept all / Review individually) → re-run → approval | decision before approval, separate calls; Minor defaulted and listed (AC-1, 7, 9, S3.5) | |
| P3 | approve → `/harness --modify "..."` → `/harness-build` refused → `/harness` Resume → gate re-render → approve → build passes; variant: edit spec.md in an editor | AC-11, 12, 14 | |
| P4 | `--separate-gate` session with decisions: 3-message flow, Resume → `Next → /harness-gate`; inline session typing `/harness-gate` → one-line redirect | AC-8, 13 | |
| P5 | interrupt the loop, resume (new run); `run_style=phase` approval stop + Resume → `/harness-build`; chain refused → same output | AC-10, 14 | |
| P6 | WORKFLOW path (ultracode ON): round-1 `spec.eval` + inline verify; inject a failure → row ④ | AC-2, 8, 15 | |
| P7 | tree check: a sub-agent touching a file outside the excluded paths → `failed (loop_tree_dirty)`; designated outputs overwritten → not a failure | AC-17 | |
| P8 | `claude -p` non-interactive: stops at `plan_done`, no approval record, escape line printed | AC-16 | |
| P9 | two-slice toy epic: epic approval → first slice auto-start → slice a approve → auto commit → slice b auto-start → approve → epic complete. Variants: non-clean slice (commit question → boundary stop), Command with `--fast` appended (shape check fails), `run_style≠auto` session, retried slice (no `dirty_at_start`, commit question, left-out list) | AC-18–21, S3.5 | |
| P10 | cut the session mid-chain, `/handoff resume` → "Start next step" continues; note whether WebSearch/WebFetch are blocked in the continued turn | AC-21, risk 7 | |

## Record per scenario

runId(s), the exact AskUserQuestion calls seen (header + options), state.json fields after the
scenario (`phase`, `converge.*`, `gate.*`, `cli_flags.separate_gate`, `dirty_at_start`), commits
made, `git status` before/after, and any branch of the contract NOT observed.
