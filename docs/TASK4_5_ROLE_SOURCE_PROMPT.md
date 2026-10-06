# Task 4.5 — Trusted Role Source (carry-forward ②) — spec + Codex builder prompt (Cowork-authored)

> **Inserted before Task 5** (closes PROJECT_STATE §4 carry-forward ②). The Task-4 auth adapter resolves
> role from the JWT `app_metadata.role` claim, which the seed never populates → every user resolves to
> `applicant`, so the service `canReview` guard can never authorize a real reviewer. This task moves the
> trusted role to a **server-side source** so that "the JWT authenticates *who you are* (`auth.uid()`); the
> DB decides *what you can do* (`profiles.role`)."
>
> **Mechanism decision (JT, this round): (a) security-definer `current_user_role()` RPC** — NOT app_metadata
> injection. Rationale: single source of truth (`profiles.role`, service-role-write-only), role changes take
> effect immediately (no JWT-staleness window — critical for prompt revocation/demotion in a trust app), no
> two-source drift (§6 failure mode).
>
> **Workflow (risk-tiered, `docs/WORKFLOW.md`):** auth/permissions/DB = security layer → **Codex builds**,
> **Opus audit session audits** (separate), **JT commits**. Builder does not self-approve.

---

## 0. Grounded contract (verified from the working tree at HEAD `057e375` — NOT memory)

**Frozen core (DO NOT edit — `packages/core/src`):**
- `AuthSession { userId: string; role: UserRole }` and `AuthPort { signUp, signIn, getSession, getUserId }`
  are CONTRACT-FROZEN (`packages/core/src/ports/auth-port.ts:1-23`). `Actor { id, role }` and
  `UserRole = "applicant"|"member"|"reviewer"|"admin"` are frozen (`domain/shared/types.ts:1-11`).
- Authorization chain: route → `AuthPort` → `AuthSession.role` → `Actor.role` → `cmd.actor.role` →
  `canReview(role) = role==="reviewer"||"admin"` (`domain/admission/admission-policy.ts:16`), enforced as
  INV-11 step 1 in the service (`domain/admission/admission-service.ts:134,168,236,273`).
  **⇒ `AuthSession.role` is the single role source for the whole authz chain. This task only changes WHERE
  the adapter gets that value; the frozen shapes do not change.**

**Current adapter (the thing to change — `packages/adapters/src/supabase/supabase-auth-adapter.ts`):**
- `roleFromAppMetadata(user.app_metadata)` reads `app_metadata.role`, validates vs `UserRole`, defaults
  `applicant`; used by `signUp`/`signIn`/`getSession` (lines 27-35, 54, 72, 87).
- Its test (`supabase-auth-adapter.test.ts:18-21,25`) currently *enforces* "AuthPort must NOT query
  profiles.role" (mock `from: () => throw`) and "ignores user-editable user_metadata role". The first
  invariant is the R2 fix and **is now obsolete** — this task flips it: role comes FROM `profiles.role`
  (via the security-definer RPC, not a raw column select). The "ignore user_metadata" invariant **stays and
  strengthens**: after this task, role comes from neither `user_metadata` NOR `app_metadata`.

**DB / seed (verified):**
- `profiles.role` text check `(applicant|member|reviewer|admin)`, default `applicant`
  (`migrations/0001_phase1_schema.sql:11-12`); service-role-write-only — the committed smoke test proves
  `authenticated` cannot select OR update `profiles.role` (42501).
- `0003_rls.sql` security-definer helper pattern to mirror: `is_active_member` etc. —
  `security definer`, `set search_path=''`, `revoke execute from public, anon`, `grant to authenticated,
  service_role`.
- `seed.sql`: role lives in BOTH `raw_user_meta_data.role` AND `profiles.role`; `app_metadata` is role-less.
- Committed gate `supabase/tests/pre_task5_rpc_rls_smoke.sql` (41 pgTAP) has a "role-source reality check"
  block that documents the *pre-②* state (asserts reviewer role is in `user_metadata`). That block must be
  updated to the post-② reality (see §1.D).

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 4.5 — Trusted role source (security layer / auth+DB). Implement ONLY this; do NOT advance to Task 5.

Goal: make AuthSession.role come from a trusted SERVER-SIDE source (profiles.role) instead of the JWT
app_metadata claim, so the service canReview guard (INV-11) can authorize a real reviewer. Mechanism =
security-definer current_user_role() RPC reading profiles.role for auth.uid(). Read the REAL object names
in packages/core/src/ports/auth-port.ts, packages/adapters/src/supabase/supabase-auth-adapter.ts(+.test.ts),
supabase/migrations/0001+0003, supabase/seed.sql, supabase/tests/pre_task5_rpc_rls_smoke.sql first — do not guess.

A) NEW migration supabase/migrations/0006_role_source.sql:
   create function public.current_user_role() returns text
     language sql stable security definer set search_path = ''
     -> select role from public.profiles where id = auth.uid();   (NULL if no row)
   revoke execute on function public.current_user_role() from public, anon;
   grant  execute on function public.current_user_role() to authenticated, service_role;
   (Mirror the 0003 is_active_member pattern exactly. Zero-arg, OWN role only — never accept a uuid param.
    Do NOT edit committed migrations 0001-0005.)

B) Adapter (packages/adapters/src/supabase/supabase-auth-adapter.ts): resolve AuthSession.role from the
   trusted source, NOT from any JWT claim:
   - signIn / getSession: after a session exists, role = result of this.client.rpc('current_user_role').
     Map the returned text via the existing UserRole guard; FAIL-CLOSED to 'applicant' on null/error/unknown.
   - signUp: a brand-new user is 'applicant' (profiles.role default) — return 'applicant'.
   - Use the adapter's EXISTING (user-scoped) client only. Do NOT introduce a service-role client into
     AuthPort (INV-17). Remove roleFromAppMetadata. Frozen AuthSession/AuthPort/Actor shapes do NOT change.

C) Adapter tests (supabase-auth-adapter.test.ts): update to the new invariant:
   - role reflects the current_user_role() RPC result (mock .rpc to return e.g. 'reviewer' → session.role
     'reviewer'); 
   - forged user_metadata.role AND forged app_metadata.role are BOTH ignored (role still tracks the RPC);
   - rpc null/error -> role 'applicant' (fail-closed).
   The old "must not query profiles.role" mock invariant is replaced (role now comes from the RPC).

D) Seed + committed smoke test (single consistent change):
   - seed.sql: remove `role` from raw_user_meta_data for all seeded users (profiles.role is the ONLY
     canonical role source). Keep profiles.role as-is (admin/reviewer/applicant). Do NOT inject app_metadata.role.
   - supabase/tests/pre_task5_rpc_rls_smoke.sql: (i) update the role-source block so it asserts the POST-②
     reality — app_metadata has no role (unchanged) AND user_metadata has no role (was the opposite) AND
     profiles.role is canonical; (ii) ADD runtime proof of current_user_role() under REAL authenticated
     sessions (set local role authenticated + jwt claims per user): admin…0001->'admin', reviewer…0002->
     'reviewer', applicant…0003->'applicant'; (iii) ADD the anti-escalation proof: with sub=applicant…0003
     AND a forged user_metadata/app_metadata role='reviewer' in the claims, current_user_role() STILL
     returns 'applicant'; (iv) assert anon cannot execute current_user_role() (42501/denied).

FORBIDDEN (violation = redo):
 - editing packages/core/src/** (frozen AuthPort/AuthSession/Actor/UserRole) — if you think you need to, STOP;
 - introducing a service-role client into AuthPort, or trusting ANY JWT claim (user_metadata/app_metadata)
   for role — role MUST come from current_user_role()/profiles.role;
 - editing committed migrations 0001-0005 (add 0006 instead);
 - weakening any grant/policy to pass a test; running the new smoke assertions as postgres/superuser
   (they MUST run as authenticated);
 - implementing Task 5 service/container wiring, or reviewer/admin RLS *read* policies (out of scope —
   those land when the reviewer read-path does; note as follow-on, do NOT build here).

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` -> ALL pgTAP green (existing + new current_user_role + anti-escalation);
 - `pnpm -r typecheck` clean; `pnpm -F @soulbound/adapters test` green; `pnpm -F @soulbound/core test` 19 green (unchanged);
 - `bash scripts/audit.sh` PASS;
 - `git status --short` shows ONLY: supabase/migrations/0006_role_source.sql, supabase/seed.sql,
   packages/adapters/src/supabase/supabase-auth-adapter.ts(+.test.ts), supabase/tests/pre_task5_rpc_rls_smoke.sql;
 - `git diff --stat packages/core/src` empty.
STOP and report. Do not self-approve — the Opus audit session audits (separate), JT commits.
```

---

## 2. Dispatch + commit (JT, host)

1. Commit this prompt doc: `docs: add Task 4.5 trusted-role-source builder prompt`.
2. Paste §1 into the Codex builder. Codex builds, runs the gates, STOPS.
3. Opus audit session (separate) audits: current_user_role() is `security definer`/`search_path=''`/execute-
   revoked-from-anon; adapter trusts the RPC and ignores BOTH claims + fails closed; seed has no role in
   user_metadata/app_metadata; the smoke test PROVES role resolution + anti-escalation at call time under a
   real `authenticated` session; scope clean; core untouched. Re-derive from git, re-run audit.sh, do not
   rubber-stamp the green run (host-only — JT confirms it).
4. On PASS, JT commits: `feat(auth): trusted role source via current_user_role()` (or `feat(db)+fix(adapters)`
   split) → then `docs: record Task 4.5 audit pass` + PROJECT_STATE §4 ② = CLOSED.
5. Then Task 5 (service wiring) — the canReview guard now resolves a real reviewer end-to-end.

## 3. Out of scope (explicit — do NOT build here)
- Reviewer/admin **RLS read policies** (`using (public.current_user_role() in ('reviewer','admin'))`) for the
  review queue / review_summary — these land with the reviewer read-path (Task 6/8). current_user_role() is
  authored here so they can reuse it.
- `handle_new_user` trigger / profiles-row auto-creation on signup — separate concern; current_user_role()
  fails closed to 'applicant' if no profiles row, which is safe for P0.
