# Agent Harness Roadmap

## Unreleased — `harness-handoff-coldreview-epic-slice` epic (slices A–F)

Epic closing out cold-review-in-Eval wiring, `/handoff` slice-command chaining, and the two new
SYNC-WITH marker groups that catch a subset of the epic's own cross-reference-rot risk. Full
summary: CHANGELOG.md. This table is a **separate** deferred-items table (2-column, same header
shape as the v8.9 table below by convention, not by merge) — it is intentionally NOT appended to
that older table, which tracks a different, already-shipped release's leftovers.

`skills/test-gen/SKILL.md`/`skills/ship/SKILL.md` gate-option and `conventions.md`
auto-inheritance rows below carry the epic spec's own §유예 항목 table content
(`docs/harness/harness-handoff-coldreview-epic-slice/spec.md`, gitignored — not a public link)
— that table names itself as this table's input, so its 3 rows land here before the slice's own
additional deferrals are appended. The "Item" cell for these 3 rows is an **English restatement
followed by the epic's original Korean Item string, verbatim, in backticks** — a bilingual
**pairing, not a translation substitute** — so an automated substring check against the epic
spec's own Item text (AC-24's verification method) can match the original wording directly
rather than trusting a paraphrase.

| Item | Why deferred |
|------|-------------|
| `skills/test-gen/SKILL.md` framework-selection gate: 6 options → 4 or fewer — epic original: `` `skills/test-gen/SKILL.md` 프레임워크 선택 게이트의 옵션 6 → 4 이하 정합화 `` | Not an in-scope file for this epic; no implementation step touches it; option reduction is a user-facing behavior change needing its own review |
| `skills/ship/SKILL.md` Push Rejected gate: 5 options → 4 or fewer — epic original: `` `skills/ship/SKILL.md` Push Rejected 게이트의 옵션 5 → 4 이하 정합화 `` | Same reasoning; the 5 branches are 5 distinct recovery procedures, not easily merged |
| Epic sub-slices auto-inheriting the parent epic directory's `conventions.md` (§Step 1.5 extension) — epic original: `` 에픽 하위 슬라이스가 부모 에픽 디렉터리의 `conventions.md`를 자동 상속하도록 §Step 1.5 확장 `` | Outside decisions 1–5; the inheritance-scope rule (how far up the ancestor chain) needs a fresh design pass |
| `workflows/_reference/schemas.md` orphaned `sliceHint` delta drift | Epic AC-35 / slice A's own measurement contract owns this file; slice F does not touch it |
| `.gitattributes` does not cover `*.md`/`*.py`/`templates/**` | `git ls-files --eol` passing is this machine's `core.autocrlf`, not a repository-level guarantee; widening the pattern set is a separate, deliberate change |
| Epic AC-8 ("Auto-revise re-entry exposed once re-entry + `proposals.json` persistence land") satisfaction judgment | Literal text is satisfied (exposure-only), but slice-f's own measurement shows the payload is structurally too large to dispatch (101,645 B) two slices running — recorded, not re-litigated here |
| `specContent` path-shaped alternative (`specPath`) instead of full-text arg | Would shrink the args payload for large specs, but changes the Eval segment's args contract — new design surface |
| §Step 2.6 args should carry the epic spec.md, not just the slice spec | Same category — args-contract redesign, not a slice-f edit |
| Live integration probe — recorded as 7 items, of which this table has only ever named two examples (end-to-end chaining, actual dispatch), so slice F's own probe targets are listed separately here rather than folded into that count: the cold-gate 4-condition fail-closed path (AC-14), the `cold_reviewer.md` ↔ `TPL_COLD_REVIEWER` lockstep (AC-28), the resume gate's chain-into-next-command path, and the `Next :` / `Next cmd:` role split | This slice's evidence is static/textual only (AC-27); one combined probe was scheduled for after the epic's slices land rather than one per slice. The slices have landed and the probe has not run, so slice F's four targets carry **0 live observations** — that stays the disclosed state until it does |
| `conventions-field-contract` SYNC group's slack of 1 (`min_sites=2`, measured 3) | Epic AC-29's slack-0 requirement applies only to the 2 groups this slice adds; tightening a pre-existing group is a separate, deliberate change |
| Session Boundary Type A "After Plan" row residual — `/harness generate` typed directly still skips §Step 2.6/§Step 3/§Step 3.5 | §Step Mode Prerequisites' `generate` minimum phase is unchanged (affects every non-epic session) — see `skills/harness/SKILL.md` §Session Boundary |
| `cold_reviewer.md` ↔ `TPL_COLD_REVIEWER` byte-identity has no lint | The sync mechanism (`scripts/verify_block_sync.py`'s BLOCK-START/END SHA256) exists for a different file family (`templates/planner/*.md`); reusing it here was evaluated and not attempted this slice, so the two copies are held in step by one manually run comparison and nothing else — and that comparison covers only the `## Identity` to `## Output Contract` span, 3,712 B on each side, not either file end to end. Carrying BLOCK markers is also not the same as being covered — `GROUPS` currently declares exactly two block tags, both over `templates/planner/*.md` plus their single source, so a marker pair outside that set (`templates/_shared/falsification_rules.md` has one) is never compared |
| `skills/handoff/SKILL.md` §Non-Goals' `skills/migrate/SKILL.md:246`/`:531` absolute line citations | Correcting them requires opening that file and choosing new §section names — out of this slice's own scope; re-judging them risks creating the same kind of cross-reference rot this epic exists to catch |
| Epic AC-22 (`§Session Recovery` `cli_flags.output_dir` drift-detection branch) | Verified **not implemented** — `skills/harness/SKILL.md` §Session Recovery's "Resume" action explicitly says "Do NOT recompute from `cli_flags.output_dir`" (audit/record only); the epic spec's own AC-22 wording was corrected (rev.5) to name the right operand and a non-destructive recommended option, but no code change followed in this slice |
| The `## v8.8` deferred table's **P2-3** row cites `skills/harness/SKILL.md` at 2,232 lines; the landed file measures 2,234 | That row sits under an already-shipped release heading, and its stale-figure disclosure covers the older number it replaced, not this one. The gap is one of timing, not of basis: 2,232 was measured mid-slice, before two later lines landed, and the file measures 2,234 in HEAD, in the index and in the working tree alike. The byte figure is basis-dependent, though — the same file is about 2 KB larger on disk (CRLF) than in the index (LF). Printing a figure without naming when and against what it was taken reproduces the error that made these disagree. The basis half of that discipline is an open item in this table; no row there asks a figure to name when it was taken, which is the half this row's own gap turned on |
| `workflows/spec.eval.workflow.js`'s SYNC-WITH marker sits mid-sentence and splits the `// contract` block's noun phrase | The block is one unbroken run of comment lines, so any interior boundary keeps the marker inside it and none of them reads better than where it is. Putting it back above the block's first line returns it to the position this slice already corrected once, where whether it belonged to the `// ---- args` header or to the contract block was not decidable from line order alone. Moving it again would be its second relocation inside one slice, after both placements so far produced an unintended result — so it is left awkward rather than moved to satisfy a lint that already passes and never looks at where a marker sits |
| Slice F's four timing/ordering acceptance criteria (AC-1 baseline capture, AC-4 per-stage lint logs, AC-10 cold-finding triage ledger, AC-16 two-pass cross-reference traversal) | Each requires an observation taken *before* the first edit, so producing it afterwards is fabrication rather than compliance. Two are recorded as unmet by honest disclosure and two only as post-hoc reconstruction; no later edit can move any of the four. Listed here as a closed record, not as schedulable work — the schedulable part is the Step 1 enforcement item in this table |
| Make the baseline capture, the cross-reference traversal, and the finding-triage ledger required `/harness` §Step 1 artifacts, written before the first edit (this merges the same change raised separately as a slice-F handoff follow-up) | The only remedy for the timing/ordering criteria this epic left unmet: they failed because nothing in the contract forced the artifacts to exist at the right moment, and no later document edit can supply a past observation. It is a contract change to `skills/harness/SKILL.md` that would affect every task, not just epics, so it needs its own design pass rather than a drive-by edit in the epic that found the gap |
| A rule that every quoted figure names its measurement basis (diff base, EOL, index vs working tree) | This epic produced three figures that were each right against one basis and wrong against another — a `git diff` read working-tree-vs-index instead of vs HEAD, an EOL filter matched only the index field and missed working-tree CRLF, and `wc -c` moved ~2 KB with the line ending. The tool behaved correctly all three times; the basis was chosen wrong. Where the rule should live (a `templates/_shared/` single source vs. per-skill prose) is undecided |
| AC-20 / AC-30 disclosure precision — the before/after wording of the four SSOT corrections, and the line-number → current-content comparison behind the AC-30 verdicts | Both are recorded as partially unmet and stay that way: `docs/` is `.gitignore`d in this repository, so no earlier revision of those planning documents survives to quote, and the raw comparison output was never captured. Redoing the comparison now would sharpen the disclosure without changing either verdict |
| AC-26 (scope containment) — `workflows/harness.eval.workflow.js` landed 6 hunks against a declared 4 | Counted as unmet rather than rescued by revising the spec after the round limit had passed. The 2 extra hunks are adjacent comments that the 4-condition gate change made false on the spot, so reverting them would leave 2 stale comments — the exact rot this epic exists to catch. Sharpening the disclosure changes the record's accuracy, not the verdict |
| Absolute line-number citations left in this epic's own outputs — 10 in the slice `changes.md` and 12 sites in `name_manifest.md` (both gitignored — not a public link) | The slice's own rule is to cite by §section name, and its outputs break it, the triage ledger that adjudicated the rule included. 7 of the 12 `name_manifest.md` sites were measured stale (working tree at epic close: the cited line now holds unrelated content), so each needs a fresh §section name chosen by opening the target file — which is how this class of citation rots in the first place. Separate from the `skills/handoff/SKILL.md` §Non-Goals citations, which have their own row |
| 13 EOL-only differing pairs between this repository and the installed plugin copy | Content-identical (the difference disappears once CR is stripped) and outside every slice's scope. Tidying the installed copy is release-time work; doing it mid-epic would have shaken unrelated files immediately before the live measurement that depends on them |
| Two revision-bookkeeping drifts in this epic's planning documents (gitignored — not a public link) — `slice_plan.md`'s `Requirements source (SSOT)` row still names rev.3 while the spec body is at rev.5, and the epic `spec.md`'s revision history stops at rev.4 while its own AC text carries rev.5 corrections | Neither file ships and no lint reads them, so the drift costs nothing at release and costs only the next reader, who would take each header's revision at face value. Fixing it is bookkeeping on documents this epic has closed, and editing an SSOT after the work it governed is finished is itself a risk this epic learned to avoid |

## v8.9 — Shipped (2026-08-05) — `/study` skill + `/handoff` write-immediately

- **`/handoff generate` no longer asks before saving** — Step 3 resolves the path, Step 4 writes.
  The gate guarded a write that is safe by construction (the filename convention never
  overwrites; the write touches no git state, no `.harness/`, nothing outward-facing; and
  `generate` is already an explicit user action). The correction affordance it provided is
  preserved by inverting the order — the file is the preview, and the write report always names
  how to correct it. `Cancel` is given up and documented as given up; the Progress Ledger's
  broken-chain warning moved into the write report. `resume` keeps its own gate.
  See `skills/handoff/SKILL.md`.
- **`/study` — 9th multi-path skill** — turns a `/harness` output directory, a whole project,
  or a git diff into a 7-section, 3-tier study guide (concept explanation / real code excerpts
  / interview Q&A / hands-on exercises / design rationale / anti-patterns / glossary) for
  post-hoc learning. Quick (inline, full path — the Windows CRLF safety net) or deep/thorough
  (3 evidence lenses + per-topic-bucket authors + a thorough-only reproducibility critic +
  assemble, native Workflow path, opt-in gated). Provenance is machine-checked, not a prompt
  promise: every repo-sourced code excerpt is re-read against the actual file before
  publishing, and every narrative claim carries a `repo`/`inference` basis that auto-downgrades
  when its evidence path does not resolve. Ships a self-contained static HTML report (inline
  CSS/JS, dark/light aware, tier-filterable, zero external requests) — the first non-`.md`
  skill asset in this repository (`templates/study/html_shell.html`). Carries all 3 SYNC-WITH
  marker groups (`§Ambiguity Prompt`, `§agent-harness-defaults`, `§Ad-hoc Dispatch Contract`);
  `scripts/verify_sync_markers.py` floors raised accordingly. See `skills/study/SKILL.md`.

## v8.8 — Shipped (2026-07-28) — Anthropic best-practices gap analysis — epic continuity

Scope selected from a gap analysis against Anthropic's official Claude Code best-practices
document (`docs/harness/anthropic-best-practices-skill-improvements/anthropic-best-practices.md`),
targeting the reported pain point: epic-scale work done through `/harness` ends each session
"ambiguously incomplete" because session-boundary output, artifact preservation, and the
`/harness` ↔ `/handoff` handoff were each only partially specified. Design principle: `/harness`
stays the slice executor (unchanged state machine, unchanged `state.json` v3 schema); `/handoff`
becomes the epic ledger — all changes are contract precision (tables/states/gates), not new
subsystems.

- **`## Session Boundary` single source + Step 8 evidence-preservation fix** — every
  `/harness` session-ending point (4 phase boundaries + the L1 max-retry "Stop" + Step 8) now
  prints one standardized block (resume command, `{docs_path}`, `/handoff generate`
  recommendation); Step 8's recommended "Commit code only" option no longer deletes
  `{docs_path}` (previously silently destroyed `spec.md`/`qa_report.md` in `.gitignore`d
  `docs/` setups — this repo's own default). See `skills/harness/SKILL.md`.
- **`/harness` → `/handoff` wiring + optional epic Progress Ledger** — `/harness` recommends
  `/handoff generate`; `generate` records task state in a fixed-label parse-anchor format;
  `resume` cross-checks it against the live `.harness/state.json` (report-only); `generate`
  gains an optional `## Progress Ledger` (Epic/Slice/Status/Evidence/Notes) that survives across
  an epic's multiple HANDOFF documents via an Epic-matching carry-forward rule. See
  `skills/handoff/SKILL.md`.
- **`/harness` branch-reuse safety + Setup Summary verification-gap warning** — a pre-existing,
  non-empty `harness/<slug>` branch is never silently reused (diff-contamination risk); Setup
  Summary warns (never halts) when all 4 verification commands are `null`. See
  `skills/harness/SKILL.md`.
- **`/spec` cross-skill session-conflict gate** — symmetric to `/harness`'s own gate; closes a
  real (not hypothetical) silent-overwrite path where `/spec` would delete a live `/harness`
  session's `state.json` with no confirmation. See `skills/spec/SKILL.md` §Session Recovery.
- **`/deep-review --spec <path>` opt-in Spec Conformance pass** — an independent report section
  checking the diff against a spec's Acceptance Criteria/Scope; the defect reviewers stay
  spec-blind (anchoring invariant unconditional); only upgrades `## Assessment`, never
  `## Statistics`/`## Round Verdict`. See `skills/deep-review/SKILL.md`.
- **`/spec` fresh-session recommendation** — the Phase 3 "start implementation" prompt defaults
  to printing the exact `/harness --output-dir ...` command for a NEW session, per the
  reference document's Phase 0 guidance, alongside the previous immediate-invoke option. See
  `skills/spec/SKILL.md` §Phase 3.

**Deferred to v8.9+ (documented, not silently dropped):**

| Item | Why deferred |
|------|-------------|
| **P2-1** — non-destructive "view state only" option in `/harness` Session Recovery's Resume/Restart/Stop gate; explicit priority rule between Session Recovery and the no-args next-step suggestion | Real gap (2 of 3 existing options are destructive), but additive to the same gate rather than blocking the epic-continuity fixes above |
| **P2-2** — state-machine-level distinction between the 3 different roads that all currently converge on `phase: "completed"` (QA PASS / Accept-as-is / Max-rounds-reached) | The Session Boundary block (v8.8, above) already derives a display-only `Reason` label from existing fields without a schema change; a true state-machine fork would require a `state.json` version bump, which is out of scope until real usage shows the display-only mitigation is insufficient |
| **P2-3** — top-of-file invariant summary in `skills/harness/SKILL.md` (~75KB/1,090 lines when this row was written; now ~190KB/2,232 lines post `harness-handoff-coldreview-epic-slice` — figure not updated in place, flagged stale here rather than silently left wrong, see that epic's slice-f traversal record) with Key Rules/Architecture Principles at the bottom — a compact-survival risk | Needs to re-evaluate alongside M3 (template compression, below) rather than as an isolated insertion; the fixed SKILL.md section-order convention means this needs its own design pass, not a drive-by edit |

## v8.7 — Shipped (2026-07-24) — model tiering + session continuity

Scope selected from the 2026-07-24 three-project usage audit (25-agent workflow; evidence: the user
operates primarily as a free-form ultracode orchestrator — the plugin's highest-value additions are
contracts for that path plus session continuity):

- **`frontier` model preset** — Fable evaluator / Opus advisor / Sonnet executor / Haiku verifier;
  judgment agents (cross-verification, critic) remapped to the evaluator role (no-op for pre-8.7
  presets). See `templates/_shared/model_config.md`.
- **Project defaults** — `agent-harness-defaults: path=..., model-config=..., verifier-model=...`
  line in a defaults source — `.claude/settings.local.json` env (recommended) / project CLAUDE.md /
  `~/.claude/CLAUDE.md`, first wins wholesale — as a standing opt-in (Mode Gate §Ambiguity Prompt
  step 4.5); kills the per-session `/effort` + model-picker ritual. See `templates/_shared/project_defaults.md`.
- **Ad-hoc Dispatch Contract** — output-language + model-routing rules for non-template sub-agents
  and ad-hoc Workflow scripts; root-cause fix for the v8.6.0 English leak. See
  `templates/_shared/adhoc_dispatch.md`.
- **`/handoff` skill** — human-gated session handoff (generate / resume with git-drift verification /
  list); replaces the 150+ hand-written HANDOFF/NEXT_SESSION documents found across the three
  audited projects. See `skills/handoff/SKILL.md`.
- **`/deep-review` round bookkeeping (P05, reduced scope)** — standardized round numbering,
  orchestrator-only prior-finding reconciliation (reviewers stay blind), advisory Round Verdict;
  no auto-convergence loop (the /spec oscillation invariant is untouched — user re-invokes per
  round). See `skills/deep-review/SKILL.md`.
- **`/spec` Review Sheet + `/spec digest` (P15)** — specs open with a derived review sheet (TL;DR,
  decision table, open questions, changed-in-this-revision); `digest` produces a read-only 3-layer
  briefing of existing docs (evidence: spec-comprehension effort was a reported top pain).
  See `skills/spec/SKILL.md`.

M4 (persona override), M3 (template compression), and L1 (external CLI wrapper) remain planned
(see the v8.3+ table below); audit follow-ups not in this scope (cold-review preset, segment
checkpoints, campaign ledger, `harness clean/archive`) are tracked for v8.8+.

---

## v8.x — Shipped

**v8.6.0** — Mode Gate §Ambiguity Prompt + §Path Transparency

- **§Ambiguity Prompt (single source `templates/_shared/mode_gate.md`, wired into all 8 multi-path skills)**: when no `--mode` is given and ultracode is OFF (Workflow engine available, interactive session), skills explicitly ask inline-vs-workflow instead of silently auto-resolving. `--no-prompt` / non-interactive sessions keep silent auto-resolution.
  See: `templates/_shared/mode_gate.md`, `skills/{harness,spec,debug,deep-review,codebase-audit,migrate,refactor,test-gen}/SKILL.md`
- **§Path Transparency**: every skill prints `Path : <inline|workflow> (<reason>)` — the chosen execution path and its cause are always visible, including on the auto-resolved and ultracode paths.
- **SYNC-group tracking (`scripts/verify_sync_markers.py`)**: the §Ambiguity Prompt marker is tracked as a SYNC group — referential integrity of the marker plus a minimum-site-count floor across the wired skills, so a dropped `SYNC-WITH` marker fails the lint. Content-level drift of each skill's wiring vs the single source, and a §Path Transparency marker group, are follow-ups (not yet enforced).
  See: `scripts/verify_sync_markers.py`

---

**v8.5.0** — Native Workflow Reframe + Skill Renames (alias-preserved) + Mode Gate

- **Skill renames (alias-preserved, NOT a hard break)**: `/code-review`→`/deep-review`, `/memory`→`/team-memory`, `/workflow`→`/harness`. Old names retained as deprecation-stub skills (frontmatter `name:` kept for discovery) that resolve, print a localized notice, and redirect. Removal no earlier than the next MAJOR.
  See: `skills/{deep-review,team-memory,harness}/SKILL.md`, stubs in `skills/{code-review,memory,workflow}/SKILL.md`, README "Skill Naming & Built-in Command Relationship".
- **Mode Gate (derived; opt-in)** — `templates/_shared/mode_gate.md`: default = inline path; the native Workflow path runs only when the Workflow tool is available AND the session opts in (ultracode OR explicit `--mode`); `has_git == false` or a missing/erroring engine falls back to inline. Replaces the previous raw-effort gating idea and the mode-selection AskUserQuestion roundtrip.
- **`disallowed-tools` frontmatter** on every skill — runtime enforcement of read-only / no-escalation contracts (verified-safe subset; e.g. `/team-memory` blocks Task/Agent/Workflow/WebSearch/WebFetch; read-only review skills block Edit/Write).
- **Native Workflow authoring (8 high-overlap skills)**: at opt-in depth, `harness`/`spec`/`debug`/`deep-review`/`codebase-audit`/`migrate`/`refactor`/`test-gen` author & run shipped segment scripts (`${CLAUDE_PLUGIN_ROOT}/workflows/<skill>.<segment>.workflow.js`) that fan out via `parallel()`/`pipeline()`, return schema-validated objects, and resume via `runId`. Canonical schemas (`workflows/_reference/schemas.md`, 16 `##` headings = 18 names): AnalysisResult, PlanResult, ChangeSet, VerifyVerdict, CriticReport, Hypothesis, DebugAnalysis, RootCause, Finding, FindingSet, CrossVerifyReport, MigrationPlan, AuditAnalysis, CompletenessCritique, AuditResult, SkepticVote, MutationVerdict, ExecutedMutation. (RefactorPlan is an in-script extension of PlanResult, not a canonical heading.) The 3 HARD-GATEs (spec-confirm / verify-fail / auto-fix-apply) stay in the orchestrator BETWEEN segments — `scripts/verify_meta_literal.py` rejects any gate token inside a script.
  See: `workflows/*.workflow.js`, `workflows/_reference/schemas.md`, `scripts/{verify_meta_literal.py,check_workflow_syntax.mjs,verify_block_sync.py}`.
- **`/deep-review --comment` / `--fix` parity**: `--comment` posts inline PR comments (after an explicit confirm); `--fix` applies critical/major suggestions to the working tree behind a HARD-GATE (never commits/pushes).
- **`templates/_shared/` single-source extraction** (Mode Gate, Input Trust Model, model_config, Safety Guard, detection table, status format, spec-context, falsification rules, AskUserQuestion) + `scripts/verify_block_sync.py` simplified to single-source + SHA256 reference checks.

**Breaking changes (alias-mitigated)**: command names change to `/harness`, `/deep-review`, `/team-memory` — old names still resolve via deprecation stubs (no invocation breaks), but muscle-memory and docs should migrate. Opt-in Workflow-path runs execute a segment script rather than inline prose orchestration; that path's resume key is the engine `runId` (same-session) with the `state.json` phase machine for cross-session — pre-8.5 interrupted sessions should Restart rather than Resume.

---

**v8.4.0** — Spec Skill Hardening + /ship merge-to-base

- **A+B+C+D — /spec Hardening**: Risk Auditor + Tech Constraint Analyst added to deep mode (4-analyst parallel synthesis), Spec Critic stage with 3-way gate + 1-round auto-revise, Convention Scan with `--reference` flag and has_git=false candidate file detection, qa_notes / critic_findings / conventions persistence to `{docs_path}` for slug-safe /spec → /workflow handoff (workflow Step 1.5 reuse, Step 2 variable injection into 4 planner templates, Step 8 cleanup protection).
  Token cost (deep mode): ~1.9x of base (analytic estimate from dispatch count: 5 calls deep vs 3 calls pre-8.4 + per-call content growth; live measurement deferred to follow-up smoke session). The estimate **includes** the Input Trust Model boilerplate (~7 lines / ~150 tokens) duplicated across 8 templates (4 planners + 4 spec analyst templates) for security clarity — this is a deliberate trade-off: ~1680 tokens of overhead per /spec deep run buys uniform prompt-injection guards on every sub-agent dispatch, judged worth it over a 1-line compressed form that risks ambiguity. Spec-time detection rate (coin-washer reproduce, analytic mapping of 4-analyst + Critic against original review_report.md): **Critical 5/7** (high-confidence catches C1+C2+C4+C5+C6; borderline C3+C7), **Major 6/12** (high-confidence M1+M2+M3+M4+M5+M14). False-positive on 2 known-good specs (`feature-coin-washer-improvements`, `qaas-411-reopen-fix` — analytic prediction): **Critical=0, Major≤1** each.
  See: `skills/spec/SKILL.md`, `templates/spec/{risk_auditor,tech_constraint_analyst,critic,synthesis}.md`, `templates/planner/*.md`
- **N2 — /ship Stage 6.5 (`merge_to_base`)**: Adds `release_branch → base_branch` merge step between 6c-i (branch push) and 6c-ii (tag push), ensuring the tag is reachable from `base_branch`. Branch protection auto-detection with PR creation fallback. Substep-level recovery via 3 new enum values (`merge_base_pending` / `merge_base_done` / `merge_base_pushed`). **dogfood: planned for 8.4.0 release (develop → main)**; the actual /ship invocation that produces v8.4.0 will exercise Stage 6.5 end-to-end and the executed path (Path A vs Path B, FF vs Non-FF) will be appended here in the release session as evidence (closes m11 — placeholder until release session updates this line).
  See: `skills/ship/SKILL.md §6.5`

**Breaking changes**: deep mode persona count 2 → 4 + Critic; /spec Phase 3 handoff CLI contract gains `--output-dir`; planner templates gain `{qa_discovery_notes}` / `{critic_findings}` placeholders (forked custom templates may render empty Discovery Notes silently); `/spec` deep mode now hard-error halts at Phase 2a-D step 3 if `state.conventions` is null on resume — pre-8.4 sessions that reach `qa_complete`/`gen_ready`/`qa_active` MUST complete Step 1.5 (Convention Scan) before Phase 2 entry, either by Restart or via the M14 backward-compat Resume description override which routes through Step 1.5 first; intentional asymmetry vs `/workflow`'s silent-default missing-field policy (rationale: 4-analyst pipeline depends on convention context for high-quality output, so silent degradation through 8.4 flow would produce lower-quality specs).

---

**v8.3.0** — Ship version_bump auto-detection for `.claude-plugin/*.json`

- **N1 — `/ship` version_bump auto-detection for `.claude-plugin/*.json`**: Stage 2 (`version_bump`) now auto-detects version fields in `.claude-plugin/plugin.json` (top-level `$.version`) and `.claude-plugin/marketplace.json` (`$.metadata.version` + `$.plugins[*].version`) alongside the existing standard package manifests. Pass 2 uses JSON parsing on exact key paths to avoid regression where naive string replace would taint other fields (e.g., a `description` containing the same version string). Original line-ending (CRLF vs LF) and trailing-newline state are preserved.
  See: `skills/ship/SKILL.md §Step 2 Stage — version_bump (Pass 1 + Pass 2)`

---

**v8.2.0** — Ship security hardening: Safety Guard parity + tag-length bound

- **S1 — Ship Safety Guard parity with /workflow**: `.harness/` cleanup now performs unconditional symlink-escape check (`Path.resolve() ⊆ Path.cwd()`, no `has_git` gating) and prints the exact absolute target path before deletion, mirroring the `/workflow` Artifact Cleanup Safety Guard.
  See: `skills/ship/SKILL.md §Step 8 Cleanup (Safety Guard)`, `skills/workflow/SKILL.md §Step 8 Artifact Cleanup Safety Guard`
- **S2 — Tag-name length bound**: Tag regex tightened from `^v?[0-9a-zA-Z][0-9a-zA-Z._-]*$` to `^v?[0-9a-zA-Z][0-9a-zA-Z._-]{0,253}$` (254-char max), rejecting pathological large inputs.
  See: `skills/ship/SKILL.md §Step 6c Push (Input validation)`

---

**v8.1.0** — Release hardening: Path Validator + state invariants + schema parity

- **H1 — Verifier model flexibility**: Layer 1 Mechanical Verification primarily runs commands and parses exit codes, so haiku is sufficient by default. An opt-in override is provided for high-cost diagnosis (concurrency, complex test failures).
  See: `skills/workflow/SKILL.md §Step 1 Setup` (--verifier-model), `§Model Selection`
- **H2 — Auto-fix proposal**: When Layer 1 still fails after 3 retries, users may review an AI-proposed diff via a HARD-GATE-based single attempt. The same flow is added to `/refactor` for test regressions.
  See: `skills/workflow/SKILL.md §Step 5 Verify Phase`, `§Architecture Principles`
- **Release hardening** (post-review): `## Architecture Principles` section, `## Path Validator` single-source path validation (applies to `--output-dir`, `{failing_files_list}`, unified diff, Safety Guard), Auto-fix State Transition Table with invariants I1–I4 (once-only, retry clamp, session-resume entry point), `/workflow` ↔ `/refactor` schema parity (`verify.autofix_attempted` nested, reader-union backward compat), 2nd HARD-GATE UX unified across skills.
  See: `skills/workflow/SKILL.md §Architecture Principles`, `§Path Validator`, `§State Machine`
- **L2 — ROADMAP**: This file. Transparent planning and decision log.
- **L3 — `--output-dir` flag**: Supports monorepo/CI scenarios requiring artifacts outside the default `docs/harness/`. Path validation rules live in the Path Validator single source.
  See: `skills/workflow/SKILL.md §Step 1 Setup` (--output-dir), `§Architecture Principles §Path Validator`
- **M2 — `.github/` templates**: `bug_report.yml`, `feature_request.yml`, `question.yml` issue templates + `PULL_REQUEST_TEMPLATE.md` to lower contribution barrier.
- **M2 — Marketplace description**: `plugin.json` and `marketplace.json` descriptions updated with value-proposition language and "multi-agent" keywords.
- **M1 (partial) — README text demo**: "At a Glance" section with before/after examples, terminal output sample, token cost table expansion.

---

**v8.0.0** — Thin Orchestrator + 3-Layer Quality Gates

- Thin Orchestrator: state-machine orchestrator that passes paths only to sub-agents (no accumulation), 1-line return parsing, 40–60% token savings vs fat orchestrator
- 3-layer quality gates: Layer 1 mechanical (build/test/lint/type-check/TODO scan), Layer 2 structural (criterion mapping, scope validation), Layer 3 LLM judgment (bias-reduced, context-isolated)
- `state.json v2.0`: interrupt-safe session recovery, round-based retry loop, run-style (auto/phase/step)
- Convention scanner sub-agent, multi-mode planner (single/standard/multi), phase-mode execution

---

## v8.3+ — Planned

Items deferred from v8.1 / v8.2 with rationale:

| Item | Reason deferred | Notes |
|------|----------------|-------|
| **M4 — Custom persona override** (`templates/user-override/`) | Variable contract definition required first; ROI analysis pending real usage data | Architect/Senior split: Senior recommended deferral. Minimum viable: `.harness/templates/` project-level override only |
| **M3 — Template compression** | Senior measured actual templates: avg 46 lines, max 185 lines (~2–3k tokens). Feedback premise of "8–12k tokens" did not match measurements | Re-evaluate after v8.1 usage data |
| **L1 — External CLI wrapper** | Claude Code's `/skill` invocation already functions as CLI; separate repo adds maintenance burden disproportionate to value | Reconsider if community demand emerges |

> **Re-deferred to v8.7+:** the v8.5.0 native-Workflow reframe (skill renames + Mode Gate + native authoring) was prioritized over the items above per the 2026-06-02 optimization review (ROI reversed once the native engine landed). M4 (persona override), M3 (template compression), and L1 (external CLI wrapper) remain planned for v8.7+. N2 (`merge_to_base`) shipped in v8.4.0 and has been removed from this table.

### Residual review gaps (post-v8.1 verification)

Verified residual items from `/ship` skill review (`docs/harness/unstaged-changes/review_report_final.md`). Critical/Correctness items from v8.1 were resolved in `11c4d5e`. **S1 and S2 shipped in v8.2.0** (see Shipped section above). **N1 shipped in v8.3.0** (`.claude-plugin/*.json` auto-detect, see Shipped section above). No further residual review gaps remain at this time.

---

## Non-Goals

Explicitly out of scope for agent-harness regardless of version:

- **Non-Claude LLM support**: agent-harness is designed for Claude Code's tool ecosystem (AskUserQuestion, sub-agents). Supporting OpenAI/Gemini/local models would require a different architecture.
- **Git-free-only dedicated CLI**: git-free mode is already supported (auto-detected). A separate non-git CLI adds complexity without proportional benefit.
- **Automatic code application without HARD-GATE**: All AI-generated diffs require explicit user confirmation before apply. Auto-apply is permanently out of scope.
- **Internet-dependent features as required dependencies**: WebSearch is used opportunistically (migrate skill). No feature should fail hard when offline.
