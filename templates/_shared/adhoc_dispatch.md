# Ad-hoc Dispatch Contract — Shared (single source)

**Scope.** This contract applies to EVERY sub-agent (Task/Agent tool — including `Explore` and
`general-purpose` types) and every ad-hoc Workflow script that the orchestrator creates DURING
a skill's execution WITHOUT using a shipped template file from `${CLAUDE_PLUGIN_ROOT}/templates/`.
Shipped templates already carry the `{user_lang}` wiring and role-mapped `model` parameters;
ad-hoc dispatches bypass both — this contract closes that gap.

> Evidence: the v8.6.0 English-leak incidents traced to exactly this bypass — during /harness
> runs the orchestrator spawned native Explore/general-purpose agents with English-only prompts
> (2026-07 usage audit, session 2af24cc7: 3 of 4 ad-hoc analysts returned ~9k chars of English
> vs ~150 chars of Korean). The template layer was correctly wired; the ad-hoc layer had no
> contract.

## §Language (MANDATORY)

1. Every ad-hoc sub-agent prompt MUST state the output language explicitly, e.g. as its first
   line: `Write ALL free-text output in {user_lang}. Identifiers, enums, paths, and code stay
   English raw.`
2. Schema-forced dispatches (Workflow `agent()` with `schema`): every free-text field's
   `description` MUST carry the language directive, e.g. `"one-sentence summary (in
   {user_lang})"`. Enum/id/path fields stay English raw.
3. Ad-hoc Workflow scripts written mid-session MUST receive the language via `args` (e.g.
   `userLang`) and build their schema descriptions from it — the same pattern the shipped
   segment scripts use.

An UNINTENDED output-language leak from an ad-hoc dispatch is a contract violation, not a
style issue. Exception: an explicit user instruction to output in another language for a given
dispatch overrides `{user_lang}` — the contract enforces intentionality, not a specific language.

## §Model Routing (cost discipline)

1. Mechanical / exploration / collection work (file discovery, grep sweeps, inventories,
   transcript mining) → `model_config.executor`; when the preset is `default` (or no
   model_config is in scope), prefer `sonnet` over inheriting a top-tier parent model.
2. Judgment / verification / synthesis work (adversarial verify, critique, final review) →
   `model_config.evaluator` (fall back to `advisor`, then parent inherit).
3. NEVER dispatch an ad-hoc agent on a tier ABOVE the skill's evaluator tier — bulk agents run
   below the ceiling, judgment at it, nothing above it.
4. Ad-hoc Workflow scripts SHOULD pass `model` per stage (`agent(prompt, { model })`) following
   rules 1–2, and MAY lower `effort` for mechanical stages the same way.
