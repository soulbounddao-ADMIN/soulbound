import { userScopedAdmissionRepo } from "../../../_lib/admission";
import { resolveActor } from "../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
  unauthorized,
} from "../../../_lib/http";

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
  }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const repo = userScopedAdmissionRepo(request);
    if (!repo) {
      return unauthorized();
    }

    const { id } = await context.params;
    const application = await repo.findById(id);
    if (!application) {
      return notFound();
    }

    return jsonResponse(application);
  } catch (error) {
    return dependencyFailure(error);
  }
}
