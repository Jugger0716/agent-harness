# Stage 1 practitioner hardening — data-loss paths, git-safety lint, listing hygiene, README truth

> 에픽 태스크 설명문 (초안). 근거: 2026-09-29 실무자 적대 리뷰 보고서 `design/practitioner-hardening/REVIEW.md`
> (finding id C1, M1~M4, M11~M14, M17, L7-10 등은 그 보고서의 id).
> 실행: `/harness "Stage 1 practitioner hardening — see design/practitioner-hardening/STAGE1.md" --epic`
> (태스크 문자열을 영어로 시작하는 이유: 한국어 태스크는 slug가 붕괴한다 — 보고서 M10.)

## 목표

일반 실무 저장소(커밋 안 된 WIP가 있는 기능 브랜치, Spring/Node 프로젝트)에서 이 플러그인을 처음 쓰는
개발자가 **데이터를 잃지 않고**, **스킬 목록과 README가 사실을 말하도록** 만든다. 아키텍처(3분할 게이트,
Mode Gate, INLINE 기본값, Evaluator)는 동결한다 — 이 단계는 국소 수정만 한다.

## 범위 밖 (2·3단계로 이월 — 이 에픽에서 건드리지 않는다)

- 공유 dirty-tree 게이트·`/harness abort`·`base_sha` 기록 (M5)
- 산출물 위생·"Commit code only" 라벨 통일·check-ignore 게이트 (M8)
- `test-cmd`/`build-cmd` defaults 키, 기존 실패 기준선, migrate 의존성 동기화 (M7)
- `/harness --from-spec` (M6), slug 붕괴 접미사 (M10), Fast Gate spec 요약·트리아지 (M9)
- `/ship`의 changelog 절·`--prerelease`·태그 형식·dry-run·DAG 순서 (M15)
- 행동 eval·stub 러너·본문 바이트 ratchet (M13, M14) · 스킬 통폐합

## 슬라이스

순서가 의존성이다: S2의 lint는 S1이 끝난 트리에서만 green이 된다.

### S1 — 롤백·스냅샷을 바이트 사본으로 통일 (C1, M1, M2, M3)

- 새 단일 소스 `templates/_shared/rollback.md`: "수정 전 대상 파일의 바이트 사본을 `.harness/<skill>_backup/`에
  만들고, 복원은 그 사본으로만 한다. `git checkout -- <path>`, 인자 없는 `git stash`, `git checkout -- .`,
  `git reset --hard`, `git clean -f`는 롤백·스냅샷·복구 안내에 쓰지 않는다." 선례는
  `skills/team-memory/SKILL.md` §Step 1.5 (e)와 no-git 경로의 `.harness/autofix_pre_apply/` 복사다.
  git 유무와 무관하게 같은 경로를 쓴다.
- 교체 대상 (모두 새 단일 소스를 **이름으로 인용**, 본문 재진술 금지):
  - `skills/test-gen/SKILL.md` §Mode Gate의 `has_git` note, §Phase 3: Verification의 Back up 단계와
    dirty 시 force-revert 단계 → 사본 백업/복원. `state.json`에 `active_mutation`(파일·사본 경로)을 기록하고,
    §Session Recovery 진입 시 `active_mutation`이 남아 있으면 **다른 어떤 동작보다 먼저** 사본에서 복원한다.
  - `skills/harness-build/SKILL.md` §Step 5 "If 'Apply patch'" 1번의 `git stash` 스냅샷
  - `skills/refactor/SKILL.md` §Step 4: Phase 2 — Execution의 Auto-fix 스냅샷(`git stash`)
  - `skills/refactor/SKILL.md` §Step 1: Setup 4번 "Stash first" 옵션: stash ref를 state에 기록하고,
    종료 요약에 `git stash pop <ref>` 복원 안내를 반드시 출력 (옵션 자체는 유지)
  - `skills/md-optimize/SKILL.md` §Phase 3 머리말의 `git checkout -- .` 복구 안내 → "Phase 3 시작 전
    변경 대상 .md의 사본을 만들고, 실패 시 그 파일들만 복원 + 이번 실행이 만든 split 파일 삭제"
  - `skills/migrate/SKILL.md` §Step 6: Verdict & Resolution의 Rollback: 브랜치 전환·삭제 **전에**
    이번 실행이 바꾼 파일(changes 기록 기준)을 사본에서 복원하는 단계를 선행
- 이 SKILL.md들이 번역·요약 사본(`TPL_*`, `templates/<skill>/`)을 가지면 같은 커밋에서 함께 고친다.

**완료 기준**
- `skills/`·`templates/`·`workflows/`에서 5종 패턴(`git checkout -- `, 인자 없는 `git stash`,
  `git checkout -- .`, `reset --hard`, `clean -f`)을 grep한 남은 매치가 모두 "하지 말라"는 금지 문장이거나 S2 allowlist 대상으로 정당화된다.
- test-gen의 변이 적용→복원 경로에서 커밋 안 된 수정의 바이트가 보존됨을 문면으로 추적 가능하다
  (Evaluator가 단계별로 확인).

### S2 — `scripts/verify_git_safety.py` 신설 (C1·M1~M3 재유입 차단, M13 일부)

- stdlib만 사용(`pathlib`, `re`, `argparse`). 스캔 범위 `skills/`, `templates/`, `workflows/`.
- 금지 패턴: S1 완료 기준의 5종. 예외는 스크립트 안의 allowlist(`(path, 패턴, 사유)` 튜플, 사유 필수,
  zero-slack — 매치 수와 정확히 일치)로만 허용. 금지 문장("never use …")은 문맥 규칙 또는 allowlist로 처리하고,
  어느 쪽을 택했는지 docstring에 적는다.
- 종료 코드 관례: `0` 통과, `1` 위반, `2` 구조 문제. docstring은 기존 lint와 같은 형식
  ("run manually and on push/PR via .github/workflows/lint.yml …").
- 배선: `.github/workflows/lint.yml`, `CLAUDE.md` §Commands 표와 `agent-harness-defaults: lint-cmd=` 라인,
  CLAUDE.md의 lint 개수 서술("six"), README의 lint 목록. `bash .github/scripts/check_lint_wiring.sh` 통과.

**완료 기준**: 전체 lint 체인 green. S1 이전 커밋에 대해 돌리면 `1`로 실패함을 한 번 확인하고
(`git stash` 없이 `git worktree` 또는 `git show <sha>:<path>` 기반으로) 그 출력을 slice 기록에 남긴다.

### S3 — 스킬 목록 위생 (M11, 게이트 description 절단)

- `skills/harness-gate/SKILL.md` frontmatter `description`을 따옴표로 감싼다(현재 plain scalar의 ` #1`이
  YAML 주석으로 잘려 `'HARD GATE'`로 파싱됨). 나머지 18개 SKILL.md도 같은 위험(` #`, `: `)을 점검.
- `scripts/verify_description_budget.py`:
  - plain scalar에 ` #`가 있으면 실패 (YAML 파서가 보는 값과 lint가 재는 값이 다를 수 없게)
  - `workflows/*.workflow.js`의 `meta.description`을 별도 합계·별도 ceiling으로 측정 (ratchet 규칙 동일)
- segment 15개의 `meta.description`을 "INTERNAL — launched by /<skill> only; <무엇을 하는지 한 구절>"로
  축소. `verify_meta_literal.py` 통과 유지. 설명이 바뀌어도 SKILL.md 쪽 dispatch 문면은 영향 없음을 확인.
- (선택) segment의 `JSON.parse` 실패 시 "this segment is launched by /<skill>; do not invoke directly"로 throw.

**완료 기준**: `python -c "import yaml…"`류로 19개 description을 실제 YAML 파싱해 lint 측정값과 일치.
segment description 합계가 lint 출력에 나오고 기존 대비 감소.

### S4 — `/ship` 버전 편집 정확성 (M4)

- `skills/ship/SKILL.md` §Version Detection: `pom.xml`은 `<parent>` 블록 밖의 프로젝트 `<version>`만.
- §Step 2 Pass 2: 파일 전역 문자열 치환 → 파일 형식별 **키 경로 편집** (package.json `$.version`,
  pom `project/version`, `build.gradle(.kts)` `version =`, pyproject `[project].version` /
  `[tool.poetry].version`, `Cargo.toml` `[package].version`). 이미 있는 `.claude-plugin/*.json` 키 경로
  규칙을 일반화하고 그 규칙은 유지.
- Pass 1 확인 게이트에 파일별 **줄 단위 before→after 미리보기**를 표시(`--stat`만으로 승인하지 않게).

**완료 기준**: Spring Initializr형 pom(parent 2.x + project 0.0.1-SNAPSHOT)과 `^1.2.0` 의존성이 있는
package.json을 예시로, 문면대로 따르면 parent·의존성 범위가 바뀌지 않음을 Evaluator가 추적.

### S5 — 서브에이전트의 키워드 스킬 호출 제거 (M12)

- 대상: `templates/planner/planner_single.md`, `templates/generator/generator_single.md`,
  `templates/generator/implementation.md`, `templates/generator/implementation_standard.md`,
  `templates/evaluator/evaluator_prompt.md`, `templates/migrate/evaluator.md`, 그리고 같은 문구의
  `TPL_*` 사본을 가진 `workflows/harness.build.workflow.js`, `harness.eval.workflow.js`,
  `migrate.eval.workflow.js`, `refactor.eval.workflow.js` — **같은 커밋에서**.
- "search installed skills for <keyword> and invoke if found" 지시를 삭제하고, 그 자리를 해당 단계가 원래
  원하던 행동의 짧은 인라인 지시로 대체(예: "가설을 세우고 실행 가능한 검증으로 확인한다").
- `verify_block_sync.py`/SYNC 그룹에 걸린 블록이면 버전 태그를 올리고 모든 사본을 함께 갱신.

**완료 기준**: `grep -rn -i "installed skills" templates workflows` 0건. lint 체인 green.

### S6 — README·문서 사실 정정 + 사설 저장소명 제거 (M17, L3-08, L7-10)

- README: Install 절을 상단으로(측정표 앞), Quick Start에 `--fast` 한 줄 추가, "no mode roundtrip" 문장,
  "non-opted → 자동 single/quick" 서술(실제 동작과 대조해 수정), "~8-15K tokens" 비용 수치(현재
  `wc -c` 기준으로 재산정하거나 수치 삭제), "largest skill" 서술, `## workflow` 절 제목, HARD GATE 보장
  과장 문장(결정 A의 잔여 위험을 그대로 공시), lint 배지 옆 "문서 정합성 lint — 동작 테스트 아님" 한 줄,
  업데이트 후 재시작 필요 안내.
- `skills/harness-gate/SKILL.md`에서 `design/`을 "gitignored"라 부른 문장 정정(`design/`은 커밋된다).
- `skills/study/SKILL.md`와 `workflows/_reference/study_measurements.md`에 노출된 사설 저장소명과 그 브랜치·클래스명을
  익명 라벨("private monorepo A" 등)로 교체. 측정 수치는 보존. 이름 목록은 이 문서에 재기재하지 않는다 —
  착수 시 두 파일에서 추출해 slice 기록(gitignored `docs/`)에만 둔다.
- 라인 번호 인용 금지, `§Section` 인용만.

**완료 기준**: 착수 시 추출한 이름 목록의 저장소 전체 grep이 0건(`docs/`·`.harness/` 제외).
README 수정 문장마다 근거 파일 §섹션을 slice 기록에 남긴다.

### S7 — 라이브 프로브 (에픽 종료 조건)

S1~S6 머지 후 설치본 2사본을 동기화하고 **프로세스를 재시작한 새 세션**에서, 이 저장소 밖의 임시 fixture
저장소(커밋 1개 + 커밋 안 된 수정이 있는 소스 파일 1개 + 테스트 1개)로:
- `/test-gen` 실행 → 종료 후 WIP 파일 바이트가 실행 전과 동일(sha256 비교)
- 스킬 목록에서 harness-gate 설명이 잘리지 않고, segment 항목이 INTERNAL 한 줄로 보임
결과를 `design/practitioner-hardening/PROBE.md`에 기록.

## 전역 제약

- 각 슬라이스 종료 시 CLAUDE.md의 lint 체인 전체 green (`agent-harness-defaults: lint-cmd=` 라인).
- 새 SYNC 사이트를 추가하면 같은 변경에서 `min_sites`를 실측값으로 올린다(zero slack).
- workflow 스크립트는 LF, `export const meta` 순수 리터럴, 게이트 토큰 금지.
- 커밋: `fix(test-gen,harness-build,refactor,md-optimize,migrate): …` 식 Conventional Commits, 브랜치
  `harness/<slug>`, develop에 `--no-ff` 머지. 버전 bump·릴리스는 이 에픽 밖(`/ship`).
- **이 에픽 진행 중 HARD GATE #3에서 "Apply patch"를 고르지 않는다** — 실행 중인 설치본(v8.14.0)에는
  M1(`git stash` 스냅샷)이 아직 살아 있다. 필요하면 먼저 커밋한 뒤 수동으로 적용한다.
