import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decideFetchStrategy,
  isCacheableResponse,
  isValidSwRelease,
  readSwRelease,
} from "./sw-rules";

const serviceWorkerSource = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

describe("service worker release constant", () => {
  it("declares a single SW_RELEASE in YYYY-MM-DD.N format", () => {
    const release = readSwRelease(serviceWorkerSource);
    expect(isValidSwRelease(release)).toBe(true);
    expect(serviceWorkerSource.match(/const SW_RELEASE =/g)).toHaveLength(1);
  });

  it("derives every cache name from SW_RELEASE", () => {
    expect(serviceWorkerSource).toContain(
      "const CACHE_VERSION = `${CACHE_PREFIX}${SW_RELEASE}`;",
    );
    expect(serviceWorkerSource).not.toContain("soulbound-prealpha-v1");
  });

  it("rejects malformed releases", () => {
    expect(isValidSwRelease(null)).toBe(false);
    expect(isValidSwRelease("v2")).toBe(false);
  });
});

describe("decideFetchStrategy", () => {
  it.each([
    ["/api/membership/me", "GET", undefined],
    ["/api/admission/persona-clip", "GET", "navigate"],
    ["/member", "POST", "navigate"],
    ["/apply/persona-clip/upload", "GET", "no-cors"],
    ["/member", "GET", "cors"],
    ["/gate?_rsc=abc", "GET", "cors"],
  ])("passes %s (%s, %s) through without intercepting", (url, method, mode) => {
    expect(decideFetchStrategy({ url, method, ...(mode ? { mode } : {}) }))
      .toBe("passthrough");
  });

  it("passes cross-origin media through", () => {
    expect(decideFetchStrategy({
      url: "https://storage.example.com/signed/persona-clip.webm",
      sameOrigin: false,
    })).toBe("passthrough");
  });

  it("passes Authorization-bearing and no-store requests through", () => {
    expect(decideFetchStrategy({
      url: "/manifest.webmanifest",
      headers: new Headers({ Authorization: "Bearer token" }),
    })).toBe("passthrough");
    expect(decideFetchStrategy({
      url: "/_next/static/chunks/app.js",
      headers: new Headers({ "Cache-Control": "no-store" }),
    })).toBe("passthrough");
  });

  it.each(["/member", "/gate", "/apply/status", "/admin/applications"])(
    "keeps private navigation %s network-only (offline fallback only)",
    (url) => {
      expect(decideFetchStrategy({ url, mode: "navigate" })).toBe(
        "network-only-navigation",
      );
    },
  );

  it.each(["/", "/login", "/signup", "/terms"])(
    "handles public navigation %s",
    (url) => {
      expect(decideFetchStrategy({ url, mode: "navigate" })).toBe("navigation");
    },
  );

  it("does not intercept non-navigation requests for public pages (RSC fetches)", () => {
    expect(decideFetchStrategy({ url: "/login?_rsc=1", mode: "cors" })).toBe(
      "passthrough",
    );
  });

  it("serves hashed Next assets cache-first", () => {
    expect(decideFetchStrategy({ url: "/_next/static/chunks/app.js" })).toBe(
      "cache-first",
    );
  });

  it.each([
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/maskable-192.png",
    "/icon.png",
    "/apple-icon.png",
  ])("revalidates %s in the background", (url) => {
    expect(decideFetchStrategy({ url })).toBe("stale-while-revalidate");
  });
});

describe("isCacheableResponse", () => {
  it("accepts only same-origin, non-redirected 200 responses", () => {
    expect(isCacheableResponse({ status: 200, type: "basic", redirected: false }))
      .toBe(true);
    expect(isCacheableResponse({ status: 200, type: "basic", redirected: true }))
      .toBe(false);
    expect(isCacheableResponse({ status: 0, type: "opaque", redirected: false }))
      .toBe(false);
    expect(isCacheableResponse({ status: 0, type: "opaqueredirect", redirected: false }))
      .toBe(false);
    expect(isCacheableResponse({ status: 206, type: "basic", redirected: false }))
      .toBe(false);
    expect(isCacheableResponse({ status: 404, type: "basic", redirected: false }))
      .toBe(false);
    expect(isCacheableResponse(undefined)).toBe(false);
  });
});
