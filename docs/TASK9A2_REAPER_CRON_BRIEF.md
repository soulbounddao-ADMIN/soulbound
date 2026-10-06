# Alpha R2 — Task 9a-2: Persona-Clip Reaper 자동화 (internal cron route) — Design Brief (Cowork)

> **Step 1 of the loop** (설계 Cowork → 계획 Codex → 계획검토·보충 Cowork → 빌드 Codex → 검토 Cowork → 수정 Codex → 최종검토 Cowork → 커밋/푸시/디플로이 Codex). **Builder ≠ approver.**
> **SECURITY 레이어 (full loop §4b)** — retention/deletion 경로. 단, 삭제 로직 자체는 9a 감사 완료분을 **재사용만** 한다.
> 근거: 수동 CLI 루틴은 사람 실수 = 파기 약속 위반 리스크. JT 명시 승인(2026-07-04)으로 deferred 해제
> (PROJECT_STATE "env schema/9a-2 변경 금지" 조항 충족). RC1_RELEASE_RUNBOOK.md §14의 수동 절차는 병행 유지.

## 1. 확정 사실 (검증 완료)
- reap 코어는 이미 함수화되어 있음: `makeSupabaseStorageAdapter(client).reapDeletablePersonaClips({})` →
  `{scanned, deleted, failed, deletedAssetIds}` (`reap-persona-clips-cli.ts:38-51`). CLI = `pnpm -F @soulbound/adapters clip:reap`.
- RPC `list_deletable_persona_clips`/mark 계열은 security definer·service_role 전용(0008), 9a에서 원자성·멱등·
  protected-바이트 생존까지 감사 완료. **이 라운드는 RPC/adapter 로직에 손대지 않는다.**
- Vercel Cron은 **production 배포에서만** 실행 → soulbound-staging 프로젝트의 production 승격이 선행 조건
  (알파 고정 URL 필요와 겸사 해결).

## 2. 설계 (HIGH — 전부 필수)
- **route**: `apps/web/app/api/internal/persona-clip-reap/route.ts` (**GET** — Vercel Cron 호출 방식).
  - 인증: `Authorization: Bearer ${CRON_SECRET}` 정확 일치(타이밍세이프 비교), 불일치/부재 → 401. 세션/역할 인증 없음
    (사용자 경로와 완전 분리). `CRON_SECRET` 미설정 환경 → 503(비활성)으로 안전 실패.
  - 처리: 서버 전용 service-role 클라이언트(기존 `_lib` 컨벤션) → `reapDeletablePersonaClips({})` 호출 — **로직 중복 0,
    StoragePort/adapter 경유(HARD RULE 8).**
  - 응답: `failed === 0` → 200 `{scanned, deleted, failed}` · `failed > 0` → **500**(Vercel cron 실패로 마킹되어
    대시보드에서 관측 가능 = runbook의 "failed>0 대응" 신호). `deletedAssetIds`는 응답에 포함하지 않고 서버 로그로만
    (internal이라도 응답 표면 최소화).
- **cron 설정**: 신규 `vercel.json` — `{"crons":[{"path":"/api/internal/persona-clip-reap","schedule":"0 18 * * *"}]}`
  (18:00 UTC = 03:00 KST, 일 1회). `@vercel/config`(vercel.ts)는 신규 dep이므로 사용하지 않는다.
- **env**: `CRON_SECRET` 신규 — Vercel(production) + 로컬 `.env` 문서/schema 갱신. 클라이언트 번들 유출 0(INV-17
  검증 대상에 포함). 값 생성은 Codex 배포 단계에서(`openssl rand -hex 32`류), repo에 미기록.
- **운영 문서**: RC1_RELEASE_RUNBOOK.md §14 갱신 — 자동(일1회 cron) + 수동 CLI(결정 배치 직후, 장애 시 fallback)
  병행 체계, failed>0 시 대응 절차(수동 재실행 → 잔존 시 asset 단위 조사) 명시.

## 3. Guardrails
- 🔴 INV-17: service-role/`CRON_SECRET`이 클라이언트 번들에 0 (`.next` 번들 grep 포함).
- 삭제 의미론 무변경: 9a의 remove-first·멱등·protected-hash 생존 보장을 그대로 상속(재사용이므로 자동 충족;
  회귀 테스트로 고정).
- 사용자-facing 표면 변경 0. admin UI 버튼 없음(범위 밖 유지).
- 신규 dep 0. core/adapters/supabase **0-diff** (route + vercel.json + docs + env 문서만).

## 4. Acceptance gates (full loop)
- route 단위테스트: secret 부재/불일치 → 401 · 일치 → 200 + 카운트 · adapter mock `failed>0` → 500 ·
  `CRON_SECRET` 미설정 → 503. 기존 reap 테스트(9a) 무손상.
- `pnpm -r typecheck` · `pnpm -F web test` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- boundary EMPTY: `packages/*`·`supabase/*`·기존 라우트·PWA·lock 0-diff.
- 배포 검증(Codex 디플로이 단계): production 승격 → Vercel Cron 등록 확인 → 수동 트리거 1회(curl + secret) 200 →
  다음 정기 실행 로그 확인. 스테이징 DB에 삭제 대상 0이면 `scanned=0 deleted=0 failed=0`이 정상.

## 5. 범위 밖
admin UI reap 버튼 · 알림/알럿 연동 · 삭제 대상 조회 API · reap 주기 다변화 · CAPTCHA 등 다른 deferred 항목.
