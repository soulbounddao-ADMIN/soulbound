# Pre-alpha Design Pass — Simplicity Tone-Down Addendum (Claude Code / Cowork)

> **Step 1 (re-design) of the agreed loop**, corrective for candidate `ac62201` now live on Vercel preview.
> **Claude Code = this addendum** → **Codex = concrete plan** (incl. GLM-delegated repetitive sweeps) →
> **Claude Code = review/approve plan** → **Codex builds (fix-forward commit, GLM as grunt)** →
> **Claude Code = final independent review (adversarial workflow + measurable gates)**.
> Invariant preserved: builder (Codex/GLM) never self-approves; design ≠ build; final gate = Claude Code/Cowork.
> Scope chosen by JT: **FULL tone-down** — landing + every page (`/login` `/signup` `/gate` `/apply` `/apply/status`)
> + already-reskinned `member` / `admin`. One coherent corrective.
> Companion to `docs/DESIGN_PASS_BRIEF.md` (the original brief, commit 37da24e). This does not change WORKFLOW base policy.

## 0. Why (the defect, grounded in deployed source)
JT's feedback on the staging build: "UI가 충분히 심플하지 않다 (2012 카톡 같지 않다)" + "어두운 테마가 그대로인 것 같다."
Verified across **all** of `apps/web` (source, not `.next` cache):
- **No global dark theme.** `prefers-color-scheme` overrides = 0; `:root` is `color-scheme: light` + cream `--canvas`.
- **The only dark surface a non-admin user sees = the landing `/` hero** — `.hero` near-black overlay
  `linear-gradient(90deg,#191919e6,#1919198f)` + dark brown, plus `.door-visual` `#2b211d` and a fake-phone mockup.
  On mobile that fills the first ~72svh → reads as "dark theme still here."
- **The whole app reads "loud / premium," not "calm."** The build **drifted from the original brief's own discipline**:
  - font-weights **650–840** everywhere (brief said **two weights, 400/500**)
  - **box-shadows** on panels/cards/appShell (brief said **no shadows**)
  - **body radial+linear gradients** + the dark hero gradient (brief said **one quiet surface, no gradients**)
  - display type **42–76px** (brief said **h1 22 / h2 18**)
  - **uppercase** eyebrows + admin table headers (brief said **sentence case everywhere**)
  - decorative cruft: `.door-visual`, `.hero-phone`, `.intro-band` steps, `auth-panel::before` "S" seal box.

**Therefore this pass = re-enforce the brief's existing discipline + rebuild the landing light + apply uniformly,
with measurable gates so it cannot silently drift back.** No new design language is being invented.

## 1. Hard boundary (unchanged — final audit enforces; identical to brief §0)
- **100% surface / app-layer only**: `apps/web/app/**` (tsx + CSS modules), `apps/web/components/**` (UI), `app/globals.css`.
- **FROZEN — do NOT touch**: `supabase/**`, `packages/**`, `apps/web/app/api/**`, `apps/web/lib/**`, `.env*`, `scripts/`,
  `next.config*`, `package.json`/lockfile (**zero new deps**).
- **🔴 PWA is already audited & live — leave byte-identical**: `apps/web/public/sw.js`, `app/manifest.ts`,
  `app/icon.png`, `app/apple-icon.png`, `public/icons/*`, `components/pwa/**` (install-prompt, service-worker-provider,
  sw-security). These passed a byte-match audit on staging; this pass must NOT alter them. Final audit re-verifies the
  byte-match.
- **Untouched behavior**: auth/session, 3-client boundary, component→hook→`authedFetch`→route→service flow, RLS/RPC,
  storage/reaper/retention, approval state machine, INV-*, and **Persona Clip semantics + proper noun "Persona Clip."**

## 2. Design thesis (the feel we are correcting toward)
- **It is an app, not a landing page.** Calm, warm, light-first, utilitarian. 2012-KakaoTalk *familiarity*
  (bottom tabs, list rows, big touch targets, mobile-first) — **never** a marketing splash.
- **One quiet surface**: flat cream page, hairline borders, generous whitespace. No gradients, no shadows, no hero art.
- **Quiet typography**: small, two weights, sentence case. The screen should feel like a tidy messenger list, not a brochure.
- Reference that is already close to right: the **member shell**. Everything else should feel like it belongs next to it.

## 3. The discipline (these ARE the measurable final-audit gates — keep them grep-checkable)
| Rule | Target | Audit check |
|---|---|---|
| Font weight | **only 400 / 500** (single **600** allowed for active-tab/title emphasis) | no `font-weight: 6[5-9]0 / 7xx / 8xx` in any `apps/web/**` css |
| Heading size | **h1 ≤ 22 (mobile 20) · h2 ≤ 18 · body 16/15 · sub 13** | no heading `font-size` > 24px |
| Shadows | **none on content** panels/cards/appShell; hairline border instead | no `box-shadow` on panel/card/shell classes (overlay-only exception must be commented) |
| Backgrounds | **flat** solid `--canvas` page; accents are small fills/dots, not fields | no body gradient; no `.hero`/`.door-visual` dark gradients |
| Case | **sentence case everywhere** | no `text-transform: uppercase` |
| Dark surfaces | **none for non-admin users** | no near-black bg outside admin clip-video letterbox (`#101418` may stay) |
| Radius / spacing | radius 8 / 12 / 999 · spacing 4 / 8 / 12 / 16 / 24 | visual |
| No cruft | remove `.door-visual`, `.hero-phone`, `.intro-band` steps, `auth-panel::before` seal | classes gone |

## 4. Per-surface direction (restyle/restructure only — preserve every data wiring + guard)
- **`/` landing** — rebuild light + sparse: small SoulBound seal (32–40px, `--accent-weak` fill) + name (h1 ≤ 22) +
  one calm value line + two CTAs (가입하기 / 로그인) stacked on mobile. Optionally one plain "이렇게 진행돼요" 3-item
  list — **no eyebrow, no mono step-numbers, no card, no dark band.** Logged-in branch → single "입장 상태 보기" CTA.
  **Delete** `.hero` dark gradient, `.door-visual`, `.door-panel`, `.keyhole`, `.hero-phone*`, `.intro-band`/`.intro-steps`
  /`.step-number` and their markup in `page.tsx`. Keep the `useAuth` session/loading branch.
- **`/login` · `/signup`** — centered card, hairline border, **no shadow, no `::before` seal**, fields + primary button +
  quiet link. Keep `signIn`/`signUp` + the email-confirmation ("메일 확인") branch intact.
- **`/gate`** — plain state-aware list/steps; **drop the `border-left: 5px` accent slab + shadow**. Keep both
  `authedFetch` reads (`/api/admission/applications/me`, `/api/membership/me`).
- **`/apply`** — form fields + **Persona Clip recorder section restyled shell only**; recorder hook / `authedFetch` /
  PC-01 (absence never blocks submit) untouched; "Persona Clip" stays the proper noun.
- **`/apply/status`** — badge + applicantNotice. **Keep the no-render lock**: reviewSummary / reasonCode must still NOT
  render (the existing `apply/status/page.test.tsx` stays and must stay non-vacuous).
- **`/member`** — keep the shell + 멤버/대화/더보기 tabs (it's the reference). **Drop the heavy `0 22px 60px` appShell
  shadow → border only**; `phoneTop` weight 820 → 500/600. Keep `/api/membership/me` + non-active→`/gate` guard.
- **Admin** (`/admin/applications`, `/admin/applications/[id]`) — weights → 400/500; **sentence-case the table `th`
  (remove uppercase)**; keep modest sizes. clip-video letterbox bg may stay dark. Keep ALL behavior:
  `requireReviewer` route-delegation, reviewSummary reviewer-only, clip playback on click, reasonCode enum,
  idempotency, 409 handling.
- **Global** — site-header weights down (brand 780 → 600); flatten body background to solid `--canvas`; remove
  `--shadow` usage. Install-prompt mount + service-worker-provider **unchanged**.

## 5. What must NOT change (builder guardrails)
- Any route/service/repository/adapter/RLS/RPC, auth, 3-client boundary, `authedFetch` flow.
- `public/sw.js` · `app/manifest.ts` · icons · `components/pwa/**` — leave **byte-identical** (PWA already audited & live).
- Persona Clip semantics + proper noun.
- Existing test **assertions**: PC-01, role-403, membership, decision-body, idempotency, the status no-render lock, and
  the SW security tests. Selectors/queries may be updated for the restyle, but **assertions are not weakened**.
- No new dependencies.

## 6. Acceptance gates (Claude Code final review — step 5, adversarial workflow)
- `pnpm -F web typecheck` clean · `pnpm -F web test` green & **non-weakened** · `pnpm -r build` PASS · `git diff --check` clean.
- **Boundary diff EMPTY**: `git show <range> -- supabase packages apps/web/app/api apps/web/lib .env* scripts next.config*
  package.json pnpm-lock.yaml apps/web/public/sw.js apps/web/app/manifest.ts apps/web/components/pwa` = ∅.
- **PWA byte-match still holds** on the new deploy (re-fetch `/sw.js` + `/manifest.webmanifest`, cmp = 0).
- **🔴 Simplicity gates (mechanical, grep-able — §3 table):** no `prefers-color-scheme`; `.hero`/`.door-visual`/
  `.hero-phone`/`.intro-band` classes gone; no `font-weight` > 600; no heading `font-size` > 24px; no panel `box-shadow`
  (documented overlay exception only); no `text-transform: uppercase`; no body gradient; no non-admin dark surface.
- Persona Clip proper noun + semantics intact; INV-* untouched.
- **Visual**: JT real-device eyeball — light + calm across all surfaces; member shell still intact.

## 7. Handoff to Codex (step 2)
Produce the **concrete implementation plan** from this addendum:
1. A **normalization map** — every current weight (650/700/720/750/780/790/820/840) → its 400/500/600 target; every
   heading size → its capped target; every `box-shadow`/gradient to remove.
2. The `app/globals.css` edits (delete `.hero*`/`.door*`/`.keyhole`/`.intro*` blocks, flatten `body`, cap type, kill
   shadows, drop `auth-panel::before`, remove uppercase).
3. The per-file `.tsx` edits (landing rebuild; remove eyebrow/intro-band markup; member/admin module tweaks).
4. **Explicitly which repetitive sweeps GLM 5.2 does** under Codex supervision (the weight / case / shadow normalization
   across files), vs. what Codex hand-edits (the landing rebuild, test-selector updates).
5. Confirmation that §1/§5 frozen + PWA files are not in the change set.
Return the plan for Claude Code review **before** building. Do not start the build until the plan is approved.
