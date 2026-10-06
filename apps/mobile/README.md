# SoulBound iPhone 앱 (`@soulbound/mobile`)

Expo SDK 57 · React Native 0.86 · expo-router 기반 iPhone 앱. 웹(`apps/web`)의 주요 사용자 흐름(가입/로그인 → 입장 신청 → 멤버 공간)을 그대로 따른다.

> **상태: 감사 전/미승인.** 독립 감사를 통과하지 않았다. 스토어 제출 전에 아래 BLOCKER를 반드시 해소해야 한다.

## 구조와 경계

- `app/` — 화면(expo-router 파일 라우팅). 화면/컴포넌트는 **Supabase를 직접 호출하지 않는다.**
- `src/auth/` — Supabase는 여기서만 사용(아이디+비밀번호 로그인/가입, 세션 복원·갱신, `current_user_role` 역할 조회). 세션은 `expo-secure-store`(Keychain, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`)에 저장한다.
- `src/api/` — 모든 데이터는 웹 앱의 `/api/*` 라우트로만 간다. 단일 API 클라이언트가 `Authorization: Bearer <access_token>`를 붙인다.
- `@soulbound/core`는 **타입만** import 한다. 서버 코드는 import 하지 않는다.
- 알림(`expo-notifications`), 체인 SDK, 채팅/DM 없음.

## 준비물

1. **Apple Developer Program** 가입(연 $99, USD) — 실기기 TestFlight/App Store 배포에 필요.
2. **Expo 계정**(무료) — EAS Build/Submit에 필요.
3. 둘 중 하나:
   - Xcode가 설치된 **Mac**(iOS 시뮬레이터/로컬 빌드), 또는
   - **EAS Build**(클라우드 빌드 — Mac 불필요).
4. Node 24, pnpm 11.1.3 (`npm i -g pnpm@11.1.3`). 저장소 루트에서 `pnpm install --frozen-lockfile`.

## 환경 변수

`apps/mobile/.env.example`을 `apps/mobile/.env.local`로 복사해서 채운다(`.env*`는 gitignore 됨, **절대 커밋 금지**).

| 변수 | 설명 |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | 배포된 웹 origin (예: `https://soulbound.example`). `/api/*`, `/terms`, `/privacy`가 여기서 열린다. |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (웹의 `NEXT_PUBLIC_SUPABASE_URL`과 같은 값) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (웹과 같은 값, service-role 키 금지) |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | (선택) 개인정보 처리방침 URL. 비우면 `${EXPO_PUBLIC_API_BASE_URL}/privacy` |
| `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | (미사용, 선택) 앱 밖 삭제 안내용. 앱은 `DELETE /api/account`로 직접 삭제한다. |
| `EXPO_PUBLIC_REPORT_URL` | (미사용, 선택) 신고는 `POST /api/reports`로 접수한다. |
| `IOS_BUNDLE_ID` | (선택) 기본값 `com.soulbound.app` |
| `EAS_PROJECT_ID` | (선택) `eas init` 후 받은 프로젝트 ID |

EAS 빌드에서는 같은 값을 EAS 환경 변수(`eas env:create`)나 `eas.json` 프로필의 `env`로 넣는다. `EXPO_PUBLIC_*` 값은 앱 번들에 포함되므로 **공개되어도 되는 값만** 넣는다.

## 실행

```bash
# 저장소 루트
pnpm install --frozen-lockfile
cd apps/mobile
pnpm start          # QR 코드 → iPhone의 Expo Go 앱으로 열기
pnpm ios            # Mac: iOS 시뮬레이터에서 열기 (Xcode 필요)
```

Expo Go는 SDK 57을 지원하는 최신 버전이어야 한다. 이 앱은 Expo Go에 포함된 모듈만 쓰므로 개발 빌드 없이도 실행된다.

### 개발 빌드(시뮬레이터)

```bash
npm i -g eas-cli
eas login                      # JunTae 본인 계정
eas init                       # 프로젝트 ID 발급 → extra.eas.projectId 또는 EAS_PROJECT_ID
eas build -p ios --profile development   # 시뮬레이터용 Debug 빌드(expo-dev-client 없음, Metro에 연결)
```

## TestFlight / App Store

```bash
eas build -p ios --profile preview       # 내부 배포(등록된 기기)
eas build -p ios --profile production    # 스토어용(빌드 번호 자동 증가)
eas submit -p ios --profile production   # App Store Connect 업로드 → TestFlight
```

`eas.json` 프로필: `base`(Node 24.19.0, pnpm 11.1.3) → `development`(시뮬레이터 Debug) / `preview`(내부 배포 Release) / `production`(store, 빌드 번호 원격 자동 증가). 각 프로필은 같은 이름의 EAS 환경 변수(`eas env:create --environment …`)를 쓴다.
`submit.production.ios`에는 `language: "ko"`만 있다. App Store Connect 앱 레코드를 만든 뒤 `ascAppId`(숫자)와 `appleTeamId`를 추가하거나 `eas submit` 대화형 입력을 쓴다.

**전체 제출 절차·메타데이터·App Privacy 답변·소유자 전용 단계: [`docs/store/APP_STORE_SUBMISSION.md`](../../docs/store/APP_STORE_SUBMISSION.md).**

## App Store 제출 체크리스트

- [ ] 개인정보 처리방침 URL — 웹 `/privacy` **정식본**(시행 2026-10-06, 앱 설정/가입 화면 연결됨). 배포된 URL을 App Store Connect에 등록
- [x] 앱 내 계정 삭제 (설정 → 계정 삭제 → `DELETE /api/account` → 로그아웃) — 프로덕션 DB에 0014 마이그레이션 적용 필요
- [x] UGC 신고/차단 (게시글·댓글·멤버) — `POST /api/reports`(사유 선택 + 선택 설명), `/api/blocks`(서버 저장·서버 필터) / 운영자 처리 루틴(`/admin/reports`) 필요
- [ ] 심사용 데모 계정(활성 멤버 1개) + 리뷰 노트(아이디/비밀번호, 입장 절차 설명)
- [ ] App Privacy 설문(수집: 아이디·멤버 번호[User ID], 게시글/댓글·입장 신청 내용·신고 설명[Other User Content], 역할·멤버십 상태·투표 참여 여부(찬반 아님)·차단 목록·신고 처리 상태[Other Data Types] / 모두 사용자 연결·앱 기능 목적 / 추적 없음) — 답변표와 `ios.privacyManifests`(PrivacyInfo.xcprivacy)는 `docs/store/APP_STORE_SUBMISSION.md` §4·§1.1
- [x] 권한 문구 없음(카메라·마이크·사진·위치·알림·Face ID 미사용 — `expo-secure-store`의 기본 Face ID 문구도 제거), ATS 임의 HTTP 금지
- [ ] 스크린샷(iPhone 6.3" 1206×2622 또는 1179×2556 **필수**, 6.9" 1320×2868 권장, iPad 불필요 — 제출 문서 §7), 앱 설명, 지원 URL, 연령 등급(UGC 포함)
- [x] 앱 화면의 "프리알파" 배지 제거(가이드라인 2.2). 웹 `/terms` 제8조 "프리알파 고지"는 별도 결정
- [x] 수출 규정: `ITSAppUsesNonExemptEncryption=false` 설정됨(HTTPS만 사용)
- [ ] 이용약관(`/terms`) 법률 검토

## Known BLOCKERS

1. **개인정보 처리방침은 정식본.** 웹 `/privacy`(시행 2026-10-06). App Store Connect에는 배포된 URL을 등록하면 된다. 연락 이메일은 `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`(비우면 `soulbound.dao@gmail.com`).
2. **신고 처리 운영 루틴 필요.** 신고는 `/admin/reports`에서 reviewer/admin이 처리한다. 새 신고 알림은 없다(푸시 없음). Apple 1.2는 신속한 조치를 요구한다.
3. **프로덕션 반영 필요.** `supabase/migrations/0014_store_compliance.sql`을 프로덕션 Supabase에 적용하고 웹을 재배포해야 앱의 삭제/신고/차단이 동작한다.
4. **Persona Clip 녹화 미구현.** 신청은 Persona Clip 없이 가능(선택 항목). 투표 상세의 Persona Clip 재생도 웹에서만.
5. **검토자/관리자 화면 미구현(P5).** reviewer/admin 계정은 웹 관리 화면 링크만 표시.
6. Apple Developer 가입, Expo 계정, EAS 프로젝트 ID, 심사용 데모 계정은 JunTae가 직접 준비해야 한다.

## 검증 명령

```bash
pnpm -F @soulbound/mobile typecheck
pnpm -F @soulbound/mobile test           # jest-expo, Linux 헤드리스
cd apps/mobile && npx expo-doctor
cd apps/mobile && npx expo export --platform ios   # dist/는 gitignore
```

## 툴체인 메모

루트 `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `scripts/audit.sh`는 **변경하지 않았다.** `pnpm-workspace.yaml`의 `allowBuilds` 추가도 필요 없었다(설치 스크립트가 필요한 Expo 패키지 없음). `react-native-worklets`/`react-native-reanimated`/`react-dom`/`@react-native/metro-config`는 expo-router·expo의 peer 의존성을 SDK 57 호환 버전으로 고정하기 위해 명시했다(직접 사용하지 않음).
