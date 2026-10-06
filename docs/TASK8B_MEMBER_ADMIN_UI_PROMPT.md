# Task 8b — Member + admin/reviewer UI — spec + Codex builder prompt (Cowork-authored)

> Second (final) slice of Task 8. **8b = the member home + the reviewer/admin pages** (review queue, application
> detail, the approve/reject/request-more-info decision UI, and reviewer Persona-Clip playback). It consumes the
> existing 6b/7a routes — **8b adds NO new API routes, NO adapters change, NO core change**: it is pure client UI on
> top of the 8a auth foundation. Completes the 8a login-redirect targets (`/member`, `/admin/applications`).
>
> **Builder = Codex** (WORKFLOW §8 amendment — Codex builds all tiers). Final audit = **Opus audit session**
> (builder ≠ approver). JT commits.
>
> **⚠️ Make-or-break (any violation = redo):**
> 1. **No service-role / no direct Supabase in the browser.** 8b creates NO Supabase client — it uses the 8a
>    `AuthProvider`'s `authedFetch` for every call. `createClient` / `service_role` / `.from()` / `.storage()` stay
>    **0** in all 8b client code (INV-17 / HARD RULE 1).
> 2. **Client role-guard is UX only; the routes are the security boundary.** The admin pages may hide behind a
>    role check for UX, but a non-reviewer who reaches them still gets **403** from `requireReviewer` (already
>    audited) → no data leaks. Never treat the client role as authority.
> 3. **`reviewSummary` is reviewer-internal.** It may be shown on the reviewer detail page (reviewer-gated route),
>    but must NEVER appear on any applicant-facing page (the 8a status page already omits it — do not change that).
> 4. Every route call carries `Authorization: Bearer …` (via `authedFetch`).

---

## 0. Grounded contract (verified from the tree — re-read each file; do not trust this paraphrase)

**Auth/session:** reuse 8a's `apps/web/lib/auth-provider.tsx` — `useAuth()` gives `{ session, role, loading,
authedFetch, … }`. Use `authedFetch` for ALL calls; on `UnauthenticatedError` / HTTP 401 → `router.replace("/login")`.

**Routes 8b consumes (all exist; read each for the exact shape):**
- `GET /api/admin/applications?status=&limit=&cursor=` → `requireReviewer`; returns **`readonly AdmissionApplication[]`**
  (a plain array — `listReviewQueue`; cursor is an input param, the response is just the array). Query =
  `reviewQueueQuerySchema` { status? (AdmissionStatus), limit (default 50, 1–100), cursor? }.
- `GET /api/admin/applications/{id}` → `requireReviewer`; returns one `AdmissionApplication` or 404.
- `POST /api/admin/applications/{id}/review` → body `{ idempotencyKey }` (startReviewSchema). submitted → under_review.
- `POST /api/admin/applications/{id}/approve` | `/reject` | `/request-more-info` → body
  `{ reasonCode (AdmissionReasonCode), applicantNotice?, reviewSummary?, idempotencyKey }` (reviewDecisionSchema) →
  Result (resultToResponse: 200 ok | 409 INVALID_STATE_TRANSITION/CONFLICT | 403 | 422 | 404 | 502).
- `GET /api/admin/applications/{id}/persona-clip-url` → `requireReviewer`; returns `{ url }` (short-lived signed read
  URL) or 404 if no clip.
- `GET /api/membership/me` → returns `Membership | null` (Membership.status ∈ active|suspended|revoked).

**`AdmissionApplication` fields (frozen)** the reviewer detail shows: `id, applicantId, status, applicantStatement?,
motivation?, referralCode?, reviewerId?, reviewedAt?, reviewSummary?` (internal), `applicantNotice?` (applicant-facing),
`policyVersion, personaClipAssetId?/personaClipHash?` (null ⇒ no clip), `createdAt, updatedAt`. **There is NO
top-level `reasonCode` field** (reasonCode flows into events/audit, not stored queryable on the row — so the detail
page cannot display a historical reasonCode; show status + applicantNotice + reviewSummary instead).

**Statuses:** draft, submitted, under_review, needs_more_info, approved, rejected, withdrawn, expired.
**Reason codes (enum):** meets_phase1_policy, insufficient_context, mismatch_with_policy,
needs_identity_clarification, duplicate_identity_suspected, applicant_withdrew, application_expired.

**Pages 8b creates (BuildPlan §4.2):** `app/member/page.tsx`, `app/admin/applications/page.tsx`,
`app/admin/applications/[id]/page.tsx`. (8a already routes login → these.)

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 8b — Member + admin/reviewer UI. Implement ONLY these pages on top of the 8a auth foundation. Do NOT add
any API route, do NOT change adapters, services, supabase/, packages/core, the 8a auth-provider, or the applicant
pages. Pure client UI consuming existing routes via the 8a authedFetch.

Read first (confirm shapes, don't trust paraphrase): apps/web/lib/auth-provider.tsx (useAuth/authedFetch),
apps/web/app/api/admin/applications/route.ts + [id]/route.ts + [id]/{review,approve,reject,request-more-info}/route.ts
+ [id]/persona-clip-url/route.ts, apps/web/app/api/membership/me/route.ts, packages/core admission types
(AdmissionApplication / AdmissionStatus / AdmissionReasonCode), apps/web/app/apply/status/page.tsx (pattern to mirror:
auth guard, authedFetch, 401->/login, error handling) + apps/web/lib/api-response.ts.

A) app/member/page.tsx ('use client'): auth guard (loading -> wait; no session -> /login). authedFetch GET
   /api/membership/me. If a Membership with status==='active' -> a minimal member home (welcome + membership status).
   If null / non-active -> "아직 멤버가 아닙니다" + link to /gate. 401 -> /login.

B) app/admin/applications/page.tsx ('use client'): role-guard for UX (loading -> wait; if role is not 'reviewer'|
   'admin' -> router.replace('/gate')) — BUT the security is the route, so also handle a 403 response by showing
   "권한이 없습니다" (do not assume the client guard is enough). authedFetch GET /api/admin/applications with an
   AdmissionStatus filter <select> (default: show the actionable queue, e.g. status=submitted; allow changing it and
   an "all" option that omits status). Render the returned array: applicantId, status, createdAt, and a "클립" marker
   when personaClipAssetId is set. Each row links to /admin/applications/{id}. Optional: a "더 보기" using cursor =
   the last item's id when the array length === limit (skip if not trivial). (No applicant PII join in P0 — applicantId
   is the reference.)

C) app/admin/applications/[id]/page.tsx ('use client'): role-guard (as in B) + 403 handling. authedFetch GET
   /api/admin/applications/{id} (404 -> "신청을 찾을 수 없습니다"). Render: status, applicantStatement, motivation,
   referralCode, applicantNotice, reviewSummary (label it 검토자 내부 메모 — reviewer-internal), reviewerId/reviewedAt,
   timestamps. Persona Clip: if personaClipAssetId is set, a "클립 재생" button -> authedFetch GET
   /api/admin/applications/{id}/persona-clip-url -> set a <video controls src={url}> from the returned { url } (do NOT
   autoplay; the URL is short-lived — fetch on click). Decision actions, gated by status:
     - status==='submitted': a "검토 시작" button -> POST /api/admin/applications/{id}/review { idempotencyKey:
       crypto.randomUUID() }.
     - status==='under_review': three actions — Approve / Reject / Request more info — each a small form with a
       reasonCode <select>, an applicantNotice <textarea> (applicant-facing), a reviewSummary <textarea> (internal,
       optional), and POST to /approve | /reject | /request-more-info with { reasonCode, applicantNotice?,
       reviewSummary?, idempotencyKey: crypto.randomUUID() }. Suggested reasonCode options (the route validates the
       enum; offer sensible ones): approve -> meets_phase1_policy; reject -> mismatch_with_policy /
       insufficient_context / duplicate_identity_suspected; request-more-info -> needs_identity_clarification /
       insufficient_context.
     - any other status (needs_more_info / approved / rejected / withdrawn / expired): read-only (no action buttons),
       just show the status.
   After a successful decision -> re-fetch the detail (reflect the new status). Handle 409 (invalid transition /
   conflict) by showing a message and re-fetching (the route is the authority — the UI only offers likely actions).
   Generate a fresh idempotencyKey per submitted action; 401 -> /login; 403 -> 권한 메시지.

   (Optional, UX only) extend apps/web/app/_components/site-header.tsx with role-aware links (멤버 -> /member,
   reviewer|admin -> /admin/applications). Keep it minimal; do not add data fetching to the header.

FORBIDDEN (violation = redo):
 - importing @supabase/supabase-js / calling createClient / service_role / .from() / .storage() anywhere in client
   code (8b uses ONLY the 8a authedFetch);
 - adding/altering any API route, adapter, service, supabase/ file, packages/core, the 8a auth-provider, or the
   applicant pages;
 - showing reviewSummary on any applicant-facing page (reviewer detail only);
 - treating the client role as the security boundary (it is UX; routes enforce requireReviewer);
 - free-text reason inputs that bypass the reasonCode enum (reasonCode is enum-only, INV-22).

GATE (UI — deterministic unit tests + a source grep + a manual-QA checklist; no new live-DB gate):
 - Unit tests (vitest jsdom; mock useAuth/authedFetch + next/navigation):
     * queue: renders the array; the status <select> changes the request query; a 403 shows the permission message;
       a non-reviewer role triggers the redirect.
     * detail: renders the fields incl. reviewSummary (reviewer view); "클립 재생" appears ONLY when personaClipAssetId
       is set and on click fetches /persona-clip-url and sets the video src; "검토 시작" shows for submitted and POSTs
       review; under_review shows approve/reject/request-more-info and each POSTs { reasonCode, idempotencyKey (+notice/
       summary) } to the right route; a terminal status shows no actions; a 409 is surfaced.
     * member: active membership -> home; null -> redirect to /gate.
 - Source grep (make-or-break): rg "createClient\(|service_role|SUPABASE_SERVICE_ROLE_KEY|\.from\(|\.storage" over the
   new 8b files => 0; git diff --stat apps/web/app/api packages/adapters packages/core supabase => EMPTY (no routes/
   adapters/core/db change).
 - Manual-QA checklist file: reviewer login -> /admin/applications -> open one -> 검토 시작 -> approve/reject/
   request-more-info -> applicant's /apply/status reflects the outcome (applicantNotice shown, reviewSummary NOT);
   play a clip; a plain applicant hitting /admin/applications gets redirected/permission-denied (and the API 403s).
 - Existing gates UNCHANGED (8b touches no DB/route/adapter): pnpm -F web test green (incl. new 8b tests),
   pnpm -r typecheck / build clean, bash scripts/audit.sh PASS, supabase test db 56, web test:integration 5.

ACCEPTANCE (report each verbatim):
 - the gate results;
 - git status --short shows ONLY apps/web/app/member/**, apps/web/app/admin/** (incl. the [id] page), the new test
   files, and (optionally) apps/web/app/_components/site-header.tsx + apps/web/vitest.config.ts if needed;
 - git diff --stat apps/web/app/api packages/adapters packages/core supabase => EMPTY.
STOP and report. Do not self-approve - Opus audit session finals, JT commits.
```

---

## 2. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add Task 8b member/admin UI builder prompt`.
2. Paste §1 into the **Codex** builder. Codex builds the 3 pages + tests + QA checklist, STOPS.
3. **Opus audit session audits/finals** (builder ≠ approver): re-derive from git; the make-or-break greps (no
   service-role / createClient / `.from` / `.storage` in 8b client; `git diff app/api packages/* supabase` EMPTY —
   no new routes/adapters/core/db); authedFetch (bearer) on every call; reviewSummary on reviewer detail only (never
   applicant); client role-guard is UX + 403 handled; decision POST bodies (reasonCode enum + idempotencyKey); clip
   playback fetches the short URL on click; unit tests genuine; audit.sh.
4. On PASS, JT commits: `feat(web): Task 8b member and admin review UI` -> `docs: record Task 8b audit pass`.
   **Task 8 (UI) complete.** Next: **Task 9** (audit/outbox hardening + the Persona-Clip byte-delete worker — which
   MUST scope draft-cleanup to status='draft', per the 7a residual).

   ⚠️ git add note: the detail page path contains brackets — quote it under zsh:
   `git add 'apps/web/app/admin/applications/[id]/page.tsx'` (and the matching test path).

## 3. Out of scope (explicit)
- Any new API route / adapter / service / `supabase/` / `packages/core` change; the 8a auth-provider + applicant
  pages (unchanged). The outbox processor + Persona-Clip byte-delete worker = **Task 9**. Real-camera + full
  reviewer round-trip = manual QA (the seeded reviewer/applicant + the now-working signup flow exercise it).

## 4. Decisions / notes (Cowork)
- **8b is pure client UI** — the lowest-risk slice: no new routes, no adapters, no core, no DB. The security surface
  is entirely "does the browser still avoid service-role and route everything through authedFetch + the audited
  requireReviewer routes." That is the focused audit.
- **No reasonCode on the detail** (frozen `AdmissionApplication` carries none) — show status + applicantNotice +
  reviewSummary. This is consistent with Task 8a finding #2/#3 (reasonCode is internal/audit, not a stored display
  field). The decision FORMS still submit a reasonCode (required by the route); they just can't render a historical one.
- **reviewSummary boundary** — reviewer detail may show it (reviewer-gated, service-role route authorized by the
  reviewer's bearer); applicant pages never do. A non-reviewer browser that loads /admin gets 403 from the route, so
  the client guard is convenience, not the boundary.
- **Determinism:** 8b's gate is deterministic mocked unit tests (no live DB) — no 5×+reset host gate; the live
  regression gates (test db 56, integration 5) are unchanged by construction.
