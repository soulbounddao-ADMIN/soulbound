import { AppError, ok, validation } from "@soulbound/core";
import {
  appErrorResponse,
  resultToResponse,
  unauthorized,
  validationError,
} from "./http";

describe("http helpers", () => {
  it("maps successful results to JSON responses", async () => {
    const response = resultToResponse(ok({ status: "submitted" }), 201);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ status: "submitted" });
  });

  it("maps AppError codes to HTTP status codes", async () => {
    const cases = [
      [new AppError("FORBIDDEN", "no"), 403],
      [new AppError("NOT_FOUND", "missing"), 404],
      [new AppError("INVALID_STATE_TRANSITION", "state"), 409],
      [new AppError("CONFLICT", "again"), 409],
      [new AppError("DEPENDENCY_FAILURE", "dep"), 502],
    ] as const;

    for (const [error, status] of cases) {
      expect(appErrorResponse(error).status).toBe(status);
    }
  });

  it("maps validation and unauthenticated requests", () => {
    expect(resultToResponse({ ok: false, error: validation("bad") }).status)
      .toBe(422);
    expect(validationError("bad").status).toBe(422);
    expect(unauthorized().status).toBe(401);
  });
});
