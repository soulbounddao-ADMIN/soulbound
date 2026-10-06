# Mobile (iPhone) implementation notes — 감사 전/미승인

Branch `devin/ios-expo-app-2026-10-06` (fork). Package `apps/mobile` (`@soulbound/mobile`).
Stack: Expo SDK 57 (`expo ~57.0.26`), React Native 0.86.3, React 19.2.3, expo-router 57, `@supabase/supabase-js` 2.x, `expo-secure-store`, jest-expo 57.

## Boundaries

- Supabase is imported only in `apps/mobile/src/auth/supabase-auth-client.ts` (password auth, session, `current_user_role` RPC). Screens use `useAuth()` + `src/api/endpoints.ts`.
- Session storage: `expo-secure-store` via a chunked adapter (`src/auth/chunked-storage.ts`) because Keychain values are limited (~2KB) and Supabase sessions can exceed that.
- API client (`src/api/client.ts`): base URL from `EXPO_PUBLIC_API_BASE_URL` or `app.config.ts` `extra.apiBaseUrl`; always sends `Authorization: Bearer <access_token>`. 401 → local session cleared → protected navigator returns to landing/login.
- `@soulbound/core` imported type-only. Web API response types (board/vote/members) are mirrored in `src/api/types.ts` rather than imported from `apps/web/app/api/**`.
- No changes to protected areas (`packages/*`, `supabase/`, `apps/web/**`, toolchain files, existing tests). No `expo-notifications`, chain SDKs, chat/DM.

## Screens / flows

| Priority | Status | Screens |
| --- | --- | --- |
| P1 auth | **Done** | `/` landing + session restore, `/login`, `/signup` (terms consent required, terms + privacy links), sign out (Settings), role routing (`resolveHomeRoute`: reviewer/admin → `/reviewer`, member or active membership → `/member`, else `/gate`), `/gate` |
| P2 applicant | **Done (without Persona Clip)** | `/apply` (statement, idempotency key reused across retries), `/apply/status` (status badge, reviewer notice, needs-more-info resubmit with idempotency key, 409 → reload) |
| P3 member | **Done** | `/member` tabs: 멤버 (membership + directory with paging), 투표 (list), 게시판 (list + create), 더보기 (settings); `/vote/[voteId]` (detail, cast yes/no, 409 handling, results when closed); `/board/[postId]` (detail, comments, add comment, delete own post/comment). Edit is not offered because the web/API has no edit endpoint. |
| P4 settings / store | **Done (backend wired; privacy policy is the final web page)** | `/settings` (+ member 더보기): sign out, privacy policy link (default `${API_BASE_URL}/privacy`), terms link (web `/terms`), server-backed block list with unblock (`/api/blocks`, secure-store optimistic cache), 계정 삭제 confirmation → `DELETE /api/account` → sign out, app version. Report menu on posts, comments, directory members → reason picker + optional text (iOS `Alert.prompt`) → `POST /api/reports`. |
| P5 reviewer/admin | **Not done** | `/reviewer` only shows a notice + link to web `/admin/applications`. |

Persona Clip: **not implemented on mobile.** Strict INV-PC rules (in-app capture only, no library/preview/retake/edit) plus the existing `/api/admission/persona-clip` upload contract would require adding a camera/recording module and an upload pipeline that has not been audited; the apply flow ships without it (clip is optional, absence never blocks submit). No camera/microphone usage strings are declared. Vote-detail clip playback is also web-only.

## API endpoints used

- `GET /api/admission/applications/me`
- `GET /api/admission/applications/{id}`
- `POST /api/admission/applications` `{ idempotencyKey, applicantStatement? }`
- `POST /api/admission/applications/{id}/resubmit` `{ idempotencyKey, applicantStatement? }`
- `GET /api/membership/me`
- `GET /api/members?limit=50&cursor=`
- `GET /api/board?limit=20&cursor=`, `POST /api/board` `{ body }`
- `GET /api/board/{postId}`, `DELETE /api/board/{postId}`
- `POST /api/board/{postId}/comments` `{ body }`, `DELETE /api/board/{postId}/comments/{commentId}`
- `GET /api/vote/applications?limit=20&cursor=`, `GET /api/vote/applications/{voteId}`
- `POST /api/vote/applications/{voteId}/cast` `{ choice: "yes" | "no" }`
- `DELETE /api/account` `{ confirm: "DELETE_MY_ACCOUNT" }`
- `POST /api/reports` `{ targetType, targetId, reason, detail? }`
- `GET /api/blocks`, `POST /api/blocks` `{ memberNumber }`, `DELETE /api/blocks/{memberNumber}`
- Supabase Auth (auth module only): `signInWithPassword`, `signUp` (synthetic `<username>@soulbound.internal`, `user_already_exists` → 이미 사용 중인 아이디), `signOut`, `getSession`/auto refresh, RPC `current_user_role`.

Not used: `/api/admission/persona-clip`, `/api/vote/applications/{voteId}/persona-clip-url`, all `/api/admin/**`.

## BLOCKERS

1. `/privacy` is the final policy (effective 2026-10-06; owner waived legal review). Register the deployed URL in App Store Connect. See `docs/store-compliance/IMPLEMENTATION_NOTES.md`.
2. Production Supabase must get migration `0014_store_compliance.sql` and the web must be redeployed before the in-app deletion/report/block calls work; reports need an operator routine at web `/admin/reports`.
3. Store-compliance backend: done on `devin/store-compliance-api-2026-10-06` (account deletion, reports, blocks).
4. Persona Clip recording/playback not implemented on mobile.
5. Reviewer/admin screens (P5) not implemented.
6. Apple Developer Program / Expo account / EAS project ID / demo reviewer account must be provisioned by the owner. No EAS build/submit was run.

## Toolchain

- No toolchain file changed; no `allowBuilds` entry needed.
- New deps only in `apps/mobile/package.json`. Peer deps pinned to SDK 57 versions to keep `pnpm peers check` clean: `react-dom 19.2.3`, `react-native-worklets 0.10.1`, `react-native-reanimated 4.5.1`, `@react-native/metro-config 0.86.3`.
- Lockfile side effect: the `apps/web`/`packages/*` importer entries keep the same versions, but pnpm re-keyed peer suffixes because optional peers now exist in the workspace (`next@16.2.7(babel-plugin-react-compiler@1.0.0)…`, `vite/vitest(…)(lightningcss@1.33.0)(terser@5.51.2)`). Web build/tests unchanged.

## Gate results (2026-10-06, Node 24.21.0, pnpm 11.1.3)

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — "Already up to date" |
| `pnpm -r typecheck` | PASS — core / adapters / web / mobile `Done` |
| `pnpm -F @soulbound/core test` | PASS — 3 files, 26 tests |
| `pnpm -F @soulbound/adapters test` | PASS — 8 files, 25 tests |
| `pnpm -F web test` | PASS — 23 files, 191 tests |
| `bash scripts/audit.sh` | PASS — `AUDIT PASSED` |
| `pnpm -F web build` | PASS — `Compiled successfully`, 22/22 static pages |
| `pnpm -F @soulbound/mobile typecheck` | PASS |
| `pnpm -F @soulbound/mobile test` | PASS — 5 suites, 18 tests |
| `npx expo-doctor` | PASS — 21/21 checks |
| `npx expo export --platform ios` | PASS — 1189 modules, `entry-*.hbc` 3.1MB, `Exported: dist` (gitignored) |

Not verified: running on a real iPhone/simulator (no macOS in the build environment) and live calls against a deployed backend.
