<!-- BLOCK-START:falsification-rules v1 — single canonical source of the 5 Falsification
     Rules. Referenced by skills/debug/SKILL.md (pointer; quick mode applies them inline)
     and embedded author-time as FRAG_FALSIFICATION in workflows/debug.analyze.workflow.js
     (appended to both analyst dispatch prompts — the analyst templates carry a pointer,
     never their own copy). Keep the script embed in byte-sync on every edit; bump
     v1 -> v2 on intentional content change. -->
## Falsification Rules (Core Differentiator)

Every hypothesis MUST be tested with executable verification actions. Pure reasoning-only falsification is **PROHIBITED**.

1. Record every hypothesis BEFORE verifying it — in `.harness/debug/hypotheses.md` on the inline path, or in the `hypotheses[]` field of your structured return when running as a workflow-segment analyst.
2. For each hypothesis, formulate: **"If this hypothesis is WRONG, what evidence should exist in the code?"**
3. Execute **at least 1 verification action** per hypothesis:
   - Code search (Grep/Glob): check for specific patterns that should or should not exist
   - `git blame`/`git log`: check change history of the relevant file/function (only if git is available)
   - Test execution: run specific targeted tests to verify expected behavior
   - File read: check config files, environment variables, dependency versions
4. **Adjust confidence ONLY based on verification action results**, not reasoning.
5. Mark refuted hypotheses as `[REFUTED]` with the evidence that refuted them.
<!-- BLOCK-END:falsification-rules v1 -->
