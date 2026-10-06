# RC-1 Verification

Status: LOCAL GATE PASS / STAGING DEPLOYED / §13 FINAL AUDIT PASS / STAGING RC VALIDATED (`v0.1.0-rc.2`)

## SHA

baseline_sha: f9f1bad
candidate_sha: fafba308929544daebf2f10311117dfd6f7c8191

### Candidate history (fix-forwards after baseline)

| SHA | What | Authorization |
|---|---|---|
| `c8903b6` | docs: RC-1 runbook decisions finalized (docs-only) | — |
| `dbcd8ec` | docs: first verification record (docs-only) | — |
| `c07fe98` | **fix(build)**: `pnpm-workspace.yaml` build-script allowlist `allowBuilds: esbuild+sharp` (sharp = Next.js build requirement on Vercel). **0C-frozen file — JT-authorized minimal wiring fix** (precedent: audit.sh fix 1c243c1). | JT (committed directly) |
| `fafba30` | **fix(web)**: Next 16.0.0→16.2.7, React 19.2.0→19.2.7 security patches (+lockfile). | JT |

Per the runbook §4 ("re-run after any fix-forward"), the FULL local gate was re-run at `fafba30`
(the first record at `c8903b6` is superseded by the run below).

## Date / Runner

date: 2026-06-10 KST (re-gate at candidate); staging smoke updated 2026-06-16 KST
runner: JT (toolchain gates + real-device smoke) + Codex (staging role/decision/clip/reap smoke automation)
host: local Mac
pnpm: 11.1.3
node: 24.13.1

## Local gate — at candidate_sha `fafba30`

- `pnpm install --frozen-lockfile`: PASS
- `pnpm -r typecheck`: PASS
- `pnpm -r build`: PASS (web: Next 16.2.7 build OK, all routes emitted)
- `bash scripts/audit.sh`: PASS / AUDIT PASSED
- `pnpm -F @soulbound/core test`: PASS / 20 tests
- `pnpm -F @soulbound/adapters test`: PASS / 22 tests
- `pnpm -F web test`: PASS / 42 tests
- `supabase db reset`: PASS (migrations 0001–0008 + local seed)
- `supabase test db`: PASS / Files=3, Tests=73

## Live Integration Determinism — at candidate_sha `fafba30`

5 consecutive live runs (post-reset): PASS

Each run included:

- `pnpm -F @soulbound/adapters test:integration`: PASS / 4 tests
- `pnpm -F web test:integration`: PASS / 5 tests

## Persona Clip Reaper — at candidate_sha `fafba30`

Command:

```sh
pnpm -F @soulbound/adapters clip:reap
```

Result:

```text
scanned=0 deleted=0 failed=0 deletedAssetIds=[]
```

## Staging Deploy

- Vercel: NEW account `soulbounddao-admin` / team `soulbound-admin-s-projects`, project **soulbound-staging**.
  Settings per runbook §8: framework=nextjs, Root Directory=`apps/web` + include-source-outside-root, Node 24,
  build `cd ../.. && pnpm -F web build`, output not overridden, `ENABLE_EXPERIMENTAL_COREPACK=1` (pnpm 11.1.3).
- Preview deployment: READY, **git SHA metadata = `fafba30`** (matches candidate).
- Supabase staging: migrations **0001–0008 applied, NO seed** (runbook §6/§11).
- First HTTP smoke (shallow): `/` 200, `/signup` 200, unauthenticated API 401. (NOT the §13 smoke.)
- Vercel SSO / Deployment Protection: **OFF since 2026-06-10 16:08:30 KST** (lifted for the §13 smoke; staging is publicly
  reachable — open-signup decision applies). External reachability verified from a real mobile device (carrier
  network), no Vercel login prompt.
- Post-candidate documentation-only commits after `fafba30`: runtime diff from `fafba30` = 0; candidate unchanged.

## Staging Smoke (§13) — FINAL AUDIT PASS (Cowork/Opus; candidate `e517ec3` / `v0.1.0-rc.2`)

**PASS so far (2026-06-10, real device on carrier network):**
- Real new signup (redacted staging test account) → **email-confirmation ON works**: confirmation mail received, link →
  staging origin, then sign-in → `/gate` reached (no-application state + procedure list rendered).
- **profiles provisioning trigger verified ON STAGING**: direct DB query → exactly 1 `public.profiles` row,
  UID matches `auth.users`, `role='applicant'`, `membership_status='none'` (the 0007 trigger, real-signup path).
- **Custom SMTP proof captured**: confirmation mail sender shown as `noreply@soulbound.co.kr` (no longer the default
  `noreply@mail.app.supabase...` sender). This satisfies the RC-1 "email-confirm ON with real SMTP" requirement.
- **Applicant no-clip / skip path verified on a real mobile device**: Persona Clip unavailable/skip path → submit →
  `/apply/status` shows `제출됨` (PC-01: clip absence does not block submission).
- **Real-camera Persona Clip path verified on mobile Chrome (2026-06-16)**: camera preview/recording → upload
  completion (`Persona Clip이 준비되었습니다`) → submit → `/apply/status` shows `제출됨`.
- **Mobile compatibility observation**: Samsung Internet on the same Android device reported recorder unavailable and
  fell back to the no-clip path. This is not a data-loss/privacy failure because PC-01 fallback works, but it is a
  known alpha UX compatibility risk. Candidate fix-forward, if prioritized later: recorder MIME fallback/probing.

**PASS (2026-06-16, staging smoke automation with synthetic staging actors):**
- Created isolated staging smoke actors for clip-applicant, reject-applicant, and reviewer (service-role setup;
  real signup/email/profiles path is covered separately above).
- Clip application path: created signed Persona Clip upload, uploaded bytes, submitted application with clip asset.
- No-clip rejection path: submitted a second application without a clip.
- Role boundary: reviewer queue contains both applications; applicant access to admin queue returns **403**.
- Reviewer detail: clip asset present; signed clip playback/download succeeds and bytes match the uploaded clip.
- Decisions: reviewer approves the clip application and rejects the no-clip application; approved applicant sees
  `/api/membership/me` with `status='active'`; applicant response does not expose `reviewSummary`.
- No-leak checks: `audit_logs` + `outbox_events` for the smoke applications contain no `storage_path` or signed URL;
  public HTML/JS bundle scan contains neither the service-role key value nor the literal `SUPABASE_SERVICE_ROLE_KEY`.
- Persona Clip retention before reaper: approved clip row has `status='attached'`, `deletion_reason='application_approved'`,
  `delete_after` present, and `deleted_at` absent.
- Manual staging `clip:reap`:
  ```text
  persona-clip reap scanned=1 deleted=1 failed=0 deletedAssetIds=["23768a28-bcbc-4df8-997d-222a50f564ad"]
  ```
- Post-reaper evidence: target row is `status='deleted'`, `deletion_reason='application_approved'`, `deleted_at`
  present, and the Storage object is absent (`storageFetchStatus=400`). The storage path was read only internally for
  verification and was not printed in the CLI output or this record.

**PASS (2026-06-16, real-camera mobile Chrome clip through reviewer decision + reaper):**
- Latest real-camera Chrome submission identified on staging: application `54f5ad9d-6a6f-4c84-a358-bc3a0624999e`,
  clip asset `3d3aafa0-a750-4cde-8cf6-4d4c71989954` (safe IDs only; no storage path recorded).
- Reviewer queue/detail path saw the application and clip asset; reviewer signed playback/download succeeded before
  decision.
- Reviewer approved the application; DB verified `status='approved'`, `reviewed_at` present, reviewer present, and
  active membership issued for that application.
- Clip retention before reaper: row `status='attached'`, `deletion_reason='application_approved'`, `delete_after`
  present, `deleted_at` absent.
- Manual staging `clip:reap`:
  ```text
  persona-clip reap scanned=1 deleted=1 failed=0 deletedAssetIds=["3d3aafa0-a750-4cde-8cf6-4d4c71989954"]
  ```
- Post-reaper evidence: row `status='deleted'`, `deletion_reason='application_approved'`, `deleted_at` present,
  Storage object absent (`storageFetchStatus=400`), and audit/outbox no-path/no-URL check returned true.

**✅ Supabase Auth rate-limits — recorded (2026-06-10, staging dashboard):**
sign-ups/sign-ins **30 req/5min/IP** (the §15 open-signup mitigation, active); token refreshes 150/5min/IP;
token verifications 30/5min/IP; anonymous + Web3 locked (unused). Custom SMTP evidence is now captured above; re-check
the email-send limit in the dashboard before a larger alpha if the provider-specific cap needs to be recorded.

**Residual evidence notes for final audit:**
- INV-17 evidence is an automated deployed-bundle/API smoke (no service-role key in public HTML/JS; user-data calls
  use bearer tokens in the smoke harness), not a screenshot of browser devtools. Capture a devtools screenshot if the
  final audit wants that exact artifact. **→ Final audit ACCEPTS the automated bundle+API scan as sufficient** — a
  whole-deployed-bundle scan for the service-role key/literal plus a bearer-on-data-calls assertion is stronger and
  reproducible vs a single devtools screenshot; no screenshot required.
- Alpha reaper ops decision remains manual: JT runs `pnpm -F @soulbound/adapters clip:reap` against staging at least
  daily and promptly after approve/reject batches; persistent `failed>0` pauses/investigates alpha decisions. Public
  non-alpha launch must re-evaluate 9a-2 automation as a release-blocker/ops decision.

## Secret hygiene

- `/private/tmp` secret-bearing temp files (staging API keys, vercel env JSONs, API headers, CLI strings dump):
  **deleted 2026-06-10** (two sweeps). Non-secret artifacts (deployment metadata, SHA snapshots/tars, page HTML)
  remain; delete at RC close.

## Verdict — §13 FINAL AUDIT: PASS (Cowork/Opus)

Local gate green (re-gated at `fafba30`, forward-verified at the RC-2 candidate `e517ec3`). Staging deployed.
**§13 staging smoke = FINAL AUDIT PASS** — evidence complete + accepted: signup → profiles-provisioning trigger;
custom SMTP (`noreply@soulbound.co.kr`); applicant clip + no-clip submit (PC-01); reviewer role boundary
(applicant→admin **403**); reviewer clip playback; approve **and** reject; member active; `reviewSummary` not
exposed; audit/outbox no-leak + INV-17 bundle scan (no service-role key/literal in the deployed bundle); full clip
lifecycle → manual `clip:reap` (`deleted=1 failed=0`) → **Storage object absent (400)** — verified twice, including
a real-camera mobile-Chrome run.

**Candidate = `e517ec3` (`v0.1.0-rc.2`).** The one §13-era residual — Samsung Internet recorder unavailable — is
**CLOSED by RC-2 `e517ec3`** (device-verified; `docs/RC2_MIME_FALLBACK_AUDIT.md`). RC-1 §13 evidence **carries
forward** to `e517ec3` for every surface RC-2 did not touch (RC-2 = Persona Clip recorder MIME selection only);
the recorder delta was separately smoked (Samsung record + real-camera Chrome lifecycle → reap). No full §13 rerun
required.

**From an audit standpoint the staging RC is VALIDATED → GO for the internal alpha** (the decision to open the alpha
is JT's). Public/GA readiness remains separately gated on: (1) the internal-alpha run itself, and (2) the
reaper-automation (Task 9a-2) re-evaluation before any public (non-alpha) launch. `v0.1.0-rc.1 @ fafba30` and
`v0.1.0-rc.2 @ e517ec3` are both tagged; `e517ec3` is the current validated candidate.
