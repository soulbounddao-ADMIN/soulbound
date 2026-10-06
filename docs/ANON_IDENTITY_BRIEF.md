# Anonymous Identity v2 — self-chosen 로그인 + member-N + persona 폐기 + dossier 최소화 — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **급진적 익명성 신원 개편.** 신원 토대라 게시판(Round 3)보다 먼저. 위협모델: CR 대상=국가만, 운영자(JT)=max 권한.
> **⚠️ 이번 세션 산출물 갈아엎음**: persona(6a32dd2) 폐기 · 디렉터리(cb05f68) → member-N 명부로 개편.

## 0. 확정 모델 (JT 2026-06-25)
- **로그인 ID = 본인 설정 username** + 비번. **실 이메일 0**(synthetic `username@soulbound.internal`, AuthPort 0-diff). username 유일.
- **member-N = `soulbound-member-N`(순차)** = **멤버끼리 보이는 유일 표시 신원**(익명). **승인 시 발급**(N번째 승인 멤버). 신청자(pending)는 없음.
- **admin은 로그인 username을 봄**(운영자 식별). **멤버끼리는 member-N으로 익명.**
- **persona 통째 폐기** — handle/display_name/bio **없음**. 멤버 정체성 = member-N 그뿐.
- **dossier = 자기소개(statement) + 동영상(clip, 선택)** 만. 지원동기(motivation)·추천코드(referral) **제거**.
- **dossier 즉시 파쇄**: 승인/거부(terminal) 시 dossier 내용 **즉시 파쇄**(INV-PC-09를 statement까지 확장). 결정기록(audit/reasonCode)만 남음.
- **복구 없음**. 안내: "비번 분실 시 복구 불가 — 어떤 정보도 저장 안 하기 때문."

## 1. Hard boundary + 폐기/frozen 처리
- **AuthPort core = FROZEN·0-diff** (synthetic email로 시그니처 보존, unfreeze 불필요).
- **persona 폐기**: `DefaultProfileService`/persona repo 메서드(getMyPersona/updateMyPersona)/persona UI(멤버 셸 view·edit)/`/api/profile/me` **제거**. `profiles.handle/display_name/bio/avatar_url`는 **사용 중단(dormant)** — 컬럼 drop은 frozen 0001이라 안 함(미사용 잔존). username은 `profiles.username`에 저장하고, 인증용 synthetic email은 내부 식별자로만 쓴다.
- **member-N**: `profiles.member_number`(additive 신규 migration, 0001 무변경) 또는 sequence — 승인 시 할당. Codex 제안.
- **디렉터리(cb05f68) 개편**: persona 표시 → **member-N 명부**. read 엔드포인트·active-RLS·no-leak 배관 재활용.
- **FROZEN 0-diff**: `packages/core` frozen 마커(AuthPort 포함)·기존 migration(새 additive 제외)·persona-clip recorder/storage/reaper(파쇄 확장은 정책)·PWA·lock. 신규 dep 0.

## 2. Auth (self-chosen username · no email · no recovery)
- **가입**: username(본인설정, 유일) + 비번 → synthetic email `username@soulbound.internal` → signUp(AuthPort 0-diff) → applicant. **이메일 필드 0.** email-confirmation **off**(host). **member-N은 가입 때 아님, 승인 때 발급.**
- **안내(가입)**: "username·비번을 저장하세요. **복구 없음** — 어떤 정보도 저장하지 않기에 비번 분실 시 복구 불가."
- **로그인**: username + 비번 → synthetic email 구성 → signIn.
- 복구 경로(forgot-password 등) **0**.

## 3. 입장(admission) 흐름 + dossier 최소화·파쇄
- 흐름: 가입(username+비번) → gate → **apply(자기소개 + 동영상 선택)** → admin 심사(승인/거절/추가정보, reasonCode) → 승인 시 **member-N 발급**·active 멤버.
- **dossier 축소**: `apply`에서 **motivation 필드 제거**(referral 이미 제거 대상). 남는 것 = `applicant_statement` + persona clip(선택). (`admission_applications.motivation`/`referral_code` 컬럼은 frozen이라 dormant 잔존, UI/제출에서만 제거.)
- **🔴 dossier 파쇄(terminal)**: 승인 또는 거부 시 dossier *내용*(statement 텍스트 + clip) **즉시 파쇄·미보존**. clip은 기존 reaper(INV-PC-09); **statement도 같은 정책으로 확장**(terminal 시 null/삭제). 결정 audit(reasonCode/member-N)만 남음.
- **안내(apply)**: "제출 정보는 **심사 동안만 보관**, 승인/거부 **즉시 파쇄**, 이후 미보존."

## 4. 디렉터리 → member-N 명부
- cb05f68 디렉터리를 **active 멤버의 member-N 목록**으로(persona 제거). 행 = `soulbound-member-N`(+ 가입/승인 시점 같은 비식별 메타 선택). **persona handle/display_name/bio 표시 0.** 사진 0.
- 배관 재활용: active-멤버 read + RLS active-public + no-leak(email/role/username/uuid 0 — member-N만).
- (대안: 디렉터리 자체 폐기 — JT 확인 시.)

## 5. 불변식 (반드시)
1. **실 이메일 0** — 어디에도 수집/저장 0. auth.users.email = synthetic만.
2. **AuthPort/core 0-diff** (synthetic email).
3. **멤버끼리 member-N 익명** — 멤버-facing 응답/UI에 username/실신원/role/uuid/persona 0, **member-N만**.
4. **admin만 username 봄** — 멤버-facing 아닌 admin 경로 한정.
5. **dossier terminal 파쇄** — 승인/거부 시 statement+clip 내용 파쇄, 결정기록만.
6. **복구 0** · **persona 0** · **3-client** 유지.

## 6. ⚠️ 정직한 한계 — 완전 익명 아님
남는 비익명화(이 라운드 밖, Northstar): **IP 로깅(Supabase auth)** — 검찰 IP 소환→ISP→실신원(*최대 잔여*) · username을 유저가 실명으로 고르면 admin이 봄(유저 선택) · clip(심사 중 얼굴/음성). → 이메일 제거·persona 폐기는 큰 걸음이나 "완전 익명" 아님.

## 7. Acceptance gates (Claude 최종 감사)
- `pnpm -r typecheck` · `pnpm -F web test`(비약화) · `pnpm -F @soulbound/core test`(AuthPort 0-diff) · `pnpm -F @soulbound/adapters test` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **boundary**: AuthPort/core frozen 0-diff · 기존 migration 0-diff(member_number는 additive 신규) · persona-clip recorder/storage 0-diff · PWA/lock 0-diff · 신규 dep 0.
- **🔴 grep/테스트**: 가입/로그인 실 이메일 입력 0 · 멤버-facing에 username/persona/email/uuid 0(member-N만) · dossier terminal 파쇄(승인/거부 후 statement/clip 내용 null/삭제, 결정 audit 잔존) · 복구 경로 0 · motivation/referral UI 0.
- **host**: 가입(username→세션)·로그인·승인 시 member-N 발급·dossier 파쇄·디렉터리 member-N 표시 — 통합. DB-touch라 결정성 확인.

## 8. Handoff to Codex (Step 2) — 계획만
member-ID(username 본인설정·유일·synthetic email·AuthPort 0-diff) · member-N(순차·승인 시 발급·저장위치) · 가입/로그인 UI(이메일 제거, no-recovery 안내) · email-confirmation off 전제 · **persona 폐기**(service/repo/UI/route 제거, 컬럼 dormant) · **디렉터리 member-N 개편** · **dossier 축소(motivation 제거)+terminal 파쇄(statement 확장)** + apply 파쇄 안내 · 테스트. **명시 확인**: AuthPort/frozen core surfaces 0-diff, non-frozen profile/persona core 제거 · 기존 migration 0-diff(신규 additive migration만) · 신규 dep 0 · 실 이메일 0 · 멤버-facing member-N만 · dossier 파쇄 · 복구 0 · 3-client. Claude 승인 전 빌드 금지.

## 9. 범위 밖 (Northstar)
IP 비로깅/Tor · clip 익명화 · ICP Internet Identity · 게시판(Round 3, attribution=member-N) · 1:1 DM.
