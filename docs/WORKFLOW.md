# SoulBound — Operating Workflow (canonical)

> This is the **canonical** definition of who builds, who audits, who approves, and who commits for
> SoulBound Phase 1 P0. The HARD RULES in `CLAUDE.md`, `.clinerules`, and `AGENTS.md`, plus the pipeline
> section of `PROJECT_STATE.md`, point here. **If you change roles here, change those four together**
> (drift across charters is a documented failure mode — PROJECT_STATE §6).
>
> Adopted 2026-06-01 after the Task 3 episode (GLM output rejected → Codex reimplemented → Cowork PASS).
> Builder selection is **risk-tiered** (JT-approved).
>
> **AMENDMENT 2026-06-05 (JT-approved): Codex builds ALL tiers; GLM / Claude Code is retired as an active
> builder (not used).** The risk-tier framework below is kept as the rationale for *audit depth* (surface =
> fast loop §4a, security = full loop §4b), but the *builder* for both tiers is now **Codex**. Reason: the §6
> "stability" reassignment fired on **every** surface task through 7b — GLM proved unreliable even at the
> surface (e.g. the Supabase-in-component risk), so Codex-builds-all is the rule, not a recurring exception.
> The load-bearing invariant (§2 — builder ≠ final approver) is preserved by **Codex builds → Opus/Cowork
> finals**. If GLM/Claude Code is ever reactivated as a builder, the §6 exception protocol + the surface rules
> below apply again.
>
> **AMENDMENT 2026-07-02 (JT-approved): Codex owns commit / push / deployment.** The loop is fixed as:
> design (Cowork) → plan (Codex) → plan review & supplement (Cowork) → build (Codex) → review (Cowork) →
> fix findings (Codex) → final review (Cowork) → **commit / push / deploy (Codex)**. Commit/push/deploy is
> a *mechanical execution step* that runs **only after the Cowork FINAL PASS** — it is not approval, so §2
> is preserved (Cowork approves and never commits; Codex commits only what Cowork approved). JT remains
> exception authority and may still run host git when stepping in. Supersedes the former "JT sole commit
> authority" clauses (§1, §4, §7 updated below).

---

## 1. Actors

| Actor | Role | One line |
|---|---|---|
| **Cowork** | Architect / Final Auditor / Judge | Designs contract, invariants, Task prompts, acceptance gates; final semantic approval. Does **not** mass-implement. |
| **Codex** | Builder (**all tiers** since 2026-06-05) *and* first-pass Auditor / precision repair; **ships (commit/push/deploy) since 2026-07-02** | Builds surface + constitutional layers; or audits + surgically patches. Commits/pushes/deploys **only after the Cowork FINAL PASS**. Never builds **and** finally-approves the **same** change. |
| **GLM / Claude Code** | Surface-layer Builder — **retired 2026-06-05** (not used) | Was: UI, boilerplate, repetitive edits, mechanical wiring. If reactivated, §6 exception + §3 surface rules apply. |
| **JT** | Site lead / exception authority | Names tasks, approves exceptions and amendments; may run host commands. Commit/push/deploy moved to **Codex** 2026-07-02 (was: JT sole). |

---

## 2. The load-bearing invariant (do not violate)

> **The final approver of a change is never the actor that built or patched it.**

Everything else (who builds, who audits, who patches) is flexible. This one is not. Concretely:
- A builder never self-approves their own build.
- Codex **may** do first-pass audit **and** the minimal surgical patch of its own findings — but the
  **final** gate on that change is always **Cowork**, or a **separate Codex session that did not build it**.
- Cowork approves; Cowork does not build the thing it will be the sole approver of. If Cowork builds, a
  different model audits.

---

## 3. Risk-tiered builder selection

Choose the builder by the **layer** the task touches, not by a fixed default.

**Security / constitutional layer → Codex is the default builder.** GLM/Claude Code must **not** be the
primary builder here (bounded scaffolding / logs / command execution only).
- DB schema, RLS, RPC, storage policies
- Supabase **adapter boundaries** (service_role vs anon/auth client separation), 3-client boundary
- authorization, state-transition guards, idempotency, audit trail, retention/deletion
- anything touching or adjacent to a frozen contract

**Surface / bulk layer → Codex builds too (GLM / Claude Code retired 2026-06-05).** The tier now governs
*audit depth* — surface uses the fast loop (§4a) and Codex still builds it; Cowork finals.
- UI pages and components, forms, loading/error states
- boilerplate, repetitive file generation, mechanical route/wiring scaffolds
- log collection, running acceptance commands

> Rationale: Task 3 showed GLM's failure in the constitutional layer is **systematic, not bad luck** —
> it produces output that passes mechanical gates (`db reset`, `audit.sh`) but is semantically wrong
> (invented enum values, RLS-row-policy mistaken for column protection, schema/RPC column mismatch,
> corrupted prompt doc). GLM is strong at "syntactically plausible structure," weak at the
> permission / state-transition / audit / idempotency layer. So security-layer Codex is a **rule**, not
> a recurring ad-hoc "exception."

---

## 4. Loops

### 4a. Standard loop — surface-layer tasks (fast path)
```
[0] JT: name the Task
[1] Cowork: design brief — scope, forbidden list, acceptance gates, expected failure points
[2] Codex: implementation plan only (no build yet)
[3] Cowork: plan review & supplement — approve before any build
[4] Codex (Builder session): implement the approved plan (this Task only; stop, do not advance)
[5] Cowork — or a separate Codex session that did NOT build it: review (scope, regressions, typecheck/build/test, invariants)
[6] Codex (Builder session): fix the findings
[7] Cowork: final review (independent — see §5; never the session that built it)
[8] Codex: commit / push / deploy — only after [7] FINAL PASS (amended 2026-07-02; was JT)
```

### 4b. Full loop — security/constitutional-layer tasks
```
[0] JT: name the Task
[1] Cowork: Task prompt + invariants + acceptance gates
[2] Codex: implementation plan; Cowork reviews & supplements it before build
[3] Codex (Builder session): implement the security layer
[4] Codex (separate Auditor session) OR Cowork: first-pass audit
[5] Codex (Patch): surgical patch of findings only — no design change, no scope creep
[6] Cowork: final semantic review (independent — see §5); the builder/patcher does NOT approve here
[7] Codex: repatch only Cowork's blocking findings
[8] Cowork: final approval (PASS/FAIL)
[9] Codex: commit / push / deploy — only after [8] PASS (amended 2026-07-02; was JT)
```

Proportionality: do not run the full loop on low-risk surface work; do not shortcut it on the
security layer.

---

## 5. Cowork must not rubber-stamp (self-binding)

"Tests passed per the report" is **not** approval. Cowork final approval requires:
- re-derive state **from git and the working tree**, not from memory or a handoff narrative;
- re-run every gate Cowork **can** run independently (e.g. `audit.sh`, static column/enum cross-checks,
  scope diffs);
- for **runtime-only** claims that the sandbox cannot reproduce (RLS actually enforced under real roles,
  RPC executes without column/type error), require a **committed, reproducible smoke test**
  (e.g. `supabase/tests/`) rather than accepting a one-time manual claim. A green `supabase db reset`
  is **not** sufficient — plpgsql errors surface only at call time.

---

## 6. Exception protocol (builder reassignment)

Reassigning a task's builder away from the default (since 2026-06-05: **Codex builds all tiers**) — e.g.
**reactivating GLM/Claude Code** for a surface task, or any non-Codex builder — requires, every time:
1. explicit **JT** authorization;
2. a one-line documented reason (audit findings link);
3. builder ≠ final auditor preserved;
4. the exception **does not generalize** to future tasks.

Task 3 was such an exception and is the worked precedent: see `docs/TASK3_REIMPLEMENTATION_DECISION.md`
and `docs/TASK3_AUDIT_FINDINGS.md` (Round 2).

Precedent (the other direction): 7b's GLM→Codex "stability" reassignment **recurred on every surface task**,
so per clause 4 it stopped being an exception — it was **formalized** into the 2026-06-05 amendment (Codex
builds all tiers) rather than re-invoked per task. When an "exception" stops being exceptional, amend the rule.

---

## 7. Commits / push / deploy (Codex, after Cowork FINAL PASS — amended 2026-07-02)

- Builder/audit/patch commits are **separated** for a clean audit trail:
  - implementation: `feat(...): implement Task N ...`
  - audit-finding repair: `fix(...): address Task N audit findings`
  - audit evidence/decision: `docs: record Task N audit pass`
- **Codex (builder session) executes `git add/commit/push` and deployments — only after the Cowork FINAL
  PASS on that exact change.** Committing is mechanical execution of an approved change, not approval;
  §2 stays intact because Cowork approves and never commits, and Codex commits only what Cowork approved.
- Cowork and Codex *auditor* sessions never `git add/commit/push` (AGENTS.md read-only charter; sandbox
  `.git` locks are also a documented failure — PROJECT_STATE §6).
- JT: exception authority; may run host git when stepping in (tags, releases, recovery).
- Repo identity: `soulbounddao-ADMIN`, not a personal identity.

---

## 8. Per-task builder assignment (Phase 1 P0)

| Task | Layer | Default builder | Auditor |
|---|---|---|---|
| 3 — DB schema / RLS / RPC | security | Codex *(done, exception-authorized)* | Cowork |
| 4 — Supabase + noop adapters | security (3-client boundary) | **Codex** | Cowork (+ separate Codex pass) |
| 5 — service wiring / container | security (no business logic in container) | **Codex** | Cowork |
| 6 — API routes | security (route→service, no direct supabase, no key leak) | **Codex** | Cowork |
| 7 — Persona Clip route + recorder | mixed | **Codex** (7a routes/retention + 7b recorder UI) | Cowork *(done)* |
| 8 — UI pages | surface | **Codex** *(amendment 2026-06-05; was GLM)* | Cowork (Codex may first-pass) |
| 9 — audit/outbox hardening | security | **Codex** | Cowork |
| 10 — external ledger PoC (옵션) | security | **Codex** | Cowork |

GLM/Claude Code must **not** be the primary builder for DB/RLS/RPC, authorization, idempotency, audit,
retention, adapter client boundaries, or frozen-contract work — even when "assisting." (As of 2026-06-05
GLM/Claude Code is not an active builder at all — Codex builds every tier; this clause governs any future
reactivation.)
