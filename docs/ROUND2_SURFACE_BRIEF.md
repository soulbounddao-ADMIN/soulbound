# Round 2 Surface — Referral 제거 + Admin 이메일 식별 — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> 두 surface 변경. A는 순수 surface(fast loop). C는 surface + **deanonymizing 데이터 경로**라 약간 더 본다(불변식 완화 기록 동반).
> chat-UI는 이 라운드에서 **제거 안 함** — 대화 탭은 Round 3 챗방이 된다.

## A. 추천코드 필드 제거 (합의됨)
**Why**: referral 시스템이 없다 → 검증·용도 없는 dead 입력(reviewer 표시만).
- **제거**: `apps/web/app/apply/page.tsx`의 추천코드 `<label>`+input + 그걸 읽는 `optionalText(form,"referralCode")`(L51)·submit spread(L58). + `apps/web/app/admin/applications/[id]/page.tsx`의 "추천 코드" 행(L445-446).
- **유지(0-diff)**: `referral_code` 컬럼(0001)·`p_referral_code`(0004)·route 조건부(`admission/applications/route.ts`)·`schemas.ts` `referralCode: optionalString` — **frozen·dormant**(미래 referral 기능 여지). 제거 안전하나 frozen이라 안 깐다.
- **테스트**: apply/admin 테스트가 referralCode 셀렉터/제출 참조하면 **비약화 업데이트**(필드 제거 반영).

## C. Admin 신청자 식별 = raw 이메일 (JT 결정 — ⚠️ 불변식 의도적 완화)
**Why**: admin이 보는 UUID가 사람이 못 읽음. JT가 raw 이메일로 식별하기로 결정(§내가 anti-bias/deanonymization 비용 명시 후).
- **데이터 경로**: admin 신청 DTO/route가 신청자(필요 시 reviewer)의 `auth.users.email`을 **service-role(server-only)로** 조회(예: `auth.admin.getUserById` 또는 service-role `auth.users` 읽기), **`requireReviewer` 게이트 뒤에서만**. Codex Step-2가 정확 경로 확정.
- **표시**: admin 큐(`applications/page.tsx`) + 상세(`[id]/page.tsx`)에서 UUID 대신/와 함께 이메일. (truncated UUID는 유지하든 대체하든 Codex 제안.)
- **🔴 불변식 (반드시)**:
  1. **이메일은 admin/reviewer surface에만.** 신청자-facing 응답(`/apply/status`, 멤버 디렉터리, 어떤 비-admin 라우트)에 **절대 노출 금지.** (grep 게이트.)
  2. **reviewSummary reviewer-only** 유지. **persona⟂dossier** 유지(이메일=신원, persona/dossier와 별개 — admin에만 추가되는 deanonymization).
  3. `requireReviewer` 403 게이트·3-client(이메일 조회는 service-role server-only, 클라이언트로 절대 안 감) 유지.
- **기록**: 이건 **anti-bias·가명-리뷰어 불변식의 의도적 완화**(알파 운영자 편의). PROJECT_STATE에 완화로 명시 기록(다중 리뷰어 시 재고).

## 경계 (최종 감사 강제)
- **FROZEN 0-diff**: `supabase/migrations/**`(referral_code 컬럼/RPC dormant 유지, **변경 금지**), `packages/core` frozen 마커, persona-clip/membership 동작, PWA, package/lock. **신규 dep 0.**
- C의 `auth.users` 읽기는 service-role(server-only)·additive — 스키마 변경 0.

## Acceptance gates (Claude 최종 감사)
- `pnpm -r typecheck` · `pnpm -F web test`(비약화) · `pnpm -F @soulbound/core test` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **boundary**: migrations·frozen core·PWA·lock 0-diff, 신규 dep 0.
- **🔴 A**: apply 폼·admin 상세에서 추천코드 사라짐(grep `referralCode`/"추천 코드" UI 참조 0). 제출/표시 무회귀.
- **🔴 C no-leak**: 이메일이 **admin/reviewer 경로에만** 등장 — 신청자-facing(`/apply/status`·디렉터리·비-admin route) 응답에 email 0(grep + 테스트). requireReviewer 403 유지. 3-client(email은 클라이언트 미도달).
- **host**(C는 auth.users service-role 읽기): admin은 이메일 봄 / 신청자는 자기 status에서 이메일 안 봄 — 통합 테스트. DB-touch면 결정성 대상.

## Handoff to Codex (Step 2)
계획: A 제거 지점(apply JSX/JS + admin 행) + 테스트 업데이트; C 이메일-fetch 경로(service-role `auth.users`/admin API, server-only, requireReviewer 뒤) + admin UI 표시 + **신청자-facing 노출 0 보장** + no-leak 테스트. **명시 확인**: migrations 0-diff(referral dormant)·신규 dep 0·이메일 admin-only·3-client·reviewSummary reviewer-only. Claude 승인 전 빌드 금지.

## 범위 밖 (별도 라운드)
멤버 챗방(Round 3, HR9 unfreeze 후) · 토글/웹 nav B(다음 턴).
