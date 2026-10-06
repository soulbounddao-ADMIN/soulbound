import type {
  AdmissionApplication,
  ResubmitApplicationCommand,
} from "@soulbound/core";
import { resolveActor } from "../../../../_lib/auth";
import { getContainer } from "../../../../_lib/container";
import {
  appErrorResponse,
  dependencyFailure,
  jsonResponse,
  unauthorized,
  validationError,
} from "../../../../_lib/http";
import { resubmitApplicationSchema } from "../../../../_lib/schemas";
import type { ResubmitApplicationBody } from "../../../../_lib/schemas";

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

function optionalProps(
  body: ResubmitApplicationBody,
): Omit<
  ResubmitApplicationCommand,
  "applicantId" | "applicationId" | "idempotencyKey"
> {
  return {
    ...(body.applicantStatement !== undefined
      ? { applicantStatement: body.applicantStatement }
      : {}),
  };
}

function applicantSafeApplication(
  application: AdmissionApplication,
): Omit<AdmissionApplication, "reviewSummary"> {
  const { reviewSummary, ...safe } = application;
  void reviewSummary;
  return safe;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const parsed = resubmitApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const { id } = await context.params;
    const result = await getContainer().admissionService.resubmitApplication({
      applicantId: actor.id,
      applicationId: id,
      idempotencyKey: parsed.data.idempotencyKey,
      ...optionalProps(parsed.data),
    });

    if (!result.ok) {
      return appErrorResponse(result.error);
    }

    return jsonResponse(applicantSafeApplication(result.value));
  } catch (error) {
    return dependencyFailure(error);
  }
}
