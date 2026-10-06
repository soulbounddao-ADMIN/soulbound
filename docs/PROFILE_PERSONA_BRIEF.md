# Profile / Pseudonymous Persona (Tier A) — Feature Design Brief (Claude Code / Cowork)

> **Step 1 of the loop** (Claude design → Codex plan → Claude approve → Codex build → Claude FULL audit).
> This is the **first real feature since P0** — it goes through the **full BUILD ORDER (core+tests → adapter → route → UI)**
> and a **full audit** (not the surface fast-loop). Builder ≠ approver.
> Direction locked with JT (2026-06-20): post-admission persona = **self-authored pseudonymous text, NO photos (anti-bias),
> NO AI authorship**. Includes a small surface bundle: bottom-tab **icon-only**.

## 0. Thesis (why)
SoulBound is a human-judged "final club." A member's **Persona** is their *own* words — judged by people, not by a face.
- **No AI authorship** (JT + Cowork agree): AI-written personas make reviewers judge AI prose, homogenize signal, and add
  infra/privacy/cost against the lean/privacy-first ethos. AI is, at most, a future optional *assist* — never the author. Excluded.
- **No photos/avatars (anti-appearance-bias)** — permanent design invariant. Judge the persona, not the looks.
- **CORRECTED FACT (important):** the admission form (`admission_applications`) collects the *review dossier* —
  `applicant_statement` / `motivation` / `referral_code` (+ the Persona Clip). It does **NOT** collect `handle`/`display_name`/`bio`;
  those are `profiles` columns that **no flow currently fills** (the provisioning trigger sets only `role` → persona is empty).
  → Tier A persona is **net-new self-authoring**, NOT "display of collected data."
- **This strengthens the locked anonymity invariant:** `persona (handle/display_name/bio) ⟂ dossier (motivation/statement/
  referral/clip)` are already separated at the table/column level, and persona is never auto-filled from the dossier → there is
  **no structural de-anonymization path**. The brief must keep it that way.

## 1. Scope + boundary
**IN (this pass):**
- **Post-admission** persona **view + edit** inside `/member` (the active-member shell): `handle`, `display_name`, `bio`.
- Bottom-tab **icon-only** (surface; see §5).

**OUT (explicit non-goals → separate decisions):**
- Touching the **admission / `/apply` / onboarding** flow (the frozen constitutional layer). No persona capture there this pass.
  Onboarding-time authoring is a *later* separate decision.
- **Avatar/photo upload** — permanently excluded (anti-bias). `taste tags` — no column, future. **AI** — excluded. **On-chain** — future.

**Boundary precision (honest wording — NOT "literally zero"):**
- **NEW DB contract / migration = 0; frozen files unmodified** (`supabase/migrations/**`, frozen core tests, packages' frozen
  public contracts). `profiles` table + RLS (`select own`, `select active public`, `update own safe columns`) already exist — reuse.
- **App/core layer = net-new ADDITIVE**: a new Profile domain/port + service (+unit tests) in `packages/core`, a new supabase
  adapter method, a new `/api/profile/me` route, and `/member` UI. This is **addition, not a freeze violation** — but it is not
  "zero diff." So: **"DB·frozen 한정 0 + core/app additive."**
- **No new npm dependency.**

## 2. The feature — full BUILD ORDER (a → c → d → e; b not needed)
- **a. core (`packages/core`, additive):** a `Persona` type (the pseudonymous identity ONLY: `handle`, `displayName`, `bio` —
  NOT role/wallet/membership/email), a `ProfilePort`/repository interface (`getMyPersona`, `updateMyPersona`), and a
  `ProfileService` (read-own, update-own **with validation**). **Unit tests (mock port)**: validation rules, own-only, handle-conflict.
  Wire into the existing core container (mirror membership/admission service patterns). **packages/core must stay supabase-free.**
- **b. DB:** none — `profiles` + RLS exist (update-own-safe). No migration/RPC.
- **c. adapter (`packages/adapters/supabase`, additive):** Profile repository impl using the **user-JWT (user-context) client**
  so RLS `update own safe columns` + `select own` enforce security. Map the `handle` unique-violation → a domain conflict error.
- **d. route (`apps/web/app/api/profile/me`, NEW):** `GET` (read own persona) + `PATCH` (update own persona). **user-JWT** client
  (the authed server context), 3-client boundary (INV-17) — **never service-role** for self-edit. PATCH body schema = **`{ handle?,
  displayName?, bio? }` ONLY** (see §3).
- **e. UI (`/member`, additive):** persona **view** (My Persona card → real handle/display_name/bio) + **edit** mode (form via the
  existing `Field`/`Button` primitives). Fetch via `authedFetch("/api/profile/me")`. Non-photo **initials/monogram** mark (§3).

## 3. 🔴 No-photo enforced STRUCTURALLY (not just policy)
`avatar_url` IS inside the RLS `update own safe columns` grant → a write path could store an arbitrary image URL and reintroduce
photos through the back door. So enforce no-photo by **structure**:
- `avatar_url` is **excluded from the PATCH schema, the ProfileService update input, the adapter write set, and the `Persona`
  type** — there is **no code path that writes `avatar_url`** in this feature.
- The client renders a deterministic **initials / monogram / color** mark derived from `display_name` (or a user-selected abstract
  token) — **no URL, no upload, anywhere.** Abstract marks carry no appearance/identity signal (agreed) and aid list scannability.

## 4. Invariants (carry + enforce; final audit verifies)
- **persona ⟂ dossier:** persona is never auto-filled from admission; profile responses contain **no** dossier fields
  (motivation/statement/referral/clip). Consistent with face-clip destruction (INV-PC-09) — no persistent face/appearance asset.
- **🔴 no-leak:** `GET /api/profile/me` (and the `Persona` type) expose **ONLY `{handle, displayName, bio}`** — **never** `role`,
  `wallet_address`, `membership_status`, `email`, or the auth/user id to any surface. Project only the persona fields.
- **own-only write** — enforced by RLS (`update own safe columns`) + user-JWT context + service; one's own row only.
- **handle unique → 409** on conflict (DB constraint → adapter conflict error → route 409, graceful UI).
- **INV-01/17/PC-05:** no `supabase`/`createClient`/service-role in components; self-edit uses user-JWT, not service-role.
- **a11y:** bottom tabs become icon-only but keep an **`aria-label`** per tab (no a11y regression).

## 5. Bottom-tab icon-only (surface, bundled)
- Remove the visible text label from the TabBar buttons; keep the inline-SVG icon. Move each label into **`aria-label`** on the
  button (a11y). CSS adjust (icon centered, no label row). Keep the `orientation` prop (horizontal). Small surface change.

## 6. Acceptance gates (Claude FULL audit)
- `pnpm -F @soulbound/core test` (new ProfileService unit tests green, existing frozen core tests untouched) ·
  `pnpm -F web test` · `pnpm -r typecheck` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **DB/frozen 0:** `supabase/migrations/**` unchanged; frozen core test files unchanged; no migration/RPC added; **no new npm dep**.
- **app/core additive only:** new files = core Profile domain/port/service + tests, supabase adapter method, `/api/profile/me`
  route, /member UI. (api is NOT "empty diff" here — the new route is the intended addition; everything ELSE frozen stays 0.)
- **🔴 structural no-photo:** `avatar_url` appears in **no** PATCH schema / ProfileService input / adapter write / `Persona` type /
  UI (grep). Client mark is initials/monogram only — no `url(`/upload/`<img>` for avatars.
- **🔴 no-leak:** a test asserts `GET /api/profile/me` returns only `{handle, displayName, bio}` (no role/wallet/membership/email/id).
- **handle 409:** test asserts conflict → 409 + graceful UI; **own-only:** RLS/service prevents editing others.
- **3-client:** profile route uses user-JWT, not service-role; no supabase in components (audit.sh).
- **tabs:** icon-only + `aria-label` per tab (a11y), `orientation` prop intact.
- Persona Clip / admission flow / membership untouched; simplicity + warmth gates preserved.

## 7. Handoff to Codex (step 2)
Produce the plan: the additive **core** `Persona` type + `ProfilePort` + `ProfileService` signatures + **validation rules**
(handle format/length/uniqueness, display_name length, bio max) + the **unit tests**; the **supabase adapter** (user-JWT,
unique→conflict mapping); the **`/api/profile/me`** GET/PATCH route + the **PATCH schema (`handle?/displayName?/bio?` only —
no `avatar_url`)**; the **/member** view+edit UI + the initials mark; the **bottom-tab icon-only** change. Explicitly confirm:
**no migration/frozen edit, no new dep, avatar_url unwritable (structural no-photo), profile response = persona-fields-only
(no-leak), user-JWT not service-role, admission/onboarding untouched.** Return for Claude approval before build.
