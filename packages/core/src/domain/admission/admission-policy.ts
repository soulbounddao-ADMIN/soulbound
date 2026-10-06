/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. These are pure, deterministic policy
 * rules (no I/O). They ARE the law; Cline must not weaken them. To change,
 * say "unfreeze contract".
 *
 * Admission lifecycle:
 *   draft -> submitted -> under_review -> { needs_more_info | approved | rejected }
 *   needs_more_info -> { approved | rejected | (resubmit) }
 */
import type { AdmissionStatus } from "./types";
import type { UserRole } from "../shared/types";

export const POLICY_VERSION = "phase1-v0.95";

/** Only reviewers and admins may act on the review queue (INV-11). */
export const canReview = (role: UserRole): boolean =>
  role === "reviewer" || role === "admin";

/** submitted -> under_review */
export const canStartReviewFrom = (status: AdmissionStatus): boolean =>
  status === "submitted";

/** approve / reject are permitted from these states only. */
export const canDecideFrom = (status: AdmissionStatus): boolean =>
  status === "under_review" || status === "needs_more_info";

/** needs_more_info is requested from an in-review application. */
export const canRequestMoreInfoFrom = (status: AdmissionStatus): boolean =>
  status === "under_review";

/** needs_more_info -> submitted after the applicant provides the requested update. */
export const canResubmitFrom = (status: AdmissionStatus): boolean =>
  status === "needs_more_info";
