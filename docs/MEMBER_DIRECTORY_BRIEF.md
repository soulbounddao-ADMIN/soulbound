# Member Directory — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **P0 이후 두 번째 northstar 기능** — profile/persona(6a32dd2)의 형제(내 persona *쓰기* → 남의 공개 persona *보기*).
> 레이어 = surface + **additive** core read(frozen 시그니처 무변경). 기존 RLS `profiles select active public` 위에 read-only.

## 0. Why
입장(admission) 파이프라인은 완결됐으나 **입장 *후*가 비어 있다**(persona 편집 + placeholder뿐). 디렉터리 = 멤버가 서로
보이는 **첫 member-to-member 기능** → 빈 멤버 셸을 실 커뮤니티로. 대화(DM)는 P0 금지(HARD RULE 9) Northstar라 별개 —
디렉터리는 대화 없이도 "살아있는 클럽"을 만든다. 가장 저위험 northstar(기존 RLS+persona 위 read-only, 새 인프라/체인 0).

## 1. Hard boundary (최종 감사 강제)
- **Surface + additive read only.** 손대는 곳: `apps/web/app/member/page.tsx`(members 탭), 새 GET 라우트(`apps/web/app/api/members/route.ts` 류),
  새 서비스/리포지토리 read 메서드(profile 도메인 확장 or 병렬 directory), 멤버 셸 UI 프리미티브 재사용(`components/ui/*`).
- **Additive 허용**: `ProfileRepository`/service에 `listActivePublicPersonas(...)` 신설(또는 `MemberDirectoryService`). frozen 시그니처/enum/테스트 **변경 금지**, 신규 메서드만.
- **FROZEN 0-diff**: `supabase/migrations/**`(RLS/RPC — 기존 `select active public` 그대로 사용, 변경 금지), `packages/core`의 frozen 마커,
  admission/apply/persona-clip 동작, `auth-provider`, PWA, package/lock. **신규 npm dep 0.**
- **🔴 불변식(반드시 유지)**:
  1. **persona ⟂ dossier** — 디렉터리는 *공개 persona*(handle/display_name/bio)만. dossier(statement/motivation/referral/clip) **절대 노출 금지**.
  2. **no-leak** — 응답·렌더에 **role / email / membership_status / wallet_address / avatar_url 절대 포함 금지.** 서비스/DTO가 persona-only로 projection(RLS grant가 더 줘도 코드가 막는다).
  3. **no-photos** — 사진/아바타 0(anti-bias). avatar_url을 read/render에 절대 싣지 않음(구조적 부재).
  4. **active-only** — active 멤버만 노출(`is_active_member`/`select active public`), 그리고 **뷰어도 active 멤버여야** 열람(라우트 active-membership 게이트 403, profile/me 패턴 재사용).

## 2. Data path (3-client 경계 준수)
- 흐름: component → hook → **GET 라우트** → service → repository → adapter. **user-JWT 클라이언트로 읽음**(service-role 아님) →
  RLS `profiles select active public`가 "active 멤버만, 공개 persona만"을 집행. (profile/me처럼 `resolveUserContext` + active-membership 게이트.)
- read 메서드: `listActivePublicPersonas({ limit, cursor })` → `Persona[]`(= {handle, displayName, bio}, 기존 타입 재사용). **본인 제외 여부**는 옵션(기본: 포함하되 UI에서 "나" 표시 or 제외 — §3 선택).
- 페이지네이션: `limit`(기본 ~50) + cursor/offset. 알파 규모엔 단순 limit으로 충분.

## 3. UI (members 탭 — placeholder 대체)
- 현재 New/Active/All Members **placeholder 3개**를 실데이터로. **기본(권장): 단일 "Members"(active 전체) 리스트** —
  new/active 구분은 가입일/활동 데이터가 있어야 의미 있으니 *후속*. (원하면 3-섹션 유지 가능 — 아래 선택.)
- 각 행: `ListRow`(기존 프리미티브) — title=displayName(없으면 "익명 멤버"), secondary=@handle, description=bio(2줄 clamp). **leading 아바타/사진 0.**
- 멤버 탭하면 → 공개 persona 상세(handle/display_name/bio). **기본(권장): `/member/[handle]` 라우트**(공유가능·딥링크) — 또는 인라인 확장. (선택.)
- 빈/로딩/에러 상태(기존 패턴), warm/simplicity 게이트 유지(weight ≤600, no uppercase, heading ≤24, serif=prose-only).

### 열린 선택지 (Codex Step-2에서 확정, 기본값 명시)
- (a) 단일 active 리스트 **[기본]** vs New/Active/All 3-섹션.
- (b) 멤버 상세 = `/member/[handle]` 라우트 **[기본]** vs 인라인 확장.
- (c) 검색/필터: 알파 MVP는 **단순 리스트(검색 보류)** [기본] vs 클라이언트 handle/이름 필터.
- (d) 본인 노출: 리스트에 포함하되 표시 [기본] vs 제외.

## 4. Acceptance gates (Claude 최종 감사 — surface=fast loop, 단 RLS read는 host 검증)
- `pnpm -F web typecheck` · `pnpm -F web test`(비약화) · `pnpm -F @soulbound/core test`(additive, 비약화) · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **Boundary**: `supabase/migrations`·frozen core 마커·admission/apply/persona-clip·PWA·package/lock **0-diff**. 신규 dep 0.
- **🔴 no-leak(grep + 테스트)**: 디렉터리 응답·UI에 role/email/membership_status/wallet_address/avatar_url **0건**(grep). DTO/서비스가 persona-only projection.
- **🔴 persona⟂dossier**: 디렉터리 경로에 dossier 필드(statement/motivation/referral/clip) 참조 0.
- **🔴 RLS(host 통합)**: 비-active 뷰어는 403 / non-active 멤버 persona는 안 보임 / active 멤버는 다른 active 멤버 공개 persona만 봄. (로컬 Supabase, profile 통합 패턴; DB-touch라 §6 결정성.)
- own-profile(profile/me) 경로 무회귀.

## 5. Handoff to Codex (Step 2)
계획 제시: additive read 메서드/서비스 위치(profile 도메인 확장 vs 신규 directory)·GET 라우트·user-JWT+active 게이트·persona-only projection·members 탭 UI(리스트/상세/빈상태)·위 (a)-(d) 선택 확정·테스트(no-leak·persona⟂dossier·RLS 열람규칙·페이지네이션). **명시 확인**: RLS/RPC 0-diff(기존 `select active public` 사용)·frozen core 시그니처 무변경·신규 dep 0·no-photo/no-leak·3-client 경계. Claude 승인 전 빌드 금지.

## 6. 범위 밖 (이번 라운드 아님)
대화/DM/presence(HARD RULE 9 Northstar) · 멤버 검색 고도화 · new/active 활동기반 구분 · 추천코드 제거(별도 surface 라운드) · admin 이메일 식별(별도, 불변식 완화 기록 동반).
