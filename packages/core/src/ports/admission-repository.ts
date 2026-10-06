/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. Cline implements ADAPTERS for this in Task 4;
 * Cline must NOT alter these signatures. To change, say "unfreeze contract".
 *
 * The *Tx methods each map to a single Postgres rpc that performs all of its
 * writes in ONE transaction (INV-18). Inside that transaction the rpc writes
 * admission_events + audit_logs (INV-05/06), and approve additionally creates
 * the membership and flips profiles.membership_status. Because the audit/event
 * writes live inside the atomic rpc, the SERVICE does not (and must not) emit
 * them via separate sequential calls.
 */
import type {
  AdmissionApplication,
  AdmissionReasonCode,
  AdmissionStatus,
} from "../domain/admission/types";
import type { Membership } from "../domain/membership/types";

export interface ReviewQueueQuery {
  readonly status?: AdmissionStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface SubmitApplicationTxInput {
  readonly applicantId: string;
  readonly applicantStatement?: string;
  readonly motivation?: string;
  readonly referralCode?: string;
  readonly personaClipAssetId?: string | null; // optional (INV-PC-01)
  readonly personaClipHash?: string | null;
  readonly policyVersion: string;
  readonly idempotencyKey: string;
}

export interface ResubmitApplicationTxInput {
  readonly applicationId: string;
  readonly applicantId: string;
  readonly applicantStatement?: string;
  readonly idempotencyKey: string;
}

export interface DecisionTxInput {
  readonly applicationId: string;
  readonly actorId: string;
  readonly reasonCode: AdmissionReasonCode; // INV-22 — enum only, no free text
  readonly applicantNotice?: string;
  readonly reviewSummary?: string;
  readonly idempotencyKey: string;
}

export interface StartReviewTxInput {
  readonly applicationId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
}

export interface ApproveOutcome {
  readonly application: AdmissionApplication;
  readonly membership: Membership;
}

export interface AdmissionRepository {
  // ---- reads ----
  findById(applicationId: string): Promise<AdmissionApplication | null>;
  findActiveByApplicantId(applicantId: string): Promise<AdmissionApplication | null>;
  listReviewQueue(query: ReviewQueueQuery): Promise<readonly AdmissionApplication[]>;

  // ---- atomic state transitions (one rpc / one transaction each) ----
  submitApplicationTx(input: SubmitApplicationTxInput): Promise<AdmissionApplication>;
  resubmitApplicationTx(input: ResubmitApplicationTxInput): Promise<AdmissionApplication>;
  startReviewTx(input: StartReviewTxInput): Promise<AdmissionApplication>;
  approveApplicationTx(input: DecisionTxInput): Promise<ApproveOutcome>;
  rejectApplicationTx(input: DecisionTxInput): Promise<AdmissionApplication>;
  requestMoreInfoTx(input: DecisionTxInput): Promise<AdmissionApplication>;
}
