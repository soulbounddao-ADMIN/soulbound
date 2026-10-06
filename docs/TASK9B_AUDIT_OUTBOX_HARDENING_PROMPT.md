# Task 9b — Audit/outbox hardening (regression-lock) — spec + Codex builder prompt (Cowork-authored)

> Closes Task 9 (with 9a). **This is deliberately THIN.** The hardening invariants (원문금지 / idempotency / INV-13 /
> reason-enum) are **already enforced and already tested** (map below). 9b adds the **one missing regression-lock**
> (the outbox payload shape) + a coverage map, and otherwise **does NOT rebuild what is covered** (HARD RULE 10 —
> no overbuild).
>
> **Builder = Codex** (per WORKFLOW §8). Final audit = **Opus audit session**. JT commits. Deterministic
> (mock-based core unit test, no live DB) → **no 5×+reset host gate**; the existing live gates are unchanged.

## 0. What is ALREADY locked (re-derived — do NOT re-implement or duplicate)
- **idempotency** — `supabase/tests/pre_task5_rpc_rls_smoke.sql`: "approve_application_tx idempotency replay returns
  the same application" + "…does not duplicate admission_events / membership rows / approve audit rows" (lines ~236–276).
- **원문금지 (audit)** — same smoke file: "audit metadata does not include review_summary text" (~376) and "audit
  metadata does not include persona clip storage_path after clip approve/reject" (~541). Plus the 6a/6b/7a/reap
  integration tests assert no `storage_path` / signed URL / token in `audit_logs.metadata` + `outbox_events.payload`.
- **no free-text into the tx** — `admission-service.test.ts`: "INV-22: reasonCode enum flows; no free-text `reason`
  leaks into the tx payload" (~200) + the reject test asserts `arg.reason` is undefined (~247).
- **INV-13 (failure tolerance)** — `admission-service.test.ts`: "INV-13: an outbox/ledger failure does NOT roll back
  the committed approval" (~215).
- **reason-enum guard** — `scripts/audit.sh` "FROZEN no free-text reason field".
- **In P0 the outbox never runs** — the enqueue is gated by `flags.externalLedgerEnabled` (false on main).

## 1. The ONE genuine gap (the only new test 9b adds)
The approve post-step enqueues an outbox event with payload `{ applicationId, membershipId, userId, policyVersion }`
(ids/refs only, by construction — `admission-service.ts` ~205). **Nothing asserts this shape.** The INV-13 test flips
`externalLedgerEnabled: true` but mocks `enqueue` to *reject* (failure path) — it never inspects the payload. So a
future change that slips `applicantStatement` / `motivation` / `reviewSummary` / `applicantNotice` / a storage path
into the outbox payload would pass every test. 9b locks it.

## 2. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 9b — audit/outbox hardening regression-lock. This is intentionally SMALL. Do NOT add new machinery, new
runtime code, migrations, routes, or duplicate existing assertions. Implement ONLY the one regression-lock test
below. Do NOT touch packages/core/src (non-test) — the service is frozen-correct; you only add a test.

Read first: packages/core/src/domain/admission/admission-service.ts (the approve post-step enqueue payload, gated by
flags.externalLedgerEnabled), packages/core/src/domain/admission/admission-service.test.ts (the existing INV-13 test
+ the createMocks/makeApplication/decision helpers — reuse them; do NOT duplicate them).

Add ONE test to admission-service.test.ts (reuse the existing harness):
  it("INV-16: the outbox payload carries ids/refs only — no free-text or PII", ...):
    - createMocks with flags { ...featureFlags, externalLedgerEnabled: true } and an under_review application that
      ALSO carries free-text fields (applicantStatement, motivation) + (if the model has them) reviewSummary /
      applicantNotice, so the test would catch them leaking.
    - approve via the service (enqueue resolves normally this time — do NOT mock it to reject).
    - assert outboxRepo.enqueue was called once, and the call's payload keys are a subset of
      { applicationId, membershipId, userId, policyVersion } (assert exact key set), AND that JSON.stringify(payload)
      contains NONE of the free-text/PII values you put on the application (no applicantStatement/motivation/
      reviewSummary/applicantNotice text, no storage_path). Also assert the event target is "external_ledger" and the
      idempotencyKey is the command's key.

FORBIDDEN (violation = redo / overbuild):
 - adding migrations, routes, runtime code, or any new file beyond the test edit;
 - duplicating the already-covered assertions (idempotency replay, INV-13 rollback, audit no-leak, reason-enum) —
   cite them, don't re-add them;
 - editing packages/core/src non-test files, services, adapters, supabase/, or the UI.

GATE (deterministic — no live DB):
 - pnpm -F @soulbound/core test green (incl. the new test); pnpm -r typecheck / build clean; bash scripts/audit.sh
   PASS. The existing live gates (supabase test db 73, web/adapters integration) are UNCHANGED by construction — a
   single confirming run is enough (no 5x needed; 9b touches no live surface).

ACCEPTANCE (report verbatim):
 - pnpm -F @soulbound/core test (count), typecheck, build, audit.sh;
 - git status --short shows ONLY packages/core/src/domain/admission/admission-service.test.ts;
 - git diff --stat packages/core/src (non-test) supabase apps/web packages/adapters/src => EMPTY.
STOP and report. Do not self-approve - Opus finals, JT commits.
```

## 3. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add Task 9b hardening regression-lock prompt`.
2. Paste §2 into **Codex**. Codex adds the one test, STOPS.
3. **Opus audit session finals**: verify the test genuinely fails if a PII field is added to the payload (i.e. it's a
   real lock, not vacuous — the asserted key-set is exact and the free-text values are checked absent); scope (only
   the test file changed); the existing locks are cited not duplicated; gates green. Opus also writes the **Task 9
   hardening coverage map** (consolidating §0 + this lock) into the audit record so "Task 9 complete" is auditable.
4. On PASS, JT commits: `test(core): lock outbox payload to ids/refs only (INV-16)` → `docs: record Task 9b audit pass`.
   **Task 9 complete.**

## 4. Out of scope / notes (Cowork)
- This task is small **on purpose** — the prior tasks (7a runtime no-leak, the smoke pgTAP, the core service tests)
  already did the hardening. 9b only pins the one un-pinned surface (the outbox payload) so a future regression is
  caught, and records the coverage map. Resisting the urge to "add more tests for completeness" IS the correct call
  here (HARD RULE 10).
- 9a-2 (internal cron route wrapping the CLI) and Task 10 (external ledger) remain separate/deferred.
