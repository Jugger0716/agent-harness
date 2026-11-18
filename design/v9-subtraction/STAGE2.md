# v9 2단계 (v9.0.1: 정확성 수정 묶음) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workflow 세그먼트 5개의 치환·인자·빈 반환·판정 결함과 harness 종료·재개 경계의 결함 2건을 고치고, 1단계가 넘긴 항목을 닫아 v9.0.1로 릴리스한다.

**Architecture:** 스텁 테스트를 먼저 쓰고 스크립트를 고친다. 다섯 스크립트가 공유하는 조각(한 번 훑는 치환, 필수 인자 검사, 빈 반환 가드)은 바이트가 같은 BLOCK 하나로 두고 기존 `verify_block_sync.py`가 지킨다. 계약 문서의 수정은 스크립트 뒤에 오고, 독립 리뷰와 실사용 검증을 거쳐 릴리스한다.

**Tech Stack:** Markdown 계약 문서, 엔진 호스팅 JavaScript(Workflow 세그먼트), Python 3 표준 라이브러리(린트), Node.js(스텁 테스트·문법 검사).

**Spec:** `design/v9-subtraction/SPEC.md` 5절 2단계 표, 부록 A(W2, W6, W9, W15~W18, K2, K3). 넘겨받은 항목의 정본은 `design/v9-subtraction/BASELINE.md`의 "브랜치 리뷰"(m4, m6, m9, m10), "실사용에서 드러난 것"(r7, r9), "릴리스 전 리뷰"(p4, p9, p11, 명명된 예외 ②).

## Global Constraints

- 작업 브랜치는 `harness/v9-stage2`, 기준은 `develop`(`5a7b47e`, 태그 `v9.0.0`)이다. `main`에 직접 커밋하지 않는다.
- **게이트 G** (모든 커밋 직전): `CLAUDE.md`의 `agent-harness-defaults: lint-cmd=` 줄에 적힌 체인이 exit 0이고, `node tests/segment_stubs/run.mjs`가 exit 0이다.
- 커밋하기 전에 `git config --get user.email`이 noreply 주소인지 확인한다. amend와 force push를 하지 않는다. 태그 `v9.0.0`을 옮기지 않는다.
- `main` 병합, 태그, GitHub 릴리스, `develop` 푸시, 설치본 교체, 로컬 브랜치·백업 삭제는 단계마다 사용자 확인을 새로 받는다. 브랜치 푸시는 Task 15에서 처음 한다.
- 공개 저장소다. 커밋하는 문서에 사내 저장소·프로젝트 이름, 사람 이름·계정명, 내부 경로를 쓰지 않는다. `docs/` 인용에는 `(gitignored — not a public link)`를 붙인다.
- 스텁 테스트의 `check`를 약하게 고치지 않는다. 결함을 고치면 같은 커밋에서 `known_failures.json`의 항목을 지운다. 예상 밖 실패를 목록에 넣지 않는다. 새 케이스는 목록에 넣지 않고 FAIL(exit 1)을 먼저 본다. 이 단계가 끝나면 목록에는 `review-dropped-findings`(W7, 4단계) 하나만 남는다.
- `*.workflow.js`는 LF를 유지한다. `.py` 파일은 커밋 전에 `git ls-files --eol`로 `i/lf`를 확인한다.
- 스크립트 규칙(`CLAUDE.md` §Workflow scripts): `String.replace`, `Date.now`, `new Date`, `Math.random`을 쓰지 않는다. 게이트 토큰을 스크립트에 쓰지 않는다. 스크립트는 서로 import하지 않는다.
- 인용은 `§절 이름`으로 한다. 행 번호를 커밋 문서에 쓰지 않는다. 결함별 위치는 `docs/harness/v9-audit/02`, `03` 보고서(gitignored — not a public link)의 같은 번호를 보되 고치기 전에 현재 트리에서 다시 읽는다.
- BLOCK 내용을 바꾸면 그 그룹의 모든 사본을 한 커밋에서 고치고 버전을 올린다. `min_sites`는 실측값에 여유 0이다.
- 크기는 `git ls-tree -r -l <commit>`의 blob 바이트로만 잰다.
- Git Bash에서 `/`로 시작하는 정규식을 넘길 때는 `export MSYS_NO_PATHCONV=1`을 먼저 실행한다.
- 계약 문장을 고친 커밋은 리뷰 없이 릴리스하지 않는다(Task 15). 리뷰는 배치당 리뷰어 1명이다.

## 범위 밖 (이 계획이 하지 않는 것)

| 항목 | 이유 |
|---|---|
| W7 `droppedFindings` | 4단계. `known_failures.json`에 남는다 |
| 감사 보고서 03의 개선 여지 3·5·6 (입력 신뢰 블록 일관화, planFiles 경로 거르기, md-optimize 키워드 안전망) | SPEC 2단계 표에 없다 |
| md-optimize 대상 폴더 인자(r9) | 인자를 추가하지 않고 "CWD에서만 동작한다"를 계약에 적는다(Task 12) |
| `known_failures.json`에 기대 이유 기록(1단계가 넘긴 Minor) | 항목이 1건만 남는다 |
| `harness.eval`의 `onlyL1` PASS 경로 | 호출 지점이 모두 `onlyL1: false`다. 5단계 4번(쓰이지 않는 분기 삭제) |

## STAGE1 진행 기록에서 넘겨받은 것

1단계 실행 기록(`.superpowers/sdd/STAGE1/progress.md`, gitignore 대상)은 이 계획이 커밋된 뒤 지운다. 그 기록에만 있던 앞으로의 일은 다음과 같다.

| 내용 | 갈 곳 |
|---|---|
| 스텁 러너가 스크립트 파일 없음(ENOENT)을 W6의 "거부"로 세어 FIXED를 낸다 | 이 계획 Task 2 |
| md-optimize 백업을 `.harness/` 밖의 md-optimize 소유 폴더로 옮기고, `525b507`이 넣은 멈춤 두 곳을 없앤다 | 이 계획 Task 12 (멈춤 하나는 좁혀서 남긴다 — 그 Task의 "기록된 결정과 다른 점") |
| `525b507`은 독립 리뷰도 실사용 검증도 받지 않았다 | 이 계획 Task 15, Task 17 |
| handoff §Step 5 규칙 5는 지우지 않고 "웹이 필요한 스킬 일반"으로 넓혀 두었다 | 3단계 본문 감량에서 다시 본다 |
| `/harness` §Step 2의 Discovery Notes Injection이 여전히 `{docs_path}critic_findings.md`를 읽는다. harness-build §Step 8의 스테이징 목록에도 그 파일이 있다 | 5단계 (K17) |
| "Partial edits"의 "Stop"은 `phase == "generating"`을 남기고, 재개 표의 그 행은 Verify로 간다 | 5단계 (K16) |
| 자동 수정 적용 뒤 재검증이 Layer 1 FAIL이어도 패치를 자동으로 되돌리지 않는다. 사본은 Step 8까지 남는다 | 5단계 (Auto-fix 존폐와 함께) |

## Review Focus

1. **9.0.0이 쓴 state.json을 9.0.1로 재개**: `phase`가 없는 Setup 체크포인트, 그리고 커밋이 실패한 채 `phase == "completed"`인 세션 — 앞의 것은 `setup` 행으로 가고, 뒤의 것은 지금처럼 "No active session"으로 끝나되 그 사실을 CHANGELOG에 적는다. (Task 9 Step 5)
2. **9.0.0이 남긴 `.harness/md-optimize/` 백업**: 새 위치만 보면 그 백업은 보이지 않고, 같은 폴더의 `/harness` 세션이 끝나며 지운다 — `/md-optimize`는 옛 위치도 확인하고, `/harness`는 옛 위치에 한해 멈춤을 유지한다. (Task 12 Step 4)
3. **값 안의 플레이스홀더에 기대던 템플릿**: 여러 번 치환할 때는 값으로 들어간 조각 안의 `{key}`도 채워졌다 — 한 번 훑으면 남는다. 대표 인자 케이스 5개가 남은 플레이스홀더 0개를 확인한다. (Task 3 Step 5)
4. **공백뿐인 인자와 JSON 문자열 인자**: `diffContent: "  \n"`은 거부하고, 인자가 JSON 문자열로 와도 같은 검사가 돈다. (Task 4 Step 1)
5. **스키마 밖의 값을 돌려주는 평가자**: `layer: "L1"`, `PASS`인데 critical 항목 — 엔진의 스키마 검증이 걸러 준다고 가정하지 않고 스크립트가 정규화한다. (Task 6 Step 1)

---

## A. 준비

### Task 1: 1단계 검증 과제의 결과물 두 건을 가져온다 (m6, m4)

**Files:**
- Modify: `CLAUDE.md`, `scripts/verify_description_budget.py` (m6, 커밋 `d349a34`), `workflows/_reference/schemas.md`, `workflows/harness.plan.workflow.js` (m4, 커밋 `c653d8d`)

**Interfaces:**
- Produces: `harness.plan.workflow.js`의 머리말 주석이 바뀐다(코드는 그대로). Task 3이 같은 파일의 `render`를 고친다.

- [ ] **Step 1: 두 커밋이 현재 트리에 그대로 적용되는지 확인한다**

Run: `for c in d349a34 c653d8d; do git diff $c~1 $c | git apply --check - && echo ok; done`
Expected: `ok` 두 줄.

- [ ] **Step 2: 한 건씩 `git cherry-pick -n <sha>`로 가져와 새 커밋으로 만든다**

커밋을 그대로 옮기지 않는 이유: `d349a34`의 Co-Authored-By 줄이 실제 모델과 다르다. 제목은 원래 것을 쓴다 — `docs(lint,claude-md): correct verify_description_budget statements made stale by v9`, `docs(harness): name the removed plan segments by skill, not by file name`. 각 커밋 전에 게이트 G.

- [ ] **Step 3: BASELINE의 m4·m6 행에 정정을 덧붙인다**

"브랜치 리뷰" 표의 두 행 "갈 곳" 칸 끝에 `(2단계에서 반영)`을 붙인다. 행을 지우지 않는다. Task 16의 BASELINE 커밋에 함께 넣는다.

### Task 2: 스텁 러너가 스크립트 로드 실패를 "거부"로 세지 않게 한다

**Files:**
- Modify: `tests/segment_stubs/engine.mjs`

**Interfaces:**
- Produces: `run(name, args, agentImpl)`은 스크립트 파일을 읽지 못하면 reject한다(지금은 `{ error }`로 resolve). 러너는 그 케이스를 ERROR로 센다. 스크립트 본문이 던진 오류는 지금처럼 `{ error }`다.

- [ ] **Step 1: 실패를 재현한다**

Run: `git mv workflows/harness.critic.workflow.js workflows/x.js && node tests/segment_stubs/run.mjs | grep harness.critic; git mv workflows/x.js workflows/harness.critic.workflow.js`
Expected(수정 전): `empty-args-harness.critic` 등 W6 케이스가 `FIXED`로 나온다.

- [ ] **Step 2: `run`에서 `load(name)`을 `try` 밖으로 옮긴다**

머리말의 "Engine assumptions" 목록에 두 줄을 더한다: 이 스텁은 스키마를 강제하지 않으므로 케이스가 스키마 밖의 값을 돌려줄 수 있다(실제 엔진이 걸러 주는지는 가정하지 않는다). 스크립트 파일을 읽지 못하는 것은 케이스의 결과가 아니라 러너의 오류다.

- [ ] **Step 3: Step 1의 명령을 다시 돌린다**

Expected: `harness.critic` 케이스가 모두 `ERROR`, exit 1. 파일을 되돌린 뒤 게이트 G → `7 pass, 23 known-fail`.

- [ ] **Step 4: Commit**

`test(stubs): report an unreadable segment script as ERROR, not as a refusal`

---

## B. 세그먼트 스크립트

### Task 3: 치환을 한 번만 훑는 공통 조각으로 바꾼다 (W2)

**Files:**
- Modify: `workflows/harness.plan.workflow.js`, `workflows/harness.build.workflow.js`, `workflows/harness.eval.workflow.js`, `workflows/harness.critic.workflow.js`, `workflows/deep-review.review.workflow.js`, `scripts/verify_block_sync.py`, `CLAUDE.md`
- Test: `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Produces: BLOCK 그룹 `wf-prelude v1`. 다섯 스크립트의 `const A = …` 줄 바로 아래에 놓인다. 정의하는 이름은 셋이다 — `render(tpl, vars) -> string`, `requireArgs(segment, a, keys) -> void`(없거나 공백뿐이면 `Error('<segment>: missing required argument "<key>"')`), `must(segment, label, result) -> result`(falsy면 `Error('<segment>: <label> returned null')`). Task 4·5·6이 뒤의 둘을 호출한다.

- [ ] **Step 1: `verify_block_sync.py`에 그룹을 먼저 넣고 실패를 본다**

`WF_SCRIPTS`(다섯 경로)를 만들고 `GROUPS`에 `("wf-prelude", "v1", WF_SCRIPTS, None)`을 더한다. 독스트링의 Groups 목록에 한 줄을 더한다.
Run: `python scripts/verify_block_sync.py` → Expected: exit 2 (마커 없음).

- [ ] **Step 2: 다섯 스크립트의 기존 `render` 정의와 그 위 주석을 아래 블록으로 바꾼다**

블록은 다섯 파일에서 바이트가 같아야 하므로 그대로 넣는다. 마커는 JS 주석 안의 HTML 주석 형태다(린트의 마커 정규식이 그 형태를 읽는다).

```js
// <!-- BLOCK-START:wf-prelude v1 — shared by the five segment scripts; edit every copy in one commit and bump the version -->
// Single-pass substitution: the template is split on its {snake_case} tokens once, so a value
// that itself contains a {placeholder} is never scanned again. A token with no entry in `vars`
// is left as written.
const render = (tpl, vars) =>
  String(tpl)
    .split(/(\{[a-z][a-z0-9_]*\})/)
    .map((seg, i) => {
      if (i % 2 === 0) return seg
      const k = seg.slice(1, -1)
      if (!Object.hasOwn(vars, k)) return seg
      return vars[k] == null ? '' : String(vars[k])
    })
    .join('')
// Refuse to run without the payload the segment exists to process.
const requireArgs = (segment, a, keys) => {
  for (const k of keys) {
    const v = a[k]
    if (v == null || (typeof v === 'string' && v.trim() === '')) {
      throw new Error(`${segment}: missing required argument "${k}"`)
    }
  }
}
// A single agent() resolves to null when the user skips it or it ends in a terminal API error.
const must = (segment, label, result) => {
  if (!result) throw new Error(`${segment}: ${label} returned null`)
  return result
}
// <!-- BLOCK-END:wf-prelude v1 -->
```

- [ ] **Step 3: 순서에 기대던 주석을 정리한다**

"Structural keys first … payload LAST" 류의 주석은 더는 보호 수단이 아니다. 호출 지점마다 남은 그 주석을 지우거나 "순서는 의미가 없다"로 고친다. `harness.plan`의 합성 호출 위 긴 주석(`proposals.json`의 플레이스홀더 노출을 "열린 결정"으로 적은 문단)은 지우지 말고 끝에 커밋 날짜를 넣어 `Closed <YYYY-MM-DD>: render() is single-pass, so a placeholder inside a proposal is no longer substituted.`를 덧붙인다.

- [ ] **Step 4: `known_failures.json`에서 W2 세 항목을 지운다**

`plan-resubstitution`, `build-resubstitution`, `review-resubstitution`.

- [ ] **Step 5: 게이트 G**

Expected: `verify_block_sync.py`가 `OK [wf-prelude v1]: 5 copies match`. 스텁 `10 pass, 20 known-fail, 0 fail`. `rep-*` 다섯 케이스가 PASS여야 한다 — 하나라도 `unsubstituted:`를 내면 그 템플릿이 값 안의 플레이스홀더에 기대고 있던 것이므로, 그 값을 넣는 호출 지점에서 먼저 `render`로 풀어 넘기도록 고친다(블록은 건드리지 않는다).

- [ ] **Step 6: `CLAUDE.md`를 맞춘다**

§Workflow scripts의 "Substitute with `split`/`join` … structural keys first, user-influenced payload last" 항목을 "`render()`는 `wf-prelude` 블록의 한 번 훑는 구현 하나다. 직접 치환을 쓰지 않는다"로 고치고, §Verification의 `verify_block_sync.py` 항목에 `wf-prelude` 그룹을 더한다("`hx-*` 4개" 서술과 충돌하지 않게 그룹 수를 다시 센다).

- [ ] **Step 7: Commit**

`fix(workflows): make prompt substitution single-pass in every segment script (W2)`

### Task 4: 필수 인자를 검사하고 세그먼트 설명을 내부용으로 줄인다 (W6)

**Files:**
- Modify: 스크립트 5개, `scripts/verify_meta_literal.py`, `workflows/_reference/schemas.md`(인자 계약 서술이 있으면), `CLAUDE.md`
- Test: `tests/segment_stubs/cases.mjs`, `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Consumes: Task 3의 `requireArgs`.
- Produces: 스크립트별 필수 키 — `harness.plan`: `task` / `harness.build`: `specContent` / `harness.eval`: `specContent`, `verifyReportPath`, `qaReportPath` / `harness.critic`: `specContent`, `criticFindingsPath` / `deep-review.review`: `diffContent`.

- [ ] **Step 1: 케이스를 넓힌다**

`cases.mjs`의 `REQUIRED`를 위 표대로 배열로 바꾸고 키마다 `missing-<key>-<script>` 케이스를 만든다(기존 id 5개는 그대로 나온다). 두 가지를 더한다:

```js
{ id: 'blank-diffContent-deep-review.review', defect: 'W6', script: 'deep-review.review',
  check: async (e) => refusal(await e.run('deep-review.review', { ...REP['deep-review.review'], diffContent: '  \n' }, (p, o) => e.minimal(o.schema)), 'diffContent') },
{ id: 'string-args-harness.build', defect: 'W6', script: 'harness.build',
  check: async (e) => refusal(await e.run('harness.build', JSON.stringify(without(REP['harness.build'], 'specContent')), (p, o) => e.minimal(o.schema)), 'specContent') },
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node tests/segment_stubs/run.mjs`
Expected: exit 1. 새 케이스 5개(`missing-verifyReportPath-harness.eval`, `missing-qaReportPath-harness.eval`, `missing-criticFindingsPath-harness.critic`, 위 둘)가 FAIL.

- [ ] **Step 3: 각 스크립트의 블록 바로 아래에 호출 한 줄을 넣는다**

`requireArgs('<meta.name>', A, [<위 표의 키>])`. 첫 `phase(…)`보다 앞이어야 한다. `harness.critic`의 "a missing field is not an exception, it silently renders as ''" 주석과 `deep-review`의 같은 뜻의 주석은 필수 키에 대해 더는 사실이 아니므로 고친다.

- [ ] **Step 4: 호출 지점이 그 키를 모두 넘기는지 확인한다**

`skills/harness-build/SKILL.md` §Step 5의 `harness.eval` 호출 세 곳(본 호출, `skipL1: true`, 자동 수정 뒤 재검증)이 `verifyReportPath`와 `qaReportPath`를 넘기는지 읽는다. 본 호출의 인자 블록을 "그대로 쓰되 한 값만 바꾼다"고 적혀 있으면 충분하다. 빠진 곳이 있으면 그 문장에 인자를 더한다.

- [ ] **Step 5: `meta.description`을 내부용 한 줄로 바꾼다**

| 스크립트 | description |
|---|---|
| `harness.plan` | `INTERNAL — launched by /harness only. Plan segment: persona proposals in parallel, then synthesis into one structured spec object; modifies no file.` |
| `harness.build` | `INTERNAL — launched by /harness-build only. Build segment: implementation plan, advisory review, then one implementation pass that edits source files.` |
| `harness.eval` | `INTERNAL — launched by /harness-build only. Eval segment: Layer 1 commands, an isolated Layer 2+3 evaluation and an optional cold review; modifies no source file.` |
| `deep-review.review` | `INTERNAL — launched by /deep-review only. Review segment: parallel specialist reviews, cross-verification in thorough mode, then synthesis into one FindingSet; modifies no file.` |

`harness.critic`은 이미 이 형식이다.

- [ ] **Step 6: 린트에 검사 두 개를 더한다**

`verify_meta_literal.py`: (1) `meta.description`이 `INTERNAL — launched by /`로 시작한다. (2) 스크립트에 `requireArgs('<meta.name>', A, [`가 있고 그 위치가 첫 `phase(` 호출보다 앞이다. 독스트링의 검사 목록과 `CLAUDE.md` §Verification의 이 린트 항목에 둘을 더한다.
확인: 한 스크립트에서 호출 줄을 지우면 exit 1, 되돌리면 0.

- [ ] **Step 7: `known_failures.json`에서 W6 15개를 지우고 게이트 G**

Expected: `30 pass, 5 known-fail, 0 fail`.

- [ ] **Step 8: Commit**

`fix(workflows): refuse a segment run that lacks its required arguments (W6)`

### Task 5: 단일 에이전트의 빈 반환을 이름 붙인 오류로 바꾼다 (W9, m10)

**Files:**
- Modify: `workflows/harness.plan.workflow.js`, `workflows/harness.eval.workflow.js`, `workflows/harness.critic.workflow.js`, `workflows/deep-review.review.workflow.js`, `workflows/harness.build.workflow.js`(로그 한 줄)
- Test: `tests/segment_stubs/cases.mjs`, `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Consumes: Task 3의 `must`.
- Produces: 오류 메시지 `harness.plan: synthesis returned null`, `harness.eval: verify_l1 returned null`, `harness.eval: evaluator returned null`, `harness.critic: critic returned null`, `deep-review.review: synthesis returned null`. `harness.build`의 `implementation returned null — partial edits possible`은 그대로 둔다(오케스트레이터가 그 문구를 읽는다).

- [ ] **Step 1: 케이스 네 개를 더한다**

`eval-null-l1`(라벨 `verify_l1`), `eval-null-evaluator`(`evaluator`), `critic-null`(`critic`), `review-null-synthesis`(`synthesis`). 모두 `defect: 'W9'`이고 형태는 기존 `plan-null-synthesis`와 같다 — 해당 라벨만 `null`을 돌려주고 `namesAgent(r.error, '<label>')`을 확인한다.

- [ ] **Step 2: 실패를 확인한다** — 새 네 케이스가 FAIL(`Cannot read properties of null`), exit 1.

- [ ] **Step 3: 다섯 지점을 `must(...)`로 감싼다**

`const plan = must('harness.plan', 'synthesis', await agent(...))` 형태. `harness.eval`의 콜드 리뷰 호출은 감싸지 않는다(그 `try`가 실패를 `coldStatus = 'failed'`로 바꾼다).

- [ ] **Step 4: `harness.build`의 계획 로그를 고친다 (m10)**

`implPlan`이 없으면 `log('Plan: implementation plan unavailable — implementing from the spec alone')`, 있으면 기존 문장.

- [ ] **Step 5: `known_failures.json`에서 `plan-null-synthesis`를 지우고 게이트 G**

Expected: `35 pass, 4 known-fail, 0 fail`.

- [ ] **Step 6: Commit**

`fix(workflows): name the agent whose result was missing instead of failing on a null read (W9)`

### Task 6: 평가 세그먼트의 `{scope}`와 판정을 정규화한다 (W15, W16)

**Files:**
- Modify: `workflows/harness.eval.workflow.js`, `workflows/_reference/schemas.md`, `skills/harness/SKILL.md` §Step 1 items 5–6, `templates/_shared/detection_table.md`
- Test: `tests/segment_stubs/cases.mjs`, `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Produces: `harness.eval`의 반환에서 `layer`는 Layer 1 결과면 `"L1"`, 평가자 결과면 `verdict == "FAIL_L2"`일 때 `"L2"`, 그 밖에는 `"L3"`이다. `verdict == "PASS"`인데 severity가 `critical`이나 `major`인 `failures` 항목이 있으면 `verdict`는 `"FAIL_L3"`이 된다. state.json의 `lint_cmd` / `type_check_cmd` / `build_cmd` / `test_cmd`에는 글자 `{scope}`가 남지 않는다.

- [ ] **Step 1: 케이스를 고치고 더한다**

`eval-scope-placeholder`의 단언을 강화한다: `{scope}`가 없고 `pylint src`가 있어야 한다. 더하는 케이스:

| id | defect | 입력 | 단언 |
|---|---|---|---|
| `eval-scope-default` | W15 | `lintCmd: 'pylint {scope}'`, `scope: '(no limit)'` | L1 프롬프트에 `pylint .` |
| `eval-scope-evaluator` | W15 | `testCmd: 'pytest {scope}'`, `scope: 'src'` | 평가자 프롬프트에 `pytest src` |
| `eval-fail-l2-mislabelled` | W16 | 평가자가 `{verdict:'FAIL_L2', layer:'L1', failures:[]}` | `result.layer === 'L2'` |
| `eval-l1-mislabelled` | W16 | `verify_l1`이 `{verdict:'FAIL_L2', layer:'L3', failures:[]}` | `result.layer === 'L1'`, 에이전트 호출 1회 |
| `eval-pass-with-major` | W16 | 평가자가 `PASS` + severity `major` 1건 | `result.verdict === 'FAIL_L3'` |
| `eval-pass-with-minor` | W16 | 평가자가 `PASS` + severity `minor` 1건 | `result.verdict === 'PASS'` |

- [ ] **Step 2: 실패를 확인한다** — `eval-pass-with-minor`만 PASS, 나머지 새 케이스는 FAIL.

- [ ] **Step 3: 스크립트를 고친다**

- 인자 파싱 뒤에 `const scopeArg`를 둔다: `A.scope`가 문자열이고 trim한 값이 비어 있지 않고 `(`로 시작하지 않으면 그 값, 아니면 `'.'`.
- `const cmd = (c) => (c ? render(String(c), { scope: scopeArg }) : c)`를 두고 `buildCmd`·`testCmd`·`lintCmd`·`typeCheckCmd`를 프롬프트에 넣는 모든 지점에서 `cmd(...)`를 거친다.
- 평가자용 스키마 `EvaluatorVerdictSchema`를 따로 둔다(`VerifyVerdictSchema`와 같고 `layer`만 `['L2', 'L3']`). Layer 1 호출은 기존 스키마를 쓴다.
- Layer 1 결과를 받은 직후 `l1.layer = 'L1'`.
- 평가자 결과를 받은 직후: critical·major 항목 수를 세고(대소문자 무시), `PASS`인데 1건 이상이면 `verdict.verdict = 'FAIL_L3'`로 바꾸고 `log`로 알리고 `summary` 앞에 `verdict normalized: PASS with <n> blocking failure(s) -> FAIL_L3. `를 붙인다. 그 뒤 `layer`를 위 규칙으로 다시 쓴다. 콜드 리뷰 조건은 정규화한 `verdict`를 읽는다.

`FAIL_L3`으로 보내는 이유: Layer 2 FAIL은 자동 재시도로 가고, Layer 3 FAIL은 사용자에게 보인다. 모순된 판정은 사람이 봐야 한다.

- [ ] **Step 4: Setup이 `{scope}`를 풀어 저장하게 한다**

INLINE 경로의 Layer 1은 스크립트를 거치지 않으므로 스크립트만 고쳐서는 닫히지 않는다. `/harness` §Step 1 items 5–6 끝에 한 문장을 더한다: 결정된 명령(build·test·lint·type-check)에 글자 `{scope}`가 있으면 저장하기 전에 세션의 `scope` 값으로 바꾸고, `scope`가 `(no limit)`이면 `.`으로 바꾼다. `detection_table.md`의 `pylint {scope}` 행 아래에 그 규칙을 가리키는 한 줄을 더한다.

- [ ] **Step 5: `schemas.md`에 평가자 스키마와 정규화 규칙을 적고, `known_failures.json`에서 `eval-scope-placeholder`·`eval-pass-with-critical`을 지운다**

- [ ] **Step 6: 게이트 G** — Expected: `43 pass, 2 known-fail, 0 fail`.

- [ ] **Step 7: Commit**

`fix(harness): resolve {scope} in commands and normalize the evaluator's layer and verdict (W15, W16)`

### Task 7: 개수를 정규화할 때 요약도 다시 만든다 (W17)

**Files:**
- Modify: `workflows/harness.critic.workflow.js`, `workflows/deep-review.review.workflow.js`
- Test: `tests/segment_stubs/cases.mjs`, `tests/segment_stubs/known_failures.json`

**Interfaces:**
- Produces: `harness.critic`의 `summary`는 항상 `Critical=<n>, Major=<n>, Minor=<n>`(정규화한 개수)이다. `deep-review.review`의 `findingSet.summary`는 개수를 고쳤을 때만 `Critical=<n>, Major=<n>, Minor=<n>, Suggestion=<n>`으로 바뀐다.

- [ ] **Step 1: 케이스 하나를 더한다**

`review-summary`(`defect: 'W17'`): 합성이 `counts.critical: 5`, `findings`에 `minor` 1건, `summary: 'critical=5'`를 돌려준다. 단언: `findingSet.summary`에 `Critical=0`과 `Minor=1`이 있다.

- [ ] **Step 2: 실패 확인 → 구현 → `critic-summary`를 목록에서 지운다 → 게이트 G**

Expected: `45 pass, 1 known-fail, 0 fail`. 남은 1건은 `review-dropped-findings`.

`{docs_path}plan_critic_findings.md`의 Summary 줄은 고치지 않는다. 그 파일은 수렴 루프의 매핑이 잔여 보고서로 다시 쓴다(`templates/harness/converge.md` §Mapping).

- [ ] **Step 3: Commit**

`fix(workflows): rebuild the summary line when counts are normalized (W17)`

---

## C. 계약

### Task 8: 계획 검토의 모델을 두 경로에서 같게 한다 (W18)

**Files:**
- Modify: `skills/harness/SKILL.md` §Step 2.6 INLINE branch, `templates/harness/plan_critic_inline.md`(머리말이 모델을 적고 있으면)

- [ ] **Step 1: INLINE branch의 `model_config.advisor`를 `model_config.evaluator`로 바꾼다**

근거는 `templates/_shared/model_config.md`의 "critic은 evaluator 역할" 문장이고, WORKFLOW 쪽은 이미 `MODELS.evaluator || MODELS.advisor`다. 수렴 루프의 review(`advisor`)와 verify(`evaluator`)는 건드리지 않는다.

- [ ] **Step 2: 확인**

Run: `grep -n "plan_critic_inline" skills/harness/SKILL.md`
Expected: 그 줄의 모델이 `model_config.evaluator`.

- [ ] **Step 3: 게이트 G → Commit** — `fix(harness): run the inline plan critic on the evaluator model, as the workflow path does (W18)`

### Task 9: phase `setup`과 `finalizing`을 더한다 (K3, K2)

**Files:**
- Modify: `skills/harness/SKILL.md`(§Session Recovery 표, §Step 1 item 7·8, §State Machine 블록), `skills/harness-build/SKILL.md`(§Session Recovery 표, §Step 7의 `completed` 쓰기 네 곳과 그것을 가리키는 문장, §Step 8, §State Machine 블록), `templates/_shared/session_recovery.md` item 3·7(a), `templates/_shared/status_format.md` §Harness phase labels, `templates/harness/state_schema.md`, `workflows/_reference/state_fields.md`, `skills/harness-gate/SKILL.md`(phase 소유자를 적은 한 줄), `scripts/verify_block_sync.py`(`hx-state-machine` v3 → v4)

**Interfaces:**
- Produces: phase 값 두 개.
  - `setup` — §Step 1 item 7의 체크포인트가 쓴다. `/harness` 재개: item 4–6(탐지, 아무것도 쓰지 않음)을 다시 하고 item 8부터 13까지 간다. 체크포인트의 `task`, `cli_flags`, `user_lang`, `has_git`, `docs_path`, `slug`, `dirty_at_start`는 다시 계산하지 않는다. `/harness-build`는 `plan_ready`와 같은 행("run /harness")으로 보낸다.
  - `finalizing` — §Step 7이 `completed` 대신 쓴다(네 곳 모두). `/harness-build` 재개: §Step 8로 간다. `/harness`는 "past the gate — run /harness-build" 행에 넣는다.
  - `completed`는 에픽 종료(§Step 3.6)만 쓴다. 9.0.0이 쓴 `completed` 세션을 다루는 기존 행은 그대로 둔다.

- [ ] **Step 1: 블록 버전을 먼저 올려 실패를 본다**

`verify_block_sync.py`의 `("hx-state-machine", "v3", …)`을 `v4`로. Run → exit 2.

- [ ] **Step 2: 상태 도표와 전이 규칙을 고친다 (두 파일의 블록, 같은 바이트)**

도표 첫 줄 앞에 `setup → plan_ready`, 끝을 `… → [Verdict Gate] → finalizing → (Step 8 deletes .harness/)`로. 전이 규칙에 두 줄: `setup`은 Step 1이 item 11에서 `plan_ready`로 바꿀 때까지의 값이다. `finalizing`은 판정이 끝나고 Step 8(커밋 질문과 정리)이 남았다는 뜻이며, Step 8의 성공은 `.harness/`를 지우므로 그 뒤에 쓰이는 phase는 없다.

- [ ] **Step 3: `setup` (K3)**

- §Step 1 item 7의 체크포인트 필드 목록에 `phase: "setup"`을 더한다.
- §Step 1 item 8에 한 문장: 현재 브랜치가 이미 `harness/<slug>`이면(재개) 만들지 않고 그대로 쓴다.
- `/harness` 표에 `setup` 행(위 Interfaces). 같은 행에 "`phase`가 없고 `docs_path`가 있는 state.json(9.0.0의 체크포인트)도 이 행으로 간다"를 적는다.
- `session_recovery.md` item 3: 아직 정해지지 않은 필드(`mode`, `model_config`, `branch`)는 상태 블록에서 `—`로 찍는다.
- `/harness-build` 표의 `plan_ready` / `planning` 행에 `setup`을 더한다.
- `status_format.md`: `setup` "Setup — in progress".

- [ ] **Step 4: `finalizing` (K2)**

- Run: `grep -n '"completed"' skills/harness-build/SKILL.md` — §Step 7의 쓰기 네 곳(PASS, "Accept as-is", Layer 3 FAIL 뒤 종료, 최대 라운드)을 `"finalizing"`으로 바꾼다. §Step 3.6의 쓰기는 바꾸지 않는다.
- 같은 출력에서 "§Step 7이 `completed`를 쓴다"를 전제로 한 문장(콜드 리뷰 되먹임 분기의 "BEFORE `phase → "completed"` is written", `session_recovery.md` item 7(a)의 괄호 설명 등)을 `finalizing`에 맞게 고친다. 7(a)의 조건식은 그대로다.
- `/harness-build` 표에 `finalizing` → §Step 8 행: 판정은 끝났으므로 다시 평가하지 않고, 슬라이스 세션의 판단(§Epic Slice Chain)과 커밋 질문부터 다시 한다.
- §Step 8 "Commit code only" step 3의 "the session is resumable … re-run" 문장에 재개 명령을 적는다: `/harness-build`.
- `/harness` 표의 `generate_ready … evaluate_done` 행 범위에 `finalizing`을 더한다. `harness-gate`의 소유자 문장도 맞춘다.
- `status_format.md`: `finalizing` "Finalize — commit pending". `state_schema.md`와 `state_fields.md`에 phase 값 목록이 있으면 둘을 더한다.

- [ ] **Step 5: 옛 state 호환을 계약에서 확인한다**

두 문장이 계약에 있어야 한다: (a) `phase` 없는 체크포인트 → `setup` 행. (b) 9.0.0에서 커밋이 실패해 `completed`로 남은 세션은 9.0.1에서도 "No active session"이다(손으로 커밋하거나 `/harness`로 새로 시작) — 이 한계는 CHANGELOG에 적는다(Task 16).

- [ ] **Step 6: 게이트 G**

`verify_sync_markers.py`의 `harness-steps` 검사가 새 `§Step` 인용을 문제 삼으면 메시지가 요구하는 경로 앵커를 맞춘다. Step 번호는 바뀌지 않는다.

- [ ] **Step 7: Commit**

`fix(harness): add the setup and finalizing phases so an interrupted Setup or a failed commit can be resumed (K3, K2)`

### Task 10: 빌드 세그먼트가 오류로 끝나면 부분 편집을 확인한다 (p9)

**Files:**
- Modify: `skills/harness-build/SKILL.md` §Step 4 — WORKFLOW path item 9

- [ ] **Step 1: 예외의 범위를 넓힌다**

지금은 오류 메시지에 `implementation returned null`이 있을 때만 "Partial edits" 질문을 한다. 빌드 세그먼트의 다른 오류(스크립트 오류, 스키마 불일치, 구현 도중의 엔진 오류)도 구현 에이전트가 파일을 고친 뒤일 수 있다. item 9를 이렇게 고친다: 이 세그먼트의 Workflow 오류는 모두 같은 확인(`git status --porcelain` 출력 → "Partial edits" 질문)을 거친다. 질문 문구는 `The build segment failed ({error}), and the working tree may be partly edited.`로 바꾸고, 선택지와 그 뒤 처리는 그대로 둔다. 권한 거부는 지금처럼 `templates/_shared/mode_gate.md` rule 3으로 간다(이 질문 대상이 아니다).

비용을 같은 문단에 적는다: 에이전트가 하나도 돌기 전의 실패에도 질문이 한 번 나온다. 구분할 신호가 없어서 묻는 쪽을 택했다.

- [ ] **Step 2: Key Rules의 "Graceful engine fallback" 문장에 이 예외를 가리키는 절을 더한다 (p7의 일부)**

`harness`와 `harness-build` 양쪽의 그 문장이 `hx-*` 블록 안인지 먼저 확인한다. 블록 안이면 버전을 올리고 모든 사본을 함께 고친다.

- [ ] **Step 3: 게이트 G → Commit** — `fix(harness-build): ask before falling back inline after any build-segment error (p9)`

### Task 11: 가리킬 대상이 없는 "found above" 문장을 지운다 (r7)

**Files:**
- Modify: `templates/generator/generator_single.md`, `templates/generator/implementation.md`, `templates/generator/implementation_standard.md`, `workflows/harness.build.workflow.js`(`TPL_IMPLEMENTATION_*` 두 곳)

- [ ] **Step 1: 조건이 참이 될 수 없는 항목을 지우고 번호를 다시 매긴다**

"if a parallel execution skill was found above …" 항목과 "if a TDD skill was found above …" 항목. 검색 지시는 1단계(W14)에서 지워졌으므로 지워도 동작이 바뀌지 않는다. 스크립트 안의 템플릿 사본은 원본과 같은 문장으로 맞춘다.

- [ ] **Step 2: 확인**

Run: `grep -rn "found above" skills templates workflows` → Expected: 출력 없음. 게이트 G(`rep-harness.build` PASS).

- [ ] **Step 3: Commit** — `fix(generator): drop the steps that depend on a removed skill lookup (r7)`

### Task 12: md-optimize 백업을 `.harness/` 밖으로 옮긴다 (m9, r9, p1 후속)

**Files:**
- Modify: `skills/md-optimize/SKILL.md`, `skills/harness/SKILL.md` §Step 1 item 2, `README.md`(백업 위치를 적은 곳이 있으면)

**Interfaces:**
- Produces: 백업 폴더 `.md-optimize/`(CWD 기준) — `.md-optimize/.gitignore`(내용 `*` 한 줄, 폴더를 만들 때 가장 먼저 쓴다), `.md-optimize/manifest.txt`, `.md-optimize/backup/<path>`. Exclusion List에 `.md-optimize/`.

**기록된 결정과 다른 점.** 1단계의 결정은 "`525b507`이 넣은 멈춤 두 곳을 없앤다"였다. 이 Task는 `/md-optimize` §1a 5번(열린 `/harness` 세션에서 멈춤)은 없애지만 `/harness` §Step 1 item 2의 멈춤은 없애지 않고 좁힌다 — 9.0.0이 `.harness/md-optimize/`에 남긴 백업이 있을 때만 멈춘다. 완전히 없애면 그 백업은 `/harness` 세션이 끝날 때 지워진다(BASELINE p1이 다시 열린다).

- [ ] **Step 1: 경로를 바꾼다**

Run: `grep -n "\.harness/md-optimize" skills/md-optimize/SKILL.md` — 나온 곳을 모두 `.md-optimize/`로 바꾼다. Step 3.0 첫 항목 앞에 "폴더를 만들면 곧바로 `.md-optimize/.gitignore`에 `*` 한 줄을 쓴다"를 더한다. Exclusion List에 `.md-optimize/`를 더한다.

- [ ] **Step 2: manifest를 먼저 쓴다 (r9)**

Step 3.0의 두 번째 규칙을 고친다: 새 파일은 만들기 전에 `created <path>`를 manifest에 적는다. 복구는 `created` 경로가 실제로 있을 때만 지운다(§Phase 3과 §1a 4번의 복구 문장 양쪽).

- [ ] **Step 3: Step 3c에 비-md 참조 확인을 넣는다 (m9)**

원본을 지우기 전에 그 파일의 저장소 상대 경로와 파일 이름을 `.md`가 아닌 파일에서 찾는다(git 저장소면 `git grep -n -F -e <path> -e <name> -- . ':!*.md'`, 아니면 같은 제외 목록으로 내용 검색). 한 건이라도 나오면 지우지 않고 Phase 5 보고서의 "Kept — referenced from non-markdown files" 목록에 경로와 참조 위치를 적는다.

- [ ] **Step 4: 멈춤을 정리한다**

- `/md-optimize` §1a 5번(열린 `/harness` 세션)을 지운다.
- §1a 4번은 `.md-optimize/`와 함께 `.harness/md-optimize/`(9.0.0이 남긴 것)도 확인한다. 옛 위치에서 찾으면 같은 질문과 같은 복구를 그 경로로 한다. 옛 위치의 백업을 지운 뒤 `.harness/`가 비어 있으면 그 폴더도 지운다.
- `/harness` §Step 1 item 2의 문장을 "9.0.0의 md-optimize가 남긴 백업"으로 좁힌다. 멈춤 메시지의 경로와 안내(`/md-optimize`를 먼저 실행)는 그대로다.

- [ ] **Step 5: CWD 한정을 적는다 (r9)**

§1a 머리에 한 문장: 이 스킬은 현재 작업 폴더를 대상으로 하고 대상 폴더 인자는 없다.

- [ ] **Step 6: 확인**

Run: `grep -rn "\.harness/md-optimize" skills templates README.md`
Expected: `/md-optimize` §1a 4번의 옛 위치 문장과 `/harness` §Step 1 item 2 두 곳뿐. 게이트 G.

- [ ] **Step 7: Commit**

`fix(md-optimize): keep the run backup in .md-optimize/, outside the directory /harness deletes (m9, r9)`

---

## D. 린트

### Task 13: git 안전 린트가 통과시키던 형태를 막는다 (p4)

**Files:**
- Modify: `scripts/verify_git_safety.py`, `CLAUDE.md` §Verification의 이 린트 항목

- [ ] **Step 1: 탐지 대상을 시험 파일로 먼저 확인한다**

`templates/_probe.md`를 임시로 만들고 여덟 줄을 넣는다 — 걸려야 하는 것: `git checkout main -- src/a.ts`, `git -C repo checkout -- workflows/`, `git restore --staged --worktree a.ts`, `git checkout -f main`, `git switch --discard-changes main`. 걸리면 안 되는 것: `git checkout -b harness/x`, `git restore --staged a.ts`, `git switch main`.
Run: `python scripts/verify_git_safety.py` → Expected(수정 전): 시험 파일에서 0줄 보고.

- [ ] **Step 2: 패턴을 고친다**

모든 `git` 패턴은 `git`과 하위 명령 사이의 `-C <path>` / `-c <k=v>`를 건너뛴다. 아래에서 `GIT`은 `git\s+(?:-[Cc]\s+\S+\s+)*`다.

```
checkout (ref가 앞에 와도 `-- `를 잡는다)   GIT checkout\s+(?:[^\s-]\S*\s+)?(?:--\s|\.(?![\w/]))
restore (기존 패턴은 유지, 이것을 더한다)    GIT restore\b[^\n`]*(?:--worktree\b|\s-W\b)
forced checkout / switch (새 항목)           GIT checkout\s+(?:-f\b|--force\b)
                                             GIT switch\b[^\n`]*(?:\s-f\b|--force\b|--discard-changes\b)
```

`git stash` 패턴에도 같은 `GIT` 머리를 쓴다.

- [ ] **Step 3: 시험 파일로 확인하고 지운다**

Expected: 다섯 줄 보고, 세 줄 미보고, exit 1. 시험 파일을 지운다.

- [ ] **Step 4: 트리에서 새로 걸리는 줄을 처리한다**

`templates/harness/doctor.md`의 `rm <location>/workflows/*.workflow.js && git -C <location> checkout -- workflows/`가 걸린다. `ALLOW`에 넣고 이유를 적는다: 같은 줄에서 방금 지운 추적 파일을 플러그인 설치 사본 안에서 다시 꺼내는 수리 명령이고 `<location>`에 고정돼 있다. 그 밖에 걸리는 줄이 있으면 명령을 고칠지 ALLOW에 넣을지 줄마다 정하고 이유를 커밋 메시지에 적는다.

- [ ] **Step 5: 독스트링과 CLAUDE.md**

독스트링의 "Two destructive forms pass" 문단은 지우지 말고 끝에 날짜와 함께 "이제 둘 다 잡는다"는 정정을 덧붙인다. `CLAUDE.md`의 "Two destructive forms pass it" 문장도 같은 방식으로 고친다.

- [ ] **Step 6: 게이트 G → Commit** — `fix(lint): catch checkout <ref> -- <path>, a worktree restore behind --staged, and forced checkouts (p4)`

### Task 14: 삭제 토큰 검사의 예외를 좁힌다 (p11)

**Files:**
- Modify: `scripts/verify_sync_markers.py`

- [ ] **Step 1: 현재형으로 삭제된 스킬을 말하는 문장을 찾는다**

Run (`MSYS_NO_PATHCONV=1`): `grep -n -E "/(spec|study|ship|debug|refactor|migrate|test-gen|team-memory|codebase-audit|md-generate)\b|skills/(spec|study|ship|debug|refactor|migrate|test-gen|team-memory|codebase-audit|md-generate)/" scripts/verify_sync_markers.py`
출력에서 날짜가 붙은 측정 이력 주석이 아닌 줄을 고른다. 독스트링의 "This fulfills the lint promise in skills/spec/SKILL.md §Step 1.5 …"가 그중 하나다(BASELINE은 2곳이라 적었다).

- [ ] **Step 2: 그 문장들을 현재 사실로 고친다**

지우지 말고 같은 문단 안에서 정정한다(예: 정본이 `skills/harness/SKILL.md` §Step 1.5로 옮겨졌다).

- [ ] **Step 3: BASELINE에 정정을 덧붙인다**

"린트와 테스트"의 "이력 주석 밖에서 0건" 줄 끝에: 그때는 이 파일을 통째로 뺐고 현재형 문장 N곳이 가려져 있었다, 2단계에서 고쳤다. Task 16의 BASELINE 커밋에 넣는다.

- [ ] **Step 4: 게이트 G → Commit** — `docs(lint): correct the present-tense statements about removed skills in verify_sync_markers (p11)`

---

## E. 리뷰와 릴리스

### Task 15: 브랜치 독립 리뷰

- [ ] **Step 1: 브랜치를 푸시하고 리뷰어 1명을 띄운다 (읽기 전용, 최상위 모델)**

범위는 `f3be29d..HEAD`다 — 리뷰받지 않은 `525b507`과 이 단계의 커밋 전부. 리뷰어에게 줄 것: 이 계획, SPEC 5절 2단계 표, BASELINE의 p1~p3 정정 문단. 특히 보게 할 것: Task 9(재개 표의 빈 행, `completed`를 전제한 남은 문장), Task 12(복구 순서, 옛 위치 처리), Task 6(정규화가 재시도 횟수와 게이트에 미치는 영향), `525b507`의 세 수정.

- [ ] **Step 2: Critical·Major를 고친다**

수정마다 실패하던 확인을 먼저 보이고 통과를 보인다. Minor는 고치거나 "갈 곳"을 정해 BASELINE에 적는다. 계약 문장을 다시 고쳤으면 그 커밋만 범위로 리뷰를 한 번 더 받는다.

- [ ] **Step 3: 결과를 BASELINE에 적는다** — "2단계 후"(Task 16) 아래 "브랜치 리뷰" 절.

### Task 16: 릴리스 문서와 버전

**Files:**
- Modify: `CHANGELOG.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `design/v9-subtraction/BASELINE.md`, `design/v9-subtraction/SPEC.md`(상태 줄), `README.md`(백업 위치·phase 목록을 적은 곳이 있으면)

- [ ] **Step 1: `RELEASING.md` 1~6번을 한다**

버전은 `9.0.1`, 세 경로 모두. CHANGELOG `## [9.0.1]`의 Fixed에 부록 A 번호를 붙여 적고, "Upgrade notes"에 두 가지를 적는다: md-optimize 백업 위치가 `.md-optimize/`로 바뀌었고 옛 위치의 백업은 다음 `/md-optimize`가 묻는다. 9.0.0에서 커밋이 실패한 채 끝난 세션은 9.0.1에서도 재개되지 않는다.

- [ ] **Step 2: BASELINE에 "2단계 후 (v9.0.1)" 절을 더한다**

스킬별 blob 크기(1단계 후 대비), 스텁 테스트 요약(기대: `45 pass, 1 known-fail`), BLOCK 그룹 수, 부록 A 2단계 9건의 상태, Task 1·14의 정정, Task 15의 리뷰 결과.

- [ ] **Step 3: SPEC 상태 줄을 고친다** — 1단계 릴리스 완료·K7 종결, 2단계 구현 완료·릴리스 확인 대기.

- [ ] **Step 4: 게이트 G → Commit** — `chore(release): v9.0.1` → 브랜치 푸시.

### Task 17: 실사용 검증과 릴리스 (단계마다 사용자 확인)

- [ ] **Step 1 (confirm): 설치본을 릴리스 브랜치 내용으로 바꾸고 Claude Code를 새로 시작한다** — `RELEASING.md` 8번. 9번: 스킬 목록에 세그먼트 5개의 설명이 `INTERNAL —`로 시작하고, `/harness doctor` ①~⑤가 ✓.

- [ ] **Step 2: 바뀐 경로를 한 번씩 돌린다 (저장소 밖의 시험 폴더)**

| 경로 | 방법 | 통과 기준 |
|---|---|---|
| K3 | `/harness "<작은 과제>"`를 Model 질문에서 멈추고, 새 세션에서 `/harness` → Resume | 브랜치 단계부터 다시 가고 `harness/<slug>`에서 진행한다 |
| K2 | 항상 실패하는 pre-commit 훅을 둔 폴더에서 완주 → 커밋 실패 → 훅 제거 → `/harness-build` | 커밋 질문이 다시 나온다 |
| W15 | `.pylintrc`가 있는 폴더, INLINE 경로 | Layer 1 보고서의 lint 명령에 `{scope}`가 없다 |
| W6 | 스킬 목록의 세그먼트를 빈 인자로 직접 호출 | 에이전트가 하나도 돌지 않고 인자 이름이 든 오류로 끝난다 |
| p9 / 명명된 예외 ② | WORKFLOW 경로에서 구현 에이전트를 건너뛴다 | "Partial edits" 질문이 나온다 |
| 명명된 예외 ② | 자동 수정 적용 도중 중단 후 재개 | 끊긴 적용을 알리고 사본으로 되돌린 뒤 적용한다 |
| Task 12 | md-optimize를 Phase 3 도중 중단 → 다시 실행 → Restore. 평가자 지적에 "Skip" | 백업이 `.md-optimize/`에 있고 복구 뒤 sha256이 실행 전과 같다. "Skip" 뒤 백업이 남고 경로가 출력된다 |
| Task 12 (옛 위치) | `.harness/md-optimize/`에 manifest를 손으로 둔 폴더에서 `/harness`, 이어서 `/md-optimize` | `/harness`는 멈추고, `/md-optimize`는 옛 위치의 백업을 묻는다 |

돌리지 못한 경로는 명명된 예외로 BASELINE에 남긴다. 실패한 경로는 브랜치로 되돌아간다(`RELEASING.md` §If a step fails).

- [ ] **Step 3: 관측을 BASELINE "2단계 후" 아래에 적고 커밋·푸시한다** — 명명된 예외 ②가 닫혔는지도 적는다.

- [ ] **Step 4 (confirm, 각각): `main` 병합(`--no-ff`) → 태그 `v9.0.1` → 푸시 → GitHub 릴리스 → `develop` 갱신** — `RELEASING.md` 11~15번.

- [ ] **Step 5 (confirm): 로컬 작업 브랜치 `harness/m6-…`, `harness/m4-…`를 지운다** — Task 1이 내용을 가져왔다.

## 완료 기준과 Task 대응 (SPEC 5절 2단계)

| SPEC 완료 기준 | Task |
|---|---|
| 스텁 러너: 페이로드 안의 `{key}`가 다시 치환되지 않음 (W2) | 3 |
| 스텁 러너: 빈 인자·빈 반환에서 명시적 오류 (W6, W9) | 4, 5 |
| `meta.description` 내부용 한 줄 — 스킬 목록에서 확인 (W6) | 4, 17 Step 1 |
| 스텁 러너 케이스 통과 (W15, W16, W17) | 6, 7 |
| 두 경로의 모델 지정 일치 (W18) | 8 |
| pre-commit 실패 뒤 `/harness-build` 재실행이 커밋 질문으로 돌아감 (K2) | 9, 17 Step 2 |
| Model 질문에서 중단 후 재개가 브랜치 단계부터 다시 시작 (K3) | 9, 17 Step 2 |
| 공통 조각이 스크립트마다 같은지 린트로 검사 | 3, 4 Step 6 |
| 넘겨받은 항목: m4·m6 / m9·r9 / m10 / r7 / p4 / p9 / p11 / `525b507` 리뷰와 명명된 예외 ② | 1 / 12 / 5 / 11 / 13 / 10 / 14 / 15, 17 |
