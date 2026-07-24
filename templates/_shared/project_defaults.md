# Project Defaults — agent-harness (single source)

Persistent agent-harness defaults let a user or a team skip the per-session opt-in rituals
(path prompt, model picker). The declaration is one defaults line:

    agent-harness-defaults: path=workflow, model-config=frontier, verifier-model=haiku

**Sources & precedence — the FIRST source that declares the line wins WHOLESALE (no per-key
merging across sources):**

| # | Source | Audience | Committed? |
|---|--------|----------|------------|
| 1 | `.claude/settings.local.json` → `env.AGENT_HARNESS_DEFAULTS` (the defaults line as the string value; the `agent-harness-defaults:` prefix is optional there) | Personal, per-project — **recommended** when the project CLAUDE.md is team-shared and committed | No (Claude Code's local settings file) |
| 2 | Project root `CLAUDE.md` — one line, anywhere in the file (first match) | Team-agreed defaults; affects every developer who runs these skills | Yes |
| 3 | `~/.claude/CLAUDE.md` (user-level) — one line, anywhere | Personal, machine-wide fallback across all projects | No |

Sources are read as FILES (Read tool) — no shell command, no dependency on actual env-var
injection. Malformed JSON in source 1 → skip that source silently and continue the search.

**Keys (all optional; unknown keys → warn once in `user_lang`, then ignore):**

| Key | Values | Effect |
|-----|--------|--------|
| `path` | `workflow` \| `inline` | Standing opt-in, resolved at Mode Gate §Ambiguity Prompt step 4.5 — `workflow` runs the skill's ultracode-target tier (same tier rule as ultracode ON); `inline` forces the inline path silently. |
| `model-config` | `default` / `all-opus` / `frontier` / `balanced` / `economy` | Used when no `--model-config` flag is given — the interactive model picker is skipped. |
| `verifier-model` | `haiku` \| `sonnet` \| `opus` | Used when no `--verifier-model` flag is given. |

**Resolution orders (session input always wins):**

- Path: `--mode` > ultracode ON > **project default** > §Ambiguity Prompt / silent auto-resolve.
  `--mode single/quick` still forces INLINE (mode_gate rule, unchanged).
- Model config: `--model-config` > **project default** > AskUserQuestion (or the skill's
  documented fallback).
- Verifier: `--verifier-model` > **project default** > `haiku`.

**Parse rule:** in sources 2–3, take the FIRST line matching `^\s*agent-harness-defaults:`;
in source 1, take the `env.AGENT_HARNESS_DEFAULTS` string value. Split the remainder on commas
into `key=value` pairs; trim whitespace; keys and values are case-insensitive. An invalid
value → warn once (in `user_lang`) and ignore that key — NEVER halt on a malformed defaults
line (defaults are a convenience, not a contract). No source file or no matching line → no
defaults, zero behavior change.

**Transparency:** every value consumed from this line is echoed in the Setup Summary with the
suffix `(project default)`, and a path resolved via step 4.5 shows the §Path Transparency
reason `project default (<source>)` — `<source>` ∈ `settings.local.json` / `CLAUDE.md` /
`~/.claude/CLAUDE.md`, so it is always visible WHICH file drove the decision.

**Engine unavailability:** `path=workflow` never overrides Mode Gate steps 1–2 — if the
`Workflow` tool is missing or `has_git == false`, the run degrades to inline exactly like
ultracode ON does. This is a standing opt-in, NOT effort gating (the OPT-IN principle of
`templates/_shared/mode_gate.md` is preserved — the user opts in once, in a file they own).
