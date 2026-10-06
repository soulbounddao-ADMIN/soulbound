# Task 6b — admin/reviewer API routes — spec + Codex builder prompt (Cowork-authored)

> Second slice of Task 6. **6b = the reviewer/admin API routes**: the review queue + per-application detail
> (reads) and the four state transitions (review / approve / reject / request-more-info). Reuses the `apps/web`
> scaffold + helpers from 6a. Gate = route-handler integration tests (same approach JT chose for 6a),
> **deterministic** (bounded fixture-auth retry, 5×+reset — the 6a lesson).
>
> **⚠️ Correction to an earlier Cowork note:** 6b does **NOT** add reviewer/admin RLS read policies and does **NOT**
> touch `supabase/`. Per BuildPlan §5.3.2, reviewer/admin reads go through a **service-role route gated by role**,
> and RLS keeps "타인 신청서 read 차단 (INV-12)". So the route's role gate is the security boundary, not RLS.
>
> **Workflow (risk-tiered, `docs/WORKFLOW.md`):** route↔service boundary / 3-client / authz = security layer →
> **Codex builds**, **Opus audit session audits** (separate), **JT commits**. Builder does not self-approve.

---

## 0. Grounded contract (verified from the working tree at HEAD `bfb95de` — NOT memory)

- **Reviewer reads use the service-role repo, gated by the route's role check** (BuildPlan §5.3.2 + milestone
  "검토 큐/상세, approve/reject/needs_more_info(service role route)"). RLS on `admission_applications` has ONLY
  applicant-own policies (`0003_rls.sql`) — a reviewer's *user-scoped* read returns nothing, and "타인 신청서
  read 차단 (INV-12)". So reviewer reads MUST go through a **service-role** admission repo, and **the route's
  role gate is the ONLY thing protecting that read** (service-role bypasses RLS). ⇒ an applicant hitting an admin
  read route MUST get **403**, or they would read everyone's data + `review_summary`. **This role gate is the
  make-or-break security control of 6b.**
- **review_summary boundary (verified in the adapter):** `serviceRoleApplicationSelect` INCLUDES `review_summary`
  (`supabase-admission-repository.ts:58`); `userScopedApplicationSelect` excludes it. So reviewer detail (via the
  service-role repo) returns `review_summary` (the internal note — correct), while the applicant's own-detail
  route (6a, user-scoped safe select) never does, and the applicant can't reach the admin route (403). The gate
  must prove BOTH directions.
- **Frozen `AdmissionService` = writes only.** The 4 transitions are `startReview` / `approveApplication` /
  `rejectApplication` / `requestMoreInfo` (commands carry `actor`, `applicationId`, `reasonCode`(decisions),
  `applicantNotice?`, `reviewSummary?`, `idempotencyKey`). Each re-checks `canReview(actor.role)` internally
  (INV-11) → FORBIDDEN. The reviewer **reads** (queue/detail) have NO service method → use the service-role repo
  directly: `AdmissionRepository.listReviewQueue({status?, limit, cursor?})` and `findById(id)`.
- **Reuse 6a (`apps/web/app/api/_lib`):** `resolveActor` (Bearer → `getUser` verify + `current_user_role`),
  `getContainer()` (service-role services, for the writes), `toHttp`/`resultToResponse`/`unauthorized`/`notFound`
  (status map 422/403/404/409/409/502 +401), and the integration test's **bounded fixture-auth retry** helper +
  per-run throwaway-applicant pattern. The seeded `reviewer@soulbound.local` can now sign in (Task 5.5).
- **3-client / INV-17:** service-role client (server-only env `SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_*`)
  backs both the container (writes) and the reviewer-read repo; the user client only resolves the actor.

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 6b — admin/reviewer API routes (security layer). Implement ONLY this; do NOT touch supabase/ (no RLS
policy / no migration — reviewer reads go through service-role routes gated by role), and do NOT build Task 7
persona-clip, Task 9 outbox, or Task 8 UI.

Reuse the 6a apps/web scaffold + _lib helpers (resolveActor, getContainer, toHttp/http, the integration-test
bounded auth-retry + throwaway-applicant pattern). Read them + packages/core admission types +
packages/adapters supabase-admission-repository (serviceRoleApplicationSelect includes review_summary;
listReviewQueue/findById) first — do not guess.

A) Helpers (apps/web/app/api/_lib):
   - requireReviewer(actor): returns a 403 Response if actor.role is not 'reviewer' or 'admin'; else null. (The
     ONLY guard for the reviewer READ routes, since they use the RLS-bypassing service-role repo.)
   - serviceRoleAdmissionRepo(): makeServiceRoleAdmissionRepository(createServiceRoleSupabaseClient(env)) — the
     reviewer read repo (review_summary-inclusive select). Server-only; never a NEXT_PUBLIC_ key (INV-17).
   - zod: reviewDecisionSchema { reasonCode: <AdmissionReasonCode enum>, applicantNotice?, reviewSummary?,
     idempotencyKey } ; reviewQueueQuerySchema { status?: <AdmissionStatus enum>, limit (bounded default+max),
     cursor? }. reasonCode/status must be the FROZEN enums (read core types).

B) Routes (every route: resolveActor → 401 if null → requireReviewer → 403 if not reviewer/admin → then act;
   actor/id come from the resolved actor + the URL, NEVER from the body):
   - GET  api/admin/applications            -> validate query; serviceRoleAdmissionRepo().listReviewQueue(query); 200 list.
   - GET  api/admin/applications/[id]        -> serviceRoleAdmissionRepo().findById(id); 404 if null; 200 (includes review_summary).
   - POST api/admin/applications/[id]/review            -> getContainer().admissionService.startReview({actor, applicationId, idempotencyKey}); toHttp.
   - POST api/admin/applications/[id]/approve           -> approveApplication({actor, applicationId, reasonCode, applicantNotice?, reviewSummary?, idempotencyKey}); toHttp (200 on Ok).
   - POST api/admin/applications/[id]/reject            -> rejectApplication({...}); toHttp.
   - POST api/admin/applications/[id]/request-more-info -> requestMoreInfo({...}); toHttp.
   (Writes are double-gated: requireReviewer at the route AND canReview inside the service. Reads are gated ONLY
   at the route — that gate is security-critical.)

C) Gate — route-handler integration tests (live Supabase, NO HTTP server), DETERMINISTIC, in the existing
   apps/web integration config; reuse the 6a bounded auth-retry + per-run throwaway applicant; sign in the SEEDED
   reviewer@soulbound.local (retry-wrapped). Prove:
   - reviewer lists the queue (GET admin/applications) and the just-submitted throwaway app appears;
   - reviewer detail (GET admin/applications/[id]) is 200 AND the response includes review_summary; after an
     approve/reject carrying reviewSummary='internal note', the reviewer detail shows that note;
   - BOUNDARY BOTH WAYS: the SAME application read via the applicant's OWN 6a route (GET admission/applications/[id])
     does NOT include review_summary; via the reviewer admin route it DOES;
   - transitions: review->under_review, approve->approved (+ membership active), reject->rejected,
     request_more_info->needs_more_info (use a SEPARATE throwaway applicant per terminal/branch to avoid
     one-active-application/membership collisions);
   - SECURITY NEGATIVES (the crux): an APPLICANT session gets 403 on GET admin/applications, GET
     admin/applications/[id], and POST .../approve (role gate must bite on reads AND writes);
   - 401 for missing/invalid session on an admin route; invalid reasonCode -> 422.
   - Env missing -> throw (fail loud, never skip). Must pass 5x consecutively AND immediately after `supabase db reset`.

FORBIDDEN (violation = redo):
 - editing packages/core/src/**, packages/adapters/src/**, or supabase/** (NO RLS policy, NO migration — reviewer
   reads are service-role-route + role-gate, per BuildPlan §5.3.2);
 - a reviewer READ route without requireReviewer (that gate is the only thing protecting RLS-bypassing reads);
 - business logic / state guard in a route (transitions go through the service; reads through the repo); trusting
   a body-supplied actor/role/applicantId; exposing SUPABASE_SERVICE_ROLE_KEY as NEXT_PUBLIC_*;
 - leaking review_summary to the applicant path; weakening assertions; skip/todo/only; silent skip;
 - Task 7 persona-clip(-url), Task 9 outbox, Task 8 UI.

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` -> 49 pgTAP green (unchanged);
 - `supabase start`, then apps/web `test:integration` -> all 6b cases green; run it 5x consecutively + once
   immediately after `supabase db reset` -> all green (determinism, the 6a bar);
 - apps/web `test` (unit) green stack-free; `pnpm -F @soulbound/adapters test` 14; `@soulbound/core test` 19; `pnpm -r typecheck`; `pnpm -r build`;
 - `bash scripts/audit.sh` PASS with apps/web/.next present;
 - `git status --short` shows ONLY new/modified apps/web/** files;
 - `git diff --stat packages/core/src packages/adapters/src supabase` empty.
STOP and report. Do not self-approve — the Opus audit session audits (separate), JT commits.
```

---

## 2. Dispatch + commit (JT, host)

1. Commit this prompt doc: `docs: add Task 6b admin-routes builder prompt`.
2. Paste §1 into Codex. Codex builds the helpers + 6 routes + tests, runs the gates (incl. 5×+reset), STOPS.
3. Opus audit session (separate) audits, focus: **every reviewer READ route has requireReviewer** (an applicant
   → 403 on GET queue/detail — the make-or-break control); reviewer reads use the service-role repo, writes go
   through the service (which re-checks canReview); review_summary reaches the reviewer route but NOT the
   applicant route (boundary proven both ways); actor/id never from the body; service-role key server-only; no
   supabase/ or core/adapters changes; the integration test is deterministic (verify 5×+reset on the host, not a
   single green — the 6a lesson) and fail-loud; no skip/todo. Re-derive from git, re-run audit.sh.
4. On PASS, JT commits: `feat(web): Task 6b admin/reviewer API routes` → then `docs: record Task 6b audit pass`
   + PROJECT_STATE update. Task 6 (API routes) complete after 6b.
5. Then Task 7 (Persona Clip route + recorder) — the persona-clip + persona-clip-url routes + recorder UI.

## 3. Out of scope (explicit — do NOT build here)
- Any `supabase/` change (RLS reviewer policy / migration) — reviewer reads are service-role-route + role-gate.
- persona-clip + persona-clip-url routes = **Task 7**; outbox/process = **Task 9**; all UI pages = **Task 8**.
- `[id]/submit` (no P0 draft path, established in 6a).
