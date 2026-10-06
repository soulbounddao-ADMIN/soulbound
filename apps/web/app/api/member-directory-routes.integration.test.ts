import { createServiceRoleSupabaseClient } from "@soulbound/adapters";
import {
  createActiveMember,
  createApplicant,
  deleteFixtureUsers,
  readIntegrationConfig,
  type TestSession,
} from "./_integration/fixtures";
import { GET as getMemberDirectory } from "./members/route";

function authedRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

function expectMemberNumberOnly(value: Record<string, unknown>): void {
  expect(Object.keys(value).sort()).toEqual([
    "createdAt",
    "isMe",
    "label",
    "memberNumber",
  ]);
  for (const key of [
    "id",
    "role",
    "email",
    "username",
    "wallet_address",
    "membership_status",
    "membership",
    "userId",
    "avatar_url",
    "handle",
    "displayName",
    "bio",
    "statement",
    "motivation",
    "referralCode",
    "personaClipAssetId",
    "personaClipHash",
  ]) {
    expect(key in value).toBe(false);
  }
}

async function assignMemberNumber(
  config: ReturnType<typeof readIntegrationConfig>,
  userId: string,
  memberNumber: number,
): Promise<void> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const { error } = await serviceRoleClient
    .from("profiles")
    .update({ member_number: memberNumber })
    .eq("id", userId);
  if (error) {
    throw error;
  }
}

describe("member directory route handlers", () => {
  const fixtureUsers: TestSession[] = [];

  afterEach(async () => {
    if (fixtureUsers.length === 0) {
      return;
    }

    try {
      await deleteFixtureUsers(readIntegrationConfig(), fixtureUsers);
    } finally {
      fixtureUsers.length = 0;
    }
  });

  it("lists active member numbers only and hides inactive or identifying data", async () => {
    const config = readIntegrationConfig();
    const viewer = await createActiveMember(config, "directory-viewer");
    fixtureUsers.push(viewer);
    const otherMember = await createActiveMember(config, "directory-other");
    fixtureUsers.push(otherMember);
    const inactiveApplicant = await createApplicant(
      config,
      "directory-inactive",
    );
    fixtureUsers.push(inactiveApplicant);

    await assignMemberNumber(config, viewer.id, 7_001);
    await assignMemberNumber(config, otherMember.id, 7_002);

    const listResponse = await getMemberDirectory(
      authedRequest(viewer.accessToken, "/api/members?limit=2&cursor=7000"),
    );
    expect(listResponse.status).toBe(200);
    const directory = await listResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
      readonly myLabel: string;
      readonly myMemberNumber: number;
      readonly nextCursor: number | null;
    };
    expect(Object.keys(directory).sort()).toEqual([
      "items",
      "myLabel",
      "myMemberNumber",
      "nextCursor",
    ]);
    expect(directory.myMemberNumber).toBe(7_001);
    expect(directory.myLabel).toBe("soulbound-member-7001");
    expect(directory.items.map((item) => item.label)).toEqual([
      "soulbound-member-7001",
      "soulbound-member-7002",
    ]);
    for (const item of directory.items) {
      expectMemberNumberOnly(item);
    }
    expect(directory.items[0]).toMatchObject({
      label: "soulbound-member-7001",
      memberNumber: 7_001,
      isMe: true,
    });
    expect(directory.items[1]).toMatchObject({
      label: "soulbound-member-7002",
      memberNumber: 7_002,
      isMe: false,
    });

    const pagedResponse = await getMemberDirectory(
      authedRequest(viewer.accessToken, "/api/members?limit=1&cursor=7000"),
    );
    expect(pagedResponse.status).toBe(200);
    const page = await pagedResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: number | null;
    };
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(7_001);

    const secondPageResponse = await getMemberDirectory(
      authedRequest(viewer.accessToken, "/api/members?limit=1&cursor=7001"),
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage = await secondPageResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: number | null;
    };
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]).toMatchObject({
      label: "soulbound-member-7002",
      memberNumber: 7_002,
      isMe: false,
    });
    expect([null, 7_002]).toContain(secondPage.nextCursor);

    const nonMemberViewerResponse = await getMemberDirectory(
      authedRequest(inactiveApplicant.accessToken, "/api/members"),
    );
    expect(nonMemberViewerResponse.status).toBe(403);
  });
});
