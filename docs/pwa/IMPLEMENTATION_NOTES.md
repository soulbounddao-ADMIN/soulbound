# PWA finish — implementation notes (2026-10-06)

Branch `zcode/pwa-finish-2026-10-06` (fork `BeautifulMind-JT/soulbound`), base `phase1-p0-mvp` @ `1e9e225`.
Toolchain: Node 24.21.0, pnpm 11.1.3, `pnpm install --frozen-lockfile`. **No new dependencies**
(`package.json` / `pnpm-lock.yaml` unchanged). Untouched: `packages/**`, `supabase/**`, `apps/web/lib/**`
(auth-provider), `apps/web/app/api/**`, Persona Clip, NotificationPort, HARD RULE 6,
`components/pwa/service-worker.security.test.ts` (frozen) and `components/pwa/sw-security.ts`.

| # | Item | Status |
|---|------|--------|
| 1 | Manifest / installability | done (screenshots skipped) |
| 2 | iOS meta | done (`viewport-fit=cover` intentionally not set) |
| 3 | Offline fallback | done (served as `/offline.html`) |
| 4 | SW correctness / versioning | done |
| 5 | Update flow | done |
| 6 | Install UX | done |
| 7 | Android warning doc | done (doc only; hosting checks are operator work) |
| 8 | Unit tests | done |
| 9 | Gates | done — all 6 pass |

## 1. Manifest / installability — done
- `app/manifest.ts`: added `lang: "ko"`, `dir: "ltr"`, `orientation: "portrait"` (UI is a mobile-first
  phone shell), `categories: ["social"]`, explicit `purpose: "any"` on 192/512, new
  `purpose: "maskable"` 192. `id`/`start_url`/`scope` stay `"/"` (stable identity).
- `public/icons/maskable-192.png` (new, 192×192) and `public/icons/maskable-512.png` (regenerated,
  512×512): full-bleed `#F5E4DB` background with the glyph inside the 80% safe-zone circle. The old
  maskable-512 had a rounded card on an off-white background, so launcher masks showed off-white
  corners and the glyph corners sat on the safe-zone edge. Generated with Python stdlib (no deps).
- Verified pixel sizes with `file`: icon-192 192×192, icon-512 512×512, maskable-192/512 OK,
  `app/icon.png` 192×192, `app/apple-icon.png` 180×180.
- Public reachability (`next start`, no cookies): `/manifest.webmanifest` 200
  `application/manifest+json`; all `/icons/*.png`, `/icon.png`, `/apple-icon.png`, `/sw.js`,
  `/offline.html` 200, no redirects. The repo has no Next middleware/proxy.
- Not done: manifest `screenshots` — no real UI screenshot assets exist and generating
  representative ones would need a browser pipeline/assets outside the repo; optional per brief.

## 2. iOS meta — done
- Emitted head (verified via curl on `next start`):
  `<link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="180x180" type="image/png">`,
  `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style=default`,
  `mobile-web-app-capable=yes`, `viewport width=device-width, initial-scale=1`, `theme-color`.
- `app/layout.tsx`: added `other: { "apple-mobile-web-app-capable": "yes" }` — Next 16 only emits
  `mobile-web-app-capable`; older iOS versions need the apple-prefixed tag for standalone launch.
- `viewport-fit=cover` **not** added: the existing app CSS has no safe-area handling (header, tab
  bar), so `cover` would let content run under the notch/home indicator. The new update banner uses
  `env(safe-area-inset-bottom, 0px)` which is harmless without `cover`. Revisit when the shell CSS
  gets safe-area padding.

## 3. Offline fallback — done
- `public/offline.html`: static, data-free Korean page (no scripts, no external requests, inline
  CSS, `noindex`); "다시 시도" reloads the original URL.
- Precached in `install` (required: install fails only if the offline page itself fails).
- Served **only** for failed navigations (`request.mode === "navigate"`). Private pages
  (`/member`, `/admin`, `/apply`, `/gate`) are network-only with `cache: "no-store"` and never stored;
  `/api` and `persona-clip` navigations are not intercepted at all. Public shell pages
  (`/`, `/login`, `/signup`) fall back to their cached copy first, then the offline page.
- Served at `/offline.html` (a static `public/` file) rather than an app route so it has zero
  framework/JS/data dependencies.

## 4. SW correctness / versioning — done
- `public/sw.js`: single constant `SW_RELEASE = "2026-10-06.1"` (format `YYYY-MM-DD.N`); cache names
  derived as `soulbound-${SW_RELEASE}:shell|assets`; `activate` deletes every other `soulbound-*`
  cache (incl. the old `soulbound-prealpha-v1`), leaves foreign caches alone. Rule documented in the
  sw.js header and in `PROJECT_STATE.md` (2026-10-06 entry).
- Manifest + icons: stale-while-revalidate (`waitUntil` keeps the revalidation alive).
  `/_next/static/*` (hashed): cache-first.
- Only `status 200`, `type "basic"`, `!redirected` responses are cached (also for precache).
- Bypassed requests (non-GET, cross-origin, Authorization, no-store, `/api`, persona-clip,
  `/admin`, `/apply`, `/gate`, `/member`): **no `respondWith`**. Single exception: same-origin GET
  page navigations to private pages → `fetch(request, { cache: "no-store" })` so failure can show the
  offline page (nothing cached). Unknown same-origin GETs are also not intercepted.
- Install caches shell URLs individually (`Promise.allSettled`); one failing shell URL no longer
  fails installation. Automatic `skipWaiting` removed; `message` handler for `{ type: "SKIP_WAITING" }`.
- Pure mirror of the decision table in `components/pwa/sw-rules.ts` (reuses frozen
  `sw-security.ts#shouldBypassCache`).

## 5. Update flow — done
- `components/pwa/sw-update.ts`: `watchForWaitingWorker` (existing `registration.waiting` +
  `updatefound` → `statechange: installed`; never prompts on the first install, i.e. without a
  controller) and `createReloadGuard` (reload exactly once, only after the user accepted).
- `service-worker-provider.tsx`: registers `/sw.js` (production only, `updateViaCache: "none"`),
  checks for updates on `visibilitychange`, shows the banner "새 버전이 있습니다 — 새로고침"
  (`update-banner.module.css`), posts `SKIP_WAITING`, reloads once on `controllerchange`.

## 6. Install UX — done
- `components/pwa/install-platform.ts` (pure): iOS incl. iPadOS (`Macintosh` UA + `maxTouchPoints>1`),
  in-app browsers (KakaoTalk, Naver, Instagram, Facebook, LINE, Android WebView), standalone,
  dismissal TTL, `resolveInstallMode` → `native | ios | in-app | none`, external-browser URL
  (KakaoTalk `kakaotalk://web/openExternal`, Android `intent://…;package=com.android.chrome`).
- `install-prompt.tsx`: native `beforeinstallprompt` button (Android/desktop); iOS/iPadOS Safari step
  guide (공유 버튼 → "홈 화면에 추가" → 추가); in-app guidance "Safari/Chrome으로 열기" with open link
  where a scheme exists + 링크 복사; hidden in standalone / after `appinstalled`; dismissal stored as a
  timestamp in `localStorage["soulbound.pwa.install-dismissed-at"]` (14-day TTL, non-sensitive,
  storage errors tolerated). Still mounted in `site-header.tsx` and the member "앱" section.

## 7. Android "unsafe app" warning — done (doc)
- `docs/pwa/android-install-warning.md`: WebAPK minting (public HTTPS, anonymous manifest/icon
  fetch), Vercel Deployment Protection, `*.vercel.app` preview domains, manifest `id` stability,
  Samsung Internet / Play Protect / in-app browsers, `chrome://webapks`, curl checklist, what to
  collect from reporters. Code-side: only the maskable icon fix + explicit `purpose`; the likely root
  causes (protection / preview domain) are hosting settings and cannot be fixed in code.

## 8. Tests — done (new files only; frozen tests unchanged)
- `install-platform.test.ts` (29): UA detection matrix, iPadOS, in-app browsers, standalone,
  dismissal TTL, install modes, external URLs.
- `sw-rules.test.ts` (27): release parsing, bypass → passthrough / network-only navigation,
  cache-first / SWR routing, cacheable-response policy (opaque, redirected, 206, 500 rejected).
- `sw-update.test.ts` (6): waiting/updatefound detection, first-install suppression, disposal,
  one-time reload guard.
- `sw-behavior.test.ts` (18): runs the **shipped** `public/sw.js` in `node:vm` with fake
  caches/fetch: no `respondWith` for every bypass class, private navigation network-only + never
  cached, offline fallback, install resilience, SKIP_WAITING only on message, no redirected/opaque
  caching, SWR, cache-first, old-release cleanup. (Addresses the PROJECT_STATE §4 "SW drift-guard"
  P2 follow-up.)

## 9. Gates — all pass
| Gate | Result |
|------|--------|
| `pnpm -r typecheck` | PASS — core / adapters / web `Done` |
| `pnpm -F @soulbound/core test` | PASS — 3 files, 26/26 |
| `pnpm -F @soulbound/adapters test` | PASS — 8 files, 25/25 |
| `pnpm -F web test` | PASS — 23 files, 191/191 (baseline 111 + 80 new) |
| `bash scripts/audit.sh` | PASS — `AUDIT PASSED` |
| `pnpm -F web build` | PASS — `Compiled successfully`, `/manifest.webmanifest` static |
Also `git diff --check` clean.

### Browser check (Chrome 137 on the VM, `next start` with dummy `NEXT_PUBLIC_SUPABASE_*`, not Lighthouse)
- SW controls the page after first load; no update banner on first install.
- Bumping `SW_RELEASE` + `registration.update()` → waiting worker → banner shown → click
  "새로고침" → page reloads, caches become `soulbound-2026-10-06.2:*` only, no reload loop
  (navigation count stable after an extra wait).
- Server stopped: `/member`, `/admin`, `/apply`, `/terms` → offline page; `/login` → cached shell.
  Cache contents after visiting `/member` and `/admin` online: no private path stored.
- Note: without `NEXT_PUBLIC_SUPABASE_*` the client `AuthProvider` throws on hydration (pre-existing,
  unrelated), which unmounts the tree and hides the banner — test with public env set.
- **Not run:** Lighthouse 11.x installability and real-device installs (Android Chrome, Samsung
  Internet, iOS Safari / iPadOS). Lighthouse ≥12 has no PWA category; use Chrome DevTools →
  Application → Manifest or `npx lighthouse@11` outside the repo.

## Risks
- `/offline.html` is a separate static file; the brief said "/offline page". Functionally equivalent.
- Users on the old SW (`soulbound-prealpha-v1`, which auto-`skipWaiting`ed) switch to the new SW on
  their next visit without the banner (old worker has no waiting logic); from then on the banner flow
  applies.
- Install guidance copy / external-browser schemes are UA-heuristic; needs real-device confirmation.
