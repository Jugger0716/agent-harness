# run_style and the harness command surface (single source)

> Cited by name from `skills/harness/SKILL.md` and `skills/harness-build/SKILL.md` §run_style.
> Holds the three execution styles, the full CLI surface of all three pipeline skills, and the
> step-mode prerequisite table. Read it when parsing arguments or deciding where a session ends.

## run_style (Execution Mode)

| Style | Behavior | Session end points |
|---|---|---|
| `auto` | Automatic progression WITHIN a skill; the Plan → Gate boundary is a skill boundary and always ends the `/harness` session (SPEC rev.9 (b)) unless `--fast` chains it in-session. In `/harness-build`, user gates at evaluate_done(FAIL) only | `plan_done` (`/harness`), `completed` (`/harness-build`) |
| `phase` | Stop at each `*_done` state, resume in the next session | `plan_done`, `generate_done`, `verify_done`, `evaluate_done` |
| `step` | Execute only the specified step, then stop | immediately after the step |

## §CLI Parsing

```
/harness "task description"              → auto (default); ends at plan_done → Next → /harness-gate
/harness plan "task description"         → phase mode, plan step — the same end point
/harness --fast "task"                   → auto + single/inline; skips Plan Critic and cold review; in-session Fast Gate, then chains into /harness-build (skills/harness/SKILL.md §Fast Gate). --quick is an alias
/harness --mode single "task"            → auto + single mode (inline forced)
/harness --mode multi "task"             → auto + multi mode (workflow path)
/harness --model-config balanced "task"  → auto + balanced preset
/harness "task" --epic | --no-epic       → cli_flags.epic = true | false (skills/harness/SKILL.md §Scale Assessment override); with --epic the gate's Pass B leads with "Plan as epic" and prints /harness-build --epic
/harness "task" --no-cold-pass           → cli_flags.cold_pass = false — read by skills/harness-build/SKILL.md §Step 5 "Cold Review Input Collection"
/harness --modify "<request>"            → gate re-entry (plan_done only) — skills/harness/SKILL.md §Gate re-entry flags
/harness --auto-revise | --critic        → gate re-entry (plan_done only) — same section
/harness doctor                          → read-only diagnostic (dispatch: skills/harness/SKILL.md §Session Recovery carve-out; contract: ## Sub-command: doctor)
/harness-gate                            → HARD GATE #1 (Pass A / Pass B); prints the next command; writes nothing
/harness-build                           → phase → "generate_ready" write, then Step 4 → 8 (auto within this skill)
/harness-build --epic                    → Slice Plan (skills/harness-build/SKILL.md §Step 3.5) then Epic Exit (Step 3.6); phase stays plan_done
/harness-build generate | verify | evaluate → phase mode (generate) / step mode (verify, evaluate)
```

When state.json exists and `/harness` or `/harness-build` is called with no arguments, §Session Recovery routes by phase; a phase owned by the other skill prints that skill's name and halts.

## §Step Mode Prerequisites

| Step | Required files | Required phase (minimum) | Missing action |
|---|---|---|---|
| `/harness plan` | (none) | (new session OK) | Normal start |
| `/harness-gate` | spec.md | `plan_done` exactly | `skills/harness-gate/SKILL.md` §Entry Check redirects to the owner; nothing is written |
| `/harness-build` | spec.md | `plan_done` (performs the `generate_ready` write) or later | Error: "Run /harness first" |
| `/harness-build verify` | changes.md | after `generate_done` | Error: "Run generate first" |
| `/harness-build evaluate` | spec.md + changes.md + verify_report.md | after `verify_done` | Error: "Run verify first" |
