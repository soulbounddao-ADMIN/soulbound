# Task 8b — Member + admin/reviewer UI — Audit Findings (final auditor record)

> Builder: **Codex** (per WORKFLOW §8 — Codex builds all tiers). Final auditor: **Opus audit session** (separate;
> builder ≠ approver). Verdict: **PASS** (0 blocking findings). Commit by **JT**. Spec:
> `docs/TASK8B_MEMBER_ADMIN_UI_PROMPT.md`. **Completes Task 8 (UI).**

8b = the member home + the reviewer/admin pages (review queue, application detail, approve/reject/request-more-info
decision UI, reviewer Persona-Clip playback). Pure client UI on the 8a auth foundation — **no new API routes, no
adapters/core/DB change**.

## Audit method (re-derived from the working tree — not a rubber stamp)

Re-derived scope + the protected-surface diff from git; **re-ran `audit.sh` and `pnpm -F web test` myself** (PASS;
42/42); the make-or-break greps; read all three pages + the detail test in full. 8b's gate is deterministic mocked
unit tests (no live DB) → no 5×+reset host gate; the live regression gates are unchanged by construction.

## Verified

- **8b is pure client UI (the make-or-break).** `git diff HEAD -- apps/web/app/api packages/adapters packages/core
  supabase` = **EMPTY** — no new routes, no adapter/core/DB change. `createClient` / `service_role` /
  `SUPABASE_SERVICE_ROLE_KEY` / `.from(` / `.storage` = **0** across `apps/web/app/member` + `apps/web/app/admin`.
  Every data call goes through the 8a `authedFetch` (bearer).
- **Authorization is route-delegated, not client-role-gated (the role-race fix, and it is the *more correct*
  pattern).** The builder found a real bug — the AuthProvider's role is transiently `applicant` until
  `current_user_role` resolves, so a role-based redirect bounced real reviewers to `/gate`. The fix: the queue +
  detail pages do **not** read `role` at all; they fetch and treat a **403** as the permission boundary
  (`permissionDenied` → "권한이 없습니다"). A real reviewer gets data (their bearer authorizes the route) even during
  the transient window; a non-reviewer gets 403 and **no data renders**. This is exactly make-or-break #2 (client
  role is UX, the route is the boundary) — cleaner than the prompt's suggested UX-guard. Proven by the test "shows
  the route 403 even when the client role is stale" (role=`applicant`, fetch called once, **no** `/gate` redirect).
- **`reviewSummary` boundary holds.** Shown only on the reviewer detail page (labeled 검토자 내부 메모), which is a
  reviewer-gated route; never on any applicant page (8a status page unchanged). A non-reviewer browser gets 403 →
  the data never arrives. Test asserts the reviewer sees it + the applicantNotice.
- **Persona-Clip playback is correct.** "클립 재생" appears only when `personaClipAssetId` is set; it fetches the
  short-lived signed URL **on click** (not on load, not autoplay) and binds it to `<video controls>`. Test asserts
  video is absent before click and `src` = the signed URL after.
- **Decision UI is correct + enum-safe.** submitted → 검토 시작 (POST `/review` `{idempotencyKey}`); under_review →
  approve/reject/request-more-info, each posting `{ reasonCode (enum select — no free-text reason, INV-22),
  applicantNotice?, reviewSummary?, idempotencyKey: crypto.randomUUID() }` to the matching route; terminal statuses
  are read-only (no action buttons). A **409** (invalid transition / conflict) shows a message and re-fetches the
  authoritative detail. A fresh idempotencyKey is generated per action. Tests assert the route + body for review and
  all three decisions, the terminal read-only case, and the 409 re-fetch.
- **Member page** GETs `/api/membership/me`; `status==='active'` → member home (tier/issuedAt/id), else (null/non-active)
  → `/gate`. 401 → /login.
- **Gates (auditor-rerun):** `audit.sh` PASS; `pnpm -F web test` **42/42** (10 files), deterministic. Builder's
  regression gates (test:integration 5, pgTAP 56, adapters 17, core 19, typecheck, build) are on surfaces 8b does not
  touch (empty protected-surface diff corroborates).
- **Scope:** only `apps/web/app/member/**` + `apps/web/app/admin/applications/**` (3 pages + 2 CSS + 3 tests + manual
  QA). No `vitest.config` change needed (the existing `app/**/*.test.ts` glob covers the new tests). The optional
  site-header nav extension was not done — fine (it was optional). No skip/todo/only.

## Findings
- **0 blocking.** The role-race discovery + fix is a genuine improvement (real bug found; the route-delegation
  choice is more correct than the prompt's UX-guard suggestion). Noted as a positive.

## Out of scope (unchanged)
- The outbox processor + the Persona-Clip byte-delete worker = **Task 9** (the worker MUST scope draft-cleanup to
  `status='draft'`, per the 7a residual). No new routes/adapters/core were needed for 8b.

## Runtime confirmation
Auditor re-ran (sandbox): `audit.sh` PASS, `pnpm -F web test` 42/42, scope + protected-surface + forbidden-pattern
greps + the three pages + detail test verified. Builder/host green: web unit 42, web integration 5, pgTAP 56,
adapters 17, core 19, typecheck, build, audit.sh, desktop + 390px mobile reviewer-session smoke.
