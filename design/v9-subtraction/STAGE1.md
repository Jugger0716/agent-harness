# v9 1단계 (v9.0.0: 삭제와 손실 경로 차단) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스킬 디렉터리 13개를 지우고, 남는 6개가 삭제 대상에 기대던 의존을 먼저 옮기고, 데이터를 잃을 수 있는 경로 8건을 막아 v9.0.0으로 릴리스한다.

**Architecture:** 커밋을 "의존 이전 → 손실 차단 → 삭제 → 린트 → 릴리스" 순으로 나눈다. 모든 커밋은 아래 게이트 G를 통과한 상태로 끝난다. 삭제 대상 스킬이 살아 있는 동안에는 그 파일도 린트가 깨지지 않을 만큼만 고친다.

**Tech Stack:** Markdown 계약 문서, 엔진 호스팅 JavaScript(Workflow 세그먼트), Python 3 표준 라이브러리(린트), Node.js(스텁 테스트·문법 검사).

**Spec:** `design/v9-subtraction/SPEC.md` 5절 1단계(1.1~1.4), 8절, 부록 A. 기준 수치는 `design/v9-subtraction/BASELINE.md`.

## Global Constraints

- 작업 브랜치는 `harness/v9-subtraction`, 기준 커밋은 converge HEAD `20b20e4`다. `develop`이나 `v8.14.0` 태그를 기준으로 삼지 않는다.
- **게이트 G** (모든 커밋 직전): `CLAUDE.md`의 `agent-harness-defaults: lint-cmd=` 줄에 적힌 체인이 exit 0이고, `node tests/segment_stubs/run.mjs`가 exit 0이다.
- 남기는 것 6개: handoff, harness, harness-gate, harness-build, deep-review, md-optimize. 지우는 것 13개 디렉터리: spec, refactor, migrate, test-gen, study, team-memory, codebase-audit, md-generate, debug, ship, code-review, memory, workflow.
- `main` 병합, 태그, GitHub 릴리스, 설치본 두 곳의 교체는 사용자 확인을 받은 뒤에만 한다(SPEC 8.2). 브랜치 푸시는 승인돼 있다.
- 공개 저장소다. 커밋하는 문서에 사내 저장소·프로젝트 이름, 사람 이름·계정명, 내부 경로를 쓰지 않는다. `docs/` 인용에는 `(gitignored — not a public link)`를 붙인다.
- 크기는 `git ls-tree -r -l <commit>`의 blob 바이트로만 잰다.
- 스텁 테스트의 `check`를 약하게 고치지 않는다. 결함을 고치면 같은 커밋에서 `known_failures.json`의 항목을 지운다. 예상 밖 실패를 목록에 넣지 않는다.
- `*.workflow.js`는 LF를 유지한다. 새 `.py` 파일은 `.gitattributes` 대상이 아니므로 커밋 전에 `git ls-files --eol`로 `i/lf`를 확인한다.
- 인용은 `§절 이름`으로 한다. 행 번호를 커밋 문서에 쓰지 않는다. 결함별 위치는 `docs/harness/v9-audit/02`, `03` 보고서(gitignored — not a public link)의 같은 번호를 보되, 고치기 전에 그 위치를 현재 트리에서 다시 읽는다(결함 51건 중 10건만 원문 확인됨).
- `min_sites`와 `min_cross_files`는 실측값에 여유 0으로 고정한다. 값을 바꾸는 커밋의 메시지에 이전 값 → 새 값을 적는다.
- 커밋 메시지는 스킬 범위를 붙인 Conventional Commits다.
- Git Bash에서 `/`로 시작하는 정규식을 넘길 때는 `export MSYS_NO_PATHCONV=1`을 먼저 실행한다. 빠뜨리면 패턴이 경로로 바뀌어 0건이 나온다.

## 1.1 의존표 재확인 결과 (2026-11-13, HEAD `5e6209e`)

SPEC 1.1의 12행은 모두 현재 트리에 그대로 있다. 표에 없던 것과 시뮬레이션 값이 다른 것은 다음과 같다.

| 발견 | 처리 |
|---|---|
| `templates/spec/critic.md`가 `workflows/spec.eval.workflow.js`의 `TPL_CRITIC` 원본이다(`// SYNC-SOURCE:` 주석) | Task 1에서 스크립트와 함께 옮긴다 |
| 스텁 테스트가 `spec.eval`을 이름으로 참조한다(`cases.mjs` 4곳, `known_failures.json` 키 3개와 `speceval-summary`) | Task 1에서 같은 커밋으로 바꾼다 |
| `workflows/_reference/state_fields.md`에도 `carried_over`가 있다 | Task 3 |
| `templates/_shared/falsification_rules.md`의 유지 쪽 소비자는 `workflows/_reference/schemas.md`의 서술뿐이다 | "정리"가 아니라 파일 삭제(Task 10) |
| `workflows/_reference/study_measurements.md`의 유지 쪽 소비자는 `CLAUDE.md`와 린트뿐이다 | 파일 삭제(Task 10) |
| 키워드 스킬 검색 지시(W14)가 표의 범위보다 넓다: `templates/generator/` 3개, `templates/evaluator/evaluator_prompt.md` 3곳, `templates/planner/planner_single.md` 2곳, `harness.build` 2곳, `harness.eval` 3곳 | Task 9 |
| 삭제 스킬의 `/x` 토큰이 유지 파일 31개에 남아 있다. `README.md`가 77줄로 가장 많다 | Task 11 |
| `session-conflict` 삭제 후 마커는 1곳이다(SPEC 1.3은 2). `adhoc-dispatch`는 4곳이다(SPEC은 5) | Task 10의 값 |
| md-optimize 라우팅 질문은 선택지가 2개라 `/md-generate` 선택지만 지우면 1개가 남는다 | Task 4에서 대체 선택지를 둔다 |

## 보류 Minor 6건의 배정

| 항목 | 배정 | 이유 |
|---|---|---|
| README "Seven top-level directories", CLAUDE.md "Run all six" 문구 | Task 11 | 그 문단을 어차피 고친다 |
| `.gitattributes`에 `tests/**/*.mjs` | Task 11 | 한 줄 |
| 대표 케이스 없는 스크립트의 이름 출력 | Task 10 | 삭제 뒤 0개가 되는지 확인하는 수단이 된다 |
| W15 케이스 단언 강화, `engine.mjs` 머리말 가정 보강, 알려진 실패의 기대 이유 기록 | 2단계 | 2단계의 완료 기준이 스텁 테스트다 |

## Review Focus

1. **업그레이드 전 세션의 state**: `plan_critic.source == "carried_over"`가 남은 `.harness/state.json`을 v9로 재개 — 게이트 행 ③으로 가서 `Run Critic anyway`를 고를 수 있어야 한다. (Task 3 Step 4)
2. **`.harness/wf/`의 옛 사본**: `spec.eval.workflow.js` 사본이 남은 작업 디렉터리에서 계획 검토 WORKFLOW 실행 — 새 이름으로 복사해 실행하고 옛 사본은 무시해야 한다. (Task 16 Step 3)
3. **git 저장소가 아닌 폴더**: 자동 수정 스냅샷과 md-optimize 백업이 git 없이도 같은 바이트 사본 경로로 동작해야 한다. (Task 5 Step 1, Task 7 Step 4)
4. **삭제된 스킬 이름을 부르는 사용자**: 플러그인 안에서는 응답할 수 없다 — CHANGELOG 이전 안내표가 13개 이름을 모두 담아야 한다. (Task 15 Step 2)
5. **유지 폴더에 남는 고아 템플릿**: 삭제 스킬만 읽던 파일이 `templates/_shared/` 등에 남는 경우 — 인용 0건인 파일을 세어 지워야 한다. (Task 10 Step 6)

---

## A. 의존 이전

### Task 1: 계획 검토 자산을 harness로 옮긴다

**Files:**
- Move: `templates/spec/critic_inline.md` → `templates/harness/plan_critic_inline.md`
- Move: `templates/spec/critic.md` → `templates/harness/plan_critic.md`
- Move: `workflows/spec.eval.workflow.js` → `workflows/harness.critic.workflow.js`
- Modify: `skills/harness/SKILL.md` §Step 2.6, `skills/harness-build/SKILL.md`(INLINE cold review 항목의 인용), `templates/harness/plan_critic_dispatch.md`, `templates/harness/converge.md`, `templates/_shared/segment_launch.md`, `templates/_shared/architecture_principles.md`, `workflows/_reference/schemas.md`, `workflows/harness.eval.workflow.js`·`workflows/deep-review.review.workflow.js`(주석), `scripts/verify_sync_markers.py`, `skills/spec/SKILL.md`(Phase 2c-D의 마커와 `scriptPath`만)
- Test: `tests/segment_stubs/cases.mjs`, `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Produces: 세그먼트 이름 `harness.critic`(`meta.name`), 실행 사본 경로 `.harness/wf/harness.critic.workflow.js`, SYNC 그룹 id `plan-critic-contract`(대상 `workflows/harness.critic.workflow.js`, 절 `contract`), 템플릿 경로 두 개. args와 반환 계약은 바꾸지 않는다.

- [ ] **Step 1: 스텁 테스트의 이름을 먼저 바꾼다**

`cases.mjs`의 `'spec.eval'` 키·`script`·`e.run` 인자를 `'harness.critic'`으로, 케이스 id `speceval-summary`를 `critic-summary`로 바꾼다. `known_failures.json`의 키 4개를 `empty-args-harness.critic`, `empty-object-harness.critic`, `missing-specContent-harness.critic`, `critic-summary`로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `node tests/segment_stubs/run.mjs`
Expected: exit 1. `harness.critic` 케이스가 ERROR(스크립트 없음)로 나온다.

- [ ] **Step 3: 세 파일을 `git mv`로 옮기고 스크립트 머리를 고친다**

`meta.name`은 `'harness.critic'`, `meta.description`은 `'INTERNAL — launched by /harness only. Plan-critic segment: one cold Critic review of spec.md; writes the findings file, modifies nothing else.'`로 한다(2단계가 나머지 스크립트에 적용할 내부용 한 줄 형식을 이 파일에는 지금 쓴다 — 어차피 다시 쓰는 문장이다). `// contract` 주석은 호출자를 `/harness` Step 2.6 하나로 적고 문구 `contracted for ONE caller`를 넣는다. `// SYNC-SOURCE:`는 `templates/harness/plan_critic.md`를 가리킨다. `/spec`을 설명하는 머리말 문장은 지운다.

- [ ] **Step 4: 인용 지점을 새 경로로 바꾼다**

위 Modify 목록의 파일에서 옛 경로 세 개와 `spec.eval`이라는 세그먼트 이름을 새 값으로 바꾼다. `verify_sync_markers.py`의 그룹은 id `plan-critic-contract`, `target_file` `workflows/harness.critic.workflow.js`, `target_anchor` `contracted for ONE caller`로 하고 `min_sites`는 3을 유지한다(spec 쪽 마커가 Task 10까지 남는다).

- [ ] **Step 5: 옛 이름이 남지 않았는지 확인한다**

Run: `git grep -n -E "spec\.eval|templates/spec/critic" -- . ':!CHANGELOG.md' ':!ROADMAP.md' ':!design'`
Expected: 출력 없음.

- [ ] **Step 6: 게이트 G를 돌린다**

Expected: 린트 exit 0. 스텁 테스트 마지막 줄 `5 pass, 25 known-fail, 0 fail, 0 fixed, 0 stale, 0 error; 10 script(s) without a representative case`.

- [ ] **Step 7: Commit**

`refactor(harness): move the plan-critic template and segment out of spec`

### Task 2: conventions 계약의 단일 소스를 harness로 옮긴다

**Files:**
- Modify: `skills/harness/SKILL.md` §Step 1.5, `skills/spec/SKILL.md`(마커 2곳의 대상만), `scripts/verify_sync_markers.py`

**Interfaces:**
- Produces: SYNC 그룹 `conventions-field-contract`의 대상이 `skills/harness/SKILL.md`, 절 이름은 그대로 `Step 1.5 conventions field contract`.

- [ ] **Step 1: 그룹의 `target_file`을 `skills/harness/SKILL.md`로 바꾸고 린트를 돌려 실패를 확인한다**

Run: `python scripts/verify_sync_markers.py`
Expected: exit 1 (마커가 옛 대상을 가리킨다).

- [ ] **Step 2: 마커 3곳의 대상을 `skills/harness/SKILL.md`로 바꾼다**

harness §Step 1.5의 `conventions` field contract 문단이 정본이 된다. 허용 값 세 개(`null`, `"skipped"`, `"file:.harness/conventions.md"`)가 그 문단에 모두 있는지 확인하고 빠진 값이 있으면 채운다. 그룹 주석의 "spec이 정본" 서술은 지우지 말고 같은 주석 안에 정정을 덧붙인다. `harness-steps` 검사가 자기 파일을 가리키게 된 인용을 문제 삼으면 린트 메시지가 요구하는 대로 경로 앵커를 맞춘다.

- [ ] **Step 3: 게이트 G → Commit**

`refactor(harness): make harness the single source of the conventions field contract`

### Task 3: `/spec` 산출물 이어받기(`carried_over`)를 없앤다

**Files:**
- Modify: `skills/harness/SKILL.md`(§Step 1 item 7, §Step 2.6 Skip-vs-run), `skills/harness-gate/SKILL.md`(게이트 행 표), `templates/harness/converge.md`, `templates/harness/state_schema.md`, `workflows/_reference/state_fields.md`

- [ ] **Step 1: 현재 지점을 센다**

Run: `git grep -c "carried_over" -- skills templates workflows`
Expected: harness 2, harness-gate 3, converge.md 1, state_schema.md 1, state_fields.md 1.

- [ ] **Step 2: 쓰는 쪽을 지운다**

`carried_over`는 `plan_critic.source`의 값이다. `skills/harness/SKILL.md` §Step 2.6 Skip-vs-run에서 "`critic_findings.md`가 이미 있으면 건너뛴다" 분기를 지운다. 그 파일이 있어도 계획 검토는 평소대로 돈다. 이 삭제로 부록 A의 K12가 함께 사라진다.

- [ ] **Step 3: 읽는 쪽은 표를 다시 짜지 않고 좁힌다**

`skills/harness-gate/SKILL.md`의 State-Space Derivation은 `plan_critic.applied`의 4값 위에 서 있고 행 ③은 `applied == "skipped"` 전체를 받는다. 이 구조와 7행은 그대로 둔다. 행 ③의 조건에서 `source ∈ {…}` 절을 빼고 `applied == "skipped"`만 남긴다. 표시 문구는 `source == "fast"`이면 지금의 `skipped by --fast`, 그 밖의 값이면 `critic skipped`다. 선택지 집합과 `C=? M=?`는 그대로다. "TWO writers" 서술은 writer 하나(`--fast`)로 고치고, 행 이름 "carried-over or --fast"는 "skipped"로 바꾼다. `skills/harness/SKILL.md` §Approval Gate의 `Critic:` 줄과 `templates/harness/converge.md`의 해당 문장도 같은 규칙으로 맞춘다. `state_schema.md`와 `state_fields.md`의 `source` 값 목록에서 `"carried_over"`를 지운다.

- [ ] **Step 4: 옛 값이 어디로 가는지 확인한다**

v9 이전에 쓰인 state의 `source == "carried_over"`는 Step 3의 "그 밖의 값"에 걸려 행 ③으로 가고, 사용자는 거기서 `Run Critic anyway`를 고를 수 있다. 따로 호환 문장을 두지 않는다.
Run: `git grep -n "carried_over\|carried over" -- skills templates workflows`
Expected: 출력 없음.

- [ ] **Step 5: 게이트 G → Commit**

`hx-*` BLOCK 그룹을 건드렸다면 `verify_block_sync.py`가 알려 준다. 세 파일의 사본을 같이 고친다.
`refactor(harness,harness-gate): drop the spec carry-over path`

### Task 4: 삭제 스킬로 가는 위임을 끊는다

**Files:**
- Modify: `templates/harness/doctor.md`, `skills/harness/SKILL.md` §Sub-command: doctor(점검 개수 서술), `skills/deep-review/SKILL.md` §Step 4.5, `skills/md-optimize/SKILL.md` §1b, `skills/handoff/SKILL.md`, `templates/generator/auto_fix_proposer.md`

- [ ] **Step 1: doctor**

`skills/team-memory/SKILL.md` §Step 1.5 item 1의 ignore 판정 규칙을 `doctor.md`의 해당 문단에 직접 옮겨 적고 위임 문장을 지운다. 점검 ⑤(team-memory 저장소 ignore 상태)는 점검 자체를 지우고 번호와 개수 서술을 맞춘다.

- [ ] **Step 2: deep-review**

§Step 4.5 Size guard의 "`/spec digest`와 같은 방식"을 `skills/spec/SKILL.md` §Sub-command: digest의 표본 추출 규칙 본문으로 바꾼다. 다른 파일을 가리키는 문장을 남기지 않는다.

- [ ] **Step 3: md-optimize**

§1b 상태 표의 첫 행(".md 파일이 하나도 없음")은 질문 없이 멈추게 한다 — 최적화할 대상이 없으므로 `Continue`가 뜻이 없다. 멈출 때 "CLAUDE.md를 먼저 만들 것(내장 `/init`)"을 한 줄로 알린다. 나머지 세 행은 질문을 유지하되 권고 문구 "Generate instead" / "Generate then optimize"를 "Create CLAUDE.md first"로 바꾸고, 첫 선택지를 label `Stop` / description `Create CLAUDE.md first (the built-in /init does this), then re-run /md-optimize`로 바꾼다. 선택 시 동작 문장도 같은 뜻으로 고친다. 두 번째 선택지 `Continue`는 그대로 둔다.

- [ ] **Step 4: handoff**

§Step 5 rule 5(`/migrate` 체이닝 금지)를 지우고 "rules 1, 4 and 5"를 "rules 1 and 4"로 고친다. §Non-Goals의 `/migrate` 서술은 이 한 문장으로 줄인다: `WebSearch and WebFetch stay blocked for this skill, and a command chained from resume inherits that block for the rest of the turn.` rule 1의 부정 예시 `/ship`은 `/harness-build`로 바꾼다. 머리말의 `/team-memory`와 Slice 열 규칙의 `/spec` 언급을 지운다.

- [ ] **Step 5: auto_fix_proposer**

첫 줄의 `Sync with templates/refactor/…` 주석을 지운다.

- [ ] **Step 6: 확인한다**

Run: `export MSYS_NO_PATHCONV=1; git grep -n -E "team-memory|/spec|/migrate|/ship|md-generate|templates/refactor" -- templates/harness/doctor.md skills/deep-review skills/md-optimize skills/handoff templates/generator/auto_fix_proposer.md`
Expected: 출력 없음.

- [ ] **Step 7: 게이트 G → Commit**

`refactor(handoff,deep-review,md-optimize,harness): cut delegations to skills being removed`

## B. 손실 경로 차단

### Task 5: 자동 수정 스냅샷을 바이트 사본으로 바꾼다 (K1)

**Files:**
- Modify: `skills/harness-build/SKILL.md` §Step 5 "If Apply patch", §Auto-fix State Transition Table(스냅샷 서술이 있으면)

- [ ] **Step 1: "If Apply patch"의 1번과 3번을 다시 쓴다**

git 유무와 관계없이 같은 절차다.
1번: 패치가 건드리는 경로마다 현재 바이트를 `.harness/autofix_pre_apply/<path>`에 복사하고, `.harness/autofix_pre_apply/manifest.txt`에 한 줄씩 `existing <path>` 또는 `absent <path>`(패치가 새로 만드는 파일)를 적는다.
3번(적용 또는 재검증 실패): `existing` 줄은 사본을 제자리로 되돌리고, `absent` 줄은 패치가 만든 파일을 지운 뒤 스냅샷 폴더를 지운다. 성공 경로에서는 재검증 통과 뒤 스냅샷 폴더를 지운다.

- [ ] **Step 2: 확인한다**

Run: `git grep -n "git stash" -- skills/harness-build`
Expected: 출력 없음.

- [ ] **Step 3: 게이트 G → Commit**

`fix(harness-build): snapshot auto-fix targets as byte copies instead of git stash`

### Task 6: 구현 에이전트의 빈 결과를 드러낸다 (W1)

**Files:**
- Modify: `workflows/harness.build.workflow.js`, `skills/harness-build/SKILL.md` §Step 4 — WORKFLOW path("On Workflow error" 항목과 반환 필드 읽기), `workflows/_reference/schemas.md`(harness.build 반환)
- Test: `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Produces: 반환값에 `stats: { planOk: boolean, advisorsSucceeded: number }` 추가. 오류 메시지 `harness.build: implementation returned null — partial edits possible`. 계획이 없을 때의 digest 라벨 `(plan unavailable)`.

- [ ] **Step 1: 알려진 실패에서 두 항목을 지우고 실패를 확인한다**

`known_failures.json`에서 `build-null-implementation`, `build-null-plan-label`을 지운다.
Run: `node tests/segment_stubs/run.mjs`
Expected: exit 1, 두 케이스가 FAIL.

- [ ] **Step 2: 스크립트를 고친다**

구현 에이전트 결과가 null이면 위 메시지로 throw한다(결과를 읽는 `log` 줄보다 앞). lead_developer 결과가 null이면 계획 digest 자리에 `(plan unavailable)`을 쓰고 `planOk`를 false로 둔다. 조언자 자리의 `(advisor unavailable)`은 그대로 둔다.

- [ ] **Step 3: 통과를 확인한다**

Run: `node tests/segment_stubs/run.mjs`
Expected: exit 0, `7 pass, 23 known-fail`.

- [ ] **Step 4: SKILL의 폴백 항목을 고친다**

오류 메시지에 `implementation returned null`이 들어 있으면 INLINE으로 바로 넘어가지 않는다. `has_git`이면 `git status --porcelain`으로 바뀐 경로를 보여 주고 질문한다 — header `Partial edits`, 선택지 `Continue inline`(현재 트리 위에서 generator_single을 실행하고, 일부 파일이 이미 편집됐을 수 있음을 프롬프트에 알린다) / `Stop`(`.harness/`를 남기고 경로 목록을 출력한다). 비대화 세션은 `Stop`이다. 그 밖의 오류는 지금의 폴백 그대로다. `stats.planOk == false`이면 "계획 없이 구현됨"을 한 줄로 알린다.

- [ ] **Step 5: 게이트 G → Commit**

`fix(harness-build): fail loudly when the implementation agent returns nothing`

### Task 7: md-optimize가 원본을 잃지 않게 한다 (W3, W4)

**Files:**
- Modify: `skills/md-optimize/SKILL.md`(Exclusion List, §1a, §Phase 3 머리말, Step 3d, §Phase 5, §Safety Rules)

- [ ] **Step 1: 백업 단계를 넣는다**

§Phase 3의 첫 단계로 `Step 3.0: Backup`을 둔다. Phase 3이 고치는 파일마다 바이트를 `.harness/md-optimize/backup/<path>`에 복사하고 `.harness/md-optimize/manifest.txt`에 `modified <path>`를 적는다. 새로 만드는 파일은 만들 때마다 `created <path>`를 덧붙인다. Exclusion List에 `.harness/`를 추가한다.

- [ ] **Step 2: 복구 안내를 바꾼다**

단계가 실패하면 manifest대로 복구한다 — `modified`는 사본을 되돌리고 `created`는 지운 뒤, 복구한 경로를 출력한다. `git checkout` 안내 두 곳(§Phase 3 머리말, §Safety Rules)을 이 절차로 바꾼다. 성공한 실행과 복구가 끝난 실행은 `.harness/md-optimize/`를 지운다. 복구 자체가 실패하면 폴더를 남기고 경로를 알린다.

- [ ] **Step 3: 중복 파일 삭제를 없앤다**

Step 3d의 제목을 `Report Duplicates`로 바꾸고 삭제와 참조 갱신을 지운다. 해시가 같은 파일 묶음을 Phase 5 보고에만 싣는다. 보고의 `Files deleted` 줄은 `Duplicates reported : N group(s) (not deleted)`로 바꾼다. Phase 2 게이트의 중복 목록 설명에서 "merge/remove"를 "report only"로 고친다.

- [ ] **Step 4: 확인한다**

Run: `git grep -n -E "git checkout|Delete exact-duplicate" -- skills/md-optimize`
Expected: 출력 없음. git 저장소가 아닌 폴더에서도 Step 3.0이 같은 경로를 쓰는지 본문을 읽어 확인한다(git 명령에 기대는 문장이 없어야 한다). 실행 시험은 Task 16에서 한다.

- [ ] **Step 5: 게이트 G → Commit**

`fix(md-optimize): back up before editing and stop deleting duplicate files`

### Task 8: deep-review `--fix`를 리뷰한 리비전에 묶는다 (W5)

**Files:**
- Modify: `skills/deep-review/SKILL.md` §Step 1, §Step 7

- [ ] **Step 1: §Step 1에 `reviewed_sha` 기록을 넣는다**

PR 대상은 `gh pr view <n> --json headRefOid`의 값, 브랜치나 커밋 범위 대상은 `git rev-parse <tip>`, 작업 트리·`--staged`·파일 경로 대상은 `git rev-parse HEAD`다. git 저장소가 아니면 `null`이다.

- [ ] **Step 2: §Step 7의 진입 조건을 넣는다**

`reviewed_sha`가 `null`이 아니고 `git rev-parse HEAD`와 다르면 Step 7을 건너뛰고 이렇게 알린다(`user_lang`으로): `--fix skipped: the reviewed revision <sha7> is not the checked-out HEAD <sha7>. Check out the reviewed revision and re-run.` 기존의 "코드가 일치하지 않으면 건너뜀" 규칙은 그 뒤의 둘째 방어선으로 남긴다.

- [ ] **Step 3: 게이트 G → Commit**

`fix(deep-review): refuse --fix when HEAD is not the reviewed revision`

### Task 9: 키워드 스킬 검색 지시를 지우고 harness-gate 설명을 살린다 (W14, K14)

**Files:**
- Modify: `templates/generator/generator_single.md`, `templates/generator/implementation.md`, `templates/generator/implementation_standard.md`, `templates/evaluator/evaluator_prompt.md`, `templates/planner/planner_single.md`, `workflows/harness.build.workflow.js`, `workflows/harness.eval.workflow.js`, `skills/harness-gate/SKILL.md`(frontmatter)

- [ ] **Step 1: 지시 문장을 지운다**

"search installed skills …"로 시작하는 문장을 모두 지운다. 같은 줄에 남길 내용이 있으면 그 부분만 남긴다(예: `planner_single.md`의 "Think broadly first — …"는 검색 절만 뺀다). 템플릿과 스크립트 안의 사본을 같은 글자로 맞춘다.

- [ ] **Step 2: 확인한다**

Run: `git grep -n -i "installed skills" -- templates/planner templates/generator templates/evaluator templates/verify templates/harness templates/deep-review templates/_shared workflows/harness.*.js workflows/deep-review.review.workflow.js`
Expected: 출력 없음.

- [ ] **Step 3: harness-gate의 `description:` 값을 큰따옴표로 감싼다**

값 안에 큰따옴표가 있으면 작은따옴표로 감싼다. 글자는 바꾸지 않는다.

- [ ] **Step 4: 게이트 G → Commit**

`verify_description_budget.py`는 따옴표를 뺀 길이를 재므로 상한은 그대로다.
`fix(harness,harness-gate): drop keyword skill lookup from sub-agent prompts; quote the gate description`

## C. 삭제

### Task 10: 13개 디렉터리와 그 자산을 지우고 린트 고정값을 맞춘다

**Files:**
- Delete: `skills/{spec,refactor,migrate,test-gen,study,team-memory,codebase-audit,md-generate,debug,ship,code-review,memory,workflow}/`
- Delete: `workflows/{codebase-audit.analysis,debug.analyze,migrate.analyze,migrate.eval,refactor.eval,refactor.plan,spec.plan,study.analyze,test-gen.analyze,test-gen.judge}.workflow.js` (10개)
- Delete: `templates/{codebase-audit,debug,migrate,refactor,ship,spec,study,test-gen}/`, `templates/_shared/falsification_rules.md`, `workflows/_reference/study_measurements.md`
- Modify: `scripts/verify_sync_markers.py`, `scripts/verify_description_budget.py`, `tests/segment_stubs/run.mjs`

- [ ] **Step 1: 지우기 전에 옮길 것이 남았는지 확인한다**

Run: `git grep -l -E "templates/(spec|debug|refactor|migrate|ship|study|test-gen|codebase-audit)/|skills/(spec|team-memory|migrate)/SKILL" -- skills/handoff skills/harness skills/harness-gate skills/harness-build skills/deep-review skills/md-optimize templates/harness templates/planner templates/generator templates/evaluator templates/verify templates/deep-review workflows/harness.*.js workflows/deep-review.review.workflow.js`
Expected: 출력 없음. 출력이 있으면 Task 1~4로 돌아간다.

- [ ] **Step 2: `git rm -r`로 지운다**

- [ ] **Step 3: `verify_sync_markers.py`의 고정값을 맞춘다**

| 그룹 | 이전 → 이후 |
|---|---|
| `ambiguity-prompt` | 10 → 2 (harness, deep-review) |
| `project-defaults` | 9 → 2 (harness, deep-review) |
| `adhoc-dispatch` | 13 → 4 (harness, harness-build, deep-review, md-optimize) |
| `session-conflict` | 7 → 1 (`templates/_shared/session_recovery.md`) |
| `conventions-field-contract` | 3 → 1 (harness 자신) |
| `plan-critic-contract` | 3 → 2 (`plan_critic_dispatch.md`, 스크립트 자신) |

`SECTION_REF_TARGETS`에서 `study_measurements.md` 항목을 지운다. `min_cross_files` 세 값은 린트가 출력하는 실측값으로 다시 고정한다. 그룹 주석의 옛 내역은 지우지 말고 같은 주석 안에 "v9 1단계: 13개 삭제로 N → M"을 덧붙인다. `conventions-field-contract`와 `session-conflict` 주석에는 마커가 1곳뿐이라 이제 토큰 존재 검사일 뿐임을 적는다.

- [ ] **Step 4: `verify_description_budget.py`에서 삭제 스킬의 항목을 지운다**

`PER_SKILL_CEILING`, 하한 표, 필수·금지 토큰 표, 3인칭 허용 목록에서 13개 이름의 항목을 지운다. `TOTAL_CEILING`은 남은 6개의 실측 합으로 내린다.

- [ ] **Step 5: `run.mjs`가 대표 케이스 없는 스크립트의 이름을 출력하게 한다**

요약 줄 앞에 `uncovered`가 비어 있지 않으면 `UNCOVERED  <name>`을 한 줄씩 출력한다. 종료 코드는 바꾸지 않는다.

- [ ] **Step 6: 고아 템플릿을 센다**

남은 `templates/**/*.md` 각각에 대해 파일 이름이 `skills/`, `templates/`, `workflows/` 어디에서도 인용되지 않는 것을 찾아 지운다. 지운 파일을 커밋 메시지에 적는다. 0건이면 0건이라고 적는다.

- [ ] **Step 7: 게이트 G를 돌린다**

Expected: 린트 exit 0. 스텁 테스트 마지막 줄 `7 pass, 23 known-fail, 0 fail, 0 fixed, 0 stale, 0 error; 0 script(s) without a representative case`. `ls skills | wc -l`은 6, `ls workflows/*.workflow.js | wc -l`은 5.

- [ ] **Step 8: Commit**

`feat!: remove 13 skill directories (v9 subtraction)` — 본문에 삭제 목록, 고정값의 이전 → 이후, "v8.14.0 태그에 보존됨"을 적는다.

### Task 11: 남은 파일에서 삭제된 스킬의 서술을 정리한다

**Files:**
- Modify: `templates/_shared/{slugify,session_conflict,mode_gate,segment_launch,status_format,path_validator,project_defaults,safety_guard,session_recovery,askuserquestion,architecture_principles}.md`, `templates/harness/{auto_revise,converge,plan_critic_dispatch,state_schema}.md`, `workflows/_reference/{schemas,state_fields}.md`, `workflows/harness.plan.workflow.js`·`workflows/harness.critic.workflow.js`(주석), `skills/{harness,harness-gate,md-optimize,deep-review}/SKILL.md`, `.github/ISSUE_TEMPLATE/*.yml`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CLAUDE.md`, `README.md`, `.gitattributes`

- [ ] **Step 1: 검사 C1을 돌려 현재 건수를 본다**

```bash
export MSYS_NO_PATHCONV=1
git grep -n -E '(^|[^A-Za-z0-9_./-])/(spec|refactor|migrate|test-gen|study|team-memory|codebase-audit|md-generate|debug|ship|memory|workflow)([^A-Za-z0-9_/.-]|$)' -- . ':!CHANGELOG.md' ':!ROADMAP.md' ':!design'
git grep -n -E '(skills|templates)/(spec|refactor|migrate|test-gen|study|team-memory|codebase-audit|md-generate|debug|ship|code-review|memory|workflow)/|workflows/(spec|refactor|migrate|test-gen|study|codebase-audit|debug)\.' -- . ':!CHANGELOG.md' ':!ROADMAP.md' ':!design'
```

`/code-review`는 검사에 넣지 않는다. 내장 명령의 이름이고 deep-review가 그것을 가리킨다.

- [ ] **Step 2: 템플릿·레퍼런스·스킬 본문을 고친다**

삭제된 스킬을 예로 들거나 전제하는 문장을 지우거나 남은 스킬의 예로 바꾼다. `schemas.md`와 `state_fields.md`에서는 삭제된 세그먼트의 스키마 절을 통째로 지운다. 실행 규칙의 뜻은 바꾸지 않는다.

- [ ] **Step 3: 매니페스트를 고친다**

두 파일의 `description`을 이 글로 맞춘다: `Plan → Generate → Verify → Evaluate harness with human approval gates and 3-layer review (/harness, /harness-gate, /harness-build), session handoff (/handoff), deep code review (/deep-review), and markdown optimization for Claude Code (/md-optimize). Multi-agent paths are opt-in native Workflow segments; the default path runs inline.` `keywords`는 `["harness", "deep-review", "md-optimize", "handoff", "session-continuity", "planner", "generator", "evaluator", "multi-agent", "model-tiering", "token-efficiency"]`로 한다. 버전은 Task 15에서 올린다.

- [ ] **Step 4: `CLAUDE.md`를 고친다**

스킬 수 19 → 6, Architecture 표의 삭제된 행, "runtime output of 13 skills", 폐기 스텁 문단, team-memory 충돌 항목, Mode Gate 문단의 `min_sites` 값(2와 2), `study_measurements.md`를 다루는 `anchor-heading` 서술, "Run all six"(→ "Run the whole chain")를 고친다.

- [ ] **Step 5: `README.md`에서 삭제된 스킬을 덜어낸다**

`## refactor`, `## migrate`, `## debug`, `## spec`, `## test-gen`, `## team-memory`, `## codebase-audit`, `## md-generate`, `## ship`, `## study` 절과 `### Deprecation` 소절을 지운다. `## Skills` 표, `### Skill Naming & Built-in Command Relationship` 표, `### Repository Layout`("Seven top-level directories" 포함), Quick Start, Plugin Compatibility에서 삭제된 스킬의 행과 문장을 지운다. 300줄 이하로 다시 쓰는 일은 6단계다. 여기서는 틀린 내용만 없앤다.

- [ ] **Step 6: `.gitattributes`에 한 줄을 넣는다**

`tests/**/*.mjs text eol=lf`. 주석의 스킬 나열(`harness / spec / debug / …`)은 `harness / deep-review`로 고친다.

- [ ] **Step 7: 검사 C1이 0건인지 확인하고 게이트 G를 돌린다**

Expected: 두 명령 모두 출력 없음. `verify_manifest_sync.py` exit 0.

- [ ] **Step 8: Commit**

`docs: remove references to the deleted skills from the remaining files`

## D. 린트

### Task 12: git 안전 린트

**Files:**
- Create: `scripts/verify_git_safety.py`
- Modify: `.github/workflows/lint.yml`, `CLAUDE.md`(Commands 표, `lint-cmd` 줄, Verification 절, "6 self-consistency lints" → 8)

**Interfaces:**
- Produces: `python scripts/verify_git_safety.py` — exit 0 통과, 1 위반, 2 스캔 대상 폴더 없음.

- [ ] **Step 1: 스크립트를 쓴다**

`skills/`, `templates/`, `workflows/`의 `.md`·`.js`를 줄 단위로 읽는다. 금지 패턴은 네 개다: `git checkout -- `, `git stash(?!\s+(?:push|pop|apply|list|show|drop)\b)`, `reset --hard`, `clean -f`. 허용 목록은 `{(파일, 줄에 들어 있는 글자): 이유}` 사전이고 항목은 하나다 — `("skills/handoff/SKILL.md", "git clean -fdx")`: 무시된 handoff 문서가 무엇에 지워지는지 사용자에게 알리는 경고이지 지시가 아니다. 쓰이지 않은 허용 항목은 위반으로 본다. 위반은 `파일:줄: 패턴 이름`으로 출력한다. 표준 라이브러리만 쓴다.

- [ ] **Step 2: 통과와 검출을 확인한다**

Run: `python scripts/verify_git_safety.py` → Expected: exit 0.
그 다음 `templates/_shared/_probe.md`에 `` Run `git stash` first. `` 한 줄을 써 넣고 다시 실행한다 → Expected: exit 1, 그 파일과 `bare git stash`가 출력된다. 프로브 파일을 지운다.

- [ ] **Step 3: 배선한다**

`lint.yml`에 `- run: python3 scripts/verify_git_safety.py` 한 줄을 넣고, `CLAUDE.md`의 표와 `lint-cmd` 체인에 추가한다.
Run: `bash .github/scripts/check_lint_wiring.sh` → Expected: exit 0.

- [ ] **Step 4: `git ls-files --eol scripts/verify_git_safety.py`가 `i/lf`인지 확인하고 게이트 G → Commit**

`feat(lint): forbid destructive git commands in contracts and templates`

### Task 13: 인용 경로 실재 린트

**Files:**
- Create: `scripts/verify_cited_paths.py`
- Modify: `.github/workflows/lint.yml`, `CLAUDE.md`

**Interfaces:**
- Produces: `python scripts/verify_cited_paths.py` — exit 0 통과, 1 없는 경로 인용, 2 스캔 대상 없음.

- [ ] **Step 1: 스크립트를 쓴다**

스캔 대상은 `skills/**/*.md`, `templates/**/*.md`, `workflows/**/*.js`, `workflows/**/*.md`, `CLAUDE.md`, `README.md`다. 정규식 `(?:skills|templates|workflows|scripts)/[A-Za-z0-9_./-]+\.(?:md|js|mjs|py|json)`에 걸린 토큰마다 저장소 루트 기준으로 파일이 있는지 본다. `<`, `{`, `*`가 든 자리표시 경로는 이 문자 집합에 걸리지 않아 자연히 빠진다. 허용 목록은 `{(인용한 파일, 경로): 이유}` 사전이고 빈 채로 시작한다. 쓰이지 않은 허용 항목은 위반이다. 없는 경로는 `파일:줄: 경로`로 출력한다.

- [ ] **Step 2: 통과와 검출을 확인한다**

Run: `python scripts/verify_cited_paths.py` → Expected: exit 0. 1이면 출력된 인용을 고친다(허용 목록에 넣는 것은 일부러 든 반례일 때뿐이고 이유를 적는다).
그 다음 `templates/_shared/_probe.md`에 `` `templates/spec/critic.md` `` 한 줄을 써 넣고 다시 실행한다 → Expected: exit 1. 프로브 파일을 지운다.

- [ ] **Step 3: 배선하고(Task 12 Step 3과 같은 세 곳) 게이트 G → Commit**

`feat(lint): require every cited template, workflow and script path to exist`

### Task 14: 설명 절단 검사와 예산 상한 고정

**Files:**
- Modify: `scripts/verify_description_budget.py`

- [ ] **Step 1: 절단 검사를 넣는다**

frontmatter의 `description:` 원문 줄이 따옴표로 감싸이지 않았고 ` #`(공백 뒤 샵)을 포함하면 위반이다. 메시지: `<skill>: unquoted description contains ' #' — YAML truncates it there; quote the value`.

- [ ] **Step 2: 검출을 확인한다**

`skills/harness-gate/SKILL.md`의 따옴표를 잠깐 벗기고 실행 → Expected: exit 1, 위 메시지. 따옴표를 되돌리고 실행 → Expected: exit 0.

- [ ] **Step 3: 상한을 실측값으로 내린다**

린트가 출력하는 스킬별 길이로 `PER_SKILL_CEILING` 6개와 `TOTAL_CEILING`을 여유 0으로 맞춘다.

- [ ] **Step 4: 게이트 G → Commit**

`feat(lint): catch YAML-truncated descriptions; pin budgets to the six kept skills`

### Task 14.5: 브랜치 독립 리뷰

- [ ] **Step 1: 리뷰어 1명에게 `5e6209e..HEAD`의 diff를 맡긴다**

구현한 세션의 설명 없이 diff와 `SPEC.md` 5절 1단계만 준다. 볼 것은 린트가 못 잡는 것이다: Task 3(게이트 표가 여전히 모든 경우를 덮는가), Task 4(옮겨 적은 규칙이 원문과 같은 뜻인가, doctor 점검 삭제가 다른 점검을 깨지 않는가), Task 5~8(새 절차가 기존 HARD-GATE·재시도 상한 서술과 모순되지 않는가), Task 10(유지 스킬이 읽는 파일이 지워지지 않았는가).

- [ ] **Step 2: Critical·Important를 고치고 게이트 G → Commit**

고치지 않기로 한 지적은 이유와 함께 `BASELINE.md`의 "1단계 후" 절에 적는다. 판정이 "수정 후 병합"보다 나쁘면 Task 15로 가지 않는다.

## E. 릴리스

### Task 15: 릴리스 문서와 버전

**Files:**
- Create: `RELEASING.md`
- Modify: `CHANGELOG.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `design/v9-subtraction/BASELINE.md`, `design/v9-subtraction/SPEC.md`(상태 줄)

- [ ] **Step 1: `RELEASING.md`를 쓴다**

삭제된 릴리스 스킬을 대신하는 점검표다. 항목과 순서: 게이트 G 통과 → 버전 3곳(`plugin.json` `$.version`, `marketplace.json` `$.metadata.version`, `$.plugins[*].version`) → CHANGELOG 절 → 커밋 → `main`에 `--no-ff` 병합 → 태그 `vX.Y.Z` → 푸시 → GitHub 릴리스 → 설치본 두 곳 교체와 프로세스 재시작 → 스킬 목록에서 버전과 설명 확인. 병합부터는 항목마다 "사용자 확인 뒤"라고 적는다. 삭제된 스킬 이름을 슬래시 토큰으로 쓰지 않는다(검사 C1).

- [ ] **Step 2: CHANGELOG에 `## [9.0.0]` 절을 만든다**

`[Unreleased]`의 converge 내용을 이 절 아래로 옮기고(원문은 고치지 않는다), 1단계의 변경(Removed / Fixed / Changed)을 적는다. 이전 안내표를 넣는다 — 13개 이름이 모두 있어야 한다.

| 삭제된 것 | 대신 쓸 것 |
|---|---|
| spec | `/harness`의 계획 단계. 예전 동작이 필요하면 `v8.14.0` 태그 |
| md-generate | 내장 `/init` |
| code-review (스텁) | `/deep-review` 또는 내장 `/code-review` |
| workflow (스텁) | `/harness` |
| memory (스텁) | 내장 자동 메모리 |
| refactor, migrate, test-gen, debug, study, codebase-audit, team-memory, ship | 후속 없음. `v8.14.0` 태그에 보존 |

`carried_over` 폐기, `spec.eval` → `harness.critic` 이름 변경, md-optimize의 중복 삭제 기능 제거를 Changed에 적는다.

- [ ] **Step 3: 버전 3곳을 `9.0.0`으로 올린다**

Run: `python scripts/verify_manifest_sync.py` → Expected: exit 0.

- [ ] **Step 4: 기준선을 다시 잰다**

이 커밋 직전의 HEAD에서 `git ls-tree -r -l HEAD -- skills workflows templates`로 재서 `BASELINE.md`에 `## 1단계 후 (v9.0.0)` 절을 덧붙인다: 스킬별 바이트, 워크플로·템플릿 합계, SYNC 그룹과 `min_sites`, 스텁 테스트 요약 줄. 기존 표는 고치지 않는다. `SPEC.md`의 상태 줄을 "1단계 구현 완료, 릴리스 확인 대기"로 고친다.

- [ ] **Step 5: 검사 C1과 게이트 G → Commit → 브랜치 푸시**

`chore(release): v9.0.0`

### Task 16: 실사용 검증과 릴리스 (사용자 확인이 필요한 단계)

각 Step 앞에서 사용자에게 확인을 받는다. 확인 없이 진행하지 않는다.

- [ ] **Step 1: 설치본 두 곳을 이 브랜치 내용으로 교체하고 프로세스를 재시작한다** (확인 필요)

스킬 목록에 스킬 6개와 세그먼트 5개만 나오고, harness-gate 설명이 끝까지 보이는지 확인한다(K14, K7의 "설치본 버전 = 매니페스트").

- [ ] **Step 2: `/harness`를 작은 과제 하나로 완주한다**

계획 → 계획 검토 INLINE 1회 → 승인 → 구현 → 평가. 과제는 이 저장소의 문서 한 줄 수정처럼 되돌리기 쉬운 것으로 한다.

- [ ] **Step 3: 계획 검토를 WORKFLOW 경로로 1회 돌린다**

시작 전에 `.harness/wf/spec.eval.workflow.js`라는 빈 파일을 만들어 둔다. `.harness/wf/harness.critic.workflow.js`가 복사돼 실행되고 옛 이름 파일은 읽히지 않아야 한다.

- [ ] **Step 4: `/handoff generate`와 `/handoff resume`을 각 1회 돌린다**

- [ ] **Step 5: md-optimize 복구를 시험한다**

임시 git 저장소에 커밋하지 않은 `.md` 두 개를 두고 실행해 Phase 3 도중 중단시킨다. 두 파일이 실행 전 바이트로 돌아와야 한다(`sha256sum` 비교). git 저장소가 아닌 폴더에서 한 번 더 한다.

- [ ] **Step 6: deep-review `--fix` 거부를 시험한다**

현재 브랜치가 아닌 브랜치를 대상으로 `--fix`를 붙여 실행한다. Step 7이 건너뛰어지고 거부 메시지가 나와야 한다.

- [ ] **Step 7: 결과를 `BASELINE.md`의 "1단계 후" 절에 적고 커밋한다**

Step 2~6 각각의 통과 여부와 관측한 것을 한 줄씩 적는다. 실패한 것이 있으면 릴리스하지 않고 해당 Task로 돌아간다.

- [ ] **Step 8: `RELEASING.md`대로 `main` 병합, 태그 `v9.0.0`, GitHub 릴리스** (각각 확인 필요)

## 완료 기준과 Task 대응 (SPEC 1.4)

| 기준 | 확인하는 곳 |
|---|---|
| 삭제된 경로와 슬래시 토큰 0건 | Task 11 Step 7, Task 15 Step 5 (검사 C1) |
| 인용 경로 실재, 린트로 고정 | Task 13 |
| 린트 전체 통과, 예산 상한 = 실측값 | Task 14, 게이트 G |
| 실사용 검증 | Task 16 Step 2~6 |
| CHANGELOG 이전 안내표, 버전 3곳, 설명·키워드 | Task 15 Step 2~3, Task 11 Step 3 |
| 1.2의 8건 (K1, 안전 린트, W1, W3·W4, W5, W14, K14, K7) | Task 5, 12, 6, 7, 8, 9, 9·14, 15·16 |
