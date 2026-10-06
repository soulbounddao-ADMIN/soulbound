# Task 6b — admin/reviewer API routes — Audit Findings (final auditor record)

> Builder: **Codex** (route↔service boundary / 3-client / authz = security layer). Final auditor: **Opus audit
> session** (separate). Verdict: **PASS.** Commit by **JT** (host). Builder ≠ final approver preserved (WORKFLOW §2).
> Spec: `docs/TASK6B_ADMIN_ROUTES_PROMPT.md`. Gate = route-handler integration tests (JT's choice). Completes Task 6.

6b = the reviewer/admin routes: review queue + per-application detail (reads) and the four transitions
(review/approve/reject/request-more-info). Reuses the 6a `apps/web` scaffold + helpers. **No `supabase/` change**
(reviewer reads go through a service-role route gated by role, per BuildPlan §5.3.2 — NOT a new RLS policy).

## Audit method (re-derived from the working tree — not a rubber stamp)

Read the helpers (`admin.ts`) + all 6 routes + schemas + the integration test; grepped for the role gate on every
reviewer read; confirmed scope + core/adapters/supabase untouched + audit.sh; analyzed the host determinism runs
(distinguishing a stack-infra failure from a test flake). Live runs are host-only; corroborated statically.

## Verified (each point independently re-derived)

- **① The make-or-break control: every reviewer READ route gates on role.** `GET /api/admin/applications` and
  `GET /api/admin/applications/[id]` both do `resolveActor → 401` then `requireReviewer → 403` **before** calling
  the RLS-bypassing service-role repo. `requireReviewer` allows only `reviewer`/`admin`, else 403. Since service-role
  bypasses RLS, this route gate is the ONLY thing protecting these reads — and the test proves an applicant gets 403
  on both (and on a write). Without it an applicant could read every application + `review_summary`.
- **② review_summary boundary proven BOTH ways (same application).** `serviceRoleApplicationSelect` includes
  `review_summary` (reviewer detail returns it); the applicant's own-detail route (6a, `userScopedApplicationSelect`)
  does not. The test sets `reviewSummary` via approve, then asserts the reviewer admin-detail shows it AND the
  applicant's own 6a route `not.toHaveProperty("reviewSummary")`.
- **③ reads via service-role repo, writes via the service.** The 4 transition routes call
  `getContainer().admissionService.{startReview,approveApplication,rejectApplication,requestMoreInfo}` (each
  re-checks `canReview` internally — INV-11). Routes carry no business logic / no direct DB mutation (INV-09).
- **④ actor/id from trusted sources.** `actor` from `resolveActor` (GoTrue `getUser`-verified + `current_user_role`);
  `applicationId` from the URL param. Never from the body. `reviewDecisionSchema`/`reviewQueueQuerySchema` bind to
  the FROZEN `AdmissionReasonCode`/`AdmissionStatus` enums via `satisfies` (compile-fails on drift); invalid
  reasonCode → 422 (proven). service-role key server-only (INV-17). 401 on missing/invalid session (proven).
- **⑤ scope clean.** Only `apps/web/**` (admin routes + `admin.ts`(+test) + `schemas.ts`(+test) +
  `admin-routes.integration.test.ts`). `git diff` of `packages/core/src`, `packages/adapters/src`, `supabase` empty.
  No `.skip/.todo/.only`. audit.sh PASS.

## Determinism — PASS (the lone failure was infra, not the test)

Host runs: **5/5 consecutive `test:integration` green**, then `supabase db reset` **failed** with
`error running container: exit 1`, and the immediately-following run failed — `signInWithPassword` /
`admin.createUser` threw `AuthApiError: Database error querying schema` / `checking email`. Analysis:
- This is a **broken-stack artifact**, not a test flake. The failure coincided exactly with the failed reset; the
  errors are GoTrue-can't-reach-its-DB (`Database error …`), distinct from 6a's transport flake
  (`AuthRetryableFetchError`). All 9 healthy-stack runs (5 before + 4 after recovery) passed.
- **The test correctly failed loud** — `Database error …` is non-retryable, so it broke immediately and threw a
  labeled error rather than masking a broken stack. That is the intended fail-loud behavior.
- After `supabase stop --no-backup && supabase start` recovered the stack: a clean `supabase db reset` →
  `supabase test db` (49) → `test:integration` **4/4 green**. So the "5× + reset-then-green" bar is satisfied on a
  healthy stack.
- **Ops note (not a code issue):** local `supabase db reset` occasionally fails with a container error on JT's
  Docker; recover via `supabase stop && supabase start`. Does not affect CI/fresh-checkout or the committed code.

## Minor (cosmetic, non-blocking — optional follow-up)

The shared integration-test retry helper throws `… failed after ${attempts} attempts` using the MAX attempts even
when it broke immediately on a **non-retryable** error (e.g. the `Database error …` above failed on attempt 1, not
4). Harmless to correctness, but the message overstates the retry count and could mislead debugging. Applies to both
`admin-routes` and `applicant-routes` integration tests. Worth a one-line fix in a future test-hygiene pass.

## Out of scope (unchanged)
- persona-clip + persona-clip-url routes = **Task 7**; outbox/process = **Task 9**; UI pages = **Task 8**.
- Reviewer/admin RLS read policies — intentionally NOT added (service-role route + route gate per BuildPlan §5.3.2).

## Runtime confirmation (host-only)
Auditor corroborated statically + analyzed the determinism runs. Builder/host-reported green: `supabase test db` 49,
`test:integration` 5/5 + 4/4 (post-recovery), unit 12, adapters 14, core 19, `typecheck`, `build`, audit.sh.
JT re-confirms on the host at commit (WORKFLOW §5).
