# Standard Status Format — Shared (single source)

Read `.harness/state.json` and print the status block. Render per each skill's Output
Language Contract / Print Translation Pattern: the **labels stay English raw** for
monospace alignment; **values** follow the Preserved-English Glossary.

```
[harness]
  Task   : <task>
  Mode   : <single | standard | multi>
  Model  : <model_config preset name>
  Style  : <auto | phase | step>
  Phase  : <phase label>
  Round  : <round> / <max_rounds>
  Branch : <branch>          ← omit if has_git == false
  Scope  : <scope>
```

**Label rules:**
- The label set above (`Task/Mode/Model/Style/Phase/Round/Branch/Scope` — plus, where a
  skill uses them, `Directory/Verifier/Language/Test/Build/Lint/TypeCheck/Output`) is
  **English raw** regardless of `user_lang`, for monospace alignment.
- **Omit the `Branch` line if `has_git == false`.**
- **Prefix is per-skill.** Most skills use `[harness]`; others use their own token (e.g.
  `[debug]`, `[memory save]`). Document the prefix token in the consuming skill — only the
  block shape + label rules are shared here.
- **Phase-label → human-string maps stay in each skill** (they differ per skill, e.g.
  `plan_ready → "Plan — ready"`). Do not centralize them here.
