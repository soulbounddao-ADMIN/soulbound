# Task 3 — Final Audit (Cowork) + Fix-Round Builder Prompt

> Role: [3] Final Auditor (= Architect). Read-only semantic audit over the builder's Task 3 SQL.
> First pass: Codex returned **FAIL**. This document is my independent verification of each finding
> against source (I re-read the actual files, did not trust the report), my verdict, the architect
> decisions needed to fix the contract-level issue, and the copy-paste FIX prompt for the builder.
> Decisions here are the source of truth (PROJECT_STATE §3/§4 updated to match). 2026-06-01.

## VERDICT: FAIL (concur with Codex) — reject to [1] Builder

The DB layer largely exists and the structural gates passed (`supabase db reset` clean, 19 core tests
still green, `audit.sh` PASS, `security definer`+`set search_path=''`+`REVOKE` on all 5 rpc, RLS enabled
on every table, `audit_logs`/`outbox_events` have no client policy). **ADD-1 was followed** (rpc guards
match `admission-policy.ts` 1:1) and **ADD-2 was followed** (local Docker only). But the green gates do
not exercise the rpc, so two defects that break the *core* deliverable slipped through, plus three
RLS/correctness P1s and one process violation.

---

## Findings (all independently verified by me)

### P0-1 — BLOCKING. Every rpc throws on first real call (audit_logs has no idempotency_key).
- `audit_logs` is defined WITHOUT an `idempotency_key` column — `supabase/migrations/0001_phase1_schema.sql:102-122`.
- All 5 rpc functions INSERT `idempotency_key` into `audit_logs` — `0004_rpc.sql:73, 157, 271, 289, 395, 493`
  (line 302 even writes `p_idempotency_key || '.membership'`).
- plpgsql resolves column refs at *runtime*, so `db reset` created the functions fine and no test calls
  them — the breakage is latent. The first actual submit/approve/etc. errors: *column "idempotency_key"
  of relation "audit_logs" does not exist*.
- **Fix (DEC-3): remove `idempotency_key` from the 6 `audit_logs` INSERTs.** The frozen persisted shape
  `AuditLogEntry` (`packages/core/src/domain/audit/types.ts:30-42`) has NO `idempotencyKey`, so the schema
  is correct and the rpc is wrong. Do NOT "fix" it by adding the column — that breaks Task 4 adapter parity.
  Idempotency is already enforced upstream by `admission_events.idempotency_key UNIQUE` (the rpc checks it
  first and returns current state). audit_logs needs nothing.

### P0-2 — BLOCKING. rpc writes reason codes that are not in the frozen enum (INV-22).
- `submit_application_tx` writes `'application_submitted'` (`0004_rpc.sql:68, 79`); `start_review_tx`
  writes `'review_started'` (`0004_rpc.sql:152, 163`).
- Frozen `AdmissionReasonCode` has exactly 7 values and neither of those — `types.ts:20-27`. INV-22:
  "the ONLY reason representation that flows into admission_events / audit_logs."
- **Root cause is mine, not just the builder's.** Frozen `SubmitApplicationCommand` / `StartReviewCommand`
  carry NO `reasonCode` (`types.ts:56-71`) — submit/start-review have no decision reason. But my Appendix A
  specced `reason_code text NOT NULL`, so the builder invented codes to satisfy NOT NULL instead of stopping
  on the frozen-vs-spec conflict (the watch-item it should have raised). GLM papered over it; that habit is
  why this round failed.
- **Fix (DEC-1 + DEC-2):**
  - DEC-1: do NOT add submit/review members to `AdmissionReasonCode` (that is unfreezing the contract — forbidden).
  - DEC-2: make `admission_events.reason_code` and `audit_logs.reason_code` **NULLABLE**. submit/start_review
    write `NULL` (no decision reason); approve/reject/request_more_info write the enum value. Add a DB CHECK on
    both columns — `reason_code IS NULL OR reason_code IN (<the 7 frozen values>)` — so INV-22 is finally
    enforced in the database (today it is unconstrained `text`, which is its own weakness). A NULL reason is
    the *absence* of a reason, not a free-text reason, so this is INV-22-consistent.

### P1 — Applicant can read `review_summary` (admin-internal leaks to applicant).
- `review_summary` lives on `admission_applications` (`0001:41`); the applicant SELECT policy exposes the
  WHOLE own row (`0003_rls.sql:40-43`). RLS filters rows, not columns — the inline comment claiming
  "review_summary is NOT client-readable" (`0003:47`) is not enforced. Violates INV-16 / §3.7 / §7.4
  (only `applicant_notice` is applicant-facing).
- **Fix (DEC-4): column-level privileges.** `REVOKE SELECT ON public.admission_applications FROM authenticated;`
  then `GRANT SELECT (<every column EXCEPT review_summary>) ...`, keeping the own-row RLS policy. (A safe
  applicant-facing view is an acceptable alternative.) reviewer/admin still read everything via service_role.

### P1 (security — treat as P0-adjacent) — "limited update" RLS does not limit columns; self-promotion possible.
- `profiles` update policy is `using/with check (auth.uid() = id)` only (`0003_rls.sql:27-34`). Nothing stops
  an authenticated user from `UPDATE profiles SET role='admin'` or `membership_status='active'` on their own
  row — i.e. self-promote to admin and **bypass the entire admission/trust model**. The "only safe columns"
  comment is not enforced.
- Same class on `admission_applications` draft update (`0003:48-55`): `status` happens to be pinned by the
  `with check (status='draft')`, but `reviewer_id`, `reviewed_at`, `review_summary`, `applicant_notice`,
  `policy_version`, ledger/clip fields remain client-writable.
- **Fix (DEC-4): column-level privileges, not RLS.** `REVOKE UPDATE ... FROM authenticated;` then
  `GRANT UPDATE (handle, display_name, bio, avatar_url) ON public.profiles TO authenticated;` and
  `GRANT UPDATE (applicant_statement, motivation, referral_code) ON public.admission_applications TO authenticated;`
  Keep the row-level RLS policies as the row gate. (`membership_status`, `role`, status/reviewer fields → service_role only.)

### P1 — `approve_application_tx` records wrong `from_status` (approved→approved).
- The UPDATE sets `status='approved'` and `returning * into v_app` (`0004_rpc.sql:239-247`), so `v_app.status`
  is already `'approved'` when used as `from_status` for the event (`:265`) and audit metadata (`:279`).
  Result: `from_status='approved'`, corrupting the state-change log. `reject_application_tx` does it right —
  it captures `v_from_status` BEFORE the update (`:372`).
- **Fix (DEC-5): capture `v_from_status := v_app.status;` before the UPDATE, mirror reject.**

### P1 (process) — Builder went out of scope and corrupted the canonical prompt doc.
- `docs/TASK3_BUILDER_PROMPT.md` is scrambled: Appendix-A content sits where the §1 COPY-PASTE block
  should be (broken fragment ~`:34`) and the prompt is jammed mid-Appendix-D with a broken code fence
  (~`:206`); `git diff --stat` shows a 132/132 rewrite, far beyond my ~21-line ADD-1/ADD-2 insertion.
  Task 3 scope was `supabase/` only. (My ADD edits were clean and verified; the scramble is the builder's.)
- **Fix (DEC-6): restore the doc + add ADD-3 scope guard.** See "Doc restoration" below. Re-run prompt forbids
  touching anything outside `supabase/`.

### P2 (non-blocking, note only) — idempotency key is globally unique, not per-applicant.
- `admission_events.idempotency_key UNIQUE` is global; two different applicants reusing a key would collide
  and the second would receive the first's application on the idempotent-replay path. Keys are expected
  unique per request, so this is low-risk. Optional: scope the dedup to `(applicant_id, idempotency_key)`.
  Do not block the fix round on this.

---

## What was correct (do NOT regress in the fix round)
- 5 rpc each `language plpgsql` + `security definer` + `set search_path=''` + `REVOKE EXECUTE ... FROM anon, authenticated, public`.
- Status guards match `admission-policy.ts` 1:1 (ADD-1 honored). RLS enabled on every table.
- `audit_logs`/`outbox_events` have zero client policies (INV-10). No `commit`/`rollback` tokens, no plaintext/key columns (audit.sh PASS).
- approve = one atomic call: app update + membership insert + profile update + events + audit + clip mark; reject/approve mark `delete_after`+`deletion_reason`, more_info does not (INV-PC-09).

---

## FIX-ROUND PROMPT (copy-paste to the builder — Claude Code + GLM)

```text
Task 3 FIX round — the audit (Codex first pass + Cowork final, docs/TASK3_AUDIT_FINDINGS.md) returned FAIL.
Fix ONLY the items below. SQL/config under supabase/ ONLY. The migrations 0001–0005 + seed are NOT yet
committed, so EDIT THEM IN PLACE (db reset re-applies from scratch) — do NOT stack patch-migrations.

ADD-3 (scope): Do NOT modify ANY file outside supabase/. Specifically do NOT touch packages/core/src
(frozen, 19 green), any 0C toolchain file, or ANY doc (including docs/TASK3_BUILDER_PROMPT.md). The doc
will be restored separately by the architect. Last round corrupted it by going out of scope — do not repeat.

FIX-1 (P0, audit_logs.idempotency_key): Remove `idempotency_key` from ALL audit_logs INSERTs in
0004_rpc.sql (6 sites incl. the `|| '.membership'` one). Do NOT add an idempotency_key column to audit_logs
— the frozen AuditLogEntry has none and Task 4 maps to it. Idempotency stays enforced by
admission_events.idempotency_key UNIQUE (keep the existing early-return check).

FIX-2 (P0, reason_code vs frozen enum): Do NOT invent reason codes and do NOT add members to the frozen
AdmissionReasonCode. Instead:
  - 0001: make admission_events.reason_code and audit_logs.reason_code NULLABLE (drop NOT NULL).
  - 0001: add a CHECK on BOTH columns: reason_code IS NULL OR reason_code IN
      ('meets_phase1_policy','insufficient_context','mismatch_with_policy','needs_identity_clarification',
       'duplicate_identity_suspected','applicant_withdrew','application_expired').
  - 0004: submit_application_tx and start_review_tx write reason_code = NULL on both the event and the audit
      row (delete 'application_submitted' / 'review_started'). approve/reject/request_more_info keep passing
      p_reason_code (the service constrains it to AdmissionReasonCode).

FIX-3 (P1 security, column-restricted writes): RLS cannot restrict columns. In 0003 (or a new privileges
section), use column privileges and KEEP the row-level policies:
  - REVOKE UPDATE ON public.profiles FROM authenticated;
    GRANT UPDATE (handle, display_name, bio, avatar_url) ON public.profiles TO authenticated;
  - REVOKE UPDATE ON public.admission_applications FROM authenticated;
    GRANT UPDATE (applicant_statement, motivation, referral_code) ON public.admission_applications TO authenticated;
  membership_status, role, status, reviewer_id, reviewed_at, review_summary, etc. → service_role only.

FIX-4 (P1 privacy, review_summary hidden from applicant): RLS can't hide a column. In 0003:
  - REVOKE SELECT ON public.admission_applications FROM authenticated;
    GRANT SELECT (<every column EXCEPT review_summary>) ON public.admission_applications TO authenticated;
  Keep the own-row RLS select policy. reviewer/admin read review_summary via service_role server routes.
  (A safe applicant view is an acceptable alternative — but review_summary must never reach an applicant client.)

FIX-5 (P1, approve from_status): In approve_application_tx, capture `v_from_status := v_app.status;` BEFORE
the UPDATE and use it as the event from_status and in the audit metadata (mirror reject_application_tx).

ACCEPTANCE (report each verbatim):
  supabase db reset                 # clean apply, local Docker only — do NOT link/push any cloud project
  pnpm -r typecheck                 # CLEAN (no TS changed)
  pnpm -F @soulbound/core test      # 19 GREEN, 0 skipped (must NOT regress)
  pnpm -F @soulbound/core build     # unchanged
  bash scripts/audit.sh             # AUDIT PASSED
  git diff --stat packages/core/src # MUST be empty
  git status --short                # ONLY supabase/ files changed; no docs, no core
Then STOP and hand back the migration diff. Do NOT self-approve. Codex first pass → Cowork final.
```

---

## Doc restoration (architect-owned; host action)
`docs/TASK3_BUILDER_PROMPT.md` is corrupted in the working tree — **do not paste from it.** Restore the exact
committed version on the host, then I re-apply ADD-1/ADD-2 and correct Appendix A:

```bash
git checkout HEAD -- docs/TASK3_BUILDER_PROMPT.md   # host terminal (sandbox .git is locked)
```

After restore I will (a) re-add the ADD-1/ADD-2 reinforcement block, and (b) fix the Appendix A spec bug:
change `admission_events` / `audit_logs` `reason_code text not null` → nullable + the enum CHECK, so the spec
itself no longer collides with the frozen contract (the root cause of P0-2).

---

# Round 2 — Codex clean reimplementation: FINAL AUDIT (Cowork) = **PASS**

> Round 1 (GLM) was discarded; Task 3 was reimplemented from a clean post-Task-2 state by **Codex**
> (one-time exception per `TASK3_REIMPLEMENTATION_DECISION.md`). I (Cowork) am a different model from
> the implementer, so this final approval respects the builder≠auditor rule. Reviewed **uncommitted**
> working tree on 2026-06-01. I re-read every file and re-derived the facts; I did not trust the
> implementer's self-report (Round 1's lesson: green `db reset` hides runtime-only RPC failures).

## Verdict: PASS — clear to commit, then proceed to Task 4. No blocking defects found.

### How I verified (independent)
- Full line-by-line read of `supabase/{config.toml, migrations/0001–0005, seed.sql}`.
- Deterministic column/enum cross-reference script over schema↔RPC: **0 column-existence problems**
  across all 13 RPC inserts; **6/6** `audit_logs` inserts free of `idempotency_key`; **0** invented
  reason codes; `reason_code` nullable+CHECK on both event/audit tables; `security definer`+
  `search_path=''`+`revoke`/`grant` on all 5 RPC.
- `bash scripts/audit.sh` → **AUDIT PASSED** with the `supabase/migrations` checks now ACTIVE
  (no plaintext/key columns; no commit/rollback tokens). Zero concrete-chain tokens in `supabase/`.
- `git diff --stat packages/core/src` empty; `docs/` diff empty (prompt intact, no scope drift).

### Each Round-1 finding — confirmed fixed
| # | Round-1 finding | Round-2 status | Evidence |
|---|---|---|---|
| P0-1 | `audit_logs` insert of nonexistent `idempotency_key` | FIXED | audit inserts are `(actor_id, action, entity_type, entity_id, reason_code, metadata)` only; idempotency via `admission_events.idempotency_key UNIQUE` checked first |
| P0-2 | invented reason codes `application_submitted`/`review_started` | FIXED | submit/start_review write `reason_code = null`; decisions validate against the 7 frozen values inline + DB CHECK |
| P1 | `review_summary` readable by applicant | FIXED | `grant select(...)` on `admission_applications` omits `review_summary` (and `role` on profiles) |
| P1 | column-unrestricted updates (self-promote to admin) | FIXED | `revoke all ... from authenticated` + `grant update(handle,display_name,bio,avatar_url)` / `(applicant_statement,motivation,referral_code)` only |
| P1 | approve `from_status` recorded as approved→approved | FIXED | `v_from_status := v_app.status` captured before the UPDATE (0004:295), mirrored in reject/more_info |
| P1 | builder corrupted `TASK3_BUILDER_PROMPT.md` | RESOLVED | prompt restored; Codex stayed in scope (`supabase/` only) |

### Decision-doc review checklist (TASK3_REIMPLEMENTATION_DECISION.md §Review)
scope control ✓ · RLS semantics ✓ (column-grant, not row-policy, for column protection) · RPC guards 1:1
with `admission-policy.ts` ✓ · idempotency schema-consistent ✓ · `review_summary` non-exposure ✓ ·
restricted-column non-mutability ✓ · Persona Clip terminal retention ✓ (approve/reject mark
`delete_after`+`deletion_reason`; more_info does not) · `packages/core/src` untouched ✓ · no Task 4 leakage ✓.

### Caveat + one recommendation (non-blocking)
- **Runtime gates are host-only.** A faithful run of `supabase db reset` + actual RPC execution + RLS
  enforcement under real `anon`/`authenticated`/`service_role` needs the Supabase/Docker stack; the
  sandbox has no Postgres. Codex reported these green and my static cross-ref corroborates RPC
  correctness, but I could not re-execute them here.
- **Recommend before/with Task 4: commit a reproducible smoke/integration test** (e.g. a SQL or pgTAP
  script under `supabase/tests/`) that drives submit→start_review→approve/reject/more_info and asserts
  RLS denials (applicant cannot read `review_summary`; cannot update `role`). Codex's smoke test was
  ad-hoc/uncommitted. This is the durable guard against exactly the Round-1 trap (green `db reset` ≠
  correct RPC) and turns "looks right" into "stays proven."

### Minor notes (P3, non-blocking)
- `request_more_info_tx` sets `reviewed_at` on a non-terminal transition — cosmetic.
- `evidence_files` stub carries `ipfs_cid`/`filecoin_deal_id`/`arweave_tx_id` columns — inert and
  sanctioned by the frozen outbox `target` enum (`internal|external_ledger|icp|filecoin|arweave`); no
  logic/adapters → HARD RULE 9 (no IMPLEMENTATION) holds.
- Double-submit with a different idempotency key surfaces a raw unique-violation from the
  one-active-application partial index; the service layer maps it to a domain error in Task 5.
