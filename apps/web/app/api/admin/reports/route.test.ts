import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { POST as resolve } from "./[reportId]/resolve/route";

const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  userClientFromRequest: vi.fn(),
  repo: {
    create: vi.fn(),
    listMine: vi.fn(),
    listForReview: vi.fn(),
    resolve: vi.fn(),
  },
}));

vi.mock("../../_lib/auth", () => ({
  resolveActor: mocks.resolveActor,
  userClientFromRequest: mocks.userClientFromRequest,
}));

vi.mock("@soulbound/adapters", () => ({}));

vi.mock("../../reports/_lib/supabase-report-repository", () => ({
  SupabaseReportRepository: class {
    constructor() {
      return mocks.repo;
    }
  },
}));

const reportId = "4d2a3f9e-0000-4000-8000-000000000001";

function request(path: string, method = "GET", body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ reportId: id }) };
}

describe("reviewer report routes", () => {
  beforeEach(() => {
    mocks.resolveActor.mockReset().mockResolvedValue({ id: "reviewer-1", role: "reviewer" });
    mocks.userClientFromRequest.mockReset().mockReturnValue({});
    mocks.repo.listForReview.mockReset().mockResolvedValue([]);
    mocks.repo.resolve.mockReset().mockResolvedValue({
      id: reportId,
      status: "resolved",
      resolutionCode: "content_removed",
      resolvedAt: "2026-10-06T00:00:00.000Z",
    });
  });

  it("returns 401 without authentication", async () => {
    mocks.resolveActor.mockResolvedValue(null);
    expect((await GET(request("/api/admin/reports"))).status).toBe(401);
    expect((await resolve(
      request(`/api/admin/reports/${reportId}/resolve`, "POST", { status: "resolved", resolutionCode: "content_removed" }),
      params(reportId),
    )).status).toBe(401);
  });

  it("returns 403 for members and applicants", async () => {
    for (const role of ["member", "applicant"]) {
      mocks.resolveActor.mockResolvedValue({ id: "user-1", role });
      expect((await GET(request("/api/admin/reports"))).status).toBe(403);
      expect((await resolve(
        request(`/api/admin/reports/${reportId}/resolve`, "POST", { status: "resolved", resolutionCode: "content_removed" }),
        params(reportId),
      )).status).toBe(403);
    }
    expect(mocks.repo.listForReview).not.toHaveBeenCalled();
    expect(mocks.repo.resolve).not.toHaveBeenCalled();
  });

  it("lets reviewers and admins list reports", async () => {
    for (const role of ["reviewer", "admin"]) {
      mocks.resolveActor.mockResolvedValue({ id: "user-1", role });
      const response = await GET(request("/api/admin/reports?status=all&limit=10"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: [] });
    }
    expect(mocks.repo.listForReview).toHaveBeenCalledWith("all", 10);
  });

  it("validates list queries", async () => {
    expect((await GET(request("/api/admin/reports?status=bogus"))).status).toBe(422);
  });

  it("resolves with an enum resolution code", async () => {
    const response = await resolve(
      request(`/api/admin/reports/${reportId}/resolve`, "POST", { status: "resolved", resolutionCode: "content_removed" }),
      params(reportId),
    );

    expect(response.status).toBe(200);
    expect(mocks.repo.resolve).toHaveBeenCalledWith(reportId, "resolved", "content_removed");
  });

  it("validates resolution input", async () => {
    expect((await resolve(
      request(`/api/admin/reports/${reportId}/resolve`, "POST", { status: "dismissed", resolutionCode: "content_removed" }),
      params(reportId),
    )).status).toBe(422);
    expect((await resolve(
      request("/api/admin/reports/not-a-uuid/resolve", "POST", { status: "resolved", resolutionCode: "content_removed" }),
      params("not-a-uuid"),
    )).status).toBe(422);
    expect(mocks.repo.resolve).not.toHaveBeenCalled();
  });
});
