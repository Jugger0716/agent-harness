# User Interaction Rules — Shared (single source)

All user-facing questions MUST use AskUserQuestion tool when available.
- If AskUserQuestion is available → use it (provides numbered selection UI)
- If AskUserQuestion is NOT available or fails → present the same options as text and accept number/keyword responses (case-insensitive). Two shipped questions have no text fallback, and an unavailable or failing call makes the session non-interactive instead: the converge loop's decision question (`templates/harness/converge.md` §Decision Question), whose answer is applied to spec.md as written — the decisions stay open; and `/harness`'s approval question (`skills/harness/SKILL.md` §Approval Gate, every variant), because only a label selection approves — the session stops at `plan_done` with no approval recorded. A text reply, by number or keyword, is never an approval.
- Every option must include a `label` (short name) and `description` (specific explanation)
- "Other" (free text input) is automatically appended by the framework
- Translate all question text, labels, and descriptions to `user_lang`
- Recommended per-call cap: keep to ≤4 substantive options when the option set is open-ended (not a universal rule) — two shipped calls use more where the domain requires it: `skills/test-gen/SKILL.md` §Step 1: Setup, the "If detection fails" prompt (6, framework selection) and `skills/ship/SKILL.md` §6.5: Stage — merge_to_base, step 7 "Push outcome handling" (5, Push Rejected, comment self-labels "5-way"). Combined with this file's own "'Other' (free text input) is automatically appended by the framework" rule above, a 4-option call shows 5 choices on screen.
