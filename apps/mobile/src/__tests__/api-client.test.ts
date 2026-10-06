import { ApiNotConfiguredError, buildUrl, createApiClient, UnauthenticatedError } from "../api/client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as Response;
}

describe("api client", () => {
  it("builds urls with query params and strips trailing slashes", () => {
    expect(buildUrl("https://x.test/", "/api/board", { limit: 20, cursor: null })).toBe(
      "https://x.test/api/board?limit=20",
    );
    expect(buildUrl("https://x.test", "/api/board", { cursor: "a b" })).toBe(
      "https://x.test/api/board?cursor=a%20b",
    );
  });

  it("sends the bearer token and JSON body", async () => {
    const fetch = jest.fn(async () => jsonResponse(200, { id: "1" }));
    const api = createApiClient({ baseUrl: "https://x.test", getAccessToken: () => "tok", fetch });
    const result = await api.request<{ id: string }>("/api/board", { method: "POST", body: { body: "hi" } });
    expect(result).toEqual({ ok: true, status: 200, data: { id: "1" } });
    expect(fetch).toHaveBeenCalledWith("https://x.test/api/board", {
      method: "POST",
      headers: {
        authorization: "Bearer tok",
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "hi" }),
    });
  });

  it("returns status for error responses and tolerates empty bodies", async () => {
    const api = createApiClient({
      baseUrl: "https://x.test",
      getAccessToken: () => "tok",
      fetch: async () => jsonResponse(409, undefined),
    });
    await expect(api.request("/api/x")).resolves.toEqual({ ok: false, status: 409, data: null });
  });

  it("throws without a token or base url", async () => {
    const noToken = createApiClient({ baseUrl: "https://x.test", getAccessToken: () => null, fetch: jest.fn() });
    await expect(noToken.request("/api/x")).rejects.toBeInstanceOf(UnauthenticatedError);
    const noBase = createApiClient({ baseUrl: "", getAccessToken: () => "t", fetch: jest.fn() });
    await expect(noBase.request("/api/x")).rejects.toBeInstanceOf(ApiNotConfiguredError);
  });
});
