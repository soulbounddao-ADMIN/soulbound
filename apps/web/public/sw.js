/*
 * SoulBound service worker (hand-rolled, no build step).
 *
 * RELEASE / VERSIONING
 * - SW_RELEASE is the single cache-version constant. Bump it once per release that changes this
 *   file, the precached shell (OFFLINE_URL / PUBLIC_SHELL_PATHS) or the icon/manifest set
 *   (format: YYYY-MM-DD.N). Every cache name is derived from it; activate deletes every
 *   "soulbound-*" cache that does not belong to the current release.
 * - A new worker waits (no automatic skipWaiting). The page shows an update banner and posts
 *   { type: "SKIP_WAITING" } when the user accepts.
 *
 * CACHE BOUNDARY (see components/pwa/sw-security.ts + sw-rules.ts, guarded by tests)
 * - shouldBypassCache(): non-GET, cross-origin, Authorization, no-store, /api, persona-clip,
 *   /admin, /apply, /gate, /member are never cached.
 * - Bypassed requests are not intercepted (no respondWith) so the browser handles them natively
 *   (media / upload streams, Safari). The only exception is a same-origin GET page navigation
 *   to a private page, which goes network-only via fetch(request, { cache: "no-store" }) so a
 *   failed navigation can show the static offline page. /api and persona-clip are never touched.
 * - Only status-200, same-origin ("basic"), non-redirected responses are ever cached.
 */
const SW_RELEASE = "2026-10-06.1";
const CACHE_PREFIX = "soulbound-";
const CACHE_VERSION = `${CACHE_PREFIX}${SW_RELEASE}`;
const ASSET_CACHE = `${CACHE_VERSION}:assets`;
const SHELL_CACHE = `${CACHE_VERSION}:shell`;
const OFFLINE_URL = "/offline.html";
const PUBLIC_SHELL_PATHS = ["/", "/login", "/signup"];
const PRIVATE_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
  /persona-clip/i,
  /\/admin(?:\/|$)/,
  /\/apply(?:\/|$)/,
  /\/gate(?:\/|$)/,
  /\/member(?:\/|$)/,
];
const NEVER_INTERCEPT_PATTERNS = [/^\/api(?:\/|$)/, /persona-clip/i];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldBypassCache(request) {
  if (request.method !== "GET") {
    return true;
  }
  const url = new URL(request.url);
  if (!sameOrigin(url)) {
    return true;
  }
  if (request.headers.has("authorization")) {
    return true;
  }
  if ((request.headers.get("cache-control") || "").includes("no-store")) {
    return true;
  }
  return PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function isPageNavigation(request) {
  if (request.method !== "GET" || request.mode !== "navigate") {
    return false;
  }
  const url = new URL(request.url);
  return sameOrigin(url) &&
    !NEVER_INTERCEPT_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function isImmutableAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}

function isRevalidatedPublicAsset(pathname) {
  return (
    pathname.startsWith("/icons/") ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/manifest.webmanifest"
  );
}

function isCacheableResponse(response) {
  return Boolean(response) &&
    response.status === 200 &&
    response.type === "basic" &&
    !response.redirected;
}

async function precache(cache, path) {
  const response = await fetch(new Request(path, { cache: "reload" }));
  if (!isCacheableResponse(response)) {
    throw new Error(`precache failed: ${path}`);
  }
  await cache.put(path, response);
}

async function offlineResponse() {
  const cached = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
  if (cached) {
    return cached;
  }
  return new Response("오프라인 상태입니다. 연결을 확인한 뒤 다시 시도해 주세요.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function privateNavigation(request) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch {
    return offlineResponse();
  }
}

async function publicNavigation(request) {
  const { pathname } = new URL(request.url);
  const isShell = PUBLIC_SHELL_PATHS.includes(pathname);
  try {
    const response = await fetch(request);
    if (isShell && isCacheableResponse(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(pathname, response.clone());
    }
    return response;
  } catch {
    if (isShell) {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(pathname);
      if (cached) {
        return cached;
      }
    }
    return offlineResponse();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const network = caches.open(ASSET_CACHE).then(async (cache) => {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  });
  const settled = network.catch(() => undefined);
  event.waitUntil(settled);
  return caches.open(ASSET_CACHE)
    .then((cache) => cache.match(request))
    .then((cached) => cached || network);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await precache(cache, OFFLINE_URL);
    await Promise.allSettled(
      PUBLIC_SHELL_PATHS.map((path) => precache(cache, path)),
    );
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) =>
            key.startsWith(CACHE_PREFIX) && !key.startsWith(`${CACHE_VERSION}:`))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (shouldBypassCache(request)) {
    if (isPageNavigation(request)) {
      event.respondWith(privateNavigation(request));
    }
    return;
  }

  if (isPageNavigation(request)) {
    event.respondWith(publicNavigation(request));
    return;
  }

  const { pathname } = new URL(request.url);
  if (isImmutableAsset(pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isRevalidatedPublicAsset(pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
