# Task 5 — Service Wiring / Composition Root — spec + Codex builder prompt (Cowork-authored)

> Build the CONCRETE composition root that instantiates the frozen core services with the real Supabase +
> Noop adapters, returning a `CoreContainer`. **Acceptance gate is option (b) (JT, this round):** not merely
> "a container file exists," but a committed integration test that proves the full reviewer path end-to-end —
> **real reviewer sign-in → `current_user_role()` → `AuthSession.role = reviewer` → `canReview` passes →
> service-role `approveApplicationTx` RPC → approve succeeds** — through the actual TS service + adapter +
> auth layers against a live local Supabase. Routes/UI are Task 6/8; the reviewer path here is proven at the
> **service + adapters** layer, exactly as a Task-6 route would compose it, minus HTTP.
>
> **Workflow (risk-tiered, `docs/WORKFLOW.md`):** service wiring / auth / 3-client boundary = security layer →
> **Codex builds**, **Opus audit session audits** (separate), **JT commits**. Builder does not self-approve.

---

## 0. Grounded contract (verified from the working tree at HEAD `d6fe559` — NOT memory)

**Frozen core (DO NOT edit — `packages/core/src`; INV-03 core stays infrastructure-free):**
- `CoreContainer { admissionService: AdmissionService; membershipService: MembershipService }` is
  CONTRACT-FROZEN (`application/container.ts`) and its comment says the concrete wiring is built **in
  `packages/adapters` or `apps/web`, NOT in core**. (`apps/` does not exist yet → build it in `packages/adapters`.)
- Concrete services already implemented (Task 2, 19 green): `DefaultAdmissionService` (`domain/admission/
  admission-service.ts:102`), `DefaultMembershipService` (`domain/membership/membership-service.ts`). All
  exported from `@soulbound/core`.
- `AdmissionServiceDeps { admissionRepo, outboxRepo, ledger, flags, idgen?, clock? }` — **AuthPort is NOT a
  service dep**; role enters via `cmd.actor.role` (the service checks `canReview(cmd.actor.role)` as INV-11
  step 1). `MembershipServiceDeps { membershipRepo }`; `MembershipService.getMyMembership(userId)`.
- Post-approve side effects run **only if `flags.externalLedgerEnabled`** (`admission-service.ts:199`), which is
  a HARD `false` literal on main (`config/feature-flags.ts`, INV-21). Exported P0 const: `featureFlags`
  (`@soulbound/core`, `index.ts:13`). ⇒ on main, approve performs NO outbox/ledger side effect.

**Adapters already shipped (Task 4 + 4.5) — `@soulbound/adapters` exports (use these, do not re-implement):**
- Clients (`clients.ts`): `createAnonSupabaseClient({url,anonKey})`, `createUserSupabaseClient({url,anonKey,
  accessToken})`, `createServiceRoleSupabaseClient({url,serviceRoleKey})`.
- Repo factories (each takes `client: SupabaseAdapterClient`, returns the port):
  `makeServiceRoleAdmissionRepository` (broad/service-role column select), `makeUserScopedAdmissionRepository`
  (RLS-scoped reads — **Task 6, not here**), `makeSupabaseMembershipRepository`, `makeSupabaseOutboxRepository`.
- `makeNoopLedgerAdapter()` (the ONLY ledger on main — INV-05), `makeSupabaseAuthAdapter(client)` (Task 4.5:
  resolves role via `current_user_role()` on its client, fail-closed to `applicant`).

**The 3-client wiring decision (security crux — encode exactly):**

| Wiring | Client | Why |
|---|---|---|
| admission/membership/outbox **repos in the container** | **service-role** | The services are the privileged server-side path: the reviewer must `findById` ANY application (no reviewer RLS read policy exists yet) and the `*Tx` rpcs are `service_role`-EXECUTE-only (proven by the smoke gate). |
| **AuthPort** (sign-in + role resolution) | **anon** (becomes authenticated after `signIn`) | `current_user_role()` must run as the signed-in user (`auth.uid()`). NEVER give AuthPort the service-role client (INV-17). |

Service-role key is **server-only** — never a `NEXT_PUBLIC_*` env var, never bundled to a client (INV-17).

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 5 — Service wiring / composition root (security layer). Implement ONLY this; do NOT build Task 6 routes or UI.

Goal: a composition root that instantiates the frozen core services with the real Supabase + Noop adapters and
returns a CoreContainer, PLUS a committed integration test proving the real reviewer approval path end-to-end
through the TS service+adapter+auth layers against a live local Supabase. Read the REAL exports first — do not
guess: packages/core/src/application/container.ts, domain/admission/admission-service.ts,
domain/membership/membership-service.ts, config/feature-flags.ts, ports/*; packages/adapters/src/index.ts,
supabase/clients.ts, the repo/auth factories.

A) Composition root — packages/adapters/src/container.ts:
   export function makeCoreContainer(config: { url: string; serviceRoleKey: string }): CoreContainer
   - service-role client = createServiceRoleSupabaseClient({ url, serviceRoleKey }).
   - admissionService = new DefaultAdmissionService({
       admissionRepo: makeServiceRoleAdmissionRepository(serviceRoleClient),
       outboxRepo: makeSupabaseOutboxRepository(serviceRoleClient),
       ledger: makeNoopLedgerAdapter(),          // INV-05: the only ledger on main
       flags: featureFlags,                        // INV-21: externalLedgerEnabled=false (do not redefine)
     });
   - membershipService = new DefaultMembershipService({
       membershipRepo: makeSupabaseMembershipRepository(serviceRoleClient),
     });
   - return { admissionService, membershipService } satisfying CoreContainer.
   - Export it from packages/adapters/src/index.ts. Do NOT wire AuthPort or any anon/user client into the
     container (CoreContainer has neither; AuthPort + user-scoped repos are the Task-6 route layer).
   - The service-role key comes from config (caller passes a server-only env value). NEVER read or expose it as
     NEXT_PUBLIC_* (INV-17). Add NO business logic here — composition only.

B) Integration test (option b) — a NEW test that hits a LIVE local Supabase (NOT mocked), kept SEPARATE from
   the existing mocked unit tests so `pnpm -F @soulbound/adapters test` stays green without the stack:
   - Add a `test:integration` script + a vitest setup that includes ONLY the integration test(s) (e.g.
     *.integration.test.ts), and EXCLUDE that glob from the default `test` run.
   - Config from env: SUPABASE_URL (http://127.0.0.1:54321), SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
     (from `supabase status`). If unset, FAIL LOUDLY with a clear message (do NOT silently skip — a silent skip
     reads as "passed" when it tested nothing).
   - Wire it the way a Task-6 route will: authAdapter = makeSupabaseAuthAdapter(createAnonSupabaseClient({url,
     anonKey})); container = makeCoreContainer({ url, serviceRoleKey }).
   - Prove this exact path:
       reviewerSession = await authAdapter.signIn({ email:'reviewer@soulbound.local', password:'password123' });
       assert reviewerSession.role === 'reviewer'                    // current_user_role() resolved it
       // set up an application in under_review (use the container; applicant via signIn applicant…):
       submit  = container.admissionService.submitApplication({ actor:{id:applicantId,role:'applicant'}, ... }) -> Ok
       start   = container.admissionService.startReview({ actor:{id:reviewerId,role:'reviewer'}, applicationId, idempotencyKey }) -> Ok
       approve = container.admissionService.approveApplication({ actor:{id:reviewerId,role:'reviewer'}, applicationId, reasonCode:'meets_phase1_policy', idempotencyKey }) -> Ok
       assert approve.value.application.status === 'approved' && approve.value.membership.status === 'active'
       assert container.membershipService.getMyMembership(applicantId) returns the active membership
   - NEGATIVE (the guard must bite with the REAL resolved role):
       applicantSession = authAdapter.signIn(applicant...) -> role 'applicant'
       container.admissionService.approveApplication({ actor:{id:applicantId,role:'applicant'}, ... }) -> Err(FORBIDDEN)
   - RE-RUNNABLE: a second `test:integration` run must NOT fail on stale state. Either (i) run against a fresh
     `supabase db reset`, OR (ii) create a per-run throwaway applicant (unique id) via the service-role admin API
     so the one-active-application / one-active-membership partial unique indexes don't collide. Document which.

FORBIDDEN (violation = redo):
 - editing packages/core/src/** (frozen CoreContainer/services/deps) — if you think you need to, STOP;
 - putting any business logic, role check, or state guard in the container (composition only — guards live in the service);
 - giving AuthPort or the container's repos the WRONG client (AuthPort=anon, container repos=service-role; never
   the reverse), or exposing the service-role key as NEXT_PUBLIC_* (INV-17);
 - wiring the real/external ledger (NoopLedger only, INV-05) or flipping externalLedgerEnabled (INV-21);
 - building Task 6 API routes, Task 8 UI, user-scoped read repos, or reviewer/admin RLS read policies;
 - making the integration test silently skip when the stack/env is absent (fail loudly instead).

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` -> existing 49 pgTAP green (unchanged);
 - `supabase start` up, then `pnpm -F @soulbound/adapters test:integration` -> the reviewer-approve path + the
   FORBIDDEN negative both green;
 - `pnpm -F @soulbound/adapters test` -> unit tests green WITHOUT requiring the stack (integration excluded);
 - `pnpm -r typecheck` clean; `pnpm -F @soulbound/core test` 19 green (unchanged); `pnpm -F @soulbound/adapters build` + `@soulbound/core build` ok;
 - `bash scripts/audit.sh` PASS;
 - `git status --short` shows ONLY: packages/adapters/src/container.ts, packages/adapters/src/index.ts,
   the new integration test + any vitest config/script, and packages/adapters/package.json (test:integration);
 - `git diff --stat packages/core/src` empty.
STOP and report. Do not self-approve — the Opus audit session audits (separate), JT commits.
```

---

## 2. Dispatch + commit (JT, host)

1. Commit this prompt doc: `docs: add Task 5 service-wiring builder prompt`.
2. Paste §1 into the Codex builder. Codex builds, runs the gates (incl. `supabase start` + `test:integration`), STOPS.
3. Opus audit session (separate) audits: container is composition-only (no business logic / no role check);
   the 3-client split is exactly right (AuthPort=anon, repos=service-role; service-role key never public, INV-17);
   NoopLedger only + flags untouched (INV-05/21); the integration test genuinely proves the reviewer path with the
   REAL `current_user_role()`-resolved role AND the FORBIDDEN negative (not vacuous, not silently skipped); it is
   re-runnable; unit `test` stays stack-free; core untouched; scope clean. Re-derive from git, re-run audit.sh,
   do not rubber-stamp the green runs (host-only — JT confirms).
4. On PASS, JT commits: `feat(adapters): Task 5 service composition root + reviewer-path integration test` →
   then `docs: record Task 5 audit pass` + PROJECT_STATE update.
5. Then Task 6 (API routes): routes resolve AuthSession → Actor and call the container's services; wire the
   user-scoped read repos for applicant self-reads; add reviewer/admin RLS read policies as needed.

## 3. Out of scope (explicit — do NOT build here)
- API routes (Task 6), UI (Task 8), the user-scoped admission read path / `makeUserScopedAdmissionRepository`
  wiring (Task 6), reviewer/admin RLS read policies (land with the reviewer read-path).
- The outbox-vs-ledger single-call refactor (carry-forward [Task 10-1]) — on main `externalLedgerEnabled=false`
  so the post-approve side-effect block is inert; do NOT touch it here.
- Any `apps/web` scaffold — the composition root lives in `packages/adapters` for now.
