# Pre-alpha Design Pass — Anthropic Warmth/Depth Addendum (Claude Code / Cowork)

> **Step 1 (re-design) of the loop**, corrective for "same hex, but lacks Anthropic's deep warmth" on the tone-down build.
> Claude Code = this addendum → Codex = concrete plan (incl. font sourcing + GLM-delegated sweeps) → Claude Code =
> review/approve → Codex builds (fix-forward) → Claude Code = final independent review (adversarial workflow + grep gates).
> Builder ≠ approver; design ≠ build; final gate = Claude Code/Cowork.
> **JT scope decision (2026-06-18):** FULL warmth + the optional micro-depth seasoning + **serif body**.
> Companions: `docs/DESIGN_PASS_BRIEF.md` (§1 frozen palette), `docs/DESIGN_PASS_ADDENDUM.md` (tone-down/simplicity rules — still in force).

## 0. Why / ground truth (Anthropic's real brand CSS, fetched live 2026-06-18 — HIGH confidence)
Our hex palette already matches Anthropic exactly, but it does NOT *feel* like Anthropic. Verified against
`cdn.prod.website-files.com/.../ant-brand.shared.*.min.css`:
- **Warmth is carried FIRST by TYPOGRAPHY.** Anthropic body/paragraph text is a **SERIF** (`"Anthropic Serif", Georgia`
  as the `:root` default); headings are a distinctive **SANS** ("Anthropic Sans", 600/700). Our build **loads NO web font
  at all** — `globals.css` names `"Geist","Inter"` but there is no `next/font`, no `@font-face`, no woff files, so we render
  in the OS **system sans** (the generic "unstyled web app" signal). This is the #1 reason for "same hex, wrong feel."
- **The reframe that resolves JT's tension:** warmth ≠ added depth/busyness. A serif on flat cream reads **calmer** than
  sans, cream surfaces **lower** contrast, ink buttons **reduce** noise. So the biggest levers serve BOTH "calm/simple"
  and "Anthropic-warm" at once. Only shadow + canvas-gradient genuinely trade against flat — those are applied
  **homeopathically** (JT opted into the micro-dose).

## 1. Hard boundary (final audit enforces)
- **Surface / app-layer only**: `apps/web/app/**` (tsx + CSS modules + a `fonts` module + committed `*.woff2`), `apps/web/
  components/**` (UI), `app/globals.css`, `app/layout.tsx` (minimal: apply the font CSS-variable class).
- **NO new npm dependency.** Use `next/font/local` (built into Next) with **self-hosted woff2** committed to the repo.
  Do NOT add `@fontsource/*`, `geist` pkg, Google-CDN runtime fonts, or any package.json change.
- **FROZEN — do NOT touch**: `supabase/**`, `packages/**`, `apps/web/app/api/**`, `apps/web/lib/**`, `.env*`, `scripts/`,
  `next.config*`, `package.json`/lockfile, and the **already-audited PWA logic** `apps/web/public/sw.js`,
  `app/manifest.ts`, `components/pwa/**` (sw.js/manifest stay **byte-identical**; new woff2 served from `/_next/static/`
  is fine and even improves offline).
- **Untouched behavior**: auth, 3-client boundary, `authedFetch` flow, RLS/RPC, storage/reaper, state machine, INV-*,
  **Persona Clip semantics + proper noun "Persona Clip"**, all guards, all test **assertions**.
- **Tone-down rules from `DESIGN_PASS_ADDENDUM.md` STAY in force** — this pass must NOT re-break simplicity (see §3).

## 2. The levers (specced, priority order)

### 2.1 Typography — load real fonts (THE lever) · authentic pairing
- **Body = warm serif.** Recommended **Source Serif 4** (SIL OFL, text optical size, highly legible at 15–16px; alt:
  Newsreader). Fallback stack: `"Source Serif 4", Georgia, "Times New Roman", serif`.
- **Headings + UI/labels/buttons = clean sans.** Recommended **Geist** (OFL; the family we already declare). Fallback:
  `"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. (This is Anthropic's real model: serif body
  + sans headings. JT may flip headings→serif with a one-line change if desired.)
- **Loading:** `apps/web/app/fonts.ts` using `next/font/local`, woff2 committed under `apps/web/app/fonts/` (or `public/
  fonts/`); export `--font-serif` / `--font-sans` CSS variables; apply both variable classes on `<html>`/`<body>` in
  `layout.tsx` (the only layout edit). In `globals.css`: `:root` body font → `var(--font-serif)`; headings/buttons/labels
  → `var(--font-sans)`. Use `display: "swap"`, latin subset (+ latin-ext); Korean copy falls back to system Hangul
  (acceptable — Anthropic ships latin only; do NOT add a heavy Korean webfont).
- **Keep the type SIZE cap** (h1 ≤ 22 / mobile 20, h2 ≤ 18, body 16/15): the serif carries the editorial warmth at the
  capped size. Do **NOT** enlarge display type (that would re-break the tone-down). Weights stay 400/500/600.

### 2.2 Surfaces — AUTHENTIC model (corrects a lens conflict)
Ground truth (Lens A, raw CSS) **overrides** the reasoning lenses here: **Anthropic uses WHITE cards on a CREAM page**
(`--card = white`), with warmth from the cream page dominating + warm *secondary* tones. So:
- **Keep white `#FFFFFF` cards** — do NOT tint the main cards cream (that would move us *away* from Anthropic).
- **Let the cream canvas dominate the viewport**: prefer cream (`--canvas #faf9f5`) as the background a user mostly sees;
  white cards read as discrete objects on it, not edge-to-edge white fills.
- **Add a true warm "oat" 3rd tone** (`#e8e6dc`, Anthropic's ivory-dark) as a token, and use it for **section bands /
  list headers / sunken zones** (e.g. member `phoneTop`, admin table header, section fills) instead of the near-white
  `--surface-warm #fff8f3`. `--surface-sunken #f0eee6` stays for nested fills.

### 2.3 Buttons — ink primary, clay as spice
- **Primary button → ink/slate** (`#191919`, white/ivory text) instead of orange `--accent-text #a94728`. Anthropic's
  primary CTA is slate-dark; clay is rare. Keep AA contrast (white on #191919 is ~17:1).
- **Reduce orange-everywhere chrome**: keep the brand seal / one or two true accent moments in clay, but de-emphasize
  orange on routine chrome (active-tab indicator, etc.) toward ink + a small clay marker. Don't remove brand identity —
  just stop orange from doing all the work.

### 2.4 Radius — unify + soften
- Cards/panels/sections **8 → 12px** (large surfaces may go 16); inputs/buttons **8–10px** (not pill). Fix the drift
  (member appShell 22px, avatar 15px, brand-seal 12px) to one moderate scale. More air in card padding (one step up).

### 2.5 Borders — optional, low priority
- Optionally redefine `--line`/`--line-strong` as **translucent ink** (`rgba(25,25,25,0.10)` / `0.18`) so lines pick up
  the surface beneath (Anthropic uses ink-derived translucent borders). Keep 1px. Skippable if risk/effort not worth it.

### 2.6 Micro-depth seasoning (JT opted IN — keep homeopathic)
- **ONE soft, WARM-tinted, low-alpha shadow on the SINGLE highest-elevation surface only** — the member `appShell`
  (and optionally the sticky header / any popover). Warm tint, e.g. layered
  `0 1px 2px rgba(60,45,35,0.04), 0 8px 24px rgba(60,45,35,0.05)` — NOT the existing cool gray `--shadow`, and **NOT on
  every card** (cards stay border-only). Replace/repurpose the unused `--shadow` token to this warm value.
- **ONE static, sub-4% warm radial wash on the canvas** — e.g. `radial-gradient(120% 80% at 50% 0%, rgba(217,119,87,0.03),
  transparent 60%)` fixed on `body`, so the page reads as lit paper. **HARD limit: imperceptible as a band** — if a user
  can point to a color stripe, it's too strong. **NO paper-grain / noise** (Anthropic uses none — off-model).

## 3. Must NOT change (guardrails — don't re-break the tone-down)
- No new npm dependency; fonts via `next/font/local` + committed woff2 only.
- Do NOT enlarge type past the cap; no heading `font-size` > 24px; weights ≤ 600; **sentence case** (no `text-transform:
  uppercase`); no decorative pseudo-element cruft returns.
- Depth is **one** elevated surface + **one** sub-4% wash. NO broad/every-card shadows, NO multi-stop loud gradient,
  NO grain, NO more/louder orange, NO bouncy/scale/entrance motion.
- PWA `sw.js`/`manifest.ts`/`components/pwa/**` byte-identical; api/lib/supabase/packages/scripts/config/package untouched.
- Persona Clip semantics + proper noun intact; existing test assertions (PC-01, role-403, membership, decision-body,
  idempotency, status no-render lock, SW security) not weakened (selectors may update for restyle, assertions may not).

## 4. Acceptance gates (Claude Code final review — step 5, adversarial workflow + grep)
- `pnpm -F web typecheck` · `pnpm -F web test` green & non-weakened · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **Boundary diff EMPTY**: supabase, packages, app/api, lib, .env*, scripts, next.config*, **package.json, pnpm-lock**,
  sw.js, manifest.ts, components/pwa = ∅. (Confirms **no new dep** + PWA untouched.)
- **Fonts actually loaded**: `next/font/local` present in `fonts.ts`; `*.woff2` committed; `--font-serif`/`--font-sans`
  wired; body computed font = serif, headings = sans. (`@font-face`/next-font output present in build; serif family referenced.)
- **Buttons**: primary background is ink `#191919` (not orange) — grep `.button`/`.button-primary`.
- **Simplicity preserved (still grep-clean)**: no heading `font-size` > 24px; no `font-weight` > 600 (in-scope); no
  `text-transform: uppercase`; **at most ONE** non-`none` `box-shadow` token used in-scope, warm-tinted, applied only to
  the elevated surface(s) — NOT to `.card`/every panel; **at most ONE** canvas `radial-gradient` at ≤ ~0.04 alpha; no
  paper-grain/noise; no `.hero`/`.door`/`.hero-phone`/`.intro-band` cruft.
- **PWA byte-match** on the new deploy: `/sw.js` cmp=0, `/manifest.webmanifest` fields intact, woff2 served 200.
- Persona Clip proper noun + semantics intact; INV-* untouched.
- **Visual**: JT real-device eyeball — reads warm + editorial (serif), still calm/flat by default.

## 5. Handoff to Codex (step 2)
Produce the **concrete plan**:
1. **Font sourcing** — exact faces (Source Serif 4 body + Geist sans, or alternates), which woff2 weights/subsets, from
   where (OFL source), committed path; the `fonts.ts` (`next/font/local`) wiring + the minimal `layout.tsx` className edit
   + the `globals.css` `:root`/heading/button font-variable application.
2. **Surface map** — add the oat `#e8e6dc` token; which elements move to oat (section bands/headers/sunken); confirm white
   cards STAY white; ensure cream-dominant viewport.
3. **Button/radius/border edits** — primary→ink, orange de-emphasis list, radius unification map, optional translucent borders.
4. **Micro-depth** — the single warm `--shadow` value + the one elevated surface it applies to; the one canvas radial wash.
5. **GLM-delegated repetitive sweeps** (under Codex supervision): radius normalization, font-variable application across
   modules, orange→ink button swaps. Codex hand-edits the font wiring + surface decisions + any test-selector updates.
6. Confirm §1/§3 frozen + PWA + package.json are NOT in the change set, and **no new npm dep**.
Return the plan for Claude Code review **before** building. Do not start until approved.
