import { requireReviewer } from "../../../../../_lib/admin";
import { resolveActor } from "../../../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
  unauthorized,
  validationError,
} from "../../../../../_lib/http";
import { finalizeAdmissionVoteSchema } from "../../../../../_lib/schemas";
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

    const body = finalizeAdmissionVoteSchema.safeParse(await request.json());
    if (!body.success) {
      return validationError(body.error.message);
    }

    const { id } = await context.params;
    const repo = serviceRoleVoteRepository();
    const voteId = await repo.findOpenVoteByApplicationId(id);
    if (!voteId) {
      return notFound();
    }

    return jsonResponse(await repo.finalizeVote({
      voteId,
      actorId: "00000000-0000-4000-8000-000000001012",
      idempotencyKey: body.data.idempotencyKey,
    }));
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
