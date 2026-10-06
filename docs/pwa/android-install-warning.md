# Android "unsafe app" / install warning — diagnosis checklist

Android Chrome installs a PWA as a **WebAPK**: Chrome sends the manifest URL to Google's WebAPK
minting server, which fetches the manifest and icons **anonymously from the public internet** and
returns a signed APK. If minting fails, Chrome falls back to a plain home-screen shortcut, and some
devices / launchers (Samsung Internet, Play Protect) then show "unsafe app", "앱이 설치되지 않았습니다"
or "출처를 알 수 없는 앱" style warnings. Almost every case below is a hosting problem, not app code.

## 1. Public HTTPS origin
- [ ] The site is served over HTTPS with a valid public certificate (no self-signed, no LAN IP,
      no `localhost`, no `http://`). `localhost` installs are shortcuts only and are not minted.
- [ ] No mixed content on `/`, `/manifest.webmanifest`, `/icons/*`.

## 2. Manifest + icons reachable without auth
Run from a machine that is **not logged in** and has no cookies:
```bash
ORIGIN=https://<production-host>
for p in /manifest.webmanifest /icons/icon-192.png /icons/icon-512.png \
         /icons/maskable-192.png /icons/maskable-512.png /apple-icon.png /sw.js; do
  curl -s -o /dev/null -w "%{http_code} %{content_type} %{redirect_url} $p\n" "$ORIGIN$p"
done
```
- [ ] Every line is `200`, correct content type, **no redirect** (a 30x to a login/SSO page breaks minting).
- [ ] `/manifest.webmanifest` is `application/manifest+json` and its `icons[].src` resolve to 200s.
- [ ] No middleware / proxy / basic-auth / WAF challenge (Cloudflare bot fight, etc.) on these paths.
      The repo currently has no Next middleware; keep it that way for these paths if one is added.

## 3. Vercel Deployment Protection / preview domains
- [ ] **Vercel Deployment Protection (Vercel Authentication / Password / Trusted IPs) is OFF for the
      domain users install from.** With protection on, Google's minting server gets a 401/redirect
      for the manifest and icons → no WebAPK → shortcut + warning.
- [ ] Users install from the stable production domain, not a `*.vercel.app` preview/branch URL.
      Preview URLs are usually protected, change per deployment, and give each install a different
      origin (the install is bound to origin + manifest `id`).
- [ ] If a protection bypass is needed for testing, use a dedicated public test domain; never put a
      bypass token in the manifest or in the repo.

## 4. Manifest identity stability
- [ ] `id` stays `"/"` and `start_url`/`scope` stay `"/"`. Changing `id`, origin, or `scope` makes
      Chrome treat it as a different app (duplicate icons, update failures, re-mint).
- [ ] Icons: `purpose: "any"` 192 + 512 and `purpose: "maskable"` 192 + 512 are all PNG with the
      declared real pixel size (verified by `file apps/web/public/icons/*.png`).
- [ ] Changing name/icons later triggers a WebAPK update (Chrome checks roughly daily); that only
      works if the manifest is still publicly reachable.

## 5. Browser / OS specific behaviour
- **Chrome (Android):** check `chrome://webapks` on the device — a minted app has a WebAPK package
  name (`org.chromium.webapk.*`). If missing, minting failed → go back to sections 1–3.
  DevTools → Application → Manifest shows installability errors.
- **Samsung Internet:** does not use Google's WebAPK server in all versions; it may install via its
  own mechanism or as a shortcut and can show its own "unknown source" prompt. Test separately.
- **Play Protect:** WebAPKs minted by Google are signed and normally pass. A warning usually means the
  device installed an unsigned / unminted package or a third-party "web to APK" wrapper — users
  should install only via the browser menu ("앱 설치" / "홈 화면에 추가").
- **In-app browsers** (KakaoTalk, Naver, Instagram, Facebook, LINE, Android WebView): cannot install
  at all. The in-app install prompt tells users to open Chrome (intent link on Android).
- Work profiles / MDM may block WebAPK installs regardless of the site.

## 6. What to collect from a reporter
1. Exact warning text + screenshot, browser + version, Android version, device model.
2. The URL they installed from (production vs preview).
3. Whether `chrome://webapks` lists SoulBound.
4. Output of the curl loop in section 2 run at the same time.

## Code-side state (this repo)
- Manifest + icons are static/public routes (`app/manifest.ts`, `public/icons/*`), no auth gating.
- No code change can fix Deployment Protection or a preview-domain install — those are hosting
  settings and must be checked on the Vercel project by an operator.
