# Agent Harness

**Zero-setup, zero-dependency** 3-Phase (Planner -> Generator -> Evaluator) development workflow for Claude Code with **multi-agent personas**.

No dependencies required. No Python, no pip, no build steps -- just install the plugin and go.

Inspired by Anthropic's [Harness Design for Long-Running Application Development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

## What it does

Separates planning, implementation, and review into distinct phases with file-based handoffs. Each phase uses **specialized sub-agents with expert personas** that collaborate through structured debate and review patterns, eliminating single-agent blind spots.

```
/agent-harness:harness  -> [Phase 1] Planner: 3 specialists propose independently
                           -> Cross-critique: each reviews others' proposals
                           -> Synthesis: orchestrator merges into spec.md
                        -> Confirmation Gate: user approves spec
                        -> [Phase 2] Generator: Lead Developer creates plan
                           -> Advisory Panel: 2 advisors review plan in parallel
                           -> Implementation: Lead Developer codes with feedback
                        -> [Phase 3] Evaluator (isolated subagent): test + review
                        -> PASS -> Done / FAIL -> Back to Phase 2 (max N rounds)
```

Claude handles everything directly -- no external CLI, no wrapper scripts. The plugin skill guides Claude through each phase natively.

## Install

```bash
claude plugin marketplace add Lee-JungGu/agent-harness
claude plugin install agent-harness@agent-harness-marketplace
```

## Usage

Once installed, use in any Claude Code session:

```
/agent-harness:harness fix login timeout bug
```

That's it. No initialization, no repo registration, no configuration files needed. The harness auto-detects your project language, test commands, and build commands from project files.

### Auto-Detection

The harness detects language, test, and build commands from your project files:

| Detected File | Language | Test Command | Build Command |
|--------------|----------|-------------|---------------|
| `build.gradle` / `build.gradle.kts` | Java/Kotlin | `./gradlew test` | `./gradlew build` |
| `pom.xml` | Java | `mvn test` | `mvn compile` |
| `pyproject.toml` / `setup.py` | Python | `pytest` | - |
| `package.json` | TypeScript/JavaScript | `npm test` | `npm run build` |
| `*.csproj` | C# | `dotnet test` | `dotnet build` |
| `go.mod` | Go | `go test ./...` | `go build ./...` |
| `Cargo.toml` | Rust | `cargo test` | `cargo build` |

## How it works

1. You invoke the harness skill with a task description
2. **Setup**: Auto-detects language/test/build, detects your language, creates `.harness/state.json` and `docs/harness/<task-slug>/`, creates a `harness/*` git branch

### Phase 1 -- Planner (Multi-Agent)

Three specialist personas analyze the task **independently and in parallel**:

| Persona | Focus |
|---------|-------|
| **System Architect** | Structure, scalability, dependency management, long-term design |
| **Senior Developer** | Implementation feasibility, practical constraints, hidden complexity |
| **QA Specialist** | Failure modes, edge cases, boundary conditions, error handling |

After independent proposals, each specialist **cross-critiques** the other two proposals. The orchestrator then **synthesizes** all 6 documents (3 proposals + 3 critiques) into a single `spec.md` using majority-rule and evidence-based decision criteria.

**Why this works:** Independent proposals eliminate anchoring bias. Cross-critique surfaces disagreements. Synthesis preserves the strongest ideas from all perspectives.

4. **Confirmation Gate**: Claude shows the spec and waits for explicit user approval before proceeding. Ambiguous responses are re-confirmed.

### Phase 2 -- Generator (Lead + Advisors)

A single Lead Developer owns the implementation for code coherence, supported by an advisory panel:

| Persona | Role | Timing |
|---------|------|--------|
| **Lead Developer** | Creates implementation plan, then implements code | Sequential |
| **Code Quality Advisor** | Reviews plan for anti-patterns, SOLID violations, consistency | Before implementation |
| **Test & Stability Advisor** | Reviews plan for runtime risks, error handling gaps, test coverage | Before implementation |

The advisory review happens **before code is written**, catching issues when they're cheap to fix rather than expensive to rework.

### Phase 3 -- Evaluator (Isolated)

Runs as an isolated sub-agent with research-backed bias reduction:

| Technique | Research Basis |
|-----------|---------------|
| **Context isolation** (separate subagent) | Agent-as-a-Judge (ICLR 2025): 90.44% human agreement vs 60.38% for inline evaluation |
| **Anchor-free input** (no Generator reasoning passed) | Anchoring bias research: LLMs anchor strongly to provided context |
| **Defect-assumption framing** ("assume defects exist") | Pre-mortem (Brookings): reduces overconfidence |
| **Author neutralization** (no author identity disclosed) | PNAS 2025: LLMs favor LLM-generated content at 89% rate |
| **PASS-before-rebuttal** (must list problems before PASS) | Confirmation bias: structural forced consideration of counterevidence |
| **Rubric decomposition** (2-3 sub-checks per criterion) | G-Eval, RocketEval: finer granularity reduces evaluation bias |

7. If FAIL, the user is asked whether to retry (up to max rounds)
8. On completion, the user is asked whether to commit the artifacts

### Token Cost vs. Quality Trade-off

The multi-agent approach uses approximately **1.7-2x more tokens** per run compared to a single-agent approach. However, the higher first-pass success rate often **reduces total cost** by avoiding expensive retry rounds:

| Scenario | Single Agent | Multi-Agent |
|----------|-------------|-------------|
| 1 round (PASS) | 100% baseline | ~175% |
| 2 rounds (FAIL → PASS) | ~200% | ~175% (first-pass PASS) |

### Session Recovery

If a session is interrupted, the harness detects the existing `.harness/state.json` on next invocation and offers to resume from where you left off.

### File Structure

```
.harness/
  state.json                        # Working state (temporary)
  planner/
    proposal_architect.md           # Architect's independent proposal
    proposal_senior_developer.md    # Senior Developer's independent proposal
    proposal_qa_specialist.md       # QA Specialist's independent proposal
    critique_architect.md           # Architect's cross-critique
    critique_senior_developer.md    # Senior Developer's cross-critique
    critique_qa_specialist.md       # QA Specialist's cross-critique
  generator/
    plan.md                         # Lead Developer's implementation plan
    review_code_quality.md          # Code Quality Advisor's review
    review_test_stability.md        # Test & Stability Advisor's review

docs/harness/<task-slug>/
  spec.md                           # Planner output (preserved)
  changes.md                        # Generator output (preserved)
  qa_report.md                      # Evaluator output (preserved)
```

### Confirmation Gates

The Generator phase consumes significant tokens and is hard to undo. The harness enforces **explicit user confirmation** before proceeding:

- **Spec approval**: Only clear affirmatives are accepted. Ambiguous responses trigger re-confirmation.
- **QA retry**: When the Evaluator reports FAIL, the harness asks the user before starting another round.

### Language Support

The harness communicates in the **user's language** -- automatically detected from the task description. All templates are written in English for token efficiency and global compatibility, but all user-facing output (messages, spec, QA reports) is generated in the detected language. Language changes mid-conversation are also detected.

### Options

You can pass options in conversation when invoking the harness:

| Option | Default | Description |
|--------|---------|-------------|
| scope | auto-detected | Restrict file modifications to a pattern |
| max rounds | 3 | Maximum Generator/Evaluator retry cycles |
| max files | 20 | Maximum number of files that can be modified |

Example: `/agent-harness:harness fix auth bug --scope "src/auth/**" --max-rounds 5`

### Plugin Compatibility

The harness discovers skills by **capability keyword** (e.g. "brainstorming", "tdd", "code-review"), not by plugin name. It works with any installed plugin that provides matching skills:

| Phase | Searches for | Example matches |
|-------|-------------|-----------------|
| Planner | "brainstorming", "ideation" | superpowers:brainstorming, any brainstorming skill |
| Planner | "writing-plans", "plan" | superpowers:writing-plans, any planning skill |
| Generator | "test-driven-development", "tdd" | superpowers:test-driven-development |
| Generator | "subagent-driven-development", "parallel-tasks" | superpowers:subagent-driven-development |
| Evaluator | "systematic-debugging", "debugging" | superpowers:systematic-debugging |
| Evaluator | "requesting-code-review", "code-review" | superpowers:requesting-code-review |
| Evaluator | "verification-before-completion", "verification" | superpowers:verification-before-completion |

If no matching skill is found, the harness proceeds without it. No specific plugin is required.

## License

MIT

## Author

Lee-JungGu
