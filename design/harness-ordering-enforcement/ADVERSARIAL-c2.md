# ADVERSARIAL-c2 — C2 적대 리뷰 18건의 복원과 분할 후 감사 (2026-09-10)

> **성격**: `harness-ordering-enforcement` 에픽의 슬라이스 `adversarial-15-revisit` 기록. 2026-09-04 C2
> (spec_stamp) 구현에 대해 돌린 적대 리뷰의 **원본 산출물 복원본**과, 그 18건을 C5 분할 후 트리에서
> 다시 감사한 결과다. 기준 트리: `develop @ ab515a1c918bab11b2c9f1baabf0427c97eeb73d`, working tree clean.
>
> **왜 이 문서가 존재하는가.** SPEC rev.5는 「18건 중 3건 성립, 나머지 15건은 판정 미완」이라고 적었고,
> 핸드오프 3편(09-07 ×2, 09-10)은 그 「15건」을 「SPEC rev.5 목록」이라 불렀다. **그 목록은 커밋된 어느
> 문서에도 없었다.** 리뷰 워크플로(`wf_939375b1-890`)가 `TypeError: null is not an object (evaluating
> 'r.verdict.refuted')`로 실패해 `result`가 비었고, 산출물은 세션 디렉터리의 에이전트 트랜스크립트 40개에만
> 남아 있었다. 이 문서가 그 유일 사본을 저장소로 옮긴다.

---

## 1. 복원 방법과 한계

- **출처**: `~/.claude/projects/C--workspace-agent-harness/4cb9b49e-8f70-484c-980a-64fcff62d6de/`
  `workflows/wf_939375b1-890.json`(status `failed`, 에러 위 인용), `workflows/scripts/c2-adversarial-review-wf_939375b1-890.js`
  (스크립트 원문 — 렌즈 4 × 발견당 반증자 2, 2표 이상 refuted면 kill), `subagents/workflows/wf_939375b1-890/agent-*.jsonl` 40개.
- **복원 규칙**: 각 트랜스크립트의 첫 user 메시지에서 역할(렌즈 / 반증자)과 반증 대상 주장(제목·심각도·위치·시나리오)을,
  마지막 `tool_use` 중 이름에 `structured`가 든 블록의 `input`에서 구조화 출력을 읽었다. 렌즈 4개(ripple 3건 /
  loss-accounting 7건 / state-machine 5건 / prose-truth 3건 = **18건**)는 전건 구조화 출력이 있다.
- **표결 결측**: 반증자 36개 중 **22개만** 구조화 판정을 남겼다(세션 한도 — 나머지 14개는 8메시지 안에서 중단).
  워크플로 스크립트의 `r.verdict.refuted`가 그 null을 만나 죽은 것이다. 따라서 표결은 **18건 중 11건만** 2표,
  7건은 0표다(§3 표의 「표결」 열). 이 결측은 복원으로 메워지지 않으며, 결측 7건의 판정은 §5에서 오케스트레이터가
  분할 후 트리에 대해 직접 내렸다.
- **「15건」의 정의**: rev.5가 직접 재현한 3건은 #5(Interruption cost → row ④), #7(live 줄 수 캐시 재사용),
  #4(mtime 10회 수치 — #1·#2는 같은 사실의 중복 보고). 그 셋을 뺀 **15건 = {1, 2, 3, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18}**.

## 2. 결론 한 줄

**15건 중 성립 11 / 기각 4.** 기각 4건(#3·#13·#14·#18)은 두 반증자가 모두 refuted로 판정했고 이 감사도 동의한다 —
그러나 rev.5·`3b22b43`가 넷 다 **명료화 문면으로 이미 수용**했으므로, 되돌리지 않고 「결함 아님, 문면은 존치」로
기록한다. **18건의 수정 전건이 분할 후 트리에 살아 있다**(§3 「분할 후 위치」 열, 전건 `grep`으로 확인).
분할 자체가 만든 회귀는 0건이다.

## 3. 감사표 — 18건 전건

표결: `S`=반증 실패(주장 생존), `R`=반증 성공, `?`=판정 없음(세션 한도). 두 글자 = 재현 각도 / 대안 각도 순서가 아니라
복원 순서다. 「분할 후 위치」는 2026-09-10 트리의 파일과 §절 — 재현 명령은 §6.

| # | 렌즈 / 심각도 | 표결 | 요지 | rev.5 / `3b22b43` 처리 | 분할 후 위치 (수정 생존 확인) | 판정 (2026-09-10) |
|---|---|---|---|---|---|---|
| 1 | ripple / minor | SS | SPEC AC-2의 「mtime 10회」가 실측(8회)과 불일치 | rev.5 항목 3 — 재측정해 「9행 / 10회」로 정정 | SPEC §3.5·AC-2 (`9행 / 10회`). **분할 후 재측정: 3파일 합 10행 / 11회, 비교 사이트 0** — AC-2 행에 append | **성립** — 정정 존치, 수치는 분할 후 값으로 갱신 |
| 2 | loss-accounting / minor | SS | #1과 같은 사실(§3.5 인용) | 동일 | 동일 | **성립** (#1 중복) |
| 3 | loss-accounting / major | RR | non-null이지만 malformed인 스탬프의 fail-closed 규칙 부재 | rev.5 「미정의 3건」 ① — malformed → stale 규칙 추가 | `skills/harness-gate/SKILL.md` §Stale Determination 세 번째 불릿 (`present but **malformed**`) | **기각(결함으로서)** — 두 반증자 모두 「관찰은 참이나 발생 경로(세그먼트 파싱)는 불가능, 남는 경로는 수기 편집뿐이며 CLAUDE.md가 금지」. 규칙은 방어적 명료화로 **존치** |
| 4 | prose-truth / blocking | SS | AC-2가 틀린 수치로 「충족」 표시 | rev.5 항목 3 | #1과 동일 | **성립** — 단 blocking은 과대: 결론(비교 사이트 0)은 유지됐고 숫자만 틀렸다. minor로 기록 |
| 5 | state-machine / major | ?? | Interruption cost 문단의 「resume은 row ①-b」가 실제로는 row ④ | rev.5 항목 1 — 재현 후 row ④로 정정 | `skills/harness/SKILL.md` §Step 2.6 Interruption cost (`resume lands on … §Step 3 Pass A **row ④**`, gate 경로 앵커 포함) | **성립** (rev.5 직접 재현) — 분할 후 앵커까지 정확 |
| 6 | state-machine / minor | ?? | routing predicate가 스탬프 유효성 아닌 파일 존재만 봐서 미완성 spec.md가 곧장 비평 대상 | `3b22b43` 항목 1 — 디스패치 전 스탬프 검사 신설, `spec_stamp_invalid` | `skills/harness/SKILL.md` §Step 2.6 (`do NOT dispatch — take failure branch (iii) with failure_reason = "spec_stamp_invalid"`) | **성립** — 수정 존치 |
| 7 | state-machine / blocking | ?? | 「live 줄 수」가 캐시된 read 재사용 → 편집 후 재렌더에서 거짓 not-stale | rev.5 항목 2 — 「매 Pass A 렌더마다 새로 읽는다」 | `skills/harness-gate/SKILL.md` §Stale Determination 머리말 (`read **fresh at every Pass A render**`) | **성립** (rev.5 직접 재현) — gate로 이동 후에도 문면 유지 |
| 8 | loss-accounting / minor | SR | 동률 규칙 소멸·`ls -l` 독립 검증 상실이 CHANGELOG 요약에 없음 | rev.5 공시 추가 | `CHANGELOG.md` [Unreleased] spec_stamp 항목 (`the same-second tie-break rule is gone`, `independently with ls -l`) | **성립** — 생존 표가 옳았고 수정 존치. 기각 표의 「문서별 역할 분담」 논거는 CHANGELOG가 이미 그 손실을 적은 지금 무의미 |
| 9 | ripple / minor | SS | CHANGELOG harness-steps 항목의 403/203/200/195 수치가 C2로 스테일 | `3b22b43` 항목 4 — 옛 항목은 그 커밋 기준으로 참이므로 유지, 새 항목이 포인터 | `CHANGELOG.md` (`quote 403 in-file §citations / 203 checked …` 포인터 문장) | **성립** — 「정정 각주」가 아니라 「포인터」 형태로 수용, 타당 |
| 10 | prose-truth / major | ?? | SPEC §4가 rev.4에서 기각한 `spec_revision +1`을 그대로 서술 | `3b22b43` 항목 3 — 스탬프 프로토콜로 재작성 | SPEC §4.2 항목 3 (`rev.2가 여기 적었던 「spec_revision을 +1」은 rev.4가 기각한 기제`) | **성립** — 수정 존치 |
| 11 | ripple / major | ?? | ROADMAP §citation 수치 3곳이 스테일, 정정 각주 없음 | rev.5 항목 3 | `ROADMAP.md` 61행·105행 (`Figures re-measured 2026-09-04 (spec_stamp change)`) — 이후 09-07 C5 정정까지 같은 셀에 누적 | **성립** — 수정 존치 |
| 12 | loss-accounting / minor | SS | 디스패치 전 삭제 성공 후 중단되는 창의 안전성 근거가 어디에도 연결돼 있지 않음(결과는 안전) | rev.5 항목 1과 함께 — 삭제 규칙 자리에 그 창을 명문화 | `skills/harness/SKILL.md` §Step 2.6 (`If the delete succeeds and the dispatch is then interrupted, …`) | **성립** — 수정 존치 |
| 13 | prose-truth / major | RR | §Architecture Principles #1이 신규 「삭제」 행위를 다루지 않음 | rev.5 — #1에 「삭제는 제3 범주, 목록 불변」 노트 추가 | `skills/harness/SKILL.md` §Architecture Principles #1 (`pre-dispatch delete … is a third category again`) | **기각** — 두 반증자 모두 「#1은 읽기 원칙이고 삭제 범주는 base부터 존재(§Step 8 `.harness/` 삭제)」. 노트는 명료화로 **존치** |
| 14 | loss-accounting / major | RR | spec_stamp 채택이 결정 A(위조 가능 값 금지)와 충돌, 미해소 | rev.5 — SPEC §3.3a 신설 | SPEC §3.3a (순서 집행 vs 신선도 입력 구분표) | **기각** — 두 반증자 모두 「결정 A의 사정거리는 게이트 통과 **기록(산출)**이지 게이트가 읽는 **입력**이 아님(§2.2 명문)」. §3.3a는 그 반박을 문서에 적은 것이라 **존치** |
| 15 | state-machine / major | ?? | row ④ 배너 규칙에 미정의 3번째 조합(executed + malformed + failure_reason null) | rev.5 「미정의 3건」 ③ | `skills/harness-gate/SKILL.md` §Pass A row ④ (`A THIRD combination reaches this row …`) | **성립** — 수정 존치, gate로 이동 |
| 16 | state-machine / minor | ?? | `findings_file_missing`이 latch (a)/(b) 두 원인을 뭉갬 | rev.5 「미정의 3건」 ② — `findings_file_missing` / `spec_stamp_invalid` 분리 | `skills/harness/SKILL.md` §Step 2.6 failure branch (iii) — 세 값 (`findings_file_missing` / `spec_stamp_invalid` / `findings_file_stale`) | **성립** — 수정 존치 |
| 17 | loss-accounting / major | SR | 줄 수가 오케스트레이터 자신의 카운팅이라는 신뢰성 리스크 미공시 | rev.5 — 공시 한계 2번 추가 | `skills/harness-gate/SKILL.md` §Stale Determination Disclosed limits 2 (`produced by the orchestrator itself`) | **성립** — 생존 표가 옳았고 수정 존치. 기각 표는 「이미 읽은 내용에서 센다」는 출처 명시를 리스크 공시로 오독 |
| 18 | loss-accounting / minor | RR | I/O 실패 축 손실이 줄 수 손실과 한 문장에 뭉뚱그려지고 근거절이 비논리적 | rev.5 — 한계 3개로 분리 + 「read 실패 → stale」 규칙 신설 | `skills/harness-gate/SKILL.md` §Stale Determination 네 번째 불릿(`cannot be obtained … fail closed`) + Disclosed limits 1·2·3 | **기각** — 두 반증자 모두 「원문도 이미 두 문장으로 분리」. 분리·규칙 신설은 명료화로 **존치** |

**집계 (18건)**: 성립 14 / 기각 4. **집계 (15건, §1 정의)**: 성립 11 / 기각 4. 심각도 정정 1건(#4 blocking → minor).
**분할이 만든 회귀**: 0 — 18건의 수정 문면이 전부 예상한 파일(gate: #3·#7·#15·#17·#18 / harness: #5·#6·#12·#13·#16 /
문서: #1·#2·#4·#8·#9·#10·#11·#14)에 있다.

## 4. 기각 4건을 되돌리지 않는 이유

넷 다 「주장한 결함은 성립하지 않으나 수용된 문면은 해가 없다」는 같은 모양이다. 되돌리면 (i) gate·harness의 BLOCK
동치와 무관한 소유자 전용 절이라 린트 비용은 없지만, (ii) 규칙을 지우는 커밋이 「왜 있었는지」를 다음 독자에게 다시
묻게 만든다. 반증 논거가 옳다는 것과 문면이 틀렸다는 것은 다른 명제다 — #14의 §3.3a가 그 표본이다: 반증자가 말한
「결정 A는 산출에 관한 것이지 입력이 아니다」가 정확히 §3.3a의 내용이고, 그 절이 없었다면 같은 질문이 다음 리뷰에서
또 나온다(이 리뷰에서 실제로 나왔다).

## 5. 표결 결측 7건의 판정 근거 (#5 #6 #7 #10 #11 #15 #16)

반증자 표가 없으므로 이 감사의 판정은 **수정이 분할 후 트리에 존재하는가**와 **rev.5·`3b22b43`가 재현을 기록했는가**
두 축으로만 내렸다. #5·#7은 rev.5가, #6·#10은 `3b22b43` 커밋 메시지가 「재현 후 수정」을 명시한다. #11은 ROADMAP 셀의
정정 문장 자체가 재현이다. #15·#16은 rev.5가 「재현 없이도 문면상 명백」으로 분류했고, 이 감사는 gate row ④의 3번째
조합 렌더 문장과 harness의 `failure_reason` 3값을 읽어 그 분류에 동의한다. **적대적 표결을 대체하는 것은 아니다** —
7건에 대해 독립 반증은 여전히 0회이고, 이것을 채우는 것은 (C)안(표결 보충)이었으나 사용자가 (B)안(인라인 감사)을
선택했다. 콜드 리뷰(`/ship` 전)가 같은 절을 다시 읽는다.

## 6. 재현

```
# 분할 후 mtime 잔존 (AC-2 후속) — 행 / 회, 3파일
for f in skills/harness/SKILL.md skills/harness-gate/SKILL.md skills/harness-build/SKILL.md; do
  echo "$f: $(grep -ci mtime $f) lines / $(grep -oi mtime $f | wc -l) occ"; done
#   → harness 3/3, gate 5/5, build 2/3 = 10행 / 11회. 전건 서술(각 행을 읽어 확인), 비교 사이트 0.
# §3 「분할 후 위치」 열의 각 문자열은 해당 파일에 grep -n 으로 1회 이상 매치한다 (2026-09-10 실측).
grep -n "spec_stamp_invalid\|If the delete succeeds\|third category again" skills/harness/SKILL.md
grep -n "fresh at every Pass A render\|THIRD combination\|produced by the orchestrator itself\|cannot be obtained" skills/harness-gate/SKILL.md
grep -n "same-second tie-break\|independently with .ls -l" CHANGELOG.md
```

---

## 부록 — 복원 원문 (18건 + 반증 표결 22표)

아래는 트랜스크립트에서 기계적으로 추출한 원문이다. 반증 사유는 각 220자로 절단했다(전문은 원 트랜스크립트).
표결 표기: `SURVIVED`=반증 실패, `REFUTED`=반증 성공, `NO-VERDICT`=구조화 판정 없이 중단.

#### 1. [ripple] minor — design/harness-ordering-enforcement/SPEC.md rev.4 AC-2 검증 셀의 "mtime 10회"가 실측과 불일치(결론은 유지, 숫자만 틀림)
- 위치: design/harness-ordering-enforcement/SPEC.md — AC 표(§7 부근) AC-2 행
- 시나리오: rev.4의 AC-2 근거란은 `grep -n mtime` → "10회 전건 서술 (충족)"이라고 적었다. 그러나 현재 작업트리에서 `grep -n mtime skills/harness/SKILL.md`를 그대로 실행하면 7줄만 매치되고(같은 줄 2150에 "mtime comparison"과 "compares mtimes" 두 표현이 함께 있어 occurrence 기준(`grep -o … | wc -l`, 및 별도 python re.finditer로 교차검증)으로도 8회일 뿐, 10회는 재현되지 않는다). 비교를 수행하는 사이트가 0건이라는 결론(파일에 열거된 각 mtime 언급을 직접 읽어 확인 — 304/997/1235/1386/1390/1507/2150행, 전부 과거 mtime 메커니즘을 설명하거나 "NOT ported"류의 반대방향 서술)은 그대로 유효하지만, 이 표가 자기 자신이 강조하는 원칙("a figure quoted without its counting rule/command is exactly what this row warns about" — ROADMAP.md 105행과 동일한 이 저장소의 반복 모티프)을 AC-2 셀 자신이 어기고 있다. HEAD(C2 이전)에서는 같은 명령이 21줄(24회) — REMEASURE-split.md·rev.3 SPEC.md가 기록한 "mtime 언급 21곳"과 일치 — 을 반환하므로, C2가 mtime 언급 대다수를 정말로 제거한 것은 맞지만 최종 잔존 수치를 세는 과정에서 21→10으로 잘못 계산된 것으로 보인다(정확히는 21→7/8).
- 표결: 
  - alt:SURVIVED — 반증 실패 — 주장은 확정(CONFIRMED)이며, 의도된 설계도 이미 공시된 한계도 아니다.

**1) 수치 재현 (전건 일치)**
- 작업트리 `grep -c mtime skills/harness/SKILL.md` → **7행** / `grep -o … | wc -l` → **8회** / python `re.findall(r'mtime')` → **8**, `re.I`로도 동일 8. 매치
  - 재현:SURVIVED — 반증 실패 — 주장은 스크래치 사본에서 그대로 재현된다.

**재현 (읽기 전용, /tmp/scr_skill.md 사본 + 원본 양쪽)**
- 작업트리 `skills/harness/SKILL.md`: `grep -c mtime` → **7**, `grep -o mtime | wc -l` → **8**, python `re.findall('mtime')` → **8** (대소문자 무시 `re.

#### 2. [loss-accounting] minor — SPEC.md §3.5/AC-2가 인용하는 'mtime 10회 전부 서술' 수치가 실측(8회)과 불일치
- 위치: SPEC.md §3.5 '손대지 않은 것' / AC 표 AC-2
- 시나리오: 현재 워킹트리의 skills/harness/SKILL.md에서 grep -ci mtime을 실행하면 7개 라인(총 8회 출현 — 1개 라인은 mtime과 mtimes를 모두 포함)만 검출되는데, SPEC.md rev.4 §3.5는 '변경 후 파일에 남은 mtime 10회는 전부 서술이고 비교를 수행하는 사이트는 0건이다'라고 적고, AC 표의 AC-2 행도 'grep -n mtime → 10회 전건 서술 (충족)'으로 같은 수치를 인용한다. 정성적 결론(비교 사이트 0건)은 7개 라인을 직접 확인한 결과 여전히 성립하는 것으로 보이나, 수치 자체가 실측과 2건 어긋난다 — scripts/verify_sync_markers.py 자신의 독스트링이 명시적으로 경계하는 '자기무효화 수치' 패턴의 사례이며, C2 변경의 정확성을 보증해야 할 문서 자신의 검증 수치가 틀렸다는 점에서 공시 신뢰도를 떨어뜨린다.
- 표결: 
  - alt:SURVIVED — 반박 실패 — 주장은 실측으로 확인된다(refuted=false).

**1) 실측 (읽기 전용, 워킹트리 `harness/spec-revision-counter`)**
- `grep -c mtime skills/harness/SKILL.md` → **7** (라인 304, 997, 1235, 1386, 1390, 1507, 2150)
- `grep -o mtime ... | wc -l` →
  - 재현:SURVIVED — 주장을 그대로 재현했고, 반증에 실패했다 — 수치는 실제로 틀렸다.

**실측(워킹트리, 브랜치 harness/spec-revision-counter, base f735cb2)**
- `grep -c -i mtime skills/harness/SKILL.md` → **7** (라인 수)
- `grep -o -i mtime skills/harness/SKILL.md | wc -l` → **8*

#### 3. [loss-accounting] major — spec_stamp/spec_stamp_at_critic이 non-null이지만 malformed(타입 오류)인 경우에 대한 fail-closed 규칙이 정의되지 않음
- 위치: SKILL.md §Stale Determination 판정 규칙
- 시나리오: 판정 규칙은 'spec_stamp == null OR spec_stamp_at_critic == null → stale'만 정의하며, 두 값이 non-null이지만 generation/lines 중 하나가 정수가 아니거나 예상 밖 형태(예: state.json 수기 편집, 세그먼트 반환 파싱 오류로 생긴 값)인 경우에 대한 처리는 어디에도 없다. 같은 절 바로 아래 §Well-formedness Determination은 plan_critic.counts에 대해 '비음수 정수인지'를 명시적으로 검사하고 I/O 실패까지 fail-closed로 처리하는데(malformed 취급), Stale Determination은 spec_stamp에 동일한 타입 가드를 두지 않는다. mtime은 OS가 반환하는 값이라 이런 malformed 케이스가 원천적으로 존재할 수 없었던 반면, 모델이 유지하는 spec_stamp에는 이 축이 새로 열렸는데도 공시되지 않았다.
- 표결: 
  - 재현:REFUTED — 문면 추적 + 스크래치 시뮬레이션으로 재현을 시도했고, 실패했다. 저장소 파일은 수정하지 않았다(git status = C2 변경 4개 그대로).

**주장의 관찰 자체는 참**: `skills/harness/SKILL.md`에 `spec_stamp`/`spec_stamp_at_critic`의 타입 가드는 없다(grep 확인: `non-negative`/`integers` 문구는 1428·1
  - alt:REFUTED — 반박한다. 네 갈래 근거로, 이것은 미공시 결함이 아니라 (a) 시나리오의 전제 자체가 사실과 다르고 (b) 남는 잔여는 이미 인라인 공시된 한계로 환원된다.

1. 시나리오가 제시한 두 발생 경로 중 하나는 원천적으로 불가능하다. 「세그먼트 반환 파싱 오류로 생긴 값」은 이 두 필드에 도달할 수 없다. §Step 2 write protocol에서 `generation`은 `prev + 1`

#### 4. [prose-truth] blocking — SPEC.md AC-2가 잘못된 mtime 잔존 횟수(10회)를 '충족'으로 표시
- 위치: design/harness-ordering-enforcement/SPEC.md §3.5 함께 바뀐 사이트 / AC 표 AC-2
- 시나리오: SPEC.md §3.5는 "변경 후 파일에 남은 `mtime` 10회는 전부 서술이고 비교를 수행하는 사이트는 0건이다"라고 단언하고, AC-2 행도 근거로 "`grep -n mtime` → 10회 전건 서술 (충족)"을 적어 놓았다. 그러나 실제로 `grep -in mtime skills/harness/SKILL.md`를 실행하면 7줄(304/997/1235/1386/1390/1507/2150)만 매치되고, 부분일치 총 횟수를 세도 8회(2150행에 mtime이 2회 등장)에 그친다. 10이라는 숫자는 어느 방식으로 세어도 재현되지 않는다. verify_sync_markers.py 갱신분이 "각 수치는 그것을 재생산하는 커맨드를 동반한다"는 원칙을 스스로 지키며 통과한 것과 대조적으로, SPEC.md는 같은 원칙을 표방하면서 그 자신의 AC 검증에서 실측 없이(혹은 잘못 실측하여) '충족' 도장을 찍은 셈이다. 이 문서를 근거로 C2가 완결됐다고 판단하는 사람은 실제로는 재현되지 않는 수치를 승인 근거로 삼게 된다.
- 표결: 
  - 재현:SURVIVED — 반박 실패 — 주장이 정확히 재현됨. (1) `grep -n mtime skills/harness/SKILL.md` → 7줄(304/997/1235/1386/1390/1507/2150), `grep -c`=7, `grep -ic`=7. (2) `grep -o` 부분일치 총계 = 8회(2150행에 mtime+mtimes). (3) Python 독립 재측정에서도 동일(7줄/8회, CR 0). (
  - alt:SURVIVED — 반증 실패 — 주장은 성립한다(다만 심각도는 blocking보다 낮게 볼 여지가 있다).

■ 실측 재확인 (working tree, harness/spec-revision-counter)
- `grep -n mtime skills/harness/SKILL.md` → **7줄**(304/997/1235/1386/1390/1507/2150), `grep -o` 부분일치 총계 → **8회**(2

#### 5. [state-machine] major — §Step 2.6 'Interruption cost' 문단이 단언하는 재개 행(①-b)이 실제로는 특정 인터럽트 구간에서 성립하지 않음 — 실제로는 row④
- 위치: §Step 2.6 Interruption cost / §Well-formedness Determination / §State-Space Derivation
- 시나리오: 근거 문면(Interruption cost): 「if the SAME-turn re-critic dispatch this section describes ... is itself interrupted before its write completes, resume lands on §Step 3 Pass A row ①-b (stale — the re-entry advanced spec_stamp.generation past the spec_stamp_at_critic the FIRST pass recorded ...)」
- 표결: 
  - alt:NO-VERDICT
  - 재현:NO-VERDICT

#### 6. [state-machine] minor — Plan Critic routing predicate가 spec_stamp 유효성이 아니라 파일 존재만으로 Step 2.6 진입을 허용 — INLINE 서브에이전트의 미완성 spec.md가 planner 재시도 기회 없이 곧장 비평 대상이 될 수 있음(결과 자체는 안전하게 stale-unknown으로 귀결)
- 위치: §Step 2.6 Plan Critic routing predicate / §Session Recovery item 7 `planning`/`plan_done` 행 / §Step 2 INLINE path item 1
- 시나리오: 1) INLINE Step 2 item1: 「Update phase → "planning", and in the same write apply step 1 of the spec_stamp write protocol above (capture prev, set spec_stamp → null). It has to happen here rather than beside item 5: on this path the file is written by the sub-agent dispatched at item 3, so the invalidation must precede the dispatch.」 phase→planning과 spec_stamp→null이 동시 기록됨. 2) item3에서 서브에이전트 디스패치. 서브에이전트가 spec.md를 부분적으로만 작성한 상태에서 세션 전체가 중단(서브에이전트 턴 미완료로 item4/item5는 전혀 실행되지 않고, spec_stamp는 null인 채 남음). 3) 재개: phase='planning'. §Session Recovery의 `planning`/`plan_done` 행이 적용되어 epic.boundaries==null이므로 §Step 2.6 Plan Critic routing predicate가 그대로 쓰인다: 「(a) {docs_path}spec.md does NOT exist → route to Step 2 ... (b) spec.md exists AND state.plan_critic has no recorded applied value → route to Step 2.6」 — 파일이 (미완성이라도) 존재하므로 (a)는 해당 없고 곧장 (b)로 Step 2.6에 직행한다. planner가 미완성 spec.md를 완성/재작성할 기회는 주어지지 않는다. 4) Step 2.6은 이 미완성 문서를 정상적으로 비평(pre-dispatch delete·디스패치 등 정상 수행)하지만 Latching의 (b) 「state.spec_stamp is non-null」이 실패(1)단계 이후 아무도 재기록하지 않아 여전히 null)하여 branch(iii)로 빠지고 spec_stamp_at_critic=null, last_findings_path=null이 된다. 5) 결과적으로 §Stale Determination의 첫 체크 「plan_critic.last_findings_path == null → stale-unknown」이 즉시 발동해 row④로 안전하게 귀결되므로 실질적 오판(거짓 stale/not-stale)은 발생하지 않는다 — 다만 Step 2.6 자신의 latch가 신뢰하는 신호(spec_stamp 유효성)와 그 진입을 허용하는 routing predicate가 신뢰하는 신호(단순 파일 존재)가 서로 다르다는 비대칭이 있고, 그 결과 최소 1회의 크리틱 디스패치가 미완성 문서에 대해 낭비된다.
- 표결: 
  - alt:NO-VERDICT
  - 재현:NO-VERDICT

#### 7. [state-machine] blocking — 체크(e) 'live line count'가 실제로는 캐시된 단일 read를 재사용 — 거짓 not-stale(위험)과 거짓 stale(자기모순) 양쪽을 유발
- 위치: §Stale Determination (근거: §Step 2's spec_stamp write protocol, §Step 2.6 단일기록, §Architecture Principles #1)
- 시나리오: 근거 문면: 「Reads state.spec_stamp and ... plus the LIVE line count of {docs_path}spec.md, counted from the content §Step 3's <HARD-GATE> already read this turn. That is not a new read site — it is the same reuse §Step 3.5's degraded restore order makes of that read, so §Architecture Principles #1's exception list stays at 7 items.」 즉 체크(e)의 '라이브' 값은 이번 턴에 §Step 3 <HARD-GATE> 최상단 'Read and show spec.md to the user'가 딱 한 번 읽은 콘텐츠의 재사용이며, Pass A가 같은 턴 안에서 여러 번 재렌더돼도 새로 읽지 않는다. 참고로 C2 이전 원문(git show HEAD)은 매번 실제 filesystem stat을 했다(「compare filesystem mtimes: mtime(...) vs mtime(...)」) — 캐싱 개념 자체가 C2가 새로 도입한 것이다.
- 표결: 
  - alt:NO-VERDICT
  - 재현:NO-VERDICT

#### 8. [loss-accounting] minor — same-second 동률 규칙 소멸과 ls -l 독립 검증 능력 상실이 SKILL.md에는 명시되지만 CHANGELOG.md 사용자용 요약에는 빠짐
- 위치: CHANGELOG.md 'Changed' 항목 / SKILL.md §Pass A 'Latch / staleness asymmetry' / §Session Recovery item 7
- 시나리오: SKILL.md는 (1) 'Equal-mtime asymmetry' 동률 규칙이 완전히 사라졌음을('that rule is gone rather than relocated... a real narrowing') §Pass A에서, (2) 사용자가 ls -l로 판정을 독립 검증할 수 있던 능력이 사라졌음을 §Session Recovery item 7에서 각각 명시적으로 공시한다. 그러나 CHANGELOG.md의 'Changed' 항목은 오직 줄 수 보존 편집 미탐지만 손실로 기록하고 이 두 가지는 언급하지 않는다 — 릴리스 노트만 읽는 독자는 이 두 손실을 알 수 없다. 또한 'state.json 필드가 유일한 진단 표면'이라는 공시는 spec_stamp.lines는 wc -l 등으로 외부 대조 가능하지만 spec_stamp.generation은 오케스트레이터의 내부 장부 외에 대조할 외부 근거가 전혀 없다는 비대칭은 짚지 않는다.
- 표결: 
  - 재현:SURVIVED — 주장의 사실 핵심이 문면 그대로 재현되므로 반박 실패(확인). 실측: (1) skills/harness/SKILL.md:1507-1510이 "This paragraph was titled \"Equal-mtime asymmetry\" and turned on a same-second tie-break; integer stamps have no tie case, so that rule is g
  - alt:REFUTED — 반박한다 — 결함이 아니라 문서별 역할 분담이 명시된 의도된 배치이고, 주장의 사실 전제 자체에도 오류가 있다.

1) 주장의 전제가 부정확하다. CHANGELOG 세 번째 불릿은 "줄 수 보존 편집 미탐지"만 적지 않는다. 같은 문장이 (i) 오케스트레이터 외부 편집이 더는 아무것도 움직이지 않음, (ii) 줄 수 보존 편집 미탐지, (iii) "unlike mtime there is no

#### 9. [ripple] minor — CHANGELOG.md의 harness-steps 모드 항목(같은 Unreleased 절, C2 바로 아래)에 남은 403/203/200/195/202→203/201→200 수치도 같은 원인으로 스테일화됐으나 정정되지 않음
- 위치: CHANGELOG.md — ## [Unreleased] 아래 ### Added("harness-steps mode in scripts/verify_sync_markers.py's section-reference check" 항목) 및 ### Fixed·### Changed(같은 배치의 후속 항목들)
- 시나리오: CHANGELOG.md 자체가 C2 커밋셋의 일부로 편집되었고(맨 위에 spec_stamp 관련 새 ### Changed 항목이 정확하게 추가됨), 바로 그 아래 이미 존재하던 harness-steps 모드 관련 ### Added/### Fixed/### Changed 항목들은 손대지 않았다. 이 항목들은 "of the 403 in-file §citations, 203 are checked and 200 are not (195 non-Step, …)"(### Added), "against c986901 the total is unchanged at 403; what moves is that single citation … (202 → 203, 201 → 200)"(### Fixed), "it now covers 203 of that file's 403 in-file citations"(### Changed, 2회 언급)라고 재현 가능한 수치로 못박아 두었는데, 위 finding에서 실측한 대로 현재 트리에서는 403/203/200이 아니라 422/216/206이다. CHANGELOG 항목 자체가 "Of these figures only 203 is restated by an OK line; the rest are reproducible solely from the commands"라고 재현성을 강조하는 문장인 만큼, 지금 그 명령을 그대로 실행하면 문서가 적어둔 숫자가 나오지 않는다 — 이 저장소가 §Sub-command: doctor 절 근처에서 스스로 경계하는 '자기무효화 수치'(self-invalidating figure) 패턴 그대로다.
- 표결: 
  - alt:SURVIVED — 반박 실패 — finding은 대체로 성립한다(단, 3개 지목 중 1개는 과잉).

[실측] `python -c "import re;print(len(re.findall(r'§(?=[0-9A-Za-z])', open('skills/harness/SKILL.md',encoding='utf-8').read())))"` 기준: c986901=403, HEAD(f735cb2)=403, **현재 워킹
  - 재현:SURVIVED — 반증 실패 — 주장의 핵심은 스크래치 없이 트리 직접 실측으로 그대로 재현된다.

**1) 수치 이동의 원인이 C2임을 확인**
동일 명령(FIGURE PROVENANCE의 `§(?=[0-9A-Za-z])` 규칙)을 세 시점에 실행:
- `c986901`: total 403 / §Step+num 205 / non-Step 196
- `f735cb2`(HEAD, C2 직전): total 403

#### 10. [prose-truth] major — SPEC.md §4(결정 ③)가 rev.4에서 명시적으로 기각한 spec_revision '+1' 방식을 그대로 서술
- 위치: design/harness-ordering-enforcement/SPEC.md §4. `Modify` 재설계 (결정 ③)
- 시나리오: 같은 문서 상단 "Changed in this revision" 항목 1은 "「같은 write에서 +1」은 물리적으로 불가능했다"며 단일 카운터 `spec_revision`을 기각하고 `spec_stamp {generation, lines}` invalidate-first 3단계 프로토콜로 대체했다고 명시한다(§3.1~3.2). 그런데 이번 diff가 건드리지 않은 §4.2 3번 항목은 여전히 "harness가 spec.md를 수정하고 `spec_revision`을 `+1`한다"라고 쓰여 있고, §4.3 표도 "근거만 mtime → revision", "revision 증가가 구조적으로 Predicate point 4를 깬다"처럼 이미 폐기된 필드명·단일-write 가정을 그대로 쓴다. 결정 ③(Modify 재설계) 구현에 착수하는 사람이 §4만 읽으면, §3 rev.4가 '물리적으로 불가능'이라 못박은 바로 그 방식을 구현 목표로 오인할 수 있다 — 같은 문서 안에서 자기 자신과 모순되는 서술이 남아 있다.
- 표결: 
  - 재현:NO-VERDICT
  - alt:NO-VERDICT

#### 11. [ripple] major — ROADMAP.md의 §citation 개수 수치 3곳(61행 sub-path 12건, 105행 W7 spike 행의 403/203/200/195)이 C2로 인해 스테일화됐으나 정정 각주가 없음
- 위치: ROADMAP.md — 61번째 줄(SUBPATH_CITE 관련 행) 및 105번째 줄("W7 spike — splitting skills/harness/SKILL.md" 행)
- 시나리오: C2(skills/harness/SKILL.md에 spec_stamp write protocol 절·상태표 2행·Stale Determination 재작성 등을 추가)는 그 파일 안의 §citation 총량 자체를 바꿔놓았다. 실측: HEAD(커밋됨, C2 미적용) 기준 `python -c "import re;print(len(re.findall(r'§(?=[0-9A-Za-z])', open('skills/harness/SKILL.md',encoding='utf-8').read())))"` → 403. 같은 명령을 현재 작업트리(C2 적용)에서 돌리면 → 422. `PYTHONIOENCODING=utf-8 python scripts/verify_sync_markers.py` 실행 결과의 OK 라인도 "216 in-file §Step ref(s)" "14 §Step N — INLINE|WORKFLOW path ref(s)"를 보고한다(둘 다 이 변경으로 스크립트 자신의 §FIGURE PROVENANCE 주석에는 422/221/219/216/206으로 이미 정정되어 있음 — 이는 프롬프트가 '이미 실측됨'이라 말한 부분과 일치). 그런데 ROADMAP.md는 동일한 수치 가족을 두 곳에서 인용한 채 그대로 남아 있다: (a) 61행 "12 such citations are checked against 6 pinned … headings" — 실측값은 14이지 12가 아니다. (b) 105행 W7 spike 행 "the total is therefore unchanged at 403" 및 "203 are checked and 200 are not (195 non-Step, 2 …, 3 …); 203 + 200 = 403" — 실측값은 422/216/206/201이다. 이 저장소는 바로 이 커밋(scripts/verify_sync_markers.py의 §FIGURE PROVENANCE 갱신, "RE-MEASURED 2026-09-04, after the spec_stamp change rewrote parts of that file" 각주)에서 정확히 같은 원인의 드리프트를 스스로 정정해 놓고도, CLAUDE.md가 명시한 컨벤션("Correct a stale ROADMAP or CHANGELOG claim by appending the correction inside the existing row. Never delete it silently")을 ROADMAP.md 쪽에는 적용하지 않았다. 105행은 이 저장소에서 향후 실제 분할 착수 여부(entry condition met/not met)를 가늠하는 살아있는 게이팅 문서이므로, 스테일 수치를 근거로 "조건이 부분 충족"이라고 재확인하는 다음 작업자가 잘못된 기준선에서 작업을 시작하게 된다.
- 표결: 
  - 재현:NO-VERDICT
  - alt:NO-VERDICT

#### 12. [loss-accounting] minor — pre-dispatch delete 자체의 크래시 윈도우(삭제 성공 후 디스패치 중단)에 대한 안전성 근거가 어디에도 연결되어 있지 않음(결과적으로는 다른 메커니즘 덕에 안전)
- 위치: SKILL.md §Step 2.6 'Pre-dispatch delete' / SPEC.md §3.4 latch (b) 대체
- 시나리오: 'Run Critic anyway'로 재디스패치가 시작되어 pre-dispatch delete가 성공한 직후 세션이 중단되면, state.plan_critic은 이전 성공 기록(applied="executed", last_findings_path=<경로>)을 그대로 유지한 채 파일만 사라진 상태가 된다. Session Recovery의 Plan Critic routing predicate (c)는 applied가 기록돼 있다는 이유만으로 Step 3로 라우팅하고, Stale Determination(state.json 필드만 비교)도 이 상태를 잡아내지 못한다. 실제로는 §Well-formedness Determination의 렌더 시점 파일-존재 I/O 체크가 이를 malformed로 걸러 row ④로 떨어뜨리므로 안전하게 귀결되지만, 이 상호작용은 §Step 2.6의 'Pre-dispatch delete' 문단과 SPEC.md §3.4 어디에도 설명되어 있지 않다(둘 다 '삭제 자체가 실패하는 경우'만 다룬다). 또한 이 경로로 malformed 판정을 받은 row ④의 배너는 이전 성공 실행에서 남은 failure_reason(대개 null)을 그대로 보여주므로, 사용자는 '파일이 삭제된 채 재시도가 중단됐다'는 실제 원인을 배너에서 알 수 없다.
- 표결: 
  - alt:SURVIVED — 반박 실패 — 주장은 확인되며 오히려 과소평가되어 있다.

(1) 미연결 확인: SKILL.md:1187–1195 'Pre-dispatch delete' 문단은 삭제의 목적과 '삭제 자체가 실패한 경우'(branch (iii) + findings_file_stale)만 다루고, 삭제 성공 후 중단 창은 한 줄도 없다. SPEC.md §3.4(289–294)도 5줄 전부 같은 두 항목뿐이고, 
  - 재현:SURVIVED — 반증 실패 — 문면 추적으로 주장이 그대로 재현된다(저장소 무수정, git status 시작 시점과 동일).

[1] 크래시 윈도우의 존재: pre-dispatch delete는 이번 변경으로 **신설**됐다. `git show HEAD:skills/harness/SKILL.md`에는 "Pre-dispatch delete"가 없고 latch (b)가 mtime 비교였다(HEAD 1172-11

#### 13. [prose-truth] major — §Architecture Principles #1이 §Step 2.6의 신규 '디스패치 전 삭제' 행위를 다루지 않음
- 위치: skills/harness/SKILL.md §Architecture Principles #1
- 시나리오: 원칙 #1은 "Exceptions — reads only, exactly 7 (writes are a separate category, not counted in this list — see the `>` notes below; three follow, of which the second covers writes)"라고 하여, 오케스트레이터가 중간산출물 파일에 가하는 예외를 읽기(7개, 번호 목록)와 쓰기(3개 노트 중 2번째, 예: proposals.json 직렬화 쓰기) 두 범주로 완전히 열거한다고 주장한다. 파일 최상단 라인 16도 "the exceptions ... are enumerated exhaustively, and ONLY, in §Architecture Principles #1"이라고 못박는다. 그러나 이번 변경이 §Step 2.6에 새로 도입한 "디스패치 직전 `{docs_path}plan_critic_findings.md` 삭제"는 읽기도 아니고 proposals.json류의 직렬화 쓰기도 아닌 제3의 파일 조작(삭제)인데, 원칙 #1의 7개 읽기 항목에도, 3개 쓰기 각주 어디에도 등재되지 않았다. §Step 2.6 자신은 이 삭제를 "the routing predicate above already names bare file-existence as a trap for exactly that reason"라며 상세히 정당화하면서도 원칙 #1을 참조하지 않는다. 이 원칙의 '예외는 여기 다 있다'는 문장을 근거로 감사하는 사람은 이 신규 삭제 동작이 원칙 #1의 통제 범위 밖에서 조용히 추가됐다는 사실을 놓치게 된다.
- 표결: 
  - alt:REFUTED — 반박됨. 세 가지 저장소 근거가 주장을 무너뜨린다.

(1) **원칙 #1은 "읽기" 원칙이며, 파일 조작 전반의 완전 열거를 자처한 적이 없다.** skills/harness/SKILL.md:2541의 제목이 "Orchestrator reads no intermediate files."이고 예외 목록은 "Exceptions — **reads only**, exactly 7 (writes a
  - 재현:REFUTED — 주장의 전제가 파일 문면과 base 상태 양쪽에서 무너진다.

(1) 원칙 #1은 "모든 파일 조작"을 망라한다고 주장한 적이 없다. 제목이 `**Orchestrator reads no intermediate files.**`이고 리드 문장이 `Exceptions — **reads only**, exactly 7`이다. 쓰기가 `>` 노트로 언급된 것도 열거 의무가 아니라 "Writing i

#### 14. [loss-accounting] major — spec_stamp 채택이 Decision A의 「위조 가능한 값을 게이트 근거로 쓰지 않는다」 원칙과 충돌하며, 이 모순이 어디에도 언급·해소되지 않음
- 위치: SPEC.md §2.3 phase의 지위 변경(결정 A) / §3 Stale Determination(결정 ②) / §5.3 리스크 R-1 / §10 Do NOT
- 시나리오: 결정 A는 「phase는 모델이 쓰는 값이라 위조 가능하므로 게이트 통과 증거로 쓰지 않는다」(PROBE §3 안 A/B 폐기 사유 '모델이 쓴 값은 모델이 위조한다')는 원칙으로 phase를 감사 전용으로 강등했다. 그런데 rev.4가 채택한 spec_stamp/spec_stamp_at_critic 역시 orchestrator(모델)가 스스로 쓰는 값이며, 이 값이 바로 HARD GATE #1(spec-confirm)의 Auto-revise Exposure Predicate 4번 조건과 Pass A의 stale 배지 렌더 여부를 결정한다. spec_stamp 기록에 버그가 있거나(예: 줄 수를 보존하는 편집 — 공시된 손실) generation/lines가 실제와 어긋나게 기록되면, 판정은 조용히 'not stale'로 떨어져 사람에게 '이 크리틱은 지금 spec과 일치한다'는 잘못된 확신을 준 채 Auto-revise를 노출한다 — 이는 결정 A가 phase에 대해 정확히 막으려던 것과 동일한 범주(모델 자기서명 신뢰)의 위험이다. Decision A와 Decision ②는 SPEC의 같은 결정 표에서 한 행 차이로 붙어 있고 '위조' 언어까지 공유하는데도, rev.4의 변경 요약·§5.3(가장 큰 미해결 리스크로 명시된 절)·§10 Do NOT 절 어디에도 이 긴장이 제기되거나 해소된 흔적이 없다.
- 표결: 
  - 재현:REFUTED — 반박(refuted). 주장이 전제한 '원칙'도, '미공시'도 문면에서 재현되지 않는다.

1) 결정 A의 범위가 SPEC 안에서 명시적으로 좁게 정의돼 있다 — 주장은 그것을 보편 원칙으로 확대해석했다.
SPEC.md:182 (§1 「명제가 커버하지 않는 것」 3번): 「게이트 통과 사실은 어디에도 기록되지 않는다(결정 A). 명제는 「게이트 턴의 무능력」이지 「게이트를 통과했음의 증명」이
  - alt:REFUTED — 반박한다 (refuted=true). 네 갈래로 무너진다.

**① 결정 A의 사정거리를 잘못 읽었다 — 「게이트 통과 기록(산출)」이지 「게이트가 읽는 입력」이 아니다.**
SPEC.md 결정표 A행의 항목명 자체가 `게이트 통과 기록`이고, 근거란은 「게이트가 `phase → "generate_ready"`를 **쓸 수 없다**(§Step 3 Pass B)」가 첫 문장이다 — 위조는 두 

#### 15. [state-machine] major — row④ 배너 규칙에 미정의 3번째 조합 존재 — applied=='executed' AND malformed AND failure_reason==null
- 위치: Pass A row④ / §State-Space Derivation
- 시나리오: 위 finding의 시나리오가 도달하는 정확한 상태(row④, applied=='executed'는 1차 pass 성공 write에서 그대로 유지, malformed=파일 부재, failure_reason=null — 1차 pass 성공 write가 failure_reason=null로 남긴 채 2차 write가 인터럽트로 미발생)를 이어받는다. row④의 배너 규칙 원문: 「+ a banner showing plan_critic.failure_reason if present, or — when applied is unrecorded (failure_reason is absent-or-null there, since branch (ii) never writes it; null-safe per the guard rule above) — the default banner ... (never silently blank either way)」. 이 문장은 정확히 두 케이스만 다룬다: (i) failure_reason이 present(참), (ii) applied가 unrecorded(미기록). 위 상태는 applied=='executed'(레코드됨 — unrecorded 아님)이면서 failure_reason==null('present' 아님)인, **문면이 다루지 않는 세 번째 조합**이다. 어느 조건절도 성립하지 않으므로 이 케이스에서 정확히 무엇을 배너에 표시할지 규정되어 있지 않고, 구현이 빈 배너를 낼 위험이 있어 같은 행이 명시적으로 약속한 「never silently blank either way」와 충돌한다. C2가 신설한 pre-dispatch delete가 바로 이 조합을(정상적인 Auto-revise 재진입 흐름 중 단순 인터럽트만으로) 상시 도달 가능하게 만든 원인이다 — C2 이전에는 own-critic 성공 직후 findings 파일이 임의로 사라지는 경우가 수동 삭제 등 희귀 상황에 국한됐다.
- 표결: 
  - 재현:NO-VERDICT
  - alt:NO-VERDICT

#### 16. [state-machine] minor — failure_reason='findings_file_missing'이 latch의 두 이질적 실패 원인((a)파일 부재 vs (b)spec_stamp null)을 한 문자열로 뭉갬 — C2가 스스로 내세운 진단성 목표와 충돌
- 위치: §Step 2.6 Latching `applied = "executed"` / Failure handling — 3-way (iii)
- 시나리오: Latching 문면: 「only after confirming {docs_path}plan_critic_findings.md (a) exists AND (b) state.spec_stamp is non-null」 — 두 개의 독립 조건. Failure handling (iii): 「plan_critic.failure_reason = ... 'findings_file_missing' (latch check) ...」 — (a) 실패든 (b) 실패든 동일하게 'findings_file_missing'으로 기록된다. 즉 spec_stamp가 write protocol 도중 인터럽트되어 null이 된 것이 원인이어도(이 경우 findings 파일 자체는 정상적으로 존재할 수 있다) 기록·배너는 마치 '파일이 없다'처럼 보인다. 이는 SKILL.md 자신이 이번 diff의 §Session Recovery item 7 서술에서 밝힌 설계 취지 — 「spec_stamp plus plan_critic.spec_stamp_at_critic ... after the move off mtime they are the ONLY surface on which a wrong stale/not-stale verdict can be diagnosed at all: the filesystem no longer carries a second opinion a user could check with ls -l」 — 와 정면으로 배치된다. 유일한 진단 표면인 failure_reason이 '파일 없음'과 '스탬프 경합'을 구분하지 못하면 사용자는 ls -l로도 state.json으로도 실제 원인을 가려낼 수 없다.
- 표결: 
  - 재현:NO-VERDICT
  - alt:NO-VERDICT

#### 17. [loss-accounting] major — 라이브 줄 수 비교가 오케스트레이터 자신의 카운팅에 의존한다는 사실과 그 신뢰성 리스크가 전혀 공시되지 않음
- 위치: SKILL.md §Step 2 spec_stamp write protocol 3단계 / §Stale Determination 'LIVE line count' 절
- 시나리오: write protocol 3단계는 'lines: <line count of the file as it now stands on disk>'라고만, Stale Determination은 'the LIVE line count of spec.md, counted from the content ... already read this turn'이라고만 적어, 줄 수를 얻는 방법(도구 호출로 결정론적으로 세는지, Read 결과의 cat-n 넘버링 마지막 줄을 읽는지, 모델이 본문을 보고 직접 세는지)을 명시하지 않는다. mtime은 OS가 결정론적으로 유지하던 값이라 이런 방법 의존성이 없었다. 새 메커니즘에서는 spec.md가 길거나 Read 결과가 잘리는 경우 write-time 카운트와 read-time 카운트가 각각 다른 이유로 부정확해질 수 있고, 두 부정확치가 우연히 일치하면 실제로 줄 수가 바뀐 편집조차 'not stale'로 오판될 수 있다. 이 리스크는 SKILL.md의 'Disclosed limit' 문단(줄 수를 보존하는 편집만 언급), CHANGELOG.md, SPEC.md 어디에도 등장하지 않는다 — 공시된 손실 목록('줄 수 보존 편집 미탐지')과는 성격이 다른, 완전히 별개의 미공시 리스크다.
- 표결: 
  - 재현:SURVIVED — 문면 추적 + 스크래치 재현 결과, 핵심 주장(줄 수 획득 방식이 명세되지 않았고 그 신뢰성 리스크가 손실 목록 어디에도 없다)은 그대로 성립한다. 반증 실패.

1) 인용 정확성 확인 — SKILL.md:988 write protocol 3단계는 `lines: <line count of the file as it now stands on disk>`가 전부이고, :1357-1359 Stal
  - alt:REFUTED — 반증됨. 주장의 핵심 전제("줄 수를 얻는 방법이 명시되지 않았고, 오케스트레이터 자신의 카운팅에 의존한다는 사실이 어디에도 공시되지 않았다")가 저장소 문면과 어긋난다.

1) read-time 카운팅 소스는 명시돼 있다. §Stale Determination은 "the LIVE line count of `{docs_path}spec.md`, **counted from the content

#### 18. [loss-accounting] minor — I/O-실패 축 손실의 공시가 줄 수 손실과 한 문장에 뭉뚱그려져 있고, 근거 문장 자체가 비논리적
- 위치: SKILL.md §Stale Determination 'Disclosed limit' 문단 / CHANGELOG.md 'One detection is genuinely lost' 항목
- 시나리오: 해당 문단은 '줄 수를 보존하는 외부 편집은 탐지되지 않는다'는 문장 뒤에 곧바로 'mtime... had an I/O-failure axis to fall closed on... so there is no such axis here'를 붙여, 서로 독립적인 두 손실(탐지 커버리지 축소 vs fail-closed 안전망 소실)을 '하나의 공시된 손실'처럼 제시한다. 게다가 'there is no such axis here'의 근거로 제시된 절('a counter that was simply never advanced is indistinguishable from one that did not need to be')은 실제로는 앞 문장의 탐지-커버리지 논증을 재사용한 것일 뿐, I/O 실패 축이 왜 구조적으로 사라졌는지(별도의 파일시스템 stat 호출이 더 이상 필요 없어졌기 때문)는 설명하지 못한다. CHANGELOG.md도 동일하게 이 두 손실을 하나의 bullet('One detection is genuinely lost')으로 묶어, 이 브리핑이 전제한 '공시된 손실은 하나뿐'이라는 인상을 그대로 심어준다.
- 표결: 
  - alt:REFUTED — 반박됨. 세 갈래로 근거를 든다.

**① "두 손실을 한 문장에 뭉뚱그렸다"는 문면과 다르다.** `skills/harness/SKILL.md` §Stale Determination의 Disclosed limit 문단은 손실 A(줄 수 보존 외부 편집)를 **독립된 첫 문장**에 굵은 "**NOT detected**"로 단독 진술한다. I/O 축은 그 다음 비교 문장에서 "mtime이 가졌
  - 재현:REFUTED — 재현 실패 — 주장의 두 핵심 고발이 모두 문면에서 성립하지 않는다.

① "뭉뚱그려져 있다"가 재현되지 않음. C:/workspace/agent-harness/skills/harness/SKILL.md 1384–1391행의 문단은 두 손실을 각각 명시 문장으로 적는다: (A) "An external edit that leaves the line count unchanged … is NOT 
