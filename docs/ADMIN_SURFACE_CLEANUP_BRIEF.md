# Admin Surface Cleanup — consistency-polish + IA — Design Brief (Claude Code / Cowork)

> **Step 1 of the loop** (Claude design → Codex plan → Claude approve → Codex build → Claude final audit).
> **Pure surface / app-layer (fast-loop). ALL behavior preserved — 0-diff backend.** Builder ≠ approver.
> Scope (JT 2026-06-20): consistency-polish (onto `components/ui` primitives) **+ 3 IA items** (decision-UI consolidation
> + note safety-split, dossier-first detail, queue triage). The admin operator account is set up separately via SQL (host).

## 0. Why
The reviewer surfaces (`/admin/applications` queue + `/admin/applications/[id]` detail) are functionally complete but use the
old `page-heading`/`eyebrow` + `admin.module.css` pattern — they don't use the `components/ui` primitive system the rest of the
app uses, so they read inconsistent. Plus IA friction: the detail shows **3 separate decision forms at once** (overwhelming), the
applicant-visible vs reviewer-internal notes aren't clearly distinguished (leak-risk by mistake), and IDs are raw UUIDs (unscannable).

## 1. Hard boundary (final audit enforces)
- **Surface / app-layer ONLY.** Files: `apps/web/app/admin/applications/page.tsx` + `[id]/page.tsx`, `admin.module.css`,
  reuse/extend `apps/web/components/ui/*` primitives (additive if extended). NO new npm dep.
- **FROZEN — 0-diff:** `apps/web/app/api/**` (admin routes), `packages/core`, `packages/adapters`, `supabase/**`,
  `apps/web/lib/auth-provider.tsx`, PWA, `package.json`/lockfile.
- **🔴 Invariants (must hold):**
  1. **Decision contract unchanged:** the consolidated UI still posts to the SAME per-action endpoints
     (`/approve`, `/reject`, `/request-more-info`, `/review`) with the SAME payload (`reasonCode` enum, optional
     `applicantNotice`, optional `reviewSummary`, `idempotencyKey`). reasonCode option sets per action unchanged. 409 handling kept.
  2. **`reviewSummary` reviewer-only** — internal note, never shown to applicants (the `/apply/status` no-render lock stays).
     In the admin detail it IS shown (admin context, correct); the consolidated form must keep the **applicant-visible vs
     internal distinction explicit** so a reviewer never writes internal content into the applicant field.
  3. **persona ⟂ dossier** — do NOT add persona (handle/display_name) to ANY reviewer view. Reviewer judges the *dossier*
     (statement/motivation/referral/clip); applicants have no persona. Keep the **pseudonymous applicant/reviewer UUID**.
  4. **requireReviewer route-gate, Persona Clip on-click signed URL (reviewer-only), reviewer-only clip access** — unchanged.

## 2. (A) Consistency-polish (baseline)
Bring queue + detail onto `components/ui` primitives + tokens, consistent with the member shell's calm-warm system:
- AppBar (page title/eyebrow), Card/Section (grouped blocks), Field (filter/select/textarea), Button (primary/secondary/danger),
  Badge (status). Keep `admin.module.css` only for admin-specific layout that primitives don't cover (the queue **table**, the
  decision **grid**). Replace ad-hoc `page-heading`/`eyebrow` with the primitive AppBar. Warm/simplicity gates preserved
  (weights ≤600, no uppercase, heading ≤24, serif=prose-only).

## 3. (B) Decision UI consolidation + note safety-split
- **3 separate `DecisionForm`s → ONE decision panel** with an **action selector** (segmented/radio: 승인 / 거절 / 추가 정보) →
  the `reasonCode` options update to that action's set → a single submit posts to that action's endpoint. **Same endpoints,
  same payload** (reasonCode/applicantNotice/reviewSummary/idempotencyKey) — pure UI consolidation.
- **Note safety-split:** render `applicantNotice` and `reviewSummary` as clearly distinct fields with explicit labels —
  e.g. `applicantNotice` = "신청자에게 보여집니다", `reviewSummary` = "내부 전용 · 신청자 비공개" (visual separation, color/placement)
  so internal notes are never mistyped into the applicant-visible field. (Leak-prevention IA.)

## 4. (C) dossier-first detail layout
- Make the **dossier** the focus: `applicantStatement` / `motivation` / `referralCode` / Persona Clip prominent (the material
  the reviewer judges). Demote review-meta (reviewerId / reviewedAt / policyVersion / created / updated) to a secondary block.
  Tidy the clip-playback block (on-click signed URL → video, reviewer-only — unchanged behavior). Decision panel reachable/sticky.

## 5. (D) Queue triage
- Raw UUID → **truncated (e.g. first 8 chars) + copy affordance** (keep full id accessible; pseudonymous — NOT persona).
- Status **chips/badge** per row; a **status quick-filter** (chips for submitted / under_review / needs_more_info, retaining the
  full dropdown or folding into chips) + a per-status **count**. Same `?status=` query param + `limit` — no route change.
- Clip indicator + 상세 link kept.

## 6. Acceptance gates (Claude final audit — fast loop)
- `pnpm -F web typecheck` · `pnpm -F web test` green & **non-weakened** · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **Boundary EMPTY:** `apps/web/app/api`, `packages/core`, `packages/adapters`, `supabase`, `apps/web/lib/auth-provider.tsx`,
  PWA, `package.json`/lockfile. No new dep.
- **🔴 Decision contract preserved (tests):** the admin `[id]` test must assert each action (approve/reject/request-more-info)
  still posts to the correct endpoint with the correct `reasonCode` (+ optional notices) + `idempotencyKey`; `review` start kept;
  409 handling kept. Selectors updated for the consolidated form, **assertions not weakened**.
- **🔴 reviewSummary reviewer-only:** still rendered in admin detail; still NOT rendered on `/apply/status` (existing lock intact);
  the consolidated form labels applicant-visible vs internal distinctly.
- **🔴 persona absent from admin:** grep — no `handle`/`displayName`/profile fetch in admin pages; applicant/reviewer shown as UUID.
- `requireReviewer` 403 state, Persona Clip on-click signed URL (reviewer-only) — behavior unchanged (tests preserved).
- Queue: status filter still drives `?status=`; truncated UUID retains full id (copy/title); counts correct.

## 7. Handoff to Codex (step 2)
Produce the plan: the primitive adoption map (which AppBar/Card/Section/Field/Button/Badge replace which current markup; what
stays in `admin.module.css`); the consolidated decision panel (action selector → reasonCode set → single submit → correct
endpoint per action, same payload) + the note safety-split; the dossier-first detail reorg; the queue triage (UUID truncate+copy,
status chips, quick-filter+count); and the **admin test updates** (selectors only; assert each action→endpoint+reasonCode,
reviewSummary reviewer-only, idempotency, 409, clip on-click — non-weakened). Explicitly confirm: **no route/service/core/
adapter/supabase change, no new dep, no persona in reviewer view, decision payloads identical.** Return for Claude approval before build.
