# Pre-Task-5 Smoke Test — spec + Codex builder prompt (Cowork-authored)

> **Mandatory gate before Task 5** (PROJECT_STATE §4). A committed, reproducible `supabase/tests/` pgTAP
> test that proves the Task 3 rpc/RLS contract **at call time**, not just at `supabase db reset` — closing
> the exact Round-1 trap (green apply, broken runtime) and locking the two Task-4 carry-forwards:
> **P2** (approve composite shape) and the **R1 `review_summary`-hiding** column-grant boundary.
>
> **Workflow (risk-tiered, `docs/WORKFLOW.md`):** DB/RLS = security layer → **Codex builds**, **Cowork
> audits** (separate session), **JT commits**. The builder does not self-approve.
>
> **Non-negotiable design point:** the RLS half (Set B) MUST run as a **real `authenticated` applicant
> session** (`set local role authenticated` + jwt claims so `auth.uid()` = the applicant). Run it as
> `postgres`/superuser and it proves nothing — superuser bypasses RLS and column grants.

---

## 0. Grounded contract the test asserts against (verified from migrations/seed — NOT memory)

Re-verified against `supabase/migrations/0001–0005` + `supabase/seed.sql` at HEAD `4de4513`:

- **RPCs** (`0004_rpc.sql`): 5 functions `submit_application_tx`, `start_review_tx`,
  `approve_application_tx`, `reject_application_tx`, `request_more_info_tx`. All `security definer` +
  `set search_path=''`; EXECUTE **revoked from anon/authenticated/public, granted to `service_role` only**
  (5 revoke / 5 grant). The rpcs do **not** check actor role internally.
- **approve composite** (`0004_rpc.sql:1`): `create type public.approve_outcome as (application
  public.admission_applications, membership public.memberships)` → confirms the adapter mapper's
  `{ application, membership }` shape (carry-forward **P2**).
- **Error codes**: `P0002` → not found; `P0001` → invalid state transition / invalid reason code.
  **Idempotency**: replay keyed on `admission_events.idempotency_key` (duplicate key returns current
  state, no second side effects).
- **Column grants** (`0003_rls.sql`): `authenticated` SELECT excludes `review_summary` (on
  `admission_applications`), `role` (on `profiles`), and `source_application_id` / `ledger_credential_ref`
  / `ledger_tx_ref` (on `memberships`). `authenticated` UPDATE on `profiles` = only
  `handle/display_name/bio/avatar_url` (so `role` / `membership_status` are NOT self-writable). `audit_logs`
  and `outbox_events` have **no** client policy (all client access denied).
- **Seed** (`seed.sql`): admin `…0001` / reviewer `…0002` / applicant `…0003`, password `password123`.
  Role lives in `raw_user_meta_data` + `profiles.role`, **NOT** `app_metadata` → the secure Task-4 auth
  adapter resolves everyone to `applicant` until a trusted role source is added (carry-forward #2, a
  separate before-Task-6 security-layer task — do NOT fix it here).
- **"Applicant can't approve"** is enforced by (a) DB EXECUTE = `service_role`-only **and** (b) the
  service-layer `canReview` guard (Task 5, not DB). This test can only assert **(a)** — make that explicit.

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task — Pre-Task-5 smoke test (security layer / DB). Implement ONLY this; do not advance to Task 5.

Implement a committed, reproducible pgTAP smoke test under supabase/tests/ that proves the Task 3
rpc/RLS contract AT RUNTIME (call-time, not just apply). This is the mandatory gate before Task 5.
Env: local Postgres via `supabase db reset` then `supabase test db`. Seed = supabase/seed.sql
(admin …0001 / reviewer …0002 / applicant …0003, password123). Use the REAL object names from
supabase/migrations/0003_rls.sql + 0004_rpc.sql; read them first, do not guess.

A) As service_role (the 5 rpcs are service_role-only EXECUTE):
   - submit_application_tx → status 'submitted'; start_review_tx → 'under_review';
   - approve_application_tx → assert the approve_outcome COMPOSITE:
       (r).application.status='approved' AND (r).membership.status='active' AND (r).membership.tier='basic';
       a memberships row exists; profiles.membership_status='active';
       exactly 2 audit_logs rows (action 'application.approved' AND 'membership.issued');
   - reject_application_tx → 'rejected'; request_more_info_tx → 'needs_more_info';
   - idempotency: re-call with the SAME p_idempotency_key → returns the same application id, NO duplicate
     admission_events / membership / audit row;
   - errors: approve an already-approved app → P0001; approve a missing uuid → P0002; pass a bogus
     p_reason_code → P0001;
   - content minimization: admission_events + audit_logs.metadata carry only codes/ids/status — assert NO
     review_summary text, NO free-text reason, NO storage_path appears in them;
   - persona clip: for an application with a persona_clip_asset_id, after approve/reject the clip row has
     delete_after set AND deletion_reason IN ('application_approved','application_rejected') (mark only —
     the row is NOT deleted here).

B) As a REAL authenticated applicant (…0003) — MUST set local role + jwt claims, NOT superuser:
     set local role authenticated;
     set local request.jwt.claims = '{"sub":"<applicant …0003 uuid>","role":"authenticated"}';
   Assert:
   - SELECT of the Task-3 safe columns on the applicant's OWN application SUCCEEDS;
   - SELECT review_summary FROM admission_applications (own row) → error 42501 (permission denied for column);
   - SELECT on ANOTHER applicant's application → 0 rows (RLS, not error);
   - SELECT role FROM profiles → 42501; UPDATE profiles SET role='admin' WHERE id=auth.uid() → denied and
     role stays 'applicant'; UPDATE profiles SET membership_status='active' → denied;
   - calling approve_application_tx(...) directly → 42501 (EXECUTE denied to authenticated);
   - SELECT source_application_id / ledger_credential_ref FROM memberships → 42501;
   - SELECT FROM audit_logs and FROM outbox_events → denied (no rows / permission denied).

C) Role-source reality check (document, do NOT fix here): assert app_metadata has no role and
   profiles.role IS populated for the seeded users — label this the before-Task-6 trusted-role-source gate.

FORBIDDEN (violation = redo):
 - editing supabase/migrations/0001–0005, supabase/seed.sql, packages/core/src/**, or packages/adapters/**;
 - weakening ANY grant/policy/rpc to make a test pass;
 - running Set B/C as postgres/superuser/service_role (they MUST run as authenticated — else the test is meaningless);
 - implementing the trusted-role-source fix or any Task 5 wiring.

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` → ALL pgTAP green;
 - `git status --short` shows ONLY supabase/tests/** (plus, if strictly needed, a minimal supabase/config.toml
   test-wiring line) — nothing else;
 - `git diff --stat packages/core/src` and `git diff --stat supabase/migrations` empty;
 - `bash scripts/audit.sh` PASS.
STOP and report. Do not self-approve — Cowork (separate session) audits, JT commits.
```

---

## 2. Dispatch + commit (JT, host)

1. Commit this spec doc + the PROJECT_STATE correction (below): `docs: add pre-Task-5 smoke test spec + correct Task 4 status`.
2. Paste §1 into the Codex builder. Codex builds `supabase/tests/**`, runs the gates, STOPS.
3. Cowork (separate session) audits: confirms Set B truly runs as `authenticated` (not superuser), the
   42501 assertions are real, the composite + idempotency + content-minimization checks hold, scope =
   `supabase/tests/` only.
4. On PASS, JT commits: `test(db): pre-Task-5 rpc+RLS smoke test` → then `docs: record pre-Task-5 smoke gate pass`.
5. Then Task 5 (service wiring) may begin.
