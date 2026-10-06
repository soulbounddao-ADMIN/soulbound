import {
  AppError,
  conflict,
  dependencyFailure as dependencyFailureError,
  forbidden,
  invalidTransition,
  notFound,
  validation,
} from "@soulbound/core";
import {
  appErrorResponse,
  dependencyFailure,
  jsonResponse,
} from "./http";

export class RateLimitedError extends Error {
  constructor(message = "rate limit exceeded") {
    super(message);
    this.name = "RateLimitedError";
  }
}

interface PostgresLikeError {
  readonly code?: string;
  readonly message?: string;
}

// Maps SQLSTATEs raised by 0014 RPCs/triggers/constraints to route errors.
export function toComplianceError(error: PostgresLikeError): Error {
  const message = error.message ?? "supabase dependency failed";
  switch (error.code) {
    case "SB429":
      return new RateLimitedError(message);
    case "22023":
    case "22P02":
    case "23514":
      return validation(message);
    case "23505":
      return conflict(message);
    case "P0002":
      return notFound(message);
    case "42501":
      return forbidden(message);
    case "P0001":
      return invalidTransition(message);
    default:
      return dependencyFailureError(message, { code: error.code });
  }
}

export function throwIfComplianceError(error: PostgresLikeError | null): void {
  if (error) {
    throw toComplianceError(error);
  }
}

export function rateLimited(): Response {
  return jsonResponse({
    error: { code: "RATE_LIMITED", message: "too many requests" },
  }, 429);
}

export function complianceErrorResponse(error: unknown): Response {
  if (error instanceof RateLimitedError) {
    return rateLimited();
  }
  if (error instanceof AppError) {
    return error.code === "DEPENDENCY_FAILURE"
      ? dependencyFailure(error)
      : appErrorResponse(error);
  }
  return dependencyFailure(error);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
