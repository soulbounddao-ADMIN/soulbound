/**
 * ⛔ CONTRACT-FROZEN public surface — owned by Cowork.
 * This is the only entry point adapters/web should import from.
 * To change, say "unfreeze contract".
 */

// application
export * from "./application/result";
export * from "./application/errors";
export type { CoreContainer } from "./application/container";

// config
export { featureFlags } from "./config/feature-flags";
export type { FeatureFlags } from "./config/feature-flags";

// shared
export type { Actor, ISODateString, UserRole } from "./domain/shared/types";

// admission
export type {
  AdmissionApplication,
  AdmissionReasonCode,
  AdmissionStatus,
  ResubmitApplicationCommand,
  ReviewDecisionCommand,
  StartReviewCommand,
  SubmitApplicationCommand,
} from "./domain/admission/types";
export {
  POLICY_VERSION,
  canDecideFrom,
  canRequestMoreInfoFrom,
  canResubmitFrom,
  canReview,
  canStartReviewFrom,
} from "./domain/admission/admission-policy";
export {
  DefaultAdmissionService,
} from "./domain/admission/admission-service";
export type {
  AdmissionService,
  AdmissionServiceDeps,
} from "./domain/admission/admission-service";

// membership
export type { Membership, MembershipStatus, MembershipTier } from "./domain/membership/types";
export { DefaultMembershipService } from "./domain/membership/membership-service";
export type {
  MembershipService,
  MembershipServiceDeps,
} from "./domain/membership/membership-service";

// audit / outbox / ledger / storage
export type { AuditAction, AuditAppendInput, AuditLogEntry } from "./domain/audit/types";
export type {
  EnqueueOutboxInput,
  OutboxEvent,
  OutboxStatus,
  OutboxTarget,
} from "./domain/outbox/types";
export type {
  ChainReceipt,
  IssueActivationStakeInput,
  IssueAdmissionTicketInput,
  IssueMembershipCredentialInput,
  LedgerChain,
} from "./domain/ledger/types";
export type {
  EvidenceReceipt,
  PutEvidenceInput,
  StorageProvider,
} from "./domain/storage/types";

// ports
export type {
  AdmissionRepository,
  ApproveOutcome,
  DecisionTxInput,
  ResubmitApplicationTxInput,
  ReviewQueueQuery,
  StartReviewTxInput,
  SubmitApplicationTxInput,
} from "./ports/admission-repository";
export type { MembershipRepository } from "./ports/membership-repository";
export type { AuditLogRepository } from "./ports/audit-log-repository";
export type { OutboxRepository } from "./ports/outbox-repository";
export type { LedgerPort } from "./ports/ledger-port";
export type { StoragePort } from "./ports/storage-port";
export type { NotificationPort, NotifyInput } from "./ports/notification-port";
export type { AuthCredentials, AuthPort, AuthSession } from "./ports/auth-port";
