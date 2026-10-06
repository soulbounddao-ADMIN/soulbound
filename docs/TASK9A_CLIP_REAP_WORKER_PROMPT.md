# Task 9a — Persona-Clip byte-delete worker (CLI/script) — spec + Codex builder prompt (Cowork-authored)

> **Task 9a = the Persona-Clip byte-delete worker, as a server-only CLI/script** (JT decision: CLI over an API
> route — minimize new surface; open a route only when ops automation actually needs it). PC-09 retention: raw media
> is deleted once it has served the admission decision — **for approved AND rejected applicants** — and abandoned
> drafts expire. The DB keeps **evidence rows only**.
>
> **Builder = Codex** (security/storage layer — real byte deletion; full loop + host determinism). Final audit =
> **Opus audit session** (builder ≠ approver). JT commits.
>
> **Trigger = CLI script** invoked as `pnpm -F @soulbound/adapters clip:reap` (server shell / CI only).
> **NOT in this task:** an API route, `CRON_SECRET`, cron wiring, an Edge Function, an admin-UI button, pg_cron-only
> deletion, or outbox/ledger processing. (An internal cron route that thinly wraps this CLI = a later **Task 9a-2**,
> only if/when ops needs HTTP-triggered scheduling.)
>
> **⚠️ Make-or-break (any violation = redo):**
> 1. **Deletion scope is exact.** Delete bytes ONLY for the JT predicate below. A `status='attached'` clip with
>    `deletion_reason IS NULL` must **NEVER** be deleted (safeguard against a no-reason stale clip — e.g. the 7a
>    non-atomic submit+clear residual). Approved/rejected clips ARE deleted (the RPC set their `deletion_reason`) —
>    **do not preserve approved-applicant media bytes.**
> 2. **INV-PC-06 / no raw.** The CLI output, logs, `audit_logs`, and `outbox_events` carry only `assetId` /
>    `contentHash` / `status` / `deleted_at` / `deletion_reason` / counts — **never** `storage_path`, a signed URL, a
>    token, raw bytes, transcript, or summary. (`storage_path` legitimately lives in the `persona_clip_assets` row —
>    it is `NOT NULL` and frozen INV-PC-06 ALLOWS it there; the reaper reads it only to call `storage.remove` and does
>    NOT null it. The prohibition is CLI / log / audit / outbox / return-value — NOT the table.)
> 3. **Server-only, no new web surface.** No API route, no `CRON_SECRET`, nothing `NEXT_PUBLIC_`. The reaper runs in
>    `@soulbound/adapters` with the service-role client, reachable only from a server shell / CI.
> 4. **core `StoragePort` stays frozen** — the reaper is a concrete `SupabaseStorageAdapter` extension (the 7a pattern).
> 5. **Idempotent + failure-tolerant** — a second run reaps nothing already deleted; a transient Storage failure
>    leaves the row unmarked for the next run (never mark `deleted` without confirming the object is gone/absent).

---

## 0. JT retention policy (bake in VERBATIM)

We do not keep Persona Clip video/audio originals. Raw media is deleted once it has served the admission decision —
for **both approved and rejected** applicants — and the DB keeps **evidence only** (assetId, contentHash,
status='deleted', deleted_at, deletion_reason, audit/admission event). **Approved applicant clips are deleted too —
do not preserve approved media bytes for membership history.** The worker:
1. **Approved terminal clip** (`approve_application_tx` set `delete_after=now(), deletion_reason='application_approved'`) → delete the Storage object.
2. **Rejected terminal clip** (`reject_application_tx` set `delete_after=now(), deletion_reason='application_rejected'`) → delete the Storage object.
3. **Abandoned draft** (`status='draft' AND delete_after<=now()`) → delete.
4. **Evidence-only retention** — keep assetId, contentHash, status='deleted', deleted_at, deletion_reason,
   audit/admission event. Do NOT keep raw media, transcript, summary, signed URL, or the storage object.
5. **Safeguard** — a `status='attached' AND deletion_reason IS NULL` stale clip is NOT deleted (a misjudgement-guard,
   not approved-clip preservation; normal approve/reject always sets deletion_reason, so those clips ARE in scope).

**Worker predicate (use exactly):**
```sql
status <> 'deleted'
AND delete_after IS NOT NULL
AND delete_after <= now()
AND (
  deletion_reason IS NOT NULL
  OR status = 'draft'
)
```
Meaning: expired draft → delete; approved clip → delete; rejected clip → delete; an attached clip with no
deletion_reason → NOT deleted. On Storage delete success OR confirmed object-missing → set
`status='deleted', deleted_at=now()` (and, for an abandoned draft whose deletion_reason was null, set
`deletion_reason='draft_abandoned'`). On a transient Storage failure → leave the row as-is (retry next run).

## 1. Grounded contract (verified from the tree — re-read each; do not trust paraphrase)

- **`supabase/migrations/0002_*.sql` `persona_clip_assets`**: `status` (draft|attached|deleted), `deletion_reason`
  (null | draft_abandoned | application_approved | application_rejected | application_withdrawn |
  application_expired | policy_cleanup), `delete_after`, `deleted_at`, `storage_path`, `content_hash`. Index
  `persona_clip_assets_delete_after_idx ON delete_after WHERE delete_after is not null and status != 'deleted'` —
  exactly the worker's scan.
- **`supabase/migrations/0004_*.sql`**: approve → `deletion_reason='application_approved'`, reject →
  `'application_rejected'`, both `delete_after=now()`.
- **`packages/adapters/src/supabase/supabase-storage-adapter.ts`** (`SupabaseStorageAdapter implements StoragePort`,
  bucket `"persona-clips"`): has createUploadUrl / put / getSignedUrl / markForDeletion / markOwnDraftForDeletion /
  clearSubmittedRetention. **No byte-delete-from-Storage method** — add one (concrete; core StoragePort untouched).
  Bytes are removed via `client.storage.from("persona-clips").remove([paths])`.
- **`packages/core/src/ports/storage-port.ts`** is FROZEN — do not edit.
- **`packages/adapters/package.json`** is NOT 0C-frozen — adding a `clip:reap` script (+ a minimal `tsx` devDep, or
  any runner you prefer) is allowed. Env for the CLI = `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only;
  the adapters integration test already reads these — mirror it, fail loud if missing).
- **`packages/adapters/.../*.integration.test.ts`** run via `pnpm -F @soulbound/adapters test:integration`
  (vitest.integration.config.ts) against live local Supabase with the service-role client.

## 2. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 9a — Persona Clip byte-delete worker, CLI/script only. Implement a server-only reaper in
@soulbound/adapters that deletes Supabase Storage bytes for due Persona Clips (approved/rejected after review, or
expired drafts) and keeps minimal evidence rows. Approved applicant clips MUST be deleted too — do not preserve
approved media bytes. Security/storage layer: full loop + host determinism.

Do NOT: add an API route, add an internal cron route (that is a later Task 9a-2), use CRON_SECRET, add an Edge
Function, use pg_cron-only deletion, add an admin-UI button, implement outbox/ledger processing, change
packages/core (StoragePort frozen), or change the 8a/8b UI / admission RPCs / services.

Read first (confirm, don't trust paraphrase): supabase/migrations/0002_*.sql (persona_clip_assets + the delete_after
index), 0004_*.sql (approve/reject marking), packages/adapters/src/supabase/supabase-storage-adapter.ts (methods +
bucket "persona-clips" + how it queries/removes), packages/core/src/ports/storage-port.ts (FROZEN),
packages/adapters/src/container.integration.test.ts + vitest.integration.config.ts (the live service-role fixture +
env reading: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).

A) packages/adapters/src/supabase/supabase-storage-adapter.ts — add a concrete method (NOT on the frozen
   StoragePort; export any new result type from packages/adapters/src/index.ts):
   reapDeletablePersonaClips({ limit?: number }): Promise<{ scanned: number; deleted: number; failed: number;
     deletedAssetIds: string[] }>
   - SELECT id, storage_path, status, deletion_reason FROM persona_clip_assets WHERE
       status <> 'deleted' AND delete_after IS NOT NULL AND delete_after <= now()
       AND ( deletion_reason IS NOT NULL OR status = 'draft' )
     ORDER BY delete_after LIMIT (limit ?? 100).   // EXACT predicate — do not broaden or narrow
   - For each row (per-row try/catch; one failure must NOT abort the batch):
       0. TOCTOU guard — immediately RE-READ the row by id and confirm it STILL matches the exact predicate
          (status<>'deleted' AND delete_after IS NOT NULL AND delete_after<=now() AND (deletion_reason IS NOT NULL OR
          status='draft')). If it no longer matches (e.g. an expired draft was just submitted -> attached), SKIP it
          (do NOT remove bytes, do NOT update). This re-verification just before deletion is REQUIRED.
       1. const { error } = await client.storage.from("persona-clips").remove([storage_path]); ALSO wrap the call in
          try/catch for a thrown transport error. You MUST inspect the RETURNED error (Supabase remove() usually
          reports failure as { data: null, error }, NOT by throwing) — do not rely on try/catch alone.
       2. SUCCESS = no returned error AND nothing thrown (this includes the object-already-absent case, which
          Supabase reports as success).
       3. On SUCCESS: UPDATE persona_clip_assets SET status='deleted', deleted_at=now(),
          deletion_reason = COALESCE(deletion_reason, 'draft_abandoned') WHERE id = ... AND status <> 'deleted'.
       4. On a RETURNED { error } OR a THROWN error: do NOT update the row; count it as failed (retry next run).
          NEVER mark a row deleted when remove() returned (or threw) an error.
   - Return counts + deletedAssetIds ONLY. NEVER return/log storage_path / signed URL / token / raw bytes
     (INV-PC-06). Idempotent (status<>'deleted' guard) + failure-tolerant (per-row).

B) CLI script (server-only) + a package script:
   - packages/adapters/src/scripts/reap-persona-clips.ts: read SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
     process.env (fail loud if missing — mirror the integration test's requireEnv), create the service-role client
     (createServiceRoleSupabaseClient), call makeSupabaseStorageAdapter(client).reapDeletablePersonaClips({}), print
     a one-line summary (scanned/deleted/failed + the deletedAssetIds — NO storage_path/url), and process.exit(0) on
     success / non-zero if it threw. Browser-unreachable; no auth/session/role logic.
   - packages/adapters/package.json: add "clip:reap": "<runner> src/scripts/reap-persona-clips.ts" (tsx is fine as a
     devDependency; keep additions minimal). (packages/adapters/package.json is NOT 0C-frozen.)
   - Entry point must be: pnpm -F @soulbound/adapters clip:reap.

FORBIDDEN (violation = redo):
 - deleting (or marking deleted) any row outside the EXACT predicate — especially status='attached' AND
   deletion_reason IS NULL (the safeguard);
 - storage_path / signed URL / token / raw / transcript / summary in the CLI output, logs, audit_logs, outbox, or the
   method's return value (storage_path STAYS in the persona_clip_assets row — that is allowed/required, NOT nulled);
 - any API route / CRON_SECRET / cron / Edge Function / pg_cron-only / admin-UI button / outbox/ledger processing;
 - NEXT_PUBLIC_-ing any secret or touching client code;
 - editing packages/core (StoragePort frozen) / admission RPCs / services / 8a/8b UI;
 - marking a row 'deleted' before the Storage object is confirmed gone/absent (no optimistic delete).

GATE (security/storage — full loop + HOST DETERMINISM; a single green run is NOT proof — §6):
 - A NEW adapters live integration test (packages/adapters/...integration.test.ts; reuse the service-role fixture;
   upload small objects via client.storage.from("persona-clips").upload(...) and insert matching
   persona_clip_assets rows). Set up one clip in EACH state and assert reapDeletablePersonaClips:
     * approved-marked (deletion_reason='application_approved', delete_after<=now(), object uploaded) -> object GONE,
       row status='deleted' + deleted_at set;
     * rejected-marked -> object GONE, status='deleted';
     * abandoned draft (status='draft', delete_after<=now()) -> object GONE, status='deleted',
       deletion_reason='draft_abandoned';
     * SAFEGUARD: stale attached (status='attached', deletion_reason IS NULL, delete_after<=now()) -> object PRESENT,
       row UNCHANGED (the make-or-break assertion);
     * already 'deleted' -> untouched (counted 0);
     * absent object: a DUE row (e.g. approved-marked) whose Storage object is ALREADY gone -> the row still
       transitions to status='deleted' (object-absent is treated as success);
     * idempotent: a second reap run deletes nothing new.
   Clean up the test's own storage objects/rows.
 - Unit tests (mocked supabase client — no live stack required):
     * transient remove failure — cover BOTH shapes: (a) remove() RETURNS { data: null, error } (the usual Supabase
       shape) and (b) remove() THROWS a transport error. In EACH case reapDeletablePersonaClips returns failed>=1 AND
       performs ZERO row UPDATEs for that asset (row stays non-deleted, retried next run). [Without the returned-error
       case, a buggy impl that ignores { error } and marks the row deleted would slip through.]
     * no-leak: the method's RETURN value AND the CLI's captured stdout contain NO storage_path / signed URL / token
       (only assetId / contentHash / status / counts).
 - pnpm -F @soulbound/adapters test:integration green WITH this added; pnpm -r typecheck / build clean;
   bash scripts/audit.sh PASS; web unit / web integration / core / pgTAP (56) unchanged.
 - HOST DETERMINISM (required): on the host, clean `supabase db reset`, then run
   `pnpm -F @soulbound/adapters test:integration` 5x CONSECUTIVELY, all green; and run `pnpm -F @soulbound/adapters
   clip:reap` once against the seeded/reset DB and report its summary. Do not submit a single pass as proof.

ACCEPTANCE (report each verbatim):
 - all gate results incl. the 5x host-determinism runs and the post-reset run, and the clip:reap CLI summary;
 - git status --short shows ONLY: packages/adapters/src/supabase/supabase-storage-adapter.ts (+ index.ts),
   packages/adapters/src/supabase/supabase-storage-adapter.test.ts (the transient-failure + no-leak UNIT tests),
   packages/adapters/src/scripts/reap-persona-clips.ts (+ its unit test, if separate),
   the new adapters reap INTEGRATION test file (e.g. packages/adapters/src/persona-clip-reap.integration.test.ts),
   packages/adapters/package.json, pnpm-lock.yaml (if tsx added), and a manual-QA/runbook note;
 - git diff --stat packages/core/src supabase apps/web => EMPTY (no core/RPC/UI/web change; StoragePort frozen).
STOP and report. Do not self-approve - Opus audit session finals, JT commits.
```

---

## 3. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add Task 9a clip-reap CLI worker builder prompt`.
2. Paste §2 into the **Codex** builder. Codex builds A–B + the gate incl. 5x host determinism, STOPS.
3. **Opus audit session audits/finals** (builder ≠ approver): re-derive from git; the EXACT predicate (safeguard
   test proves stale-attached-null untouched); approved+rejected ARE deleted; server-only (no API route / no
   CRON_SECRET / nothing NEXT_PUBLIC / no client touch); core StoragePort frozen (concrete adapter only); INV-PC-06
   (no storage_path/url/token in CLI output, logs, audit_logs,
   outbox, or return values — `persona_clip_assets.storage_path` remains intact); idempotency + failure-tolerance
   (both the returned-`{error}` and thrown-error cases leave the row unmarked); scope; audit.sh; **host determinism
   reproduced (5x + reset)** before PASS.
4. On PASS, JT commits: `feat(adapters): persona-clip byte-delete reaper (CLI)` + `test(adapters): clip-reap
   retention integration` + `docs: record Task 9a audit pass`.

## 4. Out of scope (explicit)
- **Internal cron route wrapping this CLI = Task 9a-2** (later, only if ops needs HTTP-triggered scheduling — adds
  the route + a secret + observability together).
- **Audit/outbox 원문금지·idempotency hardening regression = Task 9b** (small follow-up): in P0 the outbox does not
  run (`externalLedgerEnabled=false`) and leaks were proven 0 (7a), and core tests cover idempotency/INV-13 — so 9b
  is a light regression/verification pass, not new P0 code. (This task's own tests already cover the delete-path's
  no-leak + idempotency.)
- External-ledger / outbox **drain** processor + the outbox-vs-ledger single-call refactor = **Task 10**.
- `application_withdrawn` / `application_expired` reaping = future (no flow wired in P0; the broad
  `deletion_reason IS NOT NULL` predicate would already reap them if such a reason were ever set).

## 5. Decisions / notes (Cowork)
- **CLI over a route = JT decision (surface minimization).** An internal route is a new API surface (CRON_SECRET
  storage/verify, route exposure, log/response leak, method allow-listing, deploy-env, server-runtime impact); the
  CLI has none of that (browser-unreachable, no API route, no secret, no session/role boundary, runs in server
  shell/CI, audit scope confined to adapters). Open the route later (9a-2) only when Vercel-Cron/automation makes
  HTTP triggering clearly better and CRON_SECRET/observability are designed together.
- **The safeguard is the make-or-break.** The exact predicate + the "stale attached, no reason → untouched"
  integration assertion is the hardest-verified item; wrong = privacy-violating (under-delete) or data-loss
  (over-delete).
- **Determinism required** (live Storage+DB integration, flaky-prone) — host 5x + reset, per §6.
- **Concurrency (architect decision — closes the first-pass FLAG).** Terminal clips (approved/rejected —
  `deletion_reason` set) are in a FINAL state and cannot transition back, so the privacy-critical rows have NO TOCTOU;
  remove-first is safe + privacy-correct for them (bytes gone before the row is marked; a failed mark is retried). The
  only raceable rows are expired drafts (`status='draft'`); the REQUIRED per-row predicate re-check immediately before
  `storage.remove` (step 0) narrows the window to sub-millisecond. Accepted, documented residual: an expired draft
  submitted in that tiny window could lose its bytes -> a missing clip on that application, which PC-01 explicitly
  tolerates (absence never blocks) and is NOT a privacy leak. A fully race-proof design (a `deleting` claim state or a
  SECURITY DEFINER claim-RPC) needs a schema/contract change and is deferred unless P0 requires it. Remove-first is
  chosen over claim-first because the reaper's purpose is privacy: claim-first risks "row marked deleted but bytes
  remain" (an undetected leak), which is worse than the bounded draft residual.
- **Prompt corrected after Codex first-pass prompt-audit** (3 valid FAILs + 1 valid FLAG against the architect's
  draft): the `storage_path` contract wording (table-allowed vs CLI/log/audit/outbox-forbidden), the absent-object +
  transient-failure + stdout-no-leak tests, and this concurrency decision. The corrected prompt goes to a FRESH Codex
  builder session (not the prompt-audit session); Opus finals (builder ≠ approver).
