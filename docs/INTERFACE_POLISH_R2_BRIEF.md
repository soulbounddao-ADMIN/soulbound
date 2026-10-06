# Interface Polish Round 2 — 매끄러움·직관성·한글 카피 고도화 — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **SURFACE / app-layer 폴리시 (fast loop).** Round 1(cb05b00, FINAL PASS 75f647d) 위에서 진행.
> 근거: 2026-07-02 전 화면 재실사. Round 1 잔여 항목 + 새로 발견한 dead-end·마감투표 버튼·용어 불일치 정리.

## 0. 원칙 (Round 1 계승 + 추가)
1. Round 1 원칙 유지: 표면당 상태 패턴 하나(EmptyState) · 같은 말 두 번 금지 · 합쇼체/동사 버튼.
2. **막다른 화면 금지**: 모든 상태 화면은 "다음에 무엇을 하면 되는지" 한 가지를 제시한다.
3. **동작 불가능한 버튼 노출 금지**: 눌러도 실패할 버튼(마감된 투표 등)은 숨기거나 비활성+사유 표기.
4. **용어는 한 단어로**: 같은 개념에 한 표면이라도 다른 말 금지(멤버 번호/입장일/파기).

## 1. Hard boundary (Round 1 §1 verbatim 유지)
- **surface/app-layer만**: `apps/web/app/**/page.tsx` · `components/ui/*` · `components/admission|pwa` · `globals.css`/module.css. **NO** 백엔드/route 로직/스키마/RPC/frozen core/payload shape 변경.
- payload 필드 추가 0 · 신규 dep 0 · PWA 동작 무변경. 상태별 CTA·버튼 숨김은 **이미 받은 payload 필드만** 사용(`application.status`, `voteDetail.status`, `membership.status`).

## 2. HIGH (correctness·dead-end — 필수)
- **🔴 status 페이지 dead-end(`apply/status/page.tsx`)**: 현재 뱃지+검토자 안내뿐 → **상태별 다음 행동** 추가.
  - `approved` → "입장이 승인되었습니다." + **[입장 절차로]**(`/gate`) 버튼(멤버 활성 여부는 gate가 판정 — status에서 membership 조회 추가 금지).
  - `rejected`/`expired`/`withdrawn` → 한 줄 안내("이번 신청은 거부되었습니다/만료되었습니다/철회되었습니다.") + **[새로 신청하기]**(`/apply`).
  - `needs_more_info` → "검토자 안내를 확인하고 요청된 정보를 준비해 주세요."
  - `submitted`/`under_review`(+`in_vote` 매핑) → "검토가 끝나면 이 화면에서 결과를 안내합니다."
  - 라벨/no-leak 규칙 무변경(`in_vote`→"검토 중" 유지).
- **🔴 마감 투표 버튼(`member/page.tsx` ~1058-1074)**: `voteDetail.status !== "open"`인데 찬성/반대 버튼이 활성(누르면 에러) → **open이 아니면 버튼 숨김**, 결과줄만 표시. open+`hasVoted`면 현행 유지(비활성+투표 완료 뱃지).
- **용어: "승인 번호" 제거(`member/page.tsx:870`)**: fallback "승인 번호를 불러오는 중입니다." → "멤버 번호를 불러오는 중입니다." (전 표면 = **멤버 번호**).
- **용어: "파쇄" → "파기"(`apply/page.tsx:99`)**: "승인 또는 거부 즉시 파쇄합니다" → "…즉시 파기합니다". 복구없음 약속 의미 보존(§5 guardrail).
- **login 리드(`login/page.tsx:62`)**: "아이디와 비밀번호로 돌아옵니다." → **"아이디와 비밀번호를 입력해 주세요. 복구는 제공하지 않습니다."**

## 3. MEDIUM (매끄러움·직관성)
- **gate 현재 단계 표시(`gate/page.tsx`)**: 절차 패널(계정 만들기/입장 신청/멤버 입장)에 현재 단계 강조(`aria-current="step"` + 스타일). 판정: membership active=3, application 있음=2 진행 중, 없음=2 대기. li 안 하드코딩 "1. 2. 3." 제거 → CSS 마커/카운터. 리드 "현재 상태에 맞는 한 가지 다음 행동만 보여드립니다." → **"지금 필요한 다음 단계를 안내합니다."**
- **에러 재시도**: fetch 실패 화면(gate 상태·status·member 명부/투표/게시판·admin 대기열/상세)에 **[다시 시도]** 버튼(기존 load 함수 재호출만, 로직 무변경).
- **board 삭제 확인 beat(`member/page.tsx` deletePost/deleteComment)**: 즉시 삭제 → admin override와 같은 **2-step confirm**("다시 눌러 삭제") verbatim 패턴 재사용. 파괴적 동작 즉발 금지.
- **member 비멤버 fallback(`member/page.tsx:858-867`)**: "멤버 전용 공간입니다." 안내만 있고 행동 없음 → **[입장 절차 보기]**(`/gate`) 버튼 추가. h2 문말 마침표 제거(아래 문장부호 규칙).
- **더보기 탭 카피(`member/page.tsx` disabledMoreGroups)**: "신원 & 자산"→"신원·자산", "개인정보·보안 & 설정"→"개인정보·보안·설정" (**& 전면 제거, · 통일**). "E2EE 보안 설명"→"종단 간 암호화(E2EE) 안내". "프리알파 스테이징 셸"→"프리알파 미리보기 버전".
- **admin 상세 헤더(`admin/applications/[id]/page.tsx:424`)**: AppBar description에 raw UUID → `신청 ${shortId(applicationId)}` 표기(전체 ID는 본문 dl "신청자 ID"에 이미 존재 — 데이터 무변경, 표현만). "확인 불가"(464·512) → **"기록 없음"**.
- **apply 라벨 정합(`apply/page.tsx:106`)**: "나를 설명하는 한 문장" + maxLength 1200 부조화 → label **"자기소개"** + hint "한두 문장이면 충분합니다. (최대 1,200자)".
- **상태 패턴 마감(Round 1 §0-1 완결)**: gate/status/admin의 inline `loading-line`·문단 상태 → **EmptyState** 통일(member 페이지와 동형).
- **TabBar 중복 라벨(`components/ui/tab-bar.tsx:38`)**: 가시 `tabLabel`이 있는데 버튼 `aria-label` 중복 → aria-label 제거(스크린리더 이중 낭독 방지). tab-bar.test.tsx 셀렉터 갱신(단언 약화 0).
- **문장부호 규칙**: 제목(h1/h2/Section title)은 마침표 없음, 본문/안내문은 마침표 있음 — 전 화면 일괄("멤버십을 확인하는 중입니다." h2 등 정리).

## 4. LOW (선택 — 시간 남으면)
- 명부 meta "기록일" → **"입장일"** 통일(내 카드와 동일 용어).
- signup 중복 아이디 구분: supabase 에러로 식별 가능할 때만 "이미 사용 중인 아이디입니다." 분기(식별 불가하면 현행 유지 — 추측 금지).
- persona-clip-recorder 인라인 스타일 → module.css 이관(동작·카피 무변경, 순수 정리).

## 5. Guardrails (Round 1 §6 verbatim — 반드시 유지)
- 게이트: sentence-case(대문자 0) · 2-weight(400/500) · h1 ≤24 · serif=prose-only · 이미지 아바타 0.
- **🔴 no-leak**: 멤버-facing username/email/persona/uuid 0(member-N만) · 신청자 in_vote 비노출("검토 중"만) · admin만 username.
- 안내 정확성: 복구없음·파기·비밀투표 카피 의미 보존(부드럽게, 약속 왜곡 금지).
- admin "거절" / 신청자 "거부" 표면별 일관 유지(한 표면 내 혼용 0).

## 6. Acceptance gates (Claude 최종 감사 — fast loop)
- `pnpm -F web typecheck` · `pnpm -F web test`(카피/셀렉터 갱신 시 단언 약화 0) · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **boundary EMPTY**: `apps/web/app/api` · route 로직 · `packages/*` · `supabase` · payload shape · PWA 동작 · package/lock.
- **grep**: `파쇄` 0 · `승인 번호` 0 · `돌아옵니다` 0 · ` & ` 0(멤버 표면 카피) · `확인 불가` 0(admin) · uppercase/off-palette 0(기존 게이트).
- **동작 확인**: closed/overridden 투표 상세에 찬성/반대 버튼 미노출 · status 각 상태별 CTA 렌더 · board 삭제 2-step · gate 현재 단계 표시.

## 7. Handoff to Codex (Step 2) — 계획만
§2 HIGH 5건 + §3 MEDIUM 9건(§4는 여유 시) 화면별 수정 맵 작성 → Claude 승인 후 빌드. **명시 확인**: 백엔드/payload/frozen 0-diff · 신규 dep 0 · no-leak 유지 · 테스트 비약화. Claude 승인 전 빌드 금지.

## 8. 범위 밖
백엔드/스키마/RPC · payload 필드 추가 · 신규 기능(알림/실시간/신청 수정 flow) · 팔레트 재설계 · needs_more_info 재제출 기능(별도 라운드).
