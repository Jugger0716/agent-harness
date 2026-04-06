# Single/Multi Mode Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 single(v3 단일 에이전트) / multi(v4.0.1 다중 페르소나) 모드를 선택하여 토큰 비용과 분석 깊이를 조절할 수 있게 한다.

**Architecture:** `state.json`에 `mode` 필드를 추가하고, SKILL.md의 Step 1에서 모드를 결정(인자 or 질문)한 뒤, Step 2(Planner)와 Step 4(Generator)에서 mode에 따라 분기한다. Single 모드용 템플릿 2개를 v3 기반으로 신규 생성한다.

**Tech Stack:** Markdown 템플릿, Claude Code Plugin (SKILL.md 기반 워크플로우)

---

## File Structure

| 파일 | 작업 | 역할 |
|------|------|------|
| `templates/planner/planner_single.md` | 신규 생성 | Single 모드 Planner 템플릿 (v3 기반) |
| `templates/generator/generator_single.md` | 신규 생성 | Single 모드 Generator 템플릿 (v3 기반) |
| `skills/harness/SKILL.md` | 수정 | 모드 선택 로직 + Step 2/4 조건부 분기 |
| `README.md` | 수정 | 모드 선택 옵션 문서화 |

---

### Task 1: Single 모드 Planner 템플릿 생성

**Files:**
- Create: `templates/planner/planner_single.md`

- [ ] **Step 1: 템플릿 파일 생성**

v3의 `planner_prompt.md` (git show 3d849c3:templates/planner_prompt.md)를 기반으로, v4.0.1의 변수 네이밍 컨벤션에 맞춰 `templates/planner/planner_single.md`를 생성한다.

```markdown
# Planner Phase (Single Agent)

You are the **Planner** in a 3-phase agent workflow. Your sole job is to deeply understand the task and write a structured spec — you must NOT write any implementation code.

## Task

{task_description}

## Repository

- **Path:** {repo_path}
- **Language:** {lang}
- **Scope:** {scope}

## Output Language

Write the spec in **{user_lang}**. All section headings and content must be in the user's language.

## Instructions

1. **Explore the codebase** — read `CLAUDE.md` (if present), then browse the files and directories relevant to the scope above. Understand the existing architecture, patterns, and conventions before writing anything.

2. **Think broadly first** — search installed skills for "brainstorming" or "ideation" and invoke if found. Explore the problem space: consider multiple approaches, surface edge cases, and identify risks before committing to a direction. If no skill is available, do this reasoning inline.

3. **Write a plan** — search installed skills for "writing-plans" or "plan" and invoke if found. Organise your findings into a coherent, actionable spec. If no skill is available, structure the spec directly.

4. **Write `spec.md`** to `{spec_path}` with the following sections (in order). Translate section headings to `{user_lang}`:

   ### Goal
   One or two sentences. What outcome must be achieved?

   ### Background
   Why is this change needed? Relevant context from the codebase or requirements.

   ### Scope
   Which files, modules, or directories are in scope? Which are explicitly out of scope?

   ### Approach
   High-level approach and design decisions. Describe *what* will be built and *why* — **do not** specify exact function signatures, SQL, or other implementation details. Those decisions belong to the Generator.

   ### Completion Criteria
   A checklist of verifiable acceptance criteria. Use GitHub-flavoured Markdown checkboxes:
   - [ ] criterion one
   - [ ] criterion two

   ### Risks
   Potential risks, unknowns, or areas requiring care during implementation.

## Constraints

- Do **not** modify any source files in the repository.
- Do **not** define implementation details such as function signatures, data structures, or algorithms — the Generator phase decides those.
- Output only `spec.md`; do not create any other files.
```

- [ ] **Step 2: 커밋**

```bash
git add templates/planner/planner_single.md
git commit -m "feat: add single-mode planner template based on v3"
```

---

### Task 2: Single 모드 Generator 템플릿 생성

**Files:**
- Create: `templates/generator/generator_single.md`

- [ ] **Step 1: 템플릿 파일 생성**

v3의 `generator_prompt.md` (git show 3d849c3:templates/generator_prompt.md)를 기반으로, v4.0.1의 변수 네이밍 컨벤션에 맞춰 `templates/generator/generator_single.md`를 생성한다.

```markdown
# Generator Phase — Round {round_num} (Single Agent)

You are the **Generator** in a 3-phase agent workflow. Your job is to implement code that satisfies the spec produced by the Planner.

## Spec

{spec_content}

## QA Feedback from Previous Round

{qa_feedback}

## Output Language

Write `changes.md` and all user-facing messages in **{user_lang}**.

## Scope & Limits

- **File scope:** {scope}
- **Max files to modify/create:** {max_files}

## Available Skills

Search installed skills by keyword and invoke matches. Do not require specific plugin names.

- If test command is available: search for "test-driven-development" or "tdd" skill and invoke if found.
- Search for "subagent-driven-development", "parallel-tasks", or "dispatching-parallel-agents" skill and invoke if found.
- If no matching skill is found, proceed without it.

## Instructions

1. **Read the spec carefully.** Understand the goal, scope, approach, and completion criteria before writing a single line of code.

2. **Pre-implementation scope check** (skip if scope is "(no limit)"):
   - List all files you plan to modify or create.
   - For each file, verify it matches the scope pattern: `{scope}`
   - If any file falls outside scope, adjust your plan before writing any code.
   - Print the verified file list before proceeding.

3. **Parallel execution** — if a parallel execution skill was found above, use it to break the implementation into independent sub-tasks.

4. **TDD** — if a TDD skill was found above, follow it: write a failing test for each change, then implement the minimal code to make it pass. Run tests after each change.

5. **If this is Round 2 or later:**
   - Review the QA feedback above carefully.
   - **Only fix items marked FAIL** in the QA report.
   - **Do not touch items already marked PASS** — leave them exactly as they are.
   - Surgical, minimal changes only.

6. **Stay within scope.** Do not modify files outside the declared scope. Do not exceed {max_files} files total.

7. **After implementation, write `changes.md`** to `{changes_path}` with the following format:

   ```
   ## Round {round_num} Changes

   ### Modified Files
   - path/to/file.py — brief reason

   ### Created Files
   - path/to/new_file.py — brief reason

   ### Deleted Files
   - (none, or list)
   ```

## Constraints

- Keep changes minimal and focused — do not refactor code unrelated to the spec.
- Follow the existing code style, naming conventions, and patterns observed in the repository.
- Do not introduce new dependencies unless explicitly required by the spec.
```

- [ ] **Step 2: 커밋**

```bash
git add templates/generator/generator_single.md
git commit -m "feat: add single-mode generator template based on v3"
```

---

### Task 3: SKILL.md — Step 1 모드 선택 로직 추가

**Files:**
- Modify: `skills/harness/SKILL.md:50-113` (Step 1: Setup 섹션)

- [ ] **Step 1: Step 1의 7번 항목 뒤에 모드 선택 단계 추가**

Step 1의 기존 7번(Print setup summary) 뒤에 새로운 8번을 삽입한다.
또한 state.json 스키마(6번)에 `mode` 필드를 추가한다.

state.json에 `"mode"` 필드 추가 (6번 항목의 JSON에):

```json
{
  "task": "<user's task description>",
  "mode": "<selected mode: single or multi>",
  "user_lang": "<detected language code>",
  ...
}
```

Setup summary(7번)에 Mode 줄 추가:

```
[harness] Task started!
  Repo     : <path>
  Branch   : harness/<slug>
  Mode     : <single | multi>
  Language : <lang>
  Test     : <test_cmd or "none">
  Build    : <build_cmd or "none">
  Scope    : <scope>
```

새로운 8번 항목 추가:

```markdown
8. **Mode selection:**

   - If `--mode single` or `--mode multi` was passed in the task arguments, set mode accordingly and skip the prompt.
   - Otherwise, ask the user (in `user_lang`):
     ```
     [harness] 모드를 선택해 주세요:
       1. single — 단일 에이전트 (빠르고 토큰 절약)
       2. multi  — 다중 페르소나 (깊이 있는 분석, 토큰 ~1.7x)
     > (1 / 2 / single / multi)
     ```
     (Translate the prompt to `user_lang`.)
   - Accept: "1", "2", "single", "multi" (case-insensitive).
   - Write the selected mode to `state.json`.
   - If the user provides an unrecognized response, re-ask.
```

- [ ] **Step 2: Session Recovery 섹션에 mode 표시 추가**

`skills/harness/SKILL.md:29-30` 의 세션 복구 표시에 Mode 줄 추가:

```
[harness] Previous session detected.
  Task   : <task>
  Mode   : <single | multi>
  Phase  : <phase label>
  Round  : <round> / <max_rounds>
  Branch : <branch>
```

- [ ] **Step 3: Status Check 섹션에도 mode 표시 추가**

`skills/harness/SKILL.md` 하단 Status Check 표시:

```
[harness]
  Task   : <task>
  Mode   : <single | multi>
  Phase  : <phase label>
  Round  : <round> / <max_rounds>
  Branch : <branch>
  Scope  : <scope>
```

- [ ] **Step 4: 커밋**

```bash
git add skills/harness/SKILL.md
git commit -m "feat: add mode selection logic to Step 1 Setup"
```

---

### Task 4: SKILL.md — Step 2 Planner 조건부 분기

**Files:**
- Modify: `skills/harness/SKILL.md:115-198` (Step 2: Planner Phase 섹션)

- [ ] **Step 1: Step 2 헤더와 설명을 모드 분기 구조로 변경**

기존 Step 2 전체를 다음 구조로 교체한다:

```markdown
### Step 2: Planner Phase

Read `mode` from state.json and branch accordingly.

#### If mode == "single": Step 2-S (Single Agent Planner)

1. Read the single planner template: `{CLAUDE_PLUGIN_ROOT}/templates/planner/planner_single.md`
2. Interpret it with the current context (task, repo_path, lang, scope, user_lang, spec_path). Do NOT write a rendered file — process inline.
3. Follow the planner instructions:
   - Explore the codebase (CLAUDE.md, relevant files)
   - **Invoke a brainstorming skill** — search installed skills for "brainstorming" or "ideation" and invoke the first match
   - **Invoke a planning skill** — search installed skills for "writing-plans" or "plan" and invoke the first match
   - If no matching skill is found, proceed without it
   - Write `spec.md` to `docs/harness/<slug>/spec.md` — **all content in `user_lang`**
4. Update `.harness/state.json`: set phase to `"plan_ready"`.
5. Inform the user (in `user_lang`):
   ```
   [harness] Planner complete.
     Mode   : single
     Output : spec.md written
   ```

#### If mode == "multi": Step 2-M (Multi-Agent Planner)

The Planner uses **3 specialist personas** to generate diverse, independently-reasoned proposals, followed by cross-critique and synthesis. This eliminates anchoring bias and maximizes edge case discovery.

##### Step 2a: Independent Proposals (Parallel)

(기존 Step 2a 내용 그대로 유지)

##### Step 2b: Cross-Critique (Parallel)

(기존 Step 2b 내용 그대로 유지)

##### Step 2c: Synthesis

(기존 Step 2c 내용 그대로 유지)
```

- [ ] **Step 2: 커밋**

```bash
git add skills/harness/SKILL.md
git commit -m "feat: add single/multi branch to Step 2 Planner"
```

---

### Task 5: SKILL.md — Step 4 Generator 조건부 분기

**Files:**
- Modify: `skills/harness/SKILL.md` (Step 4: Generator Phase 섹션)

- [ ] **Step 1: Step 4 헤더와 설명을 모드 분기 구조로 변경**

기존 Step 4 전체를 다음 구조로 교체한다:

```markdown
### Step 4: Generator Phase

Read `mode` from state.json and branch accordingly.

#### If mode == "single": Step 4-S (Single Agent Generator)

1. Update state.json: phase → `"gen_ready"`, read current round.

2. Read the single generator template: `{CLAUDE_PLUGIN_ROOT}/templates/generator/generator_single.md`

3. Prepare the prompt:
   - `{spec_content}`: read from `docs/harness/<slug>/spec.md`
   - `{qa_feedback}`: read from `docs/harness/<slug>/qa_report.md` if round > 1, else "(First round — no QA feedback)"
   - `{round_num}`, `{scope}`, `{max_files}`: from state.json
   - `{user_lang}`: from state.json
   - `{changes_path}`: `docs/harness/<slug>/changes.md`

4. **Invoke implementation skills** — search installed skills and invoke matches:
   - If test_cmd available: search for "test-driven-development" or "tdd"
   - Search for "subagent-driven-development", "parallel-tasks", or "dispatching-parallel-agents"
   - If no matching skill is found, proceed without it

5. **Launch 1 subagent** to implement the code following the template.

6. Wait for completion. Verify `docs/harness/<slug>/changes.md` exists.

7. Inform the user (in `user_lang`):
   ```
   [harness] Generator complete.
     Mode   : single
     Code   : implemented
     Output : changes.md written
   ```

#### If mode == "multi": Step 4-M (Lead + Advisors Generator)

The Generator uses a **Lead Developer + Advisory Panel** pattern. One agent owns the implementation for code coherence, while advisors review the plan before code is written to prevent costly rework.

##### Step 4a: Implementation Plan (Subagent)

(기존 Step 4a 내용 그대로 유지)

##### Step 4b: Advisory Review (Parallel)

(기존 Step 4b 내용 그대로 유지)

##### Step 4c: Implementation (Subagent)

(기존 Step 4c 내용 그대로 유지)
```

- [ ] **Step 2: 커밋**

```bash
git add skills/harness/SKILL.md
git commit -m "feat: add single/multi branch to Step 4 Generator"
```

---

### Task 6: SKILL.md — description 및 Key Rules 업데이트

**Files:**
- Modify: `skills/harness/SKILL.md:1-3` (frontmatter)
- Modify: `skills/harness/SKILL.md` (Key Rules 섹션)

- [ ] **Step 1: frontmatter description 업데이트**

```yaml
---
name: harness
description: 3-Phase (Planner -> Generator -> Evaluator) development workflow with selectable single-agent or multi-agent persona mode. Use when starting feature work, bug fixes, or maintenance tasks that benefit from structured planning, implementation, and review.
---
```

- [ ] **Step 2: 첫 줄 설명 업데이트**

```markdown
You are orchestrating a 3-Phase development workflow with **selectable single-agent or multi-agent persona mode**.
```

- [ ] **Step 3: Key Rules에 모드 관련 규칙 추가**

Key Rules 섹션 끝에 추가:

```markdown
- **Mode selection.** If `--mode` argument is provided, use it. Otherwise, ask the user after Setup. Store in state.json and preserve across session recovery.
- **Single mode skips multi-agent steps.** No parallel proposals, no cross-critiques, no advisory reviews. The Evaluator phase is identical in both modes.
```

- [ ] **Step 4: 커밋**

```bash
git add skills/harness/SKILL.md
git commit -m "feat: update SKILL.md description and key rules for mode selection"
```

---

### Task 7: README.md 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 상단 설명에 모드 선택 언급 추가**

`README.md:1-3`의 설명을 업데이트:

```markdown
# Agent Harness

**Zero-setup, zero-dependency** 3-Phase (Planner -> Generator -> Evaluator) development workflow for Claude Code with **selectable single-agent or multi-agent persona mode**.
```

- [ ] **Step 2: 워크플로우 다이어그램에 모드 분기 반영**

기존 다이어그램 (`README.md:14-22`) 교체:

```
/agent-harness:harness  -> [Setup] Auto-detect + mode selection (single / multi)
                        -> [Phase 1] Planner
                           single: 1 agent explores + writes spec.md
                           multi:  3 specialists propose independently
                                   -> Cross-critique: each reviews others
                                   -> Synthesis: merge into spec.md
                        -> Confirmation Gate: user approves spec
                        -> [Phase 2] Generator
                           single: 1 agent implements code
                           multi:  Lead Developer creates plan
                                   -> 2 advisors review plan in parallel
                                   -> Lead Developer codes with feedback
                        -> [Phase 3] Evaluator (isolated subagent): test + review
                        -> PASS -> Done / FAIL -> Back to Phase 2 (max N rounds)
```

- [ ] **Step 3: Options 테이블에 mode 옵션 추가**

`README.md` Options 섹션의 테이블에 행 추가:

```markdown
| Option | Default | Description |
|--------|---------|-------------|
| mode | (ask user) | `single` for fast/token-saving, `multi` for deep multi-agent analysis |
| scope | auto-detected | Restrict file modifications to a pattern |
| max rounds | 3 | Maximum Generator/Evaluator retry cycles |
| max files | 20 | Maximum number of files that can be modified |
```

Usage 예시 업데이트:

```markdown
## Usage

```
/agent-harness:harness fix login timeout bug                    # mode 물어봄
/agent-harness:harness fix login timeout bug --mode single      # 바로 single
/agent-harness:harness fix login timeout bug --mode multi       # 바로 multi
```
```

- [ ] **Step 4: Token Cost 섹션 업데이트**

`README.md`의 Token Cost vs. Quality Trade-off 섹션에 모드 선택 안내 추가:

```markdown
### Token Cost vs. Quality Trade-off

Choose the mode that fits your task:

| Mode | Best for | Token cost |
|------|----------|------------|
| **single** | Small bug fixes, simple features, quick iterations | Baseline |
| **multi** | Complex features, architectural changes, high-stakes code | ~1.7x baseline |

The multi-agent approach uses more tokens per run, but the higher first-pass success rate often reduces total cost by avoiding expensive retry rounds.
```

- [ ] **Step 5: 커밋**

```bash
git add README.md
git commit -m "docs: update README with mode selection feature"
```

---

### Task 8: 버전 범프

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: 버전 파일 확인 및 범프**

`.claude-plugin/plugin.json`과 `.claude-plugin/marketplace.json`의 version 필드를 `4.0.1` → `4.1.0`으로 업데이트한다. (minor 버전 증가 — 하위호환 기능 추가)

- [ ] **Step 2: 커밋**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: bump version to 4.1.0"
```
