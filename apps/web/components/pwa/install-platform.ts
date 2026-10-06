export type InAppBrowser =
  | "kakaotalk"
  | "naver"
  | "instagram"
  | "facebook"
  | "line"
  | "daum"
  | "webview";

export interface PlatformInput {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
}

export type InstallMode = "native" | "ios" | "in-app" | "none";

export interface InstallModeInput extends PlatformInput {
  readonly standalone: boolean;
  readonly hasPromptEvent: boolean;
  readonly dismissed: boolean;
}

export const INSTALL_DISMISS_KEY = "soulbound.pwa.install-dismissed-at";
export const INSTALL_DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const IN_APP_PATTERNS: ReadonlyArray<readonly [InAppBrowser, RegExp]> = [
  ["kakaotalk", /KAKAOTALK/i],
  ["naver", /NAVER\(inapp|\bNAVER\//i],
  ["instagram", /Instagram/i],
  ["facebook", /FBAN|FBAV|FB_IAB|FBIOS/i],
  ["line", /\bLine\//i],
  ["daum", /DaumApps/i],
];

export function isIos({ userAgent, maxTouchPoints = 0 }: PlatformInput): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return true;
  }
  // iPadOS 13+ Safari reports a desktop "Macintosh" UA; touch support tells it apart.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function isAndroid({ userAgent }: PlatformInput): boolean {
  return /Android/i.test(userAgent);
}

export function detectInAppBrowser(input: PlatformInput): InAppBrowser | null {
  const { userAgent } = input;
  for (const [name, pattern] of IN_APP_PATTERNS) {
    if (pattern.test(userAgent)) {
      return name;
    }
  }
  if (isAndroid(input) && /;\s?wv\)/.test(userAgent)) {
    return "webview";
  }
  if (
    isIos(input) &&
    /AppleWebKit/i.test(userAgent) &&
    !/Safari\//i.test(userAgent)
  ) {
    return "webview";
  }
  return null;
}

export function resolveInstallMode(input: InstallModeInput): InstallMode {
  if (input.standalone || input.dismissed) {
    return "none";
  }
  if (input.hasPromptEvent) {
    return "native";
  }
  if (detectInAppBrowser(input)) {
    return "in-app";
  }
  if (isIos(input)) {
    return "ios";
  }
  return "none";
}

export function externalBrowserUrl(
  input: PlatformInput,
  currentUrl: string,
): string | null {
  const inApp = detectInAppBrowser(input);
  if (!inApp) {
    return null;
  }
  const url = new URL(currentUrl);
  if (url.protocol !== "https:") {
    return null;
  }
  if (inApp === "kakaotalk") {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(url.href)}`;
  }
  if (inApp === "line") {
    url.searchParams.set("openExternalBrowser", "1");
    return url.href;
  }
  if (isAndroid(input)) {
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  return null;
}

export function isDismissalActive(
  storedValue: string | null,
  now: number,
): boolean {
  if (!storedValue) {
    return false;
  }
  const dismissedAt = Number(storedValue);
  if (!Number.isFinite(dismissedAt) || dismissedAt > now) {
    return false;
  }
  return now - dismissedAt < INSTALL_DISMISS_TTL_MS;
}
