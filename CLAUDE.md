# SoulBound — Claude Code 작업 지침

> 이 파일은 `.clinerules`의 **Claude Code 미러**입니다. 빌더 = Claude Code + GLM 5.1.
> **(2026-06-05 개정: 빌더는 Codex 전 레이어로 일원화 — Claude Code+GLM은 빌더 은퇴. HARD RULE 11 참조.)**
> Cline은 `.clinerules`를, Claude Code는 이 `CLAUDE.md`를 자동으로 읽습니다.
> 두 파일의 **HARD RULES는 항상 동일하게** 유지하세요(드리프트 방지). 규칙을 바꾸면 양쪽 다 바꿉니다.

You are building **SoulBound Phase 1 MVP**. Centralized infra, migration-ready.

- Frozen design contract: `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`
- Contract handoff (0A+0B+0C): `docs/CONTRACT_FREEZE_HANDOFF.md`
- Toolchain handoff (0C): `docs/TOOLCHAIN_FREEZE_HANDOFF.md`
- v1.3 delta: `docs/V1.3_CHANGESET.md`

---

## TASK DISCIPLINE
- Implement **ONLY** the explicitly requested task. Do NOT proceed to later tasks.
- One task at a time. Do not overbuild.
- The copy-paste **Task 1 / Task 2 prompts** live in `docs/CONTRACT_FREEZE_HANDOFF.md` §5 / §6. Follow them verbatim.

## COMMANDS (acceptance gates)
```bash
pnpm install
pnpm -r typecheck
pnpm -F @soulbound/core build
pnpm -F @soulbound/core test      # Task 1 후엔 19 RED(NOT_IMPLEMENTED)가 정상. green은 Task 2.
bash scripts/audit.sh
```
- **Task 1 통과 기준:** `install` / `typecheck` / `core build` / `audit.sh` 통과 (테스트 RED 허용).
- **Task 2 통과 기준:** 위 + `test` 19 green, 0 skipped.
- 테스트를 수정해서 통과시키지 말 것. 테스트가 곧 경계의 집행자다.

## TOOLCHAIN IS PROVIDED (0C) — do not invent it
이미 존재하고 검증된 파일입니다. 재생성·완화·재구성 금지:
```
package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, .npmrc, scripts/audit.sh,
packages/core/package.json, packages/core/tsconfig.json, packages/core/tsconfig.build.json,
packages/core/vitest.config.ts
```
- tsconfig strictness / package scope / scripts / pnpm 설정을 바꾸지 말 것.
- pnpm 11: 설정은 `pnpm-workspace.yaml`에 있다(`.npmrc` 아님). 옮기지 말 것.
- `packageManager` = `pnpm@11.1.3` 고정, Node 24 고정. bump 금지.
- 누락된 wiring 보정만 허용(워크스페이스가 못 잡는 경로 연결). 그 외 0C 파일 shape 변경 금지.

## FROZEN — do not touch (unless user explicitly says "unfreeze contract")
- `packages/core/src`에서 "CONTRACT-FROZEN" 표시된 모든 것: signatures, types, enums, test assertions.
- 어떤 `*.test.ts`도 편집 금지. frozen test를 `.skip` / `.todo` 금지.

---

## HARD RULES (위반 시 그 파일을 다시 작성)
1. React components must NOT call Supabase directly. Flow: component -> hook -> API route -> service -> repository -> adapter.
2. packages/core must NOT import @supabase or any concrete-chain SDK. Pure TypeScript only.
3. Business logic lives in application services, not in routes or components.
4. Every admission status change emits admission_events; every admin action writes audit_logs and requires reasonCode (enum only).
5. In P0 main branch, no real external side effect runs. LedgerPort = NoopLedgerAdapter only.
6. Chain-neutral: do NOT import any concrete-chain SDK (@mysten, aleo, aztec, zcash) on main.
7. direct_messages table is ciphertext-only. Never add plaintext/body_plain columns.
8. Persona Clip: in-app recording only; no upload/preview/retake/edit; absence must never block submit;
   storage access goes through StoragePort, never supabase.storage directly;
   raw media deleted on terminal admission state.
9. Do not implement ICP, Filecoin, IPFS, Arweave. Do not create chat/messages/inbox routes.
10. Do not overbuild.
11. Role/builder boundary — canonical: `docs/WORKFLOW.md`. **As of 2026-06-05 (JT-approved amendment): Codex
    builds ALL tiers; GLM/Claude Code is retired as an active builder (not used).** Layer risk now governs only
    *audit depth* (surface = fast loop, security = full loop), NOT who builds. INVARIANT (unchanged): the final
    approver of a change is never the actor that built or patched it; the builder never self-approves (final
    gate = Cowork/Opus, or a Codex session that did not build it). Preserved by Codex-builds → Opus/Cowork-finals.
    If GLM/Claude Code is reactivated, the §6 exception + the surface/security split apply again.
    **As of 2026-07-02 (JT-approved): the loop is design(Cowork) → plan(Codex) → plan review/supplement(Cowork)
    → build(Codex) → review(Cowork) → fix(Codex) → final review(Cowork) → commit/push/deploy(Codex, only
    after the Cowork FINAL PASS; Cowork never commits).**

---

## BUILD ORDER (TEST-DRIVEN — 테스트가 어댑터·UI보다 먼저다)
```
a. packages/core 타입/포트/서비스/errors/result + 서비스 단위테스트(mock)  ← 테스트 통과 = a 완료
b. supabase/migrations + RLS + seed + rpc (approve / reject / request_more_info)
c. packages/adapters/supabase + noop  (a의 통과된 service에 어댑터를 맞춤)
d. apps/web API routes  (service 호출만, 3-client 경계 준수)
e. apps/web UI pages
f. packages/adapters/external  — 메인 아님. 별도 브랜치, M6 이후 (옵션)
```

## TASK SEQUENCE (한 번에 하나씩)
```
Task 1   monorepo 골격 + packages/core skeleton (컴파일만, 테스트 RED 유지)
Task 2   core 서비스 단위테스트 19개 GREEN
Task 3   Supabase schema + RLS + rpc only  (DB만, persona_clip_assets + private bucket 포함)
Task 4   packages/adapters/supabase + noop only
Task 5   admission service + membership service 실제 배선 only
Task 6   API routes only (service 호출 + 3-client 경계)
Task 7   Admission Persona Clip route + recorder component only
Task 8   UI pages only (signup/login/gate/apply/status/member/admin)
Task 9   audit/outbox hardening (원문금지·idempotency·실패내성·clip 보존정책)
Task 10  (옵션, 별도 브랜치) External Ledger PoC — 체인 선택은 다음 라운드
```

## IDEMPOTENCY
- submit / approve / reject / membership create / ledger issue 에 idempotency key.

---

## GLM 5.1 알려진 약점 — 능동적으로 방어할 것
1. 컴포넌트에 Supabase 직접 박기
2. "편의상" service 우회
3. UI부터 뽑고 서비스 경계 무너뜨리기

→ 충돌 시 **HARD RULES 1·2·3 과 BUILD ORDER(a부터)** 가 항상 이긴다. 애매하면 멈추고 경계를 따른다.

## 역할 경계 (파이프라인) — 정본: `docs/WORKFLOW.md`
- 운영 루프 정본 = `docs/WORKFLOW.md`(2026-06-01 채택, **2026-06-05 개정**, JT 승인). **개정: Codex가 전 레이어
  (표면 UI + 보안)를 빌드, GLM/Claude Code는 빌더에서 은퇴(미사용).** 이 에이전트(Claude Code + GLM 5.1)는
  더 이상 활성 빌더가 아니다. 레이어 위험도는 이제 *감사 깊이*만 좌우(표면=fast loop, 보안=full loop).
  (재활성화 시 §6 예외 + 보안층 주빌더 금지 규칙이 다시 적용된다.)
- 빌더는 **감사하지 않는다.** 감사는 Codex(1차) + Cowork(최종). 빌더와 감사자는 다른 행위자.
- **불변식:** 어떤 변경의 최종 승인자는 그걸 짠/보수한 주체가 절대 아니다. 자기가 짠 걸 자기가 최종 승인 금지.
