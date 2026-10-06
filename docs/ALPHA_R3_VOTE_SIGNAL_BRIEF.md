# Alpha R3 — 투표 참여 신호 + 소품 묶음 — Design Brief (Cowork)

> **Step 1 of the loop** (설계 Cowork → 계획 Codex → 계획검토·보충 Cowork → 빌드 Codex → 검토 Cowork → 수정 Codex → 최종검토 Cowork → 커밋/푸시/디플로이 Codex). **Builder ≠ approver.**
> **SURFACE / fast loop.** 백엔드·스키마·payload·frozen 무변경. R1(재제출)과 파일 교집합 없음(member/signup/login/tab-bar/recorder vs status/core/RPC) — 순서 무관 진행 가능.
> 근거: 입장 투표는 정족수 없음 + 동수 부결. 멤버가 투표 열림을 모르면 그 자체로 부결 — 알파 소인원에서 승인 전멸 리스크.
> 이메일 채널 없음(아이디-only) → 인앱 신호가 유일 수단. + JT 확정 정책(2026-07-04) 고지 + 이월 소품 2건.

## 1. HIGH — 투표 참여 신호 (`member/page.tsx`, `components/ui/tab-bar.tsx`)
- **미투표 뱃지**: 멤버십 확인 성공 시점에 `loadVotes()`를 **미리 호출**(현재는 투표 탭 진입 시에만). 기존
  `/api/vote/applications` 호출 그대로 — **payload/API 무변경, 호출 시점만 이동.** 뱃지 수 = 로드된 목록 중
  `!hasVoted` 건수, 표시 상한 "9+". 0건이면 뱃지 미표시.
- **TabBar 확장**: `TabItem`에 `badge?: string` 옵션 추가(`components/ui`). 뱃지 span은 **aria-hidden** —
  탭의 접근성 이름은 "투표" **불변**(R2에서 확정한 visible-label 체계·기존 테스트 셀렉터 유지). 정보 자체는
  투표 탭 목록으로 접근 가능하므로 중복 낭독 불필요.
- **갱신**: 투표 캐스트 후 기존 `loadVotes()` 재호출이 이미 있음 → 뱃지 자동 갱신. 별도 폴링/실시간 금지.
- **마감 임박 표시**: 투표 목록 행에 `windowEndsAt`이 24시간 이내면 `Badge` "마감 임박"(기존 `마감 {date}` 옆).
  클라이언트 시계 비교만, 데이터 무변경.

## 2. HIGH — 계정 분실 정책 고지 (`signup/page.tsx`, `login/page.tsx`)
- JT 확정 정책(2026-07-04): 복구 없음, 분실 = 멤버십 상실, 운영 개입 없음. 카피 반영:
  - signup 리드: "아이디와 비밀번호를 저장해 주세요. **복구는 제공하지 않으며, 분실하면 멤버십을 잃게 됩니다.**"
  - login 리드: 현행 유지("복구는 제공하지 않습니다.") — 경고는 가입 시점이 핵심, 로그인 화면 중복 경고는 소음.
- 의미 정확성: "잃게 됩니다"를 약화하는 표현(찾을 수 있다는 암시) 금지.

## 3. MEDIUM — 이월 소품 2건
- **중복 아이디 에러 구분(`signup/page.tsx` + `lib/auth-provider`)**: supabase signUp 에러가 **코드/상태로
  식별 가능할 때만** "이미 사용 중인 아이디입니다." 분기(Step 2 계획에서 실제 에러 shape 확인 후 확정).
  메시지 문자열 매칭 같은 취약한 추측 분기 금지 — 식별 불가면 현행 유지가 정답.
- **recorder 스타일 모듈화(`components/admission/persona-clip-recorder.tsx`)**: 인라인 style 객체 →
  module.css 이관. **동작·카피·마크업 구조 무변경**(토큰 사용 유지). 스냅샷성 diff만.

## 4. Guardrails
- **payload/API 무변경**: 신규 엔드포인트 0, 기존 응답 필드 추가 0, vote payload 그대로. 프리페치도 기존 호출 재사용.
- 🔴 no-leak 유지(member-N만·in_vote 비노출), sentence-case·2-weight·문장부호 규칙(R2 표준), 신규 dep 0.
- R2에서 고친 에러-가드(`votesError` 시 자동 재요청 중단)와 충돌 금지 — 프리페치 실패 시 뱃지 없이 조용히 두고,
  투표 탭 진입 시 기존 에러+재시도 UI가 처리(프리페치 실패로 새 에러 배너를 멤버 탭에 띄우지 말 것).
- 실패할 버튼 미노출·dead-end 금지(JT UX 기준) 유지.

## 5. Acceptance gates (fast loop)
- `pnpm -F web typecheck` · `pnpm -F web test`(뱃지 표시/0건 미표시/캐스트 후 감소·탭 접근성 이름 "투표" 불변·
  마감 임박·signup 카피 단언; 기존 단언 비약화) · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- boundary EMPTY: `apps/web/app/api`·`packages/*`·`supabase/*`·PWA·lock 0-diff.
- grep: 뱃지에 후보 식별자/username 노출 0 · recorder 이관 후 인라인 hex/off-token 0.

## 6. 범위 밖
푸시/이메일 알림 · 실시간 갱신/폴링 · 미투표 수 전용 API · 투표 마감 연장 · login 경고 중복 · 명부/게시판 뱃지.
