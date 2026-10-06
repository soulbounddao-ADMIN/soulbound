# Task 4.5 — Trusted Role Source (carry-forward ②) — Audit Findings (final auditor record)

> Builder: **Codex** (security layer / auth+DB). Final auditor: **Opus audit session** (separate). Verdict:
> **PASS (R1 — clean, no findings).** Commit by **JT** (host). Builder ≠ final approver preserved (WORKFLOW §2).
> Spec/prompt: `docs/TASK4_5_ROLE_SOURCE_PROMPT.md`. Mechanism: (a) security-definer `current_user_role()`.

Closes PROJECT_STATE §4 carry-forward ②. Before: the auth adapter resolved role from JWT `app_metadata.role`,
which the seed never populated → everyone resolved to `applicant`, so the service `canReview` guard could
never authorize a real reviewer. After: role is resolved server-side from `profiles.role` (the canonical,
service-role-write-only column) via a security-definer RPC keyed to the signed `auth.uid()`.

## Audit method (re-derived from the working tree — not a rubber stamp)

Read all 5 changed files; cross-checked the function hardening, adapter logic, test assertions, seed, and the
smoke-test additions against the migrations; re-counted assertions; confirmed scope + core-untouched + audit.sh.
Could not run `supabase test db` (host-only) — corroborated statically + via the 41→49 count match; JT confirms
the green run on the host at commit.

## Verified (each item independently re-derived)

- **`0006_role_source.sql`**: `current_user_role()` is zero-arg, `language sql stable security definer set
  search_path=''`, body `select p.role from public.profiles p where p.id = auth.uid()` (both `public.profiles`
  and `auth.uid()` schema-qualified — required under empty search_path), `revoke execute from public, anon` +
  `grant to authenticated, service_role`. Mirrors the 0003 `is_active_member` hardening; own-role-only (no uuid
  param). NULL when no row → adapter fails closed. 0001–0005 untouched; 0006 is the only new migration.
- **Adapter** (`supabase-auth-adapter.ts`): `roleFromAppMetadata` removed; `signIn`/`getSession` resolve role
  via `this.client.rpc("current_user_role")`; `resolveCurrentUserRole` fails closed to `applicant` on
  error/null/non-enum; `signUp` returns `applicant` (fresh user). Uses the existing user-scoped client only — no
  service-role client introduced (INV-17). **Zero residual `app_metadata`/`user_metadata` role reads.** Frozen
  `AuthSession`/`AuthPort`/`Actor`/`UserRole` shapes unchanged; `packages/core/src` diff empty.
- **Adapter tests**: role tracks the RPC result; forged `app_metadata.role` AND `user_metadata.role` are BOTH
  ignored; RPC null and RPC error both fail closed to `applicant`. The old "must not query profiles.role" mock
  invariant is correctly replaced (role now comes from the RPC, not a column select). `@soulbound/adapters` 14
  green / `@soulbound/core` 19 green (unchanged) per builder run.
- **Seed**: `raw_user_meta_data` = `'{}'` for all seeded users (role removed); no `app_metadata.role` injected;
  `profiles.role` intact (admin/reviewer/applicant) = single canonical source.
- **Smoke test** (`pre_task5_rpc_rls_smoke.sql`, 41 → 49 pgTAP): under REAL `authenticated` sessions
  (`set local role authenticated` + jwt claims per user), `current_user_role()` returns admin→'admin',
  reviewer→'reviewer', applicant→'applicant'; **anti-escalation** — with `sub`=applicant AND forged
  `user_metadata`/`app_metadata` role='reviewer' in the claims, `current_user_role()` STILL returns 'applicant'
  (reads the table, not the claim — a real regression guard); anon cannot execute `current_user_role()` (42501);
  the role-source block is flipped to the post-② reality (no role in user_metadata for all four users, incl. the
  test-inserted `…0004` whose top-of-file insert was updated to `'{}'` consistently). No `.skip/.only/.todo`.

## Why this is escalation-proof (the security argument)

Identity (`auth.uid()`/`sub`) is signed by GoTrue → unforgeable. Role comes only from `profiles.role`, which an
applicant cannot write (the smoke test proves `authenticated` UPDATE/SELECT of `profiles.role` → 42501). The
function ignores all JWT metadata claims. So an authenticated applicant cannot make `current_user_role()` return
anything but their true `profiles.role`. The "JWT authenticates who you are; the DB authorizes what you can do"
separation holds end-to-end, and is proven at call time by the committed smoke test.

## Scope / invariants

Only `supabase/migrations/0006_role_source.sql`, `supabase/seed.sql`,
`packages/adapters/src/supabase/supabase-auth-adapter.ts(+.test.ts)`, and
`supabase/tests/pre_task5_rpc_rls_smoke.sql` changed. No core edits, no grant/policy weakening, no Task 5 wiring.

## Out of scope (still open, by design — see TASK4_5_ROLE_SOURCE_PROMPT.md §3)
- Reviewer/admin **RLS read policies** (`using (public.current_user_role() in ('reviewer','admin'))`) for the
  review queue / `review_summary` — land with the reviewer read-path (Task 6/8); `current_user_role()` is now
  available for them to reuse.
- `handle_new_user` trigger / profiles-row auto-creation on signup — separate concern; `current_user_role()`
  fails closed to `applicant` if no profiles row, which is safe for P0.

## Runtime confirmation (host-only)
Auditor corroborated statically + 41→49 count match + `audit.sh` PASS. The green
`supabase db reset` → `supabase test db` (Files=1/Tests=49) is host-only; JT re-confirms it on the host at commit.
