/**
 * ⛔ CONTRACT-FROZEN signatures — owned by Cowork.
 * Cline implements the method BODIES in Task 2 to make the frozen tests green.
 * Cline must NOT change: the interface, the deps shape, or the return types.
 * To change, say "unfreeze contract".
 *
 * Required implementation order for the decision methods (enforced by tests):
 *   1. role guard       -> Err(FORBIDDEN)                 if !canReview(actor.role)   (INV-11)
 *   2. load             -> Err(NOT_FOUND)                 if application missing
 *   3. state guard      -> Err(INVALID_STATE_TRANSITION)  if status not allowed
 *   4. atomic rpc        -> admissionRepo.*Tx(...)         (INV-05/06/18, INV-22)
 *   5. post-step (approve only): if deps.flags.externalLedgerEnabled, enqueue outbox
 *      inside try/catch so a failure NEVER rolls back the committed approval (INV-13).
 */
import type { Result } from "../../application/result";
import type { AppError } from "../../application/errors";
import type { FeatureFlags } from "../../config/feature-flags";
import type { AdmissionRepository, ApproveOutcome } from "../../ports/admission-repository";
import type { OutboxRepository } from "../../ports/outbox-repository";
import type { LedgerPort } from "../../ports/ledger-port";
import type {
  AdmissionApplication,
  ResubmitApplicationCommand,
  ReviewDecisionCommand,
  StartReviewCommand,
  SubmitApplicationCommand,
} from "./types";
import { ok, err } from "../../application/result";
import {
  forbidden,
  notFound,
  invalidTransition,
  conflict,
} from "../../application/errors";
import {
  canReview,
  canDecideFrom,
  canRequestMoreInfoFrom,
  canResubmitFrom,
  canStartReviewFrom,
  POLICY_VERSION,
} from "./admission-policy";

export interface AdmissionServiceDeps {
  readonly admissionRepo: AdmissionRepository;
  readonly outboxRepo: OutboxRepository;
  readonly ledger: LedgerPort;
  readonly flags: FeatureFlags;
  /** optional injectables for deterministic tests */
  readonly idgen?: () => string;
  readonly clock?: () => Date;
}

export interface AdmissionService {
  submitApplication(
    cmd: SubmitApplicationCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  resubmitApplication(
    cmd: ResubmitApplicationCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  startReview(
    cmd: StartReviewCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  approveApplication(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<ApproveOutcome, AppError>>;

  rejectApplication(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;

  requestMoreInfo(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>>;
}

/**
 * Task 2 — service body implementation. Follows the guard order encoded in
 * the frozen tests and admission-policy:
 *   1. role guard       -> Err(FORBIDDEN)                 if !canReview  (INV-11)
 *   2. load             -> Err(NOT_FOUND)                 if missing
 *   3. state guard      -> Err(INVALID_STATE_TRANSITION)  if status wrong
 *   4. atomic *Tx call  -> admissionRepo.*Tx(...)          (INV-05/06/18, INV-22)
 *   5. approve-only:     optional outbox/ledger in try/catch (INV-13)
 */

// -- Private helpers for exactOptionalPropertyTypes compliance ---------------
// With `exactOptionalPropertyTypes: true`, `{ foo: undefined }` is not
// assignable to `{ foo?: string }`. We must either omit the key or provide a
// value of the declared type.

/** Spread a key only when the value is defined (for `?: T` properties). */
function spreadIfDefined<K extends string, V>(
  key: K,
  value: V | undefined,
): Record<K, V> | Record<string, never> {
  return value !== undefined ? { [key]: value } as Record<K, V> : {};
}

/**
 * Spread a key when the value is defined (including `null`).
 * For `?: T | null` properties — null is a valid value, undefined means omit.
 */
function spreadNullable<K extends string, V>(
  key: K,
  value: V | null | undefined,
): Record<K, V | null> | Record<string, never> {
  return value !== undefined ? { [key]: value } as Record<K, V | null> : {};
}
export class DefaultAdmissionService implements AdmissionService {
  constructor(private readonly deps: AdmissionServiceDeps) {}

  async submitApplication(
    cmd: SubmitApplicationCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    // Duplicate-active guard (CONFLICT)
    const active =
      await this.deps.admissionRepo.findActiveByApplicantId(cmd.applicantId);
    if (active) {
      return err(conflict("duplicate active application"));
    }

    // Single atomic submit tx — persona clip fields are optional (INV-PC-01)
    const application = await this.deps.admissionRepo.submitApplicationTx({
      applicantId: cmd.applicantId,
      ...spreadIfDefined("applicantStatement", cmd.applicantStatement),
      ...spreadIfDefined("motivation", cmd.motivation),
      ...spreadIfDefined("referralCode", cmd.referralCode),
      ...spreadNullable("personaClipAssetId", cmd.personaClipAssetId),
      ...spreadNullable("personaClipHash", cmd.personaClipHash),
      policyVersion: POLICY_VERSION,
      idempotencyKey: cmd.idempotencyKey,
    });

    return ok(application);
  }

  async resubmitApplication(
    cmd: ResubmitApplicationCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    const application =
      await this.deps.admissionRepo.findById(cmd.applicationId);
    if (!application) {
      return err(notFound("application not found"));
    }

    if (application.applicantId !== cmd.applicantId) {
      return err(forbidden("application does not belong to applicant"));
    }

    if (!canResubmitFrom(application.status)) {
      return err(
        invalidTransition(
          `cannot resubmit from status '${application.status}'`,
        ),
      );
    }

    const updated = await this.deps.admissionRepo.resubmitApplicationTx({
      applicationId: cmd.applicationId,
      applicantId: cmd.applicantId,
      ...spreadIfDefined("applicantStatement", cmd.applicantStatement),
      idempotencyKey: cmd.idempotencyKey,
    });

    return ok(updated);
  }

  async startReview(
    cmd: StartReviewCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    // 1. Role guard (INV-11)
    if (!canReview(cmd.actor.role)) {
      return err(forbidden("only reviewers and admins may start review"));
    }

    // 2. Load
    const application =
      await this.deps.admissionRepo.findById(cmd.applicationId);
    if (!application) {
      return err(notFound("application not found"));
    }

    // 3. State guard — only "submitted" may transition to "under_review"
    if (!canStartReviewFrom(application.status)) {
      return err(
        invalidTransition(
          `cannot start review from status '${application.status}'`,
        ),
      );
    }

    // 4. Atomic tx
    const updated = await this.deps.admissionRepo.startReviewTx({
      applicationId: cmd.applicationId,
      actorId: cmd.actor.id,
      idempotencyKey: cmd.idempotencyKey,
    });

    return ok(updated);
  }

  async approveApplication(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<ApproveOutcome, AppError>> {
    // 1. Role guard (INV-11)
    if (!canReview(cmd.actor.role)) {
      return err(forbidden("only reviewers and admins may approve"));
    }

    // 2. Load
    const application =
      await this.deps.admissionRepo.findById(cmd.applicationId);
    if (!application) {
      return err(notFound("application not found"));
    }

    // 3. State guard
    if (!canDecideFrom(application.status)) {
      return err(
        invalidTransition(
          `cannot approve from status '${application.status}'`,
        ),
      );
    }

    // 4. Single atomic approve tx (INV-05/06/18, INV-22)
    const outcome = await this.deps.admissionRepo.approveApplicationTx({
      applicationId: cmd.applicationId,
      actorId: cmd.actor.id,
      reasonCode: cmd.reasonCode,
      ...spreadIfDefined("applicantNotice", cmd.applicantNotice),
      ...spreadIfDefined("reviewSummary", cmd.reviewSummary),
      idempotencyKey: cmd.idempotencyKey,
    });

    // 5. Post-approve side effects (INV-13: failure must NOT roll back)
    if (this.deps.flags.externalLedgerEnabled) {
      try {
        await this.deps.outboxRepo.enqueue({
          aggregateType: "admission_application",
          aggregateId: cmd.applicationId,
          eventType: "external_ledger.membership_credential.issue_requested",
          payload: {
            applicationId: cmd.applicationId,
            membershipId: outcome.membership.id,
            userId: outcome.membership.userId,
            policyVersion: POLICY_VERSION,
          },
          target: "external_ledger",
          idempotencyKey: cmd.idempotencyKey,
        });
      } catch {
        // intentionally swallowed — INV-13
      }

      try {
        await this.deps.ledger.issueMembershipCredential({
          userId: outcome.membership.userId,
          applicationId: cmd.applicationId,
          idempotencyKey: cmd.idempotencyKey,
        });
      } catch {
        // intentionally swallowed — INV-13
      }
    }

    return ok(outcome);
  }

  async rejectApplication(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    // 1. Role guard (INV-11)
    if (!canReview(cmd.actor.role)) {
      return err(forbidden("only reviewers and admins may reject"));
    }

    // 2. Load
    const application =
      await this.deps.admissionRepo.findById(cmd.applicationId);
    if (!application) {
      return err(notFound("application not found"));
    }

    // 3. State guard
    if (!canDecideFrom(application.status)) {
      return err(
        invalidTransition(
          `cannot reject from status '${application.status}'`,
        ),
      );
    }

    // 4. Atomic reject tx (INV-18/22)
    const updated = await this.deps.admissionRepo.rejectApplicationTx({
      applicationId: cmd.applicationId,
      actorId: cmd.actor.id,
      reasonCode: cmd.reasonCode,
      ...spreadIfDefined("applicantNotice", cmd.applicantNotice),
      ...spreadIfDefined("reviewSummary", cmd.reviewSummary),
      idempotencyKey: cmd.idempotencyKey,
    });

    return ok(updated);
  }

  async requestMoreInfo(
    cmd: ReviewDecisionCommand,
  ): Promise<Result<AdmissionApplication, AppError>> {
    // 1. Role guard (INV-11)
    if (!canReview(cmd.actor.role)) {
      return err(forbidden("only reviewers and admins may request more info"));
    }

    // 2. Load
    const application =
      await this.deps.admissionRepo.findById(cmd.applicationId);
    if (!application) {
      return err(notFound("application not found"));
    }

    // 3. State guard
    if (!canRequestMoreInfoFrom(application.status)) {
      return err(
        invalidTransition(
          `cannot request more info from status '${application.status}'`,
        ),
      );
    }

    // 4. Atomic tx
    const updated = await this.deps.admissionRepo.requestMoreInfoTx({
      applicationId: cmd.applicationId,
      actorId: cmd.actor.id,
      reasonCode: cmd.reasonCode,
      ...spreadIfDefined("applicantNotice", cmd.applicantNotice),
      ...spreadIfDefined("reviewSummary", cmd.reviewSummary),
      idempotencyKey: cmd.idempotencyKey,
    });

    return ok(updated);
  }
}
