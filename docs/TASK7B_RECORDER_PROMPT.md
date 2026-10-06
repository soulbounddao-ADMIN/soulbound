# Task 7b — Persona Clip recorder component (surface) — spec + GLM builder prompt (Cowork-authored)

> Second slice of Task 7. **7b = the in-app recorder COMPONENT** (surface layer, but **built by Codex** — see
> below). 7b only consumes the 7a route's plain-fetch upload contract — it must NOT touch Supabase directly.
>
> **Builder = Codex (WORKFLOW §6 exception, JT-authorized 2026-06-05).** Risk-tier default for surface UI is GLM,
> but JT reassigned 7b to **Codex for stability**; first-pass + final audit = **Opus audit session** (builder ≠
> final approver preserved — Codex builds, Opus finals). Per-task exception, documented reason = stability.
> (Meta: if surface work keeps going to Codex, formalize it in WORKFLOW §8 instead of re-invoking the exception —
> see §4.)
>
> **⚠️ The hard rule (INV-PC-05, regardless of who builds):** the component/hook NEVER imports
> `@supabase/supabase-js`, NEVER calls `supabase.storage` / `createClient`, NEVER reads a service-role key. It
> records in-app, then uploads ONLY via the contract the 7a route returns. `scripts/audit.sh` greps
> `apps/web/components` for `createClient` and `apps` for `supabase.storage` — both must stay 0.

---

## 0. Grounded contract (verified from the working tree at HEAD `21b99a0` — NOT memory)

- **7a route the recorder calls** (`apps/web/app/api/admission/persona-clip/route.ts` + `_lib/schemas.ts`):
  `POST /api/admission/persona-clip` with JSON body `{ contentHash (8–256, /^[A-Za-z0-9._:-]+$/), mimeType (one of
  the `personaClipMimeTypes` enum: video/webm|video/mp4|audio/webm|audio/mp4), durationSeconds? (int 0–600) }`,
  authenticated via the user's session, returns `{ assetId: string, upload: { url, method: 'PUT', headers:
  Record<string,string> } }`. The browser uploads the recorded blob by `fetch(upload.url, { method: upload.method,
  headers: upload.headers, body: blob })` — NO Supabase SDK. (Read the route to confirm the exact shape.)
- **Apply submit** (`POST /api/admission/applications`, 6a) accepts optional `personaClipAssetId` +
  `personaClipHash`. The recorder produces `{ assetId, contentHash }`; the apply page (Task 8) passes them to submit.
- **INV-PC (frozen):** PC-01 absence never blocks submit; PC-02/04 in-app recording only — NO file-upload
  fallback, NO preview-and-retake, NO edit/filter/caption/AI; PC-05 no `supabase.storage` / no direct supabase
  client in the component; PC-08 the clip is the applicant's own. `apps/web/components` does not exist yet — 7b
  creates `apps/web/components/admission/persona-clip-recorder.tsx`.

---

## 1. COPY-PASTE PROMPT (paste into the GLM / Claude Code builder)

```text
Codex Task 7b — Persona Clip recorder component (surface/UI, stability-reassigned to Codex). Implement ONLY this
component + its logic hook + unit tests. Do NOT touch routes, adapters, services, supabase/, or packages/core. Do
NOT build other UI pages (Task 8).

Read first: apps/web/app/api/admission/persona-clip/route.ts + _lib/schemas.ts (the upload contract), the 6a apply
route (personaClipAssetId/Hash). Build:

A) Logic hook apps/web/components/admission/use-persona-clip-recorder.ts (component -> hook -> route; HARD RULE 1):
   State machine: idle -> requesting -> recording -> uploading -> done | unavailable | skipped.
   - start(): navigator.mediaDevices.getUserMedia({ video: true, audio: true }); if it rejects or MediaRecorder is
     unsupported -> state 'unavailable' (NOT an error the user must resolve).
   - record with MediaRecorder (mimeType 'video/webm'; it MUST be one of the route's personaClipMimeTypes). Collect
     chunks; on stop build a Blob.
   - contentHash = lowercase hex SHA-256 of the blob bytes via crypto.subtle.digest('SHA-256', ...).
   - POST /api/admission/persona-clip { contentHash, mimeType: blob.type, durationSeconds } via fetch (same-origin,
     credentials included so the session cookie/bearer is sent) -> read { assetId, upload }.
   - Upload: fetch(upload.url, { method: upload.method, headers: upload.headers, body: blob }). REQUIRE a 2xx.
   - onComplete({ assetId, contentHash }) fires ONLY after the upload returns 2xx — never just after getting the
     assetId (an un-uploaded assetId must never reach submit). On any failure -> surface a retryable error state
     but DO NOT block; the user can still skip.
   - skip(): onSkip(); state 'skipped'. Always stop tracks / release the camera on stop/unmount.

B) Component apps/web/components/admission/persona-clip-recorder.tsx ('use client'): a THIN shell over the hook.
   Props: { onComplete: (r: { assetId: string; contentHash: string }) => void; onSkip: () => void }.
   UI (minimal, per the frozen design):
     Persona Clip — 선택 사항. "[녹화하기]" "[건너뛰기]".
     while recording: a live camera viewfinder + "[녹화 중지]". (Live viewfinder during active recording is allowed;
       there is NO post-record playback/retake/edit — stop -> hash -> upload -> done.)
     unavailable: "녹화를 사용할 수 없습니다. Persona Clip 없이 계속 진행할 수 있습니다. [계속하기]" -> onSkip.
     uploading: a simple progress/disabled state. done: a brief confirmation (no playback).

FORBIDDEN (violation = redo — INV-PC hard rules, builder-agnostic):
 - importing @supabase/supabase-js, calling createClient, or any supabase.storage / direct storage upload — the
   ONLY upload path is fetch() to upload.url with the contract the 7a route returns;
 - reading SUPABASE_SERVICE_ROLE_KEY or any service-role key in the component/hook;
 - a file-input / "choose a video" upload fallback, a preview-and-retake flow, edit/filter/caption/AI (INV-PC-02/04);
 - calling onComplete before the upload's 2xx (no un-uploaded assetId may reach submit);
 - making absence-of-clip block anything (PC-01): skip and unavailable must always let the user continue;
 - editing routes/adapters/services/supabase/packages/core; building Task 8 pages.

GATE (this is UI — no live-DB integration gate; deterministic UNIT tests + a manual QA checklist):
 - Unit tests for the hook (vitest; mock navigator.mediaDevices.getUserMedia, MediaRecorder, crypto.subtle,
   global fetch — add @testing-library/react + jsdom ONLY if needed, minimally):
     * happy path: start -> stop -> POSTs { contentHash (hex sha256), mimeType, durationSeconds } -> uploads the
       blob to upload.url with upload.method + upload.headers -> onComplete({assetId, contentHash}) fires AFTER the
       upload 2xx;
     * onComplete does NOT fire if the upload returns non-2xx;
     * getUserMedia rejection / no MediaRecorder -> 'unavailable', onSkip available, nothing thrown;
     * skip() -> onSkip(), no network calls;
     * the POSTed mimeType is one of the route's personaClipMimeTypes.
 - A short manual-QA checklist file (record a real clip -> attaches; deny camera permission -> unavailable ->
   continue; skip -> no clip; slow upload -> no double-submit).
 - These run under the existing apps/web `test` (stack-free): `pnpm -F web test` green.

ACCEPTANCE (report each verbatim):
 - `pnpm -F web test` green (incl. the new recorder hook tests); `pnpm -r typecheck` clean; `pnpm -r build` ok;
 - `bash scripts/audit.sh` PASS with .next present — esp. "no direct supabase client in components" and
   "persona clip: no supabase.storage in apps" both OK (now that apps/web/components exists);
 - existing gates unchanged: `supabase test db` 49, web `test:integration` green, adapters/core tests green;
 - `git status --short` shows ONLY apps/web/components/** (+ the manual-QA checklist doc, + minimal vitest/dep
   wiring if a DOM test runner was added);
 - `git diff --stat packages/core/src packages/adapters/src supabase apps/web/app/api` empty (7b touches NO routes/adapters).
STOP and report. Do not self-approve — Codex first-pass audits, the Opus session finals, JT commits.
```

---

## 2. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add Task 7b recorder builder prompt`.
2. Paste §1 into the **Codex** builder. Codex builds the hook + component + unit tests + QA checklist, STOPS.
3. **Opus audit session audits/finals** (builder ≠ approver: Codex built it): NO supabase.storage / no createClient
   / no service-role key in the component or hook (the make-or-break); upload only via the 7a contract;
   onComplete fires strictly after the upload 2xx (upload-before-submit — closes the 7a residual #2); skip +
   unavailable never block (PC-01); no file-upload/preview/retake/edit (PC-02/04); unit tests cover the state
   machine; audit.sh's component checks pass. Re-derive from git, re-run audit.sh.
4. On PASS, JT commits: `feat(web): Task 7b persona-clip recorder component` → `docs: record Task 7b audit pass`.
   Task 7 (Persona Clip route + recorder) complete. Then **Task 8** (UI pages — apply page wires this recorder).

## 3. Out of scope (explicit)
- Routes/adapters/services/`supabase/`/`packages/core` (7a + frozen). Task 8 UI pages (the apply page consumes the
  recorder's `onComplete`/`onSkip`). The Storage byte-delete worker = Task 9. No upload fallback/preview/retake/edit.

## 4. Decisions (JT, 2026-06-05)
- **Viewfinder: CONFIRMED.** A live camera viewfinder during active recording IS built. There is NO post-record
  playback, NO review-then-retake, NO edit — record → stop → hash → upload → done.
- **Builder reassignment (meta):** 7b is surface UI yet built by Codex (stability). This is the first true surface
  task; if Task 8 (UI pages) and later surface work also go to Codex, the WORKFLOW §8 "surface = GLM" assignment is
  effectively dead — at that point **update WORKFLOW.md §8 + the four charters** to say "Codex builds all tiers,
  GLM not used; builder ≠ approver preserved by Codex-builds + Opus-finals", rather than re-invoking the §6
  exception every task (the exception is, by definition, not supposed to generalize). Opus (auditor) will raise
  this for a decision after 7b. No action needed now beyond noting it.
