# Stage 1 spec convergence record (2026-09-29)

> 확정 spec: `SPEC.md` (rev 5, 339줄, AC 17개). 작업 사본은 `docs/harness/stage-1-practitioner-hardening-see-design-practiti/spec.md`
> (gitignored — not a public link), `spec_stamp` generation 5.

## 왜 이 기록이 있나

`/harness` 표준 루프(Plan Critic → `/harness-gate` → `--modify` → `--critic` …)는 이 에픽에서 수렴하지 않았다.

| 라운드 | 설계 | Critical | Major | 비고 |
|---|---|---|---|---|
| rev 1 | 바이트 사본 통일 | 5 | 9 | Plan Critic |
| rev 2 | 〃 + 삭제 지점 전수표 | 3 | 8 | Plan Critic |
| rev 3 | 〃 + MANIFEST·run_id·결정표 | 3 | 11 | Plan Critic |
| rev 4 | clean-target 게이트로 전환 | 2 | 10 | Plan Critic (`spec.eval`, 1 agent) |
| rev 5 | rev 4 + 수렴 워크플로 | 0 | 0 | 아래 방식 — minor 6건은 문구로 직접 반영 |

비수렴 원인(관측): critic이 매 라운드 이전 판정을 모른 채 spec 전체를 새로 보고, 거짓 양성을 걸러 내는 검증이 없으며,
반영할 때마다 spec에 새 장치가 붙어 다음 라운드의 공격 표면이 늘었다. 라운드마다 사용자 명령이 3개 필요했다.

## rev 4 → rev 5 수렴 방식 (ultracode 워크플로)

1. **입력 합류** — `spec.eval` Plan Critic 19건 + 저장소 실측 리뷰 4렌즈(git 의미론 실측·저장소 사실 대조·S2 lint 실현성·WIP 손실 적대) 43건 = 62건.
2. **군집화** — 62건 → 47 cluster, 8개 주제 batch.
3. **주제별 적대 검증·분류** — 실측으로 확인되지 않으면 기각 쪽으로. 결과: 자동 반영 38, 결정 필요 6(5개 주제), 기각 3.
4. **통합 + 델타 재검증(바뀐 부분만)** — 1차 통합 후 새 C/M 8 → 2차 3 → 결정 확정 후 최종 통합 1차 3 → 2차 **0** (minor 6).
5. **결정 질문 1회** — 사용자가 5개 결정을 한 번에 확정.

## 확정 결정

| # | 주제 | 선택 | 요지 |
|---|---|---|---|
| D1 | clean 판정의 바이트 동일성 | A | `git cat-file --filters HEAD:<p>` sha256 == 작업 트리 sha256 조건 추가. EOL·smudge 불일치는 copy로 분류(실측: 이 저장소 `.md` 57개가 `i/lf w/crlf`인데 porcelain clean) |
| D2 | 'Commit WIP first' checkpoint | A | 보호 대상 조작이 끝나면 HEAD==sha일 때만 `reset --soft <sha>^` + 경로 unstage로 해체. migrate는 해체하지 않고 공시. HEAD가 다르거나 halt면 SHA·브랜치만 공시 |
| D3 | untracked·no-git 사본 위치 | B | `.harness-backup/<skill>/<상대 경로>` + 자기무시 `.gitignore`(`*`). 어떤 `.harness/` 삭제 경로도 사본을 지우지 못하므로 삭제 지점 배선이 필요 없다 |
| D4 | migrate 기존 untracked 보호 | A | §Created Files 부재 확인으로 삭제 경로만 막고 나머지는 공시 |
| D5 | S2 '같은 절 인용 = 허용' 범위 | B | REQUIRED_CITERS 5개 생산자 파일에서만 유효. 그 밖의 파일은 allowlist 개수로만 판정 |

## 후속

- **harness UX 개선 에픽을 Stage 1 구현 전에 먼저 한다**(사용자 결정). 목표: Converge 자동 루프(실측 리뷰 → 적대 검증 → 분류 → 일괄 반영 → 델타 재검증, seen-set으로 재등장 차단), 결정 질문·승인 1회로 게이트 통합(Fast Gate의 `gate.approved` 메커니즘 일반화), 승인 후 자동 체이닝.
- Stage 1 세션(`.harness/state.json`, phase `plan_done`, 브랜치 `harness/stage-1-practitioner-hardening-see-design-practiti`)은 보존한다. `plan_critic.spec_stamp_at_critic`은 generation 4를 가리키므로 기존 게이트는 rev 5를 stale로 렌더한다 — rev 5의 검토 근거는 이 문서다.
