import { requireReviewer } from "../../_lib/admin";
import { resolveActor, userClientFromRequest } from "../../_lib/auth";
import { complianceErrorResponse } from "../../_lib/compliance-errors";
import { reportReviewQuerySchema } from "../../_lib/compliance-schemas";
import {
  jsonResponse,
  unauthorized,
  validationError,
} from "../../_lib/http";
import { makeReportService } from "../../reports/_lib/report-context";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    const client = userClientFromRequest(request);
    if (!actor || !client) {
      return unauthorized();
    }

    const forbidden = requireReviewer(actor);
    if (forbidden) {
      return forbidden;
    }

    const query = reportReviewQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return validationError(query.error.message);
    }

    return jsonResponse({
      items: await makeReportService(client).listForReview(query.data),
    });
  } catch (error) {
    return complianceErrorResponse(error);
  }
}
