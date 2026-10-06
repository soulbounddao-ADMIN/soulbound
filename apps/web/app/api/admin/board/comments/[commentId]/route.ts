import { resolveActor } from "../../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
  unauthorized,
} from "../../../../_lib/http";
import { serviceRoleBoardRepository } from "../../../../board/_lib/board-context";

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

    const { commentId } = await context.params;
    const deleted = await serviceRoleBoardRepository()
      .hardDeleteComment(commentId);
    if (!deleted) {
      return notFound();
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    return dependencyFailure(error);
  }
}
