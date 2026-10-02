# Spec — harness converge flow

> 에픽: harness UX 개선. 자동 수렴(Converge), 세션 내 승인, 승인 뒤 자동 체인, 에픽 슬라이스 자동 연쇄를 다룬다.
> 근거: `design/practitioner-hardening/CONVERGE.md`. 4라운드 동안 수렴하지 않았고, 수렴 워크플로를 쓴 뒤에야 C/M 0에 도달했다.
> 최종본(2026-09-29): 사용자 결정 D1~D4·E 반영. 수렴 워크플로 3라운드(C/M 19 → 6 → 4) 뒤 잔여 major 4건·minor는 오케스트레이터가 직접 반영했다.

### 목표

1. 사람이 치는 메시지를 `/harness "task"` 하나로 줄인다. 수렴 → (결정 질문) → 승인 → 구현 → 커밋이 같은 세션에서 이어진다. 에픽이면 슬라이스도 연달아 진행되고, 사람은 슬라이스마다 승인 클릭 한 번만 한다.
2. Plan Critic 반복을 자동 수렴 루프로 바꾼다. 루프는 리뷰 → 검증·분류 → 일괄 반영 → 델타 재검증 순서로 돈다. 원장이 이미 처리한 발견이 다시 나와도 되풀이하지 않는다. 사람은 정말 갈리는 결정에만 답한다.
3. "승인 전 구현 금지"라는 목적(`design/harness-ordering-enforcement/SPEC.md`)은 유지하고 수단만 바꾼다. 수단은 세 가지다. AskUserQuestion 라벨 선택으로 받는 승인, spec 세대(`spec_stamp`)에 묶인 승인 기록, `/harness-build` §Entry의 fail-closed 거부. 순서 보증 등급은 Fast Gate와 같다(위험 1).

### 배경

- **비용은 구조에서 나온다.** 수정 한 바퀴마다 명령 3개(`/harness-gate` → `--modify|--critic` → `/harness-gate`)가 들었고, `spec_stamp`가 전진할 때마다 전체를 다시 비평했다. 실측 C/M은 5/9 → 3/8 → 3/11 → 2/10으로 수렴하지 않았다.
- **critic에게는 기억도 검증도 없다.** 이전 판정을 받지 않고, 거짓 양성을 거르지 않는다. 종료 기준은 같은 바이트에서도 흔들리는 자기신고 counts다(ROADMAP "Plan Critic has run-to-run variance" 행).
- **같은 턴 승인·체인에는 선례가 있다.** §Fast Gate(AskUserQuestion 승인 → `gate.approved` → Skill로 `harness-build`, build §Entry 거부 가드, 라이브 프로브 4회 이상 성공)와 `/handoff resume`의 "Start next step"이다.
- **게이트 스킬로는 체인할 수 없다.** `disallowed-tools`가 턴 범위로 누출되기 때문이다(`mode_gate.md` 규칙 3(a)). 그래서 체인은 쓰기 도구를 가진 `/harness` → `/harness-build` 경로에서만 한다.
- **에픽 슬라이스는 지금 전부 수동이다.** §Step 3.6이 `slice_plan.md`를 쓰고 `.harness/`를 지운 뒤, 슬라이스마다 사람이 `Command` 열로 `/harness`를 새로 시작한다. `Command`는 `skills/harness-build/SKILL.md` §Step 3.5 `slice_plan.md` format이 바이트 동일 실행용으로 정의한 형식이므로 체인 입력으로 그대로 쓸 수 있다.
- **이전 초안들이 수렴하지 않은 원인.** 결함마다 상태값·예외·분기를 더했고, 더한 장치마다 새 결함이 생겼다. r3은 범주·분기를 더 줄였다(§r2 대비 단순화).

### 범위

**포함**
- `/harness` §Step 2.6 확장(Step id 유지): 수렴 루프, 원장, 두 값 종료, 결정 질문, `plan_critic` 사상.
- §Approval Gate(§After Plan Phase 안, fast·슬라이스 변형 포함), §Fast Gate의 포인터화, 게이트 모드(기본 inline, `--separate-gate`·`gate=separate` opt-in).
- `/harness-build` §Entry 거부 가드 일반화, `/harness-gate` 리다이렉트·배너 정정, 재개 라우팅.
- 에픽 슬라이스 자동 연쇄(§Step 3.6 → 첫 슬라이스, 슬라이스 §Step 8 → 다음 슬라이스), 깨끗한 종료 슬라이스의 자동 커밋.
- additive state 필드(`version` "3.0" 불변), AC-24 grep에 걸리는 문면 정정, ordering SPEC 행 안 정정, 라이브 프로브 기록 `design/harness-converge/PROBE.md`.

**제외** (ROADMAP 이월로 기록)
- 새 Workflow 세그먼트 `harness.converge`(D4). Setup 조건부 질문 묶음(지금도 `agent-harness-defaults` 한 줄이면 0회다) (정정 2026-10-02, S1–S3 리뷰: 한 줄이 없애는 것은 Model·Mode Gate 질문뿐이다. Convention Scan은 키가 없어 루트 CLAUDE.md가 sparse·missing이면 남고, S3 체인에서는 슬라이스마다 다시 묻는다.).
- 체인 밖 build 질문 변경(Layer 2/3 Fix/Accept, HARD GATE #2/#3, 체인 밖이거나 깨끗한 종료가 아닌 Step 8 커밋 질문).
- `spec.eval.workflow.js`, `templates/spec/critic_inline.md`, `harness.plan.workflow.js`의 args·본문 변경. SYNC 그룹 `spec-eval-dual-caller`와 `critic-revision-block`은 건드리지 않는다.
- Auto-revise 재합성 개선, separate 경로의 잔여 재시도 비용(라운드당 명령 3개), 보존 중인 Stage 1 세션(`.harness/state.json`) 수정, separate 게이트 Pass B "Plan as epic" 설명 변경(슬라이스 체인 동의는 슬라이스 승인 클릭에서 받으므로(E-1) 필요 없다).

### 접근 방식

#### 확정 결정

| # | 결정 | 이 spec에서의 귀결 |
|---|---|---|
| D1=A | 새 세션 기본값은 세션 내 승인(inline)이다. | 라벨 선택으로만 승인이 성립한다. 기록은 `spec_stamp`와 경로에 결속한다. 체인 조건을 만족하면 같은 턴에 Skill로 `/harness-build`를 부른다(에픽이면 `--epic`). 무도구 별도 턴 게이트는 `--separate-gate`·`gate=separate`로 존속한다. ordering SPEC 결정 ①·A·⑧과 rev.9(b) 행 안에 정정을 덧붙인다: "기본 inline 경로는 모델이 쓴 승인 기록을 순서 근거로 채택한다(Fast Gate와 같은 등급)". |
| D2=A | 자동 반영은 정합성·사실·배선 교정만 한다. | 범위·AC 의미·트레이드오프 변경과 새 AC·state 필드·단계 추가는 decision이다. 실측 근거가 없는 발견은 auto가 되지 않는다. |
| D3=B | 결정 먼저, 승인은 나중. | 결정 질문 → 반영 → 자동 재검증 → 반영 요약과 함께 승인 질문(결정이 있으면 2회, 없으면 1회). 승인 뒤에는 spec 쓰기가 없다. |
| D4=A | 새 세그먼트 없음. | 두 경로 모두 인라인 서브에이전트로 디스패치한다. 1라운드 critic만 기존 경로별 디스패치를 재사용한다. |
| E | 에픽 슬라이스 자동 연쇄 포함. | 별도 슬라이스 S3로 두고, 라이브 프로브는 마지막 S4에서 한다. 설계 결정은 E-1~E-3이다. |
| E-1 | 슬라이스 승인은 생략하지 않는다. | 대화형 inline 슬라이스 세션은 §Approval Gate 승인 질문을 1회 렌더한다(결정이 있으면 결정 질문이 먼저). 옵션은 {Build now, Modify, Stop}이며 Plan as epic이 없어 에픽이 중첩되지 않는다. 체인 조건을 만족할 때만 "Build now" 설명에 자동 커밋(E-2)과 다음 슬라이스 자동 진입을 적고, 그 클릭을 슬라이스별 동의로 삼는다. 이유: 생략(위임)하려면 동의 출처 추적, 체인 조건 결속, 범위 가드라는 장치 셋이 필요한데, `slice_plan.md`만으로는 셋 다 성립하지 않는다. 그 비용에 비하면 슬라이스당 클릭 1회가 싸다. |
| E-2 | 깨끗한 종료 슬라이스의 커밋은 묻지 않는다. | 체인 조건을 만족하고 **깨끗한 종료**인 슬라이스 세션의 §Step 8은 질문 없이 "Commit code only"를 적용하고 공시한다. 스테이징은 그 세션이 바꾼 파일과 "Commit code only"가 원래 커밋하는 산출물로 한정한다. 깨끗한 종료가 아니면 현행 §Step 8 커밋 질문을 렌더한다. 커밋이 실패하면 경계 멈춤이다("커밋을 해결하거나 수동 커밋한 뒤" 한 줄, 다음 행 `Command`, "다음 슬라이스 시작 시 item 7에서 Restart로 남은 `.harness/` 정리" 한 줄). |
| E-3 | 컨텍스트 때문에 멈추는 곳은 슬라이스 경계뿐이다. | 경계는 §Step 3.6 뒤와 슬라이스 §Step 8 성공 뒤다. 슬라이스 도중에는 자동 압축에 맡긴다(전역 지침 §세션 연속성). 수치 한계는 두지 않는다. 체인 상태는 모두 디스크(`slice_plan.md`, 커밋, `state.json`)에서 다시 도출하므로 압축 뒤에도 이어진다. |

- **체인 조건**(아래 두 정의는 이름으로 인용한다)**:** 게이트 모드가 inline이고, `run_style==auto`이며, 대화형 세션일 것. 체인하는 모든 지점(승인 → build, §Step 3.6 → 첫 슬라이스, §Step 8 자동 커밋, 다음 슬라이스)과 그 지점을 약속하는 옵션 설명에서 판정한다. 하나라도 어긋나면 그 지점은 현행 동작을 따른다.
- **깨끗한 종료:** Reason == `QA PASS`이고 `verify.layer1_result == PASS`이며, `verify.cold_result`가 `clean`이거나 `cli_flags.cold_pass == false`에서 온 `skipped`일 것. 그 밖(`null`, 다른 원인의 `skipped` — `skipL1`·git 실패·빈 입력 —, `findings`·`retried_*`·`failed`, `Accept as-is`·`Max rounds reached`)은 깨끗한 종료가 아니다.

#### 전체 흐름

1. **Setup, Plan (Step 1~2):** 현행과 같다. Step 1은 새 세션마다 게이트 모드를 기록한다. 우선순위는 `--separate-gate` > `gate=` > 기본 inline이다. `--fast`는 항상 inline이며, `--separate-gate`와 함께 주면 halt한다. 게이트 모드 필드는 기존 `gate.mode`(승인 방식 `"fast"`)와 이름이 겹치지 않게 한다. 필드가 없는 기존 세션은 `cli_flags.fast`면 inline, 아니면 separate로 읽는다. `spec_stamp`에 결속되지 않은 기존 `gate.approved`는 승인 없음으로 본다(재개가 §Approval Gate를 다시 렌더한다. 비용은 재클릭 1회). 슬라이스 세션 여부는 기록하지 않고 도출한다: task 문자열이 `{docs_path}`의 부모 디렉터리에 있는 `slice_plan.md`(= `Command`의 `--output-dir` 값)의 한 행 `Slice`와 같으면 슬라이스 세션이다.
2. **Step 2.6 수렴 루프:** 한 번의 "실행"은 라운드 예산 R = 5 안에서 돈다. §Step 2.6 routing predicate가 루프를 건너뛰는 세션(fast, carried_over)은 현행대로 게이트로 간다. 라운드 하나는 다음 순서다.
   - **리뷰.** 실행의 첫 라운드는 전체 리뷰이고(결정·Modify 반영 직후의 실행은 예외로 델타 리뷰), 그 밖의 라운드는 델타 리뷰다. 전체 리뷰는 기존 critic 디스패치(WORKFLOW `spec.eval`, INLINE `critic_inline.md`. 선택은 §Step 2.6 최초 진입에서 Mode Gate 경로를 따르고, 재개·`--critic`·Modify 뒤 재실행에서만 §Gate re-entry flags `--critic` 행의 INLINE 규칙을 적용한다)와 저장소 실측 리뷰 서브에이전트 1개로 한다. 델타 리뷰의 입력은 경로(스냅샷·spec·원장)뿐이고, 범위는 바뀐 구간과 그 구간을 정방향·역방향으로 인용하는 절이며, diff는 서브에이전트가 계산한다. (정정 2026-10-02, S1 구현: Modify 반영 뒤의 델타 예외는 Modify 쓰기 직전에 직전 실행이 `converged`·`capped`로 사상되어 있고 `skills/harness-gate/SKILL.md` §Stale Determination이 not stale인 세션에만 적용한다. `failed`·미기록·루프 이전 세션, 그리고 마지막 사상 뒤 spec이 바뀐 세션(편집기 직접 수정, 중단된 쓰기, 리뷰되지 않은 쓰기)의 Modify 뒤 실행은 전체 리뷰로 시작한다. Modify의 스냅샷은 자기 편집 직전 spec 전체를 담으므로, 그런 세션의 델타 리뷰는 리뷰되지 않은 구간을 리뷰된 것으로 사상하기 때문이다. 델타 리뷰만으로 `executed`가 기록되면 흐름 5·AC-15가 미검토로 노출하는 `failed` 세션이 전체 리뷰 없이 행 ②에 착지하기 때문이다. 결정 반영 뒤 실행은 같은 턴의 실행이 `converged`·`capped`로 끝난 뒤에만 오므로 그대로 델타다 — `templates/harness/converge.md` §Starting a run.) (정정 2026-10-02, S2 구현: §재개 5의 결정 질문은 같은 턴의 실행 없이 렌더되므로, 재개 시 결정 반영 뒤 실행은 위 Modify 규칙을 따른다 — 직전 실행이 `converged`·`capped`이고 not stale일 때만 델타, 아니면 전체 리뷰.)
   - **검증·분류.** 판정 서브에이전트 1개가 발견을 군집화하고 지문(절 앵커 + 결함 클래스 + 핵심 식별자)을 붙여 `auto` / `decision` / `reject`로 나눈다. 경계는 D2이고, 실측 근거가 없으면 reject 쪽이다. 원장에 있는 지문이 새 근거(바뀐 구간을 가리키는 근거) 없이 다시 나오면 기존 항목에 합친다. decision에는 선택지 2~4개와 권장안이 붙는다.
   - **종료 판정.** 검증 뒤 원장에 미반영 auto C/M이 0이면 `converged`다. 0이 아니고 r = R이면 `capped`다. 둘 다 아니면 반영하고 다음 라운드로 간다. decision과 Minor는 판정에 넣지 않는다.
   - **반영.** 종료하지 않은 라운드는 원장의 미반영 auto를 전부(Minor 포함) 한 번에 반영한다. 종료 라운드는 쓰지 않는다. 남은 미반영 auto는 잔여로 보고되고, 다음 실행의 첫 라운드가 판정에서 다시 잡는다. 반영된 변경은 모두 뒤 라운드의 리뷰를 거친다.
3. **spec.md 쓰기 사건:** 사건은 라운드 반영, 결정 반영, Modify 반영, 재개 시 재스탬프(§재개 3)다. 사건마다 직전에 `.harness/converge/snapshot.md`를 덮어쓰고, `spec_stamp` 쓰기 프로토콜을 한 번 감싼다(generation +1). 결정·Modify 반영 뒤에는 새 실행이 시작된다. 루프를 건너뛰는 세션은 스냅샷·새 실행 없이 stamp +1만 한다. (정정 2026-10-02, S2 구현: 재개 시 재스탬프는 스냅샷을 덮어쓰지 않는다. 내용 변경이 없으므로 덮어쓰면 스냅샷이 편집된 spec과 같아져, 재스탬프가 존재하는 이유인 직접 편집·중단된 쓰기 구간이 다음 실행의 diff에서 사라지고 그 구간의 재제기가 원장 항목에 합쳐지기 때문이다. 재스탬프 뒤 실행은 전체 리뷰다 — `templates/harness/converge.md` §Write Events.) (정정 2026-10-02, S2 리뷰: 위 근거는 스냅샷이 있을 때만 성립한다. 실행이 아직 아무것도 반영하지 않아 원장만 있고 스냅샷이 없는 세션에서는 diff의 기준이 없어 모든 재제기가 합쳐지므로, 재스탬프가 빈 `snapshot.md`를 먼저 써서 spec 전체를 바뀐 구간으로 잡는다.)
4. **결정 질문(D3=B):** 실행이 끝났을 때 미결 decision이 있고, 대화형이고, 원장에 답한 결정이 아직 없으면 묻는다. 승인과는 다른 AskUserQuestion 호출이다. 권장안을 표시하고, 호출당 질문 상한을 넘으면 나눈다. Other 자유서술은 그 결정의 답으로 반영한다. 반영은 쓰기 사건 1회이고 새 실행이 뒤따른다. 이미 답한 세션에서 새로 나온 decision은 승인 요약의 잔여로 둔다(세션당 1회, 원장에서 도출).
5. **사상:** 실행이 끝나면 `plan_critic`에 많아야 한 번 쓴다. 이것이 그 턴의 마지막 spec 관련 쓰기다. 재사용하는 1라운드 critic 디스패치의 자체 latch 쓰기는 하지 않는다. (정정 2026-10-02, S1–S3 리뷰: '그 턴'은 '직전 사상 이후'로 읽는다 — §Approval Gate의 Modify는 같은 턴 안에서 실행과 사상을 반복하므로, 사상은 루프마다 한 번이고 rounds는 직전 사상 이후 완료된 실행의 라운드만 더한다.)
   - `converged`·`capped`: `applied="executed"`, `source="own"`, counts = 잔여(원장 미결 항목 전부, 즉 미결 decision + 미반영 auto), `last_findings_path` = `{docs_path}plan_critic_findings.md`, `failure_reason` = null, `spec_stamp_at_critic` = 현재 stamp(7필드 한 번 쓰기는 §Step 2.6 Success 형태). Auto-revise 기회는 소진으로 기록해 재합성이 수렴 결과를 덮어쓰지 않게 한다.
   - `failed`: 기존 §Step 2.6 "Failure handling — 3-way"의 형태와 배너를 쓴다. (ii)(기록 없음)는 1라운드 WORKFLOW `spec.eval`의 권한 거부에만 적용한다. 루프 내부 인라인 디스패치의 거부·실패와 트리 오염은 (iii) `applied="failed"`에 새 `failure_reason`으로 기록한다. 둘 다 gate 행 ④에 착지한다. (i) 엔진 오류는 실패가 아니라 INLINE 재시도다(AC-15).
   - 잔여 보고서와 원장 요약은 `{docs_path}plan_critic_findings.md`에 렌더한다. 원장과 스냅샷은 `.harness/converge/`에 두고 `.harness/`와 함께 지운다.
6. **§Approval Gate(inline, HARD GATE #1의 세션 내 렌더):**
   - 요약에 들어가는 것: 실행·라운드 수와 종료 상태, 자동 반영 목록(항목당 1줄), 기각 수, 반영한 결정, 잔여 C/M/m, Scale Assessment. 배너는 두 가지다. `failed`면 기존 §Step 2.6 실패 배너(spec unreviewed)를, `capped`이거나 잔여 C/M이 있으면 "검토 미완" 배너를 붙인다.
   - AskUserQuestion은 1회이고 승인만 담는다. 옵션은 {Build now, Plan as epic, Modify, Stop}이다. fast 세션(§Step 1 item 5가 `--fast`+`--epic`을 halt)과 슬라이스 세션(에픽 중첩 방지)은 Plan as epic 없이 3개다. 선두 옵션은 `skills/harness-gate/SKILL.md` §Step 3 Pass B의 leading-option 표를 이름으로 인용한다. 체인 조건을 만족할 때만 Plan as epic 설명에 "슬라이스가 자동으로 이어지고, 슬라이스마다 승인 1회, 깨끗한 종료 슬라이스는 자동 커밋"을, 슬라이스 세션의 Build now 설명에 E-1 문구를 적는다.
   - Modify: 요청을 반영해 쓰기 사건 1회를 만들고(흐름 3), 새 실행과 사상을 거친 뒤 게이트를 다시 렌더한다. 빈 요청이면 반영 없이 전체 리뷰 실행만 한다(루프를 건너뛰는 세션은 재렌더만). Other 자유서술과 모호한 응답은 Modify로 처리하며, 결코 승인이 아니다.
   - Stop: 아무것도 쓰지 않고 멈춘다.
7. **승인 처리:** 승인은 Build now 또는 Plan as epic 라벨을 선택할 때만 성립한다. 예외는 없다. 승인 기록은 한 번에 쓰며, 승인 여부·시각·그 시점의 `spec_stamp`·경로(single·epic)를 담는다. 기록과 체인 사이에는 spec 쓰기가 없다. 체인 조건을 만족하면 같은 턴에 Skill로 `harness-build`를 체인한다(epic이면 `--epic`).
8. **inline 멈춤 출력:** inline 세션이 `plan_done`에서 멈추면(Stop, 체인 조건 불충족, 체인 실패, 비대화형) Type A 블록을 출력한다. `Resume` 행은 승인 기록이 AC-11 검사를 통과하면 `/harness-build{ --epic}`, 아니면 `/harness`다. 별도 `Next →` 줄은 없다. 승인 뒤 `run_style=phase`의 다음 명령이 `/harness-build`라는 `templates/_shared/run_style.md` §run_style과 맞는다.
9. **비대화형과 도구 부재:** headless·cron·sub-agent·`--no-prompt`이거나, AskUserQuestion이 없거나 호출이 실패한 경우다. 이때는 결정·승인 질문, 승인 기록, 체인이 모두 없다. 텍스트 폴백(`askuserquestion.md`) 응답은 번호든 키워드든 승인이 아니다(`--fast`에도 적용되는 회귀이며 CHANGELOG에 공시). 요약과 미결 결정을 출력하고 `plan_done`에서 멈춘다(inline은 흐름 8, separate는 `Next → /harness-gate`). inline 출력에는 탈출구 한 줄을 공시한다: "AskUserQuestion을 쓸 수 없는 환경이면 `/harness "<task>" --separate-gate`로 새 세션을 시작하고, 재개 질문(item 7)에서 Restart를 고르라(수렴 결과는 이어지지 않고, `--fast`와는 함께 쓸 수 없다)". (정정 2026-10-02, S2 리뷰: item 7 질문도 답할 수 없는 환경(headless·cron)에서는 Restart를 고를 수 없으므로, 탈출구 문구에 "그런 환경이면 먼저 `.harness/`를 지우라"를 더한다.) `mode_gate.md` 규칙 3의 "never block an automated run"은 경로 선택에만 적용되고, 승인에는 적용되지 않는다. (정정 2026-10-02, S2 리뷰: 이 문구의 출처는 규칙 3이 아니라 `mode_gate.md` §Ambiguity Prompt 5단계다. 규칙 3은 엔진 실패 폴백·권한 거부 분기다.)

#### 게이트 모드별 동작

- **separate:** 흐름 1~5(결정 질문 포함)는 똑같이 돌고, 사상 뒤 `Next → /harness-gate`로 멈춘다. 그 뒤는 현행 3메시지 흐름과 결정 A를 따른다. 사상이 마지막 쓰기이므로 게이트는 not-stale 행에 착지한다. "Run Critic anyway"는 `/harness --critic`(변경 없는 재실행)이다. 이 실행의 첫 라운드가 남은 미반영 auto를 잡으므로 진전이 생긴다.
- **inline 세션에서 `/harness-gate`를 부른 경우:** AskUserQuestion 없이 리다이렉트 한 줄("이 세션의 승인은 /harness")만 출력하고 멈춘다.
- **`/harness-gate` 배너:** 행 ①-c의 round 배너는 "자동 수정 기회 소진(Auto-revise 또는 수렴 루프)"으로 바꾼다. 행 ④ 기본 배너에는 루프가 `running`일 때 "수렴 루프 중단 — /harness로 재개" 분기를 둔다.

#### 재개 (`/harness` 재호출)

재호출은 현행 `session_recovery.md` item 7 질문을 렌더한다. 'Resume'을 고르면 아래 순서에서 처음 맞는 항목 하나로 간다.

1. `epic.boundaries != null` 선검사(현행 문구). (정정 2026-10-02, S2 리뷰: separate 세션에만 적용한다. inline 세션은 2~6이 승인 기록으로 라우팅한다 — 통과하는 승인은 기록된 경로대로 체인·멈춤하고(epic이면 `/harness-build --epic`, §Step 3.5 재진입이 기록된 경계 응답을 재사용), 통과하지 못하는 승인은 §Approval Gate를 다시 렌더한다. 그대로 두면 경계 응답 뒤 spec이 바뀐 inline 세션에서 이 항목의 `/harness-build --epic` 안내와 build의 `/harness` 안내가 서로를 가리켜 순환한다(AC-12 "승인·거부 순환 없음" 위반).)
2. inline이고 승인 기록이 AC-11 검사를 통과하면: 체인 조건을 만족하면 기록된 경로대로 체인하고, 아니면 흐름 8대로 멈춘다. 승인이 통과하면 spec은 승인 뒤 바뀌지 않았으므로 루프를 다시 돌리지 않는다.
3. inline이고 stamp가 null·malformed이거나 live 줄 수 ≠ `spec_stamp.lines`(편집기 직접 수정, 쓰기 프로토콜 도중 중단)면, 내용 변경 없는 쓰기 사건 1회로 stamp를 다시 찍고, §Stale Determination을 거치지 않고 곧바로 4의 새 실행(전체 리뷰)으로 간다(루프를 건너뛰는 세션은 6의 게이트로). §Approval Gate 요약에 "재스탬프됨(중단된 쓰기 또는 직접 편집)" 배너 한 줄을 더한다. (정정 2026-10-02, S2 리뷰: 목적지는 4의 두 번째 갈래부터다 — `plan_critic`이 미기록이면 §Step 2.6(fast·carried_over 건너뛰기 적용), 기록이 있으면 새 실행(전체 리뷰). Step 2 쓰기 도중 끊긴 `--fast`·/spec 유래 세션은 `plan_critic`이 아직 없어 "루프를 건너뛰는 세션"이 아니므로, 곧바로 새 실행으로 보내면 `--fast`의 Plan Critic 생략과 carried_over 생략을 어긴다.)
4. 루프가 `running`이거나, 사상이 없거나, inline에서 `skills/harness-gate/SKILL.md` §Stale Determination(이름 인용)이 stale(fail-closed 포함)을 내면, 원장을 유지한 채 §Step 2.6 routing predicate대로 새 실행을 전체 리뷰로 시작한다. 결정·Modify 반영 직후 새 실행 전에 끊긴 세션도 stamp가 사상보다 앞서므로 여기서 잡힌다. stale-unknown(carried_over·failed)과 not-stale은 루프를 돌리지 않는다. separate의 stale은 현행대로 `/harness-gate`가 판정한다.
5. 미결 decision이 있고 아직 결정 질문을 하지 않았으며 대화형이면 결정 질문을 한다.
6. 게이트 단계: inline이면 §Approval Gate를 렌더하고, separate면 §After Plan Phase의 `Next → /harness-gate`로 간다.

#### 에픽 슬라이스 자동 연쇄 (E)

- **에픽 세션:** Plan as epic 승인 → `/harness-build --epic` → §Step 3.5 경계 Q&A(현행) → §Step 3.6(`slice_plan.md` 쓰기, `.harness/` 삭제). 체인 조건은 삭제 전에 판정한다. 조건을 만족하고 첫 행 `Command`가 형태 검사를 통과하면, 그 `Command`를 바이트 동일로 Skill `harness`에 넘겨 같은 턴에 시작한다. 그 밖에는 경계 멈춤이다.
- **삭제와 체인 순서:** 체인 조건은 `.harness/` 삭제 전에 판정하고, 체인은 삭제 성공과 경계 출력 뒤에만 한다. 삭제에 실패하면 경계 멈춤이다(§Step 3.6·§Step 8 공통).
- **형태 검사:** `Command`가 `skills/harness-build/SKILL.md` §Step 3.5 `slice_plan.md` format과 정확히 같을 것. 즉 task == 같은 행 `Slice`이고, 플래그는 `slice_plan.md`가 있는 디렉터리를 가리키는 `--output-dir` 하나뿐이다. `--fast`·`--mode`·다른 경로 같은 손으로 넣은 플래그는 체인하지 않는다.
- **슬라이스 세션:** 흐름 1~9를 그대로 따르고 승인은 E-1대로 받는다. §Step 8은 E-2를 따른다.
- **다음 슬라이스:** §Step 8이 성공하고, 깨끗한 종료이며, 체인 조건을 만족하고, 표에서 현재 행 바로 다음 행의 `Command`가 형태 검사를 통과하면, 그 `Command`로 같은 턴에 체인한다. 다음 행이 없으면 Type B와 "에픽 완료" 줄을 출력한다. 표 순서가 기준이고 `Depends on`은 참고용이다.
- **멈춤(규칙 둘):**
  1. 질문(Setup·Mode Gate·결정·승인·HARD GATE #2/#3·Step 7 분기·깨끗한 종료가 아닌 슬라이스의 §Step 8 커밋 질문)에 답하면 흐름이 이어진다. Stop류 답은 규칙 2의 도중 멈춤이다. 깨끗한 종료가 아닌 슬라이스는 커밋 질문에 답한 뒤 경계 멈춤으로 끝난다. (정정 2026-10-02, S3 구현: 그 답으로 고른 커밋이 실패하면 경계 멈춤이 아니라 현행 §Step 8 중단 경로다 — AC-20 정정과 같다.)
  2. 체인을 끝내는 멈춤의 출력은 위치로 정한다.
     - **경계 멈춤**(§Step 3.6 뒤, 또는 슬라이스 §Step 8 성공 뒤; 원인은 체인 조건 불충족, 깨끗한 종료 아님, 형태 검사 실패, `.harness/` 삭제 실패, 커밋 실패(E-2), §Step 3.6 뒤 첫 슬라이스 또는 다음 슬라이스 Skill 체인 실패, 컨텍스트): 현행 Type B와 `/handoff generate` 안내. §Step 3.6 뒤면 현행 에픽 변형(첫 행 `Command` 안내), 슬라이스 뒤면 다음 행 `Command`를 안내한다. 깨끗한 종료가 아니면 그 앞에 "Reason/Remaining을 먼저 확인" 한 줄을 붙인다.
     - **도중 멈춤**(질문에 Stop, 승인 → build 체인 실패): 흐름 8 또는 해당 실패 경로의 현행 Type A와 재개 명령만 출력하고, 다음 행 `Command`는 출력하지 않는다. 끝나지 않은 슬라이스를 건너뛰지 않기 위해서다.

#### 슬라이스 순서

- **S1 — 수렴 루프.** §Step 2.6, 새 템플릿, 원장, 종료, 결정 질문, 사상, separate §After Plan Phase, #1 슬롯 문구(S3의 `slice_plan.md` 읽기까지 한 번에). 게이트 모드와는 독립이다.
- **S2 — Approval Gate와 체인.** 게이트 모드와 읽기 규칙, 체인 조건, §Approval Gate(fast 변형 포함), §Fast Gate 포인터화, build §Entry, gate 리다이렉트·배너, 재개 라우팅, 비대화형, D1 문면 정정.
- **S3 — 에픽 슬라이스 자동 연쇄.** 슬라이스 판별, 형태 검사, §Step 3.6 체인, 슬라이스 승인 변형, 깨끗한 종료와 §Step 8, 다음 슬라이스, 멈춤 출력, handoff 연동 문면.
- **S4 — 라이브 프로브와 기록.** 설치본 2사본 재동기화, `exit` 후 새 `claude` 프로세스, `design/harness-converge/PROBE.md`.

#### r2 대비 단순화

- 레거시 게이트 모드 범주와 레거시 fast 예외를 읽기 규칙 한 줄(흐름 1)로, 별도 Fast Gate 렌더를 §Approval Gate 변형으로, 루프 중간 재개를 "원장 유지 + 새 실행"으로 바꿨다. 도중 컨텍스트 멈춤은 없앴다(E-3).
- 커밋과 다음 슬라이스의 조건을 "깨끗한 종료" 하나로 묶고, 멈춤 출력을 "경계/도중" 두 갈래로 정리했다(§Step 3.6 뒤는 경계).

### 완료 기준

- [ ] AC-1: 새 inline 세션(`run_style==auto`, 대화형, `agent-harness-defaults` 줄로 Setup·Mode Gate 질문이 0회인 조건)의 정상 경로에서 사용자가 입력하는 메시지는 `/harness "task"` 하나이고, 세션은 Step 8에 도달한다. Step 8 전의 AskUserQuestion은 결정이 없으면 승인 1회다. 결정이 있으면 결정 질문이 앞에 더해진다(호출당 질문 상한을 넘을 때만 호출이 나뉜다). P1·P2로 확인한다.
- [ ] AC-2: 한 실행은 사용자 입력 없이 최대 R=5 라운드를 돈다. 검증 뒤 원장의 미반영 auto C/M이 0이면 `converged`로, 아니면 r=R에서 `capped`로 끝난다. 디스패치 실패·1줄 파싱 실패·산출 부재·권한 거부·트리 오염은 `failed`다. 상태 값은 `{running, converged, capped, failed}` 넷뿐이다.
- [ ] AC-3: 종료 라운드는 spec.md를 쓰지 않고, 남은 미반영 auto는 잔여로 보고된다. 다음 실행(결정·Modify 반영, `--critic`, 빈 Modify, 재개)이 있으면 그 실행의 첫 라운드가 이 잔여를 반영 대상으로 잡는다. 반영된 변경(라운드·결정·Modify 반영)은 모두 뒤에 오는 리뷰를 거친다.
- [ ] AC-4: spec.md 쓰기 사건 하나는 `spec_stamp` generation을 정확히 1 올리고, 직전에 스냅샷을 덮어쓴다. §Step 2.6 routing predicate가 루프를 건너뛰는 세션은 스냅샷·새 실행 없이 stamp +1만 한다. 델타 리뷰 입력은 경로뿐이고, 범위는 바뀐 구간과 그 정방향·역방향 인용 절이다. 변경 없는 재실행과 재개 실행은 전체 리뷰로 시작한다. (정정 2026-10-02, S2 리뷰: 재개 시 재스탬프는 쓰기 사건이지만 스냅샷을 덮어쓰지 않는다 — 흐름 3 정정. 또 시작 stamp가 null이면(중단된 쓰기) generation은 `gate.spec_stamp`·`spec_stamp_at_critic`에 기록된 값 중 최대값 위에서 +1 한다 — 그렇지 않으면 1로 되돌아가 옛 승인·critic 기록과 다시 일치할 수 있다.)
- [ ] AC-5: 원장 지문이 새 근거 없이 다시 나오면 기존 항목에 합쳐진다. 잔여 counts는 원장의 미결 항목(미결 decision, 미반영 auto) 전부에서 계산한다.
- [ ] AC-6: 실측 근거가 없는 발견은 auto로 반영되지 않는다. 범위·AC 의미·트레이드오프 변경과 새 AC·state 필드·단계 추가는 decision이다.
- [ ] AC-7: 결정 질문은 대화형 세션에서 원장에 답한 결정이 없을 때만 렌더되며, 승인과는 다른 호출이다. 그 뒤 새로 나온 decision은 승인 요약의 잔여로 표시된다. 비대화형 실행 뒤 대화형으로 재개하면 게이트보다 결정 질문이 먼저 렌더된다.
- [ ] AC-8: 사상은 그 턴의 마지막 spec 관련 쓰기이며 `plan_critic`에 많아야 한 번 쓴다((ii)는 쓰지 않는다). `converged`·`capped`는 `applied="executed"`, `failed`는 (ii)(1라운드 WORKFLOW `spec.eval` 권한 거부 전용) 또는 (iii)(루프 내부 거부·실패·트리 오염 포함)의 기존 형태다. 결정이 있던 separate 세션을 포함해 `/harness-gate`는 not-stale 행에 착지한다. 잔여 C/M이 0이면 행 ②이고 Auto-revise는 노출되지 않는다. `failed`면 행 ④다.
- [ ] AC-9: 승인 질문의 옵션은 4개다(fast·슬라이스 세션은 Plan as epic 없이 3개). 승인은 "Build now"·"Plan as epic" 라벨 선택으로만 성립하며 예외가 없다. Other 자유서술, 모호한 응답, 텍스트 폴백 응답은 승인이 아니다(`--fast` 포함, CHANGELOG 공시).
- [ ] AC-10: 승인 기록은 그 시점 `spec_stamp`와 경로를 담은 한 번의 쓰기이고, 기록과 체인 사이에 spec 쓰기가 없다. 체인 조건을 만족하면 같은 턴에 Skill로 `harness-build`(epic이면 `--epic`)를 호출한다. 체인 조건이 어긋나거나(`run_style≠auto` 포함) Skill이 없거나 거부되면 Type A(Resume `/harness-build{ --epic}`)를 출력한다. 어느 경우든 승인은 유지된다.
- [ ] AC-11: `/harness-build` §Entry는 `phase=="plan_done"`인 inline 세션(fast 포함)을 다음 경우 아무것도 쓰지 않고 거부한다: 승인 없음(stamp에 결속되지 않은 기존 승인 포함), 기록된 stamp나 현재 stamp가 null·malformed, 둘이 다름, spec.md 읽기 실패, live 줄 수 ≠ `spec_stamp.lines`, `--epic` 유무 ≠ 기록된 경로. §Stale Determination은 인용하지 않는다. separate 동작은 바뀌지 않는다. (정정 2026-10-02, S2 리뷰: "아무것도 쓰지 않고"는 검사 자신의 쓰기와 게이트 횡단 필드(`phase`, `gate.*`, `spec_stamp`, `epic.*`)에 대한 말이다 — 그보다 먼저 도는 `session_recovery.md` item 5–6의 복원 쓰기(`conventions`, `has_git`, `path_resolved`)는 거부된 호출에도 남을 수 있다. `--epic` 유무 대조는 build 호출에만 해당하고, `/harness`에서 이 검사를 인용하는 사이트는 나머지 다섯 조건만 평가한다 — 그 사이트가 출력·체인하는 명령이 기록된 경로에서 `--epic`을 도출하기 때문이다.)
- [ ] AC-12: 승인 뒤 spec.md가 바뀌면(`--modify`, 편집기 직접 수정 등) build가 거부한다. `/harness` 재호출('Resume')은 새 실행을 거쳐 §Approval Gate를 다시 렌더하며, 직접 수정의 경우 재스탬프 → (루프 대상 세션이면 전체 리뷰 실행) → 게이트 순이다. 이 게이트에서 승인하면 build가 통과한다(승인·거부 순환이 없다). (정정 2026-10-02, S2 리뷰: 줄 수를 보존하는 편집기 직접 수정은 탐지하지 못한다 — `skills/harness-gate/SKILL.md` §Stale Determination의 Disclosed limits 1–2가 승인 검사에도 그대로 적용되며, 이 AC는 줄 수가 바뀌거나 쓰기 프로토콜을 거친 변경에 대해서만 성립한다.)
- [ ] AC-13: separate 세션(게이트 모드 필드가 없는 비-fast 세션, 즉 보존 중인 Stage 1 세션 포함)은 사상 뒤에도, `/harness` 재호출의 'Resume' 뒤에도 `Next → /harness-gate`로 멈추고 게이트를 렌더하지 않는다. `/harness-gate`의 `disallowed-tools`는 한 글자도 바뀌지 않는다. inline 세션의 `/harness-gate` 호출은 AskUserQuestion 없는 리다이렉트 한 줄로 끝난다.
- [ ] AC-14: `/harness` 재호출은 현행 item 7 질문을 렌더한다. 'Resume'을 고르면 §재개 순서에서 처음 맞는 목적지 하나로 간다. 승인이 AC-11 검사를 통과한 세션은 루프를 다시 돌리지 않는다.
- [ ] AC-15: `failed` 세션은 기존 §Step 2.6 실패 배너와 함께 게이트(inline §Approval Gate 또는 `/harness-gate` 행 ④)에 도달하며, 라벨 선택 없이는 승인되지 않는다. 엔진 오류는 기존 Mode Gate 폴백(INLINE 재시도)을 따른다.
- [ ] AC-16: 비대화형이거나 AskUserQuestion이 없거나 실패한 세션은 승인 기록과 체인 없이 `plan_done`에서 멈춘다(inline 흐름 8, separate `Next → /harness-gate`). inline 출력에는 `--separate-gate` 새 세션 탈출구와 "item 7에서 Restart" 한 줄이 들어간다. (정정 2026-10-02, S2 리뷰: 같은 줄에 질문에 답할 수 없는 환경(headless·cron)의 대안 "먼저 `.harness/` 삭제"가 들어간다 — 흐름 9 정정.)
- [ ] AC-17: 리뷰·검증 서브에이전트 디스패치 직전과 직후의 `git status --porcelain`을 대조한다. 대조에서는 `.harness/`와 그 디스패치의 지정 산출 경로(1라운드 critic 산출, `.harness/converge/` 산출)를 뺀다. 그 밖의 경로가 달라졌을 때만 루프를 `failed`((iii))로 멈추고 공시하며, 자동 원복은 하지 않는다. `has_git==false`면 대조를 생략했다고 공시한다.
- [ ] AC-18: 체인 조건을 만족하면 에픽 세션은 §Step 3.6 뒤 같은 턴에 형태 검사를 통과한 첫 행 `Command`를 바이트 동일로 실행한다. 깨끗한 종료로 §Step 8을 마친 슬라이스는 형태 검사를 통과한 다음 행 `Command`를 실행하고, 마지막 행 뒤에는 "에픽 완료" 블록을 출력한다. 그 밖(체인 조건이 어긋난 경우 포함)에는 경계 멈춤 출력을 낸다.
- [ ] AC-19: 대화형 inline 슬라이스 세션은 승인 질문을 1회 렌더하고, 옵션은 Plan as epic 없이 3개다. 자동 커밋·다음 슬라이스 문구는 체인 조건을 만족할 때만 "Build now" 설명에 들어간다. Plan as epic 설명의 자동 연쇄 문구도 같은 조건을 따른다. separate 슬라이스 세션은 `Next → /harness-gate`, 비대화형은 흐름 9다.
- [ ] AC-20: 체인 조건을 만족하고 깨끗한 종료인 슬라이스 세션의 §Step 8은 커밋 질문 없이 "Commit code only"를 적용하고 공시하며, 스테이징은 그 세션이 바꾼 파일과 원래 커밋 대상 산출물로 한정한다. `Max rounds reached`·`Accept as-is`·콜드리뷰 `findings`·`retried_*`·`failed`인 슬라이스는 현행 커밋 질문을 받는다. 커밋 실패는 경계 멈춤(커밋 해결·Restart 안내 포함)이다. 체인 밖 §Step 8은 바뀌지 않는다. (정정 2026-10-02, S3 구현: 경계 멈춤이 되는 커밋 실패는 자동 커밋(E-2)의 실패와 그 Safety Guard ABORT다. 깨끗한 종료가 아닌 슬라이스가 커밋 질문에서 고른 커밋이 실패하면 현행 §Step 8 중단 경로 그대로다 — Type B·`Next` 없음. §범위 제외의 커밋 질문 불변을 따르며, ROADMAP S3 행 (c)에 공시한다.)
- [ ] AC-21: 체인 중 질문에 답하면 흐름이 이어진다. 경계 멈춤(§Step 3.6 뒤 포함)은 Type B, 해당 `Command`(첫 행 또는 다음 행), `/handoff generate` 안내를 출력하고, 깨끗한 종료가 아니면 "Reason/Remaining 먼저 확인" 줄을 앞에 둔다. 도중 멈춤은 Type A와 재개 명령만 출력한다. 컨텍스트 멈춤은 경계에서만 일어난다. 새 세션에서 `/handoff resume` → "Start next step"으로 그 `Command`를 실행하면 승인 클릭 뒤 체인이 이어진다.
- [ ] AC-22: 세그먼트 스크립트에 새 게이트 토큰이 없다. HARD GATE는 3개이고, #1의 렌더 위치는 §Approval Gate(fast·슬라이스 변형 포함)와 `/harness-gate`다. 이 서술은 SKILL.md 3종과 `templates/_shared/architecture_principles.md` #6 본문에서 같다. `### Fast Gate` 제목은 기존 인용을 위한 포인터로 남는다.
- [ ] AC-23: 새 템플릿은 모두 `{user_lang}`과 명시적 출력 언어 지시를 가진다. 요약·질문·배너는 사용자 언어로, Glossary 토큰은 영어로 쓴다.
- [ ] AC-24: `grep -nE 'harness-gate|plan_done|3 messages|three-message|HARD GATE #1|confirmed at|hands off to|never routes into Step 3|only Type A|slice_plan|Epic planned|never content'`을 `skills/`, `templates/`, `workflows/_reference/`, `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md`, `design/harness-ordering-enforcement/`에 돌린다. 적중 사이트는 전부 판정·정정되어 서로 모순이 없다. ordering SPEC과 ROADMAP의 기존 행은 지우지 않고 행 안에 정정을 덧붙인다.
- [ ] AC-25: lint 체인 전체(`CLAUDE.md`의 `agent-harness-defaults: lint-cmd`)가 0으로 끝난다. 변경한 핀(BLOCK 버전, description ceiling, cross-file 수, 슬롯 수 문구)은 같은 커밋에서 재측정한 값이다.
- [ ] AC-26: Stage 1 rev 4 spec 사본으로 루프를 실행하고(결정 질문 1회 허용), 종료 상태, 실행·라운드 수, 잔여 C/M, 재등장 합류 수, 결정 수, AskUserQuestion 호출 수를 CONVERGE.md 수치와 나란히 기록한다. 최종 상태가 `converged`가 아니면 R과 리뷰 구성을 다시 정하기 전에는 S1을 완료로 보지 않는다.

### 테스트 전략

1. **정적:** lint 체인 전체를 돌린다(`PYTHONIOENCODING=utf-8` 필수). `hx-state-machine` BLOCK 양쪽 사본, description ceiling, `HARNESS_MIN_CROSS_FILES`, #1 슬롯 수 문구를 재측정한다.
2. **문면 정합:** AC-24 grep 결과를 전수 판정한 뒤 적대 콜드리뷰를 1회 한다(README 포함). 콜드리뷰는 이 에픽의 루프가 아니라 CONVERGE.md 방식의 ultracode 수렴 워크플로로 한다(위험 9).
3. **수렴 효과:** AC-26(합격선: `converged`).
4. **라이브 프로브(S4):** 재동기화 → `exit` → `claude` 순서로 한다(같은 세션에서 관측한 것은 무효). Stage 1 세션을 보존하기 위해 scratch 저장소에서 돌리고, 시나리오마다 `git status`를 확인한다.
   - P1: inline 정상 경로, 결정 0 (AC-1, 2, 10)
   - P2: 결정이 있는 경로: 결정 질문 → 재실행 → 승인 (AC-1, 7, 9)
   - P3: 승인 후 `--modify` → build 거부 → 'Resume' → 재렌더 → 승인 → build 통과. 변형으로 편집기 직접 수정 → 재스탬프·전체 리뷰 (AC-11, 12, 14)
   - P4: `--separate-gate` 결정 있는 세션의 3메시지 흐름과 'Resume' → `Next → /harness-gate`, inline 세션의 `/harness-gate` 리다이렉트 (AC-8, 13)
   - P5: 루프 중단 후 재개(새 실행), `run_style=phase` 승인 뒤 멈춤과 'Resume' → `Next → /harness-build`, 체인 거부 시 같은 출력 (AC-10, 14)
   - P6: WORKFLOW 경로(ultracode ON)의 1라운드 `spec.eval` + 인라인 검증, 실패 주입 시 행 ④ (AC-2, 8, 15)
   - P7: 트리 오염 검사, 지정 산출 덮어쓰기는 오염이 아님 (AC-17). P8: `claude -p` 비대화형 (AC-16)
   - P9: 2슬라이스 장난감 에픽: 에픽 승인 → 첫 슬라이스 자동 진입 → a 승인 1회·자동 커밋 → b 자동 진입 → b 승인 → 에픽 완료. 변형: 깨끗한 종료가 아닌 슬라이스(커밋 질문 → 경계 멈춤), 형태 검사 실패(`--fast`를 덧붙인 행), `run_style≠auto` 세션의 현행 출력 (AC-18~21)
   - P10: 체인 중 세션을 끊고 `/handoff resume` → "Start next step"으로 이어지는지 확인한다. 이어진 턴에 WebSearch·WebFetch가 막히는지도 관측한다 (AC-21, 위험 7)

### 엣지 케이스

- **auto 반영이 새 결함을 심음:** 뒤 라운드가 잡는다(AC-3). 무한 반복은 R 상한, 세션당 1회 결정 질문, 사람이 트리거하는 재개가 막는다.
- **carried_over(`critic_findings.md` 존재, /spec 유래):** 현행대로 critic과 루프를 건너뛰고 게이트로 간다. Modify는 stamp +1만 한다.
- **사람이 슬라이스 `Command`를 직접 침:** 슬라이스 세션으로 판별된다. 체인 조건을 만족하면 Build now 설명이 자동 커밋과 다음 슬라이스 진입을 알리고, 사람이 그 옵션을 고를 때만 체인한다. separate 에픽이 만든 `slice_plan.md`도 같다. `Command`는 `--separate-gate`를 싣지 않으므로 separate를 유지하려면 `gate=separate` 기본값 줄을 쓴다. 동의는 표가 아니라 클릭에서 온다.
- **`slice_plan.md` 손편집:** 다음 슬라이스는 표 순서로 정한다. `Command`가 형태 검사를 통과하지 못하면 경계 멈춤이다.
- **작업 트리에 에픽 전부터 있던 미커밋 변경:** E-2 스테이징 범위 밖이라 커밋되지 않는다. 다만 세션이 같은 파일을 고쳤다면 그 파일 전체가 스테이징된다(위험 8).

### 위험

1. **보증 하향(D1=A):** 기본 경로에서 "게이트 렌더 턴은 쓰기 불가"라는 명제가 사라지고, 모델이 쓴 승인 기록과 build 거부에 의존하게 된다(Fast Gate 등급, SPEC §3.3a: 스탬프 결속은 우회하려는 모델을 막지 못한다). 완화: 라벨 선택만 승인으로 인정하고 예외를 두지 않는다. 승인 뒤 spec 쓰기가 없다. build가 fail-closed로 거부한다. 슬라이스도 승인 질문을 거친다. separate를 opt-in으로 남긴다. ordering SPEC 행 안에 정정을 공시한다. (정정 2026-10-02, S2 리뷰: 기록을 위조할 수 있는 것은 오케스트레이터만이 아니다 — 수렴 루프의 리뷰·검증 서브에이전트도 트리 대조의 사각지대인 `.harness/state.json`에 `gate.*`를 쓸 수 있다. 완화: `templates/harness/converge.md` §Mapping이 `gate.*`를 실행 시작 시점 값으로 되돌려 쓴다. 사상에 이르지 않는 실행(branch (ii)의 상태 단독 쓰기, 실행 도중 끊긴 세션)은 남으며, 그 세션의 재개는 위조된 기록으로 체인할 수 있다 — ROADMAP 트리 대조 행.)
2. **수렴은 보장되지 않는다:** critic 분산, 같은 모델 계열의 자기편향, 지문 과병합, CONVERGE 대비 축소 구성(렌즈 4 → 1, 검증 batch 8 → 1) 때문이다. 완화: 원장 기준 종료, 새 근거가 있으면 새 항목, `capped`를 정직하게 노출, AC-26 합격선.
3. **auto 오분류:** 완화: D2의 좁은 경계, 자동 반영 목록 필수 표시, Modify, 슬라이스마다 사람이 요약을 보고 승인.
4. **문면 모순:** lint는 의미를 보지 않는다. 완화: AC-24 grep 전수 판정과 적대 콜드리뷰.
5. **lint 비용:** description 3종이 상한에 붙어 있고, `hx-state-machine` 두 사본과 슬롯 수 문구를 함께 재측정해야 한다.
6. **비용·시간:** 라운드당 에이전트 2~3개, 실행당 최대 5라운드, 결정·Modify·재개마다 실행이 하나 더 는다. 완화: review=advisor, verify=evaluator, 디스크 원장, 1줄 반환.
7. **미측정 경로:** 다문항 AskUserQuestion 직후의 Skill 체인, `--epic` 체인, 비대화형 멈춤, 한 턴 다슬라이스 체인의 압축 동작은 아직 관측하지 않았다. `/handoff resume` 경유 체인에서는 그 턴의 모든 슬라이스가 handoff의 `disallowed-tools`를 상속해 WebSearch·WebFetch 없이 돈다(`mode_gate.md` 규칙 3(a)). S4 전까지는 "관측됨"이라고 주장하지 않는다.
8. **체인 부작용:** 깨끗한 종료 슬라이스마다 자동 커밋이 생기고, 브랜치가 이전 슬라이스 커밋 위에 선형으로 쌓인다. 병합은 자동화하지 않는다. 세션이 고친 파일에 사용자의 기존 미커밋 변경이 섞여 있으면 함께 커밋된다(공시). 텍스트 폴백 승인 제거와 체인 조건의 `run_style==auto`·대화형 요건은 `--fast` 사용자에게 회귀다(CHANGELOG 공시). fast 변형의 Build now 설명은 기존 "Plan Critic and cold review are skipped" 고지를 보존한다. separate 경로의 잔여 재시도 비용은 그대로다(ROADMAP 공시).
9. **자기 적용:** 현행 `/harness`로 굴리면 같은 비수렴 루프를 밟으므로, spec 확정과 콜드리뷰는 ultracode 수렴 워크플로로 한다.

### 구현 단계

필드명, 정확한 문구, 루프 실패의 `failure_reason` 문자열, E-2 스테이징 범위를 구하는 방법(changes 목록 기반 여부)은 구현에서 정한다. 각 슬라이스는 lint 전체와 AC-24 grep으로 닫는다.

**S1 — 수렴 루프**
1. 단일 소스 `templates/harness/converge.md`: 실행·라운드 절차, R=5, 원장 기준 두 값 종료, 반영 규칙(비종료 라운드는 원장 미반영 auto 전부, 종료 라운드는 무반영), 쓰기 사건과 스냅샷(루프 건너뛰는 세션은 stamp +1만), 지문·합류, D2 루브릭, 결정 질문 1회, 잔여 정의, 실패 → `failed`((ii)는 1라운드 WORKFLOW 거부 전용, 나머지 (iii)), `git status` 대조와 제외 경로, 비대화형 규칙. 루프 파일은 `.harness/converge/`에 두고 라운드 번호는 영속화하지 않는다.
2. 새 템플릿 `converge_review.md`(전체·델타)와 `converge_verify.md`. `{user_lang}`, Input Trust Model, 경로만 입력, 산출 파일 1개, 1줄 반환을 갖춘다. `model_config.md` §Harness role map에 review → advisor, verify → evaluator를 둔다.
3. `templates/_shared/architecture_principles.md`: #1에 슬롯 하나를 둔다. 문구는 "`.harness/converge/` 읽기(§Step 2.6, §Approval Gate)와 `slice_plan.md`의 `Slice`·`Command` 열 읽기(슬라이스 판별, 형태 검사, §Step 3.6, §Step 8)"다. #2에 carve-out 둘(review는 저장소 읽기 전용, verify는 `.harness/converge/`와 1라운드 critic 산출 읽기 전용. 정정 2026-10-02, S1 구현: verify는 발견의 evidence가 인용한 저장소 파일과 읽기 전용 명령도 그 근거를 확인하는 데에만 읽는다. 확인하지 못한 저장소 근거를 실측으로 치면 AC-6의 '실측 근거'가 review의 자기신고로 남기 때문이다), #3에 경로 전용 델타 입력을 둔다. SKILL.md 3종의 슬롯 수 문구는 여기서 한 번만 재측정한다.
4. `skills/harness/SKILL.md` §Step 2.6에 굵은 문단(Converge loop)으로 `converge.md`를 인용하고, `plan_critic` 사상(latch 쓰기 생략 포함), `round` 증가 문장, `spec_stamp` 쓰기 사이트 열거, §Gate re-entry flags를 고친다. `state_schema.md`·`state_fields.md`에 `converge` 객체와 `round` 주석, `plan_critic_failures.md`에 Known gap 행과 새 `failure_reason`을 둔다. separate §After Plan Phase와 README §File Structure도 고친다.
5. AC-26을 실행한다.

**S2 — Approval Gate와 체인**
1. Step 1과 설정 표면: `--separate-gate`(`--fast`와 함께면 halt), 게이트 모드 기록(기존 `gate.mode`와 이름 분리)과 필드 없는 세션의 읽기 규칙, `project_defaults.md`의 `gate=` 행과 Resolution order(마커 사이트 불변), `setup_summary.md`, README §Project Defaults.
2. `skills/harness/SKILL.md`: 체인 조건 단일 정의, `### Approval Gate`(흐름 6~9, fast·슬라이스 변형), `### Fast Gate`를 포인터 한 줄로 축소("`--fast` 세션은 §Step 2.6 fast 분기 뒤 §Approval Gate를 Plan as epic 없이 렌더한다". 기존 Resume 문단과 "Stop" 설명의 "/harness-gate is also valid"는 §재개와 흐름 8로 대체), 텍스트 폴백 승인 제거(CHANGELOG 회귀 공시), §After Plan Phase, §Session Boundary, §Session Recovery(boolean 플래그 열거에 `--separate-gate` 추가, planning/plan_done 행을 §재개 순서로), §run_style·서두 불변식·§Key Rules·요약 #6, `hx-state-machine` `[User Gate]`(버전 상향). `templates/_shared/architecture_principles.md` #6 본문(#1 렌더 위치 둘)도 고친다. (정정 2026-10-02, S1 구현: S1은 `--critic`이 spec.md를 쓰게 되면서 §Gate re-entry flags에 `gate.approved == true` 세션을 거부하는 임시 가드를 두었다. 이 가드는 AC-11 결속과 AC-12 재렌더로 대체한다.)
3. `skills/harness-build/SKILL.md`: §Entry를 AC-11로, 결정 A 서술을 separate 한정으로, §Step 3.5 진입 경로, #6의 "#1 (spec-confirm) is `/harness-gate`" 문장, `hx-state-machine` 사본, description.
4. `skills/harness-gate/SKILL.md`: §Entry Check 리다이렉트와 "7점" 인용, 행 ①-c·④ 배너, §Next command 표, #6, description. `disallowed-tools`는 바꾸지 않는다.
5. `session_recovery.md`(View state 필드만, item 7 불변), `run_style.md`(§run_style, §CLI Parsing의 `--separate-gate`·`gate=`·`--no-prompt` 승인 억제 의미, §Step Mode Prerequisites), §Step 1의 `--no-prompt` 서술, state 문서.
6. 문서: ordering SPEC §1·§2.2·§2.3·§3.3a·§8, 결정 ①·A·⑧, rev.9(b) 행 안에 D1 정정. `CLAUDE.md` HARD GATE #1 문장과 §Architecture 표(`templates/harness/` 행의 파일 열거에 S1이 만든 `converge.md`와 그 서브에이전트 템플릿 `converge_review.md`·`converge_verify.md`를 더하는 것 포함 — S1에서 README §Repository Layout 사본만 고쳤고 CLAUDE.md 사본은 이월했다). README는 AC-24 적중 절 전부를 마지막 별도 패스로 한다. `CHANGELOG.md` `[Unreleased]`. `ROADMAP.md` 기존 행(variance, "Run Critic anyway", 턴 스코프 누출, Live integration probe) 정정과 이월 행 신설(정정 2026-10-02, S1 구현: 이월 행에 루프 트리 대조의 사각지대를 더한다 — `git status`가 못 보는 `{docs_path}spec.md`·`.harness/state.json`·`.harness/converge/`의 내용 해시 대조. AC-17의 대조 범위 밖이라 S1은 공시만 했다). description 3종을 재측정하고, 넘으면 같은 커밋에서 ceiling을 올린다.

**S3 — 에픽 슬라이스 자동 연쇄**
1. 슬라이스 판별 도출(부모 디렉터리의 `slice_plan.md`), 형태 검사(§Step 3.5 `slice_plan.md` format 이름 인용).
2. `skills/harness-build/SKILL.md` §Step 3.6: 삭제 전 체인 조건 판정, 마지막 출력을 "첫 행 `Command` 체인 또는 경계 멈춤(현행 Type B 에픽 변형)"으로 분기, fail-closed 2단계의 "never content" 문장을 #1 새 슬롯 인용으로 정정.
3. §Approval Gate 슬라이스 변형(옵션 3개, 조건부 Build now 설명). §Step 8에 깨끗한 종료 정의(§Session Boundary `Remaining` derivation 표 이름 인용), 자동 커밋(E-2, 스테이징 범위), 다음 행 체인, 에픽 완료, 경계/도중 멈춤 출력. §Session Boundary Type B에 에픽 완료와 경계 멈춤(다음 행 `Command`, "Reason/Remaining 먼저 확인" 줄) 변형. (구현 기록 2026-10-02, S3: ① 슬라이스 판별·형태 검사·깨끗한 종료·자동 커밋·멈춤 규칙은 `skills/harness-build/SKILL.md` §Epic Slice Chain 한 곳에 두고 §Approval Gate·§Step 3.6·§Step 8·§Session Boundary가 이름으로 인용한다. 깨끗한 종료도 §Step 8이 아니라 이 절에 둔다 — `/harness` §Approval Gate의 Build now 설명도 같은 정의를 쓰기 때문이다. ② `Command` 형태 `/harness --output-dir <dir> "<Slice>"`를 §Step 3.5 format에 명시했다(형태 검사의 비교 대상). 표 셀 값은 감싼 백틱 한 쌍을 벗긴 값이다. ③ E-2 스테이징 범위는 changes 목록이 아니라 새 additive 필드 `dirty_at_start`로 구한다. §Step 1 item 7이 슬라이스 세션에서만(그 밖의 세션은 필드를 남기지 않는다) 아무것도 만들기 전에 `git diff HEAD --name-only --no-renames` ∪ 미추적 경로마다 `git hash-object`를 기록하고, §Step 8은 같은 합집합(삭제 포함, `.harness/`·`.git/`·`{docs_path}` 제외) 가운데 기록에 없거나 해시가 바뀐 경로만 커밋한다. 커밋은 경로 지정(`git commit --only -- <변경 집합> <스테이징한 산출물>`)이라 세션 전에 인덱스에 올라가 있던 다른 변경은 스테이징된 채 커밋되지 않는다(2026-10-02 git 2.47 실측). 두 목록이 모두 비면 `git commit`을 실행하지 않고 nothing-to-commit 커밋 실패(경계 멈춤)로 본다 — 경로 없는 `git commit --`는 인덱스 전체를 커밋하고(exit 0), `--only`는 경로가 없으면 거부한다(exit 128, 같은 날 실측). 변경 집합은 생성기가 보고한 파일이 아니라 세션 동안 작업 트리에서 바뀐 모든 경로라서, gitignore 밖의 빌드·테스트 산출물과 그 사이 손으로 고친 파일도 들어간다 — 커밋 때 경로 목록을 출력하고 ROADMAP에 공시한다. changes 목록을 쓰지 않는 이유: `changes.md`와 `workflow_ctx.changedFiles`는 Generate 패스(L1 재시도, Fix 라운드)마다 다시 쓰여 마지막 패스의 파일만 담으므로, 깨끗한 종료 슬라이스의 앞 패스 변경을 빠뜨린다. 해시 대조는 "세션이 같은 파일을 고쳤다면 그 파일 전체가 스테이징된다"(엣지 케이스·위험 8)를 그대로 지킨다. 기록이 없거나 `null`인 세션(필드 이전에 시작, Step 1의 git 실패)이나 변경 집합 계산 중 git 실패는 커밋 질문 + 경계 멈춤이다. 깨끗한 종료의 `QA PASS`는 디스크의 `verify.verdict == "PASS"`로 읽는다(압축 내성, E-3). ④ Type B의 에픽·슬라이스 행은 `Check`/`Next`/`Epic`/`Chain`/`Handoff`다. 에픽 변형의 "`/handoff generate`는 제공하지 않는다" 문장은 행 안 정정으로 바꿨다 — `/handoff generate`는 `.harness/` 없이도 돈다. 마지막 행 뒤에는 깨끗한 종료 여부와 관계없이 `Epic` 행을 내고, 깨끗하지 않으면 `Check` 행이 앞선다. ⑤ 자동 커밋 실패(와 Safety Guard ABORT)는 기존 "블록 없음" 중단 경로의 예외로 Type B를 출력한다. 커밋 질문 뒤의 커밋 실패는 현행 중단 경로 그대로다(제외 범위 — ROADMAP 행). ⑥ 슬라이스 변형은 fast 변형처럼 §Scale Assessment를 렌더하지 않는다 — 고를 에픽 선택지가 없다. ⑦ separate 슬라이스 세션의 Pass B "Plan as epic"은 그대로이므로 에픽 중첩 방지는 inline 게이트에서만 성립한다(ROADMAP 행). ⑧ 체인 조건의 `run_style`은 §Step 1이 state.json에 기록한 값이다 — 나중에 손으로 친 `/harness-build`의 스타일이 아니다. 그래서 약속 없이 받은 승인(체인 조건 불충족) 뒤에는 자동 커밋·체인이 오지 않고, E-1의 동의 결속에 새 필드가 필요 없다. 남는 틈은 하나다: `slice_plan.md`가 item 7 뒤 승인 전에 이 task와 맞지 않게 바뀌었다가 §Step 8 전에 다시 맞게 바뀌면(승인은 4옵션 게이트, item 7과 §Step 8은 슬라이스 판별) 약속 없는 승인 뒤 자동 커밋이 된다 — 닫으려면 승인 기록에 필드가 필요하다(D2상 decision). ⑨ 슬라이스 세션의 Build now 설명은 `has_git == true`인데 `dirty_at_start`가 map이 아니면 커밋도 다음 슬라이스도 약속하지 않는다(커밋 질문 뒤 경계 멈춤이므로). git 없는 에픽의 Plan as epic 설명은 첫 슬라이스 진입만 약속한다 — git 없이는 콜드리뷰를 끈 슬라이스만 깨끗한 종료다. ⑩ 슬라이스 id task(영어 원문)는 언어를 담지 않으므로 user_lang은 사용자의 최근 자연어 메시지에서 정한다.)
4. `skills/handoff/SKILL.md`에 슬라이스 `Command`가 체인을 잇는다는 한 줄(규칙 변경 없음). README 에픽 절(`gate=separate`로 슬라이스를 separate로 유지하는 법 포함), ROADMAP·CHANGELOG.
5. 적대 콜드리뷰(S2·S3 합산 1회).

**S4 — 라이브 프로브**
1. 설치본 두 곳(`marketplaces/`, `cache/.../<version>/`)을 재동기화하고 `exit` → `claude`로 새 프로세스를 띄운다.
2. scratch 저장소에서 P1~P10을 실행하고, `PROBE.md`에 runId·관측·미관측 분기를 기록한다.
3. 발견한 문면 결함은 수정 커밋으로 처리하고 해당 AC를 다시 확인한다.
