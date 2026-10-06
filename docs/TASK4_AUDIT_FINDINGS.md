# Task 4 — Final Audit (Cowork) = HOLD (return for one targeted patch)

> Role: Cowork final auditor (read-only). Codex was the Task 4 builder (security-layer, per
> `docs/WORKFLOW.md`). I am a different actor, so this approval is valid — but I do not rubber-stamp:
> I re-derived everything from the working tree and did NOT trust the builder report. Reviewed the
> **uncommitted** working tree on 2026-06-01.

## Verdict: HOLD — not clear to commit as-is. One P1 (3 read sites) + one P2 to resolve.

The package is well-built and in scope; the structural/contract work is correct. But the applicant-facing
**read** paths select columns that Task 3's column-grants withhold from `anon`/`authenticated`, so those
reads will throw *permission denied for column* at runtime when used with the user/anon client (the intended
applicant path). No Task 4 gate exercises a live user client, so all gates are green while a security-boundary
read path is broken — exactly the runtime-only trap this workflow exists to catch.

## What is correct (verified independently — do NOT regress)
- **Scope clean:** only `pnpm-lock.yaml` (+ new `packages/adapters/`) changed. `git diff --stat packages/core/src`
  and `git diff --stat supabase` both empty. `@supabase` absent from `packages/core`. No chain SDK / no
  `NEXT_PUBLIC_*SERVICE_ROLE` in adapters. `bash scripts/audit.sh` → AUDIT PASSED.
- **8 adapters implement the 8 frozen ports exactly**; package mirrors `@soulbound/core`.
- **State transitions = ONE rpc each** (`supabase-admission-repository.ts`): submit/start/approve/reject/more_info
  call exactly one `.rpc(...)` with the correct snake_case params; no hand-sequenced table writes. ✓ (the crux)
- **Client boundary** (`clients.ts`): anon / user-JWT-via-Bearer / service-role factories, injected config, no
  global singletons, no `process.env`/`NEXT_PUBLIC` reads. service-role key isolated in its own config type. ✓
- **Error model** (`errors.ts`): `P0002→NOT_FOUND`, `P0001→INVALID_STATE_TRANSITION`, `23505→CONFLICT`,
  else `DEPENDENCY_FAILURE`; throws `AppError` (ports return values/throw — NOT Result). ✓
- **Mappers**: correct snake↔camel; `exactOptionalPropertyTypes`-safe conditional spreads; `reviewSummary`
  only included when the row carries it (no synthesis). ✓
- **Storage** (`supabase-storage-adapter.ts`): private `persona-clips` bucket; 5-min signed URL minted
  server-side, not persisted; `markForDeletion` sets `delete_after`+`deletion_reason` (mark only, deletion is
  Task 9); `supabase.storage` appears ONLY here; no storage_path/raw/URL into audit/outbox. ✓
- **Noop ledger/notification**: return `{chain:"none",status:"skipped"}` / no-op; no network, no SDK. ✓
- **Outbox**: `claimPending` filters `target='internal'` (P0); audit `append` writes codes/ids only with NO
  `idempotency_key` column (consistent with Task 3 schema). ✓
- **Tests** are pure mapper/error/Noop (no live Supabase). ✓

## P1 — BLOCKING (fix before commit / before Task 5 wiring). Applicant-facing reads select withheld columns.
Task 3 `0003_rls.sql` does `revoke all ... from anon, authenticated` then `grant select (<safe list>)`. The safe
lists deliberately EXCLUDE `review_summary` (admission_applications), `role` (profiles), and
`ledger_credential_ref`/`ledger_tx_ref`/`source_application_id` (memberships). Postgres rejects a `SELECT` that
references a column the role lacks privilege on (incl. `*`). So with a user/anon client these throw
`42501 permission denied for column ...`; they only "work" via the service-role client, which would BYPASS RLS
for an applicant read (the worse failure — relies on app-layer trust where the DB should enforce). Three sites:
- `supabase-admission-repository.ts:51` (`findById`) and `:64` (`findActiveByApplicantId`) — `select("*")`
  pulls `review_summary`. (`listReviewQueue` is service-role/reviewer → fine.)
- `supabase-membership-repository.ts:13` (`findByUserId`) — `select("*")` pulls `ledger_*`/`source_application_id`.
- `supabase-auth-adapter.ts` `getRoleForUser` — `select("role")` from `profiles`; `role` is not client-granted.

**Fix direction (small, surgical — do not change frozen core or migrations):**
- Admission/membership user-path reads: select an EXPLICIT safe-column list matching the Task 3 `authenticated`
  grant (omit `review_summary` / `ledger_*` / `source_application_id`). Keep `*` (incl. `review_summary`) only on
  the service-role/reviewer path. This also makes `makeUserScopedAdmissionRepository` vs
  `makeServiceRoleAdmissionRepository` meaningfully different (they are currently identical). The mappers already
  tolerate absent columns (conditional spread), so only the `select(...)` list changes.
- Auth role: read role from the Supabase auth user metadata already returned by signUp/signIn/getUser
  (`app_metadata`/`user_metadata.role`, seeded in Task 3), OR a `security definer` rpc — do NOT `select profiles.role`
  with a user/anon client.

> Note: this is a static inference (sandbox has no live Supabase). It MUST be confirmed and locked by the
> pre-Task-5 committed smoke test (PROJECT_STATE §4): assert an applicant user-client `findById` SUCCEEDS and
> returns NO `review_summary`, and that signIn yields the correct role. The fix + that test close this together.

## P2 — verify (not blocking the patch). Unprobed approve composite shape.
`mapApproveOutcomeRow` assumes `approve_application_tx` returns `{ application: {...}, membership: {...} }`
(nested composite). Plausible for a PostgREST composite return, but not live-probed (Codex noted this honestly).
Add an assertion to the pre-Task-5 smoke test that approve returns and maps both application + membership.

## P3 — minor (non-blocking)
- `supabase-storage-adapter.ts` `put` hardcodes `size_bytes: 0` (PutEvidenceInput carries no size) — placeholder, fine for P0.
- `mappers.ts` `mapAuditLogRow` maps null `reason_code` → `""`; lossy but unused on the write path.

## Disposition
Codex (builder) patches the P1 (3 read sites) only — surgical, no scope/design change, no core/migration edits.
Then I re-audit, and the pre-Task-5 smoke test confirms P1+P2 at runtime. Recommended: patch BEFORE the Task 4
commit so the committed adapter has a correct user-read path (commit `feat(adapters): Task 4 …`, then
`docs: record Task 4 audit`). JT owns the commit call. No self-approval — builder ≠ final approver.

---

# Round 2 re-audit (Cowork) — patch reviewed = HOLD again (1 new P1)

Codex patched the 3 read sites. I re-derived from the working tree (core/supabase diff empty; only the 3
adapter files + a new auth test changed; `audit.sh` PASS). Result: **2 of 3 fixed cleanly; the auth fix
introduced a privilege-escalation vector.**

## Fixed correctly (verified) — do not regress
- **Admission** (`supabase-admission-repository.ts`): `userScopedApplicationSelect` matches the Task 3
  `authenticated` grant exactly (excludes `review_summary`); `serviceRoleApplicationSelect` adds it back;
  injected via constructor; `makeUserScoped…` vs `makeServiceRole…` now genuinely differ. ✓
- **Membership** (`supabase-membership-repository.ts`): `membershipSelect` = the 7 granted columns only
  (no `ledger_*`/`source_application_id`). ✓
- Remaining `select("*")` is only on `persona_clip_assets` (table-level grant) and `outbox_events`
  (service-role only) — both safe. ✓

## P1 — BLOCKING (new). Auth role now trusts user-editable `user_metadata`.
`supabase-auth-adapter.ts` `roleFromMetadata` prefers `app_metadata.role` but **falls back to
`user_metadata.role`** (lines 35–37; used at :59/:77/:94), and the new test asserts this
(`supabase-auth-adapter.test.ts:29` → role `reviewer` from `user_metadata`). `user_metadata` is
**user-editable** (`supabase.auth.updateUser({ data:{ role:"admin" }})`), so any logged-in applicant can
self-promote. This is worse than the original bug: Task 6 routes drive **service-role** writes based on
`session.role`, so a forged role becomes a real approval-authority bypass (RLS/grant protections don't help —
the server acts via service-role on the forged-admin's behalf). The Task 3 seed stores role in
`user_metadata`, so the fallback is the path that returns roles today — the insecure path is the live one.

**Fix direction:**
- Minimum to clear P1: drop the `user_metadata` fallback — read role from `app_metadata.role` ONLY (and fix
  the test). `app_metadata` is service-role/admin-only writable → a trusted authz source.
- Make it actually work (decision owed before Task 6): authoritative role is `profiles.role` (Task 3:
  service-role-only writable). Recommended robust source = a new `security definer` rpc
  `public.current_user_role()` returning `(select role from public.profiles where id = auth.uid())`,
  `grant execute to authenticated`; the auth adapter calls `client.rpc('current_user_role')` on the user
  client (no metadata at all). Alternative = provision role into `app_metadata` via the service-role admin
  API at seed/signup. Either way **role must not come from `user_metadata`**, and the Task 3 seed's
  `raw_user_meta_data.role` should move to the trusted source. (rpc/seed = security-layer → Codex builds, Cowork audits.)

## Still open
- **P2** (approve composite `{application,membership}` live shape) — unchanged; confirm in the pre-Task-5 smoke test.

## Disposition
HOLD. Codex removes the `user_metadata` trust (minimum) and, ideally, wires the trusted role source; then I
re-audit and the pre-Task-5 smoke test confirms P1+P2 at runtime. Do not commit Task 4 while the auth role
path trusts `user_metadata`. Builder ≠ final approver.

---

# Round 3 re-audit (Cowork) — **PASS**. Task 4 adapters accepted; clear to commit.

Codex removed the `user_metadata` trust. I re-derived from the working tree:
- `supabase-auth-adapter.ts` `roleFromAppMetadata` reads **only `app_metadata.role`** (validated to the 4
  UserRole values), else `applicant`. No `user_metadata` anywhere in adapter source (only the test, as a
  forged input). `app_metadata` is service-role/admin-only writable → trusted authz source. ✓
- Test now asserts the secure behavior: `app_metadata.role` honored; a forged `user_metadata.role="admin"`
  is **ignored** → `applicant` (`supabase-auth-adapter.test.ts` "ignores user-editable user metadata role claims"). ✓
- R1 fixes intact (no regression): admission `userScoped`/`serviceRole` select split, membership safe-column
  list. Scope clean: only the auth adapter + its test changed this round; `git diff --stat packages/core/src`
  and `supabase` empty; `@supabase` absent from core; `bash scripts/audit.sh` PASS.

All three P1s (admission read, membership read, auth role) are resolved. **Verdict: PASS — clear for JT to commit.**

### Carry-forward (NOT Task 4 blockers — tracked, scheduled)
1. **P2 — approve composite live shape.** `mapApproveOutcomeRow` assumes `{application,membership}`; confirm
   in the committed **pre-Task-5 smoke test** (PROJECT_STATE §4), which should also assert: applicant
   user-client `findById` succeeds and excludes `review_summary`; column-grant reads work end-to-end.
2. **Trusted role source — before Task 6.** The secure adapter returns `applicant` for everyone until a
   trusted role source exists. The seed currently stores role in `raw_user_meta_data` (user-editable, now
   ignored). Before Task 6, add (security-layer, Codex builds / Cowork audits) EITHER a `security definer`
   `public.current_user_role()` rpc reading `profiles.role` (recommended — single authoritative source), OR
   service-role-managed `app_metadata.role` provisioning; and move the seed role to that source. This is the
   "Codex used a shortcut to fill a missing DB affordance" gap surfaced by Task 4 — resolve it deliberately,
   not via `user_metadata`.

### Commit (JT, host) — clean builder/auditor split
- `feat(adapters): Task 4 Supabase + Noop adapters` → `packages/adapters/**` + `pnpm-lock.yaml`.
- `docs: record Task 4 audit (3 rounds, PASS)` → `docs/TASK4_AUDIT_FINDINGS.md` + `PROJECT_STATE.md`.
Builder ≠ final approver; this PASS is Cowork's (a different actor from the Codex builder/patcher).
