import { resolveActor } from "../../../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
  unauthorized,
  validationError,
} from "../../../../../_lib/http";
import { overrideAdmissionVoteSchema } from "../../../../../_lib/schemas";
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
    if (actor.role !== "admin") {
      return jsonResponse({
        error: {
          code: "FORBIDDEN",
          message: "admin role required",
        },
      }, 403);
    }

    const body = overrideAdmissionVoteSchema.safeParse(await request.json());
    if (!body.success) {
      return validationError(body.error.message);
    }

    const { id } = await context.params;
    const repo = serviceRoleVoteRepository();
    const voteId = await repo.findOpenVoteByApplicationId(id);
    if (!voteId) {
      return notFound();
    }

    return jsonResponse(await repo.overrideVote({
      voteId,
      actorId: actor.id,
      decision: body.data.decision,
      idempotencyKey: body.data.idempotencyKey,
    }));
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
