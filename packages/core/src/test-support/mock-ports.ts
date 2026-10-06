/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork (test support).
 * Cline must NOT edit this file or the *.test.ts files. Cline only implements
 * service bodies until these tests pass. To change, say "unfreeze contract".
 */
import { vi } from "vitest";

import { featureFlags, type FeatureFlags } from "../config/feature-flags";
import type { AdmissionApplication } from "../domain/admission/types";
import type { Membership } from "../domain/membership/types";
import type { OutboxEvent } from "../domain/outbox/types";
import type { ChainReceipt } from "../domain/ledger/types";
import type {
  AdmissionRepository,
  ApproveOutcome,
} from "../ports/admission-repository";
import type { MembershipRepository } from "../ports/membership-repository";
import type { OutboxRepository } from "../ports/outbox-repository";
import type { LedgerPort } from "../ports/ledger-port";
import { POLICY_VERSION } from "../domain/admission/admission-policy";
import type { AdmissionServiceDeps } from "../domain/admission/admission-service";

const ISO = "2026-05-29T00:00:00.000Z";

export const makeApplication = (
  partial: Partial<AdmissionApplication> = {},
): AdmissionApplication => ({
  id: "app-1",
  applicantId: "user-1",
  status: "under_review",
  policyVersion: POLICY_VERSION,
  createdAt: ISO,
  updatedAt: ISO,
  ...partial,
});

export const makeMembership = (
  partial: Partial<Membership> = {},
): Membership => ({
  id: "mem-1",
  userId: "user-1",
  status: "active",
  tier: "basic",
  sourceApplicationId: "app-1",
  issuedAt: ISO,
  ...partial,
});

const skippedReceipt: ChainReceipt = { chain: "none", status: "skipped" };

const makeOutboxEvent = (): OutboxEvent => ({
  id: "obx-1",
  aggregateType: "admission_application",
  aggregateId: "app-1",
  eventType: "internal.noop",
  payload: {},
  target: "internal",
  status: "pending",
  idempotencyKey: "obx-key",
  attemptCount: 0,
  createdAt: ISO,
});

export interface MockSetupOptions {
  /** value returned by findById (default: an under_review application) */
  readonly application?: AdmissionApplication | null;
  /** value returned by findActiveByApplicantId (default: null = no active app) */
  readonly activeApplication?: AdmissionApplication | null;
  /** override flags (default: P0 main featureFlags) */
  readonly flags?: FeatureFlags;
}

export interface MockBundle {
  readonly admissionRepo: {
    [K in keyof AdmissionRepository]: ReturnType<typeof vi.fn>;
  };
  readonly membershipRepo: {
    [K in keyof MembershipRepository]: ReturnType<typeof vi.fn>;
  };
  readonly outboxRepo: {
    [K in keyof OutboxRepository]: ReturnType<typeof vi.fn>;
  };
  readonly ledger: { [K in keyof LedgerPort]: ReturnType<typeof vi.fn> };
  readonly deps: AdmissionServiceDeps;
}

export const createMocks = (opts: MockSetupOptions = {}): MockBundle => {
  const application =
    opts.application === undefined ? makeApplication() : opts.application;
  const activeApplication =
    opts.activeApplication === undefined ? null : opts.activeApplication;

  const approveOutcome: ApproveOutcome = {
    application: makeApplication({ status: "approved" }),
    membership: makeMembership({ status: "active" }),
  };

  const admissionRepo = {
    findById: vi.fn().mockResolvedValue(application),
    findActiveByApplicantId: vi.fn().mockResolvedValue(activeApplication),
    listReviewQueue: vi.fn().mockResolvedValue([]),
    submitApplicationTx: vi
      .fn()
      .mockResolvedValue(makeApplication({ status: "submitted" })),
    resubmitApplicationTx: vi
      .fn()
      .mockResolvedValue(makeApplication({ status: "submitted" })),
    startReviewTx: vi
      .fn()
      .mockResolvedValue(makeApplication({ status: "under_review" })),
    approveApplicationTx: vi.fn().mockResolvedValue(approveOutcome),
    rejectApplicationTx: vi
      .fn()
      .mockResolvedValue(makeApplication({ status: "rejected" })),
    requestMoreInfoTx: vi
      .fn()
      .mockResolvedValue(makeApplication({ status: "needs_more_info" })),
  };

  const membershipRepo = {
    findByUserId: vi.fn().mockResolvedValue(makeMembership()),
  };

  const outboxRepo = {
    enqueue: vi.fn().mockResolvedValue(makeOutboxEvent()),
    claimPending: vi.fn().mockResolvedValue([]),
    markSucceeded: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };

  const ledger = {
    issueAdmissionTicket: vi.fn().mockResolvedValue(skippedReceipt),
    issueMembershipCredential: vi.fn().mockResolvedValue(skippedReceipt),
    issueActivationStake: vi.fn().mockResolvedValue(skippedReceipt),
  };

  const deps: AdmissionServiceDeps = {
    admissionRepo: admissionRepo as unknown as AdmissionRepository,
    outboxRepo: outboxRepo as unknown as OutboxRepository,
    ledger: ledger as unknown as LedgerPort,
    flags: opts.flags ?? featureFlags,
  };

  return { admissionRepo, membershipRepo, outboxRepo, ledger, deps };
};
