import {
  dependencyFailure,
  jsonResponse,
  notFound,
} from "../../../_lib/http";
import {
  requireActiveVoteContext,
  voteErrorResponse,
} from "../../_lib/vote-context";

interface RouteContext {
  readonly params: Promise<{
    readonly voteId: string;
  }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveVoteContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const { voteId } = await context.params;
    const vote = await authorized.voteRepo.getVote(voteId);
    if (!vote) {
      return notFound();
    }

    return jsonResponse(vote);
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
