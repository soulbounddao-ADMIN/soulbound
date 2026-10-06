import { z } from "zod";
import type {
  AdmissionReasonCode,
  AdmissionStatus,
} from "@soulbound/core";

const optionalString = z.string().trim().min(1).optional();
const optionalApplicantStatement = z.string().trim().min(1).max(1200).optional();
const optionalNullableString = z.string().trim().min(1).nullable().optional();
const personaClipMimeTypes = [
  "video/webm",
  "video/mp4",
  "audio/webm",
  "audio/mp4",
] as const;

const admissionStatusValues = [
  "draft",
  "submitted",
  "under_review",
  "needs_more_info",
  "approved",
  "rejected",
  "withdrawn",
  "expired",
] as const satisfies readonly [AdmissionStatus, ...AdmissionStatus[]];

const admissionReasonCodeValues = [
  "meets_phase1_policy",
  "insufficient_context",
  "mismatch_with_policy",
  "needs_identity_clarification",
  "duplicate_identity_suspected",
  "applicant_withdrew",
  "application_expired",
] as const satisfies readonly [
  AdmissionReasonCode,
  ...AdmissionReasonCode[],
];

export const submitApplicationSchema = z.object({
  applicantStatement: optionalString,
  personaClipAssetId: optionalNullableString,
  personaClipHash: optionalNullableString,
  idempotencyKey: z.string().trim().min(1),
}).strict();

export type SubmitApplicationBody =
  z.infer<typeof submitApplicationSchema>;

export const resubmitApplicationSchema = z.object({
  applicantStatement: optionalApplicantStatement,
  idempotencyKey: z.string().trim().min(1),
}).strict();

export type ResubmitApplicationBody =
  z.infer<typeof resubmitApplicationSchema>;

export const startReviewSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
});

export type StartReviewBody = z.infer<typeof startReviewSchema>;

export const reviewDecisionSchema = z.object({
  reasonCode: z.enum(admissionReasonCodeValues),
  applicantNotice: optionalString,
  reviewSummary: optionalString,
  idempotencyKey: z.string().trim().min(1),
});

export type ReviewDecisionBody = z.infer<typeof reviewDecisionSchema>;

export const reviewQueueQuerySchema = z.object({
  status: z.enum(admissionStatusValues).optional(),
  limit: z.preprocess(
    (value) => value === undefined || value === "" ? 50 : value,
    z.coerce.number().int().min(1).max(100),
  ),
  cursor: optionalString,
});

export type ReviewQueueQueryParams =
  z.infer<typeof reviewQueueQuerySchema>;

export const createPersonaClipSchema = z.object({
  contentHash: z.string()
    .trim()
    .min(8)
    .max(256)
    .regex(/^[A-Za-z0-9._:-]+$/),
  mimeType: z.enum(personaClipMimeTypes),
  durationSeconds: z.number().int().min(0).max(600).optional(),
});

export type CreatePersonaClipBody =
  z.infer<typeof createPersonaClipSchema>;

export const deletePersonaClipQuerySchema = z.object({
  assetId: z.string().uuid(),
});

export type DeletePersonaClipQuery =
  z.infer<typeof deletePersonaClipQuerySchema>;

export const memberDirectoryQuerySchema = z.object({
  limit: z.preprocess(
    (value) => value === undefined || value === "" ? 50 : value,
    z.coerce.number().int().min(1).max(50),
  ),
  cursor: z.preprocess(
    (value) => value === undefined || value === "" ? null : value,
    z.coerce.number().int().min(1).nullable(),
  ),
});

export type MemberDirectoryQueryParams =
  z.infer<typeof memberDirectoryQuerySchema>;

export const boardListQuerySchema = z.object({
  limit: z.preprocess(
    (value) => value === undefined || value === "" ? 20 : value,
    z.coerce.number().int().min(1).max(50),
  ),
  cursor: z.preprocess(
    (value) => value === undefined || value === "" ? null : value,
    z.string().trim().min(1).nullable(),
  ),
});

export type BoardListQueryParams = z.infer<typeof boardListQuerySchema>;

export const voteListQuerySchema = z.object({
  limit: z.preprocess(
    (value) => value === undefined || value === "" ? 20 : value,
    z.coerce.number().int().min(1).max(50),
  ),
  cursor: z.preprocess(
    (value) => value === undefined || value === "" ? null : value,
    z.string().trim().min(1).nullable(),
  ),
});

export type VoteListQueryParams = z.infer<typeof voteListQuerySchema>;

export const castVoteSchema = z.object({
  choice: z.enum(["yes", "no"]),
}).strict();

export type CastVoteBody = z.infer<typeof castVoteSchema>;

export const openAdmissionVoteSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  windowHours: z.number().int().min(1).max(168).optional(),
}).strict();

export type OpenAdmissionVoteBody =
  z.infer<typeof openAdmissionVoteSchema>;

export const finalizeAdmissionVoteSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
}).strict();

export type FinalizeAdmissionVoteBody =
  z.infer<typeof finalizeAdmissionVoteSchema>;

export const overrideAdmissionVoteSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  idempotencyKey: z.string().trim().min(1),
}).strict();

export type OverrideAdmissionVoteBody =
  z.infer<typeof overrideAdmissionVoteSchema>;

export const createBoardPostSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

export type CreateBoardPostBody = z.infer<typeof createBoardPostSchema>;

export const createBoardCommentSchema = z.object({
  body: z.string().trim().min(1).max(1200),
}).strict();

export type CreateBoardCommentBody =
  z.infer<typeof createBoardCommentSchema>;
