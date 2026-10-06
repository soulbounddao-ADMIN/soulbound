import {
  dependencyFailure,
  jsonResponse,
  validationError,
} from "../../_lib/http";
import { voteListQuerySchema } from "../../_lib/schemas";
import {
  requireActiveVoteContext,
  voteErrorResponse,
} from "../_lib/vote-context";

export async function GET(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveVoteContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const query = voteListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return validationError(query.error.message);
    }

    return jsonResponse(await authorized.voteRepo.listOpenVotes(query.data));
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
