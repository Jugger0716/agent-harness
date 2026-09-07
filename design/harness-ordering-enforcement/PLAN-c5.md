# C5 — `skills/harness/SKILL.md` 3분할 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `skills/harness/SKILL.md`(2,699행 / 228,414 B, `develop @ e155cb9` — `328d951` 이후 무변경)를
`harness` / `harness-gate` / `harness-build` 세 스킬로 분할하고, 가운데 스킬의 frontmatter에서
`Bash`·`Write`·`Edit`·`Glob`·`Task`·`Agent`·`Workflow`를 제거해 「게이트가 렌더되는 턴에는 파일 수정도
명령 실행도 구조적으로 불가능하다」를 산다. 린트 7종이 **매 커밋** rc=0이어야 한다.

**Architecture:** 자르는 기준은 **헤딩과 BLOCK 마커**다(행 번호는 `328d951`=`e155cb9` 재현 좌표일 뿐).
공유 계약은 `templates/_shared/` 추출이 아니라(R-1 기각) **소유권 분할 + BLOCK-sync 복제**로 처리한다
(SPEC §5.4). gate의 진입 검사는 §Session Recovery의 사본이 아니라 리다이렉트 **신작**이다(§5.4.5). 게이트의
모든 선택지는 **사용자가 타이핑할 다음 명령을 출력**할 뿐 아무것도 쓰지 않는다(§2.2).

**Tech Stack:** Markdown 계약 문서, Python 3 stdlib 린트(`scripts/verify_*.py`), Node(`check_workflow_syntax.mjs`).
저장소 파일 쓰기는 반드시 `open(p, 'w', encoding='utf-8', newline='\n')` — `pathlib.write_text`는 Windows에서
CRLF를 남긴다. `grep -P` 금지(rc 2). stdout은 `PYTHONIOENCODING=utf-8`.

**Spec:** `design/harness-ordering-enforcement/SPEC.md` rev.9 (§2 분할 설계, §5.4 배분, §6 커밋 계획, §7 예산,
§9 AC, §10 Do NOT). 실측 근거: `design/harness-ordering-enforcement/REMEASURE-split.md` §2.4/§2.6.

## Global Constraints

- **`harness-gate`의 `disallowed-tools`는 이름 형식만**: `Bash, Write, Edit, Glob, NotebookEdit, WebSearch, WebFetch, Task, Agent, Workflow` (AC-7·AC-14). 스코프 패턴은 no-op이므로 금지(§10).
- **gate가 실행할 수 없는 옵션("Restart" / "Stop" / "Delete and start" / 삭제·재시작 일체)을 gate의 진입 검사에 렌더하지 마라**(AC-13). gate의 AskUserQuestion 사이트는 HARD GATE #1 하나뿐.
- **`phase`는 게이트 통과 증거가 아니다**(결정 A). `phase → "generate_ready"` 쓰기는 `harness-build` 진입이 수행한다(§2.3).
- **BLOCK-sync 그룹은 `(tag, version, files, None)`** — `shared_source=None`, harness 사본이 정본. 사본을 바꾸면 version을 올리고 전 사본을 같은 커밋에서 갱신.
- **`§Step` 인용을 정규식으로 일괄 재앵커하지 마라** — `PATH_ANCHOR_RE` 위치 판정으로 이미 타 파일에 앵커된 인용(`skills/team-memory/SKILL.md` 2건, `skills/spec/SKILL.md` 1건)을 건너뛴다(AC-6).
- **경로 앵커 형식**은 린트의 `PATH_ANCHOR_RE`가 요구하는 대로: `` `skills/<dir>/SKILL.md` §Step N `` (백틱 경로 + 공백 + `§Step`). 앵커가 `§Step` 바로 앞에 있어야 한다.
- **`skills/harness/SKILL.md` 안에 그 파일의 §citation 수치를 적지 마라**(자기무효화).
- **§Session Recovery item 7의 순서를 재배열하지 마라**(priority order 명문화 절).
- **`git add -A` / `git commit -a` 금지** — 열거한 경로만 add. 브랜치 `harness/c5-three-way-split`, base `develop`, 머지는 `--no-ff`.
- **rev.8의 +62 KB를 인용하지 마라.** 비용 인용은 SPEC §5.4.6(+26/+35 KB) + 이 계획의 Task 0 재계산.
- 각 커밋 종료 시 `python scripts/verify_sync_markers.py && python scripts/verify_manifest_sync.py && python scripts/verify_meta_literal.py && python scripts/verify_block_sync.py && node scripts/check_workflow_syntax.mjs && python scripts/verify_description_budget.py && bash .github/scripts/check_lint_wiring.sh` 전부 rc=0.

---

## 이 계획이 SPEC rev.9에 대해 뒤집는 것 (Task 0에서 SPEC rev.10으로 기록)

실행 계획을 세우며 현재 트리를 실측한 결과다. 설계 변경이 아니라 **rev.9가 세지 않은 것**이다.

1. **Pass A의 옵션 3개가 배분되지 않았다.** SPEC §2.2의 매핑표는 Pass B 4개(Proceed / Plan as epic /
   Modify / Stop)뿐이다. Pass A의 "Auto-revise"(§Step 2 WORKFLOW 재진입 디스패치 + `plan_critic` 쓰기),
   "Run Critic anyway" / "Retry Critic"(§Step 2.6 own-critic 디스패치 + state.json 쓰기)은 gate가
   **실행할 수 없다**(Task/Agent/Workflow/Write 미보유). §10 「실행 못 하는 옵션 렌더 금지」가 그대로
   적용되므로 이 셋도 Modify와 같은 **리다이렉트**가 된다: `/harness --auto-revise`, `/harness --critic`.
   harness는 `phase == plan_done`에서 이 두 플래그(+ 기존 `--modify "<text>"`)를 재진입 명령으로 받는다.
2. **`hx-scale-render`(#15) 실측 — B2 5,525 B, ≤1,235 B가 아니다.** §Scale Assessment에서 gate가
   렌더에 필요로 하는 것은 §1~§4(2,516 B)만이 아니라 §Signal Domain(1,530 B — `measured: 없음/손상됨`
   렌더 문자열과 마감 공시 줄)과 §INLINE Fallback(1,477 B — degraded resume 렌더)까지다. 셋은 연속
   구간(현재 521–610행)이라 블록 1개로 잡힌다. 분리 불가한 것은 헤더 blockquote + §Compute-once
   (491–519행, 2,044 B)이며 이는 O harness(rev.9 (a) 재작성) + gate용 짧은 render-only 머리말 신작
   (≈450 B)이다. 비용은 rev.9 전체 기준 +35.1 KB → **+39.4 KB**(+5,525 − 1,235).
3. **재앵커는 62건이 아니라 126건이다.** 62/5는 2분할(Step 4 컷) 수치였고 3분할은 재측정이 필요하다고
   SPEC §6.2가 이미 경고했다. 실측(`STEP_CITE_RE`, 타 파일 앵커 제외, 영역 A=1–1371+2421–2699 /
   G=1372–1703 / B=1704–2420): **A→B 77, A→G 21, G→A 15, G→B 4, B→G 7, B→A 2 = 126**.
   비-Step §인용(§Session Recovery 등, 린트 미검사)은 별도로 A 4+…(아래 Task 3 표) — 블록 사본으로
   자기 파일 안에 남는 것이 대부분이고, gate가 §Session Recovery를 인용하는 5건만 진입 검사로 재조준.
4. **BLOCK 그룹은 14+1이 아니라 14+3이다.** `## Model Selection`(역할→티어 맵, 서브에이전트 디스패치
   규칙)과 `## User Interaction Rules`(2줄)는 rev.9 표에서 「꼬리 잔류(harness)」로만 잡혔으나 build가
   Generator/Evaluator/Verifier 디스패치에 그대로 실행한다 → B2 `hx-model-selection`(#16). User
   Interaction Rules 2줄은 동기화 없이 복제(공시, §Architecture Principles #3·#5·#6과 같은 처리).
5. **SYNC 마커 사이트 수가 51에서 움직인다.** `hx-session-entry`(session-conflict 마커 175행)와
   `hx-handoff-fields`(handoff-state-record 마커 478행)가 build로 복제되므로 `session-conflict` 7→8,
   `handoff-state-record` 2→3, 합 51→53. `slice-command-format` 그룹의 `target_file`은
   `skills/harness-build/SKILL.md`로 이동하고 `skills/handoff/SKILL.md`의 마커·산문 3곳도 따라간다.
   AC-5의 「51 marker site(s)」는 정정 대상(같은 커밋에서 SPEC 행 안에 정정 추가).
6. **커밋 분할 순서.** 핸드오프의 「C5-a 마커·분할 / C5-b 재앵커·재핀」은 각 커밋 lint green과 양립하지
   않는다(분할만 하면 54 FAIL, §6.2). green이 되는 순서는 **재앵커 먼저**다: 미분할 단일 파일 안에서
   장래 경로로 앵커된 인용은 layer 4·5에서 「타 파일 앵커 → OUT OF SCOPE」로 통과하고, 자기 경로
   (`skills/harness/SKILL.md`)로 앵커된 인용은 in-scope로 기존과 같이 검사된다. layer 6(CROSS)은
   등록된 타깃에만 돌므로 아직 없는 파일을 가리키는 앵커는 검사되지 않는다. 따라서
   **C5-a = 제자리 준비(중립화 + 앵커) → C5-b = 분할·등록·재핀 → C5-c = 파일별 의미 문면 → C5-d = 설명·문서**.

---

## 파일 구조 (분할 후)

| 파일 | 소유 절 (헤딩 기준) | 공유 블록(B2/B3) | 신작(N) |
|---|---|---|---|
| `skills/harness/SKILL.md` | frontmatter, 제목·역할 문단, §Session Recovery(carve-out·6.5·7(b)·plan 점프행), §Session Boundary(머리말·Type A 표 harness 행), §Scale Assessment 헤더+§Compute-once, §State Machine 전이표까지, §Workflow Steps: Step 1·1.5·2·2.6·After Plan Phase, §Sub-command: doctor, §Model Selection, §User Interaction Rules, §Architecture Principles 전체(registry), §Key Rules | #1–#14, #16 전부(정본) | plan_done 행 재작성, `--modify/--auto-revise/--critic` 재진입, §Fresh Start |
| `skills/harness-gate/SKILL.md` | frontmatter, 제목·역할 문단, §Entry Check, §Scale Assessment(render-only 머리말), §Workflow Steps: Step 3(Pass A/B/Modify Interaction) → 「Next command」표, §Architecture Principles(gate 부분집합), §Key Rules(gate 부분집합) | #2 `hx-user-lang`, #3 `hx-olc-core`, #14 `hx-path-validator`, #15 `hx-scale-render` | §Entry Check(≈1.5 KB), 옵션→명령 매핑, render-only 머리말 |
| `skills/harness-build/SKILL.md` | frontmatter, 제목·역할 문단, §Entry(plan_done 진입 쓰기 / `--epic`), §Session Recovery(build 점프행·completed·no-state), §Session Boundary(머리말·Type A build 행·Type B 전체), §State Machine Auto-fix 표, §Workflow Steps: Step 3.5·3.6·4·5·6·7·8, §Model Selection, §User Interaction Rules, §Architecture Principles(build 부분집합 + #2·#4), §Key Rules(build 부분집합) | #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #16 | §Entry(≈600 B), §Fresh Start(build판) |
| `scripts/verify_block_sync.py` | `GROUPS` += 16 그룹 | | |
| `scripts/verify_sync_markers.py` | `SECTION_REF_TARGETS` += 2 엔트리, harness 엔트리 재핀, `SYNC_GROUPS` 3곳 갱신, docstring 한계 갱신 | | |
| `scripts/verify_description_budget.py` | `PER_SKILL_CEILING` += 2, `TOTAL_CEILING` 상향, harness 항목 상향 | | |
| `skills/handoff/SKILL.md` | §Step 3.5 마커·산문 3곳 → `skills/harness-build/SKILL.md` | | |
| `workflows/_reference/schemas.md` | 202행 인용 → gate/build 경로 | | |
| `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `CLAUDE.md`, `SPEC.md`(rev.10) | 문서 | | |

**BLOCK 그룹 확정 (헤딩·리터럴 경계; 행은 `e155cb9` 좌표):**

| # | tag | 사본 | 시작(포함) | 끝(포함) |
|---|---|---|---|---|
| 1 | `hx-preamble-a` | harness, build | `## Sub-agent Return Value Rules (INLINE path only)` (18) | `## User Language Detection` 직전 비어있지 않은 행 (44) |
| 2 | `hx-user-lang` | harness, gate, build | `## User Language Detection` (46) | `## Output Language Contract` 직전 (56) |
| 3 | `hx-olc-core` | harness, gate, build | `## Output Language Contract` (58) | `### 1-line Return Translation (INLINE path only)` 직전 (91) |
| 4 | `hx-olc-inline-returns` | harness, build | `### 1-line Return Translation (INLINE path only)` (93) | `## Mode Gate — …` 직전 (103) |
| 5 | `hx-preamble-b` | harness, build | `## Mode Gate — path & mode resolution …` (104) | `## Session Recovery …` 직전 (145) |
| 6 | `hx-session-entry` | harness, build | `Cross-session continuity uses the \`state.json\` phase machine below.` (166) | item 6 마지막 행 `…The stored \`mode\` already preserves the chosen tier (single/standard/multi).` (222) |
| 7 | `hx-session-gate-a` | harness, build | `7. **Resume-suppression check**` (235) | `- **(b) docs_path drift**` 직전 (247) |
| 8 | `hx-session-gate-b` | harness, build | `   - Otherwise, ask the user via AskUserQuestion` (256) | `     - \`plan_ready\` →` 직전 (274) |
| 9 | `hx-session-actions-tail` | harness, build | `   - **Restart**:` (298) | View state only 항목 끝 `…re-renders it from the top.` (316) |
| 10 | `hx-run-style` | harness, build | `## run_style (Execution Mode)` (319) | Step Mode Prerequisites 표 마지막 행 (359) |
| 11 | `hx-boundary-shell` | harness, build | `### Type A — phase-boundary …` (373) | Type A 코드블록 닫는 ``` (384) |
| 12 | `hx-handoff-fields` | harness, build | `### \`/handoff generate\` field contract (P0-4)` (464) | `full contract — this file … beyond being read.` (481) |
| 13 | `hx-state-machine` | harness, build | `## State Machine` (612) | `### Auto-fix State Transition Table` 직전 (639) |
| 14 | `hx-path-validator` | harness, gate, build | `### Path Validator` (2642) | 공격벡터 표 마지막 행 (2680) |
| 15 | `hx-scale-render` | harness, gate | `### 1. Raw signal counts` (521) | INLINE Fallback 마지막 행 `…이 신호도 같은 오염을 반영함".` (610) |
| 16 | `hx-model-selection` | harness, build | `## Model Selection` (2594) | Verifier blockquote 행 (2603) |

마커 형식(기존 관례 그대로): `<!-- BLOCK-START:<tag> v1 — shared by /harness, /harness-build; edit every copy in one commit and bump the version -->` … `<!-- BLOCK-END:<tag> v1 -->`. `verify_block_sync.py`는 START 마커의 `.*?-->`를 허용하므로 설명 문구는 자유이고 END는 `tag version`만.

---

## Task 0: 실측 확정 + SPEC rev.10 + 브랜치

**Files:**
- Modify: `design/harness-ordering-enforcement/SPEC.md` (§Review Sheet Changed-in-this-revision, §2.2 표, §5.4.3 §Scale Assessment 행, §5.4.4 표, §5.4.6, §6 C5 행, §9 AC-5·AC-12, §10)
- Modify: `ROADMAP.md` W7 행 (rev.10 정정 문장 1개 append)

**Interfaces:**
- Produces: `hx-*` 16개 tag 명과 경계(위 표), Pass A 리다이렉트 매핑(아래), 재앵커 126건 확정치. 이후 모든 Task가 이 표를 읽는다.

- [ ] **Step 1: 브랜치 생성**

```bash
git switch -c harness/c5-three-way-split develop
git status --short --branch   # ## harness/c5-three-way-split, clean
```

- [ ] **Step 2: 재앵커 126건 목록을 스크래치에 생성** (실행 시 재측정 — 아래 스크립트가 Task 2의 입력이 된다)

```bash
mkdir -p "$SCRATCH"   # $SCRATCH = 세션 스크래치패드 디렉터리
PYTHONIOENCODING=utf-8 python - > "$SCRATCH/reanchor.tsv" <<'PY'
import re,bisect
t=open('skills/harness/SKILL.md',encoding='utf-8').read()
lines=t.split('\n'); off=[0]
for l in lines: off.append(off[-1]+len(l)+1)
ln=lambda pos: bisect.bisect_right(off,pos)
_SEP=r"[ \t]*(?:\n[ \t]*(?:>[ \t]*|//[ \t]*)?)?[ \t]*"
STEP=re.compile(r"§Step"+_SEP+r"(\d+(?:\.\d+)?)")
PA=re.compile(r"(?:\{CLAUDE_PLUGIN_ROOT\}/)?((?:skills|templates|workflows)/[A-Za-z0-9_.\-/]+\.(?:md|js))`?[ \t\n]*§Step")
anchored={m.end()-len("§Step"):m.group(1) for m in PA.finditer(t)}
def region(n): return 'G' if 1372<=n<=1703 else 'B' if 1704<=n<=2420 else 'A'
own={'A':{'1','1.5','2','2.6'},'G':{'3'},'B':{'3.5','3.6','4','5','6','7','8'}}
path={'A':'skills/harness/SKILL.md','G':'skills/harness-gate/SKILL.md','B':'skills/harness-build/SKILL.md'}
print("line\tregion\tid\tanchor_to\tcontext")
for m in STEP.finditer(t):
    if m.start() in anchored: continue          # already anchored elsewhere — never touched (AC-6)
    n=ln(m.start()); r=region(n); sid=m.group(1)
    tgt=[k for k,v in own.items() if sid in v][0]
    if tgt!=r:
        ctx=t[max(0,m.start()-30):m.end()+10].replace('\n','⏎')
        print(f"{n}\t{r}\t{sid}\t{path[tgt]}\t{ctx}")
PY
wc -l "$SCRATCH/reanchor.tsv"    # 127 (헤더 1 + 126)
```

Expected: 126 rows. 다른 수가 나오면 그 수를 이 계획과 SPEC rev.10에 적는다 — 추정하지 않는다.

- [ ] **Step 3: SPEC rev.10 기록** — `## Review Sheet` → `### Changed in this revision` 맨 위에 다음을 추가하고, 본문 4곳을 고친다.

```markdown
**rev.10 (2026-09-07) — C5 실행 계획(`PLAN-c5.md`)을 세우며 실측한 것 4건. 설계는 불변, rev.9가 세지 않은 것이다.**

1. **Pass A의 옵션 3개("Auto-revise" / "Run Critic anyway" / "Retry Critic")가 §2.2 매핑표에 없었다.**
   셋 다 §Step 2/§Step 2.6 디스패치 + state.json 쓰기라 gate가 실행할 수 없다. Modify와 같은
   리다이렉트로 처리한다 — §2.2 표에 3행 추가, harness가 `--auto-revise`·`--critic`(boolean)을
   `plan_done` 재진입 플래그로 받는다. `--modify`는 VALUE-TAKING이라 §Session Recovery carve-out의
   값 취득 플래그 목록에 들어간다.
2. **`hx-scale-render`(#15)는 B2 5,525 B로 확정** — §1~§4 2,516 + §Signal Domain 1,530 + §INLINE
   Fallback 1,477(연속 구간). gate가 `measured: 없음/손상됨`과 마감 공시 줄을 렌더하므로 뒤 둘도
   필요하다. 헤더 blockquote + §Compute-once(2,044 B)만 O harness. 전체 비용 +35.1 → **+39.4 KB**.
3. **재앵커는 126건**(A→B 77 / A→G 21 / G→A 15 / G→B 4 / B→G 7 / B→A 2). 62/5는 2분할 수치였다(§6.2의
   경고대로).
4. **BLOCK 그룹 16개** — `hx-model-selection`(§Model Selection, build가 디스패치에 실행) 추가, `## User
   Interaction Rules` 2줄은 동기화 없는 복제. SYNC 마커 사이트 51 → 53(`session-conflict` 7→8,
   `handoff-state-record` 2→3); `slice-command-format`의 target은 `skills/harness-build/SKILL.md`.
   AC-5의 「51 marker site(s)」는 그 행 안에서 정정.
```

§2.2 매핑표에 추가할 3행(기존 4행 뒤):

```markdown
| "Auto-revise" (Pass A ①-a) | `/harness --auto-revise` |
| "Run Critic anyway" / "Retry Critic" (Pass A ①-b/①-c/②-b/③/④) | `/harness --critic` |
| "Proceed as-is" (Pass A) | (명령 없음 — 같은 턴에서 Pass B로 진행, 쓰기 0) |
```

§5.4.3 §Scale Assessment 행의 `≤1,235` → `5,525 (실측 rev.10 — §1~§4 + Signal Domain + INLINE Fallback 연속 구간)`, 「C5 착수 시 실측」→「확정」. §5.4.4 표의 `(15)` 행을 확정 행으로, `| 16 | hx-model-selection | harness, build | 2594–2603 | 1,207 |` 추가. §5.4.6 표에 `| 전체 + #15·#16 실측 | — | +39.4 KB + 1.2 KB | rev.10 |` 행 추가. §6 C5 행의 「14개(#15는 실측 후)」→「16개(rev.10)」. AC-5의 `51 marker site(s)` 뒤에 ` — **rev.10 정정: 53**(블록 복제로 마커 2곳이 build에 생긴다)` append. AC-12의 「14(#15 실측 결과에 따라 15)」→「16」. §10에 추가: `- **Pass A의 Auto-revise / Run Critic anyway / Retry Critic을 gate에서 디스패치하지 마라** — 리다이렉트(§2.2)뿐이다.`

- [ ] **Step 4: ROADMAP W7 행 append** — 행 끝 `Evidence: … SPEC.md\` §5.4. |` 직전에 한 문장:

```
**Correction 2026-09-07 (SPEC rev.10) — the re-anchor count above (62) is the two-way figure; the three-way split re-anchors 126, and BLOCK groups are 16, not 14 — measured in `design/harness-ordering-enforcement/PLAN-c5.md` before any edit.**
```

- [ ] **Step 5: 린트 + 커밋**

```bash
python scripts/verify_sync_markers.py && python scripts/verify_manifest_sync.py && python scripts/verify_meta_literal.py && python scripts/verify_block_sync.py && node scripts/check_workflow_syntax.mjs && python scripts/verify_description_budget.py && bash .github/scripts/check_lint_wiring.sh
git add design/harness-ordering-enforcement/SPEC.md design/harness-ordering-enforcement/PLAN-c5.md ROADMAP.md
git commit -m "docs(design): C5 execution plan; SPEC rev.10 records what the plan measured"
```

---

## Task 1 (C5-a, part 1): 제자리 중립화 — 분할 전에도 참인 문면

`skills/harness/SKILL.md` 단일 파일 안에서, 블록화될 구간의 스킬 특정 문구를 스킬 중립으로 바꾼다.
모두 분할 전 상태에서도 **참**인 문장이다.

**Files:**
- Modify: `skills/harness/SKILL.md` (아래 리터럴 6곳)

**Interfaces:**
- Produces: 「§Fresh Start」 앵커명(각 파일이 자기 정의를 가진다), 「the owning skill」 관용구.

- [ ] **Step 1: Session Conflict gate 문안 중립화 (rev.9 (c))** — 175행 아래 gate 문단.

기존:
```
     question: "A `/{skill|'unknown'}` session exists in this directory (task: `{task}`, phase: `{phase}`, docs: `{docs_path}`). Starting /harness here will delete it. Delete it and start /harness?"
     options:
       - label: "Delete and start" / description: "Delete .harness/ and proceed with /harness"
```
변경:
```
     question: "A `/{skill|'unknown'}` session exists in this directory (task: `{task}`, phase: `{phase}`, docs: `{docs_path}`). Starting a new session here will delete it. Delete it and start?"
     options:
       - label: "Delete and start" / description: "Delete .harness/ and proceed with this skill's §Fresh Start"
```
기존 `If "Delete and start" → delete \`.harness/\`, then proceed
   to Step 1.` → `If "Delete and start" → delete \`.harness/\`, then proceed
   to this skill's §Fresh Start (defined once per skill — for /harness it is Step 1).`

`session-conflict` 그룹 토큰 `Session Conflict`·`Delete and start`는 그대로 남는다(확인: `grep -c "Delete and start" skills/harness/SKILL.md` ≥ 2).

- [ ] **Step 2: item 2 legacy branch·Restart·Stop·no-state 행의 「Step 1」→ §Fresh Start**

| 위치 | 기존 | 변경 |
|---|---|---|
| item 2 | `options: "Restart" / "Delete .harness/ and start fresh", "Stop" / "Keep files and halt"` | 불변(문구에 Step 1 없음) |
| item 7(a) 옵션 | `{"Restart" / "Delete .harness/ and start fresh", "Stop" / "Delete .harness/ and halt"}` | 불변 |
| Actions Restart (298) | `- **Restart**: Delete \`.harness/\` and proceed to Step 1` | `- **Restart**: Delete \`.harness/\` and proceed to this skill's §Fresh Start` |
| 318 | `If \`.harness/state.json\` does not exist, proceed to Step 1.` | `If \`.harness/state.json\` does not exist, proceed to this skill's §Fresh Start.` |
| Resume Safety Guard 실패 (270) | `treat as Restart` | 불변 |

- [ ] **Step 3: harness의 §Fresh Start 정의 추가** — 318행 바로 아래(§run_style 헤딩 앞)에:

```markdown
### Fresh Start

The entry this skill takes when no session exists, or after a Restart / "Delete and start"
deleted one: **Step 1: Setup** (§Workflow Steps). Each skill of the split defines this section
once; the shared §Session Recovery prose above names it and never a Step number, so the same
bytes hold in every copy.
```

- [ ] **Step 4: Glossary 주석 「this file (`/harness`)」→「this skill」 (B3 `hx-olc-core` 바이트 동일용)** — 58–91행 안 2곳:

`(rendered by \`/handoff\` — this file (\`/harness\`) has no \`Next cmd\` output site of its own)` → `(rendered by \`/handoff\` — this skill has no \`Next cmd\` output site of its own)`
`\`/harness\` still has no \`Next cmd\` output site of its own — that ownership is unchanged` → `this skill still has no \`Next cmd\` output site of its own — that ownership is unchanged`

- [ ] **Step 5: `/handoff generate` field contract 마지막 문장 (B2 #12)** — `this file (\`/harness\`) has no further obligation beyond being read.` → `this skill has no further obligation beyond being read.`

- [ ] **Step 6: Path Validator 호출 사이트 열거 중립화 (B3 #14)** — 2644행 `Call sites:` 문장은 Step 번호를 괄호 안 산문(`(Step 1.2)`)으로 적는다 — `§` 없이 — 린트 대상이 아니므로 불변. 다만 gate에서 거짓이 되는 것은 없다(gate도 `docs_path` 검증 사이트 「Session Recovery re-validation」에 대응하는 §Entry Check 6을 갖는다). **변경 없음** — 확인만.

- [ ] **Step 7: 린트 → rc=0 확인, 커밋은 Task 2와 합침**

```bash
python scripts/verify_sync_markers.py   # OK 라인 3개, 236 in-file 불변(§Step 토큰을 건드리지 않았으므로)
```

---

## Task 2 (C5-a, part 2): 126건 제자리 경로 앵커

미분할 파일 안에서 장래 소유 파일의 경로를 `§Step N` 바로 앞에 붙인다. **정규식 일괄 치환 금지** — Task 0
Step 2의 `reanchor.tsv`가 나열한 (행, id) 좌표만, 각 행을 열어 문맥에 맞게 손으로(또는 좌표 기반 스크립트로) 고친다.

**Files:**
- Modify: `skills/harness/SKILL.md` (126 사이트)

**Interfaces:**
- Consumes: `$SCRATCH/reanchor.tsv` (Task 0).
- Produces: 분할 후 layer 4/5가 전건 통과하는 인용 집합.

- [ ] **Step 1: 앵커 규칙**

| 인용이 있는 영역 → 가리키는 Step | 삽입 텍스트 (`§Step N` 직전) |
|---|---|
| A → 3 | `` `skills/harness-gate/SKILL.md` §Step 3`` |
| A → 3.5, 3.6, 4–8 | `` `skills/harness-build/SKILL.md` §Step N`` |
| G → 1, 1.5, 2, 2.6 | `` `skills/harness/SKILL.md` §Step N`` |
| G → 3.5, 3.6, 4–8 | `` `skills/harness-build/SKILL.md` §Step N`` |
| B → 1, 1.5, 2, 2.6 | `` `skills/harness/SKILL.md` §Step N`` |
| B → 3 | `` `skills/harness-gate/SKILL.md` §Step 3`` |

이미 `§Step N`이 백틱 경로 뒤에 오는 형태(`skills/spec/SKILL.md §Step 1.5` 등 3건)는 `reanchor.tsv`가 애초에 제외했다. 한 문장에 같은 파일의 §Step이 연달아 올 때(`§Step 2.6/§Step 3/§Step 3.5`, 394행)는 **각 토큰마다** 앵커를 붙인다 — `PATH_ANCHOR_RE`는 토큰 단위다.

- [ ] **Step 2: 좌표 기반 삽입 스크립트** (행 번호 뒤에서 앞으로 처리해 좌표가 밀리지 않게)

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import re,csv
p='skills/harness/SKILL.md'
t=open(p,encoding='utf-8',newline='').read()
assert '\r' not in t
lines=t.split('\n')
rows=list(csv.DictReader(open(r'%s/reanchor.tsv'%__import__('os').environ['SCRATCH'],encoding='utf-8'),delimiter='\t'))
from collections import defaultdict
by=defaultdict(list)
for r in rows: by[int(r['line'])].append(r)
STEP=re.compile(r"§Step[ \t]+(\d+(?:\.\d+)?)")
own={'skills/harness/SKILL.md':{'1','1.5','2','2.6'},'skills/harness-gate/SKILL.md':{'3'},'skills/harness-build/SKILL.md':{'3.5','3.6','4','5','6','7','8'}}
changed=0
for n in sorted(by,reverse=True):
    line=lines[n-1]
    def sub(m):
        global changed
        sid=m.group(1)
        tgt=[k for k,v in own.items() if sid in v][0]
        # skip if the 40 chars before already end with a backtick path anchor
        pre=line[max(0,m.start()-60):m.start()]
        if re.search(r"(skills|templates|workflows)/[A-Za-z0-9_.\-/]+\.(md|js)`?\s*$",pre): return m.group(0)
        changed+=1
        return f"`{tgt}` {m.group(0)}"
    # only ids listed for this line
    ids={r['id'] for r in by[n]}
    lines[n-1]=STEP.sub(lambda m: sub(m) if m.group(1) in ids else m.group(0), line)
open(p,'w',encoding='utf-8',newline='\n').write('\n'.join(lines))
print('anchored',changed)
PY
```

Expected: `anchored 126` (Task 0 Step 2와 같은 수). **줄바꿈으로 갈라진 `§Step\nN`(CONT_RE 형)은 이 스크립트가 못 본다** — `reanchor.tsv`의 `context` 열에 `⏎`가 들어간 행은 손으로 고친다(예상 0~3건; 개수를 커밋 메시지에 적는다).

- [ ] **Step 3: 린트 실행 — 통과 근거를 눈으로 확인**

```bash
python scripts/verify_sync_markers.py
```
Expected OK 2행: `in-file §Step ref(s)`가 236 → **236 − (A→G 21 + A→B 77) + 0 = 138**로 줄고 `foreign-anchored … OUT OF SCOPE`가 3 → **3 + 98 = 101**; G/B 영역의 `skills/harness/SKILL.md` 자기 앵커(15+2=17)는 in-scope로 남는다(238−... 정확 수는 출력을 적는다). rc=0. 다른 6종도 rc=0.

- [ ] **Step 4: 팀메모리 앵커 2건 무수정 확인 (AC-6)**

```bash
git diff -U0 skills/harness/SKILL.md | grep -c "team-memory"   # 0
```

- [ ] **Step 5: 커밋 (C5-a)**

```bash
git add skills/harness/SKILL.md
git commit -m "refactor(harness): neutralise shared-block wording and path-anchor 126 boundary-crossing §Step citations ahead of the split"
```

---

## Task 3 (C5-b, part 1): 분할 스크립트 — 3파일 생성 + BLOCK 마커

한 번에 실행되는 결정적 스크립트다. **먼저 스크래치 사본에서 돌려 린트 green을 확인한 뒤**(Task 4·5까지 스크래치에서 마친 뒤) 원본에 적용한다.

**Files:**
- Create: `skills/harness-gate/SKILL.md`, `skills/harness-build/SKILL.md`
- Modify: `skills/harness/SKILL.md`
- Create (scratch): `$SCRATCH/split.py`

**Interfaces:**
- Consumes: Task 1의 §Fresh Start 문단, 블록 경계 표.
- Produces: 세 파일. 각 파일의 헤딩 집합(재핀 값의 근거):
  - harness canonical Step ids `{1, 1.5, 2, 2.6}`, subpaths `{(2,INLINE),(2,WORKFLOW)}`
  - gate `{3}`, subpaths `{}`
  - build `{3.5, 3.6, 4, 5, 6, 7, 8}`, subpaths `{(4,INLINE),(4,WORKFLOW),(5,INLINE),(5,WORKFLOW)}`

- [ ] **Step 1: 스크립트 작성** — `$SCRATCH/split.py`. 헤딩 텍스트로 구간을 찾고, 블록 마커를 삽입하고, 세 파일을 조립한다. 아래 `LIT_*`는 Task 4·5의 리터럴을 그대로 넣는다(스크립트 안에 문자열로).

```python
# $SCRATCH/split.py — run from repo root. Idempotent guard: refuses if harness-gate/ exists.
import os, re, sys
ROOT = os.getcwd()
SRC = 'skills/harness/SKILL.md'
if os.path.exists('skills/harness-gate'): sys.exit('already split')
t = open(SRC, encoding='utf-8', newline='').read()
assert '\r' not in t
L = t.split('\n')

def idx(literal, start=0):
    """0-based index of the first line == literal (exact) at/after start."""
    for i in range(start, len(L)):
        if L[i] == literal: return i
    raise SystemExit(f'anchor not found: {literal!r}')
def idx_prefix(prefix, start=0):
    for i in range(start, len(L)):
        if L[i].startswith(prefix): return i
    raise SystemExit(f'prefix not found: {prefix!r}')

# ---- section anchors (0-based) ----
h_rv      = idx('## Sub-agent Return Value Rules (INLINE path only)')
h_ul      = idx('## User Language Detection')
h_olc     = idx('## Output Language Contract')
h_olc_ret = idx('### 1-line Return Translation (INLINE path only)')
h_mg      = idx_prefix('## Mode Gate — ')
h_sr      = idx_prefix('## Session Recovery')
sr_cont   = idx_prefix('Cross-session continuity uses the `state.json` phase machine below.')
sr_65     = idx_prefix('6.5. **docs_path drift check**')
sr_7      = idx_prefix('7. **Resume-suppression check**')
sr_7b     = idx_prefix('   - **(b) docs_path drift**')
sr_other  = idx_prefix('   - Otherwise, ask the user via AskUserQuestion')
sr_jump_pr= idx_prefix('     - `plan_ready` →')
sr_jump_gr= idx_prefix('     - `generate_ready` →')
sr_compl  = idx_prefix('     - `completed` →')
sr_restart= idx_prefix('   - **Restart**:')
sr_nostate= idx_prefix('If `.harness/state.json` does not exist, proceed to this skill')
h_fresh   = idx('### Fresh Start')
h_rs      = idx('## run_style (Execution Mode)')
h_sb      = idx('## Session Boundary')
h_sb_a    = idx_prefix('### Type A — phase-boundary')
sb_a_tbl  = idx_prefix('| Boundary site |')
h_sb_b    = idx_prefix('### Type B — ')
h_sb_hf   = idx('### `/handoff generate` field contract (P0-4)')
h_sa      = idx('## Scale Assessment')
h_sa_c    = idx('### Compute-once / freeze / render-by-reference')
h_sa_1    = idx('### 1. Raw signal counts')
h_sm      = idx('## State Machine')
h_sm_af   = idx('### Auto-fix State Transition Table')
h_ws      = idx('## Workflow Steps')
h_s3      = idx_prefix('### Step 3: HARD GATE #1')
h_s35     = idx('#### Step 3.5: Slice Plan')
h_s4      = idx('### Step 4: Generate Phase')
h_doctor  = idx('## Sub-command: doctor')
h_ms      = idx('## Model Selection')
h_uir     = idx('## User Interaction Rules')
h_ap      = idx('## Architecture Principles')
h_pv      = idx('### Path Validator')
h_kr      = idx('## Key Rules')

def last_nonblank_before(i):
    j = i - 1
    while L[j].strip() == '': j -= 1
    return j

def seg(a, b):            # inclusive 0-based line range -> list of lines
    return L[a:b+1]

def block(tag, copies, body):
    s = f'<!-- BLOCK-START:{tag} v1 — shared by {copies}; edit every copy in one commit and bump the version -->'
    e = f'<!-- BLOCK-END:{tag} v1 -->'
    return [s] + body + [e]

HB  = '/harness, /harness-build'
HGB = '/harness, /harness-gate, /harness-build'
HG  = '/harness, /harness-gate'

B = {}   # tag -> block lines (identical bytes for every copy)
B['hx-preamble-a']        = block('hx-preamble-a', HB,  seg(h_rv, last_nonblank_before(h_ul)))
B['hx-user-lang']         = block('hx-user-lang', HGB,  seg(h_ul, last_nonblank_before(h_olc)))
B['hx-olc-core']          = block('hx-olc-core', HGB,   seg(h_olc, last_nonblank_before(h_olc_ret)))
B['hx-olc-inline-returns']= block('hx-olc-inline-returns', HB, seg(h_olc_ret, last_nonblank_before(h_mg)))
B['hx-preamble-b']        = block('hx-preamble-b', HB,  seg(h_mg, last_nonblank_before(h_sr)))
B['hx-session-entry']     = block('hx-session-entry', HB, seg(sr_cont, last_nonblank_before(sr_65)))
B['hx-session-gate-a']    = block('hx-session-gate-a', HB, seg(sr_7, last_nonblank_before(sr_7b)))
B['hx-session-gate-b']    = block('hx-session-gate-b', HB, seg(sr_other, last_nonblank_before(sr_jump_pr)))
B['hx-session-actions-tail']=block('hx-session-actions-tail', HB, seg(sr_restart, last_nonblank_before(sr_nostate)))
B['hx-run-style']         = block('hx-run-style', HB,   seg(h_rs, last_nonblank_before(idx('---', h_rs))))
B['hx-boundary-shell']    = block('hx-boundary-shell', HB, seg(h_sb_a, last_nonblank_before(sb_a_tbl)))
B['hx-handoff-fields']    = block('hx-handoff-fields', HB, seg(h_sb_hf, last_nonblank_before(idx('---', h_sb_hf))))
B['hx-state-machine']     = block('hx-state-machine', HB, seg(h_sm, last_nonblank_before(h_sm_af)))
B['hx-path-validator']    = block('hx-path-validator', HGB, seg(h_pv, last_nonblank_before(h_kr)))
B['hx-scale-render']      = block('hx-scale-render', HG,  seg(h_sa_1, last_nonblank_before(idx('---', h_sa_1))))
B['hx-model-selection']   = block('hx-model-selection', HB, seg(h_ms, last_nonblank_before(h_uir)))

# ---- literals supplied by Task 4 / Task 5 (verbatim) ----
from lit import (FM_HARNESS, FM_GATE, FM_BUILD, ROLES_HARNESS, ROLES_GATE, ROLES_BUILD,
                 SR_HEAD_BUILD, SR_JUMP_BUILD_OUT_OF_RANGE, SR_COMPLETED_BUILD, SR_NOSTATE_BUILD,
                 FRESH_BUILD, SB_PREAMBLE_HARNESS, SB_PREAMBLE_BUILD, SB_TYPEA_TABLE_HARNESS,
                 SB_TYPEA_TABLE_BUILD, SA_HEADER_HARNESS, SA_HEADER_GATE, ENTRY_CHECK_GATE,
                 ENTRY_BUILD, AP_GATE, AP_BUILD, KR_GATE, KR_BUILD, UIR_COPY, WS_HEAD_GATE, WS_HEAD_BUILD,
                 PLAN_DONE_ROW_HARNESS, REENTRY_FLAGS_HARNESS)

# ---- harness (file A) ----
A  = L[:h_rv]                                        # frontmatter + title + roles (roles replaced below)
A  = FM_HARNESS + ROLES_HARNESS
A += B['hx-preamble-a'] + [''] + B['hx-user-lang'] + [''] + B['hx-olc-core'] + [''] + B['hx-olc-inline-returns'] + [''] + B['hx-preamble-b'] + ['']
A += seg(h_sr, sr_cont-1)                            # SR heading + doctor carve-out + positional args
A += B['hx-session-entry'] + ['']
A += seg(sr_65, sr_7-1)                              # 6.5
A += B['hx-session-gate-a'] + ['']
A += seg(sr_7b, sr_other-1)                          # 7(b)
A += B['hx-session-gate-b'] + ['']
A += seg(sr_jump_pr, sr_jump_pr)                     # plan_ready row (unchanged)
A += PLAN_DONE_ROW_HARNESS                           # replaces planning/plan_done row (Task 5)
A += SR_JUMP_BUILD_OUT_OF_RANGE['harness']           # generate_ready…evaluating → "owned by /harness-build"
A += seg(sr_compl, sr_compl)                         # completed → Step 1 (unchanged wording, Fresh Start)
A += B['hx-session-actions-tail'] + ['']
A += seg(sr_nostate, h_rs-1)                         # no-state line + ### Fresh Start (Task 1)
A += REENTRY_FLAGS_HARNESS                           # --modify / --auto-revise / --critic (Task 5)
A += B['hx-run-style'] + ['', '---', '']
A += [L[h_sb]] + SB_PREAMBLE_HARNESS + [''] + B['hx-boundary-shell'] + [''] + SB_TYPEA_TABLE_HARNESS + ['']
A += seg(h_sb_hf, h_sa-1)[:0]                        # (Type B is build-only; skipped)
A += B['hx-handoff-fields'] + ['', '---', '']
A += seg(idx('> The comparison-operator prohibition below', h_sb_hf), h_sa-1)   # the OUTSIDE note
A += [L[h_sa]] + SA_HEADER_HARNESS + [''] + seg(h_sa_c, h_sa_1-1) + B['hx-scale-render'] + ['', '---', '']
A += B['hx-state-machine'] + ['', '---', '']          # Auto-fix table is build-only
A += seg(h_ws, h_s3-1)                               # ## Workflow Steps + Step 1 … After Plan Phase
A += seg(h_doctor, h_ms-1)                           # doctor
A += B['hx-model-selection'] + [''] + seg(h_uir, h_ap-1)   # UIR (copy, unsynced)
A += seg(h_ap, h_pv-1) + B['hx-path-validator'] + [''] + seg(h_kr, len(L)-1)

# ---- gate (file G) ----
G  = FM_GATE + ROLES_GATE
G += B['hx-user-lang'] + [''] + B['hx-olc-core'] + ['']
G += ENTRY_CHECK_GATE + ['']
G += seg(idx('> The comparison-operator prohibition below', h_sb_hf), h_sa-1)
G += [L[h_sa]] + SA_HEADER_GATE + [''] + B['hx-scale-render'] + ['', '---', '']
G += WS_HEAD_GATE + seg(h_s3, h_s35-1)               # Step 3 only (Pass A / Pass B / Modify Interaction / phase write para — rewritten in Task 5)
G += AP_GATE + B['hx-path-validator'] + [''] + KR_GATE

# ---- build (file B) ----
Bf  = FM_BUILD + ROLES_BUILD
Bf += B['hx-preamble-a'] + [''] + B['hx-user-lang'] + [''] + B['hx-olc-core'] + [''] + B['hx-olc-inline-returns'] + [''] + B['hx-preamble-b'] + ['']
Bf += ENTRY_BUILD + ['']
Bf += SR_HEAD_BUILD + B['hx-session-entry'] + ['']
Bf += B['hx-session-gate-a'] + ['']
Bf += B['hx-session-gate-b'] + ['']
Bf += SR_JUMP_BUILD_OUT_OF_RANGE['build']            # plan_ready/planning/plan_done → owner guidance (Task 5)
Bf += seg(sr_jump_gr, sr_compl-1)                    # generate_ready … evaluating rows (unchanged)
Bf += SR_COMPLETED_BUILD
Bf += B['hx-session-actions-tail'] + ['']
Bf += SR_NOSTATE_BUILD + [''] + FRESH_BUILD + ['']
Bf += B['hx-run-style'] + ['', '---', '']
Bf += [L[h_sb]] + SB_PREAMBLE_BUILD + [''] + B['hx-boundary-shell'] + [''] + SB_TYPEA_TABLE_BUILD + ['']
Bf += seg(h_sb_b, h_sb_hf-1) + B['hx-handoff-fields'] + ['', '---', '']
Bf += B['hx-state-machine'] + [''] + seg(h_sm_af, h_ws-1)
Bf += WS_HEAD_BUILD
s35 = seg(h_s35, h_doctor-1)
s35 = [re.sub(r'^#### (Step 3\.[56])', r'### \1', x) for x in s35]   # promote 3.5/3.6 (no parent Step 3 here)
Bf += s35
Bf += B['hx-model-selection'] + [''] + UIR_COPY + ['']
Bf += AP_BUILD + B['hx-path-validator'] + [''] + KR_BUILD

def w(path, lines):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = '\n'.join(lines)
    if not body.endswith('\n'): body += '\n'
    open(path, 'w', encoding='utf-8', newline='\n').write(body)
w('skills/harness/SKILL.md', A)
w('skills/harness-gate/SKILL.md', G)
w('skills/harness-build/SKILL.md', Bf)
print('harness', len(A), 'gate', len(G), 'build', len(Bf))
```

`lit.py`는 Task 4·5의 리터럴을 파이썬 리스트(행 단위)로 담는 스크래치 모듈이다 — 계획의 리터럴 블록을 그대로 옮긴다.

- [ ] **Step 2: 스크래치 사본에서 실행**

```bash
rm -rf "$SCRATCH/repo" && git worktree add "$SCRATCH/repo" HEAD   # 격리 사본 (읽기 실험용)
cd "$SCRATCH/repo" && cp "$SCRATCH/split.py" "$SCRATCH/lit.py" . && PYTHONIOENCODING=utf-8 python split.py
```
Expected: `harness N gate N gate N` 행 수 출력, `skills/harness-gate/SKILL.md`·`skills/harness-build/SKILL.md` 생성.

- [ ] **Step 3: 블록 바이트 동일성 자체 검증** (린트 등록 전 선행)

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import re,hashlib
files={'h':'skills/harness/SKILL.md','g':'skills/harness-gate/SKILL.md','b':'skills/harness-build/SKILL.md'}
txt={k:open(v,encoding='utf-8').read() for k,v in files.items()}
tags=sorted(set(re.findall(r'BLOCK-START:(hx-[a-z-]+) v1',txt['h'])))
for tag in tags:
    hs={}
    for k,t in txt.items():
        m=re.search(rf'<!--\s*BLOCK-START:{tag} v1.*?-->(.*?)<!--\s*BLOCK-END:{tag} v1\s*-->',t,re.S)
        if m: hs[k]=hashlib.sha256(m.group(1).strip().encode()).hexdigest()[:12]
    print(f"{tag:26s} {len(hs)} copies {'OK' if len(set(hs.values()))==1 else 'DRIFT '+str(hs)}")
print(len(tags),'tags')
PY
```
Expected: 16 tags, 전건 OK (2 또는 3 copies).

- [ ] **Step 4: 위 스크래치에서 Task 4·5·6을 이어서 수행하고 린트 green을 본 뒤에만 원본에 적용** — 원본 적용은 같은 스크립트를 저장소 루트에서 한 번 더 실행(결정적)한다. 스크래치 worktree는 `git worktree remove --force "$SCRATCH/repo"`로 제거.

---

## Task 4 (C5-b, part 2): 파일별 리터럴 — frontmatter·역할·진입·Fresh Start

`lit.py`에 들어갈 리터럴. 전부 영어 원문(계약 문서 관례). `{harness_desc}` 등은 **Task 7의 확정 문안**이 들어갈 자리이나, C5-b 커밋은 예산 통과를 위해 아래 **잠정 문안 그대로** 넣는다(Task 7에서 교체).

**Files:**
- Create (scratch): `$SCRATCH/lit.py`

- [ ] **Step 1: frontmatter 3개**

```markdown
<!-- FM_HARNESS -->
---
name: harness
disallowed-tools: NotebookEdit
description: Entry point of the 3-Phase harness (Plan -> Gate -> Generate -> Verify -> Evaluate) with a read-only `doctor` diagnostic. Runs Setup, Convention Scan, Plan and Plan Critic, writes spec.md, then halts at plan_done and hands off to /harness-gate — the spec-confirmation gate lives in that separate, tool-less skill, and /harness-build implements. Plugin-shipped native Workflow segment scripts on the workflow path (ultracode or --mode opt-in) with schema-validated returns; inline single path otherwise. Use for development AND non-development tasks that benefit from structured planning and 3-layer review. (formerly /workflow)
---
```
```markdown
<!-- FM_GATE -->
---
name: harness-gate
disallowed-tools: Bash, Write, Edit, Glob, NotebookEdit, WebSearch, WebFetch, Task, Agent, Workflow
description: HARD GATE #1 of the /harness pipeline — spec confirmation, and nothing else. Holds no Bash, Write, Edit, Glob or sub-agent tools; it reads .harness/state.json and spec.md, renders the critic status and the Scale Assessment, asks once, and prints the next command (/harness-build, /harness-build --epic, or a /harness re-entry). It writes nothing. Run after /harness reaches plan_done; any other phase is redirected to its owning skill.
---
```
```markdown
<!-- FM_BUILD -->
---
name: harness-build
disallowed-tools: NotebookEdit
description: Implementation half of the /harness pipeline — Slice Plan and Epic Exit, Generate, Verify (Layer 1), Evaluate (Layer 2+3), the Verdict loop and Cleanup. Consumes only a spec.md that /harness-gate has confirmed; `/harness-build --epic` writes slice_plan.md and exits instead of implementing. Same opt-in Workflow segments and inline fallback as /harness. Not an entry point — run /harness first.
---
```

- [ ] **Step 2: 제목·역할 문단 3개** (기존 7–17행을 대체)

```markdown
<!-- ROLES_HARNESS -->
# Agent Harness — /harness Orchestrator (v3, plan half)

You are a **state-machine orchestrator** — the ENTRY POINT of a pipeline split across three
skills that share one `state.json` phase machine:

| Skill | Owns | Tools it does NOT have |
|---|---|---|
| `/harness` (this file) | Step 1 → 1.5 → 2 → 2.6, `spec.md`, the Plan Critic, `doctor` | `NotebookEdit` |
| `/harness-gate` | Step 3 — HARD GATE #1 (spec confirmation) only | `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`, `Workflow` — it can change nothing |
| `/harness-build` | Step 3.5 → 3.6 → 4 → 5 → 6 → 7 → 8 | `NotebookEdit` |

**Every session of this skill ends at `plan_done`** and prints `Next → /harness-gate`. The gate
is a separate user message by construction: the turn that renders it holds no write tool, so
nothing can be implemented before the human confirms the spec (SPEC §1 —
`design/harness-ordering-enforcement/SPEC.md`). `/harness-gate` and `/harness-build` cannot be
prevented from being invoked directly; each detects a missing prerequisite and says so.

Your role is:
1. Manage phase transitions via `state.json` up to `plan_done`
2. Resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped native Workflow segment scripts)
3. On the WORKFLOW path: invoke `Workflow {scriptPath}` and receive **schema-validated objects** — no text parsing
4. On the INLINE path: dispatch sub-agents with minimal context and parse 1-line returns (legacy contract, inline only)
5. Halt at `plan_done` with the next command — HARD GATE #1 is rendered by `/harness-gate`, never here, never inside a segment script

**You do NOT**: read intermediate artifacts (proposals, critiques, plans, reviews), accumulate sub-agent output in context, or make quality judgments about code — the exceptions (including `.harness/planner/proposals.json`'s write and Auto-revise re-entry read) are enumerated exhaustively, and ONLY, in §Architecture Principles #1; this line does not restate them. Sub-agents and segment scripts handle all domain work; you handle transitions and writing `spec.md` from returned objects.
```
```markdown
<!-- ROLES_GATE -->
# Agent Harness — /harness-gate (v3, HARD GATE #1)

You are the **spec-confirmation gate** of the `/harness` pipeline and nothing else. This skill
holds `Read` and `AskUserQuestion` only — no `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`,
`Workflow`. **It writes nothing, deletes nothing, dispatches nothing.** Its whole output is the
gate itself and, after the human chooses, ONE next command for the human to type (§Next
command). `phase` is never written here and is never read as proof that this gate ran
(SPEC decision A) — the human's typed command is the only carrier of the decision.

Pipeline: `/harness` (Steps 1–2.6, ends at `plan_done`) → **this skill** (Step 3) →
`/harness-build` (Steps 3.5–8). See `skills/harness/SKILL.md` §Session Recovery for the full
phase machine; this file only needs §Entry Check below.
```
```markdown
<!-- ROLES_BUILD -->
# Agent Harness — /harness-build (v3, implementation half)

You are a **state-machine orchestrator** for the second half of the `/harness` pipeline:
Step 3.5 → 3.6 → 4 → 5 → 6 → 7 → 8. You are reached by the command `/harness-gate` printed
after the human confirmed `spec.md`; `/harness` (Steps 1–2.6) and `/harness-gate` (Step 3)
own everything before you. Invoking this skill directly, without a confirmed `spec.md`, is
not prevented — §Entry below detects it and redirects.

Your role is:
1. Manage phase transitions via `state.json` from `plan_done` (§Entry) to `completed`
2. Resolve the execution path per §Mode Gate — **INLINE** (dispatch sub-agents directly) or **WORKFLOW** (run plugin-shipped native Workflow segment scripts)
3. On the WORKFLOW path: invoke `Workflow {scriptPath}` and receive **schema-validated objects** — no text parsing
4. On the INLINE path: dispatch sub-agents with minimal context and parse 1-line returns (legacy contract, inline only)
5. Present HARD-GATEs #2 and #3 (verify-fail / auto-fix-apply) to the user — gates are NEVER inside a segment script. HARD GATE #1 belongs to `/harness-gate`.

**You do NOT**: read intermediate artifacts (proposals, critiques, plans, reviews), accumulate sub-agent output in context, or make quality judgments about code — the exceptions are enumerated exhaustively in `skills/harness/SKILL.md` §Architecture Principles #1 (the registry); §Architecture Principles below lists the subset this skill exercises. Sub-agents and segment scripts handle all domain work; you handle transitions, gates, and writing final artifacts (changes.md / slice_plan.md) from returned objects.
```

- [ ] **Step 3: gate §Entry Check (N, SPEC §5.4.5 그대로 + Pass A 리다이렉트 표)** — `ENTRY_CHECK_GATE`

```markdown
## Entry Check (read-only — this skill holds no Bash, Write or Edit; it can delete nothing)

Read `.harness/state.json` with `Read`. Evaluate in order; the first match halts. Every message is
printed per §Output Language Contract (`[harness-gate]` is a Glossary-class prefix — English raw).
**No option is offered at any of the seven points below** — this section contains no
AskUserQuestion: Restart, Stop-and-delete and "Delete and start" are actions this skill cannot
perform, and offering an action one cannot perform is a false promise, not a contract.

1. `.harness/state.json` absent → `[harness-gate] No /harness session here — run /harness "<task>" first.`
2. Parse failure → print the path and the parse error only. (Same rule as `skills/harness/SKILL.md`
   §Session Recovery "View state only" — no partial recovery.)
3. `skill != "harness"` OR `version != "3.0"` → `[harness-gate] Not a /harness v3 session
   (skill: {skill|absent}, version: {version|absent}). This skill cannot delete or repair it —
   run /harness, which renders the Session Conflict gate.`
4. `epic.boundaries != null AND phase == "completed"` → `[harness-gate] Epic session residue —
   run /harness, which offers the recovery options.`
5. `phase != "plan_done"` → `[harness-gate] phase is {phase}; this gate only reads plan_done.
   Owner: /harness for plan_ready|planning, /harness-build for generate_ready…completed.`
6. `validate_path(docs_path, kind=output_dir)` fails (§Path Validator — this skill's own copy)
   → print the validator's halt message and halt. No recovery is offered; that belongs to /harness.
7. Otherwise → restore `user_lang` and `model_config`-independent display fields from state.json
   (`task`, `mode`, `path_resolved`, `docs_path`, `plan_critic.*`, `spec_stamp`, `scale.*`,
   `cli_flags.epic`), then proceed to §Workflow Steps — Step 3. `{docs_path}spec.md` and
   `{docs_path}plan_critic_findings.md` / `critic_findings.md` are read from here on; a missing
   file is detected by the failed `Read` itself (no Glob — SPEC OQ-4 closed).

Never emit a `{...}` token verbatim — substitute from state.json before rendering.

## Next command (the gate's only output after the human chooses)

Every option of Step 3 that used to write state, dispatch a sub-agent, or edit `spec.md` now
ends this turn by printing ONE line the human types next. The mapping is exhaustive over both
passes; a label absent here does not exist in this skill.

| Chosen option | Printed next command | What that skill does with it |
|---|---|---|
| "Proceed as single" / "Proceed" (Pass B) | `/harness-build` | writes `phase → "generate_ready"`, resets `epic.boundaries → null`, runs Step 4 → 8 |
| "Plan as epic" (Pass B) | `/harness-build --epic` | runs §Step 3.5 → §Step 3.6 (slice plan, epic exit) |
| "Modify" (either pass) | `/harness --modify "<the user's change request, quoted>"` | the /harness orchestrator edits `spec.md` under its `spec_stamp` write protocol, then prints `Next → /harness-gate` |
| "Auto-revise" (Pass A row ①-a) | `/harness --auto-revise` | Auto-revise re-entry + a fresh Plan Critic pass, then `Next → /harness-gate` |
| "Run Critic anyway" / "Retry Critic" (Pass A rows ①-b/①-c/②-b/③/④) | `/harness --critic` | a fresh own-critic dispatch (§Step 2.6), then `Next → /harness-gate` |
| "Proceed as-is" (Pass A) | (none — Pass B renders in this same turn) | — |
| "Stop" (either pass) | (none — halt; `.harness/` is left exactly as found) | — |

Print the command in a fenced code block on its own, after one line in `user_lang` that names
the option chosen. **Never execute it, never invoke the other skill from here** — the turn
boundary is the mechanism (SPEC §2.2), and this skill has no tool that could.
```

- [ ] **Step 4: build §Entry (N)** — `ENTRY_BUILD`

```markdown
## Entry (how a `/harness-build` invocation starts)

Evaluate before §Session Recovery below, in order; first match wins.

1. `.harness/state.json` absent → print `[harness-build] No /harness session here — run /harness "<task>" first.` and halt.
2. Positional args or flags other than the ones this skill owns (`--epic`, `generate`, `verify`, `evaluate`, `--mode`, `--model-config`, `--verifier-model`, `--lint-cmd`, `--type-check-cmd`) → print `[harness-build] Unknown argument — this skill takes no task string; the task lives in state.json.` and halt.
3. Otherwise run §Session Recovery below. Its `plan_done` handling is THIS skill's gate-crossing write and is defined here, once — the jump table cites it by name:
   - **`phase == "plan_done"` and `--epic` NOT given** → single write: `phase → "generate_ready"`, `epic.boundaries → null` (clears any boundary answer a prior §Step 3.5 visit recorded — the same reset `/harness-gate`'s "Proceed as single" used to perform), `updated_at → now`. Then Step 4. This is the write `/harness-gate` cannot perform (SPEC §2.3); it proves nothing about the gate having run — the human typing this command is that proof (decision A).
   - **`phase == "plan_done"` and `--epic` given** → hand control to §Step 3.5 (Slice Plan) by name. `phase` stays `plan_done` throughout, exactly as that section's entry contract requires; a non-null `epic.boundaries` is its re-entry path.
   - **`phase == "plan_done"` and `generate|verify|evaluate` given** → §Step Mode Prerequisites decides (spec.md exists → same as the no-flag case; otherwise the error row).
```

- [ ] **Step 5: Session Recovery의 파일별 조각** — `SR_HEAD_BUILD`, `SR_JUMP_BUILD_OUT_OF_RANGE`, `SR_COMPLETED_BUILD`, `SR_NOSTATE_BUILD`, `FRESH_BUILD`

```markdown
<!-- SR_HEAD_BUILD -->
## Session Recovery (state.json v3 phase machine)

No `doctor` carve-out and no positional task argument exist in this skill (`/harness doctor`
and the task string belong to `/harness`). Item 6.5 (docs_path drift) and item 7(b) are
`/harness`-only as well: both need a task string this skill never receives, so they cannot
fire here and are not restated. Everything else below is byte-identical with `/harness`'s
copy (BLOCK-sync).

```
```markdown
<!-- SR_JUMP_BUILD_OUT_OF_RANGE['harness']  (inserted after harness's plan_done row) -->
     - `generate_ready` / `generating` / `generate_done` / `verify_ready` / `verifying` /
       `verify_done` / `evaluate_ready` / `evaluating` / `evaluate_done` → **owned by
       `/harness-build`** — print `[harness] This session is past the gate (phase: {phase}) —
       run /harness-build` (with `verify` / `evaluate` when `phase` is `generate_done` /
       `verify_done`, mirroring §Session Boundary Type A's resume column) and halt. Nothing is
       written.
```
```markdown
<!-- SR_JUMP_BUILD_OUT_OF_RANGE['build']  (build's first jump rows) -->
     - `plan_ready` / `planning` → **owned by `/harness`** — print `[harness-build] Planning is
       not finished (phase: {phase}) — run /harness` and halt. Nothing is written.
     - `plan_done` → §Entry above (this skill's gate-crossing write, or §Step 3.5 with `--epic`).
```
```markdown
<!-- SR_COMPLETED_BUILD -->
     - `completed` → no active session — print `[harness-build] No active session — run
       /harness "<task>" to start one` and halt.
```
```markdown
<!-- SR_NOSTATE_BUILD -->
If `.harness/state.json` does not exist, proceed to this skill's §Fresh Start.
```
```markdown
<!-- FRESH_BUILD -->
### Fresh Start

This skill has no fresh start of its own: with no session to continue, print
`[harness-build] No /harness session here — run /harness "<task>" first.` and halt. Reached
after a Restart / "Delete and start" from the shared §Session Recovery prose above (the
delete itself is performed — this skill holds `Bash` — and then nothing is created).
```

- [ ] **Step 6: Session Boundary 머리말 파일별 (rev.9 (d)) + Type A 표 파일별** — `SB_PREAMBLE_HARNESS`, `SB_PREAMBLE_BUILD`, `SB_TYPEA_TABLE_HARNESS`, `SB_TYPEA_TABLE_BUILD`

```markdown
<!-- SB_PREAMBLE_HARNESS -->

> Single source for the user-facing block printed when a `/harness` session ends. In this skill
> that is exactly ONE site — §After Plan Phase — and it is not optional: every `/harness`
> session ends there (the gate is a separate skill). Type B (task complete) never prints from
> this skill; it belongs to `/harness-build`. Shape + label rules mirror Setup Summary
> (§Output Language Contract — Print Translation Pattern: labels English raw, values per
> Preserved-English Glossary).
```
```markdown
<!-- SB_PREAMBLE_BUILD -->

> Single source for every user-facing block printed when a `/harness-build` session ends.
> Referenced by name (never restated) at: the 3 phase/step-mode phase-boundary sites in
> §Workflow Steps 4/5/6 (After Generate / After Verify / After Evaluate), the Step 5 L1
> max-retry 1st HARD-GATE "Stop" branch, and the end-of-session summary printed by §Step 8's
> 3 commit branches and its `has_git == false` branch, plus §Step 3.6 — which is not one of
> those branches, so it is named separately here; excludes the commit-failure abort path,
> which does not end the session. The After-Plan site is `/harness`'s. Shape + label rules
> mirror Setup Summary (§Output Language Contract — Print Translation Pattern: labels English
> raw, values per Preserved-English Glossary).
```
```markdown
<!-- SB_TYPEA_TABLE_HARNESS -->
| Boundary site | Completed → Next | Resume command |
|---|---|---|
| After Plan (Step 2) — the only Type A site in this skill | Plan → Gate | `/harness-gate` (always — `run_style` no longer changes this: `auto` sessions halt here too, SPEC rev.9 (b)). A `/harness` re-entry (`--modify` / `--auto-revise` / `--critic`) also ends here and prints the same line. |

**Residual (After Plan row):** `/harness-build` typed directly still skips the gate — by
design, not by drift (SPEC §8: an explicit choice, detected and disclosed by that skill's
§Entry, never prevented).
```
```markdown
<!-- SB_TYPEA_TABLE_BUILD -->
| Boundary site | Completed → Next | Resume command |
|---|---|---|
| After Generate (Step 4) | Generate → Verify | `/harness-build verify` |
| After Verify (Step 5) | Verify → Evaluate | `/harness-build evaluate` |
| After Evaluate (Step 6) | Evaluate → Verdict & Loop | `/harness-build` (no args — Session Recovery / no-args next-step rule routes to Step 7) |
| Step 5 L1 max-retry "Stop" (1st HARD-GATE) | Verify (Layer 1) halted | `/harness-build` (no args — §Session Recovery `verify_done` branch re-enters the 1st HARD-GATE directly) |
```

- [ ] **Step 7: Scale Assessment 머리말 2종 (rev.9 (a))** — `SA_HEADER_HARNESS`, `SA_HEADER_GATE`

```markdown
<!-- SA_HEADER_HARNESS -->

> Single source for the scale/slice recommendation block. **(1) compute** — §Step 2 (Plan
> Phase), immediately after the Plan segment/sub-agent completes on BOTH the INLINE and
> WORKFLOW branches, run exactly once per Plan pass and frozen into `state.scale.*`;
> **(2) render** — §After Plan Phase, which EVERY `/harness` session reaches (the gate is a
> separate skill, so there is no `auto` run-through any more); **(3) render** — `/harness-gate`
> §Workflow Steps Step 3 Pass B, in the NEXT session, from the same frozen values. Renders
> (2) and (3) are therefore both expected in one task — the earlier "mutually exclusive per
> session" rule described the unsplit file and is withdrawn (SPEC rev.9 (a)). The render
> fragment below (§1 → §INLINE Fallback) is byte-identical with `/harness-gate`'s copy.
```
```markdown
<!-- SA_HEADER_GATE -->

> **Render-only in this skill.** The four signals, `slice_hint` and `override` were computed
> ONCE by `/harness` §Step 2 and frozen into `state.scale.*`; this skill reads them from
> state.json and never re-derives anything — it has no `PlanResult`, and it must not try to
> rebuild one. **If `state.scale` is missing entirely** (a pre-split session, or one that
> reached `plan_done` without computing it), treat every signal as `absent` and render per
> §INLINE Fallback below — never error, never block the gate on a missing block; the INLINE
> Fallback's one `ok` signal is counted from the `spec.md` this gate already reads (`Read`
> suffices — no Glob). The fragment below is byte-identical with `/harness`'s copy.
```

- [ ] **Step 8: 나머지 소품** — `WS_HEAD_GATE = ['## Workflow Steps', '', '> This skill owns one Step. Steps 1–2.6 are `skills/harness/SKILL.md`; Steps 3.5–8 are `skills/harness-build/SKILL.md`.', '']`, `WS_HEAD_BUILD = ['## Workflow Steps', '', '> Steps 1–2.6 are `skills/harness/SKILL.md`; Step 3 is `skills/harness-gate/SKILL.md`. Steps 3.5 and 3.6 are top-level sections here (they had no parent Step 3 to nest under once the gate moved).', '']`, `UIR_COPY = ['## User Interaction Rules', '', 'See `templates/_shared/askuserquestion.md`.']` (harness 원문 그대로 — 동기화 없는 복제, 공시는 CLAUDE.md).

- [ ] **Step 9: Architecture Principles 부분집합 + Key Rules 부분집합** — `AP_GATE`, `AP_BUILD`, `KR_GATE`, `KR_BUILD`

```markdown
<!-- AP_GATE -->
## Architecture Principles

The registry of invariants is `skills/harness/SKILL.md` §Architecture Principles; this skill
exercises the subset below and nothing beyond it.

1. **Orchestrator reads no intermediate files** — of the registry's 7 read exceptions this skill
   performs **2**: (1) `spec.md` at the plan gate (the line count for the Stale Determination is
   re-read at every Pass A render), and (7) gate-display critic count parsing
   (`plan_critic_findings.md` / `critic_findings.md` `## Summary` line). It performs NO write —
   not `state.json`, not `spec.md`, nothing under `.harness/` (the tool set makes this
   structural, not a rule).
5. **All external paths pass through Path Validator before use** (see §Path Validator below —
   `docs_path` from state.json is validated at §Entry Check 6 before any file under it is read).
6. **Gates never enter segment scripts.** This skill IS the spec-confirm gate (HARD GATE #1 of
   the pipeline's 3); it dispatches no script. The gate renders as up to two sequential passes
   (Pass A, Pass B) inside ONE `<HARD-GATE>` tag — a pass is not a separate gate.

```
```markdown
<!-- AP_BUILD -->
## Architecture Principles

The registry of invariants is `skills/harness/SKILL.md` §Architecture Principles; this skill
exercises the subset below. Numbering follows the registry so a citation such as "#4" means
the same thing in every file.

1. **Orchestrator reads no intermediate files** — of the registry's 7 read exceptions this skill
   performs **3**: (2) qa_report.md at the verdict gate (INLINE path; WORKFLOW path on session
   resume — verdict reconstruction), (3) changes.md path-extraction on WORKFLOW-path resume when
   `workflow_ctx` is null (repo-relative paths only, no content analysis — §Step 5 — WORKFLOW
   path `changedFilesList` source priority), and (4) verify_report.md path (for the user message)
   and failing-file extraction for Auto-fix Proposer dispatch (paths only, Path Validator
   `kind=file_reference`, capped at 5 — §Step 5 Auto-fix dispatch). Writes are a separate
   category: this skill writes `changes.md`, `slice_plan.md`, and — WORKFLOW path only —
   `cold_review.md` from returned objects (the INLINE path's `cold_review.md` is written by the
   cold-review sub-agent itself, §Step 6), plus the Apply-before `--- a/` / `+++ b/` diff header
   lines (2 metadata lines per file — hunk body is delegated to the Edit tool). None of that is
   reading intermediates.
2. **Auto-fix Proposer is the only sub-agent that directly Reads SOURCE files among orchestrator-dispatched agents.** (Segment-script agents explore the codebase themselves by design — they run inside the engine's autonomous span.) Other inline sub-agents receive content only through template variables, with one narrower exception: an inline sub-agent MAY instead receive a `{docs_path}` artifact PATH that the orchestrator explicitly hands it and read that one file itself — distinct from "source files", and it does not enlarge the registry's exception list, which stays at 7 items (AC-27).
3. **Paths only to sub-agents; never file contents** (ephemeral digests passed inside a segment run excepted — they never enter the orchestrator's context beyond `workflow_ctx` storage; `specContent` passed as a Build segment arg (§Step 4 — WORKFLOW path) and as an Eval segment arg (§Step 5 — WORKFLOW path) is also an explicit exception — spec.md content, not a path, crosses into segment `args` because size, not path-vs-content, is the actual constraint).
4. **Session-wide invariants** (see §State Machine — Auto-fix State Transition Table):
   - Auto-fix: at most 1 attempt per session (`verify.autofix_attempted` once-only — not reset on round increment).
   - Layer 1 retries: max 3. Do NOT reset after Auto-fix Apply.
5. **All external paths pass through Path Validator before use** (see §Path Validator below).
6. **Gates never enter segment scripts.** HARD-GATEs #2 (verify-fail) and #3 (auto-fix-apply) are rendered by this orchestrator between segment runs; #1 (spec-confirm) is `/harness-gate`. `scripts/verify_meta_literal.py` guards this at lint time by rejecting gate-marker tokens — the `<HARD-GATE>` tag form, `AskUserQuestion`, and the `Apply patch` option label — inside any segment script. This is a marker-based tripwire, not a proof of gate-freedom: it deliberately does NOT flag the spaced prose form `HARD GATE #N`, which segment scripts legitimately use in comments to note that gates live in the orchestrators.

```
`KR_GATE`: harness §Key Rules에서 gate에 적용되는 행만 — `Confirmation gates are non-negotiable.`(문구 「Gates live ONLY in this orchestrator」→「Gates live in the orchestrators — this skill renders #1」), `User language.`, `Orchestrator reads no intermediate files.`(→ §Architecture Principles above), 그리고 신규 `- **No writes, ever.** This skill has no Bash, Write or Edit; every decision leaves as a printed command (§Next command).`
`KR_BUILD`: harness §Key Rules 전체에서 `Never skip phases.`(epic-exit 예외 문장 유지), `Planner proposals must be independent.` 제거(build에 planner 없음), 나머지 그대로 + `Ad-hoc dispatch` 행의 SYNC-WITH 마커는 **build에도 복제**(adhoc-dispatch `min_sites` 12 → 13 — Task 6에서 반영). **주의**: `- **Never skip phases.** Always Plan → Generate → Verify → Evaluate.` 문장은 build에서 `Always Generate → Verify → Evaluate after a confirmed spec.`로.

---

## Task 5 (C5-b, part 3): 파일별 의미 문면 — plan_done 행, 재진입 플래그, gate Step 3 옵션 결말, run_style

**Files:**
- Modify (scratch → 원본): `skills/harness/SKILL.md`, `skills/harness-gate/SKILL.md`, `skills/harness-build/SKILL.md`

- [ ] **Step 1: harness `planning`/`plan_done` 점프행 재작성 (rev.9 (e))** — `PLAN_DONE_ROW_HARNESS`

```markdown
     - `planning` / `plan_done` → **first check `state.epic.boundaries != null`** (meaningful
       only once `phase == "plan_done"` — that combination cannot exist before the boundary
       Q&A completes, so it is itself a Q&A-completion mark): if true, the slice plan was
       interrupted after the gate — print `[harness] Boundary Q&A already answered — run
       /harness-build --epic` and halt. If `epic.boundaries == null`, apply the §Step 2.6 Plan
       Critic routing predicate (defined there as the single source; the three branches are NOT
       restated here): the branches that run Step 2.6 run it here, in this session; every
       branch then ends at §After Plan Phase, which prints `Next → /harness-gate` and halts.
       **This skill never routes into Step 3** — the gate is `/harness-gate`, a separate skill
       reached only by the human typing it (SPEC §2.2). A resume right after an interrupted
       Auto-revise re-synthesis lands on the gate's Pass A stale row in that next session — see
       `skills/harness-gate/SKILL.md` §Step 3 Pass A.
```

- [ ] **Step 2: harness 재진입 플래그 절 (N)** — `REENTRY_FLAGS_HARNESS`, §Fresh Start 뒤·§run_style 앞

```markdown
### Gate re-entry flags (`--modify` / `--auto-revise` / `--critic`)

`/harness-gate` cannot edit `spec.md`, dispatch a critic, or re-run a Plan pass; each of those
options ends the gate's turn by printing one of the commands below, which THIS skill executes.
All three require `phase == "plan_done"` (any other phase → `[harness] --{flag} needs a
plan_done session (phase: {phase})` and halt) and all three end at §After Plan Phase, printing
`Next → /harness-gate` — the gate re-renders from Pass A in that next session, seeing the
fresh `spec_stamp` / `plan_critic` state (its Modify Interaction contract).

| Flag | Action (this skill's orchestrator) | Writes |
|---|---|---|
| `--modify "<request>"` (VALUE-TAKING — listed in the doctor carve-out's flag list above) | apply the request to `{docs_path}spec.md` under §Step 2's `spec_stamp` write protocol (invalidate → write → stamp); never a dispatched sub-agent (SPEC decision ③) | `spec.md`, `spec_stamp` |
| `--auto-revise` | §Step 2 — WORKFLOW path's Auto-revise re-entry, exactly as Pass A row ①-a used to trigger it, including its same-turn Step 2.6 re-run | as that re-entry |
| `--critic` | §Step 2.6's own-critic dispatch, exactly as "Run Critic anyway" / "Retry Critic" used to trigger it (a fresh single write to `plan_critic`, `source = "own"`; INLINE branch when the recorded failure was a permission denial — `templates/_shared/mode_gate.md` rule 3) | `plan_critic.*` |

`--modify` is added to the VALUE-TAKING list in §Session Recovery's doctor carve-out in the
same change that adds this section — otherwise `/harness --modify doctor` would misfire.
```
그리고 155–156행의 VALUE-TAKING 목록에 `` `--modify` `` 추가, boolean 목록에 `` `--auto-revise`, `--critic` `` 추가.

- [ ] **Step 3: gate Step 3의 옵션 결말 문단 재작성** — gate 파일의 §Workflow Steps Step 3 안에서, 아래 문단들을 §Next command 참조로 바꾼다(각 문단은 `sed -n`으로 원문을 열어 문맥 확인 후 편집):
  - `"Run Critic anyway" / "Retry Critic" (rows …): dispatch §Step 2.6's own-critic dispatch again … row ④ CAN recur …` → `"Run Critic anyway" / "Retry Critic" (rows ①-b / ①-c / ②-b / ③ / ④): end this turn with the \`/harness --critic\` line (§Next command). The fresh dispatch runs in \`/harness\`; the NEXT \`/harness-gate\` session re-presents from Pass A against the fresh \`plan_critic\` state, landing on whichever row now matches (typically ①-a or ②) — row ④ CAN recur if that dispatch itself fails again.` (Exception 문단 ①-c는 유지 — 사실 불변.)
  - `"Auto-revise" (row ①-a only): dispatch §Step 2 WORKFLOW path's Auto-revise re-entry … ` → `"Auto-revise" (row ①-a only): end this turn with the \`/harness --auto-revise\` line (§Next command). The re-entry and its same-turn Step 2.6 re-run happen in \`/harness\`; the next gate session renders a fresh Pass A against the revised spec.md (never a stale badge for a revision Auto-revise itself just produced — \`/harness\` §Step 2.6's write records \`spec_stamp_at_critic\` from the advanced stamp).`
  - `"Modify" (every row): **the orchestrator itself** updates spec.md …` → `"Modify" (every row): end this turn with the \`/harness --modify "<request>"\` line (§Next command) — the \`/harness\` orchestrator itself edits spec.md under its \`spec_stamp\` write protocol, so the edit advances \`spec_stamp.generation\` like any other spec.md write, and the next gate session re-presents from Pass A (see Modify Interaction below).`
  - Pass B 옵션 4개: `→ advances \`phase → "generate_ready"\` — the ONLY option across BOTH passes that advances the phase. Also, if \`epic.boundaries\` …` → `→ end this turn with the \`/harness-build\` line (§Next command). That skill's §Entry performs the \`phase → "generate_ready"\` write and the \`epic.boundaries → null\` reset this gate used to perform — nothing advances here.`; `"Plan as epic" … hand control to §Step 3.5 (Slice Plan), by name …` → `"Plan as epic" / "Split this task via a dedicated Slice Plan" → end this turn with the \`/harness-build --epic\` line (§Next command); §Step 3.5 runs there with \`phase\` still \`plan_done\`.`; Modify → 위와 동일 참조; Stop 불변.
  - `</HARD-GATE>` 뒤 문단 `Update state.json: \`phase → "generate_ready"\` … loop back inside the gate).` 전체 삭제 → 대체: `No state.json write follows this gate. The only thing that leaves it is the printed next command (§Next command); \`/harness-build\` §Entry owns the \`generate_ready\` write.`
  - Modify Interaction 항목 2의 「SAME turn (the ordinary Modify loop)」 → 「a later session (a Modify always crosses two user messages now)」; 항목 3 「even when the edit was made from Pass B's own "Modify"」 유지(참).
  - Pass A 도입부 「§Session Recovery routes here per routing predicate (c)」류 5건은 `\`skills/harness/SKILL.md\` §Session Recovery`로 경로 앵커(비-Step 인용이라 린트 무관, 정확성 목적).
  - Pass B 「Print the \`## Scale Assessment\` block (its Step 3 render site — the other render site is §After Plan Phase; the two are mutually exclusive, see that section's header)」 → 「Print the \`## Scale Assessment\` block (this skill's render site — §Scale Assessment above; the After-Plan render in \`/harness\` already showed the same frozen values last session)」.
  - **AC-13 검증**: `grep -c "AskUserQuestion" skills/harness-gate/SKILL.md` — Step 3 내부 사이트 수를 세고(Pass A·Pass B 각 1 + 「Every AskUserQuestion call in this gate」류 언급) 결과를 커밋 메시지에 적는다; §Entry Check·§Next command 절에서 `grep -n "Restart\|Delete and start\|Stop\b" ` → §Next command 표의 "Stop"(halt 옵션, 삭제 없음) 외 0건.

- [ ] **Step 4: run_style 재작성 (rev.9 (b)) — B2 블록이므로 harness 사본만 고치고 split.py를 재실행**(build 사본은 재실행으로 동일해진다; 원본 적용 후에는 두 사본을 함께 편집)

표:
```markdown
| Style | Behavior | Session end points |
|-------|----------|-------------------|
| `auto` | Automatic progression WITHIN a skill; the Plan → Gate boundary is a skill boundary and always ends the `/harness` session. In `/harness-build`, user gates at evaluate_done(FAIL) only | `plan_done` (`/harness`), `completed` (`/harness-build`) |
| `phase` | Stop at each `*_done` state, resume in next session | `plan_done`, `generate_done`, `verify_done`, `evaluate_done` |
| `step` | Execute only the specified step, then stop | Immediately after step |
```
CLI Parsing 블록은 3스킬 통합표로:
```
/harness "task description"              → auto (default); ends at plan_done → /harness-gate
/harness plan "task description"         → phase mode, plan step (same end point — the two are now equivalent up to the gate)
/harness --mode single "task"            → auto + single mode (inline forced)
/harness --mode multi "task"             → auto + multi mode (workflow path)
/harness --model-config balanced "task"  → auto + balanced preset
/harness plan "task" --epic              → cli_flags.epic=true (§Scale Assessment override); the gate leads with "Plan as epic"
/harness plan "task" --no-epic           → cli_flags.epic=false (§Scale Assessment override)
/harness "task" --no-cold-pass           → cli_flags.cold_pass=false — read by /harness-build §Step 5 "Cold Review Input Collection"
/harness --modify "<request>" | --auto-revise | --critic   → gate re-entry (plan_done only) — §Gate re-entry flags in /harness
/harness doctor                          → read-only diagnostic (/harness only)
/harness-gate                            → HARD GATE #1; prints the next command; writes nothing
/harness-build                           → generate_ready write + Step 4 → 8 (auto within this skill)
/harness-build --epic                    → §Step 3.5 → §Step 3.6 (slice plan, epic exit)
/harness-build generate                  → phase mode, generate step
/harness-build verify                    → step mode, verify only
/harness-build evaluate                  → step mode, evaluate only
```
`When state.json exists and /harness is called with no arguments: → Read phase, suggest next step` → `When state.json exists and \`/harness\` or \`/harness-build\` is called with no arguments: → §Session Recovery routes by phase; a phase owned by the other skill prints that skill's name and halts.`
Step Mode Prerequisites:
```markdown
| Step | Required files | Required phase (minimum) | Missing action |
|------|---------------|-------------------------|----------------|
| `/harness plan` | (none) | (new session OK) | Normal start |
| `/harness-gate` | spec.md | `plan_done` exactly | §Entry Check in that skill redirects to the owner |
| `/harness-build` | spec.md | `plan_done` (performs the `generate_ready` write) or later | Error: "Run /harness first" |
| `/harness-build verify` | changes.md | after `generate_done` | Error: "Run generate first" |
| `/harness-build evaluate` | spec.md + changes.md + verify_report.md | after `verify_done` | Error: "Run verify first" |
```
그리고 `/harness` 재진입 시 「자동 진행」 문장 중 `Step 2 → Step 2.6 → Step 3 without stopping` 류(§After Plan Phase 두 번째 문단 `If run_style == "auto": Continue to Step 3 (Gate) — do NOT render …`)를 삭제하고 §After Plan Phase를 다음으로 바꾼다:

```markdown
#### After Plan Phase

Print: `[harness] Plan complete.`

**Every `run_style`** (auto / phase / step) ends the session here — the gate is `/harness-gate`,
a separate skill (SPEC rev.9 (b): an `auto` session no longer runs Step 2 → 2.6 → 3 without
stopping; the stop is structural). Print the `## Scale Assessment` block (its After-Plan render
site; `/harness-gate` renders the same frozen `state.scale.*` values again at Pass B) using the
values frozen at the end of Step 2. Then print the §Session Boundary block (Type A: After Plan),
whose Resume row is `/harness-gate`. Halt. **If this session carries `cli_flags.epic` or a
§Scale Assessment epic recommendation**, the gate's Pass B leads with "Plan as epic" and prints
`/harness-build --epic`; §Step 3.5 there fills its table with no in-context `PlanResult` — see
`skills/harness-build/SKILL.md` §Step 3.5's degraded restore order, by name.
```
AC-15 검증: `grep -n "MUTUALLY EXCLUSIVE\|mutually exclusive\|without stopping\|Step 2 → Step 2.6 → Step 3" skills/harness*/SKILL.md` → 0건(rev.9 (a)(b) 문장 잔존 없음).

- [ ] **Step 5: 비-Step §인용의 파일별 재조준 (린트 미검사 — 정확성)** — Task 0 Step 2와 같은 방식으로 스크래치에서 목록을 뽑아 각 파일에서 자기 파일에 없는 절을 가리키는 것을 경로 앵커한다. 예상 대상: gate의 `§Session Recovery` 5건(→ §Entry Check 또는 `skills/harness/SKILL.md §Session Recovery`), gate·build의 `§After Plan Phase`, build의 `§Step 2.6 routing predicate` 언급, harness의 `§Session Boundary Type B`(→ build). 실측 목록:

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import re
files={'skills/harness/SKILL.md','skills/harness-gate/SKILL.md','skills/harness-build/SKILL.md'}
heads={f:set(re.sub(r'\s*(?::|\s—\s|—|\(|\|).*$','',h) for h in re.findall(r'^#{1,6}[ \t]+(.*\S)[ \t]*$',open(f,encoding='utf-8').read(),re.M)) for f in files}
SEC=re.compile(r"(?<![`/A-Za-z0-9_.-])§([A-Z][A-Za-z0-9.'’&-]*(?:[ ]+(?!and\b)[A-Za-z0-9][A-Za-z0-9.'’&-]*){0,4})")
for f in files:
    t=open(f,encoding='utf-8').read()
    for m in SEC.finditer(t):
        if m.group(1).startswith('Step '): continue
        pre=t[max(0,m.start()-60):m.start()]
        if re.search(r"SKILL\.md`?\s*$",pre): continue
        core=m.group(1); toks=core.split(' ')
        ok=any(' '.join(toks[:n]) in heads[f] for n in range(len(toks),0,-1))
        if not ok: print(f, t.count('\n',0,m.start())+1, '§'+core)
PY
```
출력의 각 행을 열어 (a) 자기 파일 안 절을 다른 이름으로 부른 것은 정정, (b) 타 파일 절이면 경로 앵커. 결과 건수를 커밋 메시지에 적는다.

---

## Task 6 (C5-b, part 4): 린트 등록 — 블록·섹션 참조·SYNC·예산

**Files:**
- Modify: `scripts/verify_block_sync.py`, `scripts/verify_sync_markers.py`, `scripts/verify_description_budget.py`, `skills/handoff/SKILL.md`, `workflows/_reference/schemas.md`

- [ ] **Step 1: `verify_block_sync.py` GROUPS**

```python
HX_HB  = ["skills/harness/SKILL.md", "skills/harness-build/SKILL.md"]
HX_HGB = ["skills/harness/SKILL.md", "skills/harness-gate/SKILL.md", "skills/harness-build/SKILL.md"]
HX_HG  = ["skills/harness/SKILL.md", "skills/harness-gate/SKILL.md"]

GROUPS: list[tuple[str, str, list[str], str | None]] = [
    ("spec-context-block", "v1", PLANNERS, "templates/_shared/spec_context_block.md"),
    ("input-trust-model", "v2", PLANNERS, "templates/_shared/input_trust_model.md"),
    # harness-ordering-enforcement C5 (SPEC §5.4.4, rev.10): the /harness split keeps the
    # operative contracts byte-identical across the skill copies. shared_source is None —
    # the /harness copy is the canonical one; no fourth copy exists under templates/.
    ("hx-preamble-a", "v1", HX_HB, None),
    ("hx-user-lang", "v1", HX_HGB, None),
    ("hx-olc-core", "v1", HX_HGB, None),
    ("hx-olc-inline-returns", "v1", HX_HB, None),
    ("hx-preamble-b", "v1", HX_HB, None),
    ("hx-session-entry", "v1", HX_HB, None),
    ("hx-session-gate-a", "v1", HX_HB, None),
    ("hx-session-gate-b", "v1", HX_HB, None),
    ("hx-session-actions-tail", "v1", HX_HB, None),
    ("hx-run-style", "v1", HX_HB, None),
    ("hx-boundary-shell", "v1", HX_HB, None),
    ("hx-handoff-fields", "v1", HX_HB, None),
    ("hx-state-machine", "v1", HX_HB, None),
    ("hx-path-validator", "v1", HX_HGB, None),
    ("hx-scale-render", "v1", HX_HG, None),
    ("hx-model-selection", "v1", HX_HB, None),
]
```
docstring `Groups:` 목록에 한 줄 추가: `  - hx-* (v1)              : 16 groups across skills/harness{,-gate,-build}/SKILL.md, no shared source (harness copy is canonical) — see design/harness-ordering-enforcement/SPEC.md §5.4.4`.

Run: `python scripts/verify_block_sync.py` → `OK [hx-…]` 16행 + 기존 2행, rc=0.

- [ ] **Step 2: `verify_sync_markers.py` SECTION_REF_TARGETS + 재핀**

```python
HARNESS_STEP_IDS = {"1", "1.5", "2", "2.6"}  # 4 -- Steps 3 (gate) and 3.5-8 (build) left this file in C5
HARNESS_SUBPATHS = {("2", "INLINE"), ("2", "WORKFLOW")}  # 2
HARNESS_FILES = {"skills/harness/SKILL.md"}
HARNESS_MIN_CROSS_FILES = 7   # re-measure at C5 (harness-gate and harness-build both point here; expected >= 9)
HARNESS_NON_HEADING_ANCHORS = {
    "Conventions injection rule": "**Conventions injection rule (used by Step 2):**",
}
GATE_STEP_IDS = {"3"}
GATE_SUBPATHS: set[tuple[str, str]] = set()
GATE_FILES = {"skills/harness-gate/SKILL.md"}
GATE_MIN_CROSS_FILES = 2      # skills/harness/SKILL.md + skills/harness-build/SKILL.md (measured at C5)
BUILD_STEP_IDS = {"3.5", "3.6", "4", "5", "6", "7", "8"}
BUILD_SUBPATHS = {("4", "INLINE"), ("4", "WORKFLOW"), ("5", "INLINE"), ("5", "WORKFLOW")}
BUILD_FILES = {"skills/harness-build/SKILL.md"}
BUILD_MIN_CROSS_FILES = 3     # harness, harness-gate, handoff (measured at C5)
```
`SECTION_REF_TARGETS`에 두 엔트리 추가(`mode: "harness-steps"`, 다섯 키 전부, `non_heading_anchors: {}`). **`min_cross_files`는 실측값으로 재핀** — 린트를 한 번 돌려 `N file(s) carry a path-anchored … §pointer` 실패 메시지 또는 OK 라인의 수를 읽고 그 값을 적는다(제로 슬랙).

- [ ] **Step 3: SYNC_GROUPS 갱신**
  - `handoff-state-record`: `"min_sites": 3` + 주석 `# skills/handoff/SKILL.md (self) + skills/harness/SKILL.md + skills/harness-build/SKILL.md (hx-handoff-fields copy, C5)`.
  - `slice-command-format`: `"target_file": "skills/harness-build/SKILL.md"`, 주석의 경로 3곳 갱신; `min_sites` 2 유지(self + handoff).
  - `session-conflict`: `"min_sites": 8` + 주석 한 줄 `# C5: +1 -- the hx-session-entry BLOCK copy in skills/harness-build/SKILL.md carries the marker too`.
  - `adhoc-dispatch`: `"min_sites": 13` + 주석 `# C5: +1 -- skills/harness-build/SKILL.md §Key Rules`.
  - `ambiguity-prompt`/`project-defaults`: 마커가 Step 1 안(729·731행)이라 harness 잔류 — **불변**. 확인: `grep -c "§Ambiguity Prompt -->" skills/harness-build/SKILL.md` → 0.
  - 실측: OK 라인 `9 sync group(s), 53 marker site(s)` — 다른 수면 그 수로 floor를 맞추고 SPEC rev.10 4번 항목을 정정.

- [ ] **Step 4: 외부 인용 재조준**
  - `skills/handoff/SKILL.md` 88·90·673행: `skills/harness/SKILL.md` §Step 3.5: Slice Plan → `skills/harness-build/SKILL.md` §Step 3.5: Slice Plan (마커 90행 포함).
  - `workflows/_reference/schemas.md` 202행: `> \`skills/harness/SKILL.md\` §Step 3 and §Step 3.5 read \`scale.slice_hint\`.` → `> \`skills/harness-gate/SKILL.md\` §Step 3 and \`skills/harness-build/SKILL.md\` §Step 3.5 read \`scale.slice_hint\`.`
  - `skills/handoff/SKILL.md` 352행(§Session Boundary field contract)과 `skills/spec/SKILL.md` 115행(§Session Recovery item 1), `skills/deep-review/SKILL.md` 253·444행(§Path Validator): harness 잔류 절 → **불변**.

- [ ] **Step 5: `verify_description_budget.py`** — `PER_SKILL_CEILING`에 `"harness-gate": <측정>, "harness-build": <측정>` 추가, `"harness": <측정>`으로 상향, `TOTAL_CEILING = <측정 합>`; 각 항목 주석 `# at this commit (C5); …`. 측정은 린트 자체가 출력한다: 먼저 임의 큰 값으로 돌려 `chars` 열을 읽고 그 값으로 제로 슬랙 재고정. `LOWER_BOUND`에 `"harness": 400`(기존 470의 85%)을 추가해 분할이 진입점 설명을 비우는 것을 막는다. docstring의 `C2 RE-FIX BLOCK` 아래에 `C5 RE-FIX` 주석 3줄.

- [ ] **Step 6: `verify_sync_markers.py` docstring 갱신** — `§What this does not check` 1(수치 재측정: 세 파일 각각의 in-file/checked/unchecked, 명령으로), 5(PIN-FILES 한 디렉터리 글롭: 「이제 세 엔트리가 각자 자기 디렉터리를 핀한다 — 형제 디렉터리 분할은 여전히 서로 보이지 않는다」), 그리고 22–32행 「TWO entries」→「FOUR entries (one anchor-heading, three harness-steps)」. `§FIGURE PROVENANCE` 주석의 명령을 세 파일에 대해 돌리도록 갱신.

- [ ] **Step 7: 린트 7종 전부 rc=0 → 원본 적용 → 재실행 → 커밋 (C5-b)**

```bash
# in scratch worktree first; then in the real tree: python "$SCRATCH/split.py" && (apply the same edits — Task 5/6 are file edits, replay them from the scratch diff: git -C "$SCRATCH/repo" diff > "$SCRATCH/c5b.patch"; git apply --check "$SCRATCH/c5b.patch" && git apply "$SCRATCH/c5b.patch")
python scripts/verify_sync_markers.py && python scripts/verify_manifest_sync.py && python scripts/verify_meta_literal.py && python scripts/verify_block_sync.py && node scripts/check_workflow_syntax.mjs && python scripts/verify_description_budget.py && bash .github/scripts/check_lint_wiring.sh
git ls-files --eol skills/harness/SKILL.md skills/harness-gate/SKILL.md skills/harness-build/SKILL.md   # w/lf everywhere
git add skills/harness/SKILL.md skills/harness-gate/SKILL.md skills/harness-build/SKILL.md scripts/verify_block_sync.py scripts/verify_sync_markers.py scripts/verify_description_budget.py skills/handoff/SKILL.md workflows/_reference/schemas.md
git commit -m "feat(harness): split /harness into /harness, /harness-gate and /harness-build — the gate skill holds no Bash, Write, Edit or Glob"
```
커밋 본문에 OK 라인 전문(세 타깃 각 2행 + sync 1행 + block 18행 + budget 1행)과 Task 2·5의 건수를 적는다.

- [ ] **Step 8: AC 직접 확인 (커밋 메시지에 기록)**
  - AC-7/AC-14: `sed -n '1,4p' skills/harness-gate/SKILL.md` — `disallowed-tools:` 행에 `Bash`, `Write`, `Edit`, `Glob` 이름 형식.
  - AC-13: `grep -c "AskUserQuestion" skills/harness-gate/SKILL.md`(값 기록) + `awk '/^## Entry Check/,/^## Workflow Steps/' skills/harness-gate/SKILL.md | grep -c "Restart\|Delete and start"` → 0.
  - AC-6: `git diff develop -- skills/harness/SKILL.md | grep "team-memory"` → 0행.
  - AC-15: Task 5 Step 4의 grep → 0.

---

## Task 7 (C5-c / C6): description 확정 + 문서 동기화

**Files:**
- Modify: `skills/harness/SKILL.md`·`skills/harness-gate/SKILL.md`·`skills/harness-build/SKILL.md` frontmatter(필요 시), `scripts/verify_description_budget.py`, `README.md`, `CHANGELOG.md`, `ROADMAP.md`, `CLAUDE.md`, `design/harness-ordering-enforcement/SPEC.md`(AC 충족 표기)

- [ ] **Step 1: description 길이 확정** — Task 4 잠정 문안을 `verify_description_budget.py` 출력으로 측정. SPEC §7.2 목표(harness ~520 / gate ~330 / build ~420, 합 ≤ ~1,270)를 넘으면 문장을 줄인다(트리거 신호 유지: harness = 「Plan/Gate/Generate/Verify/Evaluate」+「/harness-gate」+「(formerly /workflow)」+「doctor」; gate = 「HARD GATE」+「writes nothing」+「no Bash, Write, Edit」; build = 「Generate/Verify/Evaluate」+「confirmed spec.md」+「--epic」+「slice_plan.md」). 세 항목의 ceiling과 `TOTAL_CEILING`을 확정치로 재고정(라쳇 관례: 같은 커밋). `POV_ALLOWLIST` 불변(세 문안 모두 3인칭 — `grep -inw "you\|your\|we\|our" `로 확인).

- [ ] **Step 2: README** — §Skills 표의 Harness 행을 3행으로(`/harness <task>` plan half · `/harness-gate` · `/harness-build`), 「Your First Task in 5 Minutes」의 흐름을 `/harness` → `/harness-gate` → `/harness-build` 3메시지로, 216–217행 「run `/harness` with no arguments … re-enters at the step you left」→「the skill that owns that phase re-enters it; a phase past the gate is `/harness-build`」. §Repository Layout 불변(`skills/<name>/SKILL.md` 일반 행). 71–78행의 SKILL.md 크기 표는 **기준 릴리스 커밋 기준 수치**라 불변(그 표의 성격상 커밋에 고정).

- [ ] **Step 3: CHANGELOG `## [Unreleased]`** — `### Changed`에 한 항목:

```markdown
- **`/harness` is now three skills, and the spec-confirmation gate has no write tool.**
  `skills/harness/SKILL.md` (Steps 1–2.6, ends every session at `plan_done`), `skills/harness-gate/SKILL.md`
  (Step 3 only — `disallowed-tools` removes `Bash`, `Write`, `Edit`, `Glob`, `Task`, `Agent`, `Workflow`,
  so the turn that renders HARD GATE #1 cannot modify a file or run a command) and
  `skills/harness-build/SKILL.md` (Steps 3.5–8). The gate's options print the next command for the
  human to type (`/harness-build`, `/harness-build --epic`, `/harness --modify|--auto-revise|--critic`);
  `phase → "generate_ready"` is written by `/harness-build` on entry and is never read as proof the
  gate ran. Operative contracts the skills share are byte-identical BLOCK-sync copies (16 `hx-*`
  groups, `verify_block_sync.py`); `verify_sync_markers.py` now pins all three files. A task costs
  three user messages minimum (`/harness` → `/harness-gate` → `/harness-build`) and a Modify two more.
  Design record: `design/harness-ordering-enforcement/SPEC.md` (rev.10) and `PLAN-c5.md`.
```

- [ ] **Step 4: ROADMAP W7 행 append** — `**C5 landed <sha> — the split is real; verdict for the spike row itself is superseded by the epic's own record (SPEC §9 AC-5·6·7·12·13·14·15 met; AC-8 live probe pending).**`

- [ ] **Step 5: CLAUDE.md** — §Project Overview「17 skills」→「19 skills」; §Architecture 표에 `skills/harness{,-gate,-build}/SKILL.md` 한 행(「one contract split three ways; `hx-*` BLOCK groups keep the shared parts byte-identical」); §Verification의 `SECTION_REF_TARGETS` 문장을 「four entries under two modes」로, 「four pins」문장을 「pins per entry」로; §Important Notes의 「`/harness`'s 3 HARD-GATEs … must stay in `skills/harness/SKILL.md`」→「HARD GATE #1 lives in `skills/harness-gate/SKILL.md`, #2/#3 in `skills/harness-build/SKILL.md`; `verify_meta_literal.py` still rejects gate tokens inside segment scripts」; 「§Architecture Principles #3·#5·#6 (1,474 B) and §User Interaction Rules are duplicated WITHOUT a sync group — disclosed here, blocked the day they drift」 한 줄.

- [ ] **Step 6: SPEC §9 AC 표에 충족 표기** (AC-5·6·7·12·13·14·15 각 `(**충족** — C5 <sha>)`; AC-8·AC-10은 미충족으로 남김), §6 C5·C6 행에 「완료」.

- [ ] **Step 7: 린트 → 커밋 → 머지**

```bash
python scripts/verify_sync_markers.py && python scripts/verify_manifest_sync.py && python scripts/verify_meta_literal.py && python scripts/verify_block_sync.py && node scripts/check_workflow_syntax.mjs && python scripts/verify_description_budget.py && bash .github/scripts/check_lint_wiring.sh
git add skills/harness/SKILL.md skills/harness-gate/SKILL.md skills/harness-build/SKILL.md scripts/verify_description_budget.py README.md CHANGELOG.md ROADMAP.md CLAUDE.md design/harness-ordering-enforcement/SPEC.md
git commit -m "docs(harness,harness-gate,harness-build): final descriptions, budget re-fix and repository docs for the three-way split"
git switch develop && git merge --no-ff harness/c5-three-way-split -m "Merge branch 'harness/c5-three-way-split' into develop"
```

---

## Task 8: 라이브 프로브 (AC-8) — 별도 세션

플러그인 설치본 2사본(`~/.claude/plugins/marketplaces/agent-harness-marketplace/`, `~/.claude/plugins/cache/agent-harness-marketplace/agent-harness/<version>/`)을 동기화하고 `exit` 후 `claude`를 재실행한 새 세션에서(`/clear`·`--resume`으로는 반영되지 않는다):

1. 임시 저장소에서 `/harness --mode single "add a greet(name) function with a test"` → `plan_done`에서 `Next → /harness-gate` 출력 확인.
2. `/harness-gate` → Pass A/B 렌더, "Proceed" 선택 → `/harness-build` 한 줄 출력; **같은 턴에서 `Bash` 호출을 시도**(예: 사용자가 「그 턴 안에서 `git status`를 실행해」) → `No such tool available` 확인(AC-8). `.harness/state.json`의 mtime·해시가 그 턴 전후로 불변 확인.
3. `/harness-build` → `phase == generate_ready` 쓰기 후 Step 4 진행 확인.
4. 결과를 SPEC §9 AC-8 행과 `PROBE-FINDINGS.md`에 기록.

---

## Self-review (계획 작성자 체크 — 완료)

- **Spec coverage**: §2.1 도구 계약(Task 4 frontmatter) / §2.2 매핑(Task 4 Step 3 + rev.10 3행) / §2.3 phase 강등·generate_ready 이전(Task 4 Step 4, Task 5 Step 3) / §4 Modify(Task 5 Step 2) / §5.4.2~5.4.4 배분(Task 3 표 + split.py) / §5.4.5 Entry Check(Task 4 Step 3) / rev.9 (a)(b)(c)(d)(e)(Task 5 Step 4, Task 1 Step 1, Task 4 Step 6, Task 5 Step 1) / §6 커밋 단위(Task 0·2·6·7) / §7 예산(Task 6 Step 5, Task 7 Step 1) / §9 AC-5·6·7·12·13·14·15(Task 6 Step 8) / AC-8(Task 8) / AC-11(Task 7 Step 3·4). **갭**: `harness-build`의 §Session Boundary Type B 「Handoff : Run `/handoff generate`」는 불변이나, `/handoff generate`가 `.harness/state.json`의 `skill`을 읽어 `Skill : harness`를 적는다 — build가 쓰는 state.json의 `skill` 값은 그대로 `"harness"`다(세 스킬이 한 세션을 공유하므로 **`skill` 필드는 바꾸지 않는다** — §Version & Compatibility의 v3 정의 `skill: "harness"`가 세 파일 B2 블록에 그대로 있다). 이 결정을 Task 4 Step 4의 §Entry 문단 끝에 한 줄로 명시한다: `The \`skill\` field stays \`"harness"\` — one session, three skills; \`/handoff\` and the Session Conflict table read that value unchanged.`
- **Placeholder scan**: `<측정>`·`<sha>`는 실행 시점에만 존재하는 값(제로 슬랙 라쳇·커밋 sha)이라 계획이 미리 적을 수 없는 것이며, 각 자리에 그 값을 얻는 명령을 붙였다. 그 외 TBD 없음.
- **Name consistency**: `hx-*` 16 tag는 Task 3 표·split.py·Task 6 Step 1이 동일; `§Fresh Start`·`§Entry Check`·`§Next command`·`§Entry`·`§Gate re-entry flags` 명칭은 Task 1·4·5 전체에서 동일; 플래그 `--modify`/`--auto-revise`/`--critic`은 Task 0·4·5 동일.

---

## 실행 기록 (2026-09-07)

계획대로 실행했고, 계획과 달라진 것만 적는다.

- **커밋 4개** (`harness/c5-three-way-split`): C5-0 `2b0cd3d`(계획+rev.10) → C5-a `e77515e`(제자리 중립화 + 126건 앵커) → C5-b `231e2f5`(분할·등록·문면) → C5-c(설명 확정 + 문서). 각 커밋 린트 7종 rc=0.
- **C5-b는 Task 3~6을 한 커밋**으로 냈다 — 분할 뒤의 파일이 각각 자기 모순 없이 서게 하려면 진입 검사·리다이렉트·plan_done 행이 분할과 같은 커밋이어야 했다. 재현은 `task5.py → task5b.py → split.py → register.py` 순서(스크래치 worktree와 실제 트리가 바이트 동일).
- **Task 5 Step 5의 비-Step 인용**은 린트 미검사라 "정확성 목적"으로만 잡았는데, 실측 19곳이 실제로 타 파일 절을 가리키고 있었다(gate의 §Session Recovery 5곳, 공유 블록의 §Session Boundary Type B·§Standard Status Format·§Scale Assessment 등). 전건 경로 앵커.
- **블록 안의 §Step 인용에 두 번째 앵커 규칙이 필요했다**: 공유 블록이 harness 소유 Step(1/1.5/2/2.6)을 인용하면 build/gate 사본에서 layer 4가 FAIL한다. `split.py`가 블록 본문의 그런 인용에 `skills/harness/SKILL.md` 앵커를 자동으로 붙인다(자기 파일 앵커는 in-scope로 그대로 검사되므로 harness 쪽 의미는 불변). Type B·Auto-fix 표처럼 O-build이면서 원래 A 영역에 있던 조각도 같은 처리.
- **SYNC 마커 사이트 54** (rev.10의 53이 아니라) — build §Key Rules의 `adhoc-dispatch` 마커를 rev.10이 세지 않았다. SPEC AC-5 행에 정정.
- **AC-13의 `grep -c AskUserQuestion`은 5** — `<HARD-GATE>` 태그 안 사이트는 1, 나머지 4는 산문 언급. AC 행에 그 분해를 적었다.
- **description에 `: `가 들어가 YAML 스칼라 검사에 걸렸다**(harness·gate) — em dash로 교체. 확정 길이 555 / 401 / 379, `TOTAL_CEILING` 7,706.
- **Task 8(AC-8 라이브 프로브)은 미실행** — 설치본 동기화 + 새 프로세스가 필요해 별도 세션.
