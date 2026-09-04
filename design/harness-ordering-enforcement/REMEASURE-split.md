> **이 파일은 2026-09-04에 `docs/harness/plan/REMEASURE-harness-split.md`에서 이 경로로 옮겨졌다.**
> 원래 위치는 `.gitignore`의 `docs/` 아래여서 커밋되지 않았다. 이제 이 파일은 **커밋된다** —
> 따라서 본문에서 *이 문서 자신*을 「gitignored — 공개 링크 아님」으로 지칭하는 표기는
> 이 헤더가 대체한다. 여전히 `docs/` 아래에 있는 **다른** 파일을 그렇게 지칭하는 표기는 유효하다.
> 추가로 원본 1행의 harness 서브에이전트 주입-가드 배너(저자가 쓴 내용이 아니라 도구가
> 삽입한 줄)를 제거했다.
>
> 본문은 그 밖의 한 글자도 수정하지 않았다.

# BLOCKING 3건 복원 판정 및 분할 재측정 기록

기준: `C:/workspace/agent-harness`, `develop @ 490f4a6`, 작업 종료 시 `git status --porcelain` 빈 출력(원본 무수정). 모든 분할 실험은 스크래치패드 사본에서만 수행 후 삭제.

---

## 0. 잃어버린 판정의 원출처를 찾았다 — 3라벨 해석의 열쇠

세 병렬 보고 중 budget가 찾아낸 `docs/harness/plan/PROBE-FINDINGS-enforcement.md`(gitignored, 2026-09-01)를 직접 읽었다. 그 §5에는 핸드오프 한 줄 요약 **바로 위에** 3라벨이 무엇을 겨냥했는지를 결정하는 문장이 남아 있다:

> 「단계별로 「이 경로에만 못 쓰게」는 스킬 분할만으로 달성 불가이며, 남는 수단은 **도구 자체를 통째로 빼는 것**뿐이다(예: **게이트 전 단계에서 `Bash`·`Write`·`Edit`를 통째로 제거**).」
> 「따라서 광고 가능한 명제는 「게이트 전 구현 불가」가 아니라 **「게이트 전 기존 파일 수정·명령 실행 불가」**다.」
> — `docs/harness/plan/PROBE-FINDINGS-enforcement.md` §5 (131–142행)

이 두 문장이 라벨 3개 중 2개를 즉시 해석 가능하게 만든다. 적대 렌즈가 겨냥한 것은 「분할하면 파일이 깨진다」가 아니라 **「분할이 광고하려는 명제가 harness 자신의 계약과 모순된다」**이다. 「기존 파일 수정 불가」 ↔ `Modify`(= "update spec.md"), 「명령 실행 불가」 ↔ mtime 조회. 라벨 두 개가 §5의 명제 두 절과 정확히 1:1 대응한다.

재현: `sed -n '116,148p' docs/harness/plan/PROBE-FINDINGS-enforcement.md` (gitignored — 공개 링크 아님)

이 문서에도 BLOCKING 3건의 근거·재현은 없다(budget 보고와 일치). 아래는 그 라벨들을 현재 트리에서 다시 성립시키거나 기각한 결과다.

---

## 1. BLOCKING 3건 판정

### ① 「게이트의 mtime 의존」 — **부분 성립. 단, 소실된 판정이 겨냥했을 지점보다 더 앞에서 이미 무너진다**

**(a) 무엇을 두고 한 말인가.** §Step 3의 Stale Determination이다. 원문:

```
Otherwise, compare filesystem mtimes: `mtime({docs_path}spec.md)` vs.
`mtime(plan_critic.last_findings_path)`.
...
- mtime retrieval fails for either file (I/O error, tool unavailable) → **fail closed**,
  treat as **stale**. A silently-skipped check would re-expose Auto-revise on exactly the
  input this rule exists to protect (a user's un-recorded manual spec.md edit).
```
— `skills/harness/SKILL.md:1287-1298`

그리고 §Step 2.6의 latch: 「`plan_critic_findings.md` (a) exists AND (b) has an mtime STRICTLY AFTER `spec.md`'s mtime ... If either check fails, treat it exactly like an inline parse failure」(`:1171-1177`).

**(b) 성립하는가 — 세 갈래로 나뉜다.**

1. **「분할 경계가 mtime 기제를 가른다」는 소박한 읽기: 기각.** mtime 언급 21곳 전부를 확인했다. 위치는 279 / 1172-1177 / 1239 / 1287-1298 / 1406-1473 / 1522-1526 / 2022 / 2046. 비교를 *수행하는* 사이트는 §Step 2.6(1172)과 §Step 3(1287)뿐이고, 그 입력인 `spec.md`(§Step 2가 씀)와 `plan_critic_findings.md`(§Step 2.6)도 모두 같은 쪽이다. 4개 후보 경계(1268/1539/1655/1713) 어디를 택해도 전부 file A에 남는다. 2022·2046은 「**mtime latch를 일부러 이식하지 않았다**」는 반대 방향 서술이다(`:2046` "the same comparison would be unsound there, so the latch is deliberately NOT ported"). 재현: `grep -n "mtime" skills/harness/SKILL.md` (21행), `grep -c "mtime" skills/harness/SKILL.md` → `21`.
   - ※ gate-mechanics 보고의 「21줄, 전부 §Step 2.6와 §Step 3 사이에만 존재」는 **틀렸다** — 279·2022·2046이 그 밖에 있다. 개수 21은 맞다.

2. **「Bash 제거 → 게이트 영구 stale」이라는 읽기: 성립하되 절대적이지 않다.** §5가 명시한 수단이 「게이트 전 단계에서 Bash를 통째로 제거」이고, Stale Determination이 명문으로 `tool unavailable → fail closed → stale`을 규정하므로 이 조합은 논리적으로 성립한다. 결과는 Auto-revise 영구 비노출 + §Step 2.6 latch 영구 `"failed"`다. **다만 반증 한 가지를 붙인다**: 이 저장소의 도구 집합에서 mtime *순서*는 Bash 없이도 얻을 수 있다 — `Glob`의 계약이 "Returns matching file paths sorted by modification time"이다. Stale Determination이 필요로 하는 것은 절대 시각이 아니라 두 파일의 선후이므로 `Glob`로 부분 대체가 가능하다. 대체 불가능한 부분은 **동률(same-second) 규칙**이다 — 정렬은 동률에도 어떤 순서를 내놓으므로, 문서가 「보수적으로 stale」로 규정한 케이스가 조용히 not-stale이 된다. 즉 Bash 제거는 게이트를 죽이지는 않고, **명문화된 보수 규칙 하나를 조용히 무효화**한다. (Glob의 mtime 정렬은 도구 계약 문언으로만 확인했고 실측 프로브는 하지 않았다 — **미확인**.)

3. **결정적 사실 — 게이트를 보기도 전에 Bash는 이미 필수다.** §Step 1 Setup이 Bash를 세 곳에서 요구한다: `git rev-parse --is-inside-work-tree`(§Zero-Setup Environment Detection, `:41`), `git checkout -b harness/<slug>`와 실패 시 `git log harness/<slug> --oneline -1`(§Step 1 item 8, `:707`), 그리고 item 4-6의 언어/테스트/lint/typecheck 자동 감지. 따라서 **분할의 앞쪽 스킬에서 Bash를 통째로 제거하는 선택지는 mtime과 무관하게 이미 없다.** §5가 예시로 든 「게이트 전 Bash 제거」는 현재 Step 1과 양립 불가다.

**판정**: 라벨은 실재하는 모순을 가리킨다 — 그러나 결박 지점은 게이트가 아니라 **Step 1**이다. 정확한 진술은 「게이트의 mtime 의존이 분할을 막는다」가 아니라 **「앞쪽 스킬은 Bash를 내려놓을 수 없으므로, 분할은 §5가 광고한 '명령 실행 불가'를 전혀 제공하지 못한다」**이다.

**(c) 회피 설계 2안.**
- **안 1 — 게이트 전용 3번째 스킬.** `harness-plan`(Write/Bash 보유) → 사용자 메시지 → `harness-gate`(Read/AskUserQuestion만, Bash·Write·Edit 전부 제거) → 사용자 메시지 → `harness-build`. 게이트 스킬만이 실제로 무장해제 가능한 유일한 단위다. **대가**: 태스크당 사용자 메시지가 1회 → 2회로 늘고, Stale Determination을 mtime이 아닌 상태값으로 재설계해야 한다(예: plan 스킬이 spec.md를 쓸 때마다 `state.spec_revision`을 증가시키고 critic 결과에 그 값을 새기는 세대 카운터 — 파일시스템 무관, 동률 문제 소멸). 그 재설계는 §Step 2.6 latch·§Step 3 표 7행·§Auto-revise Exposure Predicate 4점을 함께 건드린다.
- **안 2 — 명제를 하향 조정하고 mtime을 유지.** 분할은 하되 광고 문구를 「게이트 전 소스 수정 불가」에서 「build 스킬을 사용자 메시지 없이는 진입할 수 없다」로 낮춘다. **대가**: 그 명제는 이미 P-10(턴 스코프) 실측이 무료로 주는 것이라, 분할이 새로 사는 것이 사실상 없다. 즉 이 안은 「분할하지 않는다」와 거의 등가다.

---

### ② 「`Modify` 옵션의 기존 파일 수정」 — **성립. 3건 중 가장 날카롭다**

**(a) 무엇을 두고 한 말인가.** §Step 3 HARD GATE 안, Pass A 전 행과 Pass B가 공유하는 옵션이다:

```
"Modify" (every row): update spec.md, then re-present **starting at Pass A**   (:1471)
- "Modify" / "Edit the spec, then re-confirm" → update spec.md, then re-present
  **starting at Pass A** (not Pass B) — see Modify Interaction below                (:1510-1511)
```
저장소 전체에서 `update spec.md`는 이 두 곳뿐이다. 재현: `grep -rn "update spec.md" skills/ templates/` → 2건.

**(b) 성립하는가.**

- **좁은 읽기(TOCTOU: build가 읽은 spec.md를 Modify가 나중에 바꾼다): 기각.** §State Transition Diagram(`:607-613`)과 §Transition Rules(`:620-630`)를 확인했다. `generate_ready` 이후 `plan_done`으로 돌아오는 전이가 없고, 재시도 루프는 `generating`/`verifying` 사이에서만 돈다. Modify는 항상 phase 전진 이전에만 일어난다. boundary 보고의 이 반증은 옳다.
- **§5 명제 대비 읽기: 성립.** §5가 광고하려는 명제는 문자 그대로 「**게이트 전 기존 파일 수정** 불가」인데, 게이트 자신의 표준 상호작용이 **모든 행에서 항상** 기존 파일(spec.md) 수정을 제공한다. ROADMAP 114행 실측(「`disallowed-tools: Write(probe_zone/**)`는 **완전히 무시**됐다 ... a capability-ordered split can only remove whole tools」)에 따라 「spec.md만 쓰게」는 표현 불가이므로, Modify를 유지하려면 앞쪽 스킬이 Write/Edit를 **통째로** 보유해야 하고, 그 순간 임의 소스 편집 능력이 되살아난다.
- **더 강한 사실 — Modify가 없어도 명제는 이미 거짓이다.** 앞쪽 스킬은 Modify와 무관하게 파일을 쓴다: `.harness/state.json`(§Step 1 item 7 이후 전 단계), `{docs_path}spec.md`(§Step 2 WORKFLOW item 6 「Orchestrator writes `{docs_path}spec.md` from the PlanResult object」 `:1004`), `{docs_path}slice_plan.md`(§Step 3.5), 그리고 §Architecture Principles #1의 「the orchestrator also **WRITES** spec.md/changes.md/slice_plan.md from returned objects」(`:2435`). 최상단 역할 정의도 「you handle transitions, gates, and **writing final artifacts**」(`:16`)다. 따라서 **Modify는 이 결함의 원인이 아니라 가장 눈에 띄는 사례**다.

**판정**: 라벨이 겨냥한 결함은 실재한다. 다만 정확한 형태는 「Modify가 분할을 깬다」가 아니라 **「게이트를 앞쪽에 두는 어떤 분할도 §5의 '기존 파일 수정 불가' 명제를 만족시킬 수 없다 — 앞쪽 스킬이 Write/Edit를 통째로 보유해야 하기 때문이며, Modify는 그 필연성을 게이트 스텝 자신에게까지 좁혀 보여주는 증거」**다.

**미확인**: `Modify`의 *수행 주체*는 SKILL.md 원문에 동사로 명시돼 있지 않다. 같은 표에서 `Auto-revise`만 「**dispatch** §Step 2 WORKFLOW path's Auto-revise re-entry」(`:1465`)라고 위임을 명시하는 대조, 게이트가 오케스트레이터 전용이라는 규칙, §Architecture Principles #1의 오케스트레이터 spec.md 쓰기 선례 — 세 가지에서 「오케스트레이터가 자기 턴에 직접 편집한다」로 강하게 추론했을 뿐이다.

**(c) 회피 설계 2안.**
- **안 1 — 게이트에서 in-gate 편집을 제거.** `Modify`를 「Stop + 수정 요청을 담은 새 사용자 메시지로 plan 스킬 재진입」으로 대체하고, 게이트를 안 ①-1의 무도구 게이트 스킬에 둔다. **대가**: §Modify Interaction 3항목 계약(재표시는 항상 Pass A부터, 동일 턴/세션 경계 무관 동일 규칙)이 통째로 재설계 대상이 된다. 또 「Modify → 즉시 재표시」라는 사용자 경험이 「Modify → 세션 왕복」으로 나빠진다. 그리고 stale 판정을 mtime에서 세대 카운터로 옮기는 작업(①-c 안 1)과 **같은 커밋에서** 해야 한다 — 둘은 같은 문장(`:1522-1526`)으로 묶여 있다.
- **안 2 — frontmatter를 포기하고 `settings.json permissions.deny`를 쓴다.** ROADMAP 114행이 「The identical pattern DOES block under `settings.json` `permissions.deny`」로 실측했으므로 경로 스코프가 실제로 동작하는 유일한 표면이다. **대가**: 플러그인이 배포할 수 없는 사용자 머신 설정이고, 세션 전역이라 「단계별」이 아니다. 즉 「능력 기반 **순서**」가 아니라 「세션 전역 금지」로 성격이 바뀐다.

---

### ③ 「epic 경로 좌초」 — **성립. 텍스트 근거가 가장 강하다. 단 「물리적 도달 불가」라는 강한 표현은 기각**

**(a) 무엇을 두고 한 말인가.** §Step 3.5가 §Step 8로 같은 턴에 이름으로 제어를 넘기는 직행 엣지다:

```
Immediately after that write, control passes to §Step 8's epic-exit branch by name — Step 4
through Step 7 are **not** executed this session (that branch defines its own fail-closed
re-confirmation predicate independently).                                    (:1552-1555)
```
같은 사실이 독립적으로 3회 더 선언된다: §State Transition Diagram `plan_done → completed (epic exit only — §Step 8's epic-exit branch; Steps 4–7 not executed)`(`:613`), §Transition Rules(`:628-630`), 그리고 §Step 8 자신의 역방향 확인 「`{docs_path}slice_plan.md` was already written by §Step 3.5, **the section that just handed control here**」(`:2179-2180`). 재진입 경로도 확인했다 — §Session Recovery item 7의 plan_done 행은 「if true, route to §Step 3.5 (Slice Plan) by name ... **Step 4 is never reached this way**」(`:270-274`)로, Step 8을 직접 가리키는 복구 경로는 파일 전체에 0건이다.

**(b) 성립하는가 — 성립. 다만 심각도는 두 보고의 중간이다.**

- 「Step 3.5 뒤 / Step 4 앞」 컷은 출발점(Step 3.5, file A)과 도착점(Step 8, file B)을 갈라놓는다. 실측: 컷 이후 file A에 남는 `§Step 8` 인용 15건 중 **4건이 §Step 3.5 본문 안**(1548·1553·1585·1601), 1건이 §Step 3 Pass B(1505)다. 재현: 아래 §2의 교차 인용 스크립트.
- epic 세션은 정의상 Step 4~7을 실행하지 않으므로, 뒤쪽 스킬로 넘어갈 **정상 통로(Step 4 진입) 자체를 쓰지 않는다.** 그런데 뒤쪽 스킬에만 있는 Step 8이 `.harness/` 삭제·`phase → "completed"`·§Session Boundary Type B epic variant 출력을 전부 소유한다.
- **결정적 비대칭 — 그 전환에는 게이트가 없다.** §Step 8의 `#### If epic exit:` 분기(`:2171-2190`)에는 AskUserQuestion이 없다(있는 것은 `#### If has_git == true:` 분기뿐). 즉 epic 세션은 **아무 게이트도 통과하지 않은 채 구현 능력을 가진 스킬로 진입**해야 정리를 끝낸다. 「순서를 어겨도 어길 수 있는 일이 없게 만든다」는 설계 목적이 정확히 이 경로에서 뒤집힌다.
- **기각하는 부분**: gate-mechanics의 「물리적으로 도달 불가능」·「재실행할 때마다 같은 루프에 갇힌다」는 과장이다. 사용자가 `/harness-build`를 직접 부르면 Step 8에 도달한다(순서 선언 필드가 없다는 것은 §1-16이 이미 인정한 한계다). 「스킬 간 동일 턴 이름 제어이양이 불가능하다」는 것도 부재 증거 + P-10 추론이며 라이브 프로브로 확인되지 않았다 — **미확인**. 다만 정리를 끝내지 못한 채 세션이 끝나면 `.harness/`가 남아 이후 모든 `/harness` 호출이 §Session Recovery로 진입한다는 것은 문서상 확실하다(`:270-274` + `:2183-2187`의 3층 방어 서술).

**판정: 성립(설계 결함).** 정확한 진술: **「Step 4 경계 컷은 harness의 유일한 스텝 스킵 엣지를 스킬 경계 위에 올려놓으며, 그 엣지에는 게이트가 없어 epic 세션이 무게이트로 구현 스킬에 진입하게 된다.」**

**(c) 회피 설계 2안.**
- **안 1(권고) — epic-exit 분기를 앞쪽 스킬로 되당긴다.** §Step 8의 `If epic exit:` 블록을 §Step 3.5 뒤의 자체 섹션(예: `#### Step 3.6: Epic Exit`)으로 옮기고, Step 8에는 `has_git` 두 분기만 남긴다. **대가**: (i) 「sole definition of this predicate in this file」(`:2172-2173`)이라는 단일 소스 선언의 소유자가 바뀌므로 §Step 3.5·§Session Recovery의 by-name 인용 대상을 함께 고쳐야 한다. (ii) 정본 Step id가 11 → 12로 늘어 `HARNESS_STEP_IDS` 재고정이 필요하다. (iii) §Step 8을 가리키는 A쪽 인용 15건의 상당수가 새 섹션으로 재조준돼야 한다. (iv) 유리한 점 하나: 그 분기가 부르는 Artifact Cleanup Safety Guard는 이미 `templates/_shared/safety_guard.md` 단일 소스라 **추가 비용 0**이다.
- **안 2 — Step 8을 뒤쪽에 두고 핸드오프 문구를 명문화한다.** epic 세션 종료 시 「`/harness-build`를 실행해 정리를 마치라」를 출력한다. **대가**: 무게이트 구현 스킬 진입이 계약으로 승격되고, 그때까지 `.harness/`가 살아남아 그 저장소의 이후 `/harness` 호출이 전부 Session Recovery를 거친다. 결함을 문서화할 뿐 없애지 않으므로 권고하지 않는다.

---

## 2. 분할 경계 권고

### 2.1 베이스라인 (현재 트리 실측)

| 항목 | 값 | 재현 |
|---|---|---|
| 파일 크기 | 2,522행 / 212,505 B | `wc -l skills/harness/SKILL.md; wc -c skills/harness/SKILL.md` |
| 헤딩 | 80개 (H1 1 / H2 18 / H3 30 / H4 31) | 아래 measure.py |
| 정본 Step 헤딩 11개 | 663 / 864 / 957 / 1103 / 1268 / 1539 / 1655 / 1713 / 1992 / 2032 / 2160 | `CANON_STEP_RE` over `_headings()` |
| 서브패스 헤딩 6개 | 973·984(Step 2) / 1659·1671(Step 4) / 1780·1796(Step 5) | 동일 |
| in-file §Step 인용 | 203 (foreign 3 제외) | `PYTHONIOENCODING=utf-8 python scripts/verify_sync_markers.py` OK 라인 |
| 외부 인용 | 17건 / 7개 파일 | 동일 |
| SYNC 그룹 | 9그룹 / 51 사이트 | 동일 |
| 린트 | exit 0 | 동일 |

**세 병렬 보고와의 대조**: 헤딩 80·Step 라인 11개·서브패스 6개·203/17/7/9/51은 boundary 보고와 완전 일치. 교차 인용 총계는 내 재측정과 boundary가 3~4건 차이(내 104 대신 107 등) — 원인은 비-Step §citation의 해석 실패 건수 차이(내 스크립트 미해결 37, boundary 14)다. **§Step 축은 실측 린트와 정확히 교차검증된다**(아래).

### 2.2 후보 경계별 비용 (§Step 인용 교차, 정적 계산)

| 컷 | file A / B 바이트 | A→B | B→A | 합 |
|---|---|---|---|---|
| Step 3 앞 (1268) | 100,122 / 112,383 | 79 | 15 | **94** |
| Step 3.5 앞 (1539) | 123,882 / 88,623 | 65 | 14 | **79** |
| **Step 4 앞 (1655)** | 132,906 / 79,599 | **52** | **10** | **62** ← 최소 |
| Step 5 앞 (1713) | 136,649 / 75,856 | 53 | 13 | 66 |
| Step 6 앞 (1992) | 159,414 / 53,091 | 44 | 29 | 73 |

재현(측정 스크립트 전문은 `verify_sync_markers.py`의 `_headings`/`CANON_STEP_RE`/`STEP_CITE_RE`/`PATH_ANCHOR_RE`를 import해 사용):
```
python -c "import importlib.util,re;s=importlib.util.spec_from_file_location('v','scripts/verify_sync_markers.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v);
t=open('skills/harness/SKILL.md',encoding='utf-8').read();f={m.end()-5 for m in v.PATH_ANCHOR_RE.finditer(t) if m.group(1)!='skills/harness/SKILL.md'};
C={'1':663,'1.5':864,'2':957,'2.6':1103,'3':1268,'3.5':1539,'4':1655,'5':1713,'6':1992,'7':2032,'8':2160};L=1655;
c=[(t.count(chr(10),0,m.start())+1,C.get(m.group(1))) for m in v.STEP_CITE_RE.finditer(t) if m.start() not in f];
print(sum(1 for a,b in c if b and a<L<=b), sum(1 for a,b in c if b and b<L<=a))"
```

### 2.3 실측 — 실제로 잘라 린트를 돌린 결과

| 컷 | exit | FAIL 총계 | 내역 |
|---|---|---|---|
| **Step 4 앞 (1655)**, 새 파일 = `skills/harness-build/SKILL.md` | 1 | **54** | PIN-STEP 1 + PIN-SUBPATH 1 + SELF-STEP 52. **SYNC 그룹 파손 0, 외부 파일 파손 0, PIN-FILES·PIN-ANCHOR 미발화** |
| Step 3.5 앞 (1539), 동일 구조 | 1 | **74** | 위 + **SYNC 그룹 `slice-command-format` 2건 파손**(target anchor `slugify(task) == task == Slice` 소실, `Next cmd` 토큰 누락) + **외부 파일 5건 파손**(`skills/handoff/SKILL.md:88,90,673`, `workflows/_reference/schemas.md:202`, 새 파일 자기참조 1) |

재현: 스크래치 사본에 `skills templates workflows scripts`를 복사 → 해당 라인에서 분리 → `PYTHONIOENCODING=utf-8 python scripts/verify_sync_markers.py`.

**교차검증**: 1655 컷의 SELF-STEP 52건은 2.2의 정적 A→B 52와 **정확히 일치**한다. 두 방법이 독립적으로 같은 수를 낸다.
**boundary 보고와의 차이 해소**: boundary는 같은 컷에서 55/75를 얻었다. 차이 1은 boundary가 새 파일을 `skills/harness/BUILD.md`(같은 디렉터리)에 두어 **PIN-FILES가 추가로 발화**했기 때문이다. 나는 실제 설계대로 별도 스킬 디렉터리에 두었고, 그 경우 PIN-FILES는 발화하지 않는다(2.6 참조).

### 2.4 그러나 「한 줄 컷」은 틀렸다 — 새 발견

파일 구조는 `preamble(1–660) | ## Workflow Steps(661–2244) | tail(2245–2522)`다. 꼬리에는 `## Sub-command: doctor`(2245)·`## Model Selection`(2418)·`## User Interaction Rules`(2429)·`## Architecture Principles`(2433)·`## Key Rules`(2504)가 있다. **`1..1654 / 1655..끝` 단순 컷은 이들을 전부 build 스킬로 보낸다** — `/harness doctor` 서브커맨드까지 포함해서. 그 배치에서 file A는 `§Architecture Principles`를 7회, `§Path Validator`를 2회 경계 너머로 인용한다.

현실적 분할(= **Steps 4–8만(1655–2244) 추출, preamble과 tail은 harness에 잔류**)의 실측 비용:

| 지표 | 값 |
|---|---|
| file B 크기 | 55,071 B (전체의 25.9%), file A 157,434 B |
| §Step 인용 교차 | A→B 62, B→A 5 (합 67) |
| 전체 §citation 교차 | A→B 62, B→A 36 (합 98) — 단순 컷 107보다 적다 |
| B→A 인용 상위 | §Session Boundary 11, §Session Recovery 8, §Architecture Principles 6, §Output Language Contract 2, §State Machine 2, §Step 2.6 2, §Step 3.5 2, §Mode Gate 1, §Sub-agent Return Value Rules 1, §Step 3 1 |

**이것이 가장 큰 미해결 비용이다.** build 스킬 본문이 이름으로만 인용하는 공유 계약 6개의 크기: §Session Recovery 15,543 B · §Session Boundary 8,873 B · §Architecture Principles 7,774 B · §Output Language Contract 4,717 B · §State Machine 2,507 B · §Sub-agent Return Value Rules 1,320 B = **합 40,734 B**. 스킬은 호출 시 자기 SKILL.md만 로드되므로, 이 40 KB를 (i) 복제(BLOCK-sync 그룹 6개 신설) (ii) `templates/_shared/`로 추출(저장소 관례에 부합하나 이 파일 최대 규모의 리팩터) (iii) 경로 앵커만 붙이고 실행 중 다른 파일을 읽게 함(§Architecture Principles #1의 「reads no intermediate files」 예외 목록 7개와 충돌 검토 필요) 중 하나를 골라야 한다. **어느 것도 현재 어디에도 정의돼 있지 않다.** 인용 67건 재작성보다 이쪽이 훨씬 큰 비용이다.

### 2.5 권고

**「Step 3.5 뒤 / Step 4 앞」은 여전히 최소 비용 경계다 — 세 축 모두에서 확인됐다:**
1. §Step 교차 62로 5개 후보 중 최소(2.2).
2. 실측 FAIL 54로 최소이며, **SYNC 그룹 파손 0·외부 파일 파손 0인 유일한 후보**(2.3). Step 3.5를 앞쪽에 남기는 것이 결정적이다 — handoff·schemas.md가 §Step 3.5를 인용하고, `slice-command-format` SYNC 그룹의 target anchor가 Step 3.5 본문 안에 있다.
3. 외부 인용 17건은 §Step 2(5)·§Step 3.5(4)·§Session Boundary(2)·§Session Recovery(2)·§Step 2.6(1)·§Step 3(1)·§Preserved-English Glossary(1)·§Conventions injection rule(1)만 가리킨다 — **Step 4 이상을 가리키는 외부 인용은 0건**이므로 외부 파일 재작성이 필요 없다.

**단, 세 가지를 수정해서 채택한다:**
- (i) 꼬리 섹션(2245–2522)은 harness에 잔류 → 「Steps 4–8만 추출」(2.4).
- (ii) §Step 8의 `If epic exit:` 분기를 앞쪽으로 되당긴다(BLOCKING ③, 안 1) → 정본 Step id가 11 → 12로 변경됨.
- (iii) 공유 계약 40 KB의 처리 방식을 spec에서 먼저 결정한다(2.4).

### 2.6 핀 4개와 SYNC 마커 8곳의 분배

**SYNC-WITH 마커 8곳 전부 file A에 남는다** (2.4의 현실적 분할 기준). 위치: 175(session_conflict) · 469(handoff §Fixed Label) · 720·722(mode_gate/project_defaults, Step 1 내부) · 919(spec.md §Step 1.5, **동시에 `HARNESS_NON_HEADING_ANCHORS` 리터럴 행**) · 1142(spec.eval.workflow.js, Step 2.6 내부) · 1541(자기참조, Step 3.5 내부) · 2517(adhoc_dispatch.md, `## Key Rules` — 꼬리 잔류). 재현: `grep -n "SYNC-WITH" skills/harness/SKILL.md`.
※ boundary 보고는 2517이 file B로 간다고 했으나, 그것은 단순 컷 가정이다. 꼬리 잔류 분할에서는 A에 남는다.

**핀 4개 분배 (실측)**:
- `HARNESS_STEP_IDS`(11) — **발화**. A는 `['1','1.5','2','2.6','3','3.5']`만 갖는다.
- `HARNESS_SUBPATHS`(6) — **발화**. A는 `[('2','INLINE'),('2','WORKFLOW')]`만 갖는다.
- `HARNESS_FILES` — **발화하지 않는다.** 코드가 `(ROOT / target_rel).parent.glob("*.md")`라 `skills/harness/` 한 디렉터리만 본다. 새 스킬은 `skills/harness-build/`에 생기므로 **이 핀은 분할을 전혀 보지 못한다**(boundary가 미확인으로 남긴 사각지대 — 이번에 실측 확인).
- `HARNESS_NON_HEADING_ANCHORS` — **발화하지 않는다.** 리터럴 `**Conventions injection rule (used by Step 2):**`은 919행(§Step 1.5 내부)이므로 모든 후보 경계에서 A에 남는다. (과제 지시문의 「그 앵커가 다른 파일로 넘어간다」는 `## Workflow Steps` **절 전체**를 반출할 때의 이야기이며, Step 4 컷에는 해당하지 않는다.)

---

## 3. description 예산 현황

**현황 (실측)**: 17스킬 합계 **6,841자**(unquoted), `TOTAL_CEILING = 6841`, **slack 0**. harness 자신 470자, per-skill ceiling도 470으로 slack 0. 전 스킬이 slack 0이다.
재현: `PYTHONIOENCODING=utf-8 python scripts/verify_description_budget.py` → `OK: 17 skills, total 6841 chars (raw 6847, delta 6), ceiling 6841, slack 0`.

**「여유가 있는가」 — 두 개의 서로 다른 분모를 구분해야 한다.**

1. **내부 `TOTAL_CEILING` 기준: 여유는 0이며, 이것은 정책적으로 정상이다.** 이 상수는 한도가 아니라 **직전 커밋의 실측 총량 그 자체**를 박아둔 라쳇이다(docstring: 「Was 7709 at 4295156, before this slice trimmed four descriptions」). `verify_sync_markers.py`의 `min_sites`와 같은 제로슬랙 관례이므로, 「여유가 0이다」는 「추가 불가」가 아니라 「같은 커밋에서 명시적으로 올려야 한다」를 뜻한다.
2. **외부 8,000자 fallback 기준: 명목상 1,159자 여유.** 6,841 / 8,000 = 85.5%. 그러나 `SLASH_COMMAND_TOOL_CHAR_BUDGET`은 **세션에 로드된 모든 스킬이 공유**하는 예산이지 이 플러그인 전용이 아니다(docstring 47–55행). 이 세션만 해도 superpowers 등 타 출처 스킬이 함께 목록에 오른다. **따라서 실제 가용 여유는 1,159자보다 작으며, 그 실측치는 저장소 안에서 구할 수 없다 — 미확인.** 또한 1%×컨텍스트 창이 8,000보다 크면 그쪽이 분모가 되므로 세션마다 가변이다.
3. **개별 스킬 상한**: `PER_SKILL_CAP = 1024`(spec 표면 확인값). 새 스킬 하나에 대한 하드 상한은 1,024자이고, 8,000 산술로는 1,159자가 상한이므로 **실질 상한은 1,024자**다.

**같은 커밋에서 고쳐야 할 상수 — 실측으로 확인한 3곳**:
- `PER_SKILL_CEILING`에 `"harness-build": <신규 길이>` 항목 추가. **없으면 총량 비교에 도달하기도 전에 즉시 실패**한다: `FAIL: harness-build: no per-skill ceiling recorded -- add one in the same commit` (실측, exit 1).
- `TOTAL_CEILING`을 새 실측 총량으로 명시적 상향(리터럴 상수, 자동 계산 아님).
- harness 자신의 description을 **늘리는 경우에만** `PER_SKILL_CEILING["harness"]`도 함께 상향. 줄이는 것은 무료다.
- 참고로 `REQUIRED_TOKENS`/`FORBIDDEN_TOKENS`는 현재 `study` 키 하나뿐이고, `POV_ALLOWLIST`는 `handoff`/`spec` 둘뿐이다 — 새 스킬 문안에 1·2인칭을 쓰지 않는 한 추가 조치는 없다. 재현: `sed -n '141,190p' scripts/verify_description_budget.py`.
- **다른 린트는 영향 없음(실측)**: 새 스킬 디렉터리를 만든 사본에서 `verify_manifest_sync.py` exit 0(스킬을 열거하지 않는다), `verify_block_sync.py` exit 0, `verify_meta_literal.py` exit 0.

**소실 노트의 「harness 500 + harness-build 424 → 7,295 / 8,000(여유 705)」 검증**:
산술은 **정확히 재현된다**: `6841 - 470 + 500 + 424 = 7295`, `8000 - 7295 = 705`. 즉 그 두 숫자는 내부 모순이 없고, 분모가 `TOTAL_CEILING`이 아니라 외부 8,000 fallback임을 알면 정합적이다. **그러나 실제 문안은 저장소 어디에도 없다** — `grep -rn "harness-build" --include=*.md .`의 전 매치는 `PROBE-FINDINGS-enforcement.md` 두 줄(137·142행)뿐이며 둘 다 서술이지 문안이 아니다. 또한 harness 현재 description은 470자이므로 **500은 축소가 아니라 30자 증가**다. 왜 늘렸는지(위임 관계 서술 추가 추정)는 **미확인**.
※ boundary 보고의 「7,295/8,000 재현 불가」는 *문안* 기준으로는 옳고 *산술* 기준으로는 틀렸다. budget 보고의 재현이 정확하다.

---

## 4. ROADMAP W7 조건부 `go` 충족 가능성

W7 행(ROADMAP.md:105)의 조건: 「conditionally `go` only for a split that (a) cuts on canonical Step-section boundaries and (b) **registers each new file in `SECTION_REF_TARGETS` and re-pins all four** zero-slack constants ... in the same commit」.

**(a)는 만족한다.** 권고 경계(Step 4 앞, Steps 4–8 추출)는 정본 Step 섹션 경계다.

**(b)는 문면 그대로 따르면 만족할 수 없다 — 오히려 악화된다. 이것이 이번 조사의 가장 중요한 새 발견이다.**

`_check_harness_steps(target_rel)`는 대상 경로 하나만 받고 **네 개의 핀과 `HARNESS_MIN_CROSS_FILES`를 모듈 전역 상수로 읽는다**(`scripts/verify_sync_markers.py:527-573`). 즉 mode가 타깃별로 파라미터화돼 있지 않다. 실측:

| 시나리오 | exit | FAIL |
|---|---|---|
| 분할만 하고 린트 무수정 | 1 | **54** |
| 분할 + **W7 (b) 문면대로** 새 파일을 `SECTION_REF_TARGETS`에 `harness-steps`로 등록 | 1 | **70** (악화) |

등록 시 추가되는 실패:
```
skills/harness/SKILL.md canonical Step ids ['1','1.5','2','2.6','3','3.5'] != pinned [...11]
skills/harness-build/SKILL.md canonical Step ids ['4','5','6','7','8'] != pinned [...11]     ← 같은 핀이 두 파일에 적용
skills/harness-build/SKILL.md sub-path headings [...4] != pinned [...6]
skills/harness-build/SKILL.md no longer contains the literal for non-heading anchor 'Conventions injection rule'
skills/harness/*.md is ['skills/harness-build/SKILL.md'] != pinned ['skills/harness/SKILL.md']   ← 메시지 라벨 하드코딩 버그
0 file(s) carry a path-anchored skills/harness-build/SKILL.md §pointer, expected >= 7            ← 전역 floor
```
**두 파일이 한 세트의 핀을 공유하므로 어느 쪽도 통과할 수 없다.** 곁들여 확인된 사소한 결함: PIN-FILES 메시지의 `skills/harness/*.md` 라벨이 리터럴이라 다른 타깃에 적용하면 사실과 다른 문장을 출력한다(`verify_sync_markers.py:571`).

**무엇이 더 필요한가 — 실측으로 green을 확인한 경로:**
1. **`harness-steps` mode를 타깃별로 파라미터화**한다. 핀 4개 + `HARNESS_MIN_CROSS_FILES` = **손잡이 5개**를 `SECTION_REF_TARGETS` 엔트리(또는 타깃 키 딕셔너리)로 내린다. 새 파일의 cross-file floor는 7이 아니라 1이어야 한다(외부에서 그 파일을 가리키는 파일이 아직 없으므로).
2. **경계를 넘는 §Step 인용에 경로 앵커를 붙인다** — file A에서 **52건**(`§Step 4|5|6|7|8` → `skills/harness-build/SKILL.md §Step N`), file B에서 **10건**(`§Step 1|1.5|2|2.6|3|3.5` → `skills/harness/SKILL.md §Step N`). ⚠ file B 영역에는 이미 다른 파일로 앵커된 §Step 인용 2건(2325·2376행, `skills/team-memory/SKILL.md`)이 있으므로 **건드리면 안 된다**(정규식 일괄 치환 시 12건이 매치된다 — 2건은 오탐). 재현: `PATH_ANCHOR_RE.finditer()` → 919(spec) / 1541(자기) / 2325·2376(team-memory) 총 4건.
3. 위 두 가지를 적용한 스크래치 사본 실측 결과: **exit 0**.
```
OK: 30 cross-file section ref(s) from 8 file(s) -> skills/harness/SKILL.md
OK: 96 in-file §Step ref(s) -> 6 pinned Step id(s); 8 sub-path ref(s) -> 2 pinned; 53 foreign-anchored OUT OF SCOPE
OK: 52 cross-file section ref(s) from 1 file(s) -> skills/harness-build/SKILL.md
OK: 45 in-file §Step ref(s) -> 5 pinned Step id(s); 4 sub-path ref(s) -> 4 pinned; 12 foreign-anchored OUT OF SCOPE
OK: 9 sync group(s), 51 marker site(s)
```
**9개 SYNC 그룹은 손대지 않고 그대로 통과한다.**

**따라서 W7 조건부 `go`의 (b)는 「등록 + 재고정」이 아니라 「①mode 파라미터화(스크립트 리팩터) → ②등록 → ③재고정 → ④인용 62건 재앵커」 네 단계로 다시 써야 한다.** 이 문장 자체가 W7 행에 대한 정정 사항이다(관례상 기존 행 안에 추가 기입).

**추가로 W7 행에 없는 게이트 3개** (이번 조사에서 새로 드러남): (i) `HARNESS_FILES` 핀은 별도 디렉터리 분할을 **탐지하지 못한다** — 즉 이 린트는 실제 설계가 취할 분할 형태에 대해 그 핀만큼은 무력하다. (ii) 꼬리 섹션 잔류(2.4). (iii) 공유 계약 40 KB의 처리 방식(2.4) — 이건 린트가 아예 보지 않는 축이다.

---

## 5. spec 착수 전 남은 미지수 — 측정으로 답할 수 없는 것

측정으로 더 좁힐 수 없고, 사람이 결정해야 하는 항목만 분리한다.

1. **광고 명제를 무엇으로 확정할 것인가.** §5의 「게이트 전 기존 파일 수정·명령 실행 불가」는 §1/§2 판정에 따라 **거짓이다**(앞쪽 스킬은 Write·Edit·Bash를 모두 보유해야 한다). 대안은 (a) 명제를 「build 스킬 진입에 사용자 메시지 1회가 강제된다」로 하향 — 그러면 분할이 새로 사는 것이 거의 없다, (b) 게이트 전용 무도구 3번째 스킬을 도입 — 사용자 메시지가 2회로 늘고 Modify·Stale 계약을 재설계해야 한다. **이 선택이 나머지 전부를 결정하므로 spec의 1번 질문이어야 한다.**
2. **Stale Determination을 mtime에서 세대 카운터로 옮길 것인가.** 옮기면 Bash 의존과 동률 규칙 문제가 함께 사라지지만, §Step 2.6 latch·§Step 3의 7행 조건표·§Auto-revise Exposure Predicate 4점·§Modify Interaction 3항목이 한 커밋에서 함께 바뀐다. 이 저장소가 가장 조심스럽게 다뤄온 영역이다.
3. **`Modify`의 수행 주체를 명문화할 것인가.** 현재 SKILL.md는 「update spec.md」라고만 쓰고 주체를 말하지 않는다(**미확인**). 능력 기반 순서 설계는 이 한 단어에 의존하므로, 어느 쪽이든 먼저 확정해야 한다.
4. **공유 계약 40,734 B(§Session Recovery·§Session Boundary·§Architecture Principles·§Output Language Contract·§State Machine·§Sub-agent Return Value Rules)를 복제할 것인가, `templates/_shared/`로 추출할 것인가, 경로 앵커만 붙일 것인가.** 저장소 관례는 추출을 지지하지만 비용이 가장 크다. 복제는 BLOCK-sync 그룹 6개를 새로 만든다.
5. **epic-exit 분기를 앞으로 되당길 것인가.** 되당기면 정본 Step id가 11 → 12가 되고 「sole definition」 소유자가 바뀐다. 두지 않으면 무게이트 구현-스킬 진입을 계약으로 승격시킨다.
6. **`harness-steps` mode 파라미터화를 이번 분할 커밋에 포함할 것인가, 선행 커밋으로 분리할 것인가.** 저장소 관례(제로슬랙 핀은 같은 커밋에서 재고정)는 전자를 요구하는 듯 보이나, 스크립트 리팩터 + 62건 인용 재작성 + SKILL.md 분할을 한 커밋에 담으면 리뷰가 불가능해진다.
7. **두 스킬의 description 실제 문안.** 산술 여유(외부 8,000 기준 명목 1,159자, 실질은 타 스킬 공유분만큼 작음 — **미확인**)는 있으나, 「Build 세그먼트만」·「확정된 spec만 입력」 같은 트리거 신호를 유지하면서 그 길이에 담기는지는 문안을 써 봐야 안다. 스크립트가 harness/harness-build에 대해 강제하는 토큰은 **하나도 없으므로**, 트리거 신호 보존은 순전히 설계자의 자발적 선택이다.
8. **`/harness-build`를 처음부터 직접 호출하는 것은 막을 수 없다**(순서 선언 필드 부재, §1-16). 이것을 「드리프트가 아니라 명시적 선택이라 위협 모델이 다르다」로 계속 정리할 것인지의 판단.

---

## 6. 입력 보고 간 충돌 정정

| 쟁점 | 정정 |
|---|---|
| mtime 언급 위치 | gate-mechanics의 「21줄 전부가 §Step 2.6~§Step 3 사이」는 **틀렸다**. 279·2022·2046이 밖에 있다. 개수 21은 맞고, 「Step 4~8에 mtime *비교*는 0건」도 맞다. |
| 「7,295 / 705」 재현 | boundary 「재현 불가」는 *문안* 기준으로 옳고 *산술* 기준으로 틀렸다. budget의 재현(`6841-470+500+424=7295`, `8000-7295=705`)이 정확하다. 단 분모 8,000은 `TOTAL_CEILING`이 아니라 외부 fallback이며 타 스킬과 공유된다. |
| 분할 실측 FAIL 수 | boundary 55/75 vs 내 54/74. 차이 1은 새 파일을 같은 디렉터리(`skills/harness/BUILD.md`)에 두었는지(PIN-FILES 발화) 별도 스킬 디렉터리에 두었는지(미발화)의 차이다. **실제 설계는 별도 디렉터리이므로 54/74가 해당 수치다.** |
| BLOCKING ③ 심각도 | boundary 「빌드 스킬을 거쳐야 하는 구조」(약함) vs gate-mechanics 「물리적으로 도달 불가·영구 루프」(강함). **중간이 정확하다**: 도달은 가능(사용자가 직접 호출)하나 그 전환에 게이트가 없어 설계 목적이 뒤집힌다. 「영구 루프」는 **미확인**. |
| SYNC 마커 2517의 귀속 | boundary는 file B로 간다고 했다. 꼬리 잔류 분할(권고안)에서는 **file A에 남는다**. |
| `HARNESS_FILES` 사각지대 | boundary가 「미확인」으로 남긴 것을 **실측 확인**: 별도 스킬 디렉터리 분할에서 이 핀은 발화하지 않는다. |

**이번 조사에서 원본 파일은 한 줄도 수정하지 않았다.** 최종 확인: `git status --porcelain` 빈 출력, `git log --oneline -1` = `490f4a6`, `python scripts/verify_sync_markers.py` exit 0.