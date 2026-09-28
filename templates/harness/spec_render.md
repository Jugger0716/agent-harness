# spec.md render mapping — PlanResult → headings (single source)

> Applied by `skills/harness/SKILL.md` §Step 2 — WORKFLOW path item 6 and by that path's
> Auto-revise re-entry (`templates/harness/auto_revise.md`). Headings are rendered in
> `user_lang`; the `- [ ]` checkbox glyph is language-independent and is what the Scale
> Assessment INLINE Fallback counts, so it is never replaced by a translated marker.

| spec.md heading | PlanResult field | Render |
|---|---|---|
| `### Goal` | `goal` | prose |
| `### Background` | `background` | prose |
| `### Scope` | `scope.inScope` / `scope.outOfScope` | two bullet lists |
| `### Approach` | `approach` | prose |
| `### Completion Criteria` | `acceptanceCriteria[]` | GFM checkboxes `- [ ] AC-n: text` |
| `### Testing Strategy` | `testingStrategy[]` | bullets |
| `### Edge Cases` | `edgeCases[]` | bullets — omit the heading if empty |
| `### Risks` | `risks[]` | `- (source, likelihood) risk — mitigation` |
| `### Implementation Steps` | `steps[]` | bullets — omit the heading if absent |
