# SoulBound — 작업 진척도 트래커 (Work Progress Tracker)

> ⚠️ **진실의 원천(source of truth)은 `PROJECT_STATE.md`** 입니다. 이 문서는 그 인수인계 문서를
> **빠르게 훑기 위한 파생 요약 뷰**일 뿐이며, 충돌 시 항상 `PROJECT_STATE.md` + repo 파일이 우선합니다.
> 상태가 바뀌면 `PROJECT_STATE.md`를 먼저 갱신하고, 이 요약을 그에 맞춰 갱신하세요.
> 설계 캐논: `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`(동결).
> UI/UX 변경 추적: `docs/UIUX_CHANGELOG.md`. 운영 루프: `docs/WORKFLOW.md`.

- **현재 단계**: **P0 MVP 기능 + 하드닝 완성** (Task 1–9 완료). RC staging 검증 완료. **`v0.1.0-rc.2` 태그됨 @ `e517ec3`**. Pre-alpha UI/UX polish 최종 독립검토 PASS(`3bd68f2`, verdict 기록 `0efd237`). 2026-06-18 design pass + PWA `ac62201`도 최종 독립검토 PASS(acceptable for pre-alpha). **Member shell nav consolidation 최종 독립검토 PASS(`23ce4b6`, 문서 동기화 `1833541`)** — push/deploy 전 host-only runtime gate만 남음.
- **진행 중 (P0 이후 첫 real feature)**: **Profile / Pseudonymous Persona Tier A** — brief 커밋(`de52673`) + Codex Step-2 plan **조건부 승인**(Cowork). **빌드 미시작**(candidate SHA 없음). §2 표 참조.
- **다음 단계**: profile Tier A 빌드 → Cowork full 독립감사 → JT 커밋. 병행: internal alpha 운영(public/non-alpha 전 reaper 자동화 Task 9a-2 재평가).
- **현재 브랜치**: `phase1-p0-mvp`
- **검증 환경**: Node 24 / pnpm 11.1.3
- **요약 갱신일**: 2026-06-22 (UTC)

---

## 1. 한눈에 보는 현황 (Snapshot)

현재 작업 트리(`phase1-p0-mvp` HEAD `de52673`)에서 이 세션이 직접 재실행해 확인한 게이트:

| 게이트 | 결과 | 비고 |
| --- | --- | --- |
| `pnpm -r typecheck` | ✅ CLEAN | core / adapters / web 3개 프로젝트 |
| `pnpm -F @soulbound/core test` | ✅ 20 passed | Task 9b에서 19→20 (INV-16 outbox payload lock) |
| `pnpm -F @soulbound/adapters test` (unit) | ✅ 22 passed | |
| `pnpm -F web test` (unit) | ✅ 64 passed | 13 파일 (member shell nav에서 44→64, `site-header.test.tsx` 등 추가) |
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
| Member shell nav consolidation | 헤더 3-state(브랜드-only/`/member`→null) + More=northstar 전체 스캐폴드 + ListRow grid→flex 버그수정 + 하단 탭 아이콘화 | ✅ 최종 독립검토 PASS (surface, 보호표면 0-diff) | `docs/MEMBER_SHELL_NAV_BRIEF.md`, `23ce4b6`, `1833541` |
| Profile / Persona Tier A | 가명 텍스트 persona 보기+편집(handle/display_name/bio·사진 0·AI 0) + 탭 icon-only | 🔵 진행 중 — brief `de52673` + Step-2 plan 조건부 승인, **빌드 미시작** | `docs/PROFILE_PERSONA_BRIEF.md` |
| 9a-2 | internal cron reaper route | ⏳ deferred | (잔여) |
| 10 | external ledger PoC (옵션, 별도 브랜치) | ⛔ 미착수 (의도적 보류) | — |

**🎉 P0 MVP happy-path end-to-end**: signup → gate → apply → submit → (reviewer) approve → member. 완료.

---

## 3. 릴리스 상태 (Release)

| 항목 | 상태 |
| --- | --- |
| `v0.1.0-rc.1` @ `fafba30` | ✅ 태그됨. RC-1 §13 FINAL AUDIT PASS (실 SMTP·signup→profiles·role boundary·approve/reject·member·clip lifecycle→manual reap→object absence·INV-17/no-leak) |
| `v0.1.0-rc.2` @ `e517ec3` | ✅ 태그됨 (현재). persona-clip recorder **MIME fallback**(Samsung/Safari MP4 경로, Chrome/webm 보존). 코드 Opus 최종감사 PASS + Samsung Internet 실기기 스모크 PASS |
| staging 배포 | ✅ Vercel `soulbound-staging` + Supabase 마이그 0001–0008 (no-seed) |
| RC 결정 | email-confirm ON · open signup · manual CLI reaper · 자동화/CAPTCHA deferred |

---

## 4. 잔여·미결 항목 (Open Items)

`PROJECT_STATE.md §4` 미결 항목의 요약. (상세·이유는 원문 참조)

- ⏳ **Safari persona-clip 호환성 스모크** — 후속(non-블로커). 미지원 시 graceful **PC-01 degradation**(클립 없이 제출).
- ⏳ **Task 9a-2** — internal cron reaper 자동화. public/non-alpha 전 재평가.
- ⏳ **Task 10-1** — outbox vs ledger 직접호출 책임 분리(중복 발급 위험). **Task 10 전** "서비스는 enqueue만, ledger 호출은 processor 1회"로 단일화 결정 필요.
- 🟡 **Pre-alpha design pass + PWA host-only runtime gate** — Android Chrome/Samsung Internet/iOS Safari install smoke, Lighthouse PWA installable, 9-screen visual eyeball.
- 🟡 **SW drift-guard test 강화(P2)** — 현재 SW는 안전하나 shipped `sw.js` 동기화 테스트가 문자열 기반이라 구조/행동형 테스트로 후속 강화.
- 🟡 **full primitive reskin 잔여** — `/login`, `/signup`, `/gate`, `/apply` 등 구 shell 페이지를 후속 design pass에서 `components/ui/*` 기반으로 완성.
- 🟡 **Member shell nav host-only 육안 스모크** — `/member` 단일 헤더·탭 아이콘·More 스캐폴드·ListRow 비-truncation·`/gate` 로그아웃. (sandbox 브라우저 부재로 JT 호스트 1회.)
- 🔵 **Profile Persona Tier A (진행 중)** — design 결정 락(기록은 `docs/PROFILE_PERSONA_BRIEF.md`): persona = 가명 자기저작(handle/display_name/bio)·**사진 0(입장 후 피어-익명성 불변식, INV-PC-09 정합)**·**AI authorship 제외**(진정성/동질화/lean-privacy 근거, 무기한 보류)·persona ⟂ admission dossier. Tier A 빌드 후 Cowork full 독립감사 대기. 후속 layer: 아바타 업로드(영구 제외)·taste tags(C)·온체인(Task 10 후).
- ⛔ **[다음 라운드 Northstar]** privacy ledger 선택(Zcash ZSA / Aleo / Aztec) + ICP 앱체인 — P0 계약 아님. `LedgerPort` 추상 경계가 이미 수용. AI persona authoring = `AIPort`(LedgerPort와 동일 취급: core port / main Noop / branch+flag) — 무기한 보류.

---

## 5. 거버넌스 (현재 — 잊지 말 것)

> 정본 = `docs/WORKFLOW.md` (2026-06-01 채택, **2026-06-05 개정**, JT 승인).

- **Builder = Codex (전 레이어).** GLM / Claude Code는 빌더 **은퇴**(미사용, 2026-06-05). 재활성화 시 §6 예외 프로토콜.
- **Architect / Final Auditor = Cowork(한 세션 고정).** 빌더 ≠ 최종 승인자 불변식 보존.
- **First-pass Auditor = Codex(read-only, `AGENTS.md`).**
- **Commit authority = JT(호스트 전용 `git add/commit/push`).** 샌드박스 에이전트 직접 커밋 금지.
- 위 규칙 변경 시 `WORKFLOW.md` / `CLAUDE.md` / `.clinerules` / `AGENTS.md` / `PROJECT_STATE.md` 5곳 동기화(드리프트 금지).

---

## 6. 검증 재현 절차 (How to Re-verify)

```bash
# Node 24 필요 (engineStrict). corepack이 pnpm@11.1.3 자동 사용.
pnpm install
pnpm -r typecheck                    # 3 projects CLEAN
pnpm -F @soulbound/core test         # 20 passed
pnpm -F @soulbound/adapters test     # 22 passed (unit)
pnpm -F web test                     # 64 passed (unit)
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
| 2026-06-22 | `phase1-p0-mvp` HEAD(`de52673`) 기준 갱신. **member shell nav consolidation(`23ce4b6`) PASS** + web test **44→64** 반영, **Profile Persona Tier A** 진행 중(brief `de52673` + plan 조건부 승인, 빌드 미시작) 등재 및 design 결정(사진 0 익명성·AI 제외) 기록. 현재 트리에서 typecheck/core 20/adapters 22/web 64/audit 재검증. |
| 2026-06-18 | `phase1-p0-mvp` 최신 HEAD(`0efd237`) 기준으로 pre-alpha UI/UX polish 최종 독립 PASS(`3bd68f2`)를 반영. PR 브랜치를 최신 base 위로 rebase하고 `docs/UIUX_CHANGELOG.md`와 정합화. |
| 2026-06-17 | `phase1-p0-mvp` 현재 진실 기준으로 재작성. 이전 `main`(freeze 991dc5d) 기준 초안은 stale이라 폐기·교체. 현재 트리에서 typecheck/core 20/adapters 22/web 44/audit 게이트 재검증. `PROJECT_STATE.md` 종속 요약으로 명시. |
