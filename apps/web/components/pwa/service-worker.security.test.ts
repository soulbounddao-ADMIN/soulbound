import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isCacheablePublicAsset,
  shouldBypassCache,
} from "./sw-security";

const serviceWorkerSource = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

describe("service worker cache boundary", () => {
  it.each([
    ["/api/membership/me", "GET", undefined],
    ["/api/admission/persona-clip", "GET", undefined],
    ["/member", "GET", undefined],
    ["/gate", "GET", undefined],
    ["/apply/status", "GET", undefined],
    ["/admin/applications", "GET", undefined],
    ["https://storage.example.com/signed/persona-clip.webm", "GET", false],
    ["/", "POST", undefined],
  ])("bypasses cache for %s", (url, method, sameOrigin) => {
    expect(shouldBypassCache({
      url,
      method,
      ...(sameOrigin === undefined ? {} : { sameOrigin }),
    })).toBe(true);
  });

  it("bypasses cache when Authorization is present", () => {
    expect(shouldBypassCache({
      url: "/",
      headers: new Headers({ Authorization: "Bearer token" }),
    })).toBe(true);
  });

  it("bypasses cache when no-store is requested", () => {
    expect(shouldBypassCache({
      url: "/",
      headers: new Headers({ "Cache-Control": "no-store" }),
    })).toBe(true);
  });

  it.each([
    "/_next/static/chunks/app.js",
    "/icons/icon-192.png",
    "/icon.png",
    "/apple-icon.png",
    "/manifest.webmanifest",
  ])("allows public asset caching for %s", (pathname) => {
    expect(isCacheablePublicAsset(pathname)).toBe(true);
  });

  it("keeps the shipped service worker aligned with private-route bypasses", () => {
    expect(serviceWorkerSource).toContain("shouldBypassCache");
    expect(serviceWorkerSource).toContain("/^\\/api");
    expect(serviceWorkerSource).toContain("authorization");
    expect(serviceWorkerSource).toContain("no-store");
    expect(serviceWorkerSource).toContain("persona-clip");
    expect(serviceWorkerSource).toContain("fetch(request, { cache: \"no-store\" })");
  });
});
