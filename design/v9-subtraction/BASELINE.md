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

매니페스트(`plugin.json`, `marketplace.json`)와 git 원격은 같은 계정명을 쓴다. 저자 PC의 마켓플레이스 등록은 다른 계정명으로 돼 있다. 어느 쪽이 현재 저장소를 가진 계정인지는 푸시 때 확인해 여기에 적는다.
