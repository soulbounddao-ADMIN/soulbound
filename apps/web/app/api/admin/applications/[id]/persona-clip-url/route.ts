import { requireReviewer, serviceRoleAdmissionRepo } from "../../../../_lib/admin";
import { resolveActor } from "../../../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
  unauthorized,
} from "../../../../_lib/http";
import { serviceRoleStorageAdapter } from "../../../../_lib/storage";

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

    const forbidden = requireReviewer(actor);
    if (forbidden) {
      return forbidden;
    }

    const { id } = await context.params;
    const application = await serviceRoleAdmissionRepo().findById(id);
    if (!application?.personaClipAssetId) {
      return notFound();
    }

    const url = await serviceRoleStorageAdapter().getSignedUrl(
      application.personaClipAssetId,
    );
    return jsonResponse({ url });
  } catch (error) {
    return dependencyFailure(error);
  }
}
