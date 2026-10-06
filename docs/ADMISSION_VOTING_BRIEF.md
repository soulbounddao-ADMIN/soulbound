# Admission Voting — 멤버가 입장을 결정 — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **SoulBound 제품 핵심** — "누구와 함께할지는 구성원이 결정하고, 구성원이 된 뒤엔 *누구인지*가 아니라 *무엇을 말하는지*만 남는 디지털 파이널 클럽."
> **FULL feature/security loop** — DB(0012 additive) + 투표 RPC + 비밀투표 + UI. host 5x+reset 필수. **frozen 입장 계약 0편집.**

## 0. 확정 모델 (JT 2026-06-26)
- **멤버가 결정**: 신청자 = 자기소개(statement) + 동영상(clip). active 멤버가 투표로 입장 결정.
- **거버넌스 = 지분주권형(미래)**: SOUL stake 비율 = 결정권, 과반 stake = 단독결정(의도된 귀족 구조, 수용). **알파 = 1계정 1표**(스테이킹 미구축).
- **알파 규칙**: **찬성 > 반대일 때만 가입**, **동률(0-0 포함) → 불허**(default-deny). 1표라도 유효(부트스트랩).
- **투표 = 비밀**(멤버끼리 서로 표 안 보임). **binding + admin-override**: 투표가 규칙대로 자동 확정(→frozen approve/reject), 단 운영자 max 권한으로 admin override 가능. audit엔 *결정 사실 + 집계 + override* 만(개별 ballot 아님).
- **clip = voters 노출**(심사 중 신청자 privacy 포기) — 단 **완화-show**(만료·per-member·audit signed URL, 다운로드 불가, shred 전 revoke).
- **결정 후 전 자료 영구삭제**(dossier+clip shred — 기존 INV-PC-09/HARD RULE 8). 익명성은 **입장 후**(member-N).

## 1. Hard boundary (최종 감사 강제)
- **🔴 FROZEN 0-diff**: `0001-0011` SQL·`0004` RPC·`packages/core/src/domain/admission`(types/admission-policy/admission-service)·`ports/admission-repository`·모든 `*.test.ts`. **finalize는 frozen `approve_application_tx`/`reject_application_tx`에 위임**(member-N 발급·dossier 파쇄·membership·audit를 *검증된 frozen 경로*로 — 절대 인라인 금지).
- **EVOLVABLE/신규**: `0012_admission_voting.sql`(additive) · 새 core `AdmissionVoteService` + `VoteRepository`(신규 port/타입, frozen 시그니처 무변경) · 새 web 라우트(`apps/web/app/api/vote/**` 또는 admission 하위) · 멤버 UI(투표). **신규 dep 0.**
- **frozen enum 주의(Step-2 핵심)**: `status`에 **`in_vote` 추가는 additive ALTER**(필요). 단 `reasonCode`·audit `action` enum은 **frozen 3-site** — 투표 세부(찬반/근거/집계)는 **새 `admission_votes` 테이블**에 두고, finalize의 실제 approve/reject는 **기존 reasonCode** 사용 → enum 미편집. 불가피하면 한정 unfreeze를 Step-2에서 명시.
- **frozen FSM 우회 안 함, 감쌈**: open `under_review→in_vote`(새 RPC), finalize `in_vote→under_review`(새 RPC) **그 다음** frozen `approve/reject`(under_review→terminal). frozen `admission-policy` FSM은 무변경.

## 2. 투표 모델
- **WHO**: active 멤버(`member_number NOT NULL AND is_active_member(uid)`). 신청자는 voter 아님 + voters에게 **가명**(username/applicant_id/member_number 노출 0 — opaque candidate token).
- **규칙(알파)**: YES/NO 비밀투표. **admit iff YES>NO; tie(0-0 포함)→reject**(default-deny). 투표창(예 72h) 만료 시 집계. 규칙·창은 open 시 `admission_votes` 행에 **스냅샷**(미래 SOUL-가중/정족수로 재조정 가능, 과거 투표는 당시 규칙으로 audit).
- **binding + override**: 만료/결정 시 자동 finalize→frozen approve/reject. **시스템 actor_id**(profiles FK 만족하는 합성 system actor)로 audit. admin override(approve over reject, 또는 그 반대)는 admin actor_id로 별도 audit.
- **부트스트랩**: 초기 멤버 ~0명 — admin이 멤버 #1 시딩 → 투표체 생기면 멤버투표. 1표 규칙이 소수 부트스트랩 수용.

## 3. Frozen-safe 통합 (0012 additive)
1. `status` CHECK에 **`in_vote` 추가**(0012 DROP/ADD constraint — 0001 미편집) + single-active 부분 unique index에 `in_vote` 포함.
2. **`admission_votes`**(id, application_id FK, status open/closed, **스냅샷 규칙**{kind,quorum,window_ends_at}, vote_outcome, opened_by, opened_at, closed_at, idempotency_key UNIQUE).
3. **비밀투표 저장(§4 그래프-fix)**.
4. 새 **SECURITY DEFINER service_role-only RPC**(revoke anon/auth): `open_vote_tx`(under_review→in_vote) · `cast_vote_tx`(ballot insert, status 불변) · `finalize_vote_tx`(집계→in_vote→under_review→**frozen approve/reject 위임**).
5. **읽기 경로**: board의 `list_board_posts`처럼 SECURITY DEFINER RPC — voters에게 **vote-safe 컬럼만**(`applicant_statement`; **username·review_summary·member_number·applicant_id 절대 금지**), `in_vote AND is_active_member` 게이트.
6. **audit/events**: 상태 전이(open/finalize)는 `admission_events`(in_vote status additive) + finalize의 approve/reject는 frozen 경로가 audit. **개별 ballot은 audit 안 함**(§4). 단독/결정 사실 + 집계는 남김.

## 4. 🔴 비밀투표 + 영구-소환가능 그래프 fix (적대가 찾은 가장 깊은 구멍)
**문제**: one-vote 강제 위해 voter_id 저장 필요 → 0009 append-only 해시체인 audit에 ballot별로 쓰면 **삭제불가·국가소환가능한 "member-N↔투표↔신청자" 사회그래프**(데이터-min thesis 위반).
**fix (네 "비밀 + 사실만 audit"과 일치)**:
- **one-vote 강제 = turnout 행** `UNIQUE(application_id, voter_id)`(누가 *투표했는지*만, 선택 아님).
- **선택(YES/NO) = 분리된 행**, per-vote **블라인드 토큰**에 키잉 — **voter_id↔토큰 링크 미저장**(운영자가 선택을 voter에 못 묶음).
- **finalize 시 링크/토큰 purge**, **집계(X yes/Y no)+결과만** 잔존.
- **audit = 집계 결과 + 결정 사실 + (있으면)override만**, 개별 ballot 0.
- → 영구 who-judged-whom 그래프 **0**. 멤버-secret + 운영자도 *영구* 링크 미보유.
- **잔여(정직)**: live 투표창 동안 동시 insert의 *타이밍 상관*으로 운영자가 일시 추정 가능(완전 cryptographic operator-blind ballot은 Northstar). 타임스탬프 정밀도 최소화로 완화.

## 5. clip — 완화-show
voters는 clip을 **만료·per-member·audit signed URL**로만 봄(다운로드 불가, **shred 전 revoke**). 기존 `persona-clip-url` 라우트(reviewer-only) 패턴을 *투표창 동안 active voter*로 확장, 매 발급 audit, finalize-shred *전* 접근 revoke. raw 노출/박제(스크린레코드 doxx) 표면 축소.

## 6. 불변식 (반드시)
1. **frozen 0-diff** + **finalize는 frozen approve/reject 위임**(membership/member-N/shred/audit 인라인 절대 금지 — hard-spec+test).
2. **cast_vote 권한**: `is_active_member(auth.uid())` + voter_id = **auth.uid()**(라우트-공급 voter_id 불신). 비-active/비-member 투표 0.
3. **신청자 가명**: voters 응답/UI에 username/applicant_id/member_number/review_summary **0**(opaque candidate token + statement만; clip은 §5 게이트).
4. **비밀투표**: 영구 voter→choice 그래프 0(§4). audit = 집계+사실+override만.
5. **one-vote**: `UNIQUE(application_id, voter_id)`.
6. **HARD RULE 4**: 상태전이 admission_events·결정 audit(hash-chained)·reasonCode enum(frozen 기존값).
7. **3-client**: 변이 RPC service_role-only, 클라이언트-직접 Supabase 0.
8. **clip revoke가 shred *전***.

## 7. ⚠️ 정직한 알파 현실 (수용)
- **faction capture**: 알파 1표 = stake 비용 0 → 소수 bloc이 입장 결정·자기편 복리. **막을 SOUL-stake 비용은 미래 모델**(네 지분주권 = 의도). 알파 = "들어와 있는 자가 결정, 비용 없음".
- **정족수 없음**(1표 결정) = bloc capture 키움 — 부트스트랩 불가피, 정족수는 클럽 확장 시 미래 도입.
- **운영자-held 투표 turnout**: 누가 *투표했는지*(선택 아님)는 운영자 보유 → 국가소환 표면(state-CR은 미래). 멤버-secret은 보장.
- **clip 완화-show**라도 voter가 보는 순간의 노출은 남음(스크린레코드 0은 아님).

## 8. Acceptance gates (Claude 최종 감사 — full loop)
- `pnpm -r typecheck` · `pnpm -F web test`(비약화) · `pnpm -F @soulbound/core test`(frozen 0-diff) · `pnpm -F @soulbound/adapters test` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **boundary**: 0001-0011·0004·frozen core(types/policy/service/repo)·모든 frozen test **0-diff**. 신규 dep 0.
- **🔴 finalize 위임 테스트**: finalize_vote가 *오직* in_vote→under_review + 자기 event/audit만; membership insert·dossier null·member_number 할당 **0**(전부 frozen approve/reject가 함).
- **🔴 no-leak/가명**: voter 경로에 username/applicant_id/member_number/review_summary 0(grep+테스트). clip은 만료 audit URL만.
- **🔴 비밀투표 그래프**: 영구 voter→choice 링크 0(finalize 후 purge 검증); audit = 집계+사실만, 개별 ballot 0.
- **권한**: 비-active/비-member cast 거부·one-vote(중복 cast 거부)·라우트-공급 voter_id 무시.
- **규칙**: YES>NO admit / tie→reject / default-deny / binding 자동 finalize / admin override 경로.
- **host 5x+reset**(DB+RLS+RPC): supabase test db(새 pgtap: 투표 RLS/권한/one-vote/그래프-purge) + web/adapters integration.

## 9. Handoff to Codex (Step 2) — 계획만
0012(in_vote ALTER+index·admission_votes·비밀투표 저장 그래프-fix·open/cast/finalize RPC·vote-safe 읽기 RPC) · **finalize→frozen approve/reject 위임**(system actor) · admin override 경로 · clip 만료-audit signed URL(reviewer-only 패턴 확장+revoke-before-shred) · UI(투표 목록/상세[statement+clip URL]/YES-NO 비밀 cast/결과) · 테스트(위임·가명·그래프-purge·권한·one-vote·규칙·5x). **명시 확인**: frozen 0-diff(0001-0011·0004·core admission·test)·enum 미편집(불가피 시 unfreeze 명시)·신규 dep 0·비밀투표 그래프 0·가명·3-client·clip revoke-before-shred. Claude 승인 전 빌드 금지.

## 10. 범위 밖 (Northstar)
SOUL-stake 가중투표(토크노믹스 가동 후)·cryptographic operator-blind 비밀투표·정족수(클럽 확장 시)·clip redaction 파이프라인·재신청/재투표 정책 고도화.
