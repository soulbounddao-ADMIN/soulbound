# Task 7b — Persona Clip recorder component — Audit Findings (final auditor record)

> Builder: **Codex** (surface UI, reassigned from GLM via WORKFLOW §6 exception — JT-authorized for stability,
> 2026-06-05). Final auditor: **Opus audit session** (separate; builder ≠ approver preserved). Verdict: **PASS**.
> Commit by **JT** (host). Spec: `docs/TASK7B_RECORDER_PROMPT.md`. Completes Task 7 (with 7a).

7b = the in-app recorder: a logic hook + a thin `'use client'` shell + 6 hook unit tests + a manual-QA checklist.
It records in-app and uploads ONLY via the 7a route's plain-fetch contract — it never touches Supabase.

## Audit method (re-derived from the working tree — not a rubber stamp)

Read the hook + component + the 6 hook tests + the vitest wiring; grepped the component tree for any Supabase
usage; re-ran `audit.sh` (the component checks now RUN); confirmed scope + protected surface untouched. The hook
tests are fully mocked (no camera/network) → deterministic by construction; the real-camera path is manual QA.

## Verified

- **INV-PC-05 (the 7b make-or-break) — clean.** `apps/web/components` contains NO `@supabase/supabase-js`, NO
  `supabase.storage`, NO `createClient`, NO service-role key (grep = 0; `audit.sh` "no direct supabase client in
  components" + "persona clip: no supabase.storage in apps" both now RUN and PASS). The hook uploads via
  `fetch(upload.url, { method, headers, body: blob })` using the contract the 7a route returns — no SDK.
- **upload-before-onComplete (closes 7a residual #2).** In `uploadRecording`, `onComplete({assetId, contentHash})`
  fires ONLY after the upload `fetch` returns 2xx (after the `!uploadResponse.ok → throw` guard). POST-failure,
  upload-failure (503), and MediaRecorder-error all route to a retryable error state and **never** call onComplete.
  Tested: the happy-path asserts event order `['create','upload','complete']` and that onComplete is NOT called
  while the upload is pending; a separate test asserts a 503 upload → status 'error', onComplete not called. So an
  un-uploaded `assetId` can never reach submit.
- **PC-01 / 02 / 04.** `skip()` and the `unavailable` state (getUserMedia rejection or missing MediaRecorder) always
  let the user continue (no clip) — neither throws, neither blocks. In-app recording only (getUserMedia +
  MediaRecorder, `video/webm` ∈ the route's allowed mimes); NO file-upload fallback, NO post-record playback /
  retake / edit (the recorded blob is never rendered back; record → stop → hash → upload → done). A **live
  viewfinder** during active recording IS shown (the confirmed design) via `<video srcObject={stream}>`.
- **Component shell** is thin (delegates all logic to the hook), `'use client'`, props `{ onComplete, onSkip }`
  (the contract Task 8's apply page consumes), releases the camera on stop/skip/unmount.
- **Tests + wiring.** 6 deterministic hook tests (mock getUserMedia/MediaRecorder/crypto.subtle/fetch) cover
  happy-path-with-ordering, upload-failure-no-complete, recorder-error-no-upload, permission-denied→unavailable,
  missing-MediaRecorder→unavailable, skip→onSkip+camera-release. `vitest.config.ts` now includes
  `components/**/*.test.ts`, still excludes `*.integration.test.ts` + `.next`; the hook test uses a per-file
  `@vitest-environment jsdom` so the node route-handler tests are unaffected. Web unit 21 (15 + 6), integration 5
  unchanged.
- **Scope.** Only `apps/web/components/admission/**` + `apps/web/package.json` + `apps/web/vitest.config.ts` +
  `pnpm-lock.yaml`. `git diff` of `packages/core/src`, `packages/adapters/src`, `supabase`, `apps/web/app/api`
  all empty. No skip/todo/only. audit.sh PASS.

## Determinism note (differs from 6a/7a)

7b's gate is **mocked unit tests** (no live DB / camera / network) → deterministic by construction; the flaky-live
fixture risk of 6a/6b/7a does NOT apply, so no 5×+reset host gate is required. The **real-camera behavior is manual
QA** (`persona-clip-recorder.manual-qa.md`) — JT runs it when Task 8 mounts the component (record / deny
permission / skip / slow upload).

## Meta — builder reassignment (decision now ripe for JT)

7b is the first true SURFACE task and it was built by **Codex** (not GLM) via the §6 exception, and it came back
clean (no Supabase-in-component — the exact GLM failure mode the exception sidesteps). The §6 exception is, by
definition, NOT supposed to generalize. **Task 8 is also surface UI.** So before Task 8, decide: (a) keep per-task
exceptions, or (b) formalize in WORKFLOW §8 + the four charters — "Codex builds all tiers; GLM not used; builder ≠
approver preserved by Codex-builds + Opus-finals." Opus (auditor) will apply whichever JT chooses.

## Out of scope (unchanged)
- The apply page that mounts the recorder = **Task 8**. The Storage byte-delete worker = **Task 9**. No upload
  fallback / preview / retake / edit (INV-PC-02/04).

## Runtime confirmation (host-only)
Builder/host green: web unit 21, web integration 5, pgTAP 49, adapters 17, core 19, typecheck, build, audit.sh.
Deterministic (mocked) → single host run suffices; JT confirms `pnpm -F web test` + audit at commit.
