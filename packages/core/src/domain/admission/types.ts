/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 */
import type { Actor, ISODateString } from "../shared/types";

export type AdmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_more_info"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

/**
 * INV-22: the ONLY reason representation that flows into admission_events /
 * audit_logs. Free-text reasons are forbidden in audit/event surfaces.
 */
export type AdmissionReasonCode =
  | "meets_phase1_policy"
  | "insufficient_context"
  | "mismatch_with_policy"
  | "needs_identity_clarification"
  | "duplicate_identity_suspected"
  | "applicant_withdrew"
  | "application_expired";

export interface AdmissionApplication {
  readonly id: string;
  readonly applicantId: string;
  readonly status: AdmissionStatus;
  readonly applicantStatement?: string;
  readonly motivation?: string;
  readonly referralCode?: string;
  readonly reviewerId?: string;
  readonly reviewedAt?: ISODateString;
  /** Admin-internal note. RLS: client-read denied; never copied into audit (INV-16). */
  readonly reviewSummary?: string;
  /** Applicant-facing notice (safe to show the applicant). */
  readonly applicantNotice?: string;
  readonly policyVersion: string;
  readonly policySnapshotHash?: string;
  // Persona Clip (optional admission artifact). Absence is valid (INV-PC-01).
  readonly personaClipAssetId?: string | null;
  readonly personaClipHash?: string | null;
  // migration fields — present but unused in P0 (F5). Chain-neutral (v1.3).
  readonly ledgerTicketRef?: string;
  readonly ledgerTxRef?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ---- Service commands -------------------------------------------------------

export interface SubmitApplicationCommand {
  readonly applicantId: string;
  readonly applicantStatement?: string;
  readonly motivation?: string;
  readonly referralCode?: string;
  // optional Persona Clip reference — absence MUST NOT fail validation (INV-PC-01)
  readonly personaClipAssetId?: string | null;
  readonly personaClipHash?: string | null;
  readonly idempotencyKey: string;
}

export interface ResubmitApplicationCommand {
  readonly applicantId: string;
  readonly applicationId: string;
  readonly applicantStatement?: string;
  readonly idempotencyKey: string;
}

export interface StartReviewCommand {
  readonly actor: Actor;
  readonly applicationId: string;
  readonly idempotencyKey: string;
}

/**
 * Shared shape for approve / reject / requestMoreInfo.
 * reasonCode is REQUIRED (INV-22). No free-text `reason` field exists by design.
 */
export interface ReviewDecisionCommand {
  readonly actor: Actor;
  readonly applicationId: string;
  readonly reasonCode: AdmissionReasonCode;
  readonly applicantNotice?: string;
  readonly reviewSummary?: string;
  readonly idempotencyKey: string;
}
