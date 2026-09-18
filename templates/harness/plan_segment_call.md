# Plan segment call — `harness.plan.workflow.js` (single source)

> Issued by `skills/harness/SKILL.md` §Step 2 — WORKFLOW path item 2. The script path is
> plugin-shipped, never repository-relative. `args` is a JSON object; the script parses
> defensively, so it also tolerates a JSON string — do not pre-stringify it yourself.
> The re-synthesis form of this same call is `templates/harness/auto_revise.md`.

```
Workflow {
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/harness.plan.workflow.js",
  args: { task, repoPath, lang, scope, userLang, conventions: <resolved content or "">,
          qaNotes: <qa_discovery_notes>, criticFindings: <critic_findings>,
          mode: <"standard"|"multi">,
          models: { executor, advisor, evaluator, verifier: <model_config.verifier> } }
}
```

| Arg | Value |
|---|---|
| `conventions` | the resolved conventions CONTENT, or `""` — §Conventions injection rule decides which |
| `qaNotes` / `criticFindings` | the Discovery Notes Injection values, always passed even when empty |
| `mode` | `"standard"` or `"multi"`, from `state.mode` — never `"single"`, which does not reach this path |
| `models` | the whole resolved map at once; a null role inherits |

Returns `{ plan: PlanResult, proposals, stats }`, schema-validated
(`workflows/_reference/schemas.md`). Never re-read a file to recover what the object carries.
