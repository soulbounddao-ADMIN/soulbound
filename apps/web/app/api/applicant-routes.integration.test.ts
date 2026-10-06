import {
  createApplicant,
  createReviewer,
  deleteFixtureUsers,
  readIntegrationConfig,
  uniqueSuffix,
  type TestSession,
} from "./_integration/fixtures";
import { createServiceRoleSupabaseClient } from "@soulbound/adapters";
import { POST as postApplication } from "./admission/applications/route";
import { GET as getMyApplication } from "./admission/applications/me/route";
import { GET as getApplicationById } from "./admission/applications/[id]/route";
import { POST as postResubmitApplication } from "./admission/applications/[id]/resubmit/route";
import { GET as getMyMembership } from "./membership/me/route";

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

async function submitApplication(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return postApplication(authedRequest(accessToken, "/api/admission/applications", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  }));
}

async function resubmitApplication(
  accessToken: string,
  applicationId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return postResubmitApplication(
    authedRequest(
      accessToken,
      `/api/admission/applications/${applicationId}/resubmit`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
        },
      },
    ),
    { params: Promise.resolve({ id: applicationId }) },
  );
}

describe("applicant route handlers", () => {
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

  it("handles applicant submit/read/membership routes with real bearer auth", async () => {
    const config = readIntegrationConfig();
    const applicant = await createApplicant(config, "task6a-owner");
    fixtureUsers.push(applicant);
    const otherApplicant = await createApplicant(config, "task6a-other");
    fixtureUsers.push(otherApplicant);

    const maliciousSubmitResponse = await submitApplication(
      applicant.accessToken,
      {
        applicantId: otherApplicant.id,
        applicantStatement: "Task 6a applicant statement.",
        idempotencyKey: `task6a-submit-${uniqueSuffix()}`,
      },
    );
    expect(maliciousSubmitResponse.status).toBe(422);

    const submitResponse = await submitApplication(
      applicant.accessToken,
      {
        applicantStatement: "Task 6a applicant statement.",
        idempotencyKey: `task6a-submit-${uniqueSuffix()}`,
      },
    );
    expect(submitResponse.status).toBe(201);
    const application = await submitResponse.json();
    expect(application.status).toBe("submitted");
    expect(application.applicantId).toBe(applicant.id);
    expect(application.applicantId).not.toBe(otherApplicant.id);

    const meResponse = await getMyApplication(
      authedRequest(applicant.accessToken, "/api/admission/applications/me"),
    );
    expect(meResponse.status).toBe(200);
    const activeApplication = await meResponse.json();
    expect(activeApplication.id).toBe(application.id);
    expect(activeApplication).not.toHaveProperty("applicantEmail");
    expect(activeApplication).not.toHaveProperty("reviewerEmail");
    expect(activeApplication).not.toHaveProperty("email");
    expect(activeApplication).not.toHaveProperty("applicantUsername");
    expect(activeApplication).not.toHaveProperty("reviewerUsername");
    expect(activeApplication).not.toHaveProperty("username");
    expect(activeApplication).not.toHaveProperty("reviewSummary");

    const ownResponse = await getApplicationById(
      authedRequest(
        applicant.accessToken,
        `/api/admission/applications/${application.id}`,
      ),
      { params: Promise.resolve({ id: application.id }) },
    );
    expect(ownResponse.status).toBe(200);
    await expect(ownResponse.json()).resolves.toMatchObject({
      id: application.id,
      applicantId: applicant.id,
    });

    const otherSubmitResponse = await submitApplication(
      otherApplicant.accessToken,
      {
        applicantStatement: "Other applicant application.",
        idempotencyKey: `task6a-other-submit-${uniqueSuffix()}`,
      },
    );
    expect(otherSubmitResponse.status).toBe(201);
    const otherApplication = await otherSubmitResponse.json();

    const otherReadResponse = await getApplicationById(
      authedRequest(
        applicant.accessToken,
        `/api/admission/applications/${otherApplication.id}`,
      ),
      { params: Promise.resolve({ id: otherApplication.id }) },
    );
    expect(otherReadResponse.status).toBe(404);

    const membershipResponse = await getMyMembership(
      authedRequest(applicant.accessToken, "/api/membership/me"),
    );
    expect(membershipResponse.status).toBe(200);
    await expect(membershipResponse.json()).resolves.toBeNull();
  });

  it("lets the owning applicant resubmit a needs_more_info application", async () => {
    const config = readIntegrationConfig();
    const serviceRoleClient = createServiceRoleSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const applicant = await createApplicant(config, "resubmit-owner");
    fixtureUsers.push(applicant);
    const otherApplicant = await createApplicant(config, "resubmit-other");
    fixtureUsers.push(otherApplicant);
    const reviewer = await createReviewer(config, "resubmit-reviewer");
    fixtureUsers.push(reviewer);

    const submitResponse = await submitApplication(
      applicant.accessToken,
      {
        applicantStatement: "Original resubmit statement.",
        idempotencyKey: `resubmit-submit-${uniqueSuffix()}`,
      },
    );
    expect(submitResponse.status).toBe(201);
    const application = await submitResponse.json();

    const { error: startError } = await serviceRoleClient.rpc(
      "start_review_tx",
      {
        p_application_id: application.id,
        p_actor_id: reviewer.id,
        p_idempotency_key: `resubmit-start-${uniqueSuffix()}`,
      },
    );
    expect(startError).toBeNull();

    const { error: moreInfoError } = await serviceRoleClient.rpc(
      "request_more_info_tx",
      {
        p_application_id: application.id,
        p_actor_id: reviewer.id,
        p_reason_code: "needs_identity_clarification",
        p_idempotency_key: `resubmit-more-info-${uniqueSuffix()}`,
        p_applicant_notice: "보완 요청 안내입니다.",
        p_review_summary: "SECRET_RESUBMIT_REVIEW_SUMMARY",
      },
    );
    expect(moreInfoError).toBeNull();

    const maliciousResponse = await resubmitApplication(
      applicant.accessToken,
      application.id,
      {
        applicantId: otherApplicant.id,
        applicantStatement: "Attempted actor override.",
        idempotencyKey: `resubmit-malicious-${uniqueSuffix()}`,
      },
    );
    expect(maliciousResponse.status).toBe(422);

    const otherApplicantResponse = await resubmitApplication(
      otherApplicant.accessToken,
      application.id,
      {
        applicantStatement: "Other applicant statement.",
        idempotencyKey: `resubmit-other-${uniqueSuffix()}`,
      },
    );
    expect(otherApplicantResponse.status).toBe(403);

    const idempotencyKey = `resubmit-ok-${uniqueSuffix()}`;
    const resubmitResponse = await resubmitApplication(
      applicant.accessToken,
      application.id,
      {
        applicantStatement: "Updated resubmit statement.",
        idempotencyKey,
      },
    );
    expect(resubmitResponse.status).toBe(200);
    const resubmitted = await resubmitResponse.json();
    expect(resubmitted.status).toBe("submitted");
    expect(resubmitted.applicantId).toBe(applicant.id);
    expect(resubmitted.applicantStatement).toBe("Updated resubmit statement.");
    expect(resubmitted).not.toHaveProperty("reviewSummary");

    const replayResponse = await resubmitApplication(
      applicant.accessToken,
      application.id,
      {
        applicantStatement: "Replay must not overwrite.",
        idempotencyKey,
      },
    );
    expect(replayResponse.status).toBe(409);

    const wrongStateResponse = await resubmitApplication(
      applicant.accessToken,
      application.id,
      {
        applicantStatement: "Different key in the wrong state.",
        idempotencyKey: `resubmit-wrong-state-${uniqueSuffix()}`,
      },
    );
    expect(wrongStateResponse.status).toBe(409);

    const { data: storedApplication, error: storedError } =
      await serviceRoleClient
        .from("admission_applications")
        .select("status,applicant_statement,applicant_notice,review_summary,reviewer_id,reviewed_at")
        .eq("id", application.id)
        .single();
    expect(storedError).toBeNull();
    expect(storedApplication).toMatchObject({
      status: "submitted",
      applicant_statement: "Updated resubmit statement.",
      applicant_notice: null,
      review_summary: "SECRET_RESUBMIT_REVIEW_SUMMARY",
      reviewer_id: reviewer.id,
    });
    expect(storedApplication?.reviewed_at).toBeTruthy();

    const meResponse = await getMyApplication(
      authedRequest(applicant.accessToken, "/api/admission/applications/me"),
    );
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      id: application.id,
      status: "submitted",
      applicantStatement: "Updated resubmit statement.",
    });
  });

  it("returns 401 for missing or invalid sessions", async () => {
    const noSessionResponse = await postApplication(
      new Request("http://localhost/api/admission/applications", {
        method: "POST",
        body: JSON.stringify({
          applicantStatement: "No auth.",
          idempotencyKey: "no-auth",
        }),
      }),
    );
    expect(noSessionResponse.status).toBe(401);

    const invalidSessionResponse = await getMyApplication(
      authedRequest("not-a-real-token", "/api/admission/applications/me"),
    );
    expect(invalidSessionResponse.status).toBe(401);
  });
});
