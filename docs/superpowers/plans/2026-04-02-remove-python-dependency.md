# Remove Python Dependency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Python 의존성을 완전히 제거하고 순수 SKILL.md 기반 플러그인으로 전환한다.

**Architecture:** SKILL.md가 모든 워크플로우 로직(auto-detect, 상태 관리, 페이즈 전환, 확인 게이트)을 담당. Claude가 Read/Write/Bash 도구로 직접 수행. 템플릿은 유지하되 Claude가 인라인 해석.

**Tech Stack:** Markdown (SKILL.md), JSON (state.json), Git

---

### Task 1: 새 SKILL.md 작성

**Files:**
- Rewrite: `skills/harness/SKILL.md`

이 태스크가 전체 전환의 핵심이다. 현재 SKILL.md는 `python harness.py` 호출에 의존하지만, 새 버전은 모든 로직을 Claude 지침으로 포함한다.

- [ ] **Step 1: SKILL.md 전체 재작성**

기존 SKILL.md를 아래 내용으로 교체한다. 주요 섹션:

```markdown
---
name: harness
description: 3-Phase (Planner -> Generator -> Evaluator) development workflow. Use when starting feature work, bug fixes, or maintenance tasks that benefit from structured planning, implementation, and review.
---

# Agent Harness Workflow

You are orchestrating a 3-Phase development workflow.

**Zero-setup:** No initialization required. Auto-detects language, test commands, and build commands from the current directory.

## Workflow

When the user provides a task (via $ARGUMENTS or in conversation), execute this workflow:

### Step 1: Setup

1. **Slugify the task:** lowercase, remove non-word chars except hyphens, replace spaces with hyphens, truncate to 50 chars. Store as `<slug>`.

2. **Auto-detect language and commands.** Scan the repo root with Glob and check for these files:

   | File | Language | Test Command | Build Command |
   |------|----------|-------------|---------------|
   | `build.gradle` or `build.gradle.kts` | java | `./gradlew test` | `./gradlew build` |
   | `pom.xml` | java | `mvn test` | `mvn compile` |
   | `pyproject.toml` or `setup.py` | python | `pytest` | (none) |
   | `package.json` | typescript | `npm test` | `npm run build` |
   | `*.csproj` | csharp | `dotnet test` | `dotnet build` |
   | `go.mod` | go | `go test ./...` | `go build ./...` |
   | `Cargo.toml` | rust | `cargo test` | `cargo build` |

   If none match, set language to "unknown", test/build commands to null.

3. **Create directories:**
   - `.harness/` (working state)
   - `docs/harness/<slug>/` (artifacts)

4. **Create git branch:**
   ```bash
   git checkout -b harness/<slug>
   ```

5. **Write `.harness/state.json`:**
   ```json
   {
     "task": "<user's task description>",
     "repo_name": "<directory name>",
     "repo_path": "<absolute path>",
     "phase": "plan_ready",
     "round": 1,
     "scope": "<user-provided scope or '(no limit)'>",
     "max_rounds": 3,
     "max_files": 20,
     "branch": "harness/<slug>",
     "lang": "<detected>",
     "test_cmd": "<detected or null>",
     "build_cmd": "<detected or null>",
     "docs_path": "docs/harness/<slug>/",
     "created_at": "<ISO8601>"
   }
   ```

6. **Print setup summary** to the user:
   ```
   [harness] Task started!
     Repo     : <path>
     Branch   : harness/<slug>
     Language : <lang>
     Test     : <test_cmd or "none">
     Build    : <build_cmd or "none">
     Scope    : <scope>
   ```

### Step 2: Planner Phase

1. Read the planner template: `{CLAUDE_PLUGIN_ROOT}/templates/planner_prompt.md`
2. Interpret it with the current context (task, repo_path, lang, scope). Do NOT write a rendered file — process inline.
3. Follow the planner instructions:
   - Explore the codebase (CLAUDE.md, relevant files)
   - Use brainstorming/planning skills if available
   - Write `spec.md` to `docs/harness/<slug>/spec.md`
4. Update `.harness/state.json`: set phase to `"plan_ready"` (spec written, awaiting confirmation).

### Step 3: HARD GATE — Spec Confirmation

<HARD-GATE>
Show spec.md to the user and ask for explicit confirmation. Do NOT proceed to Generator until confirmed.

**Allowed responses (proceed only on these):**
"진행", "승인", "ㅇㅇ", "go", "proceed", "approve", "확인", "좋아", "넘어가", "yes", "ok", "lgtm"

**Ambiguous — must re-confirm:**
"음...", "글쎄", "괜찮은 것 같은데", questions, conditional statements, topic changes.

On ambiguity, respond:
> "구현을 시작하면 토큰 소비가 크므로 명확한 확인이 필요합니다. spec 내용대로 구현을 진행할까요? (진행/수정/중단)"

If user requests modifications, update spec.md and re-confirm. If user says "중단" or "stop", halt the workflow.
</HARD-GATE>

### Step 4: Generator Phase

1. Update state.json: phase → `"gen_ready"`, read current round.
2. Read the generator template: `{CLAUDE_PLUGIN_ROOT}/templates/generator_prompt.md`
3. Interpret with context:
   - `spec_content`: read from `docs/harness/<slug>/spec.md`
   - `qa_feedback`: read from `docs/harness/<slug>/qa_report.md` if round > 1, else "(First round — no QA feedback)"
   - `round_num`, `scope`, `max_files`: from state.json
   - `skill_instructions` / `tdd_instruction`: include TDD instructions if test_cmd is not null
4. Follow the generator instructions — implement code changes.
5. Write `docs/harness/<slug>/changes.md` listing all modified/created files.

### Step 5: Evaluator Phase

1. Update state.json: phase → `"eval_ready"`.
2. Read the evaluator template: `{CLAUDE_PLUGIN_ROOT}/templates/evaluator_prompt.md`
3. Interpret with context:
   - `spec_content`, `changes_content`: from docs/harness/<slug>/
   - `test_available`, `build_cmd`, `test_cmd`: from state.json
   - `round_num`, `scope`: from state.json
4. Follow the evaluator instructions:
   - Run tests if available
   - Code review against 5 criteria
   - Write `docs/harness/<slug>/qa_report.md` with PASS/FAIL verdict

### Step 6: Verdict & Loop

Read qa_report.md and determine verdict (look for "Verdict: PASS" or "Verdict: FAIL" or Korean equivalents).

**If PASS:**
- Update state.json: phase → `"completed"`
- Inform user: task complete
- Proceed to Step 7

**If FAIL and rounds remaining (round < max_rounds):**
- Do NOT automatically retry. Ask user:
  > "QA 결과 FAIL입니다. [failure summary]. 다음 라운드로 수정을 진행할까요? (진행/중단)"
- If user confirms: increment round in state.json, go back to Step 4
- If user stops: update phase to "completed", proceed to Step 7

**If FAIL and max rounds reached:**
- Update state.json: phase → `"completed"`
- Inform user of remaining issues
- Proceed to Step 7

### Step 7: Cleanup & Commit

Ask the user:
> "산출물(spec.md, changes.md, qa_report.md)을 커밋할까요? (커밋/스킵)"

- If commit: stage and commit `docs/harness/<slug>/` files
- Clean up `.harness/` directory (delete state.json and the directory)

### Status Check (anytime)

If user asks for status, read `.harness/state.json` and display:
```
[harness]
  Task   : <task>
  Phase  : <phase label>
  Round  : <round> / <max_rounds>
  Branch : <branch>
  Scope  : <scope>
```

Phase labels: plan_ready → "Planner — writing spec", gen_ready → "Generator — implementing", eval_ready → "Evaluator — reviewing", completed → "Completed"

## Key Rules

- **Never skip phases.** Always Planner → Generator → Evaluator.
- **Confirmation gates are non-negotiable.** No implicit approval, no proceeding on ambiguity.
- **Stay within scope.** Do not modify files outside the specified scope.
- **Evaluator must be strict.** Do not hand-wave issues.
- **Git safety.** The workflow creates a branch automatically.
- **Use whatever skills are available.** Don't require specific plugins — use matching skills from any installed plugin.
- **Language matching.** Detect the language of the user's task description and communicate all progress updates, questions, and reports in that same language. Spec sections, QA criteria, and commit messages should also match the detected language.
```

- [ ] **Step 2: SKILL.md가 올바른 마크다운인지 확인**

Read로 작성된 파일을 다시 읽어 frontmatter, 섹션 구조, 누락된 부분이 없는지 검증한다.

- [ ] **Step 3: 커밋**

```bash
git add skills/harness/SKILL.md
git commit -m "feat: rewrite SKILL.md as pure skill without Python dependency"
```

---

### Task 2: 템플릿 정리

**Files:**
- Modify: `templates/planner_prompt.md`
- Modify: `templates/generator_prompt.md`
- Modify: `templates/evaluator_prompt.md`

템플릿은 유지하되, Claude가 인라인 해석할 때 명확하도록 변수 표기를 정리한다. Python renderer에 종속된 부분이 있으면 제거.

- [ ] **Step 1: planner_prompt.md 검토 및 정리**

현재 내용을 확인하고, `{variable}` 표기가 Claude 인라인 해석에 적합한지 확인. 필요시 주석 추가하여 어떤 값으로 치환해야 하는지 명시.

현재 변수:
- `{task_description}` → 사용자의 태스크 설명
- `{repo_path}` → 저장소 절대 경로
- `{lang}` → auto-detect된 언어
- `{scope}` → 파일 범위 또는 "(no limit)"

변경 없이 유지 가능하면 그대로 둔다.

- [ ] **Step 2: generator_prompt.md 검토 및 정리**

현재 변수:
- `{round_num}`, `{spec_content}`, `{qa_feedback}`, `{scope}`, `{max_files}`
- `{skill_instructions}`, `{tdd_instruction}` — 이것들은 Python에서 조건부로 생성됨

`{skill_instructions}`와 `{tdd_instruction}`은 Python이 조건부로 삽입하던 블록이다. 이를 SKILL.md에서 Claude가 직접 판단하도록 변경:
- 두 변수를 제거하고, 대신 주석으로 조건을 명시:
  ```
  <!-- If test_cmd is available, include TDD instructions. If not, skip. -->
  ```
- 또는 두 블록을 템플릿에 직접 포함하되, `[if test available]`/`[if no test]` 조건 마커를 추가.

- [ ] **Step 3: evaluator_prompt.md 검토**

변수는 모두 직접 치환 가능:
- `{round_num}`, `{spec_content}`, `{changes_content}`, `{test_available}`, `{build_cmd}`, `{test_cmd}`, `{scope}`

변경 없이 유지 가능할 것으로 예상.

- [ ] **Step 4: 커밋**

```bash
git add templates/
git commit -m "refactor: clean up templates for direct Claude interpretation"
```

---

### Task 3: Python 파일 삭제

**Files:**
- Delete: `harness.py`
- Delete: `config.py`
- Delete: `state.py`
- Delete: `renderer.py`
- Delete: `phases/__init__.py` (if exists)
- Delete: `phases/planner.py`
- Delete: `phases/generator.py`
- Delete: `phases/evaluator.py`
- Delete: `requirements.txt`
- Delete: `tests/` (entire directory)

- [ ] **Step 1: 모든 Python 파일 및 테스트 삭제**

```bash
git rm harness.py config.py state.py renderer.py requirements.txt
git rm -r phases/
git rm -r tests/
```

- [ ] **Step 2: .gitignore 정리**

Python 관련 항목 제거 (더 이상 필요 없음):
```
# 삭제 대상:
__pycache__/
*.py[cod]
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
```

`.env`와 `.harness/`는 유지:
```
.env
.harness/
```

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "chore: remove all Python files and test suite"
```

---

### Task 4: 플러그인 메타데이터 업데이트

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `README.md`

- [ ] **Step 1: plugin.json 버전 및 설명 업데이트**

```json
{
  "name": "agent-harness",
  "description": "3-Phase (Planner, Generator, Evaluator) development workflow for Claude Code — no dependencies required",
  "version": "2.0.0",
  "author": {
    "name": "Lee-JungGu"
  },
  "repository": "https://github.com/Lee-JungGu/agent-harness",
  "license": "MIT",
  "keywords": ["harness", "workflow", "planner", "generator", "evaluator", "multi-agent"]
}
```

메이저 버전 2.0.0 — Python 제거는 breaking change.

- [ ] **Step 2: marketplace.json 버전 동기화**

plugin.json과 동일하게 version `"2.0.0"`, description 업데이트.

- [ ] **Step 3: README.md 업데이트**

현재 README에서:
- Python 설치 관련 내용 제거
- `requirements.txt` 언급 제거
- "No dependencies required" 명시
- 워크플로우 설명을 새 구조에 맞게 갱신
- 설치 방법은 기존과 동일 (claude plugin marketplace add)

- [ ] **Step 4: 커밋**

```bash
git add .claude-plugin/ README.md
git commit -m "chore: bump to v2.0.0, update metadata for pure skill plugin"
```

---

### Task 5: 통합 테스트 (수동)

Python 테스트 스위트가 삭제되므로, 실제 플러그인 동작을 수동으로 검증한다.

- [ ] **Step 1: develop 브랜치에 push**

```bash
git push origin develop
```

- [ ] **Step 2: main에 merge 후 push**

```bash
git checkout main
git merge develop
git push origin main
```

- [ ] **Step 3: 플러그인 업데이트**

```bash
claude plugin update agent-harness@agent-harness-marketplace
```

2.0.0으로 업데이트 되는지 확인.

- [ ] **Step 4: 실제 사용 테스트**

다른 프로젝트 디렉토리에서 `/agent-harness:harness <태스크>` 실행하여:
- auto-detect가 동작하는지
- `.harness/state.json`이 생성되는지
- `docs/harness/<slug>/` 디렉토리가 생성되는지
- Planner 템플릿이 올바르게 해석되는지
- Confirmation gate가 동작하는지
