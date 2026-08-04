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
- Record `{ mode, path_resolved }` (and any segment `runId`, audit-only) in `.harness/model_config.json` — **but only if this run created that file.** The path carries no per-skill namespace and `/deep-review` and `/codebase-audit` write the very same one, so BEFORE the first write, probe it once and remember the answer for the whole run as `model_config_preexisting`. If it already existed, this skill neither writes to it nor (per Step 5.1) deletes it — it is another run's record, and every field study would have put there is already printed in §Standard Status Format, so what is given up is an audit side-file, not information. Print one line (in `user_lang`) saying the audit record was skipped for that reason. **Never merge into it and never rewrite it:** `mode` and `path_resolved` mean different things in each of the three skills, so merging corrupts the other skill's record instead of dropping ours.

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
     2. **Extract candidate paths.** From both documents — inside code spans/fences and in running text — collect repo-relative tokens matching `[\w./-]+\.(json|yaml|html|toml|java|tsx|cpp|mjs|cjs|yml|ps1|sql|css|js|ts|py|go|rs|rb|sh|cc|c|h)\b` and count occurrences of each. **The alternation is ordered longest-extension-first and closed with `\b` — do not "tidy" it into alphabetical order, and do not "harden" the ending into `(?![\w])`.** Ripgrep is leftmost-*first*, not leftmost-longest, so alphabetical order truncates `state.json` to `state.js` and the resulting path — which does not exist — is deleted silently by step 3, taking the config bucket with it; and ripgrep's default engine has no look-around, so `(?![\w])`, semantically identical here, dies with `regex parse error` in the exact tool step 1 tells you to use. Both failure modes are measured (`workflows/_reference/study_measurements.md` §Outline Patterns). Known gap, accepted: extension-less files such as `.gitattributes` or `Dockerfile` cannot be found by an extension pattern, so they never enter evidence this way even though §3.4a can classify one as `config` if a topic quotes it from elsewhere.

        **Second known gap, also accepted — the `config` bucket can be structurally empty.** A `spec.md` describing work that has not shipped yet names the files that work will *create*, and step 3 drops every path that does not exist at scan time. On a `--harness` target those future artifacts are overwhelmingly config: measured 2026-08-04 against this repository, the documents named `state.json` (6), `.harness/study/topics.json` (5), `topics.json` (5), `study_guide.json` (3), `.harness/model_config.json` (2) and `model_config.json` (1) — six config paths, all correctly dropped as non-existent, leaving zero config candidates and an evidence set that was 100% executable code. The bias is systematic, not incidental, because naming files-to-be-created is what a spec does. **Do not add a compensating branch**: quoting a file that does not exist is precisely what this skill must never do, and §3.9's publish gate keys on a topic having *neither* code *nor* config, so `config == 0` on its own can never fire a false gate. Report it, do not repair it.
     3. **Exclude, then order deterministically.** Drop prose (`.md`/`.mdx`/`.txt`/`.rst`/`.adoc`), **everything under `docs/`** (this skill's own output — otherwise a previous round's report qualifies as "code"), non-existent paths, binaries, **empty files (0 bytes)**, and anything failing `resolve ⊆ cwd`. Order by citation count descending, then **path ascending** as the tie-break.

        The empty-file exclusion is not hypothetical: a 0-byte file still wins a ranking position and contributes nothing to it. Measured 2026-08-04 on `pass-monorepo-be`, a 0-byte `infra/pass-test-support/src/main/resources/sql/schema-main.sql` was selected in 2 of 5 slugs and took the **top** position in one of them, because a schema file a spec mentions repeatedly outranks the code. Under the 3-file ceiling that step 4 used to carry, that one file cost a third of the whole evidence set. Check the size, not just existence.

        **Before dropping a non-existent path, try its basename ONCE.** Deep package trees make documents abbreviate — a Java spec writes `app/pass-window-app/.../features/external/controller/FaceAuthSseController.java`, and step 2's pattern swallows the `.../` elision into the path, producing something that cannot exist. Recover it, and accept the result ONLY when BOTH hold: (a) exactly ONE file outside the §Exclusion List trees carries that basename, and (b) if the token contains a path separator, the recovered path's tail matches the token's segments after its last elision. Otherwise drop as before — **an ambiguous basename is never guessed.** Merge a recovered path's count into that file's existing count when it is already ranked; one document routinely writes the same file both ways.

        **The exclusions in the paragraph above RE-APPLY to the recovered path, not only to the token.** A bare basename carries no directory, so "everything under `docs/`" cannot possibly fire at the token stage — it has to fire again after recovery, or a basename smuggles this skill's own previous output back in as evidence, which is the exact circularity that exclusion exists to prevent — measured, this repository's own `study_guide.html` recovers uniquely, contains a `<script>` block, and would therefore be admitted as `code` by §3.4a. So: re-run prose, `docs/`, binary and `resolve ⊆ cwd` against the RECOVERED path and drop it there. Recovery may only change WHERE a path points — never WHETHER it is admissible.

        **Recovery is load-bearing on deep package trees AND on this shallow repository** — 62 of 78 citation-weight recovered on a Java monorepo, and bare-basename citations of the verifier scripts reorder this repository's own ranking outright. Both measurements, and the earlier claim they refuted, are in `workflows/_reference/study_measurements.md` §Basename Recovery.
     4. **Budget — the WORKFLOW path gets LESS than quick, not more.** deep/thorough = **550 lines** total / **300 lines per file** / at most **12 files**; quick = **600 lines** total / **300 lines per file** / at most **12 files** (quick holds this evidence in ONE context while authoring 3-5 topics and writing a ~60KB report — see §Risks).

        **Fill it: take files in ranking order and STOP at the first one that will not fit — never skip it to take a smaller file further down.** The kept set is always a prefix of the ranking, which is the same thing as "drop from the bottom" (below) when you walk the ranking in order. Skipping is a third algorithm that neither phrase sanctions, and it is worse than it looks: it buys line count by admitting a lower-cited file over a higher-cited one, and citation rank is the ONLY relevance signal this step has — measured, skipping systematically favours small files, the exact size bias that made the old 3-file ceiling so bad on Java. Report the stop in the step-7 notice. The LINE budget is the binding constraint; the 12-file ceiling only bounds fragmentation, is not meant to bind, and its 12 is a measured maximum rather than taste. The skipping comparison and the 8-slug before/after table that retired the old 3-file ceiling are both in `workflows/_reference/study_measurements.md` §Fill Rule.

        **On the inline path filling is free; on the WORKFLOW path it is not, and the line budget is not what binds there.** quick holds the evidence in one context with no serialization cap, so it simply fills. deep/thorough serialize through `args.sharedEvidence` under a hard 35,000-character cap, and characters-per-line is language-dependent — measured, a filled 550-line gather runs from 24,923 to **31,945** characters with the language, and at the high end the code side alone eats the whole allowance (`workflows/_reference/study_measurements.md` §Serialization Cost). So on the workflow path, **Step 2-W reserves prose FIRST and the reserved remainder sizes this step's fill**: that reservation is a fixed **8,750-character** prose budget split between the two documents (Step 2-W), so this step fills against `35,000 − <reserved> − the block's own overhead`. **Compute the reservation BEFORE starting this fill.** It depends only on the two documents' lengths — never on what this step selects — so there is no circularity, and it is what makes the §1.6 gate able to state the reduction before the spend rather than after it. Fill until the line budget OR that character remainder runs out, whichever binds first.

        The inversion is counterintuitive enough to state outright. quick holds the evidence in one context and never serializes it; deep/thorough must pass it through `args.sharedEvidence`, which the orchestrator re-emits as tool-call output and the segment then re-embeds in EVERY lens and bucket prompt — 6 agents in deep, 7+ in thorough. **Evidence cost is multiplied by the agent count on the workflow path and paid once on the inline one**, so the budgets run opposite to the modes' apparent size. **What deep and thorough buy is more ANALYSIS over the same evidence — 8-15 topics, three independent lenses, a critic and an assemble pass — never more evidence.** (Measured: the old, larger budget row serialized to ~56,000 characters, which the orchestrator cannot re-emit in one dispatch call at all, and hand-transcribing it would corrupt the §3.4 quote re-verification the whole guide rests on — the exact failure mode §3.2.2 forbids for the render. `workflows/_reference/study_measurements.md` §Serialization Cost.)

        **When the caps conflict, the total wins and whole files drop from the bottom of the ranking** — which the fill rule above now makes true by construction rather than by exception. It was previously false in practice: with a 3-file ceiling the FILE cap bound first on all 8 measured targets, so "the total wins" described a conflict that never arose. The three limits are still not independent: a real ranking can satisfy every per-file cap and still exceed the total. Never shave a file into a fragment to make the arithmetic work, and never cut the top-ranked file's window count to buy room — those windows are the entire point of step 5. Drop the lowest-ranked file instead, whole, and name it in the step-7 notice.

        **The order of operations is: compute step 5's windows (merging any overlap) FIRST, then test the total, then drop whole files from the bottom.** The worked example on this repository's own three candidate slugs, the counterfactual that exercises the merge, and the ranking history are in `workflows/_reference/study_measurements.md` §Fill Rule.

        Two rules survive from that history and are load-bearing here. **(i) Never inherit a ranking — re-measure it**: a ranking is an output of steps 2-3, so it changes whenever they do, and the ranking this file once published was already stale. **(ii) Where the next candidate is OVER the per-file cap, the fill cannot know whether it fits without computing step 5's windows, so step 5 runs on a file the fill then drops** — and step 5's visibility rule then fires for that file, printing a notice about a file that never entered the evidence. When it does, name the file as *evaluated for the budget, then dropped*, never as gathered evidence, which is what the unqualified notice implies. Windowing and its merge rule are therefore documented-but-unrun on every `--harness` target in this repository; the target that exercises them is one citing a file longer than 300 lines that the fill actually REACHES.
     5. **Over the per-file cap, never truncate from the head.** Grep the top-level declaration outline **using the pattern set for the file's extension (table below)**, with line numbers, then read **at most two 150-line windows** centred on declarations the documents named by name.

        **The patterns are per-extension, and every one of them is ripgrep-safe** — no look-around, no backreferences — because sub-procedure step 1 tells you to run this with Grep/Bash and ripgrep's default engine rejects look-around outright (same measured constraint as step 2's `(?![\w])` note). Match each pattern against the whole line anchored at `^`; the declaration's name is the LAST capture group that is a bare identifier.

        **Read `\|` in the table below as a plain `|`.** A pipe inside a GFM table cell has to be written `\|` or it ends the cell, so the alternations appear escaped — but `\|` in a regex means a LITERAL pipe character, which turns `(class\|interface)` into a pattern matching the text `class|interface` and silently matches nothing. **Un-escape every `\|` to `|` before handing a pattern to Grep.** Measured, the `.java` type pattern copied WITH its table escaping returns **0 matches and no parse error** on a file where the un-escaped form finds a `public class` declaration — ripgrep accepts it and silently finds nothing, which is worse than being rejected (`workflows/_reference/study_measurements.md` §Outline Patterns). Same failure family as step 2's `(?![\w])`: a pattern that reads correctly in the document and dies in the tool this step tells you to use.

        | Extensions | Outline patterns |
        |---|---|
        | `.js` `.mjs` `.cjs` `.ts` `.tsx` | `^(export )?(async )?function\s+([A-Za-z_$][\w$]*)` / `^const ([A-Za-z_][\w$]*) =` / `^class\s+([A-Za-z_$][\w$]*)` |
        | `.java` | `^(public \|protected \|private )?(abstract \|final \|static \|sealed )*(class\|interface\|enum\|record) ([A-Za-z_]\w*)` / `^\s+(public\|protected\|private)[^;={]*\s([A-Za-z_]\w*)\(` |
        | `.py` | `^(async )?def ([A-Za-z_]\w*)` / `^class ([A-Za-z_]\w*)` |
        | `.go` | `^func (\([^)]*\) )?([A-Za-z_]\w*)` / `^type ([A-Za-z_]\w*)` |
        | `.rs` | `^(pub )?(async )?fn ([A-Za-z_]\w*)` / `^(pub )?(struct\|enum\|trait\|impl) ([A-Za-z_]\w*)` |
        | `.rb` | `^\s*def ([A-Za-z_][\w?!]*)` / `^\s*(class\|module) ([A-Za-z_]\w*)` |
        | `.sh` `.ps1` | `^function ([A-Za-z_][\w-]*)` / `^([A-Za-z_][\w-]*)\(\) *\{` |
        | `.c` `.cc` `.cpp` `.h` | `^(class\|struct\|namespace) ([A-Za-z_]\w*)` / `^[A-Za-z_][\w \*&:<>,]* ([A-Za-z_]\w*)\([^;]*$` |
        | anything else | no outline — take the fallback below, and **announce it** (visibility rule) |

        **The `.js` row is frozen.** Those three patterns are byte-identical to the only set this file ever carried, and every measurement in steps 4-5 rests on them (45 outline declarations in `workflows/study.analyze.workflow.js`, 6 qualifying, `topics`/`deviations` on top). Touch that row and the whole sub-procedure has to be re-measured.

        **Why the table exists: the single previous set was JavaScript-shaped and silently matched nothing else.** `^class ` requires `class` at column 0, but Java writes `public class Foo`, has no `function` keyword and no `const x =` — so the old set found **0** declarations in every Java file tested and step 5 was dead code for the one language this skill had been validated against, invisibly, because the fallback is documented and its output looks plausible. Full before/after measurement: `workflows/_reference/study_measurements.md` §Outline Patterns.

        **Visibility rule — an outline that finds nothing is REPORTED, never silent.** For every file that goes over the per-file cap, print one line (in `user_lang`) when either its outline came back **empty** (no pattern set for the extension, or none matched) or its outline was non-empty but **nothing qualified**, naming the file, which of the two happened, and that the fallback was used instead of windows. The two cases have different fixes — a missing pattern set versus documents that never name a declaration — and a silent fallback is precisely what let an entire language go unwindowed for five rounds.

        **"Named by name" is a mechanical test, not a judgment call.** An outline declaration qualifies only when its identifier (a) occurs in `spec.md`/`changes.md` **inside a backtick code span or a fenced block**, and (b) is at least 3 characters long. A bare occurrence in running prose does NOT qualify. This is not pedantry: the identifiers in a segment script are also ordinary English or ordinary domain words, and a loose reading counts every one of those (measured: `topics` 12, `deviations` 8, `render` 3, `buckets` 1 in those two documents — and none of the four occurrences refers to the declaration it matches). Clause (b) exists because a one-character identifier collides with everything, including a code span that names a DIFFERENT skill's segment script — a cross-file collision, and a fifth kind alongside the four below. Both measurements: `workflows/_reference/study_measurements.md` §Named By Name. The two readings centre the window on the schemas versus on the fan-out and reconcile, so leaving this open destroys exactly the determinism this sub-procedure exists for.

        **What the test CANNOT distinguish — and why that is deliberately left alone.** A code-span occurrence comes in four kinds and this rule counts all four: (i) a genuine quote of the declaration (`` `mopt = (m) => (m ? { model: m } : {})` ``); (ii) a schema or field name equal to the identifier (`` `deviations[]` ``); (iii) a **filename whose stem equals the identifier** (`` `.harness/study/topics.json` ``); and (iv) an unrelated token that merely sits inside a code span (`` `render in ${LANG}` `` matches the `render` helper at line 55). Kinds (iii) and (iv) are not references to the declaration at all.

        Measured against this repository, one declaration enters the top two on kinds (iii) and (iv) ALONE, with **zero** references to the declaration itself — and **leave it that way.** Excluding filename-stem occurrences flips the top two to a disjoint pair, one of them centred on exactly the prologue-and-schemas region the paragraph above exists to keep the window away from. The proxy's false positives correlate with the code a document is actually discussing, because a document that explains the reconcile step also names the files that step reads and writes. So **do not add a kind-(iii) or kind-(iv) exclusion, and do not "tighten" this test** — measured, the strict reading is the worse one (`workflows/_reference/study_measurements.md` §Named By Name). This is the same shape as the extension-ordering rule in step 2: an obvious-looking cleanup that a measurement reverses.

        The correlation is luck, not a guarantee, so the residual risk is stated rather than hidden: a document that names a file whose stem collides with an unrelated declaration far from the interesting code will pull the window there, and **nothing in this skill catches that.** The chosen range is recorded only in step 6's `## Cited Source Files` heading (`path (lines a-b of T, cited N times)`), while Step 1.6's gate summarizes that whole block as a file count plus a line total — so the window's position is not in front of the user at the one approval that spends tokens. Surfacing the per-file ranges at that gate is the cheap remedy if this ever bites; it is not done today.

        If nothing qualifies — or the outline came back empty in the first place — take the **last `min(⌈T/3⌉, 300)` lines of the FILE**, ending at line `T` (its executable part), not a third of the outline list: an empty outline has no third to take, and after the table above that is a routine case for any extension with no pattern set. Head-truncating a 732-line segment script yields its schemas and prose and drops the fan-out, bucketing and reconcile — the part worth studying.

        **The `300` in that expression is the per-file cap and it is load-bearing, not belt-and-braces.** An uncapped "last third" breaches the per-file cap on any file over 900 lines (`⌈T/3⌉ > 300`), and that is reachable in ordinary data rather than in a constructed case: measured, a `.sql` schema file recovered by bare basename runs 974 and 1,305 lines on a real target, giving an uncapped third of 325 and 435 — 1.08× and 1.45× the per-file cap, and 59% and 79% of deep's entire 550-line total in one file (`workflows/_reference/study_measurements.md` §Fallback Cap). No measured file breaches the TOTAL budget this way, only the per-file one — but the per-file cap is what step 4's arithmetic and its counterfactual both assume, so an exception to it silently invalidates them. **Seven of the 23 extensions in step 2's pattern have no outline row** (`json`/`yaml`/`yml`/`toml`/`html`/`css`/`sql`), so the fallback is their normal path, not their exception, and a config or schema file large enough to breach the cap is an ordinary member of that set. **If more than two named declarations qualify, take them in the order the documents first mention them, then by ascending line number in the outline** — a windowing rule without a tie-break re-introduces exactly the non-determinism step 3 removed. (Line number, not path: every candidate here lives in the SAME file by construction, so a path tie-break can never separate two of them.)

        **The two windows can overlap, and on real code they usually do — merge them, and count the union.** A window is `[max(1, d-74), min(T, d+75)]` where `d` is the declaration's line and `T` the file's line count (clamping at either end only shortens a window; it never slides it). Two windows that overlap or touch — `start2 <= end1 + 1` after sorting by start — become the single range `[min(start), max(end)]`, and the line count Step 1.3(4)'s budget sees is that UNION, never the sum of the two. **Do not instead slide the second window down to the next non-overlapping qualifying declaration.** That reading buys line count by re-opening the selection this sub-step just closed: it overrides "the order the documents first mention them" with a second, competing rule, and it centres a window on a declaration the documents mentioned *less*, purely because it sits further away. Merging changes no selection at all — it only stops the same lines from being gathered twice, and stops the budget from being told 300 when it received 151.

        Overlap is the normal case here, not a pathology — the ordering rule ranks by first mention in the documents, and a document discussing one part of a file names the declarations that sit next to each other inside it. Measured on this repository's own segment script, the first two qualifying declarations sit on **adjacent lines**, so a naive sum of 300 stands against a union of **151**. That measurement is taken on the FILE, not on a live selection, so the merge rule itself remains **unrun** on every `--harness` target here (`workflows/_reference/study_measurements.md` §Window Merge).
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
   - one evidence line — `Evidence : spec.md + changes.md + <F> cited source files (<L> lines total)` — so the user sees how much §1.3 actually pulled in at the moment of the only irreversible-spend approval, not afterwards. **On the workflow path this line MUST also carry the prose reservation**: `spec.md <kept>/<total> + changes.md <kept>/<total> chars`, where `<kept>` is the FINAL length — the reservation **after** Step 2-W's slack return, not the bare reservation. All three of its inputs (the reservation, the filled code, the overhead) are known once Step 1.3(4)'s fill has run, so computing it here does not wait on Step 2-W; Step 2-W is only where it is applied to the payload. Without this the line names the two documents unconditionally while the authors may receive a fraction of them — measured on `--harness study-skill`, 10,895 of 47,993 characters, **23%** — and the only per-document notice (`kept K of T`, Step 2-W) prints AFTER the gate, i.e. after the spend. A gate that reports code volume to the character and prose volume not at all is disclosing the cheaper half;
   - **and, when `F == 0` or any candidate carries `codeAnchor: none`, one warning line** (in `user_lang`): those topics will be anchored in prose rather than code, and the remedies are to narrow the target to something containing executable code or to drop those candidates via "Edit selection". This is a warning, never a block — a documentation-only change is a legitimate thing to study, and the user is the one who knows which case this is.
   - **and, when `path_resolved == workflow`, one dense-target line** (in `user_lang`) whenever Step 2-W's 35,000-character cap would force a reduction — per target kind: on a harness slug, when `len(spec.md) + len(changes.md) + <a full-line-budget fill> + overhead > 35,000`; on `--diff` or `--project`, when that branch's evidence exceeds `35,000 − overhead` (measured, both do so on this repository: a 199,206-character diff and an 83,258-character README). The condition asks what the cap COSTS — it compares undiminished demand against the cap — which is the same test Step 2-W fires on, so the gate and the reduction can never disagree. **Do NOT rewrite it as "the reservation plus the top-ranked cited file exceed the cap": that is structurally impossible and would make this line dead**, because `reserved + kept code + overhead ≤ 35,000` is an INVARIANT of every completed fill, so any subset of a kept payload also fits and the test could only fire when the fill took zero files (`workflows/_reference/study_measurements.md` §Gate Condition). **`<a full-line-budget fill>` means Step 1.3(4)'s fill with the CHARACTER-remainder constraint removed** — line budget, per-file cap and file ceiling only. On a character-bound target that is a strictly LARGER quantity than the fill actually executed, so the ranking and its windows have already run by this point and no new analysis is needed, but this one sum is computed HERE from them — Step 1.3(4) never printed it. The error direction is safe: always ≥ the executed fill, so the test can over-warn but never stay silent on a real reduction. Name what the cap drops — how many ranked files the character remainder admits and which it excludes, or which per-file diffs / structural files fall off the bottom — and say that `--mode quick` carries no such cap and holds its full 600-line budget in one context. Step 2-W is where the cap is *spent*; this gate is where its consequence is *disclosed*, so a dense target must never reach it silently: the user would approve a deep run and receive a guide whose central file was dropped, learning it only from the completion block. Like the line above, this is a warning and never a block.

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

   Store as `model_config` (same shape/validation as `templates/_shared/model_config.md`). Persist to `.harness/model_config.json` **subject to the `model_config_preexisting` rule in §Mode Gate** — when that file was already there at entry, hold `model_config` in orchestrator context only and write nothing.

9. **Print setup summary** (in `user_lang`) using the Standard Status Format above, with `Phase: setup`.

### Step 2: Authoring

#### If mode == "quick": Step 2-Q (inline, no sub-agent, no Workflow tool)

Read `{CLAUDE_PLUGIN_ROOT}/templates/study/topic_author.md` and follow its Identity/Instructions/Output/Constraints **directly, yourself**. **Placeholder binding for the inline path** (the file is written for a dispatched agent, so bind its placeholders before following it). Its live placeholders are exactly these four — `{topic_list}`, `{evidence_digest}`, `{target_evidence}`, `{user_lang}` — and **`{persona_id}` is NOT one of them**: that one exists only in the workflow path's embedded copy (`TPL_TOPIC_AUTHOR`), and inside `topic_author.md` it appears only in the DUAL-USE comment that says exactly that, so do not go hunting for it in the body. Bind `{user_lang}` → `user_lang`; `{topic_list}` → the approved topic list; `{target_evidence}` → the evidence you gathered in Step 1.3; and `{evidence_digest}` → **empty**, because it is the workflow path's lens output and this path produces none — rely on `{target_evidence}` alone. Author, once per approved topic (this is the DUAL-USE precedent from `templates/test-gen/coverage_analyst.md` — the file is the single source of the 7-section authoring contract; this SKILL references it and does not restate its rules). Author all approved topics (3-5) from the evidence gathered in Step 1.3, applying the same provenance fields and length caps as the workflow path (the re-verification/badge rules of Step 3.4-3.5 below apply identically) — quick is a complete path, not a reduced one.

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
         // Step 1.3's budget caps the cited source files, but until the rungs below existed nothing
         // capped `spec.md` + `changes.md`, and the `--diff` branch's own cap is a LINE cap that
         // says nothing about characters: measured within ONE target, the two documents are 47,993
         // characters against the **23,511** its own 548-line fill gathers — the uncapped part is
         // 2.04× the budgeted part. **Count characters on both sides of every comparison in this
         // block** (an earlier revision compared CRLF BYTES to characters and overstated the ratio
         // by ~1.9×), **and cite the cap by NAME, never by line number** — an absolute pointer
         // inside this file is checked by no Layer 1 script and silently rots on the next edit, as
         // an earlier revision of this very sentence did. quick pays none of this (the evidence
         // never leaves the orchestrator's context), which is why the cap lives here and not in 1.3.
         // **Cap: 35,000 characters.** Do NOT raise it to buy room: the measured failure point is
         // ~56,000 (dispatch unexecutable), the safe boundary between the two is UNMEASURED, and
         // the failure mode is the dispatch not running at all. Reserve prose instead (below).
         //
         // **This cap, not Step 1.3(4)'s line budget, is the binding constraint on THIS path** —
         // so reserve prose FIRST and let the reserved remainder size the cited block, rather than
         // filling lines and discovering there is no room left. Chars-per-line is language-
         // dependent, and the old "550 lines is about 23,000 characters" assumption is low for
         // Java: measured, a filled 550-line gather reaches **31,945** characters, leaving 3,055 of
         // the cap for two documents measuring 26,688 together
         // (`workflows/_reference/study_measurements.md` §Serialization Cost).
         // Order of operations:
         //   1. Compute the two documents' RESERVED PREFIXES (the rule below). This depends only on
         //      their lengths, so it is computable before anything is selected.
         //   2. Give the entire remainder to the `## Cited Source Files` block, and stop adding
         //      files when either that remainder or Step 1.3(4)'s line budget runs out — whichever
         //      binds first.
         //   3. quick pays none of this (the evidence never leaves the orchestrator's context), so
         //      the inline path fills its full line budget and ignores this entire section.
         // **The remainder is `35,000 − <reserved> − this block's own overhead`, not `35,000 −
         // <reserved>`.** The cap applies to the whole `sharedEvidence` string, so the
         // `## Cited Source Files` heading, every `path (lines a-b of T, cited N times)` header line
         // and any truncation notice consume it too. Two readers who ignore the overhead compute
         // two different remainders, which is the same class of non-determinism step 3 exists to
         // remove. **And do this arithmetic with a script, not by eye** — the standing rule from
         // Step 1.3 sub-procedure step 1 applies unchanged here: character counting and
         // line-boundary snapping are byte-level operations, and by hand the same target yields a
         // different reservation on every run.
         //
         // **On a dense-code target, prefer quick — the cap cannot hold both.** Reserving prose
         // first protects the rationale but starves the cited block, and no split of 35,000 fixes
         // it when individual files are large. **This is not a ratio to tune; it is the cap being
         // smaller than the target needs** — and that is measured, not asserted: on the one dense
         // target in the measured set the reservation is 8,627 characters, the fill takes two of
         // the three ranked files and drops `FaceAuthSseWindowApplication.java`, the class the
         // feature is ABOUT and the one whose two windows merge; and the previous name-based
         // reservation, which left 9,232 characters MORE room for code, admitted the SAME two
         // files. Freeing headroom therefore buys zero additional code there. What the positional
         // rule buys is a reservation that is computable and non-zero on the targets where the
         // name test scored zero — never more evidence on a dense one. The per-file figures, and
         // the four repudiated ones this paragraph used to carry, are in
         // `workflows/_reference/study_measurements.md` §Reduction Order and §Repudiated Figures.
         //   quick has no such cap and holds its full 600-line budget in one context, which is the
         //   second and stronger reason the budgets do not rank the way the mode names suggest
         //   (§Risks). When a target's top files are this large, say so at the Step 1.6 gate — the
         //   gate defines that line, and Step 1.3(4) has already computed the arithmetic it needs —
         //   so the user can choose quick knowingly rather than receive a deep guide whose central
         //   file was silently dropped.
         //
         // **The reduction IS the reservation plus the fill — there is no second, later ladder that
         // reduces again.** Read the four rungs below as what each part may and may not give up, not
         // as a sequence to run after assembling an over-cap payload:
         //   1. the `## Cited Source Files` block is NEVER trimmed and code is NEVER shaved. Step
         //      1.3(4)'s fill has ALREADY bounded it by the character remainder, so there is nothing
         //      here to re-cut; a file that did not fit was never gathered.
         //   2. `spec.md` is cut from its TAIL to its reserved prefix (the rule below) — this is
         //      where the cap is actually paid;
         //   3. then the same for `changes.md`;
         //   4. a `--diff` or `--project` target carries neither document — those two branches have
         //      their own rungs, stated at the end of this comment.
         //
         // **An earlier revision framed these four as "Over the cap, reduce in this fixed order and
         // no other", and that framing is a measured trap.** Under the reserve-first order the
         // assembled payload satisfies `reserved + filled + overhead ≤ 35,000` by construction, so
         // "over the cap" can only be reached by comparing UNDIMINISHED demand against the cap — and
         // running rung 1 first on that comparison drops all the code before any prose is touched,
         // landing on a prose-only guide with 62% of the cap unspent. Measured, the difference is
         // 23,511 characters of the very evidence this skill exists to quote
         // (`workflows/_reference/study_measurements.md` §Reduction Order). The ordering above is
         // the one that is measured to work.
         //
         // **Slack after the fill returns to prose, and this is provable rather than a preference.**
         // If `reserved + filled + overhead < 35,000`, extend the reserved prefixes — **ONE pass, no
         // iteration** — by splitting the slack on the SAME basis as the reservation itself
         // (`len(spec)` and `len(changes)`, the ORIGINAL lengths, not the unread remainders), then
         // snapping each extended offset DOWN to a line boundary and never past whole. **If one
         // document is already whole its share goes to the other**; if both are whole there is
         // nothing to place. Where the two independent `round_half_up` shares would sum to one more
         // character than the slack, take the smaller — the total may never exceed the ceiling.
         //   **One pass, and the snap loss is NOT recovered — a deliberate determinism trade.**
         //   Snapping down leaves some slack unused; an iterating reading recovers most of it but
         //   needs a redistribution rule this one does not state, a termination argument, and a
         //   second competing definition of the split. The two readings differ by 362 characters
         //   on a measured target — a figure the §1.6 gate prints, so an unpinned choice is a
         //   determinism violation in a number the user approves against. One pass wins.
         //   **`11,262` on that target is the CEILING (`35,000 − 23,511 − 227`), never an achieved
         //   value** — an earlier revision reported it as the result; the rule reaches 10,895.
         //   **The slack can never instead admit another code file**, and the proof has THREE
         //   cases, because Step 1.3(4)'s fill has three stop conditions: character-bound (the
         //   slack IS the very remainder the next file already exceeded), line-bound, and
         //   file-count-bound — character slack lifts neither a line cap nor a file ceiling.
         //   State all three; two successive revisions each stated fewer and said so wrongly.
         //   Measurements: `workflows/_reference/study_measurements.md` §Reduction Order.
         //
         // **Reserve prose by POSITION. This step never parses a heading — not its text, not its
         // level.** Two earlier rules here did, and both are measured failures with the same root
         // cause: a heading is not a contract this skill controls. The NAME test
         // (`Goal`/`Background`/`Scope`/`Approach`) scores ZERO on 3 of 10 real `spec.md` files and
         // on ALL 8 `changes.md` files, across five different heading vocabularies, because both
         // producers render headings in `user_lang`. The SUBTREE test keeps the heading ALONE
         // whenever a section's body sits at a SHALLOWER level than its heading — 12 characters of
         // 42,492 on this repository's own spec. Neither is repairable by lengthening a list; the
         // measurements, target by target, are in `workflows/_reference/study_measurements.md`
         // §Prose Reservation.
         //
         // **The rule.**
         //   len(f)     = f's character count after normalizing CRLF to LF — fix this, or the same
         //                file reserves differently per platform (measured spread on this
         //                repository's own spec: 277 characters). A kept PREFIX is measured the
         //                same way and INCLUDES its final line terminator.
         //   PROSE_CAP  = **8,750 characters**, for BOTH documents together (25% of the 35,000 cap).
         //   reserve(f) = min(len(f), round_half_up(PROSE_CAP × len(f) / (len(spec) + len(changes))))
         //   then snap DOWN to the end of the last COMPLETE line at or before that offset, so a
         //   sentence, table row or list item is never cut mid-line. Ties in round(): half up.
         //   Two worked reservations, re-derived from the real files rather than inherited:
         //   `workflows/_reference/study_measurements.md` §Verified Independently.
         //   Branches, all of them reachable in the measured set:
         //     - a document shorter than its share is kept WHOLE and reserves nothing further — its
         //       unused share becomes room for code (measured: `dryrun-version-flag` keeps both
         //       documents entire at 2,914 + 849, and `coin-washer-setup-manual` its whole 1,277);
         //     - `changes.md` absent → its len is 0, so `spec.md` takes the whole PROSE_CAP
         //       (measured: 2 of the 10 targets have no `changes.md`);
         //     - both absent → there is nothing to reserve and the cited block gets the full 35,000.
         //   **This fires only when the full serialization — both documents whole plus the filled
         //   cited block plus the overhead above — would exceed 35,000.** Under the cap both
         //   documents go in whole. Over it, the reservation is the floor the prefixes are cut TO,
         //   and the slack-return rule above then hands back everything the code did not use — which
         //   is what makes "a floor, not a quota" literally true instead of merely intended. Without
         //   that return it would be false: sizing the fill at `35,000 − PROSE_CAP − overhead` is
         //   itself what creates the over-cap state that justifies cutting prose to PROSE_CAP, so
         //   code takes the room first and prose is then trimmed to a quota. The return closes that
         //   circle; do not drop it as an optimization.
         //   Measured across the same 10 targets, the reservation rises on **9** and falls on **1**
         //   — the fall being the dense-code target where the old reservation had starved the code,
         //   so that is the intended direction. Do not sell this rule on the dense target; sell it
         //   on the three targets that reserved nothing at all
         //   (`workflows/_reference/study_measurements.md` §Prose Reservation).
         //   **8,750 is a policy ceiling, not a measured threshold.** Its one anchor is the
         //   24,923-character filled gather, which leaves 10,077 characters; 8,750 sits under that.
         //   Raising it requires a new measurement first, exactly as the 35,000 cap does.
         //
         // **What the positional rule does NOT promise.** A head prefix is a PROXY for "where the
         // rationale lives", and measurably not a guarantee: `/spec` puts a derived `## Review
         // Sheet` ahead of the seven canonical sections (`skills/spec/SKILL.md` §Spec Output
         // Format), 2 of the 10 measured specs open on something else entirely, and one measured
         // target loses a section the old name test held. Do not write this rule up as reaching the
         // rationale; it reaches the document's opening, which on measured evidence is usually but
         // not always the same thing (`workflows/_reference/study_measurements.md`
         // §Prose Reservation).
         //
         // **`--diff` and `--project` rungs (4).** Neither branch produces a `spec.md`, a
         // `changes.md`, or a `## Cited Source Files` block, so rungs 1-3 have nothing to act on and
         // this cap was, until measured, entirely unenforced on them. **PROSE_CAP does not apply on
         // these two branches** — there is no decision ledger to reserve for, so by the "both absent"
         // branch of the rule above the whole `35,000 − overhead` goes to that branch's own evidence.
         // Reserving 8,750 here would strand it: nothing is entitled to it.
         //   - `--diff` — the branch's own "first ~3000 lines / ~150 files" cap is a LINE cap and
         //     says nothing about characters. Measured 2026-08-04, `git diff main..HEAD` on this
         //     repository is 2,145 lines / **199,206 characters**: already inside the line cap, and
         //     5.7× the character cap and 3.6× the ~56,000 at which the dispatch stops being
         //     executable — so the line cap has never once bound on a real range here, and the
         //     dispatch would simply not run. Keep `git diff --stat` whole (measured 794 characters
         //     over 15 files; it is the one piece the §1.6 gate already shows the user), but treat
         //     it as capped evidence like everything else rather than as free overhead — at this
         //     branch's ~150-file limit the same per-file rate extrapolates to roughly 8,000
         //     characters, which is an ESTIMATE, not a measurement. Cut the unified diff to
         //     `35,000 − overhead` at a **file boundary**: whole per-file diffs, dropped from the
         //     BOTTOM of `--stat`'s file order, never a partial hunk. A partial hunk is a shaved
         //     excerpt, and §3.4's quote re-verification cannot check one — the same asymmetry
         //     rung 1 enforces for cited files.
         //   - `--project` — "README/CLAUDE.md excerpts" had no cap of any kind, and "excerpts" set
         //     no size. Measured, this repository's own `README.md` is **83,258 characters** (84,922
         //     bytes), 2.4× the whole cap by itself. Cap the structural pass plus excerpts at the
         //     same `35,000 − overhead`, take each prose file's head, and drop whole files from the
         //     bottom of the structural listing. **The head-truncation applies to PROSE only.** If
         //     an entry-point item carries an actual code excerpt rather than just a path, it obeys
         //     rung 1 instead — whole file or not at all, never a head — for the same reason the
         //     `--diff` rung refuses a partial hunk. Step 1.3's `--project` branch does not say
         //     which of the two an "entry point" is, so decide by what you are about to emit: a path
         //     listing is prose, a quoted excerpt is code.
         //   Both notices take the same form as the `--diff` truncation notice, and both surface at
         //   the §1.6 gate through the dense-target line rather than being discovered afterwards.
         //
         // **Prose may be truncated; code may not.** Prose degrades gracefully in whatever survives,
         // whereas a shaved excerpt breaks the §3.4 quote re-verification the whole guide rests on.
         // That asymmetry is why (1) drops whole files and this step never removes a byte from one.
         //
         // **Two escape clauses that used to live here are STRUCTURALLY DEAD on the harness-slug
         // branch — recorded rather than deleted, so the next round does not re-derive them as
         // missing.** Both ("cut further from the tail of the larger prefix" and "proceed over the
         // cap and say so") are unreachable here by the same construction: the fill admits a file
         // only while `code + overhead ≤ 35,000 − reserved`, and in the degenerate case it takes
         // ZERO files. **They can only fire on the `--diff`/`--project` branches, where PROSE_CAP
         // does not apply and rung 4's own cap governs — keep them for those two and do not
         // resurrect them here.** Proofs and the 10-target range:
         // `workflows/_reference/study_measurements.md` §Dead Escape Clauses. **This is the same
         // treatment the §1.6 gate condition gets a few paragraphs up** — a condition proven
         // unreachable is written down as unreachable, not left in the list looking load-bearing.
         // Print one line per reduced document (in `user_lang`), same form as the `--diff`
         // truncation notice: `<file> : kept <K> of <T> characters (through line <L>)`. **This
         // replaces an earlier "naming every section dropped or truncated" instruction, which an
         // offset cut satisfies vacuously** — offset cutting drops no *sections*, so a 90% tail loss
         // would report nothing at all and the file's own worst case (a silent, total loss) would
         // reappear in the very rule written to prevent it. `K`, `T` and `L` need no heading parsing,
         // so they are computable by the same script that computed the reservation, and `kept 0 of
         // <T>` prints in the same form rather than printing nothing. `K` is the FINAL kept length —
         // after the slack return, not the bare reservation — so it matches what the §1.6 gate
         // printed. On the `--diff`/`--project` branches, where clause (b) above is live: if the
         // capped evidence alone still exceeds the
         // cap, do NOT trim it — proceed over the cap and say so in that same line, because a guide
         // anchored in truncated code is the exact failure this skill exists to avoid.
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
   Record the segment `runId` in `.harness/model_config.json` (audit-only; skipped entirely when `model_config_preexisting` — §Mode Gate). The script runs 3 evidence lenses in parallel (mechanism / rationale / pedagogy), fans the approved topics out to 2-3-topic authoring buckets (each bucket's author owns its topics' full 7 sections — so Q&A and exercise answers never contradict each other within a topic), runs a completeness/reproducibility critic in thorough mode only, and (when there is more than one bucket, or a critique exists) an assemble pass that merges cross-links/glossary de-duplication/tier bookkeeping — assemble NEVER re-authors topic content; the bucket outputs are the content, verbatim.

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
   | `glossary[]` + `furtherReading[]` (g) | `<h3>Glossary & Further Reading</h3>`, then the **canonical link-disclosure line** (below) wrapped as `<p class="further-reading-note">` at the FIRST rendered topic's heading ONLY — never repeated in later topics; each `furtherReading` link carries `<span class="badge link">` | `#### Glossary & Further Reading`, the **same canonical line** at the FIRST rendered topic's heading only |
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
   2. **Markdown header** — directly under the `# ` title of the `--md` document, before the first topic (Step 3.2.2, where the `--md` document is built; Step 3.7 is that path's escaping and safety nets, and says nothing about this line).
   3. **Section (g) head** — **once per rendered document**, at the FIRST rendered topic's Glossary & Further Reading heading (both output formats, per the mapping row above). *Once per document, not once per topic.* Every topic owns a (g) section, so the per-topic reading stamps the same three-line paragraph on the page once per topic plus the banner: measured 2026-08-04 on a 4-topic guide it landed 5 times, and a thorough run (10-15 topics) would reach 16. Nothing is lost by not repeating it — the per-item guarantee is already structural, since every external link carries its own `[Link unverified]` badge (§3.4).

   The wording is identical at all three; only the surrounding markup differs. If the three ever diverge, the (g) section head is authoritative.

4. **Provenance re-verification (orchestrator step, BEFORE rendering any excerpt):** for every excerpt with `source:'repo'`, re-read the real file at `path` (resolve ⊆ cwd; normalize `\`/`/`; reject if unreadable, binary, or outside the repo). Compare with **whitespace-normalized fingerprinting** (never raw string equality — CRLF/tab/indent differences must NOT downgrade a genuinely correct quote): the excerpt's first non-blank line and last non-blank line, trimmed, must both appear within `[lineStart, lineEnd]` of the real file, and `1 ≤ lineStart ≤ lineEnd ≤ file line count`. Track WHY a downgrade happened (report as sub-counts alongside the required `Quotes` line): `path-invalid` (unresolvable/escaping path) / `anchor-missing` (line range invalid or file too short) / `content-mismatch` (fingerprint disagreement) — this stops a wave of downgrades from being misread as "the model hallucinated everything" when the real cause is a path-format bug.
   - Passes verification → badge `[Code quote: {path}:{lineStart}-{lineEnd}]` (localized to `{user_lang}`, placeholders raw).
   - Fails verification → badge `[Anchor verification failed]`.
   - `source:'model'` → badge `[Model-generated example — not repository code]`.
   - `furtherReading[]` entries → badge `[Link unverified]` always (disallowed-tools makes this structural, not a judgment call).
   - **`verified` is never a field the author fills** — there is no such field in the schema; the badge is computed here, purely from `source` + the re-read result.

   **4a. Excerpt-kind tally (same pass, orchestrator-only — never a field, never written to the JSON snapshot).** Classify each excerpt by its `path` extension: `code` (`.js`/`.mjs`/`.cjs`/`.ts`/`.tsx`/`.py`/`.go`/`.rs`/`.java`/`.c`/`.cc`/`.cpp`/`.h`/`.rb`/`.sh`/`.ps1`/`.sql`) / `config` (`.json`/`.yaml`/`.yml`/`.toml` plus known extension-less config files) / `prose` (`.md`/`.mdx`/`.txt`/`.rst`/`.adoc`). Two refinements: a `path` under `skills/**` or matching `templates/**/*.md` is **`prose-self`** rather than `prose` — it means the guide quoted this skill's own procedure text back as a topic's code, which is the circular signal that produced a prose-anchored guide in the first place; and `.html`/`.css` count as `code` only if the quoted excerpt contains `<script`, otherwise `unknown`. `source:'model'` excerpts are counted in no bucket (they already carry their own badge).

   **The five buckets PARTITION the counted excerpts — `prose-self` is not a subset of `prose`.** "rather than `prose`" above is exact: an excerpt classified `prose-self` is NOT also counted in `prose`, so `code + config + prose + prose-self + unknown` equals the number of excerpts carrying a `path`, and that identity is what makes the Step 5.2 `Excerpts` line checkable at a glance. This is also why §3.9 can compare `prose-self` against `code + config` at all — a subset reading would make that comparison meaningless. Render the five side by side, never one parenthesized inside another. **This is an extension-based approximation, not a real code/prose discriminator** — a `.json` can hold logic and a `.py` docstring can be pure prose. It is therefore reported, and (per §3.9) may gate only the outward-facing publish, never the content.

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
   - The completion sentinel `<!-- study-guide: topics=N sections=M complete -->` is appended as the LAST line, once, after all content is written (`N` = topic count, `M` = total **non-empty** sections across all topics, per the empty-section rule in §3.3). **`M` is counted at §3.3 MAPPING-ROW granularity — max 7 content rows per topic, where `glossary[]` + `furtherReading[]` are the single row (g)** (so a topic with a populated glossary and zero further-reading links contributes 7, not 6.5 or 8). **The seven are the LETTERED rows (a)-(g) only, so `relatedTopicIds` never contributes to `M`** even though the empty-section rule above does govern whether it renders. Stated because the two lists differ and the difference is not cosmetic: `relatedTopicIds` is assemble output that exists ONLY on the workflow path (§3.3, last row), so counting it would make one and the same seven-section topic report a different `M` inline than in deep/thorough — a difference with no content behind it, in the one number whose whole job is to prove the write was not truncated. This is intentionally coarser than `stats.missingSections`, which reports at schema-key granularity (`t2.furtherReading`) because a reader asking "which array came back empty?" needs the finer answer. Two granularities, each with a named consumer — do not unify them.

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

1. **Clean up `.harness/`** — delete `.harness/study/topics.json`, and delete `.harness/model_config.json` **only when `model_config_preexisting` is false**, i.e. only when this run is the one that created it (§Mode Gate). When it pre-existed, leave it byte-for-byte as found: that file belongs to a `/deep-review` or `/codebase-audit` run that shares this unnamespaced path, study never wrote to it in that case, and deleting another skill's session record is not cleanup. Then remove `.harness/study/` and `.harness/` itself if empty — a preserved `model_config.json` keeps `.harness/` non-empty, so that removal simply does not fire, which is the correct outcome and not a leak. Always, success or Abort; stateless per §Mode Gate declaration (leaving behind a file study itself created would make a stateless skill accumulate session files run after run). `docs/harness/<slug>/` and `docs/harness/study_index.md` are NEVER touched by cleanup.
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
     Excerpts : <C> code / <F> config / <D> prose / <Sd> self-doc / <U> unknown — no code/config excerpt in <Z>/<N> topics
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

- **quick holds everything in one context.** The inline path carries the full gathered evidence, authors 3-5 topics against it, and renders a report that has measured ~60KB — all in a single orchestrator context. A run that overruns it loses the authored topics, not just the render, which is why the Step 1.3 total cap drops whole files rather than shaving them. Note the budgets do NOT rank the way the mode names suggest: quick's row (600 lines) is the LARGEST of the three, because deep and thorough pay for their evidence again per agent — see Step 1.3(4).
- **A single large Write can truncate silently.** A truncated HTML file still renders in a browser, so the failure is invisible without the Step 3.2.3 tail check. Prefer the deterministic script; on the fallback path, Write the shell plus the first topic and Edit in the rest.
- **The workflow path pays a serialization cost quick does not.** `args.sharedEvidence` is emitted inline by the orchestrator and then re-embedded in every lens and bucket prompt, so evidence size multiplies by the agent count. The 35,000-character cap in Step 2-W exists for this and has no analogue on the inline path. It binds on all THREE target kinds, not only on a harness slug: measured 2026-08-04, a real `git diff` range serialized to 199,206 characters and this repository's own `README.md` to 83,258 — 5.7× and 2.4× the cap, from targets that carry no `spec.md` at all. Step 2-W rung 4 is what reduces those. (Both figures are LF-normalized CHARACTER counts, not the 200,487/84,922 byte sizes `wc -c` reports; the cap is a character cap, and quoting bytes for it is a mistake this file has now made twice.)
- **Every count in this skill is a count, not a guarantee of understanding.** §5.3 states the boundary; do not let a green accounting block be read as a claim about what the reader learned.

## Key Rules

- **§Allowed Writes — read-only over analyzed source.** (This bullet is the label that the `§Allowed Writes` references in §Mode Gate and Step 3.2.2 resolve to; if the bullet is ever moved or re-titled, carry the label with it, because those two references are load-bearing.) The Author segment and its lenses/topic authors/critic/assemble NEVER modify or write a source/config file. **The ORCHESTRATOR's writes are the sanctioned exception, and ONLY these five:**
  1. `docs/harness/<slug>/study_guide[_round<N>].{html|md}` (the rendered guide — HTML default, `.md` under `--md`, never both)
  2. `docs/harness/<slug>/study_guide[_round<N>].json` (the SSOT object snapshot — `studyGuide` only, no telemetry)
  3. `docs/harness/study_index.md` (fixed root-level path, append-only, `resolve ⊆ cwd`)
  4. `.harness/study/topics.json` (session-scoped cache, cleaned up at Step 5 or on Abort)
  5. `.harness/model_config.json` (session-scoped audit record of `{ mode, path_resolved, runId }` — written in EVERY mode including quick, per §Mode Gate and Step 1.8, **and only when this run created the file**; **deleted at Step 5.1 under that same condition**, the `/deep-review` precedent). The path is shared with `/deep-review` and `/codebase-audit` and is not namespaced per skill, so "study writes and deletes it" is true only of a file study itself created — see §Mode Gate's `model_config_preexisting` rule. Listing it here closes a self-contradiction: the earlier draft declared "only four" while two other steps in this same file wrote a fifth path and cleanup never removed it.

  **And the target's own documents are never written.** `spec.md`, `changes.md`, and anything else already sitting in `docs/harness/<slug>/` are INPUTS. The guide is written into that SAME directory (Step 1.2 self-targeting note), which makes it the one place in this skill where an input file and an output file share a parent — so the absence of a rule here is not safe by default. Never modify, truncate, append to, re-format, or delete them, and never "fix" a path or a stale statement noticed in them mid-run: a `--harness` run that edits its own evidence has destroyed the ledger the next round is graded against, and §3.4's quote re-verification would then be checking the guide against a file the guide itself changed. Round numbering (§3.1) protects prior `study_guide*` files by NAME only; it says nothing about `spec.md`/`changes.md`, and this clause is what covers them.
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
