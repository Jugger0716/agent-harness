> **이 파일은 2026-09-04에 `docs/harness/plan/SPEC-harness-ordering-enforcement.md`에서 이 경로로 옮겨졌다.**
> 원래 위치는 `.gitignore`의 `docs/` 아래여서 커밋되지 않았다. 이제 이 파일은 **커밋된다** —
> 따라서 본문에서 *이 문서 자신*을 「gitignored — 공개 링크 아님」으로 지칭하는 표기는
> 이 헤더가 대체한다. 여전히 `docs/` 아래에 있는 **다른** 파일을 그렇게 지칭하는 표기는 유효하다.
>
> 본문은 그 밖의 한 글자도 수정하지 않았다.

# SPEC — `harness-ordering-enforcement` (rev.3)

> **성격**: 후속 에픽의 요구사항 명세. 입력은 `docs/harness/plan/REMEASURE-harness-split.md`(gitignored)와
> `docs/harness/plan/PROBE-FINDINGS-enforcement.md`(gitignored), 그리고 `ROADMAP.md`의 W7 행·phase-P 4행.
> 이 문서도 `docs/` 아래라 **gitignored — 공개 링크가 아니다**. 영속 경로는 ROADMAP 등재뿐이다.
> 기준 트리: `develop @ 81227d4061cee9b24d44a13dcbddc2d70efa8400`, working tree clean.

---

## Review Sheet

### TL;DR

`skills/harness/SKILL.md`(2,522행)를 **3개 스킬로 분할**하고, 가운데 스킬에서 `Bash`·`Write`·`Edit`를
`disallowed-tools`로 통째로 제거한다. 그 스킬이 소유하는 것은 **HARD GATE #1 하나뿐**이다.
얻는 것은 정확히 한 문장이다:

> **게이트가 렌더되는 턴에는 파일 수정도 명령 실행도 구조적으로 불가능하다** — 그 턴을 소유한 스킬이
> `Write`/`Edit`/`Bash`를 보유하지 않기 때문이다.

이것이 P-10(턴 스코프)이 무료로 주는 「build 진입에 사용자 메시지 1회 강제」 위에 **분할이 새로 사는 유일한 것**이며,
따라서 이 에픽의 광고 명제다. `PROBE-FINDINGS-enforcement.md` §5가 광고하려던
「게이트 전 기존 파일 수정·명령 실행 불가」는 **거짓으로 판정됐고**(앞쪽 스킬이 `state.json`/`spec.md`를 쓰고
§Step 1이 Bash를 3곳에서 요구한다), 이 명제가 그 자리를 대신한다.

### 결정 표 (rev.1에서 확정)

| # | 항목 | 결정 | 근거 / 파급 |
|---|---|---|---|
| ① | 광고 명제 | **(b) 무도구 게이트 스킬 3분할** | (a) 명제 하향은 P-10이 이미 무료로 주는 것이라 분할이 새로 사는 것이 없다 (REMEASURE §1-c 안 2) |
| ② | Stale Determination | **mtime → 세대 카운터** (강제) | 무도구 게이트는 `Bash`도 `Glob`도 없어 mtime 순서조차 얻지 못한다. 동률(same-second) 규칙 문제도 함께 소멸 |
| ③ | `Modify` 수행 주체 | **명문화 + 형태 변경**: plan 스킬 오케스트레이터가 수행, 게이트는 halt + 재진입 안내 (강제) | 무도구 게이트는 `update spec.md`를 수행할 수 없다 |
| A | 게이트 통과 기록 | **`phase`를 감사 전용으로 강등** — 게이트 증거로 쓰지 않는다 | 게이트가 `phase → "generate_ready"`를 쓸 수 없다(§Step 3 Pass B). 위조 가능한 값을 게이트 근거로 쓰는 척을 그만둔다 |
| ④ | 공유 계약 40,734 B | **`templates/_shared/` 추출** | 저장소 관례에 부합. **런타임 제약이 리스크 R-1로 남는다** — 아래 §5 |
| ⑤ | epic-exit 분기 | **되당긴다 — 단, 착지점이 재해석됐다**: §Step 8에서 분리해 게이트 **직후 스킬**의 맨 앞으로 | 원안(「§Step 3.5 뒤」)은 무도구 게이트 안에 착지해 실행 불가. §0-B 참조 |
| ⑥ | mode 파라미터화 | **선행 커밋으로 분리** | 스크립트 리팩터 + 인용 62건 재앵커 + SKILL.md 3분할을 한 커밋에 담으면 리뷰 불가 (REMEASURE §5-⑥) |
| ⑦ | description 문안 | **미확정 — §7에 초안, 예산 재계산 포함** | 스크립트가 강제하는 토큰 0개. 트리거 신호 보존은 자발적 선택 |
| ⑧ | 직접 호출 차단 불가 | **막지 않는다. 위협 모델을 문서로 분리한다** | 순서 선언 필드 부재(PROBE §1-16). 드리프트가 아니라 명시적 선택 |

### Open questions (이 rev에서 닫히지 않은 것)

- **OQ-1** — ④의 런타임 해석(R-1). `templates/_shared/` 추출이 **본문 인라인 없이** 계약을 실효시키는지는
  이 저장소에 선례가 없다. 현행 `mode_gate.md` 관례는 「요약 인라인 + 전문 단일소스」이지 완전 추출이 아니다.
- **OQ-2** — 세 스킬의 이름. 본 spec은 `harness` / `harness-gate` / `harness-build`를 가정한다(진입점 이름 보존).
- **OQ-3** — ⑦ description 실제 문안과 `TOTAL_CEILING` 상향 폭.
- **OQ-4** — `harness-gate`가 `Glob`을 보유할 것인가. 세대 카운터 채택으로 mtime 정렬이 불필요해졌으므로
  기본은 **미보유**로 두었으나, Reading Order 성격의 파일 존재 확인에 필요한지 미검증.

### Changed in this revision

**rev.3 (2026-09-04) — 적대적 검증(4렌즈 + 렌즈당 2반증)이 BLOCKING 1건을 확정했고,
그것이 rev.2의 exit 0 측정을 무효화했다. 뒤집히는 것 2건:**

1. **rev.2 §6.1의 「①+③+④ → exit 0」은 저장소가 기각한 분할로 측정됐다.**
   그 측정은 `### Step 4: Generate Phase` 이후를 **전부** B로 보내는 단순 컷을 썼는데,
   §2.1과 REMEASURE §2.4가 채택한 것은 **꼬리 잔류** 분할이다. 꼬리에 있는 subpath 인용
   3건(2440행 1건 + 2455행 2건, 전부 `§Step 4|5 — WORKFLOW path`)이 단순 컷에서는 B로
   함께 넘어가 자기참조가 되면서 결함을 **우연히 피해갔다**. 채택안으로 다시 재면 rc=1이다.
   이 저장소가 반복해 온 실패(잘못된 기준으로 잰 수치)를 이번에도 발화시켰다 — §6.2가 대체한다.
2. **파라미터화만으로는 두 번째 타깃이 green에 도달하지 못한다.** layer 5(SUBPATH-CITE)가
   `p == target`일 때 경로 앵커를 **읽지 않아**, 재앵커를 정확히 붙여도 거짓 FAIL이 남는다.
   layer 4는 같은 상황에서 `foreign_at`으로 배제한다 — 원래부터 있던 비대칭이며 이 diff가
   만든 것이 아니다(HEAD와 제어흐름 바이트 동일). **C1에서 함께 고친다** — 고치지 않으면
   C1이 존재할 이유(두 번째 타깃 통과 가능)가 성립하지 않기 때문이다.

**rev.2 (2026-09-04) — C1을 구현하고 실측했다. 이 개정이 뒤집는 것 3건:**

1. **C1의 범위가 줄었다.** rev.1의 C1 행은 「PIN-FILES 메시지의 하드코딩 라벨 버그도 함께」를
   포함했는데, 그 버그는 **이미 고쳐져 있다** — `glob_label`이 타깃 디렉터리에서 계산되며,
   `81227d4`에서 도입됐다. REMEASURE §4가 그것을 결함으로 적은 것은 측정 기준이 `490f4a6`,
   즉 그 수정 **이전** 커밋이었기 때문이다. REMEASURE는 틀리지 않았고 기준이 낡았다.
2. **「①+④ → exit 0」은 참이지만 ③이 빠져 있었다.** REMEASURE §4-3은 ①(파라미터화)과
   ④(재앵커)만 적용한 사본이 exit 0에 도달한다고 적었다. 실제로는 **③(재핀)이 함께 필요하다** —
   분할 후 `harness` 엔트리의 `step_ids`/`subpaths`도 자기 것으로 줄여야 한다.
   ①+③만 적용하면 62 FAIL, ①+③+④를 적용해야 exit 0이다(아래 실측표).
3. **C1 단독으로는 분할이 green이 되지 않는다** — 될 수도 없다. C1이 제거하는 것은
   **공유 핀 실패 5건**뿐이고, 나머지는 ③·④의 몫이다. 이것을 C1의 성공 기준으로 삼는다
   (AC-1 재작성).

**rev.1 (2026-09-04)** — 최초 개정. 아래는 **입력 문서의 진술 중 이 spec이 뒤집는 것**이다.

1. `PROBE-FINDINGS-enforcement.md` §5의 광고 명제 — **거짓**. §1로 대체.
2. `REMEASURE-harness-split.md` §1-③-c 안 1의 epic-exit 착지점(「§Step 3.5 뒤 자체 섹션」) —
   무도구 게이트와 충돌. §0-B로 재해석.
3. `REMEASURE-harness-split.md` §2.5의 **2분할** 전제 — 3분할로 바뀌면서 경계가 하나 더 생긴다.
   Step 4 앞 컷의 최소성 실측(§Step 교차 62 / FAIL 54 / 외부 인용 0)은 **여전히 유효하나, 그것은 두 번째 컷의
   비용일 뿐**이다. 첫 번째 컷(Step 3 앞)의 비용은 §3에서 별도로 계산해야 한다 — **미측정**.

---

## 0. 이 spec이 뒤집는 두 전제

### §0-A. 광고 명제는 거짓이었다

`PROBE-FINDINGS-enforcement.md` §5는 「게이트 전 **기존 파일 수정·명령 실행 불가**」를 광고 가능한 명제로 제시했다.
REMEASURE §1-①/§1-② 판정으로 이것은 **거짓**이다:

- **명령 실행**: `skills/harness/SKILL.md` §Zero-Setup Environment Detection과 §Step 1: Setup이 Bash를
  세 곳에서 요구한다(`git rev-parse --is-inside-work-tree`, `git checkout -b harness/<slug>`,
  실패 시 `git log harness/<slug> --oneline -1`). 앞쪽 스킬은 Bash를 내려놓을 수 없다.
- **기존 파일 수정**: 오케스트레이터가 `.harness/state.json`, `{docs_path}spec.md`,
  `{docs_path}slice_plan.md`를 쓴다(§Architecture Principles #1, §Step 2 WORKFLOW item 6, §Step 3.5).
  P-9 실측상 `disallowed-tools`의 스코프 패턴은 no-op이므로 「spec.md만 쓰게」는 표현 불가 —
  `Write`/`Edit`는 통째로 보유하거나 통째로 없다.

**따라서 명제는 「게이트 **전**」이 아니라 「게이트 **턴**」에 대해서만 참일 수 있다.** 그것이 §1의 명제다.

### §0-B. 결정 ⑤의 착지점이 무도구 게이트와 충돌한다

REMEASURE §1-③-c 안 1은 §Step 8의 `#### If epic exit:` 블록을 「§Step 3.5 뒤 자체 섹션」으로 옮기라고 권고했다.
그 권고는 **2분할을 전제로 쓰였다**. 3분할에서는 §Step 3.5 뒤가 곧 무도구 게이트 스킬 안이고, 그 블록은
실행 불가가 된다 — 실측 근거:

- §Step 3.5는 `{docs_path}slice_plan.md`를 **쓴다**(「the boundary Q&A below ... determines the rows written to
  `{docs_path}slice_plan.md`」), 그리고 `state.epic.boundaries` + `epic.id`를 single write로 쓴다.
- §Step 8 `#### If epic exit:`의 fail-closed order 4·5단계는 `phase → "completed"` 쓰기와 `.harness/` 삭제다.

**재해석**: ⑤가 없애려던 결함은 「게이트를 통과하지 않은 채 구현 능력을 가진 스킬로 진입」이다.
3분할은 §Step 3.5를 **게이트 뒤**에 놓으므로 그 경로 자체가 사라진다 — 결정 ⑤의 목적은 분할이 이미 달성한다.
남는 작업은 **§Step 8에서 epic-exit를 분리해 게이트 직후 스킬(build)의 맨 앞 섹션으로 승격**하는 것이다.
정본 Step id 11 → 12 변경, 「sole definition」 소유자 변경, §Step 8을 가리키는 인용 재조준은 **원안 그대로 발생**한다.

---

## 1. 광고 명제 (확정 문안)

> **게이트가 렌더되는 턴에는 파일 수정도 명령 실행도 구조적으로 불가능하다.**
> 그 턴을 소유하는 스킬(`harness-gate`)의 frontmatter가 `Bash`·`Write`·`Edit`를 제거하므로,
> 도구가 컨텍스트에서 사라진다(P-9 ⓐ 실측). 서브에이전트 우회도 같은 제거로 닫힌다(오류 메시지의
> `in subagents as well as here`; 단 **직접 호출 실측은 미실시** — PROBE §2 정정 2).

**(a)와의 차이 — 이것이 분할을 정당화하는 전부다.**
(a)(2분할 + 명제 하향)에서는 게이트를 렌더하는 턴의 스킬이 `Write`/`Edit`/`Bash`를 전부 갖고 있다.
모델이 규칙을 어기면 **게이트를 표시한 바로 그 턴에 구현을 시작할 수 있다**. (b)에서는 그 턴에 도구가 없다.

**명제가 커버하지 않는 것 — 정직하게 열거한다.**

1. `/harness-build`를 처음부터 직접 호출하는 것은 막지 못한다(⑧, PROBE §1-16). 드리프트가 아니라 명시적 선택이다.
2. `harness-build` 턴 안에서는 인터프리터 쓰기 구멍(PROBE §1-6)이 그대로 유효하다 — 그러나 그 스킬은 애초에
   쓰기가 허용된 단계이므로 이 명제의 대상이 아니다.
3. 게이트 통과 사실은 **어디에도 기록되지 않는다**(결정 A). 명제는 「게이트 턴의 무능력」이지
   「게이트를 통과했음의 증명」이 아니다.

---

## 2. 스킬 분할 설계

### 2.1 세 스킬과 도구 계약

| 스킬 | 소유 섹션 | `disallowed-tools` | 쓰기 대상 |
|---|---|---|---|
| **`harness`** (진입점, plan 단계) | preamble 전체, §Step 1, §Step 1.5, §Step 2, §Step 2.6 | `NotebookEdit` (현행 유지) | `.harness/state.json`, `{docs_path}spec.md`, `{docs_path}plan_critic_findings.md`, `{docs_path}conventions.md` |
| **`harness-gate`** (게이트 전용) | §Step 3 (Pass A / Pass B) | **`Bash`, `Write`, `Edit`, `NotebookEdit`, `WebSearch`, `WebFetch`, `Task`, `Agent`, `Workflow`** | **없음 — 쓰기 0** |
| **`harness-build`** (구현 단계) | §Step 3.5, **§Step 3.6 (신설 — epic exit)**, §Step 4~§Step 8 | `NotebookEdit` | 전 산출물 |

`harness-gate`의 보유 도구는 `Read` + `AskUserQuestion` + `Glob`(OQ-4)뿐이다.

**꼬리 섹션 잔류**(REMEASURE §2.4): `## Sub-command: doctor`·`## Model Selection`·`## User Interaction Rules`·
`## Architecture Principles`(§Path Validator 포함)·`## Key Rules`는 **`harness`에 잔류**한다.
단순 라인 컷은 `/harness doctor`까지 build로 보내므로 채택하지 않는다.

### 2.2 단계 전환 — 사용자 메시지가 곧 게이트

```
사용자: /harness "작업"
  └─ harness      : Step 1 → 1.5 → 2 → 2.6, spec.md 작성, phase = plan_done
                    출력: "다음 → /harness-gate"
── 사용자 메시지 경계 (턴 종료) ──────────────────────────
사용자: /harness-gate
  └─ harness-gate : Step 3 Pass A / Pass B 렌더. 쓰기 0.
                    출력: 선택에 대응하는 다음 명령 (아래 표)
── 사용자 메시지 경계 (턴 종료) ──────────────────────────
사용자: <게이트가 출력한 명령>
  └─ harness-build: Step 3.5 / 3.6 / 4~8
```

**게이트 선택 → 다음 명령 매핑** (게이트는 이 문자열을 출력할 뿐, 아무것도 쓰지 않는다):

| Pass B 선택 | 게이트가 출력하는 다음 명령 |
|---|---|
| "Proceed as single" / "Proceed" | `/harness-build` |
| "Plan as epic" | `/harness-build --epic` |
| "Modify" | `/harness --modify "<사용자 수정 요청>"` |
| "Stop" | (없음 — 세션 종료) |

**전달 매체는 사용자 메시지다.** 이것이 결정 A의 직접적 귀결이며, PROBE §3 안 A/B가 폐기된 이유
(「모델이 쓴 값은 모델이 위조한다」)를 **회피가 아니라 인정**으로 처리한 것이다: 게이트의 산출을
모델이 쓸 수 있는 저장소에 두지 않고, 사람이 타이핑하는 채널에 둔다.

### 2.3 `phase`의 지위 변경 (결정 A)

- `phase`는 **§Session Recovery와 감사에만** 쓴다. **게이트 통과 증거로 인용하지 않는다.**
- `harness-build`는 진입 시 `phase → "generate_ready"`를 자기가 쓴다(§Step 3 Pass B가 갖고 있던 write의 이전).
  `epic.boundaries`의 `null` 리셋도 같은 write로 이전한다.
- **§Step Mode Prerequisites 재작성 필수** — `generate`의 최소 phase 조건이 「게이트를 통과했는가」를
  표현하던 자리이므로, 그 의미를 「이 스킬은 별도 스킬이며 호출 자체가 사용자 행위다」로 바꾼다.
- **`skills/harness/SKILL.md` §Session Recovery의 phase 점프 테이블**은 세 스킬로 쪼개지며,
  각 스킬은 **자기 소유 phase 범위만** 라우팅한다. 범위 밖 phase를 만나면 해당 스킬 이름을 안내하고 halt.

---

## 3. Stale Determination — 세대 카운터 (결정 ②)

### 3.1 새 필드

| 필드 | 소유자 | 규칙 |
|---|---|---|
| `state.spec_revision` | `harness` | `{docs_path}spec.md`를 쓰는 **모든** 사이트가 같은 write에서 `+1`. 초기값 `0`, 첫 §Step 2 write 후 `1` |
| `state.plan_critic.spec_revision_at_critic` | `harness` | §Step 2.6의 single read-modify-write에 **6번째가 아닌 7번째 필드로 추가**. critic이 판정한 spec.md의 revision |

### 3.2 판정 규칙 (§Stale Determination 대체 문안)

```
plan_critic.last_findings_path == null                        → stale-unknown
spec_revision 또는 spec_revision_at_critic 중 하나라도 부재    → stale (fail closed)
spec_revision != spec_revision_at_critic                      → stale
spec_revision == spec_revision_at_critic                      → not stale
```

**mtime 대비 이득 3가지:**
1. `Bash`/`Glob` 의존 소멸 → 무도구 게이트가 판정을 **수행할 수 있다**(state.json은 `Read`로 읽는다).
2. **동률(same-second) 케이스 소멸** — REMEASURE §1-①-2가 「Glob 정렬로는 대체 불가」로 지목한 유일한 구멍.
3. I/O 실패 축이 사라져 fail-closed 분기가 「필드 부재」 하나로 단순화된다.

### 3.3 함께 바뀌는 사이트 (전건 열거 — 한 커밋에서)

- §Stale Determination — 본문 전체 교체.
- §Auto-revise Exposure Predicate point 4 — 이름 인용이므로 문안 무변경, 단 헤더 주석의 mtime 언급 제거.
- §Step 2.6 **latch 조건 (b)** — 「mtime STRICTLY AFTER」 → 「`spec_revision_at_critic == spec_revision`을
  같은 write에서 기록」. **주의**: 현행 (b)는 WORKFLOW 세그먼트가 파일을 쓰지 않고 schema-valid 결과만
  반환하는 갭을 막는 장치다. revision 비교는 그 갭을 막지 못하므로 **파일 존재 확인은 별도로 유지**한다.
- §Modify Interaction 2항목 — mtime 근거 → revision 근거.
- §Step 3 Pass A의 「a completed own dispatch writes a fresher mtime」 문장 — 재작성.
- `skills/harness/SKILL.md` 전체 `mtime` 21건 중 **비교를 수행하는 2곳**(§Step 2.6 latch, §Stale Determination)만
  대상. 나머지 19건(§Session Recovery의 279행대, §Step 5·6 영역의 2022·2046 「일부러 이식하지 않았다」 서술 포함)은
  **손대지 않는다** — 2046은 반대 방향 서술이므로 수정하면 사실이 뒤집힌다.

---

## 4. `Modify` 재설계 (결정 ③)

### 4.1 수행 주체 명문화

**`Modify`의 수행 주체는 `harness` 스킬의 오케스트레이터다.** 현행 SKILL.md는 「update spec.md」라고만 쓰고
주체를 말하지 않으며(REMEASURE §1-② 미확인 항목), 이 spec이 그것을 확정한다.

### 4.2 형태 변경

게이트의 "Modify"는 **in-gate 편집을 수행하지 않는다.** 동작:

1. 게이트가 halt한다(쓰기 0).
2. 게이트가 `/harness --modify "<수정 요청>"` 형태의 재진입 명령을 출력한다.
3. 사용자가 그 명령을 친다 → `harness`가 spec.md를 수정하고 `spec_revision`을 `+1`한다.
4. `harness`가 다시 `/harness-gate`를 안내한다.

### 4.3 §Modify Interaction 3항목의 운명

| 현행 항목 | 처리 |
|---|---|
| 1. 재표시 시 Modify 이전 버전 기준 counts 표시 | **유지** — 근거만 mtime → revision |
| 2. Modify 후 Auto-revise 즉시 재노출 금지 | **유지, 더 강해짐** — revision 증가가 구조적으로 Predicate point 4를 깬다. 세션 경계 무관은 자동 성립(state.json 필드이므로) |
| 3. 재표시는 항상 Pass A부터 | **자동 충족** — 게이트 재호출은 항상 Pass A부터 렌더한다. 「Pass B의 Modify에서도」라는 단서가 불필요해진다 |

**대가 (정직하게)**: 「Modify → 즉시 재표시」가 「Modify → 사용자 메시지 2회 왕복」이 된다.
태스크당 사용자 메시지는 최소 **3회**(`/harness` → `/harness-gate` → `/harness-build`),
Modify 1회당 **+2회**.

---

## 5. 공유 계약 추출 (결정 ④)

### 5.1 대상 6개 절 (실측 크기)

| 절 | 크기 | 소비자 |
|---|---|---|
| §Session Recovery | 15,543 B | 3스킬 전부 (각자 자기 phase 범위) |
| §Session Boundary | 8,873 B | `harness`(Type A), `harness-build`(Type B) |
| §Architecture Principles | 7,774 B | 3스킬 전부 |
| §Output Language Contract | 4,717 B | 3스킬 전부 |
| §State Machine | 2,507 B | 3스킬 전부 |
| §Sub-agent Return Value Rules | 1,320 B | `harness`, `harness-build` (게이트는 서브에이전트 없음) |
| **합** | **40,734 B** | |

### 5.2 추출 형태

`templates/_shared/` 아래 6개 신규 파일. 각 소비 스킬은 **이름으로 인용**하고 본문을 restate하지 않는다 —
`CLAUDE.md` §Conventions의 「Keep single sources in `templates/_shared/`. Cite one by name; never restate its body.」
그대로.

### 5.3 **리스크 R-1 — 이 결정의 가장 큰 미해결 축**

스킬은 호출 시 **자기 SKILL.md만 로드된다.** 따라서 「이름으로 인용」이 런타임에 무엇을 의미하는지가
계약의 실효성을 결정한다. 저장소의 현행 선례(`templates/_shared/mode_gate.md`)는 **완전 추출이 아니다** —
각 SKILL.md가 요약을 인라인으로 갖고 단일소스를 참조한다. 즉 선례는 「요약 인라인 + 전문 단일소스」다.

40 KB를 **요약 없이** 추출하면 두 가지 중 하나가 필요하다:

- **(가)** 스킬이 실행 중 `Read`로 해당 파일을 읽는다 → §Architecture Principles #1의
  「reads no intermediate files」 예외 목록 7개와의 관계를 명시해야 한다. 계약 문서는 중간 산출물이 아니므로
  성격이 다르지만, **그 구분이 현재 어디에도 문서화돼 있지 않다.**
- **(나)** 요약을 각 스킬에 인라인한다 → 추출이 아니라 「요약 복제 + 전문 단일소스」가 되며,
  요약본들 사이의 드리프트를 막을 lint가 필요하다(BLOCK-sync는 **byte-identical** 블록용이라 요약본에는
  그대로 쓸 수 없다).

**이 spec은 (가)를 기본으로 하되, 구현 전에 라이브 프로브 1회로 확인할 것을 요구한다** — AC-9 참조.
프로브 없이 (가)를 가정하고 40 KB를 옮기면, 실패 시 롤백 비용이 이 에픽 최대가 된다.

---

## 6. 커밋 계획 (결정 ⑥)

각 커밋은 **독립적으로 lint green + 리뷰 가능**해야 한다.

| # | 커밋 | 범위 | 검증 |
|---|---|---|---|
| **C1** | `harness-steps` mode 파라미터화 — **구현 완료, 아래 §6.1 참조** | `scripts/verify_sync_markers.py`만. 손잡이 5개(`HARNESS_STEP_IDS`/`HARNESS_SUBPATHS`/`HARNESS_FILES`/`HARNESS_NON_HEADING_ANCHORS` + `HARNESS_MIN_CROSS_FILES`)를 `SECTION_REF_TARGETS` 엔트리로 이동 + 모드별 필수 키 검사(`_MODE_REQUIRED_KEYS`) + **layer 5 foreign-anchor 배제**(rev.3, BLOCKING). **PIN-FILES 라벨 버그는 범위에서 제외** — 이미 `81227d4`에서 수정됨 | 린트 7종 rc=0, **출력 바이트 동일**(베이스라인 대비 diff 0) + 채택 분할에서 rc=0(§6.2) |
| **C2** | 세대 카운터 도입 | `skills/harness/SKILL.md` 단일 파일. §3.3의 사이트 전건 | 린트 7종 rc=0. 분할 전이므로 인용 무영향 |
| **C3** | epic-exit 분리 → §Step 3.6 승격 | `skills/harness/SKILL.md` + §Step 8 인용 재조준. 정본 Step id 11→12 → `HARNESS_STEP_IDS` 재고정 **같은 커밋에서** | 린트 7종 rc=0 |
| **C4** | 공유 계약 추출 | `templates/_shared/` 6파일 신설 + `skills/harness/SKILL.md`에서 참조로 대체. **R-1 프로브 선행** | 린트 7종 rc=0 + 프로브 기록 |
| **C5** | 3분할 | 스킬 디렉터리 2개 신설 + `SECTION_REF_TARGETS` 등록(C1이 가능하게 만든 것) + 핀 재고정 + 경계 넘는 `§Step` 인용 재앵커 | 린트 7종 rc=0 |
| **C6** | description 문안 + 예산 | 3스킬 문안 + `PER_SKILL_CEILING` 3항목 + `TOTAL_CEILING` 상향 | `verify_description_budget.py` rc=0 |

### 6.1 C1 실측 (2026-09-04, base `b1de150`)

스크래치 사본에 Step 4 경계 컷(`### Step 4: Generate Phase` 헤딩 앞)을 적용하고
새 파일을 `skills/harness-build/SKILL.md`에 두어 네 가지로 돌렸다. 원본 트리는 무수정.

| 시나리오 | rc | FAIL |
|---|---|---|
| OLD 스크립트, 분할만 | 1 | 54 |
| OLD 스크립트, 분할 + W7 (b) 문면대로 등록 | 1 | **70** (악화) |
| NEW 스크립트, 분할만 | 1 | 54 (불변 — 동작 변경 0) |
| NEW 스크립트, 분할 + 엔트리가 자기 핀 보유 | 1 | **65** |

**70 → 65의 5건이 정확히 「공유 핀」 부류다.** 실패 분류 실측:

| 부류 | OLD 등록 | NEW 등록 |
|---|---|---|
| SELF-STEP 인용 (file A) | 52 | 52 |
| SELF-STEP 인용 (file B) | 10 | 10 |
| PIN-STEP | 2 | **1** |
| PIN-SUBPATH | 2 | **1** |
| PIN-ANCHOR | 1 | **0** |
| PIN-FILES | 1 | **0** |
| 죽은 앵커 경고 | 1 | **0** |
| CROSS floor | 1 | 1 |

남은 PIN-STEP·PIN-SUBPATH 각 1건은 **`harness` 엔트리 자신의 재핀(③)** 몫이고,
CROSS floor 1건은 아직 그 파일을 가리키는 파일이 없어서다(④가 채운다).
**즉 C1 이후 남는 실패 중 파라미터화 때문인 것은 0건이다.**

**⚠ 아래 블록은 저장소가 기각한 단순 컷으로 측정됐다 — §6.2가 대체한다. 삭제하지 않고 남기는
이유는 이 오류의 메커니즘 자체가 기록할 가치가 있기 때문이다.**

**①+③+④ 전부 적용: exit 0.** OK 라인 실측:

```
OK: 28 cross-file section ref(s) from 8 file(s) -> skills/harness/SKILL.md
OK: 96 in-file §Step ref(s) -> 6 pinned Step id(s); 8 §Step N — INLINE|WORKFLOW path ref(s) -> 2 pinned; 53 foreign-anchored OUT OF SCOPE
OK: 52 cross-file section ref(s) from 1 file(s) -> skills/harness-build/SKILL.md
OK: 45 in-file §Step ref(s) -> 5 pinned Step id(s); 4 §Step N — INLINE|WORKFLOW path ref(s) -> 4 pinned; 12 foreign-anchored OUT OF SCOPE
OK: 9 sync group(s), 51 marker site(s)
```

재앵커는 file A 52건 / file B 10건이고, **이미 다른 파일에 앵커된 2건(team-memory)은
자동으로 건너뛴다** — 앵커 여부를 `PATH_ANCHOR_RE` 위치로 판정하므로 정규식 일괄 치환의
오탐 2건이 구조적으로 발생하지 않는다. C5는 이 방식을 써야 한다.

**REMEASURE와의 차이 1건**: REMEASURE §4-3은 harness 쪽 cross-file을 **30**으로 적었고
이번 실측은 **28**이다. 나머지 수치(96/6/8/2/53, 52/1, 45/5/4/4/12, 9/51)는 전부 일치한다.
차이는 ④ 재앵커를 어떻게 수행했는지에서 온다(REMEASURE는 손으로 편집한 사본). C1의 결함이
아니지만, **C5에서 이 숫자를 REMEASURE에서 인용하면 틀린다** — 그때 다시 측정한다.

### 6.2 채택된 분할(꼬리 잔류)에서의 실측 — §6.1의 exit 0을 대체한다

분할: `### Step 4: Generate Phase`부터 `## Sub-command: doctor` **직전**까지만 B로 추출.
preamble과 꼬리는 `harness`에 잔류(§2.1 (i), REMEASURE §2.4).
①(파라미터화)+③(재핀)+④(재앵커) 전부 적용, layer 5 수정만 토글:

| layer 5 foreign-anchor 배제 | rc | FAIL |
|---|---|---|
| OFF (원래 코드) | 1 | **3** |
| ON (C1이 추가) | 0 | **0** |

FAIL 3건 전문:

```
skills/harness/SKILL.md:1850 cites '§Step 5 — WORKFLOW path', which is not a sub-path heading in skills/harness/SKILL.md
skills/harness/SKILL.md:1865 cites '§Step 4 — WORKFLOW path', ...
skills/harness/SKILL.md:1865 cites '§Step 5 — WORKFLOW path', ...
```

**재앵커를 아무리 정확히 붙여도 회피 불가**하다 — layer 5가 앵커를 읽지 않으므로 접두어의
정확성과 무관하다. 그리고 PIN-SUBPATH가 집합 동치(제로 슬랙)라 A의 핀에 `(4,*)`·`(5,*)`를
남겨두는 우회도 막힌다.

**ON일 때의 OK 라인 (C5가 기준으로 삼을 수치):**

```
OK: 23 cross-file section ref(s) from 8 file(s) -> skills/harness/SKILL.md
OK: 101 in-file §Step ref(s) -> 6 pinned Step id(s); 8 §Step N — INLINE|WORKFLOW path ref(s) -> 2 pinned; 65 foreign-anchored OUT OF SCOPE
OK: 62 cross-file section ref(s) from 1 file(s) -> skills/harness-build/SKILL.md
OK: 35 in-file §Step ref(s) -> 5 pinned Step id(s); 4 §Step N — INLINE|WORKFLOW path ref(s) -> 4 pinned; 5 foreign-anchored OUT OF SCOPE
OK: 9 sync group(s), 51 marker site(s)
```

재앵커 건수는 **A→B 62 / B→A 5**로 REMEASURE §2.4의 정적 실측(62 / 5)과 정확히 일치한다 —
두 방법이 독립적으로 같은 수를 낸다. §6.1의 52 / 10은 단순 컷의 수치이므로 **C5에서 인용하면
틀린다**. 마찬가지로 cross-file은 23이며, §6.1의 28도 REMEASURE의 30도 채택안의 값이 아니다.

**적대적 검증에서 살아남은 나머지 4건(전부 minor)과 처리:**

| 발견 | 처리 |
|---|---|
| `_MODE_REQUIRED_KEYS`에 없는 새 모드 → `KeyError` 트레이스백 (구코드엔 없던 경로) | **수정** — `.get()` 후 이름을 말하는 FAIL |
| PIN-FILES가 형제 디렉터리 분할을 못 본다 — 값만 엔트리로 옮겼을 뿐 **비교 범위**는 여전히 타깃 자신의 디렉터리 하나 | **수정 안 함, 공시 강화** — docstring 한계 5에 명문화. 범위 확대는 ROADMAP의 별도 이월 항목(per-mode file list) |
| 새 주석이 「이 모듈 docstring도 상수명을 인용한다」고 적었는데 **거짓** | **수정** — 실측 결과 인용처는 CLAUDE.md §Verification과 ROADMAP W7 행 **둘뿐** |
| 검증 프롬프트가 「변경 파일 1개」라 했으나 실제 3개 | 코드 결함 아님 — 프롬프트 오류. 기록만 |

**C5의 인용 재앵커 — 실측 주의사항 2건 (REMEASURE §4-2):**
- 2분할 기준 측정치는 file A **52건** / file B **10건**. **3분할은 재측정이 필요하다** — 첫 컷(Step 3 앞)의
  비용은 미측정이다(§Review Sheet, Changed in this revision 3).
- **정규식 일괄 치환 금지.** file B 영역의 12건 매치 중 **2건(2325·2376행, `skills/team-memory/SKILL.md` 앵커)이
  오탐**이다.

---

## 7. description 예산 (결정 ⑦ — 초안)

### 7.1 현황 (실측)

- `TOTAL_CEILING = 6841`, slack 0 (라쳇 — 같은 커밋에서 명시적 상향이 정상)
- `PER_SKILL_CAP = 1024` (개별 하드 상한)
- `PER_SKILL_CEILING["harness"] = 470`
- 외부 fallback 8,000자 기준 명목 여유 1,159자 — **단 타 출처 스킬과 공유되므로 실질은 더 작다(미확인)**

### 7.2 3스킬 배분 초안

`470 → 3개`로 늘리므로 순증은 `(a+b+c) - 470`. 명목 여유 1,159자 안에 들어가려면 합계 ≤ 1,629자.

| 스킬 | 목표 길이 | 유지해야 할 트리거 신호 |
|---|---|---|
| `harness` | ~520 | 기존 트리거 전부 + 「Plan 단계까지」 + 「게이트는 `/harness-gate`」 |
| `harness-gate` | ~330 | 「HARD GATE 전용」 + 「무도구 — 쓰기 없음」 + 「spec 확정 확인」 |
| `harness-build` | ~420 | 「확정된 spec만 입력」 + 「Generate/Verify/Evaluate」 + 「epic slice plan」 |
| **합** | **~1,270** | 명목 여유 1,159 초과 → **`TOTAL_CEILING` 상향으로 흡수**(라쳇 관례상 정상) |

**스크립트가 `harness*`에 강제하는 토큰은 0개다**(`REQUIRED_TOKENS`/`FORBIDDEN_TOKENS`는 `study` 키 하나뿐,
`POV_ALLOWLIST`는 `handoff`/`spec` 둘뿐). 트리거 신호 보존은 순전히 설계자의 자발적 선택이며,
**린트가 잡아주지 않는다**는 점을 spec이 명시한다.

### 7.3 즉시 실패하는 함정

새 스킬 디렉터리를 만든 순간 `PER_SKILL_CEILING`에 항목이 없으면 **총량 비교 전에 즉시 실패**한다:
`FAIL: harness-build: no per-skill ceiling recorded -- add one in the same commit` (실측, exit 1).

---

## 8. ⑧ 직접 호출 — 위협 모델 분리 (결정 ⑧)

`/harness-gate`나 `/harness-build`를 처음부터 직접 호출하는 것은 **막을 수 없다**(순서 선언 필드 부재).
이 spec은 그것을 결함이 아니라 **다른 위협 모델**로 분리해 문서화한다:

- **드리프트**(이 에픽이 막는 것): 모델이 순서를 지킬 의도로 진행하다가 컨텍스트 압박·규칙 망각으로 단계를 건너뛴다.
  → 게이트 턴에 도구가 없으므로 **어길 수 있는 일이 없다.**
- **명시적 우회**(막지 않는 것): 사람이 `/harness-build`를 직접 친다.
  → 사람의 의도적 선택이며, 그 사람은 spec.md가 없다는 것을 즉시 본다.

각 스킬은 진입 시 선행 산출물 부재를 **감지해 안내**한다(차단이 아니라 안내 — `phase`가 감사 전용이므로
차단 근거로 쓸 수 없다).

---

## 9. Acceptance Criteria

| AC | 내용 | 검증 방법 |
|---|---|---|
| AC-1 | C1 적용 후 린트 7종 출력이 사전 베이스라인과 **바이트 동일** | `diff baseline.txt after.txt` → 빈 출력 (**충족**, §6.1) |
| AC-1b | C1 이후 분할 실패 중 **파라미터화가 원인인 것이 0건** — 이것이 C1의 성공 기준이며, 「분할이 green이 된다」가 아니다 | 스크래치 실패 분류표 (**충족**, §6.1: 공유 핀 5건 소멸) |
| AC-1c | 모드가 요구하는 키가 빠진 엔트리는 **KeyError가 아니라 이름을 말하는 FAIL**로 실패. 체커는 있는데 필수키 테이블에 없는 모드도 마찬가지 | `_MODE_REQUIRED_KEYS` 검사 (**충족**) |
| AC-1d | **채택된 분할(꼬리 잔류)** 에서 ①+③+④가 rc=0에 도달 | §6.2 (**충족** — 수정 전 3 FAIL, 수정 후 0) |
| AC-1e | 어떤 측정도 그것이 어느 분할에서 나왔는지 명시한다 | §6.1/§6.2가 각각 컷을 명시 (**충족**) |
| AC-2 | C2 적용 후 `skills/harness/SKILL.md`에 mtime **비교**를 수행하는 사이트가 0건 | `grep -n mtime` 후 각 건이 서술인지 비교인지 수동 판정 (21건 전건 열거) |
| AC-3 | C2가 2022·2046행의 「일부러 이식하지 않았다」 서술을 **수정하지 않음** | `git diff`에 해당 행 부재 |
| AC-4 | C3 적용 후 정본 Step id가 12개이고 `HARNESS_STEP_IDS`가 같은 커밋에서 재고정됨 | 린트 rc=0 + `git show --stat`에 두 파일 동시 존재 |
| AC-5 | C5 적용 후 린트 7종 rc=0, **SYNC 9그룹 무손상** | `verify_sync_markers.py` → `9 sync group(s), 51 marker site(s)` |
| AC-6 | C5의 재앵커가 `skills/team-memory/SKILL.md` 앵커 2건을 **건드리지 않음** | `git diff` 해당 2행 부재 |
| AC-7 | `harness-gate`의 frontmatter가 `Bash`·`Write`·`Edit`를 **이름 형식으로** 나열 (스코프 패턴 금지 — no-op) | frontmatter 직접 확인 |
| AC-8 | `harness-gate` 세션에서 `Bash` 호출이 `No such tool available`로 실패 | **라이브 프로브 1회** |
| AC-9 | **R-1 프로브**: `templates/_shared/` 파일을 이름으로만 인용한 스킬이 그 계약을 실제로 준수하는지 | **라이브 프로브 1회 — C4 착수 전 필수** |
| AC-10 | C6 적용 후 `verify_description_budget.py` rc=0, `TOTAL_CEILING`이 같은 커밋에서 상향 | 린트 + `git show` |
| AC-11 | 이 spec의 핵심 3건(광고 명제 확정 / phase 감사 전용 강등 / 3분할)이 **ROADMAP에 등재**됨 | `docs/`가 gitignored이므로 영속 경로 확보 |

---

## 10. Do NOT (이 에픽 실행 중)

- **`disallowed-tools`에 스코프 패턴을 쓰지 마라** — no-op다(P-9 ⓑ 실측). 이름 형식만 집행된다.
- **폐기된 설계 4안**(phase 그래프 집행 / 영수증 / 훅+트랜스크립트 / 트랜스크립트 사후검증)을 다시 제안하지 마라.
  사유는 `PROBE-FINDINGS-enforcement.md` §3.
- **`phase`를 게이트 통과 증거로 되살리지 마라** — 결정 A가 정확히 그것을 금지한다. 모델이 쓰는 값이다.
- **W7 조건부 go의 (b)를 문면 그대로 따르지 마라** — FAIL 54→70으로 악화된다. ROADMAP:105의 2026-09-04 정정이
  4단계 형태(①파라미터화 → ②등록 → ③재고정 → ④재앵커)를 갖고 있다.
- **`§Step` 인용을 정규식으로 일괄 재앵커하지 마라** — 12건 중 2건 오탐.
- **`skills/harness/SKILL.md` 안에 그 파일의 §citation 수치를 적지 마라** — 자기무효화가 3회 발화한 이력.
- **2분할 실측치를 3분할에 그대로 쓰지 마라** — 52/10은 **두 번째 컷**의 비용일 뿐이다.
