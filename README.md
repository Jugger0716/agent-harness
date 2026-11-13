# Agent Harness

[![lint](https://github.com/Jugger0716/agent-harness/actions/workflows/lint.yml/badge.svg)](https://github.com/Jugger0716/agent-harness/actions/workflows/lint.yml)

**Zero-setup, zero-dependency** multi-agent workflow harness for Claude Code with **3-layer quality gates** and **selectable single-agent or multi-agent persona mode**. Works for development tasks and non-development tasks (planning, document generation, analysis) alike.

No dependencies required. No Python, no pip, no build steps — just install the plugin and go.

Inspired by Anthropic's [Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

> Demo GIF coming soon — see [ROADMAP.md](ROADMAP.md) for shipped releases and the deferred/planned items.

## At a Glance

### Before / After

**Without agent-harness:** You write a prompt, Claude implements changes, you run tests manually, find regressions, prompt again. No structured retry, no isolation, no audit trail.

**With agent-harness:**
```
/harness --mode standard "add rate limiting to the API"
```
→ Two specialists (Architect + Senior Dev) propose plans independently (native Workflow fan-out)  
→ Synthesis produces `spec.md`; a converge loop reviews it, applies consistency fixes and re-reviews  
→ One approval question in the same session (a decision question first, only if the loop found a Critical/Major choice or a fix it could no longer apply — accept every recommended option at once or review them one by one; Minor choices with a recommended option take it and are listed for you to change) — you choose `Build now`  
→ `/harness-build` takes over in the same turn: Lead Dev + Advisor implement code, write `changes.md`  
→ Layer 1: build ✓ test 42/42 ✓ lint 0e/2w ✓ (auto-retry on fail, up to 3x)  
→ Layer 2 + 3: isolated LLM evaluator reviews against spec, produces `qa_report.md`  
→ PASS → you choose commit / no-commit

One typed message. With `--separate-gate` the session instead ends at `plan_done` with
`Next → /harness-gate`: you type `/harness-gate` (a skill with no write tool), answer
`Proceed as single`, and type the `/harness-build` it prints.

### Terminal Output Sample

```
[harness] Task started!
  Directory : /workspace/my-api
  Branch    : harness/add-rate-limiting-to-the-api
  Mode      : standard
  Model     : balanced
  Verifier  : haiku
  Style     : auto
  Gate      : inline
  Language  : typescript
  Test      : npm test
  Build     : npm run build
  Lint      : npm run lint
  TypeCheck : npx tsc --noEmit
  Scope     : (no limit)
  Output    : docs/harness/add-rate-limiting-to-the-api/

[harness] Plan complete.
Converge: converged — runs 1, rounds 2
  ✓ [L1] AC-3 cited a config key the spec never defines — corrected
Rejected: 1
Residual: C=0 M=0 m=1

  ← approval question, same session: you choose "Build now"

[harness] Approved — chaining into /harness-build.
[harness] Phase: Verify (Layer 1 — Mechanical)
[harness] Verify (Layer 1) complete.
  Result : PASS — build ✓, test 42/42 ✓, lint 0e/2w, scan 0 TODO

[harness] ✓ QA PASS — task complete.
```

### Token Cost vs. Quality

| Mode | Best for | Token cost | First-pass success rate |
|------|----------|------------|------------------------|
| **single** | Small fixes, quick iterations | Baseline | ~60% *(estimated)* |
| **standard** | General features, API changes | ~1.5x baseline *(estimated)* | ~80% *(estimated)* |
| **multi** | Complex features, architecture | ~2-2.5x baseline *(estimated)* | ~90% *(estimated)* |

Higher modes cost more per run but save total cost by reducing retry rounds. Standard is recommended for most tasks.

> *(estimated)*: Figures are estimates based on internal dogfooding. A measurement benchmark harness is planned for a future release.

**Fixed orchestrator overhead.** The multipliers above are relative to a baseline that is not
zero: before any planning happens, `/harness`'s own contract document is loaded. It is the
largest skill in this repository, so it is the honest floor for what the orchestrator costs
you. Measured on **2026-08-31** at commit **`9023897c4c59632cea884afca98beb1cc88f4496`**:

| Basis | Value | Command |
|-------|-------|---------|
| LF bytes, **index blob** (what is committed) | **211,235 B** | `git cat-file -p HEAD:skills/harness/SKILL.md \| wc -c` |
| UTF-8 **characters** | **207,239** | `python -c "print(len(open('skills/harness/SKILL.md',encoding='utf-8').read()))"` |
| Bytes, **working tree** | **211,235 B** on a checkout made from this release onward (LF — identical to the index blob); **213,743 B** on an older one, where the file is still CRLF | `wc -c skills/harness/SKILL.md` |
| Lines | **2,508** | `git cat-file -p HEAD:skills/harness/SKILL.md \| wc -l` |
| EOL attributes | three space-padded status fields followed by a single tab and the path: `i/lf`, then a **middle** field that depends on when you cloned — `w/lf` from this release onward, `w/crlf` on an older checkout — then `attr/text eol=lf` (empty at the basis commit) | `git ls-files --eol skills/harness/SKILL.md` |

Three of these rows hold at that commit for **every** clone — the index-blob byte count, the
character count and the line count, all three of which read the committed blob rather than the
file on disk. **The other two — the working-tree byte row and the EOL row — describe a checkout
instead of a commit**, because `*.md text eol=lf` did not exist at `9023897`; it lands in this
release, so at the basis commit the `attr/` column was empty and the working tree was CRLF.
(Rows are named rather than numbered here on purpose: an earlier revision counted positions and
put the working-tree row among the commit-fixed three and the line count among the two that
depend on the clone. Both were wrong, in opposite directions.)

Bytes and characters differ because the file contains typographic characters. Index and working
tree differ on a Windows checkout made with `core.autocrlf=true` and no attribute: there the file
is CRLF and measures **213,743 B**, exactly 2,508 bytes more, one carriage return per line. This
release adds `*.md text eol=lf` to `.gitattributes`, and a file attribute outranks
`core.autocrlf`, so a checkout made from here on gets LF and its working tree matches its index
blob. **The two working-tree figures above therefore describe different clones, not different files**
— the index, character and line figures are the ones that hold for everyone. Quote the row that
matches what you are measuring; they are not interchangeable.

> This table is a **snapshot**, not a live figure. Every edit to that file changes it, and
> re-running the five commands above is the only trustworthy source. Do not cite these numbers
> without the commit SHA and the date.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Harness** | `/harness <task>` | Entry point of the 3-Phase (Planner -> Generator -> Evaluator) pipeline: Setup, Convention Scan, Plan, then a Plan Critic converge loop over `spec.md`; every session ends at `plan_done`, where by default HARD GATE #1 is one in-session approval question whose approval chains into `/harness-build` in the same turn (`--separate-gate`: `Next → /harness-gate` instead). Inline single path by default; opt-in workflow path (ultracode or `--mode standard/multi`) runs plugin-shipped native Workflow segment scripts with schema-validated returns. Works with or without git. `/harness doctor` gives a read-only environment diagnostic. |
| **Harness gate** | `/harness-gate` | HARD GATE #1 (spec confirmation) for a `--separate-gate` / `gate=separate` session, as its own skill with `Bash`, `Write`, `Edit`, `Glob` and every sub-agent tool removed — the turn that renders the gate cannot modify a file or run a command. It reads `state.json` and `spec.md`, asks once, and prints the next command for you to type (`/harness-build`, `/harness-build --epic`, or a `/harness --modify` / `--auto-revise` / `--critic` re-entry). Writes nothing. An inline session (the default) gets one line sending it back to `/harness`. |
| **Harness build** | `/harness-build [--epic \| generate \| verify \| evaluate]` | The implementation half: Slice Plan / Epic Exit, Generate, Verify (Layer 1), Evaluate (Layer 2+3), Verdict loop, Cleanup. Performs the `generate_ready` write on entry; consumes only a `spec.md` HARD GATE #1 approved — an inline session's recorded approval must still match `spec.md`, or it refuses. In an in-session epic it also starts the slices one after another — each still asks for its own approval, and a slice that ends clean is committed without asking ([Epic Slices](#epic-slices)). Not an entry point. |
| **Handoff** | `/handoff generate/resume/list` | Session handoff for cross-session continuity: `generate` captures a verified HANDOFF document (git state, confirmed facts, next steps, reading order, an optional epic Progress Ledger) and writes it immediately — no save confirmation, because the filename convention never overwrites (`-2`/`-3` on collision); `resume` primes a fresh session from it with git-drift verification plus a live `.harness/state.json` cross-check (both report-only — never mutates git or `.harness/`). Complements `/harness` Session Recovery (task-internal state); `/harness` recommends `/handoff generate` at every session boundary. |
| **Deep Review** | `/deep-review <target>` | Systematic, bias-free code review. Quick (inline checklist) or deep/thorough (2-3 specialists + adversarial cross-verification, native Workflow path). Optional `--comment` (inline PR comments) / `--fix` (gated apply) / `--spec <path>` (opt-in spec-conformance pass, reviewers stay blind to it). Re-runs on the same target auto-advance review rounds with prior-finding reconciliation and an advisory Round Verdict. |
| **MD Optimize** | `/md-optimize` | Optimize CLAUDE.md and project `.md` files for token efficiency. |

### Skill Naming & Built-in Command Relationship

`/deep-review` and `/harness` once carried other names — the first collided with the built-in `/code-review`, the second with the native Workflow engine's own command. v9 removed the forwarding aliases that kept the old names working. The built-in `/code-review` is a different command and is unaffected.

**Relationship to the native Workflow engine (`/ultracode`):** agent-harness does **not** compete with the engine — at opt-in depth (an ultracode session, or an explicit `--mode`) the multi-agent skills *author and run* native Workflow segment scripts (`${CLAUDE_PLUGIN_ROOT}/workflows/<skill>.<segment>.workflow.js`, copied to `.harness/wf/` immediately before each launch and deleted once that run finishes, because the `Workflow` tool accepts a `scriptPath` only when it returned that path itself or the file sits under the working directory or an added directory — `templates/_shared/segment_launch.md`), layering their opinionated phased methodology, auto-detection, and human-in-the-loop HARD-GATEs on top of the engine's `parallel()` / `phase()` / `runId`-resume primitives. The HARD-GATEs (spec-confirm, verify-fail, auto-fix-apply) always stay in the orchestrator and are never delegated to a background Workflow agent.

### Repository Layout

Eight top-level directories, each with a fixed role:

| Directory | Role |
|-----------|------|
| `skills/<name>/SKILL.md` | The skill definition — orchestrator prompt, Mode Gate resolution, HARD-GATEs, and (for stateful skills) the phase state machine. Claude Code auto-discovers a skill from this file's presence alone. |
| `workflows/<skill>.<segment>.workflow.js` | Native Workflow engine segment scripts — the code that actually runs when a skill's deep/thorough/multi mode is opt-in. Filename pattern is fixed: `<skill>.<segment>.workflow.js`, 1:1 with the basename at the SKILL.md `Workflow { scriptPath: ... }` call site (which names the `.harness/wf/` copy — `templates/_shared/segment_launch.md`). |
| `templates/<skill>/<role>.md` | Sub-agent persona templates a segment script copies in at author-time (`SYNC-SOURCE: templates/<skill>/<role>.md` comments mark the embedded copy). Some are DUAL-USE (the same file also dispatches as-is on a skill's inline path). `templates/_shared/` holds the cross-skill single sources instead — `mode_gate.md`, `segment_launch.md`, `status_format.md`, `project_defaults.md`, `session_conflict.md`, `orchestrator_contract.md`, `output_language.md`, `session_recovery.md`, `session_boundary.md`, `run_style.md`, `scale_assessment.md`, `path_validator.md`, `architecture_principles.md` and the rest; a skill cites one by name and never restates its body. `templates/harness/` is the same idea for one skill: procedures and static payloads `/harness` reads on demand (`doctor.md`, `state_schema.md`, `setup_summary.md`, `setup_prompts.md`, `auto_revise.md`, `spec_render.md`, `plan_segment_call.md`, `plan_critic_dispatch.md`, `plan_critic_failures.md`, `converge.md`), plus the converge loop's two sub-agent templates (`converge_review.md`, `converge_verify.md`). |
| `scripts/*.{mjs,py}` | Repository self-verification lints (`check_workflow_syntax.mjs`, `verify_block_sync.py`, `verify_description_budget.py`, `verify_git_safety.py`, `verify_manifest_sync.py`, `verify_meta_literal.py`, `verify_sync_markers.py`) — they check this repo's own `workflows/`/`skills/`/`templates/`/`.claude-plugin/` source, and are never executed at skill runtime. |
| `tests/segment_stubs/` | Behavioural tests for the Workflow segment scripts, run against a stub engine (no model, no network). `known_failures.json` is a two-way ratchet: an unlisted failure fails the run, and so does a listed case that starts passing. |
| `.claude-plugin/*.json` | Plugin and marketplace manifests. The version string lives at three key paths across these two files. |
| `.github/` | CI: `workflows/lint.yml` runs the lint layer on push and PR; `scripts/check_lint_wiring.sh` checks that every lint is actually wired into it. Also holds the issue and PR templates. |
| `design/<epic>/` | Committed design records for a follow-up epic — the spec plus the measurements it rests on. Skill *runtime* output goes to `docs/`, which is `.gitignore`d; anything that must outlive the session that produced it lives here instead. Nothing at skill runtime reads this directory, and no lint scans it. |

## Install

```bash
claude plugin marketplace add Jugger0716/agent-harness
claude plugin install agent-harness@agent-harness-marketplace
```

## Your First Task in 5 Minutes

This is one complete run, start to finish, in a fresh repository — every prompt you will
actually see, in the order you will see it. **Quick Start below is a command catalogue**;
this section is the single walkthrough. Read this one first, then use Quick Start as the
reference you come back to.

**Setup — a scratch repository, so nothing you care about is in scope:**

```bash
mkdir harness-demo && cd harness-demo && git init
echo "# harness-demo" > README.md && git add README.md && git commit -m "init"
```

**Run:**

```
/harness --mode single "add a greet(name) function that returns 'Hello, <name>!' with a test"
```

`--mode single` forces the inline path — one orchestrator, no sub-agent fan-out, no Workflow
engine. It is the cheapest path and the right one for a first run. (Without a `--mode` flag
the Mode Gate decides, and in an interactive session with the engine available it may ask you
inline-vs-workflow first.)

**What you will be asked, in order:**

1. **`Model`** — `default` / `frontier` / `balanced (Recommended)` / `economy`. Pick
   **balanced**. This chooses which model plays executor, advisor and evaluator; it does not
   change the steps. (`default` inherits the parent model and changes nothing.)
2. **`Convention Scan`** — `Scan` / `Skip`. A fresh repo has no `CLAUDE.md`, so you are asked
   whether to scan for existing conventions. Pick **Skip** for the demo — there is nothing to
   find yet.
3. **`Approval` — HARD GATE #1, spec approval.** The planner writes
   `docs/harness/<slug>/spec.md`; the Plan Critic converge loop reviews it, applies consistency
   and wiring corrections on its own, and re-reviews (if it finds a genuine design choice, it asks
   you that first, in a question of its own — Critical/Major ones together in one question, Minor
   ones with a recommended option taking it unasked). The same session then prints a summary —
   what the loop applied, rejected, took by default and left open — and asks one question: **`Build now`** to implement the
   spec as one slice, `Plan as epic` to split the work into slices that then run one after
   another, each asking for its own approval once (a slice is a new session, so the Setup
   questions an `agent-harness-defaults` line and a rich `CLAUDE.md` do not answer come back —
   in this fresh repo, Model, the Mode Gate question and Convention Scan)
   ([Epic Slices](#epic-slices)), `Modify` to describe a change
   (the spec is edited, re-reviewed and the question comes back), or `Stop`. Choose
   **`Build now`**. Only choosing one of the first two labels approves; typed text never does.
   **This is the one gate a successful run always shows you.**

Then `/harness-build` takes over in the same turn: it implements, runs mechanical verification,
and runs the evaluator review. On a clean run there is nothing more to answer — you get a summary
and the artifacts under `docs/harness/<slug>/`.

**The other two HARD-GATEs only appear when something fails**, which is the point of them:

- **HARD GATE #2 — `Verify`.** Renders only after mechanical verification (build/test/lint)
  has failed three times: `Auto-fix proposal` / `Continue to Evaluator` / `Stop`.
- **HARD GATE #3 — the auto-fix apply gate.** Renders only if you chose `Auto-fix proposal`
  above, and asks before the patch touches your files.

So a green run answers **one** gate and types **one** command; a run that hits trouble
answers up to three gates. **No file you wrote is touched before gate #1** — but the run is not
inert before it either: Step 1 creates `.harness/`, switches to a `harness/<slug>` branch, and the
planner writes the spec document, all before the gate renders. What waits for a gate is *your*
code: implementation starts only after gate #1, and no auto-fix patch is applied before gate #3.
Gate #1's approval is a recorded click that `/harness-build` checks against the spec before it
starts — a checked rule, not a structural one: the turn that shows you the question can write.
For the structural form, start with `--separate-gate`: the session then ends at `plan_done`, you
type `/harness-gate` — a separate skill that holds no `Bash`, `Write` or `Edit`, so nothing can be
implemented in the turn the spec is shown to you — and then the `/harness-build` it prints, three
commands in all. (There the option reads `Proceed` on the inline path `--mode single` selects,
with no scale recommendation to lead with, and `Proceed as single` on the workflow path.)

**If you stop partway**, run the skill that owns the phase you stopped in, with no arguments, in
the same repository — `/harness` up to `plan_done`, `/harness-build` after it; each reads
`.harness/state.json`, re-enters at the step you left, and names the other skill if the phase is
not its own. `/harness doctor` gives a read-only environment diagnostic and never touches that state.

## Quick Start

```
/harness fix login timeout bug                    # default: inline single path (no mode roundtrip); asks model config
/harness fix login timeout bug --mode single      # fast, token-saving (inline, forced)
/harness fix login timeout bug --mode standard    # workflow path: 2-specialist fan-out via native Workflow scripts
/harness fix login timeout bug --mode multi       # workflow path: 3-specialist fan-out, deepest analysis
/harness fix bug --model-config balanced          # Sonnet executor + Opus advisor (cost-efficient)
/harness fix bug --model-config frontier          # Sonnet executor + Fable evaluator (top-model judgment)

/harness plan "add user auth"                     # phase mode: plan + in-session approval, then stop at plan_done (Resume /harness-build; no same-turn chain)
/harness fix bug --separate-gate                  # end at plan_done with Next → /harness-gate (the tool-less gate) instead of approving in-session
/harness-gate                                     # separate-gate sessions only — HARD GATE #1: shows spec.md, prints the next command, writes nothing
/harness-build                                    # implementation half: Generate -> Verify -> Evaluate -> Cleanup (an in-session approval chains into it)
/harness-build --epic                             # Slice Plan + Epic Exit instead of implementing (what "Plan as epic" runs); in-session, the first slice then starts
/harness --output-dir docs/harness/<epic> "slice-b-…"  # a slice's Command from slice_plan.md — run it by hand after a stop (see Epic Slices)
/harness-build generate                           # phase mode: resume from plan, generate only
/harness-build verify                             # step mode: mechanical verification only
/harness-build evaluate                           # step mode: evaluation only
/harness --modify "<request>"                     # re-entry at plan_done: /harness edits spec.md and re-runs the converge loop (not when the critic was skipped by --fast); the approval question re-renders (separate-gate: Next → /harness-gate)

/harness draft product requirements spec           # works without git too (non-dev tasks)

/handoff                                           # capture this session -> HANDOFF document (written immediately)
/handoff resume                                    # prime a fresh session from the newest handoff (+ git drift check)

/harness doctor                                    # read-only environment diagnostic

/deep-review #123                                  # review PR (quick inline by default; ultracode -> thorough)
/deep-review feature/auth --mode deep              # workflow path: 2 specialists + synthesis
/deep-review --staged --mode quick                 # review staged changes, quick inline
/deep-review #123 --comment                        # post critical/major findings as inline PR comments (confirmed)
/deep-review --staged --fix                        # apply suggested fixes behind an explicit gate
/deep-review #123                                  # run again after fixes -> round N+1 auto-detected, prior findings reconciled

/md-optimize                                       # optimize markdown files
```

## Model Configuration (Advisor Strategy)

Inspired by Anthropic's [Advisor Strategy](https://claude.com/blog/the-advisor-strategy), sub-agents can run on different models to optimize cost vs. quality. Select a preset at startup or via `--model-config`:

| Preset | Executor | Advisor | Evaluator | Verifier | Use case |
|--------|----------|---------|-----------|----------|----------|
| **default** | (parent) | (parent) | (parent) | Haiku | No change, inherit parent model |
| **all-opus** | Opus | Opus | Opus | Haiku | Maximum quality (flag/`Other` only — not in the interactive picker) |
| **frontier** | Sonnet | Opus | Fable | Haiku | Top-model judgment — Fable evaluates, Sonnet executes |
| **balanced** | Sonnet | Opus | Opus | Haiku | Recommended — cost-efficient with quality judgment |
| **economy** | Haiku | Sonnet | Sonnet | Haiku | Maximum savings, basic quality |

> **Verifier defaults to Haiku** — Layer 1 Mechanical Verification only executes commands and parses exit codes. Override with `--verifier-model sonnet|opus` for sensitive mechanical verification (e.g., concurrency failures, complex test diagnostics). Not recommended for routine use — Haiku is sufficient in the vast majority of cases.

> **Deprecation safety:** if a preset cell's model is no longer available (model sunset), the dispatch downgrades step-by-step along `fable → opus → sonnet → haiku → parent inherit` with a once-per-session warning and a visible echo of the actually-used model — presets (and persistent `model-config` project defaults) keep working across model generations.

**Role mapping across all skills:**
- **Executor**: bulk work — analysis, code generation, proposals (cheaper model OK)
- **Advisor**: high-level judgment — plan review, safety checks (quality model needed)
- **Evaluator**: independent verification — always protected (never haiku)

Works with: harness, refactor, migrate, debug, spec, test-gen, deep-review, codebase-audit. Presets are selected via numbered UI (AskUserQuestion) with `Other` for custom role mapping. The interactive picker holds 4 presets (default / frontier / balanced / economy — AskUserQuestion limit); `all-opus` stays available via `--model-config all-opus` or `Other`. Judgment-type sub-agents (cross-verification, critic, evaluator) map to the evaluator role — pre-8.7 presets keep identical advisor/evaluator cells, so only `frontier` differentiates them.

### Project Defaults (persistent opt-in)

Declare standing defaults ONCE and skip the per-session rituals (single source: `templates/_shared/project_defaults.md`). The defaults line:

```
agent-harness-defaults: path=workflow, model-config=frontier, verifier-model=haiku
```

can live in three places — the first source that declares it wins wholesale:

1. **`.claude/settings.local.json`** → `"env": { "AGENT_HARNESS_DEFAULTS": "path=workflow, model-config=frontier" }` — personal, per-project, NOT committed. **Recommended when the project CLAUDE.md is team-shared** (your preferences never leak into teammates' sessions).
2. **Project root `CLAUDE.md`** — one line anywhere. Committed; use only for genuinely team-agreed defaults.
3. **`~/.claude/CLAUDE.md`** — personal machine-wide fallback for all projects.

- `path=workflow` is a standing opt-in — the Mode Gate resolves the workflow path at the skill's ultracode-target tier without ultracode or `--mode` (§Path Transparency reason: `project default (<source>)`); `path=inline` pins the inline path.
- `model-config=<preset>` replaces the interactive model picker when no `--model-config` flag is given (echoed as `(project default)` in the Setup Summary). Without a flag AND without a defaults line, behavior is unchanged: skills that dispatch sub-agents ask via AskUserQuestion (exception: test-gen has no picker — it silently uses the `default` preset).
- **`lint-cmd`** / **`type-check-cmd`** — a shell command, wrapped in backticks on the defaults line (e.g. ``lint-cmd=`npm run lint && npm run typecheck` ``) — consumed by `/harness` when the flag is absent, and BEFORE auto-detection, so a repository whose lint lives only in its own docs (this one: seven commands in `CLAUDE.md`, matching no detection row) still gets a real Layer 1. The backticks are what let `&&`, commas and `=` inside the command survive the `key=value` parse; the value is echoed `(project default)` in the Setup Summary. Skills that do not consume a key ignore it silently.
- **`gate=inline|separate`** (`/harness` only) — standing default for where HARD GATE #1 renders. The default is `inline`: `/harness` asks for approval in the same session (one label click) and chains into `/harness-build`. `gate=separate` behaves like `--separate-gate`: the session ends at `plan_done` with `Next → /harness-gate`, the tool-less gate whose turn can write nothing. Resolution order: `--fast` (always inline; `--fast` with `--separate-gate` halts) > `--separate-gate` > project default `gate=` > inline. Echoed in the Setup Summary `Gate` row. A slice `Command` never carries `--separate-gate`, so this key is how an epic's slices stay separate.
- **`cold-pass=on|off`** (`/harness` only) — standing default for the cold-review pass. Resolution order: `--no-cold-pass` > `--fast` > project default `cold-pass=off` > `on`. Echoed in the Setup Summary `Cold` row; when off via this key, that row's `(<why>)` reads `project default (<source>)`.
- Session input always wins: explicit flags override the line, `--mode single/quick` still forces inline, and invalid values warn once and are ignored (never a halt).

## Interactive UX

All user-facing prompts use **AskUserQuestion** — a numbered selection UI where you pick by number instead of typing keywords. Every prompt includes descriptive options and an automatic `Other` option for free text input.

Key interaction points:
- **Mode selection** (refactor/migrate/debug/spec — `/harness` derives mode via its Mode Gate, no roundtrip): numbered options with token cost hints and auto-recommendation
- **Execution-path ambiguity prompt** (no `--mode` + ultracode OFF + interactive session with the Workflow engine available): explicit inline-vs-workflow choice instead of silent auto-resolution — and every run prints `Path : <inline|workflow> (<reason>)` so the chosen path and its cause are always visible
- **Confirmation gates**: HARD GATE #1 renders in `/harness` itself by default — one `Approval` question, `Build now` / `Plan as epic` / `Modify` / `Stop` (`--fast` and an epic's slices: no `Plan as epic`); only the first two labels approve, and an approval chains into `/harness-build`. With `--separate-gate` it is its own skill, `/harness-gate` — `Proceed as single` (plain `Proceed` when there is no scale recommendation) / `Plan as epic` / `Modify` / `Stop`, plus critic-status options on its first pass when they apply; it prints the next command instead of proceeding. Neither accepts freeform text as approval
- **Converge decisions** (`/harness`, settled once per session, before the approval): Minor decisions take their recommended option without a question and are listed in the summary (`Modify` changes one); Critical/Major ones come as one `Decisions` question — `Accept all recommended (N)` / `Review individually` (then one question per decision, up to 4 per call). A finding whose automatic fix could not be applied is asked with no recommendation — `Specify the fix` (answer with Other) / `Ignore and proceed`
- **QA retry**: Fix / Accept as-is
- **Commit**: 3 options — "Commit code only" (recommended) / "Commit all with artifacts" / "No commit" (git environments only; non-git environments skip commit). A slice that ends clean in an in-session epic is the one exception: it applies "Commit code only" without asking, on the strength of that slice's `Build now` ([Epic Slices](#epic-slices))
- **Session recovery**: Resume / Restart / Stop — `/harness` and `/harness-build` add a 4th, non-destructive **View state only** (prints the recorded session state and halts; `.harness/` is NOT deleted); `/harness-gate` offers none of these (it cannot delete anything — it redirects to the owner skill instead). The other skills sharing this gate shape keep the 3 options

Falls back to text-based input when AskUserQuestion is unavailable — except `/harness`'s spec approval and its converge decision question, which have no text fallback: without AskUserQuestion (or with `--no-prompt`) `/harness` records no approval and stops at `plan_done`, printing an escape line (a new session with `--separate-gate`, whose `/harness-gate` you answer instead).

---

## workflow

**Thin Orchestrator** architecture — the orchestrator manages state transitions and dispatches sub-agents with minimal context (~8-15K tokens). Sub-agents return 1-line summaries; detailed results are written to files. This achieves **40-60% token savings** compared to fat orchestrator designs while maintaining quality through **3-layer mechanical quality gates**.

```
/harness  -> [Setup] Auto-detect + Mode Gate (inline vs workflow path) + style
                        -> [Plan] Planner
                           single (inline):     1 agent explores + writes spec.md
                           standard (workflow): harness.plan script — 2 specialists propose -> Synthesis
                           multi (workflow):    harness.plan script — 3 specialists propose -> Synthesis
                        -> Plan Critic converge loop (review -> verify/classify -> apply, up to 5 rounds;
                           one decision question if it finds a Critical/Major choice or an
                           unapplicable fix; Minor choices with a recommendation take it,
                           listed for Modify)
                        -> session ends at plan_done with the Confirmation Gate (HARD GATE #1):
                           default (inline) — summary + one approval question in this session
                             (Build now / Plan as epic / Modify / Stop); an approval is recorded
                             against the spec's stamp and chains into /harness-build, same turn
                           --separate-gate — "Next → /harness-gate"; you type /harness-gate, a
                             skill with no Bash/Write/Edit: shows spec.md, asks once, prints ONE
                             command (/harness-build, /harness-build --epic, or a /harness re-entry)
── same turn after an approval (or the command you type after a stop / after /harness-gate) ──
/harness-build -> checks an inline session's recorded approval, writes phase → generate_ready
                        -> [Generate] Generator
                           single (inline):     1 agent implements code
                           standard (workflow): harness.build script — Lead Dev plan -> Combined Advisor -> Implementation
                           multi (workflow):    harness.build script — Lead Dev plan -> 2 Advisors parallel -> Implementation
                        -> [Verify] Layer 1 Mechanical (build/test/lint/type-check/TODO scan)
                           FAIL -> auto-retry Generator (max 3x)
                        -> [Evaluate] Layer 2 Structural + Layer 3 LLM Judgment (workflow: harness.eval script runs Verify+Evaluate in one segment)
                           L2 FAIL -> auto-retry (max 2x)
                           L3 FAIL -> user Fix/Accept (max N rounds)
                        -> PASS -> Cleanup & Commit
── "Plan as epic" instead (in-session, auto style: the chain below runs in the same turn) ──
/harness-build --epic -> Slice Plan (one boundary question) -> slice_plan.md -> Epic Exit
                        -> each row's Command: /harness --output-dir <epic dir> "<slice>"
                           -> approval (Build now / Modify / Stop) -> /harness-build
                           -> clean end: commit without asking -> next row; otherwise stop
```

Claude handles everything directly -- no external CLI, no wrapper scripts.

### Auto-Detection

The harness detects language, test, and build commands from your project files:

| Detected File | Language | Test Command | Build Command |
|--------------|----------|-------------|---------------|
| `build.gradle` / `build.gradle.kts` | Java/Kotlin | `./gradlew test` | `./gradlew build` |
| `pom.xml` | Java | `mvn test` | `mvn compile` |
| `pyproject.toml` / `setup.py` | Python | `pytest` | - |
| `package.json` | TypeScript/JavaScript | `npm test` | `npm run build` |
| `*.csproj` | C# | `dotnet test` | `dotnet build` |
| `go.mod` | Go | `go test ./...` | `go build ./...` |
| `Cargo.toml` | Rust | `cargo test` | `cargo build` |

Additionally, lint and type-check commands are auto-detected:

| Detected File / Config | Lint Command | Type-Check Command |
|------------------------|-------------|-------------------|
| `package.json` scripts.lint | `npm run lint` | — |
| `.eslintrc*` / `eslint.config.*` | `npx eslint .` | — |
| `tsconfig.json` | — | `npx tsc --noEmit` |
| `pyproject.toml` [tool.ruff] | `ruff check .` | — |
| `pyproject.toml` [tool.mypy] / `mypy.ini` | — | `mypy .` |
| `.golangci.yml` | `golangci-lint run` | — |
| `Cargo.toml` | `cargo clippy` | — |

Override with `--lint-cmd` or `--type-check-cmd` if auto-detection is inaccurate.

### How it works

1. You invoke the harness skill with a task description
2. **Setup**: Auto-detects language/test/build, detects your language, creates `.harness/state.json` and `docs/harness/<task-slug>/`, creates a `harness/*` git branch (skipped if not in a git repository)

#### Phase 1 -- Planner (Multi-Agent)

> **Standard mode** uses only the Architect and Senior Developer personas (no QA Specialist, no cross-critique). See the full mode comparison in the Token Cost table above.

Three specialist personas analyze the task **independently and in parallel**:

| Persona | Focus |
|---------|-------|
| **System Architect** | Structure, scalability, dependency management, long-term design |
| **Senior Developer** | Implementation feasibility, practical constraints, hidden complexity |
| **QA Specialist** | Failure modes, edge cases, boundary conditions, error handling |

After independent proposals, each specialist **cross-critiques** the other two proposals. The orchestrator then **synthesizes** all 6 documents (3 proposals + 3 critiques) into a single `spec.md` using majority-rule and evidence-based decision criteria.

**Why this works:** Independent proposals eliminate anchoring bias. Cross-critique surfaces disagreements. Synthesis preserves the strongest ideas from all perspectives.

4. **Confirmation Gate**: by default `/harness` renders it in the same session — the converge loop's summary and one approval question (`Build now` / `Plan as epic` / `Modify` / `Stop`). Only choosing `Build now` or `Plan as epic` approves; the approval is recorded once, bound to the spec's stamp, and `/harness` then invokes `/harness-build` in the same turn (when the style is `auto` and the session is interactive), whose entry check refuses a record that no longer matches `spec.md`. With `--separate-gate` (or `gate=separate`) the session ends at `plan_done` with `Next → /harness-gate` instead: you type `/harness-gate` — a separate skill holding no `Bash`, `Write`, `Edit` or `Glob` — which shows the spec, asks once, and prints the next command (`/harness-build`, `/harness-build --epic`, or a `/harness --modify` / `--auto-revise` / `--critic` re-entry). There nothing proceeds until you type that command; the turn boundary is the mechanism.

#### Phase 2 -- Generator (Lead + Advisors)

> **Standard mode** uses a single Combined Advisor (merged Code Quality + Test & Stability perspectives) instead of two separate advisors.

A single Lead Developer owns the implementation for code coherence, supported by an advisory panel:

| Persona | Role | Timing |
|---------|------|--------|
| **Lead Developer** | Creates implementation plan, then implements code | Sequential |
| **Code Quality Advisor** | Reviews plan for anti-patterns, SOLID violations, consistency | Before implementation |
| **Test & Stability Advisor** | Reviews plan for runtime risks, error handling gaps, test coverage | Before implementation |

The advisory review happens **before code is written**, catching issues when they're cheap to fix rather than expensive to rework.

#### Verify -- Mechanical Quality Gates (Layer 1)

After code generation, a mechanical verification step runs **before** the LLM evaluator:

| Check | Criteria | On Failure |
|-------|----------|-----------|
| **Build** | Exit code 0 | Stop, retry Generator |
| **Test** | All tests pass | Record failures, continue |
| **Lint** | No errors (warnings OK) | Record errors, continue |
| **Type Check** | Exit code 0 | Record errors, continue |
| **TODO/FIXME scan** | Completeness markers in changed files | Warning (configurable) |

If Layer 1 fails, the Generator is automatically retried up to 3 times with concrete error logs — no user intervention needed. This catches **50%+ of issues** without using LLM judgment.

#### Evaluate -- Structural + LLM Verification (Layer 2 + 3)

Runs as an isolated sub-agent with 2-layer evaluation:

**Layer 2 — Structural Verification** (narrow YES/NO checks):
- Each acceptance criterion: satisfied? `file:line` evidence required
- Each changed file: maps to a spec requirement? Unmapped = scope violation
- Test coverage per criterion, diff-based risk review (error handling, resource leaks, security)
- If any check fails → FAIL immediately, skip Layer 3, auto-retry up to 2 times

**Layer 3 — LLM Judgment** (only if Layer 2 passes):

Runs with research-backed bias reduction:

| Technique | Research Basis |
|-----------|---------------|
| **Context isolation** (separate subagent) | Agent-as-a-Judge (ICLR 2025): 90.44% human agreement vs 60.38% for inline evaluation |
| **Anchor-free input** (no Generator reasoning passed) | Anchoring bias research: LLMs anchor strongly to provided context |
| **Defect-assumption framing** ("assume defects, 2 pre-mortem hypotheses") | Pre-mortem (Brookings): reduces overconfidence |
| **Author neutralization** (no author identity disclosed) | PNAS 2025: LLMs favor LLM-generated content at 89% rate |
| **Risk-before-PASS** (identify key risks + verify with code evidence) | Confirmation bias: structural forced consideration of counterevidence |
| **Rubric decomposition** (5 criteria with inline sub-checks) | G-Eval, RocketEval: finer granularity reduces evaluation bias |

7. If Layer 1 FAIL → auto-retry Generator (max 3). If Layer 2 FAIL → auto-retry (max 2). If Layer 3 FAIL → user asked whether to fix (up to max rounds)

**Cold review** (4th pass, after Evaluate returns PASS): an independent reviewer
(`templates/evaluator/cold_reviewer.md`), orthogonal to the Evaluator, gets one automatic
feedback retry on a Critical/Major finding before falling through to PASS with disclosure.
Opt out with `--no-cold-pass`. See `skills/harness/SKILL.md` §Step 5/6/7 for the full state
contract (`verify.cold_result`, 6 values + `null`).

8. On completion, the user is asked whether to commit the artifacts — except a slice that ends clean in an in-session epic, which commits without asking and starts the next slice ([Epic Slices](#epic-slices))

### Token Cost vs. Quality Trade-off

| Mode | Best for | Token cost | Quality vs single |
|------|----------|------------|-------------------|
| **single** | Small bug fixes, simple features, quick iterations | Baseline | Baseline |
| **standard** | General features, API changes, moderate complexity | ~1.5x baseline | +60-70% |
| **multi** | Complex features, architectural changes, high-stakes code | ~2-2.5x baseline | +85-95% |

Higher modes use more tokens per run but have higher first-pass success rates, often reducing total cost by avoiding retry rounds. Standard mode is recommended for most tasks — it provides significant quality improvement at modest token cost.

> The **fixed orchestrator overhead** these multipliers sit on top of is measured once, in
> `### Token Cost vs. Quality` under `## At a Glance`. It is not repeated here.

### Execution Styles

| Style | Usage | Behavior |
|-------|-------|----------|
| **auto** (default) | `/harness "task"` (the approval chains into `/harness-build`) | Automatic progression: every `/harness` session ends at `plan_done`, where an in-session approval chains straight into `/harness-build` in the same turn when the session is interactive; `/harness-build` then runs Generate → Cleanup, gating at FAIL only. With `--separate-gate`: `/harness "task"` → `/harness-gate` → `/harness-build` |
| **phase** | `/harness plan "task"` → `/harness-build generate` | Each phase ends the session; resume in the next session for max token savings. The approval at `plan_done` is recorded but does not chain — the stop prints Resume `/harness-build`. With `--separate-gate`: `/harness plan "task"` → `/harness-gate` → `/harness-build generate` |
| **step** | `/harness-build verify` or `/harness-build evaluate` | Execute single step only |

### Options

| Option | Default | Description |
|--------|---------|-------------|
| mode | Mode Gate (no roundtrip) | `single` (inline, default without opt-in), `standard` / `multi` (workflow path via native Workflow segment scripts). Opt-in = ultracode session or explicit `--mode`; `has_git == false` or missing Workflow tool forces inline single. |
| model-config | project default → else ask | `default` / `all-opus` / `frontier` / `balanced` / `economy` — see Model Configuration section |
| scope | auto-detected | Restrict file modifications to a pattern |
| max rounds | 3 | Maximum Generator/Evaluator retry cycles |
| max files | 20 | Maximum number of files that can be modified |
| lint-cmd | auto-detected | Override lint command |
| type-check-cmd | auto-detected | Override type-check command |
| `--verifier-model <model>` | `haiku` | Override Layer 1 Verifier model. Allowed: `haiku`, `sonnet`, `opus`. Cost warning shown for sonnet/opus. |
| `--output-dir <path>` | `docs/harness` | Override output directory base for spec, changes, verify, and QA reports. Relative path from repo root. Disallows: absolute paths, `..`, reserved names (`memory`, `spec`, `planner`, `generator`). |
| `--epic` / `--no-epic` | Scale Assessment recommendation | `/harness` only — force the approval question to lead with "Plan as epic" / "Build now" (with `--separate-gate`, the gate's Pass B with "Plan as epic" / "Proceed as single"). Approving runs `/harness-build --epic` or `/harness-build`. |
| `--modify "<request>"` / `--auto-revise` / `--critic` | — | `/harness` only, `plan_done` only — the re-entries `/harness-gate` prints for "Modify" / "Auto-revise" / "Run Critic anyway", which you may also type in an inline session. `--critic` and `--modify` each run the Plan Critic converge loop again (after `--modify`'s edit, its first round reviews only what changed when the session's last run completed and spec.md had not changed since — no editor edit, no interrupted write — and the whole spec otherwise) — except that in a session whose critic was skipped by `--fast`, `--modify` only edits spec.md. Each ends at the gate again: an inline session's approval question re-renders in the same turn, a separate one ends with `Next → /harness-gate`. A recorded approval does not block them: it is bound to the spec's stamp, so after a spec.md write `/harness-build` refuses it until you approve again. |
| `--no-cold-pass` | cold pass on | `/harness` only — recorded as `cli_flags.cold_pass=false`; `/harness-build` Step 5 skips the cold-review dispatch. Standing form: `cold-pass=off` on the `agent-harness-defaults:` line — a documented rule, not a defect of this key: a personal `cold-pass=off` in source 1 (`.claude/settings.local.json`) shadows a team `CLAUDE.md` defaults line WHOLESALE, so that line's `lint-cmd` is then not consumed either (see Project Defaults below). |
| `--fast` / `--quick` | off | `/harness` only — the one-session shortcut for a small change. Forces the inline single path, skips the Plan Critic, the cold pass and the Model / Convention Scan questions; its approval question (header `Fast Gate`) has three options, `Build now` / `Modify` / `Stop`, with no `Plan as epic`. "Build now" records the approval and, when the style is `auto` and the session is interactive, chains into `/harness-build` in the same turn; `/harness-build` refuses the session without a matching approval, so the gate is moved, not removed. No text-fallback approval. Cannot be combined with `--epic`, `--separate-gate` or a workflow-tier `--mode`. |
| `--separate-gate` | off (project default `gate=`) | `/harness` only — HARD GATE #1 at `/harness-gate` instead of in-session: the session ends at `plan_done` with `Next → /harness-gate`, a skill with no write tool, and you type the command it prints. Recorded once per session (`gate=separate` on the defaults line sets it too). Halts with `--fast`. |
| `--no-prompt` | off | Non-interactive run: no Mode Gate ambiguity question (every multi-path skill). On `/harness` it also suppresses the decision question, the approval question, the approval record and the chain — the session stops at `plan_done` with the summary and any open decisions printed. Not stored; the next invocation without it is interactive again. |

Example: `/harness fix auth bug --mode single --model-config balanced`
Example: `/harness add caching --output-dir build/harness --verifier-model sonnet`

### Git-Free Mode

The workflow automatically detects whether the current directory is a git repository. When running outside a git repo (e.g., for planning data processing, document generation, or analysis tasks), git operations (branch creation, commits) are skipped entirely. All core phases (Planner → Generator → Evaluator) work identically. Artifacts are saved to `docs/harness/<slug>/`.

### Session Recovery

If a session is interrupted, run the skill that owns the phase you stopped in, with no arguments: `/harness` up to `plan_done`, `/harness-build` after it. Each detects the existing `.harness/state.json`, offers to resume from where you left off, and names the other skill if the phase is not its own. At `plan_done`, a resumed `/harness` chains (or stops) as recorded when an in-session approval still matches `spec.md`, and otherwise — if `spec.md` changed since its last review (a direct edit, an interrupted write or run) — re-reviews it in full before asking for approval again. `/harness-gate` reads only `plan_done` of a separate-gate session and redirects every other phase to its owner, and an inline session to `/harness`.

### Sub-command: doctor

`/harness doctor` — read-only environment diagnostic. No arguments, no `.harness/state.json` (neither read nor written), no git branch, no Mode Gate, no sub-agents, no Workflow dispatch; nothing is written anywhere. Five items, each `✓` or `⚠` with remediation decided at run time: ① CR contamination in the installed copies’ `*.workflow.js`, judged by counting the byte `0x0D` across both known install locations; ② whether the `Workflow` tool is in this session’s tool list, reported as observed and never probed; ③ `git rev-parse --is-inside-work-tree`; ④ version and content drift on three axes, enumerating the cache’s version directories and listing backup-suffixed ones (the predicate is the skill contract’s, not this file’s) separately rather than as drift; and ⑤ which of the three `agent-harness-defaults` sources wins, and the final resolved reading. It reports and never repairs — a `⚠` points at the existing route (a reinstall). Dispatch is by positional argument, not by position alone: `doctor` must be the **only** positional token, so `/harness --mode single doctor` is the same invocation while `/harness doctor xyz` is an ordinary task. Skips Session Recovery through a carve-out at the top of that section, so running it never disturbs an in-progress harness session.

### Confirmation Gates

The Generator phase consumes significant tokens and is hard to undo. The harness enforces **explicit user confirmation** before proceeding:

- **Spec approval**: by default rendered in `/harness` itself as one approval question. Only choosing `Build now` or `Plan as epic` counts — free text, a text-fallback reply or a non-interactive run never approves. The approval is a model-written record bound to the spec's stamp, and `/harness-build` refuses an inline session whose record no longer matches `spec.md` (an editor change that keeps the line count is not detected). That is a checked rule, not a structural one: implementation starts in the same turn as the approval. With `--separate-gate` it is rendered by `/harness-gate`, a separate skill with no `Bash`, `Write`, `Edit` or `Glob` — the turn that shows you the spec cannot touch a file; the gate prints the next command and you type it, so implementation cannot start in the same turn as the approval.
- **QA retry**: When the Evaluator reports FAIL, the harness asks the user before starting another round.

### Epic Slices

`Plan as epic` (or `/harness-build --epic`) splits an approved spec into slices instead of
implementing it: one boundary question decides the split, `slice_plan.md` is written to the
epic's `docs/harness/<epic>/`, and its `Command` column holds one ready-to-run command per
slice — `/harness --output-dir docs/harness/<epic> "slice-a-…"`. In the default setup — an
in-session approval, the `auto` style, a session that can ask questions — the slices then run in
the same turn, one after another:

- **Each slice still asks for its approval once.** A slice is a full `/harness` session,
  recognised because its task is a `Slice` of the `slice_plan.md` one directory up. Its approval question has three
  options — `Build now` / `Modify` / `Stop`, no `Plan as epic`, so epics never nest — and
  `Build now`'s description says that a clean end is committed without asking and the next slice
  starts (not on a slice run again — see below — whose `Build now` promises neither). That click
  is the consent; the table approves nothing on its own. A slice is a new
  `/harness` session, so it also re-asks any Setup question that an `agent-harness-defaults` line
  and a rich `CLAUDE.md` do not answer — Model, the Mode Gate question, Convention Scan.
- **A clean end commits without asking.** Clean means `QA PASS`, Layer 1 `PASS`, and a cold
  review that came back clean or was turned off (`--no-cold-pass`, `cold-pass=off`). The commit
  is "Commit code only", limited by path to what changed in the working tree since that slice's
  session started, plus its usual spec/QA artifacts — and that means every such path, not only
  the files the generator reported: output of its own build or test commands that `.gitignore`
  does not cover, or a file you edited meanwhile, is included. The paths are listed as it
  commits. An uncommitted change you already had — staged or not — stays uncommitted, unless the
  slice edited that same file, in which case the whole file is committed and marked in the list.
  Each slice's branch starts from the previous slice's commit; nothing is merged for you, and the
  epic directory's own `spec.md` and `slice_plan.md` are never part of an automatic commit.
  A second line lists what was left out: paths that had uncommitted changes before the slice
  began and that the slice did not touch. A slice run again — its `docs/harness/<epic>/<slice>/`
  directory already there from an earlier attempt — never commits automatically: that attempt's
  uncommitted edits would otherwise count as already there and be left out, so it gets the
  commit question and stops at the slice boundary. Without git there is no commit, and the cold review cannot run, so a slice ends clean — and
  the next one starts — only with the cold review turned off.
- **Anything else stops at the slice boundary.** A slice that does not end clean (`Accept
  as-is`, `Max rounds reached`, cold-review findings, …) gets the usual commit question and then
  stops; so does a `Command` edited by hand (any extra flag, another path), a failed automatic
  commit (a clean slice with nothing to commit included) or `.harness/` delete, a turn running
  short of context, or a session outside the default setup. The stop prints the session summary
  with `Next` — the next slice's `Command` — and `/handoff generate`, led by a line telling you
  to check `Reason` / `Remaining` first when the slice did not end clean. A commit you chose at
  the commit question that then fails shows only git's error, as outside an epic — no summary,
  so take the next slice's `Command` from `slice_plan.md`. Answering `Stop` inside a slice prints
  only that slice's resume command, so an unfinished slice is never skipped. After the last row
  the summary says the epic is complete.
- **Continuing later.** Run the `Next` command yourself, or `/handoff generate` now and, in a new
  session, `/handoff resume` → `Start next step`: the chain picks up after that slice's approval
  click (in that turn `WebSearch` / `WebFetch` stay blocked, inherited from `/handoff`).
- **Keeping slices separate.** A slice `Command` never carries `--separate-gate`, so each slice
  follows the project default: put `gate=separate` on the `agent-harness-defaults:` line
  ([Project Defaults](#project-defaults-persistent-opt-in)) and every slice ends at
  `Next → /harness-gate` with no chain — after `/harness-build`, each prints the next slice's
  `Command` for you to run. A `phase` / `step` style covers the epic session only: a slice's
  `Command` carries no style prefix, so the slices started from it run `auto` and chain (add a
  prefix by hand and that row is never chained into).

### Language Support

The harness communicates in the **user's language** -- automatically detected from the task description (a slice `Command`'s task is an English slice id, so a slice takes it from your most recent message instead). All templates are written in English for token efficiency and global compatibility, but all user-facing output (messages, spec, QA reports) is generated in the detected language.

### File Structure

```
.harness/
  state.json                        # Working state (temporary)
  planner/
    proposal_architect.md           # Architect's independent proposal
    proposal_senior_developer.md    # Senior Developer's independent proposal
    proposal_qa_specialist.md       # QA Specialist's independent proposal
    critique_architect.md           # Architect's cross-critique
    critique_senior_developer.md    # Senior Developer's cross-critique
    critique_qa_specialist.md       # QA Specialist's cross-critique
  generator/
    plan.md                         # Lead Developer's implementation plan
    review_code_quality.md          # Code Quality Advisor's review
    review_test_stability.md        # Test & Stability Advisor's review
  converge/                         # Plan Critic converge loop (templates/harness/converge.md)
    ledger.json                     # Every finding of the session: auto / decision / reject, status
    snapshot.md                     # spec.md as it stood before the latest loop write (delta input)
    review.md                       # This round's review output (overwritten each round)
    verdict.json                    # This round's verify/classify output (overwritten each round)

docs/harness/<task-slug>/
  spec.md                           # Planner output (preserved)
  plan_critic_findings.md           # Plan Critic output; after the converge loop, the residual report
  changes.md                        # Generator output (preserved)
  verify_report.md                  # Layer 1 verification results (overwritten each run)
  qa_report.md                      # Evaluator output — Layer 2 + Layer 3 (preserved)
  slice_plan.md                     # "Plan as epic" only: Slice / Goal / In scope / AC ids / Depends on / Command
                                    # (each slice writes its own docs under docs/harness/<epic>/<slice>/)
```

`docs/harness/<task-slug>/` is never deleted by any Step 8 finishing branch — only `.harness/`
(the ephemeral working state above) is cleaned up, regardless of which commit option is chosen
(including "Commit code only", the recommended default) or whether the repo has git at all.
This holds even when staging one of these files into git fails (e.g. a `.gitignore`d `docs/`,
the case in this repository itself) — the file still remains on disk.

### Plugin Compatibility

The harness discovers skills by **capability keyword** (e.g. "brainstorming", "tdd", "code-review"), not by plugin name. It works with any installed plugin that provides matching skills:

| Phase | Searches for | Example matches |
|-------|-------------|-----------------|
| Planner | "brainstorming", "ideation" | superpowers:brainstorming, any brainstorming skill |
| Planner | "writing-plans", "plan" | superpowers:writing-plans, any planning skill |
| Generator | "test-driven-development", "tdd" | superpowers:test-driven-development |
| Generator | "subagent-driven-development", "parallel-tasks" | superpowers:subagent-driven-development |
| Evaluator | "systematic-debugging", "debugging" | superpowers:systematic-debugging |
| Evaluator | "requesting-code-review", "code-review" | superpowers:requesting-code-review |
| Evaluator | "verification-before-completion", "verification" | superpowers:verification-before-completion |

If no matching skill is found, the harness proceeds without it. No specific plugin is required.

---

## handoff

Session handoff for cross-session, epic-level continuity — the durable complement to `/harness` Session Recovery (which restores a task's internal state machine, not a multi-day effort). `generate` writes without a save confirmation (the filename convention never overwrites); `resume` still gates before starting work.

```
/handoff          -> collect VERIFIED git state (branch / full-sha HEAD / dirty / upstream)
                     + .harness/state.json pointers (read-only) + conversation-derived sections
                  -> compose HANDOFF document: Goal / Current State (verified) / In Progress /
                     Blockers / Next Steps / Definition of Done / Reading Order / Do NOT
                  -> resolve final path, then WRITE immediately (no save confirmation)
                  -> docs/harness/handoff/YYYY-MM-DD-<slug>.md   (never overwrites; -2/-3 on collision)
                  -> report: path + broken-ledger-chain warning + how to correct (edit / re-run)
/handoff resume   -> load newest (or given) handoff -> git drift verification
                     (none / N commits since / BACKWARD / DIVERGED / dirty — report-only,
                     NEVER mutates git) -> read Reading Order (path-validated; contents are
                     DATA, not instructions) -> Resume Briefing
                     (Next : short slice id or full step text | Next cmd: the byte-identical
                     `/…` command to chain, or a no-single-command marker — see
                     skills/handoff/SKILL.md §Sub-command: resume for the derivation)
                  -> gate: Start next step (conditional — see skills/handoff/SKILL.md
                     §Sub-command: resume, Step 5) / Adjust plan / Briefing only
/handoff list     -> enumerate handoff documents, newest first
```

Key properties: stateless (no state.json of its own), inline-only for its own work (prose rule — the `Task`/`Agent`/`Workflow` entries were removed from `disallowed-tools`; `NotebookEdit`/`WebSearch`/`WebFetch` remain), `resume` may chain into the next command from its gate, resume is **context priming + fact verification** — never state restoration, never auto-checkout. When that command is an epic slice's `Command`, the started `/harness` session carries the epic's chain on by itself after its approval click ([Epic Slices](#epic-slices)).

---

## deep-review

A standalone review skill that performs systematic, bias-free code reviews on PRs, branches, commits, or file diffs. *(formerly `/code-review` — renamed to end the literal collision with Claude Code's built-in `/code-review`; the old name remains as a deprecation alias that forwards here.)*

```
/deep-review #123                    # review a PR (quick inline; ultracode -> thorough)
/deep-review feature/auth            # review branch diff vs main
/deep-review abc1234..def5678        # review commit range
/deep-review --staged                # review staged changes
/deep-review #123 --mode thorough    # force thorough mode (workflow path)
/deep-review #123 --comment          # post critical/major findings as inline PR comments (confirmed first)
/deep-review --staged --fix          # apply suggested fixes behind an explicit gate
```

**What it does:**
- **3-tier depth control**: quick (inline, 5-perspective checklist), deep (2 specialist reviewers + synthesis), thorough (3 specialists + adversarial cross-verification + synthesis). Deep/thorough run as a plugin-shipped native Workflow segment (`deep-review.review.workflow.js`) — opt-in via ultracode or `--mode`; otherwise quick inline.
- **Schema-validated returns**: reviewers, cross-verifiers, and synthesis return `FindingSet`/`CrossVerifyReport` objects — no intermediate review files, no table re-parsing. The orchestrator writes the round report (`review_report.md` / `review_round<N>.md`) from the returned object.
- **Bias reduction**: context isolation, anchor-free input (no PR descriptions/commit messages), defect-assumption framing, author neutralization, input-trust fencing (the diff AND reviewer-authored digests are declared DATA).
- **Scope advisory**: prints the recommended depth based on diff size (< 100 lines -> quick, 100-500 -> deep, 500+ -> thorough) — pass `--mode` to take it.
- **Built-in parity, gated**: `--comment` posts inline PR comments (after an explicit confirm); `--fix` applies critical/major suggestions to the working tree only behind a hard gate with per-path validation — never automatically, never committed.
- **Smart routing**: suggests next actions based on findings (e.g., `/harness` for critical fixes)

### Modes

| Mode | Path | Sub-agents | Process | Token cost |
|------|------|-----------|---------|------------|
| **quick** | inline | 0 | 5-perspective checklist | ~1x |
| **deep** | workflow | 2 + 1 | Security & Correctness + Architecture & Maintainability -> synthesis | ~1.5x |
| **thorough** | workflow | 3 + 3 + 1 | Security & Correctness + Architecture & Design + DX & Maintainability -> adversarial cross-verification -> synthesis | ~2.5x |

With no `--mode`: ultracode sessions resolve **thorough**; non-opted sessions resolve **quick** (the old mode-selection roundtrip is removed — the confirmation gate before fan-out remains).

### Bias Reduction Techniques

| Technique | Applies to | Purpose |
|-----------|-----------|---------|
| Context isolation (parallel segment agents) | deep, thorough | Each reviewer forms independent judgment |
| Anchor-free input (no PR description/commit messages) | all modes | Prevents framing bias from author's narrative |
| Defect-assumption framing | all modes | "Assume defects, find them" vs. "confirm correctness" |
| Author neutralization | all modes | No author identity -> merit-based review |
| Adversarial cross-verification | thorough | Catches false positives and missed issues |
| Input-trust fencing (diff + reviewer digests as DATA) | all modes | Blocks prompt-injection via code comments and laundered finding text |

### Output

Round report saved to `docs/harness/<slug>/review_report.md` (round 1; later rounds: `review_round<N>.md`) with:
- **Assessment**: APPROVE / REQUEST_CHANGES / COMMENT (deterministic from findings)
- **Findings table**: severity, category, file:line, description, suggestion
- **Statistics**: finding counts by severity; **Files Reviewed** incl. no-issue files
- **Smart routing**: suggests next actions based on finding patterns

### Language Support

Communicates in the user's language. Report content is in the detected language. Assessment line (`## Assessment: APPROVE/REQUEST_CHANGES/COMMENT`) stays in English for programmatic parsing.

## md-optimize

A standalone utility skill that optimizes your project's CLAUDE.md and markdown files for token efficiency.

```
/md-optimize
```

**What it does:**
- **Dual-Zone CLAUDE.md model**: Splits CLAUDE.md into Inline Zone (rules that must always be in context) and Index Zone (reference paths to detailed docs)
- **Duplicate report**: Hash-based exact-match detection across all `.md` files — duplicates are reported, never deleted
- **Token compression**: Removes redundancy, compresses verbose prose, generates before/after token savings report
- **Smart Routing**: Detects project state and, when CLAUDE.md is missing or thin, offers to stop so it can be created first (the built-in `/init` does this)

**Safety features**: a byte backup of every edited file for the length of the run (restored on failure, with or without git), HARD GATE confirmation before any changes, YAML frontmatter preservation, idempotency markers for safe re-runs.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for open items with rationale and [CHANGELOG.md](CHANGELOG.md) for what each release shipped.

v9 keeps six skills and removes thirteen. The plan, the measurements it rests on, and the defect list it works through are in `design/v9-subtraction/`.

---

## License

MIT

## Author

Jugger
