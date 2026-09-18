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
| `plan_critic.applied` (`"executed"` / `"skipped"` / `"failed"`), `.round`, `.last_findings_path`, `.failure_reason`, `.source` (`"own"` / `"carried_over"` / `"fast"`), `.counts` (`{critical, major, minor}`, lowercase — `CriticReport.counts`), `.spec_stamp_at_critic` (`{generation, lines}`) | `null` each | §Step 2.6 (all 7 fields in one write) |
| `spec_stamp` (`{generation, lines}`) | `null` | every `spec.md` write site, via §Step 2's `spec_stamp` write protocol |
| `scale.signals` / `scale.slice_hint` / `scale.override` | `null` | §Scale Assessment compute site |
| `epic.id`, `epic.boundaries` | `null` | `skills/harness-build/SKILL.md` §Step 3.5; `epic.boundaries` is reset by `/harness-build` §Entry and read by §Session Recovery item 7 (a) |
| `verify.cold_result`, `verify.cold_round`, `verify.cold_counts` (`{Critical, Major, Minor}`, uppercase — `CriticReport.items[].severity`), `verify.cold_review_path` | `null` | `skills/harness-build/SKILL.md` §Step 5 and the Steps 6–7 cold-review branches there |
| `verify.cold_retries` | `0` | same |
| `cli_flags.epic` (tri-state) | `null` | §Step 1 item 2 |
| `cli_flags.cold_pass` | `true` | §Step 1 item 2 (`--no-cold-pass`, `--fast`) |
| `cli_flags.fast` | `false` | §Step 1 item 2 |
| `gate.approved`, `gate.approved_at`, `gate.mode` (`"fast"`) | `null` | §Fast Gate "Build now" only — never `/harness-gate`, which holds no write tool |

> `plan_critic.counts` (lowercase keys) and `verify.cold_counts` (uppercase keys) follow different upstream schemas — an intentional difference, never normalized. `spec_stamp.generation` counts spec.md writes (unbounded) and `plan_critic.round` counts Auto-revise rounds (bounded at 1) — different axes, never compared. `plan_critic.applied`'s value set is harness-local, not interchangeable with /spec's `approved` / `pending` / `revised`.
