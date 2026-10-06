import type {
  AdmissionApplication,
  ApproveOutcome,
  AuditLogEntry,
  Membership,
  OutboxEvent,
} from "@soulbound/core";

export interface AdmissionApplicationRow {
  readonly id: string;
  readonly applicant_id: string;
  readonly status: AdmissionApplication["status"];
  readonly applicant_statement?: string | null;
  readonly motivation?: string | null;
  readonly referral_code?: string | null;
  readonly reviewer_id?: string | null;
  readonly reviewed_at?: string | null;
  readonly review_summary?: string | null;
  readonly applicant_notice?: string | null;
  readonly policy_version: string;
  readonly policy_snapshot_hash?: string | null;
  readonly persona_clip_asset_id?: string | null;
  readonly persona_clip_hash?: string | null;
  readonly ledger_ticket_ref?: string | null;
  readonly ledger_tx_ref?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface MembershipRow {
  readonly id: string;
  readonly user_id: string;
  readonly status: Membership["status"];
  readonly tier: Membership["tier"];
  readonly source_application_id?: string | null;
  readonly ledger_credential_ref?: string | null;
  readonly ledger_tx_ref?: string | null;
  readonly issued_at: string;
  readonly expires_at?: string | null;
  readonly revoked_at?: string | null;
}

export interface AuditLogRow {
  readonly id: string;
  readonly actor_id?: string | null;
  readonly action: AuditLogEntry["action"];
  readonly entity_type: string;
  readonly entity_id?: string | null;
  readonly reason_code?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly hash?: string | null;
  readonly previous_hash?: string | null;
  readonly created_at: string;
}

export interface OutboxEventRow {
  readonly id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly payload?: Record<string, unknown> | null;
  readonly target: OutboxEvent["target"];
  readonly status: OutboxEvent["status"];
  readonly idempotency_key: string;
  readonly attempt_count?: number | null;
  readonly last_error?: string | null;
  readonly processed_at?: string | null;
  readonly created_at: string;
}

export interface PersonaClipAssetRow {
  readonly id: string;
  readonly applicant_id: string;
  readonly application_id?: string | null;
  readonly storage_provider: "supabase";
  readonly storage_path: string;
  readonly content_hash: string;
  readonly mime_type: string;
  readonly size_bytes: number | string;
}

export interface ApproveOutcomeRow {
  readonly application: AdmissionApplicationRow;
  readonly membership: MembershipRow;
}

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function optionalNullableString(value: string | null | undefined): string | null | undefined {
  return value !== undefined ? value : undefined;
}

function sizeToNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  return 0;
}

function spreadString<K extends string>(
  key: K,
  value: string | null | undefined,
): Record<K, string> | Record<string, never> {
  const mapped = optionalString(value);
  return mapped !== undefined ? { [key]: mapped } as Record<K, string> : {};
}

function spreadNullableString<K extends string>(
  key: K,
  value: string | null | undefined,
): Record<K, string | null> | Record<string, never> {
  const mapped = optionalNullableString(value);
  return mapped !== undefined ? { [key]: mapped } as Record<K, string | null> : {};
}

export function mapAdmissionApplicationRow(
  row: AdmissionApplicationRow,
): AdmissionApplication {
  return {
    id: row.id,
    applicantId: row.applicant_id,
    status: row.status,
    ...spreadString("applicantStatement", row.applicant_statement),
    ...spreadString("motivation", row.motivation),
    ...spreadString("referralCode", row.referral_code),
    ...spreadString("reviewerId", row.reviewer_id),
    ...spreadString("reviewedAt", row.reviewed_at),
    ...spreadString("reviewSummary", row.review_summary),
    ...spreadString("applicantNotice", row.applicant_notice),
    policyVersion: row.policy_version,
    ...spreadString("policySnapshotHash", row.policy_snapshot_hash),
    ...spreadNullableString("personaClipAssetId", row.persona_clip_asset_id),
    ...spreadNullableString("personaClipHash", row.persona_clip_hash),
    ...spreadString("ledgerTicketRef", row.ledger_ticket_ref),
    ...spreadString("ledgerTxRef", row.ledger_tx_ref),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMembershipRow(row: MembershipRow): Membership {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    tier: row.tier,
    ...spreadString("sourceApplicationId", row.source_application_id),
    ...spreadString("ledgerCredentialRef", row.ledger_credential_ref),
    ...spreadString("ledgerTxRef", row.ledger_tx_ref),
    issuedAt: row.issued_at,
    ...spreadString("expiresAt", row.expires_at),
    ...spreadString("revokedAt", row.revoked_at),
  };
}

export function mapApproveOutcomeRow(row: ApproveOutcomeRow): ApproveOutcome {
  return {
    application: mapAdmissionApplicationRow(row.application),
    membership: mapMembershipRow(row.membership),
  };
}

export function mapAuditLogRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    ...spreadString("actorId", row.actor_id),
    action: row.action,
    entityType: row.entity_type,
    ...spreadString("entityId", row.entity_id),
    reasonCode: row.reason_code ?? "",
    metadata: row.metadata ?? {},
    ...spreadString("hash", row.hash),
    ...spreadString("previousHash", row.previous_hash),
    createdAt: row.created_at,
  };
}

export function mapOutboxEventRow(row: OutboxEventRow): OutboxEvent {
  return {
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: row.payload ?? {},
    target: row.target,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count ?? 0,
    ...spreadString("lastError", row.last_error),
    ...spreadString("processedAt", row.processed_at),
    createdAt: row.created_at,
  };
}

export function mapPersonaClipAssetToEvidenceReceipt(row: PersonaClipAssetRow) {
  return {
    id: row.id,
    provider: row.storage_provider,
    objectPath: row.storage_path,
    contentHash: row.content_hash,
    sizeBytes: sizeToNumber(row.size_bytes),
  };
}
