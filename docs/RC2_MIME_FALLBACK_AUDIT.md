# RC-2 candidate `e517ec3` — Persona Clip recorder MIME fallback — Audit Findings (final auditor record)

> Builder: **Codex** (same-session build+push — a process deviation JT flagged + corrected; `e517ec3` was treated as
> un-approved builder output until this audit). Independent audit: **Opus/Cowork final** + a 3-lens adversarial
> workflow (`wf_cfacdfc9-6d0`) run independently of both the builder session and the auditor. **Verdict: CODE PASS +
> Samsung Internet device smoke PASS ⇒ `v0.1.0-rc.2` tagged @ `e517ec3`**. Safari = follow-up
> compatibility smoke, NOT a blocker (graceful PC-01 degradation — see below). builder ≠ approver preserved
> (Codex built → Opus + independent agents finalize).

## Change
`fix(web): add persona clip recorder MIME fallback` — so Samsung Internet / Safari (no WebM MediaRecorder) can record
as MP4 while Chrome/WebM is preserved. Scope: **exactly 2 files** — `apps/web/components/admission/
use-persona-clip-recorder.{ts,test.ts}`. Diff vs `e517ec3^`: 2 files, +115/−12.

## The make-or-break — handled, type-enforced
The recorder now separates `recordingMimeType` (may carry a codec suffix, e.g. `video/webm;codecs=vp8,opus`) from
`uploadMimeType`, **typed as the literal union `"video/webm" | "video/mp4"`**. The codec-suffixed string is used
ONLY for the `MediaRecorder` constructor and never leaves the browser. The POST body `mimeType`, the Blob's declared
type, and (downstream) the Storage content-type are all driven by `uploadMimeType` — compiler-guaranteed to be one of
the two bare values, both in the server `personaClipMimeTypes` enum (`schemas.ts`), which the route re-validates via
zod. So no codec-suffixed or disallowed MIME can reach the API or Storage, even from a forged client (the adapter
uses `parsed.data.mimeType`, post-validation).

## Independent adversarial audit (workflow `wf_cfacdfc9-6d0`, 3 lenses, all `holds=true`)
- **MIME allowlist bypass** — could not break it. Traced selectRecorderMimeType → uploadMimeType → POST body →
  createUploadUrl → Storage content-type; all constrained to the bare union.
- **Regression** — none. Chrome/WebM path preserved; PC-01 unavailable/no-clip fallback is strictly *more* permissive
  (truth-table vs pre-fix); upload-before-onComplete + injected-bearer split + no-leak are byte-identical;
  `isTypeSupported` is now `try/catch`-wrapped (safer than the pre-fix bare call).
- **Test vacuity + scope** — tests are non-vacuous, **proven by 3 mutation tests** the agent ran (codec-suffix leak →
  fallback test fails; null→first-candidate default → unavailable test fails; webm-happy-path codec regression →
  contract test fails; working tree restored clean). Scope = exactly the 2 files; no DB/API/storage/auth/RLS/retention
  contract changed.
- **Findings:** P0/P1 = **0**. One **P2 (non-blocking, pre-existing, NOT introduced)**: the server enum
  `personaClipMimeTypes` also permits `audio/webm`/`audio/mp4` (broader than the client union) — untouched by this
  commit, within the already-allowed contract. No action for RC-2.

## Auditor-rerun gates (host-independent)
`pnpm -F web test` **44/44**; `bash scripts/audit.sh` PASS; `pnpm -r typecheck` clean. (Builder also reported
`pnpm -r build` PASS, core 20, adapters 22.) Working tree clean post-workflow; HEAD = `e517ec3`; the 2 files match
the commit (no leftover mutation).

## RC-2 device smoke — Samsung Internet: **PASS** (real Android device)
The fix's entire purpose is the non-Chrome recording path; confirmed on a real device:
- Samsung Internet `/apply` → Persona Clip area shows a **live camera preview + recording control** (`녹화 중지`),
  NOT "녹화를 사용할 수 없습니다" → recording completed ("Persona Clip이 준비되었습니다") → application submitted →
  `/apply/status` showed `제출됨`.
- Evidence: live camera preview visible; recording control visible; upload/attach-ready state; application submitted;
  status `제출됨`.
- This closes the Samsung Internet recorder-unavailable bug that RC-2 targeted, on a real device.

## Safari — follow-up compatibility smoke (Cowork decision: NOT an rc.2 blocker)
Safari (iOS/macOS) is **not required for the `v0.1.0-rc.2` tag**. Rationale:
- RC-2's stated goal (Samsung recorder-unavailable) is device-proven.
- The code audit established **graceful degradation on any unsupported browser**: if Safari supports none of the MIME
  candidates, `selectRecorderMimeType()` → null → `unavailable` → submit-without-clip (PC-01). The worst case on
  Safari is "no clip" (or, if it records an unplayable MP4, a clip the reviewer can't play) — neither blocks submit
  nor the admission decision. The residual is bounded and non-blocking.
- Therefore Safari is a **tracked follow-up compatibility smoke** (run during the alpha if a Safari user is present,
  or before broad/public launch), scope: does Safari record via the mp4 path, and does the reviewer's `<video>` play
  the resulting clip. JT confirms this scoping.

## Tag decision — DONE
- **CODE PASS** (this audit) + **Samsung device smoke PASS** ⇒ `v0.1.0-rc.2` **tagged @ `e517ec3`** (HEAD `b66f090`).
  `v0.1.0-rc.1 @ fafba30` untouched.

## Delta-smoke scope (carry-forward principle)
- **Full §13 rerun is NOT required for RC-2** because the fix only touches the Persona Clip recorder MIME-selection
  surface.
- **RC-1 §13 staging-smoke evidence carries forward** to `e517ec3` for every surface RC-2 did not touch — auth,
  role boundary, reviewer decision, membership, reaper, storage deletion, audit/outbox no-leak, and INV-17 — because
  `e517ec3` is code-identical to `fafba30` on those surfaces. That evidence is FINAL-AUDIT PASS in
  `docs/RC1_VERIFICATION.md`.
- **RC-2 delta smoke passed** (Samsung Internet, real device): recording, upload-ready, submit, reviewer playback,
  approve, manual `clip:reap` (`deleted=1 failed=0`), and storage object absence — plus a real-camera mobile-Chrome
  run through the same lifecycle. So the changed surface is independently verified end-to-end.
- Net: the staging RC is validated on `e517ec3`; the only remaining release-readiness items are the internal-alpha
  run and the pre-public reaper-automation (9a-2) decision (see `docs/RC1_VERIFICATION.md` Verdict). rc.2 itself is
  correctly tagged.

## Process note (governance)
`e517ec3` was built, tested, committed, pushed, and preview-deployed within a single Codex session — builder and
operator mixed. JT flagged + corrected this. Going forward: **product-code changes are committed/pushed only after
the independent final-audit GO; tag/deploy/promote only on explicit GO; already-pushed builder output is not called a
"candidate" until approved.** This audit is that independent GO for the *code*; the tag waits on the device smoke.
`v0.1.0-rc.1 @ fafba30` is untouched.
