import {
  complianceErrorResponse,
  readJsonBody,
} from "../_lib/compliance-errors";
import { blockMemberSchema } from "../_lib/compliance-schemas";
import { jsonResponse, validationError } from "../_lib/http";
import {
  requireActiveMemberContext,
  requireUserContext,
} from "../_lib/member-context";
import { makeBlockService } from "./_lib/supabase-block-repository";

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireUserContext(request);
    if ("response" in context) {
      return context.response;
    }
    return jsonResponse(await makeBlockService(context.client).listMine());
  } catch (error) {
    return complianceErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireActiveMemberContext(request);
    if ("response" in context) {
      return context.response;
    }

    const body = blockMemberSchema.safeParse(await readJsonBody(request));
    if (!body.success) {
      return validationError(body.error.message);
    }

    return jsonResponse(
      await makeBlockService(context.client).block(body.data.memberNumber),
      201,
    );
  } catch (error) {
    return complianceErrorResponse(error);
  }
}
