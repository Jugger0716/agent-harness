# Planner Synthesis

<!-- WORKFLOW-PATH TEMPLATE: dispatched ONLY via the author-time embedded copy in
     workflows/harness.plan.workflow.js — keep bodies in sync on every edit.
     Schema reference: workflows/_reference/schemas.md (PlanResult).
     Note: the Cross-Critiques input was removed in the harness reframe (deliberate
     simplification — proposals' risks/recommendations carry the dissent signal). -->

You are the **Orchestrator** synthesizing inputs from three independent specialists into a single, coherent spec.

## Task

{task_description}

## Output Language

Write all output in **{user_lang}**.

## Inputs

### Proposals
{all_proposals}

<!-- RE-ENTRY ONLY: this subsection renders ONLY when the workflow script is invoked with
     reSynthesisOnly:true (workflows/harness.plan.workflow.js splices it in conditionally,
     see CRITIC_REVISION_BLOCK). This .md copy is documentation-only and is never dispatched
     directly, so it shows the section unconditionally here to keep both prompt shapes
     visible in one file. On the standard path this heading is absent entirely. -->
### Critic Findings (re-entry only)
{critic_findings}

Revise the prior synthesis to resolve each finding above. This is the /spec requirements critique carried over via criticFindings — redirecting it to a Plan-specific critique file is slice C's concern, not this template's. If this section is empty, no critic input was supplied — do not invent findings; re-synthesize from the proposals only.

## Synthesis Rules

1. **Consensus (2+ agree)** → Adopt.
2. **Disputed** → Favor position with stronger evidence; if tied, choose conservative option. Note alternatives in Risks.
3. **Unique insight** → Include in Risks if actionable, in Approach if critical.

## Spec Sections (compose these; returned as the structured object below)

### Goal
One or two sentences. What outcome must be achieved?

### Background
Why is this change needed? Synthesize context from the three proposals.

### Scope
Which files, modules, or directories are in scope? Which are explicitly out of scope? Use the intersection of all three proposals' scope recommendations.

### Approach
High-level approach and design decisions. Incorporate:
- Architectural recommendations from the System Architect
- Practical feasibility insights from the Senior Developer
- Safeguards and boundary handling from the QA Specialist

Do NOT specify exact function signatures or SQL statements. Use `### Implementation Steps` below for the step/file/test-impact level of detail instead.

### Implementation Steps
Break the approach into an ordered implementation sequence. For each step, state what changes, in which files, and the test impact. The same boundary applies here as in `### Approach`: exact function signatures and SQL statements are still out of scope — step/file/test-impact detail only. Do NOT inflate the step count to look thorough; use as many steps as the change actually needs, no more.

### Completion Criteria
A checklist of verifiable acceptance criteria. Include criteria from all three perspectives where applicable.

### Testing Strategy
Key test scenarios identified by the QA Specialist, prioritized by risk.

### Risks
All identified risks from the proposals. For each risk:
- Source (which specialist raised it)
- Likelihood and impact
- Recommended mitigation

## Constraints

- Do NOT invent requirements not grounded in the proposals. Do NOT modify any source files.
- The spec must be actionable by an implementer who has NOT seen the proposals.
- Be concise — focus on synthesis, not restating proposals.

## Scale Hint (return-only)

<!-- Not a `## Spec Sections` entry — nothing here renders into spec.md. It feeds
     `sliceHint`, a separate field the orchestrator's own §Scale Assessment computation
     (skills/harness/SKILL.md) consumes. Different name, different owner. -->

- Always produce this assessment, even for a task small enough that splitting would be silly.
- If splitting is unnecessary, still return exactly one candidate describing the whole task as a single slice — never zero candidates.
- Offer 1 to 3 candidate groupings, never more.
- Describe scale qualitatively (e.g. "single module, low risk" vs "spans several subsystems"); do NOT phrase it as a numeric threshold comparison (no "> N files" / "≥ M steps" rules) — judgment only, no comparison operators.

## Output

Return the spec as a structured object (the dispatching engine enforces the shape), mapping the sections above into fields:
- `goal` ← Goal; `background` ← Background; `scope.inScope` / `scope.outOfScope` ← Scope
- `approach` ← Approach
- `acceptanceCriteria` ← Completion Criteria, as [{id: "AC-1", text}, ...] (ids English raw)
- `steps` ← Implementation Steps, as [{n, description, files, testImpact}, ...] (n sequential integers starting at 1; files are repo-relative paths)
- `testingStrategy` ← Testing Strategy, one string per scenario
- `risks` ← Risks, as [{risk, likelihood: low|med|high, mitigation, source}]
- `edgeCases` ← boundary conditions that must be explicitly handled (extract from the proposals' risk/boundary analyses — there is no dedicated section above)
- `sliceHint` ← Scale Hint, as {recommendation, candidates: [{label, slices}], rationale} — MANDATORY; if the task does not need splitting, still return exactly one candidate describing the whole task as a single slice
- `summary` ← one line: "{N} acceptance criteria, {M} edge cases"

English raw (not translated): `acceptanceCriteria[].id`, `risks[].likelihood`, `sliceHint.candidates[].label`, `steps[].files`. Every other free-text field renders in **{user_lang}**.
Do NOT write spec.md or any other file yourself — the orchestrator writes spec.md from this object.
