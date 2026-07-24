# Project Defaults — agent-harness (single source)

A project may declare **persistent agent-harness defaults** in its root `CLAUDE.md` so that
per-session opt-in rituals (path prompt, model picker) are skipped. One line, anywhere in the
file (first match wins):

    agent-harness-defaults: path=workflow, model-config=frontier, verifier-model=haiku

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

**Parse rule:** scan the project root `CLAUDE.md` for the FIRST line matching
`^\s*agent-harness-defaults:` ; split the remainder on commas into `key=value` pairs; trim
whitespace; keys and values are case-insensitive. An invalid value → warn once (in `user_lang`)
and ignore that key — NEVER halt on a malformed defaults line (defaults are a convenience, not
a contract). No `CLAUDE.md` or no matching line → no defaults, zero behavior change.

**Transparency:** every value consumed from this line is echoed in the Setup Summary with the
suffix `(project default)`, and a path resolved via step 4.5 shows the §Path Transparency
reason `project default (CLAUDE.md)`.

**Engine unavailability:** `path=workflow` never overrides Mode Gate steps 1–2 — if the
`Workflow` tool is missing or `has_git == false`, the run degrades to inline exactly like
ultracode ON does. This is a standing opt-in, NOT effort gating (the OPT-IN principle of
`templates/_shared/mode_gate.md` is preserved — the user opts in once, in a file they own).
