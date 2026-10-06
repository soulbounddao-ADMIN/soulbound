# Integration Harness Cleanup (Option A — self-contained fixtures) — Design Brief (Claude Code / Cowork)

> **Step 1 of the loop** (Claude design → Codex plan → Claude approve → Codex build → Claude final audit).
> **Test-harness ONLY — product code / schema / seed = 0-diff.** Goal: `pnpm -F web test:integration` runs **all 4 suites
> green, host 5x+reset deterministic, with NO manual `--testTimeout` flag and NO manual DB seeding.** Builder ≠ approver.

## 0. Why (the 3 root causes, grounded)
The integration suite is fragile for 3 reasons:
- **#3 seed dependency:** admin/applicant/persona-clip integration tests sign in as the pre-made seed users
  (`reviewer@soulbound.local` etc.). `seed.sql` DOES create them correctly, but the tests only pass if someone ran
  `supabase db reset` to apply the seed — otherwise login fails ("Invalid login credentials"). Fragile environment coupling.
- **#2 auth-fixture stall:** `retryAuthFixtureOperation` wraps `signInWithPassword` with retry but **no per-attempt timeout** —
  under load a hung sign-in never resolves, so the test blocks to its 60s timeout and fails (~1/5 admin-routes flake).
- **#1 tight timeout:** `vitest.integration.config.ts` sets no `testTimeout` → vitest default 5000ms, too tight for real-DB
  tests (5–12s). Only green with a manual `--testTimeout` flag.

The **`profile-routes` integration test already avoids all of this** — it creates its own member via service-role
(`createActiveMember`) and ran 11/11 deterministic. **Option A = make the other 3 follow that proven pattern.**

## 1. Hard boundary (final audit enforces)
- **Test-harness ONLY.** Touch: the integration test files (`apps/web/app/api/*-routes.integration.test.ts`), a shared
  integration **fixture helper** (new test-only module, e.g. `apps/web/app/api/_integration/fixtures.ts`), and
  `apps/web/vitest.integration.config.ts`.
- **0-diff:** all product code (`apps/web/app/api/**` routes, `apps/web/app/**` UI/components, `apps/web/lib`,
  `packages/core`, `packages/adapters`), `supabase/migrations/**`, `supabase/seed.sql`, schema/RLS/RPC. **No new npm dep.**
- The product behavior under test is NOT changed — only how the tests set up/authenticate their actors.

## 2. (#1) Config timeout
- In `apps/web/vitest.integration.config.ts` add `testTimeout: 20000` (+ `hookTimeout: 20000`) so the default
  `pnpm -F web test:integration` command runs without a manual flag. (Real-DB tests legitimately take 5–12s — this is a
  correction, not a weakening.)

## 3. (#3) Self-contained fixtures — remove the seed dependency
- Extract a **shared service-role fixture helper** (test-only) mirroring `profile-routes`' `createActiveMember`:
  `createReviewer()` / `createAdmin()` / `createActiveMember()` / `createApplicant()` (+ a submitted application where a test
  needs one). Each: service-role `createUser` (email-confirmed) → `upsert` the `profiles` row with the needed role → return
  `{ id, accessToken }`. Use **unique identifiers per fixture** (random email/handle) so parallel/repeat runs never collide.
- The 3 seed-dependent suites (admin / applicant / persona-clip) adopt this helper instead of signing in as
  `reviewer@soulbound.local`. After this, **no integration test depends on `seed.sql` having been applied.**
- `profile-routes` may consolidate onto the shared helper too (it already does this inline) — optional, keep it green.

## 4. (#2) Robust sign-in — kill the stall
- The fixture sign-in must have a **per-attempt timeout** (e.g. race `signInWithPassword` against ~8–10s) so a hung call
  rejects and retries instead of blocking to the test timeout. Keep bounded retry (transient errors) but no unbounded await.
- **Session reuse:** sign in **once per fixture** and reuse the returned `accessToken` across that test's requests — don't
  re-`signInWithPassword` repeatedly (the churn that triggers the stall under load).

## 5. Isolation / determinism (the §6 lesson)
- Fixtures use unique identifiers and clean up after themselves (or rely on per-run `supabase db reset`) so there is **no
  cross-test or cross-run state leak** — that is what makes the **5x+reset** run deterministic. (Recall Task 9a: a web test
  leaving state broke run-2; the §6 gate caught it. Avoid the analogue here.)

## 6. Acceptance gates (Claude final audit + host)
- Code (host-independent, Cowork reproduces): `pnpm -F web typecheck` · `pnpm -F web test` (unit, still green) · `pnpm -r build` ·
  `bash scripts/audit.sh` · `git diff --check`.
- **Boundary 0-diff:** product code (`app/api`, `app`, `lib`, `packages/core`, `packages/adapters`), `supabase/migrations`,
  `supabase/seed.sql`, schema. No new dep. (Only test files + the fixture helper + the integration config changed.)
- **🔴 Host determinism (the goal):** `pnpm -F web test:integration` **with NO `--testTimeout` flag** and **without manually
  seeding the DB** → **all 4 suites green, 5x+reset, 0 flake.** (Run on a host with local Supabase up + `SUPABASE_SERVICE_ROLE_KEY`;
  `supabase db reset` between the 5 runs.) This is the binding gate — Cowork confirms determinism from the 5x output (sandbox
  can't run real-DB).
- No integration test references `reviewer@soulbound.local`/seed-user sign-in anymore (grep); profile-routes stays green.

## 7. Handoff to Codex (step 2)
Produce the plan: the shared fixture helper API (`createReviewer/createAdmin/createActiveMember/createApplicant` via service-role,
unique ids) + the robust sign-in (per-attempt timeout + session reuse); the per-suite refactor (admin/applicant/persona-clip
adopt the helper, drop seed-user sign-in; profile optional-consolidate); the `vitest.integration.config.ts` timeout; the
cleanup/isolation approach. Explicitly confirm: **no product/schema/seed change, no new dep, no integration test depends on
seed users, host 5x+reset is the acceptance.** Return for Claude approval before build.
