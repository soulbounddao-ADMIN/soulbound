import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  resolveUserContext: vi.fn(),
  gateway: {
    prepare: vi.fn(),
    purgePersonaClips: vi.fn(),
    deleteAuthUser: vi.fn(),
    complete: vi.fn(),
  },
}));

vi.mock("../_lib/auth", () => ({
  resolveUserContext: mocks.resolveUserContext,
}));

vi.mock("./_lib/account-deletion-context", () => ({
  serviceRoleAccountDeletionGateway: () => mocks.gateway,
}));

function request(body: unknown, token = true): Request {
  return new Request("http://localhost/api/account", {
    method: "DELETE",
    headers: {
      ...(token ? { authorization: "Bearer token" } : {}),
      "content-type": "application/json",
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    mocks.resolveUserContext.mockReset().mockResolvedValue({
      userId: "user-1",
      client: {},
    });
    mocks.gateway.prepare.mockReset().mockResolvedValue({
      personaClipAssetIds: ["clip-1"],
    });
    mocks.gateway.purgePersonaClips.mockReset().mockResolvedValue({
      deletedAssetIds: ["clip-1"],
    });
    mocks.gateway.deleteAuthUser.mockReset().mockResolvedValue("deleted");
    mocks.gateway.complete.mockReset().mockResolvedValue(undefined);
  });

  it("returns 401 without an authenticated user", async () => {
    mocks.resolveUserContext.mockResolvedValue(null);

    const response = await DELETE(request({ confirm: "DELETE_MY_ACCOUNT" }, false));

    expect(response.status).toBe(401);
    expect(mocks.gateway.prepare).not.toHaveBeenCalled();
  });

  it("requires the explicit confirmation field", async () => {
    for (const body of [undefined, {}, { confirm: "yes" }]) {
      const response = await DELETE(request(body));
      expect(response.status).toBe(422);
    }
    expect(mocks.gateway.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("cannot target another user", async () => {
    const response = await DELETE(request({
      confirm: "DELETE_MY_ACCOUNT",
      userId: "user-2",
    }));

    expect(response.status).toBe(422);
    expect(mocks.gateway.prepare).not.toHaveBeenCalled();
  });

  it("deletes only the caller's account", async () => {
    const response = await DELETE(request({ confirm: "DELETE_MY_ACCOUNT" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, personaClipsRemoved: 1 });
    expect(mocks.gateway.prepare).toHaveBeenCalledWith("user-1");
    expect(mocks.gateway.purgePersonaClips).toHaveBeenCalledWith("user-1", ["clip-1"]);
    expect(mocks.gateway.deleteAuthUser).toHaveBeenCalledWith("user-1");
    expect(mocks.gateway.complete).toHaveBeenCalledWith("user-1");
  });

  it("returns 502 without leaking details when a dependency fails", async () => {
    mocks.gateway.purgePersonaClips.mockRejectedValue(new Error("secret detail"));

    const response = await DELETE(request({ confirm: "DELETE_MY_ACCOUNT" }));

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret detail");
    expect(mocks.gateway.deleteAuthUser).not.toHaveBeenCalled();
    expect(mocks.gateway.complete).not.toHaveBeenCalled();
  });

  it("returns success when the completion audit write fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.gateway.prepare.mockResolvedValue({ personaClipAssetIds: [] });
    mocks.gateway.complete.mockRejectedValue(new Error("audit down"));
    try {
      const response = await DELETE(request({ confirm: "DELETE_MY_ACCOUNT" }));

      expect(response.status).toBe(200);
      expect(JSON.stringify(await response.json())).not.toContain("audit down");
      expect(mocks.gateway.deleteAuthUser).toHaveBeenCalledWith("user-1");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
