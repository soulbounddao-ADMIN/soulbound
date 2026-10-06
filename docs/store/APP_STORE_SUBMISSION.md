# SoulBound iPhone 앱 — App Store 제출 준비서

> **상태: 초안 / 감사 전.** 브랜치 `devin/ios-store-prep-2026-10-06` (base `phase1-p0-mvp` @ `685df0b`).
> Apple Developer 계정과 Expo 계정 **없이** 할 수 있는 준비만 끝냈다. 계정이 필요한 단계는 §10 "소유자 전용 단계"에 정리했다.
> 기준 코드: `apps/mobile` (Expo SDK 57, React Native 0.86, expo-router), 웹 `/privacy` 정식본(시행 2026-10-06).

## 0. 이 브랜치에서 바꾼 것

| 파일 | 변경 |
| --- | --- |
| `apps/mobile/eas.json` | `base` 프로필(Node 24.19.0, pnpm 11.1.3, iOS image `latest`) + `development`(시뮬레이터 Debug) / `preview`(내부 배포, 실기기 Release) / `production`(store, `autoIncrement: true`). 각 프로필이 EAS 환경(`development`/`preview`/`production`)의 환경 변수를 쓴다. `submit.production.ios`의 `REPLACE_WITH_…` 자리표시자는 제거했다(그대로 두면 `eas submit`이 그 값을 진짜로 쓰려다 실패함). `language: "ko"`만 남김. |
| `apps/mobile/app.config.ts` | `ios.privacyManifests` 추가(PrivacyInfo.xcprivacy). `NSAppTransportSecurity`를 명시(임의 HTTP 금지, 로컬 네트워크만 허용). `expo-secure-store`의 기본 `NSFaceIDUsageDescription` 제거(`faceIDPermission: false` — Face ID를 쓰지 않음). `ios.buildNumber`는 EAS 원격 관리라는 주석. |
| `apps/mobile/assets/splash-icon.png` | 512→1024px, 투명 배경, 글리프 중앙 정렬. 기존 파일은 S 글리프가 둥근 사각형 밖으로 삐져나오고 가운데에서 벗어나 있었다. |
| `apps/mobile/README.md` | 위 변경 반영, 이 문서 링크. |

`packages/core`, `packages/adapters`, `supabase/`, `apps/web/app/api`, 툴체인 파일(루트 `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `scripts/audit.sh`)은 바꾸지 않았다. 새 npm 의존성도 없다.

## 1. 앱 설정 점검 결과

`npx expo config --type introspect`와 `npx expo prebuild --platform ios --no-install`(Linux, 결과물 `ios/`는 gitignore·삭제)로 실제 생성되는 Info.plist / PrivacyInfo.xcprivacy를 확인했다.

| 항목 | 값 | 판정 |
| --- | --- | --- |
| Bundle ID | `com.soulbound.app` (`IOS_BUNDLE_ID`로 바꿀 수 있음) | 기존 값 유지. **App Store Connect에 등록하면 바꿀 수 없다**(§11 Q1). |
| 표시 이름 | `SoulBound` (`CFBundleDisplayName`) | OK |
| 버전 | `0.1.0` (`CFBundleShortVersionString`) | 형식 유효. 첫 스토어 출시를 `1.0.0`으로 할지는 결정 필요(§11 Q4). |
| 빌드 번호 | EAS 원격 관리(`appVersionSource: remote`, production `autoIncrement`) | 첫 빌드는 1부터 자동 증가. 로컬 `ios.buildNumber` 불필요. |
| 기기 | iPhone 전용(`supportsTablet: false` → `TARGETED_DEVICE_FAMILY = 1`), 세로 고정 | iPad 스크린샷 불필요. |
| 최소 iOS | 16.4 (Expo SDK 57 기본 `IPHONEOS_DEPLOYMENT_TARGET`) | OK |
| 앱 아이콘 | `assets/icon.png` 1024×1024, RGB, **알파 없음** | App Store 요건 충족(알파 채널 금지). 단일 1024 아이콘에서 Xcode가 모든 크기 생성. |
| 스플래시 | `assets/splash-icon.png` 1024×1024 RGBA(투명 배경), `imageWidth: 160`, 배경 `#FAF9F5` | OK (이번에 교체). |
| `ITSAppUsesNonExemptEncryption` | `false` | HTTPS(OS 제공 TLS)만 사용, 자체 암호화 없음 → 수출 규정 질문 자동 통과. |
| ATS | `NSAllowsArbitraryLoads=false`, `NSAllowsLocalNetworking=true` | 운영은 HTTPS만. 개발 시 Metro(LAN) 허용. |
| 권한 문구(`NS*UsageDescription`) | **없음** | 카메라·마이크·사진·위치·연락처·알림·추적·Face ID 모두 사용하지 않음. 생성된 Info.plist에서 `NSFaceIDUsageDescription`이 빠진 것까지 확인. 기능을 추가할 때만 문구를 추가할 것. |
| ATT(`NSUserTrackingUsageDescription`) | 없음 | 추적하지 않음. |
| Sign in with Apple | 불필요 | 자체 아이디/비밀번호만 사용, 제3자·소셜 로그인 없음(가이드라인 4.8 비대상). |
| 딥링크 scheme | `soulbound` | OK. Universal Links(associated domains) 없음. |
| 네이티브 모듈 | expo, expo-asset, expo-constants, expo-crypto, expo-file-system, expo-font, expo-keep-awake, expo-linking, expo-router, expo-secure-store, expo-splash-screen, expo-symbols, expo-glass-effect, @expo/ui, @expo/dom-webview, @expo/log-box, react-native-screens/reanimated/worklets/safe-area-context | 전부 Expo SDK 57 기본 구성. 분석·광고·크래시 리포팅 SDK 없음. |

참고: prebuild 시 `ios.backgroundColor: Install expo-system-ui to enable this feature` 경고가 나온다. 루트 뷰 배경색 설정이 무시된다는 뜻일 뿐 빌드·심사에 영향 없다. 필요하면 나중에 `npx expo install expo-system-ui`(lockfile 변경 동반).

### 1.1 Privacy manifest (`ios.privacyManifests` → `PrivacyInfo.xcprivacy`)

- `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []`
- `NSPrivacyCollectedDataTypes` (모두 Linked=true, Tracking=false, Purpose=App Functionality):
  - `NSPrivacyCollectedDataTypeUserID` — 아이디(username), 멤버 번호
  - `NSPrivacyCollectedDataTypeOtherUserContent` — 입장 신청 자기소개/보완 내용, 게시글·댓글, 신고 추가 설명
  - `NSPrivacyCollectedDataTypeOtherDataTypes` — 역할·멤버십 상태, 투표 참여 여부(찬반 선택 아님), 차단 목록, 신고 처리 상태
- `NSPrivacyAccessedAPITypes` (React Native 코어 + 자동 링크된 Expo 모듈이 동봉한 PrivacyInfo의 합집합. Apple이 정적 CocoaPods의 매니페스트를 항상 합치지 못하므로 앱 레벨에 재선언 — Expo 공식 권고):
  - FileTimestamp: `C617.1`(react-native), `0A2A.1`·`3B52.1`(expo-file-system)
  - UserDefaults: `CA92.1`(react-native, expo-constants)
  - SystemBootTime: `35F9.1`(react-native)
  - DiskSpace: `E174.1`·`85F4.1`(expo-file-system)

의존성을 추가하면 `node_modules/<pkg>/ios/PrivacyInfo.xcprivacy`를 확인해 여기에 합칠 것. 빠진 사유가 있으면 Apple이 빌드 업로드 직후 메일(ITMS-91053)로 알려 준다.

## 2. App Store Connect 메타데이터 초안 (한국어, 기본 언어 `ko`)

| 필드 | 제한 | 초안 |
| --- | --- | --- |
| 앱 이름 | 30자 | **SoulBound** (이미 쓰이고 있으면 `SoulBound 소울바운드`) |
| 부제 | 30자 | **심사로 들어가는 익명 멤버 공간** |
| 카테고리 | — | 기본: **소셜 네트워킹(Social Networking)** / 보조: **라이프스타일(Lifestyle)** |
| 키워드 | 100자(쉼표 구분, 공백 없이) | `익명,커뮤니티,멤버십,게시판,비밀투표,입장심사,프라이버시,소울바운드,DAO,모임,초대제,멤버전용` (53자). 바이트 기준으로 걸리면 짧은 안: `익명,커뮤니티,멤버십,게시판,비밀투표,심사,DAO,soulbound` |
| 프로모션 텍스트 | 170자 | 실명·전화번호·이메일 없이 아이디 하나로. 기존 멤버의 비밀투표로 들어가는 익명 멤버 공간, SoulBound. |
| 저작권 | — | `© 2026 SOULBOUND` (법적 표기 주체 확인 필요, §11 Q6) |
| 개인정보 처리방침 URL | — | `https://<PROD_ORIGIN>/privacy` (§11 Q2 — 운영 도메인 확정 필요) |
| 지원 URL | — | `https://<PROD_ORIGIN>/support` 권장(현재 페이지 없음) — 임시로 `https://<PROD_ORIGIN>/privacy#privacy-officer`(연락처 `soulbound.dao@gmail.com` 게시). §11 Q3 |
| 마케팅 URL | 선택 | 비워 둠 또는 `https://<PROD_ORIGIN>/` |

### 2.1 설명 (4,000자 이내)

```
SoulBound는 서로의 실명을 몰라도 신뢰할 수 있는 사람들끼리 모이는 익명 멤버 공간입니다.

■ 아이디 하나로 시작
실명, 전화번호, 이메일 주소를 묻지 않습니다. 아이디와 비밀번호만으로 가입합니다.
비밀번호는 해시로만 저장되어 운영진도 원문을 알 수 없습니다.

■ 심사와 비밀투표로 입장
가입 후 자기소개를 담아 입장을 신청하면, 검토자 심사 또는 기존 멤버의 비밀투표로 입장 여부가 정해집니다.
투표의 찬성·반대는 투표자와 분리되어 저장되고, 투표가 끝나면 선택 기록은 지워집니다.
심사가 끝나면 신청 본문도 파기됩니다.

■ 멤버 전용 게시판
입장한 멤버만 게시판에 글과 댓글을 남길 수 있습니다.
다른 멤버에게는 아이디 대신 멤버 번호(soulbound-member-N)만 보입니다.

■ 안전한 공간을 위한 장치
· 게시글·댓글·멤버를 사유와 함께 신고할 수 있고, 운영진이 검토해 조치합니다.
· 원하지 않는 멤버를 차단하면 그 멤버의 글·댓글이 보이지 않습니다. 상대는 차단 사실을 알 수 없습니다.
· 내가 쓴 글과 댓글은 언제든 지울 수 있습니다.
· 설정에서 계정을 바로 삭제할 수 있습니다.

■ 추적하지 않습니다
광고, 이용 분석 도구, 광고 식별자, 오류 자동 보고, 푸시 알림 토큰을 쓰지 않습니다.

만 14세 미만은 가입할 수 없습니다.
이용약관: https://<PROD_ORIGIN>/terms
개인정보 처리방침: https://<PROD_ORIGIN>/privacy
```

> 설명·스크린샷·앱 안 문구에 "프리알파/베타/테스트" 표현을 쓰지 말 것(가이드라인 2.2: 베타·데모는 App Store가 아니라 TestFlight로). 앱 설정 화면의 `프리알파` 배지는 후속 PR(`devin/ios-store-polish-2026-10-06`)에서 제거했다. 약관 제8조 "프리알파 고지"는 §11 Q5 참고.

## 3. 연령 등급 (2026 설문 기준)

Apple 연령 등급은 2025년 7월부터 **4+ / 9+ / 13+ / 16+ / 18+** 체계다(예전 12+ → 13+, 17+ → 18+에 해당). 2026년 9월부터는 **소셜 미디어 기능 질문**에 답해야 새 앱·업데이트를 제출할 수 있다.

권장 답변:

| 섹션 | 질문 | 답 | 근거 |
| --- | --- | --- | --- |
| In-App Controls | Parental Controls | 아니요 | 없음 |
| | Age Assurance | 아니요 | 나이 확인 없음(약관상 만 14세 미만 가입 불가, 생년월일 미수집) |
| Capabilities | Unrestricted Web Access | 아니요 | 앱 안 브라우저 없음. `/privacy`, `/terms`만 Safari로 연다 |
| | User-Generated Content | **예** | 게시글·댓글, 입장 신청 자기소개 |
| | Social Media | **예** | 멤버 전용 게시판 피드에서 글을 보고 댓글로 반응 → Apple 정의("피드 등에서 UGC를 재배포·증폭·상호작용")에 해당. **최소 13+** |
| | Social Media Disabled for Users Under 13 | 아니요 | Declared Age Range API 미사용 |
| | Messaging and Chat | **예(보수적)** | DM·채팅은 없지만 Apple 정의에 "public posting"이 포함됨. 게시판 공개 게시·댓글이 이에 해당할 수 있음 |
| | Advertising | 아니요 | 광고 없음 |
| Mature Themes | 욕설/공포/약물 등 | 없음 | 앱이 제공하는 콘텐츠 없음(UGC는 위 Capabilities로 신고) |
| Medical or Wellness | | 없음 | |
| Sexuality or Nudity | | 없음 | |
| Violence | | 없음 | |
| Chance-Based Activities | 도박/모의 도박/경품 | 없음 | 입장 투표는 도박·경품 아님 |

결과: Apple 자동 산정은 **13+**가 나올 것이다.

권장: **"Override to Higher Age Rating" → 16+.**
- 약관 기준이 만 14세 이상인데 Apple 체계에 14+가 없으므로, 13+로 두면 스토어 표시가 약관보다 낮다. 그 위 단계가 16+.
- 익명 게시판 + 사후 신고 처리 구조라서 보수적으로 잡는 편이 심사·운영 리스크가 낮다.
- 18+(옛 17+)는 필요 없다고 본다. 성인 콘텐츠·랜덤 채팅·무검토 공개 피드가 아니고, 멤버 심사·신고·차단이 있다. 단, 24시간 내 신고 처리를 운영할 수 없으면 18+를 고려(§6).
- 결정은 소유자 몫(§11 Q7).

## 4. App Privacy ("개인정보 영양 성분표") 답변

근거: `apps/mobile/src`(API 호출 `src/api/endpoints.ts`, 인증 `src/auth/*`, 기기 저장 `expo-secure-store`)와 웹 `/privacy` 정식본 §2·§9. 앱에 분석·광고·크래시 SDK가 없음을 의존성 목록으로 확인했다.

**"Do you or your third-party partners collect data from this app?" → 예**

**추적(Tracking): 아니요** — 어떤 데이터도 제3자 데이터와 결합하거나 광고 목적으로 공유하지 않는다. ATT 프롬프트 불필요.

| Apple 데이터 유형 | 수집 | 사용자 연결(Linked) | 추적 | 목적 | 앱에서의 실제 데이터 |
| --- | --- | --- | --- | --- | --- |
| Contact Info › Name / Email / Phone / Address / Other | **아니요** | — | — | — | 실명·전화·주소 미수집. 로그인용 `아이디@soulbound.internal`은 아이디에서 기계적으로 만든 내부 주소로, 사용자가 입력하는 이메일이 아니며 메일을 보내지 않음 |
| Identifiers › **User ID** | **예** | 예 | 아니요 | App Functionality | 아이디(3~24자), 멤버 번호(`soulbound-member-N`), 내부 계정 UUID |
| Identifiers › Device ID | 아니요 | | | | IDFA/IDFV 미사용 |
| User Content › **Other User Content** | **예** | 예 | 아니요 | App Functionality | 입장 신청 자기소개·보완 내용, 게시글(≤2,000자)·댓글(≤1,200자), 신고 추가 설명(≤500자) |
| User Content › Photos or Videos / Audio Data | **아니요** | | | | iPhone 앱은 Persona Clip(영상·음성) 녹화를 제공하지 않음(웹 전용, 선택). iOS에 추가하면 이 항목과 카메라·마이크 권한 문구를 함께 추가해야 함 |
| User Content › Emails or Text Messages / Gameplay / Customer Support | 아니요 | | | | DM·채팅 없음 |
| **Other Data** › Other Data Types | **예** | 예 | 아니요 | App Functionality | 역할·멤버십 상태, 입장 신청 상태, 투표 참여 여부·시각(찬반 선택은 참여자와 분리 저장 후 투표 종료 시 삭제), 차단 목록, 신고 대상·사유 코드·처리 상태 |
| Usage Data (Product Interaction, Advertising Data, Other) | 아니요 | | | | 분석 도구 없음 |
| Diagnostics (Crash, Performance, Other) | 아니요 | | | | 오류 자동 보고 없음 |
| Location / Health & Fitness / Financial / Contacts / Browsing / Search History / Sensitive Info / Purchases | 아니요 | | | | 해당 기능 없음 |

비고:
- **비밀번호**: Apple 분류에 비밀번호 항목이 없다. 인증 목적으로 Supabase Auth가 해시만 저장(위 User ID와 같은 계정 정보로 처리).
- **IP 주소**: SoulBound DB는 IP를 저장하지 않는다. 호스팅(Vercel)·DB(Supabase)가 각자 접속 로그를 남길 수 있으나 위치 추정·분석에 쓰지 않으므로 별도 신고하지 않는 것이 일반적이다. 보수적으로 가려면 "Coarse Location: 아니요"는 유지하고 Other Data에 포함된다고 해석하면 된다(§11 Q8).
- **기기 저장**: 로그인 세션과 차단 목록 임시 복사본은 iOS Keychain(SecureStore)에만 저장 — 서버로 보내는 "수집"이 아니라 기기 보관.
- 이 표와 `app.config.ts`의 `NSPrivacyCollectedDataTypes`는 반드시 같은 내용이어야 한다. 앱 기능이 바뀌면 둘 다, 그리고 웹 `/privacy`를 함께 고칠 것.

## 5. 심사 정보 (App Review Information)

### 5.1 연락처 (소유자 입력)

- 이름 / 전화번호 / 이메일: **JunTae가 입력** (심사팀이 연락 가능한 번호, 국가번호 포함 `+82-10-…`)

### 5.2 로그인 정보 (데모 계정 — 자리표시자)

- Sign-in required: **예**
- Username: `<DEMO_USERNAME>` (예: `appreview`)
- Password: `<DEMO_PASSWORD>`

데모 계정 준비(소유자, 운영 환경에서):
1. 앱 또는 웹 `/signup`에서 `appreview` 계정 생성.
2. 입장 신청 → 웹 `/admin/applications`에서 reviewer/admin이 **승인**해 **활성 멤버**로 만든다(심사관이 입장 투표를 기다리지 않게).
3. 다른 멤버 계정으로 게시판에 글 2~3개와 댓글을 미리 올려 둔다(심사관이 **다른 사람의 글을 신고·차단**해 볼 수 있도록).
4. 심사관이 데모 계정을 삭제해 볼 수 있으므로, 심사 중에는 `/admin`에서 계정이 살아 있는지 확인하고 지워졌으면 같은 방법으로 다시 만든다.
5. 신청자 화면도 보여 주고 싶으면 승인하지 않은 두 번째 계정을 함께 제공(선택).

### 5.3 Notes (영문 — 심사관용)

```
SoulBound is a members-only, pseudonymous community. The app UI is in Korean.

Demo account (already an ACTIVE MEMBER, so you can see every member feature):
  Username: <DEMO_USERNAME>
  Password: <DEMO_PASSWORD>

How the app works
- Sign up needs only a username and password (no email, phone, or real name).
- A new account must apply for admission; an existing reviewer or a secret member vote approves it.
  The demo account is already approved, so you do not need to wait for admission.
- Members see a board (게시판), a member list (멤버), and admission votes (투표). Other members appear
  only as "soulbound-member-N".

User-generated content safeguards (Guideline 1.2)
- Report: open a post (게시판 → a post) and tap "신고 · 차단" on the post or on any comment → "신고하기"
  → choose a reason (spam, harassment, hate, sexual, violence, illegal, impersonation, privacy, other)
  → optional details. Members can also be reported from the member list (멤버 → tap a member).
  Reports go to our moderators (web admin console /admin/reports); we review and act on reports within 24 hours
  by removing the content and suspending or removing the offending member.
- Block: same menu → "차단하기". Blocked members' posts, comments, and directory entries are hidden for the
  blocker (filtered on the server). Unblock in 설정 → 차단한 멤버.
- Users accept the Terms of Use at sign-up (checkbox "이용약관에 동의합니다"). Objectionable content and abusive
  behavior are prohibited and lead to removal.

Account deletion (Guideline 5.1.1(v))
- 설정 (Settings) → 계정 삭제 (Delete account) → confirm "영구 삭제". The account and its data are deleted
  immediately on the server (DELETE /api/account) and the user is signed out.

Other
- No tracking, ads, analytics, or push notifications. Only HTTPS to our own backend.
- Privacy policy: https://<PROD_ORIGIN>/privacy  Terms: https://<PROD_ORIGIN>/terms
- Contact: soulbound.dao@gmail.com
```

> 위 "24시간 내 조치" 문구는 Apple이 1.2 거절 사유에 쓰는 표준 요건이다. **실제 운영 루틴(알림 없음 → 하루 최소 1회 `/admin/reports` 확인)을 소유자가 약속할 수 있을 때만** 이 문장을 넣을 것.

## 6. UGC 준수 체크리스트 (Guideline 1.2 / 5.1.1(v))

| Apple 요건 | 구현 | 위치 | 상태 |
| --- | --- | --- | --- |
| 1.2 이용약관(EULA) 동의 | 가입 시 "이용약관에 동의합니다" 체크 필수, 약관·개인정보 처리방침 링크 | `app/signup.tsx`, 웹 `/terms` | ✅ 구현. ⚠️ 약관에 **"부적절한 콘텐츠·악용 사용자에 무관용"** 문구가 명시돼 있지 않음 → §11 Q9(문안 제안 포함) |
| 1.2 부적절한 콘텐츠 필터링 | 입장 심사(검토자 승인 또는 멤버 비밀투표)를 통과한 멤버만 글쓰기 가능, 차단 시 서버 필터, 신고 후 운영자 삭제 | 웹 API `/api/board`(RLS/RPC 필터), `/api/blocks` | ⚠️ 부분. 게시 **전** 자동 필터(금칙어 등)는 없음. 심사 게이트 + 사후 조치로 설명. 거절되면 서버 금칙어 필터 추가 필요(`apps/web/app/api` 범위라 이 PR 밖) — §11 Q10 |
| 1.2 신고 기능 | 게시글·댓글·멤버 신고, 사유 9종 + 선택 설명(≤500자), 중복·자기 신고 방지, 시간당 10건 제한 | `src/screens/safety-actions.ts`, `app/board/[postId].tsx`, `app/member/index.tsx` → `POST /api/reports` | ✅ |
| 1.2 신속한 대응(24시간) | 운영자 처리 화면(reviewer/admin): 목록 + enum 처리(콘텐츠 삭제/제재/경고, 기각) | 웹 `/admin/reports`, `POST /api/admin/reports/{id}/resolve` | ⚠️ 화면은 있음. **새 신고 알림 없음** → 하루 1회 이상 확인하는 운영 루틴 필요(소유자) |
| 1.2 사용자 차단 | 게시글·댓글·멤버 메뉴에서 차단/해제, 서버 저장, 차단한 사람의 글·댓글·명부 항목 숨김, 상대는 모름 | `src/lib/block-store.tsx`, 설정 → 차단한 멤버, `/api/blocks` | ✅ |
| 1.2 연락처 게시 | `/privacy` §11에 연락 이메일 | 웹 `/privacy` | ⚠️ 지원 URL/페이지 필요 — §11 Q3 |
| 5.1.1(v) 앱 안 계정 삭제 | 설정 → 계정 삭제 → 확인 → `DELETE /api/account` 즉시 삭제 → 로그아웃. 웹사이트 이동·이메일 요청 불필요 | `src/screens/settings-content.tsx` | ✅ (운영 DB에 `0014_store_compliance.sql` 적용 + 웹 재배포 전제) |
| 5.1.1(i) 개인정보 처리방침 링크 | 가입 화면·설정 화면에서 열람, ASC에 URL 등록 | `app/signup.tsx`, 설정 | ✅ (운영 URL 확정 필요) |
| 5.1.1 최소 수집 | 아이디/비밀번호만으로 가입, 권한 요청 0개 | | ✅ |
| 2.1 앱 완성도 | 심사 시점에 운영 백엔드가 살아 있고 데모 계정이 활성 멤버여야 함 | | ⏳ 소유자 |
| 2.2 베타 표기 금지 | 앱 화면의 `프리알파` 배지 제거됨. 웹 약관 제8조 "프리알파 고지"는 남음 | `src/screens/settings-content.tsx`, 웹 `/terms` | ✅ 앱 / ⚠️ 약관 §11 Q5 |
| 4.8 Sign in with Apple | 제3자 로그인 없음 → 비대상 | | ✅ |

## 7. 스크린샷

iPhone 전용 앱이므로 iPad 스크린샷은 필요 없다. PNG/JPEG, **알파 채널 없이**, 기기 크기당 1~10장.

| 표시 크기 | 해상도(세로) | 필요 여부 |
| --- | --- | --- |
| iPhone 6.3" Dynamic Island (iPhone 15/16/17 Pro 등) | **1206×2622** 또는 1179×2556 | **필수(최소 1장)** — 현재 App Store Connect 기준 |
| iPhone 6.9" Dynamic Island (16/17 Pro Max 등) | **1320×2868** (또는 1290×2796, 1260×2736) | 권장 — 큰 화면용. 없으면 6.5" 스크린샷을 축소/확대해 사용 |
| iPhone 6.5" Face ID (11 Pro Max 등) | 1284×2778 또는 1242×2688 | 6.9"를 올리지 않을 때 필요 |

촬영 권장 화면(5~6장, 데모 계정, 실제 데이터처럼 보이되 개인정보 없이):
1. 첫 화면(가입/로그인) — "아이디 하나로 시작"
2. 입장 신청 화면(자기소개) 또는 입장 절차(gate)
3. 멤버 게시판 목록
4. 게시글 상세 + 댓글 (신고·차단 버튼이 보이게)
5. 입장 투표 목록/상세
6. 설정(차단한 멤버, 계정 삭제, 개인정보 처리방침)

Mac이 없으면: `eas build -p ios --profile development`(시뮬레이터 빌드)는 Mac 시뮬레이터가 있어야 열 수 있으므로, TestFlight로 실기기에 설치해 6.3"/6.9" 기기에서 직접 캡처하는 방법이 현실적이다.

## 8. 수출 규정 / 기타 ASC 질문

- 암호화: `ITSAppUsesNonExemptEncryption=false`가 빌드에 들어가므로 TestFlight·심사 제출 때 질문이 자동 처리된다.
- 콘텐츠 권리: 제3자 콘텐츠 없음 → "아니요".
- 가격: 무료, 인앱 결제 없음.
- 배포 국가: 처음에는 **대한민국만** 권장. EU 스토어에 배포하려면 **DSA 거래자(trader) 지위** 신고가 필요하다(거래자면 주소·전화·이메일이 스토어에 공개). §11 Q11.
- IDFA: 사용 안 함.

## 9. 게이트 결과 (이 브랜치, 2026-10-06, Node 24.19.0 / pnpm 11.1.3)

| 게이트 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | ✅ lockfile 변경 없음 |
| `pnpm -r typecheck` | ✅ core / adapters / web / mobile |
| `pnpm -F @soulbound/mobile test` | ✅ 6 suites, 24 tests |
| `npx expo-doctor` (apps/mobile) | ✅ 21/21 checks passed |
| `npx expo export --platform ios` | ✅ iOS Hermes 번들 1개(3.1 MB) |
| `bash scripts/audit.sh` | ✅ AUDIT PASSED |
| `npx expo prebuild --platform ios --no-install` (검증용, 결과 삭제) | ✅ Info.plist에 권한 문구 0개, ATS 적용, PrivacyInfo.xcprivacy 생성 확인 |
| `@expo/eas-json`으로 `eas.json` 검증 | ✅ development / preview / production / submit 프로필 파싱 성공 |

## 10. 소유자(JunTae) 전용 단계 — 순서대로

> 아래는 Apple/Expo 계정 본인 인증이 필요해서 에이전트가 대신할 수 없다. 비밀값(비밀번호, 토큰, .p8 키)은 채팅에 붙여 넣지 말고 EAS/1Password 등 비밀 저장소로만 전달.

**A. Apple Developer Program 가입**
1. 2단계 인증이 켜진 Apple ID 준비(가능하면 운영용 Apple ID).
2. https://developer.apple.com/programs/enroll/ 에서 가입 — **연 $99(USD)**. 개인(Individual) 또는 조직(Organization, D-U-N-S 번호 필요). 스토어의 "판매자" 이름이 여기서 정해진다(§11 Q6).
3. 승인 후 Team ID 확인(Membership 페이지).

**B. Expo 계정 + 토큰**
1. https://expo.dev/signup 에서 무료 계정 생성.
2. 로컬(또는 박스)에서:
   ```bash
   npm i -g eas-cli
   eas login
   cd apps/mobile
   eas init            # EAS 프로젝트 생성 → projectId 발급
   ```
   `app.config.ts`가 동적 설정이라 `eas init`이 자동으로 못 쓸 수 있다. 그때는 받은 projectId를 `extra.eas.projectId`에 직접 넣어 커밋(비밀 아님)하거나, 로컬 셸과 EAS 환경 변수 모두에 `EAS_PROJECT_ID`로 넣는다. 커밋 쪽을 권장.
3. CI/에이전트용 토큰: expo.dev → Account settings → **Access tokens** → 토큰 생성 → `EXPO_TOKEN`으로 비밀 저장소에 보관. (`EXPO_TOKEN=… eas build --non-interactive`)

**C. EAS 환경 변수 (공개되어도 되는 값만 — 앱 번들에 포함됨)**
```bash
cd apps/mobile
for ENV in production preview development; do
  eas env:create --environment $ENV --name EXPO_PUBLIC_API_BASE_URL     --value "https://<PROD_ORIGIN>" --visibility plaintext
  eas env:create --environment $ENV --name EXPO_PUBLIC_SUPABASE_URL     --value "https://<project-ref>.supabase.co" --visibility plaintext
  eas env:create --environment $ENV --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key — service_role 금지>" --visibility sensitive
done
```
(preview/development에는 스테이징 값을 넣어도 된다.)

**D. 운영 백엔드 준비(심사 전 필수)**
1. 운영 Supabase에 `supabase/migrations/0014_store_compliance.sql` 적용, 웹 재배포 → 계정 삭제/신고/차단 API 동작 확인.
2. `https://<PROD_ORIGIN>/privacy`, `/terms` 공개 접근(로그인 없이 200) 확인.
3. §5.2 데모 계정 준비.

**E. App Store Connect 앱 레코드**
1. https://appstoreconnect.apple.com → 앱 → "+" 새 앱: 플랫폼 iOS, 이름 `SoulBound`, 기본 언어 **한국어**, Bundle ID `com.soulbound.app`(목록에 없으면 첫 `eas build`가 등록하거나 Certificates, Identifiers & Profiles에서 먼저 등록), SKU 예: `soulbound-ios`.
2. 생성 후 "앱 정보"의 **Apple ID(숫자)** = `ascAppId`. `apps/mobile/eas.json`의 `submit.production.ios`에 `"ascAppId": "<숫자>"`, `"appleTeamId": "<Team ID>"`를 추가해 커밋(비밀 아님). `appleId`(이메일)는 넣지 않고 대화형 입력 또는 ASC API 키 사용 권장.
3. (권장) ASC API 키: Users and Access → Integrations → App Store Connect API → 키 생성(App Manager) → `.p8` 다운로드(한 번만 가능) → `eas credentials`에서 업로드. 이후 `eas submit --non-interactive` 가능.

**F. 빌드와 제출**
```bash
cd apps/mobile
eas build -p ios --profile production      # 첫 실행은 대화형: Apple 로그인 → 배포 인증서·프로비저닝 프로필을 EAS가 생성/보관
eas submit -p ios --profile production --latest   # 방금 빌드를 App Store Connect로 업로드 → TestFlight
# 또는 한 번에: eas build -p ios --profile production --auto-submit
```
- 업로드 후 수 분 안에 Apple 메일(ITMS-91053 등 privacy manifest 누락 경고)이 오는지 확인.
- TestFlight 내부 테스트로 실기기 확인 + 스크린샷 촬영(§7).

**G. 심사 제출**
1. §2 메타데이터, §3 연령 등급, §4 App Privacy, §5 심사 정보, §7 스크린샷, §8 배포 국가 입력.
2. 빌드 선택 → "심사에 추가" → 제출.
3. 심사 기간 동안 `/admin/reports`와 데모 계정 상태 확인.

## 11. 열린 질문 (소유자 결정 필요)

1. **Bundle ID** — `com.soulbound.app`로 확정할지. ASC 등록 후 변경 불가. (도메인을 소유하고 있으면 역도메인 형식 권장. `soulbound.app` 도메인 소유가 아니라면 `kr.soulbound.app`/`io.soulbounddao.app` 등도 가능 — 다른 개발자가 이미 쓰는 ID면 등록 단계에서 거부됨.)
2. **운영 도메인** — 이 문서의 `<PROD_ORIGIN>`. 현재 스테이징은 Vercel `*.vercel.app` alias. 개인정보 처리방침 URL은 운영 도메인으로 등록 권장.
3. **지원 URL** — `/support` 정적 페이지(연락 이메일, 신고·계정 삭제 안내)를 웹에 추가할지. 임시로 `/privacy#privacy-officer` 사용 가능. 약관 "문의"가 "초대를 안내한 운영자에게"로만 돼 있어 1.2 "연락처 게시" 요건에 약함.
4. **버전** — 첫 스토어 출시 `0.1.0` 유지 vs `1.0.0`.
5. **"프리알파" 표기** — 앱 설정 화면 배지는 제거 완료. 남은 것은 웹 약관 제8조 "프리알파 고지"(앱에서 `/terms`로 열림). 가이드라인 2.2 지적 위험이 있으니 스토어 제출 전에 문구를 "서비스 변경·중단 고지" 등으로 바꿀지 결정 필요.
6. **판매자/저작권 주체** — 개인 가입(JunTae 실명이 판매자로 표시) vs 조직(SOULBOUND 법인, D-U-N-S 필요).
7. **연령 등급** — 자동 13+ 그대로 vs 16+ override(권장).
8. **App Privacy의 IP/접속 로그** — 미신고(권장, 위 비고) 유지 여부.
9. **약관 무관용 문구** — Apple 1.2는 약관에 "부적절한 콘텐츠·악용 사용자에 대한 무관용"을 명시하라고 요구. 제6조에 추가 제안:
   > 4. 운영자는 불쾌하거나 부적절한 콘텐츠와 다른 멤버를 괴롭히는 행위를 허용하지 않습니다(무관용). 신고된 콘텐츠는 24시간 안에 검토하며, 위반이 확인되면 콘텐츠를 삭제하고 작성자의 멤버십을 정지하거나 상실시킵니다.
10. **게시 전 필터** — 1.2의 "filtering" 요건을 입장 심사 게이트로 설명할지, 서버 금칙어 필터를 추가할지(`apps/web/app/api` 변경 = 별도 태스크).
11. **배포 국가 / EU DSA 거래자 지위** — 한국만 vs EU 포함.
12. **개발 빌드(dev client)** — 현재 `development` 프로필은 dev client 없이 시뮬레이터 Debug 빌드다(앱이 Expo Go로 실행되므로). `expo-dev-client`를 추가하려면 의존성·lockfile 변경이 필요.
