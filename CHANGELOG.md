# Changelog

All notable changes to agent-harness are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

> Version stays 8.4.0 until the docs/version release-train phase lands (doc-code skew guard);
> this block collects the ultracode-reframe pilot changes.

### Added

- **`/harness` (formerly `/workflow`)** — renamed to end the concept collision with Claude Code's native Workflow engine. The old `/workflow` name is preserved as a ~30-line deprecation alias stub (frontmatter `name: workflow` kept for discovery; AskUserQuestion → Yes delegates to `/harness`).
- **WORKFLOW path (opt-in)**: `/harness` now runs plugin-shipped native Workflow segment scripts via `Workflow {scriptPath: ${CLAUDE_PLUGIN_ROOT}/workflows/...}` — `harness.plan.workflow.js` (persona fan-out → synthesis → `PlanResult`), `harness.build.workflow.js` (plan → advisors → implementation → `ChangeSet`, `retry:true` skips re-plan/re-review), `harness.eval.workflow.js` (L1 mechanical → L2/L3 evaluation → `VerifyVerdict`, `skipL1`/`onlyL1` flags). Schema-validated `agent({schema})` returns replace 1-line parsing, proposal-file re-reads, and the `### Verdict:` regex on this path. The 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) stay in the orchestrator BETWEEN segment runs — `scripts/verify_meta_literal.py` rejects any gate token inside a script.
- **Mode Gate wiring (first consumer of `templates/_shared/mode_gate.md`)**: default = inline single path; workflow path only when the Workflow tool is available AND (ultracode session OR explicit `--mode standard/multi`); `has_git == false` forces inline; any engine failure degrades gracefully to inline single. The mode-selection AskUserQuestion roundtrip is removed (mode is derived, `--model-config` ask kept).
- **`scripts/verify_meta_literal.py` full implementation** (was a Phase-0 stub): meta pure-literal (name/description + `phases` as `[{title, detail?}]` OBJECT literals), ban on `Date.now`/`new Date`/`Math.random`, HARD-GATE-leak ban, **ban on `import` and any `export` beyond the leading meta** (the engine rejects them as SyntaxError), and a required defensive-args-parse guard (`typeof args === 'string'` — the engine delivers `args` as a JSON string). Negative-tested (12 violations on a bad fixture).
- **`scripts/check_workflow_syntax.mjs` (NEW)**: engine-dialect syntax gate. Discovery: `node --check` is a TOTAL false-green for files containing ESM `export` syntax on Node 24 (even `function {{{` passes) — the planned `node --check` gate was useless for these scripts. The checker compiles each script body inside an AsyncFunction (top-level await/return legal, never executed).
- **`workflows/_reference/schemas.md`**: canonical hand-sync schema copies (no runtime `schemas.js` import — engine scripts are self-contained plain JS). Pilot schema deltas recorded there: `PlanResult` gains `background`/`scope{}`/`approach`/`testingStrategy`/`risks[].source` and `steps` is no longer required; `ChangeSet` gains `advisorFeedbackApplied/Declined`; L1 mechanical failure is encoded `{layer:'L1', verdict:'FAIL_L2'}` (branch on layer+verdict).

### Changed

- **state.json v3** (`version: "3.0"`, `skill: "harness"`): adds `path_resolved`, `runs.{plan|build|eval}.runId` (audit + same-session only), `workflow_ctx` (plan/advisor digests reused on retries). **Cross-session recovery is the state.json phase machine** — `resumeFromRunId` is same-session only and is never used across sessions. Pre-harness `/workflow` sessions (v1/v2 state.json) get "Restart recommended" — no silent migration, no legacy resume.
- **Inline path preserved verbatim** (deviation from the pre-correction pilot plan, aligned with the corrected mode-gate contract "default = current behavior"): `planner_single.md`, `generator_single.md` keep their file-write + 1-line contracts; `verify_layer1.md` / `evaluator_prompt.md` are dual-use (1-line contract on disk for inline, schema-return variant embedded in `harness.eval.workflow.js`). Hand-rolled standard/multi prose orchestration is REMOVED from the skill — standard/multi now exist only on the workflow path (engine fan-out); without opt-in or tool availability they fall back to inline single with a notice.
- **11 workflow-only templates** (3 personas, 2 syntheses, lead_developer, 3 advisors, 2 implementations) — 1-line `## Output Contract` + file-write directives replaced with schema-return `## Output` notes matching the author-time copies embedded in the segment scripts (`SYNC-SOURCE`/`WORKFLOW-PATH TEMPLATE` headers added). `implementation*.md` no longer instructs sub-agents to invoke parallel-dispatch skills (engine nesting is 1-level). multi-mode `cross_critique` is no longer dispatched (deliberate simplification — `AnalysisResult.risks/recommendations` carry the dissent; `templates/planner/cross_critique.md` retained on disk for rollback).
- **`input-trust-model` shared block v1 → v2** (4 planner templates + `templates/_shared/input_trust_model.md` + verifier): drops the literal `{placeholder}` mentions (a mechanical renderer would substitute task content INTO the trust prose) and the dangling `## Output Contract` section name. `scripts/verify_block_sync.py` now supports per-group block versions.
- **`templates/evaluator/evaluator_prompt.md`**: report destination made explicit (`{qa_report_path}` — the variable was passed but never declared in the template).
- **README**: `/workflow` → `/harness` sweep (Skills table row renamed with "formerly /workflow" note; Quick Start reflects the derived Mode Gate — no mode roundtrip; architecture diagram shows segment scripts). Historical v8.1–v8.4 entries keep the `/workflow` token. `plugin.json` keywords gain `harness` (`workflow` kept for alias-period discovery).
- **Auto-fix Proposer carve-out**: still dispatched inline by the orchestrator with its 1-line confidence contract (it Reads source directly — Architecture Principle #2). `AutoFixProposal` schema lands in a later phase.

### Engine facts verified by the Phase-1 spike (5/5 PASS)

plugin-cache-rooted `{scriptPath}` resolves and runs; `agent({schema})` returns validated objects (and plain text without a schema — fallback preserved); schema-description language directives (`render in <userLang>`) control output language (ko/en verified); `args` arrives as a JSON string; `export default`/`import` are launch-time SyntaxErrors (top-level body + global hooks only); unregistered `agentType` values fail the call (all `agentType` usage dropped); resume caching is sequential-prefix (editing the first `agent()` call re-runs everything after it).

## [8.4.0] — 2026-05-06

### Added

- **/spec deep mode now dispatches 4 analysts in parallel**: Requirements + UserScenario + RiskAuditor (NEW) + TechConstraint (NEW). Risk and TechConstraint analysts catch security, concurrency, schema, and operational issues that previously surfaced only in /workflow review cycles (coin-washer Critical 5/7 reproducible at spec-time, target verified per Phase 7 smoke test).
- **/spec Critic stage**: cold review of synthesized spec.md classifies findings as Critical/Major/Minor with `[C*]/[M*]/[m*]` IDs. Critical or Major findings trigger a 3-way gate (Auto-revise / Modify / Approve as-is). Auto-revise re-runs synthesis with `{critic_findings}` injection (max 1 round; 2nd round offers Approve/Stop only — no oscillation).
- **/spec Convention Scan (Step 1.5)**: scans CLAUDE.md (has_git=true, mirrors workflow) and 7 candidate files (has_git=false: STYLE_GUIDE.md, CONTRIBUTING.md, conventions.md, guidelines.md, policy.md, docs/style-guide.md, docs/conventions.md, case-insensitive). New `--reference <path>` CLI flag overrides auto-detect.
- **/spec Phase 3 persists `qa_notes.md`, `critic_findings.md`, `conventions.md`** to `{docs_path}` before cleanup. /workflow Step 1.5 auto-reuses persisted conventions; Step 2 injects `{qa_discovery_notes}` + `{critic_findings}` into all 4 planner templates (architect, senior_developer, qa_specialist, planner_single). /workflow Step 8 "Commit code only" preserves the 3 artifacts in the commit.
- **/ship Stage 6.5 (`merge_to_base`)**: merges release branch into base branch BEFORE tag push (closes develop→main lag from 8.1.0/8.2.0/8.3.0). Branch protection detection with PR-creation fallback (Path A) vs standard merge (Path B). Substep-level recovery via 3 new substep enum values. Push-rejection handling: 3-way protected-base gate on Path A entry (Create PR / Skip / Stop), and 5-way push-rejection gate on Path B step 7 (Retry / Manual / Create PR / Skip / Stop) with persistent retry-count cap. HARD-GATEs at merge and push, with branch-protected rollback documentation.

### Changed

- **/spec Phase 3 invokes `/workflow`** with explicit `--output-dir docs/harness/<slug>/ "Implement based on {docs_path}spec.md"` (was: `/workflow "Implement based on docs/harness/<slug>/spec.md"`). The `--output-dir` is required to ensure /workflow's `docs_path` matches /spec's `docs_path` — without it, /workflow re-slugifies the task string and silently picks a different directory.
- **`templates/spec/synthesis.md`** now accepts 5 input variables (was 2): `{requirements_analysis}`, `{scenario_analysis}`, `{risk_analysis}`, `{tech_constraint_analysis}`, `{critic_findings}`. Synthesis Instructions updated from "two analyses" to "four analyses (and Critic findings if revising)".
- **All 4 planner templates** (architect.md, senior_developer.md, qa_specialist.md, planner_single.md) now include `## Discovery Notes from Spec Phase` section with `{qa_discovery_notes}` + `{critic_findings}` placeholders.
- **/spec state.json schema** adds 3 fields: `cli_flags.reference`, `conventions`, `critic`. Pre-8.4 sessions resume with these fields defaulted to `null` via `state.get(field, default)` pattern. **Important**: /spec's backward-compat policy intentionally diverges from /workflow's soft-default — /spec halts at Phase 2a-D step 3 if `state.conventions` is null on resume, forcing user Restart or manual fix (silent degradation would produce lower-quality specs without user awareness).

### Breaking

- **Persona count change in /spec deep mode** (2 → 4 + Critic). Token cost increases approx 1.9x for deep runs (estimated; measured value TBD per Phase 7 smoke test — ROADMAP entry will be updated with the actual multiplier after smoke test). The legacy 2-analyst behavior is no longer accessible in 8.4 (no `--legacy-deep` flag — defer to 8.5 if user feedback warrants).
- **/spec → /workflow handoff CLI contract changed**. Users of automation scripts that wrap /spec output strings should update to expect `--output-dir docs/harness/<slug>/` in the invocation. The task description string also changed from `"Implement based on docs/harness/<slug>/spec.md"` (absolute-looking) to `"Implement based on {docs_path}spec.md"` (placeholder form documenting the assembly contract).
- **Planner templates**: forked custom planner templates that omit the new `{qa_discovery_notes}` / `{critic_findings}` placeholders will silently render an empty Discovery Notes section. Recommended: update fork to include the placeholders (see `templates/planner/architect.md` for reference).

### Fixed

- **Stage 6.5 hardening (audit trail)**: numerous correctness/recovery fixes to `/ship` Stage 6.5 (`merge_to_base`) — closed issues M1, M2, M3, M4, M10, M11, m1, m3, m9, m12, m14, s1, s2, NF2, NF3, NF5, C3, CC5, Sec N1, Sec N3, DX #8, Arch N3. These IDs were formerly inline `(closes …)` annotations in `skills/ship/SKILL.md`; relocated here so the skill prose stays behavior-focused while the audit trail is preserved in its proper home.

## [8.3.0] — 2026-04-30

### Added

- **feat(ship): auto-detect `.claude-plugin/*.json` version fields in Stage 2** — `/ship` Stage 2 (`version_bump`) now identifies version references in `.claude-plugin/plugin.json` (top-level `$.version`) and `.claude-plugin/marketplace.json` (`$.metadata.version` and `$.plugins[*].version` for each plugin entry) alongside the existing standard package manifests (`package.json`, `pyproject.toml`, etc.). Pass 2 applies updates via JSON parsing on these key paths, preserving the original line-ending convention (CRLF vs LF) and avoiding the regression where naive string replace would taint coincidentally-equal version strings in other fields (e.g., `description: "Initial 8.2.0 release notes…"`). Resolves residual gap N1 from v8.2.0.
- **feat(md-optimize): add `.gitignore`-aware exclusion to scan/index/safety** — `/md-optimize` Phase 1b now runs `git rev-parse --is-inside-work-tree` and excludes gitignored paths via per-path `git check-ignore --quiet`, preventing the Reference Index from emitting broken references for files that exist locally but not on teammates' machines or in CI. Phase 4 evaluator gains a "Gitignore safety" row, and Safety Rules adds a "Gitignore-aware" bullet (precedence-resolved against the Sub-CLAUDE.md rule: gitignore-aware wins). Non-git projects fall back to the existing Exclusion List with bit-identical behaviour.

### Documentation

- **docs(readme): add `/ship` skill section and Skills table entry** — README's Skills table now lists all 12 skills (previously 11), and a dedicated `## ship` section documents the 6-stage pipeline, auto-detection signals, HARD-GATE matrix, safety guards (including v8.2.0 hardening), and session-recovery substep model.
- **docs(roadmap)**: rename `v8.2+` → `v8.3+` Planned section and adjust scope (added then resolved the `/ship` version_bump auto-detect item; dropped non-development items).

## [8.2.0] — 2026-04-29

### Fixed

- **fix(ship): align `.harness/` cleanup Safety Guard with `/workflow` parity** — Add explicit symlink-escape verification (`Path('.harness').resolve() ⊆ Path.cwd().resolve()`, unconditional), insert "Display target before delete" step that prints the exact absolute path, route every validation failure through ABORT with a translated user warning, and specify symlink-vs-target deletion semantics in Item 5 (`is_symlink()` short-circuit removes the link itself, regular directories use `follow_symlinks=False`). Adds a `Path(...)` pseudocode-portability note for cross-platform agent execution. Resolves residual gap S1 and review #7 (PARTIAL).
- **fix(ship): bound tag-name regex length to strict 254 characters** — Change `tag_name` validation from `^v?[0-9a-zA-Z][0-9a-zA-Z._-]*$` to `^(v[0-9a-zA-Z][0-9a-zA-Z._-]{0,252}|[0-9a-zA-Z][0-9a-zA-Z._-]{0,253})$` to reject pathological tag inputs (e.g. 10k-char strings). Alternation form enforces a strict 254-char hard cap regardless of optional `v` prefix (the simpler `^v?[0-9a-zA-Z][0-9a-zA-Z._-]{0,253}$` would have allowed 255 chars when `v` is present). Resolves residual gap S2 and review N-8 (length bound only; consecutive-dot / trailing-dot hardening deferred).
