# Model Config — Shared Preset Map (single source)

Sub-agents run on models chosen by the session's `model_config` preset (role → model).

| Preset | executor | advisor | evaluator | verifier |
|--------|----------|---------|-----------|----------|
| default | (parent inherit) | (parent inherit) | (parent inherit) | haiku (default) |
| all-opus | opus | opus | opus | haiku (default) |
| balanced | sonnet | opus | opus | haiku (default) |
| economy | haiku | sonnet | sonnet | haiku (default) |

**Rules (apply in every consuming skill):**
- Set **once** at session start (stored in `state.json.model_config`); not changed mid-session.
- **Verifier defaults to `haiku`** in every preset (Layer-1 only runs commands + parses exit codes). Override with `--verifier-model sonnet|opus` (stored in `model_config.verifier`); show a cost warning in the Setup Summary when overridden.
- Each skill maps its OWN sub-agent roster onto {executor, advisor, evaluator}; only that role→sub-agent mapping stays in the skill (one line per sub-agent). The preset table above does NOT.
- **Applying:** when launching a sub-agent, if `model_config.preset != "default"`, pass `model` per the role's preset cell. Sub-agents never read `state.json` for model config — the orchestrator passes `model` at launch.
