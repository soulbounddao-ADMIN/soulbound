# Alpha R1 — Admission Resubmit (needs_more_info 응답 경로) — Design Brief (Cowork)

> **Step 1 of the loop** (설계 Cowork → 계획 Codex → 계획검토·보충 Cowork → 빌드 Codex → 검토 Cowork → 수정 Codex → 최종검토 Cowork → 커밋/푸시/디플로이 Codex). **Builder ≠ approver.**
> **SECURITY/구조 레이어 포함 (full loop §4b).** 상태 전이·RPC·frozen core 확장이 걸린다.
> 근거: 검토자가 "추가 정보 필요"를 보내면 신청자가 **응답할 수단이 전혀 없음**(프로세스 dead-end). frozen 정책 주석
> `admission-policy.ts:8`은 `needs_more_info -> (resubmit)` 경로를 **원래 설계에 포함**하고 있으나 미구현 상태.

## 0. ⛔ 계약 게이트 (빌드 전 필수)
- core의 frozen 파일(interface/types/policy/tests)을 **additive-only**로 확장한다. CLAUDE.md FROZEN 규칙상
  **JT가 "unfreeze contract"를 명시 선언해야 착수 가능.** 선언 전 Codex는 계획(Step 2)까지만 진행.
- additive 원칙: 기존 시그니처·기존 20개 core 테스트·기존 enum·기존 RPC는 **바이트 무변경**. 추가만 허용.

## 1. 확정 사실 (설계 근거 — 검증 완료)
- frozen `AdmissionService` 5메서드에 신청자 보완 수단 없음; `submitApplication`은 활성 신청 존재 시 CONFLICT
  (`admission-service.ts:108-113`) → needs_more_info 상태의 신청자는 아무 행동도 불가.
- `canDecideFrom`은 `needs_more_info` 포함(`admission-policy.ts:24-25`) — 검토자는 보완 없이도 결정 가능(유지).
- `admission_events.reason_code`는 **nullable**(`0001:59-`) → 재제출 이벤트에 frozen reason enum 확장 불필요.
- `canStartReviewFrom = submitted`뿐 → 재제출 목적지를 **submitted**로 두면 기존 검토 시작 루프를 그대로 재사용.

## 2. 설계 (HIGH — 전부 필수)
**전이: `needs_more_info → submitted` (actor = 신청자, reason_code = null).** 이후는 기존 흐름(startReview → 결정).

- **core (additive unfreeze)**:
  - `admission-policy.ts`: `canResubmitFrom(status) = status === "needs_more_info"` 추가.
  - `types.ts`: `ResubmitApplicationCommand { applicantId, applicationId, applicantStatement?, idempotencyKey }` 추가.
  - `admission-service.ts`: `resubmitApplication(cmd)` 추가 — guard 순서 준수:
    ① load → NOT_FOUND ② **소유권**: `application.applicantId !== cmd.applicantId` → FORBIDDEN
    ③ state guard: `canResubmitFrom` 아니면 INVALID_STATE_TRANSITION ④ atomic `resubmitApplicationTx`.
    (역할 guard 없음 — 신청자 본인 행동. 검토자 메서드와 달리 ownership이 guard.)
  - repo port `AdmissionRepository`: `resubmitApplicationTx(input)` 추가(additive).
  - core 단위테스트 **additive** (기존 20 무손상, skip 0): not_found / forbidden(타인 신청) /
    invalid_state(submitted·under_review·approved 등) / 성공(status=submitted, statement 교체, notice 소거).
- **의미 규칙 (Cowork 결정)**:
  - `applicantStatement`: 제공 시 **교체**(append 아님). 원문 보존 불필요 — 심사 자료는 종결 시 파기가 계약.
  - `applicantNotice`: 재제출 시 **null로 소거**(소비된 안내가 submitted 화면에 잔류하면 혼란).
  - Persona Clip: **범위 밖.** 재녹화/교체 없음, 기존 클립 참조 유지. (INV-PC 계열 무변경)
  - 재제출 횟수 제한 별도 불필요 — 상태기계가 자연 제한(재제출→submitted; 추가 보완은 검토자가 다시 요청해야 가능).
- **DB**: 신규 마이그레이션 1개 — `admission_resubmit(p_application_id, p_applicant_id, p_statement, p_idempotency_key)`
  security definer, `set search_path=''`, 0004 패턴 동일(원자적 상태 재검사 → update → `admission_events` insert
  `from_status='needs_more_info', to_status='submitted', actor_id=신청자, reason_code=null` → idempotency 처리 0004와 동일 패턴).
  pgTAP 추가(성공/타인/잘못된 상태/멱등·이벤트 기록). 기존 마이그레이션·기존 RPC 무변경.
- **adapter**: `supabase-admission-repository.resubmitApplicationTx` → 위 RPC 호출. 단위테스트 additive.
- **route**: `POST /api/admission/applications/[id]/resubmit` — bearer(신청자), zod(statement ≤1200 optional,
  idempotencyKey required), 401/403/404/409/422 매핑 기존 컨벤션. **service 호출만**(HARD RULE 1·3). 통합테스트 추가.
- **UI (`apply/status/page.tsx`)**: `needs_more_info`일 때 보완 폼(텍스트영역 + 힌트 "요청된 정보를 적어 주세요" +
  버튼 "보완 제출") 표시 — R2 문구 분기(안내 유무)는 폼 위 안내문으로 유지. 제출 성공 → 재로드 → submitted 화면
  ("검토가 끝나면 이 화면에서 결과를 안내합니다."). 실패 시 기존 에러+재시도 패턴. dead-end/실패할 버튼 0 (JT UX 기준).

## 3. Guardrails
- 🔴 no-leak 유지: in_vote→"검토 중", 신청자 표면에 검토자 정보/내부 메모 노출 0. `reviewSummary` 경계 무변경.
- HARD RULE 4: 상태 전이는 `admission_events` 기록 필수(위 RPC에 포함). audit_logs는 admin 행동용 — 신청자
  재제출은 admission_events로 충분(제출과 동일 급).
- 멱등성: submit과 동일 수준(중복 재제출 = 안전).
- 카피: 합쇼체·버튼 동사·마침표 규칙(R2 표준) 준수.

## 4. Acceptance gates (full loop)
- `pnpm -r typecheck` · `pnpm -F @soulbound/core test`(기존 20 green 무손상 + 신규 green, skip 0) ·
  `pnpm -F @soulbound/adapters test` · `supabase test db`(pgTAP 기존 + 신규 green) · `pnpm -F web test` ·
  `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- 통합: 재제출 happy-path + 403/409 경로. **호스트 5x + db reset 결정성**(보안층 관례).
- boundary: 기존 마이그레이션/기존 RPC/기존 frozen 테스트/PWA/lock **바이트 0-diff**. 신규 dep 0.
- grep: 기존 frozen 파일 diff가 additive hunk만인지 검증(삭제/수정 라인 0).

## 5. 범위 밖
클립 재녹화 · 알림 · 재제출 이력 UI · reason enum 확장 · withdraw flow · 재신청(rejected 후) 변경 · admin UI 변경
(재제출건은 기존 submitted 큐에 자연 표시).
