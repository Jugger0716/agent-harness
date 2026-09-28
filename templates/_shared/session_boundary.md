# Session Boundary block and the /handoff field contract (single source)

> Cited by name from `skills/harness/SKILL.md` and `skills/harness-build/SKILL.md`
> §Session Boundary. Those files own their own boundary SITES and resume commands; the block
> shape and the `/handoff` field contract are identical and live here.
>
> Shape and label rules mirror the Setup Summary: labels English raw, values per
> `templates/_shared/output_language.md`.

### Type A — phase-boundary (mid-task; session can resume next time)

```
[harness] Session boundary — <completed phase> complete.
  Task    : <task>
  Branch  : <state.json.branch>     ← omit if has_git == false
  Phase   : <completed phase label> → <next phase label>
  Output  : <docs_path>
  Resume  : <resume command — from the citing skill's boundary-site table>
  Handoff : Run `/handoff generate` to capture this session for cross-session continuity.
```

### `/handoff generate` field contract (P0-4)

When the `Handoff` row above is followed, `/handoff generate` reads `skill` / `task` / `phase` / `mode` / `docs_path` from `.harness/state.json` **read-only** (this pipeline never writes, reads or relies on any `/handoff` artifact) and records them under its `## In Progress` section in this fixed-label format:
```
Skill : <skill>
Task : <task>
Phase : <phase>
Mode : <mode>
Docs : <docs_path>
```
<!-- SYNC-WITH: skills/handoff/SKILL.md §Fixed Label Record Format -->
Full contract: `skills/handoff/SKILL.md` §Fixed Label Record Format / §Live task-state cross-check — this pipeline has no obligation beyond being read.
