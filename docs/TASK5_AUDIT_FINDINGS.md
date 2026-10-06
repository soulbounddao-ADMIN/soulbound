# Task 5 — Service Wiring / Composition Root — Audit Findings (final auditor record)

> Builder: **Codex** (security layer / service wiring + 3-client boundary). Final auditor: **Opus audit session**
> (separate). Verdict: **PASS (R1 — clean for Task 5's scope).** Commit by **JT** (host). Builder ≠ final
> approver preserved (WORKFLOW §2). Spec/prompt: `docs/TASK5_SERVICE_WIRING_PROMPT.md`. Gate = option (b).
>
> **One latent defect surfaced (out of Task 5 scope, tracked): seeded auth.users cannot GoTrue-sign-in — must
> fix before Task 6.** See §"Finding".

## Audit method (re-derived from the working tree — not a rubber stamp)

Read all 6 changed files; verified the container composition + 3-client boundary, traced the integration test's
proof of the (b) path line by line, confirmed the unit/integration vitest split keeps `pnpm test` stack-free,
re-checked scope + core/supabase untouched + audit.sh. Could not run the live stack (host-only) — corroborated
statically; JT confirms the green runs on the host at commit.

## Verified (each item independently re-derived)

- **`container.ts`** — `makeCoreContainer({ url, serviceRoleKey }): CoreContainer` wires `DefaultAdmissionService`
  + `DefaultMembershipService` with **service-role-backed** repos (`makeServiceRoleAdmissionRepository`,
  `makeSupabaseMembershipRepository`, `makeSupabaseOutboxRepository`), `makeNoopLedgerAdapter()` (INV-05), and the
  frozen `featureFlags` const (INV-21 — not redefined). No AuthPort, no anon/user client, **no business logic /
  no role check** (guards stay in the service). Service-role key is injected via config (server-only; never
  `NEXT_PUBLIC_*`, INV-17). Exported from `index.ts`. `packages/core/src` diff empty.
- **3-client boundary** — container repos = service-role (the privileged server path: a reviewer must load ANY
  application and the `*Tx` rpcs are `service_role`-EXECUTE-only). AuthPort is wired separately on the **anon**
  client (in the test, as a Task-6 route would). The two never cross → INV-17 holds by construction.
- **Integration test (`container.integration.test.ts`) genuinely proves the (b) path** — real anon password
  `signIn` → `AuthSession.role === 'reviewer'` (resolved by `current_user_role()`); `submitApplication` (applicant)
  → `startReview` (reviewer) → **applicant `approveApplication` → `Err(FORBIDDEN)`** (the guard bites with the
  REAL resolved role) → **reviewer `approveApplication` → `Ok`**, status `approved`, membership `active`;
  `getMyMembership` returns the created membership. Env missing → **throws (fail-loud), never a silent skip.**
  Re-runnable via per-run unique fixtures.
- **vitest split** — `vitest.config.ts` includes `src/**/*.test.ts` and **excludes** `*.integration.test.ts`;
  `vitest.integration.config.ts` includes only `*.integration.test.ts`; `package.json` adds `test:integration`.
  So `pnpm -F @soulbound/adapters test` (14 unit) runs WITHOUT the live stack; the live test runs only under
  `test:integration`. No landmine for the default test gate.
- **Scope** — only the 6 adapter files changed; no core/seed/migration/route/UI edits; no real ledger; audit.sh PASS.

## Why the throwaway-user deviation does NOT weaken the proof (it strengthens it)

The prompt said sign in as the seeded reviewer; the builder instead creates per-run users via the service-role
admin API (`auth.admin.createUser`) with **empty `user_metadata` AND `app_metadata`**, then inserts a `profiles`
row with the role. Because the role exists ONLY in `profiles.role` (no claim carries it), `current_user_role()`
returning `'reviewer'` proves role resolution reads the **trusted table**, not any JWT claim — a cleaner proof of
the Task-4.5 contract than seeded users would give. The sign-in is a genuine anon password flow; `canReview` is
exercised both positively (approve Ok) and negatively (applicant FORBIDDEN); approve runs through the real
service-role `approveApplicationTx`. The (b) gate is fully met. The deviation is also partly sanctioned by the
prompt's own re-runnability clause (per-run throwaway fixtures).

## Finding (out of Task 5 scope — tracked as a before-Task-6 carry-forward)

**[before Task 6 · security/DB layer] Seeded `auth.users` cannot GoTrue password-sign-in.** The builder honestly
reported, and the auditor confirmed by reasoning, that `supabase/seed.sql` hand-inserts `auth.users` without the
fields GoTrue requires for the password grant (likely `aud` / `instance_id` and non-NULL token columns), so the
seeded `admin/reviewer/applicant@soulbound.local` cannot actually log in — only admin-API-created users can. This
was invisible until now because the pgTAP smoke test fakes JWT claims via `set_config` (never touches GoTrue) and
the adapter unit tests mock the client. Impact: Task 6 routes (and local/manual QA) that perform real sign-in
would fail with the seeded fixtures. **Fix the seed so the seeded users can sign in, before Task 6 wires route
auth** (Codex builds, Opus audits). Ideally extend the integration test to also prove a *seeded* user can sign in,
so the fix is gated at runtime. NOT a Task 5 blocker — Task 5's deliverable and (b) proof stand on their own.

## Out of scope (unchanged — do NOT build until their task)
- API routes (Task 6), UI (Task 8), user-scoped read-repo wiring (Task 6), reviewer/admin RLS read policies.
- Outbox-vs-ledger single-call refactor (Task 10-1) — inert on main (`externalLedgerEnabled=false`).

## Runtime confirmation (host-only)
Auditor corroborated statically + audit.sh PASS. Builder-reported green: `supabase db reset` + `supabase test db`
(49 pgTAP), `test:integration` PASS twice (live), `test` 14, `pnpm -r typecheck`, `@soulbound/core` 19, builds.
The live runs are host-only; **JT re-confirms on the host at commit** (WORKFLOW §5).
