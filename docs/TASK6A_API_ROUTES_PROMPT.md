# Task 6a — apps/web scaffold + auth resolution + applicant API routes — spec + Codex builder prompt

> First slice of Task 6 (JT chose the 6a/6b split). **6a = the `apps/web` Next.js scaffold + server-side request
> auth (session → Actor) + the 3-client boundary + the APPLICANT-facing API routes.** Admin/reviewer routes are
> 6b. Gate = **route-handler integration tests** (JT's choice): invoke the handlers as functions with a REAL
> signed-in applicant session against live Supabase — no live HTTP server (the service→DB path is already proven
> in Task 5).
>
> **Workflow (risk-tiered, `docs/WORKFLOW.md`):** route↔service boundary / 3-client / auth = security layer →
> **Codex builds**, **Opus audit session audits** (separate), **JT commits**. Builder does not self-approve.

---

## 0. Grounded contract (verified from the working tree at HEAD `07a2b11` — NOT memory)

- **Workspace already globs `apps/*`** (`pnpm-workspace.yaml`). Framework = **Next.js 16 App Router, TS strict**
  (BuildPlan §4.1). `apps/web` does not exist yet — 6a creates it. Do NOT touch frozen 0C files (root
  `tsconfig.base.json`, `pnpm-workspace.yaml`, `packages/core|adapters` configs); `apps/web` gets its OWN
  `package.json`/`tsconfig`/vitest configs consistent with the workspace.
- **Route surface for 6a** (BuildPlan §4.2 folder diagram, minus 6b/Task7/Task9):
  `POST api/admission/applications`, `GET api/admission/applications/me`, `GET api/admission/applications/[id]`,
  `GET api/membership/me`. (Admin review/approve/reject/request-more-info + queue list = **6b**.
  persona-clip + persona-clip-url = **Task 7**. outbox/process = **Task 9**. UI pages = **Task 8**.)
- **No client-side draft in P0** — `submit_application_tx` inserts `status='submitted'` directly; the frozen
  `SubmitApplicationCommand` has NO `applicationId` (it CREATES, not updates); `0003_rls.sql` gives `authenticated`
  **no INSERT** on `admission_applications`. ⇒ `POST api/admission/applications` = `admissionService.submitApplication`
  (create-as-submitted). The folder diagram's `[id]/submit` route has **no backing RPC/service method in P0 →
  OUT OF SCOPE** (the `draft` enum exists only for future draft-editing + the clip-24h cleanup).
- **Frozen `AdmissionService` has WRITE/transition methods only** (`submitApplication`/`startReview`/approve/
  reject/requestMoreInfo) — **no read methods**. So the applicant READS go through the **user-scoped repo**
  (`makeUserScopedAdmissionRepository`, RLS own-only), NOT the service; writes go through the service. INV-09
  (no `supabase.from(...).insert/.update` in routes) is about WRITES — RLS-scoped reads via the repo are fine.
- **3-client boundary** (BuildPlan §5.3.1, INV-17): browser=anon, **server user client** (request's JWT) for the
  user's own RLS reads + AuthPort role resolution, **service-role client** (server-only) for the container's
  privileged writes. The service-role key is **NEVER** `NEXT_PUBLIC_*` and never reaches the client.
- **Building blocks already shipped**: `@soulbound/adapters` exports `createUserSupabaseClient({url,anonKey,
  accessToken})`, `createAnonSupabaseClient`, `makeSupabaseAuthAdapter(client)` (resolves role via
  `current_user_role()`), `makeUserScopedAdmissionRepository(client)`, and `makeCoreContainer({url,serviceRoleKey})`
  (Task 5, service-role services). `@soulbound/core` exports `AuthSession`, `Actor`, the `AppError` model, and
  `SubmitApplicationCommand`. The membership read is a service method: `container.membershipService.getMyMembership(userId)`.
- **Error model → HTTP** (PROJECT_STATE §3.4 / `core` errors): `VALIDATION→422`, `FORBIDDEN→403`,
  `NOT_FOUND→404`, `INVALID_STATE_TRANSITION→409`, `CONFLICT→409`, `DEPENDENCY_FAILURE→502`. No/invalid session →
  `401`. Read the real `AppError` code strings from `@soulbound/core` — do not guess.

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 6a — apps/web scaffold + auth + applicant API routes (security layer). Implement ONLY this; do NOT
build admin/reviewer routes (6b), persona-clip (Task 7), outbox (Task 9), or any UI page (Task 8).

Read first (do not guess): pnpm-workspace.yaml, tsconfig.base.json, packages/adapters/src/index.ts (+clients,
supabase-auth-adapter, supabase-admission-repository, container), packages/core/src/ports/auth-port.ts,
domain/admission/types.ts, application/errors.ts. Build apps/web as a Next.js 16 (App Router, TS strict) workspace
package, with its OWN package.json/tsconfig/vitest configs — do NOT edit the frozen 0C root configs or
packages/core|adapters.

A) Shared server helpers (apps/web, e.g. app/api/_lib or src/server):
   - env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (public), SUPABASE_SERVICE_ROLE_KEY
     (SERVER-ONLY — never NEXT_PUBLIC_, never sent to the client; INV-17). Fail loud if a required one is missing.
   - resolveActor(request): read the caller's Supabase session (access token) from the request, build a
     USER-SCOPED client (createUserSupabaseClient with that token), resolve AuthSession via
     makeSupabaseAuthAdapter(...).getSession() (role comes from current_user_role()), and return Actor {id, role}
     or null. DESIGN THIS SO IT IS INVOKABLE IN A ROUTE-HANDLER TEST with a real token (e.g. accept a Bearer
     Authorization header), not only via ambient cookies — the gate (C) depends on it.
   - getContainer(): makeCoreContainer({ url: NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY }).
   - userScopedAdmissionRepo(request): makeUserScopedAdmissionRepository(<user client from the request session>).
   - toHttp(result): map Ok→200 (POST create→201) with a JSON body; map AppError by code:
     VALIDATION→422, FORBIDDEN→403, NOT_FOUND→404, INVALID_STATE_TRANSITION→409, CONFLICT→409,
     DEPENDENCY_FAILURE→502. No session → 401. NEVER leak review_summary or service-role internals in any body.
   - zod schemas for request bodies.

B) Applicant routes (call the SERVICE for the write; the user-scoped REPO for own reads):
   - POST api/admission/applications: 401 if no actor; zod-validate body
     {applicantStatement?, motivation?, referralCode?, personaClipAssetId?, personaClipHash?, idempotencyKey};
     applicantId = actor.id (NEVER from the body — do not let a caller submit as someone else); call
     container.admissionService.submitApplication(cmd); toHttp (201 on Ok). (This is create-as-submitted; there is
     NO draft step and NO [id]/submit route in P0.)
   - GET api/admission/applications/me: 401 if no actor; return
     userScopedAdmissionRepo(req).findActiveByApplicantId(actor.id) (RLS own-only); 200 with the application or null.
   - GET api/admission/applications/[id]: 401 if no actor; userScopedAdmissionRepo(req).findById(id); RLS returns
     only the caller's own row → if null, 404 (do not reveal others' existence). 200 with the application.
   - GET api/membership/me: 401 if no actor; container.membershipService.getMyMembership(actor.id); toHttp.

C) Gate — route-handler integration tests (live Supabase, NO HTTP server), kept SEPARATE from unit tests so the
   default `pnpm test` stays stack-free (mirror the adapters split: a test:integration script + config; the
   integration glob excluded from the default config):
   - Reuse the Task-5 pattern: create a per-run THROWAWAY applicant via the service-role admin API (+ a profiles
     row), so the mutating POST is re-runnable (no one-active-application collision). Sign in (anon) to get the
     access token; construct the Request the resolver accepts (Bearer token) and INVOKE the route handler function.
   - Prove: POST applications (throwaway applicant) → 201 + status 'submitted'; GET me → that application; GET [id]
     own → 200; GET [id] of ANOTHER applicant's application → 404 (RLS); GET membership/me → 200 (null before approval);
     a request with NO/invalid session → 401; submitting with applicantId in the body must NOT override actor.id.
   - resolveActor + toHttp + zod are also covered by fast unit tests (mocked) under the default config.
   - Env missing → throw (fail loud, never silently skip).

FORBIDDEN (violation = redo):
 - editing packages/core/src/**, packages/adapters/src/**, supabase/**, or the frozen 0C root configs;
 - any business logic / role decision / state guard in a route (those live in the service — the route only
   resolves the actor, validates input, calls service/repo, maps Result→HTTP);
 - any `supabase.from(...).insert(/.update(` or raw SQL in a route (INV-09); writes go through the service only;
 - exposing SUPABASE_SERVICE_ROLE_KEY as NEXT_PUBLIC_* or to any client bundle (INV-17); trusting a body-supplied
   applicantId/role instead of the resolved actor;
 - building the [id]/submit route (no P0 draft path), admin/reviewer routes (6b), persona-clip (7), outbox (9), or UI (8);
 - making the integration test silently skip when the stack/env is absent (fail loud).

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` -> 49 pgTAP green (unchanged);
 - `supabase start` up, then apps/web `test:integration` -> applicant routes + 401 + RLS-404 + actor-not-body all green (run twice = re-runnable);
 - apps/web default `test` (unit: resolveActor/toHttp/zod) green WITHOUT the stack; `pnpm -F @soulbound/adapters test` 14 + `@soulbound/core test` 19 unchanged;
 - `pnpm -r typecheck` clean; `pnpm -r build` (or apps/web build) ok; `bash scripts/audit.sh` PASS (note: the audit's
   apps/web SKIPs should now actually run — keep them green: no supabase.storage in apps, no direct supabase client
   in components, no chat/messages routes);
 - `git status --short` shows ONLY new apps/web/** files (+ if strictly required, a minimal pnpm-lock update);
 - `git diff --stat packages/core/src packages/adapters/src supabase` empty.
STOP and report. Do not self-approve — the Opus audit session audits (separate), JT commits.
```

---

## 2. Dispatch + commit (JT, host)

1. Commit this prompt doc: `docs: add Task 6a applicant-routes builder prompt`.
2. Paste §1 into Codex. Codex scaffolds apps/web, builds the helpers + applicant routes + tests, runs the gates, STOPS.
3. Opus audit session (separate) audits: service-role key is server-only (no NEXT_PUBLIC_, not in any client bundle);
   the 3-client split is correct (user client for reads/auth, service-role only via the container for the write);
   routes carry NO business logic / no role decision / no direct DB mutation (INV-09); applicantId comes from the
   resolved actor, never the body; reads are RLS-scoped (the [id]-of-another → 404 case is real); Result→HTTP map is
   correct and leaks nothing (no review_summary); the integration test runs handlers with a REAL session and is
   re-runnable + fail-loud; unit `test` stays stack-free; core/adapters/supabase untouched. Re-derive from git,
   re-run audit.sh, do not rubber-stamp the green runs.
4. On PASS, JT commits: `feat(web): Task 6a apps/web scaffold + applicant API routes` → then `docs: record Task 6a
   audit pass` + PROJECT_STATE update.
5. Then Task 6b (admin/reviewer routes): queue list (service-role + role gate) + review/approve/reject/
   request-more-info (service); reviewer/admin RLS read policies (using current_user_role()) land there as needed.

## 3. Out of scope (explicit — do NOT build here)
- Admin/reviewer routes + review-queue list + reviewer/admin RLS read policies = **6b**.
- `[id]/submit` route (no P0 draft-creation path), persona-clip + persona-clip-url routes = **Task 7**,
  outbox/process = **Task 9**, all UI pages/components = **Task 8**.
- `handle_new_user` trigger / profiles auto-creation on signup — separate; the gate creates profiles for its
  throwaway applicant explicitly.
