import { resolveActor } from "../../_lib/auth";
import { getContainer } from "../../_lib/container";
import {
  dependencyFailure,
  resultToResponse,
  unauthorized,
} from "../../_lib/http";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const result = await getContainer().membershipService.getMyMembership(
      actor.id,
    );
    return resultToResponse(result);
  } catch (error) {
    return dependencyFailure(error);
  }
}
