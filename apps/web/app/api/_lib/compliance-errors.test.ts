import { describe, expect, it } from "vitest";
import {
  RateLimitedError,
  complianceErrorResponse,
  toComplianceError,
} from "./compliance-errors";

describe("compliance error mapping", () => {
  it.each([
    ["SB429", 429, "RATE_LIMITED"],
    ["22023", 422, "VALIDATION"],
    ["23514", 422, "VALIDATION"],
    ["23505", 409, "CONFLICT"],
    ["P0002", 404, "NOT_FOUND"],
    ["42501", 403, "FORBIDDEN"],
    ["P0001", 409, "INVALID_STATE_TRANSITION"],
    ["XX000", 502, "DEPENDENCY_FAILURE"],
  ])("maps %s to %i", async (code, status, errorCode) => {
    const response = complianceErrorResponse(
      toComplianceError({ code, message: "db message" }),
    );
    expect(response.status).toBe(status);
    const body = await response.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe(errorCode);
    if (status === 502) {
      expect(body.error.message).toBe("dependency failure");
    }
  });

  it("treats unknown errors as dependency failures", () => {
    expect(complianceErrorResponse(new Error("boom")).status).toBe(502);
    expect(toComplianceError({ code: "SB429" })).toBeInstanceOf(RateLimitedError);
  });
});
