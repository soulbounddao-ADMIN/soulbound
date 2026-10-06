# Task 4 Builder Prompt — Supabase + Noop adapters only (Codex builder)

> Cowork-authored execution prompt for **Task 4**. Paste the **§1 COPY-PASTE PROMPT** block into the
> Codex builder. Appendices A–C are precise specs the builder and auditors share.
> Frozen design contract remains `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md` §5
> and the frozen ports under `packages/core/src/ports`. Operating loop: `docs/WORKFLOW.md`.
>
> **Workflow note (v1.3 risk-tiered):** Task 4 binds frozen core ports to the Supabase RPC/RLS/storage
> boundary — a **security/authority layer**, so **Codex is the default builder** and GLM/Claude Code is
> NOT the primary builder here. The Codex builder session **must not self-approve**; final audit is Cowork
> (or a separate Codex session that did not build it). JT commits on host.

---

## 0. Prerequisites (JT, before deploying the builder)

1. **Governance commit landed first.** `docs: adopt risk-tiered build and audit workflow` is committed/pushed
   and `git status --short` is clean except this prompt doc. (Task 4 deploy happens *after* that commit.)
2. **New dependency expected:** Task 4 adds `@supabase/supabase-js` to `packages/adapters` only. That updates
   `pnpm-lock.yaml` — fine. But `pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` and
   `blockExoticSubdeps: true`; do **not** loosen them. If a too-new `@supabase/supabase-js` is blocked by the
   release-age gate, pin an older stable version rather than touching the workspace settings. `@supabase/*`
   may appear **only** under `packages/adapters` (never in `packages/core`).
3. Docker/Supabase CLI are not required for Task 4 itself (no migrations run); they remain needed for the
   optional smoke-test track (see §3 of this file).

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
You are the Task 4 builder under docs/WORKFLOW.md (risk-tiered). Task 4 is a SECURITY-LAYER adapter task,
so you (Codex) are the authorized builder. You are NOT the final approver: after you finish, STOP and hand
back for Cowork (or a separate Codex session that did not build this) to audit. Do not self-approve. Do not
git commit/push (JT does that on host).

=== READ FIRST (do not edit) ===
docs/WORKFLOW.md ; PROJECT_STATE.md ; docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md §5 ;
docs/CONTRACT_FREEZE_HANDOFF.md ; docs/TASK4_BUILDER_PROMPT.md (Appendix A–C) ;
packages/core/src/ports/*.ts ; packages/core/src/domain/**/types.ts ;
packages/core/src/domain/admission/admission-service.ts ; packages/core/src/application/{result,errors,container}.ts ;
packages/core/src/config/feature-flags.ts ; packages/core/package.json + tsconfig*.json + vitest.config.ts ;
supabase/migrations/0001_phase1_schema.sql ; supabase/migrations/0003_rls.sql ; supabase/migrations/0004_rpc.sql ;
supabase/migrations/0005_storage.sql .

=== SCOPE — Task 4 = adapters ONLY ===
Create a new package `packages/adapters` ( @soulbound/adapters ), mirroring @soulbound/core's shape, and
implement ONE adapter per frozen port. Allowed outputs:
  packages/adapters/package.json
  packages/adapters/tsconfig.json
  packages/adapters/tsconfig.build.json
  packages/adapters/vitest.config.ts
  packages/adapters/src/index.ts                       (barrel — export the adapters + factories)
  packages/adapters/src/supabase/clients.ts            (3 client factories — see CLIENT BOUNDARY)
  packages/adapters/src/supabase/mappers.ts            (snake_case row <-> frozen camelCase domain types)
  packages/adapters/src/supabase/errors.ts             (Postgres errcode -> AppError mapping)
  packages/adapters/src/supabase/supabase-auth-adapter.ts            (AuthPort)
  packages/adapters/src/supabase/supabase-admission-repository.ts    (AdmissionRepository)
  packages/adapters/src/supabase/supabase-membership-repository.ts   (MembershipRepository)
  packages/adapters/src/supabase/supabase-audit-log-repository.ts    (AuditLogRepository)
  packages/adapters/src/supabase/supabase-outbox-repository.ts       (OutboxRepository)
  packages/adapters/src/supabase/supabase-storage-adapter.ts         (StoragePort)
  packages/adapters/src/noop/noop-ledger-adapter.ts                  (LedgerPort)
  packages/adapters/src/noop/noop-notification-adapter.ts            (NotificationPort)
  packages/adapters/src/**/*.test.ts  (ONLY pure mapper/error/Noop tests that need NO live Supabase)
  optionally packages/adapters/src/test-support/*
Each adapter implements the frozen port interface EXACTLY (same method names/signatures).
The 8 ports and their exact method signatures are in Appendix A.

=== HARD BOUNDARIES (violation = redo) ===
- DO NOT modify packages/core/src/** (frozen ports/types/services/result/errors/feature-flags + 19 green tests).
  Adapters conform to the ports; never change a port to fit the adapter. If a port is insufficient, STOP and report.
- DO NOT modify supabase/migrations/**, supabase/seed.sql, supabase/config.toml, or any 0C toolchain file
  (root package.json, pnpm-workspace.yaml, tsconfig.base.json, .npmrc, .nvmrc, scripts/audit.sh, core *config*).
  Do NOT loosen engineStrict / minimumReleaseAge / blockExoticSubdeps.
- DO NOT wire CoreContainer / instantiate services with adapters — that is Task 5. Task 4 = adapter classes
  + factories only. (application/container.ts is frozen.)
- DO NOT create apps/**, API routes, hooks, UI, forms, or any React. DO NOT create chat/messages/inbox.
- DO NOT add a new migration or change the DB. If an adapter cannot satisfy a port without a schema/RPC change,
  STOP and report (do not "fix" the DB side).
- `@supabase/supabase-js` may be a dependency of packages/adapters ONLY. It must NEVER appear in packages/core.
- Chain-neutral: DO NOT import @mysten / aleo / aztec / zcash or any concrete-chain / ICP / Filecoin / IPFS /
  Arweave SDK. The only LedgerPort impl is NoopLedgerAdapter.

=== CLIENT BOUNDARY (the heart of Task 4 — get this right) ===
Provide THREE named Supabase client factories in clients.ts; adapters receive a client via CONSTRUCTOR
injection (do NOT hardcode a global client inside an adapter):
  1. anon client      — public anon key. For future browser/user-context use. service_role NEVER here.
  2. user client      — request user's JWT; RLS + column grants apply (applicant self-reads).
  3. service-role client — server-only; bypasses RLS. Used for: the 5 *Tx RPC calls (the RPCs are REVOKEd
     from anon/authenticated and granted to service_role), the reviewer/admin review queue, audit/outbox
     writes, and server-minted storage signed URLs.
RULES:
- The service-role key is read from a server-only env var. It must NEVER be referenced by a NEXT_PUBLIC_*
  name, never exported to a browser bundle, never imported by a React component (no React in Task 4 anyway).
- Each Supabase repository takes a SupabaseClient in its constructor. Provide explicit factories, e.g.
  `makeServiceRoleAdmissionRepository(serviceClient)` and `makeUserScopedAdmissionRepository(userClient)`,
  so Task 5/6 picks the correct client per request. Do not assume one global client.
- Applicant self-reads (findById / findActiveByApplicantId for the applicant's own row) MUST go through the
  USER client so RLS + the column grant hide review_summary. NEVER serve an applicant read from the
  service-role client (that bypasses RLS and would leak review_summary / other applicants' rows).
- listReviewQueue and all *Tx transitions require the service-role client.
If which-client-for-which-method is ever ambiguous against the frozen port, STOP and report.

=== STATE TRANSITIONS = ONE RPC EACH (never hand-sequenced) ===
The 5 *Tx methods each call exactly ONE Supabase RPC and map the returned row(s) to frozen domain types.
NEVER reproduce a transition with sequential .from(...).update()/.insert() calls. NEVER write
admission_events/audit_logs from the adapter for a transition (the RPC does that atomically inside one
transaction). Port method -> RPC (param order & full arg list in Appendix B):
  submitApplicationTx   -> rpc('submit_application_tx',   {...})
  startReviewTx         -> rpc('start_review_tx',         {...})
  approveApplicationTx  -> rpc('approve_application_tx',  {...})  // returns composite {application, membership}
  rejectApplicationTx   -> rpc('reject_application_tx',   {...})
  requestMoreInfoTx     -> rpc('request_more_info_tx',    {...})
PROBE the actual shape supabase-js returns for the approve composite (public.approve_outcome) and map BOTH
application and membership into ApproveOutcome. Build the mapper around the observed shape, not an assumption.

=== MAPPING ===
Map snake_case DB columns <-> frozen camelCase domain fields in mappers.ts (full table in Appendix C).
Preserve nullable reason semantics. Read AdmissionApplication includes reviewSummary in the type, but it is
only POPULATED on a service-role read; on a user-client read the column grant omits it — do not synthesize it.
NEVER copy storage_path, raw media/bytes/base64, signed URLs, storage tokens, transcripts, screenshots,
message plaintext, key material, or applicant free-text into audit_logs / outbox payloads / logs (INV-16/PC-06).

=== ERROR MODEL (align to the existing service — do NOT change core) ===
The frozen repository ports return plain values (e.g. Promise<AdmissionApplication>), NOT Result. Do NOT make
adapters return Result. On failure, THROW a typed AppError (application/errors.ts) so the already-implemented
DefaultAdmissionService maps it per the hybrid model. FIRST read admission-service.ts to confirm exactly how
it consumes the repo (what it catches vs lets throw) and match that. Map Postgres errors (Appendix B errcodes):
  P0002 (not found)            -> AppError NOT_FOUND
  P0001 (bad state / bad reason)-> AppError INVALID_STATE_TRANSITION  (reason is enum-typed upstream)
  23505 (unique_violation, e.g. one-active-application partial index) -> AppError CONFLICT
  anything else (network/infra) -> AppError DEPENDENCY_FAILURE
If the service expects a different mapping, follow the service; report any mismatch.

=== STORAGE ADAPTER (Persona Clip) ===
Implement StoragePort (put / getSignedUrl / markForDeletion) per domain/storage/types.ts against the private
'persona-clips' bucket. getSignedUrl returns a SHORT-LIVED signed URL minted server-side (service-role) only.
markForDeletion sets the deletion MARK (delete_after + deletion_reason) — it does NOT delete the object
(actual deletion worker is Task 9). No raw bytes / signed URL / storage_path in any audit/outbox/log payload.
Storage access goes through this adapter only; no supabase.storage calls anywhere else.

=== NOOP / OUTBOX ===
NoopLedgerAdapter implements LedgerPort (issueAdmissionTicket / issueMembershipCredential / issueActivationStake)
returning an inert ChainReceipt; NO network, NO chain SDK. NoopNotificationAdapter implements NotificationPort.notify
as a no-op; NO email/SMS/push/webhook. SupabaseOutboxRepository implements enqueue/claimPending/markSucceeded/
markFailed; P0 persists target='internal' records only; NO real external side effect; payload reference-only.
SupabaseAuditLogRepository.append writes audit_logs via service-role, codes/ids only (INV-16) — used for
standalone admin actions (admission transitions already audit inside the RPC).

=== ACCEPTANCE GATES (run, report each verbatim) ===
  pnpm install                              # adds @supabase/supabase-js to packages/adapters; lockfile changes OK
  pnpm -r typecheck                          # CLEAN
  pnpm -F @soulbound/core test               # still 19 GREEN, 0 skipped (MUST NOT regress)
  pnpm -F @soulbound/core build              # unchanged
  pnpm -F @soulbound/adapters build          # CLEAN (create the build script mirroring core)
  pnpm -F @soulbound/adapters test           # green if you added pure mapper/Noop tests (no live Supabase)
  bash scripts/audit.sh                      # AUDIT PASSED
Then report verbatim:
  git status --short --untracked-files=all
  git diff --stat packages/core/src          # MUST be empty (frozen untouched)
  git diff --stat supabase                   # MUST be empty (DB untouched)
  rg "@supabase" packages/core || true       # MUST be empty
  rg -n "@mysten|aleo|aztec|zcash|@mysten/sui|icp|filecoin|arweave" packages || true   # MUST be empty
  rg -n "NEXT_PUBLIC_.*SERVICE_ROLE|NEXT_PUBLIC_.*service_role" . || true               # MUST be empty
  rg -n "supabase\.storage" packages/adapters | wc -l    # only inside supabase-storage-adapter.ts

=== STOP CONDITIONS (report, do not work around) ===
Stop and report if: a frozen core file would have to change to compile; a port/RPC signature is incompatible;
the correct client (user vs service-role) for a method is ambiguous; review_summary mapping is unclear;
StoragePort cannot meet persona-clip rules without changing a frozen interface; or a 0C/toolchain file would
need loosening. Do NOT self-approve. When gates pass, STOP and hand back the diff + gate output.
Audit = Cowork final (or a separate Codex session that did not build this).
```

---

## Appendix A — frozen ports (exact signatures the adapters must implement)

From `packages/core/src/ports/*.ts` (CONTRACT-FROZEN — do not alter):

- **AuthPort**: `signUp(AuthCredentials)`, `signIn(AuthCredentials)`, `getSession(): AuthSession|null`, `getUserId(): string|null`
- **AdmissionRepository**:
  - reads: `findById(applicationId): AdmissionApplication|null`, `findActiveByApplicantId(applicantId): AdmissionApplication|null`, `listReviewQueue(ReviewQueueQuery): readonly AdmissionApplication[]`
  - transitions: `submitApplicationTx(SubmitApplicationTxInput): AdmissionApplication`, `startReviewTx(StartReviewTxInput): AdmissionApplication`, `approveApplicationTx(DecisionTxInput): ApproveOutcome`, `rejectApplicationTx(DecisionTxInput): AdmissionApplication`, `requestMoreInfoTx(DecisionTxInput): AdmissionApplication`
  - `SubmitApplicationTxInput{ applicantId, applicantStatement?, motivation?, referralCode?, personaClipAssetId?:string|null, personaClipHash?:string|null, policyVersion, idempotencyKey }`
  - `StartReviewTxInput{ applicationId, actorId, idempotencyKey }`
  - `DecisionTxInput{ applicationId, actorId, reasonCode:AdmissionReasonCode, applicantNotice?, reviewSummary?, idempotencyKey }`
  - `ApproveOutcome{ application:AdmissionApplication, membership:Membership }`
  - `ReviewQueueQuery{ status?:AdmissionStatus, limit:number, cursor? }`
- **MembershipRepository**: `findByUserId(userId): Membership|null` (creation is inside `approveApplicationTx`)
- **AuditLogRepository**: `append(AuditAppendInput): void` (standalone admin actions only; codes/ids only)
- **OutboxRepository**: `enqueue(EnqueueOutboxInput): OutboxEvent`, `claimPending(limit): readonly OutboxEvent[]`, `markSucceeded(id)`, `markFailed(id, error)`
- **LedgerPort** (Noop only): `issueAdmissionTicket(...)`, `issueMembershipCredential(...)`, `issueActivationStake(...)` → `ChainReceipt`
- **StoragePort**: `put(PutEvidenceInput): EvidenceReceipt`, `getSignedUrl(evidenceId): string`, `markForDeletion(evidenceId): void`
- **NotificationPort** (Noop): `notify(NotifyInput): void`

`CoreContainer{ admissionService, membershipService }` is **frozen** and wired in **Task 5**, not here.

## Appendix B — RPC call signatures (from `supabase/migrations/0004_rpc.sql`) + errcodes

Call via `serviceClient.rpc('<name>', { ...named args })`:

| Port method | RPC | Named args (order per SQL) | Returns |
|---|---|---|---|
| submitApplicationTx | `submit_application_tx` | `p_applicant_id, p_policy_version, p_idempotency_key, p_applicant_statement, p_motivation, p_referral_code, p_persona_clip_asset_id, p_persona_clip_hash` | `admission_applications` row |
| startReviewTx | `start_review_tx` | `p_application_id, p_actor_id, p_idempotency_key` | row |
| approveApplicationTx | `approve_application_tx` | `p_application_id, p_actor_id, p_reason_code, p_idempotency_key, p_applicant_notice, p_review_summary` | composite `approve_outcome{application,membership}` |
| rejectApplicationTx | `reject_application_tx` | `p_application_id, p_actor_id, p_reason_code, p_idempotency_key, p_applicant_notice, p_review_summary` | row |
| requestMoreInfoTx | `request_more_info_tx` | `p_application_id, p_actor_id, p_reason_code, p_idempotency_key, p_applicant_notice, p_review_summary` | row |

Postgres errcodes raised by the RPCs: `P0002` = not found; `P0001` = invalid state transition / invalid reason;
`23505` = unique_violation (one-active-application partial index). Map to AppError per the prompt's error model.
The RPCs already enforce the status guards (submitted→under_review; decide from under_review|needs_more_info;
more_info from under_review) and idempotency (admission_events.idempotency_key) — the adapter must NOT re-check
or duplicate these.

## Appendix C — column ↔ field mapping (snake_case DB ↔ camelCase domain)

**admission_applications ↔ AdmissionApplication**: `applicant_id↔applicantId`, `applicant_statement↔applicantStatement`,
`referral_code↔referralCode`, `reviewer_id↔reviewerId`, `reviewed_at↔reviewedAt`, `review_summary↔reviewSummary`
(service-role read only), `applicant_notice↔applicantNotice`, `policy_version↔policyVersion`,
`policy_snapshot_hash↔policySnapshotHash`, `persona_clip_asset_id↔personaClipAssetId`,
`persona_clip_hash↔personaClipHash`, `ledger_ticket_ref↔ledgerTicketRef`, `ledger_tx_ref↔ledgerTxRef`,
`created_at↔createdAt`, `updated_at↔updatedAt` (id/status/motivation map 1:1).

**memberships ↔ Membership**: `user_id↔userId`, `source_application_id↔sourceApplicationId`,
`ledger_credential_ref↔ledgerCredentialRef`, `ledger_tx_ref↔ledgerTxRef`, `issued_at↔issuedAt`,
`expires_at↔expiresAt`, `revoked_at↔revokedAt` (id/status/tier 1:1).

Confirm every field against the frozen `domain/{admission,membership,outbox,audit,storage,ledger}/types.ts`
before finalizing the mappers; the Task 5 wiring and the audit will check this parity.
