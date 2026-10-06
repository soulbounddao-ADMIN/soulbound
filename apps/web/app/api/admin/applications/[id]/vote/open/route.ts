import { requireReviewer } from "../../../../../_lib/admin";
import { resolveActor } from "../../../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  unauthorized,
  validationError,
} from "../../../../../_lib/http";
import { openAdmissionVoteSchema } from "../../../../../_lib/schemas";
import {
  serviceRoleVoteRepository,
  voteErrorResponse,
} from "../../../../../vote/_lib/vote-context";

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

    const body = openAdmissionVoteSchema.safeParse(await request.json());
    if (!body.success) {
      return validationError(body.error.message);
    }

    const { id } = await context.params;
    const windowHours = body.data.windowHours ?? 72;
    const windowEndsAt =
      new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString();

    return jsonResponse(await serviceRoleVoteRepository().openVote({
      applicationId: id,
      actorId: actor.id,
      idempotencyKey: body.data.idempotencyKey,
      windowEndsAt,
    }));
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
