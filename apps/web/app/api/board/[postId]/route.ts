import {
  dependencyFailure,
  jsonResponse,
  notFound,
} from "../../_lib/http";
import { requireActiveBoardContext } from "../_lib/board-context";

interface RouteContext {
  readonly params: Promise<{
    readonly postId: string;
  }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveBoardContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const { postId } = await context.params;
    const detail = await authorized.boardRepo.getPostWithComments(
      postId,
      authorized.myMemberNumber,
    );
    if (!detail) {
      return notFound();
    }

    return jsonResponse(detail);
  } catch (error) {
    return dependencyFailure(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveBoardContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const { postId } = await context.params;
    const deleted = await authorized.boardRepo.deleteOwnPost(postId);
    if (!deleted) {
      return notFound();
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    return dependencyFailure(error);
  }
}
