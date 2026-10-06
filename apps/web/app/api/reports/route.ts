import {
  complianceErrorResponse,
  readJsonBody,
} from "../_lib/compliance-errors";
import { createReportSchema } from "../_lib/compliance-schemas";
import { jsonResponse, validationError } from "../_lib/http";
import {
  requireActiveMemberContext,
  requireUserContext,
} from "../_lib/member-context";
import { makeReportService } from "./_lib/report-context";

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireActiveMemberContext(request);
    if ("response" in context) {
      return context.response;
    }

    const body = createReportSchema.safeParse(await readJsonBody(request));
    if (!body.success) {
      return validationError(body.error.message);
    }

    return jsonResponse(
      await makeReportService(context.client).create(context.userId, body.data),
      201,
    );
  } catch (error) {
    return complianceErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireUserContext(request);
    if ("response" in context) {
      return context.response;
    }

    return jsonResponse({
      items: await makeReportService(context.client).listMine(context.userId),
    });
  } catch (error) {
    return complianceErrorResponse(error);
  }
}
