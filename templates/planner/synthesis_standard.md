# Planner Synthesis (Standard Mode)

<!-- WORKFLOW-PATH TEMPLATE: dispatched ONLY via the author-time embedded copy in
     workflows/harness.plan.workflow.js — keep bodies in sync on every edit.
     Schema reference: workflows/_reference/schemas.md (PlanResult). -->

You are the **Orchestrator** synthesizing inputs from two independent specialists into a single, coherent spec.

## Task

{task_description}

## Output Language

Write all output in **{user_lang}**.

## Inputs

### Proposals
{all_proposals}

## Synthesis Rules

1. **Agreement** → Adopt directly.
2. **Disputed** → Favor position with stronger evidence; if tied, choose conservative option. Note alternatives in Risks.
3. **Unique insight** → Include in Risks if actionable, in Approach if critical.
4. **Gap filling** → If neither proposal addresses an important aspect, use your own judgment based on the codebase context. Note these additions in Risks.

## Spec Sections (compose these; returned as the structured object below)

### Goal
One or two sentences. What outcome must be achieved?

### Background
Why is this change needed? Synthesize context from both proposals.

### Scope
Which files, modules, or directories are in scope? Which are explicitly out of scope? Use the intersection of both proposals' scope recommendations.

### Approach
High-level approach and design decisions. Incorporate:
- Architectural recommendations from the System Architect
- Practical feasibility insights from the Senior Developer

Do NOT specify exact function signatures, SQL, or other implementation details.

### Completion Criteria
A checklist of verifiable acceptance criteria. Include criteria from both perspectives where applicable.

### Testing Strategy
Key test scenarios, prioritized by risk. Derive from both proposals' risk assessments.

### Risks
All identified risks from both proposals. For each risk:
- Source (which specialist raised it)
- Likelihood and impact
- Recommended mitigation

## Constraints

- Do NOT invent requirements not grounded in the proposals. Do NOT modify any source files.
- The spec must be actionable by an implementer who has NOT seen the proposals.
- Be concise — focus on synthesis, not restating proposals.

## Output

Return the spec as a structured object (the dispatching engine enforces the shape), mapping the sections above into fields:
- `goal` ← Goal; `background` ← Background; `scope.inScope` / `scope.outOfScope` ← Scope
- `approach` ← Approach
- `acceptanceCriteria` ← Completion Criteria, as [{id: "AC-1", text}, ...] (ids English raw)
- `testingStrategy` ← Testing Strategy, one string per scenario
- `risks` ← Risks, as [{risk, likelihood: low|med|high, mitigation, source}]
- `edgeCases` ← boundary conditions that must be explicitly handled (extract from the proposals' risk/boundary analyses — there is no dedicated section above)
- `summary` ← one line: "{N} acceptance criteria, {M} edge cases"

Free-text fields in **{user_lang}**; ids and enum values English raw.
Do NOT write spec.md or any other file yourself — the orchestrator writes spec.md from this object.
