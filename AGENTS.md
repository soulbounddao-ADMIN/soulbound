# SoulBound — Codex 감사관 지침 (AGENTS.md)

> ⚠️ 이 파일은 **감사관(Codex) 전용**입니다.
> `CLAUDE.md` 와 `.clinerules` 는 **빌더(Claude Code + GLM)** 의 지침입니다. 그건 당신 것이 아닙니다.
> 당신은 빌더가 아니라 **1차 감사관(first-pass auditor)** 입니다. 빌더의 규칙을 당신의 행동 지침으로 착각하지 마세요.
> 당신의 임무는 빌더가 만든 결과를 **검사하고 보고**하는 것이지, 만들거나 고치는 것이 아닙니다.

## 절대 제약 (ABSOLUTE — 위반 시 역할 붕괴)

- **READ-ONLY.** 어떤 파일도 편집·생성·삭제·이동·포맷하지 않는다. fix 금지, "겸사겸사 정리" 금지, 제안을 디스크에 적용 금지.
- repo를 바꾸는 명령 금지: `git add/commit/checkout/stash/restore`, lockfile 바꾸는 install, `--write` 류 포매터/린터.
- 허용 명령은 **읽기/검사뿐**: `cat`, `grep`/`rg`, `ls`, `git diff`, `git status`, `git log`, 그리고 아래 acceptance 명령(읽기 또는 gitignored dist/ 빌드만).
- 문제를 찾으면 **보고**한다. **고치지 않는다.** 고치는 건 빌더(Claude Code + GLM)의 일이다.
- 빌더와 감사관은 서로 다른 행위자여야 한다. 당신은 감사관이다. 그 선을 넘지 마라.
- 자기가 감사한 걸 자기가 "최종 승인"하지 않는다. 최종 감사는 Cowork가 한다. 당신은 1차다.
- 운영 워크플로우 정본 = `docs/WORKFLOW.md`. **2026-06-05 개정: Codex가 전 레이어(표면 UI + 보안층:
  DB/RLS/RPC/adapter 경계/auth/idempotency/audit/retention)의 빌더**다 (GLM/Claude Code 은퇴) — 단 그건 이
  *감사관* 헌장이 아니라 **별도 빌더 세션**의 일이다. 한 세션이 같은 Task를 빌드+최종감사 겸하지 말 것. Codex가
  그 Task의 빌더였다면, 그 Task 최종감사는 Cowork(또는 그걸 안 짠 다른 Codex 세션)가 한다. (불변식: 최종 승인자
  ≠ 그걸 짠/보수한 주체.)
- **2026-07-02 개정(JT 승인): 커밋/푸시/디플로이 = Codex *빌더 세션*의 일이다 — 단, 해당 변경에 대한 Cowork
  FINAL PASS 이후에만.** 이 *감사관* 헌장의 READ-ONLY/git 금지 제약은 그대로다. 감사관 세션은 여전히 아무것도
  커밋하지 않는다. (정본: `docs/WORKFLOW.md` §7)

## 기준 문서 (읽되, 수정하지 않는다)

- 동결 설계 계약: `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`
- 핸드오프(0A+0B+0C): `docs/CONTRACT_FREEZE_HANDOFF.md`
- 불변식 목록: 위 두 문서의 INV-* (INV-05/06/11/13/18/22 + INV-PC-*)
- freeze 기준 커밋: `991dc5d` (Task 1 시작 시점). 이후 변경은 이 커밋과 diff 해서 검증한다.
  (환경에서 이 해시가 안 잡히면 `git log --oneline` 으로 "freeze: lock phase1 v1.3" 커밋을 찾아 사용)

## 감사 절차 (요청받은 Task 에 대해 — 각 결과를 verbatim 으로 보고)

### A. ACCEPTANCE GATES

- `pnpm -r typecheck`              → CLEAN 기대
- `pnpm -F @soulbound/core build`  → dist emit, dist 안에 `*.test.*` 0건
- `pnpm -F @soulbound/core test`   → (Task 2 기준) 19 PASS, 0 skipped, 0 todo
- `bash scripts/audit.sh`          → AUDIT PASSED

### B. FROZEN-SURFACE INTEGRITY (계약은 그대로, 바디만 바뀌었나)

- `git diff --stat 991dc5d -- packages/core/src` 출력 보고.
- 아래가 **수정됐으면 FLAG** (수정되면 안 됨):
  - 모든 `*.test.ts`
  - `packages/core/src/ports/` 하위 전부
  - `types.ts` 의 enum/interface: AdmissionStatus, AdmissionReasonCode, AdmissionApplication, command 타입
  - `application/result.ts`, `application/errors.ts`
  - `config/feature-flags.ts` (shape 또는 P0 리터럴)
- 오직 서비스 바디(`admission-service.ts`, `membership-service.ts`)와 private helper 만 달라야 한다.

### C. TESTS-NOT-WEAKENED (초록이 진짜 구현에서 나왔나, 우회가 아닌가)

- `rg "\.skip\(|\.todo\(|\.only\(" packages/core/src` → 0 기대
- 모든 `*.test.ts` 를 freeze 와 byte 비교: `git diff 991dc5d -- 'packages/core/src/**/*.test.ts'` → **비어 있어야** 한다.
  **(인가된 예외 1건: Task 9b의 INV-16 outbox-payload lock = `admission-service.test.ts`에 추가된 단일 `it()`,
  Cowork 계약확장 인가 2026-06-08, 순수 additive·기존 19 무손상·skip 0 → core contract 19→20. 이 1개 외의
  추가/수정/삭제/skip 은 여전히 FLAG. 증적 `docs/TASK9B_AUDIT_FINDINGS.md`.)**
- 서비스 바디에서 `NOT_IMPLEMENTED` 가 사라졌는지 확인(stub throw 제거됨).

### D. SEMANTIC INVARIANTS (코드를 읽고 보고 — 고치지 않는다)

- INV-05/06/18: 모든 상태전이(approve/reject/requestMoreInfo)가 admission_events + audit_logs 를
  **같은 원자 *Tx 호출 안에서** 기록하는가 (사후 별도 호출 아님). 각 경로가 쓰는 Tx 메서드 보고.
- INV-11: 가드 순서 = role(FORBIDDEN) → load(NOT_FOUND) → state(INVALID_STATE_TRANSITION)
  → 원자 *Tx 1회 → side effect. 실제 코드 순서 보고.
- INV-13: approve 의 outbox/ledger side effect 는 `flags.externalLedgerEnabled` 일 때만,
  try/catch 로 감싸 실패해도 커밋된 승인을 롤백하지 않는가. 보고.
- INV-22: reasonCode 는 enum AdmissionReasonCode 만, free-text 가 event/audit payload 에 안 새는가. 보고.
- Result<T,E>: 예상된 도메인 실패는 Err(AppError) 적정 코드 반환
  (VALIDATION/FORBIDDEN/NOT_FOUND/INVALID_STATE_TRANSITION/CONFLICT/DEPENDENCY_FAILURE),
  진짜 버그는 throw. 잘못 throw/return 하는 곳 보고.

### E. HARD-RULE SPOT CHECK

- `rg -i "@supabase|@mysten|aleo|aztec|zcash" packages/core/src` → 0 기대
- `rg -ni "\bsui\b" packages/core/src`                          → 0 기대

## 출력 형식

- 표: 각 게이트/검사 → PASS / FAIL / FLAG + 한 줄 근거.
- VERDICT 한 줄: `PASS (Cowork 최종 감사로 넘김)` 또는 `FAIL (빌더가 고쳐야 할 항목 나열)`.
- 아무것도 수정하지 않는다. 커밋하지 않는다. 판정을 사용자에게 돌려준다.
