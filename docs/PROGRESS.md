# SoulBound — 작업 진척도 트래커 (Work Progress Tracker)

> ⚠️ **진실의 원천(source of truth)은 `PROJECT_STATE.md`** 입니다. 이 문서는 그 인수인계 문서를
> **빠르게 훑기 위한 파생 요약 뷰**일 뿐이며, 충돌 시 항상 `PROJECT_STATE.md` + repo 파일이 우선합니다.
> 상태가 바뀌면 `PROJECT_STATE.md`를 먼저 갱신하고, 이 요약을 그에 맞춰 갱신하세요.
> 설계 캐논: `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`(동결).
> UI/UX 변경 추적: `docs/UIUX_CHANGELOG.md`. 운영 루프: `docs/WORKFLOW.md`.

- **현재 단계**: **P0 MVP 기능 + 하드닝 완성** (Task 1–9 완료). RC staging 검증 완료. **`v0.1.0-rc.2` 태그됨 @ `e517ec3`**. Pre-alpha UI/UX polish 최종 독립검토 PASS(`3bd68f2`, verdict 기록 `0efd237`). 2026-06-18 design pass + PWA `ac62201`도 최종 독립검토 PASS(acceptable for pre-alpha); push/deploy 전 host-only runtime gate만 남음.
- **다음 단계**: internal alpha 운영. Task 9a-2 reaper 자동화는 CODE FINAL PASS, 배포 게이트 진행 중.
- **현재 브랜치**: `phase1-p0-mvp`
- **검증 환경**: Node 24 / pnpm 11.1.3
- **요약 갱신일**: 2026-06-18 (KST)

---

## 1. 한눈에 보는 현황 (Snapshot)

현재 작업 트리(`phase1-p0-mvp` 병합 기준)에서 이 세션이 직접 재실행해 확인한 게이트:

| 게이트 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm -r typecheck` | ✅ CLEAN | core / adapters / web 3개 프로젝트 |
| `pnpm -F @soulbound/core test` | ✅ 20 passed | Task 9b에서 19→20 (INV-16 outbox payload lock) |
| `pnpm -F @soulbound/adapters test` (unit) | ✅ 22 passed | |
| `pnpm -F web test` (unit) | ✅ 44 passed | 10 파일 |
| `bash scripts/audit.sh` | ✅ PASSED | apps/supabase 검사 전부 활성·OK (더 이상 SKIP 아님) |

> Docker 의존 게이트(Supabase 통합/`pgTAP`)는 이 세션에서 실행하지 않았다. `PROJECT_STATE.md` 기준
> 최종 확정값: **pgTAP 73**, `test:integration` **5/5 ×5 + db reset green**(flake 0), adapters live 통합 포함.
> 이들은 호스트 전용(JT) 결정성 게이트로, RC-1/RC-2 검증에서 green 확정됨.

---

## 2. Task 진척 (BuildPlan 10-Task)

상세 증적과 *이유*는 `PROJECT_STATE.md §2` 및 `docs/TASK*_AUDIT_FINDINGS.md` 참조.

| Task | 내용 | 상태 | 증적 |
| --- | --- | --- | --- |
| 0A/0B/0C/0D | core 계약 + 19 불변식 테스트 + toolchain + freeze commit | ✅ 완료 (동결) | MANIFEST.txt |
| 1 | monorepo+core 게이트 (typecheck/build/audit, 19 RED 정상) | ✅ 완료 | — |
| 2 | core 서비스 본문 구현 → 19 GREEN | ✅ 완료 | — |
| 3 | Supabase schema + RLS + RPC (DB only) | ✅ 완료 (R2 Codex 재구현) | TASK3_AUDIT_FINDINGS.md |
| 4 | Supabase + noop adapters (3-client 경계) | ✅ 완료 (3라운드 PASS) | TASK4_AUDIT_FINDINGS.md |
| 4.5 | 신뢰 role 소스 (`current_user_role()`) | ✅ 완료 | TASK4_5_AUDIT_FINDINGS.md |
| 5 / 5.5 | service 배선 (`makeCoreContainer`) + seed sign-in 수정 | ✅ 완료 | TASK5_AUDIT_FINDINGS.md, TASK5_5_* |
| 6a / 6b | API routes (applicant + admin/reviewer) | ✅ 완료 | TASK6A_*, TASK6B_* |
| 7a / 7b | Persona Clip routes + signed-upload + recorder 컴포넌트 | ✅ 완료 | TASK7A_*, TASK7B_* |
| profiles provision | signup→profiles 트리거 (0007) | ✅ 완료 | PROFILES_PROVISIONING_AUDIT_FINDINGS.md |
| 8a / 8b | UI — 공개/신청 UI + member/admin UI | ✅ 완료 (UI 전체) | TASK8A_*, TASK8B_* → `docs/UIUX_CHANGELOG.md` |
| Pre-alpha UI/UX polish | early-KakaoTalk-like member shell (`멤버/대화/더보기`) + public/auth/gate/apply/status copy polish | ✅ 완료 (Opus/Cowork 최종 PASS) | `PROJECT_STATE.md`, `docs/UIUX_CHANGELOG.md`, `3bd68f2`, `0efd237` |
| Pre-alpha design pass + PWA | warm terracotta visual pass + UI primitives + PWA manifest/icons/install prompt/SW + applicant status privacy lock | ✅ final audit PASS (`ac62201`, host runtime gate pending before push/deploy) | `docs/DESIGN_PASS_BRIEF.md`, `docs/DESIGN_PASS_PLAN.md`, `docs/UIUX_CHANGELOG.md`, `PROJECT_STATE.md` |
| 9a / 9b | persona-clip byte-delete worker + audit/outbox 하드닝 lock | ✅ 완료 | TASK9A_*, TASK9B_* |
| 9a-2 | internal cron reaper route | ✅ CODE FINAL PASS / 배포 게이트 진행 중 | TASK9A2_REAPER_CRON_BRIEF.md |
| 10 | external ledger PoC (옵션, 별도 브랜치) | ⛔ 미착수 (의도적 보류) | — |

**🎉 P0 MVP happy-path end-to-end**: signup → gate → apply → submit → (reviewer) approve → member. 완료.

---

## 3. 릴리스 상태 (Release)

| 항목 | 상태 |
| --- | --- |
| `v0.1.0-rc.1` @ `fafba30` | ✅ 태그됨. RC-1 §13 FINAL AUDIT PASS (실 SMTP·signup→profiles·role boundary·approve/reject·member·clip lifecycle→manual reap→object absence·INV-17/no-leak) |
| `v0.1.0-rc.2` @ `e517ec3` | ✅ 태그됨 (현재). persona-clip recorder **MIME fallback**(Samsung/Safari MP4 경로, Chrome/webm 보존). 코드 Opus 최종감사 PASS + Samsung Internet 실기기 스모크 PASS |
| staging 배포 | ✅ Vercel `soulbound-staging` + Supabase 마이그 0001–0008 (no-seed) |
| RC 결정 | email-confirm ON · open signup · daily cron reaper + manual CLI fallback · CAPTCHA deferred |

---

## 4. 잔여·미결 항목 (Open Items)

`PROJECT_STATE.md §4` 미결 항목의 요약. (상세·이유는 원문 참조)

- ⏳ **Safari persona-clip 호환성 스모크** — 후속(non-블로커). 미지원 시 graceful **PC-01 degradation**(클립 없이 제출).
- ⏳ **Task 9a-2 배포 게이트** — production 승격, `CRON_SECRET` 설정, cron 등록 확인, secret curl 200, 다음 정기 실행 로그 확인.
- ⏳ **Task 10-1** — outbox vs ledger 직접호출 책임 분리(중복 발급 위험). **Task 10 전** "서비스는 enqueue만, ledger 호출은 processor 1회"로 단일화 결정 필요.
- 🟡 **Pre-alpha design pass + PWA host-only runtime gate** — Android Chrome/Samsung Internet/iOS Safari install smoke, Lighthouse PWA installable, 9-screen visual eyeball.
- 🟡 **SW drift-guard test 강화(P2)** — 현재 SW는 안전하나 shipped `sw.js` 동기화 테스트가 문자열 기반이라 구조/행동형 테스트로 후속 강화.
- 🟡 **full primitive reskin 잔여** — `/login`, `/signup`, `/gate`, `/apply` 등 구 shell 페이지를 후속 design pass에서 `components/ui/*` 기반으로 완성.
- ⛔ **[다음 라운드 Northstar]** privacy ledger 선택(Zcash ZSA / Aleo / Aztec) + ICP 앱체인 — P0 계약 아님. `LedgerPort` 추상 경계가 이미 수용.

---

## 5. 거버넌스 (현재 — 잊지 말 것)

> 정본 = `docs/WORKFLOW.md` (2026-06-01 채택, **2026-06-05 / 2026-07-02 개정**, JT 승인).

- **Builder = Codex (전 레이어).** GLM / Claude Code는 빌더 **은퇴**(미사용, 2026-06-05). 재활성화 시 §6 예외 프로토콜.
- **Architect / Final Auditor = Cowork(한 세션 고정).** 빌더 ≠ 최종 승인자 불변식 보존.
- **First-pass Auditor = Codex(read-only, `AGENTS.md`).**
- **Commit/push/deploy = Codex 빌더 세션.** 단, Cowork FINAL PASS 이후에만 수행한다. 감사관 세션은 read-only.
- 위 규칙 변경 시 `WORKFLOW.md` / `CLAUDE.md` / `.clinerules` / `AGENTS.md` / `PROJECT_STATE.md` 5곳 동기화(드리프트 금지).

---

## 6. 검증 재현 절차 (How to Re-verify)

```bash
# Node 24 필요 (engineStrict). corepack이 pnpm@11.1.3 자동 사용.
pnpm install
pnpm -r typecheck                    # 3 projects CLEAN
pnpm -F @soulbound/core test         # 20 passed
pnpm -F @soulbound/adapters test     # 22 passed (unit)
pnpm -F web test                     # 44 passed (unit)
bash scripts/audit.sh                # AUDIT PASSED (apps/supabase 검사 활성)

# Docker(Supabase 로컬) 필요 — 호스트 전용 결정성 게이트:
supabase test db                     # pgTAP 73
pnpm -F @soulbound/adapters clip:reap   # persona-clip reaper CLI (manual)
# 통합테스트는 5x + db reset 후 green 재현으로만 PASS 판정 (PROJECT_STATE §6)
```

---

## 7. 변경 로그 (이 요약 트래커 자체)

| 일자 | 변경 |
| --- | --- |
| 2026-06-18 | `phase1-p0-mvp` 최신 HEAD(`0efd237`) 기준으로 pre-alpha UI/UX polish 최종 독립 PASS(`3bd68f2`)를 반영. PR 브랜치를 최신 base 위로 rebase하고 `docs/UIUX_CHANGELOG.md`와 정합화. |
| 2026-06-17 | `phase1-p0-mvp` 현재 진실 기준으로 재작성. 이전 `main`(freeze 991dc5d) 기준 초안은 stale이라 폐기·교체. 현재 트리에서 typecheck/core 20/adapters 22/web 44/audit 게이트 재검증. `PROJECT_STATE.md` 종속 요약으로 명시. |
