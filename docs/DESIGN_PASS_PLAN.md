# Pre-alpha Design Pass + PWA — Codex Implementation Plan

Status: approved by Claude Code/Cowork Step 3 with six build-time corrections.

This plan implements `docs/DESIGN_PASS_BRIEF.md` without changing data flow, auth, API routes, core/adapters,
Supabase, storage/reaper/retention, or Persona Clip semantics.

## 1. Boundary

Allowed:
- `apps/web/app/**` page/layout/metadata/PWA files.
- `apps/web/components/**` presentational UI and PWA components.
- `apps/web/public/**` static PWA assets and service worker.
- UI tests where selectors or surface assertions need to track restyled markup.
- `docs/**` for design-pass tracking.

Forbidden:
- `supabase/**`
- `packages/**`
- `apps/web/app/api/**`
- `apps/web/lib/**`
- `.env*`
- `scripts/**`
- `next.config*`
- `package.json` / lockfile

Boundary proof command:

```bash
git diff --name-only -- supabase packages apps/web/app/api apps/web/lib .env* scripts next.config* package.json pnpm-lock.yaml
```

Expected: empty.

## 2. Tokens

Define all design tokens in `apps/web/app/globals.css` `:root` as CSS custom properties.

Confirmed palette:
- `--color-accent: #D97757`
- `--color-accent-hover: #C15F3C`
- `--color-accent-strong: #A94728`
- `--color-accent-pressed: #963B20`
- `--color-accent-text: #8D3A24`
- `--color-accent-weak: #F5E4DC`
- `--color-on-accent: #FFFFFF`
- `--color-bg-page: #FAF9F5`
- `--color-bg-surface: #FFFFFF`
- `--color-bg-subtle: #F0EEE6`
- `--color-text-primary: #191919`
- `--color-text-secondary: #6B6862`
- `--color-text-tertiary: #8F8B80`
- `--color-border: #E5E2D9`
- `--color-border-strong: #D6D2C7`
- `--color-success: #3D9A6D`
- `--color-danger: #C0392B`

WCAG correction:
- `#D97757` is not used for normal white text buttons.
- Primary filled buttons use `#A94728` + white.
- Pressed uses `#963B20`.
- Warm-surface accent text uses `#8D3A24`.

Typography:
- System / Geist / Inter sans.
- Weights 400 and 500 only.
- `h1` around 22px, `h2` around 18px, body 15-16px, subtext 13px.

## 3. UI Components

Create `apps/web/components/ui/`:
- `button.tsx`
- `card.tsx`
- `field.tsx`
- `badge.tsx` including `StatusDot`
- `avatar.tsx`
- `list-row.tsx`
- `section.tsx`
- `empty-state.tsx`
- `app-bar.tsx`
- `tab-bar.tsx`
- `ui.module.css`
- `index.ts`

Build order:
1. Button, Card, Field, Badge/StatusDot.
2. Avatar, ListRow.
3. Section, EmptyState.
4. AppBar.
5. TabBar.
6. Apply primitives to pages.

## 4. PWA

Add:
- `apps/web/app/manifest.ts`
- `apps/web/app/icon.png`
- `apps/web/app/apple-icon.png`
- `apps/web/public/icons/icon-192.png`
- `apps/web/public/icons/icon-512.png`
- `apps/web/public/icons/maskable-512.png`
- `apps/web/public/sw.js`
- `apps/web/components/pwa/service-worker-register.tsx`
- `apps/web/components/pwa/install-prompt.tsx`
- `apps/web/components/pwa/pwa-shell.tsx`
- `apps/web/components/pwa/service-worker.security.test.ts`

Update:
- `apps/web/app/layout.tsx` with `viewport`, PWA metadata, and global PWA shell mount.

No new dependencies.

## 5. Service Worker Security

`apps/web/public/sw.js` must be small and auditable.

Bypass cache for:
- non-GET
- cross-origin
- `/api/**`
- any request with `Authorization`
- `cache: "no-store"`
- any path containing `persona-clip`

Bypassed requests use `fetch(request, { cache: "no-store" })`.

Only cache:
- public app shell allowlist (`/`, `/login`, `/signup`)
- `/_next/static/**`
- PWA icon assets

Proof:
- `apps/web/components/pwa/service-worker.security.test.ts` imports/evaluates the SW policy and asserts bypass for
  `/api/**`, Authorization-bearing requests, POST, cross-origin signed URL shape, and persona-clip paths.
- Static SW audit reads every `cache.put` path.

## 6. Page Plan

`/`:
- Warm mobile-first landing shell.
- Preserve `useAuth()` session branching and `/signup`, `/login`, `/gate` links.

`/login`:
- Card + Field + Button.
- Preserve `signIn`, role redirects, and `authedFetch` calls.

`/signup`:
- Card + Field + Button.
- Preserve `signUp`, email-confirmation state, `/gate` redirect.

`/gate`:
- AppBar + Card + Section/ListRow.
- Preserve `/api/admission/applications/me`, `/api/membership/me`, 401 redirect, and next-step decision tree.

`/apply`:
- Card + Fields + Persona Clip surrounding shell.
- Preserve body construction, idempotency key, PC-01, clip asset/hash fields, submit route, and 401 handling.
- Persona Clip recorder internals are Codex-only and preferably left behaviorally untouched.

`/apply/status`:
- Card + Badge/ListRow.
- Preserve fetches and auth guard.
- Correction: add a test proving applicant status never renders `reviewSummary`; do not make `reasonCode` newly
  visible. GLM may not alter this privacy-adjacent condition.

`/member`:
- Main mobile messenger shell.
- Preserve `/api/membership/me`, 401 -> `/login`, non-active -> `/gate`.
- Use My Persona, New Members, Active Members, All Members, Chats empty state, More settings rows.
- No fake members and no new member API.

Admin queue:
- Tokenized but work-focused list/table.
- Preserve route-delegated 403, status filter, query params, and loading/empty/error states.

Admin detail:
- Tokenized cards/forms.
- Preserve detail GET, review/approve/reject/request-more-info actions, persona-clip-url playback, 401/403/404/409,
  reasonCode enum selects, idempotency, and `reviewSummary` reviewer-only display.

Layout/header:
- Tokenized header and global PWA shell.
- Preserve sign-out behavior and routes.

## 7. GLM Delegation Boundary

If a GLM-equivalent worker is available, it may only do repetitive surface work after Codex has built primitives:
- apply finished primitives to low-risk pages
- spacing/class normalization
- approved Korean copy consistency
- mobile CSS cleanup
- admin visual consistency

GLM must not touch:
- SW / PWA semantics
- `apps/web/app/api/**`
- `apps/web/lib/**`
- `packages/**`
- `supabase/**`
- Persona Clip hook/upload/hash/storage behavior
- auth/session/gate logic
- dependencies

Codex reviews all delegated diffs and rolls back violations.

## 8. Gates

Required:
- `git diff --check`
- `pnpm -F web typecheck`
- `pnpm -F web test`
- `pnpm -r build`
- boundary diff empty
- SW cache security test and static audit
- Vercel preview deploy
- Lighthouse installable check if tooling is available
- JT real-device install checks: Android Chrome, Samsung Internet, iOS Safari
- JT visual eyeball on `/`, `/login`, `/signup`, `/gate`, `/apply`, `/apply/status`, `/member`,
  `/admin/applications`, `/admin/applications/[id]`

Final approval remains Claude Code/Cowork. Codex/GLM do not self-approve.
