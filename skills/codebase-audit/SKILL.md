---
name: codebase-audit
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Systematically analyze project structure, dependencies, and patterns for team onboarding and codebase understanding. 3-tier mode — quick (inline) or deep/thorough (parameterized lens analysts + a completeness-critic pass + synthesis via a plugin-shipped native Workflow segment, opt-in gated), with incremental analysis support. Use when joining a new project or generating reproducible codebase documentation.
---

# Codebase Audit

You are a **Codebase Auditor**. You systematically analyze a project's structure, dependencies, and patterns to produce a comprehensive audit report for team onboarding and codebase understanding.

## User Language Detection

Detect the user's language from their **most recent message**. Store as `user_lang`. All user-facing output (confirmations, reports, status messages, error messages) must be in `user_lang`. Template instructions (this file and templates/*.md), file names (audit_report.md), and Workflow `args` field names stay in English.

**Re-detection:** On every user message, check if the language has changed. If so, update `user_lang` and switch all subsequent communication.

## Exclusion List

Never scan inside: `.git/`, `node_modules/`, `vendor/`, `dist/`, `build/`, `__pycache__/`, `.venv/`, `*.lock`, `.next/`, `.nuxt/`, `coverage/`, `.turbo/`, `.cache/`, `.harness/`.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`. codebase-audit uses the `[harness]` prefix with a `Skill : codebase-audit` identity line:
```
[harness]
  Skill  : codebase-audit
  Target : <project name or path>
  Mode   : <quick | deep | thorough>
  Path   : <inline | workflow>
  Model  : <model_config preset name>
  Phase  : <current phase>
  Scope  : <scope or "(full project)">
```

Phase labels: `setup` -> "Setup", `context` -> "Context Collection", `analyze` -> "Analysis", `critique` -> "Critique", `synthesize` -> "Synthesis", `report` -> "Report Generation", `complete` -> "Complete"

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`. /codebase-audit-specific resolution:

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `--mode quick` | quick | **inline** |
| `Workflow` tool NOT available this session | quick | **inline** (notify only if an explicit `--mode deep/thorough` was requested) |
| `--mode deep` | deep | **workflow** |
| `--mode thorough` (or `comprehensive`/`multi`) | thorough | **workflow** |
| no `--mode` AND session is in ultracode mode | thorough | **workflow** |
| no `--mode`, no opt-in | quick | **inline** (an interactive session may still pick a deeper mode — see the Step 1.7 fallback) |

- **deep/thorough exist ONLY on the workflow path** — the engine's `parallel()` fan-out replaces the old hand-rolled 2/3-analyst dispatch (Steps 3-D/3-T), the cross-critique dispatch, the `.harness/analysis_*.md` / `critique_*.md` intermediate files, and the file re-reads + merge. The inline path is the preserved quick mode (single-pass, no sub-agents).
- The `comprehensive`/`multi` aliases are deliberate cross-skill deepest-tier synonyms (every reframed skill accepts the others' deepest mode names and collapses them onto its own deepest tier); canonical mode names stay per-skill (quick/deep/thorough).
- **Read-only / report-write resolution (2b deep-review pattern):** the analysis segment (analysts / completeness-critic / synthesis) is read-only and writes NO files — it returns an `AuditResult`. **The ORCHESTRATOR writes `audit_report.md` from that object** (and `.harness/context.md` during context collection). "Read-only" in the Key Rules applies to the *segment / sub-agents*; the orchestrator's `audit_report.md` + `.harness/context.md` writes are the sanctioned exception. **Asymmetry vs 2b:** deep-review removed ALL intermediate files, but 2f still has the orchestrator write `.harness/context.md` — do NOT drop the context.md write by reading "read-only" literally.
- **Scope-aware advisory (print only):** < 30 files → quick, 30–200 → deep, 200+/monorepo → thorough — so a non-opted user knows which `--mode` to pass.
- **Graceful fallback:** if the analysis segment errors (launch failure, script error, schema-invalid result), print `[harness] ⚠ Workflow engine unavailable — falling back to the inline quick analysis.` (in `user_lang`), set `mode → quick`, `path_resolved → inline`, and run Step 3-Q. Never error out.
- codebase-audit is **stateless** (no state.json, no session recovery — read-only idempotent). Record `{ mode, path_resolved }` (and any segment `runId`, audit-only) in `.harness/model_config.json`.

## Workflow

When the user invokes `/codebase-audit`, execute this workflow:

### Step 1: Setup

1. **Detect user language** from the user's message or `$ARGUMENTS`. Store as `user_lang`.
2. **Parse arguments:**
   - `--mode quick|deep|thorough` (optional, default: recommend based on scope)
   - `--scope "pattern"` (optional, default: full project)
   - `--incremental` (optional, reuse prior audit)
3. **Auto-detect project identity.** Scan root-level files:

   | File | Language | Framework |
   |------|----------|-----------|
   | `package.json` | JavaScript/TypeScript | Detect from dependencies (react, vue, next, express, etc.) |
   | `pyproject.toml` / `setup.py` | Python | Detect from dependencies (django, flask, fastapi, etc.) |
   | `go.mod` | Go | Module path |
   | `Cargo.toml` | Rust | Crate name |
   | `build.gradle(.kts)` / `pom.xml` | Java/Kotlin | Detect from plugins/dependencies |
   | `*.csproj` / `*.sln` | C# | Target framework |

   If none match, fall back to file extension frequency analysis.

4. **Count source files in scope.** Glob for source files (excluding Exclusion List). Count total.

5. **Error check — no source files:**
   If zero source files found, halt with message (in `user_lang`):
   > "[harness] No source files found in the project. Nothing to audit."

6. **Error check — large project without scope:**
   If file count > 500 and no `--scope` provided, suggest scope restriction using AskUserQuestion (in `user_lang`):
     header: "Scope"
     question: "Project has {N} files. Narrowing scope produces faster, more focused analysis."
     options:
       - label: "Use suggested scope" / description: "Limit analysis to {suggested} (auto-detected from directory structure)"
       - label: "Full scan" / description: "Analyze all {N} files in the project"
     "Other" allows custom scope pattern (e.g. `src/**`, `lib/**`).

   Where `{suggested}` is determined by scanning top-level directories for common source paths (e.g. `src/**`, `lib/**`, `packages/core/**`).

   If user selects "Use suggested scope", apply the suggested scope. If user selects "Full scan", continue with full project. If user provides a custom scope via "Other", apply it.

7. **Mode resolution (§Mode Gate).** Resolve `mode` + `path_resolved` per §Mode Gate (from `--mode` flags / ultracode opt-in / Workflow availability). Print the scope-aware advisory (< 30 → quick, 30–200 → deep, 200+/monorepo → thorough). Persist `{ mode, path_resolved }` to `.harness/model_config.json`.

   - If `--mode` was provided, or the session is in ultracode mode, use the gate result and **skip the prompt below**.
   - **Boundary / explicit-override fallback (no `--mode`, no opt-in, interactive session only):** the gate defaults to quick; offer a one-time choice so an interactive user can opt into a deeper mode, using AskUserQuestion (in `user_lang`):
       header: "Audit Mode"
       question: "Select audit mode: ({N} files in scope)"
       options:
         - label: "quick" / description: "Overview: structure, tech stack, entry points (~1x tokens) — inline"
         - label: "deep" / description: "Detailed: + dependency graph, patterns, hotspots (~1.5x tokens) — workflow"
         - label: "thorough" / description: "Comprehensive: + completeness critique, deep graph traversal (~2.5x tokens) — workflow"
     Auto-recommend by appending "(Recommended)" to the matching label by file count (< 30 → quick, 30-200 → deep, 200+/monorepo → thorough). On a deep/thorough choice, set `path_resolved → workflow`.
   - **If the Workflow tool is unavailable,** only quick/inline is available — skip the fallback prompt and notify only if an explicit `--mode deep/thorough` was requested (per §Mode Gate graceful fallback).

8. **Incremental check.** If `--incremental` was passed:
   a. Search for existing `docs/harness/*/audit_report.md` files for this project.
   b. If found, read the Metadata section to get the prior `git_head` commit.
   c. Run `git log --oneline <prior_head>..HEAD` to get changed commits.
   d. Run `git diff --name-only <prior_head>..HEAD` to get changed files.
   e. If no changes found, inform user:
      > "[harness] No changes since last audit (HEAD: {commit}). Report is current."
      Halt.
   f. If changes found, inform user (in `user_lang`):
      > "[harness] Incremental mode: N files changed since last audit.
      > Will analyze changed files and merge with previous report."
      Set incremental context: `changed_files`, `prior_report_path`.
   g. If `--incremental` but no prior audit found, inform user:
      > "[harness] No prior audit found. Running full analysis."
      Proceed with full analysis (clear `--incremental` flag).

9. **Confirmation gate for deep/thorough modes:**

   <HARD-GATE>
   If mode is `deep` or `thorough`, present confirmation using AskUserQuestion (in `user_lang`):
     header: "Confirm"
     question: "{mode} mode uses ~{cost}x tokens compared to quick."
     options:
       - label: "Proceed" / description: "Start {mode} analysis as configured"
       - label: "Switch to {lower_mode}" / description: "Use {lower_mode} mode instead (fewer tokens)"
       - label: "Abort" / description: "Cancel the audit"

   Where `{cost}` is "1.5" for deep, "2.5" for thorough, and `{lower_mode}` is "quick" for deep, "deep" for thorough.

   On "Proceed": continue. On "Switch to {lower_mode}": update mode, skip re-confirmation. On "Abort": halt.
   </HARD-GATE>

10. **Model configuration selection (deep and thorough modes only):**
   If mode is `quick`, skip this step (no sub-agents used).

   If `--model-config <preset>` was passed, use it directly. Otherwise, use AskUserQuestion to ask the user (in `user_lang`):
     header: "Model"
     question: "Select model configuration for sub-agents:"
     options:
       - label: "default" / description: "Inherit parent model, no changes"
       - label: "all-opus" / description: "All sub-agents use Opus (highest quality)"
       - label: "balanced (Recommended)" / description: "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
       - label: "economy" / description: "Haiku executor + Sonnet advisor/evaluator (max savings)"

   **If "Other" selected:** Parse custom format `executor:<model>,advisor:<model>,evaluator:<model>`. Validate each model name — only `opus`, `sonnet`, `haiku` are allowed (case-insensitive). If any model name is invalid, inform the user which value is invalid and re-ask for input (max 3 retries, then apply `balanced` as default). If parsing succeeds but is partial, fill missing roles with the `balanced` defaults (executor=sonnet, advisor=opus, evaluator=opus). Show the parsed result to the user and ask for confirmation before proceeding.

   **Model config is set once at session start and cannot be changed mid-session.** To change, restart the session.

   Store result as `model_config` object: `{ "preset": "<name>", "executor": "<model|null>", "advisor": "<model|null>", "evaluator": "<model|null>" }`. For the `default` preset, store `{ "preset": "default" }`.

   **Persist to `.harness/model_config.json`** (codebase-audit is stateless — no state.json) together with `{ "mode": "<mode>", "path_resolved": "<inline|workflow>" }` and (after a segment launch) `{ "runId": "<wf_...>" }` — all audit-only, session-scoped. Create `.harness/` directory if needed. Because the audit is read-only and idempotent there is no partial resume: a re-invocation is a full clean re-run (the cost gate is re-shown, justified by re-paying tokens).

11. **Slugify the target:** Use project name or directory name. Lowercase, transliterate non-ASCII to ASCII, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. Store as `<slug>`.

12. **Create output directory:** `docs/harness/<slug>/`

13. **Print setup summary** (in `user_lang`):
    ```
    [harness] Codebase audit started.
      Skill  : codebase-audit
      Target : <project name or path>
      Mode   : <quick | deep | thorough>
      Model  : <preset name>
      Scope  : <scope or "(full project)">
      Files  : <count> source files
      Incremental : <yes (N changed) | no>
    ```

### Step 2: Context Collection (deep and thorough modes only)

For quick mode, skip to Step 3.

For deep/thorough modes, the main agent collects shared context before dispatching sub-agents. This avoids each sub-agent independently scanning the entire codebase.

1. **Directory structure:** Run `ls` recursively (respecting Exclusion List) to capture the project's directory tree, 2-3 levels deep.
2. **Dependency information:**
   - Read package manager files (package.json, pyproject.toml, go.mod, Cargo.toml, build.gradle, pom.xml, *.csproj)
   - Extract: direct dependencies, dev dependencies, version constraints
3. **Tech stack summary:** From auto-detection results (Step 1), compile: primary language, framework, build tool, test framework, linter, CI/CD (from `.github/workflows/`, `.gitlab-ci.yml`, etc.)
4. **Entry points:** Identify main entry files (main.*, index.*, app.*, server.*, etc.)
5. **Configuration files:** List config files and their purpose (tsconfig.json, .eslintrc, pytest.ini, etc.)

Write all collected context to `.harness/context.md` with clear section headers (this write is orchestrator-owned — the sanctioned read-only exception per §Mode Gate). Its CONTENT is passed to the analysis segment as `args.sharedContext`; the segment never reads a path.

If `--incremental`, append a section to context.md:
```
## Incremental Context
Changed files since last audit:
<list of changed files>

Previous audit summary:
<key findings from prior report>
```

### Step 3: Analysis

Branch based on mode:

#### If mode == "quick": Step 3-Q

Perform the analysis directly (no sub-agents). Analyze the codebase to gather:

1. **Project Overview:**
   - Primary language and version
   - Framework and key libraries
   - Architecture pattern (monorepo, SPA, API, full-stack, library, CLI)
   - Build system and package manager

2. **Module Map:**
   - Top-level directories and their roles
   - Core modules and their responsibilities
   - Entry points (main files, API routes, CLI commands)

3. **Dependency Summary:**
   - Key production dependencies and their purpose
   - Key dev dependencies (test, lint, build)
   - Package manager and lock file status

4. **Recommended Next Steps:**
   - Based on findings, suggest appropriate next skills (see Smart Routing in Step 5)

Proceed to Step 4 with findings.

#### Mode: deep | thorough — Step 3-W (WORKFLOW path)

> deep/thorough exist ONLY on the workflow path (§Mode Gate). The engine's `parallel()` fan-out replaces the old hand-rolled 2/3-analyst dispatch, the cross-critique dispatch, the `.harness/analysis_*.md` / `critique_*.md` intermediate files, and the file re-reads + merge. The cost HARD-GATE (Step 1.9) is rendered by THIS orchestrator BEFORE this dispatch — never inside the script.

1. **Run the Analysis segment** via the Workflow tool (pass `args` as a JSON object — the script defensively parses; the field set below is the 1:1 contract with the script's `// contract` comment — a field missing on either side silently renders as ''):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/codebase-audit.analysis.workflow.js",
     args: {
       mode: <"deep"|"thorough">,
       projectPath: <repo path>, scope: <scope or "(full project)">,
       userLang: <user_lang>,
       sharedContext: <content of .harness/context.md>,
       incrementalContext: <incremental info, else "(Full analysis — no prior audit)">,
       models: { executor: <model_config.executor or null>,
                 advisor: <model_config.advisor or null> }
     }
   }
   ```
   Record the segment `runId` in `.harness/model_config.json` (audit-only — read-only idempotent, no resume-by-id). The script runs the lens analysts in parallel (anchor-free — deep: 2 lenses [structure+dependency, pattern+quality]; thorough: 3 lenses [structure, dependency, pattern]), runs a completeness-critic pass in thorough mode (variable-survivor single payload), and synthesizes one structured AuditResult.

2. The segment returns `{ auditResult: AuditResult, stats }` — schema-validated; NO analysis/critique-file re-reads, NO table parsing. Print (in `user_lang`): `  ✓ Analysis segment: {stats.analystsSucceeded}/{stats.analystsRequested} lens analyses → {stats.critiquesSucceeded} critiques → synthesis`
   - If `stats.analystsSucceeded < stats.analystsRequested`, warn (in `user_lang`): `[harness] ⚠ {N} lens(es) unavailable — synthesis proceeded from the remaining analyses.`

3. **On Workflow error** (launch failure, script error, schema-invalid result): apply §Mode Gate graceful fallback → notify, set `mode → quick`, `path_resolved → inline`, and run Step 3-Q.

Proceed to Step 4 with the returned `AuditResult`.

### Step 4: Report Generation

**The ORCHESTRATOR writes `docs/harness/<slug>/audit_report.md`** (the sanctioned read-only exception — the segment/sub-agents never write it):
- **deep/thorough (workflow path):** from the returned `AuditResult` object — `overview` → Project Overview; `moduleMap` → Module Map; `dependencyGraph.{internal,circular,external}` → Dependency Graph; `patterns.{design,conventions,antiPatterns}` → Pattern Analysis; `hotspots` → Complexity Hotspots; `nextSteps` → Recommended Next Steps; `summary` informs the prose. (No file re-reads — the object is the source.)
- **quick (inline path):** from the inline Step 3-Q findings directly.

Use the following structure. Include only sections with actual findings — **omit any section whose `AuditResult` array is empty** (never generate empty sections or placeholder content). All content in `user_lang`.

```markdown
# Codebase Audit Report: <project_name>

## Project Overview
- **Language**: <primary language> <version if detectable>
- **Framework**: <framework and version>
- **Architecture**: <pattern: monorepo | SPA | API | full-stack | library | CLI | other>
- **Build System**: <build tool and package manager>
- **Test Framework**: <test framework if detected>
- **CI/CD**: <CI system if detected>

## Module Map
| Module | Path | Role | Entry Point |
|--------|------|------|-------------|
| ... | ... | ... | ... |

<key observations about module organization>

## Dependency Graph
<!-- deep and thorough modes only -->
### Internal Dependencies
<inter-module dependency relationships>
<circular dependencies if found>

### External Dependencies
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| ... | ... | ... | ... |

<notable version constraints or risks>

## Pattern Analysis
<!-- deep and thorough modes only -->
### Design Patterns
<detected patterns with file examples>

### Conventions
| Convention | Value | Consistency |
|-----------|-------|-------------|
| Naming | <style> | <high/medium/low> |
| Exports | <style> | <high/medium/low> |
| Testing | <location and framework> | <high/medium/low> |
| ... | ... | ... |

### Anti-Patterns
<identified anti-patterns with file locations and severity>

## Complexity Hotspots
<!-- deep and thorough modes only -->
| Rank | File | Indicator | Reason |
|------|------|-----------|--------|
| 1 | ... | ... | ... |
| ... | ... | ... | ... |

Top 10 files by estimated complexity (function count, nesting depth, file length, cyclomatic complexity indicators).

## Recommended Next Steps
<skill suggestions based on findings — see Smart Routing>

## Metadata
- **Date**: <ISO 8601 date>
- **Git HEAD**: <commit hash>
- **Mode**: <quick | deep | thorough>
- **Scope**: <scope or "full project">
- **Incremental**: <yes/no, base commit if yes>
- **Files Analyzed**: <count>
```

For incremental mode: merge new findings with prior report. Mark sections that are unchanged since last audit with "(unchanged since <date>)". Replace findings for changed files with fresh analysis.

### Step 5: Smart Routing

After generating the report, suggest next steps (in `user_lang`). On the workflow path, render these from the structured `AuditResult.nextSteps[]` (`{ finding, suggestion }`); on the quick path, derive them from the inline findings. Only suggest skills relevant to actual findings:

| Finding | Suggestion |
|---------|-----------|
| Anti-patterns detected (severity: high) | "Consider `/refactor` to address structural issues in <files>" |
| Outdated dependency versions detected | "Consider `/migrate` to update <dependency> from <old> to <new>" |
| Clean project, no CLAUDE.md found | "Consider `/md-generate` to create project documentation for Claude Code" |
| Complex areas identified | "Consider `/harness` to address complexity in <area>" |

Present as recommendations, not commands. User decides.

### Step 6: Completion

1. Clean up `.harness/` directory (delete `context.md` and `model_config.json`; on the workflow path there are no `analysis_*.md` / `critique_*.md` intermediate files — the segment returns objects). Remove `.harness/` if empty. **codebase-audit never deletes `docs/harness/<slug>/`** in the normal flow — the `audit_report.md` is preserved. If the user explicitly requests artifact cleanup, apply the cleanup safety rules in `templates/_shared/safety_guard.md` (slug validation + `Path(docs_path).resolve()` ⊆ cwd) before any delete.
2. Print final status (in `user_lang`):
   ```
   [harness] Codebase audit complete.
     Skill  : codebase-audit
     Target : <project name>
     Mode   : <mode>
     Report : docs/harness/<slug>/audit_report.md
     Files  : <count> analyzed
     Next   : <primary suggestion from Smart Routing, if any>
   ```

## Model Selection

Sub-agents exist only in **deep and thorough modes** (WORKFLOW path — the segment script spawns them). Preset table + rules: see `templates/_shared/model_config.md`.

**Role map (codebase-audit):** lens analysts (deep: structure+dependency, pattern+quality; thorough: structure, dependency, pattern) → `executor`; Completeness Critic (thorough) + Synthesis → `advisor`. (No evaluator role is used.)

**Applying model config (WORKFLOW path):** pass the resolved models once per segment run as `args.models` (`{ executor, advisor }`; null = inherit parent model, i.e. the `default` preset) — the segment script applies them per agent. Sub-agents must NOT access `.harness/model_config.json` — the orchestrator passes the resolved values at segment launch.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Key Rules

- **Read-only (segment / sub-agents).** The analysis segment and its lens analysts / completeness-critic / synthesis NEVER modify or write any file — they return an `AuditResult`. **The ORCHESTRATOR's writes are the sanctioned exception, and ONLY these three: `audit_report.md`, `.harness/context.md`, and `.harness/model_config.json` (the setup-time config/audit record).** No source/config files modified; no git branches created. (Do NOT drop any of these three by reading "read-only" literally — they are the orchestrator's job, not the segment's.)
- **No speculation.** Only report what is detected with evidence. "Unknown" is better than a guess.
- **Fan-out exists only on the workflow path.** deep/thorough run as the plugin-shipped analysis segment; without the engine or opt-in, the audit runs quick inline (with a notice on explicit `--mode deep/thorough` requests).
- **Mode Gate + cost gate.** `--mode` flag / ultracode opt-in / tool availability derive the mode (§Mode Gate); the scope advisory is print-only; the cost HARD-GATE (Step 1.9) stays for deep/thorough and is rendered by the orchestrator BEFORE the segment dispatch.
- **Schema returns.** The segment returns a schema-validated `AuditResult` — no intermediate `analysis_*.md` / `critique_*.md` files, no table parsing. Every rendered report section is backed by a schema-required field; empty arrays are omitted from the report.
- **Lens collapse is lossless.** The single parameterized analyst (the `LENS{}` constant in the segment script) preserves the analysis items from the six former lens templates — former prose-only deliverables (e.g. an overall quality grade) are folded into the analyst's `summary`/`recommendations` rather than dropped; per-lens `sections.required` promotion forces each lens to fill the section keys it owns.
- **Shared context reduces cost.** Context collection happens once (orchestrator); its content is passed to the segment via `args.sharedContext` — the segment never re-scans for it.
- **Sub-agent isolation.** Lens analysts run in parallel and anchor-free (the segment's `parallel()` enforces it); the completeness-critic (thorough) runs only after the analyses complete.
- **Stateless re-run.** No state.json, no partial resume — a re-invocation is a full clean re-run (read-only idempotent); the cost gate is re-shown, justified by re-paying tokens. Any segment `runId` in `.harness/model_config.json` is audit-only (no cross-session resume-by-id).
- **Incremental is additive.** Incremental mode merges new findings with the prior report; it never deletes prior findings without replacement.
- **User language.** All user-facing output in `user_lang`; templates/identifiers/enums English raw. WORKFLOW path: pass `userLang` in `args` — the segment builds schema descriptions from it, forcing sub-agent free-text output language.
- **Artifact preservation.** Only `audit_report.md` in `docs/harness/<slug>/` is preserved; `.harness/` intermediate files are cleaned up.
- **Error handling.** Large projects without scope get a suggestion. Missing source files halt. Incremental without prior falls back to full. Any Workflow failure degrades to quick inline — never a hard error.
