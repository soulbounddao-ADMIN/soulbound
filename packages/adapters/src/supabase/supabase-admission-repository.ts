import type {
  AdmissionApplication,
  AdmissionRepository,
  ApproveOutcome,
  DecisionTxInput,
  ResubmitApplicationTxInput,
  ReviewQueueQuery,
  StartReviewTxInput,
  SubmitApplicationTxInput,
} from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import {
  mapAdmissionApplicationRow,
  mapApproveOutcomeRow,
} from "./mappers";
import type {
  AdmissionApplicationRow,
  ApproveOutcomeRow,
} from "./mappers";
import { dependencyFailure } from "@soulbound/core";
import { throwIfSupabaseError } from "./errors";

const activeApplicationStatuses = [
  "draft",
  "submitted",
  "under_review",
  "needs_more_info",
] as const;

const userScopedApplicationSelect = [
  "id",
  "applicant_id",
  "status",
  "applicant_statement",
  "motivation",
  "referral_code",
  "reviewer_id",
  "reviewed_at",
  "applicant_notice",
  "policy_version",
  "policy_snapshot_hash",
  "persona_clip_asset_id",
  "persona_clip_hash",
  "ledger_ticket_ref",
  "ledger_tx_ref",
  "created_at",
  "updated_at",
].join(",");

const serviceRoleApplicationSelect = [
  "id",
  "applicant_id",
  "status",
  "applicant_statement",
  "motivation",
  "referral_code",
  "reviewer_id",
  "reviewed_at",
  "review_summary",
  "applicant_notice",
  "policy_version",
  "policy_snapshot_hash",
  "persona_clip_asset_id",
  "persona_clip_hash",
  "ledger_ticket_ref",
  "ledger_tx_ref",
  "created_at",
  "updated_at",
].join(",");

interface SupabaseAdmissionRepositoryOptions {
  readonly applicationSelect: string;
}

function requireSingleRow<T>(value: T | T[] | null): T {
  if (Array.isArray(value)) {
    const [first] = value;
    if (first === undefined) {
      throw dependencyFailure("supabase returned an empty row array");
    }
    return first;
  }

  if (value === null) {
    throw dependencyFailure("supabase returned no row");
  }

  return value;
}

export class SupabaseAdmissionRepository implements AdmissionRepository {
  constructor(
    private readonly client: SupabaseAdapterClient,
    private readonly options: SupabaseAdmissionRepositoryOptions = {
      applicationSelect: serviceRoleApplicationSelect,
    },
  ) {}

  async findById(applicationId: string): Promise<AdmissionApplication | null> {
    const { data, error } = await this.client
      .from("admission_applications")
      .select(this.options.applicationSelect)
      .eq("id", applicationId)
      .maybeSingle();

    throwIfSupabaseError(error);
    return data
      ? mapAdmissionApplicationRow(data as unknown as AdmissionApplicationRow)
      : null;
  }

  async findActiveByApplicantId(
    applicantId: string,
  ): Promise<AdmissionApplication | null> {
    const { data, error } = await this.client
      .from("admission_applications")
      .select(this.options.applicationSelect)
      .eq("applicant_id", applicantId)
      .in("status", [...activeApplicationStatuses])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfSupabaseError(error);
    return data
      ? mapAdmissionApplicationRow(data as unknown as AdmissionApplicationRow)
      : null;
  }

  async listReviewQueue(
    query: ReviewQueueQuery,
  ): Promise<readonly AdmissionApplication[]> {
    let builder = this.client
      .from("admission_applications")
      .select(this.options.applicationSelect)
      .order("created_at", { ascending: true })
      .limit(query.limit);

    if (query.status !== undefined) {
      builder = builder.eq("status", query.status);
    }

    if (query.cursor !== undefined) {
      builder = builder.gt("created_at", query.cursor);
    }

    const { data, error } = await builder;
    throwIfSupabaseError(error);
    return (data ?? []).map((row) =>
      mapAdmissionApplicationRow(row as unknown as AdmissionApplicationRow),
    );
  }

  async submitApplicationTx(
    input: SubmitApplicationTxInput,
  ): Promise<AdmissionApplication> {
    const { data, error } = await this.client.rpc("submit_application_tx", {
      p_applicant_id: input.applicantId,
      p_policy_version: input.policyVersion,
      p_idempotency_key: input.idempotencyKey,
      p_applicant_statement: input.applicantStatement ?? null,
      p_motivation: input.motivation ?? null,
      p_referral_code: input.referralCode ?? null,
      p_persona_clip_asset_id: input.personaClipAssetId ?? null,
      p_persona_clip_hash: input.personaClipHash ?? null,
    });

    throwIfSupabaseError(error);
    return mapAdmissionApplicationRow(
      requireSingleRow(data as AdmissionApplicationRow | AdmissionApplicationRow[] | null),
    );
  }

  async resubmitApplicationTx(
    input: ResubmitApplicationTxInput,
  ): Promise<AdmissionApplication> {
    const { data, error } = await this.client.rpc("admission_resubmit", {
      p_application_id: input.applicationId,
      p_applicant_id: input.applicantId,
      p_statement: input.applicantStatement ?? null,
      p_idempotency_key: input.idempotencyKey,
    });

    throwIfSupabaseError(error);
    return mapAdmissionApplicationRow(
      requireSingleRow(data as AdmissionApplicationRow | AdmissionApplicationRow[] | null),
    );
  }

  async startReviewTx(
    input: StartReviewTxInput,
  ): Promise<AdmissionApplication> {
    const { data, error } = await this.client.rpc("start_review_tx", {
      p_application_id: input.applicationId,
      p_actor_id: input.actorId,
      p_idempotency_key: input.idempotencyKey,
    });

    throwIfSupabaseError(error);
    return mapAdmissionApplicationRow(
      requireSingleRow(data as AdmissionApplicationRow | AdmissionApplicationRow[] | null),
    );
  }

  async approveApplicationTx(input: DecisionTxInput): Promise<ApproveOutcome> {
    const { data, error } = await this.client.rpc("approve_application_tx", {
      p_application_id: input.applicationId,
      p_actor_id: input.actorId,
      p_reason_code: input.reasonCode,
      p_idempotency_key: input.idempotencyKey,
      p_applicant_notice: input.applicantNotice ?? null,
      p_review_summary: input.reviewSummary ?? null,
    });

    throwIfSupabaseError(error);
    return mapApproveOutcomeRow(requireSingleRow(data as ApproveOutcomeRow | ApproveOutcomeRow[] | null));
  }

  async rejectApplicationTx(
    input: DecisionTxInput,
  ): Promise<AdmissionApplication> {
    const { data, error } = await this.client.rpc("reject_application_tx", {
      p_application_id: input.applicationId,
      p_actor_id: input.actorId,
      p_reason_code: input.reasonCode,
      p_idempotency_key: input.idempotencyKey,
      p_applicant_notice: input.applicantNotice ?? null,
      p_review_summary: input.reviewSummary ?? null,
    });

    throwIfSupabaseError(error);
    return mapAdmissionApplicationRow(
      requireSingleRow(data as AdmissionApplicationRow | AdmissionApplicationRow[] | null),
    );
  }

  async requestMoreInfoTx(
    input: DecisionTxInput,
  ): Promise<AdmissionApplication> {
    const { data, error } = await this.client.rpc("request_more_info_tx", {
      p_application_id: input.applicationId,
      p_actor_id: input.actorId,
      p_reason_code: input.reasonCode,
      p_idempotency_key: input.idempotencyKey,
      p_applicant_notice: input.applicantNotice ?? null,
      p_review_summary: input.reviewSummary ?? null,
    });

    throwIfSupabaseError(error);
    return mapAdmissionApplicationRow(
      requireSingleRow(data as AdmissionApplicationRow | AdmissionApplicationRow[] | null),
    );
  }
}

export function makeUserScopedAdmissionRepository(
  client: SupabaseAdapterClient,
): AdmissionRepository {
  return new SupabaseAdmissionRepository(client, {
    applicationSelect: userScopedApplicationSelect,
  });
}

export function makeServiceRoleAdmissionRepository(
  client: SupabaseAdapterClient,
): AdmissionRepository {
  return new SupabaseAdmissionRepository(client, {
    applicationSelect: serviceRoleApplicationSelect,
  });
}
