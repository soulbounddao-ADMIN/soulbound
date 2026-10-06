# Task 7a — Persona Clip routes + signed-upload adapter — Audit Findings (final auditor record)

> Builder: **Codex** (storage boundary / retention / authz = security layer). Final auditor: **Opus audit session**
> (separate). Verdict: **PASS** (original build + one corrective lifecycle round). Commit by **JT** (host). Builder ≠
> final approver preserved (WORKFLOW §2). Spec: `docs/TASK7A_PERSONA_CLIP_ROUTES_PROMPT.md` (with JT's 3 corrections).
> First slice of the mixed Task 7; the recorder UI is **7b (GLM)**.

7a = the persona-clip create/delete routes, the reviewer signed-read-URL route, and the signed-UPLOAD-URL
capability on the storage adapter. **Architecture (Cowork):** the frozen `StoragePort` can't upload bytes, so the
upload capability was added to **`SupabaseStorageAdapter` (packages/adapters — NOT frozen)**; `packages/core`
StoragePort stays frozen-untouched. The browser uploads via a **plain-fetch-compatible contract** the route
returns (no Supabase SDK → INV-PC-05).

## Audit method (re-derived from the working tree — not a rubber stamp)

Read the adapter + all 3 routes + the submit-route corrective + storage helpers + the integration test; grepped
every leak vector (storage_path / signed-url / token / console / audit / outbox); confirmed scope + core/supabase
untouched + audit.sh; verified host determinism (5×+reset). Live runs host-only — corroborated statically.

## Verified

- **INV-PC-06 (the make-or-break data-minimization check) holds, runtime-proven.** `storage_path` lives only in the
  `persona_clip_assets.storage_path` column + transiently inside the signed URLs returned to the authorized party
  (owner upload-URL / reviewer read-URL) — never written to audit/outbox/logs. The integration test queries
  `audit_logs.metadata`, `outbox_events.payload`, `admission_applications` text columns, and `persona_clip_assets`
  NON-path columns and asserts NONE contain the storage_path, the signed upload URL, the signed read URL,
  `object/upload/sign`, `object/sign`, or `token=`.
- **Adapter (`SupabaseStorageAdapter`, core StoragePort frozen-untouched):** `createUploadUrl` inserts a `status='draft'`
  row (frozen 0002 enum is draft|attached|deleted — not `pending_upload`) with `delete_after = now+24h`
  (draft-abandon), calls `createSignedUploadUrl(path)` with NO claimed TTL (provider-default), and returns
  `{ assetId, upload: { url, method:'PUT', headers } }` — a plain-fetch contract (probed, mirrors
  `uploadToSignedUrl`'s raw-body branch). `getSignedUrl` is short (5-min, controlled). `markOwnDraftForDeletion`
  (status='draft' only) and `clearSubmittedRetention` (corrective) are owner+state scoped. The `make*` factory now
  returns the concrete adapter so apps/web can call the extra methods; `git diff packages/core/src` empty.
- **All 3 JT corrections honored:** (1) upload-URL TTL provider-defined, not claimed short; (2) the signed-upload
  shape was probed and exposed as a plain-fetch contract the browser uses without the SDK; (3) `status='draft'` +
  `delete_after` at issuance.
- **Routes:** `POST/DELETE /api/admission/persona-clip` — `ownerId = actor.id` (body forge ignored; test injects a
  forged ownerId and asserts the row's `applicant_id = actor.id`); DELETE marks only the caller's OWN **draft**
  (service-role adapter, scoped `applicant_id=actor.id` + `status='draft'` because `authenticated` lacks an UPDATE
  grant — test proves another applicant → 404 and an attached clip → 404). `GET /api/admin/applications/[id]/
  persona-clip-url` — `requireReviewer` (applicant → 403), 404 if no clip, returns the short read URL in the
  response only.
- **Lifecycle (corrective):** submit-with-clip → the frozen rpc attaches (`status='attached'`) and the route then
  clears `delete_after`/`deletion_reason` via `clearSubmittedRetention` (scoped id+owner+application+status='attached').
  Test proves: draft has delete_after before submit; after submit the clip is `attached, delete_after=null,
  deletion_reason=null`; DELETE can't touch the attached clip (404); reviewer fetches the read URL and replays the
  EXACT uploaded bytes; absence-of-clip still submits (PC-01); approve marks `deletion_reason='application_approved'`.
- **Scope:** only apps/web + packages/adapters/src/supabase (adapter+test) + index.ts; no core/supabase edits;
  no `supabase.storage` anywhere in apps; audit.sh PASS; no skip/todo/only.

## Determinism — PASS (host-proven, clean)

On JT's host: `test:integration` **5/5 consecutive green** (all 3 files incl. persona-clip), then a CLEAN
`supabase db reset` → `supabase test db` (49) → post-reset `test:integration` green. No flake, no infra hiccup
this round. Reuses the host-validated 6a bounded-auth-retry + throwaway-applicant fixtures + fail-loud env.

## Residual risks (non-blocking — tracked)

1. **Non-atomic submit+clear.** `clearSubmittedRetention` runs AFTER `submitApplication` commits; if it fails the
   route returns 502 (honest, not silent) but the application is already submitted + the clip attached. It is
   low-harm and self-healing (submit is idempotent → a retry re-clears) AND harmless as long as the **Task 9 delete
   worker scopes draft-cleanup to `status='draft'`** (an attached clip with a stale `delete_after` is never deleted).
   A fully-atomic fix = fold the clear into `submit_application_tx` (a frozen-RPC change → separate decision, deferred).
2. **Un-uploaded clip edge.** A user can get an upload URL and submit referencing the assetId without ever
   uploading bytes → an attached-but-empty clip (no bytes → nothing to leak; reviewer fetch would fail). **7b's
   recorder must guarantee upload-before-submit.**

## Out of scope (unchanged)
- The recorder component = **7b (GLM)**. The Storage byte-delete worker = **Task 9** (must scope draft-cleanup to
  `status='draft'`). Withdraw/expire workers = later. No upload fallback/preview/retake/edit (INV-PC-02/04).

## Runtime confirmation (host-only)
Auditor corroborated statically + verified the host 5×+reset determinism. Builder/host green: `supabase test db` 49,
`test:integration` 5/5 + post-reset, web unit 15, adapters 16/17, core 19, typecheck, build, audit.sh.
