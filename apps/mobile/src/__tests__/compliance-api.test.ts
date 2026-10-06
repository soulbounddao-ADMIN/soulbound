import { createApiClient } from "../api/client";
import {
  blockMember,
  createReport,
  deleteAccount,
  listMyBlocks,
  unblockMember,
} from "../api/endpoints";
import { resolvePrivacyPolicyUrl } from "../config";
import { reportReasons, reportResultMessage, toReportRequest } from "../lib/safety";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as Response;
}

function client(status = 200, body: unknown = {}) {
  const fetch = jest.fn(async (_input: string, _init: RequestInit) => jsonResponse(status, body));
  return { fetch, api: createApiClient({ baseUrl: "https://x.test/", getAccessToken: () => "tok", fetch }) };
}

const jsonHeaders = {
  authorization: "Bearer tok",
  accept: "application/json",
  "content-type": "application/json",
};

describe("store compliance api calls", () => {
  it("deletes the account with the explicit confirmation", async () => {
    const { api, fetch } = client(200, { deleted: true, personaClipsRemoved: 0 });
    await expect(deleteAccount(api)).resolves.toEqual({
      ok: true,
      status: 200,
      data: { deleted: true, personaClipsRemoved: 0 },
    });
    expect(fetch).toHaveBeenCalledWith("https://x.test/api/account", {
      method: "DELETE",
      headers: jsonHeaders,
      body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }),
    });
  });

  it("creates reports", async () => {
    const { api, fetch } = client(201, { id: "r1" });
    const body = toReportRequest({ kind: "comment", id: "c1" }, "harassment", "  너무 심해요 ");
    const result = await createReport(api, body);
    expect(result.status).toBe(201);
    expect(fetch).toHaveBeenCalledWith("https://x.test/api/reports", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        targetType: "board_comment",
        targetId: "c1",
        reason: "harassment",
        detail: "너무 심해요",
      }),
    });
  });

  it("lists, blocks and unblocks members by member number", async () => {
    const { api, fetch } = client(200, { items: [] });
    await listMyBlocks(api);
    await blockMember(api, 12);
    await unblockMember(api, 12);
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
      ["https://x.test/api/blocks", "GET", undefined],
      ["https://x.test/api/blocks", "POST", JSON.stringify({ memberNumber: 12 })],
      ["https://x.test/api/blocks/12", "DELETE", undefined],
    ]);
  });
});

describe("report helpers", () => {
  it("maps targets and drops empty / overlong detail", () => {
    expect(toReportRequest({ kind: "post", id: "p1" }, "spam")).toEqual({
      targetType: "board_post",
      targetId: "p1",
      reason: "spam",
    });
    expect(toReportRequest({ kind: "member", id: "7" }, "other", "   ")).toEqual({
      targetType: "member",
      targetId: "7",
      reason: "other",
    });
    expect(toReportRequest({ kind: "post", id: "p1" }, "other", "x".repeat(600)).detail).toHaveLength(500);
  });

  it("offers every server reason and maps statuses to messages", () => {
    expect(reportReasons.map((reason) => reason.value)).toEqual([
      "spam", "harassment", "hate", "sexual", "violence", "illegal", "impersonation", "privacy", "other",
    ]);
    expect(reportResultMessage(201)).toContain("접수");
    expect(reportResultMessage(409)).toContain("이미");
    expect(reportResultMessage(429)).toContain("잠시 후");
    expect(reportResultMessage(500)).toContain("접수하지 못했습니다");
  });
});

describe("privacy policy url", () => {
  it("defaults to the web /privacy page unless overridden", () => {
    expect(resolvePrivacyPolicyUrl("", "https://web.test/")).toBe("https://web.test/privacy");
    expect(resolvePrivacyPolicyUrl("https://legal.test/p", "https://web.test")).toBe("https://legal.test/p");
    expect(resolvePrivacyPolicyUrl("", "")).toBe("");
  });
});
