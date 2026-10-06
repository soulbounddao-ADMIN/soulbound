# Pre-Task-5 Smoke Test — Audit Findings (final auditor record)

> Artifact under audit: `supabase/tests/pre_task5_rpc_rls_smoke.sql` (41 pgTAP assertions).
> Spec/builder prompt: `docs/PRE_TASK5_SMOKE_TEST_PROMPT.md`.
> Builder: **Codex** (security layer / DB). Final auditor: **Opus audit session** (separate from builder).
> Verdict: **PASS** (R3). Commit by **JT** (host). Builder ≠ final approver invariant preserved (WORKFLOW §2).

This is the mandatory Task-5 gate (PROJECT_STATE §4): a committed, reproducible test that proves the
Task-3 rpc/RLS contract **at call time**, closing the Round-1 trap (`supabase db reset` passes while the
runtime contract is broken — plpgsql column/type/permission errors surface only when the function is called).

---

## Audit method (host-independent re-derivation — not a rubber stamp)

The auditor cannot run `supabase db reset` / `supabase test db` (host-only, Docker). So every claim was
re-derived statically against the migrations + seed, and corroborated against the builder's reported run:

- Cross-checked **every** RPC call (arg count/type), column reference, enum value, audit `action` string,
  and seed UUID in the test against `supabase/migrations/0001–0005` + `seed.sql`. All consistent.
- Re-traced **both** partial unique indexes
  (`admission_applications_one_active_per_applicant_idx`, `memberships_one_active_per_user_idx`) across the
  full statement sequence for **both** applicants (seeded `…0003`, test-inserted `…0004`).
- Verified each `42501` assertion depends on a **withheld GRANT** (column/table), not merely an RLS row
  policy — the exact Task-3 R1 confusion ("RLS row policy mistaken for column protection").
- Independent assertion count = **41** = reported `Tests=41`. Static reachability of all 41 ⇒ consistent
  with "all successful" (an abort would have run far fewer).
- `bash scripts/audit.sh` PASS (run directly). Scope = only `supabase/tests/pre_task5_rpc_rls_smoke.sql`;
  `git diff --stat` of `packages/core/src` and `supabase/migrations` empty; no `.skip/.only/.todo`.

---

## Round 1 — P0 blocker (found by auditor cross-check; fixed by builder)

**[P0 / blocker] Partial-unique-index collision aborts the test before the RLS half runs.**
- The bogus-reason sub-test left its fixture application parked in `under_review`, holding applicant
  `…0003`'s slot in `one_active_per_applicant`; the next `submit_application_tx` for `…0003` then violated
  the index (23505) and aborted the whole transaction — so the security-critical `authenticated`-session
  RLS assertions (the entire point of the gate) **never executed**. A second latent collision existed on
  `one_active_per_user` (a second `approve` for `…0003` → second active membership).
- This is precisely the runtime-only failure class the gate exists to catch, and it was invisible to the
  builder because the local Docker runtime was down at first-build time.
- **Builder fix (fixtures only):** (a) terminalize the bogus-reason app with a valid `reject` before the
  next submit; (b) move the persona-clip *approve* fixture (and its clip) to applicant `…0004` so the
  seeded applicant never gets a second active membership. Re-traced: max 1 active app / 1 active membership
  per applicant throughout. Resolved.

## Round 2 — auditor findings (explicit spec requirements not genuinely asserted)

- **[#2 · MEDIUM] `storage_path` minimization assertion was vacuous.** It ran *before* any clip existed and
  before any clip-bearing approve/reject, so it proved nothing about INV-16/INV-PC-06 (no `storage_path` in
  `audit_logs`). The invariant held in the RPCs, but the test gave false confidence — the §6 "passes
  mechanically, semantically empty" failure mode. **Fix:** relocated the check to *after* both clip
  approve and clip reject have run.
- **[#3 · LOW–MED] approve composite `.membership` sub-field never asserted ⇒ carry-forward P2 only
  half-closed.** Only `((r).application).status` was read from the composite; the membership half (the exact
  shape the Task-4 adapter mapper consumes) was checked via table query, not the composite accessor.
  **Fix:** added `((r).membership).status='active'`, `.tier='basic'`, `.id is not null` (via the idempotency
  replay path, which populates `.membership` identically). **P2 now fully closed.**
- **[#4 · LOW] No positive proof the `authenticated` session resolved.** Own-row and other-row visibility
  assertions would pass vacuously if the JWT-claims wiring failed (`auth.uid()` → null). **Fix:** added
  `auth.uid() = …0003` and own-application `count(*) = 1` assertions, so a claims regression fails loudly.

## Round 3 — clean (PASS)

All three findings addressed, fixtures only, no regression in the index trace / clip ownership / idempotency
counts / RLS set. Count 36 → 41 (+3 composite, +2 authenticated positive). Verdict **PASS**.

---

## What this gate proves (and what it does NOT)

**Proves at runtime, as a real `authenticated` applicant (`set local role authenticated` + JWT claims):**
- service-role RPC flow: submit → start_review → approve (composite `.application` + `.membership`) →
  reject → request_more_info; idempotency replay with no duplicate event/membership/audit rows;
  P0001 (invalid state / bad reason), P0002 (missing); content minimization (no `review_summary`, no
  `storage_path` in audit); persona-clip terminal **mark-only** (`delete_after` + `deletion_reason`).
- RLS/column boundary: applicant cannot read `review_summary`, `profiles.role`,
  `memberships.{source_application_id,ledger_credential_ref}`, `audit_logs`, `outbox_events` (all `42501`);
  cannot self-write `profiles.{role,membership_status}`; cannot `EXECUTE` the rpcs directly; sees own
  application (1 row) but not another applicant's (0 rows).

**Does NOT fix (residual, tracked):**
- **Trusted role source (carry-forward ②, before Task 6).** The test only *documents* the current state —
  seed roles live in `user_metadata` + `profiles.role`, with **no** trusted `app_metadata.role`. Moving to a
  trusted source (security-definer `current_user_role()` rpc or service-role `app_metadata` injection) is a
  separate security-layer task (Codex builds, Opus audits). "Applicant cannot approve" is proven here only
  via DB `EXECUTE`-deny; the service-layer `canReview` guard is Task 5.

## Runtime confirmation (host-only)

Auditor corroborated statically + via the 41-count match + `audit.sh`. The actual green
(`supabase db reset` → `supabase test db`, Files=1/Tests=41) is host-only; **JT re-confirms it on the host at
commit time** (WORKFLOW §5: runtime claims require a committed test *and* a real green run).
