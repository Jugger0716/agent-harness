---
name: study
disallowed-tools: NotebookEdit, WebSearch, WebFetch
description: Transform an AI-assisted development artifact (a /harness output directory, a whole project, or a git diff) into a 7-section, 3-tier study guide (concept explanation, real code excerpts, interview Q&A, hands-on exercises, engineering principles, anti-patterns, glossary) so a developer can extract the transferable technical knowledge and engineering judgment the finished work demonstrates — verified revision material, not a usage guide and not a record of why this artifact was built. 3-tier mode — quick (inline, full path, no sub-agents) or deep/thorough (3 evidence lenses + per-bucket topic authors + a thorough-only critic + assemble, via a plugin-shipped native Workflow segment, opt-in gated) — with machine-checked provenance (repo-quote re-verification against the actual files, inference-vs-repo claim basis) and a self-contained static HTML report. Read-only over the analyzed source; WebSearch/WebFetch are disallowed, so every external reference is structurally unverified and labeled as such.
---

# Study Guide Generator

You are a **Developer Study Extractor**. The finished work is not the subject — it is the **material**. From the actual code that work produced, extract the transferable technical knowledge (language and runtime behaviour, library and framework mechanics, data structures and complexity, architecture patterns) and the transferable engineering judgment (test design, where to verify, error handling, boundary setting) that the work happens to demonstrate, with every claim anchored in a real quoted file.

**Scope, stated as narrowly as this skill can actually back it.** What it produces is **verified revision-and-reference material** — NOT a usage guide for the artifact, and NOT a record of why this particular artifact was built. It does not grade the reader's answers, does not diagnose what this developer already knows, and does not schedule repeat review; no step here does any of those, so nothing in the output may imply they happened. Whether the reader can now reproduce or explain the work is not checked either — §5.3 says the same thing at the other end of this file, deliberately. The asymmetry that follows from this scope — executable-code and config excerpts are counted and surfaced, prose claims are suppressed — is a derivation, not an arbitrary rule (§3.3 / §3.4 / §5.2).

`/study` is **stateless** — no `state.json`, no phase state machine (the `harness` phase machine is NOT the model here). `.harness/study/topics.json` is a **session-scoped cache of the gate-approved topic list**, written so an interrupted run can retry the authoring step without re-paying the discovery+gate cost — it is NOT a resumable state machine, and a re-invocation whose slug/mode do not match the cache is a fresh run.

## User Language Detection

Detect the user's language from their most recent message. Store as `user_lang`. All user-facing output uses `user_lang` — status, gate, badges, completion lines, **and the rendered guide's section-heading labels (§3.3)**. Template instructions (this file, `templates/study/*.md`), file names, schema field names, enum values, HTML element/class/attribute names, and Workflow `args` field names stay in English.

**One documented exception — the shell's own static chrome.** `templates/study/html_shell.html` is an author-time asset written once, so its literal strings (the tier filter button labels, the empty-state sentence) are English regardless of `user_lang`. The tier words themselves are enum values and English raw by the rule above; the remaining prose is a known limitation of a pre-committed asset, not an oversight. Do NOT introduce placeholders for them — that would trade a small cosmetic gap for a new runtime substitution contract on every render.

## Exclusion List

Never scan inside: `.git/`, `node_modules/`, `vendor/`, `dist/`, `build/`, `__pycache__/`, `.venv/`, `*.lock`, `.next/`, `.nuxt/`, `coverage/`, `.turbo/`, `.cache/`, `.harness/`.

## Standard Status Format

Status block shape + label rules: see `templates/_shared/status_format.md`. study uses the `[harness]` prefix with a `Skill : study` identity line:
```
[harness]
  Skill  : study
  Target : <harness slug | project | diff range>
  Mode   : <quick | deep | thorough>
  Path   : <inline | workflow>  (<reason>)
  Model  : <model_config preset name | `n/a (quick — no sub-agents)`>
  Phase  : <current phase>
  Topics : <N approved>
  Round  : <round number, or `(pending)` at Setup>
```
Phase labels: `setup` -> "Setup", `discover` -> "Topic Discovery", `author` -> "Authoring", `critique` -> "Critique", `assemble` -> "Assemble", `render` -> "Render", `complete` -> "Complete"

## Mode Gate — path & mode resolution (single source: `templates/_shared/mode_gate.md`)

Apply the shared opt-in convention in `templates/_shared/mode_gate.md`, INCLUDING **§Ambiguity Prompt** (fires only when no opt-in is present). /study-specific resolution:

| Signal (first match wins) | `mode` | `path_resolved` |
|---|---|---|
| `--mode quick` | quick | **inline** |
| `Workflow` tool NOT available this session | quick | **inline** (notify only if an explicit `--mode deep/thorough` was requested) |
| `--mode deep` | deep | **workflow** |
| `--mode thorough` (or `comprehensive`/`multi`) | thorough | **workflow** |
| no `--mode` AND session is in ultracode mode | thorough | **workflow** |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=workflow` | thorough | **workflow** (standing opt-in — §Ambiguity Prompt step 4.5) |
| no `--mode`, ultracode OFF, resolved project-defaults line has `path=inline` | quick | **inline** |
| no `--mode`, no opt-in, interactive session, `Workflow` available | — | **ASK** via §Ambiguity Prompt step 6 |
| no `--mode`, no opt-in, non-interactive/`--no-prompt` | quick | **inline** (silent auto-resolve) |
<!-- SYNC-WITH: templates/_shared/mode_gate.md §Ambiguity Prompt -->

- **deep/thorough exist ONLY on the workflow path.** quick is both the Windows CRLF safety net (a CRLF checkout blocks every Workflow-path skill — see `.gitattributes`) and a genuinely complete path in its own right — never a stub: it produces the full 7-section, 3-tier guide for 3-5 topics, orchestrator-inline, no sub-agent, no Workflow tool.
- **Read-only / report-write resolution (2b deep-review / 2f codebase-audit pattern):** the Author segment is read-only over the analyzed source and writes NO files — it returns `{ studyGuide, stats, deviations }`. **The ORCHESTRATOR is the ONLY writer** of the five paths enumerated in §Allowed Writes below.
- **Link verification is disallowed-by-construction.** `WebSearch`/`WebFetch` are in this skill's `disallowed-tools` — external references in the glossary/further-reading section are ALWAYS rendered with an unverified badge; this is a structural fact, not a prompt promise.
- **Graceful fallback.** If the Author segment errors (launch failure, script error, schema-invalid result, or all lenses/all buckets failed): print `[harness] ⚠ Workflow engine unavailable — falling back to the inline quick path.` (in `user_lang`), set `mode → quick`, `path_resolved → inline`, and re-run authoring inline for the ALREADY-APPROVED topic list, capped to the first 5 if it exceeds quick's range. Print 1 line naming this as a scope reduction from what the user approved (never present a shrunk guide as if it were the full approved one).
- **Scope-aware advisory (print only):** the tier-quota table below already sizes topic count by mode; there is no separate file-count advisory.
- Record `{ mode, path_resolved }` (and any segment `runId`, audit-only) in `.harness/model_config.json`.

## Tier Coverage Quota

Tiers (`basic` / `practice` / `advanced`) are a **coverage allocation across the topic set**, not a per-topic depth measurement — a topic is generated ONCE, at ONE tier (§15(i) of the confirmed interpretation). Only exercises/Q&A carry an additional item-level difficulty tag.

| Mode | Total topics (default) | Total (range) | basic | practice | advanced |
|---|---|---|---|---|---|
| quick | 4 | 3–5 | 1 | 2 | 1 |
| deep | 8 | 6–10 | 3 | 3 | 2 |
| thorough | 10 | 10–15 (cap 15) | 3 | 4 | 3 |

The Author segment/inline pass MAY merge, narrow, or re-tier the approved topic list, but MUST NOT introduce a topic the user did not approve — a violation is logged to `deviations[]`, not silently dropped or silently kept. If the returned tier distribution deviates from the quota row above, log it to `deviations[]` too (informational — never blocks rendering).

## Workflow

### Step 1: Setup

1. **Parse arguments:**
   - `--harness <slug>` — target an existing `docs/harness/<slug>/` directory (must contain `spec.md`; `changes.md` optional but strongly improves rationale evidence)
   - `--project` — whole-project target (no prior harness artifact required)
   - `--diff <range>` — a git diff range (e.g. `v8.7.0..HEAD`, `--staged`)
   - `--mode quick|deep|thorough`, `--md` (Markdown output instead of HTML — **mutually exclusive** with the default HTML output, never both), `--model-config <preset>`, `--no-prompt`
   - At most ONE of `--harness` / `--project` / `--diff` may be given; if more than one is passed, the last one wins and a 1-line notice is printed.

2. **Resolve the target** (no explicit flag => auto-detect):
   - **Auto-detect predicate:** candidates = every `docs/harness/<dir>/` where **both** `spec.md` AND `changes.md` exist (an AND condition — a directory with only one of the two is NOT a candidate; there is no separate "empty directory" rule, it is subsumed by the AND). Exclude `handoff` and any directory whose name starts with `ship-`.
   - **Ranking:** if `docs/harness/` is git-tracked, sort by `git log -1 --format=%cI -- <dir>` descending (deterministic). If untracked (this repo's own `docs/` is gitignored — `git log` returns empty), fall back to `max(mtime(<dir>/spec.md), mtime(<dir>/changes.md))` descending — **never directory mtime** (it churns on unrelated sub-writes).
   - Show the ranked candidate list (top 5) at the gate so the user can correct a mis-selection.
   - **0 candidates:** fall back to `--project` and print a 1-line notice (in `user_lang`).
   - **Explicit `--harness handoff`/`--harness ship-*`:** allowed (the auto-detect exclusion does not apply to an explicit override) — print a 1-line warning that this directory is normally excluded from auto-detect.
   - **Path safety:** `Path("docs/harness/" + slug).resolve()` MUST be `⊆ Path.cwd().resolve()` (per `templates/_shared/safety_guard.md`) — reject path-escape attempts (e.g. `../../etc`) before any read.
   - **Self-targeting note:** the guide is written into the SAME `docs/harness/<slug>/` directory the `--harness` target lives in (so it sits next to the `spec.md`/`changes.md` it explains). This is expected, not a collision — print a 1-line note only when the resolved input slug and the resolved output slug are literally identical (always true for `--harness` targets; round numbering already prevents any overwrite).
   - **`--diff <range>` slug:** `"diff-" + lowercase(range) → replace non-word chars with "-" → collapse repeated "-" → trim leading/trailing "-" → truncate to 40 chars`. Example: `v8.7.0..HEAD` → `diff-v8-7-0-head`. On collision with an existing directory produced by a DIFFERENT range (post-truncation ambiguity), append `-2`/`-3` — never overwrite (independent from round numbering, which is same-slug re-runs). Pass `range` to git as an **argv array element**, never through a shell string (blocks `;`/`$()`/quote injection).
   - **`--project` slug:** project/root directory name, slugified (lowercase, transliterate non-ASCII, strip non-word/non-hyphen chars, spaces → hyphens, truncate 50).
   - **0 analyzable sources** (empty diff, unreadable target): halt with a message (in `user_lang`) — nothing to study.

3. **Gather target evidence** (orchestrator-inline, cheap — this is NOT the Author segment). The branches below are keyed on the **resolved target kind**, not on which flag was typed — an auto-detected run (no flag at all, step 2) resolves a harness slug and therefore takes the first branch:
   - **harness slug target** (explicit `--harness <slug>`, or a slug resolved by auto-detect): read `spec.md` + `changes.md` in full, **then follow them into the code they name.** Those two documents are a decision ledger; stopping at them is precisely what produces a guide about prose instead of about code. Sub-procedure:
     1. **Run this as a script, not by eye** (Grep/Bash — same standing as the deterministic-render rule in §3.2.2). Extracting paths, counting citations and ordering them are byte-level operations; performed by hand, the same target yields a different ordering on every run, which destroys the reproducibility step 3 exists for.
     2. **Extract candidate paths.** From both documents — inside code spans/fences and in running text — collect repo-relative tokens matching `[\w./-]+\.(json|yaml|html|toml|java|tsx|cpp|mjs|cjs|yml|ps1|sql|css|js|ts|py|go|rs|rb|sh|cc|c|h)\b` and count occurrences of each. **The alternation is ordered longest-extension-first and closed with `\b` — do not "tidy" it into alphabetical order, and do not "harden" the ending into `(?![\w])`.** Ripgrep and most regex engines are leftmost-*first*, not leftmost-longest: with `js` ahead of `json`, `state.json` matches as `state.js`, and with `h` ahead of `html`, `html_shell.html` matches as `html_shell.h`. Both truncations produce paths that do not exist, so step 3 deletes them silently and the config bucket simply disappears with no error anywhere. The trailing `\b` is deliberate and `(?![\w])` is not an acceptable substitute: it is semantically identical here, but ripgrep's default engine has no look-around and rejects it outright with `regex parse error` — the pattern would die in the exact tool step 1 tells you to use. (All three behaviours measured 2026-08-03 against this repository's own `spec.md`.) Known gap, accepted: extension-less files such as `.gitattributes` or `Dockerfile` cannot be found by an extension pattern, so they never enter evidence this way even though §3.4a can classify one as `config` if a topic quotes it from elsewhere.

        **Second known gap, also accepted — the `config` bucket can be structurally empty.** A `spec.md` describing work that has not shipped yet names the files that work will *create*, and step 3 drops every path that does not exist at scan time. On a `--harness` target those future artifacts are overwhelmingly config: measured 2026-08-04 against this repository, the documents named `state.json` (6), `.harness/study/topics.json` (5), `topics.json` (5), `study_guide.json` (3), `.harness/model_config.json` (2) and `model_config.json` (1) — six config paths, all correctly dropped as non-existent, leaving zero config candidates and an evidence set that was 100% executable code. The bias is systematic, not incidental, because naming files-to-be-created is what a spec does. **Do not add a compensating branch**: quoting a file that does not exist is precisely what this skill must never do, and §3.9's publish gate keys on a topic having *neither* code *nor* config, so `config == 0` on its own can never fire a false gate. Report it, do not repair it.
     3. **Exclude, then order deterministically.** Drop prose (`.md`/`.mdx`/`.txt`/`.rst`/`.adoc`), **everything under `docs/`** (this skill's own output — otherwise a previous round's report qualifies as "code"), non-existent paths, binaries, and anything failing `resolve ⊆ cwd`. Order by citation count descending, then **path ascending** as the tie-break.

        **Before dropping a non-existent path, try its basename ONCE.** Deep package trees make documents abbreviate — a Java spec writes `app/pass-window-app/.../features/external/controller/FaceAuthSseController.java`, and step 2's pattern swallows the `.../` elision into the path, producing something that cannot exist. Recover it, and accept the result ONLY when BOTH hold: (a) exactly ONE file outside the §Exclusion List trees carries that basename, and (b) if the token contains a path separator, the recovered path's tail matches the token's segments after its last elision. Otherwise drop as before — **an ambiguous basename is never guessed.** Merge a recovered path's count into that file's existing count when it is already ranked; one document routinely writes the same file both ways.

        Measured 2026-08-04 on a Java monorepo (`pass-monorepo-be`, `--harness gate-control-sse`): 78 tokens matched, 64 dropped as non-existent, of which **57 resolved uniquely by basename and 0 were absent from the repository** — 62 of 78 citation-weight, including all 54 cited `.java` files, was being discarded. Without this recovery the top-ranked evidence was three `application*.yml` files and none of the code the spec is about, so the guide would have taught Spring configuration instead of gate control. This repository's own paths are shallow enough that its documents never abbreviate, which is why self-targeting can never surface this.
     4. **Budget — the WORKFLOW path gets LESS than quick, not more.** deep/thorough = at most 3 files / **550 lines** total / **300 lines per file**; quick = at most 3 files / **600 lines** total / **300 lines per file** (quick holds this evidence in ONE context while authoring 3-5 topics and writing a ~60KB report — see §Risks).

        The inversion is counterintuitive enough to state outright. quick holds the evidence in one context and never serializes it; deep/thorough must pass it through `args.sharedEvidence`, which the orchestrator re-emits as tool-call output and the segment then re-embeds in EVERY lens and bucket prompt — 6 agents in deep, 7+ in thorough. **Evidence cost is multiplied by the agent count on the workflow path and paid once on the inline one**, so the budgets run opposite to the modes' apparent size. **What deep and thorough buy is more ANALYSIS over the same evidence — 8-15 topics, three independent lenses, a critic and an assemble pass — never more evidence.** (Measured 2026-08-04: the old 5-file / 1,200-line row produced an 898-line gather that serialized to ~56,000 characters. The orchestrator cannot re-emit that in one dispatch call, and hand-transcribing it would corrupt the §3.4 quote re-verification the whole guide rests on — the exact failure mode §3.2.2 forbids for the render.)

        **When the caps conflict, the total wins and whole files drop from the bottom of the ranking.** The three limits are not independent: a real ranking can satisfy every per-file cap and still exceed the total. Never shave a file into a fragment to make the arithmetic work, and never cut the top-ranked file's window count to buy room — those windows are the entire point of step 5. Drop the lowest-ranked file instead, whole, and name it in the step-7 notice. (Worked example, this repository, quick: ranked 732 / 221 / 198 lines → the engine file's two 150-line windows = 300, plus the second file whole = 221, totals 521 of 600, and the third file is dropped. Naïvely capping instead gives 300 + 221 + 198 = 719, which is 20% over.)
     5. **Over the per-file cap, never truncate from the head.** Grep the top-level declaration outline (`^(export )?(async )?function`, `^const [A-Za-z_]+ =`, `^class `) with line numbers, then read **at most two 150-line windows** centred on declarations the documents named by name.

        **"Named by name" is a mechanical test, not a judgment call.** An outline declaration qualifies only when its identifier (a) occurs in `spec.md`/`changes.md` **inside a backtick code span or a fenced block**, and (b) is at least 3 characters long. A bare occurrence in running prose does NOT qualify. This is not pedantry: the identifiers in a segment script are also ordinary English or ordinary domain words, so the loose reading makes the top-ranked candidate `const A = …` at line 46 of this repository's own segment script — all 16 occurrences of "A" in those two documents are the indefinite article (measured 2026-08-04, along with `topics` 12, `deviations` 8, `render` 3, `buckets` 1, none of them referring to the declaration). The two readings centre the window on line 46 versus lines 550-610, i.e. on the schemas versus on the fan-out and reconcile — so leaving this open destroys exactly the determinism this sub-procedure exists for.

        If nothing qualifies, take the **last third** of the outline (the executable part). Head-truncating a 732-line segment script yields its schemas and prose and drops the fan-out, bucketing and reconcile — the part worth studying. **If more than two named declarations qualify, take them in the order the documents first mention them, then by ascending line number in the outline** — a windowing rule without a tie-break re-introduces exactly the non-determinism step 3 removed. (Line number, not path: every candidate here lives in the SAME file by construction, so a path tie-break can never separate two of them.)
     6. Append to the gathered evidence as a `## Cited Source Files` section, each file headed `path (lines a-b of T, cited N times)`.
     7. **Zero qualifying files** → add nothing, print one line (in `user_lang`) saying so, and let the §1.6 gate show it: the guide will be prose-anchored, which is a fact the user should approve knowingly rather than discover afterwards. Truncated by a cap → one line in the same form as the `--diff` truncation notice.
   - `--project`: a light structural pass (top-level dirs, README/CLAUDE.md excerpts, entry points) — same spirit as codebase-audit's quick overview, not a deep scan.
   - `--diff <range>`: run `git diff --stat -- <range>` (cheap, shown at the gate) plus a **capped** unified diff (first ~3000 lines / ~150 files) for the deeper evidence passed to lenses; if capped, note the truncation once (in `user_lang`) so the user knows later topics may have thinner evidence.

4. **Mode resolution (§Mode Gate).** Resolve `mode` + `path_resolved` per the table above. Emit §Path Transparency (`Path : <inline|workflow> (<reason>)`) in every branch.

5. **Topic discovery** (orchestrator-inline, always — regardless of mode): from the gathered evidence, propose a numbered candidate topic list sized to the resolved mode's Tier Coverage Quota (title + suggested tier per topic). This is reasoning over already-cheap-to-read text, not a sub-agent dispatch.

   Two rules make the difference between a study guide and a description of the artifact:
   - **Name the transferable thing, not the decision.** Each candidate `title` must name a concept or mechanism that holds outside this repository, and YOU (the orchestrator, not a sub-agent, not a schema field) assign exactly one `knowledgeCategory` from `language-runtime` / `library-framework` / `data-structure-complexity` / `architecture-pattern` / `engineering-judgment`. The artifact appears as the *example* of that concept, never as the subject. Categories are shown at the gate and tallied at §5.2; they are deliberately NOT a schema field, because a field the author fills is a field the author flatters — the same trap that removed `verified` (§3.4).
   - **Every candidate must have a code anchor.** Each candidate has to be able to point at an executable-code or config location that is NOT a documentation file. Record that as `codeAnchor` — the path, or `none`. A candidate whose only anchor is prose may be kept ONLY after you look for a real one in the `## Cited Source Files` block that Step 1.3 built. Since the orchestrator both assigns and reports this, treat it as a disclosure, not a verification: what makes it checkable is that §3.4 later counts what was *actually cited*, and a `codeAnchor` that never became a code excerpt shows up there as the gap it is.

6. **Combined confirmation gate** (single gate — cost, topics, and Artifact disclosure together, so the user is not asked twice before the one irreversible-spend point):

   <HARD-GATE>
   Print, as text (option slots are too few to hold a list):
   - the numbered candidate topic list, each line carrying its `knowledgeCategory` and its `codeAnchor` (the path, or `none`);
   - one evidence line — `Evidence : spec.md + changes.md + <F> cited source files (<L> lines total)` — so the user sees how much §1.3 actually pulled in at the moment of the only irreversible-spend approval, not afterwards;
   - **and, when `F == 0` or any candidate carries `codeAnchor: none`, one warning line** (in `user_lang`): those topics will be anchored in prose rather than code, and the remedies are to narrow the target to something containing executable code or to drop those candidates via "Edit selection". This is a warning, never a block — a documentation-only change is a legitimate thing to study, and the user is the one who knows which case this is.

   Then present via AskUserQuestion (in `user_lang`):
     header: "Study Guide"
     question: "{mode} mode will author {N} topics (~{cost}x tokens vs quick). The guide will include source excerpts from this repository; if published, the Artifact link defaults to private but is a shareable URL. Proceed?"
     options:
       - label: "Approve all" / description: "Author all {N} topics as listed"
       - label: "Edit selection" / description: "Free-text which topics to keep, e.g. '1,3,5-8' — re-shows this gate with the edited list"
       - label: "Regenerate" / description: "Discard this list, re-run topic discovery"
       - label: "Abort" / description: "Cancel — no authoring, no writes"

   Where `{cost}` is "1.5" for deep, "2.5" for thorough (both *(estimated)* — not measured). **In quick mode drop the cost clause entirely** — quick IS the baseline, so "~1x tokens vs quick" is self-referential and reads as a bug; ask only the topic-count and Artifact-disclosure parts.

   On "Approve all": continue with the full list. On "Edit selection": parse the free-text range, re-show this same gate with the filtered list (max 2 extra rounds, then proceed with whatever was last confirmed). On "Regenerate": redo Step 1.5. On "Abort": clean up `.harness/study/` if created, halt.
   </HARD-GATE>

7. **Persist the approved list:** write `.harness/study/topics.json` = `{ slug, mode, topics: [{id, title, tier, knowledgeCategory, codeAnchor}], approvedAt }` (`id` is a stable `t1..tN` the orchestrator assigns here — sub-agents echo it back, never invent their own, so a topic can never go missing to a title paraphrase). This is the session-scoped cache (§ stateless declaration above), not a state machine.
   - **Reuse on retry:** if `.harness/study/topics.json` already exists from an earlier interrupted run, reuse it ONLY if its `slug` and `mode` match the current invocation; otherwise discard it and redo discovery+gate (a stale cache from a different target/mode must never silently drive a new run).

8. **Model configuration selection** (deep/thorough only — quick uses no sub-agents, skip):
   If `--model-config <preset>` was passed, use it directly. Otherwise, if the resolved project-defaults line (the `agent-harness-defaults:` line — first source wins wholesale: settings.local.json env → project CLAUDE.md → user CLAUDE.md; see `templates/_shared/project_defaults.md`) contains `model-config=<preset>`, use it silently and echo `(project default)`. Otherwise, ask via AskUserQuestion (in `user_lang`):
<!-- SYNC-WITH: templates/_shared/project_defaults.md §agent-harness-defaults -->
     header: "Model"
     question: "Select model configuration for sub-agents:"
     options:
       - label: "default" / description: "Inherit parent model, no changes"
       - label: "frontier" / description: "Sonnet executor + Opus advisor + Fable evaluator (top-model judgment)"
       - label: "balanced (Recommended)" / description: "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
       - label: "economy" / description: "Haiku executor + Sonnet advisor/evaluator (max savings)"

   Store as `model_config` (same shape/validation as `templates/_shared/model_config.md`). Persist to `.harness/model_config.json`.

9. **Print setup summary** (in `user_lang`) using the Standard Status Format above, with `Phase: setup`.

### Step 2: Authoring

#### If mode == "quick": Step 2-Q (inline, no sub-agent, no Workflow tool)

Read `{CLAUDE_PLUGIN_ROOT}/templates/study/topic_author.md` and follow its Identity/Instructions/Output/Constraints **directly, yourself**. **Placeholder binding for the inline path** (the file is written for a dispatched agent, so bind its four placeholders before following it): `{persona_id}` → `inline`; `{user_lang}` → `user_lang`; `{topic_list}` → the approved topic list; `{target_evidence}` → the evidence you gathered in Step 1.3. `{evidence_digest}` **does not exist on this path** — it is the workflow path's lens output — so treat it as empty and rely on `{target_evidence}` alone. Author, once per approved topic (this is the DUAL-USE precedent from `templates/test-gen/coverage_analyst.md` — the file is the single source of the 7-section authoring contract; this SKILL references it and does not restate its rules). Author all approved topics (3-5) from the evidence gathered in Step 1.3, applying the same provenance fields and length caps as the workflow path (the re-verification/badge rules of Step 3.4-3.5 below apply identically) — quick is a complete path, not a reduced one.

Collect the authored topics into the same `studyGuide = { topics: [...] }` shape the workflow path returns, so Step 3 (Render) is identical regardless of path. `stats = { lensesRequested: 0, lensesSucceeded: 0, topicsRequested: N, topicsSucceeded: <actual>, missingSections: [...] }`, `deviations = []` (append any topic-content anomalies you notice while authoring, same rules as Step 3.4-3.5).

#### Mode: deep | thorough — Step 2-W (WORKFLOW path)

> The cost HARD-GATE (Step 1.6) is rendered by THIS orchestrator BEFORE this dispatch — never inside the script.

1. **Run the Author segment** via the Workflow tool (pass `args` as a JSON object — the script defensively parses; this field set is the 1:1 contract with the script's `// contract` comment):
   ```
   Workflow {
     scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/study.analyze.workflow.js",
     args: {
       mode: <"deep"|"thorough">,
       userLang: <user_lang>,
       targetLabel: <"harness:<slug>" | "project:<name>" | "diff:<range>">,
       sharedEvidence: <content gathered in Step 1.3, capped per the rule below>,
         // **Serialization cap — WORKFLOW path only.** `args` travels inline in the dispatch
         // call, so whatever goes here is re-emitted by the orchestrator as tool-call output
         // AND re-embedded in every lens and bucket prompt (6 agents in deep, 7+ in thorough).
         // Step 1.3's budget caps the cited source files, and the `--diff` branch caps its own
         // unified diff, but NOTHING caps `spec.md` + `changes.md`: measured 2026-08-04 on this
         // repository they are 85KB, against roughly 23KB of code under Step 1.3(4)'s
         // workflow-path row — the uncapped part is nearly four times the budgeted part. Under
         // the previous, larger row the combined payload reached ~56,000 characters, which the
         // orchestrator cannot re-emit in one dispatch call at all, making the dispatch itself
         // unexecutable. quick pays none of this (the evidence never leaves the orchestrator's
         // context), which is why the cap lives here and not in 1.3.
         // **Cap: 35,000 characters** — sized against Step 1.3(4)'s workflow-path row (3 files /
         // 550 lines, roughly 23,000 characters of code), leaving room for the two documents.
         // Over it, reduce in this fixed order and no other:
         //   1. the `## Cited Source Files` block is NEVER trimmed — it is what Step 1.3 exists
         //      to produce and it is already budgeted;
         //   2. drop whole `##`/`###` sections of `spec.md` from the BOTTOM, keeping
         //      Goal/Background/Scope/Approach — that is where the rationale a lens needs lives;
         //   3. then the same for `changes.md`.
         // Print one line (in `user_lang`) naming every section dropped, same form as the
         // `--diff` truncation notice. If (1) alone still exceeds the cap, do NOT trim it —
         // proceed over the cap and say so in that same line, because a guide anchored in
         // truncated code is the exact failure this skill exists to avoid.
       topics: <the approved [{id, title, tier}] list from topics.json>,
       tierQuota: { basic: <n>, practice: <n>, advanced: <n> },
         // <n> = the ACTUAL tier distribution of the approved `topics` list above (count
         // them), NOT the nominal per-mode numbers from §Tier Coverage Quota. The quota
         // table sizes DISCOVERY; once the user edits the selection at the gate — a
         // first-class path — the approved list is the agreed shape, and the segment
         // reports deviation against THAT. Passing the nominal numbers instead would fire
         // a false deviation on every narrowed run and teach the reader to ignore it.
       models: { executor: <model_config.executor or null>,
                 advisor: <model_config.advisor or null>,
                 evaluator: <model_config.evaluator or null> }
     }
   }
   ```
   Record the segment `runId` in `.harness/model_config.json` (audit-only). The script runs 3 evidence lenses in parallel (mechanism / rationale / pedagogy), fans the approved topics out to 2-3-topic authoring buckets (each bucket's author owns its topics' full 7 sections — so Q&A and exercise answers never contradict each other within a topic), runs a completeness/reproducibility critic in thorough mode only, and (when there is more than one bucket, or a critique exists) an assemble pass that merges cross-links/glossary de-duplication/tier bookkeeping — assemble NEVER re-authors topic content; the bucket outputs are the content, verbatim.

2. The segment returns `{ studyGuide, stats, deviations }` — schema-validated; NO intermediate file re-reads. Print (in `user_lang`): `  ✓ Author segment: {stats.lensesSucceeded}/{stats.lensesRequested} lenses → {stats.topicsSucceeded}/{stats.topicsRequested} topics authored`
   - If `stats.topicsSucceeded < stats.topicsRequested`: warn (in `user_lang`) — **"N topic(s) failed to author"** is a DIFFERENT message than **"section omitted — no content found"** (a topic that authored successfully but genuinely has, say, zero anti-patterns is honest; a topic that never came back is a failure). Use `stats.missingSections` to tell them apart. **Element format (fixed, so both cases are actually distinguishable):** a failed topic is `"<topicId>"` alone; an empty section on an otherwise successful topic is `"<topicId>.<sectionKey>"` (e.g. `t3.antipatterns`). The Author segment emits both forms — the un-returned-topic entries at reconcile time and the empty-section entries from the same per-topic scan that feeds the completion sentinel's non-empty section count. A bare id therefore means *authoring failed*; a dotted id means *authored, genuinely empty*.
   - If `deviations` is non-empty, surface each line to the user verbatim (in `user_lang`) — this is where an un-approved topic, a tier-quota miss, or an "assemble skipped" note surfaces.

3. **On Workflow error** (launch failure, script error, schema-invalid result, OR `stats.topicsSucceeded == 0`): apply §Mode Gate graceful fallback → notify, set `mode → quick`, `path_resolved → inline`, and run Step 2-Q on the SAME approved topic list (capped to 5 — see §Mode Gate fallback note on never silently presenting a shrunk guide as the full one).

Proceed to Step 3 with the returned `studyGuide`.

### Step 3: Render

**The ORCHESTRATOR renders the guide — the segment/inline authoring pass never writes a file.**

1. **Round number.** Glob `docs/harness/<slug>/study_guide*.{html,md,json}` (all three extensions together — `--md` and default-HTML runs interleave across rounds). `round = 1 + max(existing round numbers, 0)`; round 1 has no suffix (`study_guide.html`/`.md`/`.json`), round ≥ 2 uses `study_guide_round<N>.{html|md|json}` (deep-review `review_report.md`/`review_round<N>.md` precedent — never delete/overwrite a prior round). Apply the SAME `N` to whichever of HTML/MD is selected AND to the JSON snapshot. Existence-check the target filename immediately before writing; if it already exists (a race with a concurrent `/study` run), bump `N` once more and warn.

2. **Write order (do not reorder — each step's safety depends on the previous one landing first):**
   1. `docs/harness/<slug>/study_guide[_round<N>].json` — the **SSOT object snapshot**: `{ "studyGuide": <the exact returned object> }` only — **no** `stats`/`deviations` (those are run telemetry, not content; keeping them out means a re-render from this JSON is byte-for-byte comparable across rounds without telemetry noise). This makes "re-render without re-analysis" possible later.
   > **Re-render from an existing JSON snapshot (the capability step 1 above exists for).** Reading a prior round's `study_guide[_round<N>].json` and rendering it again — after a renderer fix, or to switch format with `--md` — is a **normal new round**: compute `N` by §3.1 exactly as any other run, write all of `.json` / rendered file / index row at that new `N`, and never touch the source round. It SKIPS Step 1.5 discovery, the Step 1.6 topic+cost gate, and Step 2 authoring entirely (nothing is authored, so there is no spend to gate). One carve-out: the Artifact disclosure in Step 1.6 is a data-egress consent, not a spend gate — if a re-render will be published and that consent was not given in this session, ask that one question alone before publishing.
   2. The rendered file — `study_guide[_round<N>].html` by default, or `.md` if `--md` was passed (never both). For HTML: **Read `{CLAUDE_PLUGIN_ROOT}/templates/study/html_shell.html`** (author-time asset — never modify it in place), replace **ALL occurrences** of each of these three placeholders — never "once each", which would leave the second title occurrence unreplaced:
      - `__STUDY_TITLE__` — appears TWICE (`<title>` and `<h1>`);
      - `__STUDY_GENERATED__` — once, in the `.meta` line (target, mode, tier counts, round, date);
      - `__STUDY_DISCLOSURE__` — once, in the `.disclosure` line directly under `.meta`. **This is HTML surface 1 of the canonical link-disclosure line (§3.3)** — fill it with that sentence rendered in `user_lang`. Leaving it unreplaced ships the raw placeholder to the reader.

      All three substituted strings are escape targets (§3.6). Then splice the escaped per-topic content (§3.3 mapping table) at its single `<!-- STUDY_CONTENT -->` sentinel. For `--md`: build the document directly (no shell asset — Markdown has no chrome to reuse).

      **How to perform the write — prefer a deterministic script.** Everything this step does (§3.6 escaping in a fixed order, per-line `<span>` wrapping, placeholder replace-ALL, splice, sentinel append) is a byte-level transformation with no judgment in it, and hand-transcribing escaped text is precisely where an escape error enters — one that then surfaces as a §3.6 `<`/`&lt;` mismatch and gets misread as "escaping is broken" when the real cause was a transcription slip. So: **write the rendered file with a small deterministic script** (the orchestrator running it still counts as the orchestrator writing, and no sub-agent is involved). **The script itself goes to a session scratch location OUTSIDE the repository — never into the repo tree.** That is what keeps §Allowed Writes literally true: the only repository paths this skill writes are the enumerated ones, and a helper that lives outside the tree is not a sixth one. A script written into the repo would be exactly that, so do not do it. **Fallback when scripting is unavailable:** Write the shell + first topic in one call, then Edit in each remaining topic before the same sentinel — never one large single Write (truncation risk — see §Risks). Note the truncation risk that motivates the split is a property of a model emitting text, so it does not apply to the scripted path; the §3.2.3 tail check still runs on BOTH paths.

      **The `<!-- STUDY_CONTENT -->` sentinel stays in the written file** — splice content in *before* it rather than replacing it. It is deliberately retained as the anchor for a later re-render from the JSON snapshot; an HTML comment costs the reader nothing. Do not "clean it up".
   3. **Tail-truncation check:** re-read ONLY the last ~500 bytes of the file just written (not a full-file scan) and confirm the completion sentinel (below) is present at the end. If missing: the write was truncated. **Halt here** — warn the user explicitly, skip steps 4 and 5 (no index row, no Artifact publish: both would advertise a broken artifact), and **do NOT run the Step 5.1 cleanup** — keep `.harness/study/topics.json` so a re-run can re-render from the already-written JSON snapshot without re-paying discovery, the gate, or authoring. State that recovery path in the warning. This is the one documented exception to "cleanup always runs".
   4. `docs/harness/study_index.md` (append-only — see Step 4.1 below) — only after step 3 confirms a non-truncated write.
   5. Artifact publish attempt (Step 4.2 below) — only after step 4, and only after the §3.9 code-evidence check has run.

3. **StudyGuide field → HTML section id / MD heading** (both renderers follow this SAME table):

   > **The HTML class names in this table are CSS/JS hooks in `templates/study/html_shell.html` — they are a contract, not decoration. Do not rename, drop, or "clean up" any of them.** The shell's filter script selects topics with `document.querySelectorAll('section.topic')`; a topic rendered without `class="topic"` is invisible to it, which silently disables the whole tier filter and makes the empty-state message appear alongside visible content. Nothing in Layer 1 catches this (no lint reads `docs/`), so the table below is the only guard.

   | `StudyGuide.topics[]` field | HTML | Markdown |
   |---|---|---|
   | `id`, `title`, `tier` | `<section class="topic" id="topic-{id}" data-tier="{tier}">` then `<h2>{title} <span class="badge tier">{tier}</span></h2>` — `class="topic"` is required by the filter JS, `data-tier` by its counting/filtering | `### {title}` with a **{tier}** bold prefix |
   | `concept` (a) | `<h3>Concept</h3>` + `<p>` block | `#### Concept` |
   | `excerpts[]` (b) | `<h3>Code Excerpts</h3>`, one `<div class="excerpt">` per item containing its provenance badge (§3.4), then `<pre class="code">` with each escaped line wrapped in `<span class="line">`, then `<p>` with `explanation` | `#### Code Excerpts`, one fenced block per item, a badge line above it and the `explanation` paragraph below it |
   | `qa[]` (c) | `<h3>Interview Q&A</h3>`, one `<details>` per item; the item's `difficulty` renders as `<span class="badge tier">{difficulty}</span>` in the `<summary>` | `#### Interview Q&A`, one `<details>` per item with `**{difficulty}**` in the summary line |
   | `exercise` (d) | `<h3>Exercise</h3>`, prompt + its `difficulty` as `<span class="badge tier">` + `<details>` for hint/answer | `#### Exercise`, prompt + `**{difficulty}**` + `<details>` for hint/answer |
   | `decisions[]` (e) | `<h3>Engineering Principle</h3>`, one `<div class="claim">` per item with its basis badge (§3.5) | `#### Engineering Principle` |
   | `antipatterns[]` (f) | `<h3>Anti-patterns & Pitfalls</h3>`, one `<div class="claim">` per item with its basis badge | `#### Anti-patterns & Pitfalls` |
   | `glossary[]` + `furtherReading[]` (g) | `<h3>Glossary & Further Reading</h3>`, the **canonical link-disclosure line** (below) at the FIRST rendered topic's heading ONLY — never repeated in later topics; each `furtherReading` link carries `<span class="badge link">` | `#### Glossary & Further Reading`, the **same canonical line** at the FIRST rendered topic's heading only |
   | `relatedTopicIds[]` (Assemble output — present only on the workflow path) | at the END of the topic section: `<nav class="related">` with one `<a href="#topic-{relatedId}">{related title}</a>` per id | a final `**Related topics:**` line with one `[{related title}](#{anchor})` link per id |

   **Heading labels are `user_lang`; everything structural is English raw.** The `<h3>…</h3>` / `#### …` LABELS above (`Concept`, `Code Excerpts`, `Interview Q&A`, `Exercise`, `Engineering Principle`, `Anti-patterns & Pitfalls`, `Glossary & Further Reading`) are user-facing prose and are rendered translated into `user_lang` per §User Language Detection. Element names, `class`/`id`/`data-*` attribute names and values, and the topic-`id` strings are NOT translated — they are the CSS/JS contract named in the note above. (`Interview Q&A` and `Anti-patterns & Pitfalls` contain `&`, so their rendered labels are escape targets like any other string — see §3.6.)

   **`rejectedAlternatives` is optional — two renderer rules, because no schema guards this path.** The re-render path (§3.2) renders a stored JSON snapshot with no schema validation at all, so the renderer, not the schema, is what keeps a missing or legacy-shaped field from reaching the page:
   - **Absent or blank** (the normal case now that the field is optional — §Model Selection's segment schema and `templates/study/topic_author.md` both say "omit rather than invent"): render no rejected-alternatives clause at all. Do not emit a label with nothing after it, and never let an unset field reach the page as `undefined`.
   - **An array** (any round rendered before the field became a single string): join with `; ` and render as one clause. Prior rounds are never rewritten (§3.1), so this shape stays readable indefinitely.

   **Empty-section rule (applies to both renderers).** If an array section (`excerpts`, `qa`, `decisions`, `antipatterns`, `glossary`, `furtherReading`, `relatedTopicIds`) is empty, **omit its heading entirely** — never render an empty `<h3>`/`####`. This is why the completion sentinel counts `M` as *non-empty* sections and why Step 2-W can report a section as omitted. `concept` and `exercise` are single-valued and always render.

   **Canonical link-disclosure line (single source — the SAME sentence must appear at all three surfaces).** English source text:

   > External links are unverified: this skill runs with WebSearch/WebFetch in disallowed-tools, so no link was fetched or checked. Treat every URL as a lead, not a citation.

   **The canonical text carries no Markdown** — no backticks, no emphasis. This is deliberate: the same string has to land verbatim on an HTML surface (where a backtick renders as a literal backtick, which looks like a typo to the reader) and on a Markdown surface. Keep the three tool names as plain words; each renderer MAY apply its own code formatting (`<code>` in HTML, backticks in `--md`) but the underlying sentence stays identical, so the three surfaces cannot drift.

   Render it in `user_lang` (translate the sentence; keep WebSearch / WebFetch / disallowed-tools English raw per the glossary rule). It MUST be emitted at all three of:
   1. **HTML banner** — in the page header block, adjacent to the `__STUDY_GENERATED__` meta line (not only inside section (g)), so a reader who never scrolls to the glossary still sees it.
   2. **Markdown header** — directly under the `# ` title of the `--md` document, before the first topic (Step 3.7).
   3. **Section (g) head** — **once per rendered document**, at the FIRST rendered topic's Glossary & Further Reading heading (both output formats, per the mapping row above). *Once per document, not once per topic.* Every topic owns a (g) section, so the per-topic reading stamps the same three-line paragraph on the page once per topic plus the banner: measured 2026-08-04 on a 4-topic guide it landed 5 times, and a thorough run (10-15 topics) would reach 16. Nothing is lost by not repeating it — the per-item guarantee is already structural, since every external link carries its own `[Link unverified]` badge (§3.4).

   The wording is identical at all three; only the surrounding markup differs. If the three ever diverge, the (g) section head is authoritative.

4. **Provenance re-verification (orchestrator step, BEFORE rendering any excerpt):** for every excerpt with `source:'repo'`, re-read the real file at `path` (resolve ⊆ cwd; normalize `\`/`/`; reject if unreadable, binary, or outside the repo). Compare with **whitespace-normalized fingerprinting** (never raw string equality — CRLF/tab/indent differences must NOT downgrade a genuinely correct quote): the excerpt's first non-blank line and last non-blank line, trimmed, must both appear within `[lineStart, lineEnd]` of the real file, and `1 ≤ lineStart ≤ lineEnd ≤ file line count`. Track WHY a downgrade happened (report as sub-counts alongside the required `Quotes` line): `path-invalid` (unresolvable/escaping path) / `anchor-missing` (line range invalid or file too short) / `content-mismatch` (fingerprint disagreement) — this stops a wave of downgrades from being misread as "the model hallucinated everything" when the real cause is a path-format bug.
   - Passes verification → badge `[Code quote: {path}:{lineStart}-{lineEnd}]` (localized to `{user_lang}`, placeholders raw).
   - Fails verification → badge `[Anchor verification failed]`.
   - `source:'model'` → badge `[Model-generated example — not repository code]`.
   - `furtherReading[]` entries → badge `[Link unverified]` always (disallowed-tools makes this structural, not a judgment call).
   - **`verified` is never a field the author fills** — there is no such field in the schema; the badge is computed here, purely from `source` + the re-read result.

   **4a. Excerpt-kind tally (same pass, orchestrator-only — never a field, never written to the JSON snapshot).** Classify each excerpt by its `path` extension: `code` (`.js`/`.mjs`/`.cjs`/`.ts`/`.tsx`/`.py`/`.go`/`.rs`/`.java`/`.c`/`.cc`/`.cpp`/`.h`/`.rb`/`.sh`/`.ps1`/`.sql`) / `config` (`.json`/`.yaml`/`.yml`/`.toml` plus known extension-less config files) / `prose` (`.md`/`.mdx`/`.txt`/`.rst`/`.adoc`). Two refinements: a `path` under `skills/**` or matching `templates/**/*.md` is **`prose-self`** rather than `prose` — it means the guide quoted this skill's own procedure text back as a topic's code, which is the circular signal that produced a prose-anchored guide in the first place; and `.html`/`.css` count as `code` only if the quoted excerpt contains `<script`, otherwise `unknown`. `source:'model'` excerpts are counted in no bucket (they already carry their own badge). **This is an extension-based approximation, not a real code/prose discriminator** — a `.json` can hold logic and a `.py` docstring can be pure prose. It is therefore reported, and (per §3.9) may gate only the outward-facing publish, never the content.

5. **Claim basis (design decisions / anti-patterns / glossary terms):** every item carries `basis: 'repo'|'inference'`. If `basis:'repo'` but `evidenceRef` does not resolve to an existing repo-relative path (same resolve ⊆ cwd rule as excerpts), **auto-downgrade to `inference`** before rendering — never render a `repo` badge on an unresolvable reference.

   **What `[Evidence: {evidenceRef}]` asserts, and what it does not.** The check above is path RESOLUTION only — the file exists and sits inside the repository. Nothing here, and nothing anywhere else in this skill, verifies that the referenced file's *contents* support the claim; no automated step could. To a learner the badge nevertheless reads as "that file says this". So: keep the gap stated in §5.3, never widen the badge caption to imply more, and treat "the evidence is real but lives in a different file than `evidenceRef` names" as an authoring error this machinery cannot catch — measured 2026-08-04, two claims in a round-4 guide cited the segment script for a rationale that is actually stated in `spec.md`, and every check in this section passed.

   **5a. Answer-presence count (source of the `Exercises` line).** The schema marks `exercise.hint`, `exercise.answer`, and every `qa[].answer` as required and never-blank, but schema validation cannot catch a whitespace-only or placeholder-only string. Before rendering, count across all topics: an exercise is *with answer* only if BOTH `hint` and `answer` are non-blank after trimming; otherwise it is *missing*. Emit `Exercises: <N> with answer / <M> missing` where N+M equals the topic count (one exercise per topic). **Q&A blanks are a SEPARATE population and get their own line** — `Q&A: <N> with answer / <M> blank`, counted over all Q&A items (3 per topic) — because folding them into the exercise total produced numbers whose sum matched neither the topic count nor the item count, and an uninterpretable count is worse than two honest ones. A non-zero `M` is reported, never silently patched — an exercise without a checkable answer is exactly the failure this skill exists to avoid.

   **5b. Reference-path validity count (source of the `Refs` line).** Collect every **repository-internal** reference actually rendered: each surviving `evidenceRef` from step 5 plus each excerpt `path` from step 4. Check existence (resolve ⊆ cwd). Emit `Refs: <N> valid / <M> broken`. **Count REFERENCE INSTANCES, not distinct paths** — one path cited by six claims counts six times. (Stated because the two readings differ by an order of magnitude on a real guide, and the instance count is the one that answers "how much of what I am reading is anchored?".) **External URLs are NOT counted here** — they are structurally unverifiable (`WebSearch`/`WebFetch` are in `disallowed-tools`) and carry the canonical link-disclosure line instead; counting them would imply a check that never ran.
   - `basis:'repo'` (post-downgrade-check) → badge `[Evidence: {evidenceRef}]`.
   - `basis:'inference'` → badge `[Inference — unconfirmed in repository]`.
   - **Count and emit (source of the `Claims` line).** After the auto-downgrade pass completes, count every narrative claim across all topics by its FINAL basis: `R` = `repo`-backed (survived the evidence-path check), `I` = `inference` (declared as such, or downgraded here). Emit `Claims: <R> repo-backed / <I> inference`. Count the post-downgrade value, never the model's original declaration — otherwise the line reports what the model claimed instead of what was verified.

6. **Escaping (HTML output; in this exact order — order is load-bearing, reversing it double-escapes `&`):** `&` → `&amp;`, then `<` → `&lt;`, then `>` → `&gt;`. Content is spliced in as escaped semantic HTML (never a JSON data-island — an excerpt containing `</script>` would otherwise truncate the page).

   **What must be escaped — EVERY model-authored string that reaches the page, with no exceptions:** topic `title`, `tier`, `concept`, every excerpt's `code` and `explanation`, every Q&A `question`/`answer`/`difficulty`, the exercise's `prompt`/`hint`/`answer`/`difficulty`, every decision/anti-pattern/glossary free-text field and `evidenceRef`, every `furtherReading` `url`+`note`, the related-topic titles, **and the text substituted into `__STUDY_TITLE__` / `__STUDY_GENERATED__` / `__STUDY_DISCLOSURE__`**. Escape a string once, at insertion; never twice. Only the shell's own literal markup and the class/attribute names from the §3.3 table are written unescaped — those are ours, not the model's. (A field omitted from this list is a live markup-injection hole: `title` alone goes straight into `<h2>`, and this skill's subject matter is code, so `<` in a title is likely, not exotic.)

   - **Code block markup:** after escaping, split `code` on newlines and wrap EACH line in `<span class="line">…</span>`, all inside `<pre class="code">`. The shell draws line numbers from a CSS counter on `pre.code .line`; a bare `<pre><code>` loses both the numbering and the block styling.
   - **Badge markup:** every badge from §3.4/§3.5 is `<span class="badge {kind}">…</span>` with `{kind}` ∈ `repo` (verified quote) / `fail` (anchor verification failed) / `model` (model-generated example) / `inference` (a narrative claim whose basis is `inference`, declared or auto-downgraded — §3.5) / `link` (unverified external link) / `tier` (tier and difficulty labels). Six kinds, and `inference` is its own: reusing `fail` would assert a failure where none occurred, and reusing `model` would collide with "model-generated code example". Each has a matching `.badge.<kind>` rule in the shell. The badge TEXT is localized to `user_lang`; the class name is English raw.
   - **`<` vs `&lt;` cross-check:** before escaping, sum `count('<')` across **exactly the same string set enumerated above** (if the two lists ever diverge, this check produces false alarms — keep them in sync) = `pre_count`. After the full render, count literal `&lt;` occurrences in the written file = `post_count`. `pre_count == post_count` must hold (the shell's own literal tags are never converted, so they do not pollute the count). Mismatch → escaping failed somewhere — warn and do not publish.
   - The completion sentinel `<!-- study-guide: topics=N sections=M complete -->` is appended as the LAST line, once, after all content is written (`N` = topic count, `M` = total **non-empty** sections across all topics, per the empty-section rule in §3.3). **`M` is counted at §3.3 MAPPING-ROW granularity — max 7 content rows per topic, where `glossary[]` + `furtherReading[]` are the single row (g)** (so a topic with a populated glossary and zero further-reading links contributes 7, not 6.5 or 8). This is intentionally coarser than `stats.missingSections`, which reports at schema-key granularity (`t2.furtherReading`) because a reader asking "which array came back empty?" needs the finer answer. Two granularities, each with a named consumer — do not unify them.

7. **Escaping (Markdown output, `--md`):** Markdown does not need HTML-entity escaping, but gets the SAME safety nets as HTML — a trailing `<!-- study-guide: topics=N sections=M complete -->` line + the same tail-truncation check (mutually-exclusive-flag users must not lose the safety net just because they chose `--md`). **Fence collision guard:** for each excerpt's `code`, find the longest run of consecutive backticks already present in it; use a fence 1 backtick longer (minimum 4, i.e. ```` ```` ````) so an excerpt containing a triple-backtick fence (this repository's own `.md` files do) cannot prematurely close the code block.

8. **Equivalence assert:** immediately after rendering, print 1 line (in `user_lang`) confirming three set-equalities between the rendered output and the `StudyGuide` object — a plain comparison the orchestrator performs on what it just rendered vs what it read, not a new script:
   - topic-id set — exact match;
   - **non-empty** section-key set — compare against the sections that actually had content, NOT every schema key (the §3.3 empty-section rule deliberately omits empty sections; asserting against all keys would make this check fail by construction on any topic with, say, `antipatterns: []`);
   - tier-tag set, **including the item-level `difficulty` tags** on Q&A and the exercise (they are required schema fields with a rendering destination, so a dropped tag is a real regression).

   On mismatch: warn and do NOT publish (same branch as the `<` vs `&lt;` cross-check in §3.6) — a set mismatch means content was lost or invented during rendering.

9. **Code-evidence check (orchestrator-only; runs after §3.8 and BEFORE Step 4).** The ordering is the whole point: the completion block in Step 5.2 comes *after* the publish, so a number that only appears there is a post-mortem. Using the §3.4a tally:
   - Print (in `user_lang`) the `Excerpts` line defined in Step 5.2, and name the id of every topic whose excerpts contain no `code` and no `config` item.
   - **If any topic has zero code/config excerpts, or if `prose-self` outnumbers `code + config`:** the guide measurably missed what the opening scope statement at the top of this file says it is for. The local files stay — they are already written and are never rolled back. But Step 4.2 sends this outward, so **ask once** via AskUserQuestion (in `user_lang`): header "Publish anyway", question naming the affected topic ids, options "Publish anyway" / "Skip publishing". Skipping is not a failure state: the rendered file, its JSON snapshot and the index row all remain, and a re-run with a narrower target or a trimmed selection can publish a better round later.
   - This is the ONE action the extension-based tally is allowed to influence, and only the outward-facing one. It never blocks the local write, never blocks the index row, and never edits content — an approximation (§3.4a) may inform a human decision but must not silently make one.

### Step 4: Index & Publish

1. **`docs/harness/study_index.md`** (fixed path, root-level — the ONE write outside `docs/harness/<slug>/`; `Path("docs/harness/study_index.md").resolve() ⊆ Path.cwd().resolve()` per `templates/_shared/safety_guard.md`). **Append-only** — read the existing file (create with a 1-line header if absent), append ONE new row. **Fixed literal format** (a GFM table needs its separator line, so create BOTH header lines when the file is absent):

   ```
   | Date | Slug | Round | Mode | Topics | Rendered file | JSON snapshot |
   |---|---|---|---|---|---|---|
   | 2026-08-03 | my-feature | 1 | deep | 8 | study_guide.html | study_guide.json |
   ```

   `Round` is included because rows are keyed by `(slug, round)` — omitting it from the columns would make the key unreadable from the file. Append the data row only (never re-emit the header) and write back. Never rewrite or drop an existing row (a two-terminal race can lose the OTHER terminal's concurrent append — documented limitation, low blast radius since `docs/` is local/gitignored). Rows are keyed by `(slug, round)`; a given round is written exactly once (the round-existence check in Step 3.1 already prevents a same-round collision).

2. **Artifact publish** (if the Artifact tool is available):
   - Gate consent for this was already collected in Step 1.6 (the combined gate) — do not ask again.
   - Load the `artifact-design` skill before authoring/publishing anything (procedural dependency).
   - Attempt to publish the rendered file (`study_guide[_round<N>].html`, or `.md` under `--md`) AS-IS via the Artifact tool — do not author a second, Artifact-flavored copy. Note the terminology distinction from the user-facing `study_guide.json` "SSOT object snapshot": the Artifact publishes the *rendered* file, not the JSON.
   - The Artifact tool's own skeleton contract (no `<!doctype>`/`<head>`/`<body>` in the page body it wraps) can conflict with `study_guide.html`'s local-viewing contract (which DOES need `<!doctype>`/`<head>` to be a standalone double-clickable file). **If the publish call FAILS**, print a 1-line graceful-skip notice (in `user_lang`) and continue — **never** re-render a second, Artifact-shaped copy (that would be a second full-content spend).
   - **Visual fidelity of the published page is NOT something this skill can check** — confirming it would require fetching the URL, and `WebSearch`/`WebFetch` are in `disallowed-tools`. A publish that returns a URL is reported as *accepted*, never as *verified*. Print 1 line (in `user_lang`) telling the user that whether the skeleton wrap or the CSP altered the rendering is theirs to eyeball at the URL. (Measured 2026-08-03: a file WITH `<!doctype>`/`<head>`/`<body>` was accepted, not rejected — so "the publish succeeded" and "the page looks right" are genuinely independent facts here.)
   - Strict CSP means zero external requests — this is already satisfied by construction (the shell is self-contained; see `templates/study/html_shell.html`). Set a favicon per the Artifact tool's requirement (e.g. `📘`), kept stable across rounds of the same slug.

### Step 5: Completion

1. **Clean up `.harness/`** — delete `.harness/study/topics.json` AND `.harness/model_config.json`, then remove `.harness/study/` and `.harness/` itself if empty. Always, success or Abort; stateless per §Mode Gate declaration (leaving `model_config.json` behind would make a stateless skill accumulate session files run after run). `docs/harness/<slug>/` and `docs/harness/study_index.md` are NEVER touched by cleanup.
2. **Print final status** (in `user_lang`), including every required accounting line below (the set grows; do not hard-code its size):
   ```
   [harness] Study guide complete.
     Skill    : study
     Target   : <target label>
     Mode     : <mode>
     Report   : docs/harness/<slug>/<study_guide.html | study_guide_round<N>.html | .md>
     Round    : <N>
     Claims   : <R> repo-backed / <I> inference
     Quotes   : <N> verified / <M> downgraded  (path-invalid <a> / anchor-missing <b> / content-mismatch <c>)
     Exercises: <N> with answer / <M> missing
     Refs     : <N> valid / <M> broken
     Excerpts : <C> code / <F> config / <D> prose (<Sd> self-doc) / <U> unknown — no code/config excerpt in <Z>/<N> topics
     Topics   : <N>  (<knowledgeCategory distribution, e.g. engineering-judgment 5 / architecture-pattern 2>)
   ```
   Every number above is **counted, never asserted in prose**, and each has a named producing step: `Claims` ← Step 3.5 (claim basis), `Quotes` ← Step 3.4 (excerpt re-verification), `Exercises` ← Step 3.5a (answer-presence count), `Refs` ← Step 3.5b (repo-internal reference validity), `Excerpts` ← §3.4a (excerpt-kind tally, already printed once at §3.9), `Topics` ← Step 1.5 (the categories the orchestrator assigned at discovery). If a step did not run, print `n/a` for its line rather than `0` — a zero that means "not measured" is worse than no number.

   **The `Excerpts` and `Topics` lines are counted, not enforced.** By the time this block prints, Step 4.2 has already published; the enforcement point for `Excerpts` is §3.9, which runs before it. And the category distribution is **displayed only** — no threshold, no warning attached — because the orchestrator both assigns and tallies it, and because a skewed distribution is legitimate (a pure-algorithm change genuinely has one category). Do not add a bias warning here without a measured threshold to justify it.
3. **Honest success-criteria statement** (state this once, in `user_lang`, in SKILL output or on first use — not a marketing claim): what is machine-checked is quote realness (path/line/fingerprint), exercise/Q&A answer presence, and reference-path validity — **existence only; whether the referenced file actually supports the claim is never checked (§3.5)** — and **NOT** whether the learner will actually be able to reproduce or explain the work; that judgment stays with the user. Cost multipliers are `*(estimated)*` until this repository has real measurements, per house convention.

## Model Selection

Sub-agents exist only in **deep and thorough modes** (WORKFLOW path). Preset table + rules: see `templates/_shared/model_config.md`.

**Role map (study):** 3 evidence lenses (mechanism / rationale / pedagogy) + per-bucket topic authors → `executor`; completeness/reproducibility critic (thorough) → `evaluator` (falls back to `advisor` on stale args); assemble → `advisor`.

**Applying model config (WORKFLOW path):** pass the resolved models once per segment run as `args.models` (`{ executor, advisor, evaluator }`; null = inherit parent model). Sub-agents must NOT access `.harness/model_config.json` — the orchestrator passes resolved values at launch.

## User Interaction Rules

See `templates/_shared/askuserquestion.md`.

## Risks

Named here so the two cross-references in Step 1.3 and Step 3.2 resolve, and so nothing below is rediscovered per run.

- **quick holds everything in one context.** The inline path carries the full gathered evidence, authors 3-5 topics against it, and renders a report that has measured ~60KB — all in a single orchestrator context. A run that overruns it loses the authored topics, not just the render, which is why the Step 1.3 total cap drops whole files rather than shaving them. Note the budgets do NOT rank the way the mode names suggest: quick's row (3 files / 600 lines) is the LARGEST of the three, because deep and thorough pay for their evidence again per agent — see Step 1.3(4).
- **A single large Write can truncate silently.** A truncated HTML file still renders in a browser, so the failure is invisible without the Step 3.2.3 tail check. Prefer the deterministic script; on the fallback path, Write the shell plus the first topic and Edit in the rest.
- **The workflow path pays a serialization cost quick does not.** `args.sharedEvidence` is emitted inline by the orchestrator and then re-embedded in every lens and bucket prompt, so evidence size multiplies by the agent count. The 35,000-character cap in Step 2-W exists for this and has no analogue on the inline path.
- **Every count in this skill is a count, not a guarantee of understanding.** §5.3 states the boundary; do not let a green accounting block be read as a claim about what the reader learned.

## Key Rules

- **Read-only over analyzed source.** The Author segment and its lenses/topic authors/critic/assemble NEVER modify or write a source/config file. **The ORCHESTRATOR's writes are the sanctioned exception, and ONLY these five:**
  1. `docs/harness/<slug>/study_guide[_round<N>].{html|md}` (the rendered guide — HTML default, `.md` under `--md`, never both)
  2. `docs/harness/<slug>/study_guide[_round<N>].json` (the SSOT object snapshot — `studyGuide` only, no telemetry)
  3. `docs/harness/study_index.md` (fixed root-level path, append-only, `resolve ⊆ cwd`)
  4. `.harness/study/topics.json` (session-scoped cache, cleaned up at Step 5 or on Abort)
  5. `.harness/model_config.json` (session-scoped audit record of `{ mode, path_resolved, runId }` — written in EVERY mode including quick, per §Mode Gate and Step 1.7; **deleted at Step 5.1**, the `/deep-review` precedent). Listing it here closes a self-contradiction: the earlier draft declared "only four" while two other steps in this same file wrote a fifth path and cleanup never removed it.
- **No speculation without a badge.** Every excerpt and every narrative claim carries a machine-checked provenance field; there is no "trust me" content in this skill's output.
- **Fan-out exists only on the workflow path.** deep/thorough run as the plugin-shipped Author segment; quick is orchestrator-inline and complete (AC-20 — never a stub, never fewer than a full 7-section pass over 3-5 topics).
- **Mode Gate + cost gate.** `--mode` / ultracode opt-in / tool availability derive the mode (§Mode Gate); the combined topic+cost+Artifact HARD-GATE (Step 1.6) is rendered by the orchestrator BEFORE the segment dispatch, never inside the script.
- **Schema returns.** The segment returns `{ studyGuide, stats, deviations }` — schema-validated; `studyGuide` is the ONLY content payload persisted to the JSON snapshot.
- **Round file names, never overwritten.** Round 1 = unsuffixed; round ≥ 2 = `_round<N>` on ALL THREE of HTML/MD/JSON together; a prior round's files are never deleted or overwritten (deep-review precedent).
- **Un-approved topics are a deviation, not a silent addition.** The Author segment/inline pass may merge/narrow/re-tier the approved list; introducing a new one is logged to `deviations[]` and surfaced to the user verbatim.
- **Stateless re-run.** No state.json, no partial resume beyond the `topics.json` gate-cache — a re-invocation with a different slug/mode discards any stale cache and starts fresh.
- **User language.** All user-facing output in `user_lang`; templates/identifiers/enums/paths English raw. WORKFLOW path: pass `userLang` in `args` — the segment builds schema descriptions from it.
- **Ad-hoc dispatch.** Any sub-agent or Workflow script created during this skill's execution WITHOUT a shipped template follows `templates/_shared/adhoc_dispatch.md` §Ad-hoc Dispatch Contract — explicit output-language directive and role-based model routing (mechanical → executor tier, judgment → evaluator tier, never above).
<!-- SYNC-WITH: templates/_shared/adhoc_dispatch.md §Ad-hoc Dispatch Contract -->
- **Link verification is out of scope by construction.** `disallowed-tools: NotebookEdit, WebSearch, WebFetch` means external links are never fetched; the (g) section always opens with a 1-line disclosure of this, matching the SKILL/HTML-banner/MD-header wording exactly.
- **Artifact never gets a second render.** A publish failure or CSP mangling is a graceful 1-line skip — never a second full-content authoring/render pass.
- **Error handling.** Empty/unreadable target halts. 0 auto-detect candidates falls back to `--project` with a notice. Any Workflow failure degrades to quick inline on the SAME approved topics (capped to 5, with an explicit scope-reduction notice) — never a hard error.
