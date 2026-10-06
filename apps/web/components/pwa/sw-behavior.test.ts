import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideFetchStrategy } from "./sw-rules";

const serviceWorkerSource = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const ORIGIN = "https://soulbound.example";

type Listener = (event: unknown) => void;

interface FakeRequest {
  readonly url: string;
  readonly method: string;
  readonly mode: string;
  readonly headers: Headers;
}

function keyOf(input: string | FakeRequest | Request): string {
  const url = typeof input === "string" ? input : input.url;
  const parsed = new URL(url, ORIGIN);
  return parsed.pathname + parsed.search;
}

function makeResponse(
  body: string,
  { status = 200, type = "basic", redirected = false } = {},
): Response {
  const response = new Response(body, { status: status >= 200 ? status : 200 });
  Object.defineProperty(response, "status", { value: status });
  Object.defineProperty(response, "type", { value: type });
  Object.defineProperty(response, "redirected", { value: redirected });
  Object.defineProperty(response, "clone", {
    value: () => makeResponse(body, { status, type, redirected }),
  });
  return response;
}

class FakeCacheStorage {
  readonly stores = new Map<string, Map<string, Response>>();

  async open(name: string) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    const store = this.stores.get(name)!;
    return {
      put: async (key: string | FakeRequest, response: Response) => {
        store.set(keyOf(key), response);
      },
      match: async (key: string | FakeRequest) => store.get(keyOf(key))?.clone(),
    };
  }

  async keys() {
    return [...this.stores.keys()];
  }

  async delete(name: string) {
    return this.stores.delete(name);
  }

  async match(key: string, options?: { cacheName?: string }) {
    const names = options?.cacheName ? [options.cacheName] : [...this.stores.keys()];
    for (const name of names) {
      const hit = this.stores.get(name)?.get(keyOf(key));
      if (hit) {
        return hit.clone();
      }
    }
    return undefined;
  }
}

function loadServiceWorker() {
  const listeners = new Map<string, Listener>();
  const caches = new FakeCacheStorage();
  const fetchMock = vi.fn<(input: unknown, init?: RequestInit) => Promise<Response>>();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  vm.runInNewContext(serviceWorkerSource, {
    self,
    caches,
    fetch: fetchMock,
    Request: class extends Request {
      constructor(input: string, init?: RequestInit) {
        super(new URL(input, ORIGIN), init);
      }
    },
    Response,
    Headers,
    URL,
    Promise,
    Error,
    Boolean,
    console,
  });
  return { listeners, caches, fetchMock, self };
}

function request(
  path: string,
  { method = "GET", mode = "cors", headers = {} as Record<string, string> } = {},
): FakeRequest {
  return {
    url: new URL(path, ORIGIN).href,
    method,
    mode,
    headers: new Headers(headers),
  };
}

function dispatchFetch(
  sw: ReturnType<typeof loadServiceWorker>,
  req: FakeRequest,
) {
  const respondWith = vi.fn();
  const waitUntil = vi.fn();
  sw.listeners.get("fetch")!({ request: req, respondWith, waitUntil });
  return { respondWith, waitUntil };
}

async function dispatchExtendable(
  sw: ReturnType<typeof loadServiceWorker>,
  type: "install" | "activate",
) {
  let pending: Promise<unknown> = Promise.resolve();
  sw.listeners.get(type)!({
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    },
  });
  return pending;
}

describe("shipped service worker behaviour", () => {
  let sw: ReturnType<typeof loadServiceWorker>;

  beforeEach(() => {
    sw = loadServiceWorker();
  });

  it.each([
    ["/api/membership/me", {}],
    ["/api/membership/me", { mode: "navigate" }],
    ["/api/admission/persona-clip", {}],
    ["/apply/persona-clip/upload", { mode: "no-cors" }],
    ["/member?_rsc=1", {}],
    ["/", { method: "POST", mode: "navigate" }],
    ["/manifest.webmanifest", { headers: { Authorization: "Bearer token" } }],
    ["/_next/static/chunks/app.js", { headers: { "Cache-Control": "no-store" } }],
    ["/some/unknown.json", {}],
  ])("does not call respondWith for %s %j", (path, options) => {
    const req = request(path, options);
    const { respondWith } = dispatchFetch(sw, req);
    expect(respondWith).not.toHaveBeenCalled();
    expect(decideFetchStrategy({ ...req, sameOrigin: true })).toBe("passthrough");
  });

  it("does not intercept cross-origin requests", () => {
    const req = {
      ...request("/"),
      url: "https://storage.example.com/signed/persona-clip.webm",
    };
    expect(dispatchFetch(sw, req).respondWith).not.toHaveBeenCalled();
  });

  it("keeps private navigations network-only and never caches them", async () => {
    sw.fetchMock.mockResolvedValue(makeResponse("<html>member</html>"));
    const { respondWith } = dispatchFetch(sw, request("/member", { mode: "navigate" }));
    const response = await respondWith.mock.calls[0]![0];
    expect(await response.text()).toBe("<html>member</html>");
    expect(sw.fetchMock.mock.calls[0]![1]).toEqual({ cache: "no-store" });
    for (const store of sw.caches.stores.values()) {
      expect([...store.keys()]).not.toContain("/member");
    }
  });

  it("serves the offline page when a navigation fails", async () => {
    sw.fetchMock.mockImplementation(async (input) =>
      makeResponse(`precached ${keyOf(input as Request)}`));
    await dispatchExtendable(sw, "install");
    sw.fetchMock.mockRejectedValue(new TypeError("offline"));

    const priv = dispatchFetch(sw, request("/member", { mode: "navigate" }));
    expect(await (await priv.respondWith.mock.calls[0]![0]).text()).toBe(
      "precached /offline.html",
    );

    const pub = dispatchFetch(sw, request("/terms", { mode: "navigate" }));
    expect(await (await pub.respondWith.mock.calls[0]![0]).text()).toBe(
      "precached /offline.html",
    );

    const shell = dispatchFetch(sw, request("/login", { mode: "navigate" }));
    expect(await (await shell.respondWith.mock.calls[0]![0]).text()).toBe(
      "precached /login",
    );
  });

  it("install survives a failing shell URL but requires the offline page", async () => {
    sw.fetchMock.mockImplementation(async (input) => {
      const key = keyOf(input as Request);
      if (key === "/signup") {
        throw new TypeError("network");
      }
      return makeResponse(`precached ${key}`);
    });
    await expect(dispatchExtendable(sw, "install")).resolves.toBeUndefined();
    const [shellName] = [...sw.caches.stores.keys()];
    expect([...sw.caches.stores.get(shellName!)!.keys()].sort()).toEqual(
      ["/", "/login", "/offline.html"],
    );

    const failing = loadServiceWorker();
    failing.fetchMock.mockResolvedValue(makeResponse("nope", { status: 500 }));
    await expect(dispatchExtendable(failing, "install")).rejects.toThrow(
      /offline\.html/,
    );
  });

  it("does not skipWaiting on install, only on SKIP_WAITING message", async () => {
    sw.fetchMock.mockImplementation(async () => makeResponse("ok"));
    await dispatchExtendable(sw, "install");
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.listeners.get("message")!({ data: { type: "OTHER" } });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.listeners.get("message")!({ data: { type: "SKIP_WAITING" } });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("never caches redirected or opaque responses", async () => {
    sw.fetchMock.mockResolvedValueOnce(
      makeResponse("redirected", { redirected: true }),
    );
    let call = dispatchFetch(sw, request("/login", { mode: "navigate" }));
    await call.respondWith.mock.calls[0]![0];

    sw.fetchMock.mockResolvedValueOnce(
      makeResponse("", { status: 0, type: "opaque" }),
    );
    call = dispatchFetch(sw, request("/_next/static/chunks/app.js"));
    await call.respondWith.mock.calls[0]![0];

    for (const store of sw.caches.stores.values()) {
      expect(store.size).toBe(0);
    }
  });

  it("serves manifest/icons stale-while-revalidate", async () => {
    sw.fetchMock.mockResolvedValueOnce(makeResponse("v1"));
    let call = dispatchFetch(sw, request("/manifest.webmanifest"));
    expect(await (await call.respondWith.mock.calls[0]![0]).text()).toBe("v1");
    await call.waitUntil.mock.calls[0]![0];

    sw.fetchMock.mockResolvedValueOnce(makeResponse("v2"));
    call = dispatchFetch(sw, request("/manifest.webmanifest"));
    expect(await (await call.respondWith.mock.calls[0]![0]).text()).toBe("v1");
    await call.waitUntil.mock.calls[0]![0];

    sw.fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    call = dispatchFetch(sw, request("/manifest.webmanifest"));
    expect(await (await call.respondWith.mock.calls[0]![0]).text()).toBe("v2");
    await call.waitUntil.mock.calls[0]![0];
  });

  it("serves hashed Next assets cache-first", async () => {
    sw.fetchMock.mockResolvedValueOnce(makeResponse("chunk"));
    let call = dispatchFetch(sw, request("/_next/static/chunks/app.js"));
    await call.respondWith.mock.calls[0]![0];
    call = dispatchFetch(sw, request("/_next/static/chunks/app.js"));
    expect(await (await call.respondWith.mock.calls[0]![0]).text()).toBe("chunk");
    expect(sw.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("activate removes caches from older releases (incl. prealpha-v1) only", async () => {
    await sw.caches.open("soulbound-prealpha-v1:assets");
    await sw.caches.open("soulbound-prealpha-v1:shell");
    await sw.caches.open("unrelated-cache");
    sw.fetchMock.mockImplementation(async () => makeResponse("ok"));
    await dispatchExtendable(sw, "install");
    await dispatchExtendable(sw, "activate");
    const names = [...sw.caches.stores.keys()];
    expect(names).toContain("unrelated-cache");
    expect(names.some((name) => name.startsWith("soulbound-prealpha-v1"))).toBe(false);
    expect(names.some((name) => /^soulbound-\d{4}-\d{2}-\d{2}\.\d+:shell$/.test(name)))
      .toBe(true);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });
});
