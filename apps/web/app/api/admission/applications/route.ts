import type { SubmitApplicationCommand } from "@soulbound/core";
import { resolveActor } from "../../_lib/auth";
import { getContainer } from "../../_lib/container";
import {
  dependencyFailure,
  resultToResponse,
  unauthorized,
  validationError,
} from "../../_lib/http";
import { submitApplicationSchema } from "../../_lib/schemas";
import type { SubmitApplicationBody } from "../../_lib/schemas";
import { serviceRoleStorageAdapter } from "../../_lib/storage";

function optionalProps(
  body: SubmitApplicationBody,
): Omit<SubmitApplicationCommand, "applicantId" | "idempotencyKey"> {
  return {
    ...(body.applicantStatement !== undefined
      ? { applicantStatement: body.applicantStatement }
      : {}),
    ...(body.personaClipAssetId !== undefined
      ? { personaClipAssetId: body.personaClipAssetId }
      : {}),
    ...(body.personaClipHash !== undefined
      ? { personaClipHash: body.personaClipHash }
      : {}),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const parsed = submitApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const result = await getContainer().admissionService.submitApplication({
      applicantId: actor.id,
      idempotencyKey: parsed.data.idempotencyKey,
      ...optionalProps(parsed.data),
    });

    if (result.ok && typeof parsed.data.personaClipAssetId === "string") {
      const cleared =
        await serviceRoleStorageAdapter().clearSubmittedRetention({
          ownerId: actor.id,
          assetId: parsed.data.personaClipAssetId,
          applicationId: result.value.id,
        });
      if (!cleared) {
        return dependencyFailure(
          new Error("submitted persona clip retention was not cleared"),
        );
      }
    }

    return resultToResponse(result, 201);
  } catch (error) {
    return dependencyFailure(error);
  }
}
