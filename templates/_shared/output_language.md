# Output Language Contract — Preserved-English Glossary (single source)

> Cited by name from `skills/harness/SKILL.md`, `skills/harness-gate/SKILL.md` and
> `skills/harness-build/SKILL.md` §Output Language Contract. Those files carry the Invariant and
> the Print Translation Pattern inline — every print obeys them without reading this file. This
> file holds only the token TABLE, read when a renderer needs to know whether a specific token is
> translatable.

All orchestrator output visible to the user is rendered in `user_lang`. The tokens below are the
exception: they stay English raw in all output, and translating one is a defect.

| Category | Tokens |
|---|---|
| Status keywords | `PASS`, `FAIL`, `FAIL_L2`, `FAIL_L3`, `Verdict`, `Verdict: PASS`, `Verdict: FAIL` |
| Confidence | `confidence: High`, `confidence: Medium`, `confidence: Low`, `confidence: Unknown` |
| 1-line return verbs (INLINE path only) | `generated`, `changed`, `written`, `conventions written`, `auto_fix_patch written`, `review written`, `verdict written` (the converge loop's two sub-agents — `templates/harness/converge.md` §Round) — as leading keyword tokens in an inline sub-agent's 1-line return only; natural-language usage in prose is exempt |
| Prefix | `[harness]` (and `[harness doctor]`, `[harness-build]` for those surfaces) |
| Status format labels | `Task`, `Mode`, `Path`, `Model`, `Style`, `Phase`, `Round`, `Branch`, `Scope`, `Directory`, `Verifier`, `Language`, `Test`, `Build`, `Lint`, `TypeCheck`, `Output`, `Decision`, `Critic`, `Next cmd` — monospace alignment preservation. `Next cmd` is rendered by `/handoff` resume; no skill of the harness pipeline has a `Next cmd` output site of its own |
| Session Boundary Type B `Reason` value | `Epic planned` — a *value*, not a label (`skills/harness-build/SKILL.md` §Session Boundary Type B) |
| Identifiers | state.json field names (`verify.layer1_retries`, `runs.plan.runId`, …), file paths (`{docs_path}verify_report.md`, `.harness/…`), git branch names (`harness/<slug>`), commands (`./gradlew test`, `npm run lint`), state-machine phase keys (`plan_ready`, `generating`, …), schema field names (`acceptanceCriteria`, `modifiedFiles`, …) |

**Deliberately NOT Glossary tokens.** The other Session Boundary `Reason` values — `QA PASS`,
`Accept as-is`, `Max rounds reached` — are translated. Adding them here would newly fix values
that existing sessions render in `user_lang`, changing output that is already correct.

**`critic_findings written`** is a real inline leading keyword (`skills/harness/SKILL.md`
§Step 2.6, INLINE branch) that is NOT in the verb row above. A declared gap, recorded rather than
closed by inventing a Glossary entry.

## §User Language Detection

Detect the user's language from their **most recent message**; store it as `user_lang` in state.json and re-check on every message. **All user-facing communication** (progress, questions, confirmations, errors, spec sections, QA narrative, commit messages) is in `user_lang`. **Stays English:** template instructions, state.json field names, file names, git branch names, Workflow `args` field names. **WORKFLOW path:** pass `userLang` in `args` — segment scripts build schema descriptions from it (`render in <userLang>`); enum/identifier fields stay English raw.

## §Invariant and Print Translation Pattern

### Invariant

All orchestrator output visible to the user is rendered in `user_lang`. Backtick-inline English inside `Print:` directives is a template format, not an output-language declaration; when `user_lang == "en"` this contract is a no-op. Every new `Print:` directive must conform (CI enforcement is a TODO).

### Print Translation Pattern

When rendering a `Print:` directive: translate natural-language portions to `user_lang`; Glossary tokens stay raw; variable substitutions follow §1-line Return Translation or the Glossary; AskUserQuestion option labels and descriptions follow the same rule (their `(in user_lang)` markers refer to prompt translation, a separate context from the Status Format label-preservation rule). In prose, wrap `Print` in a code span so it cannot be mistaken for a column-0 directive.

## §1-line Return Translation (INLINE path only)

- **Parse phase (English raw):** extract Glossary keywords from the first line for state-machine transitions.
- **Display phase (force `user_lang`):** the free-text summary after the first ` — ` is rendered in `user_lang` (idempotent when it already is). Split failure → the §Sub-agent Return Value Rules fallback (`confidence: Unknown`).
- **WORKFLOW equivalent:** display the object's `summary` field as returned — no parsing, no translation pass.

**Shorthand:** "Print per OLC" = render per the Print Translation Pattern (Glossary tokens stay English raw).
