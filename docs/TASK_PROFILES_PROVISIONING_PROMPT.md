# Task — Profiles provisioning (closes Task 8a finding #1) — spec + Codex builder prompt (Cowork-authored)

> Prerequisite slotted **between Task 8a and 8b**. A net-new browser `signUp` creates an `auth.users` row but no
> `public.profiles` row, so `submitApplication` FK-violates (`admission_applications.applicant_id NOT NULL →
> profiles(id)`). This task adds the standard `auth.users → profiles` trigger and fixes the **seed** and **integration
> fixtures** that the (global) trigger now interacts with.
>
> **Builder = Codex** (security/constitutional layer — DB trigger + seed + fixtures = full loop). Final audit =
> **Opus audit session** (builder ≠ approver). JT commits. Migration = **0007**.
>
> **⚠️ Make-or-break (any violation = redo):**
> 1. **No self-escalation.** The trigger sets role to the literal `'applicant'`. It must NOT read
>    `new.raw_user_meta_data` / `app_metadata` for role — a signup can never assign its own role (preserves the
>    Task 4.5 trusted-role invariant: role is server-controlled, never from client input).
> 2. **Do not break the seed or the integration tests.** The trigger fires on *every* `auth.users` insert — including
>    the 3 seeded users (whose elevated roles must survive) and the integration tests' throwaway users (whose
>    manual profile insert would now collide). Both are handled below; the gate proves nothing regressed.
> 3. **SECURITY DEFINER + `set search_path = ''`** (mirror migration 0006). No EXECUTE grant / no RPC exposure.

---

## 0. Grounded contract (verified from the working tree — re-read each file; do not trust this paraphrase)

- **`supabase/migrations/0001_phase1_schema.sql`** — `public.profiles`: `id uuid pk references auth.users(id) on
  delete cascade`, `role text not null default 'applicant' check (role in ('applicant','member','reviewer','admin'))`,
  `membership_status text not null default 'none' check (...)`, `created_at/updated_at default now()`; `handle text
  unique`; all other columns nullable. ⇒ a minimal `insert (id) values (new.id)` already defaults role→'applicant',
  membership_status→'none'. `admission_applications.applicant_id uuid not null references public.profiles(id)`.
- **`supabase/migrations/0006_role_source.sql`** — the hygiene to mirror: `security definer`, `set search_path = ''`,
  `revoke execute ... from public, anon; grant execute ... to authenticated, service_role`.
- **`supabase/seed.sql`** — order: `insert into auth.users (...) on conflict (id) do nothing;` (lines ~1-70) →
  `insert into auth.identities (...)` → `insert into public.profiles (id, handle, display_name, bio, role,
  membership_status) values (admin…'admin', reviewer…'reviewer', applicant…'applicant') on conflict (id) do
  nothing;` (lines ~115-148). **With the trigger active, the auth.users insert pre-creates `applicant` profiles for
  all 3 ids, so the `do nothing` profiles insert becomes a no-op → admin/reviewer would be stuck as `applicant`.**
  Seeded ids: admin `a0000000-0000-0000-0000-000000000001`, reviewer `…002`, applicant `…003`.
- **`apps/web/app/api/{applicant,admin,persona-clip}-routes.integration.test.ts`** — each creates a throwaway user
  via `serviceRoleClient.auth.admin.createUser(...)` then `.from("profiles").insert({ id, …, role: "applicant" })`.
  With the trigger active, `createUser` already made that profile → the plain `.insert` now hits a duplicate-`id`
  error. (These web integration tests are NOT frozen — only `packages/core` `*.test.ts` are.)
- **Layout:** migrations `0001…0006`; tests dir currently has ONE file `pre_task5_rpc_rls_smoke.sql` (49 pgTAP).
  `supabase test db` runs every `supabase/tests/*.sql`.

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task — Profiles provisioning (closes Task 8a finding #1). Implement ONLY this. Security/DB layer: full loop +
host determinism. Do NOT touch packages/core, application services, API route LOGIC, or the UI. Do NOT build
member/admin pages (that is 8b).

Read first (confirm, don't trust paraphrase): supabase/migrations/0001_phase1_schema.sql (profiles columns/defaults/
role check + admission_applications.applicant_id FK), supabase/migrations/0006_role_source.sql (function hygiene),
supabase/seed.sql (auth.users inserted BEFORE profiles; profiles ends `on conflict (id) do nothing`),
apps/web/app/api/{applicant,admin,persona-clip}-routes.integration.test.ts (admin.createUser then
.from("profiles").insert({ id, ..., role:"applicant" })).

A) supabase/migrations/0007_profiles_provisioning.sql:
   - create function public.handle_new_user() returns trigger language plpgsql SECURITY DEFINER set search_path = ''
     as: insert into public.profiles (id, role) values (new.id, 'applicant') on conflict (id) do nothing; return new;
     HARD: role is the LITERAL 'applicant'. Do NOT read new.raw_user_meta_data / new.raw_app_meta_data for role (a
     signup must never self-assign a role). Let membership_status default to 'none' (do not set it).
   - create trigger on_auth_user_created after insert on auth.users for each row execute function
     public.handle_new_user();
   - Do NOT grant EXECUTE on handle_new_user and do NOT expose it as an RPC (it runs only as the trigger's definer).
   - No explicit COMMIT/ROLLBACK in the migration (audit.sh forbids it).

B) supabase/seed.sql: the trigger now pre-creates an 'applicant' profile for each seeded auth.users row before the
   explicit profiles insert, so `on conflict (id) do nothing` would leave admin/reviewer as 'applicant'. Change ONLY
   that profiles insert's conflict clause to upsert the seeded values:
     on conflict (id) do update set
       handle = excluded.handle, display_name = excluded.display_name, bio = excluded.bio,
       role = excluded.role, membership_status = excluded.membership_status;
   Leave the auth.users and auth.identities inserts unchanged.

C) apps/web/app/api/{applicant,admin,persona-clip}-routes.integration.test.ts: each throwaway profile insert now
   collides with the trigger's row. Change ONLY those three `.from("profiles").insert({ ... })` calls to
   `.from("profiles").upsert({ ...same fields }, { onConflict: "id" })`. Change NOTHING else (assertions, flow,
   bounded-retry, throwaway uniqueness all stay identical).

D) supabase/tests/profiles_provisioning.sql (new pgTAP file; declare the exact plan count):
   - Provisioning: insert a brand-new auth.users row (fresh uuid; model required columns on seed.sql's auth.users
     insert) -> assert exactly one public.profiles row for that id with role = 'applicant' AND
     membership_status = 'none'.
   - Anti-escalation: insert an auth.users row whose raw_user_meta_data has role:'admin' -> assert the provisioned
     profile role is STILL 'applicant' (the trigger ignores client metadata).
   - Seed regression: assert a0000000-...-001 role='admin', ...-002 role='reviewer', ...-003 role='applicant'
     (proves the seed upsert overrode the trigger's default).

FORBIDDEN (violation = redo):
 - reading role/privilege from new.raw_user_meta_data / new.raw_app_meta_data (escalation vector);
 - granting EXECUTE on handle_new_user or exposing it as a callable RPC;
 - a SECURITY DEFINER function without set search_path = '';
 - explicit COMMIT/ROLLBACK in the migration;
 - editing packages/core, services, API route logic, or the UI; building member/admin pages;
 - weakening any frozen/core test; changing integration-test assertions/flow (insert -> upsert ONLY).

GATE (security/DB layer — full loop + HOST DETERMINISM; a single green run is NOT proof — §6 flaky-gate lesson):
 - supabase test db: new file green + existing 49 still green (report Files + Tests counts).
 - pnpm -F web test:integration: all 5 green WITH the trigger active (proves the upsert fixtures + throwaway
   applicant submit still work end-to-end).
 - Seeded-role regression: the seeded reviewer/admin still resolve their roles via current_user_role (NOT 'applicant')
   - the read-only seeded-login integration path demonstrates this.
 - pnpm -r typecheck / pnpm -r build clean; bash scripts/audit.sh PASS (incl. "no COMMIT/ROLLBACK in rpc migrations").
 - HOST DETERMINISM (required): on the host, do a clean `supabase db reset`, then run `supabase test db` and
   `pnpm -F web test:integration` 5x CONSECUTIVELY — all green every time. Report the 5 runs (do not submit a single
   pass as proof).

ACCEPTANCE (report each verbatim):
 - all gate results incl. the 5x determinism runs and the post-reset run;
 - git status --short shows ONLY: supabase/migrations/0007_profiles_provisioning.sql, supabase/seed.sql,
   supabase/tests/profiles_provisioning.sql, apps/web/app/api/applicant-routes.integration.test.ts,
   .../admin-routes.integration.test.ts, .../persona-clip-routes.integration.test.ts;
 - git diff --stat packages/core/src apps/web/app/api/_lib apps/web/lib => EMPTY (no route logic / UI / core change).
STOP and report. Do not self-approve - Opus audit session finals, JT commits.
```

---

## 2. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add profiles-provisioning builder prompt`.
2. Paste §1 into the **Codex** builder. Codex builds A–D, runs the gate incl. the 5x host-determinism, STOPS.
3. **Opus audit session audits/finals** (builder ≠ approver): re-derive from git; verify the trigger hardcodes
   `'applicant'` and ignores metadata (anti-escalation pgTAP green); `security definer` + `search_path=''`, no
   EXECUTE grant; seed upsert makes admin/reviewer survive (regression pgTAP + a seeded-login role check); the 3
   integration fixtures are insert→upsert only (no assertion/flow change); scope (migration+seed+test+3 fixtures
   only; no route-logic/UI/core); audit.sh; **host determinism reproduced (5x + reset)** before PASS.
4. On PASS, JT commits (separated): `feat(db): provision profiles on auth user creation` (migration + seed +
   pgTAP) → `test(web): upsert throwaway profiles for the provisioning trigger` (the 3 integration fixtures) →
   `docs: record profiles-provisioning audit pass`. Then **Task 8b** (member + admin/reviewer pages) — the applicant
   happy-path is now end-to-end.

## 3. Out of scope (explicit)
- Member/admin pages = **Task 8b**. Backfill of pre-existing auth.users without profiles is unnecessary for P0
  (every run starts from `supabase db reset`; the trigger is forward-only). Membership rows (created on approval)
  are untouched. No new API route, no service/UI change.

## 4. Decisions / notes (Cowork)
- **Trigger, not a server route.** The canonical Supabase pattern (`handle_new_user` trigger on `auth.users`) is
  atomic and covers ALL signup paths (browser, admin API, seed) without adding an API route — keeps the frozen
  BuildPlan §4.2 route surface intact and avoids a service-role signup endpoint.
- **Why seed + fixtures must change too.** The trigger is global, so it pre-creates an `applicant` profile for the
  seeded users (whose `do nothing` insert would then never set the real role) and for the tests' throwaway users
  (whose plain `.insert` would then collide). Seed → upsert; fixtures → upsert. This is the §6 lesson in action:
  the seeded-data manual QA masked the gap; the fix is verified against the *real* provisioning path + the seed.
- **Determinism required** because this is a live-DB change touching the flaky-prone integration gate — per the §6
  rule, host determinism (5x + reset) is the bar, not a single green run.
