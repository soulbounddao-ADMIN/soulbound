# Task 5.5 — Seed Sign-in Fix — Audit Findings (final auditor record)

> Builder: **Codex** (security-adjacent DB / auth fixtures). Final auditor: **Opus audit session** (separate).
> Verdict: **PASS (R1 — clean, no findings).** Commit by **JT** (host). Builder ≠ final approver preserved
> (WORKFLOW §2). Spec/prompt: `docs/TASK5_5_SEED_SIGNIN_PROMPT.md`.

Closes the carry-forward surfaced by Task 5 (PROJECT_STATE §4): the seeded `auth.users` could not GoTrue
password-sign-in, so the seeded fixtures were unusable for real auth (Task 6 blocker) and Task 5 had to work
around it with throwaway users.

## Audit method (re-derived from the working tree — not a rubber stamp)

Read both changed files; verified the seed fix is auth-plumbing only (no role in any claim), confirmed the
committed pgTAP smoke test is byte-unchanged (still 49), traced the new seeded-sign-in test for non-vacuity and
re-runnability, re-checked scope + core/migrations untouched + audit.sh. Could not run the live stack (host-only)
— corroborated statically + the builder's empirical diagnosis; JT confirms the green runs on the host.

## Verified

- **Seed fix (`supabase/seed.sql`) is auth-plumbing only.** `auth.users` gains `aud='authenticated'`,
  `instance_id='000…0'`, empty-string token columns (`confirmation_token`/`recovery_token`/`email_change`/
  `email_change_token_new`) — the NULL→`''` GoTrue-scan fix — and `created_at`/`updated_at`; plus a deterministic
  `auth.identities` row per user (`provider='email'`, `identity_data={sub,email,…}`). **`role` is NOT added to
  `raw_app_meta_data` (still `{provider,providers}`) or `raw_user_meta_data` (still `{}`)** — the Task-4.5
  trusted-role contract is intact. (`auth.users.role='authenticated'` is GoTrue's aud-role column, NOT the app
  role; the smoke test checks the JSONB metadata `? 'role'`, which stays false.) `profiles.role` unchanged.
- **Builder diagnosed empirically, did not guess** — live comparison of a seeded vs an admin-API user; GoTrue
  logs flagged NULL `confirmation_token`, then NULL `created_at`. The fix matches the live GoTrue login path.
- **Committed gates preserved.** `git diff` of `packages/core/src`, `supabase/migrations`, and
  `supabase/tests/pre_task5_rpc_rls_smoke.sql` are all empty — the smoke test is untouched and still 49 (the seed
  change cannot break its "no role in auth metadata" assertions). audit.sh PASS.
- **Runtime gate is non-vacuous + read-only + re-runnable.** New `it("signs in seeded users and resolves roles
  from current_user_role")` performs a REAL anon password `signIn('password123')` for seeded admin/reviewer/
  applicant and asserts `AuthSession.role` === admin/reviewer/applicant — proving BOTH that GoTrue sign-in now
  works (it threw before the fix) AND that `current_user_role()` resolves the seeded role. It only signs in (no
  submit/approve), so it cannot collide on the one-active-* partial indexes and is safe to re-run. Env missing →
  throws (fail-loud, never a silent skip).
- **Full-flow test unchanged** — still uses per-run throwaway users for the mutating approve flow (re-runnable);
  the seeded proof is a separate read-only test, as scoped.
- **Scope** — only `supabase/seed.sql` and `packages/adapters/src/container.integration.test.ts`. No core,
  migrations, smoke-test, route, UI, or RLS-policy edits; no real ledger.

## Non-blocking note
`auth.identities.identity_data.email_verified=false` while `auth.users.email_confirmed_at` is set — a cosmetic
mismatch. GoTrue gates confirmation on `email_confirmed_at` (set), and sign-in is proven to work, so it has no
functional effect. Not a finding.

## Out of scope (unchanged)
- Task 6 API routes, Task 8 UI, user-scoped read-repo wiring, reviewer/admin RLS read policies.
- `handle_new_user` trigger (profiles auto-creation on signup) — seed sets profiles directly.

## Runtime confirmation (host-only)
Auditor corroborated statically + audit.sh PASS. Builder-reported green: `supabase db reset` + `supabase test db`
(49 pgTAP, unchanged), `test:integration` PASS twice (seeded sign-in + full-flow), `test` 14, `pnpm -r typecheck`,
`@soulbound/core` 19, builds. The live runs are host-only; **JT re-confirms on the host at commit** (WORKFLOW §5).
