# state.json v3 — write template and additive-optional fields (single source)

> Written by `skills/harness/SKILL.md` §Step 1 item 11 and read by every later phase. The skill
> keeps the field NAMES and the partial crash-recovery checkpoint inline; this file holds the full
> literal and the additive-field defaults. `workflows/_reference/state_fields.md` holds the
> per-field writer/reader map.

```json
{
  "version": "3.0", "skill": "harness", "task": "<task>",
  "mode": "single|standard|multi", "path_resolved": "inline|workflow", "run_style": "auto|phase|step",
  "model_config": { "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>",
                    "evaluator": "<model|null>", "verifier": "<haiku|sonnet|opus>" },
  "cli_flags": { "verifier_model": null, "output_dir": null },
  "user_lang": "<lang>", "has_git": true, "repo_name": "<name>", "repo_path": "<path>",
  "phase": "plan_ready", "round": 1, "max_rounds": 3, "max_files": 20,
  "scope": "<scope or (no limit)>", "branch": "harness/<slug>", "lang": "<detected>",
  "build_cmd": "<cmd or null>", "test_cmd": "<cmd or null>", "lint_cmd": "<cmd or null>", "type_check_cmd": "<cmd or null>",
  "verify": { "layer1_result": null, "layer1_retries": 0, "layer2_result": null, "layer2_retries": 0,
              "todo_blocking": false, "autofix_attempted": false },
  "autofix": null, "runs": { "plan": null, "build": null, "eval": null }, "workflow_ctx": null,
  "docs_path": "<output_base>/<slug>/", "conventions": null,
  "created_at": "<ISO8601>", "updated_at": "<ISO8601>"
}
```

> `cli_flags.verifier_model` / `output_dir` are `null` unless overridden. `verify.autofix_attempted` starts `false` each session (session-wide once-only — not reset on round increment). `autofix` becomes `{ "last_patch_path", "applied": "proposed"|"applied"|"rejected"|"stopped", "triggered_at" }` during the Auto-fix flow. `runs.{plan|build|eval}` records `{ "runId" }` after each segment launch (audit + same-session only). `workflow_ctx` stores `{ "planDigest", "advisorDigests" }` returned by `harness.build`, reused verbatim on retries.

**Additive-optional fields (v3, no `version` bump — §Version & Compatibility).** None of these is in the literal above; a missing field takes the default here. The full writer/reader map is `workflows/_reference/state_fields.md`.

| Field | Default | Written by |
|---|---|---|
| `plan_critic.applied` (`"executed"` / `"skipped"` / `"failed"`), `.round`, `.last_findings_path`, `.failure_reason`, `.source` (`"own"` / `"fast"`), `.counts` (`{critical, major, minor}`, lowercase — `CriticReport.counts`; after a converge run, the residual counts), `.spec_stamp_at_critic` (`{generation, lines}`) | `null` each | §Step 2.6 (all 7 fields in one write — after a converge run, its mapping) |
| `converge.status` (`"running"` / `"converged"` / `"capped"` / `"failed"`), `converge.runs` (integer, cumulative per session), `converge.rounds` (integer, cumulative completed rounds) | `null` each (`runs` / `rounds` read as 0) | `templates/harness/converge.md` — `status` = `"running"` and `runs += 1` at a run's start (one write, alone); the terminal `status` and `rounds` in §Step 2.6's mapping write (branch (ii): `status = "failed"` alone) |
| `spec_stamp` (`{generation, lines}`) | `null` | every `spec.md` write site, via §Step 2's `spec_stamp` write protocol (and §Session Recovery's re-stamp, the same protocol around an unchanged file) |
| `scale.signals` / `scale.slice_hint` / `scale.override` | `null` | §Scale Assessment compute site |
| `epic.id`, `epic.boundaries` | `null` | `skills/harness-build/SKILL.md` §Step 3.5; `epic.boundaries` is reset by `/harness-build` §Entry and read by §Session Recovery item 7 (a) |
| `verify.cold_result`, `verify.cold_round`, `verify.cold_counts` (`{Critical, Major, Minor}`, uppercase — `CriticReport.items[].severity`), `verify.cold_review_path` | `null` | `skills/harness-build/SKILL.md` §Step 5 and the Steps 6–7 cold-review branches there |
| `verify.cold_retries` | `0` | same |
| `verify.verdict` (`"PASS"` / `"FAIL_L2"` / `"FAIL_L3"`) | `null` | `skills/harness-build/SKILL.md` §Step 6 item 5 (INLINE, from the 1-line return's leading token) / §Step 5 item 4 (WORKFLOW, from `VerifyVerdict`); reset to `null` on round increment. §Step 7 reads it on both paths and treats `null` as `FAIL_L3` |
| `cli_flags.epic` (tri-state) | `null` | §Step 1 item 2 |
| `cli_flags.cold_pass` | `true` | §Step 1 item 2 (`--no-cold-pass`, `--fast`) |
| `cli_flags.cold_pass_source` (`"flag"` / `"fast"` / `"default:<source>"` / `null`) | `null` | §Step 1 item 2, in the same write as `cli_flags.cold_pass` |
| `cli_flags.fast` | `false` | §Step 1 item 2 |
| `cli_flags.separate_gate` (gate mode: `true` separate, `false` inline) | absent — read as inline when `cli_flags.fast`, separate otherwise (§Approval Gate's gate-mode rule). That reading is for sessions older than the field, not a default a new session may fall back on: §Step 1 item 2 MUST write it, `true` or `false`, on every new session — omitted, a non-fast session would silently read as separate | §Step 1 item 2 (`--separate-gate`, or the project default `gate=separate`), once per new session |
| `dirty_at_start` (map: repo-relative path → its `git hash-object`, `null` for a path deleted in the working tree) — the working tree as it stood before the session created anything | absent — "not recorded", and a recorded `null` reads the same: `skills/harness-build/SKILL.md` §Epic Slice Chain then asks the commit question instead of committing automatically | §Step 1 item 7, in a slice session only (every other session leaves it absent, and so does a retried slice whose `{docs_path}` already existed), in the partial checkpoint (`{}` for a clean tree; `null` without git or on a git failure), carried unchanged by item 11's write. Read by that automatic commit, and by §Approval Gate's slice variant only to decide what "Build now" promises — with `has_git == true` and this not a map, neither that commit nor the next slice |
| `gate.approved`, `gate.approved_at`, `gate.mode` (`"fast"` / `"session"` — which variant of §Approval Gate approved), `gate.spec_stamp` (`{generation, lines}`, the `spec_stamp` the approval was given for), `gate.route` (`"single"` / `"epic"`) | `null` each | §Approval Gate's approval record — all five in ONE write, "Build now" or "Plan as epic" only — never `/harness-gate`, which holds no write tool. A record without `gate.spec_stamp` (written before it existed) is no approval. `templates/harness/converge.md` §Mapping writes them back to the values a converge run started with — a restore, never an approval |

> `plan_critic.counts` (lowercase keys) and `verify.cold_counts` (uppercase keys) follow different upstream schemas — an intentional difference, never normalized. `spec_stamp.generation` counts spec.md writes (unbounded) and `plan_critic.round` marks the Auto-revise opportunity as spent (bounded at 1; every converge run-end mapping writes `1`) — different axes, never compared, and neither is `converge.rounds`, which counts loop rounds and gates nothing (`converge.status` does gate decisions — the delta-or-full choice after a Modify or a resumed decision apply, `skills/harness/SKILL.md` §Session Recovery's resume routing, `--critic`'s INLINE branch and Pass A row ④'s banner; its readers are listed in `workflows/_reference/state_fields.md`). `spec_stamp.generation` never repeats a value a recorded copy (`gate.spec_stamp`, `plan_critic.spec_stamp_at_critic`) holds — §Step 2's write protocol continues above the largest one when the stamp it starts from is `null`. The ledger, the snapshot and the per-round files of `.harness/converge/` are files, not state fields; they are deleted with `.harness/`. `plan_critic.applied`'s value set is harness-local. `gate.mode` names the variant of §Approval Gate that wrote an approval; the session's gate mode (inline / separate) is `cli_flags.separate_gate` — two fields, deliberately not sharing a name. `gate.spec_stamp` and `plan_critic.spec_stamp_at_critic` are both copies of `spec_stamp` taken at different moments (an approval, a critic mapping) and are compared with `spec_stamp` by different readers (`skills/harness-build/SKILL.md` §Entry's approval check, `skills/harness-gate/SKILL.md` §Stale Determination), never with each other.
