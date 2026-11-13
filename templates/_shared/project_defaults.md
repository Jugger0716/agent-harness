# Project Defaults — agent-harness (single source)

Persistent agent-harness defaults let a user or a team skip the per-session opt-in rituals
(path prompt, model picker).

## §agent-harness-defaults — the defaults line

The declaration is one defaults line:

    agent-harness-defaults: path=workflow, model-config=frontier, verifier-model=haiku

**Sources & precedence — the FIRST source whose defaults line yields at least one valid key
wins WHOLESALE (no per-key merging across sources):**

| # | Source | Audience | Committed? |
|---|--------|----------|------------|
| 1 | `.claude/settings.local.json` → `env.AGENT_HARNESS_DEFAULTS` (the defaults line as the string value; the `agent-harness-defaults:` prefix is optional there) | Personal, per-project — **recommended** when the project CLAUDE.md is team-shared and committed | No (Claude Code's local settings file) |
| 2 | Project root `CLAUDE.md` — one line, anywhere in the file (first match) | Team-agreed defaults; affects every developer who runs these skills | Yes |
| 3 | `~/.claude/CLAUDE.md` (user-level) — one line, anywhere | Personal, machine-wide fallback across all projects | No |

Sources are read as FILES (Read tool) — no shell command, no dependency on actual env-var
injection. Malformed JSON in source 1 → skip that source silently and continue the search.

**Resolution is two-stage:**
1. **Pick THE line** — the first source (1 → 2 → 3) that contains a defaults line with at least
   one valid key. Lower sources are then ignored ENTIRELY (wholesale — no per-key merging).
2. **Read keys ONLY from that line.** A key absent from the resolved line falls back to the
   normal per-skill behavior (model picker / `haiku` verifier / Mode Gate steps 5–6) — NEVER
   to a lower source. In particular, a resolved line without a `path` key is not a path
   signal (mode_gate step 4.5 does not fire); its other keys still apply.

**Keys (all optional; unknown keys → warn once in `user_lang`, then ignore):**

| Key | Values | Effect |
|-----|--------|--------|
| `path` | `workflow` \| `inline` | Standing opt-in, resolved at Mode Gate §Ambiguity Prompt step 4.5 — `workflow` runs the skill's ultracode-target tier (same tier rule as ultracode ON); `inline` forces the inline path silently. |
| `model-config` | `default` / `all-opus` / `frontier` / `balanced` / `economy` | Used when no `--model-config` flag is given — the interactive model picker is skipped. |
| `verifier-model` | `haiku` \| `sonnet` \| `opus` | Used when no `--verifier-model` flag is given. |
| `lint-cmd` | a shell command, **wrapped in backticks** (see the parse rule below) | Used by `/harness` when no `--lint-cmd` flag is given, BEFORE `templates/_shared/detection_table.md` auto-detection — a declared command is never second-guessed by detection. The value lands in state.json `lint_cmd`, so `/harness-build`'s Layer 1 reads it from there. |
| `type-check-cmd` | same form as `lint-cmd` | Same rule for `--type-check-cmd` / state.json `type_check_cmd`. |
| `gate` | `inline` \| `separate` | Standing default for where `/harness` renders HARD GATE #1. `separate` is consumed by `/harness` §Step 1 exactly as `--separate-gate` is, when that flag is absent and `--fast` is not given (`--fast` is always inline — the default yields to it silently): the session ends at `plan_done` with `Next → /harness-gate`, the tool-less gate. `inline` is an explicit no-op — the in-session approval (`skills/harness/SKILL.md` §Approval Gate) is already the default. Any other value → the parse rule's warn-and-ignore. A slice `Command` carries no `--separate-gate`, so this key is how an epic's slices stay separate. |
| `cold-pass` | `on` \| `off` | Standing default for the cold-review pass. `off` is consumed by `/harness` §Step 1 exactly as `--no-cold-pass` is, when neither `--no-cold-pass` nor `--fast` is given. `on` is an explicit no-op a team can pin to document intent; it never re-enables the pass under `--fast`, whose semantics are fixed. Any other value → the parse rule's warn-and-ignore. |

**Resolution orders (session input always wins):**

- Path: `--mode` > ultracode ON > **project default** > §Ambiguity Prompt / silent auto-resolve.
  `--mode single/quick` still forces INLINE (mode_gate rule, unchanged).
- Model config: `--model-config` > **project default** > AskUserQuestion (or the skill's
  documented fallback).
- Verifier: `--verifier-model` > **project default** > `haiku`.
- Lint / type-check commands (`/harness` only): `--lint-cmd` / `--type-check-cmd` > **project
  default** > detection table > `null` (Layer 1 skips that command).
- Cold pass (`/harness` only): `--no-cold-pass` > `--fast` >
  **project default `cold-pass=off`** > `true`.
- Gate mode (`/harness` only): `--fast` (always inline; `--fast` with `--separate-gate` halts) >
  `--separate-gate` > **project default `gate=`** > inline.

**Parse rule:** in sources 2–3, take the FIRST line matching `^agent-harness-defaults:` at
column 0 — indented lines and lines inside fenced code blocks (```) are EXAMPLES, excluded
from matching;
in source 1, take the `env.AGENT_HARNESS_DEFAULTS` string value. Split the remainder on commas
into `key=value` pairs; trim whitespace; keys and values are case-insensitive — except a
**backtick value**: a value that begins with a backtick runs to the next backtick on the same
line, verbatim and case-preserved; commas, `=` and `&&` inside it are content, not separators,
and the two backticks themselves are stripped. An unclosed backtick is an invalid value for that
key (warn, ignore the key). This form exists for `lint-cmd` / `type-check-cmd`, whose values are
shell commands; the other keys never need it. A key a skill does not consume (`lint-cmd` for
`/deep-review`, say) is ignored silently by that skill — the unknown-key warning is for keys no skill
defines. An invalid
value → warn once (in `user_lang`) and ignore that key — NEVER halt on a malformed defaults
line (defaults are a convenience, not a contract). A matched line that yields ZERO valid keys
is treated as NO declaration for stage 1 — warn once and CONTINUE the source search (it does
not block lower sources). No source file or no matching line anywhere → no defaults, zero
behavior change.

**Transparency:** every value consumed from this line is echoed in the Setup Summary with the
suffix `(project default)`, and a path resolved via step 4.5 shows the §Path Transparency
reason `project default (<source>)` — `<source>` ∈ `settings.local.json` / `CLAUDE.md` /
`~/.claude/CLAUDE.md`, so it is always visible WHICH file drove the decision. When `gate` is consumed it is echoed in the Setup Summary
`Gate` row the same way. When `cold-pass` is
consumed it is echoed the same way, in the Setup Summary `Cold` row: the value recorded in
`cli_flags.cold_pass_source` is `"default:<source>"`, which the §Step 7 rendering rule in
`skills/harness-build/SKILL.md` renders as `project default (<source>)`; `<source>` is one of the
same three names — never a new one.

**Engine unavailability:** `path=workflow` never overrides Mode Gate steps 1–2 — if the
`Workflow` tool is missing or `has_git == false`, the run degrades to inline exactly like
ultracode ON does. This is a standing opt-in, NOT effort gating (the OPT-IN principle of
`templates/_shared/mode_gate.md` is preserved — the user opts in once, in a file they own).
