# v9 3단계 (v9.1: handoff 바로잡기와 감량) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/handoff`의 resume 결함(H1~H6, H9, H10, H12~H14)과 Progress Ledger 결함(H7, H8, H11)을 고치고, 본문을 generate와 resume으로 나누고, 결정적 절차를 Node 스크립트로 옮겨 v9.1.0으로 릴리스한다. generate 호출에 실리는 본문은 15KB 이하, resume의 읽기량은 말뭉치로 잰 예산 이하여야 한다.

**Architecture:** 파싱·git 상태·드리프트·경로 검사·읽기 계획은 `skills/handoff/scripts/`의 Node 스크립트가 JSON으로 내고, 계약 문서는 그 출력을 쓰는 규칙만 적는다. 판단이 필요한 것(`Next cmd:` 후보의 부정 판별, 승인 질문, 사용자와의 대화)은 산문에 남는다. 본문 이동은 의미를 바꾸지 않는 기계적 분할로 먼저 하고, 규칙 수정은 분할된 파일에서 한다. 규칙마다 실제 handoff 문서 말뭉치로 전후를 비교한다.

**Tech Stack:** Markdown 계약 문서, Node.js ESM 스크립트(표준 라이브러리만), Python 3 표준 라이브러리(린트).

**Spec:** `design/v9-subtraction/SPEC.md` 5절 3단계 3.1~3.4, 부록 A의 H1~H15, 8.3의 "resume 읽기 예산". 넘겨받은 항목의 정본은 `design/v9-subtraction/BASELINE.md`의 "2단계 후 (v9.0.1)". 결함별 위치와 수정안은 `docs/harness/v9-audit/01-handoff-review.md` (gitignored — not a public link)의 같은 번호다.

## Global Constraints

- 작업 브랜치는 `harness/v9-stage3`, 기준은 `develop`(`90fbad7`, 태그 `v9.0.1`)이다. 이 브랜치에는 BASELINE 기록 커밋 `7e42edf`가 있다. `main`에 직접 커밋하지 않는다.
- **게이트 G** (모든 커밋 직전): `CLAUDE.md`의 `agent-harness-defaults: lint-cmd=` 줄의 체인이 exit 0이고, `node tests/segment_stubs/run.mjs`와 `node tests/handoff/run.mjs`가 exit 0이다. Task 3 전에는 뒤의 것을 건너뛴다.
- 커밋하기 전에 `git config --get user.email`이 noreply 주소인지 확인한다. amend와 force push를 하지 않는다. 태그 `v9.0.0`·`v9.0.1`을 옮기지 않는다.
- `main` 병합, 태그, GitHub 릴리스, `develop` 푸시, 설치본 교체, cache 폴더·로컬 브랜치 삭제는 단계마다 사용자 확인을 새로 받는다. cache 폴더는 `.in_use`의 PID가 모두 죽었음을 먼저 확인한다. 브랜치 푸시는 Task 13에서 처음 한다.
- 공개 저장소다. 커밋하는 모든 파일에 사내 저장소·프로젝트 이름, 사람 이름·계정명, 내부 경로를 쓰지 않는다. 말뭉치는 "실제 handoff 문서 말뭉치"로만 부르고, 출력 표에는 저장소 이름 대신 순번을 쓴다. `docs/` 인용에는 `(gitignored — not a public link)`를 붙인다. Task 14의 위생 검사가 이를 확인한다.
- 말뭉치 문서와 그 사본, 스냅샷 매니페스트는 저장소에 커밋하지 않는다. 스크립트는 `--corpus <폴더>`로 받는다. 커밋하는 것은 합성 픽스처뿐이다.
- 스크립트 규칙: Node 표준 라이브러리만 쓴다. 출력은 stdout에 JSON 하나다. 실패는 0이 아닌 exit 코드와 stderr 메시지로 드러내고, 계약은 실패 시 산문으로 대신 처리하지 않는다. 종료 코드는 `0` 성공, `1` 입력 문제(없는 파일, handoff 문서가 아님), `2` 사용법·내부 오류다.
- `.mjs` 파일은 LF를 유지한다. `.py` 파일은 커밋 전에 `git ls-files --eol`로 `i/lf`를 확인한다. 파이썬으로 저장소 파일을 쓸 때 `write_text`를 쓰지 않는다(`write_bytes`).
- 린트 배선: 새 린트는 `.github/workflows/lint.yml`에 한 줄 `- run:` 단계로, `CLAUDE.md`의 `lint-cmd` 줄과 명령표에 함께 넣고 `bash .github/scripts/check_lint_wiring.sh`를 돌린다. 이 검사의 이름 정규식은 `scripts/<이름>.(py|mjs)`이므로, `lint.yml`의 단계 줄에 그 모양이 부분 문자열로 들어가면(예: `tests/foo_scripts/run.mjs`) 배선 오류가 된다. handoff 테스트 폴더 이름은 `tests/handoff/`로 고정한다.
- 계약 문장을 고친 커밋은 리뷰 없이 릴리스하지 않는다(Task 13). 리뷰는 배치당 리뷰어 1명이다.
- 크기는 `git ls-tree -r -l <commit>`의 blob 바이트로 잰다. 린트는 `\r`를 뺀 UTF-8 바이트로 잰다(`verify_description_budget.py`와 같은 기준).
- 인용은 `§절 이름`으로 한다. handoff 파일로 가는 `§` 인용은 어느 린트도 보지 않는다 — Task 4의 인벤토리 grep이 유일한 검사다.
- Git Bash에서 `/`로 시작하는 정규식을 넘길 때는 `export MSYS_NO_PATHCONV=1`을 먼저 실행한다.
- 실사용 시험은 저장소 밖의 시험 폴더에서 돌린다. 시험 결과의 기록과 커밋은 `--plugin-dir` 없이 연 세션에서 한다(그 세션에서는 저장소 안 Write·Edit이 분류기에 막힌 적이 있다).

## Review Focus

1. **새 필드가 없는 옛 문서**: `Worktree:`·`Dirty files:`·`Harness :`·`planned`가 없는 문서(말뭉치 대부분)를 resume이 오류 없이 읽고, 필드가 없다는 사실을 "기록 없음"으로 보고한다. 이전 `Next :` 파생으로 조용히 떨어지지 않는다. (Task 3, 6, 7)
2. **잘린 원장**: 이월이 `in-progress`·`blocked`·`planned` 행을 하나도 잃지 않는다. done 행만 줄어든다. (Task 8)
3. **in-progress 2행 이상, 라벨 없음**: `Next :`가 임의의 한 행을 고르지 않고 모호함을 밝힌다. `Next cmd:`는 `(no single command — see Next Steps item 1)`이다. (Task 6)
4. **`docs/harness/` 아래 경로**: 기록된 `Docs`와 Reading Order의 `docs/harness/…` 경로가 거짓으로 거부되지 않고, `..`·`.git/`·저장소 밖 절대 경로는 여전히 거부된다. (Task 5)
5. **다른 작업 트리·비-git**: 워크트리에서 만든 문서를 메인 트리에서 resume해도 거짓 "branch differs"가 없다. git이 아닌 폴더와 detached HEAD에서 오류 없이 "검증 불가"를 보고한다. (Task 7)

그 밖에 각 Task의 테스트가 다룬다: 범위 힌트 없는 2,000줄 초과 파일, 예산 소진 시 건너뛰는 순서, 같은 날 문서 여러 개, Node 부재 시 실패가 드러나는지.

## 범위 밖 (이 계획이 하지 않는 것)

| 항목 | 이유 |
|---|---|
| "다음 9.0.x" Minor 묶음 | 2026-11-18 사용자 결정: 9.0.2로 따로 낸다. `develop`에서 딴 별도 브랜치에서 한다 |
| 명명된 예외 ② 중 "끊긴 자동 수정" | 2026-11-18 사용자 결정: 5단계 4번(Auto-fix 존폐)에 맡긴다 |
| `claude plugin eval`, 컨텍스트 알림 훅 실험 (SPEC 3.4 선택 항목) | 필수 조건이 아니다 |
| 감사 보고서 01의 개선 여지 3~8 (규칙 줄이기, 선택 필드 `Prev:` 등, 추가 드리프트, `fact — evidence` 강제, 민감정보 경고, 대체 표시) | SPEC 3단계 표에 없다 |
| 기존 handoff 문서의 일괄 변환 | 문서는 수정하지 않는다. 새 resume이 옛 문서를 그대로 읽는 것이 요구 사항이다 |
| `templates/_shared/path_validator.md` 수정 | harness가 소유한 단일 소스다. handoff는 이를 인용하지 않고 자기 검사를 정의한다(H4) |
| `/harness`·`/harness-build`의 다른 계약 | `templates/_shared/session_boundary.md`의 한 문장(Task 7)과 인용 갱신(Task 4)만 건드린다 |

## STAGE2에서 넘겨받은 것

| 내용 | 갈 곳 |
|---|---|
| handoff §Step 5 규칙 5(웹이 필요한 스킬로는 체이닝하지 않음)를 "웹이 필요한 스킬 일반"으로 넓혀 둔 것 | Task 10에서 지금 체이닝 대상(harness 계열)에 맞게 한 문장으로 줄이고 이유를 RATIONALE에 둔다 |
| `Status` 셀의 `**`·백틱 정규화 | Task 8 (`parse`가 한 번 정규화). 같은 현상인 `Epic` 셀도 함께 닫는다(ROADMAP의 유보 항목에 정정을 덧붙인다) |
| handoff `disallowed-tools`(`NotebookEdit`, `WebSearch`, `WebFetch`) | 바꾸지 않는다 |

## 이 계획이 고정한 결정

| # | 결정 | 근거 |
|---|---|---|
| D1 | 위치: 본문 분할은 `templates/handoff/generate.md`·`resume.md`, 스크립트는 `skills/handoff/scripts/`, 테스트는 `tests/handoff/` | 다른 스킬의 `templates/<skill>/` 관례. 스킬은 템플릿을 `{CLAUDE_PLUGIN_ROOT}/templates/…`로 읽는다 |
| D2 | "generate 호출 시 실리는 본문" = `skills/handoff/SKILL.md` + `templates/handoff/generate.md` + generate가 읽는 템플릿(지금은 0개)의 `\r` 제외 UTF-8 바이트 합 ≤ 15,360 | 작은 파일로 나눠도 읽는 총량이 같으면 SPEC 3절의 실패 기준이다 |
| D3 | resume 예산 B는 Task 5에서 잰다. 규칙: 범위 인식 정책으로 문서마다 읽기량을 구하고, B = 그 P90을 16KB 단위로 올림, 단 128KB를 넘으면 128KB로 하고 상한에 걸린 문서 비율을 보고한다 | SPEC 8.3 — 값은 실측 뒤에 정한다. 근거 없는 숫자를 미리 넣지 않는다 |
| D4 | 범위 표기는 두 가지만: `경로:시작-끝`(행), `경로 §제목 일부`(절). 범위 없는 2,000줄 초과 파일은 건너뛰지 않고 앞 400행과 목차(제목·행 번호)를 읽는다 | H1. 계약 문서의 `§` 인용 관례와 같은 모양이다 |
| D5 | 이월하는 done 행은 최근 5개. 미완 행(`in-progress`·`blocked`·`planned`)은 전부 이월한다 | H7. 말뭉치 중앙값 13행, 5는 한 슬라이스 앞뒤 맥락을 남기는 최소값이다. 100행 넘던 표본이 20행 이하가 되는지는 Task 8이 잰다 |
| D6 | `Next :` 우선순위: `Slice :` 라벨 > in-progress가 정확히 1행 > (하네스 상태가 관련 있을 때만) `Docs` 마지막 구간 > Next Steps 1번 원문. in-progress가 2행 이상이고 라벨이 없으면 모호하다고 밝히고 1번 원문으로 간다 | H2, H3 |
| D7 | 헤더에 `Worktree:`(git 최상위, 없으면 `n/a`)와 `Dirty files:`(경로 최대 40개, 넘으면 `+N more`)를 더한다. 하네스 상태가 없거나 관련 없으면 In Progress에 `Harness : none (<이유>)` 한 줄을 쓴다 | H3, H5, H6, H9 |
| D8 | 순서: 기계적 분할을 규칙 수정보다 앞에 둔다 | 규칙을 단일 파일에서 먼저 고치면 같은 문장을 두 번 옮긴다. 분할은 "원문의 모든 줄이 새 파일에 그대로 있다"로 검사할 수 있는 이동이다 |
| D9 | 릴리스 버전은 9.1.0이다. 3곳(`plugin.json` `$.version`, `marketplace.json` `$.metadata.version`, `$.plugins[*].version`) | `CLAUDE.md` |
| D10 | 9.0.2가 먼저 `develop`에 들어가면 `develop`을 이 브랜치에 병합한다. rebase와 force push를 하지 않는다 | 이 계획의 Global Constraints |

## 파일 구조

| 경로 | 작업 | 책임 |
|---|---|---|
| `skills/handoff/SKILL.md` | 수정 | 분기표, 언어 감지, 위치 규칙, 공통 규칙, `list`, Non-Goals. 호출된 쪽 본문을 읽으라는 포인터 |
| `templates/handoff/generate.md` | 생성 | generate의 Step 1~4, 문서 틀, 필드 계약(Fixed Label Record Format 포함) |
| `templates/handoff/resume.md` | 생성 | resume의 Step 1~5, 추출 규칙, 게이트 |
| `skills/handoff/scripts/handoff.mjs` | 생성 | 하위 명령 분기와 JSON 출력, 종료 코드 |
| `skills/handoff/scripts/lib/{git,parse,ledger,reading,paths}.mjs` | 생성 | git 상태·드리프트 / 문서 파싱 / 원장 이월 / 읽기 계획 / 경로 검사 |
| `tests/handoff/{run,cases,mkrepo}.mjs`, `tests/handoff/fixtures/` | 생성 | 테스트 러너, 케이스, 임시 git 저장소 생성기, 합성 문서 |
| `tests/handoff/corpus/{snapshot,measure,diff,legacy_next}.mjs` | 생성 | 말뭉치 스냅샷·지표·전후 비교. CI에서 돌리지 않는다 |
| `design/handoff-diet/RATIONALE.md` | 생성 | 본문에서 옮긴 측정 기록, 기각한 대안, 해소 불가 인용 |
| `scripts/verify_body_budget.py` | 생성 | 스킬별 본문 상한과 날짜 표지 금지 |
| `templates/_shared/session_boundary.md`, `templates/_shared/mode_gate.md`, `skills/harness-build/SKILL.md`, `README.md` | 수정 | handoff를 가리키는 인용의 갱신, 상태 기록 규칙 한 문장 |
| `scripts/verify_sync_markers.py`, `scripts/verify_git_safety.py` | 수정 | 옮겨진 마커·예외의 대상 파일 |
| `.github/workflows/lint.yml`, `.gitattributes`, `CLAUDE.md` | 수정 | 배선, 줄 끝, 명령표 |
| `CHANGELOG.md`, `.claude-plugin/*.json`, `design/v9-subtraction/{BASELINE,SPEC}.md` | 수정 | 릴리스 |

### 스크립트 하위 명령 (Task들이 공유하는 계약)

호출은 `node {HANDOFF_JS} <하위 명령> [--옵션 값]…`이다. `{HANDOFF_JS}`는 Task 1이 정한 표기로 쓴 `skills/handoff/scripts/handoff.mjs`의 경로다.

| 하위 명령 | 입력 | 출력 (JSON) | 만드는 Task |
|---|---|---|---|
| `parse` | `--doc <경로>` | `header{title,date,project,branch,head,dirtyRaw,dirtyPaths[],worktree,upstream}`, `sections{이름→본문}`, `fixedLabels{Skill,Task,Phase,Mode,Docs}\|null`, `harness: "record"\|"none"\|"absent"`, `ledger{rows[{epic,slice,status,evidence,notes}]}\|null`, `stepOne{text,candidates[],sliceLabel\|null}`, `readingOrder[{raw,path,range\|null,isFile}]` | 3 (이후 확장) |
| `next` | `--doc <경로>` `--state-relevant true\|false` | `{slice, source: "label"\|"in-progress"\|"docs"\|"step-one", ambiguous: [slice…], stepOneText}` | 6 |
| `git-state` | `--cwd <경로>` | `{isGit, toplevel, branch, head, subject, dirty[{status,path}], upstream{ahead,behind}\|null}`. detached면 `branch`는 `"(detached)"`, git이 아니면 `isGit:false`로 exit 0 | 7 |
| `harness-state` | `--branch <현재 브랜치>` | `{exists, relevant, reason, fields{skill,task,phase,mode,docs_path}\|null}`. 읽기만 한다 | 7 |
| `drift` | `--doc <경로>` `--cwd <경로>` | `{branch{recorded,current,same,viaWorktree}, head{relation: "same"\|"forward"\|"backward"\|"diverged"\|"unknown", ahead[{sha,subject}], more}, dirty{currentCount,lost[],committedSince[],stillDirty[]}, skipped[]}` | 7 |
| `reading-plan` | `--doc <경로>` `--budget <바이트>` | `{entries[{path,status: "read"\|"range"\|"partial"\|"skipped-missing"\|"skipped-invalid"\|"skipped-budget",range,bytes,lines,outline?}], totalBytes, budget}` | 5 |
| `ledger-carry` | `--doc <이전 문서>` `--epic <id>` | `{rows[], pointer, droppedDone}` (D5) | 8 |
| `latest-epic` | `--dir <폴더>` | `{epic\|null, doc\|null}` | 8 |
| `resolve-path` | `--slug <s>` `--date <YYYY-MM-DD>` `--dir <폴더>` | `{path, slug, normalized}`. 정규화 뒤 slug가 비면 exit 1 | 9 |
| `list` | `--dir <폴더>` | `{docs[{path,date,slug,branch,head,title,mtimeMs}]}` 최신순, 첫 줄이 `# HANDOFF —`인 파일만 | 9 |
| `latest` | `--dir <폴더>` `--branch <현재 브랜치>` | `{doc, candidates[], needsChoice}` | 9 |

---

## A. 준비

### Task 1: 스킬이 스크립트를 실행할 수 있는지 먼저 본다 (SPEC 7절 위험 행)

**Files:** 저장소 밖의 임시 플러그인 폴더만 쓴다. 커밋하는 파일 없음.

**Interfaces:**
- Produces: `{HANDOFF_JS}`로 쓸 경로 표기 하나, 그리고 "권한 프롬프트 없이 실행됨 / 매번 묻는다 / 거부된다" 중 어느 쪽인지의 기록.

- [ ] **Step 1: 시험 스킬을 만든다**

임시 폴더에 `.claude-plugin/plugin.json`, `skills/ping/SKILL.md`, `skills/ping/scripts/ping.mjs`를 만든다. `ping.mjs`는 `{ node: process.version, argv: process.argv.slice(2), cwd: process.cwd() }`를 JSON 한 줄로 출력한다. `SKILL.md` 본문은 같은 스크립트를 세 가지 표기로 실행하라고 적는다: `{CLAUDE_PLUGIN_ROOT}/skills/ping/scripts/ping.mjs`, 스킬 머리말의 "Base directory"에 `scripts/ping.mjs`를 이은 절대 경로, `${CLAUDE_SKILL_DIR}/scripts/ping.mjs`.

- [ ] **Step 2: `claude --plugin-dir <임시 폴더>`로 연 세션에서 `/ping`을 돌린다**

Bash 도구(Git Bash)와 PowerShell 도구에서 각각 세 표기를 돌린다. 기록할 것: 어느 표기가 경로로 풀리는지, 권한 프롬프트나 분류기 거부가 있었는지, 한글이 든 인자(`--slug 한글`)가 그대로 오는지.

- [ ] **Step 3: Node가 없을 때의 실패 모양을 본다**

PATH에서 `node`를 뺀 셸에서 한 번 돌린다. 오류가 stderr에 명시적으로 드러나는지만 확인한다.

- [ ] **Step 4: 결과를 판정하고 사용자에게 알린다**

통과 기준: 표기 하나 이상이 두 셸 모두에서 프롬프트 없이 실행된다. 통과하면 그 표기를 `{HANDOFF_JS}` 표기로 고정한다. 프롬프트가 매번 뜨거나 거부되면 **여기서 멈추고** 사용자에게 두 가지를 묻는다: (a) 첫 실행 시 허용 안내를 README에 적고 계획대로 진행, (b) 스크립트 이관을 철회하고 SPEC 3.3의 세 번째 행을 산문 유지로 바꾼다. (b)를 고르면 이 계획의 Task 3·5~9의 스크립트 부분은 테스트 가능한 산문 규칙으로 바뀌므로 계획을 고쳐 다시 승인받는다. 결과는 BASELINE에 Task 14에서 적는다.

### Task 2: 말뭉치를 고정하고 기준선을 다시 잰다

**Files:**
- Create: `tests/handoff/corpus/snapshot.mjs`, `tests/handoff/corpus/measure.mjs`

**Interfaces:**
- Produces: `node tests/handoff/corpus/snapshot.mjs --roots <폴더>… --out <폴더>` — 첫 줄이 `# HANDOFF —`인 문서를 모두 `--out`에 복사하고 `manifest.json`을 쓴다(문서마다 순번 id, sha256, 바이트, 파일 mtime, 그 문서의 Reading Order 엔트리가 가리키는 파일의 존재·바이트·행 수). 이후 모든 비교는 이 스냅샷으로만 한다. `node tests/handoff/corpus/measure.mjs --corpus <폴더>` — SPEC 6절 지표를 표로 출력한다.

- [ ] **Step 1: 이름과 경로를 출력하지 않는 도구를 쓴다**

`snapshot.mjs`는 `--roots`로 받은 경로를 매니페스트에 쓰지 않는다. 문서 id는 복사 순번이다. 도구 안에 저장소·사람 이름을 상수로 두지 않는다.

- [ ] **Step 2: 스냅샷을 만든다 (저장소 밖 폴더)**

`--roots`에는 작업 저장소들의 `docs/harness/handoff/` 폴더를 준다(작업 트리 안의 `.worktrees/*/docs/harness/handoff/` 포함). 첫 줄 검사 때문에 같은 폴더의 설계 문서 등은 걸러진다.
Expected: 문서 수가 감사 때의 276보다 많다(2026-11-18 조사에서 292건). 그 수를 기록한다.

- [ ] **Step 3: 기준선을 잰다**

`measure.mjs`가 낼 지표(현행 계약 기준): 문서 수, resume 읽기량(Reading Order 파일 합, 2,000줄 초과는 건너뜀 — 중앙값·P90·최대)과 2,000줄 초과 대상 비율, `Next :`의 출처(in-progress / 라벨 / 마지막 행)별 건수와 "라벨과 in-progress가 모두 있는데 값이 다른 문서" 수, 원장 문서 수·행 수 중앙값·최대·50행 초과·100행 초과, in-progress가 2행 이상인 문서 수, 기록된 `Docs` 중 `docs/harness/` 아래인 수, 원장이 문서 바이트에서 차지하는 비중.
`measure.mjs`는 `Next :` 출처를 아직 계산하지 않는다 — 그 부분은 Task 3의 `legacy_next.mjs`를 호출한다. 이 Step에서는 나머지를 잰다.

- [ ] **Step 4: 감사 때의 값과 비교한다**

감사 값(276건): 읽기량 중앙값 270KB·2,329줄, 라벨·in-progress 불일치 58건 중 13건, 원장 236건, 행 수 중앙값 13·최대 261, `Docs`가 `docs/harness/` 아래인 것 56건. 스냅샷 중 감사 시각 이전 mtime의 문서만 뽑은 부분집합에서 같은 지표를 내고 차이를 표로 남긴다. 차이는 맞추지 않고 보고한다(스냅샷 방식이 감사의 방식과 다르다).

- [ ] **Step 5: Commit**

`test(handoff): add corpus snapshot and measurement tools (no corpus data)`

### Task 3: 현행 동작을 재현하는 파서와 테스트 러너

**Files:**
- Create: `skills/handoff/scripts/handoff.mjs`, `skills/handoff/scripts/lib/parse.mjs`, `tests/handoff/run.mjs`, `tests/handoff/cases.mjs`, `tests/handoff/corpus/legacy_next.mjs`, `tests/handoff/corpus/diff.mjs`, `tests/handoff/fixtures/*.md`
- Modify: `.gitattributes`, `.github/workflows/lint.yml`

**Interfaces:**
- Produces: `parse` 하위 명령(위 표). `legacy_next.mjs`는 `deriveLegacyNext(parsed) -> {slice, source}`로, 9.0.1 계약의 3단 파생(원장의 마지막 in-progress → 없으면 Next Steps 1번의 라벨 → 마지막 행 → `Docs` 마지막 구간 → 1번 원문)을 그대로 구현한다. 배포 스크립트가 아니라 테스트 쪽에 둔다 — 낡은 규칙이 배포본에 남지 않게 한다. `diff.mjs --corpus <폴더> --what <이름>`은 Task 5~8이 `--what`을 하나씩 더하는 전후 비교기다.

- [ ] **Step 1: 합성 픽스처와 케이스를 먼저 쓴다**

`tests/handoff/fixtures/`에 합성 문서를 만든다(실제 문서를 줄여 쓰지 않는다). 파일마다 한 상황: `label-and-inprogress-differ`, `no-label-two-inprogress`, `done-only-last-row`, `bold-wrapped-status`, `no-ledger-with-docs-label`, `no-ledger-no-docs`, `negated-command-token`, `two-command-tokens`, `path-like-token`(`/dev/null`), `legacy-no-labels`, `heading-variant`(`## Definition of Done (v3 계획)`), `reading-order-forms`(범위·`이 문서`·비파일 엔트리). `cases.mjs`는 `parse`의 출력을 단언한다. 케이스 이름과 단언의 예:
- `parse-ledger-status-strips-emphasis`: `**in-progress**` → `status === "in-progress"`
- `parse-step-one-candidates-skip-nothing`: `candidates`는 백틱 `/…` 토큰을 걸러내지 않고 모두 낸다(걸러내는 것은 Task 6)
- `parse-heading-prefix`: `Definition of Done (v3 계획)` 절이 `sections["Definition of Done"]`에 든다
- `parse-legacy-has-no-new-fields`: `worktree === null`, `harness === "absent"`
- `parse-rejects-non-handoff`: 첫 줄이 `# HANDOFF —`가 아니면 exit 1

- [ ] **Step 2: 러너를 쓰고 실패를 본다**

`run.mjs`는 `cases.mjs`의 각 케이스를 실행해 `N pass, M fail`을 출력하고 하나라도 실패하면 exit 1이다. 중복 id는 exit 2다.
Run: `node tests/handoff/run.mjs` → Expected: exit 1 (모듈 없음).

- [ ] **Step 3: `parse.mjs`와 `handoff.mjs`를 구현한다**

시그니처: `parseHandoff(text: string) -> Parsed`. 규칙: 영어 제목은 접두 일치로 읽는다(H14). `Status`·`Epic` 셀은 `**`·`__`·백틱 한 쌍을 벗겨 읽는다. 알 수 없는 필드는 `null`로 둔다. 파일을 읽는 것은 `handoff.mjs`의 몫이다.

- [ ] **Step 4: 현행 파생을 `legacy_next.mjs`로 재현하고 말뭉치로 확인한다**

`docs/harness/v9-audit/scripts/handoff_corpus/agg.js` (gitignored — not a public link)의 `Next :` 분류를 읽고, 같은 스냅샷에서 두 구현의 분류(출처와 값)를 문서 단위로 비교한다. 통과 기준: 모든 문서에서 일치. 불일치는 목록으로 남기고 문서마다 "9.0.1 계약 문장이 맞는지, `agg.js`가 맞는지"를 판정해 `legacy_next.mjs`를 계약 문장 쪽에 맞춘다. 그 뒤 `measure.mjs`에 `Next :` 지표를 연결하고 Task 2의 표를 완성한다.

- [ ] **Step 5: 줄 끝과 CI를 연결한다**

`.gitattributes`에 `skills/handoff/scripts/**/*.mjs text eol=lf`를 더한다(`tests/**/*.mjs`는 이미 있다). `lint.yml`에 `- run: node tests/handoff/run.mjs`를 한 줄 단계로 더한다. `bash .github/scripts/check_lint_wiring.sh`가 통과해야 한다. `CLAUDE.md`의 Commands 표에 같은 명령을 더한다.

- [ ] **Step 6: 게이트 G → Commit**

`feat(handoff): add the document parser, its test runner and a characterization of the current Next derivation`

---

## B. 분할

### Task 4: 본문을 generate와 resume으로 기계적으로 나눈다 (H15의 첫 절반)

**Files:**
- Create: `templates/handoff/generate.md`, `templates/handoff/resume.md`
- Modify: `skills/handoff/SKILL.md`, `skills/harness-build/SKILL.md`, `templates/_shared/session_boundary.md`, `templates/_shared/mode_gate.md`, `README.md`, `scripts/verify_sync_markers.py`, `scripts/verify_git_safety.py`

**Interfaces:**
- Produces: `SKILL.md`는 분기표에서 호출된 쪽 파일 하나만 읽게 한다(`/harness`가 `templates/harness/doctor.md`를 가리키는 문장 형식을 따른다 — 먼저 그 문장을 읽는다). 절 이름은 바꾸지 않는다. 옛 `§Sub-command: generate`는 `templates/handoff/generate.md`로, `§Sub-command: resume`은 `templates/handoff/resume.md`로 간다.

- [ ] **Step 1: 인벤토리를 먼저 뽑는다**

Run (`MSYS_NO_PATHCONV=1`): `grep -rn "handoff/SKILL.md" skills templates workflows scripts README.md CLAUDE.md`
현재 알려진 곳: `skills/harness-build/SKILL.md` 4곳(generate 필드, "Start next step", resume 절, 백틱 정규화), `templates/_shared/mode_gate.md` 3곳(`§Step 5`), `templates/_shared/session_boundary.md` 2곳(`§Fixed Label Record Format`), `README.md` 2곳(`§Sub-command: resume`), `scripts/verify_sync_markers.py`의 `handoff-state-record`(대상 파일·앵커)와 `slice-command-format`(handoff 쪽 마커), `scripts/verify_git_safety.py`의 `("skills/handoff/SKILL.md", "git clean -fdx")` 예외. 이 목록을 커밋 메시지에 건수와 함께 적는다. 이 인용은 어느 린트도 `§` 이름을 보지 않으므로 바뀐 곳을 이 grep으로만 확인한다.

- [ ] **Step 2: 분할한다 — 의미는 바꾸지 않는다**

`SKILL.md`에 남기는 것: 머리말, "What this is NOT", 언어 감지, 분기표와 위치 규칙, `list`, Non-Goals. generate 절은 `templates/handoff/generate.md`로, resume 절은 `templates/handoff/resume.md`로 옮긴다. 옮기는 본문은 한 글자도 고치지 않는다. 분기표의 두 행과 각 파일 첫머리에 포인터 문장만 더한다.

- [ ] **Step 3: 이동을 기계적으로 검사한다**

Run: 분할 전 `SKILL.md`(`git show HEAD:skills/handoff/SKILL.md`)에서 비어 있지 않은 줄을 `sort -u`한 것과, 새 세 파일의 같은 처리 결과를 `comm -23`한다.
Expected: 출력은 이 Task가 의도해서 바꾼 줄(포인터 문장, 인용 갱신)뿐이다. 그 줄들을 Step 1의 목록과 대조한다.

- [ ] **Step 3b: 인용을 새 위치로 고친다**

Step 1의 각 곳을 새 파일 경로 앵커(`templates/handoff/resume.md` §Step 5 등)로 고친다. `verify_sync_markers.py`의 `handoff-state-record`는 대상 파일을 `templates/handoff/generate.md`로, `session_boundary.md`의 `SYNC-WITH` 주석도 같게 고친다. `min_sites`는 바꾸지 않는다. `verify_git_safety.py`의 예외 키는 `git clean -fdx` 문장이 옮겨 간 `templates/handoff/generate.md`로 바꾼다.

- [ ] **Step 4: 확인**

Run: Step 1의 grep을 다시 → `skills/handoff/SKILL.md`로 가리키는 곳이 `§Sub-command`·`§Step 5`·`§Fixed Label Record Format` 형태로 남아 있지 않다. 게이트 G.

- [ ] **Step 5: Commit**

`refactor(handoff): split the contract into a dispatcher and per-subcommand templates, moving text unchanged (H15)`

---

## C. 규칙 수정

공통 순서(Task 5~9): 케이스를 먼저 쓰고 실패를 본다 → 스크립트를 고친다 → 계약 문장을 고친다 → 말뭉치 전후 비교 → 게이트 G → Commit. 말뭉치 비교는 `node tests/handoff/corpus/diff.mjs --corpus <폴더> --what <이름>`이고, 결과는 저장소 밖에 두며 요약 수치만 BASELINE에 적는다.

### Task 5: Reading Order에 범위와 예산을 둔다 (H1, H4)

**Files:**
- Create: `skills/handoff/scripts/lib/reading.mjs`, `skills/handoff/scripts/lib/paths.mjs`
- Modify: `skills/handoff/scripts/handoff.mjs`, `skills/handoff/scripts/lib/parse.mjs`, `templates/handoff/resume.md`, `templates/handoff/generate.md`, `tests/handoff/cases.mjs`, `tests/handoff/corpus/diff.mjs`

**Interfaces:**
- Consumes: Task 3의 `parse`의 `readingOrder[{raw,path,range,isFile}]`.
- Produces: `reading-plan`(위 표). 범위는 D4의 두 형태. 경로 검사 `validateHandoffPath(path: string, root: string) -> {ok: boolean, reason?: string}`: 상대 경로이거나 `root` 안의 절대 경로, `..` 구간 없음, `.git/` 밖. `docs/harness/` 아래를 허용한다.

- [ ] **Step 1: 케이스를 쓰고 실패를 본다**

- `reading-plan-line-range`: `src/a.js:120-180` → `status "range"`, `bytes`가 그 행들의 바이트
- `reading-plan-section-range`: `docs/x.md §Foo` → 제목에 `Foo`가 든 절만, 없으면 `status "partial"`과 `outline`
- `reading-plan-oversize-without-range`: 2,000줄 초과·범위 없음 → `status "partial"`, 앞 400행, `outline` 포함, 건너뛰지 않음
- `reading-plan-budget-order`: 예산이 모자라면 문서 순서상 뒤의 엔트리부터 `"skipped-budget"`
- `reading-plan-docs-harness-allowed`: `docs/harness/x/y.md`가 읽힌다
- `reading-plan-rejects`: `../x`, `.git/config`, 저장소 밖 절대 경로 → `"skipped-invalid"`
- `reading-plan-non-file-entry`: `memory 항목`, `git log …` 같은 엔트리 → `isFile false`, 건너뜀 사유 `not a file`
- `reading-plan-self-entry`: `이 문서` → 그 문서 자신
Run: `node tests/handoff/run.mjs` → Expected: 새 케이스가 FAIL.

- [ ] **Step 2: 구현한다**

`reading.mjs`: `planReading(entries, root, budgetBytes) -> Plan` — 엔트리를 문서 순서로 처리하고 예산을 누적한다. 목차는 `^#{1,3} ` 제목과 행 번호다. 구현 방법은 파일을 줄 단위로 한 번 읽는 것으로 충분하다.

- [ ] **Step 3: 예산 B를 잰다 (D3)**

`diff.mjs --what reading`이 스냅샷으로 문서마다 읽기량을 범위 인식 정책으로 구해 분포(중앙값·P90·최대)와 후보 B(64·96·128KB)별로 예산 때문에 건너뛰는 엔트리 비율을 표로 낸다. D3의 규칙으로 B를 정해 이 Step의 출력에 적는다. B는 `templates/handoff/resume.md`에 한 번만 쓰는 상수다.

- [ ] **Step 4: 계약을 고친다**

`resume.md` Step 4를 "`reading-plan` 출력대로 읽는다"로 바꾼다 — 상태가 `range`·`partial`이면 그 범위만 읽고 사유를 브리핑에 적는다. `skipped-*`는 사유와 함께 나열한다. `validate_path(kind=file_reference)` 인용을 지우고 `validateHandoffPath`의 네 조건을 이 파일이 소유한다고 적는다. `generate.md`의 Reading Order 항목에 범위 표기(D4)를 허용한다고 쓴다.

- [ ] **Step 5: 말뭉치로 확인한다**

Expected: (a) 범위 인식 정책의 읽기량 중앙값 ≤ B, 기준선(Task 2의 270KB급)보다 작다. (b) 스냅샷에서 기록된 `Docs`가 `docs/harness/` 아래인 문서 전부가 `validateHandoffPath`를 통과한다(기준선에서는 현행 검증기가 거부하던 56건). (c) `..`·`.git/`를 포함한 경로를 가진 엔트리는 거부로 남는다. 세 수치를 기록한다.

- [ ] **Step 6: 게이트 G → Commit**

`feat(handoff): read Reading Order entries by range under a measured budget and check paths with a handoff-specific rule (H1, H4)`

### Task 6: `Next :`는 라벨을 우선하고 후보 규칙을 정한다 (H2, H10)

**Files:**
- Modify: `skills/handoff/scripts/handoff.mjs`, `skills/handoff/scripts/lib/parse.mjs`, `templates/handoff/resume.md`, `tests/handoff/cases.mjs`, `tests/handoff/corpus/diff.mjs`

**Interfaces:**
- Consumes: Task 3의 `parse`.
- Produces: `next`(위 표, D6). `stepOne.candidates`는 슬래시 명령 모양(`/` + 소문자 시작 이름 하나, 뒤에 인자 허용, 두 번째 `/` 구간으로 이어지는 경로 모양 제외)의 백틱 토큰이고, `/handoff` 자신은 제외한다.

- [ ] **Step 1: 케이스를 쓰고 실패를 본다**

- `next-label-wins`: 라벨 X, in-progress 행 Y·Z → `slice X`, `source "label"`
- `next-single-in-progress`: 라벨 없음, in-progress 1행 → 그 행, `"in-progress"`
- `next-two-in-progress-no-label`: 라벨 없음, 2행 → `slice null`, `ambiguous`에 두 행, 출처 `"step-one"`
- `next-done-only`: 라벨 없음, in-progress 0행 → 끝난 슬라이스(마지막 행)를 내지 않고 `"docs"` 또는 `"step-one"`
- `next-bold-status`: `**in-progress**`가 in-progress로 센다
- `next-docs-tier-needs-relevance`: `--state-relevant false`이면 `Docs` 구간을 쓰지 않는다
- `cmd-skips-path-like`: `/dev/null`은 후보가 아니다
- `cmd-skips-self`: `/handoff`는 후보가 아니다
- `cmd-whole-token`: `` `/harness --output-dir x "slice-a"` ``는 통째로 한 후보다
- `cmd-two-candidates-both-listed`, `cmd-zero`

- [ ] **Step 2: 구현한다 → 통과를 본다**

`next(parsed, {stateRelevant}) -> NextResult` (D6 순서).

- [ ] **Step 3: 계약을 고친다**

`resume.md` Step 5의 `Next :` 파생 절을 D6의 네 단으로 줄인다. 모호한 경우의 출력 줄을 고정한다: `(Next : ambiguous — <N> in-progress rows; Next Steps item 1 follows)`. 후보 판별 중 **부정·배제 문장 판단은 산문에 남긴다**(스크립트는 토큰만 낸다). 게이트의 정의되지 않던 분기를 정한다: 후보가 2개 이상이면 첫 선택지를 만들지 않고, 후보를 번호로 나열한 뒤 "계획 조정"을 권한다 — AskUserQuestion은 여전히 정확히 한 번이다.

- [ ] **Step 4: 말뭉치로 확인한다**

`diff.mjs --what next`: 같은 스냅샷에서 `legacy_next`와 `next`를 문서 단위로 비교해 변경을 세 종류로 분류한다 — 라벨로 바뀜 / 모호로 바뀜 / 그 밖.
Expected: (a) 라벨과 in-progress가 모두 있고 값이 달랐던 문서(기준선 값)에서 새 `Next :`가 라벨 값인 비율 100%. (b) "그 밖"으로 분류된 변경 0건 — 라벨 없이 in-progress가 1행이었던 문서의 값은 그대로다. (c) 모호로 바뀐 문서 수를 보고한다.

- [ ] **Step 5: 게이트 G → Commit**

`fix(handoff): prefer the Slice label over the last in-progress row and define the command-candidate rules (H2, H10)`

### Task 7: 상태 관련성, 기준 디렉터리, 미커밋 유실을 다룬다 (H3, H5, H6, H9)

**Files:**
- Create: `skills/handoff/scripts/lib/git.mjs`, `tests/handoff/mkrepo.mjs`
- Modify: `skills/handoff/scripts/handoff.mjs`, `skills/handoff/scripts/lib/parse.mjs`, `templates/handoff/generate.md`, `templates/handoff/resume.md`, `templates/_shared/session_boundary.md`, `tests/handoff/cases.mjs`

**Interfaces:**
- Produces: `git-state`, `harness-state`, `drift`(위 표). 헤더 필드(D7). `mkrepo.mjs`는 `makeRepo({commits, dirty, detached, worktree}) -> {dir, cleanup()}`로 임시 폴더에 git 저장소를 만든다(테스트 쪽이므로 `git checkout`·`reset` 같은 명령을 써도 된다 — 린트 대상이 아니다).

- [ ] **Step 1: 케이스를 쓰고 실패를 본다**

- `git-state-clean`, `git-state-dirty-lists-every-path`, `git-state-detached`(`branch "(detached)"`), `git-state-not-a-repo`(`isGit false`, exit 0)
- `harness-state-absent`, `harness-state-other-branch`(`relevant false`), `harness-state-completed`(`relevant false`), `harness-state-match`(`true`)
- `drift-same`, `drift-forward`, `drift-backward`, `drift-diverged`(amend 뒤)
- `drift-dirty-lost`: 문서가 `a.txt`를 dirty로 기록, 지금은 되돌려 clean → `dirty.lost === ["a.txt"]`
- `drift-dirty-committed-since`: 그 뒤 커밋됨 → `committedSince`, `lost` 아님
- `drift-worktree-from-main`: 링크된 워크트리에서 만든 문서를 메인 트리에서 → `branch.same true`, `viaWorktree true`
- `drift-worktree-gone`: 기록된 워크트리 폴더가 없음 → `skipped`에 사유, 경보 없음
- `parse-new-header-fields`: `Worktree:`·`Dirty files:`가 파싱된다
Run → Expected: FAIL.

- [ ] **Step 2: 구현한다**

`git.mjs`: `gitState(cwd)`, `drift(parsed, cwd)`, `harnessState(cwd, branch)`. 관련성 규칙: `.harness/state.json`이 있고, 그 `branch`가 현재 브랜치와 같고, `phase`가 `completed`가 아니면 `relevant`. git 명령은 모두 읽기 전용이다.

- [ ] **Step 3: generate 계약을 고친다**

Step 1 item 1을 `git-state`를 쓰게 하고, 헤더 틀에 D7의 두 필드를 더한다. item 2는 `harness-state`가 `relevant`일 때만 다섯 줄 고정 라벨 기록을 쓰게 하고, 아니면 `Harness : none (<reason>)` 한 줄을 쓰게 한다. 비-git 폴더의 헤더 값(`Branch: n/a`)과 detached(`Branch: (detached)`)를 정의한다.

- [ ] **Step 4: 공유 계약을 같은 커밋에서 고친다**

`templates/_shared/session_boundary.md`에 한 문장을 더한다: handoff generate는 현재 브랜치와 `branch`가 같고 `phase`가 `completed`가 아닌 state.json에 대해서만 고정 라벨 기록을 쓰고, 그 밖에는 `Harness : none (…)`을 쓴다. `handoff-state-record` 그룹의 토큰 5개와 `min_sites`는 그대로다.

- [ ] **Step 5: resume 계약을 고친다**

Step 3(드리프트)은 `drift` 출력을 쓰고 `dirty.lost`를 "기록 당시 dirty였는데 지금 없는 것"으로 보고한다. Step 3.5는 `harness-state`를 쓴다 — 관련 없으면 `/harness` 재진입 안내와 `Docs` 단을 끈다. 문서에 고정 라벨도 `Harness :`도 없으면 "기록 없음 — 하네스 상태 검증 대상 아님"으로, `Harness : none`이면 "하네스 태스크 없음"으로 표시한다("legacy"라는 말을 쓰지 않는다). 기준 디렉터리를 명시한다: 헤더의 `Worktree`가 있고 그 폴더가 있으면 `git -C <worktree>`로 검증한다. 스크립트 실패(exit ≠ 0)는 stderr를 그대로 보여 주고 멈춘다.

- [ ] **Step 6: 말뭉치로 확인한다**

`diff.mjs --what state`: 스냅샷의 고정 라벨이 있는 문서 중 `harness-state`가 현재 `relevant false`인 것의 수와, 그 문서들에서 새 resume이 재진입 안내를 내지 않는지를 센다. 감사의 stale 라벨 표본(문서에 "무관·stale" 단서가 붙은 것)에서 재진입 안내가 0건이어야 한다.

- [ ] **Step 7: 게이트 G → Commit**

`fix(handoff): judge task-state relevance, record the worktree and dirty paths, and report lost uncommitted work (H3, H5, H6, H9)`

### Task 8: Progress Ledger를 줄인다 (H7, H8, H11)

**Files:**
- Create: `skills/handoff/scripts/lib/ledger.mjs`
- Modify: `skills/handoff/scripts/handoff.mjs`, `templates/handoff/generate.md`, `templates/handoff/resume.md`, `tests/handoff/cases.mjs`, `tests/handoff/corpus/diff.mjs`, `ROADMAP.md`

**Interfaces:**
- Produces: `ledger-carry`, `latest-epic`(위 표). `Status` 값 `planned`를 더해 enum은 `done` / `in-progress` / `blocked` / `planned` / `dropped`다.

- [ ] **Step 1: 케이스를 쓰고 실패를 본다**

- `ledger-carry-keeps-every-unfinished`: `in-progress`·`blocked`·`planned` 행은 전부 남는다
- `ledger-carry-keeps-last-five-done`: done은 최근 5개, `droppedDone`이 나머지 수
- `ledger-carry-pointer`: `pointer`가 이전 문서 파일 이름
- `ledger-carry-other-epic-not-carried`
- `ledger-carry-normalizes-cells`: `**blocked**`, 백틱 `Epic`
- `ledger-carry-never-drops-unfinished-when-large`: 미완 행이 15개여도 모두 남는다
- `latest-epic-newest-ledger-doc`, `latest-epic-last-row-when-several`, `latest-epic-none`
Run → Expected: FAIL.

- [ ] **Step 2: 구현한다 → 통과**

`carryLedger(rows, epic, {keepDone = 5}) -> {rows, droppedDone}`. 한 문서 안의 행 순서는 보존한다.

- [ ] **Step 3: generate 계약을 고친다**

Step 1 item 5를 고친다 — (a) Epic은 `latest-epic`이 낸 값을 제안으로 쓰고, 그 값이 없거나 이번 세션의 작업이 다른 Epic이라는 구체적 근거(사용자가 다른 id를 말함)가 있을 때만 묻는다. (b) 이월 원본은 `ledger-carry`가 고른다 — 통독하지 않는다. (c) 이월은 D5. (d) done 행이 줄었으면 `ledger-carry`의 `pointer`로 "Earlier rows: <파일 이름>" 줄을 표 아래에 쓴다. (e) 열 계약에 `planned`와 "Evidence는 전체 40자 sha 또는 경로"를 쓴다. resume의 `Next :`·Ledger 해석에 `planned`를 더한다. ROADMAP의 `Epic` 셀 정규화 유보 항목 행 안에 "닫힘(3단계, `parse`가 정규화)" 정정을 덧붙인다 — 행을 지우지 않는다.

- [ ] **Step 4: 말뭉치로 확인한다**

`diff.mjs --what ledger`: 원장이 있는 모든 문서를 현재 규칙으로 다시 이월했을 때 (a) 100행을 넘던 문서의 이월 행 수 ≤ 20(SPEC 3.2의 기준), (b) 모든 문서에서 미완 행의 수가 이월 전후 같다(0건 손실), (c) 한 문서에 Epic이 여러 개인 경우 선택한 Epic 행만 나온다. (a)를 못 채우는 문서가 있으면 그 수와 이유를 기록하고 D5를 사용자와 다시 정한다.

- [ ] **Step 5: 게이트 G → Commit**

`fix(handoff): carry only unfinished ledger rows forward, add the planned status and propose the Epic from the previous ledger (H7, H8, H11)`

### Task 9: 최신 문서 선택, slug, 문서 형식을 정한다 (H12, H13, H14)

**Files:**
- Modify: `skills/handoff/scripts/handoff.mjs`, `skills/handoff/scripts/lib/paths.mjs`, `skills/handoff/scripts/lib/parse.mjs`, `skills/handoff/SKILL.md`, `templates/handoff/generate.md`, `templates/handoff/resume.md`, `tests/handoff/cases.mjs`

**Interfaces:**
- Produces: `resolve-path`, `list`, `latest`(위 표). slug 규칙: 영문 소문자·숫자·`-`, 최대 40자. 영문 요약을 만드는 것은 모델이고, 스크립트는 정규화와 충돌 처리만 한다.

- [ ] **Step 1: 케이스를 쓰고 실패를 본다**

- `resolve-path-collision-suffix`: 같은 이름이 있으면 `-2`, 그것도 있으면 `-3`
- `resolve-path-normalizes`: `Hello World!` → `hello-world`, `normalized true`
- `resolve-path-caps-40`
- `resolve-path-empty-after-normalize`: 한글만 → exit 1과 "영문 요약을 주라"는 메시지
- `list-order`: 파일 이름 날짜 → 접미사 번호 → mtime
- `list-skips-non-handoff-md`: 첫 줄이 `# HANDOFF —`가 아니면 제외
- `latest-same-day-different-branch`: 같은 날 2건이고 기록 브랜치가 현재와 다른 것이 섞이면 `needsChoice true`와 후보
- `latest-prefers-current-branch-descendant`: 하나만 현재 브랜치이고 HEAD가 기록 sha의 후손이면 그것을 고른다
- `parse-do-not-reference-only`: `Do NOT` 본문이 이전 문서 참조뿐이면 `doNotRefOnly true`
Run → Expected: FAIL.

- [ ] **Step 2: 구현한다 → 통과**

- [ ] **Step 3: 계약을 고친다**

위치 규칙(`SKILL.md`)의 slug 문장을 "영문 kebab 요약, 40자, `[a-z0-9-]`, 비-ASCII 음역을 하지 않는다"로 고친다. generate Step 4는 `resolve-path`를 쓰고 보고문의 "재실행하면 `-2`"를 "새 파일(이름은 달라질 수 있음)"로 고친다. resume Step 1은 `latest`를 쓰고, `needsChoice`면 후보를 보여 주고 고르게 한다(AskUserQuestion 1회 규칙은 그대로 — 이 질문은 브리핑 전의 선택이다). `Do NOT`은 이전 문서 참조만으로 승계하지 않고 본문에 다시 쓴다고 generate에 적고, resume은 `doNotRefOnly`면 참조된 문서의 절을 읽는다.

- [ ] **Step 4: 게이트 G → Commit**

`fix(handoff): define latest-document selection, the slug rule and the Do NOT carry-over form (H12, H13, H14)`

---

## D. 감량

### Task 10: 근거를 `design/`으로 옮기고 본문에 규칙만 남긴다 (H15의 나머지)

**Files:**
- Create: `design/handoff-diet/RATIONALE.md`
- Modify: `skills/handoff/SKILL.md`, `templates/handoff/generate.md`, `templates/handoff/resume.md`, `templates/_shared/mode_gate.md`

- [ ] **Step 1: 옮길 것을 분류한다**

현재 `generate.md`·`resume.md`·`SKILL.md`를 읽고 문단마다 "규칙(본문에 남김)"과 "근거(옮김)"로 나눈다. 근거에 해당하는 것: `Measured`·`Observed` 날짜가 붙은 측정 기록, 기각된 대안, 해소 불가 인용(`spec.md:407`, "spec D-4/D-5", `AC-` 번호, "NEW, P0-1"), "Why there is no confirmation…" 같은 이력 서사, 에픽 `harness-handoff-coldreview-epic-slice`의 "이 변경이 무효로 만든 세 요구" 블록(그 슬라이스는 출하됐다). 규칙 문장은 하나도 지우지 않는다 — 판단이 서지 않는 문단은 남긴다.

- [ ] **Step 2: `RATIONALE.md`를 쓴다**

옮긴 문단마다 `원문 위치(절 이름) → 본문에 남은 규칙 문장`을 한 줄로 적는다(그 표가 "규칙이 안 사라졌다"의 증거다). 공개 위생: 측정은 "이 저장소의 handoff 말뭉치"로만 부르고 저장소 이름·경로를 쓰지 않는다.

- [ ] **Step 3: 본문에서 지운다 → 규칙만 남은 문장으로 고친다**

STAGE2에서 넘겨받은 규칙 5는 한 문장으로 줄이고 이유를 RATIONALE에 둔다. `templates/_shared/mode_gate.md`의 rule 3 원인 (a)가 handoff `§Step 5`의 "두 결과"를 인용하는 곳 3곳은 인용을 RATIONALE의 해당 절로 바꾼다 — 단일 소스의 의미는 바꾸지 않는다.

- [ ] **Step 4: 확인**

Run: `grep -rnE "(Observed|Measured|MEASURED|OBSERVED)[^.]{0,40}20[0-9]{2}" skills/handoff templates/handoff` → 출력 없음. `generate` 적재량(D2)을 `git ls-tree -r -l`이 아니라 아직 커밋 전이므로 `\r`를 뺀 바이트로 재어 ≤ 15,360인지 본다. 넘으면 결정적 절차의 서술을 스크립트 호출 한 줄로 더 줄인다(규칙은 줄이지 않는다). 게이트 G.

- [ ] **Step 5: Commit**

`docs(handoff): move measurement history and rejected alternatives to design/handoff-diet (H15)`

### Task 11: 재팽창을 막는 린트를 더한다

**Files:**
- Create: `scripts/verify_body_budget.py`
- Modify: `.github/workflows/lint.yml`, `CLAUDE.md`

**Interfaces:**
- Produces: `python scripts/verify_body_budget.py` — 종료 코드 `0` 통과, `1` 위반, `2` 구조 문제. 검사: (1) 스킬 6개의 `SKILL.md` 본문 상한(측정값, 여유 0 — 내리는 것은 자유, 올리려면 같은 커밋에서 상한을 명시적으로 올린다), (2) handoff의 generate 적재량 ≤ 15,360(D2)과 resume 적재량(`SKILL.md` + `resume.md`)의 상한(측정값), (3) `skills/handoff/SKILL.md`와 `templates/handoff/*.md`에 날짜 표지 `(Observed|Measured|MEASURED|OBSERVED)` 뒤 40자 안에 `20dd`가 있는 줄이 0건. 측정 기준(`\r` 제외 UTF-8 바이트)은 독스트링 맨 앞에 쓴다.

- [ ] **Step 1: 시험으로 먼저 실패를 만든다**

`verify_body_budget.py`를 상한 없이 쓰고 Run → Expected: exit 2. 상한을 측정값으로 채운다.

- [ ] **Step 2: 세 곳에서 동작을 확인한다**

handoff 본문 파일에 1바이트를 더하면 exit 1, 되돌리면 0. 날짜 표지를 한 줄 넣으면 exit 1, 지우면 0.

- [ ] **Step 3: 배선을 같은 커밋에서 한다**

`lint.yml`에 `- run: python3 scripts/verify_body_budget.py`를 한 줄 단계로, `CLAUDE.md`의 `lint-cmd` 줄 끝과 Commands 표에 더한다. `CLAUDE.md`의 "8 self-consistency lints"·"The eight lints" 서술을 9로 고치고 Verification 절에 이 린트 항목을 더한다. `bash .github/scripts/check_lint_wiring.sh` → `OK`. `git ls-files --eol scripts/verify_body_budget.py`가 `i/lf`.

- [ ] **Step 4: 게이트 G → Commit**

`feat(lint): cap skill body size and ban dated measurement markers in the handoff contract`

---

## E. 검증과 릴리스

### Task 12: 말뭉치 전체 회귀 (SPEC 3.4)

**Files:** 저장소 밖 보고서만 쓴다. 커밋하는 파일 없음.

- [ ] **Step 1: 전체 비교를 돌린다**

Run: `node tests/handoff/corpus/diff.mjs --corpus <폴더> --what all` — `reading`·`next`·`state`·`ledger`를 차례로 낸다. 스냅샷은 Task 2의 것이고, 도중에 다시 뜨지 않는다.

- [ ] **Step 2: 결과를 판정한다**

기록할 표(저장소 이름 없이): 읽기량 전후 중앙값·P90, 라벨 불일치 전후 건수, 모호로 바뀐 문서 수, 재진입 안내가 꺼진 stale 문서 수, 이월 행 수 최대·중앙값 전후. 어느 항목이든 SPEC 완료 기준(3.1~3.2)을 못 채우면 해당 Task로 돌아간다.

### Task 13: 브랜치 독립 리뷰

- [ ] **Step 1: 브랜치를 푸시하고 리뷰어 1명을 띄운다 (읽기 전용, 최상위 모델)**

범위는 `7e42edf..HEAD`다. 리뷰어에게 줄 것: 이 계획, SPEC 5절 3단계 표, Task 12의 표, `RATIONALE.md`. 특히 보게 할 것: Task 4의 이동 검사(`comm` 결과)와 인용 인벤토리, Task 5의 경로 검사(거부해야 할 것이 통과하지 않는지), Task 7의 상태 관련성 규칙과 `session_boundary.md` 문장, Task 10에서 옮긴 문단 중 규칙이 섞여 사라진 것이 없는지(`RATIONALE.md`의 대응표), 스크립트 실패가 산문 폴백 없이 드러나는지.

- [ ] **Step 2: Critical·Major를 고친다**

수정마다 실패하던 확인을 먼저 보이고 통과를 보인다. Minor는 고치거나 "갈 곳"을 정해 BASELINE에 적는다. 계약 문장을 다시 고쳤으면 그 커밋만 범위로 리뷰를 한 번 더 받는다.

### Task 14: 릴리스 문서와 버전

**Files:**
- Modify: `CHANGELOG.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `design/v9-subtraction/BASELINE.md`, `design/v9-subtraction/SPEC.md`(상태 줄), `README.md`, `CLAUDE.md`

- [ ] **Step 1: `RELEASING.md` 1~6번을 한다**

버전 `9.1.0`, 세 경로 모두. CHANGELOG `## [9.1.0]`: Added(스크립트, 헤더 필드 `Worktree:`·`Dirty files:`, `Harness : none`, `planned`, 읽기 범위·예산, `verify_body_budget.py`), Changed(본문 분할), Fixed(부록 A 번호와 함께 H1~H15). Upgrade notes: 옛 handoff 문서는 그대로 읽힌다, `/handoff`는 Node가 있어야 한다(없으면 실패가 그대로 드러난다), "다음 9.0.x" Minor 묶음은 9.0.2로 따로 나간다.

- [ ] **Step 2: BASELINE에 "3단계 후 (v9.1)" 절을 더한다**

스킬별 blob 크기(2단계 후 대비), generate 적재량과 resume 적재량, Task 12의 전후 표, Task 1의 스크립트 실행 결과, 테스트 수(`tests/handoff`, `tests/segment_stubs`), 린트 수 9종, 부록 A H1~H15의 상태, Task 13의 리뷰 결과. 실사용 검증과 관찰은 아래 Task가 덧붙인다.

- [ ] **Step 3: `README.md`·`CLAUDE.md`·SPEC 상태 줄을 맞춘다**

README의 handoff 설명(스크립트, 새 헤더 필드, 읽기 예산), `CLAUDE.md` Architecture 표(`templates/handoff/`, `skills/handoff/scripts/`, `tests/handoff/`, 린트 9종)와 `.gitattributes` 서술, SPEC 상태 줄(3단계 구현 완료, 릴리스 확인 대기).

- [ ] **Step 4: 위생 검사**

저장소 밖의 금지어 목록(작업 중인 저장소 폴더 이름들과 사람·계정 이름)으로 `git ls-files` 전체를 `grep -F -f`한다 → 0건. 추적 파일 밖은 보지 않는다.

- [ ] **Step 5: 게이트 G → Commit → 브랜치 푸시**

`chore(release): v9.1.0`

### Task 15: 실사용 검증 (사용자 확인)

- [ ] **Step 1 (confirm): 릴리스 브랜치를 `--plugin-dir`로 로드한 세션을 연다**

설치본은 9.0.1 그대로 둔다(제자리 덮어쓰기는 K7을 되살린다). 시험마다 저장소 밖에 작은 로컬 git 저장소를 만든다.

- [ ] **Step 2: handoff 경로를 한 번씩 돌린다**

| # | 시나리오 | 방법 | 통과 기준 |
|---|---|---|---|
| 1 | generate, 하네스 없음 | `/handoff generate` | 문서가 생기고 `Worktree:`·`Harness : none`이 있고, 보고문에 정정 방법 3가지가 있다 |
| 2 | resume 정상 | `/handoff resume` | 브리핑, 질문 정확히 1회, `drift: none`. Read 호출 수·바이트를 기록한다(기준선: 중앙값 10회·270KB) |
| 3 | 미커밋 유실 | dirty 파일을 둔 채 generate → 파일을 되돌림 → resume | "기록 당시 dirty였는데 지금 없음"을 보고 |
| 4 | 워크트리 | 링크된 워크트리에서 generate → 메인 트리에서 resume | 거짓 "branch differs" 없음 |
| 5 | 큰 파일 | Reading Order에 2,000줄 넘는 파일을 범위 힌트 있게/없게 | 힌트 있으면 그 범위만, 없으면 앞부분과 목차 |
| 6 | 원장 | 같은 Epic으로 generate를 연속 2회 | 미완 행 유지, done은 최근 5개 + `Earlier rows` 줄 |
| 7 | 스크립트 실패 | PATH에서 `node`를 뺀 셸에서 resume | 오류가 그대로 보이고 모델이 손으로 대신하지 않는다 |
| 8 | 같은 날 문서 2건, 브랜치 다름 | `/handoff resume`(경로 없이) | 후보를 보여 주고 고르게 한다 |

- [ ] **Step 3: 명명된 예외 두 건을 돌린다 (2026-11-18 결정)**

③ W18: `frontier` 프리셋(advisor opus, evaluator fable)으로 INLINE 계획 검토를 1회 돌려 critic의 모델이 evaluator 모델임을 확인한다. ② "Partial edits": 저장소 사본을 저장소 밖에 만들고 그 사본의 `workflows/harness.build.workflow.js`에서 첫 `agent(` 호출 앞에 `throw`를 넣은 뒤, 사본을 `--plugin-dir`로 로드한 WORKFLOW 경로 세션에서 `/harness-build`를 돌려 "Partial edits" 질문이 나오는지 본다(실제 저장소와 설치본은 건드리지 않는다). 관측하지 못하면 사유를 BASELINE에 적고 5단계 7번(K16)으로 넘긴다.

- [ ] **Step 4: 관측을 BASELINE "3단계 후" 아래에 적고 커밋·푸시한다**

돌리지 못한 경로는 명명된 예외로 남긴다. 실패한 경로는 해당 Task로 돌아간다(`RELEASING.md` §If a step fails).

### Task 16: 릴리스 (단계마다 사용자 확인)

- [ ] **Step 1 (confirm): `develop`이 9.0.2로 앞서 있는지 본다**

앞서 있으면 `develop`을 이 브랜치에 병합하고 게이트 G를 다시 돌린다(D10).

- [ ] **Step 2 (confirm, 각각): `main` 병합(`--no-ff`) → 태그 `v9.1.0` → 푸시 → GitHub 릴리스 → `develop` 갱신**

`RELEASING.md` 11~15번. 병합과 태그를 한 명령 묶음으로 잇지 않는다. 병합 메시지는 `-m`으로 준다(`git merge -F -`는 표준 입력을 읽지 않는다).

- [ ] **Step 3 (confirm): 설치본을 9.1.0으로 바꾸고 새 세션에서 `/harness doctor`를 돌린다**

`claude plugin marketplace update` → `claude plugin update`. `/harness doctor` ④ ✓ 확인. 옛 cache 폴더 `9.0.1`은 `.in_use`의 PID가 모두 죽었음을 확인하고 사용자 확인을 받은 뒤에만 지운다.

### Task 17: 릴리스 뒤 관찰 (릴리스를 막지 않는다)

- [ ] **Step 1: 릴리스 14일 뒤 resume의 읽기 호출 수와 바이트를 센다**

감사 때 쓴 세션 로그 집계 스크립트(`docs/harness/v9-audit/scripts/skill_usage/` (gitignored — not a public link))를 같은 방법으로 돌려 SPEC 2.4·6절의 기준선(Read 호출 중앙값 10, 총량 중앙값 270KB)과 비교한다.

- [ ] **Step 2: BASELINE "3단계 후" 아래에 날짜와 함께 적는다**

기준선보다 줄지 않았으면 그 사실과 원인 가설을 적고 4단계 이후의 입력으로 남긴다. 줄었으면 SPEC 6절 지표 표의 해당 행에 정정을 덧붙인다.

---

## 완료 기준과 Task 대응 (SPEC 5절 3단계)

| SPEC 완료 기준 | Task |
|---|---|
| 말뭉치 기준 resume 읽기량 중앙값이 예산 이하 (H1) | 2, 5, 12 |
| 라벨과 in-progress가 다른 문서에서 라벨 값이 나옴 (H2) | 3, 6, 12 |
| stale 라벨 표본에서 재진입 안내 없음 (H3, H9) | 7, 12 |
| 기록된 `Docs`가 검사를 통과 (H4) | 5 |
| 미커밋 파일을 되돌린 뒤 resume이 유실을 보고 (H5) | 7, 15 |
| 워크트리 문서를 메인 트리에서 resume해도 거짓 경보 없음 (H6) | 7, 15 |
| 계약에 분기 정의 (H10, H12, H13, H14) | 6, 9 |
| 100행 넘던 표본을 다시 만들면 20행 이하 (H7, H8, H11) | 8, 12 |
| generate 호출 시 실리는 본문 15KB 이하 (H15) | 4, 10, 11, 14 |
| 본문에 `(Observed\|Measured) 20xx` 0건 (H15) | 10, 11 |
| 스크립트 테스트가 CI에서 실행 | 3 |
| 린트 통과, 상한 = 실측값 | 11 |
| 말뭉치 회귀: 수정 전후 `Next :` 비교, 저장소에는 합성 픽스처만 | 3, 6, 12, 14 Step 4 |
| 실사용: 2주 관찰 | 17 |
| 열린 명명된 예외 ③·"Partial edits" | 15 Step 3 |
