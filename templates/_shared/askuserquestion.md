# User Interaction Rules — Shared (single source)

All user-facing questions MUST use AskUserQuestion tool when available.
- If AskUserQuestion is available → use it (provides numbered selection UI)
- If AskUserQuestion is NOT available or fails → present the same options as text and accept number/keyword responses (case-insensitive)
- Every option must include a `label` (short name) and `description` (specific explanation)
- "Other" (free text input) is automatically appended by the framework
- Translate all question text, labels, and descriptions to `user_lang`
- Recommended per-call cap: keep to ≤4 substantive options when the option set is open-ended (not a universal rule) — two shipped calls use more where the domain requires it: `skills/test-gen/SKILL.md:142-150` (6, framework selection) and `skills/ship/SKILL.md:777-787` (5, Push Rejected, comment self-labels "5-way"). Combined with `:7`'s framework-appended "Other", a 4-option call shows 5 choices on screen.
