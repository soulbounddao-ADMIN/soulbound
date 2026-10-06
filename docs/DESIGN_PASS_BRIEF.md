# Pre-alpha Design Pass + PWA — Initial Design Brief (Claude Code / Cowork)

> **Step 1 of the agreed loop** (JT-approved, 2026-06-18):
> **Claude Code = initial design (this doc)** → **Codex = concrete implementation plan** (incl. exactly what is
> delegated to GLM 5.2) → **Claude Code = review/approve the plan** → **Codex builds** (GLM as grunt for repetitive
> surface work, under Codex supervision) → **Claude Code = final independent review**.
> Invariant preserved: the builder (Codex/GLM) never self-approves; design ≠ build; final gate = Claude Code/Cowork.
> This is a **one-time surface-polish exception** (same shape as the 3bd68f2 exception in PROJECT_STATE §1); it does
> NOT change `docs/WORKFLOW.md` base policy.

This brief sets the **visual + structural direction + the PWA architecture**. Codex turns it into the detailed
build plan (file-by-file, component build order, per-page change list, GLM-delegated tasks). Codex should NOT
invent product behavior — only restyle/restructure the existing surface.

## 0. Hard boundary (every step obeys; final audit enforces)
- **100% surface / app-layer**: `apps/web/app/**`, `apps/web/components/**` (UI), CSS/tokens, `app/manifest.ts`,
  `app/icon.*`, `public/` static assets, a service worker, an install-prompt component.
- **FROZEN — do NOT touch**: `supabase/**`, `packages/**` (core/adapters), `apps/web/app/api/**` (route logic),
  `apps/web/lib/**` (auth-provider, api-response, application-state), `.env*`, `scripts/`, `next.config` build
  semantics beyond what PWA requires, `package.json`/lockfile beyond strictly-needed (prefer zero new deps).
- **Untouched behavior**: auth/session, the 3-client boundary, data flow (component→hook→`authedFetch`→route→
  service), RLS/RPC, storage/reaper/retention, approval state machine, INV-*, and **Persona Clip semantics**
  (upload/hash/storage/deletion) + its **product proper noun** "Persona Clip".
- **🔴 Service-worker security guard (the one security-sensitive piece)**: the SW caches **app-shell / static assets
  ONLY**. It must **NEVER** cache `/api/**`, any request carrying an `Authorization` header, user data, signed URLs,
  tokens, or Persona Clip bytes → those are **network-only, no-store**. Caching authenticated data client-side is an
  INV-17-adjacent leak. The fetch handler must explicitly exclude `/api/` + authenticated requests.

## 1. Design tokens (CONFIRMED — Anthropic exact hex, light-warm; SoulBound-own shades are a later revision)
| Token | Hex | Use |
|---|---|---|
| accent | `#D97757` | primary action · active tab · link · self avatar |
| accent-hover | `#C15F3C` | hover/press |
| accent-weak | `#F5E4DC` | accent badge / selected-row fill |
| on-accent | `#FFFFFF` | text/icon on accent |
| bg-page | `#FAF9F5` | app background |
| bg-surface | `#FFFFFF` | cards · header · tab bar |
| bg-subtle | `#F0EEE6` | hero/persona band · section fills |
| text-primary | `#191919` | titles · body |
| text-secondary | `#6B6862` | sub-labels |
| text-tertiary | `#8F8B80` | hints · counts |
| border | `#E5E2D9` | dividers · card borders |
| border-strong | `#D6D2C7` | emphasis borders |
| success | `#3D9A6D` | active status dot |
| danger | `#C0392B` | reject / destructive |
- Define these as CSS custom properties in one place (e.g. `app/globals.css` `:root`) so every component references
  tokens, not literals. Build a proper **accent ramp** (light fill → dark text shade) so accent text/buttons hit
  **WCAG AA**.
- **Typography**: system / Geist / Inter sans, **two weights only (400/500)**, **sentence case** everywhere. h1 22 ·
  h2 18 · body 16 (mobile 15) · sub 13. line-height ~1.6.
- **Radius**: 8 (md) · 12 (lg, cards) · 999 (pill). **Spacing**: 4 · 8 · 12 · 16 · 24.

## 2. Design principles (the "feel")
- **Calm, warm, trust-first** — intimate/curated, not a mass-market chat clone. Take 2012-KakaoTalk's *familiarity*
  (bottom tabs, avatar list rows, big touch targets, mobile-first), not its yellow skin.
- **Mobile-first** (alpha is on phones — Samsung Internet / iOS Safari / Android Chrome). Touch targets ≥ 44px.
- **Intentional empty states** — placeholders read as designed ("…여기 표시됩니다" + icon), never "unfinished".
- **One quiet surface** — generous whitespace, hairline borders, no gradients/shadows.
- Reference for the member shell: the approved member-home mock (warm terracotta + cream, top bar / My Persona / list
  rows / bottom tab bar).

## 3. Component system (shared primitives — build once, use everywhere)
Codex builds these as reusable components (e.g. `apps/web/components/ui/`), each token-driven:
- **AppBar** — page title + optional subtitle + right icon slot (search/bell). Surface bg, hairline bottom border.
- **TabBar** (bottom) — 2–4 tabs, icon + label, active = accent. In-flow (not `position:fixed`).
- **ListRow** — avatar + primary/secondary text + right slot (status dot / chevron / badge). Divider border.
- **Avatar** — initials circle; self = accent fill, others = subtle tan fill + accent initials. 42/54px.
- **Card** — surface bg, hairline border, radius-lg, padding. (My Persona band = bg-subtle variant.)
- **Section** — header (title + count/right slot) + body; used for member sections.
- **EmptyState** — dashed/subtle box, icon + one calm line.
- **Field** — label + input/textarea (reuse existing form behavior; restyle only).
- **Button** — primary (accent), secondary (outline), danger; ≥44px, pill or radius-md.
- **Badge / StatusDot** — pill (accent-weak / semantic) + dot (success/idle).

## 4. PWA architecture (whole app, installable, Cursor-quality)
- **manifest** → `app/manifest.ts` (Next 16 native metadata route): `name`, `short_name`, `display: "standalone"`,
  `start_url: "/"`, `theme_color: "#FAF9F5"`, `background_color: "#FAF9F5"`, icons (192, 512, **512 maskable**).
- **icons** → `app/icon.png` + `app/apple-icon.png` + the manifest sizes. SoulBound mark on warm bg (terracotta).
- **viewport/theme** → layout `viewport` export (theme-color `#FAF9F5`; `appleWebApp: { capable, statusBarStyle,
  title }` for iOS standalone).
- **service worker** → **hand-rolled minimal** (no next-pwa/Serwist dep — tighter security control + 0C-friendly):
  registered client-side; **precache the app shell + static assets only**; fetch handler = **network-only/no-store
  for `/api/**` and any Authorization-bearing request** (the §0 guard), cache-first only for hashed static assets;
  a versioned cache name + cleanup of old caches on activate. Keep it small + auditable. (Serwist is the fallback
  only if hand-rolled proves insufficient — and then `/api` exclusion must be explicit in its runtime config.)
- **install UX** (platform-aware, Cursor-like):
  - **Chromium (Chrome/Samsung Internet)**: capture `beforeinstallprompt` (preventDefault, stash it) → show a custom
    **"앱으로 설치" button/banner** → on click call `prompt()`; hide after install / when `display-mode: standalone`.
  - **iOS Safari**: no programmatic install → show an **instructional sheet** ("공유 → 홈 화면에 추가") gated on iOS-
    Safari detection + not-already-standalone.
  - Never show the install affordance when already installed/standalone.
- **No new backend, no push** for this pass (push is out of scope; iOS 16.4+ web-push is a later option).

## 5. Per-page direction (all 7 — Codex details the implementation per page)
Apply the token+component system consistently; restyle/restructure only, preserve all existing data wiring + guards.
- **`/` landing ("잠긴 문")** — calm hero (mark + one-line value + "입장"/"가입" CTA). Warm, sparse, premium.
- **`/login`** — centered Card, Field × 2 (email/password), primary Button, link to signup. Keep `signIn` wiring.
- **`/signup`** — same Card pattern; keep `signUp` + email-confirmation branch ("메일 확인" state) intact.
- **`/gate`** — admission hub: state-aware (no-app → 신청, has-app → 상태, member → 멤버). Clean step list. Keep the
  `/api/admission/applications/me` + `/api/membership/me` reads via `authedFetch`.
- **`/apply`** — application form (Fields) + **Persona Clip recorder section unchanged in behavior** (restyle the
  surrounding shell only; recorder hook/`authedFetch`/PC-01 untouched). "Persona Clip" stays the proper noun.
- **`/apply/status`** — status card: badge + applicantNotice (NOT internal reasonCode/reviewSummary). Keep the
  me/detail fetch + auth guard.
- **`/member`** — the approved shell (멤버/대화/더보기 tabs + My Persona + New/Active/All Members sections + intentional
  empty states) per the approved mock. Keep `/api/membership/me` + non-active→`/gate` guard.
- **Admin pages** (`/admin/applications`, `/admin/applications/[id]`) — apply the system for consistency (AppBar,
  ListRow queue, Card detail, Button decisions). Keep ALL behavior: `requireReviewer` route-delegation, reviewSummary
  reviewer-only, clip playback on-click, reasonCode enum, idempotency, 409 handling.
- **Global**: `app/layout.tsx` wraps everything; site-header consistent with AppBar; the install prompt mounts
  globally (not on a protected route).

## 6. Acceptance gates (Claude Code final review — step 5, with an adversarial workflow)
- `pnpm -F web typecheck` clean · `pnpm -F web test` green (UI test selectors updated, **not weakened**; PC-01 /
  role-403 / membership / decision-body assertions preserved) · `pnpm -r build` PASS · `git diff --check` clean.
- **Boundary diff EMPTY**: `git show <range> -- supabase packages apps/web/app/api apps/web/lib .env* scripts` = ∅.
- **🔴 SW audit**: prove the SW never caches `/api/**` or Authorization-bearing requests (read the fetch handler +
  a test/inspection). No service-role/token/user-data in any cache.
- **PWA installable**: Lighthouse PWA "installable" pass; **real-device install** on Android Chrome + Samsung
  Internet (custom button → home screen) + iOS Safari (share → add to home screen, opens standalone).
- **Visual**: JT real-device eyeball on the 7 pages + the member shell.
- Persona Clip proper noun + semantics intact; INV-* untouched.

## 7. Handoff to Codex (step 2)
Codex: produce the **concrete implementation plan** from this brief — token CSS location, the `ui/` component files
+ build order, the `app/manifest.ts` / icons / SW / install-component files, the per-page change list (7 pages +
admin + layout), and **explicitly which repetitive surface tasks GLM 5.2 does** (e.g. applying a finished component +
tokens across pages, copy/spacing/label normalization) under Codex supervision. Return the plan for Claude Code
review BEFORE building. Do not start the build until the plan is approved.
