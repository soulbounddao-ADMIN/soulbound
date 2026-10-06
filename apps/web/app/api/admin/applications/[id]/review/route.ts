import { requireReviewer } from "../../../../_lib/admin";
import { resolveActor } from "../../../../_lib/auth";
import { getContainer } from "../../../../_lib/container";
import {
  dependencyFailure,
  resultToResponse,
  unauthorized,
  validationError,
} from "../../../../_lib/http";
import { startReviewSchema } from "../../../../_lib/schemas";

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
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

    const forbidden = requireReviewer(actor);
    if (forbidden) {
      return forbidden;
    }

    const parsed = startReviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const { id } = await context.params;
    const result = await getContainer().admissionService.startReview({
      actor,
      applicationId: id,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return resultToResponse(result);
  } catch (error) {
    return dependencyFailure(error);
  }
}
