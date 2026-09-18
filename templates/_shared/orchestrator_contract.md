# Orchestrator Contract — returns, version, environment (single source)

> Cited by name from `skills/harness/SKILL.md` and `skills/harness-build/SKILL.md`
> §Orchestrator Contract. `/harness-gate` dispatches nothing and needs only §Version &
> Compatibility below. Read this file at Setup and whenever a sub-agent or segment returns.

## Sub-agent Return Value Rules (INLINE path only)

When an inline-dispatched sub-agent returns:
1. Read only the **first line** for state decisions
2. Extract keywords: `"FAIL"`, `"PASS"`, `"generated"`, `"changed"`, `"written"`
3. Use the first line as the progress message — translate the non-keyword portion to `user_lang` per §1-line Return Translation; Glossary keywords stay English raw
4. **Ignore all remaining text** — never analyze, reference, or forward it

**Parse failure** (the return does not match `<keyword> — <summary>`): treat as `confidence: Unknown` and print `[harness] ⚠ 1-line return parse failed — fallback: confidence Unknown`. For the Auto-fix Proposer the fallback form is `auto_fix_patch written — confidence: Unknown — <reason>`.

**WORKFLOW path returns are schema-validated objects** (PlanResult / ChangeSet / VerifyVerdict — `workflows/_reference/schemas.md`). Branch on fields directly. If a Workflow run errors or returns an unusable result, apply §Mode Gate graceful fallback — never halt with an engine error.

## Version & Compatibility

This is **state.json v3** (`version: "3.0"`, `skill: "harness"`); a v3 file carries BOTH fields. On load:
- `version == "3.0"` AND `skill == "harness"` → run the v3 logic in this file. A `"3.0"` file whose `skill` is another value or absent is routed by §Session Recovery item 1 to the Session Conflict gate.
- `version` missing or non-`"3.0"` → **do NOT migrate silently** — §Session Recovery item 2 recommends Restart; legacy resume is unsupported.
- **Additive fields within `"3.0"` never bump `version`**: readers ignore unknown fields and treat a missing field as its documented default (`skills/harness/SKILL.md` §Step 1 item 11's new-field table); writers never make such a field required.

## Zero-Setup Environment Detection

At startup run `git rev-parse --is-inside-work-tree 2>/dev/null`: success → `has_git = true`, failure → `has_git = false`.
