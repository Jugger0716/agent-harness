# Setup Summary output block (single source)

> Printed by `skills/harness/SKILL.md` §Step 1 item 12. Labels stay English raw; values follow
> `templates/_shared/output_language.md`. Read this file when rendering the block.

12. **Print the setup summary** per §Print Translation Pattern (labels English raw):
```
[harness] Task started!
  Directory : <path>
  Branch    : <state.json.branch>     ← omit if has_git == false
  Mode      : <single | standard | multi>
  Path      : <inline | workflow>  (<reason per §Path Transparency>)
  Model     : <preset>
  Verifier  : <model_config.verifier>
  Style     : <auto | phase | step>   ← append "(fast)" when cli_flags.fast
  Language  : <lang>
  Test      : <test_cmd or "none">
  Build     : <build_cmd or "none">
  Lint      : <lint_cmd or "none">
  TypeCheck : <type_check_cmd or "none">
  Scope     : <scope>
  Output    : <docs_path>
```
If `model_config.verifier` is `sonnet` or `opus`, also print `  ⚠ Verifier set to <model> — high cost for mechanical verification. haiku is usually sufficient.` **(P1-3)** If `build_cmd`, `test_cmd`, `lint_cmd` AND `type_check_cmd` are all `null`, also print `  ⚠ No build/test/lint/type-check command detected — Layer 1 verification is inactive; completion will rely on Layer 2/3 (LLM judgment) alone. Provide --lint-cmd / --type-check-cmd, or verify manually.` — a warning, never a halt (doc-only tasks legitimately have no commands).
