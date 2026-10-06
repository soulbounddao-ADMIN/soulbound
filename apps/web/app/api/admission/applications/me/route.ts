import { userScopedAdmissionRepo } from "../../../_lib/admission";
import { resolveActor } from "../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  unauthorized,
} from "../../../_lib/http";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const repo = userScopedAdmissionRepo(request);
    if (!repo) {
      return unauthorized();
    }

    const application = await repo.findActiveByApplicantId(actor.id);
    return jsonResponse(application);
  } catch (error) {
    return dependencyFailure(error);
  }
}
