# SoulBound — PROJECT_STATE (설계자/감사자 인수인계)

> 이 문서는 **설계·감사 역할(Architect/Auditor)** 의 인수인계 문서입니다.
> 여러 Cowork 세션 / 채팅이 이 프로젝트를 이어받을 때, **이 파일 + repo 파일이 진실의 원천**입니다.
> 자기 기억이 아니라 여기 적힌 결정과 그 *이유*를 기준으로 판단하세요.
> 결정을 바꾸면 반드시 이 파일을 갱신하고 커밋하세요(머릿속에만 두지 말 것).

마지막 갱신: Task 4 adapters = Cowork 3라운드 감사 **PASS**, 커밋됨(4899ca8 feat + 4de4513 docs, pushed). Task 1–4 커밋 완료. **pre-Task-5 rpc/RLS smoke test = Opus 감사세션 최종 PASS**(Codex 빌드, 41 pgTAP green; 증적 docs/PRE_TASK5_SMOKE_TEST_AUDIT.md). 커밋 = JT(`test(db)`+`docs`). **Task 4.5(신뢰 role 소스, carry-forward ②) = Opus 감사세션 PASS**(0006 `current_user_role()` + adapter RPC 해석 + seed 정리 + smoke 41→49; 증적 docs/TASK4_5_AUDIT_FINDINGS.md). 커밋 = JT. **Task 5(service 배선) = Opus 감사세션 PASS**(makeCoreContainer + 실 reviewer 승인경로 live 통합테스트; 증적 docs/TASK5_AUDIT_FINDINGS.md). 커밋 = JT. **Task 5.5(seed sign-in 수정) = Opus 감사세션 PASS**(seed에 auth.identities + aud/instance_id/'' token 보강[role은 metadata에 안 넣음], 시드 유저 실 sign-in 런타임 게이트; 증적 docs/TASK5_5_AUDIT_FINDINGS.md). 커밋 = JT. **Task 6a = Opus 감사세션 PASS**(apps/web 스캐폴드 + applicant 라우트). 최초 PASS는 flaky 통합테스트로 성급(§6 교훈) → HOLD → **corrective(4fa4755: fixture-auth bounded retry, fixture 전용·route/단언 무손상, tsbuildinfo 정리)** → **JT 호스트 5/5 연속 + db reset 후 green = 결정성 확정** → 최종 PASS. audit.sh 빌드아티팩트 보정(1c243c1) 별개 유효. 증적 docs/TASK6A_AUDIT_FINDINGS.md. **Task 6b(admin/reviewer 라우트) = Opus 감사세션 PASS**(reviewer 큐/상세 read + 4전이; route 역할게이트가 service-role read의 유일 보호막, review_summary 경계 양방향; RLS 정책 미추가=service-role route, BuildPlan §5.3.2; 증적 docs/TASK6B_AUDIT_FINDINGS.md). 커밋 = JT. **Task 6(API routes) 완료**. **Task 7a(persona-clip routes + signed-upload adapter) = Opus 감사세션 PASS**(adapter `createUploadUrl`[core StoragePort frozen 유지·concrete adapter 확장]·reviewer signed-read-url·submit-attach시 retention clear corrective; INV-PC-06 누수 0 런타임검증; 호스트 5/5+reset 결정성; 증적 docs/TASK7A_AUDIT_FINDINGS.md). 커밋 = JT. **Task 7b(persona-clip-recorder 컴포넌트) = Opus 감사세션 PASS**(Codex 빌드[§6 표면 예외·안정성]; INV-PC-05 components에 supabase/createClient/service-role **0**·upload-before-onComplete[7a 잔여#2 차단]·라이브 viewfinder/녹화후 no-preview·retake; mocked 단위테스트 6개 결정성[flaky 위험 0]; 증적 docs/TASK7B_AUDIT_FINDINGS.md). 커밋 = JT. **Task 7 완료**. **§8 빌더정책 공식화(2026-06-05, JT 승인): Codex가 전 레이어 빌드, GLM/Claude Code는 빌더 은퇴 — 5개 정본(WORKFLOW/CLAUDE/AGENTS/.clinerules/PROJECT_STATE) 동기화, 개정 배너 + 스테일 GLM-배정 0 검증.** **Task 8(UI) = 8a/8b 분할(JT 승인).** 다음 **Task 8a(auth foundation + 공개/신청 UI) = Opus 감사세션 PASS**(Codex 빌드; browser anon 클라이언트 persistSession·authedFetch bearer·current_user_role 역할해석[새 라우트 0]·7b recorder bearer 배선보정·페이지 7; INV-17 service-role 0[소스+`.next` 번들 재확인]·PC-01·idempotency; 결정성 단위 29/29[내 재실행]·audit.sh PASS; 증적 docs/TASK8A_AUDIT_FINDINGS.md). 커밋 = JT. 🔴 **HIGH carry-forward: 신규 browser signup이 public.profiles 행 미생성 → submit FK 막힘**(8a 범위 밖 정당; §4 — profiles-provisioning 트리거 태스크를 8b 전에 권장). **profiles provisioning(migration 0007 트리거 + seed/fixtures upsert + 7 pgTAP[anti-escalation 포함, 49→56]) = Opus 감사세션 PASS**(**JT 호스트 5x+reset green 2026-06-08: `supabase test db` 56 + `test:integration` 5/5 ×5, flake 0 — 최종확정**; 증적 docs/PROFILES_PROVISIONING_AUDIT_FINDINGS.md). 커밋 = JT. **Task 8b(member + admin/reviewer) = Opus 감사세션 PASS**(Codex; 순수 클라이언트·새 라우트/adapters/core/db 0·보호표면 EMPTY; 권한 라우트403 위임[role-race 버그 빌더 발견+수정]·reviewSummary reviewer전용·clip 클릭재생·결정 reasonCode enum+idempotency·409 graceful; createClient/service_role/.from 0; web test 42/42 + audit.sh 내 재실행; 결정성 mocked·5x 불요; 증적 docs/TASK8B_AUDIT_FINDINGS.md). 커밋 = JT. **🎉 Task 8(UI) 완료** — signup→gate→apply→submit→(reviewer)approve→member happy-path end-to-end. **Task 9a(persona-clip byte-delete worker, CLI) = Opus 감사세션 FINAL PASS**(Codex 빌드; 1차감사 3×P1 FAIL → 보정 → PASS). unique `owner/assetId` path + DB unique index[#1] · DB-now() reap RPC 2개(list/mark, security-definer·service_role-only·DB COALESCE·원자 predicate 재검사)[#2/#3] · remove-first/no-leak/멱등/StoragePort frozen 유지. **동일-hash safeguard 통합테스트가 공유-hash인데도 protected 바이트 생존 증명**(make-or-break). **호스트 5x+reset green**(run-2서 §6 게이트가 cross-package 테스트격리 누수[web가 남긴 approved clip] 잡음 → web afterEach 정리 → 5x 재증명). pgTAP 56→73, adapters unit 22, audit.sh 내 재실행. 증적 docs/TASK9A_AUDIT_FINDINGS.md. 커밋 = JT. **🎉 P0 MVP 기능 완성**(마지막 실기능=clip 보존 worker). **Task 9b(audit/outbox 하드닝 회귀-lock) = Opus 감사세션 PASS** — 유일 갭(outbox payload ids-only)을 core 단위테스트로 lock(INV-16; **순수 additive·기존 19 무손상·skip 0**, Cowork 계약확장 인가 → **core 19→20**); 나머지 불변식은 이미 잠김(coverage-map docs/TASK9B_AUDIT_FINDINGS.md). 커밋 = JT. **✅ Task 9 완료 = P0 MVP 기능 + 하드닝 완성.** 잔여(deferred/옵션): **Task 9a-2**(internal cron route) · **Task 10**(external ledger PoC, 별도 브랜치). **RC staging 검증 완료**(docs/RC1_RELEASE_RUNBOOK.md + docs/RC1_VERIFICATION.md + docs/RC2_MIME_FALLBACK_AUDIT.md): 결정 = email-confirm ON·open signup·manual CLI reaper·자동화 deferred·CAPTCHA deferred(코드 미지원). `fafba30`에서 로컬 게이트·5x 결정성·reap 재게이트 green(2026-06-10), Vercel soulbound-staging[새 계정] + Supabase 마이그 0001–0008 no-seed 배포. **RC-1 §13 FINAL AUDIT PASS**(실 SMTP·signup→profiles·role boundary·approve/reject·member active·clip lifecycle→manual reap→object absence·INV-17/no-leak). **`v0.1.0-rc.1` 태그됨 @ fafba30.** **RC-2 후보 = `e517ec3`**(persona-clip recorder MIME fallback — Samsung/Safari MP4 경로, Chrome/webm 보존; recorder 2파일만·계약 무손상). **코드 = Opus 최종감사 PASS**(독립 적대검증 워크플로 3 lens 전부 holds·P0/P1 0; uploadMimeType 유니온 리터럴로 bare MIME만 API/Storage 도달; mutation test로 테스트 non-vacuity 증명; 증적 docs/RC2_MIME_FALLBACK_AUDIT.md). **CODE PASS + Samsung Internet 실기기 스모크 PASS → `v0.1.0-rc.2` 태그됨 @ e517ec3**(HEAD b66f090, RC-2 COMPLETE). **Safari = 후속 호환성 스모크(non-블로커)** — 미지원 시 graceful PC-01 degradation(클립 없이 제출). RC-1 §13 전체 스테이징 스모크는 FINAL AUDIT PASS이며, RC-2는 MIME fallback 델타 스모크 PASS로 `v0.1.0-rc.2 @ e517ec3` 기준 validated staging RC가 됨. 다음 단계는 internal alpha 운영이며, public/non-alpha 전에는 Task 9a-2 reaper 자동화 여부를 재평가. 거버넌스 교훈: 한 세션의 build→push→deploy 혼재를 JT가 교정 — 제품코드는 독립 최종감사 GO 후에만 commit/tag/deploy. **Pre-alpha UI/UX polish gate CLOSED @ `251c963`**(PR #1 머지·docs-only 순효과·보호표면 0·트리 clean; 3bd68f2 Opus 최종 PASS, verdict 0efd237, 추적 docs/PROGRESS.md+docs/UIUX_CHANGELOG.md). **다음 세션 시작점 = internal alpha readiness checklist**(우선순위: ① 수동 reaper 운영 루틴[일1회+결정배치 후·failed>0 대응, 자동화=9a-2 deferred] ② 알파 초대/온보딩[open signup] ③ reviewer/admin 실계정 지정+기록[§6] ④ kill switch/SMTP/Auth rate-limit/clip 보존 모니터링) — **코드변경 없이 문서/운영 절차 먼저, smoke는 필요 시에만**. 브랜치 `phase1-p0-mvp`.

추가 갱신(2026-06-17, pre-alpha UI/UX polish): **이번 한정 워크플로우 예외를 JT가 승인** — Codex가 같은 builder
세션에서 UI/UX 방향 확인 → 표면 구현 → self-check → GLM 5.2 반복정리 프롬프트 작성까지 수행하고, GLM은
Codex가 지정한 copy/spacing/label/mobile 반복작업만 수행, 같은 Codex 세션이 GLM diff를 감독/반려, 최종 제품·보안
검토는 Opus/Cowork가 수행한다. 이는 `docs/WORKFLOW.md`의 기본 "GLM 빌더 은퇴" 원칙을 바꾸는 것이 아니라,
internal alpha 전 **표면 UI/UX polish에 한정한 단발 예외**다. 구현 내용: `/member`를 Members / Chats / More
admitted shell로 재구성하고 Members 기본 화면에 My Persona / New Members / Active Members / All Members 골격을
넣음(새 member API나 mock 사람 데이터 없음); login/signup/gate/apply/status/landing copy를 짧고 한국어 중심으로
정리; `Persona Clip`은 제품 고유명으로 유지하되 주변 설명만 짧게 정리; hero/spacing/mobile shell 스타일 조정;
관련 UI 테스트 셀렉터 갱신. 보호범위: schema/migrations/SQL/RLS/RPC/API auth/storage/reaper/adapters/core/env/approval
state machine **0건 변경**. 게이트: `git diff --check`, `pnpm -F web typecheck`, `pnpm typecheck`, `pnpm -F web test`
(44/44), `pnpm build` PASS; dummy public env로 browser smoke(`/` no console errors, `/member` unauth→`/login`) 확인.

추가 갱신(2026-06-18, pre-alpha design pass + PWA): JT가 Claude/Cowork Step 1 brief와 Step 3 승인
조건(6개 보정)을 제시했고, Codex가 `docs/DESIGN_PASS_PLAN.md`를 별도 커밋으로 고정한 뒤 `ac62201`을 구현했다.
**Step 5 Final Independent Audit = PASS(acceptable for pre-alpha)** — P0/P1 0, P2/observations only. 변경 내용:
warm paper + terracotta AA ramp
토큰으로 `globals.css` 재정렬, landing door motif를 messenger phone preview로 교체(모바일에서는 읽기성 위해 숨김),
`components/ui/*` 공통 primitive(AppBar/TabBar/ListRow/Avatar/Card/Section/EmptyState/Field/Button/Badge) 추가,
`/member`를 phone-like admitted shell로 추가 polish, admin palette 정렬, applicant status에서 `reviewSummary`와
`reasonCode`가 ordinary applicant 화면에 렌더되지 않도록 잠금, PWA manifest/icons/install prompt/hand-rolled SW 추가.
SW 보안 설계: `/api/**`, Authorization-bearing, `no-store`, persona-clip, cross-origin, non-GET은 network-only/no-store
bypass; cache 대상은 public shell/static asset으로 한정하고 `components/pwa/service-worker.security.test.ts`로 증명.
Persona Clip recorder internals는 건드리지 않았고, DB/schema/RLS/RPC/API routes/auth/session/adapters/core/env/storage/
reaper/approval state machine은 변경하지 않았다. GLM 5.2 callable model은 이 Codex 도구셋에 없어서 실제 GLM 빌드는
수행하지 않았으며, 반복 표면작업은 Codex가 동일 금지선 아래 직접 처리했다(최종 보고에서 명시 필요). 검증 후보 게이트:
`pnpm -F web typecheck` PASS, `pnpm -F web test` 61/61 PASS, `pnpm build` PASS, browser smoke(`/`, `/login`
390px/1200px; dev indicator 제외) 수행. 독립감사 재검증: protected-surface diff EMPTY, SW cache boundary 보수적,
Persona Clip 시맨틱/guards 보존, status privacy test는 non-vacuous, typecheck/test/build/diff-check green. **push/deploy 전
남은 host-only runtime gate**: Android Chrome + Samsung Internet + iOS Safari real-device install smoke, Lighthouse PWA
installable pass, 9-screen visual eyeball. 후속 기록: P2 SW drift-guard test를 string-based에서 구조/행동형으로 강화,
그리고 이번 pass에 포함되지 않은 `/login`/`signup`/`gate`/`apply` 등 구 shell 페이지의 full primitive reskin은 다음
design-pass로 분리.

추가 갱신(2026-06-19, pre-alpha tone-down + warm editorial typography): ac62201(design pass + PWA) 이후
internal-alpha 전 UIUX를 "차분·라이트·앤트로픽 웜"으로 수렴시키는 표면 패스를 **Claude 설계 → Codex plan →
Claude 승인 → Codex 빌드 → Claude 최종 독립검토** 루프로 진행. 전부 surface/app-layer 한정, 보호표면
(supabase/packages/app·api/lib/.env/scripts/config/**PWA logic**/Persona Clip) 0건 변경, **새 npm 의존성 0**.
**① Tone-down(`a25deeb`) = Opus 최종 PASS**(3-lens adversarial + 게이트 재현; docs/DESIGN_PASS_ADDENDUM.md):
다크 히어로/도어/가짜폰/intro-band 제거, 과한 굵기(650–840)→400/500/600, 패널 그림자·바디 그라디언트·uppercase
제거, 헤딩≤22px, `.page-heading .eyebrow` muted 강등. 푸시+preview served-audit(배포 번들=tone-down 확정).
**② Warm typography pass = Opus 최종 PASS**(docs/DESIGN_PASS_WARMTH_ADDENDUM.md). 동기: 팔레트가 앤트로픽
정확값(#FAF9F5/#FFFFFF/#D97757/#191919, brief §1)인데도 "느낌"이 안 남. **앤트로픽 실 brand CSS 라이브 분석
워크플로**로 ground truth 확인 — 웜함은 hex가 아니라 **타이포(세리프 본문 + 산세 제목)** 가 1차 캐리어, 카드는
흰색(앤트로픽도 white-on-cream), **grain/noise 없음**. 결정: 정확 앤트로픽 hue 유지(베이스 워밍 거부),
color-scheme forced-light meta는 JT가 불필요로 드롭. (a) `9f81bf2`: Source Serif 4(prose 본문) + Geist(제목/UI)
self-host woff2 + next/font/local(**의존성 0**), 1차버튼 orange→**ink #191919**, oat #e8e6dc 세컨더리 밴드,
`.appShell`에 웜 `--elevate`(별도 토큰; cool `--shadow`는 frozen install-prompt 보존), 캔버스 워시. **세리프는
prose 전용 opt-in**(lede/intro/gate/status/notice/appbar desc; eyebrow·loading은 `:not` 제외; 데이터/라벨/뱃지/
버튼/인풋엔 0). (b) **3-lens adversarial 최종감사가 내 인라인이 놓친 P2를 포착**(`.gate-status p`의 `:not(.loading-line)`
누락 → gate 로딩문구 세리프 누출) → 1줄 수정 `c452353` → PASS. (c) JT 푸시 후 "따스함 부족" → ambient 심화
`e522b04`: `--canvas-lit` 2-radial 웜 워시(clay 0.05 + amber 0.035)를 body·`.hero`·member `.tabPanels`에 적용
(예전엔 불투명 canvas가 워시를 덮어 안 보였음). 보더는 따뜻한 taupe 유지(translucent-neutral ink는 흰 카드에서
오히려 차가워져 거부 — Cowork가 잡은 nuance). 최종 PASS + 배포본 served-audit PASS(sw.js cmp=0 · canvas-lit
clay#d977570d/amber#b9793609 · radial 2개 · `.hero` canvas-lit · 보더 taupe · 다크히어로/grain 0 · woff2 2개
200+preload) + **JT visual eyeball PASS(2026-06-19 "uiux 괜찮아진듯")**.
**결과 디자인 시스템**: 라이트웜 크림(#FAF9F5 정확 앤트로픽) · 세리프 prose / 산세 UI(self-host) · ink 1차버튼 ·
oat 세컨더리 · white 카드 · `.appShell` soft warm `--elevate` · 2-radial 웜 캔버스 워시. **거버넌스 교훈 재확인**:
빌더(Codex/GLM)≠최종승인자 유지; adversarial 워크플로가 인라인 누락 P2 포착(=full loop 가치); 정확-앤트로픽-hex
약속이 임시 워밍을 이김; ground truth(white 카드·no grain)가 추론 lens를 오버라이드.
**현재 상태**: origin `phase1-p0-mvp` = `e522b04`(푸시됨), Vercel preview(soulbound-staging) 배포+served-audit PASS,
tree clean. **🔴 production/tag/RC/alpha 전 남은 host-only 게이트(여전히 OPEN)**: Android Chrome + Samsung Internet +
iOS Safari 실기기 **설치 스모크**(홈화면 추가→standalone), **Lighthouse PWA installable**, **기능 9-screen eyeball**.
(PWA sw.js/manifest/icons는 ac62201/rc.2와 byte-identical이라 prior validity 유지하나, 이번 사이클 device-confirm은
아직 미수행.) **tag/RC/alpha 보류 유지.** **Backlog(P3, 비차단)**: install-prompt.module.css font-weight 760(frozen
PWA — PWA 차기 scope 시 ≤600 정규화); SW drift-guard 테스트 string-based→구조형 강화; login/signup/gate/apply는
globals 경유로 warmth/typography는 받았으나 `components/ui` primitive 풀 reskin은 옵션 차기 design-pass.

추가 갱신(2026-06-19, internal-alpha readiness — repo 번들 + 4-이슈 진단): warmth 사이클 종료 후 알파 운영이슈
4개를 워크플로로 진단하고 repo 번들 1개를 PASS. **repo 번들 `a9d3be3`(fix: alpha PWA theme + signup redirect)
= Opus 최종 독립검토 PASS** — 3파일만(layout.tsx viewport themeColor `#FAF9F5`→**`#D97757`**; manifest.ts +`id:"/"`
+ theme_color `#D97757`[**background_color `#FAF9F5` 크림 유지**]; lib/auth-provider.tsx signUp에 `options.emailRedirectTo:
${window.location.origin}/login` 추가, signUp 외 무변경·SSR-safe). boundary EMPTY(**새 의존성 0**·sw.js/PWA logic 무변경·
lib는 auth-provider만 인가변경), 테스트 0변경 **61/61**, 게이트 재현(typecheck/test/build/audit/diff), 배포본 served-audit
PASS(manifest `id`/theme `#D97757`/background 크림 · `<meta theme-color #D97757>` · 클라번들에 `emailRedirectTo`+
`location.origin}/login` 실재 · sw.js cmp=0 · stable alias 동일). 직전 docs 기록 `cfafa89` 포함, **푸시됨(origin 동기화).**
**4-이슈 상태:** **① 가입확인 메일 — Email confirmation: RC-1 Custom SMTP remains valid; Resend POST /emails 200
confirmed on 2026-06-19** (from "SoulBound" `<noreply@soulbound.co.kr>`, subject "Confirm your email address") = **발송 정상**
(200 = Resend 수락/발송). **실원인 = Supabase Auth URL config drift**(Site URL/Redirect 허용목록이 최신 stable alias 미반영)
**→ stable alias로 갱신해 해결.** 링크 클릭→`${alias}/login` 복귀→로그인 `/gate` = **real-device 확인 완료(2026-06-19) → ① CLOSED.**
(교훈: 초기 "Supabase 기본 이메일 default" 가설은 부정확 — `docs/RC1_VERIFICATION.md` 증거와 reconcile해 정정. 진단은
repo 코드뿐 아니라 *프로젝트 기록*과도 대조할 것.) **② 운영자 계정 — HOST/operational, pending:** no-seed 스테이징이라
reviewer/admin 지정 계정 0(신규가입=`applicant`, reviewer/admin은 seed.sql에만 있고 미실행) → 모든 `/api/admin/*` 403.
승격 UI/RPC 없음 → 대시보드 SQL `update public.profiles set role='reviewer', updated_at=now() where id=(select id from
auth.users where email='OPERATOR_EMAIL')` 후 재로그인. `reviewer`=심사큐 전체 충분, `admin`=superset(멤버십/관리까지 시).
JT가 계정 지정 + §6 기록(앱 미자동감사 `role.changed`). **③ 모바일 탭/설치 색 — SOLVED**(a9d3be3, theme-color `#D97757`;
앤트로픽은 theme-color를 *안* 써서 복사값 없음→팔레트 클레이 선택; 크림은 모바일 주소창에서 무색이라 기각). **④ 설치
"안전하지 않은 앱" 경고 — pending(문구 확인 대기):** origin-trust/Play-Protect 신호(공유 `*.vercel.app` 저평판 origin).
**Vercel auth-wall은 배제**(preview+alias 둘 다 인증 없이 200 서빙 직접 확인). **커스텀 도메인이 유일·확실 해법 아님**
(갓 산 도메인도 초기 저평판이라 동일 경고 가능; 평판은 시간/트래픽으로 누적) — 정확 fix는 *경고 문구*에 의존(Play-Protect
'무시하고 설치' 가능류 vs HTTPS류 vs 출처불명-APK류) → **JT 스크린샷 pending.** manifest `id` 추가(a9d3be3)로 PWA
정체성 안정화. **production/tag/RC/alpha 보류 유지.** 알파 전 host-pending: ② 운영자 SQL
지정, ④ 설치경고 문구 확정 후 조치, + 기존 미완 device 설치 스모크/Lighthouse/기능 9-screen. (① 메일 flow CLOSED 2026-06-19.)

추가 갱신(2026-06-19, member shell nav consolidation): **`23ce4b6`(feat: consolidate member shell navigation) =
독립 최종감사 PASS** — surface/app-layer only, 보호표면(api/auth-provider/core/adapters/supabase/PWA/lockfile) 0-diff.
SiteHeader 3-state(pathname 기반 `/member`→null·비멤버 로그아웃·anon 로그인/가입, role/membership fetch 0),
`/member` de-stack(AppBar 제거·phoneTop 단일 헤더), More=northstar 전체 그룹 스캐폴드(wired: 내멤버십 inline·입장현황→`/gate`·로그아웃·앱설치 / 준비중·심사권한=`<div aria-disabled>` 비-내비게이션·href/onClick 0·심사=role무관 "자격 획득 필요"·`/admin` 0), ListRow grid→flex 버그수정(leading-없는 행 truncation 해소·description 2-line clamp), TabBar inline SVG 아이콘 + orientation prop(horizontal 기본·vertical 미구현). Cowork 게이트 재실행: web typecheck/build/audit PASS·web test 64/64·boundary diff EMPTY. 비-블로커: 호스트 `/member` 육안 스모크(sandbox 브라우저 부재). follow-up: 데스크톱 좌측 레일(반응형, TabBar orientation 예약)·Q4 role-aware 라이브 심사 진입점(별도 brief). production/tag/RC/alpha 보류 유지. 증적 `docs/MEMBER_SHELL_NAV_BRIEF.md`.

추가 갱신(2026-06-20, profile/persona Tier A — **P0 이후 첫 northstar 기능**): `6a32dd2`(feat: add pseudonymous
persona profile) = 독립 최종감사 **FINAL PASS, pushed**(origin 동기화). 첫 real feature라 surface fast-loop이 아니라
**풀 BUILD ORDER(core+테스트 → 어댑터 → 라우트 → UI) + 풀 감사**로 진행.
- **기능**: post-admission `/member` persona 보기+편집(handle/display_name/bio). persona = **net-new 자기저작 가명
  정체성, 심사 dossier(motivation/statement/referral/clip)와 테이블·컬럼 차원 분리(⟂)** — admission이 persona를 안
  채움 → de-anon 누수 경로 구조적 0(잠긴 익명성 불변식 강화). **AI 개입 0**(파이널클럽=사람이 사람 심사; AI저작은
  진정성↓·동질화·인프라/프라이버시 비용으로 코어 역행 → JT+Cowork 합의 배제).
- 🔴 **구조적 no-photo**: `avatar_url`을 PATCH 스키마·ProfileService 입력·어댑터 write·`Persona` 타입·UI 전 경로에서
  제외(쓰는 코드 0). 클라는 이니셜/모노그램 마크만. DB grant는 avatar_url update를 허용하므로 정책 아닌 *구조*로 강제
  (DB-레벨 회수[profiles update grant에서 avatar_url 제외=migration]는 defense-in-depth follow-up).
- 🔴 **no-leak**: GET/PATCH 응답·`Persona` 타입 = `{handle,displayName,bio}`만 — role/wallet/email/membership/auth-id 0.
- **빌드**: core Profile 도메인/포트/서비스(검증 handle 3-24·alnum·displayName 40·bio 160·empty-patch VALIDATION·conflict
  409)+단위테스트 → supabase 어댑터(**user-JWT**, 23505→CONFLICT) → `/api/profile/me` GET/PATCH(**user-JWT per-request
  ProfileService**[service-role 컨테이너 미사용]·active membership gate→403·strict schema→422) → `/member` view/edit +
  하단 탭 icon-only(aria-label). 보호표면(migrations/RLS/seed/auth-provider/PWA/manifest/persona-clip/admission/apply/
  package/lock) 0-diff · 새 의존성 0 · core supabase-free.
- **보안 모델(검증됨)**: column-grant(handle/display_name/bio/avatar_url만)가 **role/membership/wallet escalation을
  DB에서 차단** + RLS own-row + schema 422.
- **검증**: Cowork 코드 인라인 전수 + host-독립 게이트 재실행(core 27 · adapters 27 · web 74 · typecheck · build · audit ·
  diff) + **host 통합 보안 게이트 = profile-routes ~11x 결정적 green**(own-only RLS cross-user 거부 · role escalation DB
  거부 · persona-only 응답 · 타유저 unchanged; 실-DB라 ~3–9s → testTimeout 15–20k 필요). 빌더(Codex)≠승인자(Cowork),
  보안 게이트 *실제 실행*(rubber-stamp 아님).
- **follow-up(하네스/ops — 기능과 별개·비차단)**: ① `vitest.integration.config.ts` `testTimeout` ~20000 상향(profile
  통합이 기본 5000ms엔 flaky, 수동 플래그로만 green) ② **기존 admin-routes 통합테스트 flake**(reviewer 테스트 60s 행
  ~1/5, auth-fixture 재시도-부하 추정 — 이번 기능 무관, §6 스위트 신뢰성 별도 조사) ③ 통합 env reviewer/admin 시드
  재현성(수동 Node 생성 → `supabase db reset`/스크립트화) ④ avatar_url DB-grant 회수(no-photo DB-레벨 방어).
- production/tag/RC/alpha 보류 유지. 증적 `docs/PROFILE_PERSONA_BRIEF.md`.

추가 갱신(2026-06-20, admin surface cleanup): `4b1f304`(feat(web): clean up admin review surface) = 독립 최종감사
**FINAL PASS, pushed**. surface/app-layer only — 보호표면(`apps/web/app/api`/`packages/core`/`packages/adapters`/`supabase`/
`auth-provider`/PWA/manifest/`package`/lockfile) **0-diff**, 새 의존성 0.
- **consistency-polish**: 큐/상세 → `components/ui` primitive(AppBar/Card/Section/Field/Button/LinkButton/Badge/EmptyState),
  member와 톤 통일. `admin.module.css`엔 table/grid/clip-video 등 admin 전용 layout만 잔류. (Card/Button/Section은 `className?`
  optional additive 보강 — 기존 시그니처 무수정.)
- **3 IA**: ① **결정 UI 3폼→1 DecisionPanel**(액션 세그먼트→reasonCode 동적, **같은 엔드포인트/payload/idempotency**;
  🔴 **옵션-스코프 = 기존 `decisionConfigs` 파생**[손수 union 0] + **비공허 옵션-SET 테스트**[approve→meets_phase1_policy /
  reject→mismatch·insufficient·duplicate / req-info→needs_identity·insufficient]로 회귀 잠금) ② **dossier-first 상세**
  (statement/motivation/referral/clip 우선, 메타/결정기록 분리) ③ **큐 트리아지**(정직한 현재-필터 count+`+`cap·UUID 축약+copy·
  status badge·quick-filter, 같은 `?status=`).
- **노트 안전구분**: applicantNotice "신청자에게 보여집니다" vs reviewSummary "내부 전용·신청자 비공개" — 라벨+시각 분리.
- **불변식 보존**: 결정 contract·reasonCode enum·idempotency(submit 시점 생성)·409·requireReviewer 403 위임·Persona Clip
  on-click signed-URL(reviewer-only)·reviewSummary 리뷰어 전용(/apply/status no-render 락 무변경)·status 렌더 게이트
  (submitted→review / under_review→panel / terminal→read-only)·**persona⟂dossier(admin에 persona 0, 가명 applicantId UUID)**.
- **검증**: Cowork 양 페이지+핵심 테스트 100% 인라인 + 게이트 재현(typecheck·**web test 75/75**·build·audit·diff·boundary EMPTY·
  persona grep 0). surface-only(boundary EMPTY)라 별도 워크플로 불요. 빌더(Codex)≠승인자(Cowork).
- **Step-3 핵심 부가가치(코드대조 확인)**: approve↔reasonCode 옵션-스코프는 *백엔드 미강제 = UI-only 가드*다
  (`reviewDecisionSchema.reasonCode = z.enum(full)`[schemas.ts:59], core `approveApplication`은 role/state만 가드·reasonCode
  값 무검증) → 통합 시 UI 파생+옵션-SET 테스트로 잠금.
- **follow-up**: ① **backend reasonCode-per-action 강제**(defense-in-depth — 옵션-스코프가 직접 API론 우회 가능, core/route, 별개)
  ② admin 계정 SQL 승격(host) ③ **통합 하네스 정리**(testTimeout config·admin-routes 통합 flake·reviewer/admin 시드 재현성 — 다음 작업).
- production/tag/RC/alpha 보류 유지. 증적 `docs/ADMIN_SURFACE_CLEANUP_BRIEF.md`.

추가 갱신(2026-06-23, integration harness cleanup): `50660c7` + `c465677` = **FINAL PASS** — web/adapters
통합 하네스 결정성 확보. seeded reviewer/password 의존 제거(**web admin/persona-clip 한정**: self-created reviewer
fixture로 교체; applicant/profile은 공통 fixture로 DRY), fixture sign-in per-attempt timeout/retry + vitest integration
`testTimeout`/`hookTimeout` 20_000, FK-aware cleanup(`c465677`: `reviewer_id`/`actor_id` null 처리 + 관련
application/membership 정리 후 auth user 삭제). **Host binding gate**: `supabase db reset` 후
`pnpm -F web test:integration`(4 suites/6 tests) + `pnpm -F @soulbound/adapters test:integration`(2 suites/4 tests)
**5회 연속 GREEN**, flake 0, cross-package persona-clip reaper 누수 0. 제품 코드/schema/seed/auth-provider/PWA/
package-lock/core/adapters-src **0-diff**. Follow-up(non-blocking): 로컬 integration env/export 루프 스크립트화,
adapters container 시드 의존 제거, backend reasonCode-per-action defense-in-depth, alpha admin SQL.

추가 갱신(2026-06-24, Operator Hardening STAGE-0a — audit hash chain): `df1f6e9`(feat(db): enforce audit hash chain)
= **Cowork Step-5 FINAL PASS**. 설계 brief `docs/OPERATOR_HARDENING_STAGE0_BRIEF.md` §2 → Codex Step-2 계획 →
Cowork Step-3 조건부 승인(C1–C7) + JT 한정 unfreeze(feature-flags `auditHashChainEnabled` 1리터럴만) → Codex Step-4 빌드
→ Cowork Step-5 독립 감사. builder≠approver 유지. **DB-side `BEFORE INSERT` 트리거(0009)가 `audit_logs.hash/previous_hash`
유일 작성자** — **adapter + `0004_rpc.sql` 6개 audit insert(approve의 tx당 2건 포함) 전부 트리거로 묶음**. canonical
단일 함수(트리거·backfill·verify 공유, UTC µs·metadata jsonb·평문 제외), genesis 64-zero sentinel + previous_hash/hash
partial unique index(fork 차단), singleton `FOR UPDATE` 직렬화, verifier는 링크 추적(tamper→false 검증). **harness
`deleteFixtureUsers`의 `audit_logs` mutation 제거 + audit-참조 user는 db reset 위임**(c465677 무손상). **경계 0-diff**:
`0003_rls.sql`·`0004_rpc.sql`·core domain/ports·package/lock. Host: supabase test db 90, web 6/6·adapters 5/5,
**SECURITY 5x+reset GREEN**. ⚠️ **범위 뉘앙스**: STAGE-0a는 **tamper-evidence 확보**이지 tamper-proof 아님 —
**full-control DB owner/service-role급 적이 체인 전체 + state row를 재계산하면 막지 못함**(앵커 없는 해시체인의 본질 한계,
brief가 scope한 "변조-증거"에 정확히 부합). 그래도 현 범위 목표(양 writer 트리거 통합 + cleanup mutation 제거 + 5x green)
**달성**. **후속 하드닝**: 외부 앵커링(head hash를 운영자가 못 고치는 외부 witness에 주기 발행) + **STAGE-0b service-role
분할**(한 키가 audit_logs와 state를 둘 다 못 쓰게). tag/RC/alpha 보류.

추가 갱신(2026-06-24, Member Directory — **P0 이후 두 번째 northstar 기능**): `cb05f68`(feat(web): add active member
directory) = **Cowork Step-5 FINAL PASS**. 설계 brief `docs/MEMBER_DIRECTORY_BRIEF.md` → Codex Step-2 계획 → Cowork
Step-3 조건부 승인(R1 silent-cap 금지·R2 honest count·R3 grep 범위) → Codex Step-4 빌드 → Cowork Step-5 독립 감사.
builder≠approver. **unfreeze 불필요**(profile 도메인 CONTRACT-FROZEN 아님, additive only; RLS/RPC·frozen 포트 0-diff).
profile/persona(6a32dd2)의 형제 — 내 persona *쓰기* → 남의 공개 persona *보기*. `GET /api/members`(+`/[handle]`) 신설,
`/member` placeholder 섹션 → 실 Members 리스트 + `/member/[handle]` 상세. **no-leak 4중**(`publicPersonaSelect=
"handle,display_name,bio"` SQL projection + 라우트 응답 `{handle,displayName,bio,isMe}` 명시 projection + 테스트
forbidden-keys/dossier-keys absent + grep 게이트), **persona⟂dossier**(dossier 필드 0), **no-photo**(avatar 미선택,
상세는 텍스트 모노그램), **active 이중방어**(라우트 401/403 + RLS `using(membership_status='active' AND
is_active_member(auth.uid()))` = row-active+viewer-active), **user-JWT**(`makeUserScopedProfileRepository`, service-role 0),
keyset 페이지네이션(handle.asc + cursor) + "더 보기"(silent-cap 0), isMe=handle 비교(id 누출 0). **경계 0-diff**:
migrations·0003·0004·frozen core 포트·admission/apply/persona-clip·auth-provider·PWA·package-lock. 신규 dep 0. **Host**:
core 31/31·adapters 27/27·web 88/88·build·audit.sh, web/adapters `test:integration` **5x+reset GREEN, flake 0**(새
`member-directory-routes.integration.test.ts` 포함). 범위 밖(후속): 대화/DM/presence(HARD RULE 9 Northstar) · 추천코드
제거 + admin raw-email 식별(anti-bias/가명-리뷰어 **불변식 의도적 완화** 기록 동반) = 별도 Round 2 surface. tag/RC/alpha 보류.

추가 갱신(2026-06-25, Anonymous Identity v2 — 급진적 익명성 신원 개편): `4392115`(feat: implement anonymous identity v2)
= **Cowork Step-5 FINAL PASS**. 설계 brief `docs/ANON_IDENTITY_BRIEF.md` → Codex Step-2 → Cowork Step-3 조건부(C1 frozen
테스트 green·C2 nullable·C3 clip orphan 0) → Codex Step-4 → Cowork Step-5 독립 감사. builder≠approver. **위협모델**: CR 대상=
국가공권력만, 운영자(JT)=max 권한("거부"가 아니라 *안 쥠*이 구조적 방어). **변경**: ① **이메일 제거 → self-chosen username 로그인**
(synthetic 내부 email `username@soulbound.internal`로 **AuthPort frozen 0-diff 보존**, unfreeze 0) ② **member-N(`soulbound-member-N`
순차)**=멤버끼리 보이는 유일 표시(승인 시 발급, 익명) ③ **persona(6a32dd2) 통째 폐기**(service/repo/route/`/api/profile/me`/상세
페이지 제거, profiles handle/display_name/bio/avatar_url dormant) — **Persona-Clip 입장 아티팩트는 보존**(0008 0-diff) ④ **디렉터리
→ member-N 명부**(persona 표시 0) ⑤ **dossier 축소**(motivation/referral UI 제거, statement+선택 clip만) + **terminal 파쇄**
(승인/거부 시 statement/motivation/referral/clip refs·hash null + clip asset reaper 예약; 결정 audit/reasonCode만 잔존) ⑥ **복구 0**
(분실=영구상실, "저장 안 해서 복구 불가" 안내) ⑦ admin은 username 봄(서버 service-role, requireReviewer 뒤), 멤버-facing엔 username/
email/uuid/persona 0. **0010_anonymous_identity.sql**(additive): username/member_number 컬럼·`grant select(member_number) to
authenticated`만(**username 미부여=no-leak**)·format check·sequence+결정적 backfill·handle_new_user/approve/reject create-or-replace
(0004/0007 **파일 0-diff**, 행위 진화). **경계 0-diff**: auth-port·0001-0009·frozen core·persona-clip storage/reaper·PWA·package-lock.
신규 dep 0. **Host**: core 20/20(31→20=persona 테스트 제거, frozen 무손상)·adapters 23/23·web 73/73·build·audit.sh, web/adapters
`test:integration` **5x+reset GREEN, flake 0**. **churn(정직)**: cb05f68 디렉터리 + 98e54ed-C admin-email을 forward-supersede(persona/
이메일 폐기로 무효화 — 빠른 방향전환이 통과작 일부 무효화, JT product 콜). **남는 한계(완전익명 아님)**: IP 로깅(Supabase auth, 검찰 IP
소환→ISP→실신원 = 최대 잔여) · username 실명선택 시 admin 가시 · clip 심사중 얼굴/음성 → IP 비로깅/Tor·clip 익명화·ICP II는 Northstar.
tag/RC/alpha 보류.

추가 갱신(2026-06-25, Member Board 게시판 — Round 3 · **메신저 Northstar 1번 벽돌**): `c696953`(feat(web): add member board)
= **Cowork Step-5 FINAL PASS**. 설계 brief `docs/MEMBER_BOARD_BRIEF.md` → Codex Step-2 → Cowork Step-3 → Step-4 → Step-5
독립 감사. builder≠approver. **JT가 HARD RULE 9를 "단일 공용 멤버 게시판"에 한해 unfreeze**(1:1 DM/inbox·realtime·presence는
계속 금지, `direct_messages`/HR7 보존, `realtimeChatEnabled` false 유지). 디씨인사이드식 async 게시판 — active 멤버가 글/댓글,
**작성자 표시 = `soulbound-member-N`(익명)**. **변경**: ① 새 라우트 `/api/board`(목록/상세/댓글)·`/api/board/[id]` author own-delete·
`/api/admin/board/*` admin hard-delete ② **새 migration 0011_board.sql**(additive): board_posts/board_comments(+content_hash·
previous_hash dormant·storage_provider/ref·deleted_at) ③ "대화"(chats) 탭 → **게시판** 탭, 더보기 "소통" 제거. **🔴 no-leak 4층**:
(a) `author_id`를 authenticated SELECT grant에서 **제외** (b) **SECURITY DEFINER projection 함수**(list/get_board_posts·comments)가
author_id 내부 join→`member_number`만 반환 (c) repository가 `.rpc()` 호출→`{memberNumber,label,isMe}` 매핑(author_id 없음)
(d) RLS active-only select·author-own insert/delete. **권한**: 모더레이션 = **admin 전용**(`actor.role==="admin"`, reviewer 거부);
author 자기글 삭제. **CR seam**(검열저항 "연결 가능성"): `BoardRepository`를 **web/app-layer local port**로(core 0-diff) — 알파
SupabaseBoardRepository plaintext, 미래 CR 어댑터(ICP/Filecoin/Arweave)=옵션 브랜치; `content_hash`(per-row 트리거, canonical
author_id/body/created_at[+post_id], sha256 = 안티-조작 seed) + storage_*/previous_hash dormant. main에 chain/탈중앙저장 SDK 0(HR9).
**경계 0-diff**: direct_messages·0001-0010·0003·0004·frozen core·auth-provider·디렉터리 라우트·PWA·package-lock. 신규 dep 0.
**Host**: core 20/20·adapters 23/23·web 75/75·build·audit.sh·supabase test db 104/104, **5x+reset GREEN**(매회 pgTAP 104/104·
web integration 8/8·adapters 5/5). 수정된 기존 pgTAP/test는 0010 username-required 트리거 적응(role-forgery 차단 단언 보존). **nit(비차단)**:
0011 board_posts/comments에 컬럼-무지정 `grant insert`가 컬럼별 grant 중복(dormant 컬럼 세팅 가능하나 content_hash는 트리거가 덮고
나머지 dormant·RLS 행게이트라 익스플로잇 0) — 다음에 `grant insert (author_id, body)`로 정리 권장. tag/RC/alpha 보류.

추가 갱신(2026-07-01, Admission Voting — 멤버가 입장을 결정): `007feba`(feat: add anonymous member admission voting)
= **Cowork Step-5 FINAL PASS, pushed**. 설계 brief `docs/ADMISSION_VOTING_BRIEF.md`(`be2abcb`) → Codex Step-2 →
Cowork Step-3 조건부(C1 `in_vote` applicant-facing 비누출·C2 system actor·C3 cast=auth.uid/short-TTL clip·C4 secret graph/frozen
delegation/host 5x) → Step-4 → Step-5 독립감사. builder≠approver. 제품 thesis: **익명 가입(username) → 신청(자기소개+Persona Clip)
→ active 멤버 비밀투표(YES>NO admit, tie/0-0 reject) → frozen approve/reject 위임 → member-N → 게시판**. 즉 SoulBound의 입장을
운영자가 아니라 멤버가 결정하는 첫 binding 메커니즘. **변경**: ① `0012_admission_voting.sql` additive(status CHECK에 DB-only `in_vote`,
single-active index 포함, `admission_votes`/turnout/ballot/clip-access tables, vote RPC/read RPC) ② 멤버 "투표" 탭 + vote routes
③ admin open/finalize/override routes/UI ④ applicant status label 매핑(`in_vote`→"검토 중"). **frozen-safe**: 0001-0011·0004·frozen
core admission/service/repo/test·auth-provider·Persona Clip storage/reaper·PWA·package-lock 0-diff; core `AdmissionStatus` enum 미편집.
**C1**: `in_vote`는 applicant-facing에 투표 substage로 새지 않고 "검토 중"으로 표시. **C2**: 고정 UUID system finalizer actor
(random password hash, 로그인 불가, `member_number=null`)로 FK 충족·member-facing 제외. **secret graph fix**: turnout은
`voter_id`만(choice 없음), ballot은 choice만(`voter_id` 없음), finalize/override 후 ballot purge; audit/events는 결정 사실+집계만,
개별 ballot 0. **finalize/override**: `in_vote→under_review` 후 frozen `approve_application_tx`/`reject_application_tx` 위임
(membership/member-N/dossier shred 인라인 0). **no-leak**: vote read RPC/routes 반환은 opaque candidate token + statement + clip flag/counts뿐;
username/applicant_id/member_number/reviewSummary/role/email/wallet 0. **clip**: open vote active member에게만 short-TTL signed URL,
finalize 후 신규 발급 0(기발급 즉시 revoke는 과대주장 안 함). **Host**: core 20/20·adapters 23/23·web 75/75·typecheck/build/audit.sh,
`supabase test db` 134/134, **5x+reset GREEN**(매회 db reset → pgTAP 134/134 → web integration 9/9 → adapters integration 5/5).
정직한 알파 flag: stake/SOUL 비용 없는 1인1표라 faction capture 비용이 낮음, 정족수 없음(default-deny tie), live turnout은 운영자 보유
(선택은 분리/purge). tag/RC/alpha 보류.

추가 갱신(2026-07-01, Interface Polish — 전체 UI 카피/탭/게이트 정리): `cb05b00`(fix(web): polish interface copy and
tab navigation) = **Cowork Step-5 FINAL PASS, pushed**. 설계 brief `docs/INTERFACE_POLISH_BRIEF.md`(`319093e`) → Codex Step-2 →
Cowork Step-3 승인 → Step-4 → Step-5 독립감사. surface-only fast loop, builder≠approver. **변경**: TabBar 3열 하드코딩 제거
(`--tab-count` 동적 컬럼) + visible label로 웹 4탭 노출 정상화(토글/웹 nav B 펜딩 종료), home/signup/login/gate/apply/status/member/admin
카피를 anonymous identity + member-N + 게시판/투표 모델에 맞게 정리, `YES/NO`→`찬성/반대`, admin override 2-step 확인, Persona Clip
recorder/install prompt 토큰/weight 정리. **게이트**: uppercase 0, CSS `font-weight` 6xx~9xx 0, `fonts.ts` weight `"400 500"`,
거짓 이메일/chat 약속 0, 신청자 `in_vote`는 "검토 중" 유지, member-facing username/email/persona/uuid 노출 0(member-N만). **경계 0-diff**:
`apps/web/app/api`·core·adapters·supabase·auth-provider·PWA/manifest·package-lock. Host-independent gate: web typecheck, web test 76/76,
workspace typecheck, build, audit.sh, diff-check PASS. tag/RC/alpha 보류.

추가 갱신(2026-07-02, Interface Polish R2 — 다음 행동 안내/흐름 매끄러움): `35c0a90`(fix(web): polish interface flow,
next-step guidance, and copy (round 2)) = **Cowork Step-5 FINAL PASS**. 설계 brief `docs/INTERFACE_POLISH_R2_BRIEF.md`(`c92e27d`)
→ Codex Step-2 계획 → Cowork Step-3 조건부 승인(보완 3건: status 재시도·gate/status EmptyState 통일·제목 마침표 스윕)
→ Step-4 빌드 → Step-5 독립감사(5관점 병렬 + 발견별 3인 반박 검증, 확정 4건 → 패치 라운드 후 표적 재감사 PASS).
**변경**: status 상태별 next-action CTA(approved→gate "입장 절차 보기", 거부/만료/철회→재신청, needs_more_info는 검토자
안내 유무로 분기), gate 현재 단계 `aria-current="step"`+CSS 카운터, 마감/재정의 투표에서 찬성/반대 버튼 숨김, 게시글/댓글
2-step 삭제("다시 눌러 삭제"), 전 표면 fetch 에러 [다시 시도] + 투표/게시판 자동 재요청 무한루프 가드(`votesError`/`boardError`)
수정, 파쇄→파기·승인 번호→멤버 번호·기록일→입장일·admin 표면 거부/거절 혼용 정리("거절 재정의"), E2EE/스테이징 셸 등
더보기 카피 순화, EmptyState 상태 패턴 통일(loading-line 폐기), TabBar 중복 aria-label 제거. **게이트**: no-leak 유지
(member-N만, 신청자 `in_vote`="검토 중", admin만 username), uppercase/신규 hex 0, font-weight 400/500 내. **경계 0-diff**:
`apps/web/app/api`·core·adapters·supabase·PWA/manifest·package-lock. web typecheck, web test 90/90(+14 신규, 비약화),
build, audit.sh, diff-check PASS. tag/RC/alpha 보류.

추가 갱신(2026-07-04, alpha 운영 결정 — JT): ① **계정 복구 없음 = 확정 정책. 비밀번호 분실 = 멤버십 상실, 운영자 개입 없음.**
가입/로그인 카피에 "분실 시 멤버십 상실" 경고를 명시하도록 강화(다음 fast 라운드에 포함). ② **Task 9a-2 reaper 자동화 = GO**
(deferred 해제, §"env schema/9a-2 변경 금지" 조항의 명시 승인 충족; 브리프 `docs/TASK9A2_REAPER_CRON_BRIEF.md`).
③ 재신청 경로 스모크 = 보류(JT). 알파 라운드 순서: **R1 = needs_more_info 재제출 경로**(full loop, core 계약
*additive* 확장 — 빌드 전 JT "unfreeze contract" 선언 필요; 브리프 `docs/ALPHA_RESUBMIT_BRIEF.md`) →
**R2 = Task 9a-2** → R3 = 투표 참여 신호 + 소품 묶음(fast). (R2 선빌드는 Cowork 계획검토서 허용 — 파일 교집합 0.)

추가 갱신(2026-07-04, Task 9a-2 reaper cron route = R2 빌드): **Cowork CODE FINAL PASS** (커밋/배포 = Codex 대기).
브리프 `docs/TASK9A2_REAPER_CRON_BRIEF.md` → Codex 계획 → Cowork 검토·보충(서버 로그라인·readWebEnv 무변경/optional
읽기 503) → Codex 빌드 → Cowork 최종감사: 4관점+발견별 3인 반박 워크플로 = **확정 결함 0 / 기각 11**(전수 검토 동의);
게이트 재실측 PASS(typecheck 3pkg·web 94/94·build[route ƒ dynamic]·audit.sh·diff-check)·INV-17 번들 grep 0
(CRON_SECRET/service_role/deletedAssetIds). 구현: 빈 secret→503·timingSafeEqual(길이차 패딩)·force-dynamic·
counts-only 응답·ids는 서버 로그만·9a reap 함수 재사용만. **배포 게이트 잔여(Codex)**: production 승격 →
CRON_SECRET 설정 → cron 등록 확인 → 수동 curl 200 → 다음 정기 실행 로그. 비차단 권고: `docs/PROGRESS.md`의
stale "9a-2 deferred/재평가" 라인을 같은 커밋에서 갱신.

추가 갱신(2026-07-05, Task 9a-2 shipping): `4962198`(feat) + `e141d61`(fix: catch 경로 서버 로그) 커밋·푸시,
HEAD==origin. **배포 게이트: 승격/CRON_SECRET/cron 등록 = PASS · 수동 트리거 = FAIL 502** — 확정 원인은 앱이 아니라
**staging Supabase 프로젝트(leyjdpoycglzvybbegrd) INACTIVE**(supabase.co NXDOMAIN, `fetch failed`). 앱/cron 배포는 정상.
잔여 조치: ① JT가 Supabase Dashboard에서 reactivate ② DNS 복구 확인 ③ Codex 재검증(`vercel crons run` 우선,
curl 필요 시 CRON_SECRET 회전 후) ④ 03:00 KST 정기 실행 로그 확인 → 완료 시 이 라운드 최종 마감.
**절차 기록: `e141d61`은 배포 진단 중 FINAL PASS 범위 밖에서 커밋됨(경미·28줄·로그만).** Cowork 사후 감사 =
**PASS**(응답 무변경·서버 로그만·비공허 테스트 +1, web 95/95·typecheck 재실측). 단, 규칙 재확인: 진단성 수정도
**커밋 전** Cowork 검토가 원칙(§7 — FINAL PASS는 "그 정확한 변경"에 대한 것; build→push 혼재는 §6 기록된 실패 모드).

추가 갱신(2026-07-06, Task 9a-2 최종 마감): **COMPLETE.** 자연 정기 실행(07-06 03:00 KST) = Vercel Observability
기준 invocation 1·**2XX**·error 0%·timeout 0%·Supabase external call 1. literal 로그 라인(`scanned=...`)은 Hobby
로그 보존기간으로 미확보 — 단 route 계약상 **200은 `failed===0`일 때만 반환**되므로 파기 실패 0은 결정적 추론
(수동 curl 200 + counts body는 별도 확보됨). 알파 파기 자동화 공식 가동: cron 일1회 03:00 KST + 수동 CLI fallback.

추가 갱신(2026-07-06, ⛔→🔓 계약 해동 선언 — JT): **"unfreeze contract (additive resubmit only)" 선언됨.**
범위 = `docs/ALPHA_RESUBMIT_BRIEF.md` §2의 additive 항목만(기존 시그니처·기존 core 테스트 20·enum·기존 RPC
바이트 무변경; 추가만 허용). **R1 최종 감사 PASS와 동시에 자동 재동결** — 이 선언은 R1 한 라운드에만 유효하며
다른 frozen 변경에 원용 금지. R1 빌드 착수 가능(Codex 계획 + Cowork 보충 4건[audit_logs 'application.resubmit'
ids-only·reviewer 필드 무변경·충돌 의미론·UI 소품] 승인 완료 상태). R3(투표 참여 신호 + 소품) 브리프 =
`docs/ALPHA_R3_VOTE_SIGNAL_BRIEF.md`. JT 지시: R1·R3 전부 진행("전부 다 하자").

추가 갱신(2026-07-06, Alpha R1 admission resubmit = **Cowork FINAL PASS** — ⛔ **계약 재동결 발효**): needs_more_info
응답 경로 완성. core additive(`resubmitApplication`+`canResubmitFrom`+port/type/`application.resubmit` 액션;
frozen `admission-service.test.ts` 바이트 무변경·삭제 라인 = import 통합 1줄) · `0013_admission_resubmit.sql`
(security definer·service_role-only·전역 idempotency 매칭 + application_id 불일치 P0001·이벤트 reason null·
audit ids-only) · resubmit route(bearer actor·applicantId strict reject·reviewSummary 제거 = /me 필드셋 동일) ·
status 페이지 보완 폼(409→키 폐기+재로드·`submitErrorMessage`·randomUUID). **감사**: 5관점 워크플로+인라인 검증
(세션한도로 패널 일부 대체) → 수정 3건(pgTAP 픽스처 분리·RPC 키-신청서 불일치 가드·409 dead-end 제거) 반영 확인.
**승인된 의미론**: same-key replay는 상태 전이 후 409(frozen submit 패턴과 동형; UI 재로드로 사용자 영향 0 —
바인딩 (d) 문구보다 좁지만 "submit 패턴 복제" 취지가 우선, carve-out 제거로 단순화). **게이트**(Cowork 독립 재실행):
db reset(0013)·pgTAP 158·integration 10/10·core 26/adapters 25/web 102·typecheck·build·audit.sh·diff-check +
빌더 호스트 5x+reset 결정성. **배포 잔여(Codex)**: 커밋(feat+docs 분리) → push → staging Supabase에 0013
`db push` → Vercel 배포 → (선택) 스테이징 재제출 스모크. **unfreeze는 이 PASS로 소멸 — core는 다시 CONTRACT-FROZEN.**

추가 갱신(2026-07-06, Alpha R3 vote signal + 소품 = **Cowork FINAL PASS**): 투표 탭 미투표 뱃지(멤버십 확인 후
기존 목록 프리페치·9+ 상한·0건 미표시·aria-hidden으로 탭 접근성 이름 "투표" 불변·`votesPrefetchedRef`로 마운트당
1회 — 토큰 리프레시 시 목록 리셋 회귀 감사에서 적발→수정) · 마감 임박 뱃지(24h) · signup 경고 카피("분실하면
멤버십을 잃게 됩니다" — 2026-07-04 정책 고지) · 중복 아이디 분기(`AuthApiError`+`user_already_exists` 구조화
판별만, 문자열 매칭 0) · recorder 인라인 스타일 → CSS module(동작/카피 무변경). **감사**: 직독 + 2관점 워크플로
+3인 반박(확정 1 저심각→수정 반영, 기각 2 동의). **게이트**(Cowork 독립 재실행): typecheck·web 109/109·build·
audit.sh·diff-check, boundary 0-diff(api/packages/supabase/PWA/lock). 프리페치 실패 처리 = 브리프 §4 원문 우선
(탭 진입 시 에러+재시도 UI). **배포 잔여(Codex)**: 커밋 → push → Vercel(프론트 전용). staging DB push(0009–0013)는
JT 귀환 시 이월 유지 — 완료 전까지 staging의 투표/게시판/재제출 표면은 DB 레벨 미가동 상태임을 유의.

추가 갱신(2026-07-07, Alpha R4 가입약관 + 동의 흐름 = **Cowork FINAL PASS**): `/terms` 정적 페이지(브리프
`docs/ALPHA_R4_TERMS_BRIEF.md` §3 전문 verbatim·prose-text 본문/산세리프 제목·metadata title) + signup 필수 동의
체크박스(명시적 htmlFor/id·required 네이티브 검증·새 탭 약관 링크·**동의값 payload 미전송**). 약관 = 구현 사실
1:1 정직 고지 10조: 복구 불가(분실=멤버십 상실)·심사 자료 파기·비밀투표·member-N 익명성+탈익명 금지·프리알파
무보증·만 14세 미만 불가. **JT 강조(2026-07-07) 반영**: "회원이 실제로 누구인지 알 수 있는 정보를 수집하지 않는
것을 원칙" — 제1조 원칙 선언 + 제2조 "복구에 쓸 정보 자체를 갖지 않습니다" + 제7조 미수집 정보 선행 구조.
("어떤 정보도 저장 안 함" 문구는 거짓 약속이라 배제 — 게시글/가명 아이디/감사 기록은 저장.) **게이트**(Cowork
독립 재실행): typecheck·web 111/111·`/terms` 정적(○) 빌드·audit.sh·diff-check·boundary 4파일 외 0-diff. 감사
1차에서 보충 미반영 2건(prose 타이포·metadata) 적발→수정 후 표적 재확인 PASS. 당시 기록: public 전 법률 검토가 과제로 남아 있었다(개인영상정보·처리방침 분리 — 브리프 §6). 처리방침은 2026-10-06 소유자 결정으로 정식본이 되었다(아래 항목). **배포 잔여(Codex)**: 커밋 → push → Vercel(프론트 전용, DB 무관).

추가 갱신(2026-10-06, PWA finish — fork 브랜치 `zcode/pwa-finish-2026-10-06`, **감사 전/미승인**): manifest
(`lang`/`dir`/`orientation`/`categories`, 아이콘 `purpose:"any"` 명시, maskable 192 추가·maskable 512 full-bleed
재생성), `/offline.html` 정적 오프라인 폴백(실패한 navigation에만), SW 업데이트 UX(대기 워커 → "새 버전이 있습니다 —
새로고침" 배너 → `SKIP_WAITING` → controllerchange 1회 reload), 설치 UX(iOS/iPadOS 안내·인앱 브라우저 안내·14일 dismiss).
**SW 릴리스/버전 규칙(신규)**: `apps/web/public/sw.js`의 `SW_RELEASE`(형식 `YYYY-MM-DD.N`)가 **유일한 캐시 버전 상수**다.
sw.js·precache 대상(`OFFLINE_URL`/`PUBLIC_SHELL_PATHS`)·아이콘/manifest를 바꾸는 릴리스마다 1회 bump. 모든 캐시 이름은
`soulbound-${SW_RELEASE}:{shell|assets}`로 파생되고 activate가 이전 `soulbound-*` 캐시(구 `soulbound-prealpha-v1` 포함)를
삭제한다. 자동 `skipWaiting` 없음 — 사용자 수락 시에만. bypass 경계(non-GET/cross-origin/Authorization/no-store/`/api`/
persona-clip/`/admin`/`/apply`/`/gate`/`/member`)는 동일, bypass 요청은 `respondWith` 미호출(단 비공개 페이지 navigation은
network-only `no-store` → 실패 시 오프라인 페이지, 캐시 저장 0). 상세·게이트: `docs/pwa/IMPLEMENTATION_NOTES.md`,
Android 경고 진단: `docs/pwa/android-install-warning.md`. 실기기 설치 스모크/Lighthouse 11 installability는 여전히 host-only.

추가 갱신(2026-10-06, iPhone 앱 — fork 브랜치 `devin/ios-expo-app-2026-10-06`, **감사 전/미승인**): `apps/mobile`(`@soulbound/mobile`, Expo SDK 57 + expo-router) 신규. Supabase는 `apps/mobile/src/auth`에서만(아이디+비밀번호 인증·세션·`current_user_role`), 세션은 `expo-secure-store`, 데이터는 웹 `/api/*`만 Bearer 토큰으로 호출. P1 인증·P2 입장 신청/현황/보완 제출·P3 멤버(명부·게시판·투표) 완료, P4 설정(계정 삭제 진입·신고/차단·개인정보/약관 링크)은 클라이언트만 — **BLOCKER**: 백엔드 계정 삭제·신고/차단 API 없음, 웹 `/privacy` 없음. Persona Clip 모바일 녹화·P5 관리자 화면 미구현. 보호 영역·툴체인 파일 변경 0. 상세는 `docs/mobile/IMPLEMENTATION_NOTES.md`.

---

추가 갱신(2026-10-06, App Store compliance backend — **감사 전/미승인**): JunTae 승인 2026-10-06: 보호 영역 개방 — 계정삭제/신고/차단
(이번 태스크 한정: `apps/web/app/api`, 새 마이그레이션 `0014_store_compliance.sql`, `packages/adapters` 추가분; core 무변경).
브랜치 `devin/store-compliance-api-2026-10-06`(PR #7, base `3eb533a` = PR #6). `DELETE /api/account`(service-role 삭제 + StoragePort 경로로
clip 바이트 삭제; prepare는 `account.deletion_requested`, auth 사용자 삭제 후에만 `complete_account_deletion`이
`account.deleted`를 hash-chain에 추가; 투표 turnout 비식별 보존), `reports`(0002 빈 legacy 테이블 교체, 본인 행만 RLS,
reviewer/admin 큐는 `list_reports_for_review`만 — `reporter_id` SELECT 없음, 중복 open 차단, DB 10건/시간 제한, 해결 시
audit enum reasonCode), `blocks`(RLS own-only, insert는 active member, board/members 서버 필터), `/admin/reports`, 모바일 배선. `/privacy`는 같은 날 정식본으로 확정(다음 항목). 상세·보존 매트릭스·프로덕션 적용 절차: docs/store-compliance/IMPLEMENTATION_NOTES.md.
독립 감사 전에는 프로덕션 마이그레이션 금지. `/privacy` 법률 검토는 2026-10-06 정식본 확정으로 더 이상 조건이 아니다.

추가 갱신(2026-10-06, 개인정보 처리방침 정식본): JunTae 2026-10-06: 법률 검토 생략하고 정식본 확정. `apps/web/app/privacy/page.tsx`는 초안 배너와 법률 검토 TODO를 제거한 정식 개인정보 처리방침이다. 시행일 2026년 10월 6일. 처리 항목·보유·파기는 코드와 마이그레이션(0014 계정 삭제 시 즉시 삭제 / 연결 해제 / audit_logs·vote turnout의 끊긴 UUID, Persona Clip reap, 승인·거절 시 신청 본문 파쇄)에 맞춘다. 연락 이메일은 `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`(비우면 `soulbound.dao@gmail.com`, `apps/web/app/privacy/contact.ts`). 소유자가 채울 항목: 법인명·사업자등록번호·주소·전화·기명 보호책임자(저장소에 없어 "SOULBOUND 운영팀"만 표기), Supabase 리전(미기재 → "제공자가 운영하는 해외 리전"), 호스팅 접속 로그 보관 기간(제공자 정책). 실이메일 수집·발송 코드가 없어 SMTP/Resend는 수탁자로 적지 않았다(가입은 `아이디@soulbound.internal`, 확인 메일이 켜져 있으면 가입이 실패). 과거 RC-1 문서의 Resend·`noreply@soulbound.co.kr`은 현재 가입 경로에서 쓰이지 않는다.

## 0. 한 줄 요약

trust-first, 입장심사 기반 비공개 메신저(SoulBound) Phase 1 MVP를, **설계를 먼저 동결(freeze)하고
빌드하는 4-actor 파이프라인**으로 만든다. 중앙화(Supabase+Vercel+Next.js)지만 검열저항/E2EE/탈중앙은
*데이터·권한 형태*로 day 1에 박아 migration-ready로 간다. 원칙: **"기능은 나중에 붙일 수 있다,
데이터·권한 형태는 못 바꾼다."**

---

## 1. 4-ACTOR 파이프라인 (역할 분리 — 절대 섞지 말 것)

> **운영 루프 정본 = `docs/WORKFLOW.md`** (2026-06-01 채택, **2026-06-05 개정**, JT 승인). **개정: Codex가
> 전 레이어(표면+보안) 빌드, GLM/Claude Code는 빌더 은퇴(미사용).** 레이어 위험도는 이제 *감사 깊이*만 좌우
> (표면=fast loop, 보안=full loop). 불변식(최종 승인자 ≠ 짠/보수한 주체)은 **Codex 빌드 → Opus/Cowork 최종**으로 보존.
> HARD RULES는 CLAUDE.md/.clinerules/AGENTS.md/이 문서 네 곳을 함께 갱신(드리프트 금지, §6).
> **2026-07-02 개정(JT 승인): 커밋/푸시/디플로이 = Codex(빌더 세션), Cowork FINAL PASS 후에만. Cowork는
> 커밋하지 않는다. 루프 = 설계(Cowork)→계획(Codex)→계획검토·보충(Cowork)→빌드(Codex)→검토(Cowork)→
> 수정(Codex)→최종검토(Cowork)→커밋/푸시/디플로이(Codex). (WORKFLOW §4/§7)**

```text
[0] Architect/Auditor  설계 동결 + 최종 의미감사   ← Cowork 한 세션 OR 채팅 (단, 하나로 고정)
[1] Builder            Codex (전 레이어, 06-05 개정)  ← 코드를 짠다 (GLM/Claude Code 은퇴)
[2] First-pass Auditor Codex                       ← read-only 기계감사 (AGENTS.md)
[3] Final Auditor      = [0]                        ← 의미적 불변식 검증, 반려 시 [1]로
[4] Ship               Codex (빌더 세션, 07-02 개정)  ← FINAL PASS 후 commit/push/deploy (was JT)
```

철칙:
- **빌더와 감사자는 다른 모델.** 자기가 짠 걸 자기가 최종승인 금지.
- **설계 판단(Architect)은 한 곳에서만.** 설계 세션이 둘이면 도면이 둘 나와 드리프트 난다.
  (이 프로젝트는 stale-아티팩트 드리프트로 여러 번 데였다 — §6 참고.)
- 빌더 목줄: `.clinerules`(Cline) / `CLAUDE.md`(Claude Code). 감사관 헌장: `AGENTS.md`(Codex).
  이 셋의 HARD RULES는 항상 동일해야 한다. 규칙 바꾸면 셋 다 + 이 문서 갱신.

### 멀티 세션 규칙 (Cowork 세션이 여러 개일 때)
- source of truth = **repo의 파일** (`docs/architecture/...FROZEN.md`, frozen `packages/core/src`, 이 문서).
- 어느 세션도 *기억*으로 계약을 재구성하지 말 것. 파일을 열어 확인.
- 설계 결정은 파일+커밋으로 남긴다. 구두/세션-로컬 결정 금지.

### 2026-06-17 UI/UX polish 예외 (이번 한정)
- 적용 범위: internal alpha 전 **표면 UI/UX polish only**. 목적은 "초기 KakaoTalk-like private messenger shell"과
  reference target(`https://pixel-perfect-clone-12870.lovable.app/members`)의 방향을 현재 앱 표면에 맞춰 축소 반영하는 것.
- 예외 워크플로우: Codex가 단일 builder 세션에서 계획·구현·self-check·GLM 5.2 반복작업 프롬프트 작성까지 맡는다.
  GLM 5.2는 Codex가 지정한 **단순 반복 표면 작업(copy 통일, spacing 반복 정리, label 통일, 모바일 보정,
  내부용어 제거)** 만 수행한다. 같은 Codex 세션이 GLM diff를 검토해 선 넘은 변경을 rollback/지적한다.
  최종 제품 방향성·보안층 불변식·RC 포함 가능성은 Opus/Cowork가 판단한다.
- 이 예외는 `docs/WORKFLOW.md`의 기본 정책(2026-06-05 이후 Codex 전 레이어 빌드, GLM/Claude Code 빌더 은퇴)을
  폐기하거나 일반화하지 않는다. 이유: 이번 작업은 DB/API/core/adapters가 동결된 **순수 UI copy/layout polish**이고,
  GLM에게 맡길 영역도 구현이 아니라 반복적인 surface cleanup으로 제한했기 때문이다.
- 금지선: schema/migrations, SQL/RLS/RPC/policies, adapters/core contracts, auth/session/security model,
  API authorization, persona-clip upload/hash/storage/deletion/reaper/retention semantics, approval/gate business logic,
  env schema, Task 9a-2 automation은 명시 승인 없이는 변경 금지.

---

## 2. 지금 상태 (어디까지 왔나)

```text
작업장 세팅      ✅ (Node24/pnpm11.1.3, repo=github.com/soulbounddao-ADMIN/soulbound private,
                    브랜치 phase1-p0-mvp, git 신원=soulbounddao-ADMIN)
0A 계약 코드     ✅ packages/core/src (동결)
0B 불변식 테스트  ✅ 19개
0C toolchain     ✅ (검증됨: typecheck CLEAN / build emit / audit PASS / engineStrict Node<24 차단 실측)
Task 1 게이트    ✅ typecheck/build/audit 통과, 19 RED 정상
Task 2 구현      ✅ admission-service.ts + membership-service.ts 바디만 구현, 19 GREEN
                    Codex 1차 + Cowork 최종 감사 통과. (커밋은 JT가 진행 중)
Task 3 (R1 GLM)  ❌ 반려. Codex 1차 + Cowork 최종 둘 다 FAIL (P0 2건/P1 4건). 산출물 폐기.
                    증적: docs/TASK3_AUDIT_FINDINGS.md, docs/TASK3_REIMPLEMENTATION_DECISION.md (커밋 910b85f)
Task 3 (R2 Codex)✅ DB레이어 재구현. Cowork 최종 감사 PASS. 커밋됨 2583f6f + 감사증적 bd052b0.
                    예외: 이 Task만 Codex가 빌더, Cowork가 감사(자기승인 금지). supabase/ 만 변경, core/docs 무손상.
Task 4 (Codex)   ✅ adapters(@soulbound/adapters). Cowork 감사 3라운드 끝 **PASS**. 커밋됨 4899ca8(feat)+4de4513(docs), pushed.
                    R1 P1(read 컬럼) → admission/membership 안전컬럼 분리로 수정. R2 P1(보안: auth role이
                    user_metadata 폴백 → 자가승격) → app_metadata 전용으로 수정, 테스트가 위조 user_metadata 무시 단언.
                    증적 docs/TASK4_AUDIT_FINDINGS.md(R1~R3).
                    이월(Task 4 비차단): ① approve composite 라이브 shape → **smoke test로 종결**(composite .application
                    +.membership 직접 단언). ② 신뢰 role 소스 → **Task 4.5로 종결**(0006 current_user_role + adapter RPC).
Pre-Task5 게이트  ✅ supabase/tests/pre_task5_rpc_rls_smoke.sql (49 pgTAP, Task 4.5에서 41→49 확장). Opus PASS —
                    R1 빌더 자가수정 P0(partial-unique 충돌), R2 Cowork findings #2(storage_path vacuous)·
                    #3(composite membership 미검증)·#4(auth.uid 양성), R3 clean. 증적 docs/PRE_TASK5_SMOKE_TEST_AUDIT.md.
                    런타임 그린(db reset/test db)은 host 전용 → JT가 커밋 시 재확인.
Task 4.5 (Codex) ✅ 신뢰 role 소스(carry-forward ②). 0006 current_user_role() security-definer + adapter가
                    app_metadata→RPC로 role 해석(claim 무신뢰, fail-closed) + seed user_metadata.role 제거 +
                    smoke 49(role 증명·anti-escalation·anon 거부). Opus 1라운드 clean PASS. 증적 docs/TASK4_5_AUDIT_FINDINGS.md.
Task 5 (Codex)   ✅ service wiring. makeCoreContainer(service-role repos + NoopLedger + featureFlags, AuthPort 분리)
                    + live-Supabase 통합테스트(실 reviewer signIn→current_user_role→canReview→approve RPC→membership,
                    applicant→FORBIDDEN). unit↔integration vitest 분리(pnpm test 스택-free 유지). Opus 1라운드 PASS.
                    증적 docs/TASK5_AUDIT_FINDINGS.md. ⚠️ seed 유저 GoTrue sign-in 불가 발견(§4) — Task 5.5서 종결.
Task 5.5 (Codex) ✅ seed sign-in 수정(auth-plumbing only). seed에 auth.identities + aud/instance_id/'' token +
                    created/updated 보강(role은 어느 metadata에도 안 넣음 → smoke 49 유지). read-only 게이트: 시드
                    admin/reviewer/applicant 실 password sign-in + current_user_role 해석 증명(재실행 안전).
                    full-flow는 throwaway 유지. Opus 1라운드 clean PASS. 증적 docs/TASK5_5_AUDIT_FINDINGS.md.
Task 6a (Codex)  ✅ apps/web 스캐폴드 + 요청인증(resolveActor: getUser 실검증 + current_user_role, claim 무신뢰,
                    fail-closed) + applicant 라우트(POST applications=submit / GET me·[id] / membership/me). 3-client:
                    읽기=user-scoped repo(RLS), 쓰기=service-role container. service-role 키 server-only(INV-17),
                    applicantId=actor(body 위조 차단), 타인 [id]→404, 무세션/invalid→401, Result→HTTP 매핑 누수 0.
                    route-handler 통합테스트(실 토큰 invoke, body주입 능동검증, 재실행) + unit 7. Opus PASS.
                    증적 docs/TASK6A_AUDIT_FINDINGS.md. +audit.sh GREP() .next/dist/node_modules 제외 보정(JT 승인).
                    create-as-submitted 확정(P0 draft 생성경로 없음 — [id]/submit 라우트 미구현).
                    [flaky→해결] 통합테스트가 fixture(createUser/signIn) AuthRetryableFetchError로 비결정적이었음
                    → corrective(4fa4755) fixture-auth bounded retry(retryable-only, fixture 전용, route/단언 무손상)
                    → JT 호스트 5/5 + reset 후 green으로 결정성 확정. route 보안로직은 처음부터 정상(원인=fixture transport).
Task 6b (Codex)  ✅ admin/reviewer 라우트(큐 list/상세 GET + review/approve/reject/request-more-info). 모든 reviewer
                    READ에 requireReviewer(applicant→403; RLS-우회 service-role read의 유일 보호막), 쓰기=service(canReview
                    재검사), actor/id=resolved actor·URL(body 위조 차단), frozen-enum zod. **review_summary 경계 양방향**
                    증명(reviewer 상세=노출 / 같은 신청서 applicant 본인 라우트=비노출). RLS 정책 미추가(BuildPlan §5.3.2 =
                    service-role route + route gate). 결정성: 호스트 5/5 + (reset 컨테이너 실패→stop/start 복구 후) 깨끗한
                    reset→smoke49→integration 4/4. 그 1회 실패는 `db reset` 인프라 실패(broken stack)였고 테스트가 fail-loud로
                    정직히 surfaced(masking 아님, non-retryable "DB error"). Opus PASS. 증적 docs/TASK6B_AUDIT_FINDINGS.md.
                    (minor cosmetic: retry 에러메시지가 non-retryable에도 "after 4 attempts" 표기 — 후속 정리.)
Task 7a (Codex)  ✅ persona-clip routes + signed-upload(보안층, mixed Task 7의 7a). adapter `createUploadUrl`
                    (draft+24h delete_after, provider-TTL 미주장, plain-fetch contract {url,PUT,headers}) +
                    clearSubmittedRetention(corrective) — **core StoragePort frozen 무수정**(concrete adapter 확장).
                    routes: POST/DELETE persona-clip(ownerId=actor, own-draft만; DELETE는 service-role+owner필터,
                    authenticated가 update grant 없어서) + reviewer persona-clip-url(requireReviewer→403, 5min read).
                    submit-with-clip → status='attached' + delete_after=null(corrective). **INV-PC-06**: storage_path·
                    signed upload/read url·token이 audit/outbox/admission_app 텍스트·clip non-path 컬럼에 **0건**(실쿼리).
                    upload→store→reviewer-read 바이트 라운드트립 + PC-01(부재 submit OK). 호스트 5/5+reset 결정성. Opus PASS.
                    증적 docs/TASK7A_AUDIT_FINDINGS.md. (잔여: ①비원자 submit+clear[502 honest·idempotent self-heal·
                    Task9 draft-scope로 무해] ②un-uploaded clip edge=7b가 upload-before-submit 보장.)
Task 7b (Codex)  ✅ persona-clip-recorder 컴포넌트(표면, §6 예외로 Codex 빌드·안정성, JT 승인). 훅
                    usePersonaClipRecorder(getUserMedia/MediaRecorder→blob→sha256→POST persona-clip→upload PUT) +
                    thin shell(라이브 viewfinder, 녹화후 미리보기/재촬영/편집 없음). **INV-PC-05**: components에
                    supabase/createClient/service-role **0**(grep+audit "no direct supabase client in components" OK).
                    **upload-before-onComplete**: onComplete가 upload 2xx 후에만(7a 잔여#2 차단) — 훅 코드+테스트 검증.
                    PC-01 skip/unavailable graceful. 6 hook 단위테스트(media/fetch/crypto 모킹·결정성, flaky 위험 0).
                    실카메라=manual-qa.md(Task8 마운트 시 JT). Opus PASS. 증적 docs/TASK7B_AUDIT_FINDINGS.md.
Task 8a (Codex)  ✅ auth foundation + 공개/신청 UI(§8 개정: Codex 전 레이어). adapters createBrowserSupabaseClient
                    (anon키·persistSession) + AuthProvider(브라우저 anon 클라이언트=auth+current_user_role만, authedFetch가
                    bearer 주입·no-session throw, 역할=신뢰 RPC) + 페이지 7(landing/login/signup/gate/apply/status +layout)
                    + 7b recorder bearer 배선보정(authedFetch 주입; route POST만 bearer, upload PUT은 plain; 6테스트 무변+1).
                    **INV-17**: service-role **0**(클라이언트 소스 + `.next` 번들 둘 다 — 내가 재확인)·createClient 0(components)
                    ·브라우저 .from/.storage 0. PC-01(skip→clip필드 생략·제출 진행, 테스트)·idempotencyKey(1회·재사용·성공시 클리어).
                    게이트=결정성 단위테스트(내 재실행 `pnpm -F web test` 29/29)+audit.sh PASS(내 재실행)+번들 grep. Opus PASS.
                    증적 docs/TASK8A_AUDIT_FINDINGS.md. 🔴 carry-forward(HIGH): 신규 signup이 profiles 행 미생성→submit FK
                    막힘(8a 범위 밖, §4 참조).
profiles provision (Codex)  ✅ Task 8a 발견#1 종결. migration 0007 handle_new_user() 트리거(after insert on auth.users
                    → profiles(id,'applicant') on conflict do nothing; role 리터럴·metadata 무시·security definer+
                    search_path=''·EXECUTE 전부 revoke[definer라 트리거 정상 발동]) + seed profiles upsert(시드 elevated
                    role 생존) + 통합fixtures 4개 insert→upsert(웹3 + adapters container[빌더 정직 scope확장, 정확·필요]) +
                    7 pgTAP(provision·defaults·**anti-escalation** forged{role:admin}→applicant·seed roles; 49→56).
                    보호표면(core/route로직/_lib/lib/UI) EMPTY. audit.sh 내 재실행 PASS. Opus PASS(JT 호스트 5x+reset
                    재현 후 최종확정). 증적 docs/PROFILES_PROVISIONING_AUDIT_FINDINGS.md.
Task 8b (Codex)  ✅ member + admin/reviewer UI(§8 Codex 전레이어). 순수 클라이언트 — 새 라우트/adapters/core/db **0**
                    (보호표면 EMPTY). 페이지 3(member·admin queue·admin detail[id]) + 기존 6b/7a 라우트를 8a authedFetch로
                    소비. **권한=라우트 403 위임**(role 안 읽음 — transient applicant role redirect 버그 빌더 발견+수정,
                    make-or-break #2 정수). reviewSummary=reviewer 상세만(non-reviewer 403→데이터0). clip=클릭 시 signed
                    url fetch→<video>. 결정폼 reasonCode enum(free-text reason 0)+idempotencyKey 매번신규·409→reload·
                    terminal read-only. createClient/service_role/.from 0. audit.sh + web test 42/42 내 재실행 PASS.
                    Opus PASS(결정성 mocked·5x 불필요). 증적 docs/TASK8B_AUDIT_FINDINGS.md. **→ Task 8(UI) 완료.**
Task 9a (Codex)  ✅ persona-clip byte-delete worker(CLI `pnpm -F @soulbound/adapters clip:reap`). 1차감사 3×P1 FAIL
                    → 보정 → FINAL PASS. **#1** unique `owner/assetId` path(createUploadUrl: randomUUID→id 삽입) + DB
                    unique index → row↔객체 1:1(공유-hash safeguard 우회 차단). **#2/#3** migration 0008 reap RPC 2개
                    (list_deletable/mark, **DB now()**·**DB COALESCE**·원자 predicate 재검사·security-definer·search_path=''
                    ·**service_role-only**) → worker 시각/stale-reason 제거. remove-first·반환{error}처리·no-leak·멱등·
                    StoragePort frozen 유지. 통합테스트: 동일-hash 2업로드→distinct path→due reap시 **protected 바이트
                    생존**(make-or-break) + 6상태/absent/멱등. unit: transient 양쪽(반환/throw)·CLI no-leak. pgTAP 56→73.
                    **호스트 5x+reset green**(run-2서 §6가 cross-package web 테스트격리 누수 잡음→web afterEach 정리→재증명).
                    보호표면(core/0004 admission RPC/web 비테스트) EMPTY. audit.sh+adapters unit 22 내 재실행. Opus FINAL
                    PASS. 증적 docs/TASK9A_AUDIT_FINDINGS.md. (잔여: 9b 하드닝 회귀·9a-2 cron route·Task10 ledger.)
Task 9b (Codex)  ✅ audit/outbox 하드닝 회귀-lock(thin·HARD RULE 10 준수). 유일 갭=outbox payload shape 미잠금(INV-13
                    테스트는 enqueue reject mock이라 payload 미검사) → core 단위테스트 1개 추가: flag-on approve의 enqueue
                    payload 키셋이 정확히 {applicationId,membershipId,userId,policyVersion}·free-text/PII/storage_path 부재
                    (application에 실 PII 실어 non-vacuous). **순수 additive(deletions 0/insertions 63)·기존 19 contract
                    무손상·skip 0** → Cowork가 additive 계약확장 인가(**core 19→20**, freeze 목적 준수·literal diff-empty만
                    트립). 나머지(idempotency·INV-13·audit 원문금지·reason enum)는 smoke pgTAP/core/7a에 이미 잠김 — 재구현
                    안 함. core test 20 내 재실행·scope 테스트파일만·audit.sh PASS. Opus PASS. 증적 docs/TASK9B_AUDIT_FINDINGS.md.
                    **→ ✅ Task 9 완료(9a+9b) = P0 MVP 기능+하드닝 완성.**
Pre-alpha UI/UX polish
                  ✅ **Opus/Cowork 최종 독립검토 PASS** (2026-06-18, candidate 3bd68f2; Codex builder + GLM 표면).
                    검증(내 재도출): 보호표면 git show EMPTY(supabase/packages/api/lib/.env/scripts/next.config/lock),
                    페이지 추가라인에 직접 supabase/createClient/service-role/raw-fetch/env **0건**, member 페이지
                    auth-guard+membership fetch+비active→/gate 보존, Persona Clip 고유명·시맨틱 무손상(recorder/adapter/route
                    미변경), 테스트 무약화(라벨/UI 셀렉터만), diff --check clean, typecheck/test 44/test/build PASS. P0/P1 0.
                    **이번 한정 workflow 예외**(§1):
                    Codex가 UI 방향 확인→구현→self-check→GLM 5.2 표면반복 프롬프트 작성까지 수행. GLM은 지정된
                    표면 반복정리만 수행했고, Codex가 diff를 검토/감독했다. 최종 판단은 Opus/Cowork가 한다.
                    변경 표면은 apps/web UI/components/tests only. **보호표면 EMPTY**: supabase migrations/SQL/RLS/RPC,
                    API routes, auth/session/security model, adapters/core contracts, env schema, storage/reaper/retention,
                    approval state machine 0건 변경.
                    구현 상세:
                    - `/member`: 기존 "멤버십 상태 확인" 화면을 admitted shell로 재구성. 하단 `멤버/대화/더보기`
                      tablist 도입, Members가 기본 탭. Members 안에 `My Persona`(기존 membership issuedAt/status만 사용),
                      `New Members`, `Active Members`, `All Members` 골격 추가. **새 member API, route rename, mock 사람
                      데이터 없음**. Chats는 조용한 empty state, More는 내 프로필/설정/알림/내 멤버십 골격만.
                    - GLM 5.2 감독 결과: `apps/web/app/member/page.tsx`에서 ordinary-user 메뉴의 `SOUL`을
                      `내 멤버십`으로 낮추고, page h1을 `멤버`로 맞추며, eyebrow 중복 brand 표기를 section label
                      `Member`로 정리했다. Codex 검토 결과 forbidden layer 변경은 없고, `PROJECT_STATE.md`의
                      More 메뉴 기록만 이 변경에 맞춰 갱신했다.
                    - public/auth/gate/apply/status: landing hero를 간단한 private messenger positioning으로 축소,
                      login/signup은 `로그인`/`가입하기` 중심으로 단순화, gate는 "현재 상태에 맞는 한 가지 다음 행동"으로
                      정리, apply submit CTA를 `입장 신청`으로 통일.
                    - ordinary-user terminology: `Persona Clip`은 제품 고유명으로 유지하고, 주변 설명만 짧게 정리.
                      내부 구현명·API field·storage/retention semantics는 변경하지 않음. status reason label의
                      `정책` 표현은 사용자용 `기준`으로 완화.
                    - visual polish: `globals.css`에서 hero 높이/타이포/spacing을 줄이고 brand seal에 talk-yellow accent
                      추가. `/member` CSS는 compact card, quiet empty state, mobile 700px 대응, tab focus/selected 상태를
                      제공.
                    - tests: label 변경에 맞춰 `apply/page.test.tsx`, `member/page.test.tsx` selector 갱신. behavior/assertion
                      core는 유지(authedFetch endpoint/body/idempotency, unauth redirect).
                    검증:
                    - `git diff --name-only`: PROJECT_STATE.md + apps/web UI/test/component 파일 12개.
                    - `git diff --check`: PASS.
                    - `pnpm -F web typecheck`: PASS.
                    - `pnpm typecheck`: PASS.
                    - `pnpm -F web test`: PASS, 44/44.
                    - `pnpm build`: PASS(core/adapters/web build).
                    - Browser smoke(dummy public env): `/` renders with no console errors; `/member` unauthenticated redirects
                      to `/login`; no Next error overlay.
```

빌드 순서(10 Task, 하나씩 / 사이마다 Codex→Cowork 감사):
```
1 monorepo+core skeleton  2 core test 19 green  3 supabase schema+RLS+rpc(DB only)
4 supabase+noop adapter   5 service 배선        6 API routes
7 Persona Clip route+recorder  8 UI pages       9 audit/outbox hardening
10 (옵션·별도 브랜치) External Ledger PoC — 체인 선택은 그때 결정
```

---

## 3. 핵심 설계 결정 + *이유* (이게 문서의 핵심 — 파일엔 결정만, 여기엔 이유가 있다)

### 3.1 Chain-neutral (Sui 탈명사화)
- **무엇:** P0는 어떤 concrete chain에도 결합하지 않는다. `LedgerPort` + `NoopLedgerAdapter`만.
  `externalLedgerEnabled=false` 고정. F5 마이그레이션 필드는 `ledger_*_ref`(체인명 없음).
- **왜:** Sui mainnet이 2026-05 stall. 특정 체인에 영혼 박으면 그 체인 죽을 때 같이 죽는다.
  추상 경계(LedgerPort)만 두면 나중에 Zcash/Aleo/Aztec 중 뭐든 꽂을 수 있다.
- **중요:** Sui를 *다른 체인 이름으로 교체한 게 아니라* 이름 자체를 들어냈다. 그래야 다음 라운드에
  자유롭게 고른다. 체인 선택(Zcash ZSA vs Aleo vs Aztec)은 **다음 라운드 Northstar 결정** — P0 아님.
  (ZSA는 ZIP 226/227이 아직 Draft라 MVP 핵심 의존성으론 위험하다고 결론.)
- audit: `packages/core/src`에 `sui` 0건, `packages/apps`에 `@mysten|aleo|aztec|zcash` 0건.
  docs의 historical mention은 예외.

### 3.2 Persona Clip (입장심사용 영상, optional)
- **무엇:** 선택 제출. 앱내 녹화 only. 업로드/미리보기/재촬영/편집/공개피드/영상메시지 전부 없음.
  부재가 submit을 막지 않는다. StoragePort 경유(절대 supabase.storage 직접호출 금지).
- **보존(중요):** terminal admission state(approved/rejected/withdrawn/expired) 도달 **즉시 raw media 삭제**.
  draft 24h 미제출도 삭제. 영구보존 금지. `persona_clip_hash`(해시)만 남고 raw는 안 남는다.
  - **왜:** "안 가진 건 유출·제출당할 수 없다" = data minimization / 검열저항 Northstar 정합.
  - rpc는 `delete_after`+`deletion_reason` *마킹만*. 실제 Storage 삭제 worker는 Task 9.
- **storage_path 경계(INV-PC-06):** `persona_clip_assets`/StoragePort 안에서만. audit_logs/outbox/log/
  analytics/reviewer-notes엔 `persona_clip_asset_id`/`content_hash`/`status`/`deletion_reason`/
  `deleted_at`/`policy_version`만. signed URL/token/raw bytes/base64/transcript/screenshot/요약 전부 금지.

### 3.3 Admission Underwriting / Activation SOUL (캐논만, 경제로직 미구현)
- 후보자는 SOUL 없이 맨손 신청(입장권 구매 아님). 기존 고신뢰 멤버가 stake-backed review.
  승인자는 Review Toll 재원에서 Activation SOUL 받아 즉시 DefaultStakedSoul로 lock.
- Activation SOUL ≠ 보상/에어드랍/수익/양도토큰. 신규발행 없음.
- **P0:** schema/interface/policy로만. 실제 Review Toll 계산/Bond lock/지급/slash는 **구현 안 함**.
  `LedgerPort.issueActivationStake`(구 `grantSoul`에서 개명 — 보상 어감 제거)는 인터페이스만, 구현은 Noop.

### 3.4 에러 모델 (HYBRID)
- 예상된 도메인 실패 → `Result<T, AppError>` (코드: VALIDATION/FORBIDDEN/NOT_FOUND/
  INVALID_STATE_TRANSITION/CONFLICT/DEPENDENCY_FAILURE → 422/403/404/409/409/502).
- 진짜 버그 → throw.

### 3.5 상태전이 = 단일 원자 rpc
- approve/reject/requestMoreInfo는 Postgres rpc 하나(`*Tx`)가 admission_events + audit_logs를
  **한 트랜잭션 안에서** 기록. 서비스가 별도 호출로 나눠 쓰지 않는다. (INV-05/06/18)
- reason은 enum(`AdmissionReasonCode`)만 audit/event로 흐른다. free-text 금지. (INV-22)

### 3.6 AdmissionStatus / ReasonCode (v1.3 최종)
- status: draft|submitted|under_review|needs_more_info|approved|rejected|withdrawn|**expired**
- reason: meets_phase1_policy|insufficient_context|mismatch_with_policy|needs_identity_clarification|
  duplicate_identity_suspected|**applicant_withdrew**|**application_expired**
  (뒤 2개는 withdraw route / expire worker용 — status만 추가하고 reason 빠뜨리면 INV-22 깨짐)

### 3.7 보안 경계 (RLS 3-client)
- browser=anon / server=user-JWT / server-only=service-role. service-role은 절대 `NEXT_PUBLIC_` 금지(INV-17).
- audit_logs/outbox_events엔 client policy 0 (service-role만, RLS가 모두 deny) (INV-10).
- React 컴포넌트가 Supabase 직접 호출 금지. component→hook→route→service→repo→adapter.
- direct_messages는 ciphertext-only. plaintext/key 컬럼 영구 금지(INV-04/19).
- rpc: security definer + `set search_path=''` + anon/authenticated/public EXECUTE REVOKE.
  함수 안에 COMMIT/ROLLBACK 0건(이미 한 트랜잭션; 되돌릴 땐 raise exception). (INV-23)

---

## 4. 미결 항목 (잊으면 안 됨 — 기록 안 하면 사라진다)

- **✅ [완료 — Task 5 직전 필수 게이트] 재현가능한 rpc/RLS smoke test.** `supabase/tests/pre_task5_rpc_rls_smoke.sql`
  (41 pgTAP, Codex 빌드, Opus 감사세션 최종 PASS). R1 교훈(`db reset` 통과는 함정 — plpgsql 오류는 *호출 시* 터짐)을
  닫음: 실제 `authenticated` 세션 RLS·컬럼거부 + RPC 런타임 흐름 + approve composite 양쪽(.application/.membership) +
  idempotency 무중복 + P0001/P0002 + content-minimization + persona clip terminal 마킹을 *호출 시점*에 단언.
  커밋 = JT(`test(db)`). 증적 docs/PRE_TASK5_SMOKE_TEST_AUDIT.md.
- **✅ [완료 — carry-forward ②, Task 4.5] 신뢰 role 소스.** `supabase/migrations/0006_role_source.sql`의
  security-definer `current_user_role()`(profiles.role를 auth.uid 키로 서버사이드 해석). adapter가 JWT
  claim(user_metadata/app_metadata) 대신 이 RPC로 role 해석(fail-closed to applicant), seed에서
  user_metadata.role 제거(profiles.role 단일 진실원). smoke 49 pgTAP가 실 `authenticated` 세션서 admin/
  reviewer/applicant role 증명 + anti-escalation(위조 claim 무시) + anon 거부. Opus 1라운드 clean PASS.
  증적 docs/TASK4_5_AUDIT_FINDINGS.md. (escalation-proof: applicant는 profiles.role 못 씀 — 42501 증명됨.)
- **✅ [완료 — Task 5.5] seed auth.users GoTrue password sign-in 수정됨.** Task 5 통합테스트가 발견(빌더 정직
  보고 → Opus 검증), Task 5.5서 종결. 진단(실측): 시드 유저가 `auth.identities` 행 부재 + `aud`/`instance_id`/
  NULL token 컬럼 결여로 GoTrue 로그인 불가였음(admin-API 유저만 로그인). 수정: `supabase/seed.sql`에
  `auth.identities`(provider=email, identity_data {sub,email}) + `aud`/`instance_id`/`''` token + created/updated
  보강 — **role은 어느 metadata에도 안 넣음**(Task 4.5 불변식 + smoke 49 "claim에 role 없음" 유지). 게이트:
  read-only 통합테스트가 시드 admin/reviewer/applicant **실 password sign-in + current_user_role 해석**을 런타임
  증명(재실행 안전); full-flow 테스트는 throwaway 유지. Opus 1라운드 clean PASS. 증적 docs/TASK5_5_AUDIT_FINDINGS.md.
- ✅ **[완료 — profiles provisioning task, Task 8a 발견#1 종결] 신규 signup profiles 자동 provision.** 종결:
  migration 0007 `handle_new_user()`(role 리터럴 applicant·metadata 무시·`security definer`+`search_path=''`·EXECUTE
  전부 revoke) + `after insert on auth.users` 트리거 + seed/통합fixtures(웹3+adapters) upsert + 7 pgTAP
  (anti-escalation forged{role:admin}→applicant + seed regression 포함, 49→56). Opus PASS(JT 호스트 5x+reset 재현 후
  최종). 증적 docs/PROFILES_PROVISIONING_AUDIT_FINDINGS.md. (이하 원래 발견 기록:)
- 🔴 **[원기록 — Task 8a서 발견] 신규 signup profiles 자동 provision 부재.**
  `admission_applications.applicant_id NOT NULL → profiles(id)`, profiles→`auth.users(id)`, 그러나 `on auth.users`
  트리거 없음(grep 0). 브라우저 `signUp`은 auth.users 행만 만들고 profiles 행 미생성 → `submitApplication` FK 위반.
  시드 유저(`*@soulbound.local`)는 profiles 보유라 빌더 수동테스트가 갭을 가림. **신규 applicant happy-path 차단.**
  → 전용 보안태스크(Codex): security-definer `handle_new_user()` + `after insert on auth.users` 트리거
  (→`public.profiles(id, role='applicant')`) 마이그레이션 + pgTAP(신규 auth user → applicant profile 단언). 8a는
  supabase/·신규라우트 금지라 정당히 미수정. 증적 docs/TASK8A_AUDIT_FINDINGS.md #1.
- ✅ **[완료 — ac62201] Task 8a 잔여 status reasonCode dormant 분기 제거.** applicant status는
  `applicantNotice`만 표시하고, `reviewSummary`/`reasonCode`는 ordinary applicant 화면에 렌더하지 않는다.
  새 `app/apply/status/page.test.tsx`가 mock payload에 `reviewSummary`와 `reasonCode`를 넣고도 미렌더를 단언해
  미래 API 변경 시 내부 분류 우발노출을 막는다.
- **[P2 follow-up — design pass] SW drift-guard test 강화.** (2026-10-06 PWA finish 브랜치: `components/pwa/sw-behavior.test.ts`가
  shipped `public/sw.js`를 vm에서 실제 이벤트로 구동하는 행동형 테스트 추가 — 감사 PASS 후 완료 처리.) 현재 `components/pwa/service-worker.security.test.ts`는
  helper 동작 테스트 + `public/sw.js` 문자열 동기화(`toContain`)로 shipped SW를 감시한다. `ac62201` 현재 코드는
  `shouldBypassCache()`가 fetch handler 맨 앞에서 실행되어 `/api/**`, Authorization, no-store, persona-clip,
  cross-origin, non-GET을 network-only/no-store로 배제하므로 안전하다. 다만 미래 리팩터가 문자열은 남긴 채
  `cache.put` 순서를 앞당기는 drift를 막으려면 SW fetch handler를 실제/준실제 Request로 평가하는 구조/행동형
  테스트로 강화할 것.
- **[UX follow-up — partial scope] full primitive reskin 잔여.** `ac62201`은 core primitives, PWA, landing,
  `/member`, `/apply/status`, admin palette를 우선 정리했다. `/login`, `/signup`, `/gate`, `/apply` 등은 새 토큰은
  적용되지만 아직 모든 구조가 `components/ui/*` primitive 기반으로 재작성된 것은 아니다. pre-alpha 후속 design pass에서
  같은 금지선(DB/API/auth/storage/Persona Clip semantics 무변경) 아래 반복 적용.
- **[Task 10-1] outbox vs ledger 직접호출 책임 분리.** 현재 approve 후처리가 `outbox.enqueue` +
  `ledger.issueMembershipCredential`를 *둘 다* 직접 실행(INV-13 테스트가 그렇게 강제). P0는
  `externalLedgerEnabled=false`라 안 돌지만, Task 10에서 outbox processor가 `external_ledger`
  이벤트를 처리하면 **중복 발급** 위험. → Task 10 전에 "서비스는 enqueue만, ledger 호출은
  processor/adapter에서 1회"로 단일화 결정. INV-13(실패내성)은 유지. (Codex P2 finding, Cowork 동의.)
- **[다음 라운드] privacy ledger 선택** (Zcash ZSA / Aleo / Aztec) + **ICP 앱체인 전환** — Northstar,
  P0 계약 아님. LedgerPort 추상 경계가 이미 이걸 수용함.
- **[다음 라운드] SOUL/BOUND 토크노믹스 후보설계** = `docs/FUTURE_tokenomics_design_notes.md` 참조
  (✅ 전액준비 수량-peg escrow로서 경제 건전 · 리스크=구현/커스터디/권한 · net-new Layer 3 ·
  §3.3 서명 unfreeze+법무/커스터디 선행 · ICP 결정 선행 · alpha 검증 후). BOUND v1.1 = HYPE식 staking 보상,
  100M 캡·12M emission·10년 half-life·100% feature-fee burn+60% buyback-burn·ICP reserve 분리·Howey 법무 게이트.
  적대검토 commit-pin `4d7f99e`.
- **[다음 라운드] 검열저항 / 운영자 데이터-최소화 (단일-ICP)** = `docs/FUTURE_censorship_resistance_icp.md` 참조
  (dormant Northstar · option-branch only · 목표=영장 시 운영자 빈손+운영안정성 · 체인 grab-bag 전부 skip, 단일-ICP 확정 ·
  🔴 critical: canister controller 키를 threshold/blackhole 안 하면 전향적 강압에 오늘보다 약함 · 도달성/메타그래프/규제는 못 삼).
- **[지금 가능 · SECURITY full 루프] Operator Hardening STAGE-0** = `docs/OPERATOR_HARDENING_STAGE0_BRIEF.md` 참조
  (체인 무관·main 위 · 0a audit hash chain 강제(설계된 미배선 완성) + 0b service-role 슈퍼키 구획화 ·
  ⚠️ frozen 0003 RLS·audit 서비스 건드림 → JT GO + unfreeze 필요 · 0a 먼저 권장).

---

## 5. 감사 체크리스트 (Cowork 최종 감사 시 — 의미 불변식)

Task별로 Codex 1차(AGENTS.md, 기계검사) 통과 후, 설계세션이 코드를 *읽고* 확인:
- INV-11 가드 순서: role(FORBIDDEN)→load(NOT_FOUND)→state(INVALID_STATE_TRANSITION)→원자 *Tx→side effect
- INV-12 cross-tenant: 남의 application/clip 못 읽음
- INV-13 실패내성: outbox/ledger 실패가 커밋된 승인을 롤백 안 함 (try/catch, flag 안에서만)
- INV-16 audit/outbox에 원문/raw payload/storage_path 0건 (코드/ids/refs만)
- INV-18 원자성: 상태전이+event+audit가 한 트랜잭션
- INV-22 reason enum only
- INV-PC-09 clip 보존: terminal 즉시 마킹삭제 + worker(Task9)
- frozen 무수정: `git diff --stat packages/core/src` 가 해당 Task에서 바뀌면 안 되는 것 안 바뀜
- tests-not-weakened: `*.test.ts` diff 없음, `.skip/.todo/.only` 0건

---

## 6. 반복된 실패 모드 (같은 실수 반복 금지)

- **게이트 비결정성 — audit.sh가 빌드 아티팩트를 grep (Task 6a):** apps/web 도입 후 `bash scripts/audit.sh`가
  머신마다 다르게 동작 — `rg` 있으면 .gitignore 존중해 PASS, 없으면 `grep -rEn`가 gitignore된 `apps/web/.next`
  (번들된 supabase-js)까지 훑어 `supabase.storage` **false-FAIL**. 빌더는 rg로 PASS·감사자는 rg 없이 FAIL → 발견.
  → `GREP()`에서 `.next/dist/node_modules` 제외(rg glob + grep `--exclude-dir`)로 결정적화. 교훈: 정적 게이트는
  **소스만** 스캔하고 빌드/deps 출력을 배제해야 한다(안 그러면 false-FAIL이 진짜 위반을 가리는 습관을 만든다).
  JT 승인 하 frozen audit.sh 보정.
- **flaky 런타임 게이트를 'passed twice'로 통과 (Task 6a):** web 통합테스트가 빌더 환경 + 호스트 1회 PASS → Opus가
  PASS 판정. 그러나 fixture(`createUser`/`signInWithPassword`)가 비결정적(`AuthRetryableFetchError`)이라 반복 실행/
  `db reset` 후 계속 실패. (b)게이트의 존재이유 = *신뢰성 있는* 런타임 증명인데 1~2회 통과는 결정성 증거가 아니다.
  → 교훈: **호스트 전용 런타임 게이트는 "passed N times" 보고가 아니라 *연속 다회 + reset 후* 재현된 green을 봐야 PASS.**
  fixture 불안정은 bounded retry/유니크화/정리로 닫되, assertion·route 호출은 결정적으로 유지(retry로 가리지 말 것).
- **시드 데이터 수동 QA가 신규-유저 provisioning 갭을 가린다 (Task 8a):** 빌더가 시드 applicant로 login→gate→apply
  수동확인=통과. 그러나 시드 유저는 `seed.sql`이 profiles 행을 미리 박음. 실제 브라우저 `signUp`은 profiles 트리거
  부재로 행을 안 만들어 submit이 FK에서 막힘(§4 HIGH). → 교훈: **수동/통합 QA의 happy-path는 시드 픽스처가 아니라
  *제품이 실제로 만드는* 신규 엔티티로 최소 1회 통과시켜라**(provisioning/트리거/기본값 누락은 시드가 항상 가린다).
- **결정성 5x가 cross-package 테스트격리 누수를 잡았다 (Task 9a):** clip reap의 동일-hash 테스트가 `scanned:1`(전역
  카운트) 단언인데, **다른 패키지(web) 통합테스트가 같은 로컬 DB에 남긴 due clip**(approved/policy_cleanup 2건)을
  reap이 주워 run-2서 `scanned:3` FAIL. run-1 단일통과만 봤으면 **거짓 PASS**. → 교훈: **공유 DB 위 통합테스트는
  서로 격리(각자 afterEach 정리)해야 하고, 전역 상태에 의존하는 단언은 5x+reset로만 신뢰**(§6 5x 고집의 정당성 재확인).
  보정: web 테스트 afterEach가 fixture clip 행/객체/참조 정리; reap의 강한 단언은 canary로 유지.
- **stale 아티팩트 드리프트:** 산출물 여러 버전이 떠다녀 옛 버전을 받아 작업 → 여러 번 사고.
  → 대응: 단일 번들 + `MANIFEST.txt`(version assertion + grep + sha256). 받으면 MANIFEST부터 확인.
- **"했다고 말한 것" ≠ "실제 파일":** 보고는 v1.3인데 zip 안은 v1.2였던 적 다수.
  → 대응: 항상 grep/typecheck로 working tree를 실측하고 주장. shipped tar 내부를 풀어서 재확인.
- **git 신원 사고:** 샌드박스 git이 host 전역신원을 못 봐서 잘못된 local 신원(JT/justice.parkit)을
  박을 뻔. → repo 신원은 soulbounddao-ADMIN <soulbound.dao@gmail.com>로 고정. 커밋 author 확인 습관.
- **샌드박스 .git 락:** Cowork 샌드박스가 `.git/*.lock`을 못 지워 커밋 실패 → commit/push는 **호스트
  터미널**에서. 락 걸리면 `rm -f .git/index.lock .git/HEAD.lock`.
- **빌더 폭주(GLM):** 컴포넌트서 Supabase 직접호출 / service 우회 / UI부터 / overbuild.
  → HARD RULES 1·2·3 + BUILD ORDER가 항상 이김. 가드레일 상·하단 중복 명시.
- **`db reset` 통과 함정 + GLM의 DB/RLS 한계 (Task 3 R1):** GLM의 Task 3가 mechanical 게이트(db reset/
  typecheck/test/audit)는 다 통과했는데 의미가 깨져 있었다 — rpc가 없는 컬럼(audit_logs.idempotency_key)에
  insert, frozen enum 밖 reason code, RLS로 컬럼 못 숨김(review_summary 노출 + role 자가승격 가능), approve
  from_status 오기록, prompt doc 손상. plpgsql 오류는 *호출 시* 터지므로 apply-only 검증은 불충분.
  → 대응: (a) DB/RLS/rpc 같은 보안경계 고정밀 작업은 **Task 3 한정 Codex 빌더 예외**(자기승인 금지, Cowork 감사).
  (b) 감사는 apply뿐 아니라 실제 rpc 호출 + RLS 역할 단언까지. (c) 재현가능 smoke test 커밋(§4 권고).
  R2(Codex 재구현)는 6건 전부 수정 + Cowork PASS. 증적: docs/TASK3_AUDIT_FINDINGS.md "Round 2".

---

## 7. 환경/사실 메모

- Node 24, pnpm 11.1.3(`packageManager` 핀), corepack이 폴더 안에서 자동으로 핀 버전 사용.
- pnpm 11: 설정은 `pnpm-workspace.yaml`(`.npmrc` 아님). engineStrict/minimumReleaseAge:1440/
  blockExoticSubdeps:true/onlyBuiltDependencies:[esbuild].
- Supabase 로컬 = Docker. `supabase db reset`은 **로컬 Docker만** 초기화(클라우드 아님).
  클라우드는 배포 시점에 `supabase link`+`db push`로 한 번만(지금 미리 연결 안 함 — 실험단계엔 위험).
- 빌더는 Cline 또는 Claude Code+GLM. Claude Code는 `.clinerules` 안 읽고 `CLAUDE.md` 읽음(미러됨).
```
