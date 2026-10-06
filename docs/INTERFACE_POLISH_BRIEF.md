# Interface Polish — 전체 UI 고도화 + 한글 카피 표준 — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **SURFACE / app-layer 폴리시 (fast loop).** 더 매끄럽고 직관적 + 한글 카피 매끄럽게. **백엔드/스키마/frozen/payload 무변경.**
> 근거: 화면별 감사 워크플로(2026-06-26). churn(email→username·persona 폐기·게시판/투표 추가) 후 잔재·불일치·게이트 일탈 정리.

## 0. 원칙 (design)
1. **표면당 상태 패턴 하나**: 모든 async 화면 = `loading → error → empty → content → 더 보기` 순서 + `EmptyState`로 3개 비-content 상태 통일(현재 member/gate/status가 제각각 inline).
2. **같은 말 두 번 금지**: apply/status의 뱃지+"신청 상태" dl 중복 제거 · 영어 eyebrow(h1 재진술) 제거.
3. **churn 페이지(member/vote)를 DESIGN_PASS 페이지(signup/gate) 수준으로** 일관화(토큰·프리미티브 사용, ad-hoc 스타일 제거).

## 1. Hard boundary (최종 감사 강제)
- **surface/app-layer만**: 페이지(`apps/web/app/**/page.tsx`)·`components/ui/*`·`components/admission|pwa` 스타일·`globals.css` 카피/토큰. **NO** 백엔드/route 로직/스키마/RPC/frozen core/payload shape 변경.
- **payload에 필드 추가 금지**: candidate-token·memberNumber·in_vote 매핑·vote payload(candidateToken/statement/hasClip/aggregate/hasVoted)는 그대로 — 폴리시는 *표현 래퍼*지 데이터 변경 아님.
- **신규 dep 0.** PWA manifest/SW 동작 무변경(카피/색 토큰 정리만).

## 2. 한글 카피 표준 (전 화면 적용)
- **톤 = 합쇼체**: 서술 「…합니다/…습니다」, 요청 「…해 주세요」. **해요체 imperative 제거**(gate "확인하세요"→"확인해 주세요", home "대화하세요"→아래). 느낌표·대문자 없음.
- **용어표(좌=사용, 우=교체)**: **아이디** ← 표시용 "username"(signup/login label·body·error; `autoComplete="username"` 속성은 유지) · 가입 · 로그인 · 입장 · 입장 신청 · 멤버 · **게시판** · 입장 투표 · 더보기 · **찬성/반대** ← "YES/NO" · **거부**(신청자 표면, "거절됨"→"거부됨"으로 통일; admin 표면은 "거절" 내부 일관 허용, 단 한 표면 내 혼용 금지) · **검토 중**(신청자: home/gate/status 전부, "검토 대기" 제거).
- **마이크로카피 패턴**: 버튼=동작 동사(합쇼체 아님, 명령형 짧게 "저장"/"신청"/"투표"), 상태=EmptyState 일관 문형, 에러=원인 구분 가능하게.

## 3. HIGH 수정 (correctness·gate — 필수)
- **home(`page.tsx`)**: ① step1 "계정 만들고 **메일 확인**" → **"아이디와 비밀번호로 계정을 만듭니다"**(이메일 언급 전면 삭제 — signup은 username-only). ② **"멤버와 대화하세요"/"대화" 약속 제거** → 게시판 반영("멤버들과 게시판에서 이야기합니다"류). chat/DM은 없음(계약 금지).
- **member(`page.tsx:845` fallback)**: "명부와 **대화**를 사용" → "명부와 **게시판**을 사용".
- **🔴 TabBar(`components/ui/ui.module.css` + `tab-bar.tsx`)**: `.tabBar`가 `repeat(3, ...)` 하드코딩인데 멤버 탭 **4개** → **동적 컬럼**(`repeat(var/자동)` 또는 항목수 기반)으로 수정. **아이콘-only → 라벨 표시**(하단 라벨 or 접근가능 텍스트) → "웹에서 탭 안 보임" 해소.
- **투표 버튼(`member/page.tsx ~1036-1050`)**: `YES`/`NO` 대문자 영어 → **찬성/반대**(sentence-case 게이트). 결과줄도 "찬성 {n} · 반대 {n}".
- **admin 투표 패널(`admin/applications/[id]/page.tsx` 565/584/601-611)**: 번역투 한글화("active 멤버에게"→"활동 멤버에게", "binding decision으로 확정"→"투표 결과로 확정", "override는 admin만"→"운영자만 재정의 가능"). "심사 dossier"(434)→"심사 자료".
- **eyebrows(gate/apply/status/admin×2)**: 영어 eyebrow(Gate/Apply/Status/Review operations/Application review) — h1 재진술이라 **제거**(또는 한글화). 권장 제거.
- **persona-clip-recorder(`components/admission/persona-clip-recorder.tsx`)**: 하드코딩 오프-팔레트 hex(#a8b0b9/#17684f 등) → **토큰(--accent/--ink/--surface/--line)**으로. /apply 토큰 시스템과 정합.

## 4. MEDIUM 수정
- **투표 cast 피드백(`member/page.tsx`)**: YES/NO 후 disabled+"투표 완료"뿐 → **명시적 완료 beat + 비밀 안내**("투표가 접수되었습니다. 선택은 공개되지 않습니다."). 결과에 **outcome 표시**(가결/부결 — `voteDetail.outcome` 사용).
- **signup 힌트**: username 아래 "소문자·숫자·-·_ 3~24자", 비번 아래 "6자 이상". 가능하면 "이미 사용 중인 아이디" vs 형식오류 구분.
- **3단계 용어 통일(home/gate)**: 1) 계정 만들기 2) 입장 신청 3) 멤버 입장 — verbatim 재사용. review 단계는 "검토 중"과 정렬.
- **apply/status 중복 제거**: 뱃지 유지, "신청 상태" dl 행 제거(또는 제출일 등 additive로 대체).
- **admin under_review(561-629)**: 투표-열기 섹션 + DecisionPanel 둘 다 보임 → 관계 명확히(예: "멤버 투표" vs "직접 결정" 택1 안내).
- **override 확인단계**: 승인/거절 override 즉시 실행 → **확인 단계** 추가(파괴적).
- **placeholder 통일**: 삭제된 statement 문구를 list("결정 후 삭제됩니다")/detail("삭제되었습니다") 일관화.
- **candidateToken 표현**: raw "candidate-xxxxxxxx" → 부드럽게("신청 #xxxx"류 표시, 데이터 무변경).
- **admin queue in_vote="멤버 투표 중"(brand)** = *의도된 것*(admin은 substage 봄; 신청자는 "검토 중"). **유지** — 혼동 아님, no-leak 정합.

## 5. Gate violations (정리)
- **font-weight**: 코드 600(8곳: globals `103/116/189/244/337/402/414/461`) vs 게이트 400/500. **JT 결정 → default 400/500 통일**(문서·부드러움 정합; 폰트 선언 `400 600`→`400 500`). 600 유지 시 문서 갱신.
- **install-prompt.module.css:16 `font-weight:760`** → 스케일 내로(500/600).
- clip-recorder 오프-팔레트(위 §3).

## 6. Guardrails (폴리시가 반드시 유지)
- **게이트**: sentence-case(대문자 0 — 추가 금지) · 2-weight 목표 · h1 ≤24(현 22 유지) · serif=prose-only(--font-prose) · **사진/이미지 아바타 0**(member-N 텍스트 mark).
- **🔴 no-leak**: 멤버-facing에 username/email/persona/uuid **0**, member-N만. admin만 username. **신청자는 in_vote를 "검토 중"으로만**(투표 substage 비노출).
- **안내 정확성 유지**: 복구없음·파쇄·비밀투표 카피는 *의미 정확*하게(부드럽게 다듬되 약속 왜곡 금지).

## 7. Acceptance gates (Claude 최종 감사 — fast loop)
- `pnpm -F web typecheck` · `pnpm -F web test`(비약화; 카피/셀렉터 변경 시 테스트 업데이트하되 단언 약화 0) · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **boundary EMPTY**: `apps/web/app/api`·route 로직·`packages/core`·`packages/adapters`·`supabase`·payload shape·PWA 동작·package/lock. 신규 dep 0.
- **게이트 grep**: `text-transform:uppercase` 0 · font-weight ≤ 결정값 · `YES`/`NO`/영어 eyebrow 0 · 오프-팔레트 hex 0(토큰만).
- **🔴 no-leak grep**: 멤버-facing에 username/email/persona/uuid 0(member-N만) · 신청자 경로에 in_vote 노출 0.
- **카피 정확성**: home/member에 "대화"(chat 약속) 0 · 이메일 언급 0(signup/home) · 복구없음/파쇄/비밀 안내 의미 보존.

## 8. Handoff to Codex (Step 2) — 계획만
화면별 수정 맵(위 §3-5)·한글 카피 표준(§2) 적용·TabBar 동적 컬럼+라벨·상태패턴 통일(EmptyState)·clip-recorder/install-prompt 토큰화·font-weight 결정 반영·테스트 업데이트(비약화). **명시 확인**: 백엔드/route/스키마/frozen/payload 0-diff·신규 dep 0·게이트 유지·member-N no-leak·신청자 in_vote 비노출·안내 정확성. Claude 승인 전 빌드 금지.

## 9. 범위 밖
백엔드/스키마/RLS/RPC·payload 필드 추가·팔레트 재설계·신규 기능(chat/realtime 등)·live 투표 tally(데이터 필요 시 별도).
