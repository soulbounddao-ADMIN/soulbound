import { describe, expect, it } from "vitest";
import {
  detectInAppBrowser,
  externalBrowserUrl,
  INSTALL_DISMISS_TTL_MS,
  isAndroid,
  isDismissalActive,
  isIos,
  resolveInstallMode,
} from "./install-platform";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  ipadOsSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  kakaoIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5",
  kakaoAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.8.5 (INAPP)",
  naverAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.6.3)",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone15,2; iOS 17_5; ko_KR)",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.79;]",
  lineIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

describe("platform detection", () => {
  it("detects iPhone and iPadOS (desktop UA + touch) as iOS", () => {
    expect(isIos({ userAgent: UA.iphoneSafari })).toBe(true);
    expect(isIos({ userAgent: UA.ipadOsSafari, maxTouchPoints: 5 })).toBe(true);
  });

  it("does not treat desktop macOS Safari as iOS", () => {
    expect(isIos({ userAgent: UA.macSafari, maxTouchPoints: 0 })).toBe(false);
  });

  it("detects Android", () => {
    expect(isAndroid({ userAgent: UA.androidChrome })).toBe(true);
    expect(isAndroid({ userAgent: UA.iphoneSafari })).toBe(false);
  });

  it.each([
    [UA.kakaoIos, "kakaotalk"],
    [UA.kakaoAndroid, "kakaotalk"],
    [UA.naverAndroid, "naver"],
    [UA.instagramIos, "instagram"],
    [UA.facebookAndroid, "facebook"],
    [UA.lineIos, "line"],
    [UA.androidWebView, "webview"],
  ])("detects in-app browser %#", (userAgent, expected) => {
    expect(detectInAppBrowser({ userAgent })).toBe(expected);
  });

  it.each([
    UA.iphoneSafari,
    UA.iphoneChrome,
    UA.androidChrome,
    UA.samsungInternet,
    UA.desktopChrome,
    UA.macSafari,
  ])("does not flag a regular browser as in-app %#", (userAgent) => {
    expect(detectInAppBrowser({ userAgent, maxTouchPoints: 5 })).toBeNull();
  });
});

describe("resolveInstallMode", () => {
  const base = { standalone: false, hasPromptEvent: false, dismissed: false };

  it("hides when already running standalone", () => {
    expect(resolveInstallMode({
      ...base,
      userAgent: UA.androidChrome,
      standalone: true,
      hasPromptEvent: true,
    })).toBe("none");
  });

  it("hides after a remembered dismissal", () => {
    expect(resolveInstallMode({
      ...base,
      userAgent: UA.iphoneSafari,
      dismissed: true,
    })).toBe("none");
  });

  it("uses the native prompt when beforeinstallprompt fired", () => {
    expect(resolveInstallMode({
      ...base,
      userAgent: UA.androidChrome,
      hasPromptEvent: true,
    })).toBe("native");
  });

  it("shows the iOS step guide on iPhone and iPadOS", () => {
    expect(resolveInstallMode({ ...base, userAgent: UA.iphoneSafari })).toBe("ios");
    expect(resolveInstallMode({
      ...base,
      userAgent: UA.ipadOsSafari,
      maxTouchPoints: 5,
    })).toBe("ios");
  });

  it("shows external-browser guidance inside in-app browsers", () => {
    expect(resolveInstallMode({ ...base, userAgent: UA.kakaoIos })).toBe("in-app");
    expect(resolveInstallMode({ ...base, userAgent: UA.naverAndroid })).toBe("in-app");
  });

  it("shows nothing on desktop without a prompt event", () => {
    expect(resolveInstallMode({ ...base, userAgent: UA.desktopChrome })).toBe("none");
    expect(resolveInstallMode({ ...base, userAgent: UA.macSafari })).toBe("none");
  });
});

describe("externalBrowserUrl", () => {
  const page = "https://soulbound.example/login?next=%2Fmember";

  it("uses KakaoTalk's openExternal scheme", () => {
    expect(externalBrowserUrl({ userAgent: UA.kakaoIos }, page)).toBe(
      `kakaotalk://web/openExternal?url=${encodeURIComponent(page)}`,
    );
  });

  it("uses LINE's openExternalBrowser parameter", () => {
    expect(externalBrowserUrl({ userAgent: UA.lineIos }, page)).toBe(
      "https://soulbound.example/login?next=%2Fmember&openExternalBrowser=1",
    );
  });

  it("uses a Chrome intent on Android in-app browsers", () => {
    expect(externalBrowserUrl({ userAgent: UA.naverAndroid }, page)).toBe(
      "intent://soulbound.example/login?next=%2Fmember#Intent;scheme=https;package=com.android.chrome;end",
    );
  });

  it("returns null for iOS in-app browsers without a known scheme", () => {
    expect(externalBrowserUrl({ userAgent: UA.instagramIos }, page)).toBeNull();
  });

  it("returns null for regular browsers and non-https pages", () => {
    expect(externalBrowserUrl({ userAgent: UA.androidChrome }, page)).toBeNull();
    expect(
      externalBrowserUrl({ userAgent: UA.kakaoIos }, "http://localhost:3100/"),
    ).toBeNull();
  });
});

describe("isDismissalActive", () => {
  const now = 1_800_000_000_000;

  it("is inactive without a stored value or with garbage", () => {
    expect(isDismissalActive(null, now)).toBe(false);
    expect(isDismissalActive("not-a-number", now)).toBe(false);
    expect(isDismissalActive(String(now + 1000), now)).toBe(false);
  });

  it("is active inside the TTL and expires after it", () => {
    expect(isDismissalActive(String(now - 1000), now)).toBe(true);
    expect(
      isDismissalActive(String(now - INSTALL_DISMISS_TTL_MS), now),
    ).toBe(false);
  });
});
