import {
  AppError,
  conflict,
  dependencyFailure,
  forbidden,
  invalidTransition,
  notFound,
} from "@soulbound/core";

export interface PostgresLikeError {
  readonly code?: string | undefined;
  readonly message?: string | undefined;
  readonly details?: string | undefined;
  readonly hint?: string | undefined;
}

export function mapPostgresError(error: PostgresLikeError): AppError {
  const message = error.message ?? "supabase dependency failed";
  const meta = {
    code: error.code,
    details: error.details,
    hint: error.hint,
  };

  if (error.code === "P0002") {
    return notFound(message, meta);
  }

  if (error.code === "P0001") {
    return invalidTransition(message, meta);
  }

  if (error.code === "42501") {
    return forbidden(message, meta);
  }

  if (error.code === "23505") {
    return conflict(message, meta);
  }

  return dependencyFailure(message, meta);
}

export function throwIfSupabaseError(error: PostgresLikeError | null): void {
  if (error) {
    throw mapPostgresError(error);
  }
}
