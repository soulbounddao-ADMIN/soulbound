# Member Board (게시판) — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **P0 이후 세 번째 northstar 기능** + **메신저 Northstar의 1번 벽돌**(게시판 → 후속: realtime 챗방 → ICP-native 암호화).
> **JT unfreeze 적용(이 브리프 한정)**: `HARD RULE 9`(chat/messages/inbox 라우트 금지)를 **단일 공용 멤버 게시판에 한해** 푼다.
> **여전히 금지**: 1:1 DM/inbox(ciphertext-E2E DM Northstar + `HR7 direct_messages` 보존). `realtimeChatEnabled`는 **false 유지**(게시판=async, realtime 아님).

## 0. Why
입장 후가 비었다(member-N 디렉터리뿐). 게시판 = 초기 멤버가 *함께 떠드는* 첫 소통면. 디씨인사이드식 — **member-N 익명 posting**,
async, 멤버 전용. **익명(member-N)이 thesis와 정합**, Telegram 의존 0, realtime 복잡성 0. 메신저 Northstar의 첫 걸음.

## 1. Hard boundary (최종 감사 강제)
- **새 기능 + 새 테이블.** 손대는 곳: 새 migration(`0011_board.sql`류), 새 라우트(`apps/web/app/api/board/**`), 새 서비스/리포지토리,
  멤버 셸의 "대화"(chats) 탭을 **게시판**으로 전환(라벨 "게시판"/"라운지" — Codex 제안), 더보기의 죽은 "소통" 섹션 제거.
- **🔴 FROZEN 0-diff**: `direct_messages` 및 기존 migration(0001-0009)·`0003_rls`·`0004_rpc` **변경 금지**(게시판은 *새 테이블*). `packages/core` frozen 마커,
  admission/apply/persona-clip/membership/디렉터리 동작, auth-provider, PWA, package/lock. **신규 npm dep 0.** `realtimeChatEnabled` false 유지.
- **HR9 unfreeze 범위**: 멤버 *공용 게시판* 라우트만. **1:1 DM/inbox·realtime·presence는 이 라운드 밖**(후속 단계).

## 2. Data (새 테이블 + RLS + plaintext 기록)
- 새 migration: `board_posts`(id uuid pk, author_id → profiles(id), body text[, title text?], created_at, **content_hash text**, **previous_hash text null**, **storage_provider text default 'supabase'**, **storage_ref text null**, **deleted_at timestamptz null**) + `board_comments`(id, post_id → board_posts on delete cascade, author_id → profiles(id), body text, created_at, **content_hash text**, **previous_hash text null**, **deleted_at timestamptz null**). **plaintext**(서버-readable). migration-ready 컬럼은 §2.5 검열저항 seam용 — `content_hash`/`previous_hash`는 0009 audit-hash-chain, `storage_*`는 persona_clip_assets/evidence_files 패턴과 동형.
  - **content_hash = `sha256(canonical(author_id, body, created_at))`** (0009 canonical 패턴 — body-only 아님, author/timestamp 변조도 탐지 = 국가 압류 후 위조 탐지). 알파에 *채움*. 검증 불변식: 저장값 == 재계산.
  - **previous_hash**: 시퀀스 안티-조작 seed, **dormant null**(컬럼만). 운영자-억압 탐지가 *목표 아님*이라 우선순위↓ — 미래에 국가 압류 후 재배열/삽입 탐지가 필요하면 0009식으로 켬.
  - **deleted_at**: *선택*. **운영자/author는 hard-delete 가능**(max 권한 — tombstone 강제 아님). 미래 분산저장/내구성 단계에서 soft-delete가 유용해지면 그때 채택.
- **RLS**: active 멤버만 read+write — `using/with check (is_active_member(auth.uid()))`, author insert는 `author_id = auth.uid()`. (디렉터리의 active-게이트와 동형.) 새 정책만 추가, 기존 RLS 무변경.
- **🔴 plaintext = 의도적 data-min 완화**(알파): 게시판 콘텐츠는 운영자-readable. PROJECT_STATE에 완화 기록(후속: 암호화/최소화 = 메신저 Northstar STAGE). **단 핵심 프라이버시는 보존**: 글은 *member-N*에만 귀속(실신원/이메일/username 아님).
- 컬럼 최소: 콘텐츠는 body(text) 위주. 미디어/첨부 **이번 라운드 밖**(텍스트만).

## 2.5 검열저항 마이그레이션 seam (JT 요구 — "연결 가능성"이 코드에 있어야)
> 게시판 글은 **알파 이후 검열저항이 담보되는 형태**(파일코인/ICP 등 내구·탈중앙)로 갈 수 있어야 한다. 게시판은 *영속 공유 기록*이라
> 검열저항 = *운영자가 내릴/변조할 수 없음* → 내구 탈중앙 저장이 적합(삭제돼야 할 클립/DM과 반대 — 데이터 종류가 다름).
> **단 지금은 구현이 아니라 *seam*만**(HR9가 main에 Filecoin/ICP/IPFS/Arweave *구현*을 금지). 프로젝트의 "migration-ready" 철학 그대로.
- **포트 seam**: 게시판 콘텐츠 접근을 **`BoardRepository`(또는 BoardContentPort) 추상 뒤로** — 라우트/서비스는 포트만 호출, Supabase 직접 X.
  알파 어댑터 = `SupabaseBoardRepository`(plaintext Postgres). **미래 어댑터**(ICP 캐니스터 저장 / 콘텐츠-주소 + Filecoin·IPFS 앵커 / Arweave) =
  **옵션 브랜치**(`FUTURE_censorship_resistance_icp.md` staged path). LedgerPort=Noop-on-main + 실어댑터-on-branch와 동형.
- **🔴 위협모델 (JT 2026-06-25)**: **CR 대상 = 국가공권력(검찰/경찰)만.** 운영자(JT)는 **최대 권한 유지** — 읽기·모더레이션·hard-delete 전부.
  *운영자-억압 방지는 목표 아님.* (단 핵심 긴장: 운영자가 강제당하면 국가가 운영자 권한 상속 → 진짜 state-resistance는 *운영자 강제가능 표면*을 줄여야 함. 알파는 운영자 max라 아직 state-content-resistant 아님 — durability/익명성이 양립 레버.)
- **(B) 내구성 = 1차 state-resistance** (운영자 권한과 양립): `storage_provider`(default 'supabase') + `storage_ref`(null) + `BoardRepository` 포트.
  미래에 blob을 *운영자 인프라 밖* 내구 저장(ICP 캐니스터/Filecoin·IPFS/Arweave)으로 → **국가가 운영자 서버 압류해도 전역 소멸/포획 불가.** 운영자는 여전히 live view 모더레이션. 알파엔 'supabase'/null dormant.
- **content_hash = 안티-조작**: `sha256(canonical(author_id, body, created_at))` 알파에 *채움* → 미래 외부 앵커 결합 시 *국가가 압류 후 위조/변조해도 멤버가 탐지.* **운영자 삭제와 무관**(운영자 자유 삭제).
- **익명성 = 핵심 state-resistance** (운영자 모더레이션과 양립): **member-N 익명**(Anonymous Identity v2 `4392115`로 이메일 제거·username 로그인·member-N 표시·persona 폐기 완료). 게시판 글도 **member-N에만 귀속**, 운영자가 실신원 링크를 국가 소환 형태로 안 쥠. (구 raw-email 충돌은 v2가 이메일 제거로 해소.)
- **(A) previous_hash 체인 = demote/dormant**: 주가치(운영자-억압 탐지)가 *목표 아님*이라 우선순위↓. 시퀀스 안티-조작(국가 압류 후 재배열/삽입 탐지)용 cheap dormant 컬럼만 유지. `deleted_at`도 *선택*(운영자 hard-delete 가능 — tombstone 강제 아님).
- **🔴 boundary**: 알파는 **Supabase-plaintext 어댑터 + content_hash 채움 + 포트 seam + dormant 필드만.** main에 concrete-chain/탈중앙-저장 SDK·구현 **0**(HR9·chain-neutral). 신규 dep 0.

## 3. Routes (async · user-JWT · active 게이트 · member-N attribution)
- 흐름: component → hook → 라우트 → service → repository → adapter. **user-JWT 클라이언트**(service-role 아님) + active-membership 게이트(401/403, profile/me·디렉터리 패턴).
- `GET /api/board`(post 목록, keyset 페이지네이션 created_at+id) · `POST /api/board`(post 작성) · `GET /api/board/[postId]`(post + comments) · `POST /api/board/[postId]/comments`(댓글). async(realtime 0).
- **attribution = member-N only**: 각 post/comment에 author의 **`member_number`(soulbound-member-N)** 만 join해 표시(persona 폐기됨). **🔴 author의 username/email/role/membership_status/wallet/dossier/uuid 절대 응답 금지**(no-leak — member-N만; 디렉터리 규율과 동일). isMe는 서버측 member_number 비교(uuid 누출 0).

## 4. UI (대화 탭 → 게시판)
- "대화"(chats) 탭을 게시판으로: post 목록(최신순, ListRow/카드 — title/본문 미리보기 + **soulbound-member-N** + 시간), 작성 컴포저, post 상세(본문 + 댓글 + 댓글 작성). **realtime 0**(새로고침/pull-to-refresh). 빈/로딩/에러 상태.
- 사진/아바타 0(member-N 텍스트 mark만 — 디렉터리 memberMark 패턴 재활용). warm/simplicity 게이트 유지(weight ≤600, no uppercase, heading ≤24, serif=prose-only).
- 더보기의 "소통" 섹션(대화/DM/알림 placeholder) **제거**(JT 요청 — DM은 Northstar, 게시판이 소통면).

## 5. 불변식 (반드시)
1. **member-only** — active 멤버만 read/write(RLS + 라우트 게이트 이중).
2. **익명(member-N)** — post/comment는 `soulbound-member-N`에만 귀속(persona 폐기됨). username/실신원/이메일/role/author uuid 노출 0.
3. **no-DM** — 단일 공용 게시판만. 1:1 DM/inbox 라우트 0(HR9 unfreeze 범위 준수).
4. **plaintext 기록** — 운영자-readable 완화를 명시 기록(후속 암호화 STAGE).
5. **dossier 비노출** — 게시판 어디에도 dossier(statement/motivation/referral/clip/reviewSummary) 0. (persona 폐기됨.)

## 6. 모더레이션 (운영자 max 권한 — 위협모델 §2.5)
- **운영자/admin = 전권 모더레이션**: 어떤 post/comment든 삭제/숨김 가능(hard-delete OK). requireReviewer/admin 게이트 뒤 service-role 또는 admin RLS 경로. *운영자 검열은 의도적으로 최대 유지*(CR 대상은 국가뿐).
- **author 자기 글 삭제**: `author_id=auth.uid()` RLS delete.
- 입장 심사가 강한 1차 필터. slash/audit 연계는 후속. (선택) 게시판 작성/삭제 `audit_logs` 기록 — Codex 제안(0009 hash chain 자동 커버).

## 7. Acceptance gates (Claude 최종 감사 — 새 RLS read/write라 host 결정성)
- `pnpm -r typecheck` · `pnpm -F web test`(비약화) · `pnpm -F @soulbound/core test` · `pnpm -F @soulbound/adapters test` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **boundary**: `direct_messages`·기존 migration(0001-0009)·0003/0004·frozen core·admission/apply/persona-clip·디렉터리·PWA·lock **0-diff**. 신규 dep 0. `realtimeChatEnabled` false 유지.
- **🔴 no-leak(grep+테스트)**: 게시판 응답에 username/email/role/membership_status/wallet_address/author uuid/dossier/persona **0**. `member_number`(soulbound-member-N)만.
- **🔴 RLS(host 통합 + 5x+reset)**: 비-active 뷰어 read/write 403 · active 멤버만 post/comment · author만 자기 글 삭제 · 타인 글 수정/삭제 불가. DB-touch라 **5x+reset 결정성**.
- supabase test db(새 pgtap: RLS 작성/삭제/열람 규칙).

## 8. Handoff to Codex (Step 2)
계획: 테이블/RLS(0011, 기존 0-diff)·서비스/리포지토리·라우트(GET/POST, user-JWT, active 게이트, **member-N-only projection**)·UI(대화 탭→게시판, 작성/목록/상세/댓글, realtime 0)·더보기 소통 제거·테스트(no-leak·RLS 열람/작성/삭제·페이지네이션)·(선택)audit 기록. **명시 확인**: direct_messages/기존 migration 0-diff·realtimeChatEnabled false·1:1 DM 0·신규 dep 0·**member-N만(username/email/uuid/persona 미노출)**·3-client. Claude 승인 전 빌드 금지.

## 9. 범위 밖 (후속 단계 — 메신저 Northstar)
realtime(즉시 표시)·presence(누가 온라인)·1:1 DM(ciphertext-E2E)·미디어 첨부·암호화(group/E2E)·**CR-저장 어댑터 구현**(ICP 캐니스터/Filecoin·IPFS 앵커/Arweave = 옵션 브랜치)·외부 앵커링 발행 + Telegram-attach(thesis 모순 — 기각).
**이번 라운드 IN**: §2.5의 *seam만* — `BoardRepository` 포트 추상 + `content_hash` 채움(canonical) + `previous_hash`·`deleted_at`(tombstone)·`storage_provider`/`storage_ref` 컬럼 + soft-delete. (체인-켜기·외부앵커·CR어댑터는 OUT — 연결 가능성만.)
