# v9-subtraction 기준선

`SPEC.md`의 단계가 끝날 때마다 같은 방법으로 다시 재서 이 표와 비교한다. 크기는 바이트를 1024로 나눈 값(KB)이다.

## 기준

- 커밋: `20b20e4` (`harness/harness-converge-flow` HEAD, `v8.14.0-13-g20b20e4`)
- 측정일: 2026-11-13
- 설치본의 핵심 스킬 4개(handoff, harness, harness-gate, harness-build)는 이 커밋과 바이트 단위로 같다. 버전 표기는 `8.14.0`이다.

## 스킬별 크기

`skills/<name>/SKILL.md`의 커밋 blob 바이트다(`git ls-tree -r -l 20b20e4 -- skills`). 이 문서의 크기는 모두 blob 기준이다. 작업 트리 크기는 줄 끝 변환 때문에 체크아웃마다 달라질 수 있어 쓰지 않는다.

| 스킬 | 바이트 | KB | v9에서 |
|---|---|---|---|
| study | 125,207 | 122.3 | 삭제 |
| harness-build | 123,025 | 120.1 | 유지 |
| spec | 86,564 | 84.5 | 삭제 |
| harness | 79,519 | 77.7 | 유지 |
| ship | 70,525 | 68.9 | 삭제 |
| handoff | 48,258 | 47.1 | 유지 |
| harness-gate | 47,562 | 46.4 | 유지 |
| refactor | 43,795 | 42.8 | 삭제 |
| migrate | 42,639 | 41.6 | 삭제 |
| test-gen | 42,579 | 41.6 | 삭제 |
| deep-review | 38,559 | 37.7 | 유지 |
| debug | 34,004 | 33.2 | 삭제 |
| codebase-audit | 29,575 | 28.9 | 삭제 |
| team-memory | 28,831 | 28.2 | 삭제 |
| md-generate | 17,353 | 16.9 | 삭제 |
| md-optimize | 14,960 | 14.6 | 유지 |
| memory | 1,689 | 1.6 | 삭제(스텁) |
| code-review | 1,548 | 1.5 | 삭제(스텁) |
| workflow | 1,404 | 1.4 | 삭제(스텁) |
| **합계 (19개)** | **877,596** | **857.0** | |

유지 6개의 합은 351,883바이트(343.6KB)다. harness 3종은 250,106바이트(244.2KB)이고, `v8.14.0` 태그에서는 197,115바이트(192.5KB)였다.

## 그 밖의 크기

| 구분 | 값 |
|---|---|
| `workflows/*.workflow.js` | 15개, 361.8KB |
| `templates/` | 93개 파일, 448.8KB |
| `README.md` | 114.7KB, 1,511줄 |
| `CHANGELOG.md` | 173.9KB, 1,758줄 |
| `ROADMAP.md` | 160.0KB, 356줄 |

## 유지 스킬이 인용하는 템플릿 합계 (상한)

각 SKILL.md 본문에서 `templates/….md` 경로를 뽑아 중복을 없앤 뒤 실재하는 파일의 크기를 더했다. 한 번의 호출이 이 전부를 읽지는 않으므로 상한이다. 템플릿이 다시 인용하는 템플릿은 세지 않았다.

| 스킬 | 인용 파일 수 | 합계 |
|---|---|---|
| harness | 29 | 166.0KB |
| harness-build | 20 | 98.3KB |
| harness-gate | 6 | 64.5KB |
| deep-review | 7 | 41.6KB |
| handoff | 1 | 15.1KB |
| md-optimize | 2 | 4.5KB |
| 6개 합집합 | 35 | 197.0KB |

## 린트 SYNC 그룹

`scripts/verify_sync_markers.py`의 `SYNC_GROUPS`. 현재 9개 그룹, 마커 52곳이다.

| 그룹 | `min_sites` |
|---|---|
| `adhoc-dispatch` | 13 |
| `ambiguity-prompt` | 10 |
| `project-defaults` | 9 |
| `session-conflict` | 7 |
| `conventions-field-contract` | 3 |
| `spec-eval-dual-caller` | 3 |
| `critic-revision-block` | 3 |
| `handoff-state-record` | 2 |
| `slice-command-format` | 2 |

## 사용과 실측

누적 호출은 저자 PC 한 대의 스킬 사용 기록이다. 최근 두 달은 2026-09-15 ~ 11-13의 세션 로그 집계다. 호출 직후 컨텍스트 증가는 호출 앞뒤 메시지의 컨텍스트 크기 차이의 중앙값이라 추정치다.

| 스킬 | 누적 호출 | 최근 두 달 | 호출 직후 컨텍스트 증가 |
|---|---|---|---|
| handoff | 419 | 52 (resume 31, generate 21) | 약 1.8만 토큰 (generate) |
| harness | 152 (+구 별칭 123) | 8 | 약 5.7만 토큰 |
| harness-gate | 46 | 6 | 약 3.3만 토큰 |
| harness-build | 26 | 2 | 약 5.0만 토큰 |
| debug | 20 | 0 | — |
| ship | 14 | 0 | — |
| md-optimize | 8 | 1 | — |
| deep-review | 6 (+구 별칭 29) | 0 | — |
| 나머지 8개 | 각 0~2 | 0 | — |

**handoff** (실제 문서 276건)

| 지표 | 값 |
|---|---|
| resume 한 번이 읽어야 하는 Reading Order 파일 총량 | 중앙값 270KB·2,329줄, 최대 846KB |
| resume 구간의 Read 호출 수 | 중앙값 10, 최대 51 |
| `Slice :` 라벨과 in-progress 행이 함께 있는 문서 중 두 값이 다른 것 | 58건 중 13건 |
| Progress Ledger가 문서 바이트에서 차지하는 비중 | 전체 30.8%, 2026-10 문서 중앙값 64.6%, 2026-11 문서 0건 |
| 필수 섹션 9개가 모두 있는 문서 | 93.1% |

**harness 3종** (스펙이 있는 작업 디렉터리 75개)

| 지표 | 값 |
|---|---|
| 평가까지 도달 | 62건 (83%) |
| 시작 월별 완주율 | 5월 34/36, 8월 11/14, 9월 7/11 |
| 스펙 크기 | 중앙값 27.5KB, 최대 142KB |
| 계획 검토 18건의 Major 건수 | 중앙값 7.5, 0건인 것은 없음 |
| 검증 보고서의 템플릿 형식 준수 | 23/62 |

**콜드리뷰 요청** (2026-09-16 ~ 11-12)

| 지표 | 값 |
|---|---|
| "콜드리뷰" 언급 프롬프트 | 83건 |
| "필요한가?"를 묻는 질문 | 38건 |
| 리뷰 요청 중 그 턴에 Workflow를 실행한 것 | 15건, 전부 그때 새로 쓴 스크립트 |
| deep-review 사용 | 0건 |

**스텁 테스트**: 결함 8종(W1, W2, W6, W7, W9, W15, W16, W17)이 모의 실행으로 재현된다(케이스 30개 중 25개가 알려진 실패). 케이스별 상태는 `tests/segment_stubs/known_failures.json`이 정본이다.

## 저장소 계정

매니페스트(`plugin.json`, `marketplace.json`)와 git 원격은 같은 계정명을 쓴다. 저자 PC의 마켓플레이스 등록은 다른 계정명으로 돼 있다. 2026-11-13 푸시에서 저장소 이동 안내가 나오지 않았으므로 매니페스트와 원격의 계정이 현재 저장소를 가진 계정이다. 고칠 쪽은 저자 PC의 마켓플레이스 등록이다(SPEC 6.3).

## 1단계 후 (v9.0.0)

- 커밋: `b187a3b` (`harness/v9-subtraction`, 버전 커밋 직전)
- 측정일: 2026-11-13. 방법은 위와 같다(`git ls-tree -r -l b187a3b`의 blob 바이트).

### 스킬별 크기

| 스킬 | 바이트 | KB | 기준선 대비 |
|---|---|---|---|
| harness-build | 125,377 | 122.4 | +2,352 |
| harness | 78,415 | 76.6 | −1,104 |
| handoff | 48,045 | 46.9 | −213 |
| harness-gate | 47,162 | 46.1 | −400 |
| deep-review | 39,997 | 39.1 | +1,438 |
| md-optimize | 17,797 | 17.4 | +2,837 |
| **합계 (6개)** | **356,793** | **348.4** | 유지 6개의 기준선 351,883에서 +4,910 |

19개 합계는 877,596바이트에서 356,793바이트로 59% 줄었다. 줄어든 것은 전부 삭제한 13개다. 유지한 6개의 본문은 줄지 않았고 손실 경로 차단 절차만큼 늘었다. harness 3종은 250,106 → 250,954바이트다. 본문 감량은 3단계(handoff)와 5단계(harness)의 일이다.

### 그 밖의 크기

| 구분 | 기준선 | 1단계 후 |
|---|---|---|
| `workflows/*.workflow.js` | 15개, 361.8KB | 5개, 130.4KB |
| `templates/` | 93개 파일, 448.8KB | 58개 파일, 289.0KB |
| `README.md` | 114.7KB, 1,511줄 | 66.2KB, 767줄 |
| 스킬 설명 합계 (목록에 실리는 글자 수) | 7,793 | 2,880 |

### 린트 SYNC 그룹

9개 그룹, 마커 19곳(기준선 52곳).

| 그룹 | 기준선 | 1단계 후 |
|---|---|---|
| `adhoc-dispatch` | 13 | 4 |
| `ambiguity-prompt` | 10 | 2 |
| `project-defaults` | 9 | 2 |
| `session-conflict` | 7 | 1 |
| `conventions-field-contract` | 3 | 1 |
| `plan-critic-contract` (전 `spec-eval-dual-caller`) | 3 | 2 |
| `critic-revision-block` | 3 | 3 |
| `handoff-state-record` | 2 | 2 |
| `slice-command-format` | 2 | 2 |

SPEC 1.3의 시뮬레이션 값과 다른 것은 `session-conflict`(2로 예상, 실제 1)와 `adhoc-dispatch`(5로 예상, 실제 4)다. 마커가 1곳만 남은 두 그룹은 파일 간 비교가 아니라 토큰 존재 검사다.

`verify_sync_markers.py`의 `min_cross_files` 세 값(9 / 3 / 4)은 다시 고정하지 않았다. 실측은 26 / 11 / 15이고 삭제 전에는 28 / 11 / 15였다. 여유는 v9 이전부터 있었고 그 값의 주석이 "서술을 고쳐도 걸리지 않게"를 의도로 적고 있다. 이 문서의 "여유 0" 원칙에서 벗어난 유일한 고정값이다.

### 린트와 테스트

- 린트 8종(6종에서 `verify_git_safety.py`, `verify_cited_paths.py` 추가)과 배선 검사 통과.
- `verify_cited_paths.py`: 73개 파일의 경로 인용 854건이 모두 실재. (정정 2026-11-17: `b187a3b`와 `e047218`에서 다시 실행한 값은 둘 다 856건이다.)
- 스텁 테스트: `7 pass, 23 known-fail, 0 fail, 0 fixed, 0 stale, 0 error; 0 script(s) without a representative case` (기준선 5 / 25, 대표 케이스 없는 스크립트 10개). W1의 두 케이스가 통과로 옮겨 갔다.
- 삭제된 스킬의 슬래시 토큰과 경로: CHANGELOG·ROADMAP·design과 `scripts/verify_sync_markers.py`의 이력 주석 밖에서 0건.

### 부록 A 결함

1단계에 배정된 9건(K1, K7, K12, K14, W1, W3, W4, W5, W14) 가운데 K7을 뺀 8건을 계약과 스크립트에서 고쳤다. K7(설치본 버전 표기와 내용의 불일치)은 설치본을 교체해야 닫힌다. W4는 중복 파일 삭제를 없애 닫았고, 감사 보고서가 같은 번호로 적은 나머지(Step 3c의 원본 삭제가 비-md 참조를 깨는 경로, `.github/`·`.claude/` 제외)는 남아 있다.

### 브랜치 리뷰 (2026-11-13)

독립 리뷰 1회, 범위 `5e6209e..00a8fd9`. 판정 "수정 후 병합", Critical 0, Important 3, Minor 10. Important 3건과 Minor 3건(완료 기준 1.4를 놓친 2건, 새 린트의 구멍 1건)을 `b187a3b`에서 고쳤다. 고치지 않고 남긴 Minor 7건:

| # | 내용 | 갈 곳 |
|---|---|---|
| m1 | harness-gate §Entry Check 항목 8과 §Architecture Principles #1이 행 ③이 더는 하지 않는 `critic_findings.md` 읽기를 나열한다 | 5단계 (K18) |
| m4 | `schemas.md`와 `harness.plan.workflow.js`의 주석이 삭제된 스크립트를 파일 이름으로 든다. `verify_cited_paths.py`는 접두 없는 파일 이름을 보지 않는다 | 2단계 |
| m6 | `verify_description_budget.py` 독스트링과 CLAUDE.md의 해당 항목이 삭제 뒤 낡았다 | 2단계 |
| m7 | 자동 수정 적용이 도중에 끊긴 뒤 다시 적용하면 스냅샷이 덮어써진다 | 5단계 (Auto-fix 존폐와 함께) |
| m8 | deep-review `reviewed_sha`: annotated tag는 `^{commit}`이 필요하고, 조회 실패 시 `null`이 되어 가드가 꺼진다 | 4단계 |
| m9 | md-optimize: 자기 작업 폴더와 Exclusion List 문구의 충돌, Step 3c의 비-md 참조 미확인, Phase 4d "Skip" 뒤 백업 삭제 | 2단계 |
| m10 | `harness.build`가 계획이 없어도 "implementation plan ready"를 로그한다 | 2단계 |

실사용 검증(SPEC 1.4)의 결과는 이 절 아래에 덧붙인다.

### 실사용 검증 (2026-11-16 ~ 17)

`STAGE1.md` Task 16의 Step 1 후반부터 Step 6까지의 결과다. 관측 대상은 설치본이고, 그 내용은 릴리스 커밋 `e047218`과 같다. 실패한 Step은 없다. SPEC 1.4의 "계획 검토 INLINE, WORKFLOW 각 1회"도 채워졌다.

| Step | 결과 | 관측 |
|---|---|---|
| 1 후반 (설치본 확인) | 통과. K7은 미해소 | 스킬 6개와 세그먼트 5개만 목록에 나오고 harness-gate 설명이 끝까지 보인다. 두 설치본은 릴리스 커밋과 내용이 같다. `plugin.json`은 9.0.0인데 cache 폴더 이름은 `8.14.0` 그대로다 |
| 2 (`/harness` 완주, WORKFLOW 경로) | 통과 | `multi` 모드로 Setup부터 Step 8까지 갔고 2라운드에 QA PASS. 세그먼트 4종(`harness.plan`, `harness.critic`, `harness.build`, `harness.eval`)이 모두 `.harness/wf/` 사본에서 첫 시도에 실행됐다. 권한 거부와 엔진 오류는 0건 |
| 2 (`/harness` 완주, INLINE 경로) | 통과 | `--mode single`로 Setup부터 Step 8까지 갔고 2라운드에 QA PASS. INLINE 계획 검토, 수렴 루프, 세션 안 승인과 체인, `generator_single`, `verify_layer1`, 평가자, INLINE 콜드 리뷰(`clean`), "Commit code only"가 모두 돌았다 |
| 3 (계획 검토 WORKFLOW, 옛 사본 무시) | 통과 | `.harness/wf/`에 빈 `spec.eval.workflow.js`를 두고 실행했다. `harness.critic.workflow.js` 사본이 실행됐고 옛 이름 파일은 0바이트 그대로였다 |
| 4 (`/handoff generate`, `resume`) | 통과 | resume은 드리프트 검사, 축소 검사, 브리핑, 승인 질문, 선택 후 같은 턴 착수까지 동작했다 |
| 5 (md-optimize 복구) | 통과 | git 폴더: Phase 3 도중 중단 → 다음 실행이 남은 백업을 알아챔 → Restore 뒤 두 파일의 sha256이 실행 전과 같다. 비-git 폴더: Step 3b 실패 → manifest 복구 뒤 sha256이 같다. 중단과 실패는 시험자가 일으켰다(모의 중단, 0바이트 쓰기). Phase 4·5는 돌지 않았다 |
| 6 (deep-review `--fix` 거부) | 통과 | 체크아웃되지 않은 브랜치를 대상으로 실행했다. Step 7이 건너뛰어졌고 거부 메시지가 출력과 보고서 Notes에 남았다. 작업 트리 변경은 0건. quick 경로만 봤다 |

#### 질문 수 (SPEC 5단계 9번의 기준선)

| 경로 | 멈춤 | 질문 | 내역 |
|---|---|---|---|
| WORKFLOW (`multi`) | 5 | 6 | Path와 Model(한 호출에 2개), Decisions, Approval, QA(Layer 3 FAIL → Fix), Commit |
| INLINE (`--mode single`) | 5 | 5 | Model, Decisions, Approval, QA(Layer 3 FAIL → Fix), Commit |

묻지 않고 처리된 것은 수렴 루프의 Minor 결정(WORKFLOW 6건, INLINE 3건)과 Convention Scan이다. Path와 Model을 한 호출로 묶은 것은 오케스트레이터의 선택이다. 계약대로 따로 물으면 WORKFLOW는 멈춤 6회다.

#### 수렴 루프

| 경로 | run | 라운드 | 발견 → 원장 | 처리 | 검사 |
|---|---|---|---|---|---|
| WORKFLOW | 2 | 3 | 27건 → 18항목 (정정 2026-11-17: 19항목이다. 18은 사용자가 답한 1건을 뺀 수다) | 자동 적용 6, 사용자 답 1, 기본값 6, 기각 3, 잔여 3 | 트리 검사 8회, 커버리지 검사 3회 모두 통과 |
| INLINE | 2 | 4 | 30건 → 27항목 | 자동 적용 16, 사용자 답 3, 기본값 3, 기각 1, 잔여 4 | 트리 검사 8회, 커버리지 검사 4회 모두 통과 |

두 실행 모두 `converged`로 끝났다. INLINE 실행에서는 결정을 반영하면서 들어간 결함 1건(CR 검사 명령이 CRLF를 세지 못함)을 다음 delta 라운드가 잡았다.

#### 서브에이전트 토큰

| 경로 | 계획 | 계획 검토와 수렴 루프 | 구현 | 검증·평가·콜드 리뷰 | 합계 |
|---|---|---|---|---|---|
| WORKFLOW | 32.6만 | critic 13.1만 + inline 리뷰·검증 6회 약 78만 | 34.0만 + 32.0만 | 16.9만 + 16.8만 | 약 223만 |
| INLINE | 15.4만 | 9회 115.8만 | 2회 12.8만 | Layer 1 2회 9.6만, 평가 2회 20.6만, 콜드 리뷰 11.6만 | 약 186만 |

과제는 둘 다 주석·문서 몇 줄의 정정이었다(m6, m4). 스펙은 각각 110줄, 135줄이었고 완료 기준은 10개, 13개였다.

#### 실사용에서 드러난 것

| # | 내용 | 갈 곳 |
|---|---|---|
| r1 | WORKFLOW 실행에서 스펙이 구현자에게 커밋을 시켰다. 스펙 단계와 완료 기준이 "커밋 1개"를 요구했고 계획 검토 2회가 이를 잡지 못했다. 그 결과 콜드 리뷰 입력이 두 라운드 모두 0건이라 `skipped`가 됐고, Step 8의 권장 선택지는 "nothing to commit"으로 실패할 수밖에 없었다 | 5단계 1번 (2026-11-17 결정: 1단계의 실패로 보지 않는다. 1단계가 만든 회귀가 아니고 데이터 손실도 없다) |
| r2 | r1의 `Remaining` 표기가 사실과 다르다. 건너뛴 이유는 "구현자가 이미 커밋함"인데 파생 규칙은 `none (cold pass skipped — git failure or empty input)`을 낸다 | 5단계 1번 |
| r3 | INLINE 실행의 과제와 스펙은 커밋 금지를 명시했다. 그래도 Step 8은 "Commit code only (Recommended)"를 낸다 | 5단계 9번 (r1과 뿌리가 같다 — 스펙의 커밋 지시·금지를 Step 8이 읽지 않는다. 9번에서 다루되 5단계 1번의 r1을 참조한다) |
| r4 | 스펙과 conventions 전문이 프롬프트와 인자로 실린다(K9). WORKFLOW에서 conventions 약 20KB를 1회, 스펙 약 28~30KB를 5회 실었다. INLINE 계약도 planner에 conventions 전문을, 구현자와 평가자에 스펙 전문을 싣게 한다 | 5단계 3번 |
| r5 | 결정 질문은 세션당 한 번이다. 두 번째 run에서 나온 결정은 잔여로 승인 화면에 남는다(WORKFLOW 결정 2건과 auto 1건, INLINE Major 결정 1건을 포함한 결정 2건과 auto 2건) | 5단계 2번 (K11) |
| r6 | 2라운드의 `changes.md`가 1라운드 내용을 덮어쓴다. INLINE 경로에서는 평가자의 파일 목록이 2라운드에 고친 파일로 좁아진다 | 5단계 1번 (W8) |
| r7 | `templates/generator/generator_single.md`가 "a parallel execution skill was found above", "a TDD skill was found above"라고 쓴다. 그 검색 지시는 W14로 지워졌으므로 가리킬 대상이 없다 | 2단계 |
| r8 | 프로젝트 기본값 줄에 `lint-cmd`만 있으면 스텁 테스트는 Layer 1에서 실행되지 않는다. 두 실행 모두 평가자가 직접 돌렸다 | 5단계 7번 (K13) |
| r9 | md-optimize: 대상 폴더 인자가 없어 CWD 기준으로만 동작한다. manifest의 `created` 줄은 파일을 만든 뒤에 적으므로 그 사이에 끊기면 새 파일이 기록 없이 남는다(읽어서 확인, 미시험). 복구 뒤 빈 `.harness/`가 남는다. Exclusion List의 `.harness/` 금지와 백업 위치의 충돌(m9)은 그대로다 | 2단계 (m9와 함께) |
| r10 | deep-review의 리비전 가드는 산문 지시다. 이번 통과는 계약을 읽은 모델이 그대로 따른 것이고, m8(annotated tag, 조회 실패 시 `null`)은 시험하지 않았다 | 4단계 |

#### 오케스트레이터가 계약과 다르게 한 것

- WORKFLOW 실행: 브랜치 생성을 Setup 체크포인트 기록보다 먼저 했다. 승인 화면 Summary Block의 항목 요약을 줄여 적었다. Step 8 커밋 질문의 권장 표시를 "No commit"으로 옮겼다.
- INLINE 실행: 구현자와 평가자의 스펙·QA 피드백 자리에 전문 대신 경로 포인터를 넣었다(r4의 비용과 옮겨 적다 달라질 위험 때문). 결정을 반영하려고 읽기 전용 측정 명령을 직접 실행했고 스펙 전문을 읽었다. 상태 전이 일부를 한 번의 쓰기로 합쳤다. `cold_review.md`의 첫 몇 줄을 읽었다(계약은 존재와 크기만 확인).
- md-optimize 시험: 게이트 질문 2개를 한 호출로 묶은 것이 2회 있다.

#### 남은 것

- K7은 닫히지 않았다. cache 폴더 이름과 내부 버전이 다르다.
- `/harness doctor` (2026-11-17, 릴리스 브랜치의 작업 트리에서 실행): ① ✓, ② ✓, ③ ✓, ④ ⚠, ⑤ ✓. ④의 ⚠는 K7 하나다. cache 폴더 이름은 `8.14.0`이고 그 안의 `plugin.json`은 9.0.0이다. 두 설치본의 `plugin.json`은 저장소와 같다(9.0.0). 추적 파일 116개 가운데 설치본과 내용이 다른 것은 릴리스 커밋 뒤에 고친 문서 4개(`CHANGELOG.md`, `RELEASING.md`, `SPEC.md`, 이 문서)뿐이고 스킬·템플릿·워크플로·스크립트에는 없다. 줄 끝만 다른 파일이 28개, 설치본에 없는 추적 파일과 설치본에만 있는 파일은 0개다. `RELEASING.md` 9번이 요구하는 "✓"는 이 릴리스에서 채워지지 않았다. K7을 알려진 예외로 두고 릴리스 뒤에 닫는다. (이 줄은 실행 시점의 관측이다. 그 뒤 "릴리스 전 리뷰"의 수정이 스킬 2개와 스크립트 1개를 바꿨다.)
- 검증용 과제 2건의 결과물은 릴리스 커밋 위의 로컬 작업 브랜치에만 있다(`d349a34`는 m6, `c653d8d`는 m4의 정정). v9.0.0에는 넣지 않고 2단계로 보류한다(2026-11-17 결정). m4·m6는 원래 2단계 배정이고, 넣으면 실사용 검증을 마친 설치본과 릴리스 내용이 달라진다. 이 문서의 m4·m6 행은 2단계에서 병합될 때까지 그대로 둔다.
- 관측하지 못한 경로: HARD GATE #2와 #3, Layer 2 자동 재시도, 콜드 리뷰 되먹임 재시도, WORKFLOW 경로의 콜드 리뷰, `--fast`, `--separate-gate`와 `/harness-gate`, epic과 slice 체인, Session Recovery, 권한 거부와 엔진 오류 폴백, 승인 화면의 "Modify".

### 릴리스 전 리뷰 (2026-11-17)

독립 리뷰 2회. 두 번 모두 Critical은 0건이다.

| 회차 | 범위 | 판정 | Critical / Major / Minor |
|---|---|---|---|
| 1 | `b187a3b`(브랜치 리뷰 지적을 고친 커밋, 그때까지 재검토 없음), `1f83905` | 수정 후 릴리스 | 0 / 6 / 9 |
| 2 | `717490c`(1회차 수정), 손실 경로 절차 통독(md-optimize 전체, 자동 수정 스냅샷, deep-review `--fix` 가드, `harness.build`의 빈 결과 처리), `8f25b64` | 수정 후 릴리스 | 0 / 3 / 12 |

**고친 것.** 1회차 Major 6건은 `8f25b64`(CHANGELOG 정정 문단 2건)와 `717490c`(4건)에서 고쳤다. 그중 둘은 문서만 고쳤다: `verify_git_safety.py`는 통과하는 위험 형태를 독스트링에 공개했고 정규식은 그대로다. README는 다른 플러그인 의존이 한 곳 남아 있다고 적었고 그 의존은 그대로다. 2회차의 Minor 7건(생성기에 넘기는 경로 목록의 설명, "Continue inline"의 경로 기록, md-optimize 남은 백업 질문의 근거·복구 실패 처리·문구, CHANGELOG의 carried-over 정정, 이 문서의 doctor 줄)은 이 절을 넣은 커밋에서 고쳤다.

**고치지 않고 남긴 것.** 2회차 Major 3건(p1~p3)은 모두 중단되거나 버려진 실행에서만 생기고, 8.14.0에서는 같은 상황에 백업이 없거나 `git stash`였다. CHANGELOG 9.0.0의 "Known limits of the new safeguards"에 공개했다. "갈 곳"은 오케스트레이터가 SPEC 단계 목록에 맞춰 배정한 것이다.

| # | 심각도 | 내용 | 갈 곳 |
|---|---|---|---|
| p1 | Major | md-optimize 백업이 `.harness/` 아래에 있어, 중단된 md-optimize 뒤에 같은 폴더에서 돈 `/harness` 세션이 끝나며 `.harness/`를 지우면 실행 전 사본도 사라진다 | 2단계 (m9와 함께) |
| p2 | Major | 자동 수정 적용이 도중에 끊긴 뒤 재개하면 부분 적용을 알리지 않고 다시 묻는다. 다시 적용하면 스냅샷이 덮어써지고(m7), 거절하면 부분 패치가 트리에 남는다 | 5단계 (m7과 함께) |
| p3 | Major | md-optimize Phase 4d "Skip" 뒤 Phase 5가 백업을 지운다 (m9에 이미 있음) | 2단계 |
| p4 | Minor | `verify_git_safety.py`가 `git checkout <ref> -- <path>`, `git restore --staged --worktree <path>`를 통과시킨다. 강제 체크아웃 계열도 보지 않는다 | 2단계 |
| p5 | Minor | INLINE 평가자가 다른 플러그인의 에이전트 유형을 "있으면" 쓴다 | 5단계 4번 |
| p6 | Minor | 재시도 지점들이 `phase → "generating"` 쓰기를 디스패치 뒤에 나열한다. Session Recovery의 `verify_ready`/`verifying` 행은 재시도 횟수를 0으로 되돌린다 | 5단계 7번 (K16) |
| p7 | Minor | Key Rules의 "Graceful engine fallback"에 빈 결과 질문 예외가 없다. 상태 도표에 `generating → generate_ready`가 없다. harness-gate는 `generate_ready` 쓰기를 §Entry만 한다고 적는다 | 5단계 7번 (K18) |
| p8 | Minor | deep-review는 `reviewed_sha`를 얻지 못하면 가드 없이 진행한다 (m8과 같다) | 4단계 |
| p9 | Minor | 빈 결과가 아닌 Workflow 오류로 구현이 끊기면 묻지 않고 부분 편집된 트리 위에서 INLINE으로 다시 실행한다 | 2단계 (W9와 함께) |
| p10 | Minor | README의 "skills that dispatch sub-agents ask via AskUserQuestion"이 남은 스킬과 맞지 않는다 | 6단계 |
| p11 | Minor | 삭제 토큰 검사가 `scripts/verify_sync_markers.py`를 통째로 빼서 그 파일의 현재형 문장 2곳이 가려진다. 이 문서 "린트와 테스트"의 "이력 주석 밖에서 0건"은 그 때문에 정확하지 않다 | 2단계 |

**명명된 예외** (`RELEASING.md` §If a step fails). ① K7 — 위 "남은 것". 닫는 방법: 릴리스 뒤 설치본의 버전 표기를 맞춘다. ② 리뷰 수정으로 바뀐 두 경로(`/harness-build`의 "Partial edits" 질문, md-optimize의 남은 백업 질문)는 실사용 세션에서 돌리지 않았다. 설치본은 릴리스 커밋 `e047218`의 내용이고, 실사용 검증은 그 내용에서 했다. 닫는 방법: 2단계 실사용 검증에서 두 경로를 돌린다.
