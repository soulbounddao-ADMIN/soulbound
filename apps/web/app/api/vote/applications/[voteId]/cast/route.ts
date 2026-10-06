import {
  dependencyFailure,
  jsonResponse,
  notFound,
  validationError,
} from "../../../../_lib/http";
import { castVoteSchema } from "../../../../_lib/schemas";
import {
  requireActiveVoteContext,
  voteErrorResponse,
} from "../../../_lib/vote-context";

interface RouteContext {
  readonly params: Promise<{
    readonly voteId: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveVoteContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const body = castVoteSchema.safeParse(await request.json());
    if (!body.success) {
      return validationError(body.error.message);
    }

    const { voteId } = await context.params;
    const vote = await authorized.voteRepo.castVote(voteId, body.data.choice);
    if (!vote) {
      return notFound();
    }

    return jsonResponse(vote);
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
