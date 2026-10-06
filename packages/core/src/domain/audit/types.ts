/**
 * ⛔ CONTRACT-FROZEN — owned by Cowork. To change, say "unfreeze contract".
 *
 * INV-16: audit entries carry codes/ids/hashes ONLY. Never raw payloads
 * (no application full text, no message plaintext, no keys, no AI transcripts).
 */
import type { ISODateString } from "../shared/types";

export type AuditAction =
  | "application.submit"
  | "application.resubmit"
  | "application.review_started"
  | "application.more_info_requested"
  | "application.approved"
  | "application.rejected"
  | "membership.issued"
  | "role.changed";

export interface AuditAppendInput {
  readonly actorId: string;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  /** code/enum only — never free text (INV-16 / INV-22). */
  readonly reasonCode: string;
  /** structured, redacted metadata only — no raw payloads (INV-16). */
  readonly metadata?: Record<string, unknown>;
  readonly idempotencyKey: string;
}

export interface AuditLogEntry {
  readonly id: string;
  readonly actorId?: string;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId?: string;
  readonly reasonCode: string;
  readonly metadata: Record<string, unknown>;
  // global append-only hash chain — columns present in P0, populated in P1 (§5.4)
  readonly hash?: string;
  readonly previousHash?: string;
  readonly createdAt: ISODateString;
}
