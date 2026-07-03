# SoulBound — UI/UX 개선·변경 추적 (UI/UX Change Tracking)

> ⚠️ **진실의 원천은 `PROJECT_STATE.md`** 입니다. 이 문서는 `apps/web`의 **UI/UX 표면 변경을 추적하는
> 파생 뷰**로, Task별 의미·증적은 `PROJECT_STATE.md §2` 및 `docs/TASK8A_AUDIT_FINDINGS.md` /
> `docs/TASK8B_AUDIT_FINDINGS.md` / `docs/RC2_MIME_FALLBACK_AUDIT.md`가 정본입니다.
> 작업 진척도 전반: `docs/PROGRESS.md`. 설계 캐논: `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`.

- **현재 상태**: `apps/web` **구축 완료** (Task 8a/8b 완료). P0 happy-path 화면 전체 존재. **RC-2(`v0.1.0-rc.2 @ e517ec3`) validated staging** 이후 pre-alpha UI/UX polish 최종 독립검토 PASS(`3bd68f2`, verdict 기록 `0efd237`). 2026-06-18 design pass + PWA `ac62201` 최종 독립검토 PASS, warm typography/ambient pass `e522b04` PASS, member shell nav consolidation `23ce4b6` PASS.
- **다음 단계**: **Profile / Persona Tier A** 빌드(진행 중 — 가명 텍스트 persona 보기+편집 + 탭 icon-only; brief `de52673`, plan 조건부 승인, 빌드 미시작). Members placeholder를 실데이터로 연결할 때는 새 API route + service 경유(HARD RULE 1)로만 진행.
- **마지막 갱신**: 2026-06-22 (UTC)
- **브랜치**: `phase1-p0-mvp`

---

## 0. UI/UX 작업의 전제 (Ground Rules)

UI는 "완벽히 돌아가더라도" 아래 가드를 깨면 빌드 실패다. 모든 UI/UX 변경은 이 제약 안에서 이뤄진다.

- **INV-01**: 컴포넌트에서 `supabase.from(...)` / `supabase.storage` 직접 호출 0건. 흐름은
  `component → hook → API route → service → repository → adapter`.
- **INV-17**: service-role 키는 **절대 `NEXT_PUBLIC_` / 브라우저 번들** 금지. 브라우저=anon 클라이언트만(auth + `current_user_role`).
- **INV-PC-05**: components에 `supabase` / `createClient` / service-role 0건 (audit "no direct supabase client in components").
- **INV-02 / INV-20 / INV-24**: 체인 클라이언트 직접 서명 0건(지갑 connect 예외) · 채팅 route/메시지 UI(목록·말풍선·작성창) 0건.
- **Persona Clip (INV-PC-03/05/06)**: 앱내(in-app) 녹화 only. 업로드/미리보기/재촬영/편집 없음.
  **부재가 submit을 막지 않는다(PC-01)**. `upload-before-onComplete`(업로드 2xx 후에만 완료). storage 접근은 StoragePort/route 경유.
- **권한 = 라우트 403 위임**: UI는 role을 직접 신뢰해 분기하지 않는다(8b의 role-race 버그 교훈). reviewer 전용 데이터(`review_summary`)는 비-reviewer엔 403→데이터 0.
- **결정 입력 = `reasonCode`(enum)만**. free-text reason 입력 UI 금지(INV-22). 멱등키 매 시도 신규, 409→graceful reload.
- **검열저항 카피 경계(§2.3)**: "법적 의무 없음"을 주장하지 않는다 — "애초에 평문·키를 보유하지 않도록 설계"를 카피로 표현.

---

## 1. 화면(Route) 인벤토리 & 상태

`apps/web/app/**` 기준. 전부 **구축 완료(BUILT)**.

| 화면 | 경로 | 역할 | 상태 |
| --- | --- | --- | --- |
| Landing | `app/page.tsx` | 잠긴 문 hero + 입장 3단계 안내 (세션 시 `/gate` CTA) | ✅ BUILT (8a) |
| Login | `app/login/page.tsx` | 로그인 | ✅ BUILT (8a) |
| Signup | `app/signup/page.tsx` | 가입 (signup→profiles 자동 provision) | ✅ BUILT (8a) |
| Gate Hub | `app/gate/page.tsx` | 입장 절차 안내 허브 | ✅ BUILT (8a) |
| Apply | `app/apply/page.tsx` | 신청서 + persona-clip recorder 섹션 | ✅ BUILT (8a) |
| Apply Status | `app/apply/status/page.tsx` | 내 신청 현황 (상태 badge + 검토자 안내) | ✅ BUILT (8a) |
| Member Home | `app/member/page.tsx` | 승인 후 shell (`멤버/대화/더보기`, My Persona, New/Active/All Members placeholder) | ✅ BUILT (8b) + polished (`3bd68f2`) + nav consolidated (`23ce4b6`) |
| Admin Queue | `app/admin/applications/page.tsx` | 검토 큐 | ✅ BUILT (8b) |
| Admin Detail | `app/admin/applications/[id]/page.tsx` | 검토 상세 + 결정 폼 + clip 재생 | ✅ BUILT (8b) |

공통 셸: `app/layout.tsx` + `app/_components/site-header.tsx`(sticky header, 세션 분기 nav, 로그아웃).

---

## 2. 컴포넌트 & 디자인 시스템 인벤토리

| 항목 | 경로 | 비고 | 상태 |
| --- | --- | --- | --- |
| persona-clip-recorder | `components/admission/persona-clip-recorder.tsx` | 앱내 녹화 only · live viewfinder · no preview/retake/edit · INV-PC-05 준수 | ✅ BUILT (7b) |
| usePersonaClipRecorder 훅 | `components/admission/use-persona-clip-recorder.ts` | getUserMedia→MediaRecorder→blob→sha256→POST→upload PUT · upload-before-onComplete | ✅ BUILT (7b) |
| AuthProvider | `lib/auth-provider.tsx` | 브라우저 anon 클라이언트(persistSession) · `authedFetch`(bearer 주입) · 역할=신뢰 RPC | ✅ BUILT (8a) |
| api-response / application-state | `lib/api-response.ts`, `lib/application-state.ts` | 응답 파싱 · 신청 id 기억 | ✅ BUILT |
| 글로벌 디자인 토큰/스타일 | `app/globals.css` | compact private messenger shell, talk-yellow accent, landing door visual 유지, 반응형(@760px/@700px) | ✅ BUILT + polished |
| 멤버 스타일 | `app/member/page.module.css` | CSS Module | ✅ BUILT |
| 관리자 스타일 | `app/admin/applications/admin.module.css` | CSS Module | ✅ BUILT |
| UI primitives | `components/ui/*` | AppBar/TabBar/ListRow/Avatar/Card/Section/EmptyState/Field/Button/Badge, member shell ListRow/TabBar polish | ✅ BUILT + nav/list polish (`23ce4b6`) |
| PWA shell | `app/manifest.ts`, `app/icon.png`, `app/apple-icon.png`, `public/sw.js`, `public/icons/*`, `components/pwa/*` | manifest/icons/install prompt/hand-rolled SW + cache-boundary tests | ✅ BUILT + served-audited (install smoke pending) |

**디자인 시스템 요약** (`globals.css`):
- 컬러 토큰: warm paper + terracotta ramp. Main values: `--ink #191919`, `--canvas #faf9f5`, `--surface #ffffff`, `--accent #d97757`, `--accent-text #a94728`, `--accent-pressed #963b20`, `--accent-weak #f5e4dc`, `--success #3d9a6d`, `--danger #c0392b`.
- 타이포: Geist/Inter/system sans 중심. Hero/member shell heading도 sans 기준으로 단순화.
- 컴포넌트 클래스: `.button` / `.button-secondary` / `.button-danger`, `.auth-panel`/`.form-panel`/`.status-panel`, `.status-badge`, `.gate-grid`, `.recorder-section`.
- 모티프: landing은 messenger phone preview, admitted surface는 `멤버/대화/더보기` bottom-tab shell.
- 접근성: `aria-live`/`role="alert"`, `:focus` 링, 최소 44px 터치 타깃, 320px min-width, mobile breakpoints.

---

## 3. UX 상태 모델 (참고)

신청 lifecycle은 화면 상태/카피의 근간. 라벨은 `apply/status/page.tsx`의 `statusLabel`/`reasonLabel` 참조.

```
draft → submitted → under_review → needs_more_info → approved / rejected
                                                    ↘ withdrawn / expired (terminal)
```

- applicant 화면 노출: `applicantNotice`("검토자 안내")만. `review_summary`(관리자 내부 메모)는 노출 금지(라우트 403로 차단).
- 결정 사유는 `reasonCode`(enum) → 한글 라벨 매핑으로만 표시. 자유서술 입력 없음.
- applicant status는 `applicantNotice`만 표시한다. `reviewSummary` 및 `reasonCode`는 ordinary applicant 화면에 렌더하지 않는다.

---

## 4. UI/UX 변경 로그 (Changelog)

> 새 UI/UX 변경마다 **최상단에 한 줄 추가**. 기준선 = RC-2(pre-alpha). 그 이전 빌드 단계(Task 8a/8b)는 회고 기록으로 1회만 등재.
> `유형`: 🆕 신규 · ✏️ 개선 · 🐛 수정 · ♻️ 리팩터 · 🗑️ 제거 · 📄 문서.

| 일자 | 화면/컴포넌트 | 유형 | 요약 | 가드 영향 | 증적 |
| --- | --- | --- | --- | --- | --- |
| 2026-06-19 | site-header · member(shell/More/tabs) · ui(ListRow/TabBar) | ✏️/🐛 개선·수정 | Member shell nav 통합: 전역 헤더 3-state(`/member`→null·비멤버 로그아웃·anon 로그인·설치) + AppBar 제거로 단일 헤더, More=northstar 전체 스캐폴드(wired 내멤버십 inline/입장현황/로그아웃/앱설치 · 준비중·심사권한은 비-내비 aria-disabled "자격 획득 필요"), ListRow grid→flex 버그수정(leading-없는 행 truncation 해소·desc 2-line clamp), 하단 탭 inline SVG 아이콘 + TabBar orientation prop(좌측 레일은 follow-up) | 독립 최종감사 PASS. 보호표면(api/auth-provider/core/adapters/supabase/PWA) 0-diff · role-fetch 0 · 새 route/href 0(chat/admin 0) · 새 의존성 0 | `23ce4b6`, `docs/MEMBER_SHELL_NAV_BRIEF.md`, `PROJECT_STATE.md` |
| 2026-06-18 | app shell, components/ui, PWA, member, landing, status | 🆕/✏️ 개선 | Pre-alpha design pass + PWA: warm terracotta token ramp, reusable UI primitives, PWA manifest/icons/install prompt/hand-rolled SW, landing messenger preview, `/member` phone-like shell refinement, applicant status privacy lock(`reviewSummary`/`reasonCode` 미렌더), admin palette alignment | Final independent audit PASS. DB/schema/RLS/RPC/API/auth/adapters/core/env/storage/reaper/approval 무변경. SW는 `/api/**`, Authorization, no-store, persona-clip, cross-origin, non-GET bypass. Persona Clip recorder internals untouched. Host-only install/Lighthouse/visual smoke pending before push/deploy. | `ac62201`, `docs/DESIGN_PASS_BRIEF.md`, `docs/DESIGN_PASS_PLAN.md`, `PROJECT_STATE.md` |
| 2026-06-18 | member, public/auth/gate/apply/status, globals | ✏️ 개선 | Pre-alpha UI polish: `/member`를 `멤버/대화/더보기` admitted shell로 전환, Members 기본 탭에 My Persona + New/Active/All Members placeholder 추가, public/auth/gate/apply/status copy를 짧은 Korean labels 중심으로 정리, `SOUL` ordinary-user 메뉴를 `내 멤버십`으로 완화 | Surface-only. DB/schema/RLS/RPC/API/auth/adapters/core/env/storage/reaper/approval 무변경. Persona Clip proper noun/semantics 유지. | `3bd68f2`, `0efd237`, `PROJECT_STATE.md` |
| 2026-06-18 | (문서) | 📄 문서 | UI/UX 추적 문서를 현재 진실(`apps/web` BUILT, RC-2 + pre-alpha polish PASS)로 재작성. 이전 "미생성/planned" 초안 폐기 | — | (이 PR) |
| ~RC-2 | persona-clip-recorder | 🐛 수정 | **MIME fallback** — Samsung/Safari MP4 경로 추가, Chrome/webm 보존(recorder 2파일·계약 무손상). Samsung Internet 실기기 스모크 PASS | INV-PC-05 무손상 | RC2_MIME_FALLBACK_AUDIT.md |
| Task 8b | member, admin queue, admin detail | 🆕 신규 | 멤버 홈 + 검토 큐/상세 + 결정 폼(reasonCode enum·멱등·409 graceful)·clip 클릭 재생. 권한=라우트 403 위임 | INV-01/17, reviewSummary 경계 | TASK8B_AUDIT_FINDINGS.md |
| Task 8a | landing/login/signup/gate/apply/status + layout/header | 🆕 신규 | 공개/신청 UI + auth foundation(anon 클라이언트·authedFetch bearer) + 디자인 시스템(globals.css) | INV-17(번들 service-role 0)·PC-01 | TASK8A_AUDIT_FINDINGS.md |

---

## 5. UI/UX 변경 진입 체크리스트

UI/UX를 건드릴 때 매번:

- [ ] 흐름이 `component → hook → API route → service`를 따르는가 (컴포넌트 직접 supabase 0 — INV-01/PC-05).
- [ ] service-role 키가 브라우저 번들(`.next` 포함)에 안 새는가 (INV-17 — 소스 + 번들 둘 다 grep).
- [ ] 권한 분기를 role 직접 신뢰가 아니라 라우트 403 위임으로 하는가 (8b role-race 교훈).
- [ ] reviewer 전용 데이터(`review_summary`)가 비-reviewer 화면에 안 새는가.
- [ ] 결정 입력이 `reasonCode` enum뿐인가(free-text 0), 멱등키·409 graceful 처리하는가.
- [ ] Persona Clip: 인앱 녹화만, 업로드/미리보기/재촬영/편집 없음, 부재가 submit 막지 않음(PC-01), upload-before-onComplete.
- [ ] `pnpm -F web test` + `bash scripts/audit.sh` 통과(특히 "no direct supabase client in components").
- [ ] §1/§2 인벤토리와 §4 Changelog를 갱신했는가.

---

## 6. 알려진 UX 후속 (Known Follow-ups)

- 🔵 **Profile / Persona Tier A (진행 중, 빌드 미시작)** — `/member`에 가명 텍스트 persona 보기+편집(handle/display_name/bio) + 하단 탭 **icon-only**(aria-label 유지). design 결정 락(증적 `docs/PROFILE_PERSONA_BRIEF.md`): **사진/아바타 영구 0**(입장 후 피어-익명성 불변식, persona-clip 파기 INV-PC-09 정합·이니셜/모노그램 마크만)·**AI authorship 제외**·persona ⟂ admission dossier·구조적 no-photo(`avatar_url` write 경로 0)·no-leak(role/wallet/email/id 0)·own-only·handle 409. Tier A 빌드 후 Cowork full 독립감사 → 빌드되면 §1/§2/§4 갱신.
- 🟡 **Member shell nav host-only 육안 스모크** (non-블로커): `/member` 단일 헤더·탭 아이콘·More 스캐폴드·ListRow leading-없는 행 비-truncation·`/gate` 로그아웃·anon 설치.
- ⏳ **Safari persona-clip 호환성 스모크** (non-블로커). 미지원 시 graceful **PC-01 degradation**(클립 없이 제출).
- 🟡 2026-06-18 design pass + PWA host-only runtime gate: Android Chrome/Samsung Internet/iOS Safari install smoke, Lighthouse PWA installable, 9-screen visual eyeball.
- 🟡 SW drift-guard test 강화: 현재 SW는 안전하나 shipped `sw.js` 동기화 테스트가 문자열 기반이라 구조/행동형 테스트로 후속 강화.
- 🟡 full primitive reskin 잔여: `/login`, `/signup`, `/gate`, `/apply` 등 구 shell 페이지를 후속 design pass에서 `components/ui/*` 기반으로 완성.
