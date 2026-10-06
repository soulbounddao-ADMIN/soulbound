import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  resolveUserContext: vi.fn(),
}));

const adapterMocks = vi.hoisted(() => ({
  membershipRepo: {
    findByUserId: vi.fn(),
  },
  memberDirectoryRepo: {
    getMyMemberNumber: vi.fn(),
    listActiveMembers: vi.fn(),
  },
  makeSupabaseMembershipRepository: vi.fn(),
  makeUserScopedMemberDirectoryRepository: vi.fn(),
}));

vi.mock("../_lib/auth", () => ({
  resolveUserContext: authMocks.resolveUserContext,
}));

vi.mock("@soulbound/adapters", () => ({
  makeSupabaseMembershipRepository:
    adapterMocks.makeSupabaseMembershipRepository,
  makeUserScopedMemberDirectoryRepository:
    adapterMocks.makeUserScopedMemberDirectoryRepository,
}));

function request(path = "/api/members"): Request {
  return new Request(`http://localhost${path}`, {
    headers: {
      authorization: "Bearer token",
    },
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("/api/members", () => {
  beforeEach(() => {
    authMocks.resolveUserContext.mockReset();
    adapterMocks.membershipRepo.findByUserId.mockReset();
    adapterMocks.memberDirectoryRepo.getMyMemberNumber.mockReset();
    adapterMocks.memberDirectoryRepo.listActiveMembers.mockReset();
    adapterMocks.makeSupabaseMembershipRepository.mockReset()
      .mockReturnValue(adapterMocks.membershipRepo);
    adapterMocks.makeUserScopedMemberDirectoryRepository.mockReset()
      .mockReturnValue(adapterMocks.memberDirectoryRepo);
    authMocks.resolveUserContext.mockResolvedValue({
      userId: "user-1",
      client: {},
    });
    adapterMocks.membershipRepo.findByUserId.mockResolvedValue({
      id: "membership-1",
      userId: "user-1",
      status: "active",
      tier: "basic",
      issuedAt: "2026-06-20T00:00:00.000Z",
    });
    adapterMocks.memberDirectoryRepo.getMyMemberNumber.mockResolvedValue(7);
    adapterMocks.memberDirectoryRepo.listActiveMembers.mockResolvedValue({
      items: [
        {
          memberNumber: 7,
          label: "soulbound-member-7",
          createdAt: "2026-06-20T00:00:00.000Z",
        },
        {
          memberNumber: 8,
          label: "soulbound-member-8",
          createdAt: "2026-06-21T00:00:00.000Z",
        },
      ],
      nextCursor: 8,
    });
  });

  it("returns 401 without an authenticated user context", async () => {
    authMocks.resolveUserContext.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("requires active membership", async () => {
    adapterMocks.membershipRepo.findByUserId.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(403);
  });

  it("returns member-number-only active rows with isMe and cursor", async () => {
    const response = await GET(request("/api/members?limit=50"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      "items",
      "myLabel",
      "myMemberNumber",
      "nextCursor",
    ]);
    expect(body.myMemberNumber).toBe(7);
    expect(body.myLabel).toBe("soulbound-member-7");
    expect(body.nextCursor).toBe(8);
    expect(adapterMocks.memberDirectoryRepo.listActiveMembers)
      .toHaveBeenCalledWith({ limit: 50, cursor: null });

    const items = body.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([
      "createdAt",
      "isMe",
      "label",
      "memberNumber",
    ]);
    expect(items[0]).toEqual({
      memberNumber: 7,
      label: "soulbound-member-7",
      createdAt: "2026-06-20T00:00:00.000Z",
      isMe: true,
    });
    expect(items[1]).toMatchObject({
      memberNumber: 8,
      label: "soulbound-member-8",
      isMe: false,
    });
    for (const item of items) {
      for (const key of [
        "id",
        "userId",
        "applicantId",
        "role",
        "email",
        "username",
        "wallet_address",
        "membership_status",
        "membership",
        "avatar_url",
        "handle",
        "displayName",
        "bio",
        "statement",
        "motivation",
        "referralCode",
        "personaClipAssetId",
      ]) {
        expect(key in item).toBe(false);
      }
    }
  });

  it("passes numeric pagination cursors to the repository", async () => {
    const response = await GET(request("/api/members?limit=25&cursor=8"));

    expect(response.status).toBe(200);
    expect(adapterMocks.memberDirectoryRepo.listActiveMembers)
      .toHaveBeenCalledWith({ limit: 25, cursor: 8 });
  });

  it("rejects invalid pagination params", async () => {
    const response = await GET(request("/api/members?limit=51"));

    expect(response.status).toBe(422);
    expect(adapterMocks.memberDirectoryRepo.listActiveMembers)
      .not.toHaveBeenCalled();
  });
});
