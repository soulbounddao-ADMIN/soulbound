# Task 8a — Auth foundation + public/applicant UI — spec + Codex builder prompt (Cowork-authored)

> First slice of Task 8 (UI pages). **8a = the browser auth foundation + the public + applicant-facing pages +
> the bearer wiring fix for the 7b recorder.** 8b (member + admin/reviewer pages) follows after 8a passes.
>
> **Builder = Codex.** Per the **WORKFLOW §8 amendment (2026-06-05, JT-approved): Codex builds ALL tiers** —
> this is the standing rule now, NOT a §6 exception. First-pass + final audit = **Opus audit session** (builder ≠
> final approver preserved). JT commits.
>
> **⚠️ The make-or-break security constraints (any violation = redo):**
> 1. **INV-17 / 3-client:** the browser uses the **anon key only**. `SUPABASE_SERVICE_ROLE_KEY` (or any
>    service-role client) must **never** reach a client component or the built client bundle, and must never be
>    `NEXT_PUBLIC_`-prefixed.
> 2. **HARD RULE 1:** the browser Supabase client is for **auth + `current_user_role` only** — never `.from()` /
>    `.storage()` / any data read/write. ALL data goes through `authedFetch` → the existing API routes.
> 3. Every API-route call carries `Authorization: Bearer <access_token>` (the routes read the bearer — see §0).
> 4. **Client-side role/guards are UX only.** The security boundary is the routes (already audited). Never write
>    `profiles.role` from the client.
> 5. **PC-01:** absence of a Persona Clip must never block submit.

---

## 0. Grounded contract (verified from the working tree at HEAD — NOT memory; the builder must re-read each file)

**Auth model (the load-bearing fact)** — `apps/web/app/api/_lib/auth.ts`:
- Routes authenticate via `Authorization: Bearer <accessToken>` (`bearerTokenFromRequest` → `getUser(token)`),
  then resolve role via `client.rpc("current_user_role")` (the trusted source; default `applicant`).
- ⇒ The browser must sign in with the anon client, obtain `session.access_token`, and send it as
  `Authorization: Bearer …` on **every** fetch to the API routes. (Cookies are NOT read by the routes.)

**Env** — `apps/web/app/api/_lib/env.ts`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(public, browser-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only — must not appear client-side).

**Existing Supabase client factories** — `packages/adapters/src/supabase/clients.ts`: `createAnonSupabaseClient`,
`createUserSupabaseClient`, `createServiceRoleSupabaseClient` — **all `persistSession:false, autoRefreshToken:false`**
(server, stateless). None is suitable for a persisted browser login. 8a adds a browser variant (see §1-A).

**Routes 8a calls** (read each to confirm exact response shapes):
- `POST /api/admission/applications` — submit. Body (`_lib/schemas.ts submitApplicationSchema`):
  `{ applicantStatement?, motivation?, referralCode?, personaClipAssetId?, personaClipHash?, idempotencyKey (REQUIRED, non-empty) }`.
- `GET /api/admission/applications/me` — the caller's own application (status / reasonCode / applicantNotice).
- `GET /api/admission/applications/[id]` — single own application.
- `GET /api/membership/me` — the caller's membership (for gate/landing routing).
- `POST /api/admission/persona-clip` (7a) — the recorder calls this; **it uses `resolveActor` → needs the bearer**
  (see the 7b gap below). Returns `{ assetId, upload: { url, method:'PUT', headers } }`.

**`current_user_role` RPC** (migration 0006, Task 4.5): `security definer`, `execute` granted to `authenticated` —
an authenticated **browser** session may call it to read its own role (escalation-proof, keyed to `auth.uid()`).
⇒ role is resolved client-side via the anon client's `.rpc("current_user_role")` — **no new API route needed**
(keeps the frozen BuildPlan §4.2 route surface intact).

**7b recorder bearer GAP (must fix in 8a):** `apps/web/components/admission/use-persona-clip-recorder.ts` currently
does `fetch("/api/admission/persona-clip", { credentials:"include", … })` with **no `Authorization` header**. The
route requires the bearer ⇒ mounting the recorder as-is would 401. 8a bridges this (see §1-D). (The 7b unit tests
mock fetch, so they never exercised real auth — this is why it wasn't caught.)

**BuildPlan §4.2 page paths in 8a scope (frozen surface — create exactly these):**
`app/layout.tsx` (root), `app/page.tsx` (Landing — "잠긴 문"), `app/login/page.tsx`, `app/signup/page.tsx`,
`app/gate/page.tsx` (입장 절차 허브), `app/apply/page.tsx` (신청서, mounts the recorder), `app/apply/status/page.tsx`
(내 신청 현황). **No pages exist yet** — 8a creates the root layout + these. (8b adds `/member`, `/admin/applications`,
`/admin/applications/[id]`.)

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 8a — Auth foundation + public/applicant UI. Implement ONLY this slice. Do NOT touch packages/core,
services, repositories, supabase/ (migrations/RLS/seed), or the existing API routes' logic. Do NOT add new API
routes. Do NOT build member/admin pages (that is 8b).

Read first (confirm contracts, don't trust this prompt's paraphrase):
 apps/web/app/api/_lib/auth.ts (bearer + current_user_role), _lib/env.ts, _lib/schemas.ts (submit body),
 packages/adapters/src/supabase/clients.ts (factories), apps/web/app/api/admission/applications/route.ts +
 .../me/route.ts + api/membership/me/route.ts (response shapes), apps/web/components/admission/
 use-persona-clip-recorder.ts + persona-clip-recorder.tsx (the recorder you will mount + bearer-bridge).

A) packages/adapters/src/supabase/clients.ts — add ONE factory + export it (the only adapters change):
   createBrowserSupabaseClient({ url, anonKey }): createClient(url, anonKey, { auth: { persistSession: true,
   autoRefreshToken: true } }). ANON KEY ONLY (mirrors createAnonSupabaseClient; never the service-role key).
   Export from packages/adapters/src/index.ts.

B) Browser auth foundation — put these in apps/web/lib/ (NOT in apps/web/components/, so the audit's
   "no direct supabase client in components" grep stays clean; this is app infrastructure, not a feature component):
   - A 'use client' AuthProvider/context (React context) that:
       * creates exactly ONE browser client via createBrowserSupabaseClient(NEXT_PUBLIC_SUPABASE_URL,
         NEXT_PUBLIC_SUPABASE_ANON_KEY);
       * exposes: session, accessToken, role, loading, signUp(email,password), signIn(email,password)
         [signInWithPassword], signOut();
       * resolves role AFTER sign-in by calling client.rpc("current_user_role") (default "applicant" if null/err) —
         this is the ONLY non-auth call the browser client makes;
       * exposes authedFetch(input, init?) that sets headers.Authorization = `Bearer ${accessToken}` and
         headers["content-type"] ??= "application/json"; if there is no session it does NOT call the route — it
         signals unauthenticated (caller redirects to /login).
   - The browser client is used for auth + current_user_role ONLY. NEVER client.from(...) / client.storage /
     any table or storage call. ALL data goes through authedFetch -> the API routes.
   - NEVER read or reference SUPABASE_SERVICE_ROLE_KEY (or createServiceRoleSupabaseClient) anywhere in client code.

C) Pages (BuildPlan §4.2 paths; minimal but functional, plain React + the AuthProvider; no UI lib needed):
   - app/layout.tsx: root layout wrapping <AuthProvider>.
   - app/page.tsx (Landing, "잠긴 문"): public; links to /login, /signup, /gate. If signed in, a link onward to /gate.
   - app/login/page.tsx: email+password -> signIn; on success route by state — fetch current role + me endpoints and
     send: member -> /member, reviewer|admin -> /admin/applications, else (applicant) -> /gate. (/member + /admin are
     built in 8b; routing there is fine — they 404/stub until 8b. Do NOT build them here.)
   - app/signup/page.tsx: email+password -> signUp. Do NOT set role client-side (profiles.role defaults server-side).
     After signup, route to /gate (or show "check email" if confirmation is on — read the project's auth settings;
     for local dev sign-in is immediate).
   - app/gate/page.tsx (입장 절차 허브): authedFetch GET /api/admission/applications/me and /api/membership/me; show
     the applicant's current state and the next step: no application -> link /apply; has application -> link
     /apply/status; active member -> link /member. Explain the admission steps briefly.
   - app/apply/page.tsx (신청서): a form with applicantStatement / motivation / referralCode (all optional text).
     Mount <PersonaClipRecorder onComplete={...} onSkip={...} authedFetch={authedFetch} /> (pass the auth context's
     authedFetch — see D). Keep the recorder result {assetId, contentHash} in state if onComplete fired; clear/none
     if onSkip. On submit: generate idempotencyKey = crypto.randomUUID(); authedFetch POST /api/admission/applications
     with { applicantStatement?, motivation?, referralCode?, idempotencyKey, AND personaClipAssetId/personaClipHash
     ONLY if the recorder completed } — if skipped, OMIT the clip fields and STILL submit (PC-01). Surface route errors
     by status (422 validation, 403 forbidden, 409 conflict/duplicate, 401 -> /login, 502 dependency). On success ->
     /apply/status.
   - app/apply/status/page.tsx: authedFetch GET /api/admission/applications/me; render status (draft|submitted|
     under_review|needs_more_info|approved|rejected|withdrawn|expired) + reasonCode/applicantNotice when present.
     If 401 -> /login; if no application -> link /apply.

D) Recorder bearer bridge (fix the 7b gap in apps/web/components/admission/use-persona-clip-recorder.ts +
   persona-clip-recorder.tsx):
   - Add an OPTIONAL option authedFetch to usePersonaClipRecorder({ onComplete, onSkip, authedFetch }) and use it
     for the POST /api/admission/persona-clip (so the bearer is attached). Default authedFetch = globalThis.fetch so
     the existing 6 hook tests keep passing unchanged. The upload PUT to upload.url stays plain fetch (it carries the
     storage contract headers, no bearer). Thread authedFetch through PersonaClipRecorder's props.
   - Keep all 6 existing recorder hook tests GREEN. Add ONE test: when an authedFetch is injected, the POST to
     /api/admission/persona-clip is made via it AND carries Authorization: Bearer <token> (the upload-before-onComplete
     ordering and all other behavior unchanged).

FORBIDDEN (violation = redo):
 - SUPABASE_SERVICE_ROLE_KEY / createServiceRoleSupabaseClient referenced in ANY client component or the client
   bundle; NEXT_PUBLIC_-prefixing the service-role key;
 - the browser supabase client calling .from() / .storage() / any table/storage data op (auth + current_user_role
   ONLY); any data fetch that bypasses authedFetch -> the API routes (HARD RULE 1);
 - a literal createClient(...) inside apps/web/components (use the adapters factory from apps/web/lib);
 - treating client-side role as a security boundary (UX only — routes enforce); writing profiles.role from client;
 - making absence-of-clip block submit (PC-01); adding a file-upload/preview/retake/edit to the recorder (INV-PC-02/04);
 - adding new API routes (resolve role via current_user_role; keep the frozen §4.2 route surface);
 - editing packages/core, services, repositories, supabase/ (migrations/RLS/seed); building /member or /admin pages (8b).

GATE (UI — deterministic unit tests + a source/bundle grep + a manual-QA checklist; no new live-DB gate):
 - Unit tests (vitest jsdom; mock the browser client + fetch):
     * AuthProvider: signIn sets session + resolves role via current_user_role; authedFetch attaches
       Authorization: Bearer; signOut clears session; no-session authedFetch does not call the route.
     * apply page: submit body includes idempotencyKey + (personaClipAssetId/Hash when the recorder completed);
       OMITS the clip fields and STILL submits when skipped (PC-01); maps 401->login, 422/403/409 to messages.
     * recorder bearer bridge: injected authedFetch is used for the route POST and carries the bearer; the 6
       existing hook tests remain green.
 - Source/bundle grep gate (THE make-or-break — report each):
     * rg "SUPABASE_SERVICE_ROLE_KEY|service_role|createServiceRoleSupabaseClient" apps/web (excluding app/api/**
       server code) => 0 in client components/lib;
     * after pnpm -F web build: grep .next/static for the service-role key NAME and VALUE => 0 (it must never be
       inlined into the client bundle);
     * rg "createClient\(" apps/web/components => 0 (adapters factory only);
     * no client.from(/.storage in apps/web client code.
 - Manual-QA checklist file: signup -> login -> gate -> apply (record a clip; also: deny camera -> unavailable ->
   continue; skip -> submits with no clip) -> status shows submitted; service-role never visible in
   devtools/network; reviewer/member accounts route toward /admin//member (stub until 8b).
 - Existing gates UNCHANGED: pnpm -F web test green (incl. recorder), pnpm -r typecheck clean, pnpm -r build ok,
   bash scripts/audit.sh PASS (component checks still OK), supabase test db 49, web test:integration green,
   adapters/core tests green.

ACCEPTANCE (report each verbatim):
 - all GATE commands above;
 - git status --short shows ONLY: apps/web/app/** (new pages + layout), apps/web/lib/** (auth foundation),
   apps/web/components/admission/** (recorder bearer-bridge + its test), packages/adapters/src/supabase/clients.ts +
   packages/adapters/src/index.ts, and minimal vitest/dep wiring if needed;
 - git diff --stat packages/core/src supabase apps/web/app/api  => EMPTY (no core/migration/RLS/route-logic changes;
   the persona-clip route itself is untouched — only the recorder client is bridged).
STOP and report. Do not self-approve — Opus audit session finals, JT commits.
```

---

## 2. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add Task 8a auth+applicant UI builder prompt`.
2. Paste §1 into the **Codex** builder. Codex builds A–D + tests + QA checklist, STOPS.
3. **Opus audit session audits/finals** (builder ≠ approver): re-derive from git; the make-or-break greps
   (service-role absent from client + built bundle; browser client auth-only, no `.from`/`.storage`; createClient not
   in components); bearer attached on every route call; PC-01 (skip still submits); recorder bridge carries the
   bearer + 6 old tests green; role is UX-only not a boundary; scope (no core/route/migration edits); audit.sh.
4. On PASS, JT commits: `feat(web): Task 8a auth foundation + applicant UI` → `docs: record Task 8a audit pass`.
   Then **Task 8b** (member + admin/reviewer pages).

## 3. Out of scope (explicit)
- `/member`, `/admin/applications`, `/admin/applications/[id]` and the approve/reject/request-more-info UI +
  reviewer clip playback = **8b**. New API routes (none — role via `current_user_role`). The outbox/byte-delete
  workers = **Task 9**. Real-camera QA = manual (8a mounts the recorder; the checklist covers it). No upload
  fallback / preview / retake / edit (INV-PC-02/04).

## 4. Decisions / notes (Cowork)
- **Builder = Codex** per the §8 amendment (2026-06-05) — standing rule, not a §6 exception.
- **Browser auth client** = `createBrowserSupabaseClient` (anon key, `persistSession:true`/`autoRefreshToken:true`)
  added to adapters (adapters owns the client topology → apps never calls `createClient` directly → audit-clean).
  Session persisted by supabase-js (localStorage) — the standard browser tradeoff for an MVP; acceptable.
- **Role resolution = `current_user_role` RPC from the authed browser client** (the same trusted source the routes
  use) → **no new API route**, so the frozen BuildPlan §4.2 route surface is preserved. The RPC call lives ONLY in
  the AuthProvider, not scattered in feature components.
- **Recorder bearer bridge is required** because the routes authenticate by bearer and the 7b hook only sent
  `credentials:'include'`. Making `authedFetch` an injected option (default = global fetch) fixes auth without
  breaking the 7b tests.
- **The security weight of 8a is the client boundary** (no service-role leak, anon-only, auth-only client, bearer
  wiring) — audited at full depth even though the page markup is surface. This is the "mixed" reality of the UI
  layer; all of it is Codex-built now.
