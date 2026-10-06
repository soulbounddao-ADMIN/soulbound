import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { toComplianceError } from "../_lib/compliance-errors";

const mocks = vi.hoisted(() => ({
  resolveUserContext: vi.fn(),
  membershipRepo: { findByUserId: vi.fn() },
  repo: {
    create: vi.fn(),
    listMine: vi.fn(),
    listForReview: vi.fn(),
    resolve: vi.fn(),
  },
}));

vi.mock("../_lib/auth", () => ({
  resolveUserContext: mocks.resolveUserContext,
}));

vi.mock("@soulbound/adapters", () => ({
  makeSupabaseMembershipRepository: () => mocks.membershipRepo,
}));

vi.mock("./_lib/supabase-report-repository", () => ({
  SupabaseReportRepository: class {
    constructor() {
      return mocks.repo;
    }
  },
}));

const postId = "b1000000-0000-4000-8000-000000000001";

function request(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/reports", {
    method,
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

const report = {
  id: "report-1",
  targetType: "board_post",
  targetId: postId,
  reason: "spam",
  detail: null,
  status: "open",
  resolutionCode: null,
  resolvedAt: null,
  createdAt: "2026-10-06T00:00:00.000Z",
};

describe("/api/reports", () => {
  beforeEach(() => {
    mocks.resolveUserContext.mockReset().mockResolvedValue({ userId: "user-1", client: {} });
    mocks.membershipRepo.findByUserId.mockReset().mockResolvedValue({ status: "active" });
    mocks.repo.create.mockReset().mockResolvedValue(report);
    mocks.repo.listMine.mockReset().mockResolvedValue([report]);
  });

  it("returns 401 without authentication", async () => {
    mocks.resolveUserContext.mockResolvedValue(null);
    expect((await POST(request("POST", { targetType: "member", targetId: "2", reason: "spam" }))).status).toBe(401);
    expect((await GET(request("GET"))).status).toBe(401);
  });

  it("requires active membership to file a report", async () => {
    mocks.membershipRepo.findByUserId.mockResolvedValue(null);

    const response = await POST(request("POST", { targetType: "member", targetId: "2", reason: "spam" }));

    expect(response.status).toBe(403);
    expect(mocks.repo.create).not.toHaveBeenCalled();
  });

  it("validates the body", async () => {
    const response = await POST(request("POST", { targetType: "board_post", targetId: "nope", reason: "spam" }));
    expect(response.status).toBe(422);
  });

  it("files the report as the caller with normalized detail", async () => {
    const response = await POST(request("POST", {
      targetType: "board_post",
      targetId: postId.toUpperCase(),
      reason: "spam",
      detail: "   ",
    }));

    expect(response.status).toBe(201);
    expect(mocks.repo.create).toHaveBeenCalledWith({
      reporterId: "user-1",
      targetType: "board_post",
      targetId: postId,
      reason: "spam",
      detail: null,
    });
  });

  it("maps duplicate open reports to 409 and rate limits to 429", async () => {
    mocks.repo.create.mockRejectedValueOnce(toComplianceError({ code: "23505" }));
    expect((await POST(request("POST", { targetType: "member", targetId: "2", reason: "spam" }))).status).toBe(409);

    mocks.repo.create.mockRejectedValueOnce(toComplianceError({ code: "SB429" }));
    const limited = await POST(request("POST", { targetType: "member", targetId: "2", reason: "spam" }));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });

  it("maps self reports and missing targets", async () => {
    mocks.repo.create.mockRejectedValueOnce(toComplianceError({ code: "22023" }));
    expect((await POST(request("POST", { targetType: "member", targetId: "2", reason: "spam" }))).status).toBe(422);

    mocks.repo.create.mockRejectedValueOnce(toComplianceError({ code: "P0002" }));
    expect((await POST(request("POST", { targetType: "member", targetId: "2", reason: "spam" }))).status).toBe(404);
  });

  it("lists only the caller's reports", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [report] });
    expect(mocks.repo.listMine).toHaveBeenCalledWith("user-1", 50);
  });
});
