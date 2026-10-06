import {
  dependencyFailure,
  jsonResponse,
  validationError,
} from "../../../_lib/http";
import { createBoardCommentSchema } from "../../../_lib/schemas";
import { requireActiveBoardContext } from "../../_lib/board-context";

interface RouteContext {
  readonly params: Promise<{
    readonly postId: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveBoardContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const body = createBoardCommentSchema.safeParse(await request.json());
    if (!body.success) {
      return validationError(body.error.message);
    }

    const { postId } = await context.params;
    return jsonResponse(await authorized.boardRepo.addComment(
      postId,
      authorized.userId,
      body.data.body,
      authorized.myMemberNumber,
    ), 201);
  } catch (error) {
    return dependencyFailure(error);
  }
}
