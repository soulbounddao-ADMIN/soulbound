# Task 9b — Audit/outbox hardening (regression-lock) — Audit Findings (final auditor record)

> Builder: **Codex**. Final auditor: **Opus audit session**. Verdict: **PASS** (one regression-lock test;
> Cowork-authorized additive contract extension — see Freeze note). Commit by **JT**. Spec:
> `docs/TASK9B_AUDIT_OUTBOX_HARDENING_PROMPT.md`. **Closes Task 9** (with 9a).

## Verified
- **The lock is genuine (non-vacuous).** `admission-service.test.ts` gained one test, "INV-16: the outbox payload
  carries ids/refs only — no free-text or PII": it builds an `under_review` application carrying REAL free-text +
  a storage-path-like value (`applicantStatement`, `motivation`, `reviewSummary`, `applicantNotice`,
  `personaClipHash`), flips `externalLedgerEnabled: true`, approves with `enqueue` resolving normally, then asserts
  the captured payload's keys are EXACTLY `{applicationId, membershipId, policyVersion, userId}` AND
  `payload` `toEqual` those four ids AND `JSON.stringify(payload)` contains neither `storage_path` nor any of the
  free-text values. So adding any PII/free-text/extra key to the outbox payload fails the test → a real lock for the
  one external-side-effect surface that was previously unpinned (the INV-13 test only exercised the failure path).
- **Purely additive — nothing weakened.** `git diff` of the file = **0 deletions / 63 insertions**; the existing
  contract tests are byte-untouched; no `.skip` / `.todo` / `.only`. core test count 19 → **20** (my re-run: 20/20,
  deterministic).
- **Scope:** ONLY `packages/core/src/domain/admission/admission-service.test.ts`. `git diff --stat` of
  `packages/core/src` (non-test domain/application/ports), `supabase`, `apps/web`, `packages/adapters/src` = EMPTY.
  No runtime/migration/route/UI change. `audit.sh` PASS.
- **Existing live gates unchanged by construction** (9b touches no live surface): builder/host pgTAP 73, adapters
  integration 4/4, web integration 5/5 — unchanged.

## Freeze note (transparency + Cowork authorization)
`packages/core/src/**/*.test.ts` is CONTRACT-FROZEN (AGENTS.md gate: diff vs `991dc5d` must be empty). The 9b lock
adds a test to `admission-service.test.ts`, so that gate now shows one additive test. **My 9b prompt directed the
addition without flagging the freeze — that was my omission.** Resolution: as the **contract owner (Cowork)** I
**authorize this as a deliberate ADDITIVE contract extension** — it *strengthens* the contract (locks INV-16 for the
outbox), the existing 19 are byte-untouched (0 deletions), and there is no skip/todo. The freeze's purpose (a
builder must not weaken/game the contract tests) is fully honored; only its literal "diff-empty" proxy trips, and the
owner resolves the proxy. **New baseline: core contract tests = 20** (the 19 frozen + the 9b INV-16 lock). Future
first-pass audits will see this one additive test in the `991dc5d` diff — it is authorized and recorded here +
in PROJECT_STATE.

## Task 9 hardening — coverage map (so "Task 9 complete" is auditable)
| Invariant | Locked by |
|---|---|
| **원문금지 — audit_logs** | smoke pgTAP: "audit metadata does not include review_summary text" (~376) + "…persona clip storage_path after clip approve/reject" (~541); 6a/6b/7a integration: no storage_path/url/token in `audit_logs.metadata`. |
| **원문금지 — outbox_events** | 7a integration: no storage_path/url/token in `outbox_events.payload`; **9b: INV-16 outbox payload = ids/refs only (the new lock).** |
| **no free-text into the state-transition tx** | `admission-service.test.ts` "INV-22: reasonCode enum flows; no free-text reason leaks into the tx payload" + reject test `arg.reason` undefined. |
| **idempotency** | smoke pgTAP: approve replay → same application + no duplicate admission_events / membership / audit rows (~236–276); RPC `idempotency_key`. |
| **INV-13 failure tolerance** | `admission-service.test.ts` "INV-13: an outbox/ledger failure does NOT roll back the committed approval". |
| **reason-enum only** | `scripts/audit.sh` "FROZEN no free-text reason field" + frozen `AdmissionReasonCode`. |
| **clip retention (PC-09)** | **Task 9a** (byte-delete reaper; same-hash safeguard; host 5×+reset). |

9b deliberately added only the one missing lock (HARD RULE 10 — no overbuild); everything else was already covered.

## Out of scope (remaining, deferred/optional)
- **Task 9a-2** — internal cron route wrapping the `clip:reap` CLI (only when ops needs HTTP scheduling).
- **Task 10** — external-ledger PoC + the outbox-drain processor (separate branch; chain TBD; P0
  `externalLedgerEnabled=false`).

## Runtime confirmation
Auditor re-ran (sandbox, host-independent): `pnpm -F @soulbound/core test` **20/20**, scope + 0-deletions + no
skip/todo verified. Builder/host: typecheck, build, `audit.sh`, pgTAP 73, adapters 4/4, web 5/5 — unchanged.
