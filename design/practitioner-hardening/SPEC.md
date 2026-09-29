# Spec — Stage 1 practitioner hardening

### 목표

커밋되지 않은 WIP가 있는 일반 실무 저장소에서 이 플러그인의 롤백·스냅샷·복구 경로가 사용자 데이터를 잃지 않게 합니다. 방법은 범용 백업 체계가 아니라 **clean-target 게이트**입니다. 파괴적 조작(git 기반 복원)은 대상 파일이 조작 직전에 HEAD와 같을 때만 허용하고, 대상이 dirty면 사용자에게 먼저 커밋할지 중단할지 묻습니다. git이 복원할 수 없는 대상(untracked 파일, git 없는 저장소)만 소규모 파일 사본으로 보호합니다. 이 계약의 단일 소스는 templates/_shared/rollback.md입니다. 새 lint는 이 계약을 인용하지 않은 절에 위험 git 명령이 다시 들어오는 것을 막습니다. 스킬 목록, /ship 버전 편집, 서브에이전트 지시, README도 사실대로 고칩니다. 아키텍처(3분할 게이트, Mode Gate, INLINE 기본값, Evaluator)는 동결합니다.

### 배경

근거는 2026-09-29 실무자 적대 리뷰(design/practitioner-hardening/REVIEW.md)의 C1·M1~M4·M11·M12·M17·L7-10입니다. 여러 스킬이 롤백·스냅샷에 HEAD 기준 명령을 씁니다: test-gen 변이 복원의 `git checkout -- <source>`, harness-build·refactor Auto-fix의 인자 없는 `git stash`, refactor Stash first의 인자 없는 `git stash`, md-optimize 실패 안내의 `git checkout -- .`. 이 명령들은 커밋 안 된 WIP를 지우거나 stash로 쓸어 담습니다. migrate Rollback은 반대로 `git checkout <original_branch>`가 커밋되지 않은 migrate 편집을 원래 브랜치로 끌고 가므로 되돌리지 못합니다.

rev 3은 모든 복원을 바이트 사본·매니페스트·복원 결정표로 통일하고 .harness/ 삭제 지점마다 검사를 배선했는데, 복잡도 대부분이 ".harness/ 안의 사본이 .harness/ 삭제로 사라진다"에서 나왔습니다. rev 4는 이를 뒤집었습니다. 대상이 조작 직전에 HEAD와 같으면 git 복원도 .harness/ 삭제도 원본을 잃지 않으므로, 남는 것은 (a) 조작 직전 검사, (b) dirty 대상 질문, (c) git이 원본을 갖지 않는 대상의 소규모 사본뿐입니다. rev 5는 rev 4 적대 리뷰 판정(K1~K47), 델타 리뷰 세 차례, 사용자 확정 결정(D1~D5, §접근 방식 첫머리)을 반영했습니다.

이 밖에 다음 결함도 다룹니다(S3~S6). harness-gate description이 YAML 주석으로 잘립니다(M11). segment description이 스킬 목록 공유 예산을 잠식합니다. /ship Pass 2의 전역 치환이 parent·의존성 버전을 바꿀 수 있습니다(M4). 서브에이전트 템플릿에 키워드 스킬 호출 지시가 있습니다(M12). README에 사실과 다른 서술과 사설 저장소명이 있습니다. 설치본 v8.14.0에는 M1이 살아 있으므로, 에픽 동안 HARD GATE #3에서 Apply patch를 쓰지 않는 제약을 유지합니다.

### 범위

**포함**

- templates/_shared/rollback.md (신설 — clean-target 게이트 계약)
- skills/test-gen/SKILL.md: §Mode Gate의 has_git note(SYNC 사이트 아님. 바로 뒤 §Ambiguity Prompt 불릿과 그 SYNC-WITH 마커 줄은 편집 대상 밖), Phase 3 §Step 2 INLINE 2·5번과 4번 strengthen, WORKFLOW 3a·3d·4, §Verdict reduction·Test Report Quality Score, §Session Recovery 맨 앞과 gate 0 직후(복구 선출력, (1)의 위치), §Key Rules의 production immutability·Judge-panel 줄
- workflows/test-gen.judge.workflow.js의 계약 주석 두 곳(파일 머리, return 직전), workflows/_reference/schemas.md §MutationVerdict(서두 문장, verdict enum·score·Determinism locks)
- skills/harness-build/SKILL.md §Step 5 "If Apply patch" 1~3번, §Session Recovery('Follow session_recovery.md' 문장 앞 복구 선출력 한 줄과, 그 줄을 예외로 적도록 'byte-identical with /harness's copy' 머리말 정정)
- skills/refactor/SKILL.md §Step 1(has_git 검출, 4번 Stash first의 라벨 설명과 동작, 11번 state 필드), §Step 4 Auto-fix "If Apply patch" 1~2번, §Step 4-S 2.d Revert step, Stash Restore Notice 문단과 그것을 가리키는 종료 지점, §Session Recovery 맨 앞과 gate 0 직후(복구 선출력, (1)의 위치)
- skills/md-optimize/SKILL.md §Exclusion List, §1a(맨 앞 잔여 사본 검사, 1번, 2번 공시), §Phase 3 머리말(§Dirty Gate), Phase 4(§4a·§4b의 copy 대상 비교), Phase 5 Report 직후 사본 삭제·checkpoint 해체, §Safety Rules의 Git-first·Sequential execution 줄
- skills/migrate/SKILL.md §Step 1(has_git 검출, migrate 브랜치 검사, 숨김 플래그 공시, 쓰기 전 전체 clean 게이트), §Step 4 파일 생성 기록, §Step 6 Rollback(실패 분기 포함), has_git==false 처리
- scripts/verify_git_safety.py (신설)
- lint 배선: .github/workflows/lint.yml, CLAUDE.md(§Commands 표, lint-cmd 라인, §Architecture scripts/ 행, 'Run all six', §Verification 'The six lints'와 새 lint 불릿), README.md(lint 목록, §Project Defaults 'seven commands')
- skills/harness-gate/SKILL.md frontmatter description 따옴표, design/ 'gitignored' 오기 정정
- scripts/verify_description_budget.py (plain scalar 불변식, segment·결합 합계, 목표 상한 보고, docstring 정정)
- workflows/*.workflow.js 15개의 meta.description
- skills/ship/SKILL.md §Version Detection 표, §Step 2 Pass 1(미리보기와 state 기록)·Pass 2(형식별 앵커 편집), §Session Recovery의 pass1_done 재개
- templates/planner/planner_single.md, templates/generator/generator_single.md, templates/generator/implementation.md, templates/generator/implementation_standard.md, templates/evaluator/evaluator_prompt.md, templates/migrate/evaluator.md, templates/refactor/evaluator.md 및 workflows/harness.build·harness.eval·migrate.eval·refactor.eval.workflow.js의 TPL_* 사본
- README.md 사실 정정, skills/study/SKILL.md·workflows/_reference/study_measurements.md 사설 저장소명 익명화
- design/practitioner-hardening/PROBE.md (S7 라이브 프로브 기록)

**제외**

- .harness/ 삭제 지점 배선 전부: session_conflict.md·session_recovery.md의 Delete and start·Restart·Stop, debug·migrate·refactor·ship·spec·test-gen의 인라인 사본, 각 Cleanup, harness-build §Step 3.6·§Step 8, spec HARD GATE Stop. 근거: clean-target이면 원본이 HEAD에 있고, 사본은 .harness/ 밖에 있으므로(§Copy Path) .harness/ 삭제가 원본도 사본도 잃지 않습니다.
- 매니페스트 계열 전부: MANIFEST.json, run_id·rollback_run_id, post_sha256, 복원 결정표(R0~R6·C1~C3), 자기/고아 매니페스트 분류·재기준화, §Pre-delete Check, 레거시 백업(.harness/autofix_pre_apply/, v8.14 stash 스냅샷) 검사. 레거시 잔여물은 공시만 합니다.
- templates/_shared/path_validator.md 헤더 변경(rollback.md와 refactor가 path_validator를 인용하지 않으므로 불필요)
- refactor Revert step의 게이트화: 방법만 문장으로 고정합니다([생산자별 변경] refactor).
- migrate의 사본 경로: git 없는 Rollback은 선택지를 숨기고 공시합니다(대상이 많아 '소규모 사본'이 아님). Step 1 이전부터 있던 untracked·ignore 파일의 변경도 사본으로 보호하지 않고 공시합니다(D4).
- skills/harness/SKILL.md §Session Recovery의 복구 선출력(§Residual Risks에 공시)
- 공유 dirty-tree 게이트, /harness abort, base_sha 기록 (M5)
- 산출물 위생, 'Commit code only' 라벨 통일, check-ignore 게이트 (M8). 사본 디렉터리는 자기무시 .gitignore로 노출되지 않습니다(§Copy Path).
- test-cmd/build-cmd defaults 키, 기존 실패 기준선, migrate 의존성 동기화 (M7)
- /harness --from-spec (M6), slug 붕괴 접미사 (M10), Fast Gate spec 요약·트리아지 (M9)
- /ship changelog 절, --prerelease, 태그 형식, dry-run, DAG 순서 (M15)
- 행동 eval, stub 러너, 본문 바이트 ratchet (S2 외 M13·M14), 스킬 통폐합
- team-memory 영속 백업(.harness/memory_backup/)
- test-gen이 기존 테스트 파일을 수정하는 경로(Phase 2 생성). §Residual Risks에 공시만 함
- ship Pass 2의 in-memory raw bytes 백업 방식 교체 (기존 방식 유지)
- 19개 스킬 description 자체의 축소. 결합 합계 목표 미달은 잔여 위험으로 공시
- (8)의 미검사 변형. docstring에 공시만 함
- git 이력·push된 커밋·태그 재작성, 새 SYNC/BLOCK 그룹 신설, 버전 bump·릴리스

### 접근 방식

**확정 결정** (사용자 확정, 본문 규칙에 반영됨)
- D1(K1) = A: §Clean Check의 clean 조건에 `git cat-file --filters HEAD:<p>` sha256 == 작업 트리 sha256을 넣고, 불일치는 copy로 분류합니다.
- D2(K9·K10) = A: 'Commit WIP first' checkpoint는 보호 대상 조작이 끝나면 HEAD==sha일 때만 해체합니다(§Dirty Gate Checkpoint 해체). migrate는 해체하지 않고 공시합니다. HEAD가 다르거나 halt면 Checkpoint 공시만 하고 자동 조치는 없습니다.
- D3(K32) = B: 사본은 `.harness-backup/<skill>/<상대 경로>`에 두고, 처음 만들 때 자기무시 .gitignore를 둡니다. .harness/ 삭제 경로와 무관합니다.
- D4(K33) = A: migrate는 §Created Files 부재 확인으로 기존 untracked·ignore 경로의 삭제만 막고, 나머지는 Step 1·Rollback 확인·§Residual Risks에 공시합니다.
- D5(K38) = B: S2의 '같은 절 인용 = 허용'은 REQUIRED_CITERS 5개 파일에서만 유효합니다. 그 밖의 파일은 인용 여부와 무관하게 allowlist 개수로 판정합니다.

슬라이스는 순차로 진행합니다. 순서는 S1 → S2 → S3 → S5 → S4 → S6 → S7입니다. 파일이 겹치는 슬라이스끼리 인접시키고, S2 lint는 S1이 끝난 트리에서만 green이 됩니다. **S1은 단일 슬라이스입니다**(분할 사유였던 삭제 지점 배선과 매니페스트 기반 test-gen이 사라져 계약 1개와 생산자 SKILL.md 5개의 국소 편집만 남음). state.json에 동결된 §Scale Assessment의 S1 분할 권고는 개정 전 값이며 이 spec이 우선합니다.

[S1 rollback.md: clean-target 게이트 계약]
금지 명령 목록을 SKILL.md 본문에 재진술하지 않습니다. S1 편집 후 파괴적 조작이나 게이트 대상 명령 문자열((8)의 클래스)이 남는 생산자 SKILL.md의 모든 절은, 안내문(§Session Recovery 안내, has_git note 포함)이라도 같은 절에 전체 경로형 `templates/_shared/rollback.md` §이름으로 인용합니다. 계약 원문(라벨·질문·설명)은 영어, 렌더링은 user_lang입니다(session_conflict.md와 같은 방식).

(1) §Scope — 파괴적 조작 대조표. 각 조작은 아래 행 하나로만 존재합니다.

| 스킬 | 조작 | 대상 | clean 검사 시점 | Abort의 의미 |
|---|---|---|---|---|
| test-gen | 변이 적용 → 복원 | proposal.file(INLINE은 변이 대상 함수의 파일) 집합 | 변이 루프 시작 직전 1회(대상 전체), 변이마다 적용 직전 재확인 | dirty 대상의 변이는 적용하지 않고 `score.protected`로 기록(skipped·totalScored에 넣지 않음), 나머지는 진행 |
| harness-build | Auto-fix Apply patch → 실패 시 복원 | 패치 헤더의 경로 목록(경로 검증 통과분) | 헤더 파싱·검증 직후, 적용 직전 | Apply를 거부하고 FAIL retries ≥ 3 HARD-GATE로 복귀(Auto-fix 숨김), autofix.applied → "rejected" |
| refactor | Auto-fix Apply patch → 실패 시 복원 | 위와 동일(.harness/refactor/auto_fix_patch.md) | 위와 동일 | regression HARD-GATE로 복귀(Auto-fix 숨김), autofix.applied → "rejected" |
| md-optimize | Phase 3 쓰기·삭제 ~ §4d 수정 → 실패 시 복원 | 확정 대상(Phase 2 계획상 3a~3d가 생성·수정·삭제할 모든 경로 — 3d 참조 갱신 대상 포함) | Phase 3 첫 쓰기 직전 1회 + §4d가 확정 대상 밖 경로를 쓰면 그 쓰기 직전(§1a는 공시만 — [생산자별 변경] md-optimize) | halt(아무것도 쓰지 않음). 단 §4d가 확정 대상 밖 dirty·blocked 경로를 쓰려 하면 그 수정만 건너뜀 |
| migrate | Step 4 편집·명령 → Rollback | 작업 트리 전체(tracked) | §Step 1에서 어떤 쓰기(디렉터리 생성, 기준선 테스트 산출물, 브랜치 생성)보다 먼저 1회 | halt(아무것도 만들지 않음) |

- refactor Stash first는 파괴적 복원이 아니라 사용자의 명시적 WIP 이동이므로 게이트 대상이 아닙니다. 대신 (7)을 따릅니다.
- 이 표에 없는 파일의 게이트 대상 명령은 S2 allowlist에 사유와 개수로 등재된 것만 허용되며, 그 밖의 것은 S2 lint가 거부합니다(D5).
- **진행 중 표식**: state.json을 쓰는 생산자(test-gen·harness-build·refactor)는 첫 수정 직전 대상 경로와 분류(clean·copy·created)를 in-flight 필드(test-gen `mutation_in_flight`, Auto-fix `autofix.apply_in_flight`)에 기록하고, 적용 성공 또는 복원 검증 직후 null로 합니다. copy 대상의 사본은 이 null 기록 **뒤에** 삭제합니다(§Copy Path).
- **복구 선출력**: Resume·Restart·Stop 질문보다 먼저 아래를 차례로 봅니다. 위치: test-gen·refactor는 (i)을 §Session Recovery 제목 바로 아래·gate 0 앞 한 줄에 둡니다(gate 0의 'Delete and start'가 Step 1로 직행하므로. 그 줄에 '.harness/를 건드리지 않아 gate 0보다 먼저 평가'를 적고 gate 0 문구는 불변). (ii)·(iii)은 gate 0 직후·skill 일치 검사 전입니다. harness-build는 (i)~(iii)을 'Follow session_recovery.md' 문장 앞 한 줄에(session_recovery.md 불변), md-optimize는 §1a 맨 앞에서 (i)만 봅니다. 자동 복원은 하지 않습니다.
  - (i) `.harness-backup/<skill>/`이 있으면 경로 목록과 수동 복원 방법(사본을 대상 경로로 복사)을 출력합니다.
  - (ii) state.json이 있고 `skill`이 자기 파이프라인(test-gen·refactor는 자기 이름, harness-build는 "harness")일 때만 in-flight 표식을 봅니다. 경로별 해결 판정: clean → `git status --porcelain -- <path>` 빈 출력, created → 부재, copy → 사본 `.harness-backup/<skill>/<path>` 부재(<skill>은 (5)의 디렉터리 리터럴 — harness-build는 `harness-build`. 표식 null 뒤 사본 삭제 순서라, 사본 부재는 사용자가 (i)대로 처리했다는 뜻). 모두 해결이면 필드를 null로 바꿉니다. 미해결 경로는 분류별 복원 방법(clean → `git diff -- <path>` 확인 후 `git checkout -- <path>`, created → 삭제)을 출력합니다.
  - (iii) (ii)와 같은 조건에서 `wip_checkpoint`가 있으면 (3)의 Checkpoint 공시를 출력하고 필드를 null로 합니다(해체 없음, 새 checkpoint의 덮어쓰기 방지).
  - (i)이 있으면 (i)의 위치에서, (ii)에 미해결 경로가 남으면 (iii) 뒤에 '위 항목을 해결한 뒤(사본으로 수동 복원했으면 `.harness-backup/<skill>/` 삭제 포함) 다시 호출하십시오'를 붙이고 halt하며 Resume·Restart·Stop을 제시하지 않습니다. 그 외에는 질문으로 진행합니다.

(2) §Clean Check — 대상 경로 p 하나에 대한 판정. p는 저장소 루트 기준 상대 경로이고 `..` 세그먼트가 없으며 `.harness/`·`.harness-backup/`·`.git/` 밖이어야 합니다. 위반이면 harness-build·refactor는 패치 형태 위반과 같이 (1)의 Abort 의미를, md-optimize·migrate는 halt를, test-gen은 [생산자별 변경]을 따릅니다. harness-build는 기존 §Step 5의 kind=diff_target 검증을 그대로 쓰고, 그에 더해 이 절의 `.harness-backup/` 제외를 적용합니다(diff_target은 `.harness-backup/`을 막지 않음). refactor에는 기존 검증이 없으므로 이 경로 조건 자체를 검증으로 적용합니다. path_validator.md는 인용하지 않고 헤더도 바꾸지 않습니다.
- **패치 형태**: Auto-fix 패치는 파일 블록마다 `--- a/<p>`|`--- /dev/null`과 `+++ b/<p>`|`+++ /dev/null` 한 쌍으로만 이뤄져야 합니다. p는 `a/`·`b/` 뒤의 경로만 추출합니다. `--- /dev/null`은 생성 표지, `+++ /dev/null`은 삭제 표지로 읽을 뿐 경로 검증 대상이 아닙니다. 쌍이 없는 블록이나 확장 헤더(rename·copy·mode·Binary)가 있으면 Apply를 거부하고 (1)의 Abort 의미를 따릅니다.
- **경로 취급**: <root> = `git rev-parse --show-toplevel`. 이 계약과 이를 인용하는 절의 모든 git 명령은 `git -C <root> --literal-pathspecs …`로 실행하고, 존재 검사·사본·삭제도 <root> 기준 경로로 합니다. git 출력의 경로는 `-z`(NUL 구분)로 읽고 따옴표를 해석하지 않습니다. 여러 경로를 한 명령에 넘길 때는 `--pathspec-from-file=<f> --pathspec-file-nul`을 씁니다(f는 .harness/ 아래).
- has_git == false 또는 HEAD 없음(`git rev-parse --verify -q HEAD` 실패) → 모든 대상이 **copy**(index 등록 여부 무관). migrate는 HEAD 없음을 has_git == false와 같이 처리합니다.
- `git ls-files --error-unmatch -- p`가 실패 → 파일이 있으면 **copy**(untracked), 없으면 **created**(조작이 새로 만들 파일).
- tracked p 중 `git ls-files -v` 태그가 소문자이거나 `S`인 대상, unmerged 대상(porcelain XY에 `U`가 있거나 `AA`/`DD`), 그리고 merge·rebase·cherry-pick·revert가 진행 중인 저장소의 모든 dirty 대상은 **blocked**입니다.
- 나머지 tracked p는 다음을 모두 만족할 때만 **clean**: `git status --porcelain -- p` 출력이 비어 있음(수정·staged 모두 없음), 태그 `H`, `git cat-file --filters HEAD:<p>`의 sha256 == 작업 트리 p의 sha256(해시 도구는 §Copy Path 순서). 앞의 두 조건만 만족하고 해시가 다르면(EOL·smudge 불일치) checkout 복원 바이트가 원본과 달라지므로 **copy**로 분류합니다(D1). 그 외는 **dirty**.
- 검사는 스킬이 p를 처음 수정하기 **직전**에 합니다. 스킬 자신이 앞서 수정한 파일(Generator 출력, 앞 단계 refactor 편집, 같은 파일에 테스트를 쓰는 언어의 test-gen 출력)도 dirty입니다. 소유자 구분은 하지 않습니다.
- 검사와 복원 사이에 스킬은 p를 stage하지 않습니다. 따라서 index == HEAD가 유지되고 `git checkout -- p`가 HEAD 내용을 복원합니다.

(3) §Dirty Gate — dirty·blocked 대상이 하나라도 있으면 조작 전에 한 번 처리합니다.
- 질문은 한 세션에서 최대 1회입니다. 이후 재확인(test-gen 변이별, md-optimize §4d)에서 dirty가 나오면 다시 묻지 않고 (1)의 Abort 의미로 처리합니다. 따라서 checkpoint는 세션당 최대 하나입니다.
- blocked 대상은 'Commit WIP first'로 clean이 될 수 없습니다(pathspec 커밋이 플래그 파일을 조용히 빼거나 merge 중 거부). 질문과 별도로 나열하고 해제 방법(`git update-index --no-assume-unchanged`/`--no-skip-worktree -- <p>`, 충돌 해소·진행 중 조작 완료)을 안내한 뒤 (1)의 Abort 의미로 처리합니다. 아래 질문과 'Commit WIP first'는 blocked가 아닌 dirty 대상에만 적용합니다.
- 비대화형 세션(headless·cron·sub-agent)은 묻지 않고 halt합니다. 아무것도 바꾸지 않습니다. templates/_shared/session_conflict.md §Gate Procedure item 6을 이름으로 인용합니다.
- AskUserQuestion(dirty 목록 전체를 한 질문에): header "WIP", question "Uncommitted changes in files this operation may overwrite: {paths}. Restoring them later from git would lose these changes."
  - "Commit WIP first" / "Commit only these {n} files as a checkpoint, then continue": `git commit -m "chore(<skill>): WIP checkpoint before <operation>" -- <dirty paths>`(pathspec 커밋이라 다른 경로의 staged 변경은 포함하지 않는다. 대상 경로는 작업 트리 내용으로 커밋되므로, 그 경로에 부분 staging이 있었다면 staged 중간본은 사라진다). 성공하면 SHA와 커밋한 브랜치 이름을 출력합니다. 커밋 실패(hook 거부, 서명 대기 등)면 halt합니다. 커밋 후 (2)를 다시 돌려 dirty·blocked가 하나도 없을 때만 진행합니다. copy로 재분류된 대상(EOL·smudge 불일치 — core.autocrlf=true에서 LF 파일을 커밋하면 흔함)은 §Copy Path로 보호합니다. dirty나 blocked가 남으면 다시 묻지 않고, 경로와 ls-files -v 태그를 출력한 뒤 halt합니다.
  - "Abort" / "Do not run {operation}; nothing is changed": (1)의 Abort 의미를 따릅니다.
- **Checkpoint 해체**(D2): test-gen·harness-build·refactor는 state.json `wip_checkpoint = {sha, branch, paths}`(branch = 커밋 시점 `git rev-parse --abbrev-ref HEAD`의 출력. 출력이 `HEAD`(detached)이면 null)에, md-optimize는 세션 값으로 둡니다. 해체 지점은 보호 대상 조작이 끝난 직후 하나입니다(test-gen Phase 3 WORKFLOW 4 clean guard 통과 직후·MutationVerdict 조립 전, Auto-fix 적용 성공 또는 복원 완료 직후, md-optimize Phase 5 Report 직후). 네 스킬 모두 질문이 첫 쓰기 직전에 있어 checkpoint 뒤 조작 전의 정상 종료 지점이 없습니다. 해체 지점에서 `git rev-parse HEAD`가 그 SHA일 때만 `git reset --soft <sha>^` 후 `git reset -q -- <paths>`로 해체하고 필드를 null로 합니다. HEAD가 다르거나 halt로 끝나면 Checkpoint 공시만 합니다.
- **Checkpoint 공시**: SHA·브랜치(기록값, null이면 생략)와 'checkpoint 커밋 <sha>가 이력에 남아 있음. 필요하면 수동으로 정리'를 출력합니다. git 명령은 안내하지 않고 자동 조치도 하지 않습니다.
- migrate는 checkpoint를 기록·해체하지 않고, 커밋 직후 Checkpoint 공시에 한 문장만 덧붙입니다: '그 브랜치의 HEAD가 아직 <sha>일 때 `git reset --soft <sha>^`로 커밋을 풀 수 있다(변경은 staged로 남는다)'. 위에 커밋이 쌓인 뒤의 되돌리기는 안내하지 않습니다.
- 선택지를 늘리지 않습니다. stash 제안은 넣지 않습니다.

(4) §Git Restore — clean 분류 대상의 복원.
- `git -C <root> --literal-pathspecs checkout --pathspec-from-file=<f> --pathspec-file-nul`(목록이 한 경로면 `checkout -- <p>`도 허용)만 씁니다. 목록은 (2)에서 clean으로 판정된 경로에 한정하며, `-- .`·디렉터리 pathspec·glob은 쓰지 않습니다.
- 복원 후 (2)의 porcelain 검사를 다시 돌려 비어 있어야 합니다. 비어 있지 않으면 1회 재시도하고, 그래도 실패하면 halt하며 경로와 `git diff -- <p>` 확인을 안내합니다. .harness/는 지우지 않습니다.
- clean 조건이 복원 바이트 동일을 보장합니다. 검사와 복원 사이에 .gitattributes·core.autocrlf가 바뀌는 경우만 공시합니다. migrate는 전체 트리 게이트라 이 조건을 적용하지 않으며, 복원된 파일은 현재 smudge EOL로 쓰입니다(공시).

(5) §Copy Path — copy 분류 대상만(D3).
- 위치: `.harness-backup/<skill>/<대상 상대 경로 그대로>`(<skill> 리터럴 = test-gen·harness-build·refactor·md-optimize). 대소문자 무시 파일시스템 충돌을 막기 위해 평탄화하지 않습니다. 처음 만들 때 `.harness-backup/.gitignore`에 `*` 한 줄을 둡니다(자기무시). .harness/ 삭제 경로는 이 디렉터리를 건드리지 않습니다.
- 바이트 도구: 복사는 cp → python shutil.copyfile, 해시는 sha256sum → shasum -a 256 → python hashlib 순. 모두 없으면 halt합니다. 모델이 Read→Write로 다시 쓰는 방식은 금지합니다(CRLF·BOM·비UTF-8·끝 개행 보존).
- 사본은 조작마다 경로별로 한 번만 만듭니다. md-optimize는 Phase 3 첫 쓰기 직전에 확정 대상 중 copy 분류 전부의 사본을 만들고, §4d가 확정 대상 밖 경로를 쓸 때만 그 경로의 사본을 추가합니다. 같은 조작 안에서 다시 쓰는 경로는 기존 사본을 그대로 씁니다.
- 사본 경로에 파일이 이미 있으면(그 경로의 조작 전 — 같은 조작이 이미 만든 사본은 제외) 덮어쓰지 않고 그 경로와 (1) (i)의 안내를 출력한 뒤 halt합니다(조작 전이라 변경 없음 — 진입 경로와 무관한 잔여 사본 보호).
- 순서: 사본 생성 → 사본 해시 == 원본 해시 확인 → 조작. 복원: 사본을 대상에 복사 → 해시 확인(불일치 1회 재시도 후 halt, 사본 보존).
- 삭제: 조작이 끝나면(성공이든 복원 완료든) 진행 중 표식을 null로 한 뒤 그 조작의 사본을 즉시 삭제하고(md-optimize는 Phase 5 Report 직후), 스킬 종료 시 `.harness-backup/<skill>/`을 삭제합니다. halt로 끝나면 사본을 남기고 경로를 출력합니다.
- 잔여 사본: 검사 위치·출력·halt는 (1) 복구 선출력 (i)을 따릅니다.

(6) §Created Files — created 분류 대상.
- 생성 직전에 경로가 없음을 확인합니다(있으면 copy로 재분류).
- 조작이 실패해 되돌릴 때는 이번 조작이 만든 경로만 삭제합니다. 삭제는 단일 파일 삭제로만 하고 git clean은 쓰지 않습니다.

(7) §Stash Guidance — refactor Stash first 전용.
- push 전에 `git stash list --format='%H %s'`에서 `%s`가 `: harness-refactor-<slug>`로 끝나는 stash(`-m` 메시지 앞에 'On <branch>: '가 붙음)가 이미 있으면 그 SHA를 출력하고 '이전 시도의 stash가 남아 있음(원래 WIP일 수 있음)'이라고 경고합니다. 자동 조작은 하지 않습니다. Session Recovery의 Restart·Stop에는 배선하지 않고, 아래 메시지 기반 찾기 안내로 대신합니다.
- `git stash push -m "harness-refactor-<slug>"`를 씁니다. 실행 전후 `git stash list --format='%H'`를 비교해 새 SHA가 있으면 기록하고, 없으면 null과 함께 '생성된 stash 없음(untracked는 작업 트리에 그대로)'을 출력합니다. SHA는 `stash_sha`로 기록합니다([생산자별 변경] 공통의 세션 값 규칙).
- **Stash Restore Notice**: refactor SKILL.md는 복원 안내의 git stash 철자(apply·list %gd·drop)를 이름 붙은 문단 'Stash Restore Notice' 한 곳에만 적고, 그 문단이 이 절을 인용합니다. §Step 1 4번은 push·전후 list 비교·사전 중복 경고를 이 절 인용으로 수행하고 철자를 재진술하지 않습니다. 안내: `git stash apply --index <sha>`(충돌로 실패하면 `--index` 없이 재시도하고, 이때 staged 구성이 unstaged로 풀린다고 안내) → 성공 확인 → `git stash list --format='%gd %H'`에서 그 SHA의 stash@{n}을 찾아 → `git stash drop stash@{n}`. SHA를 잃었으면 `git stash list`에서 제목이 `: harness-refactor-<slug>`로 끝나는 항목을 찾습니다. `pop <sha>`는 거부되므로 쓰지 않습니다.
- Stash first를 고른 세션의 종료 지점 — §Step 1 7번 'Fix first'·'Abort' halt, Step 3 'Stop', Step 4 Auto-fix 'Stop', Step 4-MC abort, Step 7 완료 출력 — 은 Stash Restore Notice를 이름으로만 가리켜 출력합니다.
- 라벨 설명에는 git 명령을 적지 않습니다.

(8) §Guarded Commands — S2 lint가 쓰는 명령 클래스(클래스의 이름·범위를 정의합니다. 실행 정규식은 scripts/verify_git_safety.py에 고정하며, lint는 rollback.md가 있을 때 이 절에 네 pattern_id 리터럴 checkout_dd·stash·reset_hard·clean_f가 모두 있는지 확인합니다).
- 전역 옵션: `git(\s+-[Cc]\s+\S+|\s+--[a-z][\w-]*)*\s+<subcommand>`. 하위 명령 뒤의 옵션은 순서와 개수에 무관하게 매칭합니다(예: `git reset -q --hard`, `git clean -d -f`, `git clean --force`, `git checkout -q HEAD -- p`).
- 게이트 대상(인용 필요) 클래스:
  - checkout_dd: `git checkout (<ref> )?-- …`(`-- .` 포함), 동의어 `git checkout .`, `git checkout -f`/`--force`, `git checkout --pathspec-from-file=…`, `git restore`(`--staged`/`-S`만 있고 `--worktree`/`-W`가 없는 형태 제외)
  - stash: `git stash`의 모든 형태(인자 없음, push, save, -u, apply, pop, drop 포함). 단 `list`·`show`는 읽기 전용이라 제외
  - reset_hard: `git reset --hard`
  - clean_f: `git clean`의 `-*f*`·`--force` 형태
- 제외(검사 안 함): `git checkout -b`, 브랜치 전환용 `git checkout <branch>`, `--staged`/`-S`만 있고 `--worktree`/`-W`가 없는 `git restore`, `git reset --soft`.
- 미검사(공시): `git reset --merge/--keep`, `--` 없는 `git checkout <path>`, `git read-tree -u`, `git switch --discard-changes`, 값을 받는 -C/-c 외 전역 옵션(`--git-dir`·`--work-tree` 등), 셸 rm·mv.

(9) §Residual Risks — 계약이 막지 않는 것(문면에 공시).
- 사본은 `.harness-backup/`에 있어 .harness/ 삭제(Restart·Stop·Delete and start)에 지워지지 않습니다. 사용자가 이 디렉터리를 직접 지우면 halt 뒤 남은 유일한 사본도 사라집니다.
- v8.14 세션이 남긴 .harness/autofix_pre_apply/와 Auto-fix stash는 검사하지 않습니다.
- checkpoint: 해체 전 크래시하면 checkpoint 커밋이 남습니다. test-gen·harness-build·refactor는 다음 세션의 복구 선출력 (iii)이 공시하고, md-optimize는 state.json이 없어 커밋 직후 출력한 SHA로만 추적할 수 있습니다. migrate checkpoint는 사용자의 현재 브랜치에 남습니다. 해체 후 해당 경로의 staged/unstaged 구분은 사라집니다(내용 보존).
- md-optimize는 진행 중 표식이 없어, Phase 3~§4d 도중 크래시한 부분 적용 상태를 다음 실행이 알리지 않습니다(그 파일은 다음 실행의 §1a 공시와 Phase 3 §Dirty Gate에 dirty로 나타나고, 원본은 HEAD나 잔여 사본에 있음).
- 조작 도중(검사~복원 사이)의 대상 편집이나 다른 프로세스의 commit·stage는 감지하지 않습니다. 복원이 그 편집을 지우거나, 커밋된 변이가 porcelain 검사를 통과할 수 있습니다.
- 다른 스킬의 .harness/ 삭제가 진행 중 표식(test-gen `mutation_in_flight` 등)을 지우면 clean 대상의 변이·부분 적용이 작업 트리에 남을 수 있습니다. 같은 파이프라인의 /harness §Session Recovery Restart도 여기에 해당합니다(복구 선출력은 /harness-build에만 둡니다).
- migrate: Step 1 이전부터 있던 untracked·ignore 파일에 migrate가 한 변경은 Rollback이 되돌리지 않습니다. 보존하려면 먼저 커밋하십시오(D4). ignore된 설치 산출물(node_modules 등)도 복원하지 않습니다. migrate의 Restart·Stop과 타 스킬의 Delete and start는 original_branch·created_files를 지워 자동 Rollback을 불가능하게 합니다(사용자 WIP는 원래 브랜치 HEAD에 있고, 다음 migrate는 §Step 1 브랜치 검사에서 halt합니다).
- 보호 범위 밖: test-gen이 기존 테스트 파일을 수정하는 경로, refactor Revert step(Edit 역적용으로 고정했지만 게이트는 없음).

[생산자별 변경]
- 공통 — has_git 출처: migrate·refactor는 §Step 1에서 첫 git 명령·첫 쓰기 전에 templates/_shared/orchestrator_contract.md §Zero-Setup Environment Detection 방식으로 has_git을 검출합니다. md-optimize는 §1a 1번의 판정을 세션 값으로 씁니다. has_git == false면 migrate §Step 1의 브랜치 검사·clean 게이트와 9번 브랜치 조작, refactor §Step 1의 4번(Stash first 포함)과 6번 git 명령을 건너뛰고 그 사실을 공시합니다.
- 공통 — 세션 값 규칙: state.json 첫 기록 전에 생긴 값(has_git, refactor `stash_sha`)은 세션 값으로 보관하고, 첫 기록(refactor §Step 1 11번, migrate 12번)의 필드 목록에 추가해 저장합니다. 그 사이의 halt(refactor 7번 'Fix first'·'Abort' 등)도 종료 지점이므로 해당 안내를 출력합니다.
- test-gen
  - INLINE 2번(적용 직전): 첫 변이 전 대상 전체에 §Clean Check·§Dirty Gate, 변이마다 재확인, dirty·Abort면 기록 후 다음 대상, copy 대상은 §Copy Path 사본, `mutation_in_flight` 설정 후 적용. INLINE 5번: 3d와 같은 복원·검증.
  - WORKFLOW 3a: '(git tracks it, or copy aside…)'를 §Clean Check·§Copy Path 인용으로 바꾸고 INLINE 2번과 같은 규칙을 적용합니다. 3d: clean 대상은 `git checkout -- <file>`(§Git Restore), copy 대상은 사본 복원, 각각 즉시 검증합니다.
  - 4(clean guard): `git diff --quiet` 판정과 force-revert를 없애고, '변이한 clean 대상은 porcelain 빈 출력, copy 대상은 해시 일치'로 바꿉니다. 대상이 변이 전에 HEAD와 같았으므로 이 판정은 거짓 dirty를 내지 않습니다. 통과 직후(MutationVerdict 조립 전) §Dirty Gate Checkpoint 해체를 인용합니다. 판정이 실패하면 복원 명령을 실행하지 않고 경로와 `git diff -- <p>` 확인 안내를 출력한 뒤 halt합니다(Checkpoint 공시).
  - §Clean Check 경로 조건을 위반한 proposal은 그 변이만 skipped(사유 invalid path)로 기록하고 루프를 계속합니다(proposal은 서브에이전트 출력).
  - INLINE 4번 strengthen은 재작성할 테스트가 변이 대상 파일 안에 있으면 수행하지 않고, 그 변이를 weak로 기록한 뒤 weakTests[].suggestedAssertion만 남깁니다(복원이 파일 전체를 되돌리므로).
  - §Verdict reduction 첫 규칙으로 `totalScored == 0 ∧ protected > 0 → UNMEASURED`를 두고, Test Report Quality Score와 최종 status에 `Protected (WIP): n`을 출력합니다. schemas.md §MutationVerdict(verdict enum, score.protected, Determinism locks)와 test-gen §Key Rules Judge-panel 줄을 같이 맞춥니다.
  - §Session Recovery에 (1) 복구 선출력을 (1)의 위치대로 둡니다.
  - has_git note: 'with git it reverts via git checkout -- <source> and verifies with git diff --quiet' 서술을 rollback.md 인용으로 바꿉니다.
  - §Key Rules의 production immutability·Judge-panel 줄, judge 계약 주석 두 곳, schemas.md §MutationVerdict 서두를 새 판정에 맞춥니다.
- harness-build §Step 5 · refactor §Step 4 Auto-fix
  - 순서를 '헤더 파싱·경로 검증(harness-build: diff_target, refactor: §Clean Check 경로 조건 — 신설) → §Clean Check 분류 → dirty·blocked면 §Dirty Gate → copy 대상 사본 → `autofix.apply_in_flight` 설정 → 적용'으로 바꿉니다. `git stash` 스냅샷과 .harness/autofix_pre_apply/는 폐지합니다.
  - hunk 적용 실패: clean 대상은 §Git Restore, copy 대상은 사본 복원, `--- /dev/null`로 만든 파일은 §Created Files 삭제. 경고 문구 'Apply failed — reverted to pre-apply state.'는 유지합니다.
  - 적용 성공 후 L1 FAIL("stopped")은 기존대로 패치를 되돌리지 않습니다.
  - Generator·앞 단계 편집 때문에 대상이 거의 항상 dirty이므로 §Dirty Gate가 대부분 뜬다는 점을 절 안에 적습니다.
  - 적용 성공 또는 복원 완료 직후 §Dirty Gate Checkpoint 해체를 인용합니다. 두 스킬 §Session Recovery에 (1) 복구 선출력을 (1)의 위치대로 둡니다. harness-build는 'Follow session_recovery.md' 문장 앞 한 줄이며(`verify_done` 분기는 공유 item 7 질문 뒤라 쓰지 않음), 바로 앞 'byte-identical with /harness's copy (BLOCK-sync)' 머리말에 이 한 줄이 예외임을 적습니다(실제 BLOCK 마커는 없어 lint 영향 없음).
- refactor
  - Stash first: §Stash Guidance를 인용하고(철자 위치는 (7) Stash Restore Notice) 라벨 설명에서 git 명령을 뺍니다.
  - §Step 4-S 2.d Revert step 문장에 '이 단계가 만든 편집만 Edit으로 역적용하고, git 복원·stash 명령은 쓰지 않는다(앞 단계 편집과 사용자 WIP 보존)'를 명시합니다. git 명령 철자는 적지 않습니다(S2 매치 방지).
- md-optimize
  - §Exclusion List에 `.harness/`와 `.harness-backup/`을 추가합니다. §1a 맨 앞에 (1) 복구 선출력 (i)을 둡니다.
  - §1a 1번: no-git 경고를 '사본으로 복원 가능'으로 고칩니다(대상은 §Copy Path).
  - §1a 2번: 'Uncommitted' 질문(Continue/Abort, 'commit/stash' 권고)을 없애고, 범위 안 .md 중 clean이 아닌 경로를 공시만 합니다(질문·커밋 없음, 'Phase 3 첫 쓰기 직전에 묻는다'). '범위 안 .md'는 Glob `**/*.md`에 §Exclusion List와 §1b gitignore 필터를 적용한 집합, 곧 §1b 인벤토리와 같은 집합입니다. 이 필터를 §1a에서 먼저 계산하거나 공시를 §1b 1번 직후로 옮깁니다. 범위 밖 dirty 파일은 공시하지 않습니다. 질문이 §Phase 3 머리말에만 있으므로 §1b 'Switch: /md-generate'·Phase 2 'Stop'에는 checkpoint가 없습니다.
  - §Phase 3 머리말: 첫 쓰기 직전 확정 대상에 §Clean Check·§Dirty Gate를 적용하고(세션의 유일한 질문), 실패 안내 '`git checkout -- .`'를 '수정·삭제한 clean 대상만 `git checkout -- <목록>`, 3a에서 새로 만든 파일은 삭제'로 바꿉니다(rollback.md 인용).
  - §4d가 확정 대상 밖 경로를 쓰려 할 때 그 경로가 dirty·blocked이면 halt하지 않고 그 수정만 건너뛴 뒤 Phase 5 Report에 경로와 미적용 이슈를 적습니다(질문 없음, 세션당 1회 규칙 유지).
  - Phase 4: copy 대상에 대해서는 Evaluator(§4a·§4b)에 git diff 대신 사본과의 비교를 제공합니다. copy 대상의 사본은 §4d가 끝난 뒤(Phase 5 Report 직후)에 삭제하고, 같은 지점에서 §Dirty Gate Checkpoint 해체를 인용합니다.
  - §Safety Rules: Git-first 줄의 'commit/stash' 권고를 commit 권고로, Sequential execution 줄의 'git checkout' 안내를 rollback.md 인용으로 바꿉니다.
- migrate
  - §Step 1 순서(모두 2번 slug 산출 뒤, 7번 기준선 테스트 앞): has_git 검출(공통) → **브랜치 검사**: 현재 브랜치가 `harness/migrate-`로 시작하거나 `harness/migrate-<slug>` 브랜치가 이미 있으면(`git rev-parse --verify -q refs/heads/harness/migrate-<slug>` 성공) 게이트·커밋·쓰기 없이 halt합니다(이전 시도의 tracked·untracked 잔여 편집, 9번 `checkout -b` 충돌, original_branch 오기록 방지). Resume `setup`(→ Step 1)도 여기서 halt합니다(setup 단계에는 migrate 편집이 없음). halt 메시지는 현재 브랜치, state.json의 `skill`이 "migrate"이면 기록된 original_branch와 'Restart·Stop은 이 기록을 지운다', 그리고 '원래 브랜치로 돌아가 해당 migrate 브랜치(현재 브랜치가 `harness/migrate-*`이면 그 브랜치, 아니면 이미 있는 `harness/migrate-<slug>`)를 병합·정리한 뒤 다시 실행하라'를 출력합니다(git 명령 철자·자동 조치 없음). → `git ls-files -v`에서 태그가 소문자이거나 `S`인 경로를 공시(porcelain·`git diff`가 이 경로의 변경을 숨겨 Rollback (a)·(e)가 되돌리지 못함과 플래그 해제 방법을 안내. 게이트 대상 아님 — sparse-checkout 저장소 차단 방지) → 어떤 쓰기보다 먼저(현재 7번 기준선 테스트 앞) 전체 게이트: `git status --porcelain -z --untracked-files=no`가 비어 있지 않으면 §Dirty Gate(대상 = dirty tracked 전체). 'Commit WIP first'는 §Dirty Gate의 migrate 문구로 공시만 합니다. untracked 파일은 목록과 함께 (9)의 migrate 기존 untracked 문장을 공시합니다(D4).
  - §Step 4: 새 파일을 만들 때는 rollback.md §Created Files대로 생성 직전 부재를 확인하고 state.json `created_files[]`에 먼저 추가합니다. 경로가 이미 있으면(untracked·ignore 포함) created_files[]에 넣지 않습니다(D4). 명령(npm install, codemod, wrapper 등)은 실행 전후 `git status --porcelain -z --untracked-files=all` 비교로 새로 생긴 untracked 경로를 `created_files[]`에 추가합니다. ignore된 설치 산출물은 기록하지 않고 공시합니다.
  - §Step 6 Rollback 순서: (a) 되돌릴 목록 계산 — tracked 변경 = `git diff --name-only --no-renames -z HEAD`, 생성 = `created_files[]` 중 현재 존재하는 경로. .harness/와 docs/harness/<slug>/는 제외합니다. (b) 목록을 출력하고 AskUserQuestion으로 확인합니다(Manual fix 중 사용자가 한 편집도 포함됨과 (9)의 migrate 기존 untracked 문장을 명시). 비대화형이면 halt. (c) `git diff --cached --quiet`가 실패하면(무언가 staged) halt. (d) `git checkout --pathspec-from-file=<f> --pathspec-file-nul` 후 생성 목록을 파일 단위로 삭제. (e) `git status --porcelain --untracked-files=no`가 비어 있는지 확인, 아니면 1회 재시도 후 halt(브랜치 조작·.harness/ 삭제 금지). (f) `git checkout <original_branch>`, 실패하면 halt하고 branch -D 금지. (g) `git rev-list <original_branch>..harness/migrate-<slug>`가 비어 있을 때만 `git branch -D`, 비어 있지 않으면(pause 중 사용자 커밋) 삭제하지 않고 안내. (h) .harness/ 정리.
  - original_branch나 created_files가 없는 구세션은 자동 Rollback 없이 halt하고 수동 안내합니다.
  - has_git == false(HEAD 없음 포함): 시작 시 '자동 Rollback 없음'을 공시하고 Rollback 선택지를 숨깁니다.
  - REVIEW §8의 git restore 제안은 따르지 않습니다.

[S2 verify_git_safety.py — 인용 없는 게이트 대상 명령 금지]
- stdlib만 쓰고 --root 인자를 둡니다. 스캔 대상은 <root>의 skills·templates·workflows 아래 .md와 .js이며, 정확한 경로 `templates/_shared/rollback.md`만 제외합니다(basename 비교 금지).
- **절**: .md에서 매치의 절은 매치 줄 앞의 마지막 제목 줄부터, 수준과 무관하게 다음 제목 줄 직전까지입니다(하위 절 불포함). 첫 제목 앞 영역(frontmatter 포함)은 별도의 한 절입니다. 코드 펜스는 `^\s*(```|~~~)`로 여닫기를 짝지어 인식하고, 펜스 안 줄은 제목으로 보지 않습니다. 짝이 맞지 않으면 exit 2입니다. .js는 파일 전체가 한 절이며, 주석 인용 하나가 파일 전체를 허용한다는 점을 docstring에 공시합니다.
- 매칭: 줄 머리의 blockquote 접두(`^\s*>\s?`)를 제거한 뒤 절 안의 공백(줄바꿈 포함)을 정규화한 텍스트에서, 코드에 고정된 네 클래스((8)이 서술)를 찾습니다. rollback.md가 없어도 매치 스캔은 계속합니다(AC-8). 위치는 원래 줄로 역산해 출력하고, 겹치는 매치(checkout -- 와 -- .)는 한 번만 셉니다. JS 문자열 연결로 쪼개진 명령은 미검사로 공시합니다.
- 인용 토큰 = 리터럴 부분 문자열 `templates/_shared/rollback.md`입니다(`${CLAUDE_PLUGIN_ROOT}/` 접두 포함형도 해당하며, bare `rollback.md §…`는 인용이 아님). 허용 판정과 REQUIRED_CITERS 계수는 같은 토큰의 출현 횟수를 쓰고, HTML 주석 안 출현도 포함합니다(docstring 공시).
- 허용 조건(D5): REQUIRED_CITERS 5개 파일에서는 매치가 있는 절에 인용 토큰이 있으면 통과하고, 없으면 위반입니다. 그 밖의 파일의 매치는 인용 여부와 무관하게 allowlist 개수로만 판정합니다(인용된 매치도 계수에 포함). 문맥(부정어) 규칙은 쓰지 않습니다.
- allowlist: 형식은 (path, pattern_id, expected_count, reason)이고 개수는 zero-slack입니다. 착수 시 재실측해 고정합니다. 초기 후보: ship reset_hard(Stage 6.5 로컬 merge 되돌리기, pre_merge_sha), handoff clean_f 1건(경고문 'fresh clone'), team-memory stash·checkout_dd 금지문('Never use'), templates/harness/doctor.md checkout_dd 1건(플러그인 설치본 복구). 재실측으로 나오는 비생산자 매치는 사유와 함께 추가하고 slice 기록에 남깁니다.
- REQUIRED_CITERS: 생산자 SKILL.md 5개(test-gen, harness-build, refactor, md-optimize, migrate)만. {path: 인용 토큰 출현 횟수}를 실측값으로 정확히 고정합니다.
- 종료 코드: 1 = 위반, allowlist 개수 불일치, REQUIRED_CITERS 불일치, rollback.md §Guarded Commands의 pattern_id 누락. 2 = rollback.md 부재, allowlist path 부재, 펜스 짝 불일치. 둘 다 있으면 전부 출력하고 1을 냅니다. 이 우선순위와 미검사 변형은 docstring에 공시합니다.
- 새 SYNC 그룹은 만들지 않습니다(min_sites 불변).

[S3]
- YAML 파서 없이 plain scalar 불변식(' #', ': ', 선두 지시자)을 강제합니다. 따옴표로 감쌀 때는 내부의 큰따옴표와 백슬래시가 0개인지 확인합니다.
- segment description은 JS 이스케이프를 디코드한 뒤 셉니다.
- 다음을 출력합니다:
  - skill 합계 (현재 7,706)
  - segment 합계: 추출 대상은 `export const meta` 리터럴 안의 description만(스키마의 description 문자열 제외). 기준치는 착수 시 lint가 처음 출력한 값으로 정하고 측정 명령과 함께 slice 기록에 남깁니다(참고: critic 실측 3,594자) (M7)
  - 결합 합계: 이름 문자열 포함 여부를 docstring 측정 기준에 고정하고, 이름 포함값을 별도 줄로 출력합니다. ratchet ceiling과 목표 8,000 대비 초과량은 이름 포함값 하나에만 적용합니다. 이름 제외값은 기존 skill 합계 기준과 이어 보기 위한 참고 출력입니다.
  - 목표 상한 8,000 대비 초과량
- ceiling은 축소 후 실측값의 ratchet으로 둡니다. 결합 합계가 8,000 아래로 내려가지 않으면 잔여 위험으로 docstring과 slice 기록에 공시합니다.
- segment 설명은 dispatch 사이트 실측으로 기동 스킬을 적습니다. spec.eval은 /spec과 /harness 두 곳입니다.
- JSON.parse throw는 선택 항목입니다. 가드 줄을 보존하고 후속 줄에서만 수행하며, 게이트 토큰을 넣지 않습니다. 필수 키는 실측 dispatch 키로 한정하고, 확신이 없으면 보류합니다.

[S4 형식별 앵커 표]
대상 줄만 in-place로 편집하고, 원본 raw bytes를 보관하며, 나머지 줄은 바이트 단언합니다.
- package.json: $.version (JSON 줄 앵커 방식). 워크스페이스는 루트만 편집하고 하위는 감지만 합니다.
- package-lock.json: $.version, $.packages[""].version.
- pom.xml: project/version 직계 자식. 외부 parent는 불변입니다. 내부 parent, ${revision}, 프로젝트 version 없음은 감지만 하고 첫 매치 폴백 없이 중단합니다.
- build.gradle(.kts): 최상위 version = 줄만 편집합니다. plugins 블록은 제외하고, gradle.properties는 감지만 합니다.
- pyproject: [project].version, [tool.poetry].version. dynamic은 감지만 합니다.
- Cargo.toml: [package].version. workspace·dependencies는 감지만 합니다.
- *.csproj: Project/PropertyGroup/Version이 유일할 때만 편집하고, 여럿이면 감지만 합니다.
- 소스 상수: 한 줄 정규식 앵커가 파일당 정확히 1매치일 때만 편집하고, 그 외는 감지만 합니다.
- .claude-plugin/*.json 규칙은 그대로 둡니다.
Pass 1에서 미리보기 {path, line, before, after, status: edit|detected-only}를 state.json stage_results.version_bump_preview에 기록합니다. HARD-GATE 직전 Print 단계에 표시하고, 게이트 라벨과 구조는 바꾸지 않습니다. pass1_done에서 재개할 때 재계산값이 기록과 다르면 Pass 1 게이트를 다시 띄웁니다. Pass 2에서는 '변경 줄 집합 = 기록된 edit 줄 집합'을 단언합니다.

[S5]
- 'installed skills', 'invoke if found', 'invoke matches' 계열 지시를 걷어내고, 각 단계가 원래 원하던 행동을 짧은 인라인 지시로 대체합니다.
- 검색 결과에 기대는 후행 조건('if a … skill was found above', 'If no matching skill is found', 'If no skill is available')과 '## Available Skills' 제목도 함께 걷어냅니다. 해당 단계는 원래 조건(TDD는 'if tests are available', 병렬 분해는 독립 하위 작업이 있을 때)을 붙인 인라인 지시로 남기고, 단계 자체를 삭제하지 않습니다.
- 쌍 대조 기준: 두 쪽 모두에 있던 지시는 같은 대체 문장으로 바꿉니다. 한쪽에만 있던 지시는 그쪽에서만 대체하고 기존 드리프트로 공시합니다(예: migrate.eval TPL에만 있는 verification-before-completion).

[S6]
- 문맥 단위로 수정하고 전역 치환은 하지 않습니다.
- 사설 이름 목록은 gitignored docs/ slice 기록에만 둡니다. study_measurements.md의 ## § 제목을 바꾸면 인용 지점도 같은 커밋에서 수정합니다(현재 18개 제목에는 없는 것으로 실측).

[에픽 자기참조]
- state.json의 lint_cmd는 Setup 시점에 고정되어 있습니다. 따라서 S2 이후 slice 기록에는 verify_git_safety.py 수동 실행 결과를 남깁니다.
- state 갱신은 슬라이스 경계에서만 허용합니다.

### 완료 기준

- [ ] AC-1: templates/_shared/rollback.md가 [S1] (1)~(9)의 아홉 절과 그 규칙을 빠짐없이 담습니다. 특히 확인할 것: 표 밖 파일의 allowlist 한정(D5), 진행 중 표식(null 뒤 사본 삭제)과 복구 선출력(위치 — (i)은 test-gen·refactor gate 0 앞, (i)~(iii) 순서, 분류별 해결 판정 — copy는 사본 부재, (iii) 뒤 필드 null, halt 조건), 패치 형태 거부, 경로 위반의 생산자별 처리(harness-build의 `.harness-backup/` 제외 포함), 경로 취급, §Git Restore의 pathspec 파일 형태, HEAD 없음 → copy, blocked 분류, smudge 바이트 일치(불일치 → copy)(D1), 질문 세션당 1회, 재검사 후 dirty·blocked면 재질문 없이 halt(copy 재분류는 §Copy Path로 진행), Checkpoint 해체(`{sha, branch, paths}`, 조작 종료 직후 단일 해체 지점, HEAD==sha 조건)와 Checkpoint 공시(git 명령 없음, migrate 한 문장 예외)(D2), 비대화형 halt와 session_conflict.md §Gate Procedure item 6 인용, `.harness-backup/`·자기무시 .gitignore·사본 경로 선존재 시 halt(D3), Stash Restore Notice 단일 위치와 apply --index, stash 제목 접미 매칭, pattern_id 리터럴, 조작 도중 편집·HEAD 이동 미감지와 md-optimize 크래시 미통지 공시.
- [ ] AC-2: test-gen에서 `git diff --quiet` 판정과 force-revert가 사라집니다. WORKFLOW 3a·3d·4와 INLINE 2·5번이 rollback.md §Clean Check·§Dirty Gate·§Git Restore·§Copy Path를 인용합니다. dirty 대상의 변이는 score.protected로 세고, totalScored==0 ∧ protected>0이면 verdict가 UNMEASURED이며 `Protected (WIP): n`이 출력됩니다. 경로 위반 proposal은 그 변이만 skipped이고, 변이 대상 파일과 같은 파일의 테스트는 strengthen하지 않고 weak+suggestedAssertion으로 남깁니다. `mutation_in_flight`가 적용 직전 설정·복원 검증 직후 null이고, §Session Recovery에 (1)의 위치대로 복구 선출력이 있으며((i)은 gate 0보다 앞), 표식이 남은 채 미해결 경로가 있으면 Resume을 제시하지 않고 halt합니다. clean guard 통과 직후 Checkpoint 해체를 인용하고, clean guard 실패면 복원 없이 halt합니다. judge 주석 두 곳, schemas.md §MutationVerdict, §Key Rules 두 줄, has_git note가 이와 일치하고, `grep -nE "diff --quiet|git-diff-clean" skills/test-gen/SKILL.md workflows/test-gen.judge.workflow.js workflows/_reference/schemas.md` 결과가 0건입니다(명령 없는 "clean guard" 서술과 README 도식은 불변).
- [ ] AC-3: harness-build §Step 5와 refactor Auto-fix가 [생산자별 변경]의 순서(헤더 파싱·경로 검증 → … → 적용)이고, 패치 형태 위반은 거부하며, hunk 실패 시 clean은 checkout, copy는 사본 복원, 신규 파일은 삭제로 되돌립니다. 두 파일에서 `git stash` 스냅샷과 .harness/autofix_pre_apply/ 참조가 0건이고, Abort가 각각 해당 HARD-GATE(Auto-fix 숨김)로 돌아갑니다. `autofix.apply_in_flight` 설정·해제, 적용 성공·복원 완료 직후 Checkpoint 해체 인용, 복구 선출력(harness-build는 'Follow session_recovery.md' 문장 앞 한 줄과 'byte-identical' 머리말의 예외 명시, refactor는 (1)의 위치 — (i)은 gate 0보다 앞)이 있고, refactor의 has_git이 §Step 1 첫 git 명령 전에 검출되어 11번 필드로 저장됩니다.
- [ ] AC-4: refactor §Step 1 4번 Stash first가 rollback.md §Stash Guidance 인용으로 사전 중복 stash 경고(제목이 `: harness-refactor-<slug>`로 끝나는 stash), `-m "harness-refactor-<slug>"` push, 전후 list 비교를 수행하되 git stash 철자를 재진술하지 않고, `stash_sha`(없으면 null과 안내 문구)가 §Step 1 11번에 기록됩니다. 열거된 종료 지점(§Step 1 7번 두 halt, Step 3 Stop, Step 4 Auto-fix Stop, Step 4-MC abort, Step 7)이 모두 Stash Restore Notice를 가리키고, 복원 안내의 git stash 철자(apply·list %gd·drop)는 그 문단 한 곳에만 (7)의 형태(apply --index와 재시도, %gd로 찾은 stash@{n} drop)로 있으며, `pop <sha>` 안내는 0건, 라벨 설명에 git 명령이 없습니다. Revert step 문장이 Edit 역적용·git 복원 금지를 명시합니다.
- [ ] AC-5: md-optimize의 §Exclusion List에 .harness/·.harness-backup/, §1a 맨 앞 잔여 사본 halt, §1a 1번(no-git 사본 복원 가능), 2번(범위 안 .md — §1b 인벤토리와 같은 필터 — 의 비clean 경로 공시만, 질문 없음), Phase 3 머리말(첫 쓰기 직전 확정 대상에 §Clean Check·§Dirty Gate, 대상 한정 checkout + 생성 파일 삭제 안내)이 있습니다. 조작 범위가 §4d까지이고, Phase 4가 copy 대상에 사본 비교를 제공하며, Phase 5 Report 직후에 사본 삭제와 Checkpoint 해체 인용이 있고, §Dirty Gate 질문이 Phase 3 머리말 밖(§1a·§1b·Phase 2)에 없습니다. Safety Rules 두 줄이 rollback.md와 일치하고, `git checkout -- .`와 stash 권고가 0건입니다.
- [ ] AC-6: migrate §Step 1이 'has_git 검출(첫 git 명령보다 앞에서 검출, 12번 필드로 저장) → 브랜치 검사(2번 slug 산출 뒤. 현재 브랜치가 `harness/migrate-*`이거나 `harness/migrate-<slug>`가 이미 있으면 트리 상태·진입 경로(Resume `setup` 포함)와 무관하게 halt, 정리 방향 출력(기록이 있으면 original_branch도), 자동 조치 없음) → 숨김 플래그 경로 공시 → 전체 clean 게이트' 순서이고, 게이트가 모든 쓰기(기준선 테스트, 디렉터리 생성, 브랜치 생성)보다 앞에 있으며, Commit WIP first는 migrate 문구의 Checkpoint 공시만 하고 state에 기록하지 않습니다. §Step 4가 §Created Files의 부재 확인으로 기존 경로를 created_files에서 제외하고(D4) 명령 전후 `-z` 비교로 기록합니다. Rollback이 [생산자별 변경] migrate의 (a)~(h) 순서와 halt 분기를 따르고, `git checkout -- .`·git clean·reset --hard가 없습니다. 구세션은 halt하고, has_git == false(HEAD 없음 포함)에서는 Rollback 선택지가 숨겨지고 Step 1의 git 조작을 건너뜁니다.
- [ ] AC-7: scripts/verify_git_safety.py가 [S2]를 구현합니다: stdlib 전용, --root, 정확 경로로만 rollback.md 제외, 평탄 절 정의(preamble 절, 펜스 짝·불일치 exit 2, .js 1절), blockquote 제거 후 공백 정규화 매칭과 원래 줄 역산, 코드 고정 네 클래스와 전역 옵션(-C/-c/--<옵션>) 정규식, pattern_id 리터럴 확인, 인용 토큰 정의, 생산자 5개 한정 인용 허용(D5), 사유 필수 zero-slack allowlist(doctor.md checkout_dd 포함), 정확 개수 REQUIRED_CITERS, 종료 코드 0/1/2와 '1 우선' 규칙, docstring 공시(문맥 규칙 미사용, 미검사 변형, .js 1절·HTML 주석 인용). 현재 트리에서 exit 0이어야 합니다.
- [ ] AC-8: S1 이전 커밋을 저장소 밖에 git archive로 추출한 트리를 --root로 스캔하면 exit 1이 나야 합니다. 출력에는 S1 대상 파일(test-gen·harness-build·refactor·md-optimize)의 인용 없는 게이트 대상 매치와 rollback.md 부재 구조 문제가 함께 보고되고, 그 출력과 git status --porcelain 빈 출력이 slice 기록에 남아 있어야 합니다.
- [ ] AC-9: 같은 커밋에서 다음이 모두 갱신되고 check_lint_wiring.sh가 통과해야 합니다: lint.yml 한 줄 run, CLAUDE.md(§Commands 표, 0열·펜스 밖 lint-cmd, §Architecture scripts/ 행, 'Run all six', §Verification 'The six lints'와 새 lint 불릿; 'six layers'는 불변), README(lint 목록, §Project Defaults의 'seven commands' 개수).
- [ ] AC-10: PyYAML로 19개 SKILL.md description을 파싱한 값이 lint 측정값과 일치하고(harness-gate가 잘리지 않음), 그 1회성 증거가 slice 기록에 있어야 합니다. budget lint는 plain scalar의 ' #', ': ', 선두 지시자를 실패시켜야 합니다.
- [ ] AC-11: lint 출력에 skill 합계, segment 합계, 결합 합계(ratchet·목표 비교는 이름 포함값 단일 기준, 이름 제외값은 참고 출력), 목표 8,000 대비 초과량이 나오고, segment·결합 합계는 ratchet ceiling을 가져야 합니다. segment 합계는 S3 착수 시 lint가 처음 출력한 기준치(meta 리터럴 description만, 측정 명령 기록)보다 줄어야 하고, 목표 미달이면 잔여 위험으로 공시되어야 합니다. segment 설명의 기동 스킬은 dispatch 실측과 일치하고(spec.eval은 두 기동자), docstring의 자기무효화 서술('no other skill quotes', 'exactly 6')은 수치 추가 없이 정정되어야 합니다.
- [ ] AC-12: ship Pass 2가 앵커 표의 대상 줄만 편집합니다. 대상은 package.json, package-lock.json, pom, gradle, pyproject, Cargo, csproj, 소스 상수(1매치 조건)입니다. Spring Initializr형 pom의 parent, package.json의 ^1.2.0 의존성, 워크스페이스 하위 package.json은 바뀌지 않고, 표 밖 형태는 detected-only로 미리보기에 표시되어야 합니다. 미리보기는 state.json version_bump_preview에 기록되고, 재개 시 재계산값이 기록과 다르면 Pass 1 게이트를 다시 띄웁니다. Pass 2는 변경 줄 집합이 기록된 edit 줄 집합과 같다고 단언하며, HARD-GATE 라벨은 불변이어야 합니다.
- [ ] AC-13: `grep -rniE "installed skills|invoke (if found|matches)|skill was found|## available skills|matching skill|no skill is available" templates workflows skills` 결과가 0건이어야 합니다. 템플릿↔TPL 쌍 대조표가 slice 기록에 있고, 두 쪽에 모두 있던 지시는 같은 대체 문장이며, 한쪽에만 있던 지시는 드리프트로 공시되어야 합니다.
- [ ] AC-14: README 정정 항목마다 근거 파일 §섹션이 slice 기록에 있고, harness-gate의 design/ 'gitignored' 오기가 정정되어야 합니다. 착수 시 추출한 사설 이름 목록을 저장소 전체에서 grep한 결과가 HEAD 기준 0건이어야 합니다(docs/·.harness/ 제외, 이력 잔존은 공시).
- [ ] AC-15: 각 슬라이스 종료 시 CLAUDE.md lint-cmd 체인 전체가 green이고 git status로 확인한 트리 오염이 0이어야 합니다. S2 이후의 slice 기록에는 verify_git_safety.py 수동 실행 결과가 남아 있어야 합니다.
- [ ] AC-16: S7 PROBE.md에 재시작한 새 세션에서의 결과가 기록되어야 합니다. (a) WIP가 있는 변이 대상에서 /test-gen이 §Dirty Gate를 띄우고, Abort면 대상 sha256 불변·변이 protected, Commit WIP first면 checkpoint 커밋 후 변이·복원 뒤 sha256 동일, 해체 후 `git rev-parse HEAD`가 checkpoint 이전 커밋이고 대상 경로가 unstaged 변경으로 남음. (b) clean 대상 변이 후 porcelain 빈 출력. (c) untracked 대상, CRLF·끝 개행 없음 대상, eol 속성과 작업 트리 EOL이 어긋난 tracked 대상이 사본 경로로 바이트 보존(D1). (d) git stash list 불변(Stash first 미선택 시). (e) harness-gate 설명이 잘리지 않음. (f) segment 항목 표시 상태와 그 시점의 결합 합계 관측 기록(목표 미달이면 잔여 위험으로만 기록).
- [ ] AC-17: 폐기된 설계의 잔재가 없어야 합니다: `git grep --untracked -nE "MANIFEST\.json|rollback_run_id|post_sha256|Pre-delete Check|autofix_pre_apply" -- skills templates workflows ':(exclude)templates/_shared/rollback.md'` 결과 0건(레거시 공시는 (9)가 요구). templates/_shared/path_validator.md·session_conflict.md·session_recovery.md와 debug·ship·spec SKILL.md가 S1 목적으로 바뀌지 않음(판정: S1 슬라이스 시작 커밋~종료 커밋 범위의 `git diff --name-only` 출력에 해당 파일이 없음. S4의 ship 변경은 이 판정 밖).

### 테스트 전략

- [최고 위험] dirty 대상 보호: WIP가 있는 파일을 변이·Auto-fix·md-optimize 대상으로 두고, §Dirty Gate가 조작보다 먼저 뜨는지, Abort면 sha256 불변, Commit WIP first면 pathspec 커밋이 대상만 담는지, 조작 종료 직후 해체(HEAD≠sha·halt면 Checkpoint 공시, md-optimize 쓰기 전 종료에는 checkpoint 없음), 세션당 질문 1회, 비대화형 halt를 문면으로 추적하고 S7에서 행동으로 확인합니다.
- 분류: assume-unchanged·skip-worktree 파일과 unmerged·merge 진행 중 대상이 blocked, staged만 된 파일이 dirty, HEAD 없는 저장소의 staged 파일이 copy, EOL 불일치 tracked 대상이 copy로 판정되는지, core.autocrlf=true에서 LF 파일을 Commit WIP first로 커밋한 뒤 재검사가 copy로 재분류하고 halt 없이 진행하는지 추적합니다.
- 경로: 하위 디렉터리 cwd, 비ASCII·공백 경로, `[id].tsx` 같은 glob 문자 경로에서 경로 취급 규칙(`-C <root>`·`--literal-pathspecs`·`-z`·pathspec 파일)이 판정과 복원을 맞게 하는지 저장소 밖 임시 저장소로 확인합니다.
- 검사 시점: 스킬 자신이 앞서 수정한 파일이 Auto-fix 시점에 dirty로 판정되는지, 검사 뒤 stage하는 경로가 없는지 확인합니다.
- 복원 정확성: clean 대상 checkout이 목록 밖 파일을 건드리지 않는지, 복원 후 재검사·1회 재시도·halt 분기, `-- .`·디렉터리 pathspec이 문면에 없는지 확인합니다.
- copy 경로: 사본 생성·해시 확인·복원·표식 null 뒤 삭제, `.harness-backup/.gitignore` 생성, 도구가 전부 없을 때 halt, 잔여 사본이 있을 때 각 시작 위치에서 halt하는지 추적합니다. CRLF·BOM·끝 개행 없음 fixture로 해시 일치를 확인합니다(S7).
- 크래시: in-flight 표식·`wip_checkpoint`·잔여 사본이 남은 새 세션에서, 복구 선출력이 (1)의 위치에서 질문보다 먼저 나오는지, 미해결 경로·잔여 사본이면 질문 없이 halt하는지, 수동 복원·사본 삭제 뒤 재호출하면 copy 표식이 해결되는지(영구 halt 없음, has_git == false·Generator 신규 파일 포함), (iii) 뒤 필드 null, 다른 스킬 세션이 끼어든 뒤 gate 0 'Delete and start'로 재진입해도 잔여 사본에서 halt하는지(사본 경로 선존재 halt 포함) 추적합니다.
- test-gen 점수: 대상 전부가 dirty일 때 UNMEASURED, 같은 파일 테스트 언어에서 strengthen 생략, 경로 위반 proposal의 개별 skipped, clean guard 실패 시 복원 없는 halt를 추적합니다.
- migrate: [생산자별 변경] migrate의 §Step 1 순서, 브랜치 검사(clean 트리·untracked 잔여·Resume `setup`·같은 slug 브랜치 존재에서 halt, 기록이 있으면 original_branch 출력, 그 밖에서는 진행), created_files 기록(기존 경로 제외), Rollback (a)~(h)의 각 halt 분기, 구세션 halt, no-git Rollback 숨김을 단계별로 추적합니다. lockfile은 tracked이므로 checkout으로 복원되는지도 봅니다.
- refactor Stash first: untracked만 있을 때 null, 사전 중복 경고('On <branch>: ' 접두가 붙은 제목에서도 발동), Stash Restore Notice 단일 위치(AC-4)를 확인합니다.
- S2 lint 회귀: 현재 트리 exit 0, 구 트리 exit 1(구조 문제 동시 보고)을 확인합니다. scratch fixture로 줄바꿈으로 갈린 명령, 인용이 다른 절에 있는 경우(위반), 같은 절에 있는 경우(허용), 중첩 제목(인용이 하위 절에만 있음 / 상위 절 본문에만 있음 → 둘 다 위반), blockquote 안 명령, 펜스 안 `#` 줄, 짝 없는 펜스(2), 비생산자 파일의 인용된 매치(allowlist 계수), bare `rollback.md §` 인용(인용 아님), allowlist 개수 불일치, REQUIRED_CITERS 불일치(1), rollback.md 부재 단독(2), `git -C x checkout -- y`·`git --literal-pathspecs checkout -- y`·`git reset -q --hard` 형태를 검증합니다. 모두 저장소 밖에서 실행합니다.
- S3: PyYAML 대조 1회, ' #' 가짜 frontmatter로 lint가 실패하는지, segment·결합 합계와 목표 초과량 출력을 확인합니다.
- S4 부정 예시 추적: 앵커 표의 각 행과 detected-only 형태, 미리보기 state 기록, pass1_done 재개 시 불일치하면 게이트가 다시 뜨는지, edit 줄 집합 단언을 확인합니다.
- S5 쌍 대조: 템플릿과 TPL 대체 문장을 diff하고, 후행 조건 제거 후 TDD·병렬 단계가 원래 조건으로 남았는지와 드리프트 공시를 확인합니다.
- 각 슬라이스 종료: lint-cmd 전체를 실행하고, git status --porcelain으로 오염 0을 확인하며, 워크플로 파일은 커밋 전에 working-tree CR 검사를 합니다.

### 엣지 케이스

- 대상이 staged만 되어 있고 작업 트리는 index와 같으면: porcelain에 나타나므로 dirty입니다. `git checkout -- p`는 index 내용을 복원하므로, clean 판정이 아니면 절대 쓰지 않습니다.
- assume-unchanged·skip-worktree 파일: porcelain이 변경을 숨기므로 ls-files -v 태그로 blocked 처리합니다(Abort 의미).
- HEAD가 없는 저장소(첫 커밋 전): `rev-parse --verify` 실패로 감지해 staged 파일을 포함한 모든 대상을 copy로 분류합니다(게이트·checkpoint 커밋 없음).
- 작업 트리 EOL이 smudge 결과와 다른 tracked 파일(예: `*.md text eol=lf`인데 작업 트리가 CRLF): porcelain은 비어 있어도 해시가 달라 copy로 분류합니다.
- 비ASCII·공백 경로: git 출력은 -z로 읽고 목록은 pathspec 파일로 넘기므로 core.quotePath 이스케이프의 영향을 받지 않습니다.
- 같은 파일에 테스트를 쓰는 언어(Rust 인라인 테스트 등): Phase 2가 소스 파일을 수정하므로 변이 시점에 dirty입니다. Commit WIP first는 생성된 테스트까지 커밋하고, Abort는 그 변이를 protected로 기록합니다. strengthen은 하지 않습니다.
- 'Commit WIP first' 커밋이 pre-commit hook·서명 요구로 멈추거나, merge 진행 중이라 pathspec 커밋이 거부되는 경우: 후자는 blocked로 먼저 걸리고, 전자는 halt합니다(아무것도 바꾸지 않음).
- 검사와 조작 사이에 사용자가 대상을 편집하면: 변이마다 재확인하고 md-optimize는 Phase 3 첫 쓰기 직전에 검사하므로 그 조작 직전에 다시 걸립니다. 조작 도중 편집은 §Residual Risks에 공시합니다.
- 패치가 만드는 경로(`--- /dev/null`)가 이미 untracked로 존재하면 created가 아니라 copy로 재분류합니다. 패치가 지우는 파일(`+++ /dev/null`)이 clean이면 실패 시 checkout으로, copy 대상이면 사본으로 되살립니다. rename·copy·mode 헤더가 있는 패치는 분류하지 않고 거부합니다.
- migrate가 기존 untracked 경로에 파일을 '생성'하면 부재 확인에 걸려 created_files에 들어가지 않으므로 Rollback이 그 파일을 지우지 않습니다.
- migrate "Manual fix & resume" 중 사용자가 migrate와 무관한 파일을 편집하면 Rollback 목록에 포함됩니다. 목록 확인 질문에서 드러나며, 거절하면 halt합니다.
- migrate pause 중 사용자가 migrate 브랜치에 커밋하면 Rollback (a)의 `git diff … HEAD`가 그 커밋을 보지 못하고, rev-list 검사가 branch -D를 막습니다. 커밋된 변경의 되돌리기는 수동 안내입니다.
- 완료된 migration 브랜치('Commit code only'·'No commit' 뒤) 위에서, 또는 같은 대상을 다시 올리려고 같은 slug로 migrate를 시작하면 §Step 1 브랜치 검사에서 halt합니다(정리 방향은 그 halt 메시지가 안내).
- refactor Stash first에서 변경이 untracked뿐이면 stash_sha는 null입니다. git stash pop <sha>·drop <sha>는 거부되므로 apply --index <sha> 후 stash@{n}을 찾아 drop합니다.
- S2: 한 절에 게이트 대상 명령이 여러 번 나와도 인용 하나로 모두 허용됩니다(생산자 5개 파일). 인용이 하위 절에만 있으면 상위 절의 매치는 위반이고, 반대로 인용이 상위 절 본문에만 있고 매치가 하위 절에 있어도 위반입니다.
- ship: 내부 parent 멀티모듈, ${revision}, 프로젝트 version 없는 pom, Gradle plugins 블록, gradle.properties, Cargo workspace·dependencies, pyproject dynamic, csproj PropertyGroup 다중, 소스 상수 0매치 또는 2매치 이상, 워크스페이스 하위 package.json은 detected-only입니다. package-lock의 packages[""].version은 편집 대상입니다.

### 위험

- (orchestrator, high) harness-build·refactor Auto-fix의 대상은 Generator·앞 단계가 이미 수정한 파일이라 거의 항상 dirty입니다. — 절 안에 명시하고, checkpoint는 조작 종료 시 해체합니다. Auto-fix는 세션당 1회라 빈도는 낮습니다.
- (orchestrator, med) halt로 남은 사본이 다른 경로로 사라지거나 새 사본에 덮일 수 있습니다. — §Copy Path(.harness/ 밖 자기무시 위치, 선존재 시 halt)와 복구 선출력 (i).
- (orchestrator, med) 검사를 스킬 시작 시 한 번만 하면 그 사이 사용자 편집이 checkout으로 사라집니다. — §Clean Check의 '첫 수정 직전'(test-gen 변이마다, md-optimize Phase 3 첫 쓰기 직전). migrate만 시작 시 1회이며 Rollback 전 목록 확인으로 보완합니다.
- (orchestrator, med) migrate Rollback의 목록에 pause 중 만든 무관한 편집이 섞이거나, 기존 untracked 편집이 빠질 수 있습니다. — 실행 전 목록과 비복원 범위를 출력하고 확인받습니다. 비대화형이면 halt합니다.
- (orchestrator, med) migrate가 이전 시도의 브랜치 위에서 다시 시작하면 original_branch 오기록과 `checkout -b` 충돌이 생깁니다. — §Step 1 브랜치 검사로 halt합니다(대가: 연쇄 실행은 병합 뒤로).
- (architect, senior_developer, qa_specialist, high) test-gen의 git diff --quiet clean guard가 HEAD와 비교하므로, 명령만 바꾸면 WIP 파일에서 거짓 dirty 판정과 재복원이 계속됩니다. — 변이 대상을 clean으로 제한해 HEAD 비교가 참이 되고, dirty 대상은 protected로 셉니다.
- (qa_specialist, low) has_git note 바로 뒤의 §Ambiguity Prompt 불릿과 SYNC-WITH 마커 줄을 함께 편집하면 SYNC 사이트가 깨질 수 있습니다. — has_git note 불릿만 고치고, 각 커밋 전에 verify_sync_markers를 실행합니다.
- (architect, senior_developer, qa_specialist, high) 금지 패턴이 좁으면 git restore, checkout HEAD --, stash push 같은 동의어로 재유입되고, 구현자가 REVIEW §8의 git restore 제안을 따를 수 있습니다. — §Guarded Commands가 클래스·동의어·옵션 순서를 정의하고, REVIEW §8 불채택을 명시하며, 미검사 변형은 docstring에 공시합니다.
- (orchestrator, med) '같은 절 인용 = 허용'은 인용만 붙이면 통과하는 구멍입니다. — D5로 생산자 5개에 한정하고, 생산자 절의 인용이 계약 준수를 보장하지 않음을 docstring에 공시합니다.
- (senior_developer, qa_specialist, plan_critic, med) copy 경로의 Read→Write 왕복은 CRLF, BOM, 비UTF-8, 끝 개행을 조용히 바꿉니다. — §Copy Path 바이트 도구, S7 fixture.
- (qa_specialist, senior_developer, plan_critic, med) 위치 기반 stash 안내나 pop <sha>, 실패를 무시한 migrate branch -D는 대상을 바꾸거나 손실을 만듭니다. — §Stash Guidance, migrate Rollback (e)~(g).
- (orchestrator, low) 복원 바이트 동일은 검사와 복원 사이에 .gitattributes나 core.autocrlf가 바뀌면 깨질 수 있습니다. migrate는 smudge 조건을 적용하지 않습니다. — §Git Restore에 공시합니다.
- (architect, senior_developer, qa_specialist, plan_critic, med) S4의 'parent 제외' 일률 규칙과 csproj·소스 상수·lockfile 누락은 회귀나 새 오편집을 만들고, 메모리 전용 미리보기는 재개 시 게이트 보장을 깹니다. — [S4] 앵커 표.
- (architect, plan_critic, high) skill 합계만 7,706자이므로 결합 합계가 목표 8,000 아래로 내려가지 않을 가능성이 큽니다(M11 잔존). — 결합 합계·초과량 출력과 ratchet, 미달은 docstring·README·PROBE에 공시(AC-16은 관측 기록).
- (qa_specialist, med) segment 설명의 'launched by /<skill> only'가 사실과 다를 수 있습니다(spec.eval). — dispatch 사이트 실측 표를 근거로 씁니다.
- (senior_developer, qa_specialist, architect, high) harness-gate를 따옴표로 감싸면 budget lint docstring의 'no other skill quotes'와 'exactly 6'이 거짓이 됩니다. — 같은 커밋에서 수치 추가 없이 고치고, dated Correction 누적은 금지합니다.
- (architect, senior_developer, qa_specialist, med) 선택 항목인 JSON.parse throw가 ARGS_GUARD를 깨거나 정상 호출을 INLINE으로 폴백시킬 수 있습니다. — [S3]의 제한을 따르고, 확신이 없으면 보류합니다.
- (architect, senior_developer, qa_specialist, plan_critic, high) S5 grep이 변형 문구나 후행 조건을 못 잡으면 TDD·병렬 단계가 소리 없이 사라지고, 템플릿과 TPL이 어긋날 수 있습니다. — [S5]와 AC-13.
- (qa_specialist, senior_developer, plan_critic, med) lint 개수 서술을 전역 치환하면 무관한 'six layers'까지 오염되고, 누락하면 자기무효화 수치가 생깁니다. — AC-9의 열거 위치만 문맥 단위로 수정.
- (architect, senior_developer, qa_specialist, med) 사설 저장소명 익명화는 HEAD만 정리합니다. — AC-14를 HEAD 기준으로 한정하고 이력 잔존을 공시, 커밋 직전 staged diff·메시지 grep.
- (qa_specialist, med) lint는 문면만 봅니다. 실행 중 모델의 이탈이나 PyYAML과 실제 frontmatter 파서의 차이는 잡지 못합니다. — AC-16 프로브.
- (architect, senior_developer, qa_specialist, med) 이 에픽을 실행하는 설치본 v8.14.0에는 M1이 살아 있어, HARD GATE #3에서 Apply patch를 고르면 에픽의 WIP가 stash로 빠집니다. — 게이트마다 금지를 재고지하고 필요하면 커밋 후 수동 적용합니다. S7 전에 설치본 2사본을 동기화하고 재시작합니다.
- (plan_critic, low) 보호 범위 밖 경로(기존 테스트 파일 수정, refactor Revert step)를 사용자가 보호된다고 오해할 수 있습니다. — §Residual Risks와 해당 스킬에 공시.

### 구현 단계

- 1. S1 계약: templates/_shared/rollback.md를 신설합니다([S1] (1)~(9)). 착수 시 `grep -rnE "git (checkout|stash|reset --hard|clean|restore)" skills templates workflows`로 현재 사이트를 재실측해 §Scope 표와 대조하고 slice 기록에 남깁니다.
- 2. S1 test-gen: [생산자별 변경] test-gen 전부(AC-2). judge 워크플로 주석 두 곳은 LF를 유지합니다.
- 3. S1 Auto-fix: [생산자별 변경] harness-build §Step 5 · refactor §Step 4 Auto-fix 전부(AC-3).
- 4. S1 refactor: [생산자별 변경] 공통(has_git·세션 값 규칙)과 refactor 전부(AC-4).
- 5. S1 md-optimize와 migrate: [생산자별 변경] md-optimize·migrate 전부(AC-5·AC-6). 슬라이스 종료 시 AC-17 잔재 grep과 lint-cmd 전체를 실행하고, (8)의 클래스와 [S2]의 절 정의로 저장소 밖 임시 스캔을 돌려 생산자 5개에 인용 없는 매치가 0건임을 slice 기록에 남깁니다.
- 6. S2: verify_git_safety.py를 신설합니다([S2] 전체). 같은 커밋에서 lint.yml, CLAUDE.md 다섯 곳, README 두 곳을 배선합니다. 저장소 밖 scratch에 S1 이전 커밋을 git archive로 풀어 --root로 exit 1을 확인하고 기록합니다.
- 7. S3: harness-gate description을 큰따옴표로 감쌉니다. budget lint에 [S3]의 불변식·합계·초과량 출력·ratchet을 넣고 docstring 서술을 정정합니다. segment 15개 설명을 dispatch 실측 기반의 'INTERNAL — launched by …' 한 줄로 줄입니다.
- 8. S5: 템플릿 7개와 TPL_* 사본 4개 워크플로에서 키워드 스킬 호출 지시와 후행 조건을 인라인 행동 지시로 대체합니다. 쌍 대조표를 남기고 드리프트를 공시합니다. BLOCK 내부 변경이 있으면 버전을 올립니다.
- 9. S4: ship §Version Detection 표를 앵커 기준으로 바꿉니다. Pass 1에는 형식별 앵커 표, detected-only 분류, 미리보기의 state.json 기록과 Print 단계 표시를 넣습니다. Pass 2에는 앵커 편집, edit 줄 집합 단언, 바이트 단언 확장을 넣습니다. §Session Recovery pass1_done 재개 시 재계산하고, 불일치하면 게이트를 다시 띄웁니다.
- 10. S6: README를 사실대로 정정합니다(Install 상단, --fast, mode roundtrip, non-opted 서술, 비용 수치, largest skill, ## workflow 제목, HARD GATE 잔여 위험, '문서 정합성 lint — 동작 테스트 아님', 재시작 안내, 결합 예산 잔여 위험). harness-gate의 design/ 오기를 고치고, study 두 파일을 익명화합니다.
- 11. S7: 설치본 2사본을 동기화하고 프로세스를 재시작한 새 세션에서, 저장소 밖 fixture로 라이브 프로브를 실행해 PROBE.md에 기록합니다(AC-16의 시나리오).
