# Plan Critic WORKFLOW dispatch — `spec.eval.workflow.js` (single source)

> Issued by `skills/harness/SKILL.md` §Step 2.6, WORKFLOW branch. The segment is shared with
> `/spec`, and this call changes none of its args contract. Read this file before dispatching.

<!-- SYNC-WITH: workflows/spec.eval.workflow.js §contract -->
```
Workflow {
  scriptPath: ".harness/wf/spec.eval.workflow.js",   // FIRST apply templates/_shared/segment_launch.md: copy ${CLAUDE_PLUGIN_ROOT}/workflows/spec.eval.workflow.js here; delete the copy once this call returns
  args: { task: <task>, userLang: <user_lang>, specContent: <{docs_path}spec.md content>,
          qaNotes: <qa_discovery_notes>,
          criticFindingsPath: "{docs_path}plan_critic_findings.md",
          models: { advisor: <model_config.advisor or null>, evaluator: <model_config.evaluator or null> } }
}
```

| Arg | Value |
|---|---|
| `specContent` | the CONTENT of `{docs_path}spec.md`, not a path — the size carve-out in `templates/_shared/architecture_principles.md` #3 |
| `qaNotes` | the Discovery Notes Injection value, passed even when empty |
| `criticFindingsPath` | a PATH the agent writes to, unlike `specContent` — the orchestrator verifies its existence afterwards, because the segment's own contract defers that check |
| `models` | `advisor` and `evaluator` only; this segment launches no executor |

Returns a schema-validated `CriticReport` (`counts` / `items` / `summary` —
`workflows/_reference/schemas.md`). A schema-valid return is NOT evidence the findings file was
written: `skills/harness/SKILL.md` §Step 2.6's latch checks that separately.
