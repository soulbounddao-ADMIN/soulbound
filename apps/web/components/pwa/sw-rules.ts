import { isCacheablePublicAsset, shouldBypassCache } from "./sw-security";

export type FetchStrategy =
  | "passthrough"
  | "network-only-navigation"
  | "navigation"
  | "cache-first"
  | "stale-while-revalidate";

export interface FetchDecisionInput {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Headers;
  readonly sameOrigin?: boolean;
  readonly mode?: string;
}

const NEVER_INTERCEPT_PATTERNS = [/^\/api(?:\/|$)/, /persona-clip/i];
const RELEASE_FORMAT = /^\d{4}-\d{2}-\d{2}\.\d+$/;

function pathnameOf(url: string): string {
  return new URL(url, "https://soulbound.local").pathname;
}

export function isPageNavigation({
  url,
  method = "GET",
  mode,
  sameOrigin = true,
}: FetchDecisionInput): boolean {
  return (
    method.toUpperCase() === "GET" &&
    mode === "navigate" &&
    sameOrigin &&
    !NEVER_INTERCEPT_PATTERNS.some((pattern) => pattern.test(pathnameOf(url)))
  );
}

export function decideFetchStrategy(input: FetchDecisionInput): FetchStrategy {
  if (shouldBypassCache(input)) {
    return isPageNavigation(input) ? "network-only-navigation" : "passthrough";
  }
  if (isPageNavigation(input)) {
    return "navigation";
  }
  const pathname = pathnameOf(input.url);
  if (pathname.startsWith("/_next/static/")) {
    return "cache-first";
  }
  if (isCacheablePublicAsset(pathname)) {
    return "stale-while-revalidate";
  }
  return "passthrough";
}

export interface CacheableResponseLike {
  readonly status: number;
  readonly type: string;
  readonly redirected: boolean;
}

export function isCacheableResponse(
  response: CacheableResponseLike | null | undefined,
): boolean {
  return Boolean(response) &&
    response!.status === 200 &&
    response!.type === "basic" &&
    !response!.redirected;
}

export function readSwRelease(source: string): string | null {
  return source.match(/const SW_RELEASE = "([^"]+)";/)?.[1] ?? null;
}

export function isValidSwRelease(release: string | null): boolean {
  return release !== null && RELEASE_FORMAT.test(release);
}
