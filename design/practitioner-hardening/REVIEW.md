> 2026-09-29 실무자 관점 적대 리뷰 기록 (29-에이전트 Workflow `wf_c54c3b1d-632`: 8렌즈 → 렌즈별 사실검증+설계의도 옹호 → 3방향 설계 → 판정).
> 행 번호는 develop `2a60a30` 시점 스냅샷이다 — 현재 위치는 §섹션명으로 다시 찾을 것. 평점은 판정 에이전트의 주관 점수다.
> 후속 실행 문서: `STAGE1.md`.
> **후속 (2026-11-13):** 8절 로드맵의 순서는 `design/v9-subtraction/SPEC.md` 8.1절이 바꿨다. 이 보고서의 결함 id(C1, M1~M17)와 그 문서 부록 A의 번호(H/K/W) 사이에 대응표는 없다. 유지 스킬에 남은 항목은 부록 A에 새 번호로 다시 실려 있다.

# agent-harness 실무 적합성 최종 판정 보고서

## 1. 한 줄 결론과 종합 평점

**결론: 핵심 루프(Layer 1 기계 검증 + 격리 Evaluator, /debug 검증 스키마, /handoff drift 검증)에는 대체재가 없는 가치가 있습니다. 그러나 일반 실무 저장소에 그대로 쓰기에는 아직 위험하고 불편합니다. 커밋 안 된 WIP를 지우는 git 조작이 여러 스킬에 있고, 행동 검증이 전혀 없으며, 표면이 과도합니다. 결함 대부분은 국소 수정으로 고칠 수 있으므로 개선은 "가능"합니다.**

| 축 | 점수 | 근거 요약 |
|---|---|---|
| 효과성 | **5 / 10** | 고유 가치가 있는 곳은 4개 지점뿐입니다. 19개 스킬 중 6개는 호출 0회이고, 대부분의 나머지도 3회 이하입니다. |
| 편의성 | **3 / 10** | 작은 수정에도 명령 3개와 질문 4~6회가 필요합니다. 스킬 목록 항목은 34개입니다. `--fast`는 README 옵션 표 안에 숨어 있고, Install 절은 166행에 있습니다. |
| 신뢰성 | **3 / 10** | test-gen, auto-fix, md-optimize, migrate Rollback의 git 조작이 WIP를 훼손합니다. lint는 문서 정합성만 검사하므로, 잘린 스킬 설명이 green으로 출하된 상태입니다. |

**직접 재확인한 핵심 주장 (읽기 전용)**

- `skills/harness-gate/SKILL.md` frontmatter의 description은 인용부호가 없습니다(`description: HARD GATE #1 of ...`). 공백 뒤 `#`를 주석으로 해석하면 원문 401자가 `'HARD GATE'` 9자로 잘립니다. 반면 `python scripts/verify_description_budget.py`는 `OK: 19 skills, total 7706 chars ... ceiling 7706, slack 0`을 출력합니다.
- `skills/test-gen/SKILL.md` 68행의 "with git it reverts via `git checkout -- <source>`"와 456행의 "If dirty → force-revert with `git checkout -- <source>`"를 확인했습니다. 같은 파일에서 `git status`/`uncommitted`/`porcelain`을 grep하면 사전 검사 문구가 0건입니다(414행 1건은 무관한 문장).
- `skills/harness-build/SKILL.md` 754행과 `skills/refactor/SKILL.md` 398행은 Auto-fix 스냅샷을 `git stash`로 만듭니다.
- "Commit code only (Recommended)"라는 같은 라벨이 스킬마다 반대로 동작합니다. `harness-build` 984행은 "commit code + spec/QA evidence"이고, `refactor` 514·519행과 `migrate` 511·516행은 "Clean up artifacts ... then commit code changes only"입니다.
- `skills/ship/SKILL.md` 86행은 `pom.xml | <version> (first)`이고, 356행은 "Replace `{current_version}` with `{release_version}` (string replace)"입니다.
- `/spec` §Phase 3 675·689행은 `--output-dir docs/harness/<slug>/`가 "matches `/spec`'s `docs_path` exactly"라고 주장합니다. 그러나 `skills/harness/SKILL.md` 194행은 `docs_path = output_base + "/" + <slug> + "/"`로 slug를 한 번 더 붙입니다. 문면상 경로가 중첩됩니다.
- `skills/md-optimize/SKILL.md` 37행은 미커밋 상태에서 "Continue"를 허용하고, 115행은 실패 시 "Run `git checkout -- .` to restore all files"라고 안내합니다.
- `skills/migrate/SKILL.md` 499행의 Rollback은 `git checkout <original_branch>` → `git branch -D harness/migrate-<slug>`만 수행하고 변경을 되돌리는 단계가 없습니다. 검증자가 추가로 지적한 항목이며 이번에 확인했습니다.

## 2. 실무자 관점 총평

실무 개발자가 이 플러그인에서 실제로 얻는 것은 네 가지입니다. 구현자와 분리된 격리 Evaluator와 Layer 1 자동 재시도, `/debug`의 "가설마다 실행 가능한 검증"을 강제하는 스키마(`Hypothesis.verification minItems: 1`), `/handoff resume`의 FORWARD/BACKWARD/DIVERGED drift 검증, 그리고 도구 없는 게이트 턴(`disallowed-tools`)으로 스펙 승인을 구조적으로 강제하는 설계입니다. 이 넷은 plan mode, 내장 `/code-review`, superpowers에 없는 기능입니다.

INLINE 기본값과 엔진 실패 시의 무오류 폴백, commit-first/delete-later 순서, 파괴적 동작의 halt 기본값, 불확실성을 정직하게 공시하는 문화도 강점입니다.

문제는 이 가치가 이 저장소 전용 전제 위에 서 있다는 점입니다. `docs/`가 gitignore되어 있고, 기준 브랜치가 main이며, `npm test`/`pytest`를 쓰고, 작업 트리가 깨끗하고, 버전 문자열이 하나뿐이라는 전제입니다. 그래서 Spring 멀티모듈, pnpm 모노레포, WIP가 있는 기능 브랜치처럼 가장 흔한 실무 조건에서 곧바로 흔들립니다.

특히 "방금 쓴 코드에 테스트를 붙인다"는 `/test-gen`의 대표 용례에서 커밋 안 된 코드가 사라질 수 있습니다. 이 한 가지 결함만으로도 채택을 막을 수준입니다.

사용성도 무겁습니다. null 체크 하나를 고치는 데 명령 3개, 질문 4~6회, 서브에이전트 최대 10개가 들고, 유일한 단축 경로인 `--fast`는 Quick Start에 나오지 않습니다. 오케스트레이터 컨텍스트에는 계약만으로 약 197KB(조건부 템플릿을 포함하면 상한 약 309KB)가 실립니다.

검증 계층은 "문서끼리 맞다"만 증명합니다. 그래서 설치본 WORKFLOW 전면 폴백(v8.14 이전), 그리고 지금도 남아 있는 게이트 설명 절단 같은 결함이 lint green 상태로 출하되었습니다.

## 3. 확정 결함 표

심각도는 fact와 advocate 판정을 반영해 확정했습니다. 중복된 발견은 하나로 묶었습니다.

### Critical

| id | 심각도 | 제목 | 근거 | 실무 시나리오 |
|---|---|---|---|---|
| C1 (L3-01·L5-01·L7-01) | critical | test-gen의 mutation 원복이 `git checkout -- <source>`(HEAD 기준)여서 대상 파일의 미커밋 수정을 지웁니다. 사전 dirty-tree 검사도 없습니다. | `skills/test-gen/SKILL.md` §Mode Gate `has_git` note(68행), §Phase 3 WORKFLOW step 3a·4(450·456행), §Step 1 Setup(검사 0건) | 커밋 전인 `OrderService.java`에 `/test-gen`을 돌리면 첫 변이를 원복하는 순간 작성 중이던 코드가 사라집니다. 커밋된 적이 없으므로 reflog로도 복구할 수 없습니다. |

### Major

| id | 심각도 | 제목 | 근거 | 실무 시나리오 |
|---|---|---|---|---|
| M1 (L3-02·L7-05) | major | Auto-fix 스냅샷이 인자 없는 `git stash`라서 미커밋 구현 전체가 작업 트리에서 빠집니다. 성공 경로에는 pop이 없습니다. | `skills/harness-build/SKILL.md` §Step 5 "If 'Apply patch'" 1(754행), `skills/refactor/SKILL.md` §Step 4-S 2.d(398행) | 패치가 HEAD 트리에 적용되어 절반만 남은 코드로 재검증됩니다. 구현은 `stash@{0}`에 방치됩니다(복구는 가능). |
| M2 (L6-02) | major | md-optimize가 미커밋 상태에서 진행을 허용한 뒤, 실패하면 저장소 전체를 되돌리는 `git checkout -- .`를 안내합니다. | `skills/md-optimize/SKILL.md` §1a 2번(37행), §Phase 3 머리말(115행) | 안내를 그대로 따르면 반나절 분량의 무관한 코드 변경이 사라집니다. 새로 만든 split 파일은 고아로 남습니다. |
| M3 (검증자 추가·재확인) | major | migrate의 "Rollback"이 실제로는 되돌리지 않습니다. 브랜치를 전환하고 삭제만 하므로 미커밋 변경이 원래 브랜치로 따라옵니다. | `skills/migrate/SKILL.md` §Step 6 Rollback(494·499행) | 롤백을 골랐는데 pom/package.json 버전 변경과 API 치환이 원래 브랜치의 WIP와 섞입니다. |
| M4 (L6-01) | major (최상위) | /ship이 JSON 플러그인 매니페스트 외에는 파일 전역 문자열 치환을 하고, pom은 첫 `<version>`(parent)을 현재 버전으로 봅니다. | `skills/ship/SKILL.md` §Version Detection(86행), §Step 2 Pass 2(356행) | Spring Initializr 프로젝트에서 spring-boot-starter-parent 버전이 조용히 올라가고, Node에서는 `^1.2.0` 의존성 범위가 함께 바뀝니다. 커밋 게이트는 `--stat`만 보여줍니다. |
| M5 (L3-03·L2-08) | major | /harness 등 쓰기 스킬의 Setup에 dirty-tree 검사와 base_branch 기록이 없습니다. 스테이징 범위도 정의되지 않았고 abort 명령도 없습니다. | `skills/harness/SKILL.md` §Step 1 item 8, `harness-build` §Cold Review Input Collection·§Step 8 "Stage the code changes" | feature 브랜치의 WIP가 harness 브랜치로 따라오고, cold review·evaluator 판정과 AI 커밋에 섞입니다. 중간에 그만두면 정리는 전부 수동입니다. |
| M6 (L1-04·L5-03·L6-03) | major | 대표 흐름인 `/spec → /harness` 인계가 깨져 있습니다. `--output-dir`의 의미가 두 스킬에서 다르고(중첩), 승인된 spec.md를 planner가 덮어쓰며, 이어받은 Critic 수치는 덮어쓰기 전 문서에 대한 것입니다. | `skills/spec/SKILL.md` §Phase 3(675·689행), `skills/harness/SKILL.md` §Step 1 item 7(194행)·§Step 2·§Step 2.6 | PM과 3라운드 합의한 spec이 사라지고 두 번 승인해야 합니다. conventions, qa_notes, critic_findings는 조용히 무시됩니다(라이브 미검증, 문면 확정). |
| M7 (L2-02·L1-10·L7-02·L7-04) | major | test/build 명령은 루트 7행 표로 고정되어 있고 덮어쓸 수단이 없습니다. Layer 1에는 기존 실패 기준선이 없습니다. migrate에는 의존성 동기화 단계가 없습니다. | `templates/_shared/detection_table.md`, `project_defaults.md`(키: lint·type-check만), `templates/verify/verify_layer1.md` §Failure criteria, `migrate` §Step 4a→4b | Poetry/pnpm/Gradle 멀티모듈에서 엉뚱한 명령이 실행되고, 기존 실패 때문에 게이트 없이 3회 재시도가 헛돕니다. JS/Python 마이그레이션은 옛 node_modules나 venv로 거짓 통과합니다. |
| M8 (L1-11·L2-11·L3-07·L7-07·L6-08) | major | 산출물 위생 문제입니다. 같은 "Commit code only" 라벨이 harness-build에서는 spec/QA 문서 8개를 커밋하고 refactor/migrate에서는 docs를 삭제합니다. 사용자 저장소용 gitignore 안내도 없습니다. | `harness-build` 984행, `refactor` 514·519행, `migrate` 511·516행, `templates/_shared/safety_guard.md` "docs/ is git-ignored" 단정 | 팀 PR에 `docs/harness/<slug>/qa_report.md` 등이 매번 딸려갑니다. 또는 리뷰 근거 문서가 사라집니다. `git add -A` 한 번에 `.harness/`가 커밋됩니다. |
| M9 (L2-01·L2-04·L1-07·L2-05·L2-03·L2-06) | major | 작은 작업에 대한 마찰이 큽니다. 트리아지가 없고, `--fast`는 Quick Start에 없으며, `--quick`과 `--mode quick`이 반대로 동작합니다. Fast Gate는 spec 본문을 보여주지 않고, ultracode 미확인이면 multi가 권장되며, 재진입마다 Resume 질문이 뜹니다. | `skills/harness/SKILL.md` §Fast Gate·§Mode Gate 표, `templates/_shared/mode_gate.md` §Ambiguity Prompt 4·6, README §Quick Start 244행 | null 체크 하나에 명령 3개와 질문 4~6회가 듭니다. 권장값을 따르면 가장 비싼 multi 경로를 탑니다. `--fast` 사용자는 완료 기준의 "개수"만 보고 승인합니다. |
| M10 (L2-07) | major | 한국어 태스크의 slug가 `null`/`api`/`task-<ts>`로 무너지고, docs_path 충돌 검사도 없습니다. | `templates/_shared/slugify.md` 규칙 2·"does not guarantee uniqueness", `harness` §Step 1 item 7 | 여러 태스크의 산출물이 `docs/harness/api/`에 섞입니다. 과거 critic_findings가 새 태스크의 Critic을 건너뛰게 만들고, 이전 cold_review.md가 새 커밋에 스테이징됩니다. |
| M11 (L1-02·L1-03·L5-05) | major | Workflow segment 15개가 스킬 목록에 노출됩니다(`harness.build` 대 `harness-build`). 설명 예산 lint는 segment 3,594자를 세지 않아, 실제 노출량 약 11,300자가 8,000자 fallback을 넘습니다. | 이 세션의 스킬 목록, `workflows/*.workflow.js` meta.description, `scripts/verify_description_budget.py` 출력 | 다른 플러그인과 함께 설치하면 설명이 조용히 탈락할 수 있습니다(창 크기에 따라 다름). 유사한 이름이 혼동을 부릅니다. gate 우회는 자연어 인자에서 JSON.parse 예외가 나므로 실질 위험은 낮습니다. |
| M12 (L5-04·L1-12) | major | planner/generator/evaluator 템플릿이 서브에이전트 안에서 키워드로 찾은 설치 스킬을 호출하라고 지시합니다. 대상에는 brainstorming(HARD-GATE와 커밋 포함), "plan"(자기 segment와 일치), "code-review"(폐기 스텁과 일치)가 있습니다. | `templates/planner/planner_single.md` 63·65행, `generator_single.md` 19~21행, `evaluator_prompt.md` 52·99행 | superpowers를 함께 설치한 환경에서는 계획 품질이 설치 조합에 따라 달라집니다. 설계 문서가 harness 브랜치에 커밋될 수 있고, 격리 Evaluator가 다른 리뷰 파이프라인을 호출할 수 있습니다(동작은 추론). |
| M13 (L3-05·L8-01·L8-02·L1-01) | major (근본 원인) | 행동 검증이 없습니다. lint는 토큰 공존만 증명합니다. 그 결과 설치본 WORKFLOW 전면 폴백이 v8.13까지 출하되었고(v8.14에서 수정), 게이트 설명 절단은 지금도 출하 중입니다. 라이브 프로브는 모두 자기 저장소의 문서 편집이었습니다. | `scripts/check_workflow_syntax.mjs` "Compile only — never invoked", `design/harness-prompt-diet/PROBE.md` §Fifth probe Findings 1, `git ls-files`에 test·fixture 0개 | 플러그인을 업데이트할 때마다 사용자가 첫 관측자가 됩니다. C1, M1, M3 같은 git 조작 결함은 원리적으로 lint로 잡을 수 없습니다. |
| M14 (L4-01·L4-04·L4-06·L6-10·L4-03) | major | 계약 비대 문제입니다. /harness 트리오는 SKILL 197KB에 템플릿 상한 약 112KB가 더해집니다. README의 "~8-15K tokens"는 틀렸습니다. 본문에 날짜가 붙은 측정·이력 서사가 섞여 있고, content를 싣는 args가 프로브에서 이행되지 않았습니다. 게이트 #2·#3은 1,089줄 중 700행대에 있습니다. | `wc -c`(197,115B), README 366행, `design/harness-prompt-diet/PROBE.md` 6회차 Findings 3, ROADMAP L34·L124 | 대형 작업을 한 대화에서 진행하면 auto-compact가 일찍 일어나고, 호출당 고정비가 큽니다(compact 이후 규칙 유실은 추론). |
| M15 (L6-04·L6-05·L6-09) | major | /ship의 브랜치·changelog·태그 모델이 이 저장소 전제입니다. main에서 실행하면 리뷰 diff가 비고, CC 전용 초안 템플릿에는 Uncategorized 절이 없으며, `@`나 `/` 태그와 CalVer는 거부됩니다. | `skills/ship/SKILL.md` §Step 1 2·5번, §Step 3, §6b·6c, `templates/ship/code_review_summary.md` 16행 | GitHub flow 팀은 빈 검토를 받습니다. 비CC 팀의 changelog는 비어 나옵니다. pnpm·Go 모노레포에서는 태그 단계를 쓸 수 없습니다. |
| M16 (L7-03) | major | test-gen이 mutation 판정을 부풀립니다. strengthen한 테스트를 원본에서 재검증하지 않고, 컴파일 실패도 caught로 셉니다. JUnit scoped 명령이 없습니다. | `test-gen` §INLINE step 4, WORKFLOW 3b, §Phase 1 2번 | Java에서 타입이 맞지 않는 변이가 "MEANINGFUL"로 집계됩니다. 원본 코드에서도 실패하는 테스트가 커밋될 수 있습니다. |
| M17 (L1-06·L8-07) | major | 문서가 현재 상태를 알려주지 못합니다. README 상단은 유지보수자용 측정표이고 Install은 166행에 있으며, "largest skill"과 `## workflow` 절 제목은 낡았습니다. ROADMAP은 append-only라 105행이 15,980자이고, 이미 출하된 기능이 "no-go"로 표시되어 있습니다. README Roadmap은 v8.7에서 멈춰 있습니다. | README 80~113·166·364행, ROADMAP.md 3·105행 | 도입을 검토하는 팀 리드가 틀린 비용 수치와 stale 상태를 보고 오판합니다. |

### Minor 요약

- **온보딩과 표면** (L1-05, L1-08, L1-09, L7-09, L5-02): 상황별 스킬 선택표가 없습니다. 내부 용어가 노출되고 모드 어휘가 4종입니다. README 653·1203행의 "non-opted → 자동 single/quick"은 실제 동작과 모순됩니다. 폐기 스텁이 노출되고, plan mode와의 비교가 없습니다.
- **세션과 브랜치** (L3-04, L7-08, L2-09, L2-10): 디렉터리당 state 슬롯이 하나라서, /debug가 남긴 state 때문에 다음 스킬에서 Session Conflict가 뜹니다. /debug는 진단만 해도 브랜치를 전환합니다. 병행 작업 안내가 없고, Convention Scan은 매번 반복됩니다.
- **게이트와 진단** (L3-06, L3-08, L3-09, L3-10): 폴백 배너가 원인을 구분하지 않습니다. 게이트 우회는 결정 A로 문서화되어 있지만 README가 과장합니다. doctor의 범위가 좁고, 업데이트 후 재시작 안내가 없습니다.
- **비용 세부** (L4-02, L4-05, L4-07~L4-11, L7-12): 본문 크기 ratchet이 없습니다. study의 args 주석이 21.8KB입니다. WORKFLOW 절이 항상 실립니다. mode_gate.md의 관측 일지는 13개 스킬이 읽습니다. design/ 경로에 루트가 없고 감사 태그가 남아 있습니다.
- **보조 스킬** (L5-06~L5-12, L6-06, L6-07, L6-11, L6-12, L7-06, L7-10, L7-11): 뼈대가 반복되고 내장 기능과 겹칩니다. team-memory는 읽는 소비자가 없습니다. md-optimize는 로드되지 않는 .md까지 절감률에 넣습니다. ship에는 dry-run이 없고 `--prerelease`가 빠져 있습니다. deep-review 브랜치 대상은 `main...`으로 고정입니다. study에 사설 저장소명(3종, 이름은 여기 재기재하지 않음)이 노출되어 있습니다(재확인함). codebase-audit와 study는 `target/`을 제외하지 않습니다.
- **유지보수 구조** (L8-03~L8-06, L8-08~L8-12): 수기 미러 47개가 lint 밖에 있습니다. 메타 커밋 비중이 높습니다. zero-slack 핀, 버스 팩터 1, gitignored 근거 인용이 있습니다. 모두 기여자 비용이며 사용자 세션에 주는 영향은 작습니다.
- **검증자 추가 지적 중 주목할 것:**
  - refactor의 "Stash first"에 pop 안내가 없습니다.
  - refactor와 migrate의 커밋이 WIP를 쓸어 담습니다.
  - /ship DAG에서 version_bump가 build_verify보다 앞에 있고, 실패해도 복원하지 않습니다.
  - `pylint {scope}`가 "(no limit)"으로 치환될 수 있습니다. `detection_table.md` 28행에서 `pylint {scope}`를 확인했고, 치환 규칙은 없습니다.
  - harness-gate 205행이 design/을 "gitignored"로 잘못 표기합니다.
  - SemVer build metadata(`+`)를 거부합니다.

## 4. 반박되거나 하향된 주장

사실검증에서 전면 반박(REFUTED)된 주장은 0건입니다. 다만 다음은 과장이었거나 심각도를 낮췄습니다.

- **critical에서 major로 하향**
  - L2-01: `--fast`가 존재합니다. 빠진 것은 트리아지와 안내입니다.
  - L2-02: Gradle 테스트가 "8배"라는 주장은 증분 빌드를 감안하면 성립하지 않습니다. HARD GATE #2의 Continue라는 탈출구도 있습니다.
  - L4-01: 309KB는 조건부 템플릿을 모두 더한 상한입니다. plan_done 경계 블록은 존재합니다.
  - L6-01: Version 게이트와 Pass 1 위치 목록이라는 사람 확인 지점이 2개 있습니다.
  - L6-02: 스킬이 직접 실행하지 않는 "안내"입니다.
  - L8-01: WORKFLOW 폴백은 v8.14에서 수정되었고 거부는 1회 관측입니다. 다만 게이트 설명 절단이 현재진행형이라 근본 원인으로서는 유효합니다.
- **gate 우회 주장** (L1-02, L5-05): 자연어 인자는 `JSON.parse` 예외로 즉시 실패합니다. 실제 문제는 목록 잡음과 불친절한 실패입니다.
- **"HARD GATE 무력"** (L3-08): SPEC 결정 A와 `harness` SKILL.md 122행에 의도된 잔여 위험으로 공시되어 있습니다. 결함은 README 121·444행의 과장입니다.
- **"조용한 강등"** (L3-06): 배너와 보고서의 Mode·Path 행으로 공시됩니다. 결함은 원인 오진과 mode_gate rule 3의 "silently" 모순입니다.
- **"plan mode 재발명"** (L5-02): Evaluator, 재시도, 재개라는 추가 가치가 있습니다. 문제는 포지셔닝입니다.
- **"같은 뼈대 재구현"** (L5-06): 공통부는 이미 `templates/_shared/`로 추출되어 있습니다. 문제는 사용자 경험의 비일관성입니다.
- **"deep-review 대부분 중복"** (L5-07): 중복은 quick 모드에 한정됩니다.
- **ship과 git flow** (L5-09): release→main 병합은 정상입니다. §Stage 6.5는 develop→main을 지원합니다.
- **수치 오류**
  - L5-11: 설명이 가장 긴 스킬은 study가 아니라 deep-review(668자)입니다.
  - L5-12: 분할 후 비용이 "늘었다"는 틀렸습니다. 197,115B는 211,235B보다 작습니다.
  - L1-08: 해당 description은 9개가 아니라 7개입니다.
  - L8-03: 해당 템플릿은 22개가 아니라 33개(`user_lang` 언급 전무 16개)입니다.
  - L4-08: 인용 범위가 "harness 3개 스킬"이 아니라 13개 스킬이므로 오히려 영향이 더 넓습니다.
- **ship Path B** (L6-04): "승인 1회로 main 병합"은 틀렸습니다. HARD-GATE 3개를 거칩니다.
- **md-optimize 압축 범위** (L6-06): "docs 본문 압축"은 틀렸습니다. 압축은 CLAUDE.md에만 적용됩니다.
- **deep-review** (L7-06): `--staged`와 커밋 범위 지정이 있고, PR 대상은 실제 base를 씁니다.
- **debug_report 부재** (L7-08): 그 라우팅은 Phase 3에서만 제시되므로 해당 시나리오는 성립하지 않습니다.
- **study "절반이 이력"** (L7-10): 문장 기준 약 12%, 날짜가 붙은 문단 기준 최대 33%입니다.
- **메타 커밋 43.6%** (L8-05): 9월 "메타" 커밋 상당수는 치명 결함을 찾아낸 라이브 프로브 기록입니다. 이는 행동 검증에 해당합니다.
- **L4-03**: 게이트 태그 뒤 약 200줄은 대부분 판정 규칙이고, 근거 서술은 약 40줄입니다.
- **L4-07**: Type B와 harness-build의 Session Recovery는 기본 경로에 속하므로, 쓰이지 않는 비율은 약 22%입니다.
- **L2-09**: 상태 블록의 `Task :` 줄로 이전 태스크가 보이므로 "조용히 무시"는 아닙니다.
- **기여자 비용** (L8-06, L8-08~L8-11): 플러그인 사용자 세션에는 영향이 없습니다.

## 5. 실사용 증거와 함의

사용자 1인의 트랜스크립트 3,672개(약 2.3GB, 마지막 활동 2026-09-29)를 집계했습니다.

- **handoff가 압도적입니다.** 이벤트 149건, 세션 97개이며, 외부 프로젝트 8곳에서 쓰였습니다.
- **harness 트리오**는 이벤트 기준 47/22/15건, 세션 기준 22/15/8개입니다. 외부 사용은 외부 프로젝트 한 곳(worktree 계열)에 몰려 있습니다.
- **호출 0회인 스킬이 6개입니다**: spec, deep-review, codebase-audit, md-generate, md-optimize, study.
- debug, refactor, migrate, test-gen, team-memory, ship은 각각 3회 이하이고 대부분 이 저장소 안에서만 쓰였습니다.
- 같은 사용자가 Workflow 도구를 직접 250회 호출했고 superpowers 스킬도 약 48건 썼습니다.
- 마찰 신호는 낮습니다. 중단이 약 5%, 부정 어휘가 6건이었고, 스킬 결함 탓이라고 단정할 수 없습니다.

**함의**

1. 제품 가치는 사실상 handoff와 harness 트리오에 있습니다. 개선 투자도 여기에 집중해야 합니다.
2. critical·major 결함의 상당수(C1, M2, M3, M4, M15, M16)는 거의 쓰이지 않는 스킬에 있습니다. 지금 사용자는 거의 피해를 보지 않았지만, 새 설치자가 처음 써 볼 때 사고가 날 가능성은 높습니다. "잘 안 쓰니 방치"가 아니라 "안전하게 만들거나 기본 설치에서 빼기"를 결정해야 합니다.
3. 추론이지만, 세션 수가 22 → 15 → 8로 줄어드는 것은 계획까지는 하지만 빌드까지 가지 않는 이탈을 시사합니다. 마찰(M9)이나 게이트 수정 왕복이 원인일 수 있으나 이번 측정으로는 확인하지 못했습니다.
4. 데이터가 1인의 것이고 완주율과 결과 품질을 측정하지 않았으므로 일반 실무자에게 일반화할 수 없습니다. 이 사실 자체가 M13(행동 검증과 외부 조건 관측 부재)을 뒷받침합니다.

## 6. 개선 가능성 판단

**판단: 가능.** 다만 "확실하게 쓸 수 있다"는 보증 수준은 행동 검증을 도입하기 전까지 **부분 가능**입니다.

이유는 다음과 같습니다.

- **안전과 정확성 결함은 대부분 국소적입니다.** C1, M1~M8, M10, M12는 모두 특정 SKILL.md 문단이나 공유 템플릿 몇 줄의 문제이고, 아키텍처 결함이 아닙니다. 올바른 선례도 저장소 안에 이미 있습니다. team-memory §Step 1.5(e)의 checkout/stash/restore 금지와 check-ignore 재검증, refactor §Step 1.7의 `baseline_failures`, `.claude-plugin/*.json` 전용 키 경로 편집, no-git 경로의 `.harness/autofix_pre_apply/` 복사가 그 예입니다. 이 선례를 확산하면 됩니다.
- **확장 수단이 갖춰져 있습니다.** `templates/_shared/` 단일 소스, `agent-harness-defaults:` 키 체계, ratchet lint 방식이 있으므로 새 규칙과 키를 기존 틀에 넣을 수 있습니다.
- **"확실하게"에는 새 계층이 필요합니다.** lint로는 원리적으로 잡을 수 없는 결함 클래스가 있습니다. 행동 스모크(stub 엔진)와 fixture 저장소 eval 없이 문서만 고치면, 같은 클래스의 결함(게이트 설명 절단이 그 예)이 다시 green으로 출하됩니다. 여기에는 토큰 비용과 운영 규율이 듭니다.
- **표면 축소는 비용이 큽니다.** 스킬 통폐합은 semver MAJOR 변경이고, zero-slack 핀과 SYNC 바닥값 재설계를 동반합니다. 바로 해야 할 일은 아닙니다.

## 7. 3개 개선 방향 채점과 선택 이유

채점 기준: 실무 효과는 높을수록 좋고, 비용은 **높을수록 저렴**하며, 리스크는 **높을수록 안전**합니다. 각 10점 만점입니다.

| 방향 | 실무 효과 | 비용 | 리스크 | 합계 | 한줄평 |
|---|---|---|---|---|---|
| A. 4주 패치 트랙(아키텍처 동결, 안전·표면·설정 가능화) | 8 | 8 | 8 | **24** | critical과 major 대부분을 기존 단일 소스와 defaults 체계 안에서 S~M 노력으로 해결합니다. 재발 방지는 약합니다. |
| B. 핵심 7개로 축소 + 공통 코어 | 8 | 3 | 4 | 15 | 표면 문제를 근본적으로 풀지만, MAJOR 호환 파괴·L 규모 작업이 여럿이고 lint 관례도 뒤집어야 합니다. 안전 수정보다 먼저 하면 위험합니다. |
| C. 신뢰성 우선(행동 검증 계층 + git 안전 lint) | 7 | 4 | 6 | 17 | 재발 방지는 가장 강합니다. 그러나 헤드리스 eval의 비용(시나리오당 수십만 토큰)과 구축 시간 때문에 사용자 체감 개선이 늦게 옵니다. |

**선택: A를 뼈대로 삼고 C와 B의 좋은 아이디어를 접붙입니다.**

- **A를 고른 이유**: 실사용이 집중된 경로(harness 트리오)와 데이터 손실 결함을 가장 빨리, 가장 싸게 고칩니다. 도구 없는 게이트, Evaluator, Mode Gate 같은 검증된 강점도 건드리지 않습니다.
- **C에서 가져올 것**
  - `verify_git_safety.py` 금지 lint(S): 비용은 적고, C1과 M1~M3 클래스의 재유입을 구조적으로 차단합니다.
  - stub 엔진 segment 러너(M)
  - 원인별 `fallback_reason`
  - 릴리스 게이트용 fixture eval: 3단계로 미룹니다.
  - Fast Gate의 spec 요약 출력
  - `--from-spec`의 해시 기반 carried_over
- **B에서 가져올 것**
  - `.harness/`가 스스로를 무시하게 만드는 산출물 루트 아이디어(`.harness/.gitignore`에 `*`): 사용자 .gitignore를 건드리지 않아도 됩니다. A의 check-ignore 게이트와 함께 비교 검토합니다.
  - 모드 어휘 통일
  - deep-review quick 모드를 내장 `/code-review`로 위임
  - "현재 상태 문서" 관례
  - 실사용 데이터에 근거한 labs 분리: 3단계의 결정 게이트로 둡니다.
- **A 자체의 수정점**
  - dirty-tree 게이트의 "Stash first"는 ref를 기록하고 종료 시 복원 안내를 반드시 함께 둡니다. 가능하면 B처럼 stash를 제안하지 않는 편을 우선합니다.
  - UNDETERMINED일 때 권장을 뒤집는 변경은 설계 결정을 문서로 남긴 뒤 적용합니다.

## 8. 권장 로드맵

### 1단계: 즉시 (1주, 데이터 손실과 첫 접촉 결함)

| 항목 | 노력 | 해결 id |
|---|---|---|
| 롤백과 스냅샷을 바이트 사본 방식으로 통일합니다. `templates/_shared/`에 "롤백 규칙"을 승격하고(team-memory §1.5(e) 원문 기반), test-gen 68·450·456행, harness-build 754행, refactor 398행을 이 인용으로 교체합니다. test-gen에는 `active_mutation` 기록과 Session Recovery 시 선복원을 추가합니다. | M | C1, M1 |
| md-optimize 115행의 복구 안내를 "대상 .md 백업 후 그 파일만 복원 + split 파일 삭제"로 바꿉니다. migrate 499행 Rollback에 스냅샷·`git restore -- <changes.md 목록>` 복원을 선행시킵니다. refactor "Stash first"에는 ref 기록과 pop 안내를 추가합니다. | S | M2, M3 |
| `scripts/verify_git_safety.py`(stdlib)를 신설합니다. `git checkout -- `, 인자 없는 `git stash`, `git checkout -- .`, `reset --hard`, `clean -f`를 금지하고 사유가 필수인 allowlist를 둡니다. lint.yml과 check_lint_wiring에 배선합니다. | S | C1, M1~M3, M13 |
| harness-gate description을 따옴표로 감쌉니다. 예산 lint에 plain scalar의 ` #` 절단 검사와 segment description 합산을 추가합니다. | S | M11, M13(L1-01) |
| segment 15개의 meta.description을 "INTERNAL — launched by /<skill> only" 한 줄로 줄이고, 필수 args 가드(throw)를 넣습니다. | S | M11 |
| /ship version_bump를 키 경로 편집으로 통일합니다(pom은 parent 제외). Pass 1에 줄 단위 diff를 보여주고, `--prerelease`를 복구하고, changelog에 Documentation·Other 절을 추가하고, `last_tag`를 명시합니다. | M | M4, M15(일부), L6-12 |
| 서브에이전트 템플릿의 키워드 스킬 호출 지시를 삭제합니다(정확한 이름의 허용 목록만 옵트인으로 남김). TPL_ 사본도 같은 커밋에서 수정합니다. | S | M12 |
| study의 사설 저장소명과 경로 3건을 일반 예시로 교체합니다. | S | L7-10(보강) |
| README 즉시 정정: Quick Start 244행 "no mode roundtrip", 653·1203행, 366행 "~8-15K", "largest skill" 현재형, `## workflow` 제목, 121·444행 게이트 과장, lint 배지 옆 "문서 정합성 lint — 동작 테스트 아님" | S | M17, M9(일부), L3-08, L8-03 |

### 2단계: 2~4주 (실무 저장소 적합성)

| 항목 | 노력 | 해결 id |
|---|---|---|
| 공유 dirty-tree 게이트를 추가합니다(refactor §1.4를 승격). `base_branch`, `base_sha`, `pre_dirty_paths`를 기록하고, 스테이징을 "changes.md − pre_dirty"로 한정하고, `/harness abort`를 추가합니다. | M | M5, 검증자 추가(refactor/migrate WIP 혼입) |
| 산출물 위생: check-ignore 게이트(`.git/info/exclude` 권장) 또는 `.harness/out/` 자기 무시 루트 중 하나를 선택합니다. "Commit code only"는 모든 스킬에서 "코드만, 문서는 디스크 보존"으로 통일하고 "Commit code + spec/QA docs"를 따로 둡니다. safety_guard의 단정 문구는 조건부로 바꿉니다. | M | M8 |
| `test-cmd`/`build-cmd`/`branch-prefix`/`branch=current\|new`/`base-branch` defaults 키와 플래그를 추가합니다. lockfile 감지(pnpm, yarn, poetry, uv, mvnw)를 넣고, test-gen에 Maven 행을 추가하고, debug의 인라인 표를 단일 소스로 교체하고, `pylint {scope}` 치환 규칙을 명시합니다. | M | M7, L2-11, L7-08 |
| /harness Layer 1에 `baseline_failures`를 도입합니다(`--no-baseline`으로 끌 수 있게). migrate에는 dependency sync 하위 단계를 추가합니다. | M | M7 |
| `/harness --from-spec <path>`: docs_path를 그대로 쓰고, 원본을 `spec.source.md`로 보존하고, carried_over는 해시가 같을 때만 인정하고, 게이트에서 원본과의 변경 요약을 보여줍니다. 라이브 프로브 1회로 확인합니다. | M | M6 |
| slug가 붕괴하면(단일 토큰 또는 8자 미만) 접미사를 붙이고, docs_path 충돌 검사(`-2`)를 추가합니다. | S | M10 |
| 작은 작업 경로: Fast Gate에 spec 요약 15줄을 출력하고, UNDETERMINED일 때는 권장 표시를 붙이지 않고, non-fast 소형 작업이면 `--fast` 힌트를 출력하고, `--quick` 폐기를 예고합니다. README Quick Start와 결정표(10행)도 정비합니다. | S | M9, L1-05 |
| completed 상태의 타 스킬 세션을 자동으로 정리하고, /debug의 모든 종료 분기에서 cleanup을 수행하고, 브랜치 생성은 Fix 시점으로 미룹니다. /harness 재진입 시 Resume 질문을 억제하고, 새 task가 무시될 때 경고합니다. | S | L3-04, L7-08, L2-06, L2-09 |
| test-gen 판정 교정(compile_error 제외, strengthen 후 원본 재검증, JUnit 매핑). deep-review 브랜치 대상은 `--base`/`origin/HEAD`, 무인자는 `git diff HEAD`로 바꿉니다. | S | M16, L7-06 |
| /ship: build_verify를 bump보다 앞으로 옮기거나 실패 시 복원합니다. base 감지는 `origin/HEAD`를 우선합니다. `tag-format` 키를 추가합니다. `--dry-run`을 추가합니다. | M | M15, L6-12, 검증자 추가(DAG) |
| README 재배치: Install → Updating(재시작 필요) → 프로젝트에 남는 파일 → 결정표 → `--fast` 첫 실행. 측정표와 Layout은 CONTRIBUTING.md로 옮깁니다. | S | M17, L3-10, L1-08 |

### 3단계: 1~3개월 (재발 방지와 표면 정리)

| 항목 | 노력 | 해결 id |
|---|---|---|
| `scripts/run_segment_stubs.mjs`: stub 엔진으로 15개 segment를 실제 실행해 args, 스키마, 부분 실패 분기를 CI에서 검증합니다. | M | M13, L3-06 |
| fixture 저장소 매트릭스(Node pnpm, Python poetry, Gradle Spring, dirty-WIP·develop 변형)로 `claude -p` 헤드리스 eval 8~10개를 만들어 릴리스 게이트로 씁니다. 단언 대상은 WIP 바이트 보존, `.harness` 잔존 0, docs_path 일치, pom parent 불변입니다. 트리거 eval도 같은 하네스에 둡니다. 기록이 없는 스킬에는 `unverified-live`를 공시합니다. | L | M13, M6·M4 회귀 방지, L1-08 선행 조건 |
| 본문 바이트 ratchet(`verify_body_budget.py`)과 `(Observed\|Measured) 20\d\d-` 금지를 도입합니다. mode_gate.md rule 3의 관측 일지와 segment_launch.md의 Correction은 design/으로 옮기고, content args를 path args로 전환합니다. | M | M14, L3-11, L4-02·L4-08 |
| 원인별 폴백 배너, state의 `fallback_reason`, 요약 첫 줄에 "요청 모드 → 실제 모드"를 표시합니다. doctor에 check-ignore와 잔존 state 항목을 추가하고, `--probe`는 옵트인으로만 둡니다. | M | L3-06, L3-09 |
| 제품 표면 결정 게이트: 2단계 이후 실사용과 eval 데이터를 보고 refactor, migrate, test-gen, ship, codebase-audit, study, team-memory를 labs 플러그인으로 분리할지, 프로필로 통합할지 결정합니다. deep-review quick 모드는 내장 기능에 위임합니다. 폐기 스텁은 v9에서 제거합니다. | L | L5-06~L5-11, L1-09, M11 잔여 |
| ROADMAP을 "열린 항목 표(상태 열 필수) + design/ 링크"로 재작성합니다. 문서에 측정 수치를 쓰지 않고 lint 출력으로 대체합니다. TPL_ 미러는 생성기와 diff-0 lint로 관리합니다. | M | M17, L8-04, L8-08 |

## 9. 하지 말아야 할 것

- **신뢰성 문제를 문서 정합성 lint나 SYNC/BLOCK 그룹을 늘려서 풀려고 하지 마십시오.** C1, M1~M3, 게이트 설명 절단은 모두 lint green 상태로 출하되었습니다. 검증 예산은 git 안전 lint와 행동 스모크로 돌려야 합니다.
- **`git checkout --`, 인자 없는 `git stash`, `git checkout -- .`를 롤백·스냅샷·복구 안내에 다시 쓰지 마십시오.** 대체는 git 여부와 무관한 바이트 사본입니다.
- **안전 수정 전에 스킬 통폐합이나 labs 분리를 먼저 하지 마십시오.** 치명 경로를 그대로 둔 채 옮기면 검증 대상에서만 빠지고 위험은 남습니다.
- **`--fast`를 조용한 전역 기본값으로 만들지 마십시오.** 도구 없는 게이트 턴이라는 구조적 보장이 이 플러그인의 핵심 약속입니다. 트리아지 제안, 힌트, 문서 전면 배치까지만 하십시오.
- **"state에 contract_loaded 플래그를 두고 재읽기를 생략"하는 식의 절감을 하지 마십시오.** compact 이후 플래그는 참인데 내용은 없는 상태가 생깁니다. 줄이려면 단일 소스로 승격하십시오.
- **트리거 eval 없이 description 다이어트를 하지 마십시오.** 설명 누락은 알림 없이 조용히 일어납니다. 지금은 기계적 결함(절단, segment 합산)만 고치십시오.
- **CLAUDE.md, lint docstring, ROADMAP 행에 새 측정 수치나 "Correction (dated …)"를 계속 덧붙이지 마십시오.** 자기무효화 루프를 키웁니다.
- **README의 "(estimated)" 성공률과 품질 배수를 스킬·모드 권고의 근거로 쓰지 마십시오.**
- **기본 doctor를 쓰기 가능하게 바꾸지 마십시오.** 능동 프로브는 명시적 `--probe` 옵트인으로만 두십시오.
- **폐기 스텁을 semver를 무시하고 즉시 삭제하지 마십시오.** 대신 키워드 호출이 스텁에 매칭되는 경로를 먼저 끊으십시오.
- **"이 저장소에서는 docs/가 gitignore"라는 전제를 새 계약 문장에 다시 넣지 마십시오.** 사용자 저장소 상태는 항상 `git check-ignore`로 실측해 분기하십시오.