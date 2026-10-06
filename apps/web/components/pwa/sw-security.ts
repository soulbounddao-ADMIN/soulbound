export interface CacheDecisionInput {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Headers;
  readonly sameOrigin?: boolean;
}

const PRIVATE_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
  /persona-clip/i,
  /\/admin(?:\/|$)/,
  /\/apply(?:\/|$)/,
  /\/gate(?:\/|$)/,
  /\/member(?:\/|$)/,
];

export function shouldBypassCache({
  url,
  method = "GET",
  headers,
  sameOrigin = true,
}: CacheDecisionInput): boolean {
  if (method.toUpperCase() !== "GET") {
    return true;
  }
  if (!sameOrigin) {
    return true;
  }
  if (headers?.has("authorization")) {
    return true;
  }
  if (headers?.get("cache-control")?.includes("no-store")) {
    return true;
  }

  const { pathname } = new URL(url, "https://soulbound.local");
  return PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isCacheablePublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/manifest.webmanifest"
  );
}
