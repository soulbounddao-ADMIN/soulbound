# Task 5.5 — Seed Sign-in Fix — spec + Codex builder prompt (Cowork-authored)

> **Inserted before Task 6** (closes the carry-forward surfaced by Task 5: PROJECT_STATE §4). The seeded
> `auth.users` (admin/reviewer/applicant @soulbound.local, password123) **cannot GoTrue password-sign-in** —
> only `auth.admin.createUser`-made users can. So the Task-5 integration test had to work around it with
> throwaway users, and Task 6 route auth + local/manual QA would be blocked on the seeded fixtures. This task
> makes the seeded users genuinely log-in-able, and proves it at runtime.
>
> **This is an auth-plumbing fix, NOT a role fix.** Sign-in failing has nothing to do with role. Do NOT
> "fix" it by putting role into `app_metadata`/`user_metadata` — that would re-break the Task-4.5 trusted-role
> contract and the committed smoke-test assertions. Role stays ONLY in `profiles.role`; `current_user_role()`
> and `0006` are untouched.
>
> **Workflow (risk-tiered, `docs/WORKFLOW.md`):** seed / auth fixtures = security-adjacent DB layer →
> **Codex builds**, **Opus audit session audits** (separate), **JT commits**. Builder does not self-approve.

---

## 0. Grounded contract (verified from the working tree at HEAD `c5369f6` — NOT memory)

- **Current `supabase/seed.sql`** inserts `auth.users` with only `{id, email, encrypted_password,
  email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data}` and a `public.profiles` row per user.
  It inserts **no `auth.identities` row** and sets none of GoTrue's other login-path columns. `app_metadata`
  = `{"provider":"email","providers":["email"]}`, `user_metadata` = `{}` (role removed in Task 4.5).
- **Observed (Task 5):** seeded users are rejected at GoTrue password sign-in; `auth.admin.createUser` users
  log in fine. The delta between those two rows is the bug — find it empirically, do not guess.
- **Prime suspect: missing `auth.identities` row.** GoTrue's email/password login resolves the user through an
  identity record; `admin.createUser` creates `auth.users` **and** `auth.identities` together, hand-seeds don't.
  Secondary suspects to check in the same diff: `aud` (expected `'authenticated'`), `instance_id`
  (`'00000000-0000-0000-0000-000000000000'`), and token columns (`confirmation_token`, `recovery_token`,
  `email_change`, `email_change_token_new`, …) being **NULL vs `''`** (older GoTrue scans them into non-null
  strings and 500s on NULL). The live local GoTrue version is authoritative — diagnose against it.
- **Invariants that must survive (committed gates):** the pgTAP smoke test (49) asserts seeded users have NO
  role in `app_metadata` AND NO role in `user_metadata`, and `profiles.role` is canonical. `current_user_role()`
  reads `profiles.role`. The fix must keep all of this true (it touches auth login plumbing, not role).
- The Task-5 full-flow integration test (`container.integration.test.ts`) deliberately uses per-run **throwaway**
  users for re-runnability of the mutating approve flow — leave that as is (see §3).

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 5.5 — Seed sign-in fix (security-adjacent DB / auth fixtures). Implement ONLY this; do NOT build Task 6.

Problem: the seeded auth.users (admin/reviewer/applicant@soulbound.local, password123) cannot GoTrue
password-sign-in; only auth.admin.createUser users can. Make the seeded users log-in-able and PROVE it at
runtime. This is an AUTH-PLUMBING fix, not a role fix.

A) Diagnose first (do NOT guess the fix):
   - `supabase db reset`, then in the local DB compare a seeded row to a working one:
       select * from auth.users where email = 'reviewer@soulbound.local';
       -- create a reference user via the service-role admin API (or psql) and compare:
       select * from auth.users where email = '<an admin.createUser user>';
       select * from auth.identities where user_id in (<seeded id>, <reference id>);
   - Identify the exact delta that makes GoTrue reject the seeded user (most likely a missing auth.identities
     row; also check aud / instance_id / NULL-vs-'' token columns). Use the LIVE GoTrue schema as the source of
     truth, not assumptions.

B) Fix supabase/seed.sql so each seeded user is a valid, confirmed, log-in-able email/password user:
   - Add whatever the diagnosis shows is required (expected: an auth.identities row per user with the right
     provider / identity_data {sub,email}, plus any required auth.users columns). Keep deterministic seed ids.
   - Keep encrypted_password = the bcrypt of password123 the way GoTrue verifies it.
   - DO NOT add `role` to raw_app_meta_data or raw_user_meta_data (role stays only in profiles.role — Task 4.5).
   - DO NOT weaken auth globally (e.g. disabling confirmations) to mask the issue — make the rows correct.
   - Keep profiles rows + roles exactly as they are.

C) Runtime gate — add a SEPARATE, re-runnable integration test (a new `it`/file under packages/adapters,
   included by the existing vitest.integration.config.ts) that is READ-ONLY (no submit/approve, so it cannot
   collide on the one-active-* partial indexes and is safe to re-run):
   - For each seeded user, via a real anon password sign-in through makeSupabaseAuthAdapter:
       signIn('admin@soulbound.local','password123')     -> AuthSession.role === 'admin'
       signIn('reviewer@soulbound.local','password123')   -> AuthSession.role === 'reviewer'
       signIn('applicant@soulbound.local','password123')  -> AuthSession.role === 'applicant'
     (This proves BOTH that GoTrue sign-in now works AND that current_user_role() resolves the seeded role.)
   - Read config from env (SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY); if unset, throw (fail loud — never skip).

FORBIDDEN (violation = redo):
 - editing packages/core/src/** or supabase/migrations/** (0001-0006) or current_user_role();
 - adding role to app_metadata/user_metadata, or otherwise re-introducing claim-based role (Task 4.5);
 - editing the committed pgTAP smoke test to keep it green, or changing the existing Task-5 full-flow
   integration test off its throwaway users (keep it re-runnable; the seeded proof is a SEPARATE read-only test);
 - weakening any grant/policy/auth-config to force a pass; guessing the fix without the live diagnosis;
 - building Task 6 routes / UI / reviewer RLS read policies.

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` -> existing 49 pgTAP green, UNCHANGED (smoke test not edited);
 - `supabase start` up, then `pnpm -F @soulbound/adapters test:integration` -> the existing full-flow test AND
   the new seeded-sign-in test both green (re-run it twice to show re-runnability);
 - `pnpm -F @soulbound/adapters test` 14 green (stack-free); `pnpm -r typecheck` clean; `pnpm -F @soulbound/core test` 19 green; builds ok;
 - `bash scripts/audit.sh` PASS;
 - `git status --short` shows ONLY supabase/seed.sql and the integration test file(s);
 - `git diff --stat packages/core/src` empty; `git diff --stat supabase/migrations` empty;
   `git diff supabase/tests/pre_task5_rpc_rls_smoke.sql` empty.
STOP and report. Do not self-approve — the Opus audit session audits (separate), JT commits.
```

---

## 2. Dispatch + commit (JT, host)

1. Commit this prompt doc: `docs: add Task 5.5 seed sign-in builder prompt`.
2. Paste §1 into the Codex builder. Codex diagnoses, fixes seed, adds the read-only seeded-sign-in test, runs the
   gates (incl. `supabase start` + `test:integration`), STOPS.
3. Opus audit session (separate) audits: the fix is auth-plumbing only (no role in any claim — smoke 49 still
   green, role-source assertions intact); seeded admin/reviewer/applicant genuinely sign in AND
   `current_user_role()` resolves their role at runtime (not vacuous, not silently skipped); the seeded test is
   read-only/re-runnable; the full-flow test still uses throwaway users; core/migrations/smoke untouched; scope =
   seed + integration test only. Re-derive from git, re-run audit.sh, do not rubber-stamp the green runs.
4. On PASS, JT commits: `fix(db): seed auth.users so seeded users can sign in` → then `docs: record Task 5.5 audit
   pass` + PROJECT_STATE §4 (seed carry-forward = CLOSED).
5. Then Task 6 (API routes) — routes can now authenticate the seeded fixtures for real.

## 3. Out of scope (explicit — do NOT build here)
- Task 6 API routes, Task 8 UI, user-scoped read-repo wiring, reviewer/admin RLS read policies.
- Switching the Task-5 full-flow integration test off throwaway users — its throwaway fixtures are correct for a
  re-runnable mutating flow; this task only adds a separate read-only seeded-sign-in proof.
- A `handle_new_user` trigger (profiles auto-creation on signup) — separate concern; seed sets profiles directly.
