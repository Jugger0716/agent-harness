# Slice 5′ — `cold-pass=on|off` as a project default (design, 2026-09-18)

> Replacement for HANDOFF_IMPROVEMENT_PLAN Slice 5 (`.harness/config.json` governance
> presets). Companion to `RATIONALE.md` and `PROBE.md`. Status: **designed, not implemented**.
> Nothing in this file is a rule until the sections it names are edited.

## Why the original Slice 5 is not built

The plan proposed a `.harness/config.json` with `governance_tier`, `gates.require_spec_gate`,
`gates.enable_cold_review` and `gates.auto_retry_max`, read by `/harness` before the Mode Gate.

| Knob | Verdict | Reason |
|---|---|---|
| `require_spec_gate: false` | **rejected** | Turns HARD GATE #1 off from a file. The whole point of the C5 split is that the gate turn holds no write tool; `--fast` is the one explicit, per-invocation opt-out and it still renders a gate. A standing file switch removes the human from the loop without a visible act. |
| `auto_retry_max` | **rejected** | The retry ceilings are session-wide invariants (Layer 1 max 3, Layer 2 max 2, Auto-fix once — Architecture Principle #4). Making them configurable re-opens the audit that fixed them. |
| `governance_tier` | **rejected** | A tier is a bundle of the two knobs above plus cold review. With those two gone, the bundle is one boolean. |
| `enable_cold_review` | **kept, moved** | The only knob that is a convenience, not a guarantee. It already exists per session as `--no-cold-pass`; what is missing is a standing form. |
| a new file `.harness/config.json` | **rejected** | `.harness/` is the live session directory, deleted by Step 8 and Step 3.6; a config file there would be lost every run. The repository already has one standing-default mechanism — the `agent-harness-defaults:` line (`templates/_shared/project_defaults.md`) with its 3-source precedence, parse rule and Setup-Summary transparency — and `lint-cmd` / `type-check-cmd` were added to it on 2026-09-18 without a new file. |

So Slice 5′ is: **one key, `cold-pass`, on the existing defaults line**, plus fixing the display
defect that the key would otherwise make worse.

## The display defect this must fix first

Three sites in `skills/harness-build/SKILL.md` render the literal `--no-cold-pass` whenever
`cli_flags.cold_pass == false`:

1. §Step 7, the Tier 1 preamble: `Cold review: disabled (--no-cold-pass)`.
2. §Session Boundary, the `Remaining` derivation: `cli_flags.cold_pass == false` → reason
   `--no-cold-pass`, rendered as `none (cold pass skipped — --no-cold-pass)`.
3. §Step 6 item 7: `verify.cold_result → "skipped"` with the parenthetical reason
   `"--no-cold-pass"` (prose only — the reason is never persisted).

`cli_flags.cold_pass` already has **two** writers that set it `false`: the `--no-cold-pass` flag
and `--fast` (`skills/harness/SKILL.md` §Step 1 item 2). Both live probes ran under `--fast` with
no `--no-cold-pass`: the first printed `Cold review: disabled (--no-cold-pass)` (`PROBE.md`,
first probe step 11) and `Remaining : see …/qa_report.md (cold pass skipped — --no-cold-pass)`
(step 12); the second printed `Remaining : none (cold pass skipped — --no-cold-pass)` (second
probe step 8), and its record does not quote the §Step 7 preamble line. **The literal is already
false today.** Adding a third writer (the project
default) would make a false line the common case, which is why the memory note called this "the
display-string source problem" and blocked the slice on it.

The boolean is the right gate input — the three AC-28 gating points and the segment's strict
`A.coldPass === true` test must stay boolean. What is missing is *why* it is false, recorded once
at Setup and read wherever the line is rendered.

## Design

### 1. One new key on the defaults line

`templates/_shared/project_defaults.md` §agent-harness-defaults, keys table:

| Key | Values | Effect |
|---|---|---|
| `cold-pass` | `on` \| `off` | Standing default for the cold-review pass. `off` is consumed by `/harness` §Step 1 exactly as `--no-cold-pass` is, when neither `--no-cold-pass` nor `--fast` is given. `on` is an explicit no-op that a team can pin to document intent; it never re-enables the pass under `--fast`, whose semantics are fixed. Any other value → the parse rule's warn-and-ignore. |

Resolution order (added to the "Resolution orders" list, same shape as the others):

- Cold pass (`/harness` only): `--no-cold-pass` > `--fast` > **project default `cold-pass=off`** > `true`.

Wholesale-source rule unchanged: a resolved line without `cold-pass` is not a cold-pass signal.
The `project-defaults` SYNC group (`verify_sync_markers.py`, `min_sites: 9`) targets this
section by name and counts marker sites in the nine multi-path skills; adding a key row inside
the section adds no marker site, so the floor stays 9 — no lint change.

### 2. One additive state field

`templates/harness/state_schema.md` additive table and `workflows/_reference/state_fields.md`:

| Field | Default | Written by |
|---|---|---|
| `cli_flags.cold_pass_source` | `null` | §Step 1 item 2, in the same write as `cli_flags.cold_pass`. `null` whenever `cold_pass == true`. Otherwise one of `"flag"` (`--no-cold-pass`), `"fast"` (`--fast` without `--no-cold-pass`), `"default:<source>"` where `<source>` is the file name the Transparency rule already uses for §Path Transparency — `settings.local.json` / `CLAUDE.md` / `~/.claude/CLAUDE.md`. |

Rules the field inherits from the existing `cli_flags` contract (`skills/harness/SKILL.md` §Step
1 item 10.5's note): written at Setup, read elsewhere, never re-derived. That note's example list
(`epic`, `cold_pass` and `fast`) is extended to name `cold_pass_source` in the same commit, so the
new field cannot be misread as audit-only like `output_dir`. `/harness-build` never
re-reads the defaults line; a state file written before this field existed reads it as `null`
(additive-optional, no `version` bump — Orchestrator Contract).

`workflows/_reference/state_fields.md` is a 5-column table, so the same field is written there in
that shape: Type `string | null`; Missing ⇒ default `null`; Written by `skills/harness/SKILL.md`
§Step 1 item 2 (the `cli_flags.cold_pass` write); Read by the §Step 7 cold-pass disabled display
and the §Session Boundary `Remaining` derivation in `skills/harness-build/SKILL.md`, and the
`Cold` row of `templates/harness/setup_summary.md`.

The value precedence is the resolution order above, so `--no-cold-pass` typed together with
`--fast` records `"flag"` (the user said it explicitly), and `--fast` on a repository whose line
says `cold-pass=off` records `"fast"` (the session-level statement outranks the standing one;
both would print a true sentence, `"fast"` is the one the user just typed).

### 3. One rendering rule, cited by name from three sites

`skills/harness-build/SKILL.md` §Step 7 — the existing "`--no-cold-pass` display" paragraph is
renamed **"cold-pass disabled display"** and becomes the single source of the literal:

| `cli_flags.cold_pass_source` | Rendered `<why>` |
|---|---|
| `"flag"` | `--no-cold-pass` |
| `"fast"` | `--fast` |
| `"default:<source>"` | `project default (<source>)` |
| `null` while `cold_pass == false` | `source not recorded` — a state file from before this field existed; never guess between the two legacy writers |

The preamble line becomes `Cold review: disabled (<why>)`, printed under exactly the condition it
prints today (`cli_flags.cold_pass == false`, regardless of verdict — AC-28 unchanged).

- §Session Boundary `Remaining` derivation: the `cli_flags.cold_pass == false` branch renders
  `<why>` from the table above (cited by name), so `none (cold pass skipped — --fast)` and
  `none (cold pass skipped — project default (CLAUDE.md))` become possible. The priority order
  of the derivation (`cold_pass` first, then `cold_round == null`, then `has_git`, then `skipL1`)
  is unchanged.
- §Step 6 item 7: the parenthetical reason `"--no-cold-pass"` becomes "the §Step 7 rendering
  rule's `<why>`". No state write changes — `verify.cold_result` keeps its 6-value + `null`
  vocabulary (AC-16); the reason still is not persisted, exactly as today.

### 4. Setup Summary transparency

`templates/harness/setup_summary.md` gains one row, between `TypeCheck` and `Scope`:

```
  Cold      : <on | off>     ← when off, append "(<why>)" from the §Step 7 rendering rule
```

This is not optional: `project_defaults.md` §Transparency already requires every value consumed
from the line to be echoed in the Setup Summary with `(project default)`. A `cold-pass` key
without a Setup row would violate that contract on day one. The row also makes the `--fast`
implication visible at Setup for the first time.

### 5. What does not change

- `cli_flags.cold_pass` stays a plain boolean; the `epic` tri-state note in `state_fields.md` is
  still accurate.
- The three AC-28 gating points (`cold_dispatch_allowed`, §Step 6 item 7's entry check,
  `A.coldPass === true` in `workflows/harness.eval.workflow.js`) and the segment's `args` contract
  are untouched. This is a fourth *source* of the same boolean, not a fourth gating point.
- `verify.cold_result` / `cold_round` / `cold_counts` / `cold_review_path` — untouched.
- HARD GATEs #1–#3 and the Fast Gate — untouched. Nothing here can be reached from a file.
- The two `--no-cold-pass` mentions in `harness.eval.workflow.js` are comments describing the
  boolean's provenance; left as they are (no runtime change, no `check_workflow_syntax` risk).
  Optional follow-up: reword them to "cold_pass == false (flag, --fast or project default)".

## Files touched at implementation

| File | Change | Lint exposure |
|---|---|---|
| `templates/_shared/project_defaults.md` | keys-table row, resolution-order line, one Transparency sentence | `project-defaults` group: section anchor and token unchanged, 9 sites unchanged |
| `skills/harness/SKILL.md` §Step 1 items 2 and 10.5 | `--no-cold-pass` and `--fast` bullets record `cold_pass_source`; new resolution sentence citing `project_defaults.md`; item 10 already resolves the line — no second read; item 10.5's example list of non-audit-only `cli_flags` fields gains `cold_pass_source` (the writer/reader ledger itself stays `state_fields.md`) | +~0.6 KB on a file that is **already** past the figure `CHANGELOG.md` `[Unreleased]` quotes: it states `135,693 → 49,982 bytes`, and the file measures 50,660 B at `db13efd` (the figure was measured at `741d306`; the 678 B since then came from two commits — `aa4dab2` +37 B and `a3df2c9` +641 B). The CHANGELOG restatement names only the measuring commit (`50,660 bytes at db13efd`), never this per-commit attribution. Restate the CHANGELOG figure in the same commit as this slice, with the commit it was measured at — do not leave two stale figures where there is one now |
| `templates/harness/state_schema.md` | additive-table row | none |
| `workflows/_reference/state_fields.md` | 5-column row (Type / Read by included, per §2) + one line in the notes block | `anchor-heading` mode does not cover this file; none |
| `templates/harness/setup_summary.md` | `Cold` row | none |
| `skills/harness-build/SKILL.md` §Step 7, §Session Boundary, §Step 6 item 7 | rendering rule + two citations | `harness-steps` mode: no new `§Step` ids, no new cross-file anchors; +~0.5 KB |
| `templates/_shared/run_style.md` | one line under the `--no-cold-pass` row noting the standing form | none |
| `README.md` flags table, defaults-line section; `CHANGELOG.md` `[Unreleased]` | document the key and the display fix | **root documents**: write no `§` citation directly after a `skills/harness*/SKILL.md` path, or `verify_sync_markers.py` docstring item 3's dated tallies move (see `PROBE.md` second probe and the memory note's `importlib` re-count method) |

Not touched: `workflows/harness.eval.workflow.js` (runtime), the nine other skills' defaults-line
markers, `scripts/`.

## Acceptance criteria

- [ ] All six lints + wiring exit 0; `project-defaults` still reports 9 sites; description budget
      total unchanged (no frontmatter edit).
- [ ] `grep -n 'Cold review: disabled (--no-cold-pass)' skills/harness-build/SKILL.md` → 0 hits;
      the literal `--no-cold-pass` survives in that file only inside the rendering table's
      `"flag"` row and in prose naming the flag as a CLI flag, never as a rendered reason value.
- [ ] `grep -nF 'reason `"--no-cold-pass"`' skills/harness-build/SKILL.md` → 0 hits — §Step 6
      item 7's parenthetical reason now cites the §Step 7 rendering rule's `<why>`. This prose is
      never rendered, so it is the one site no live probe can catch; the `Remaining` site needs no
      grep of its own because live probes A and B pin it end to end.
- [ ] `grep -c cold_pass_source` ≥ 1 in each of: `skills/harness/SKILL.md`,
      `skills/harness-build/SKILL.md`, `templates/harness/state_schema.md`,
      `workflows/_reference/state_fields.md`, `templates/harness/setup_summary.md`.
- [ ] Root-document path-anchored `§` tallies unchanged before/after (`verify_sync_markers.py`
      docstring item 3 figures: harness 42 / harness-gate 2 / harness-build 7; sub-path 7).
- [ ] Live probe A — `/harness --fast "<task>"` on this repository: Setup Summary shows
      `Cold : off (--fast)`; Step 7 prints `Cold review: disabled (--fast)`; Type B block prints
      `Remaining : none (cold pass skipped — --fast)` on a PASS.
- [ ] Live probe B — `.claude/settings.local.json` `env.AGENT_HARNESS_DEFAULTS = "cold-pass=off"`
      (source 1, so the team `CLAUDE.md` line is shadowed wholesale — its `lint-cmd` is then NOT
      consumed; expect `Lint : none` unless `--lint-cmd` is passed, and say so in the probe
      record) and plain `/harness "<task>"`: `Cold : off (project default (settings.local.json))`
      at Setup; the same `<why>` at Step 7 and in `Remaining`.
- [ ] Live probe C — `cold-pass=maybe` on the line: one warning in `user_lang`, cold pass on,
      `cold_pass_source == null`.
- [ ] Resume of a state file lacking `cold_pass_source` with `cold_pass == false`: Step 7 prints
      `Cold review: disabled (source not recorded)`; nothing else changes.

## Edge cases

- **Wholesale precedence bites probe B.** Source 1 shadows source 2 entirely, so a personal
  `cold-pass=off` in `settings.local.json` silently drops the team `lint-cmd`. That is the
  documented rule, not a defect of this slice — but it is the first time a key someone would
  plausibly set personally coexists with a key the team sets. Disclose it in the README row.
- **`cold-pass=on` + `--fast`** → off, `"fast"`. `on` is documentation, never an override.
- **`cold-pass=off` + `--no-cold-pass`** → off, `"flag"` (session input wins, and the more
  specific statement is the one rendered).
- **`/harness-build` typed on a session whose defaults line changed since Setup** → the recorded
  `cold_pass` / `cold_pass_source` stand; the line is read at Setup only. Same rule as `lint_cmd`.
- **Headless / non-interactive** → no new question is introduced anywhere; the key only removes
  a flag from the command line.

## Out of scope, recorded

- `plan-critic=off` or any key touching Step 2.6, the Fast Gate, HARD GATEs, retry ceilings.
- Per-round or per-path cold-pass control (`cold-pass=inline-only`) — no measured need.
- Rewriting the segment's comments (`harness.eval.workflow.js`) — optional follow-up above.
