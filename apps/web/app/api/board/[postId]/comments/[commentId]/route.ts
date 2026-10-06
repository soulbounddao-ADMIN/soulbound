import {
  dependencyFailure,
  jsonResponse,
  notFound,
} from "../../../../_lib/http";
import { requireActiveBoardContext } from "../../../_lib/board-context";

interface RouteContext {
  readonly params: Promise<{
    readonly commentId: string;
  }>;
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

    const { commentId } = await context.params;
    const deleted = await authorized.boardRepo.deleteOwnComment(commentId);
    if (!deleted) {
      return notFound();
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    return dependencyFailure(error);
  }
}
