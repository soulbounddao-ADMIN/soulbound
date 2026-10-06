# Task 6a — apps/web scaffold + applicant API routes — Audit Findings (final auditor record)

> Builder: **Codex** (route↔service boundary / 3-client / auth = security layer). Final auditor: **Opus audit
> session** (separate). Verdict: **PASS after a corrective round** — the route integration test was initially
> flaky (non-deterministic auth fixture); stabilized and proven deterministic on the failing host (see §Correction).
> Also includes a JT-authorized minimal `audit.sh` toolchain fix surfaced by
> this task. Commit by **JT** (host). Builder ≠ final approver preserved (WORKFLOW §2). Spec:
> `docs/TASK6A_API_ROUTES_PROMPT.md`. Gate = route-handler integration tests (JT's choice).

First web tier in the project. 6a = `apps/web` scaffold + server request-auth (session → Actor) + the 3-client
boundary + the applicant-facing API routes. Admin/reviewer routes = 6b.

## Audit method (re-derived from the working tree — not a rubber stamp)

Read the server helpers (env/auth/container/admission/http/schemas), all 4 route handlers, and the integration
test; grepped for service-role-key leaks and direct-supabase usage; independently re-ran `audit.sh` (and caught
the build-artifact false-FAIL below); confirmed scope + core/adapters/supabase/frozen-0C untouched. The live
runs are host-only — corroborated statically; JT confirms green on the host.

## Verified (6a code — each point independently re-derived)

- **① service-role key server-only (INV-17).** `SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_*`) is read only in
  server `_lib`/route code; `getContainer()` (the only service-role user) is imported solely by route handlers;
  **no `use client` file exists**, and Next never inlines non-`NEXT_PUBLIC_` env into any bundle → no client leak.
  `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` are the only public vars.
- **② applicantId from the resolved actor, never the body.** `POST /applications` sets `applicantId: actor.id`;
  `optionalProps` is typed `Omit<…,"applicantId"|"idempotencyKey">` and the zod schema has no `applicantId` field
  (unknown keys stripped). The integration test ACTIVELY attacks this (submits with another user's id in the body)
  and asserts the created row's `applicantId === actor.id`.
- **③ no business logic / role decision / direct DB write in routes (INV-09).** Writes go through
  `container.admissionService.submitApplication`; applicant reads go through the **user-scoped repo**
  (`makeUserScopedAdmissionRepository`, RLS own-only); membership via `membershipService.getMyMembership`. Routes
  only: resolve actor → validate (zod) → call service/repo → map Result→HTTP.
- **④ auth is real, not decoded.** `resolveActor` validates identity with `client.auth.getUser(token)`
  (GoTrue-verified) and resolves role via `current_user_role()` (trusted table, NOT JWT claims), fail-closed to
  `applicant`. Another applicant's `[id]` → **404** (RLS own-only, no existence leak); no session **401**;
  invalid token **401** (proven in the test — a bogus token fails `getUser`).
- **⑤ gate is non-vacuous + fail-loud; determinism achieved via a corrective (§Correction).** The integration
  test invokes the actual handler functions with a REAL bearer token (live sign-in of a per-run throwaway
  applicant), exercising the real auth→service/repo→DB path; covers
  submit/me/[id]-own/[id]-other-404/membership-null/401/body-injection. Unit tests (7) cover
  resolveActor/toHttp/zod stack-free. Env missing → throws. **⚠️ This report's original "re-runnable" claim was
  premature** — the auth fixture was non-deterministic until the corrective; determinism is now proven (5/5 +
  post-reset on the failing host). See §Correction.
- **⑥ apps/web source clean** for the audit invariants: no `supabase.storage`, no direct `createClient`/
  `@supabase/supabase-js`, no chat/messages routes (verified by grep excluding build dirs). `http.ts`
  `dependencyFailure` is generic (`void error`) — no DB/internal leak; the status map is exhaustive
  (`Record<AppErrorCode, number>`: 422/403/404/409/409/502, +401).

Scope: `apps/web/**` + `pnpm-lock.yaml` (+ the `audit.sh` fix). `packages/core/src`, `packages/adapters/src`,
`supabase/**`, and the frozen 0C root configs are untouched.

## Grounded scoping decision (recorded)

**P0 has no client-side draft creation**, so `POST /api/admission/applications` = `submitApplication`
(create-as-submitted) and the BuildPlan folder diagram's `[id]/submit` route is **not implemented in P0**.
Grounds: frozen `submit_application_tx` inserts `status='submitted'` directly; `SubmitApplicationCommand` has no
`applicationId`; `0003_rls.sql` gives `authenticated` no INSERT on `admission_applications`. The `draft` enum
exists only for future draft-editing + the clip-24h cleanup. (A real draft step would require unfreezing the
contract — not done.)

## Toolchain finding (surfaced by 6a) + fix — both PASS

**`audit.sh` false-FAILed on build artifacts.** Re-running `audit.sh` after a build FAILed
("supabase.storage in apps") on `apps/web/.next/**` (gitignored Next build output bundling supabase-js) — NOT
source. Root cause: `GREP()` used `rg` when present (honors `.gitignore` → PASS) but `grep -rEn` otherwise (ignores
`.gitignore` → scans `.next` → FAIL). So the gate was non-deterministic across machines (builder had `rg`,
auditor didn't). **The 6a source is clean** (`.next` is gitignored / not committed; CI fresh-checkout passes).
**JT-authorized minimal fix** (frozen 0C, correctness not weakening): `GREP()` now excludes
`**/.next/**`, `**/dist/**`, `**/node_modules/**` on BOTH the `rg` and `grep` branches. Audited: diff is the
`GREP()` function only; `audit.sh` now PASSES with `.next` present on both `rg` and forced-`grep` paths; source
coverage intact (a known source token still matches under the new excludes; builder's probe confirmed a real
source `supabase.storage` still FAILs). Recorded as a failure mode in PROJECT_STATE §6.

## Out of scope (unchanged)
- Admin/reviewer routes + review-queue list + reviewer/admin RLS read policies = **6b**.
- `[id]/submit` (no P0 draft path), persona-clip + persona-clip-url = **Task 7**, outbox/process = **Task 9**,
  UI pages/components = **Task 8**.

## Runtime confirmation (host-only)
Auditor corroborated statically + re-ran `audit.sh` (caught the build-artifact issue) + verified the fix on the
grep fallback. Builder-reported green: `supabase test db` 49, apps/web `test:integration` (run twice),
`test` 7 unit, adapters 14, core 19, `typecheck`, `build`. The live runs are host-only; **JT re-confirms on the
host at commit** (WORKFLOW §5) — including `audit.sh` on a tree where `apps/web/.next` exists.

## Correction — integration test was flaky; initial PASS was premature

**What happened.** This report's first version recorded a clean PASS and called the integration test
"re-runnable," based on the builder's "ran twice" report + one host pass. On JT's host the test then failed
**repeatedly** (`AuthRetryableFetchError`) on re-runs and after `db reset`, while the **second** assertion (401)
stayed green — so the route logic was sound but the **auth fixture** (`admin.createUser` / `signInWithPassword`)
was non-deterministic. The builder's own environment never reproduced the failure, so its green was not proof.
**Auditor error (recorded in PROJECT_STATE §6):** a host-only runtime gate's whole value is *reliable* proof — a
pass once/twice is not determinism. Task 6a was put on **HOLD**.

**Corrective (commit `4fa4755`, Codex-built, Opus-audited).** A bounded retry helper
(`retryAuthFixtureOperation`, 4 attempts, linear backoff, labeled re-throw) wraps **only** the fixture's
retryable Supabase Auth transport calls (`admin.createUser`, `signInWithPassword`); a `retryable-only` filter
(`AuthRetryableFetchError` / "fetch failed") means a genuine auth failure fails fast (no masking). **No route
handler call and no security assertion is retried** — those stay deterministic. All 7 assertions unchanged
(incl. body-`applicantId`-cannot-override-actor and other's-`[id]`→404). `deleteUser` cleanup was correctly
**not** added (it hits `admission_events_actor_id_fkey` 23503 after the mutating flow); collision-safety stays via
unique-per-run users. `apps/web/tsconfig.tsbuildinfo` (accidentally committed) removed from tracking +
`*.tsbuildinfo` gitignored.

**Determinism proof (the bar that cleared HOLD).** On the host that exhibited the failure: `test:integration`
**5/5 consecutive green**, then `supabase db reset` + `supabase test db` (49) + `test:integration` green again.
Static re-audit: retry is fixture-only, filtered, bounded, re-throws with a labeled error; committed test
(`4fa4755`) matches the audited patch (no drift). **Verdict: Task 6a PASS.**

