import { z } from "zod";

export const ACCOUNT_DELETION_CONFIRMATION = "DELETE_MY_ACCOUNT";

export const reportTargetTypeValues = [
  "board_post",
  "board_comment",
  "member",
] as const;
export type ReportTargetType = (typeof reportTargetTypeValues)[number];

export const reportReasonValues = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "illegal",
  "impersonation",
  "privacy",
  "other",
] as const;
export type ReportReason = (typeof reportReasonValues)[number];

export const reportStatusValues = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof reportStatusValues)[number];

export const reportResolutionCodesByStatus = {
  resolved: ["content_removed", "member_sanctioned", "warning_issued"],
  dismissed: ["no_violation", "duplicate_report", "insufficient_information"],
} as const;

export const reportResolutionCodeValues = [
  ...reportResolutionCodesByStatus.resolved,
  ...reportResolutionCodesByStatus.dismissed,
] as const;
export type ReportResolutionCode = (typeof reportResolutionCodeValues)[number];
export type ReportClosedStatus = keyof typeof reportResolutionCodesByStatus;

export const REPORT_DETAIL_MAX_LENGTH = 500;
export const REPORTS_PER_HOUR_LIMIT = 10;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const memberNumberPattern = /^[1-9][0-9]{0,15}$/;

export function isResolutionCodeFor(
  status: ReportClosedStatus,
  code: ReportResolutionCode,
): boolean {
  return (reportResolutionCodesByStatus[status] as readonly string[])
    .includes(code);
}

export const accountDeletionSchema = z.object({
  confirm: z.literal(ACCOUNT_DELETION_CONFIRMATION),
}).strict();

export const createReportSchema = z.object({
  targetType: z.enum(reportTargetTypeValues),
  targetId: z.string().trim().min(1).max(64),
  reason: z.enum(reportReasonValues),
  detail: z.string().trim().max(REPORT_DETAIL_MAX_LENGTH).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  const valid = value.targetType === "member"
    ? memberNumberPattern.test(value.targetId)
    : uuidPattern.test(value.targetId);
  if (!valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetId"],
      message: value.targetType === "member"
        ? "targetId must be a member number"
        : "targetId must be a uuid",
    });
  }
});
export type CreateReportBody = z.infer<typeof createReportSchema>;

export const reportReviewQuerySchema = z.object({
  status: z.enum([...reportStatusValues, "all"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ReportReviewQuery = z.infer<typeof reportReviewQuerySchema>;

export const resolveReportSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  resolutionCode: z.enum(reportResolutionCodeValues),
}).strict().superRefine((value, ctx) => {
  if (!isResolutionCodeFor(value.status, value.resolutionCode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolutionCode"],
      message: `resolutionCode is not allowed for status ${value.status}`,
    });
  }
});
export type ResolveReportBody = z.infer<typeof resolveReportSchema>;

export const uuidParamSchema = z.string().regex(uuidPattern);

export const blockMemberSchema = z.object({
  memberNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

export const memberNumberParamSchema = z.string()
  .regex(memberNumberPattern)
  .transform((value) => Number.parseInt(value, 10));

export function memberLabel(memberNumber: number): string {
  return `soulbound-member-${memberNumber}`;
}
