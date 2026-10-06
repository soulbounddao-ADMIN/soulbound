import { requireReviewer } from "../../../../_lib/admin";
import { resolveActor, userClientFromRequest } from "../../../../_lib/auth";
import {
  complianceErrorResponse,
  readJsonBody,
} from "../../../../_lib/compliance-errors";
import {
  resolveReportSchema,
  uuidParamSchema,
} from "../../../../_lib/compliance-schemas";
import {
  jsonResponse,
  unauthorized,
  validationError,
} from "../../../../_lib/http";
import { makeReportService } from "../../../../reports/_lib/report-context";

interface RouteContext {
  readonly params: Promise<{
    readonly reportId: string;
  }>;
}

// Resolution and its audit_logs row (enum reasonCode) are written atomically
// by the resolve_report RPC as the calling reviewer/admin.
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
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

    const { reportId } = await context.params;
    if (!uuidParamSchema.safeParse(reportId).success) {
      return validationError("reportId must be a uuid");
    }

    const body = resolveReportSchema.safeParse(await readJsonBody(request));
    if (!body.success) {
      return validationError(body.error.message);
    }

    return jsonResponse(
      await makeReportService(client).resolve(reportId, body.data),
    );
  } catch (error) {
    return complianceErrorResponse(error);
  }
}
