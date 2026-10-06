import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { DELETE } from "./[memberNumber]/route";

const mocks = vi.hoisted(() => ({
  resolveUserContext: vi.fn(),
  membershipRepo: { findByUserId: vi.fn() },
  rpc: vi.fn(),
}));

vi.mock("../_lib/auth", () => ({
  resolveUserContext: mocks.resolveUserContext,
}));

vi.mock("@soulbound/adapters", () => ({
  makeSupabaseMembershipRepository: () => mocks.membershipRepo,
}));

function request(method: string, path = "/api/blocks", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function params(memberNumber: string) {
  return { params: Promise.resolve({ memberNumber }) };
}

describe("/api/blocks", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.resolveUserContext.mockReset().mockResolvedValue({
      userId: "user-1",
      client: { rpc: mocks.rpc },
    });
    mocks.membershipRepo.findByUserId.mockReset().mockResolvedValue({ status: "active" });
  });

  it("returns 401 without authentication", async () => {
    mocks.resolveUserContext.mockResolvedValue(null);
    expect((await GET(request("GET"))).status).toBe(401);
    expect((await POST(request("POST", "/api/blocks", { memberNumber: 2 }))).status).toBe(401);
    expect((await DELETE(request("DELETE", "/api/blocks/2"), params("2"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires active membership to block", async () => {
    mocks.membershipRepo.findByUserId.mockResolvedValue({ status: "suspended" });
    expect((await POST(request("POST", "/api/blocks", { memberNumber: 2 }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("lists the caller's blocks by member number only", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ member_number: "12", created_at: "2026-10-06T00:00:00.000Z" }],
      error: null,
    });

    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{
        memberNumber: 12,
        label: "soulbound-member-12",
        createdAt: "2026-10-06T00:00:00.000Z",
      }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("list_my_blocks");
  });

  it("blocks a member", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ member_number: 2, created_at: "2026-10-06T00:00:00.000Z" }],
      error: null,
    });

    const response = await POST(request("POST", "/api/blocks", { memberNumber: 2 }));

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith("block_member", { p_member_number: 2 });
  });

  it("validates input and rejects self-block / unknown members", async () => {
    expect((await POST(request("POST", "/api/blocks", { memberNumber: -1 }))).status).toBe(422);
    expect((await POST(request("POST", "/api/blocks", { userId: "user-2" }))).status).toBe(422);

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "cannot block yourself" } });
    expect((await POST(request("POST", "/api/blocks", { memberNumber: 1 }))).status).toBe(422);

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "member not found" } });
    expect((await POST(request("POST", "/api/blocks", { memberNumber: 999 }))).status).toBe(404);
  });

  it("unblocks idempotently", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    const first = await DELETE(request("DELETE", "/api/blocks/2"), params("2"));
    expect(await first.json()).toEqual({ unblocked: true });

    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    const second = await DELETE(request("DELETE", "/api/blocks/2"), params("2"));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ unblocked: false });
    expect(mocks.rpc).toHaveBeenCalledWith("unblock_member", { p_member_number: 2 });

    expect((await DELETE(request("DELETE", "/api/blocks/abc"), params("abc"))).status).toBe(422);
  });
});
