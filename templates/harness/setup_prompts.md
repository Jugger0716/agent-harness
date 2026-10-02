# Setup-phase AskUserQuestion payloads (single source)

> The three routine questions `skills/harness/SKILL.md` asks during Setup and Convention Scan.
> Each is cited there by its header; read this file when you reach one. All text renders in
> `user_lang` per `templates/_shared/askuserquestion.md`; "Other" is appended by the framework.
>
> §Approval Gate's question (every variant, the former §Fast Gate's included) is NOT here — it is a gate, and its payload stays inline in the skill.

## §Branch (§Step 1 item 8, non-empty existing branch)

- header: "Branch"
- question: "harness/<slug> already has commits — reusing it will mix its changes into this session's diff."
- options:
  - "Reuse anyway" / "Continue on the existing branch (the diff may include prior commits)"
  - "New branch" / "Create harness/<slug>-2 instead"

On "Reuse anyway", print per OLC before continuing:
`[harness] ⚠ Reusing harness/<slug> — N prior commit(s) will appear in this session's diff.`

## §Model (§Step 1 item 10)

Asked only when no `--model-config`, no project-defaults `model-config=<preset>`, and no
`cli_flags.fast` (which takes `balanced` silently).

- header: "Model"
- question: "Select model configuration for sub-agents:"
- options:
  - "default" / "Inherit parent model, no changes"
  - "frontier" / "Sonnet executor + Opus advisor + Fable evaluator (top-model judgment)"
  - "balanced (Recommended)" / "Sonnet executor + Opus advisor/evaluator (cost-efficient)"
  - "economy" / "Haiku executor + Sonnet advisor/evaluator (max savings)"

"Other" accepts `executor:<model>,advisor:<model>,evaluator:<model>` or a bare preset name
(`default` / `all-opus` / `frontier` / `balanced` / `economy`). Role values are validated against
`fable` / `opus` / `sonnet` / `haiku` only; max 3 retries, then `balanced`; missing roles are filled
from `balanced`.

## §Convention Scan (§Step 1.5, sparse or missing CLAUDE.md)

- header: "Convention Scan"
- question: "No rich CLAUDE.md found. Scan codebase to auto-detect project conventions (DB, API, file structure, test patterns)? This helps the Planner align with existing patterns."
- options:
  - "Scan" / "Run convention scanner sub-agent (~1 token overhead)"
  - "Skip" / "Proceed without convention data"

**Scan failed** — asked when the scanner reported success but `.harness/conventions.md` is absent:

- header: "Convention Scan Failed"
- question: "Output file missing. Retry or skip?"
- options:
  - "Retry" / "Re-run scanner" — max 2 retries
  - "Skip" / "Proceed without conventions"

Never store a `"file:"` reference to a file that does not exist.
