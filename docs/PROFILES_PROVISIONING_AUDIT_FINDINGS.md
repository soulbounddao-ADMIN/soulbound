# Profiles provisioning (Task 8a finding #1 closure) — Audit Findings (final auditor record)

> Builder: **Codex** (security/DB layer: `auth.users` trigger + seed + fixtures). Final auditor: **Opus audit
> session** (separate; builder ≠ approver). Verdict: **PASS on code/scope/security + auditor-rerun static gates;
> FINAL PASS conditional on JT host determinism** (5× + reset — §6). Commit by **JT**. Spec:
> `docs/TASK_PROFILES_PROVISIONING_PROMPT.md`. Migration **0007**. Unblocks the net-new applicant happy-path; then Task 8b.

Closes the HIGH carry-forward from Task 8a: a net-new browser `signUp` made an `auth.users` row but no
`public.profiles` row, so `submitApplication` FK-violated. Fix = the standard `auth.users → profiles` trigger,
plus the seed + integration fixtures the (global) trigger now interacts with.

## Audit method (re-derived from the working tree — not a rubber stamp)

Re-derived scope + protected-surface diff from git; **re-ran `audit.sh` myself** (PASS, incl. "no COMMIT/ROLLBACK in
rpc migrations"); read the migration, the seed diff, the pgTAP file, and all four integration-fixture diffs. Live
DB gates are host-only → corroborated statically; **host determinism is required before final PASS** (below).

## Verified

- **Trigger (`supabase/migrations/0007_profiles_provisioning.sql`) — exactly right, and more locked-down than
  specced.** `handle_new_user()` is `security definer` + `set search_path = ''`; body inserts
  `public.profiles (id, role) values (new.id, 'applicant') on conflict (id) do nothing`. **Role is the literal
  `'applicant'`; it never reads `new.raw_user_meta_data` / `raw_app_meta_data`** (no self-escalation — the Task 4.5
  trusted-role invariant holds). `EXECUTE` is revoked from `public, anon, authenticated, service_role` (it is only
  ever invoked by the trigger as definer — a trigger fires regardless of caller EXECUTE, so this is the maximally
  locked posture and does NOT break firing). `after insert on auth.users for each row`. No COMMIT/ROLLBACK.
- **Anti-escalation, proven by pgTAP.** The test inserts an `auth.users` row with `raw_user_meta_data
  = {"role":"admin"}` and asserts the provisioned profile role is **still `applicant`** — a crafted-metadata signup
  cannot self-escalate.
- **Seed (`supabase/seed.sql`) — only the profiles conflict clause changed** to `on conflict (id) do update set
  handle/display_name/bio/role/membership_status = excluded.*`. The `auth.users` / `auth.identities` inserts are
  unchanged. This makes the seeded **admin/reviewer** roles survive the trigger (which pre-creates an `applicant`
  row for each seeded `auth.users` insert); pgTAP asserts all three seeded roles post-seed.
- **Integration fixtures — `insert` → `upsert({…same fields…}, { onConflict: "id" })` ONLY**, in all four files; no
  assertion / flow / retry change. The fourth file (`packages/adapters/src/container.integration.test.ts`) was
  **beyond my prompt's scope but the builder correctly extended to it and flagged it**: `createThrowawayUser` there
  takes a variable `role` (incl. `reviewer`) — so it needs the upsert both to avoid the trigger's duplicate-`id`
  collision AND to override the trigger's `applicant` default with the requested role. Correct, necessary, minimal;
  full-loop testing surfaced it (exactly the point of the full loop). My prompt under-scoped this; noted.
- **pgTAP (`supabase/tests/profiles_provisioning.sql`) — 7 genuine assertions**, `begin … rollback` (no residue):
  provisioning creates exactly one profile; defaults role=`applicant` + membership=`none`; forged-metadata →
  `applicant`; seeded admin/reviewer/applicant roles preserved. `supabase test db` = 49 + 7 = **56** (matches report).
- **Scope:** exactly 7 files — `migrations/0007…`, `tests/profiles_provisioning.sql`, `seed.sql`, the 3 web route
  integration tests, and the adapters container integration test. `git diff HEAD -- packages/core/src
  apps/web/app/api/_lib apps/web/lib` + the route `route.ts` files = **EMPTY** (no core / route-logic / UI / shared
  helper change). `audit.sh` PASS (auditor-rerun).

## Determinism — HOST-reproduced, CONFIRMED FINAL PASS (§6)

**CONFIRMED 2026-06-08 (JT host):** clean `supabase db reset` (0007 applied cleanly) → **5 consecutive runs**, each
`supabase test db` Files=2 **Tests=56 PASS** + `pnpm -F web test:integration` **5/5 PASS** — zero flake across all
five. The §6 bar (5× + post-reset, on the host) is met → **FINAL PASS**.


Builder reported (builder env): clean `supabase db reset`; `supabase test db` 56 PASS; `test:integration` runs 1–5
each 5/5; adapters live integration 2/2 (seeded roles resolve, reviewer approval path); a real browser-style signup
→ HTTP 200, profile `applicant/none`. This is a strong report **but it is the builder's environment**. Per the §6
lesson (6a: builder-env green ≠ host-deterministic), **JT must reproduce on the host**: a clean `supabase db reset`,
then `supabase test db` + `pnpm -F web test:integration` **5× consecutively, all green**. Only then is this FINAL
PASS. (The trigger itself is deterministic; the residual flake vector is the pre-existing auth-fixture transport,
already bounded-retried since 6a.)

## Residual (accepted)
- **Forward-only.** The migration does not backfill `auth.users` rows that predate it without a profile — fine for
  P0 (every run starts from `supabase db reset`). If a long-lived env ever needs it, a one-off backfill
  `insert … select … on conflict do nothing` is the follow-up.

## Out of scope (unchanged)
- Member/admin pages = **Task 8b** (now unblocked end-to-end). Outbox/byte-delete workers = **Task 9**.

## Runtime confirmation (host-only / auditor-rerun)
Auditor re-ran (sandbox): `audit.sh` PASS; scope + protected-surface + migration/seed/pgTAP/fixture diffs verified.
Builder/host green (pending host re-proof): `supabase test db` 56, `test:integration` 5×, adapters 2/2, web unit 29,
adapters 17, core 19, typecheck, build, real signup 200.
