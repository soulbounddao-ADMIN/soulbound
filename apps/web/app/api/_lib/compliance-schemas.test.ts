import { describe, expect, it } from "vitest";
import {
  accountDeletionSchema,
  blockMemberSchema,
  createReportSchema,
  memberNumberParamSchema,
  reportReviewQuerySchema,
  resolveReportSchema,
} from "./compliance-schemas";

const postId = "b1000000-0000-4000-8000-000000000001";

describe("compliance schemas", () => {
  it("requires the explicit account deletion confirmation", () => {
    expect(accountDeletionSchema.safeParse({ confirm: "DELETE_MY_ACCOUNT" }).success).toBe(true);
    expect(accountDeletionSchema.safeParse({ confirm: true }).success).toBe(false);
    expect(accountDeletionSchema.safeParse({}).success).toBe(false);
    expect(accountDeletionSchema.safeParse(undefined).success).toBe(false);
    expect(accountDeletionSchema.safeParse({
      confirm: "DELETE_MY_ACCOUNT",
      userId: "someone-else",
    }).success).toBe(false);
  });

  it("validates report targets by type", () => {
    expect(createReportSchema.safeParse({
      targetType: "board_post",
      targetId: postId,
      reason: "spam",
    }).success).toBe(true);
    expect(createReportSchema.safeParse({
      targetType: "member",
      targetId: "42",
      reason: "harassment",
      detail: "optional context",
    }).success).toBe(true);
    expect(createReportSchema.safeParse({
      targetType: "member",
      targetId: postId,
      reason: "spam",
    }).success).toBe(false);
    expect(createReportSchema.safeParse({
      targetType: "board_comment",
      targetId: "42",
      reason: "spam",
    }).success).toBe(false);
  });

  it("rejects unknown reasons, long detail and extra fields", () => {
    const base = { targetType: "board_post", targetId: postId };
    expect(createReportSchema.safeParse({ ...base, reason: "rude" }).success).toBe(false);
    expect(createReportSchema.safeParse({
      ...base,
      reason: "other",
      detail: "x".repeat(501),
    }).success).toBe(false);
    expect(createReportSchema.safeParse({
      ...base,
      reason: "other",
      reporterId: "spoofed",
    }).success).toBe(false);
  });

  it("only accepts resolution codes that match the status", () => {
    expect(resolveReportSchema.safeParse({
      status: "resolved",
      resolutionCode: "content_removed",
    }).success).toBe(true);
    expect(resolveReportSchema.safeParse({
      status: "dismissed",
      resolutionCode: "no_violation",
    }).success).toBe(true);
    expect(resolveReportSchema.safeParse({
      status: "dismissed",
      resolutionCode: "content_removed",
    }).success).toBe(false);
    expect(resolveReportSchema.safeParse({
      status: "open",
      resolutionCode: "no_violation",
    }).success).toBe(false);
    expect(resolveReportSchema.safeParse({
      status: "resolved",
      resolutionCode: "because I said so",
    }).success).toBe(false);
  });

  it("parses review queries and block inputs", () => {
    expect(reportReviewQuerySchema.parse({})).toEqual({ status: "open", limit: 50 });
    expect(reportReviewQuerySchema.safeParse({ status: "weird" }).success).toBe(false);
    expect(blockMemberSchema.safeParse({ memberNumber: 7 }).success).toBe(true);
    expect(blockMemberSchema.safeParse({ memberNumber: 0 }).success).toBe(false);
    expect(blockMemberSchema.safeParse({ memberNumber: "7" }).success).toBe(false);
    expect(memberNumberParamSchema.parse("12")).toBe(12);
    expect(memberNumberParamSchema.safeParse("abc").success).toBe(false);
    expect(memberNumberParamSchema.safeParse("-1").success).toBe(false);
  });
});
