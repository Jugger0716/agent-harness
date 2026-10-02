# run_style and the harness command surface (single source)

> Cited by name from `skills/harness/SKILL.md` and `skills/harness-build/SKILL.md` §run_style.
> Holds the three execution styles, the full CLI surface of all three pipeline skills, and the
> step-mode prerequisite table. Read it when parsing arguments or deciding where a session ends.

## run_style (Execution Mode)

| Style | Behavior | Session end points |
|---|---|---|
| `auto` | Automatic progression WITHIN a skill; `/harness` always ends at `plan_done` (SPEC rev.9 (b)). In an inline session (the default) it renders HARD GATE #1 there — `skills/harness/SKILL.md` §Approval Gate — and an approval chains into `/harness-build` in the same turn when that skill's §Chain Condition holds; a separate session (`--separate-gate`) ends with `Next → /harness-gate`. In `/harness-build`, user gates at evaluate_done(FAIL) only | `plan_done` (`/harness`, or past it through the chain), `completed` (`/harness-build`) |
| `phase` | Stop at each `*_done` state, resume in the next session. An inline session's approval at `plan_done` does not chain (`skills/harness/SKILL.md` §Chain Condition needs `auto`): it stops with Resume `/harness-build` | `plan_done`, `generate_done`, `verify_done`, `evaluate_done` |
| `step` | Execute only the specified step, then stop | immediately after the step |

## §CLI Parsing

```
/harness "task description"              → auto (default); converge loop, then in-session approval at plan_done (skills/harness/SKILL.md §Approval Gate), then chains into /harness-build
/harness plan "task description"         → phase mode, plan step — stops at plan_done: after the in-session approval (Resume /harness-build), or Next → /harness-gate in a separate session
/harness "task" --separate-gate          → ends at plan_done → Next → /harness-gate (the tool-less gate); cannot be combined with --fast
(project line) agent-harness-defaults: gate=separate → same effect as --separate-gate, standing — templates/_shared/project_defaults.md §agent-harness-defaults (--fast still wins: always inline)
/harness "task" --no-prompt              → non-interactive: no Ambiguity Prompt, no decision or approval question, no approval record, no chain — stops at plan_done
/harness --fast "task"                   → auto + single/inline; skips Plan Critic and cold review; §Approval Gate's fast variant (no "Plan as epic"), then chains into /harness-build. --quick is an alias
/harness --mode single "task"            → auto + single mode (inline forced)
/harness --mode multi "task"             → auto + multi mode (workflow path)
/harness --model-config balanced "task"  → auto + balanced preset
/harness "task" --epic | --no-epic       → cli_flags.epic = true | false (skills/harness/SKILL.md §Scale Assessment override); with --epic the gate leads with "Plan as epic" (§Approval Gate, or the separate gate's Pass B, which prints /harness-build --epic)
/harness "task" --no-cold-pass           → cli_flags.cold_pass = false — read by skills/harness-build/SKILL.md §Step 5 "Cold Review Input Collection"
(project line) agent-harness-defaults: cold-pass=off → same effect as --no-cold-pass, standing — templates/_shared/project_defaults.md §agent-harness-defaults
/harness --modify "<request>"            → gate re-entry (plan_done only) — skills/harness/SKILL.md §Gate re-entry flags
/harness --auto-revise | --critic        → gate re-entry (plan_done only) — same section
/harness doctor                          → read-only diagnostic (dispatch: skills/harness/SKILL.md §Session Recovery carve-out; contract: ## Sub-command: doctor)
/harness-gate                            → HARD GATE #1 for a separate session (Pass A / Pass B); prints the next command; writes nothing. An inline session is redirected to /harness
/harness-build                           → phase → "generate_ready" write, then Step 4 → 8 (auto within this skill); an inline session must first pass skills/harness-build/SKILL.md §Entry's approval check
/harness-build --epic                    → Slice Plan (skills/harness-build/SKILL.md §Step 3.5) then Epic Exit (Step 3.6); phase stays plan_done
/harness-build generate | verify | evaluate → phase mode (generate) / step mode (verify, evaluate)
```

When state.json exists and `/harness` or `/harness-build` is called with no arguments, §Session Recovery routes by phase; a phase owned by the other skill prints that skill's name and halts.

## §Step Mode Prerequisites

| Step | Required files | Required phase (minimum) | Missing action |
|---|---|---|---|
| `/harness plan` | (none) | (new session OK) | Normal start |
| `/harness-gate` | spec.md | `plan_done` exactly, separate gate mode | `skills/harness-gate/SKILL.md` §Entry Check redirects to the owner (`/harness` for an inline session); nothing is written |
| `/harness-build` | spec.md | `plan_done` (performs the `generate_ready` write) or later; at `plan_done` an inline session also needs an approval record that passes `skills/harness-build/SKILL.md` §Entry's approval check (and `--epic` exactly when it records the epic route) | Error: "Run /harness first"; a failed approval check refuses, writing no gate-crossing field (`phase`, `gate.*`, `spec_stamp`, `epic.*`) |
| `/harness-build verify` | changes.md | after `generate_done` | Error: "Run generate first" |
| `/harness-build evaluate` | spec.md + changes.md + verify_report.md | after `verify_done` | Error: "Run verify first" |
