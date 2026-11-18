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
- 삭제된 스킬의 슬래시 토큰과 경로: CHANGELOG·ROADMAP·design과 `scripts/verify_sync_markers.py`의 이력 주석 밖에서 0건. (정정 2026-11-17: 그때의 검사는 이 파일을 통째로 뺐고, 날짜가 붙은 측정 이력이 아닌 현재형 문장 3곳이 가려져 있었다 — 독스트링 1곳, 주석 2곳. "릴리스 전 리뷰" p11은 2곳으로 적었다. 2단계에서 세 곳 모두 고쳤다.)

### 부록 A 결함

1단계에 배정된 9건(K1, K7, K12, K14, W1, W3, W4, W5, W14) 가운데 K7을 뺀 8건을 계약과 스크립트에서 고쳤다. K7(설치본 버전 표기와 내용의 불일치)은 설치본을 교체해야 닫힌다. W4는 중복 파일 삭제를 없애 닫았고, 감사 보고서가 같은 번호로 적은 나머지(Step 3c의 원본 삭제가 비-md 참조를 깨는 경로, `.github/`·`.claude/` 제외)는 남아 있다.

### 브랜치 리뷰 (2026-11-13)

독립 리뷰 1회, 범위 `5e6209e..00a8fd9`. 판정 "수정 후 병합", Critical 0, Important 3, Minor 10. Important 3건과 Minor 3건(완료 기준 1.4를 놓친 2건, 새 린트의 구멍 1건)을 `b187a3b`에서 고쳤다. 고치지 않고 남긴 Minor 7건:

| # | 내용 | 갈 곳 |
|---|---|---|
| m1 | harness-gate §Entry Check 항목 8과 §Architecture Principles #1이 행 ③이 더는 하지 않는 `critic_findings.md` 읽기를 나열한다 | 5단계 (K18) |
| m4 | `schemas.md`와 `harness.plan.workflow.js`의 주석이 삭제된 스크립트를 파일 이름으로 든다. `verify_cited_paths.py`는 접두 없는 파일 이름을 보지 않는다 | 2단계 (2단계에서 반영) |
| m6 | `verify_description_budget.py` 독스트링과 CLAUDE.md의 해당 항목이 삭제 뒤 낡았다 | 2단계 (2단계에서 반영) |
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

- K7은 닫히지 않았다. cache 폴더 이름과 내부 버전이 다르다. (정정 2026-11-17: 릴리스 뒤 재설치로 닫혔다 — 아래 "K7 종결".)
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

**정정 (같은 날): p1~p3은 릴리스 전에 고쳤다.** 윗문단과 아래 표의 p1~p3 행은 그 전의 기록이다. CHANGELOG의 "Known limits" 절은 Fixed의 세 항목으로 바꿨다.

- p1: `/harness`는 `.harness/md-optimize/`가 있으면 아무것도 만들지 않고 멈춘다(§Step 1 item 2). `/md-optimize`는 `.harness/state.json`이 있으면 멈춘다(§1a 5번). `.harness/`를 지우는 지점 10여 곳은 건드리지 않았다. 남는 것: 이미 열려 있던 `/harness` 세션 옆에 이 수정 이전 판이 만든 백업이 있는 경우는 막지 못한다.
- p2: 두 번째 자동 수정 질문에 도달했을 때 스냅샷 manifest가 있으면 끊긴 적용으로 보고 알린다. "Apply patch"는 스냅샷을 다시 뜨지 않고 그 사본으로 되돌린 뒤 적용한다. "Reject"는 사본으로 되돌린다. 적용 실패로 되돌린 뒤에는 스냅샷을 지운다(남아 있으면 다음 재개에서 끊긴 적용으로 읽힌다).
- p3: 평가자 지적을 고치지 않고 끝내면 Phase 5가 백업을 지우지 않고 경로를 출력한다. 다음 `/md-optimize`가 복구할지 버릴지 묻는다.

이 세 수정은 독립 리뷰도 실사용 검증도 받지 않았다. 린트 체인과 스텁 테스트만 통과했다. m7과 m9의 해당 부분(스냅샷 덮어쓰기, "Skip" 뒤 백업 삭제)은 이 수정으로 닫혔고, m9의 나머지(Exclusion List 문구 충돌, Step 3c의 비-md 참조)는 그대로다.

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

**명명된 예외** (`RELEASING.md` §If a step fails). ① K7 — 위 "남은 것". 닫는 방법: 릴리스 뒤 설치본의 버전 표기를 맞춘다. ② 리뷰 수정으로 바뀐 경로(`/harness-build`의 "Partial edits" 질문과 자동 수정의 끊긴 적용 처리, md-optimize의 남은 백업 질문·"Skip" 뒤 백업 유지·열린 세션 확인, `/harness` Setup의 남은 백업 확인)는 실사용 세션에서 돌리지 않았다. 설치본은 릴리스 커밋 `e047218`의 내용이고, 실사용 검증은 그 내용에서 했다. 닫는 방법: 2단계 실사용 검증에서 두 경로를 돌린다. (2026-11-17: ①은 닫혔다 — 아래 "K7 종결". ②는 열려 있다.) (2026-11-18: ②는 일부만 남았다 — md-optimize와 `/harness` Setup의 백업 경로는 2단계 실사용 검증에서 돌렸고, "Partial edits" 질문과 끊긴 자동 수정은 아직이다. 아래 "2단계 후" → "실사용 검증"의 명명된 예외 ②.)

### K7 종결 (2026-11-17)

릴리스 뒤 설치본을 제거하고 새로 설치한 다음, 새로 시작한 세션에서 쟀다. 저장소는 `5a7b47e`(태그 `v9.0.0`)의 작업 트리다.

| 항목 | 값 |
|---|---|
| 플러그인 등록 | 버전 9.0.0, 설치 커밋 `5a7b47e`, 경로의 cache 폴더 이름 `9.0.0` |
| marketplace 클론 | `5a7b47e`, 변경 0건. 원격 계정이 매니페스트와 같다("저장소 계정" 절의 불일치가 없어졌다) |
| 스킬 목록 | 스킬 6개와 세그먼트 5개, harness-gate 설명이 끝까지 보인다 |
| 실행 중인 사본 | cache 폴더 `9.0.0` (세션이 보고한 스킬 기준 폴더) |

`/harness doctor`: ① ✓, ② ✓, ③ ✓, ④ ✓, ⑤ ✓. ④는 처음에 ⚠였다. 재설치가 옛 cache 폴더 `8.14.0`을 남겼고(안의 `plugin.json`은 9.0.0, 내용은 `e047218`이라 추적 파일 10개가 저장소와 달랐다), 쓰는 프로세스가 없음을 확인한 뒤 사용자 확인을 받아 그 폴더를 지우고 다시 쟀다. 남은 두 사본(marketplace, cache `9.0.0`)은 추적 파일 116개 가운데 내용이 다른 것 0개, 줄 끝만 다른 것 16개, 설치본에 없는 것 0개, 설치본에만 있는 것 0개다. 워크플로 스크립트 5개의 CR은 두 사본 모두 0건이다.

이로써 설치본 버전 = 매니페스트 = 태그이고 `RELEASING.md` 9번의 "✓"가 채워졌다. 1단계에 배정된 9건 가운데 남아 있던 K7이 닫혔다(W4의 나머지는 "부록 A 결함" 절에 적은 대로 남아 있다). 이 절이 확인하지 않은 것: 명명된 예외 ②의 경로는 여전히 실사용으로 돌리지 않았다.

## 2단계 후 (v9.0.1)

- 커밋: `cdc4536` (`harness/v9-stage2`, 버전 커밋 직전). 계획은 `STAGE2.md`.
- 측정일: 2026-11-17. 방법은 위와 같다(`git ls-tree -r -l cdc4536`의 blob 바이트). 비교 기준은 태그 `v9.0.0`이다.

### 스킬별 크기

| 스킬 | 바이트 | KB | `v9.0.0` 대비 |
|---|---|---|---|
| harness-build | 131,947 | 128.9 | +3,395 |
| harness | 82,917 | 81.0 | +4,080 |
| handoff | 48,045 | 46.9 | 0 |
| harness-gate | 47,179 | 46.1 | +17 |
| deep-review | 39,997 | 39.1 | 0 |
| md-optimize | 20,854 | 20.4 | +1,462 |
| **합계 (6개)** | **370,939** | **362.2** | +8,954 (`v9.0.0`은 361,985) |

이 단계는 본문을 줄이지 않았고 고친 만큼 늘렸다. "1단계 후"의 356,793은 버전 커밋 직전(`b187a3b`)의 값이라 `v9.0.0` 태그의 361,985와 다르다 — 그 사이에 릴리스 전 리뷰의 수정이 들어갔다. 본문 감량은 여전히 3단계(handoff)와 5단계(harness)의 일이다.

### 그 밖의 크기

| 구분 | `v9.0.0` | 2단계 후 |
|---|---|---|
| `workflows/*.workflow.js` | 5개, 130.4KB | 5개, 138.7KB |
| `templates/` | 58개 파일, 289.0KB | 58개 파일, 290.1KB |
| `README.md` | 66.2KB, 766줄 | 66.3KB, 766줄 |

### 린트와 테스트

- 린트 8종과 배선 검사 통과. 린트 수는 그대로이고 검사가 늘었다: `verify_meta_literal.py`의 내부용 설명·필수 인자 호출 검사, `verify_git_safety.py`의 패턴 5종 → 7종.
- BLOCK 그룹 7개: 기존 6개에 `wf-prelude v1`(세그먼트 스크립트 5개 공통 조각)을 더했다. `hx-state-machine` v3 → v4, `hx-mode-gate` v2 → v3.
- SYNC 그룹의 `min_sites`는 바뀌지 않았다.
- `verify_cited_paths.py`: 73개 파일의 경로 인용 875건이 모두 실재.
- 스텁 테스트: `50 pass, 1 known-fail, 0 fail, 0 fixed, 0 stale, 0 error` (`v9.0.0`은 7 / 23). 케이스는 30개에서 51개가 됐다. 남은 알려진 실패는 `review-dropped-findings`(W7, 4단계) 하나다.

### 부록 A 결함

2단계에 배정된 9건(W2, W6, W9, W15, W16, W17, W18, K2, K3)을 스크립트와 계약에서 고쳤다. W2·W6·W9·W15·W16·W17은 스텁 테스트가 고정한다. W18·K2·K3은 계약 문장의 수정이고 실사용 검증에서만 확인된다.

넘겨받은 항목: m4·m6(반영), m9·r9·p1 후속(백업을 `.md-optimize/`로 이전), m10, r7, p4, p9, p11을 닫았다. r9의 "대상 폴더 인자"는 추가하지 않고 "현재 작업 폴더에서만 동작한다"를 계약에 적었다. `/harness`의 남은 백업 멈춤은 없애지 않고 9.0.0 위치에 한해 남겼다(없애면 p1이 그 백업에 대해 다시 열린다).

### 브랜치 리뷰 (2026-11-17)

독립 리뷰 3회, 리뷰어는 회차마다 1명이다. Critical은 세 번 모두 0건이다.

| 회차 | 범위 | 판정 | Critical / Important / Minor |
|---|---|---|---|
| 1 | `f3be29d..42591cc` (리뷰받지 않았던 `525b507` + 2단계 Task 1~14) | 수정 후 병합 | 0 / 6 / 15 |
| 2 | `42591cc..c0508f3` (1회차 수정 커밋 4개) | 수정 후 병합 | 0 / 5 / 6 |
| 3 | `c0508f3..cdc4536` (2회차 수정 커밋 2개, 2회차와 같은 리뷰어) | 병합 가능 | 0 / 0 / 5 |

**고친 것.** 1회차 Important 6건과 Important로 다시 매긴 Minor 1건(md-optimize의 "기록 먼저" 규칙과 어긋난 문장), 2회차 Important 5건. 1회차의 둘은 `525b507`과 그 이전의 결함이다: 끊긴 자동 수정에서 스냅샷이 없는 경로가 남던 것, 그리고 WORKFLOW 경로의 "Continue to Evaluator"가 Layer 1을 PASS로 기록해 Layer 1에 실패한 슬라이스가 질문 없이 커밋될 수 있던 것. 2회차 5건은 1회차 수정이 만들거나 남긴 것이다 — 계약 문장을 고친 커밋을 다시 리뷰하는 규칙이 이번에도 값을 했다.

**고치지 않고 남긴 것.** "갈 곳"은 오케스트레이터가 배정했고 사람이 검토하지 않았다.

| 내용 | 갈 곳 |
|---|---|
| `/harness-build` 점프 표와 harness-gate에 `phase` 없는 9.0.0 체크포인트 행이 없다(`/harness`만 받는다) | 5단계 7번 |
| Type B `Reason`이 `finalizing` 재개에서 Accept-as-is와 최대 라운드를 구분하지 못한다. 자동 커밋 실패 뒤의 `Check` 행이 Restart만 안내한다 | 5단계 8번 |
| `verify_meta_literal.py`의 필수 인자 호출 검사는 텍스트 검색이다(주석 처리한 호출도 통과). `verify_block_sync.py`의 스크립트 목록은 고정이다 | 다음 9.0.x |
| `verify_git_safety.py`가 `checkout <ref> --force`, `-fq`, `-q --`, `--no-pager`, 따옴표 안에 공백이 있는 `-C` 경로를 놓친다 | 다음 9.0.x |
| md-optimize: Step 3c의 `git grep`은 추적 파일만 본다. 평가자가 끝까지 돌지 못한 실행에서도 Phase 5가 백업을 지운다. 기록만 되고 만들어지지 않은 경로에 나중에 둔 파일을 Restore가 지운다(목록은 먼저 출력된다) | 다음 9.0.x |
| 9.0.0이 쓴 state.json의 `{scope}` 리터럴은 INLINE 재개에서 풀리지 않는다(CHANGELOG 9.0.1 Upgrade notes에 공개). 서술형 `scope` 값은 그대로 치환된다 | 5단계 4번 (`scope` 존폐와 함께) |
| 세그먼트 인자가 JSON 문자열 `"null"`이면 인자 이름 없는 TypeError로 끝난다. `skipL1: "false"`(문자열)는 Layer 1을 건너뛴다 | 다음 9.0.x |
| `harness.eval`: Layer 1 결과의 자기모순(`PASS` + 실패한 check)과 대소문자는 정규화하지 않는다(닫힌 쪽으로 실패). 실패 모양이 아닌 객체도 1건으로 감싼다. 판정이 바뀌지 않아도 요약에 "normalized"가 붙는 경우가 있다 | 다음 9.0.x |
| 정규화 사유가 `summary`와 로그에만 있고 §Step 7의 Layer 3 질문에는 실리지 않는다 | 5단계 2번 |
| 자동 수정: 상태 전이 표에 "복원 실패 → `proposed` 유지" 예외가 없다. 복원 실패 출력에 재개 명령이 없다. hunk 실패 경고가 복원이 실패해도 "reverted"로 읽힌다 | 5단계 4번 (Auto-fix 존폐와 함께) |
| `setup` 재개: 9.0.0 체크포인트의 "플래그를 다시 넘기라"는 안내가 Resume 뒤에 나온다. Setup item 8~10이 값을 즉시 쓰는지 item 11까지 쥐고 있는지 정해져 있지 않다. 기록 전에 끊긴 접미사 브랜치(`-2`)는 빈 채 남는다. 체크포인트의 `slug`가 스키마 표에 없다 | 5단계 7번 |
| 낡은 주석 2곳(`harness.plan`의 "split/join … see render() above", `verify_block_sync.py` 독스트링의 "hx-* (v1): 16 groups"). `run_style.md`의 "user gates at evaluate_done(FAIL) only"는 `verify_done`의 게이트를 빠뜨린다 | 다음 9.0.x |
| INLINE 경로의 평가자에는 "`PASS`인데 차단 항목" 정규화가 없다(1줄 반환 파싱). `/harness-build`가 "소유한다"고 적은 플래그의 효과가 정의돼 있지 않다. `finalizing` 세션에 `/harness-build evaluate`를 준 경우가 정해져 있지 않다 | 5단계 |

실사용 검증(`STAGE2.md` Task 17)의 결과는 이 절 아래에 덧붙인다. 그때까지 W18·K2·K3, md-optimize 백업 이전, 명명된 예외 ②의 경로는 실사용으로 돌리지 않은 상태다.

### 실사용 검증 (2026-11-17 ~ 18)

`STAGE2.md` Task 17 Step 2의 결과다. 설치본은 9.0.0 그대로 두고, `claude --plugin-dir <저장소>`로 연 세션에서 릴리스 브랜치의 저장소 사본(`8e68f1f`)을 로드해 관측했다(사용자 결정 2026-11-17 — `claude plugin update`는 브랜치를 설치하지 못하고, 설치본을 제자리에서 덮어쓰면 K7이 되살아난다). 시험마다 저장소 밖에 작은 로컬 git 저장소를 하나씩 만들었다. 원자료인 관측 기록은 저장소 밖에 있고 커밋하지 않는다.

로드 확인: `--plugin-dir` 세션의 스킬 목록에 `agent-harness:` 항목이 11개(스킬 6 + 세그먼트 5, 중복 없음)였고, 세그먼트 설명은 `INTERNAL — …`였다. `/harness doctor`: ①②③⑤ ✓, ④ ⚠ — 실행 중인 사본이 저장소라 알려진 설치 위치가 아니다(예상한 결과).

| # | 시험 | 대상 | 결과 | 관측 |
|---|---|---|---|---|
| 1 | md-optimize 옛 위치(`.harness/md-optimize/`) 백업 | Task 12 | PASS | `/harness`는 그 백업 앞에서 아무것도 만들지 않고 멈췄다. `/md-optimize`는 옛 위치의 백업을 찾아 Restore했고, 비게 된 `.harness/`까지 지웠다 |
| 2 | 세그먼트를 빈 인자로 직접 호출 | W6 | PASS | 다섯 세그먼트 모두 에이전트 0개로 끝났고, 오류가 빠진 인자 이름을 말했다 |
| 3 | Model 질문에서 끊고 새 세션에서 재개 (INLINE) | K3 | PASS | Path 질문 없이 Model 질문부터 진행했고, 브랜치를 그대로 썼다(`-2` 없음). 끝까지 완주했다 |
| 4 | `--lint-cmd`를 준 호출을 끊고 재개 (WORKFLOW) | K3, 리뷰 I3 | PASS (단서 1) | 인자 없는 재개에서 `lint_cmd`가 체크포인트의 `setup_args`로 복원됐다. 다만 재개 세션이 Setup Summary를 출력하지 않아 화면으로는 확인하지 못했고, state.json으로 판정했다 |
| 5 | `.pylintrc`가 있는 폴더 (INLINE, `--fast`) | W15 | PASS | 저장값이 `pylint .`였다. Setup Summary와 Layer 1 보고서에 `{scope}`가 없다 |
| 6 | 항상 실패하는 pre-commit 훅 → 훅 제거 → `/harness-build` | K2 | PASS | 커밋이 실패해도 아무것도 지우지 않았고 `phase`는 `finalizing`으로 남았다. 재개는 재평가 없이 커밋 질문으로 돌아가 커밋했다 |
| 7 | md-optimize를 Phase 3 도중 끊고 Restore (새 위치) | Task 12, m9 | PASS | `.md-optimize/.gitignore`(`*`)가 먼저 생겼고 `git status`에 백업이 보이지 않았다. 백업은 실행 전 바이트와 같았고, Restore 뒤 sha256이 일치했다 |
| 8 | md-optimize 평가자 지적에 "Skip" | Task 12, p3 | PASS (2차 시도) | Phase 5가 백업을 남기고 그 경로와 "다음 `/md-optimize`가 묻는다"는 안내를 출력했다. 1차 시도에서는 "Fix all"을 골랐다 |
| 9 | build 오류 → "Partial edits" 질문 | p9, 명명된 예외 ② | 미관측 | 구현 에이전트를 건너뛰지 못해 build가 정상으로 끝났다. 다시 시도하지 않았다(사용자 결정) |
| 10 | WORKFLOW에서 Layer 1 3회 실패 → "Continue to Evaluator" | 리뷰 I6·N3 | PASS (관측 1) | 화면은 `⚠ Verify (Layer 1): FAIL (skipped — Continue to Evaluator)`, state는 `layer1_result: "FAIL"`로 남았다 |
| 11 | 끊긴 자동 수정 | 명명된 예외 ② | 안 돌림 | 사용자 결정 |

정상 경로도 끝까지 돌았다. INLINE은 2회다(시험 3은 `finalizing` 기록 뒤 커밋, 시험 6은 커밋 실패 뒤 재개 커밋). WORKFLOW도 2회다(시험 10은 커밋까지, 시험 9는 Step 8 커밋 질문까지). WORKFLOW 쪽은 세그먼트 4종이 모두 `.harness/wf/` 사본에서 첫 시도에 실행됐다. W18은 관측할 수 없었다 — 모든 시험이 `balanced` 프리셋이었고, 이 프리셋은 advisor와 evaluator가 같은 모델이다.

실패한 시험은 없다. 릴리스를 막는 관측도 없다.

#### 다시 나온 알려진 결함

- r3: 스펙 '범위 밖'에 "구현을 커밋하지 않는다"가 있었는데, Step 8이 "Commit code only (Recommended)"를 권했다(시험 3).
- r5: run 2에서 나온 결정 2건이 "결정 질문은 세션당 한 번"이라 잔여로 남았다(시험 9).

둘 다 9.0.1의 회귀가 아니다.

#### 새로 드러난 것

| 내용 | 갈 곳 |
|---|---|
| "Continue to Evaluator" 뒤의 커밋 질문과 Type B 블록에 Layer 1 FAIL이 드러나지 않는다 — `Reason : QA PASS`, `Remaining : none (cold pass skipped — skipL1)`. 계약대로의 출력이다(Remaining 표에 그런 행이 없다). 2회차 리뷰의 범위 밖 관찰과 같은 항목이다 | 5단계 8번 |
| md-optimize §1a: 미커밋 변경 경고(2번)가 남은 백업 질문(4번)보다 먼저 와서, 끊긴 실행 자신이 남긴 편집을 두고 Continue/Abort를 먼저 묻는다 | 다음 9.0.x |
| md-optimize의 격리 평가자가 같은 입력에 다른 판정을 냈다(Keyword safety: 1차 ISSUE, 2차 PASS). 키워드 안전망이 참조 문서 대부분에 걸리는 문제와 뿌리가 같다고 본다(추정) | 다음 9.0.x |
| `setup` 재개 세션이 Setup Summary(item 12)를 출력하지 않았다. `setup` 행은 "items 8–13"을 명시하므로 계약은 출력을 요구한다 — 정해진 출력이 빠진 경우다 | 5단계 2번 |

#### 오케스트레이터가 계약과 다르게 한 것

- 시험 10: 첫 `harness.build` 호출에 spec 전문 대신 자리표시 문구를 넘겼다. 즉시 멈추고(트리 변경 없음) 전문으로 다시 실행했다. 재시도 1회차에는 spec을 요약과 경로로 넘겼다. 매 호출에 spec 전문(약 11KB)과 digest(약 8KB)를 다시 싣는 비용이 크다(K9, 5단계 3번).
- 시험 1: Phase 2 미리보기에서 키워드 안전망에 걸리는 문장을 놓쳤다. Phase 3 직전에 Inline으로 옮기고 알렸다.
- 시험 7: 질문 2개를 한 호출로 묶었다(1단계 실사용 검증에서도 같았다).

#### 한계

- 시험 5·6·8·10은 기록 세션 자신이 오케스트레이터였다. 별도 세션이 같은 문장을 같은 방식으로 따른다는 근거는 시험 3·4의 재개, 시험 7의 Restore, 시험 9다.
- Setup item 8~10이 결과를 바로 쓰는지는 계약에 정해져 있지 않다(리뷰에서 미룬 Minor). 시험 3·4의 "Path 질문이 다시 나오지 않음" 판정은 item 8·9를 바로 쓴 경우를 전제로 한다.
- `--plugin-dir` 세션에서는 저장소 안의 Write·Edit이 자동 모드 분류기에서 막혔다. 저장소 밖에 쓰는 것과 Bash로 쓰는 것은 통과했다. 원인은 확인하지 않았다. 이 절의 기록과 커밋은 `--plugin-dir` 없이 연 세션에서 했다. 시험 6의 `rm .git/hooks/pre-commit`도 같은 분류기가 거부해, 사용자가 직접 지웠다.

#### 명명된 예외 (`RELEASING.md` §If a step fails)

① **설치본 = 릴리스, `/harness doctor` ④ ✓ (`RELEASING.md` 8~9번).** 태그 전에는 관측할 수 없다. 닫는 방법: 릴리스 뒤 설치본을 9.0.1로 바꾸고 `/harness doctor` ④ ✓를 확인한다.

② **1단계 예외 ②에서 남은 둘.** 하나는 "Partial edits" 질문이다(시험 9 미관측). 스크립트 쪽 — 빈 반환이 `implementation returned null — partial edits possible`이 되는 것 — 은 스텁 케이스 `build-null-implementation`이 고정한다. 다른 하나는 끊긴 자동 수정의 처리다(시험 11 안 돌림). 1단계 예외 ②의 나머지는 이번에 닫혔다: md-optimize의 남은 백업 질문과 "Skip" 뒤 백업 유지(시험 1·7·8), `/harness` Setup의 남은 백업 확인(시험 1). md-optimize의 열린 세션 확인은 9.0.1에서 없어졌다. 닫는 방법: "Partial edits"는 다음 실사용 검증에서 구현 에이전트를 건너뛰어 본다. 자동 수정은 5단계 4번이 Auto-fix를 남기면 그 단계에서 돌리고, 없애면 예외도 함께 사라진다.

③ **W18.** `balanced` 프리셋에서는 advisor와 evaluator가 같아 구분되지 않는다. 닫는 방법: `frontier` 프리셋(advisor opus, evaluator fable)으로 INLINE 계획 검토를 1회 돌려 critic의 모델을 확인한다.
