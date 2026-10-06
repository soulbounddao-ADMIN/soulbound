import {
  createApplicant,
  createReviewer,
  deleteFixtureUsers,
  readIntegrationConfig,
  uniqueSuffix,
  type TestSession,
} from "./_integration/fixtures";
import { POST as postApplication } from "./admission/applications/route";
import { GET as getApplicantApplicationById } from "./admission/applications/[id]/route";
import { GET as getAdminApplications } from "./admin/applications/route";
import { GET as getAdminApplicationById } from "./admin/applications/[id]/route";
import { POST as postReview } from "./admin/applications/[id]/review/route";
import { POST as postApprove } from "./admin/applications/[id]/approve/route";
import { POST as postReject } from "./admin/applications/[id]/reject/route";
import { POST as postRequestMoreInfo } from "./admin/applications/[id]/request-more-info/route";

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

function authedRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);

  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

function jsonRequest(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Request {
  return authedRequest(accessToken, path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  });
}

function routeContext(id: string): RouteContext {
  return {
    params: Promise.resolve({ id }),
  };
}

async function submitApplication(
  applicant: TestSession,
  applicantStatement: string,
): Promise<Record<string, unknown>> {
  const response = await postApplication(jsonRequest(
    applicant.accessToken,
    "/api/admission/applications",
    {
      applicantStatement,
      idempotencyKey: `task6b-submit-${uniqueSuffix()}`,
    },
  ));
  expect(response.status).toBe(201);
  const application = await response.json() as Record<string, unknown>;
  expect(application.status).toBe("submitted");
  expect(application.applicantId).toBe(applicant.id);

  return application;
}

async function startReview(
  reviewer: TestSession,
  applicationId: string,
): Promise<Record<string, unknown>> {
  const response = await postReview(
    jsonRequest(
      reviewer.accessToken,
      `/api/admin/applications/${applicationId}/review`,
      { idempotencyKey: `task6b-review-${uniqueSuffix()}` },
    ),
    routeContext(applicationId),
  );
  expect(response.status).toBe(200);
  const application = await response.json() as Record<string, unknown>;
  expect(application.status).toBe("under_review");

  return application;
}

describe("admin route handlers", () => {
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

  it("handles reviewer reads and state transitions with real bearer auth", async () => {
    const config = readIntegrationConfig();
    const reviewer = await createReviewer(config, "admin-routes");
    fixtureUsers.push(reviewer);
    const approveApplicant = await createApplicant(config, "approve");
    fixtureUsers.push(approveApplicant);
    const rejectApplicant = await createApplicant(config, "reject");
    fixtureUsers.push(rejectApplicant);
    const moreInfoApplicant = await createApplicant(config, "more-info");
    fixtureUsers.push(moreInfoApplicant);

    const queueCursor = new Date(Date.now() - 60_000).toISOString();
    const approveApplication = await submitApplication(
      approveApplicant,
      "Task 6b approve branch.",
    );
    const approveApplicationId = String(approveApplication.id);

    const queueResponse = await getAdminApplications(authedRequest(
      reviewer.accessToken,
      `/api/admin/applications?status=submitted&limit=100&cursor=${encodeURIComponent(queueCursor)}`,
    ));
    expect(queueResponse.status).toBe(200);
    const queue = await queueResponse.json() as Array<Record<string, unknown>>;
    expect(queue.some((item) => item.id === approveApplicationId)).toBe(true);
    expect(
      queue.find((item) => item.id === approveApplicationId),
    ).toMatchObject({
      applicantUsername: approveApplicant.username,
    });

    const applicantAdminQueueResponse = await getAdminApplications(
      authedRequest(
        approveApplicant.accessToken,
        "/api/admin/applications?status=submitted",
      ),
    );
    expect(applicantAdminQueueResponse.status).toBe(403);

    const applicantAdminDetailResponse = await getAdminApplicationById(
      authedRequest(
        approveApplicant.accessToken,
        `/api/admin/applications/${approveApplicationId}`,
      ),
      routeContext(approveApplicationId),
    );
    expect(applicantAdminDetailResponse.status).toBe(403);

    await startReview(reviewer, approveApplicationId);

    const applicantAdminApproveResponse = await postApprove(
      jsonRequest(
        approveApplicant.accessToken,
        `/api/admin/applications/${approveApplicationId}/approve`,
        {
          reasonCode: "meets_phase1_policy",
          idempotencyKey: `task6b-applicant-forbidden-${uniqueSuffix()}`,
        },
      ),
      routeContext(approveApplicationId),
    );
    expect(applicantAdminApproveResponse.status).toBe(403);

    const invalidReasonResponse = await postApprove(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${approveApplicationId}/approve`,
        {
          reasonCode: "free_text_reason",
          idempotencyKey: `task6b-invalid-reason-${uniqueSuffix()}`,
        },
      ),
      routeContext(approveApplicationId),
    );
    expect(invalidReasonResponse.status).toBe(422);

    const reviewSummary = `internal note ${uniqueSuffix()}`;
    const approveResponse = await postApprove(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${approveApplicationId}/approve`,
        {
          reasonCode: "meets_phase1_policy",
          applicantNotice: "Welcome.",
          reviewSummary,
          idempotencyKey: `task6b-approve-${uniqueSuffix()}`,
        },
      ),
      routeContext(approveApplicationId),
    );
    expect(approveResponse.status).toBe(200);
    const approveOutcome = await approveResponse.json() as {
      readonly application: Record<string, unknown>;
      readonly membership: Record<string, unknown>;
    };
    expect(approveOutcome.application.status).toBe("approved");
    expect(approveOutcome.membership.status).toBe("active");

    const reviewerDetailResponse = await getAdminApplicationById(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/applications/${approveApplicationId}`,
      ),
      routeContext(approveApplicationId),
    );
    expect(reviewerDetailResponse.status).toBe(200);
    const reviewerDetail =
      await reviewerDetailResponse.json() as Record<string, unknown>;
    expect(reviewerDetail.reviewSummary).toBe(reviewSummary);
    expect(reviewerDetail.applicantUsername).toBe(approveApplicant.username);
    expect(reviewerDetail.reviewerUsername).toBe(reviewer.username);
    expect(reviewerDetail).not.toHaveProperty("applicantStatement");
    expect(reviewerDetail).not.toHaveProperty("motivation");
    expect(reviewerDetail).not.toHaveProperty("referralCode");

    const applicantOwnDetailResponse = await getApplicantApplicationById(
      authedRequest(
        approveApplicant.accessToken,
        `/api/admission/applications/${approveApplicationId}`,
      ),
      routeContext(approveApplicationId),
    );
    expect(applicantOwnDetailResponse.status).toBe(200);
    const applicantOwnDetail =
      await applicantOwnDetailResponse.json() as Record<string, unknown>;
    expect(applicantOwnDetail.id).toBe(approveApplicationId);
    expect(applicantOwnDetail).not.toHaveProperty("reviewSummary");
    expect(applicantOwnDetail).not.toHaveProperty("applicantEmail");
    expect(applicantOwnDetail).not.toHaveProperty("reviewerEmail");
    expect(applicantOwnDetail).not.toHaveProperty("applicantUsername");
    expect(applicantOwnDetail).not.toHaveProperty("reviewerUsername");
    expect(applicantOwnDetail).not.toHaveProperty("email");
    expect(applicantOwnDetail).not.toHaveProperty("applicantStatement");
    expect(applicantOwnDetail).not.toHaveProperty("motivation");
    expect(applicantOwnDetail).not.toHaveProperty("referralCode");

    const rejectApplication = await submitApplication(
      rejectApplicant,
      "Task 6b reject branch.",
    );
    const rejectApplicationId = String(rejectApplication.id);
    await startReview(reviewer, rejectApplicationId);
    const rejectReviewSummary = `reject internal ${uniqueSuffix()}`;
    const rejectResponse = await postReject(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${rejectApplicationId}/reject`,
        {
          reasonCode: "mismatch_with_policy",
          applicantNotice: "Not eligible for Phase 1.",
          reviewSummary: rejectReviewSummary,
          idempotencyKey: `task6b-reject-${uniqueSuffix()}`,
        },
      ),
      routeContext(rejectApplicationId),
    );
    expect(rejectResponse.status).toBe(200);
    await expect(rejectResponse.json()).resolves.toMatchObject({
      status: "rejected",
    });
    const rejectedDetailResponse = await getAdminApplicationById(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/applications/${rejectApplicationId}`,
      ),
      routeContext(rejectApplicationId),
    );
    expect(rejectedDetailResponse.status).toBe(200);
    const rejectedDetail =
      await rejectedDetailResponse.json() as Record<string, unknown>;
    expect(rejectedDetail.reviewSummary).toBe(rejectReviewSummary);
    expect(rejectedDetail).not.toHaveProperty("applicantStatement");
    expect(rejectedDetail).not.toHaveProperty("motivation");
    expect(rejectedDetail).not.toHaveProperty("referralCode");

    const moreInfoApplication = await submitApplication(
      moreInfoApplicant,
      "Task 6b request more info branch.",
    );
    const moreInfoApplicationId = String(moreInfoApplication.id);
    await startReview(reviewer, moreInfoApplicationId);
    const moreInfoResponse = await postRequestMoreInfo(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${moreInfoApplicationId}/request-more-info`,
        {
          reasonCode: "needs_identity_clarification",
          applicantNotice: "Please clarify your identity.",
          reviewSummary: `more info internal ${uniqueSuffix()}`,
          idempotencyKey: `task6b-more-info-${uniqueSuffix()}`,
        },
      ),
      routeContext(moreInfoApplicationId),
    );
    expect(moreInfoResponse.status).toBe(200);
    await expect(moreInfoResponse.json()).resolves.toMatchObject({
      status: "needs_more_info",
    });
  }, 60_000);

  it("returns 401 for missing or invalid sessions on admin routes", async () => {
    const noSessionResponse = await getAdminApplications(
      new Request("http://localhost/api/admin/applications"),
    );
    expect(noSessionResponse.status).toBe(401);

    const invalidSessionResponse = await getAdminApplications(
      authedRequest("not-a-real-token", "/api/admin/applications"),
    );
    expect(invalidSessionResponse.status).toBe(401);
  });
});
