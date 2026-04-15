# Workflow V2: Thin Orchestrator + Mechanical Quality Gates

- **Date**: 2026-04-14
- **Status**: COMPLETE (섹션 1-8 완료, 구현 착수 가능)
- **Goal**: /workflow 스킬의 토큰 효율성 극대화 + 모델 품질 변동에 대한 구조적 내성 확보
- **Target**: agent-harness v8.0.0

---

## 배경 및 동기

### 외부 환경 변화
- Claude Code 사용자들 사이에서 **토큰 절약**에 대한 관심이 급증
- LLM 모델의 추론 능력이 시기에 따라 변동하는 현상 체감 증가 (Opus 포함)
- "AI 모델의 능력만 믿고 작업"하는 방식의 한계가 드러남

### agent-harness 내부 문제
- 현재 `/workflow`는 단일 세션에서 Plan → Generate → Evaluate 전체를 진행
- 서브에이전트를 사용하더라도 **결과 요약이 메인 세션에 누적**되어 후반부 토큰 비용 급증
- Evaluator가 "PASS" 판정을 내릴 때 LLM 판단에 전적으로 의존 → 모델 부진 시 가짜 PASS 위험

### 설계 목표
1. **토큰 40-60% 절감**: 오케스트레이터 컨텍스트를 ~15K 이하로 유지
2. **모델 품질 무관 최소 품질 보장**: 빌드/테스트/린트가 통과하는 코드만 커밋
3. **UX 유지**: 기본 사용 경험은 현재와 동일, 파워 유저에게 추가 옵션 제공
4. **기존 호환**: 아티팩트 구조(spec.md, changes.md, qa_report.md) 유지

---

## 섹션 1: 핵심 문제 정의

두 가지 독립적인 문제를 하나의 설계에서 동시에 해결한다.

### 문제 A — 토큰 비효율

오케스트레이터(메인 세션)에 컨텍스트가 누적되어 후반부 토큰 비용이 급증한다.

현재 토큰 프로필 (단일 세션 기준):
```
[Setup 5K] → [Plan 30K] → [Gate 35K] → [Generate 80K+] → [Gate 90K+] → [Evaluate 120K+]
                                                                ↑ 여기서부터 비용 급증
```

서브에이전트가 격리된 컨텍스트를 사용하더라도, 서브에이전트의 결과 요약(수백~수천 토큰)이 메인 세션에 반환되고 누적된다. Generator 단계에서 여러 파일을 수정하면서 컨텍스트가 폭발적으로 증가한다.

### 문제 B — 모델 품질 변동

현재 스킬은 "모델이 잘 판단할 것"이라는 전제에 의존하는 부분이 많다.

| 단계 | LLM이 판단하는 것 | 모델 품질 저하 시 위험 |
|------|------------------|---------------------|
| Planner | "요구사항을 충분히 분석했는가" | 얕은 분석, 엣지 케이스 누락 |
| Generator | "코드가 스펙을 충족하는가" | 플레이스홀더, 불완전 구현 |
| **Evaluator** | **"구현이 합격인가"** | **가짜 PASS (가장 치명적)** |

특히 Evaluator의 거짓 PASS가 가장 치명적이다. 모델이 "잘 된 것 같다"고 넘기면 불완전한 코드가 커밋된다.

### 해결 방향 (두 문제의 공통 해법)

> **"LLM의 판단에 의존하는 부분을 줄이고, 구조와 자동 검증으로 품질을 보장한다"**

- 토큰 → 오케스트레이터가 덜 생각하게 만들면 줄어든다
- 품질 → LLM 판단 대신 실행 가능한 검증(빌드, 테스트, lint)으로 대체하면 모델 능력에 덜 의존한다

---

## 섹션 2: Thin Orchestrator 아키텍처

### 현재 구조 (Fat Orchestrator)

```
메인 세션 (오케스트레이터)
├── 사용자 대화 처리
├── Setup & 환경 감지
├── Planner 로직 실행 (또는 SubAgent 디스패치)
│   └── spec.md 생성 → 메인 세션에 결과 반환 & 누적
├── 사용자 승인 게이트
├── Generator 로직 실행 (또는 SubAgent 디스패치)
│   └── 코드 작성 → 메인 세션에 결과 반환 & 누적
├── 사용자 승인 게이트
├── Evaluator 로직 실행 (또는 SubAgent 디스패치)
│   └── qa_report.md → 메인 세션에 결과 반환 & 누적
└── Cleanup & Commit
```

**문제**: 서브에이전트를 사용하더라도, 서브에이전트의 결과 요약이 메인 세션에 계속 쌓인다. 오케스트레이터가 "다음에 뭘 할지", "결과가 좋은지"를 스스로 판단하는 비중이 크다.

### 제안 구조 (Thin Orchestrator)

```
메인 세션 (오케스트레이터) — 상태 머신으로만 동작
│
├── [1] Setup (직접 실행, ~5K)
│   환경 감지, state.json 생성
│   → state.json에 phase="plan_ready" 기록
│
├── [2] Dispatch: Plan (SubAgent)
│   입력: state.json + 사용자 태스크 설명만 전달
│   출력: spec.md 파일 기록 → 성공/실패만 반환
│   → 오케스트레이터는 "spec.md 생성됨" 1줄만 수신
│
├── [3] Gate: 사용자 승인
│   spec.md를 사용자에게 보여주고 승인 요청
│   → state.json에 phase="generate_ready" 기록
│
├── [4] Dispatch: Generate (SubAgent)
│   입력: state.json + spec.md만 전달 (이전 대화 없음)
│   출력: 코드 변경 + changes.md 기록 → 성공/실패만 반환
│   → 오케스트레이터는 "N개 파일 변경됨" 1줄만 수신
│
├── [5] Auto-Verify (SubAgent) ← 새로운 단계
│   입력: state.json + changes.md
│   실행: build → test → lint (LLM 판단 아님, 명령어 실행)
│   출력: verify_report.md (PASS/FAIL + 로그) → 결과만 반환
│
├── [6] Dispatch: Evaluate (SubAgent)
│   입력: state.json + spec.md + changes.md + verify_report.md
│   출력: qa_report.md → 결과만 반환
│
└── [7] Cleanup & Commit
```

### 핵심 변화 3가지

| 항목 | 현재 | 제안 |
|------|------|------|
| **오케스트레이터 역할** | 대화 관리 + 로직 실행 + 판단 | 상태 전이 + 디스패치 + 게이트만 |
| **서브에이전트 반환** | 결과 요약 (수백~수천 토큰) | 성공/실패 1줄 (파일에 상세 기록) |
| **단계 간 통신** | 메인 세션 컨텍스트 경유 | 파일 직접 참조 (spec.md → changes.md) |

### [5] Auto-Verify 단계 (신규)

LLM이 아니라 실제 명령어 실행(build, test, lint)으로 코드 품질을 기계적으로 검증하는 단계. 모델 품질과 무관하게 동작한다. 상세 설계는 섹션 3 참조.

### 예상 토큰 프로필

```
현재:  [Setup 5K] → [Plan 30K] → [Gate 35K] → [Generate 80K+] → [Gate 90K+] → [Evaluate 120K+]
                                                                    ↑ 여기서부터 비용 급증

제안:  [Setup 5K] → [Plan 5K→Sub] → [Gate 8K] → [Gen 5K→Sub] → [Verify 5K→Sub] → [Eval 5K→Sub]
       오케스트레이터 자체는 ~8-15K 범위에서 유지
```

### 서브에이전트 반환 규칙

오케스트레이터의 컨텍스트를 가볍게 유지하기 위한 핵심 규칙:

1. **서브에이전트는 상세 결과를 파일에 기록**한다 (spec.md, changes.md, verify_report.md, qa_report.md)
2. **오케스트레이터에 반환하는 값은 1-2줄 요약만** 허용한다:
   - Plan: `"spec.md 생성 완료 — acceptance criteria 3건, edge case 2건"`
   - Generate: `"4개 파일 변경 완료 — auth.ts, middleware.ts, routes.ts, auth.test.ts"`
   - Verify: `"PASS — build ✓, test 12/12 ✓, lint 0 errors"`
   - Evaluate: `"PASS — minor 1건 (qa_report.md 참조)"`
3. **오케스트레이터는 서브에이전트 중간 산출물을 읽지 않는다** — 단, 다음 2가지 예외를 허용:
   - **사용자 게이트**: plan_done에서 spec.md를 사용자에게 보여줄 때 Read
   - **Verdict 게이트**: evaluate_done에서 FAIL 시 qa_report.md의 Fix Instructions를 사용자에게 보여줄 때 Read
   - 읽지 않는 대상: proposal_*.md, critique_*.md, plan.md, review_*.md 등 서브에이전트 중간 산출물

---

## 섹션 3: Mechanical Quality Gates (3-Layer 검증 체계)

LLM 판단을 기계적 검증 → 구조화된 검증 → LLM 검증 순서로 계층화한다. 앞 단계에서 걸러질수록 모델 품질에 덜 의존한다.

### Layer 1: Mechanical Verification (LLM 불필요)

모델 품질과 완전히 무관하게 동작하는 기계적 검증.

```
Layer 1: Mechanical (LLM 불필요 — 모델 품질 무관)
  ├── build 통과 여부
  ├── test 통과 여부 (기존 테스트 + 새 테스트)
  ├── lint/type-check 통과 여부
  └── TODO/FIXME/HACK 스캔 (불완전 구현 탐지)
```

> **참고**: 이전 버전에서 Layer 1에 포함되었던 "acceptance criteria ↔ 테스트 매칭"은 의미 이해가 필요한 작업이므로 **Layer 2로 이동**하였다. Layer 1은 exit code와 grep 등 순수 기계적 검증만 수행한다.

**FAIL 시**: 즉시 Generator에 재시도 지시 (Evaluator 도달 전 차단). 구체적 에러 로그를 포함하여 전달.

#### Layer 1 실행 순서

```
1. build_cmd 실행 → FAIL 시 즉시 중단, 에러 로그 기록
2. test_cmd 실행 → FAIL 시 실패한 테스트 목록 기록
3. lint_cmd 실행 (있는 경우) → ERROR만 FAIL, WARNING은 기록만
4. type_check_cmd 실행 (있는 경우) → FAIL 시 에러 목록 기록
5. grep -rn "TODO\|FIXME\|HACK" <changed_files> → 발견 시 WARN (blocking 여부 설정 가능)
```

#### verify_report.md 출력 형식

```markdown
# Verify Report

- **timestamp**: 2026-04-14T15:30:00+09:00
- **result**: PASS | FAIL
- **phase**: layer1_mechanical

## Build
- command: `npm run build`
- result: PASS
- duration: 3.2s

## Test
- command: `npm test`
- result: PASS
- total: 42, passed: 42, failed: 0, skipped: 0
- duration: 8.1s

## Lint
- command: `npm run lint`
- result: PASS
- errors: 0, warnings: 2
- warnings:
  - src/auth.ts:15 — Unexpected any. Specify a different type. (@typescript-eslint/no-explicit-any)
  - src/auth.ts:23 — 'logger' is defined but never used. (@typescript-eslint/no-unused-vars)

## Type Check
- command: `npx tsc --noEmit`
- result: PASS

## Completeness Scan
- TODO/FIXME/HACK: 0 found in changed files
```

### Layer 2: Structural Verification (LLM 사용, 판단 범위 좁힘)

LLM을 사용하되, open-ended 판단이 아닌 **구체적 체크리스트 기반** yes/no 검증.

```
Layer 2: Structural (LLM 사용하되, 판단 범위를 좁힘)
  ├── spec.md의 각 acceptance criteria별 개별 yes/no 체크
  │   → "이 코드가 criteria X를 충족하는가? 근거 파일:라인을 제시하라"
  ├── changes.md의 각 파일별 "이 파일의 변경 목적" 매칭
  │   → "이 변경이 spec의 어느 요구사항에 대응하는가?"
  ├── diff 기반 리뷰 (전체 코드가 아닌 변경분만)
  │   → 컨텍스트 최소화: 변경된 파일의 diff만 제공
  └── 구체적 질문 목록 (open-ended "잘 됐나?" 금지)
      → "에러 핸들링이 누락된 코드 경로가 있는가? 있다면 파일:라인을 제시하라"
```

**핵심**: "이 코드가 좋은가?"가 아니라, "이 구체적 항목이 충족되었는가?"를 묻는다. 모델 능력이 떨어져도 좁은 범위의 yes/no 질문에는 상대적으로 정확하게 답할 수 있다.

**체크리스트 중 하나라도 NO**: 해당 항목만 구체적으로 재작업 지시 (전체 재생성 아님).

### Layer 3: LLM Judgment (최후 방어선)

기존 Evaluator의 역할. Layer 1,2를 통과한 코드만 도달하므로 신뢰도가 높다.

```
Layer 3: LLM Judgment (기존 Evaluator — 최후 방어선)
  ├── anchor-free input (Generator 자기평가 미제공)
  ├── defect-assumption framing ("결함이 있다고 가정하고 찾아라")
  ├── 반드시 파일:라인 번호 인용 (근거 없는 판단 차단)
  └── pre-mortem ("이 코드가 프로덕션에서 실패한다면 원인은?")
```

### 모델 품질 수준별 시나리오

```
모델 품질 정상:  Layer 1 (통과) → Layer 2 (통과) → Layer 3 (정밀 검증) = 고품질
모델 품질 저하:  Layer 1 (여기서 50%+ 걸림) → Layer 2 (추가 필터) → Layer 3 (가짜 PASS 가능하나, 기계적으로 검증된 코드) = 중품질 유지
모델 품질 심각:  Layer 1 (대부분 FAIL → 재시도 루프) → 최대 재시도 초과 시 사용자에게 수동 개입 요청
```

### Generator 재시도 메커니즘

Layer 1,2에서 실패 시 무조건 재시도가 아닌, **구체적 피드백 기반 재시도**.

```
[Generator SubAgent]
  → 코드 작성 완료
  
[Auto-Verify SubAgent] (Layer 1)
  → build FAIL: "src/auth.ts:42 — TypeError: Property 'token' does not exist"
  → 실패 로그를 그대로 포함하여 Generator에 전달

[Generator SubAgent — retry #1] (새로운 서브에이전트, 이전 실패 컨텍스트 오염 없음)
  입력: spec.md + 이전 changes.md + "build 실패: src/auth.ts:42 TypeError..." 
  → 구체적 에러만 수정 (전체 재작성 아님)

[Auto-Verify SubAgent] (Layer 1)
  → build PASS, test PASS, lint WARN (non-blocking)
  → Layer 2로 진행
```

재시도 시 **새로운 서브에이전트**가 실행되므로 이전 실패의 컨텍스트 오염 없이 신선한 상태에서 에러만 수정한다. 이것도 Thin Orchestrator의 이점이다.

#### 재시도 루프 상태 전이 (상세)

Layer 1 FAIL 시 재시도 루프의 state.json 변화를 명시한다:

```
[초기 Generate 완료]
  state.phase = "generate_done"
  state.verify.layer1_retries = 0

[Verify 디스패치]
  state.phase = "verifying"        ← 즉시 전환

[Verify FAIL 반환]
  state.phase = "verify_done"
  state.verify.layer1_result = "FAIL"
                                     ← retries는 여기서 증가하지 않음 (아래 retry 디스패치 시 증가)

[최대 미도달 (retries < 3) → Generator retry 디스패치]
  state.verify.layer1_retries += 1 ← retry 디스패치 시점에 증가 (재시도 횟수를 정확히 추적)
  state.phase = "generating"       ← generate_ready를 거치지 않고 직접 generating으로
                                     (재시도는 사용자 게이트 없이 자동 진행)

[Generator retry 완료]
  state.phase = "generate_done"

[Verify 재디스패치]
  state.phase = "verifying"

[Verify PASS 반환]
  state.phase = "verify_done"
  state.verify.layer1_result = "PASS"
  → evaluate_ready로 진행

[Verify FAIL + 최대 도달 (retries >= 3)]
  state.phase = "verify_done"
  state.verify.layer1_result = "FAIL"
  → 사용자에게 수동 개입 요청 (에러 로그 + verify_report.md 경로 제공)
  → 사용자 응답에 따라: "직접 수정 후 /workflow verify" 또는 "중단"
```

**retries 카운터 의미**: `layer1_retries`는 "실제로 디스패치된 Generator retry 횟수"를 나타낸다. FAIL 감지 시점이 아닌 retry 디스패치 시점에 증가하므로, `retries = 3`은 정확히 3번의 재시도가 발생했음을 의미한다 (원본 시도 1회 + 재시도 3회 = 총 4회 시도).

**핵심**: 재시도 루프에서 phase는 `generating → generate_done → verifying → verify_done`을 반복한다. `generate_ready`를 거치지 않는 이유는 재시도가 사용자 게이트 없이 자동으로 진행되기 때문이다.

**Layer 2 재시도도 동일 패턴**: `evaluate_done(FAIL)` → `generating` → ... → `verifying` → `verify_done` → `evaluating`. Layer 2 FAIL 시에도 Generator를 새로 디스패치하므로 전체 Verify → Evaluate 파이프라인을 다시 거친다.

### 최대 재시도 정책

| Layer | 최대 재시도 | 초과 시 행동 |
|-------|-----------|------------|
| Layer 1 | 3회 | 사용자에게 수동 개입 요청 (빌드/테스트 에러 로그 제공) |
| Layer 2 | 2회 | 실패 항목 표시 후 사용자 판단 요청 |
| Layer 3 | 기존과 동일 | Fix/Accept 선택지 제공 |

---

## 섹션 4: UX 설계 — 편의성과 유연성의 균형

### 설계 원칙

```
"그냥 잘 되게 해줘"  ←────────────────→  "각 단계를 내가 컨트롤하고 싶어"
   대다수 사용자                              파워 유저 / 토큰 민감 사용자
```

기본은 심플하게, 필요하면 세밀하게 컨트롤 가능해야 한다.

### 실행 모드 3가지

#### 모드 1: Auto (기본값) — 현재 UX와 동일한 경험

```bash
/workflow "사용자 인증 기능 추가"
```

- 한 번 실행하면 Plan → Verify → Generate → Verify → Evaluate 전체 진행
- 확인 게이트(spec 승인)는 기존과 동일하게 유지
- 내부적으로는 Thin Orchestrator + 서브에이전트로 토큰 최적화
- **사용자 관점에서는 현재와 차이 없음** (내부만 효율화)

#### 모드 2: Phase (단계별 실행) — 세션 분리로 토큰 극한 절약

```bash
/workflow plan "사용자 인증 기능 추가"     ← 세션 1: spec.md 생성 후 종료
/workflow generate                         ← 세션 2: spec.md 읽고 구현 후 종료
/workflow evaluate                         ← 세션 3: 평가 후 종료
```

- 각 단계가 독립 세션으로 실행 가능
- `state.json`에 현재 phase가 기록되어 있으므로 다음 단계를 자동 인식
- 세션 사이에 사용자가 spec.md를 직접 편집할 수도 있음
- **토큰 절약 극대화** — 각 세션이 최소 컨텍스트로 시작

#### 모드 3: Step (개별 단계 지정) — 특정 단계만 재실행

```bash
/workflow verify                           ← Layer 1 기계적 검증만 재실행
/workflow evaluate                         ← 평가만 재실행 (코드 수정 후)
```

- 이미 진행된 워크플로우의 특정 단계만 다시 실행
- Generate 후 수동으로 코드를 수정하고, verify만 돌리는 경우
- Evaluate 결과가 불만족스러워 코드 수정 후 재평가하는 경우

#### Step 모드 전제 조건

각 step을 독립 실행하려면 필요한 선행 조건이 충족되어야 한다:

| Step | 필요 파일 | 필요 phase (최소) | 없을 때 동작 |
|------|----------|-----------------|------------|
| `/workflow plan` | (없음) | (신규 가능) | 정상 실행 |
| `/workflow generate` | spec.md | `plan_done` 이후 | 에러: "Plan을 먼저 실행하세요 (`/workflow plan`)" |
| `/workflow verify` | changes.md | `generate_done` 이후 | 에러: "Generate를 먼저 실행하세요" |
| `/workflow evaluate` | spec.md + changes.md + verify_report.md | `verify_done` 이후 | 에러: "Verify를 먼저 실행하세요" |

**수동 수정 후 verify 실행 시**: 사용자가 Generator 없이 직접 코드를 수정한 경우, changes.md가 최신 상태가 아닐 수 있다. 이 경우:
1. changes.md가 존재하면: 기존 changes.md를 참조하되, Verify는 실제 파일 상태에서 build/test/lint를 실행하므로 changes.md 정확성과 무관하게 검증 가능
2. changes.md가 없으면: Verify SubAgent가 `git diff` 기반으로 변경 파일 목록을 추출하여 TODO/FIXME 스캔 수행 (build/test/lint는 전체 프로젝트 대상이므로 changes.md 불필요)

### 모드 선택 CLI 패턴

```bash
/workflow "태스크 설명"           → Auto 모드 (기본)
/workflow --phase plan "설명"    → Phase 모드로 plan만 실행
/workflow plan "설명"            → Phase 모드 (위와 동일, --phase 생략 가능)
/workflow generate               → 이전 plan 결과를 이어서 generate
/workflow verify                 → Step 모드 — verify만 실행
```

`state.json`이 이미 존재하면:

```bash
/workflow                        → state.json의 phase를 읽고 다음 단계 자동 제안
                                   "Plan이 완료되어 있습니다. Generate를 진행할까요?"
```

### 상태 전이 다이어그램

```
         ┌──────────────────────── Auto 모드: 자동 진행 ────────────────────────┐
         │                                                                      │
    plan_ready ──→ planning ──→ plan_done ──→ [사용자 승인] ──→ generate_ready
                                                   │
                                              Phase 모드:                    
                                              세션 종료 가능                   
                                                   │
    generate_ready ──→ generating ──→ generate_done ──→ verify_ready
                                            │
                                       Phase 모드:
                                       세션 종료 가능
                                            │
    verify_ready ──→ verifying(L1) ──→ verify_done ──→ evaluate_ready
                          │                  │
                     FAIL → retry       Phase 모드:
                     (최대 3회)          세션 종료 가능
                                             │
    evaluate_ready ──→ evaluating(L2+L3) ──→ evaluate_done ──→ [Verdict 게이트]
                                                                     │
                                                          ┌──── PASS → cleanup
                                                          │
                                                          └──── FAIL → [사용자 확인]
                                                                     │
                                                          ┌──── Fix (재시도 → generate_ready)
                                                          └──── Accept → cleanup
```

**Phase 모드 세션 종료 지점**: `plan_done`, `generate_done`, `verify_done`, `evaluate_done` 네 지점에서 세션이 종료될 수 있고, 다음 세션에서 이어서 진행.

**Auto 모드 게이트 (2곳)**:
1. `plan_done` 시점: 사용자 승인 게이트 (spec.md 확인 후 Proceed/Modify/Stop)
2. `evaluate_done` 시점 (FAIL인 경우만): Fix/Accept 선택지 제공 — Fix 선택 시 round 증가 후 `generate_ready`로 복귀, Accept 선택 시 cleanup 진행
나머지는 자동 진행하되, Layer 1 실패 시 자동 재시도 후 최대 횟수 초과 시에만 사용자에게 질문.

### 진행 상황 표시

Thin Orchestrator가 각 서브에이전트 디스패치 시 간결한 상태 메시지를 출력:

```
[workflow] Phase: Plan
  Dispatching planner sub-agent...
  ✓ spec.md generated (3 acceptance criteria, 2 edge cases)

[workflow] Phase: Generate  
  Dispatching generator sub-agent...
  ✓ 4 files changed (auth.ts, middleware.ts, routes.ts, auth.test.ts)

[workflow] Phase: Verify (Layer 1 — Mechanical)
  build... ✓
  test...  ✓ (12 passed, 0 failed)
  lint...  ✓ (0 errors, 2 warnings)
  scan...  ✓ (no TODO/FIXME in new code)

[workflow] Phase: Evaluate (Layer 2+3)
  Dispatching evaluator sub-agent...
  ✓ PASS — 1 minor suggestion (see qa_report.md)
```

오케스트레이터가 출력하는 건 이 상태 메시지뿐이므로 컨텍스트가 가볍게 유지된다.

### 기존 /workflow과의 관계

기존 워크플로우를 대체하는 것이 아니라 **실행 엔진을 교체**하는 접근:

| 항목 | 변경 사항 |
|------|----------|
| 사용자 인터페이스 | 동일 (+ phase 옵션 추가) |
| 확인 게이트 | 동일 |
| 아티팩트 구조 | 동일 (spec.md, changes.md, qa_report.md) + verify_report.md 추가 |
| state.json | 확장 (phase 세분화 + verify 결과 필드 추가) |
| 내부 실행 | Fat Orchestrator → Thin Orchestrator + Mechanical Gates |

---

## 섹션 5: 서브에이전트 핸드오프 설계

각 서브에이전트의 입력/출력/프롬프트 구조를 구체적으로 정의한다. 핵심 원칙: **오케스트레이터는 1-2줄 반환값만 수신하고, 상세 결과는 파일에 기록한다.**

### 5.1 Plan SubAgent

기존 planner 템플릿(architect.md, senior_developer.md, qa_specialist.md, synthesis.md 등)을 **그대로 재활용**한다. 변경점은 오케스트레이터와의 인터페이스뿐이다.

#### 입력 (오케스트레이터 → 서브에이전트 프롬프트)

```
You are executing the Plan phase of a workflow.

## Context
- task: "{state.task}"
- language: {state.lang}
- test_cmd: {state.test_cmd || "none"}
- build_cmd: {state.build_cmd || "none"}
- scope: {state.scope || "(no limit)"}
- repo_path: {state.repo_path}
- mode: {state.mode}

## Instructions
{기존 planner 템플릿 내용 — 모드에 따라 적절한 템플릿 선택}

## Output Contract
1. Write spec.md to: {state.docs_path}spec.md
2. Your FINAL message must be exactly ONE line in this format:
   "spec.md generated — {N} acceptance criteria, {M} edge cases"
   No other text after this line.
```

| 항목 | 값 |
|------|-----|
| **Agent tool model** | `state.model_config.advisor` (planner는 advisor 역할) |
| **프롬프트에 포함** | state.json에서 6개 필드 추출 (task, lang, test_cmd, build_cmd, scope, repo_path) |
| **프롬프트에 불포함** | state.json 전체, 이전 대화 컨텍스트, 다른 단계 결과물 |

#### 출력

| 대상 | 내용 |
|------|------|
| **파일** | `{docs_path}/spec.md` — 기존과 동일한 형식 |
| **오케스트레이터 반환** | `"spec.md generated — 3 acceptance criteria, 2 edge cases"` (1줄) |

#### 모드별 디스패치

| 모드 | 디스패치 패턴 | 변경 사항 |
|------|-------------|----------|
| **single** | 1 서브에이전트 (planner_single.md) | 현재와 동일, 반환값만 1줄로 제한 |
| **standard** | 2 병렬 서브에이전트 → 1 synthesis 서브에이전트 | 중간 결과(proposal_*.md)는 파일에만 기록. synthesis 서브에이전트가 파일을 직접 Read. 오케스트레이터에는 최종 1줄만 반환 |
| **multi** | 3 병렬 → 3 cross-critique → 1 synthesis | 동일 원칙. 중간 단계 서브에이전트도 각각 1줄 요약만 반환 |

**중간 단계 반환값 예시** (standard 모드):
```
# proposal 서브에이전트 (2개 병렬)
→ "architect proposal written — .harness/planner/proposal_architect.md"
→ "senior_dev proposal written — .harness/planner/proposal_senior_developer.md"

# synthesis 서브에이전트
→ "spec.md generated — 3 acceptance criteria, 2 edge cases"
```

### 5.2 Generate SubAgent

기존 generator 템플릿(lead_developer.md, implementation_standard.md 등)을 **그대로 재활용**한다.

#### 입력 (오케스트레이터 → 서브에이전트 프롬프트)

```
You are executing the Generate phase of a workflow.

## Context
- task: "{state.task}"
- language: {state.lang}
- test_cmd: {state.test_cmd || "none"}
- build_cmd: {state.build_cmd || "none"}
- scope: {state.scope || "(no limit)"}
- max_files: {state.max_files}
- round: {state.round}
- repo_path: {state.repo_path}

## Input Files (Read these yourself)
- spec: {state.docs_path}spec.md
{retry인 경우:}
- previous changes: {state.docs_path}changes.md
- verify failure: {state.docs_path}verify_report.md
- qa failure: {state.docs_path}qa_report.md (if exists)

## Instructions
{기존 generator 템플릿 내용}
{retry인 경우: "Fix ONLY the items marked FAIL in verify_report.md/qa_report.md. Do NOT touch items marked PASS."}

## Output Contract
1. Implement code changes in the repository
2. Write changes.md to: {state.docs_path}changes.md
3. Your FINAL message must be exactly ONE line:
   "{N} files changed — {comma-separated file basenames}"
   No other text after this line.
```

| 항목 | 값 |
|------|-----|
| **Agent tool model** | `state.model_config.executor` |
| **프롬프트에 포함** | state.json에서 7개 필드 + 입력 파일 경로 |
| **프롬프트에 불포함** | 이전 대화, planner의 중간 산출물, evaluator 컨텍스트 |

#### 출력

| 대상 | 내용 |
|------|------|
| **파일** | 코드 변경 (실제 파일 수정) + `{docs_path}/changes.md` |
| **오케스트레이터 반환** | `"4 files changed — auth.ts, middleware.ts, routes.ts, auth.test.ts"` (1줄) |

#### Retry 시 핵심 차이

- **새로운 서브에이전트** 인스턴스가 실행됨 (이전 실패 컨텍스트 오염 없음)
- 입력에 `verify_report.md`의 실패 로그가 추가됨
- 프롬프트에 "FAIL 항목만 수정, PASS 항목 건드리지 말 것" 명시
- `state.round`가 증가되어 있어 changes.md에 라운드 구분 가능

#### 모드별 디스패치

| 모드 | 디스패치 패턴 | 변경 사항 |
|------|-------------|----------|
| **single** | 1 서브에이전트 | 반환값 1줄 제한 |
| **standard** | plan → advisor → implement (3단계 순차) | 각 단계 서브에이전트가 1줄 반환. plan.md, review_combined.md는 파일에만 기록 |
| **multi** | plan → 2 advisor 병렬 → implement (3단계) | 동일 원칙 |

**중간 단계 반환값 예시** (standard 모드):
```
# plan 서브에이전트
→ "implementation plan written — .harness/generator/plan.md (7 steps)"

# advisor 서브에이전트
→ "review written — .harness/generator/review_combined.md (2 issues, 3 suggestions)"

# implementation 서브에이전트
→ "4 files changed — auth.ts, middleware.ts, routes.ts, auth.test.ts"
```

### 5.3 Verify SubAgent (신규)

**LLM 판단을 최소화**하고 Bash 명령어 실행에 집중하는 서브에이전트. Layer 1 Mechanical Verification을 수행한다.

#### 입력 (오케스트레이터 → 서브에이전트 프롬프트)

```
You are executing Mechanical Verification (Layer 1) for a workflow.

## Commands to Execute (in order)
1. build: {state.build_cmd || "SKIP"}
2. test: {state.test_cmd || "SKIP"}
3. lint: {state.lint_cmd || "SKIP"}
4. type_check: {state.type_check_cmd || "SKIP"}

## Changed Files (for completeness scan)
Read {state.docs_path}changes.md and extract the file list.

## Execution Rules
- Execute each command via Bash tool. Do NOT simulate or predict results.
- If a command is "SKIP", mark it as "SKIPPED" in the report.
- For build/test: FAIL if exit code ≠ 0. Capture full stderr/stdout.
- For lint: FAIL only on errors, WARNING on warnings.
- For type_check: FAIL if exit code ≠ 0.
- For TODO/FIXME/HACK scan: grep changed files only. Report count.

## Output Contract
1. Write verify_report.md to: {state.docs_path}verify_report.md
2. Your FINAL message must be exactly ONE line:
   "PASS — build ✓, test {passed}/{total} ✓, lint {errors}e/{warnings}w, scan {todo_count} TODO"
   or
   "FAIL — {first_failing_step}: {one-line error summary}"
   No other text after this line.
```

| 항목 | 값 |
|------|-----|
| **Agent tool model** | `state.model_config.verifier` (기본값 haiku — 아래 Model Selection 참조) |
| **프롬프트에 포함** | 4개 명령어 + 파일 경로 2개 |
| **프롬프트에 불포함** | state.json 전체, 이전 대화, Generator 이유/맥락 |

#### 출력

| 대상 | 내용 |
|------|------|
| **파일** | `{docs_path}/verify_report.md` — 섹션 3에서 정의한 형식 |
| **오케스트레이터 반환** | `"PASS — build ✓, test 12/12 ✓, lint 0e/2w, scan 0 TODO"` 또는 `"FAIL — test: 2 failed (auth.test.ts:L42, auth.test.ts:L67)"` (1줄) |

#### 설계 근거: 왜 기본값이 haiku인가

- Verify 서브에이전트의 역할은 **명령어 실행 → 결과 파싱 → 리포트 작성**이 전부
- LLM이 "판단"할 여지가 거의 없음 (exit code가 0인가 아닌가)
- 가장 저비용 모델로도 충분히 수행 가능
- 이것이 Thin Orchestrator의 핵심 이점: 기계적 작업은 기계적으로 처리

#### Verify 역할의 Model Selection 프리셋

기존 executor/advisor/evaluator에 `verifier` 역할을 추가한다:

| Preset | executor | advisor | evaluator | **verifier** |
|--------|----------|---------|-----------|-------------|
| **default** | (parent) | (parent) | (parent) | **haiku** |
| **all-opus** | opus | opus | opus | **haiku** |
| **balanced** | sonnet | opus | opus | **haiku** |
| **economy** | haiku | sonnet | sonnet | **haiku** |

**모든 프리셋에서 verifier = haiku**: 기계적 명령 실행에 고급 모델은 불필요. `default` 프리셋에서도 parent를 상속하지 않고 haiku를 고정하는 것이 의도적 설계이다. 사용자가 CLI로 `--verifier-model sonnet`과 같이 오버라이드할 수 있지만, 기본값은 항상 haiku.

**model_config 확장**: state.json의 model_config에 `"verifier": "haiku"` 필드 추가.

### 5.4 Evaluate SubAgent (Layer 2 + Layer 3 통합)

#### 설계 결정: Layer 2와 Layer 3을 단일 서브에이전트에서 실행

**근거**:
1. Layer 2와 Layer 3은 **동일한 입력 파일**을 필요로 함 (spec.md, changes.md, verify_report.md)
2. 별도 서브에이전트로 분리하면 디스패치 오버헤드 + 파일 중복 읽기 발생
3. Layer 2가 먼저 실행되고 Layer 3이 이어지는 **순차 파이프라인**이므로 단일 서브에이전트 내에서 자연스럽게 처리
4. Layer 2에서 NO가 발견되면 Layer 3을 스킵하고 즉시 FAIL 반환 가능 → 토큰 추가 절약

**대안 (분리)을 선택하지 않은 이유**: 두 레이어가 서로 다른 모델 품질을 요구하지 않음. 둘 다 `evaluator` 모델을 사용. 분리 시 이점이 비용(디스패치 오버헤드)보다 작음.

#### 입력 (오케스트레이터 → 서브에이전트 프롬프트)

```
You are executing Evaluation (Layer 2 + Layer 3) for a workflow.

## Input Files (Read these yourself)
- spec: {state.docs_path}spec.md
- changes: {state.docs_path}changes.md  (file list ONLY — ignore reason descriptions)
- verify_report: {state.docs_path}verify_report.md
- round: {state.round}

## Phase 1: Structural Verification (Layer 2)
For EACH acceptance criterion in spec.md, answer:
- Does the code satisfy this criterion? YES/NO
- Evidence: file:line reference (mandatory if YES, explanation if NO)

For EACH file in changes.md, answer:
- Which spec requirement does this change serve? (must map to at least one)
- Any file that maps to no requirement → FAIL as scope violation
  - Scope violation FAIL 시 Fix Instructions: "해당 파일의 변경을 revert하거나, spec에 해당 요구사항을 추가하라"

For EACH acceptance criterion in spec.md, verify test coverage:
- Does a test function exist that validates this criterion? YES/NO
- Evidence: test file:line reference (mandatory if YES)
- NO인 경우: WARN (blocking 아님, 단 qa_report.md에 기록)

Review the diff of changed files (use Bash: git diff) for:
- Error handling gaps: "Is there an unhandled error path? If yes, file:line"
- Resource leaks: "Is there an unclosed resource? If yes, file:line"
- Security issues: "Is there an injection/XSS/auth bypass risk? If yes, file:line"

STOP HERE if any criterion is NO or any scope violation is found. Write qa_report.md with FAIL and the failing items.
Layer 2 FAIL 시 qa_report.md의 Layer 3 섹션은 "Skipped (Layer 2 failed)" 로 표기.

## Phase 2: LLM Judgment (Layer 3)
Only if ALL Layer 2 checks pass:

Assume defects exist. Conduct:
1. Pre-mortem: "If this code fails in production, the most likely cause is..."
   List exactly 2 hypothesized failure causes. For each, confirm or disprove with code evidence.
2. Run tests if test_cmd available: {state.test_cmd || "none"}
3. Review against 5 criteria (Completion, Scope, Bug-free, Consistency, Minimal changes)
   Each criterion: PASS/FAIL with file:line evidence

## Output Contract
1. Write qa_report.md to: {state.docs_path}qa_report.md
2. Your FINAL message must be exactly ONE line:
   "PASS — {summary}" or "FAIL — {N} items failed: {brief list}"
   No other text after this line.
```

| 항목 | 값 |
|------|-----|
| **Agent tool model** | `state.model_config.evaluator` |
| **프롬프트에 포함** | 파일 경로 4개 + round 번호 + test_cmd |
| **프롬프트에 불포함** | Generator의 reasoning, 왜 파일이 변경되었는지(anchoring 방지), 이전 대화 |

#### 출력

| 대상 | 내용 |
|------|------|
| **파일** | `{docs_path}/qa_report.md` — Layer 2 체크리스트 + Layer 3 기존 형식 통합 |
| **오케스트레이터 반환** | `"PASS — all criteria met, 1 minor suggestion"` 또는 `"FAIL — 2 items: criteria #3 not met, scope violation in utils.ts"` (1줄) |

#### qa_report.md 확장 형식

기존 qa_report.md에 Layer 2 결과를 **상단에 추가**:

```markdown
## QA Report — Round {N}
### Verdict: PASS | FAIL

### Layer 2: Structural Verification
| Criterion | Result | Evidence |
|-----------|--------|----------|
| AC1: "사용자가 로그인할 수 있다" | YES | auth.ts:L42, auth.test.ts:L12 |
| AC2: "잘못된 비밀번호 시 에러" | YES | auth.ts:L58, auth.test.ts:L28 |
| AC3: "5회 실패 시 잠금" | NO | 구현 없음 |

### Layer 3: LLM Judgment
{기존 qa_report.md 형식 — Pre-mortem, Test Results, Review table, Fix Instructions}
```

### 5.5 오케스트레이터 ↔ 서브에이전트 통신 요약

```
오케스트레이터                      서브에이전트
    │                                   │
    │── 프롬프트 (컨텍스트 + 파일경로) ──→│
    │                                   │── 파일 Read (spec.md 등)
    │                                   │── 작업 수행
    │                                   │── 파일 Write (결과물)
    │←── 1줄 요약 반환 ────────────────│
    │                                   │
    │   (오케스트레이터는 중간 산출물을      │
    │    읽지 않음 — 사용자 게이트에서       │
    │    최종 아티팩트만 예외적 Read)        │
```

**반환값 파싱 규칙**: 오케스트레이터는 서브에이전트의 반환값에서 첫 번째 줄만 읽고 나머지는 무시한다. 반환값에 "FAIL"이 포함되면 실패 경로, "PASS" 또는 "generated" 또는 "changed" 또는 "written"이 포함되면 성공 경로로 분기한다.

### 5.6 반환값 제약의 현실적 한계와 대응 전략

#### 핵심 전제의 위험

"서브에이전트가 1줄만 반환한다"는 이 설계의 핵심 가정이지만, Agent tool은 서브에이전트의 **전체 최종 응답**을 오케스트레이터에 반환한다. Output Contract의 "1줄만 반환하라"는 LLM에 대한 **요청**이지 시스템 수준의 **강제**가 아니다.

#### 실패 시나리오

| 시나리오 | 실제 반환 크기 | 영향 |
|---------|-------------|------|
| 서브에이전트가 Output Contract를 준수 | 1줄 (~50 토큰) | 설계 의도대로 작동 |
| 서브에이전트가 작업 요약을 추가 | 3-10줄 (~200 토큰) | 경미 — 누적되어도 ~1K 수준 |
| 서브에이전트가 에러를 만나 상세 보고 | 20-50줄 (~1K 토큰) | 중간 — 재시도 루프에서 누적 시 문제 |
| 모델 품질 저하로 지시 무시 | 수백 줄 (~5K+ 토큰) | 심각 — Fat Orchestrator와 차이 없음 |

#### 대응 전략

**1차 방어: Output Contract 강화 (구현 시)**
- 프롬프트 최하단에 Output Contract를 배치 (recency bias 활용)
- `"CRITICAL: Your response after this point must be EXACTLY ONE LINE."` 강조
- 잘못된 반환 예시를 프롬프트에 포함하여 안티패턴 학습

**2차 방어: 오케스트레이터 측 후처리 (SKILL.md에 명시)**
```
서브에이전트 반환값 처리 규칙:
1. 반환값의 첫 번째 줄(개행 전까지)만 상태 판단에 사용
2. 첫 줄에서 키워드 추출: "FAIL", "PASS", "generated", "changed", "written"
3. 나머지 텍스트는 무시 — 메모리에 유지하지 않고, 후속 프롬프트에 포함하지 않음
4. 이 규칙을 오케스트레이터 SKILL.md에 명시하여, 오케스트레이터 역할의 LLM이 
   반환값 전체를 분석하려는 시도를 차단
```

> **현실적 한계**: SKILL.md는 마크다운 프롬프트이므로, "나머지를 무시하라"는 지시도 LLM 요청이다. Agent tool 반환값이 오케스트레이터 컨텍스트에 물리적으로 적재되는 것을 막을 수는 없다. 다만, 오케스트레이터가 해당 텍스트를 후속 프롬프트에 **재사용하지 않도록** 지시하는 것은 효과적이다.

**3차 방어 (Phase B 이후 검토): 정량적 검증**
- Phase B 구현 후 실제 토큰 사용량을 측정
- 서브에이전트 반환값의 실제 크기를 로깅
- 목표치(오케스트레이터 ~15K) 미달 시 대안 검토:
  - 대안 A: 반환값 상한을 3-5줄로 완화하고, 토큰 목표를 ~20K로 조정
  - 대안 B: 서브에이전트 반환값에서 특정 마커 이후만 파싱하는 패턴 도입

#### PoC 권고

**구현 착수 전 반드시 실행해야 할 PoC**:

```
PoC 설계:
1. 간단한 서브에이전트를 Agent tool로 디스패치
2. 프롬프트에 Output Contract("1줄만 반환") 포함
3. 서브에이전트에게 파일 읽기 + 수정 + 결과 요약 작업 지시
4. 측정: (a) 실제 반환값 길이 (b) 오케스트레이터 컨텍스트 증가량

판단 기준:
- 반환값이 일관되게 1-3줄 → 설계대로 진행
- 반환값이 5-10줄 → 토큰 목표를 ~20K로 조정, 설계는 유지
- 반환값이 50줄+ → 근본적 재설계 필요 (파일 기반 통신만으로는 부족)
```

#### PoC 실행 결과 (2026-04-15)

5개 시나리오를 Agent tool로 실제 디스패치하여 검증 완료.

**프롬프트 패턴**: Output Contract 섹션을 프롬프트 최하단에 배치, `"CRITICAL: Your response must be EXACTLY ONE LINE."` 강조문 포함.

| # | 모델 | 시나리오 | 반환 줄 수 | 반환 길이 | 준수 |
|---|------|---------|----------|----------|------|
| 1 | haiku | 단순 검증 (build/test 모두 SKIP, TODO 스캔) | 1줄 | ~65자 | ✅ |
| 2 | haiku | 파일 읽기 + 라인 수 분석 | 1줄 | ~40자 | ✅ |
| 3 | haiku | 에러 상황 (build FAIL — package.json 없음) | 1줄 | ~55자 | ✅ |
| 4 | sonnet | 복합 작업 (3개 파일 읽기 + 프로젝트 분석) | 1줄 | ~55자 | ✅ |
| 5 | opus | Layer 2+3 평가 (3개 파일 읽기 + 구조 검증 + pre-mortem) | 1줄 | ~350자 | ⚠️ |

**실제 반환값 (원문)**:

```
#1 (haiku):  "PASS — build SKIPPED, test SKIPPED, lint SKIPPED, scan 0 TODO"
#2 (haiku):  "1 files analyzed — README.md (918 lines)"
#3 (haiku):  "FAIL — build: package.json not found at C:\workspace\agent-harness"
#4 (sonnet): "analysis complete — 4 key files found, 3 directories scanned"
#5 (opus):   "PASS — All 3 structural criteria met (workflow skill exists, evaluator 
              templates exist, README exists); pre-mortem risks: (1) evaluator template 
              placeholders could silently render empty if state.json is corrupted...(후략)"
```

**핵심 발견**:

1. **1줄 반환 제약은 작동한다** — 5/5 모두 정확히 1줄만 반환. 복수 줄 반환 0건.
2. **haiku가 가장 간결** — 형식을 정확히 준수, ~50-65자. Verify SubAgent에 최적 확인.
3. **opus는 1줄이지만 내용이 길다** — 시나리오 5에서 ~350자(~80-100 토큰). 판단 결과를 한 줄에 압축하려는 경향. 수천 토큰 대비 충분히 경미하나, 복수 디스패치 시 누적 고려 필요.
4. **에러 상황에서도 준수** — FAIL 시에도 1줄 에러 요약만 반환. 장문 에러 로그를 반환하지 않음.

**판단**: 판단 기준 첫 번째("일관되게 1-3줄 → 설계대로 진행")에 해당. **설계 핵심 전제 검증 완료 — 구현 착수 가능.**

**보완 권고** (PoC 결과 기반):
- opus의 긴 1줄 대응: 오케스트레이터가 반환값에서 첫 번째 키워드(PASS/FAIL)만 추출하고 나머지는 상태 메시지로 사용자에게 표시하는 것으로 충분
- 섹션 5.6의 "2차 방어: 오케스트레이터 측 후처리" 전략이 실질적으로 불필요할 가능성 높음 — 모든 모델이 Output Contract를 준수하므로 1차 방어만으로 충분. 단, 안전장치로 유지

### 5.7 verify_report.md 덮어쓰기 정책

**결정: 매 실행 시 덮어쓰기**

- Verify SubAgent는 실행할 때마다 `verify_report.md`를 **새로 작성** (이전 내용 덮어쓰기)
- Generator retry 서브에이전트에는 **가장 최근 FAIL 로그만** 제공 (이전 retry의 실패 내용은 불필요 — 이미 수정 시도된 것이므로)
- 라운드(round) 전환 시에도 덮어쓰기 — 이전 라운드의 verify 결과는 해당 라운드의 qa_report.md에 이미 반영되어 있음

**근거**: retry마다 누적하면 Generator가 "이전에 뭘 시도했는지" 분석하게 되어 컨텍스트가 비대해진다. 새 서브에이전트는 **현재 에러만** 보고 수정하는 것이 Thin Orchestrator의 원칙에 부합한다.

---

## 섹션 6: state.json 확장 설계

### 6.1 현재 state.json 필드 (v7.0.0)

```json
{
  "task": "...",
  "mode": "single|standard|multi",
  "model_config": { "preset": "...", "executor": "...", "advisor": "...", "evaluator": "..." },
  "user_lang": "ko",
  "has_git": true,
  "repo_name": "...",
  "repo_path": "...",
  "phase": "plan_ready|planning|generate_ready|generating|completed",
  "round": 1,
  "max_rounds": 3,
  "max_files": 20,
  "scope": "...",
  "branch": "harness/<slug>",
  "lang": "typescript",
  "test_cmd": "npm test",
  "build_cmd": "npm run build",
  "docs_path": "docs/harness/<slug>/",
  "created_at": "..."
}
```

### 6.2 확장된 state.json (v8.0.0)

```json
{
  "version": "2.0",
  "task": "사용자 인증 기능 추가",
  "mode": "single|standard|multi",
  "run_style": "auto|phase|step",
  "model_config": {
    "preset": "balanced",
    "executor": "sonnet",
    "advisor": "opus",
    "evaluator": "opus",
    "verifier": "haiku"
  },
  "user_lang": "ko",
  "has_git": true,
  "repo_name": "my-app",
  "repo_path": "/path/to/my-app",
  "phase": "plan_ready",
  "round": 1,
  "max_rounds": 3,
  "max_files": 20,
  "scope": "src/auth/**",
  "branch": "harness/add-user-auth",
  "lang": "typescript",
  "build_cmd": "npm run build",
  "test_cmd": "npm test",
  "lint_cmd": "npm run lint",
  "type_check_cmd": "npx tsc --noEmit",
  "verify": {
    "layer1_result": "PASS|FAIL|null",
    "layer1_retries": 0,
    "layer2_result": "PASS|FAIL|null",
    "layer2_retries": 0,
    "todo_blocking": false
  },
  "docs_path": "docs/harness/add-user-auth/",
  "created_at": "2026-04-14T15:00:00+09:00",
  "updated_at": "2026-04-14T15:30:00+09:00"
}
```

### 6.3 신규 및 변경 필드 상세

#### `version` (신규)

- **타입**: string
- **값**: `"2.0"` (v8.0.0에서 생성된 state.json)
- **용도**: 세션 복구 시 v1/v2 state.json을 구분. version 필드가 없으면 v1로 간주하여 기존 로직으로 처리

#### `run_style` (신규)

- **타입**: `"auto" | "phase" | "step"`
- **기본값**: `"auto"`
- **설정 시점**: Step 1에서 CLI 인자 파싱 또는 기본값 적용
- **동작 차이**:

| 모드 | 단계 사이 동작 | 세션 종료 시점 |
|------|--------------|--------------|
| `auto` | 자동 진행 (사용자 게이트: plan_done만) | completed |
| `phase` | 각 done 상태에서 세션 종료 가능 | plan_done, verify_done 등 |
| `step` | 지정 단계만 실행 후 종료 | 해당 단계 완료 즉시 |

#### `lint_cmd` (신규)

- **타입**: string | null
- **자동 감지 전략**: 섹션 6.4 참조
- **사용 위치**: Verify SubAgent 프롬프트

#### `type_check_cmd` (신규)

- **타입**: string | null
- **자동 감지 전략**: 섹션 6.4 참조
- **사용 위치**: Verify SubAgent 프롬프트

#### `verify` (신규 — 객체)

- **용도**: Layer 1, 2 검증 상태 추적
- **필드**:
  - `layer1_result`: 가장 최근 Layer 1 결과 (null = 미실행)
  - `layer1_retries`: 현재 라운드의 Layer 1 재시도 횟수 (라운드 전환 시 0 리셋)
  - `layer2_result`: 가장 최근 Layer 2 결과
  - `layer2_retries`: 현재 라운드의 Layer 2 재시도 횟수
  - `todo_blocking`: TODO/FIXME/HACK 발견 시 blocking으로 처리할지 (기본 false)

#### `phase` 확장

기존 4단계에서 12단계로 세분화하면서 네이밍도 full-name으로 정리:

```
v7:   plan_ready → gen_ready    → eval_ready → completed
v7.1: plan_ready → gen_ready    → verify_ready → verifying → verify_done → eval_ready → completed
                                  ↑ Phase A에서 추가 (기존 축약 네이밍 유지)

v8:   plan_ready → planning → plan_done → generate_ready → generating → generate_done
      → verify_ready → verifying → verify_done → evaluate_ready → evaluating → evaluate_done
      → completed
      ↑ Phase B에서 full-name rename
```

**v7 → v8 phase 호환 매핑** (세션 복구 시 적용):

| v7 phase | v8 phase | 비고 |
|----------|----------|------|
| `plan_ready` | `plan_ready` | 동일 |
| `gen_ready` | `generate_ready` | rename |
| `eval_ready` | `evaluate_ready` | rename |
| `completed` | `completed` | 동일 |
| `verify_ready` | `verify_ready` | v7.1에서 추가, v8에서 유지 |
| `verifying` | `verifying` | v7.1에서 추가, v8에서 유지 |
| `verify_done` | `verify_done` | v7.1에서 추가, v8에서 유지 |

세션 복구 시 version이 없고 `gen_ready`가 발견되면 v7 로직으로 처리. version "2.0"이면 위 매핑 테이블로 자동 변환.

**상태 전이 규칙**:
- `*_ready` → `*ing`: 서브에이전트 디스패치 시 즉시 전환
- `*ing` → `*_done`: 서브에이전트 완료 시 전환
- `*_done` → 다음 `*_ready`: Auto 모드에서 자동 / Phase 모드에서 사용자 재개 시
- Phase 모드 세션 종료 가능 지점: `plan_done`, `generate_done`, `verify_done`, `evaluate_done`

#### `updated_at` (신규)

- **타입**: ISO8601 string
- **용도**: state.json이 마지막으로 갱신된 시점. 세션 복구 시 "얼마나 오래된 세션인지" 판단

### 6.4 lint_cmd / type_check_cmd 자동 감지 전략

기존 build_cmd/test_cmd 감지를 확장한다. 감지 방식을 두 가지로 분류한다:

- **Type A — 파일 존재 감지**: 특정 파일이 존재하는지만 확인 (Glob/ls). 기존 build_cmd/test_cmd와 동일한 방식.
- **Type B — 파일 내용 감지**: 파일을 Read하여 내부 구조를 파싱해야 함. lint/type-check 감지에서 새로 필요.

Type B는 구현 시 오케스트레이터가 Read tool로 해당 파일을 열고 특정 키/섹션을 확인해야 한다. 감지 테이블에 각 항목의 타입을 명시한다.

#### lint_cmd 감지

| 우선순위 | 감지 타입 | 감지 조건 | lint_cmd | 구현 노트 |
|---------|---------|----------|---------|----------|
| 1 | **B** | `package.json`의 `scripts`에 `"lint"` 키 존재 | `npm run lint` | Read package.json → JSON 파싱 → scripts.lint 존재 확인 |
| 2 | **A** | `.eslintrc` / `.eslintrc.js` / `.eslintrc.json` / `.eslintrc.yml` / `eslint.config.js` / `eslint.config.mjs` 존재 | `npx eslint .` | Glob으로 파일 존재 확인만 |
| 3 | **B** | `pyproject.toml`에 `[tool.ruff]` 섹션 존재 | `ruff check .` | Read pyproject.toml → `[tool.ruff]` 문자열 grep |
| 4 | **A+B** | `pyproject.toml`에 `[tool.pylint]` 또는 `.pylintrc` 존재 | `pylint {scope}` | .pylintrc는 Type A, pyproject.toml 내 확인은 Type B |
| 5 | **A** | `.golangci.yml` / `.golangci.yaml` 존재 | `golangci-lint run` | Glob으로 파일 존재 확인만 |
| 6 | **A** | `Cargo.toml` 존재 (Rust) | `cargo clippy` | Glob으로 파일 존재 확인만 |
| — | — | 위 모두 해당 없음 | `null` (SKIP) | |

**감지 로직**: 위에서 아래로 순서대로 확인, **첫 번째 매치**에서 중단.

#### type_check_cmd 감지

| 우선순위 | 감지 타입 | 감지 조건 | type_check_cmd | 구현 노트 |
|---------|---------|----------|---------------|----------|
| 1 | **A** | `tsconfig.json` 존재 | `npx tsc --noEmit` | Glob으로 파일 존재 확인만 |
| 2 | **A+B** | `pyproject.toml`에 `[tool.mypy]` 또는 `mypy.ini` 존재 | `mypy .` | mypy.ini는 Type A, pyproject.toml 내 확인은 Type B |
| 3 | **A+B** | `pyproject.toml`에 `[tool.pyright]` 또는 `pyrightconfig.json` 존재 | `pyright` | pyrightconfig.json은 Type A |
| 4 | **A** | `*.csproj` 존재 | `null` (build에 포함) | |
| 5 | **A** | `go.mod` 존재 | `null` (build에 포함) | |
| 6 | **A** | `Cargo.toml` 존재 | `null` (build에 포함) | |
| — | — | 위 모두 해당 없음 | `null` (SKIP) | |

**Go/Rust/C# 참고**: 이 언어들은 빌드 자체가 타입 체크를 포함하므로, build_cmd과 type_check_cmd이 중복되지 않도록 null로 처리.

#### 사용자 오버라이드

자동 감지 결과가 부정확한 경우 CLI에서 직접 지정 가능:

```bash
/workflow "태스크" --lint-cmd "npm run lint:fix" --type-check-cmd "npx tsc --noEmit --strict"
```

CLI 인자가 제공되면 자동 감지를 스킵하고 해당 값을 사용.

### 6.5 verify 결과 저장 전략

**결정: state.json에는 요약만, 상세 로그는 verify_report.md에**

| 저장 위치 | 내용 | 이유 |
|----------|------|------|
| `state.json.verify.layer1_result` | `"PASS"` or `"FAIL"` | 오케스트레이터가 분기 판단에만 사용 |
| `state.json.verify.layer1_retries` | 숫자 | 최대 재시도 도달 여부 판단 |
| `verify_report.md` | 전체 명령어 출력, 에러 로그, 스캔 결과 | 서브에이전트(Generator retry, Evaluator)가 상세 내용 참조 |

**이유**: state.json은 오케스트레이터의 **상태 전이 결정**에만 사용되므로 PASS/FAIL 1개면 충분. 상세 로그를 state.json에 넣으면 오케스트레이터가 파싱할 필요 없는 정보로 파일이 비대해짐.

### 6.6 v1 ↔ v2 state.json 호환성

```
세션 복구 시:
1. state.json 읽기
2. "version" 필드 확인
   - version 없음 → v1 state.json → 기존 v7 로직으로 처리
   - version "2.0" → v2 state.json → Thin Orchestrator 로직으로 처리
3. v1 state.json을 v2로 마이그레이션하지 않음 (진행 중 세션은 시작했던 방식으로 완료)
```

**원칙**: 진행 중인 워크플로우는 시작했던 버전의 로직으로 완료한다. 중간에 엔진을 교체하면 상태 불일치 위험이 크다.

---

## 섹션 7: 기존 스킬 적용 가능성

Thin Orchestrator + Mechanical Quality Gates 패턴의 두 가지 핵심 요소를 분리하여 적용 가능성을 분석한다:
- **패턴 A**: Thin Orchestrator (서브에이전트 1줄 반환, 파일 기반 통신)
- **패턴 B**: Mechanical Quality Gates (Layer 1 자동 검증 → Layer 2 구조 검증 → Layer 3 LLM)

### 7.1 적용 가능 스킬 상세 분석

#### `/refactor` — 패턴 A + B 모두 직접 적용

| 항목 | 현재 | 적용 후 |
|------|------|--------|
| 오케스트레이터 | 인라인 실행 | Thin Orchestrator (상태 머신) |
| 행동 보존 검증 | 테스트 통과 확인 (수동적) | Layer 1: 기존 테스트 전체 자동 실행 → 1건이라도 실패 시 즉시 롤백 |
| 코드 품질 | LLM 판단 | Layer 1: lint + type-check (기계적) |
| 각 atomic step 후 | 다음 step 진행 | Layer 1 verify → FAIL 시 해당 step만 재시도 |

**적합도**: ★★★★★ — `/refactor`의 핵심 원칙이 "행동 보존"이므로, Mechanical Verify가 이를 구조적으로 보장. 가장 자연스러운 적용 대상.

**적용 방법**: 각 atomic refactoring step 후 Verify SubAgent를 삽입. build + test만 실행 (lint는 리팩토링 범위에 따라 선택적).

#### `/migrate` — 패턴 B 강화 적용

| 항목 | 현재 | 적용 후 |
|------|------|--------|
| 단계별 검증 | 이미 존재 (각 step 후 test) | Layer 1 체계로 표준화: build → test → lint → type-check |
| 실패 시 | 롤백 후 사용자 개입 | Layer 1 FAIL → 자동 재시도 (최대 3회) → 초과 시 사용자 개입 |
| 검증 리포트 | 없음 | verify_report.md로 단계별 결과 누적 |

**적합도**: ★★★★☆ — 이미 단계별 검증이 있으므로 Layer 1 형식으로 표준화하면 됨. 신규 개발 아닌 형식 통일.

**적용 방법**: 기존 per-step test 실행을 Verify SubAgent 호출로 교체. 실패 재시도 메커니즘 추가.

#### `/test-gen` — 패턴 B 부분 적용

| 항목 | 현재 | 적용 후 |
|------|------|--------|
| 생성 테스트 실행 | 이미 존재 (생성 → 실행 → mutation testing) | Layer 1: 생성 테스트 실행 + lint 추가 |
| 테스트 품질 | mutation testing으로 검증 | 유지 (mutation testing이 Layer 1보다 강력) |

**적합도**: ★★★☆☆ — mutation testing이 이미 Mechanical Verify보다 강력한 검증. Layer 1 추가 시 lint/type-check만 의미 있음.

**적용 방법**: 생성된 테스트 파일에 대해 lint + type-check만 Layer 1에 추가. mutation testing은 기존 유지.

#### `/debug` — 패턴 B 부분 적용

| 항목 | 현재 | 적용 후 |
|------|------|--------|
| hypothesis 검증 | LLM이 코드 분석 | Layer 1: fix 적용 후 build + test 자동 실행 |
| fix 확인 | "이 수정이 맞는지" LLM 판단 | Layer 1: 원래 실패하던 테스트가 통과하는지 기계적 확인 |

**적합도**: ★★★☆☆ — hypothesis 자체는 LLM 영역이지만, fix 적용 후 검증은 기계적으로 가능.

**적용 방법**: fix 적용 → Verify SubAgent (build + target test 실행) → FAIL 시 다른 hypothesis로 전환.

### 7.2 적용 어려운 스킬

| 스킬 | 이유 | 대안 |
|------|------|------|
| `/spec` | 코드 생성 없음, Mechanical Verify 대상 없음 | 패턴 A(Thin Orchestrator)만 적용 가능 — multi 모드에서 서브에이전트 반환 최적화 |
| `/code-review` | 읽기 전용, 코드 변경 없음 | 없음 (이미 경량) |
| `/codebase-audit` | 분석 전용, 코드 변경 없음 | 패턴 A만 적용 가능 — thorough 모드에서 서브에이전트 반환 최적화 |
| `/md-generate` | 문서 생성, 실행 검증 불가 | 없음 |
| `/md-optimize` | 문서 최적화, 실행 검증 불가 | 없음 |

### 7.3 스킬별 적용 매트릭스 요약

| 스킬 | 패턴 A (Thin Orch.) | 패턴 B (Mech. Gates) | 우선순위 | 비고 |
|------|---------------------|---------------------|---------|------|
| `/workflow` | ✅ 핵심 대상 | ✅ 핵심 대상 | P0 | v8.0.0 |
| `/refactor` | ✅ 적용 | ✅ 직접 적용 | P1 | atomic step마다 verify |
| `/migrate` | ⚠️ 선택적 | ✅ 강화 적용 | P1 | 기존 검증 표준화 |
| `/debug` | ⚠️ 선택적 | ⚠️ 부분 적용 | P2 | fix 후 검증만 |
| `/test-gen` | ⚠️ 선택적 | ⚠️ 부분 적용 | P2 | lint/type-check만 추가 |
| `/spec` | ⚠️ 선택적 | ❌ 불가 | P3 | Thin Orch.만 |
| `/codebase-audit` | ⚠️ 선택적 | ❌ 불가 | P3 | Thin Orch.만 |
| `/code-review` | ❌ 불필요 | ❌ 불가 | — | 이미 경량 |
| `/md-generate` | ❌ 불필요 | ❌ 불가 | — | |
| `/md-optimize` | ❌ 불필요 | ❌ 불가 | — | |

### 7.4 공통 패턴 추출 전략

**결정: v8에서는 /workflow에 인라인, v9에서 공유 가이드 추출**

#### 근거

1. **패턴이 아직 검증되지 않음** — /workflow에서 실제로 작동하는지 확인 전에 추출하면, 잘못된 패턴이 전파될 위험
2. **스킬마다 적용 범위가 다름** — /refactor는 Layer 1만 필요, /debug는 fix 검증만 필요. 범용 가이드가 너무 추상적이면 유용성 저하
3. **인라인이 더 빠름** — 공유 가이드 설계 + 참조 체계 구축은 추가 작업. v8 목표(토큰 절감 + 품질 보장)에 집중

#### v9 추출 계획 (향후)

v8에서 /workflow가 안정화되면:
1. Verify SubAgent 프롬프트를 `templates/shared/verify_layer1.md`로 추출
2. 오케스트레이터 1줄 반환 규칙을 `templates/shared/thin_orchestrator_contract.md`로 추출
3. 각 스킬이 `{% include "shared/verify_layer1.md" %}` 형태로 참조 (실제 include가 아닌 프롬프트 내 참조 지시)

```
templates/shared/
├── verify_layer1.md          ← Mechanical Verify 표준 프롬프트
├── thin_orchestrator_contract.md  ← 1줄 반환 규칙 + 파일 통신 규약
└── state_machine_pattern.md  ← 상태 전이 패턴 가이드
```

---

## 섹션 8: 마이그레이션 계획

**전략: 2단계 점진적 도입** — 한 번에 전환하지 않고, 검증 가능한 단위로 나누어 도입한다.

### 8.1 전환 전략 개요

```
Phase A (v7.1.0): 현재 아키텍처 + Mechanical Verify 추가
  └── 기존 Fat Orchestrator 유지
  └── Generator 후 Verify SubAgent 삽입 (Layer 1만)
  └── 기존 Evaluator 유지 (Layer 3)
  └── state.json에 verify 관련 필드 추가
  └── lint_cmd, type_check_cmd 자동 감지 추가

Phase B (v8.0.0): Thin Orchestrator 전환
  └── 오케스트레이터를 상태 머신으로 전환
  └── 서브에이전트 1줄 반환 규칙 적용
  └── Phase/Step 실행 모드 추가
  └── Layer 2 (Structural Verification) 추가
  └── 전체 3-Layer 체계 완성
```

### 8.2 Phase A 상세 (v7.1.0 — Mechanical Verify 추가)

#### 변경 범위

| 파일 | 변경 내용 |
|------|----------|
| `skills/workflow/SKILL.md` | Step 4와 Step 5 사이에 Auto-Verify 단계 삽입 |
| `templates/verify/verify_layer1.md` (신규) | Verify SubAgent 프롬프트 템플릿 |
| `skills/workflow/SKILL.md` Step 1 | lint_cmd, type_check_cmd 자동 감지 로직 추가 |

#### 구현 순서

```
A-1. lint_cmd / type_check_cmd 자동 감지 로직 추가 (Step 1 확장)
     - 섹션 6.4의 감지 테이블을 Step 1.3에 통합
     - state.json에 lint_cmd, type_check_cmd 필드 추가

A-2. Verify SubAgent 프롬프트 템플릿 작성
     - templates/verify/verify_layer1.md 생성
     - 섹션 5.3의 프롬프트 구조 반영

A-3. SKILL.md에 Auto-Verify 단계 삽입
     - 기존 Step 4 (Generator) 후, Step 5 (Evaluator) 전에 삽입
     - FAIL 시 Generator 재시도 루프 (최대 3회)
     - state.json phase에 verify_ready, verifying, verify_done 추가
     - ⚠️ 기존 phase 네이밍 유지: gen_ready, eval_ready는 v7 값 그대로 사용
       verify 관련 phase만 신규 추가 (verify_ready, verifying, verify_done)

A-4. 기존 Evaluator에 verify_report.md 입력 추가
     - Evaluator 프롬프트에 verify_report.md 경로 추가
     - "Layer 1을 이미 통과한 코드"라는 컨텍스트 제공
```

#### Phase A 완료 기준

- [x] `npm test` / `npm run build` 등 기존 test_cmd/build_cmd가 Generator 코드에 자동 실행됨
- [x] lint/type-check가 감지되어 실행됨 (해당하는 프로젝트에서)
- [x] Layer 1 FAIL 시 구체적 에러 로그와 함께 Generator에 재시도 지시됨
- [x] verify_report.md가 아티팩트로 생성됨
- [x] 기존 사용 경험(UX)에 변화 없음 — 추가 검증 단계가 투명하게 삽입

#### 호환성

- 기존 진행 중 세션(v7 state.json)은 영향 없음 — verify 필드 없으면 verify 단계 스킵
- 기존 아티팩트 구조 유지 — verify_report.md만 추가

### 8.3 Phase B 상세 (v8.0.0 — Thin Orchestrator 전환)

#### 변경 범위

| 파일 | 변경 내용 |
|------|----------|
| `skills/workflow/SKILL.md` | 전면 재작성 — 상태 머신 기반 오케스트레이터 |
| `templates/planner/*.md` | 출력 계약(1줄 반환) 추가, 나머지 유지 |
| `templates/generator/*.md` | 출력 계약 추가, 나머지 유지 |
| `templates/evaluator/evaluator_prompt.md` | Layer 2 체크리스트 추가, Layer 3 유지 |
| `templates/verify/verify_layer1.md` | Phase A에서 작성 완료, 미변경 |

#### 구현 순서

```
B-1. state.json v2 스키마 구현
     - version "2.0" 필드 추가
     - phase 12단계 세분화 + full-name rename (gen_ready → generate_ready, eval_ready → evaluate_ready)
     - run_style 필드 (기존 설계의 run_style에서 rename)
     - 세션 복구 시 version 분기 로직
     - v1 phase 호환 매핑: {"gen_ready": "generate_ready", "eval_ready": "evaluate_ready"}

B-2. 서브에이전트 출력 계약 적용
     - 모든 기존 템플릿에 "Output Contract" 섹션 추가
     - "Your FINAL message must be exactly ONE line" 규칙
     - 기존 템플릿의 본문 로직은 변경 없음

B-3. 오케스트레이터 상태 머신 전환
     - SKILL.md를 상태 전이 기반으로 재작성
     - 각 상태에서: (1) state.json 갱신 (2) 서브에이전트 디스패치 (3) 1줄 반환 파싱 (4) 다음 상태 결정
     - 진행 상황 표시 메시지 (섹션 4 형식)

B-4. run_style 지원
     - auto: 기존과 동일한 자동 진행 (plan_done 게이트만)
     - phase: CLI 인자 파싱 (/workflow plan, /workflow generate 등)
     - step: 특정 단계만 실행

B-5. Layer 2 Structural Verification 추가
     - Evaluator 프롬프트에 Layer 2 체크리스트 삽입 (섹션 5.4 형식)
     - qa_report.md에 Layer 2 결과 섹션 추가
```

#### Phase B 완료 기준

- [x] 오케스트레이터 컨텍스트가 ~15K 이하로 유지됨 (서브에이전트 반환 1줄)
- [x] `/workflow "태스크"` (auto 모드)가 기존과 동일한 UX 제공
- [x] `/workflow plan "태스크"` → `/workflow generate` (phase 모드) 작동
- [x] `/workflow verify` (step 모드) 작동
- [x] Layer 1 → Layer 2 → Layer 3 순차 검증 체계 작동
- [x] v1 state.json 세션이 v2 코드에서 정상 복구 (기존 로직으로 처리)

### 8.4 기존 템플릿 재활용 방안

**원칙: 템플릿 본문은 최대한 유지, 인터페이스(입출력)만 변경**

| 템플릿 | 본문 변경 | 인터페이스 변경 |
|--------|----------|---------------|
| `planner/architect.md` | 없음 | Output Contract 추가 (1줄 반환 규칙) |
| `planner/senior_developer.md` | 없음 | Output Contract 추가 |
| `planner/qa_specialist.md` | 없음 | Output Contract 추가 |
| `planner/synthesis.md` | 없음 | Output Contract 추가 |
| `planner/synthesis_standard.md` | 없음 | Output Contract 추가 |
| `planner/cross_critique.md` | 없음 | Output Contract 추가 |
| `planner/planner_single.md` | 없음 | Output Contract 추가 |
| `generator/lead_developer.md` | 없음 | Output Contract 추가 |
| `generator/implementation.md` | 없음 | Output Contract 추가 + retry 입력 섹션 |
| `generator/implementation_standard.md` | 없음 | Output Contract 추가 + retry 입력 섹션 |
| `generator/generator_single.md` | 없음 | Output Contract 추가 + retry 입력 섹션 |
| `generator/combined_advisor.md` | 없음 | Output Contract 추가 |
| `generator/code_quality_advisor.md` | 없음 | Output Contract 추가 |
| `generator/test_stability_advisor.md` | 없음 | Output Contract 추가 |
| `evaluator/evaluator_prompt.md` | Layer 2 체크리스트 추가 | verify_report.md 입력 추가 |
| `verify/verify_layer1.md` **(신규)** | — | Phase A에서 신규 작성 |

**변경 패턴**: 각 기존 템플릿의 **마지막**에 다음 블록을 추가:

```markdown
## Output Contract
Your FINAL message must be exactly ONE line in this format:
"{expected format for this template}"
No other text after this line. Write all detailed results to the specified output file.
```

### 8.5 테스트 전략

#### 기능 검증

Phase A, B 각각에서 동일한 태스크로 v1과 비교:

```
테스트 태스크: "Express 앱에 JWT 기반 인증 미들웨어 추가"
프로젝트: 간단한 Express + TypeScript 앱 (사전 준비)

비교 항목:
1. 아티팩트 품질: spec.md, changes.md, qa_report.md의 내용 수준
2. 코드 품질: 빌드/테스트 통과 여부, lint 결과
3. 토큰 사용량: 전체 세션의 입력/출력 토큰 합계
4. 소요 시간: 전체 워크플로우 완료까지 wall-clock time
```

#### 회귀 테스트

```
1. 기존 UX 유지: auto 모드로 실행 시 사용자에게 보이는 게이트/질문이 동일한지
2. 세션 복구: 중간에 종료 후 재개 시 올바른 단계에서 이어가는지
3. v1 호환성: v1 state.json이 있는 프로젝트에서 v2 코드 실행 시 에러 없이 처리되는지
4. 모드 호환: single/standard/multi 3가지 모드 모두 정상 동작
```

#### 에지 케이스

```
1. build_cmd/test_cmd/lint_cmd가 모두 null인 프로젝트 → verify 단계에서 모두 SKIP, PASS 반환
2. Layer 1에서 3회 연속 FAIL → 사용자에게 수동 개입 요청 메시지
3. Layer 2에서 acceptance criteria 0건인 spec → Layer 2 스킵, Layer 3만 실행
4. phase 모드에서 /workflow generate를 plan 없이 실행 → 에러 메시지 + plan 실행 제안
5. step 모드에서 /workflow verify를 generate 없이 실행 → 에러 메시지
```

### 8.6 릴리스 일정 (예상)

```
Phase A (v7.1.0):
  A-1 ~ A-4 구현 + 기능 검증
  예상 작업량: SKILL.md 부분 수정 + 템플릿 1개 신규 + state.json 확장

Phase B (v8.0.0):
  B-1 ~ B-5 구현 + 회귀 테스트 + 에지 케이스 검증
  예상 작업량: SKILL.md 전면 재작성 + 기존 템플릿 16개 Output Contract 추가 + Evaluator 템플릿 확장
```

### 8.7 롤백 계획

```
Phase A 문제 발생 시:
  → Verify 단계를 SKILL.md에서 주석 처리 또는 조건부 스킵으로 비활성화
  → state.json의 verify 관련 필드를 무시하는 것만으로 v7.0.0 동작 복원
  → 기존 Generator/Evaluator 로직에 영향 없음

Phase B 문제 발생 시:
  → state.json version 분기가 있으므로, v2 로직 전체를 비활성화하고 v1 로직으로 폴백
  → 기존 templates/*.md의 Output Contract 섹션은 서브에이전트 동작에 영향 없음 (무시됨)
  → SKILL.md를 v7.1.0 시점으로 git revert 가능
```

---

## 다음 세션 작업 가이드

### 완료된 섹션 (1-8)
1. ✅ 핵심 문제 정의 (토큰 비효율 + 모델 품질 변동)
2. ✅ Thin Orchestrator 아키텍처 (상태 머신 + 서브에이전트 + 파일 핸드오프)
3. ✅ Mechanical Quality Gates (3-Layer 검증 체계 + 재시도 메커니즘)
4. ✅ UX 설계 (Auto/Phase/Step 3모드 + 상태 전이 + 진행 표시)
5. ✅ 서브에이전트 핸드오프 설계 (4종 서브에이전트 입력/출력/프롬프트 + 1줄 반환 규칙)
6. ✅ state.json 확장 설계 (v2 스키마 + lint/type-check 자동 감지 + 호환성)
7. ✅ 기존 스킬 적용 가능성 (적용 매트릭스 + v9 공유 가이드 추출 계획)
8. ✅ 마이그레이션 계획 (2단계 점진적 도입 + 템플릿 재활용 + 테스트/롤백)

### 설계 결정 완료 항목
1. ✅ Layer 2+3 → **단일 Evaluate 서브에이전트에서 실행** (동일 입력, 순차 파이프라인, 디스패치 오버헤드 감소)
2. ✅ lint/type-check → **프로젝트 설정 파일 기반 자동 감지** (Type A/B 분류 + CLI 오버라이드)
3. ✅ verify_report.md → **state.json에 PASS/FAIL만, 상세 로그는 파일에** (매 실행 덮어쓰기)
4. ✅ 공통 패턴 → **v8 인라인, v9에서 공유 가이드 추출** (검증 전 추출은 잘못된 패턴 전파 위험)
5. ✅ 전환 전략 → **2단계 점진적 도입** (Phase A: v7.1 Verify 추가 → Phase B: v8.0 Thin Orchestrator)

### 리뷰 반영 완료 항목 (2026-04-15)
- ✅ C-1: phase 네이밍 전환 계획 명시 (Phase A: v7 축약 유지 + verify 추가, Phase B: full-name rename + 호환 매핑)
- ✅ C-2: Phase 모드 세션 종료 지점 4곳으로 통일 (plan_done, generate_done, verify_done, evaluate_done)
- ✅ C-3: 1줄 반환 제약의 현실적 한계 + 대응 전략 3단계 + PoC 권고 (섹션 5.6)
- ✅ C-4: 재시도 루프 상태 전이 상세화 (phase 값 + retries 증가 시점 + 최대 도달 시 동작)
- ✅ I-1: Auto 모드 evaluate_done FAIL 시 Fix/Accept 게이트 명시
- ✅ I-2: lint/type-check 감지에 Type A(파일 존재)/Type B(내용 파싱) 분류 + 구현 노트
- ✅ I-3: Acceptance criteria 스캔을 Layer 1 → Layer 2로 이동 (의미 이해 필요한 작업)
- ✅ I-4: Step 모드 전제 조건 테이블 + 수동 수정 후 verify 시 fallback 정의
- ✅ I-5: "파일을 읽지 않는다" → "중간 산출물을 읽지 않는다" + 예외 2가지 명시
- ✅ I-6: Verify SubAgent model을 model_config.verifier로 변경 + 프리셋 테이블 추가
- ✅ S-1: execution_mode → run_style로 rename (mode와의 혼동 방지)
- ✅ S-2: verify_report.md 매 실행 시 덮어쓰기 정책 명시 (섹션 5.7)
- ✅ S-3: Layer 2 scope violation = FAIL + 재시도 지시("해당 파일 변경 revert") 명시

### PoC 검증 완료 (2026-04-15)
- ✅ 섹션 5.6 PoC — 5개 시나리오(haiku×3, sonnet×1, opus×1) 실행, 전원 1줄 반환 준수 확인
- 결론: 설계 핵심 전제 검증 완료, 구현 착수 가능

### 다음 작업: 구현 시작

설계 스펙 + PoC 검증이 완료되었으므로, 구현을 시작할 수 있다.

```
구현 순서 (권장):
1. Phase A-1: lint_cmd / type_check_cmd 자동 감지 로직 (SKILL.md Step 1 확장)
2. Phase A-2: verify_layer1.md 템플릿 신규 작성
3. Phase A-3: SKILL.md에 Auto-Verify 단계 삽입
4. Phase A-4: Evaluator 템플릿에 verify_report.md 입력 추가
5. 기능 검증 → v7.1.0 릴리스
6. Phase B 진행 (Thin Orchestrator 전환)
```
