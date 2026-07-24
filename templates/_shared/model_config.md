# Model Config — Shared Preset Map (single source)

Sub-agents run on models chosen by the session's `model_config` preset (role → model).

| Preset | executor | advisor | evaluator | verifier |
|--------|----------|---------|-----------|----------|
| default | (parent inherit) | (parent inherit) | (parent inherit) | haiku (default) |
| all-opus | opus | opus | opus | haiku (default) |
| frontier | sonnet | opus | fable | haiku (default) |
| balanced | sonnet | opus | opus | haiku (default) |
| economy | haiku | sonnet | sonnet | haiku (default) |

**Rules (apply in every consuming skill):**
- Set **once** at session start (stored in `state.json.model_config`); not changed mid-session.
- **Verifier defaults to `haiku`** in every preset (Layer-1 only runs commands + parses exit codes). Override with `--verifier-model sonnet|opus` (stored in `model_config.verifier`); show a cost warning in the Setup Summary when overridden.
- Each skill maps its OWN sub-agent roster onto {executor, advisor, evaluator}; only that role→sub-agent mapping stays in the skill (one line per sub-agent). The preset table above does NOT.
- **Applying:** when launching a sub-agent, if `model_config.preset != "default"`, pass `model` per the role's preset cell. Sub-agents never read `state.json` for model config — the orchestrator passes `model` at launch.
- **`fable`** (top-tier Claude Fable/Mythos class) is valid in the executor/advisor/evaluator cells and in custom "Other" parses; it is NEVER a verifier model (`--verifier-model` stays `haiku|sonnet|opus`).
- **Interactive pickers hold max 4 options** (AskUserQuestion limit) — `frontier` replaces `all-opus` in the picker. `all-opus` stays fully supported via `--model-config all-opus` or "Other" (a bare preset name `all-opus`, or `executor:opus,advisor:opus,evaluator:opus`).
- **Judgment-type sub-agents (cross-verification, critic, evaluator) map to the `evaluator` role.** Pre-8.7 presets have identical advisor/evaluator cells, so this mapping is behavior-preserving for them; only `frontier` distinguishes the two. A skill mode that dispatches no evaluator-role agent gets `balanced`-equivalent behavior from `frontier`.
- **Model fallback chain (deprecation safety):** if a sub-agent dispatch fails because the cell's model id is unknown/unavailable (a sunset model — e.g. a future `fable` retirement), downgrade THAT cell step-by-step along `fable → opus → sonnet → haiku → (parent inherit)` until a dispatch succeeds. Warn once per session (in `user_lang`), remember the downgraded cell for the rest of the session (never repeat a failing dispatch), and echo the actually-used model in the Setup Summary / final report. Applies on both paths — the orchestrator carries the downgraded cell into `args.models` on any segment (re-)run. Preset names are indirection: a model sunset needs only a one-line patch to the preset table above, and persistent `model-config=<preset>` project defaults keep working across model generations.
