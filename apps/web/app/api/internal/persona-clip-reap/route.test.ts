import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  reapDeletablePersonaClips: vi.fn(),
  serviceRoleStorageAdapter: vi.fn(),
}));

vi.mock("../../_lib/storage", () => ({
  serviceRoleStorageAdapter: storageMocks.serviceRoleStorageAdapter,
}));

import { GET } from "./route";

function cronRequest(secret?: string): Request {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set("authorization", `Bearer ${secret}`);
  }

  return new Request("http://localhost/api/internal/persona-clip-reap", {
    headers,
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("/api/internal/persona-clip-reap", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    storageMocks.reapDeletablePersonaClips.mockReset().mockResolvedValue({
      scanned: 2,
      deleted: 1,
      failed: 0,
      deletedAssetIds: ["asset-1"],
    });
    storageMocks.serviceRoleStorageAdapter.mockReset().mockReturnValue({
      reapDeletablePersonaClips: storageMocks.reapDeletablePersonaClips,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(cronRequest("cron-secret"));

    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({
      error: { code: "UNAVAILABLE" },
    });
    expect(storageMocks.serviceRoleStorageAdapter).not.toHaveBeenCalled();
  });

  it("returns 401 for missing or mismatched authorization", async () => {
    const missingResponse = await GET(cronRequest());
    const mismatchResponse = await GET(cronRequest("wrong-secret"));

    expect(missingResponse.status).toBe(401);
    expect(mismatchResponse.status).toBe(401);
    expect(storageMocks.serviceRoleStorageAdapter).not.toHaveBeenCalled();
  });

  it("returns counts only and logs the full CLI-style summary", async () => {
    const response = await GET(cronRequest("cron-secret"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      scanned: 2,
      deleted: 1,
      failed: 0,
    });
    expect(body).not.toHaveProperty("deletedAssetIds");
    expect(storageMocks.reapDeletablePersonaClips)
      .toHaveBeenCalledWith({});
    expect(console.log).toHaveBeenCalledWith(
      "persona-clip reap scanned=2 deleted=1 failed=0 deletedAssetIds=[\"asset-1\"]",
    );
  });

  it("returns 500 when any deletion failed without exposing asset ids", async () => {
    storageMocks.reapDeletablePersonaClips.mockResolvedValue({
      scanned: 3,
      deleted: 1,
      failed: 2,
      deletedAssetIds: ["asset-1"],
    });

    const response = await GET(cronRequest("cron-secret"));
    const body = await json(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      scanned: 3,
      deleted: 1,
      failed: 2,
    });
    expect(body).not.toHaveProperty("deletedAssetIds");
  });

  it("returns a generic 502 and logs a server-only error on dependency failure", async () => {
    storageMocks.reapDeletablePersonaClips
      .mockRejectedValue(new Error("rpc unavailable"));

    const response = await GET(cronRequest("cron-secret"));
    const body = await json(response);

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: {
        code: "DEPENDENCY_FAILURE",
        message: "dependency failure",
      },
    });
    expect(console.error).toHaveBeenCalledWith(
      "persona-clip reap dependency failure: rpc unavailable",
    );
  });
});
