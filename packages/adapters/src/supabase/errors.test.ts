import { AppError } from "@soulbound/core";
import { mapPostgresError } from "./errors";

describe("mapPostgresError", () => {
  it.each([
    ["P0002", "NOT_FOUND"],
    ["P0001", "INVALID_STATE_TRANSITION"],
    ["42501", "FORBIDDEN"],
    ["23505", "CONFLICT"],
    ["08006", "DEPENDENCY_FAILURE"],
  ])("maps %s to %s", (code, expectedCode) => {
    const error = mapPostgresError({ code, message: "database said no" });

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe(expectedCode);
    expect(error.message).toBe("database said no");
  });
});
