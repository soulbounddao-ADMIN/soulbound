# Member Shell Nav + More-tab Northstar Scaffold + ListRow Fix — Design Brief (Claude Code / Cowork)

> **Step 1 of the loop** (Claude design → Codex plan → Claude approve → Codex build → Claude final audit).
> Pure **surface / app-layer**, same fast-loop. Builder ≠ approver.
> Goal: finish the never-completed header→더보기 consolidation so the app is a true KakaoTalk-style single-nav
> paradigm (bottom tabs + 더보기), make 더보기 a scaffold of the FULL product northstar, and fix the ListRow
> truncation bug. Resolves JT's "상단우측 탭" + "하단 메뉴 짤림."

## 0. Why (grounded)
- The 더보기 tab exists but holds 4 **dead placeholders** (내프로필/설정/알림/내멤버십, no href/onClick — member/page.tsx:57-65,199-211),
  while the REAL actions (멤버/입장/로그아웃/설치) still live in the global top-right `.site-header` nav (site-header.tsx:30-50).
  → consolidation was never finished. **/member also stacks 3 header layers**: global `.site-header` + the standalone
  `<AppBar>` ("멤버" title, member/page.tsx:125) + the shell `.phoneTop` ("SoulBound" + 멤버 badge) → duplicate brand.
- ListRow truncation root cause: `.listRow { grid-template-columns: auto minmax(0,1fr) auto }` hardcodes 3 slots
  (ui.module.css:91); when `leading` is absent (더보기 rows) the body lands in the content-sized `auto` column and,
  with `white-space:nowrap; text-overflow:ellipsis` on `.listTitle/.listDescription` (ui.module.css:114-132), even short
  text truncates. Rows WITH leading (My Persona) render fine — that asymmetry is the proof.

## 1. Hard boundary (final audit enforces)
- **Surface/app-layer ONLY.** Expected files: `apps/web/app/_components/site-header.tsx`, `apps/web/app/member/page.tsx`
  + `member/page.module.css`, `apps/web/components/ui/list-row.tsx` + `tab-bar.tsx` + `ui.module.css`, and a More-tab data array.
  **NO new routes/pages. NO new npm deps.**
- **FROZEN / unchanged:** auth/session/role logic, `apps/web/lib/auth-provider.tsx` behavior (**NO role-fetch — Q4 deferred**),
  `apps/web/app/api/**`, supabase, packages/core+adapters, RLS/RPC, PWA `sw.js`/`manifest.ts` (theme already set), Persona Clip.
- **🔴 HARD-RULE safety (pin in plan):** (a) NO chat/messages/inbox route OR href/onClick anywhere — **대화/DM = LABEL ONLY**
  (INV-20/24); (b) NO ledger/SBT/SOUL/Court/governance implementation — labels only; no ICP/Filecoin/IPFS/Arweave; (c) all
  더보기 future rows are **non-navigation** (no href, no onClick); (d) tone-down/warmth rules still hold (weights ≤600, no
  uppercase, heading ≤24px, serif=prose-only, --canvas-lit, --elevate).

## 2. (A) Header consolidation — 3-state, orphan-safe (uses `usePathname`, NO role/API)
Drive the global `.site-header` by `usePathname()` + session (client-only, no membership/role fetch):
- **Anon (logged out)** — brand + `로그인` / `가입하기` + **Install entry** (public install stays here, app-level).
- **Logged-in, NON-member context** (`/gate`, `/apply`, `/apply/status`, and any logged-in non-/member route) — brand +
  **`로그아웃`** (orphan prevention: applicants never reach 더보기) + Install entry. NO 멤버/입장 top-nav (the page is that context).
- **Member shell (`/member`)** — global `.site-header` renders **null** (the member shell owns its own bar). This removes the
  double/triple header at the source.
- **Member shell internal header** — `.phoneTop` becomes the **single** top bar (brand "SoulBound" + 멤버 badge). **Drop the
  standalone `<AppBar>`** ("멤버" title/eyebrow/description) on /member so there is exactly ONE header and ONE brand. (Move the
  one-line description into the 멤버 tab body if worth keeping, else drop.)
- Net: exactly one "SoulBound" brand visible per screen; KakaoTalk single-paradigm on /member (one top bar + bottom tabs).

## 3. (B) More-tab = northstar scaffold (replace the 4 dead placeholders)
Grouped list. **✅ wired** = real link/action/inline-data that exists today; **준비 중** = label-only, **non-navigation**,
`aria-disabled` + focus-excluded + a quiet "준비 중" badge (Q3 — no "곧 제공" sheet).
- **내 계정**
  - `로그아웃` — ✅ action (`signOut()` → `/`)
  - `입장 현황` — ✅ → `/gate`
  - `내 멤버십` — ✅ **inline status row** (활성 · tier · 시작일 from already-loaded membership; **NOT a nav row** — no
    dead destination, no /membership route). (This is the Q2 "destination 확정": show inline, don't pretend-link.)
  - `내 프로필 (페르소나)` — 준비 중 (no /profile route)
- **소통**
  - `대화 / 다이렉트 메시지 (E2EE)` — 준비 중 **(LABEL ONLY — never a route/onClick, INV-20/24)**
  - `알림` — 준비 중
- **커뮤니티**
  - `멤버 디렉터리` — 준비 중
- **신원 & 자산 (northstar)**
  - `소울바운드 신원 / 온체인 크리덴셜` — 준비 중
  - `SOUL 잔액 · 스테이킹 · 원장` — 준비 중
  - `지갑 연결` — 준비 중
- **신뢰 & 안전**
  - `신고 · 모더레이션` — 준비 중
  - `Support / Challenge (stake review)` — 준비 중
  - **심사 권한 = 정적 비활성 "자격 획득 필요" 행** (Q2): an aspirational/locked ROLE row — reads as "이 역할을 얻어야 함",
    **NOT** a live queue / operator tool. Uniform-disabled regardless of actual role, 0 counts / 0 data, **no `/admin` link**.
    The 자격-획득 framing prevents the "내가 심사하나?" misread while still scaffolding the reviewer role in the northstar.
    Live role-aware reviewer entry (current_user_role fetch + /admin link) = **separate brief + audit** (Q4; reviewers reach
    `/admin/applications` by URL meanwhile).
- **개인정보·보안 & 설정**
  - `프라이버시 / 데이터 보관 정책` — 준비 중
  - `E2EE 보안 설명` — 준비 중
  - `설정 (계정/화면)` — 준비 중
- **앱**
  - `앱 설치` — ✅ InstallPrompt inline (self-hides when standalone/installed)
  - `앱 정보 / 버전` — (옵션, static)

## 4. (C) ListRow adaptive fix (the truncation bug)
- Make ListRow adaptive to absent slots: switch `.listRow` from the hardcoded 3-col grid to **flex**
  (`display:flex; align-items:center; gap`) with `.listBody { flex:1; min-width:0 }`, and `.listLeading/.listTrailing`
  as `flex:0 0 auto`. Body then always claims the correct remaining width regardless of which slots are present.
- Title stays single-line ellipsis (OK for list rows); **allow `.listDescription` to wrap up to ~2 lines** then ellipsis
  (so short menu descriptions never truncate; replace the rigid `white-space:nowrap` on description with a 2-line clamp).
- Fixes ALL ListRow usages (더보기, My Persona, future). No API/markup contract change to ListRow props.

## 4b. (D) Bottom-tab iconization (KakaoTalk-mobile authentic) + orientation-ready TabBar
- **Verified correction (Kakao official theme guide): KakaoTalk MOBILE = horizontal BOTTOM tab bar (icon + label), NOT a left rail.**
  The left vertical rail is KakaoTalk **PC/desktop** (Slack/Discord-class). So the authentic mobile move = KEEP the bottom tab
  bar and ADD icons — not switch to a rail. (Cowork earlier asserted the inverse; corrected against the official guide.)
- Add 3 **inline SVG** icons (멤버 / 대화 / 더보기) + the existing micro-label to TabBar (Kakao tabs are icon+label). **No new dep.**
  Keep horizontal bottom orientation.
- Add an `orientation` prop to TabBar (default `"horizontal"`) so a future desktop responsive left-rail can be layered without
  rework. **Do NOT implement the rail now.**

## 4c. Out of scope (this pass) → follow-up briefs
- **Desktop responsive left rail** (narrow=bottom tabs / wide=left rail — the real Kakao mobile-vs-PC split). TabBar
  `orientation` prop is reserved for it; higher CSS cost, mobile-first pre-alpha → deferred.
- **Q4 role-aware live 심사 entry** (current_user_role fetch + /admin link) — separate brief + audit; **no role-fetch this pass.**
- **/login·/signup·/gate·/apply full `components/ui` primitive reskin** — separate design-pass.

## 5. Acceptance gates (Claude final audit — fast loop)
- `pnpm -F web typecheck` · `pnpm -F web test` green & non-weakened · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **Boundary EMPTY:** supabase, packages, `apps/web/app/api`, `apps/web/lib` (incl. **auth-provider — no role-fetch added**),
  `.env*`, scripts, next.config, package.json/lockfile, `apps/web/public/sw.js`, `apps/web/app/manifest.ts`, `components/pwa`.
- **No new route:** `apps/web/app/**/page.tsx|route.ts` set unchanged except `member/page.tsx`. No chat/messages/inbox path or href.
- **더보기 future rows = non-navigation:** no href/onClick on 준비 중 rows (grep); 대화/DM row has zero route linkage.
- **One header on /member:** global `.site-header` null on /member; no duplicate "SoulBound"; applicant pages retain `로그아웃`;
  install entry present in anon/applicant header AND in 더보기.
- **ListRow:** `.listRow` no longer hardcodes the 3-col grid; truncation gone (short text renders full).
- **Tabs:** 멤버/대화/더보기 render inline-SVG icon + label, horizontal bottom; TabBar has an `orientation` prop (default
  horizontal); **NO left rail implemented**; no new dep.
- Tone-down/warmth + Persona Clip + simplicity gates preserved (weights ≤600, no uppercase, heading ≤24, serif=prose-only).

## 6. Handoff to Codex (step 2)
Produce the plan: the `usePathname`-based site-header 3-state logic (anon / logged-in-non-member / /member→null); the
/member header de-stacking (drop standalone AppBar, phoneTop = single bar, one brand); the More-tab grouped data model +
the disabled-row treatment (aria-disabled + badge, non-nav); `내 멤버십` inline-status row; the ListRow flex refactor +
the description 2-line clamp; the bottom-tab inline-SVG iconization + TabBar `orientation` prop (horizontal default, rail NOT built);
install-entry placement (public header + 더보기, not member header). Explicitly confirm
**no role-fetch, no new route, no chat/ledger linkage, no left-rail, auth/API/PWA/core unchanged.** Return for Claude approval before build.
