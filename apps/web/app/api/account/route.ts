import { resolveUserContext } from "../_lib/auth";
import {
  complianceErrorResponse,
  readJsonBody,
} from "../_lib/compliance-errors";
import { accountDeletionSchema } from "../_lib/compliance-schemas";
import {
  jsonResponse,
  unauthorized,
  validationError,
} from "../_lib/http";
import { serviceRoleAccountDeletionGateway } from "./_lib/account-deletion-context";
import { deleteOwnAccount } from "./_lib/account-deletion-service";

export async function DELETE(request: Request): Promise<Response> {
  try {
    const context = await resolveUserContext(request);
    if (!context) {
      return unauthorized();
    }

    const body = accountDeletionSchema.safeParse(await readJsonBody(request));
    if (!body.success) {
      return validationError(body.error.message);
    }

    return jsonResponse(await deleteOwnAccount(
      serviceRoleAccountDeletionGateway(),
      context.userId,
    ));
  } catch (error) {
    return complianceErrorResponse(error);
  }
}
