import { createServiceRoleSupabaseClient } from "@soulbound/adapters";
import {
  createActiveMember,
  createAdmin,
  createApplicant,
  createReviewer,
  deleteFixtureUsers,
  readIntegrationConfig,
  uniqueSuffix,
  type TestSession,
} from "./_integration/fixtures";
import { POST as postApplication } from "./admission/applications/route";
import { POST as postReview } from "./admin/applications/[id]/review/route";
import { POST as openVote } from "./admin/applications/[id]/vote/open/route";
import {
  POST as finalizeVote,
} from "./admin/applications/[id]/vote/finalize/route";
import {
  POST as overrideVote,
} from "./admin/applications/[id]/vote/override/route";
import { GET as listVotes } from "./vote/applications/route";
import { GET as getVote } from "./vote/applications/[voteId]/route";
import { POST as castVote } from "./vote/applications/[voteId]/cast/route";

interface ApplicationContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

interface VoteContext {
  readonly params: Promise<{
    readonly voteId: string;
  }>;
}

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

function applicationContext(id: string): ApplicationContext {
  return { params: Promise.resolve({ id }) };
}

function voteContext(voteId: string): VoteContext {
  return { params: Promise.resolve({ voteId }) };
}

function jsonRequest(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Request {
  return authedRequest(accessToken, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function expectVoteNoLeak(value: Record<string, unknown>) {
  expect(String(value.candidateToken)).toMatch(/^candidate-/);
  for (const key of [
    "applicantId",
    "applicantUsername",
    "username",
    "memberNumber",
    "email",
    "role",
    "reviewSummary",
    "applicantNotice",
    "personaClipAssetId",
    "personaClipHash",
  ]) {
    expect(key in value).toBe(false);
  }
}

function expectVoteSummaryShape(value: Record<string, unknown>) {
  expect(Object.keys(value).sort()).toEqual([
    "applicantStatement",
    "candidateToken",
    "hasClip",
    "hasVoted",
    "id",
    "openedAt",
    "windowEndsAt",
  ]);
  expectVoteNoLeak(value);
}

function expectVoteDetailShape(value: Record<string, unknown>) {
  expect(Object.keys(value).sort()).toEqual([
    "applicantStatement",
    "candidateToken",
    "hasClip",
    "hasVoted",
    "id",
    "noCount",
    "openedAt",
    "outcome",
    "status",
    "turnoutCount",
    "windowEndsAt",
    "yesCount",
  ]);
  expectVoteNoLeak(value);
}

async function submitAndStartReview(
  applicant: TestSession,
  reviewer: TestSession,
): Promise<string> {
  const submitResponse = await postApplication(jsonRequest(
    applicant.accessToken,
    "/api/admission/applications",
    {
      applicantStatement: `vote statement ${uniqueSuffix()}`,
      idempotencyKey: `vote-submit-${uniqueSuffix()}`,
    },
  ));
  expect(submitResponse.status).toBe(201);
  const application = await submitResponse.json() as { readonly id: string };

  const reviewResponse = await postReview(
    jsonRequest(
      reviewer.accessToken,
      `/api/admin/applications/${application.id}/review`,
      { idempotencyKey: `vote-review-${uniqueSuffix()}` },
    ),
    applicationContext(application.id),
  );
  expect(reviewResponse.status).toBe(200);
  return application.id;
}

describe("admission voting route handlers", () => {
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

  it("handles secret member voting, binding finalize, and admin override gates", async () => {
    const config = readIntegrationConfig();
    const reviewer = await createReviewer(config, "vote-reviewer");
    const admin = await createAdmin(config, "vote-admin");
    const applicant = await createApplicant(config, "vote-applicant");
    const overrideApplicant =
      await createApplicant(config, "vote-override-applicant");
    const memberYes = await createActiveMember(config, "vote-yes");
    const memberNo = await createActiveMember(config, "vote-no");
    const nonMember = await createApplicant(config, "vote-non-member");
    fixtureUsers.push(
      reviewer,
      admin,
      applicant,
      overrideApplicant,
      memberYes,
      memberNo,
      nonMember,
    );

    const applicationId = await submitAndStartReview(applicant, reviewer);
    const openResponse = await openVote(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${applicationId}/vote/open`,
        {
          idempotencyKey: `vote-open-${uniqueSuffix()}`,
          windowHours: 24,
        },
      ),
      applicationContext(applicationId),
    );
    expect(openResponse.status).toBe(200);
    const openedVote = await openResponse.json() as Record<string, unknown>;
    expectVoteDetailShape(openedVote);
    const voteId = String(openedVote.id);

    const nonMemberList = await listVotes(
      authedRequest(nonMember.accessToken, "/api/vote/applications"),
    );
    expect(nonMemberList.status).toBe(403);

    const listResponse = await listVotes(
      authedRequest(memberYes.accessToken, "/api/vote/applications"),
    );
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
    };
    expect(list.items.some((item) => item.id === voteId)).toBe(true);
    expectVoteSummaryShape(list.items.find((item) => item.id === voteId)!);

    const detailResponse = await getVote(
      authedRequest(memberYes.accessToken, `/api/vote/applications/${voteId}`),
      voteContext(voteId),
    );
    expect(detailResponse.status).toBe(200);
    expectVoteDetailShape(await detailResponse.json() as Record<string, unknown>);

    const nonMemberCast = await castVote(
      jsonRequest(
        nonMember.accessToken,
        `/api/vote/applications/${voteId}/cast`,
        { choice: "yes" },
      ),
      voteContext(voteId),
    );
    expect(nonMemberCast.status).toBe(403);

    const suppliedVoterId = await castVote(
      jsonRequest(
        memberYes.accessToken,
        `/api/vote/applications/${voteId}/cast`,
        { choice: "yes", voterId: memberNo.id },
      ),
      voteContext(voteId),
    );
    expect(suppliedVoterId.status).toBe(422);

    const yesResponse = await castVote(
      jsonRequest(
        memberYes.accessToken,
        `/api/vote/applications/${voteId}/cast`,
        { choice: "yes" },
      ),
      voteContext(voteId),
    );
    expect(yesResponse.status).toBe(200);
    const yesVote = await yesResponse.json() as Record<string, unknown>;
    expect(yesVote.hasVoted).toBe(true);

    const duplicateResponse = await castVote(
      jsonRequest(
        memberYes.accessToken,
        `/api/vote/applications/${voteId}/cast`,
        { choice: "no" },
      ),
      voteContext(voteId),
    );
    expect(duplicateResponse.status).toBe(409);

    const noResponse = await castVote(
      jsonRequest(
        memberNo.accessToken,
        `/api/vote/applications/${voteId}/cast`,
        { choice: "no" },
      ),
      voteContext(voteId),
    );
    expect(noResponse.status).toBe(200);

    const finalizeResponse = await finalizeVote(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${applicationId}/vote/finalize`,
        { idempotencyKey: `vote-finalize-${uniqueSuffix()}` },
      ),
      applicationContext(applicationId),
    );
    expect(finalizeResponse.status).toBe(200);
    const finalized = await finalizeResponse.json() as Record<string, unknown>;
    expect(finalized.outcome).toBe("rejected");
    expect(finalized.yesCount).toBe(1);
    expect(finalized.noCount).toBe(1);

    const serviceRoleClient = createServiceRoleSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const { data: appRow, error: appError } = await serviceRoleClient
      .from("admission_applications")
      .select("status,applicant_statement")
      .eq("id", applicationId)
      .single();
    if (appError) {
      throw appError;
    }
    expect(appRow.status).toBe("rejected");
    expect(appRow.applicant_statement).toBeNull();

    const { count: ballotCount, error: ballotError } = await serviceRoleClient
      .from("admission_vote_ballots")
      .select("*", { count: "exact", head: true })
      .eq("vote_id", voteId);
    if (ballotError) {
      throw ballotError;
    }
    expect(ballotCount).toBe(0);

    const overrideApplicationId =
      await submitAndStartReview(overrideApplicant, reviewer);
    const overrideOpenResponse = await openVote(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${overrideApplicationId}/vote/open`,
        { idempotencyKey: `vote-open-override-${uniqueSuffix()}` },
      ),
      applicationContext(overrideApplicationId),
    );
    expect(overrideOpenResponse.status).toBe(200);

    const reviewerOverride = await overrideVote(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${overrideApplicationId}/vote/override`,
        {
          decision: "approved",
          idempotencyKey: `vote-reviewer-override-${uniqueSuffix()}`,
        },
      ),
      applicationContext(overrideApplicationId),
    );
    expect(reviewerOverride.status).toBe(403);

    const adminOverride = await overrideVote(
      jsonRequest(
        admin.accessToken,
        `/api/admin/applications/${overrideApplicationId}/vote/override`,
        {
          decision: "approved",
          idempotencyKey: `vote-admin-override-${uniqueSuffix()}`,
        },
      ),
      applicationContext(overrideApplicationId),
    );
    expect(adminOverride.status).toBe(200);
    const overridePayload =
      await adminOverride.json() as Record<string, unknown>;
    expect(overridePayload.status).toBe("overridden");
    expect(overridePayload.outcome).toBe("approved");
  }, 60_000);
});
