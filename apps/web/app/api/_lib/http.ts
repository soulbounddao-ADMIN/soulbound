import { AppError } from "@soulbound/core";
import type { AppErrorCode, Result } from "@soulbound/core";

const errorStatusByCode: Record<AppErrorCode, number> = {
  VALIDATION: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  CONFLICT: 409,
  DEPENDENCY_FAILURE: 502,
};

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function unauthorized(): Response {
  return jsonResponse({ error: { code: "UNAUTHORIZED" } }, 401);
}

export function notFound(): Response {
  return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
}

export function validationError(message: string): Response {
  return jsonResponse({ error: { code: "VALIDATION", message } }, 422);
}

export function dependencyFailure(error: unknown): Response {
  void error;
  return jsonResponse({
    error: {
      code: "DEPENDENCY_FAILURE",
      message: "dependency failure",
    },
  }, 502);
}

export function appErrorResponse(error: AppError): Response {
  return jsonResponse({
    error: {
      code: error.code,
      message: error.message,
    },
  }, errorStatusByCode[error.code]);
}

export function resultToResponse<T>(
  result: Result<T, AppError>,
  okStatus = 200,
): Response {
  if (result.ok) {
    return jsonResponse(result.value, okStatus);
  }

  return appErrorResponse(result.error);
}
