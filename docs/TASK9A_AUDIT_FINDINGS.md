# Task 9a — Persona-Clip byte-delete worker (CLI) — Audit Findings (final auditor record)

> Builder: **Codex**. First-pass auditor: **Codex** (returned FAIL, 3×P1). Final auditor: **Opus audit session**.
> **VERDICT: FAIL (initial, 3×P1) → corrective → FINAL PASS.** I independently re-derived all three findings and
> concurred (below); the corrective fixed all three at the right level, and host determinism (5×+reset) — which
> CAUGHT a real cross-package test-isolation leak on run-2 — is now green. **FINAL PASS.** Builder ≠ approver
> preserved. Spec: `docs/TASK9A_CLIP_REAP_WORKER_PROMPT.md`. See **Resolution** at the end.

The mechanical gates all pass (adapters unit 21, integration 5×3/3, pgTAP 56, typecheck/build, `audit.sh`, protected
surface EMPTY, no skip/todo). But three **semantic** issues — not caught by the green tests — block PASS.

## Findings (re-derived from `packages/adapters/src/supabase/supabase-storage-adapter.ts`)

### 1. [P1 — BLOCKING] Shared `storage_path` bypasses the row-level safeguard
- Object key = `${ownerId}/${contentHash}` (`buildUploadObjectPath`, line 70); `createUploadUrl` inserts a new row
  per call with that path and there is **no DB unique constraint** on `storage_path`.
- ⇒ Two `persona_clip_assets` rows for the same applicant + same `content_hash` (e.g. an upload retry / double-POST
  of the recorder's `POST /persona-clip`) share the SAME storage object. If one is a **due draft** and the other is
  a protected **`attached` / `deletion_reason IS NULL`** row, reaping the draft calls `remove([sharedPath])` and
  **deletes the protected row's bytes** — the whole point of the safeguard (which protects *rows*) is defeated because
  deletion operates on the shared *object*.
- The live integration test uses a distinct path per row, so it cannot catch this.
- **This nullifies Task 9a's make-or-break (the safeguard) → must fix.**
- **FIX DIRECTION:** make object keys **unique per asset** so no two rows ever share an object — e.g. include the
  asset id (or a fresh uuid) in the path (`${ownerId}/${assetId}` / `${ownerId}/${contentHash}/${assetId}`). Keep
  `content_hash` in its column for integrity. Then the row safeguard maps 1:1 to objects and the bypass is gone. Add
  a **shared-input integration case**: two uploads with the SAME `contentHash` for the same owner must get DISTINCT
  objects, and reaping one (due) must leave the other (protected) object intact. (Touching `createUploadUrl`'s path
  builder — 7a — is authorized for this fix; same storage concern.)

### 2. [P1 per first-pass; I assess P2 — valid contract deviation] App-side `COALESCE` can clobber a concurrent reason
- The mark UPDATE sets `deletion_reason: current.deletion_reason ?? "draft_abandoned"` (line 287) using the value
  captured at re-read, not the DB's current value. A concurrent retention/terminal update landing between the re-read
  and the UPDATE is overwritten with `draft_abandoned`. The contract specified DB-side
  `COALESCE(deletion_reason, 'draft_abandoned')`.
- Impact is low (it only affects the recorded reason on a row that is being deleted anyway; both are valid deletion
  reasons; no data-loss/privacy), but it deviates from the contract and is cheap to fix correctly.
- **FIX DIRECTION:** apply the coalesce **DB-side** so a concurrently-set non-null reason is preserved (see the RPC
  in finding 3, which is the natural home for it; or, migration-free, never include `deletion_reason` in the UPDATE
  for a row whose re-read reason is non-null — update only `status` + `deleted_at` for those).

### 3. [P1 per first-pass; valid] Eligibility + timestamps use the worker (Node) clock, not DB `now()`
- The scan predicate (line 237/243), the pre-remove re-check (line 262), and `deleted_at` (line 286) use
  `new Date()`. The contract is `delete_after <= now()` (DB time). Clock skew → a worker ahead deletes a **not-yet-due
  draft early** (and because the design is remove-first, the bytes are gone before any DB re-check could veto it — a
  user about to submit that draft loses the clip), and a worker behind delays terminal-media deletion. `deleted_at`
  is similarly skewed.
- **FIX DIRECTION:** evaluate due-ness and stamp timestamps using **DB time**. The clean approach is a small
  `security definer` reap RPC pair (NEW migration `0008` — NOT the frozen admission RPCs): a read RPC returning due
  rows (`WHERE delete_after <= now() AND <exact predicate>`) and a mark RPC
  (`UPDATE … SET status='deleted', deleted_at=now(), deletion_reason=COALESCE(deletion_reason,'draft_abandoned')
  WHERE id AND <exact predicate>` — re-checked with DB `now()`, RETURNING id). Keep **remove-first** (privacy): read
  due rows (DB time) → `remove` bytes (unique per-asset object, finding 1) → mark via the RPC. This closes #2 + #3
  and tightens the mark's atomic predicate re-check in one move.

## What is already correct (verified — do not regress)
- Remove-first ordering (privacy-correct: bytes gone before the row is marked; mark-failure retried). **Keep it** —
  do NOT switch to claim-first (that risks "row marked deleted but bytes remain" = an undetected leak).
- The exact predicate `status<>'deleted' AND delete_after IS NOT NULL AND delete_after<=… AND (deletion_reason IS NOT
  NULL OR status='draft')`, the per-row re-check before remove, the **returned-`{error}`** handling (line 277 — it
  checks `removeError`, not only thrown), idempotency (`neq status 'deleted'`), no-leak CLI/return, server-only (no
  route / no CRON_SECRET), core `StoragePort` frozen, scope (core/supabase/web diff EMPTY).
- The documented TOCTOU residual (an expired draft submitted in the sub-ms window → a missing clip, PC-01-tolerated)
  stands; finding 3's DB-time fix narrows but does not eliminate it (storage delete is external — unavoidable).

## Corrective scope (authorized expansion)
- `packages/adapters/.../supabase-storage-adapter.ts` (`createUploadUrl` unique object key + the reaper using the new
  RPCs), `packages/adapters/.../index.ts`, a NEW `supabase/migrations/0008_*.sql` (reap read+mark RPCs, `security
  definer` + `set search_path=''` + execute granted to `service_role` only), the adapters reap integration test
  (+ the shared-`contentHash` safeguard case), `supabase/tests/*` if a pgTAP assertion fits, the CLI unchanged.
- Re-run the full gate + **host determinism 5×+reset** (live Storage+DB + a new migration → §6).

## Re-audit checklist (Opus, after the corrective)
Shared-hash safeguard (two same-hash uploads → distinct objects; reaping the due one leaves the protected one's bytes
intact); DB-time due-ness + `deleted_at`; DB-side COALESCE preserves a concurrent non-null reason; remove-first kept;
the reap RPC is `security definer`/`search_path=''`/`service_role`-only and re-checks the exact predicate; no-leak;
scope; audit.sh; host 5×+reset.

---

## Resolution — corrective verified, FINAL PASS (Opus)

**All three findings fixed at the right level** (re-derived from the corrective code):
- **#1 (shared path):** `createUploadUrl` now generates `crypto.randomUUID()` as the row id and the object key is
  `${ownerId}/${assetId}` (unique per asset) + a DB `unique index` on `persona_clip_assets(storage_path)` (defence
  in depth). `content_hash` stays in its column. The **same-hash integration test proves it**: two uploads with the
  SAME `contentHash` get DISTINCT object paths; reaping the due draft leaves the protected (`attached`/null-reason)
  row UNTOUCHED and its bytes **downloadable + intact**. The row safeguard now maps 1:1 to objects.
- **#2 (COALESCE) + #3 (clock):** a new `supabase/migrations/0008_persona_clip_reap.sql` adds two `security definer`
  / `search_path=''` / **`service_role`-only** RPCs: `list_deletable_persona_clips` (the exact predicate using DB
  `now()`) and `mark_persona_clip_deleted` (`UPDATE … deleted_at=now(), deletion_reason=COALESCE(c.deletion_reason,
  'draft_abandoned') WHERE id AND <exact predicate>` — DB time, DB-side coalesce, atomic predicate re-check). The
  reaper calls list (DB now()) → per-row re-check RPC → `remove` (unique path) → mark RPC. **Remove-first, returned-
  `{error}` handling, no-leak, idempotency, frozen StoragePort all kept.**
- Unit tests cover transient **both** shapes (returned `{error}` AND thrown → `failed:1`, 0 marks), the `owner/assetId`
  path, and the CLI stdout no-leak (`scanned=… deletedAssetIds=[…]`, no path/url). pgTAP 56→**73**.

**The determinism gate did its job (§6).** On the host run-2, the same-hash test failed `scanned:3` (expected 1):
the **web** persona-clip integration test (a *different* package's run, same local DB) had left two due clips
(an approved / `policy_cleanup` clip) that the adapters reaper then scanned — a cross-package **test-isolation
leak**, not a product bug. Fix: an `afterEach` in `apps/web/.../persona-clip-routes.integration.test.ts` removes the
fixture applicants' Storage objects, detaches `admission_applications.persona_clip_asset_id`, and deletes the clip
rows. The same-hash test's strong global `scanned:1 / deleted:1` + protected-bytes-survive assertions were **kept**
(not weakened) — they are a useful canary. (A single run-1 pass would have falsely PASSed; the 5× requirement caught
it — validates the §6 discipline.)

**Host determinism — CONFIRMED (JT host, 2026-06-08):** clean `supabase db reset` (0008 applied) → `supabase test
db` **73** → **5 consecutive runs**, each `pnpm -F @soulbound/adapters test:integration` **4/4** + `pnpm -F web
test:integration` **5/5**; `clip:reap` CLI on the clean DB = `scanned=0 deleted=0 failed=0 deletedAssetIds=[]`.
Auditor re-ran host-independent: `audit.sh` PASS, adapters unit **22/22**. core/`0004` admission RPC/web-non-test
diff EMPTY. **→ FINAL PASS.**

(Minor runbook note: the adapters `test:integration` requires `SUPABASE_ANON_KEY` exported in addition to
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` — the determinism command and `docs/TASK9A_CLIP_REAP_RUNBOOK.md` should
list it; JT hit + resolved this on the first attempt.)
