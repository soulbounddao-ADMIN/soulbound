import { complianceErrorResponse } from "../../_lib/compliance-errors";
import { memberNumberParamSchema } from "../../_lib/compliance-schemas";
import { jsonResponse, validationError } from "../../_lib/http";
import { requireUserContext } from "../../_lib/member-context";
import { makeBlockService } from "../_lib/supabase-block-repository";

interface RouteContext {
  readonly params: Promise<{
    readonly memberNumber: string;
  }>;
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const user = await requireUserContext(request);
    if ("response" in user) {
      return user.response;
    }

    const memberNumber = memberNumberParamSchema.safeParse(
      (await context.params).memberNumber,
    );
    if (!memberNumber.success) {
      return validationError("memberNumber must be a positive integer");
    }

    return jsonResponse(
      await makeBlockService(user.client).unblock(memberNumber.data),
    );
  } catch (error) {
    return complianceErrorResponse(error);
  }
}
