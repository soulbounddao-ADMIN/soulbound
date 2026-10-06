# Task 3 빌더 프롬프트 — Supabase schema + RLS + rpc (DB only)

> 빌더(Claude Code + GLM 5.1)에게 던지는 Task 3 실행 프롬프트입니다.
> 아래 **"COPY-PASTE PROMPT"** 블록을 그대로 복사해 빌더에 붙여넣으세요.
> Appendix A~D는 빌더와 감사자(Codex/Cowork)가 같이 참조하는 정밀 스펙입니다.
> 이 문서는 설계 계약이 아니라 **실행 지시문**입니다. 동결 계약은 여전히
> `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md` §5 가 진실의 원천입니다.
>
> **2026-06-01 (architect):** §1 COPY-PASTE 프롬프트에 ADD-1(rpc 상태 가드를 `admission-policy.ts`에서
> 1:1 이식) + ADD-2(`supabase db reset` 로컬 Docker 전용, 클라우드 연결/push 금지) 보강 반영.

---

## 0. 시작 전 — JT가 확인할 것 (prerequisites)

Task 3는 처음으로 **로컬에서 마이그레이션을 실제로 적용**해 봐야 검증됩니다. 그래서 도구 2개가 필요합니다.

```bash
# Supabase CLI 있는지
supabase --version          # 없으면: brew install supabase/tap/supabase

# Docker 떠 있는지 (supabase db reset 이 로컬 Postgres 컨테이너를 띄움)
docker --version            # 없으면 Docker Desktop 설치 후 실행
```

- **Docker Desktop이 실행 중**이어야 `supabase start` / `supabase db reset` 가 동작합니다.
- supabase 폴더가 아직 없으면 빌더가 `supabase init` 으로 `supabase/config.toml` 을 만들고 시작합니다(아래 프롬프트에 포함).
- 둘 다 없으면 스키마/RLS/rpc SQL 작성까지는 가능하지만 **"적용 게이트"를 못 돌리므로**, 설치 후 진행을 권장합니다.

---

## 1. COPY-PASTE PROMPT (빌더에 그대로 붙여넣기)

```text
Use docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md (§5) as the frozen design
contract, and docs/TASK3_BUILDER_PROMPT.md (Appendix A–D) for exact columns / rpc / RLS specs.

Implement Task 3 ONLY — the database layer. This task writes SQL only. No TypeScript, no wiring.

=== SCOPE (Task 3 = DB only) ===
Create, under supabase/ :
  - supabase/config.toml            (run `supabase init` if supabase/ does not exist yet)
  - supabase/migrations/0001_phase1_schema.sql      (§5.1 required tables + enums + indexes)
  - supabase/migrations/0002_schema_only_tables.sql (§5.2 security-critical tables + persona-clip
                                                      columns on admission_applications)
  - supabase/migrations/0003_rls.sql                (Row-Level Security per §5.3.2)
  - supabase/migrations/0004_rpc.sql                (the 5 *_tx functions, INV-23)
  - supabase/migrations/0005_storage.sql            (private 'persona-clips' bucket + storage RLS)
  - supabase/seed.sql                               (local-only minimal seed: admin/reviewer/applicant)
(You MAY split/merge migration files differently, but keep ordering deterministic and RLS + rpc present.)

=== HARD GUARDRAILS (violation = redo) ===
- DO NOT modify anything under packages/core/src (FROZEN contracts + 19 green tests).
- DO NOT modify any 0C toolchain file (package.json, pnpm-workspace.yaml, tsconfig*, .npmrc, .nvmrc,
  scripts/audit.sh, packages/core/*config*).
- DO NOT create adapters (Task 4), service wiring (Task 5), API routes (Task 6), or UI (Task 8).
- DO NOT write any TypeScript in this task. SQL + config only.
- DO NOT add a plaintext/body column to direct_messages, ever (INV-04). ciphertext-only.
- DO NOT name any column: plaintext, body_plain, content_plain, decryption_key, raw_key, plain_key,
  conversation_key_plain, conversation_key_raw (INV-19). (conversation_key_envelopes + wrapped_key are OK.)
- DO NOT write the literal tokens "commit" or "rollback" ANYWHERE in supabase/ — not in SQL, not in
  comments, not in identifiers (INV-23 audit greps \b(commit|rollback)\b). A Postgres function call is
  already one transaction; to undo, `raise exception` — the whole call is rolled back automatically.
  Describe that as "atomic / raises exception / the whole call is undone", never the c-word/r-word.
- DO NOT reference any concrete chain (sui, @mysten, aleo, aztec, zcash). Migration fields are
  chain-neutral: ledger_ticket_ref / ledger_credential_ref / ledger_tx_ref (F5, present but unused).
- DO NOT put NEXT_PUBLIC_ on any service-role value (INV-17).

=== TABLES ===
§5.1 REQUIRED (full spec in Appendix A — match the snake_case columns exactly so the Task 4 adapter maps cleanly):
  profiles, admission_applications, admission_events, memberships, audit_logs, outbox_events
§5.2 SECURITY-CRITICAL (create now, body stays empty in P0):
  direct_conversations, direct_messages (ciphertext-only),
  conversation_key_envelopes (use §5.2.1 SQL verbatim),
  persona_clip_assets (use §5.2.2 SQL verbatim, incl. deletion_reason check + the admission_applications ALTER)
§5.2 PURE STUBS (optional this task; if created, minimal placeholder columns only — NO plaintext, NO keys):
  soul_balances, soul_ledger_events, evidence_files, reports, slash_cases, decision_receipts,
  emergency_actions, user_intent_authorizations
  → If you skip them, say so in your report. Do NOT flesh out their logic.

=== RLS (§5.3.2 — Appendix C) ===
- Enable RLS on every table.
- audit_logs / outbox_events: NO client policies at all (anon + authenticated denied select/insert/update/delete).
  Only service_role (which bypasses RLS) touches them (INV-10).
- admission_applications: applicant reads own; applicant updates ONLY applicant_statement/motivation/referral_code
  on own DRAFT; status/reviewer_id/reviewed_at/review_summary are NOT client-updatable; review_summary is NOT
  client-readable (admin-internal); other applicants' rows are not readable (INV-12).
- profiles: own read + limited self-update (handle/display_name/bio/avatar_url); membership_status + role are
  NOT client-updatable (service_role only).
- persona_clip_assets: applicant CRUD own; reviewer/admin read the application's clip via server route;
  member/public/anon = 0 access (INV-PC-08).
- direct_messages / conversation_key_envelopes: participants may fetch ciphertext envelopes only;
  no route touches these in P0.

=== rpc FUNCTIONS (§5.3.3 — Appendix B) — the heart of Task 3 ===
Create exactly these 5, each = ONE atomic transaction, each maps to a frozen AdmissionRepository.*Tx method:
  submit_application_tx, start_review_tx, approve_application_tx, reject_application_tx, request_more_info_tx
Every function MUST:
  - language plpgsql, security definer, set search_path = ''  (empty), schema-qualified names (public.x, auth.x)
  - REVOKE EXECUTE ... FROM anon, authenticated, public;   (service_role calls it)
  - enforce the same status guards as packages/core/src/domain/admission/admission-policy.ts
    (submitted→under_review; decide only from under_review|needs_more_info; more_info only from under_review)
    by `raise exception` on violation (→ whole call undone, no partial writes)
  - write admission_events + audit_logs INSIDE the function (INV-05/06/18), reason_code ENUM ONLY (INV-22)
  - be idempotent on idempotency_key (admission_events.idempotency_key UNIQUE; a duplicate key returns the
    current state WITHOUT a second set of side effects) (INV-08)
approve_application_tx additionally (one transaction): set status='approved' + reviewer_id + reviewed_at +
  review_summary + applicant_notice; INSERT membership (status='active', tier='basic', source_application_id);
  UPDATE profiles.membership_status='active'; write events+audit (application.approved AND membership.issued);
  and if the application has a persona_clip_asset_id, mark that clip delete_after=now(),
  deletion_reason='application_approved' (terminal-state retention, INV-PC-09). Return application + membership.
reject_application_tx: status='rejected' + events+audit + clip delete_after=now(),
  deletion_reason='application_rejected'. Return application.
request_more_info_tx: status='needs_more_info' + events+audit. (NOT terminal → do NOT delete clip.) Return application.
NOTE: actual Storage object deletion is a worker (Task 9). Here you only set delete_after + deletion_reason.

=== STORAGE (Appendix D) ===
Create a PRIVATE bucket 'persona-clips' (public=false). storage.objects RLS: applicant may insert/select/delete
own clip; reviewer/admin read via signed URL minted server-side (service_role); no anon/public/member access.

=== REINFORCEMENTS (ADD-1, ADD-2 — architect; do NOT skip) ===
ADD-1 (rpc guards from the frozen source, NOT from memory):
  Do NOT hand-write the status guards from recollection. OPEN
  packages/core/src/domain/admission/admission-policy.ts and read the actual transition predicates,
  then translate each 1:1 into the SQL `raise exception` guards in 0004_rpc.sql:
    - canStartReviewFrom(status)      => start_review_tx allowed ONLY from 'submitted'
    - canDecideFrom(status)           => approve_application_tx / reject_application_tx allowed ONLY
                                         from 'under_review' OR 'needs_more_info'
    - canRequestMoreInfoFrom(status)  => request_more_info_tx allowed ONLY from 'under_review'
    - submit_application_tx           => 'draft' -> 'submitted' (per the lifecycle header in that file)
  The values above are an architect cross-check; you STILL must open the file and verify 1:1.
  If your SQL guard and admission-policy.ts ever disagree, the FROZEN policy wins — STOP and report,
  do not "fix" the frozen side.

ADD-2 (local Docker only — never the cloud):
  `supabase db reset` initializes the LOCAL Docker Postgres ONLY. In this task do NOT run
  `supabase link`, do NOT `supabase db push`, and do NOT connect to / migrate any remote or cloud
  Supabase project. The apply gate is local-only.

=== ACCEPTANCE (all must pass; report each verbatim) ===
  supabase db reset                         # applies ALL migrations + seed cleanly (Docker required)
  pnpm -r typecheck                          # CLEAN (unchanged — no TS added)
  pnpm -F @soulbound/core test               # still 19 GREEN, 0 skipped (must NOT regress)
  pnpm -F @soulbound/core build              # unchanged
  bash scripts/audit.sh                      # AUDIT PASSED (supabase/migrations checks now ACTIVE)
Then report:
  - git diff --stat packages/core/src        # MUST be empty (frozen untouched)
  - confirm each rpc has `security definer` + `set search_path = ''` + the REVOKE line
  - confirm RLS is enabled on every table; audit_logs/outbox_events have no client policy
  - state which §5.2 pure-stub tables you created vs skipped

=== WATCH-ITEMS (surface to the user — do NOT silently work around) ===
- If Supabase CLI or Docker is missing, REPORT it and stop at the apply gate (do not fake it).
- If a frozen contract column and the BuildPlan disagree, STOP and report — do not "fix" the frozen side.
Do NOT self-approve. When the gates pass, STOP and hand the result (and the migration diff) back.
Audit is Codex (first pass) + Cowork (final).
```

---

## Appendix A — §5.1 exact columns (snake_case; parity with frozen domain types)

> The Task 4 adapter maps these columns ↔ the frozen camelCase domain types. Names must line up.
> Types referenced: `packages/core/src/domain/{admission,membership,audit,outbox,shared}/types.ts`.

**profiles**
```
id uuid pk (= auth.users.id)
handle text unique
display_name text
bio text
avatar_url text
membership_status text not null default 'none'  check in ('none','active','suspended','revoked')
role text not null default 'applicant'           check in ('applicant','member','reviewer','admin')  -- UserRole
wallet_address text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
-- ⚠️ membership_status + role: service_role only (client update denied)
```

**admission_applications**  (AdmissionApplication)
```
id uuid pk default gen_random_uuid()
applicant_id uuid not null references profiles(id) on delete cascade
status text not null default 'draft'
  check in ('draft','submitted','under_review','needs_more_info','approved','rejected','withdrawn','expired')
applicant_statement text
motivation text
referral_code text
reviewer_id uuid references profiles(id)
reviewed_at timestamptz
review_summary text        -- admin-internal; RLS: client-read DENIED, never copied to audit (INV-16)
applicant_notice text      -- applicant-facing
policy_version text not null
policy_snapshot_hash text
persona_clip_asset_id uuid  -- added via the §5.2.2 ALTER (references persona_clip_assets(id))
persona_clip_hash text
ledger_ticket_ref text     -- F5, present/unused, chain-neutral
ledger_tx_ref text         -- F5
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

**admission_events**  (state-change log; reason is ENUM only)
```
id uuid pk default gen_random_uuid()
application_id uuid not null references admission_applications(id) on delete cascade
actor_id uuid references profiles(id)
from_status text
to_status text not null
reason_code text not null   -- AdmissionReasonCode enum ONLY (INV-22) — no free text
idempotency_key text not null unique     -- INV-08
created_at timestamptz not null default now()
```

**memberships**  (Membership)
```
id uuid pk default gen_random_uuid()
user_id uuid not null references profiles(id) on delete cascade
status text not null default 'active'  check in ('active','suspended','revoked')
tier text not null default 'basic'     check in ('basic','trusted','founding','admin')
source_application_id uuid references admission_applications(id)
ledger_credential_ref text  -- F5, chain-neutral
ledger_tx_ref text          -- F5
issued_at timestamptz not null default now()
expires_at timestamptz
revoked_at timestamptz
-- recommend: partial unique index — at most one active membership per user
--   create unique index on memberships(user_id) where status = 'active';
```

**audit_logs**  (global append-only hash chain; codes/ids only)
```
id uuid pk default gen_random_uuid()
actor_id uuid references profiles(id)
action text not null
  check in ('application.submit','application.review_started','application.more_info_requested',
            'application.approved','application.rejected','membership.issued','role.changed')
entity_type text not null
entity_id uuid
reason_code text not null   -- enum/code only (INV-16/22)
metadata jsonb not null default '{}'::jsonb   -- redacted codes/ids/refs only — NO raw payloads (INV-16)
hash text             -- null in P0, populated P1 (§5.4)
previous_hash text    -- null in P0, populated P1
created_at timestamptz not null default now()
-- index on entity_id; ensure (created_at, id) ordering for the global chain
```

**outbox_events**  (EnqueueOutboxInput / OutboxEvent; P0 main processes target='internal' only)
```
id uuid pk default gen_random_uuid()
aggregate_type text not null
aggregate_id uuid not null
event_type text not null
payload jsonb not null default '{}'::jsonb   -- codes/ids/refs only — NO plaintext/keys (INV-16)
target text not null default 'internal'
  check in ('internal','external_ledger','icp','filecoin','arweave')
status text not null default 'pending'
  check in ('pending','processing','succeeded','failed','dead_letter')
idempotency_key text not null unique
attempt_count integer not null default 0
last_error text
processed_at timestamptz
created_at timestamptz not null default now()
```

---

## Appendix B — rpc function spec (the 5 *_tx)

Each function is ONE atomic transaction and mirrors a frozen `AdmissionRepository.*Tx` signature.
Boilerplate every function must include:

```sql
create or replace function public.<name>_tx(/* args */)
returns /* row or composite */
language plpgsql
security definer
set search_path = ''                          -- empty search_path (INV-23)
as $$
begin
  -- schema-qualified everywhere: public.admission_applications, auth.users, ...
  -- guard with: if <bad> then raise exception '...' using errcode = '...'; end if;
  --   (a raised exception undoes the whole call — do NOT write the c-word/r-word)
  -- idempotency: if this idempotency_key already exists in public.admission_events,
  --   return the current state without a second set of writes.
end;
$$;

revoke execute on function public.<name>_tx(/* arg types */) from anon, authenticated, public;
-- service_role calls it from the server.
```

| function | guard (from policy) | writes (all in one tx) | returns |
|---|---|---|---|
| `submit_application_tx` | draft/new → submitted | application upsert→submitted; admission_events(submit); audit_logs(application.submit) | application |
| `start_review_tx` | submitted → under_review | application→under_review, set reviewer_id; events(review_started); audit(application.review_started) | application |
| `approve_application_tx` | under_review\|needs_more_info → approved | application→approved (+reviewer_id, reviewed_at, review_summary, applicant_notice); memberships insert(active/basic/source_application_id); profiles.membership_status='active'; events(approved); audit(application.approved + membership.issued); **mark clip delete_after=now(), deletion_reason='application_approved'** | application + membership |
| `reject_application_tx` | under_review\|needs_more_info → rejected | application→rejected; events(rejected); audit(application.rejected); **mark clip delete_after=now(), deletion_reason='application_rejected'** | application |
| `request_more_info_tx` | under_review → needs_more_info | application→needs_more_info; events(more_info_requested); audit(application.more_info_requested) | application |

Guards must match `admission-policy.ts` exactly: `canStartReviewFrom` = submitted; `canDecideFrom` =
under_review|needs_more_info; `canRequestMoreInfoFrom` = under_review. Role authorization (reviewer/admin)
is enforced by the service layer (Task 5) + the fact that only service_role may execute these; the rpc may
additionally accept actor_id for the event/audit rows.

Persona-clip retention here = **mark only** (`delete_after`, `deletion_reason`). The actual Storage object
removal + `status='deleted'` + `deleted_at` is the worker in Task 9 (INV-PC-09).

---

## Appendix C — RLS matrix (§5.3.2)

| table | anon | authenticated (own) | authenticated (others) | service_role |
|---|---|---|---|---|
| profiles | ✗ | read own; update handle/display_name/bio/avatar_url only | read public persona fields of active members | full (membership_status, role) |
| admission_applications | ✗ | read own; update applicant_statement/motivation/referral_code on own **draft** only | ✗ (INV-12) | full (status/reviewer_id/review_summary, queue) |
| admission_events | ✗ | ✗ | ✗ | full |
| memberships | ✗ | read own; read public badge | public badge only | full (insert/update) |
| audit_logs | ✗ | ✗ | ✗ | full (INV-10) |
| outbox_events | ✗ | ✗ | ✗ | full (INV-10) |
| persona_clip_assets | ✗ | applicant CRUD own | ✗ (member/public 0, INV-PC-08) | reviewer/admin read via server route |
| direct_conversations | ✗ | participant read | ✗ | full |
| direct_messages | ✗ | participant fetch ciphertext | ✗ | full (no plaintext anywhere) |
| conversation_key_envelopes | ✗ | participant fetch own envelope | ✗ | full (wrapped_key only) |

`review_summary` is admin-internal: not client-readable even to the applicant; only `applicant_notice` is
applicant-facing (§7.4). audit_logs/outbox_events have **no policy block at all** so RLS denies every client.

---

## Appendix D — storage, seed, audit traps, acceptance recap

**Storage (persona-clips):**
- `insert into storage.buckets (id, name, public) values ('persona-clips','persona-clips', false);`
- storage.objects RLS: applicant insert/select/delete own object path; reviewer/admin read is server-side
  (service_role mints a short-lived signed URL on the review detail route — Task 7); no anon/public/member.

**Seed (local only — supabase/seed.sql):**
- minimal rows so RLS + rpc can be exercised locally: one `admin`, one `reviewer`, one `applicant` profile
  (+ matching `auth.users` rows for local), and the active `policy_version` = `phase1-v0.95` (POLICY_VERSION).
- seed is for local `supabase db reset` only; never a production data path.

**Audit traps (these fail `bash scripts/audit.sh`):**
- the tokens `commit` / `rollback` anywhere in `supabase/migrations` → FAIL. Use "atomic / raise exception".
- column names in the forbidden plaintext/key list → FAIL.
- any concrete-chain token (`@mysten|aleo|aztec|zcash`) in `packages`/`apps` → FAIL (docs are exempt).

**Acceptance recap (Task 3 done when ALL hold):**
1. `supabase db reset` applies 0001→0005 + seed with no error.
2. `pnpm -r typecheck` CLEAN; `pnpm -F @soulbound/core test` 19 GREEN (no regression); build unchanged.
3. `bash scripts/audit.sh` → AUDIT PASSED with the now-active supabase/migrations checks.
4. each rpc has `security definer` + `set search_path = ''` + `revoke execute ... from anon, authenticated, public`.
5. RLS enabled on every table; audit_logs/outbox_events expose nothing to clients.
6. `git diff --stat packages/core/src` empty; 0C files untouched.

**Then:** Codex first-pass audit (read-only, `AGENTS.md`) → Cowork final audit (semantic: INV-11 role gate,
INV-12 cross-tenant read, INV-13 failure-tolerance, INV-16 no raw payload in audit/outbox, INV-18 atomicity,
INV-PC-09 retention) → pass → Task 4 (adapters).
