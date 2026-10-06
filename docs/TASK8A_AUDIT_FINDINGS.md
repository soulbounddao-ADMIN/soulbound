# Task 8a — Auth foundation + public/applicant UI — Audit Findings (final auditor record)

> Builder: **Codex** (per WORKFLOW §8 amendment — Codex builds all tiers; not a §6 exception). Final auditor:
> **Opus audit session** (separate; builder ≠ approver preserved). Verdict: **PASS** with one **HIGH carry-forward**
> that is out of 8a's scope (profiles provisioning — see below). Commit by **JT** (host). Spec:
> `docs/TASK8A_AUTH_APPLICANT_UI_PROMPT.md`. First slice of Task 8; 8b (member + admin) follows.

8a = the browser auth foundation (anon client + session provider + `authedFetch` bearer + role via
`current_user_role`), the public + applicant pages (landing/login/signup/gate/apply/status), and the bearer
wiring fix for the 7b recorder.

## Audit method (re-derived from the working tree — not a rubber stamp)

Re-derived scope + protected-surface diff from git; **re-ran host-independent gates myself** (`audit.sh`,
`pnpm -F web test`, the service-role/createClient/`.from`/`.storage` greps, the built-bundle grep); read the
security-critical source (clients.ts diff, auth-provider, recorder bridge diff, apply page, status page) and the
three test files. Confirmed the FK reality behind the builder's flagged profiles gap from migration 0001.

## Verified

- **INV-17 / 3-client (the make-or-break) — clean, proven at source AND bundle.** `SUPABASE_SERVICE_ROLE_KEY` /
  `service_role` / `createServiceRoleSupabaseClient` = **0** in all client code (only in `app/api/**` server libs +
  integration tests, correctly); **0** in the built client bundle (`grep service_role apps/web/.next/static` = 0);
  `createClient(` = 0 in `apps/web/components` (the adapters factory is used). The browser Supabase client makes
  **no** `.from()` / `.storage()` data call — auth + `current_user_role` only.
- **`createBrowserSupabaseClient`** (adapters, the only adapters change): anon key only (`SupabaseAnonClientConfig`),
  `persistSession:true`/`autoRefreshToken:true` — mirrors `createAnonSupabaseClient`. No service-role path.
- **AuthProvider** (`apps/web/lib/auth-provider.tsx`): single anon browser client from `NEXT_PUBLIC_*` (fail-loud if
  missing); role resolved via `client.rpc("current_user_role")` (the trusted source, default `applicant`) — the only
  non-auth client call; `authedFetch` reads the token from a **ref** (no stale closure), attaches
  `Authorization: Bearer <token>`, and **throws `UnauthenticatedError` without calling the route when there is no
  session**. signIn/signUp/signOut + an `onAuthStateChange` listener with a revision guard against stale-role races.
- **Recorder bearer bridge** (closes the gap I flagged in the 8a spec): `usePersonaClipRecorder` gained an optional
  `authedFetch`; the route POST uses `authedFetch ?? globalThis.fetch` (bearer attached when provided; default keeps
  the 6 existing hook tests green), while the upload PUT uses `globalThis.fetch` (storage contract headers, **no**
  bearer). The upload-before-onComplete guarantee is untouched. A new test proves the route POST carries
  `Bearer …` and the upload PUT does NOT.
- **Apply page** — PC-01 + idempotency correct: clip fields are included ONLY when the recorder completed and are
  **omitted when skipped, with submit still proceeding** (tested: "still submits after clip skip and omits clip
  fields"); `idempotencyKey = crypto.randomUUID()` generated once, reused across retries, cleared on success; 401 /
  `UnauthenticatedError` → `/login`; 422/403/409 mapped to applicant-facing messages. The recorder is mounted with
  `authedFetch={authedFetch}`.
- **Gates I re-ran:** `audit.sh` PASS (both component checks still OK with all new client files present);
  `pnpm -F web test` **29/29** (7 files; recorder 6→7, +auth-provider 1, +apply 6) — deterministic (jsdom, mocked).
  Builder's regression gates (typecheck/build, `supabase test db` 49, `test:integration` 5, adapters 17, core 19)
  are on surfaces 8a does not touch (empty protected-surface diff corroborates no regression).
- **Scope:** only `apps/web/app/**` (pages + layout + globals + `_components` + manual-QA), `apps/web/lib/**`
  (auth foundation), `apps/web/components/admission/**` (recorder bridge + test), `apps/web/vitest.config.ts`,
  `packages/adapters/src/{index.ts,supabase/clients.ts}`. `git diff HEAD -- packages/core/src supabase
  apps/web/app/api pnpm-lock.yaml` = **EMPTY**. No new API routes (role via the RPC → frozen §4.2 surface intact).

## Determinism

8a's gate is deterministic mocked unit tests + greps + manual QA (like 7b), NOT a live-DB fixture → no flaky
risk, no 5×+reset host gate required. The live regression gates are unchanged by construction (no DB/route edits).

## Findings

1. **[HIGH — carry-forward, correctly OUT of 8a scope] New browser signup does not provision a `public.profiles`
   row.** Confirmed from migration 0001: `admission_applications.applicant_id NOT NULL references
   public.profiles(id)`, `profiles.id references auth.users(id)`, and there is **no** `on auth.users` trigger
   (grep for trigger / `handle_new_user` / `insert into public.profiles` = 0). So a net-new `signUp` creates an
   `auth.users` row but no `profiles` row → `submitApplication` FK-violates. Seeded users (`*@soulbound.local`) have
   profiles rows from `seed.sql`, which **masked** this in the builder's manual test. 8a is correctly forbidden from
   touching `supabase/**` or adding routes, so the builder rightly flagged-not-fixed. **This blocks the net-new
   applicant happy-path** and must be resolved before the flow is demoable end-to-end.
   - **FIX DIRECTION (separate security-layer task, Codex):** add a migration with a `security definer`,
     `search_path=''` function + `create trigger after insert on auth.users` that inserts
     `public.profiles(id, role) values (new.id, 'applicant')` (the standard Supabase provisioning pattern; consistent
     with the project's RPC hygiene), plus a pgTAP assertion that a new auth user gets an `applicant` profile row.
     Alternative (worse: adds a route) = a server-side signup-provisioning endpoint. Recommend slotting this
     **right after the 8a commit, before 8b** — it is small, unblocks the whole applicant path, and is testable.
2. **[LOW — latent, non-blocking] Status page is wired to display `reasonCode` to the applicant** (`reasonLabel[...]`,
   guarded by `isAdmissionReasonCode`). It is **dormant today** (the applicant `AdmissionApplication` does not carry
   `reasonCode`, so nothing renders — no live leak). But `reasonCode` is the **internal** audit/classification enum
   (e.g. `duplicate_identity_suspected`, `mismatch_with_policy`); the applicant-facing field is `applicantNotice`.
   Confirm the intent: if `reasonCode` is NOT meant to be applicant-visible, **remove the dormant display branch** so
   a future API change can't inadvertently surface the internal classification. (Today: applicantNotice shows,
   reasonCode does not.)
3. **[NOTE — not a defect] Builder's "no reasonCode" item.** Showing `applicantNotice` (the human, applicant-facing
   notice) rather than the internal `reasonCode` enum is the **correct** applicant-facing behavior — not a limitation
   to fix. (Ties to finding 2: the dormant reasonCode branch is the part to reconsider, not the applicantNotice
   display.)

## Out of scope (unchanged)
- `/member`, `/admin/applications`, `/admin/applications/[id]` + reviewer decision UI / clip playback = **8b**.
  Profiles provisioning = the recommended separate DB task (finding 1). Outbox/byte-delete workers = **Task 9**.
  Real-camera QA = manual (`task8a.manual-qa.md`).

## Runtime confirmation (host-only / auditor-rerun)
Auditor re-ran (sandbox, host-independent): `audit.sh` PASS, `pnpm -F web test` 29/29. Builder/host green:
typecheck, build, `supabase test db` 49, `test:integration` 5, adapters 17, core 19, client/bundle service-role 0,
`.from`/`.storage`/component-`createClient` 0, seeded applicant login → /gate → /apply.
