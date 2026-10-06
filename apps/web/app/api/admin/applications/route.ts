import type { ReviewQueueQuery } from "@soulbound/core";
import {
  enrichAdminQueueUsernames,
  requireReviewer,
  serviceRoleAdmissionRepo,
} from "../../_lib/admin";
import { resolveActor } from "../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  unauthorized,
  validationError,
} from "../../_lib/http";
import { reviewQueueQuerySchema } from "../../_lib/schemas";
import type { ReviewQueueQueryParams } from "../../_lib/schemas";

function queryFromParams(params: ReviewQueueQueryParams): ReviewQueueQuery {
  return {
    limit: params.limit,
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const forbidden = requireReviewer(actor);
    if (forbidden) {
      return forbidden;
    }

    const url = new URL(request.url);
    const parsed = reviewQueueQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const applications = await serviceRoleAdmissionRepo().listReviewQueue(
      queryFromParams(parsed.data),
    );
    return jsonResponse(await enrichAdminQueueUsernames(applications));
  } catch (error) {
    return dependencyFailure(error);
  }
}
