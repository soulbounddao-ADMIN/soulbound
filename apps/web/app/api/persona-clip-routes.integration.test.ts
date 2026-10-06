import {
  createServiceRoleSupabaseClient,
} from "@soulbound/adapters";
import {
  createApplicant,
  createReviewer,
  deleteFixtureUsers,
  readIntegrationConfig,
  uniqueSuffix,
  type TestSession,
} from "./_integration/fixtures";
import { POST as postApplication } from "./admission/applications/route";
import {
  DELETE as deletePersonaClip,
  POST as postPersonaClip,
} from "./admission/persona-clip/route";
import { GET as getPersonaClipUrl } from "./admin/applications/[id]/persona-clip-url/route";
import { POST as postReview } from "./admin/applications/[id]/review/route";
import { POST as postApprove } from "./admin/applications/[id]/approve/route";

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

interface UploadContract {
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
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
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await postApplication(jsonRequest(
    applicant.accessToken,
    "/api/admission/applications",
    {
      applicantStatement: "Task 7a persona clip flow.",
      idempotencyKey: `task7a-submit-${uniqueSuffix()}`,
      ...body,
    },
  ));
  expect(response.status).toBe(201);
  return await response.json() as Record<string, unknown>;
}

async function createPersonaClip(
  applicant: TestSession,
  body: Record<string, unknown>,
): Promise<{
  readonly assetId: string;
  readonly upload: UploadContract;
}> {
  const response = await postPersonaClip(jsonRequest(
    applicant.accessToken,
    "/api/admission/persona-clip",
    body,
  ));
  expect(response.status).toBe(200);
  return await response.json() as {
    readonly assetId: string;
    readonly upload: UploadContract;
  };
}

async function startReview(
  reviewer: TestSession,
  applicationId: string,
): Promise<void> {
  const response = await postReview(
    jsonRequest(
      reviewer.accessToken,
      `/api/admin/applications/${applicationId}/review`,
      { idempotencyKey: `task7a-review-${uniqueSuffix()}` },
    ),
    routeContext(applicationId),
  );
  expect(response.status).toBe(200);
}

function bytesEqual(left: ArrayBuffer, right: Uint8Array): boolean {
  const leftBytes = new Uint8Array(left);
  return (
    leftBytes.length === right.length
    && leftBytes.every((value, index) => value === right[index])
  );
}

function expectNoPersonaClipSecretLeak(
  rows: readonly Record<string, unknown>[],
  forbiddenNeedles: readonly string[],
): void {
  const serialized = rows.map((row) => JSON.stringify(row));
  for (const haystack of serialized) {
    for (const needle of forbiddenNeedles) {
      expect(haystack.includes(needle)).toBe(false);
    }
  }
}

describe("persona clip route handlers", () => {
  const fixtureApplicantIds: string[] = [];
  const fixtureUsers: TestSession[] = [];

  afterEach(async () => {
    if (fixtureApplicantIds.length === 0 && fixtureUsers.length === 0) {
      return;
    }

    let cleanupError: unknown;
    try {
      const config = readIntegrationConfig();
      const serviceRoleClient = createServiceRoleSupabaseClient({
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
      });

      if (fixtureApplicantIds.length > 0) {
        const { data: clips, error: clipsError } = await serviceRoleClient
          .from("persona_clip_assets")
          .select("id,storage_path")
          .in("applicant_id", fixtureApplicantIds);
        if (clipsError) {
          throw clipsError;
        }

        const clipIds = (clips ?? []).map(({ id }) => id);
        const storagePaths = (clips ?? []).map(({ storage_path }) => storage_path);
        if (storagePaths.length > 0) {
          const { error: removeError } = await serviceRoleClient.storage
            .from("persona-clips")
            .remove(storagePaths);
          if (removeError) {
            throw removeError;
          }
        }

        if (clipIds.length > 0) {
          const { error: detachError } = await serviceRoleClient
            .from("admission_applications")
            .update({ persona_clip_asset_id: null })
            .in("persona_clip_asset_id", clipIds);
          if (detachError) {
            throw detachError;
          }

          const { error: deleteError } = await serviceRoleClient
            .from("persona_clip_assets")
            .delete()
            .in("id", clipIds);
          if (deleteError) {
            throw deleteError;
          }
        }
      }
    } catch (error) {
      cleanupError = error;
    }

    try {
      if (fixtureUsers.length > 0) {
        await deleteFixtureUsers(readIntegrationConfig(), fixtureUsers);
      }
    } catch (error) {
      cleanupError ??= error;
    } finally {
      fixtureApplicantIds.length = 0;
      fixtureUsers.length = 0;
    }

    if (cleanupError) {
      throw cleanupError;
    }
  });

  it("creates upload URLs, protects reviewer read URLs, and preserves retention invariants", async () => {
    const config = readIntegrationConfig();
    const serviceRoleClient = createServiceRoleSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const reviewer = await createReviewer(config, "persona-clip");
    fixtureUsers.push(reviewer);
    const applicant = await createApplicant(config, "clip-owner");
    fixtureUsers.push(applicant);
    const otherApplicant = await createApplicant(config, "clip-other");
    fixtureUsers.push(otherApplicant);
    const noClipApplicant = await createApplicant(config, "no-clip");
    fixtureUsers.push(noClipApplicant);
    fixtureApplicantIds.push(applicant.id, otherApplicant.id, noClipApplicant.id);

    const deleteDraft = await createPersonaClip(applicant, {
      contentHash: `delete-${uniqueSuffix()}`,
      mimeType: "video/webm",
    });

    const forbiddenDeleteResponse = await deletePersonaClip(authedRequest(
      otherApplicant.accessToken,
      `/api/admission/persona-clip?assetId=${deleteDraft.assetId}`,
      { method: "DELETE" },
    ));
    expect(forbiddenDeleteResponse.status).toBe(404);

    const ownerDeleteResponse = await deletePersonaClip(authedRequest(
      applicant.accessToken,
      `/api/admission/persona-clip?assetId=${deleteDraft.assetId}`,
      { method: "DELETE" },
    ));
    expect(ownerDeleteResponse.status).toBe(200);
    const { data: deletedDraft, error: deletedDraftError } =
      await serviceRoleClient
        .from("persona_clip_assets")
        .select("deletion_reason,delete_after")
        .eq("id", deleteDraft.assetId)
        .single();
    expect(deletedDraftError).toBeNull();
    expect(deletedDraft).toMatchObject({
      deletion_reason: "policy_cleanup",
    });
    expect((deletedDraft as { delete_after?: string }).delete_after)
      .toBeTruthy();

    const contentHash = `clip-${uniqueSuffix()}`;
    const uploadBody = new Uint8Array([83, 111, 117, 108, 66, 111, 117, 110, 100]);
    const clip = await createPersonaClip(applicant, {
      ownerId: otherApplicant.id,
      contentHash,
      mimeType: "video/webm",
      durationSeconds: 3,
    });
    expect(clip.upload.method).toBe("PUT");
    expect(clip.upload.url).toContain("token=");
    expect(clip.upload.headers["content-type"]).toBe("video/webm");

    const { data: draftClip, error: draftClipError } =
      await serviceRoleClient
        .from("persona_clip_assets")
        .select("applicant_id,storage_path,status,deletion_reason,delete_after")
        .eq("id", clip.assetId)
        .single();
    expect(draftClipError).toBeNull();
    expect(draftClip).toMatchObject({
      applicant_id: applicant.id,
      storage_path: `${applicant.id}/${clip.assetId}`,
      status: "draft",
      deletion_reason: null,
    });
    expect((draftClip as { delete_after?: string }).delete_after).toBeTruthy();

    const uploadResponse = await fetch(clip.upload.url, {
      method: clip.upload.method,
      headers: clip.upload.headers,
      body: new Blob([uploadBody], { type: "video/webm" }),
    });
    expect(uploadResponse.status).toBeGreaterThanOrEqual(200);
    expect(uploadResponse.status).toBeLessThan(300);

    const application = await submitApplication(applicant, {
      personaClipAssetId: clip.assetId,
      personaClipHash: contentHash,
    });
    const applicationId = String(application.id);
    expect(application.personaClipAssetId).toBe(clip.assetId);
    expect(application.personaClipHash).toBe(contentHash);

    const { data: attachedClip, error: attachedClipError } =
      await serviceRoleClient
        .from("persona_clip_assets")
        .select("application_id,status,delete_after,deletion_reason")
        .eq("id", clip.assetId)
        .single();
    expect(attachedClipError).toBeNull();
    expect(attachedClip).toMatchObject({
      application_id: applicationId,
      status: "attached",
      delete_after: null,
      deletion_reason: null,
    });

    const deleteAttachedResponse = await deletePersonaClip(authedRequest(
      applicant.accessToken,
      `/api/admission/persona-clip?assetId=${clip.assetId}`,
      { method: "DELETE" },
    ));
    expect(deleteAttachedResponse.status).toBe(404);
    const { data: stillAttachedClip, error: stillAttachedClipError } =
      await serviceRoleClient
        .from("persona_clip_assets")
        .select("status,delete_after,deletion_reason")
        .eq("id", clip.assetId)
        .single();
    expect(stillAttachedClipError).toBeNull();
    expect(stillAttachedClip).toMatchObject({
      status: "attached",
      delete_after: null,
      deletion_reason: null,
    });

    await startReview(reviewer, applicationId);

    const applicantReadUrlResponse = await getPersonaClipUrl(
      authedRequest(
        applicant.accessToken,
        `/api/admin/applications/${applicationId}/persona-clip-url`,
      ),
      routeContext(applicationId),
    );
    expect(applicantReadUrlResponse.status).toBe(403);

    const reviewerReadUrlResponse = await getPersonaClipUrl(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/applications/${applicationId}/persona-clip-url`,
      ),
      routeContext(applicationId),
    );
    expect(reviewerReadUrlResponse.status).toBe(200);
    const readUrlBody = await reviewerReadUrlResponse.json() as {
      readonly url: string;
    };
    expect(readUrlBody.url).toContain("token=");

    const readResponse = await fetch(readUrlBody.url);
    expect(readResponse.status).toBeGreaterThanOrEqual(200);
    expect(readResponse.status).toBeLessThan(300);
    expect(bytesEqual(await readResponse.arrayBuffer(), uploadBody)).toBe(true);

    const noClipApplication = await submitApplication(noClipApplicant, {
      applicantStatement: "No persona clip should still submit.",
    });
    expect(noClipApplication.status).toBe("submitted");
    expect(noClipApplication.personaClipAssetId ?? null).toBeNull();

    const approveResponse = await postApprove(
      jsonRequest(
        reviewer.accessToken,
        `/api/admin/applications/${applicationId}/approve`,
        {
          reasonCode: "meets_phase1_policy",
          applicantNotice: "Approved.",
          reviewSummary: "Internal clip review note.",
          idempotencyKey: `task7a-approve-${uniqueSuffix()}`,
        },
      ),
      routeContext(applicationId),
    );
    expect(approveResponse.status).toBe(200);

    const { data: terminalClip, error: terminalClipError } =
      await serviceRoleClient
        .from("persona_clip_assets")
        .select("delete_after,deletion_reason,status")
        .eq("id", clip.assetId)
        .single();
    expect(terminalClipError).toBeNull();
    expect(terminalClip).toMatchObject({
      deletion_reason: "application_approved",
      status: "attached",
    });
    expect((terminalClip as { delete_after?: string }).delete_after)
      .toBeTruthy();

    const { data: terminalApplication, error: terminalApplicationError } =
      await serviceRoleClient
        .from("admission_applications")
        .select("applicant_statement,motivation,referral_code,persona_clip_asset_id,persona_clip_hash")
        .eq("id", applicationId)
        .single();
    expect(terminalApplicationError).toBeNull();
    expect(terminalApplication).toMatchObject({
      applicant_statement: null,
      motivation: null,
      referral_code: null,
      persona_clip_asset_id: null,
      persona_clip_hash: null,
    });

    const { data: auditRows, error: auditError } = await serviceRoleClient
      .from("audit_logs")
      .select("metadata");
    expect(auditError).toBeNull();
    const { data: outboxRows, error: outboxError } = await serviceRoleClient
      .from("outbox_events")
      .select("payload");
    expect(outboxError).toBeNull();
    const { data: applicationRows, error: applicationRowsError } =
      await serviceRoleClient
        .from("admission_applications")
        .select("applicant_statement,motivation,referral_code,review_summary,applicant_notice,policy_snapshot_hash,ledger_ticket_ref,ledger_tx_ref,persona_clip_asset_id,persona_clip_hash");
    expect(applicationRowsError).toBeNull();
    const { data: clipNonPathRows, error: clipNonPathRowsError } =
      await serviceRoleClient
        .from("persona_clip_assets")
        .select("content_hash,mime_type,deletion_reason,status");
    expect(clipNonPathRowsError).toBeNull();
    expectNoPersonaClipSecretLeak(
      [
        ...((auditRows ?? []) as Record<string, unknown>[]),
        ...((outboxRows ?? []) as Record<string, unknown>[]),
        ...((applicationRows ?? []) as Record<string, unknown>[]),
        ...((clipNonPathRows ?? []) as Record<string, unknown>[]),
      ],
      [
        `${applicant.id}/${clip.assetId}`,
        clip.upload.url,
        readUrlBody.url,
        "object/upload/sign",
        "object/sign",
        "token=",
      ],
    );
  }, 90_000);
});
