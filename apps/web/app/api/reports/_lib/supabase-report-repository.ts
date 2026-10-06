import type { SupabaseAdapterClient } from "@soulbound/adapters";
import { throwIfComplianceError } from "../../_lib/compliance-errors";
import {
  memberLabel,
  type ReportClosedStatus,
  type ReportReason,
  type ReportResolutionCode,
  type ReportStatus,
  type ReportTargetType,
} from "../../_lib/compliance-schemas";
import type {
  CreateReportInput,
  ReportRepository,
  ReportView,
  ResolvedReportView,
  ReviewReportView,
} from "./report-types";

// Authenticated SELECT grant on public.reports. reporter_id, subject_user_id,
// and resolved_by are not selectable; own rows are scoped by RLS only.
const reportColumns =
  "id,target_type,target_ref,reason,detail,status,resolution_code,resolved_at,created_at";

interface ReportRow {
  readonly id: string;
  readonly target_type: ReportTargetType;
  readonly target_ref: string;
  readonly reason: ReportReason;
  readonly detail: string | null;
  readonly status: ReportStatus;
  readonly resolution_code: ReportResolutionCode | null;
  readonly resolved_at: string | null;
  readonly created_at: string;
}

interface ReviewReportRow extends ReportRow {
  readonly subject_member_number: number | string | null;
  readonly target_excerpt: string | null;
}

interface ResolvedReportRow {
  readonly id: string;
  readonly status: ReportClosedStatus;
  readonly resolution_code: ReportResolutionCode;
  readonly resolved_at: string;
}

function mapReport(row: ReportRow): ReportView {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_ref,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    resolutionCode: row.resolution_code,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

function toNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabaseReportRepository implements ReportRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async create(input: CreateReportInput): Promise<ReportView> {
    const { data, error } = await this.client
      .from("reports")
      .insert({
        reporter_id: input.reporterId,
        target_type: input.targetType,
        target_ref: input.targetId,
        reason: input.reason,
        detail: input.detail,
      })
      .select(reportColumns)
      .single();

    throwIfComplianceError(error);
    return mapReport(data as unknown as ReportRow);
  }

  async listMine(
    _reporterId: string,
    limit: number,
  ): Promise<readonly ReportView[]> {
    // RLS "reports select own" is the filter. Do not reference reporter_id.
    const { data, error } = await this.client
      .from("reports")
      .select(reportColumns)
      .order("created_at", { ascending: false })
      .limit(limit);

    throwIfComplianceError(error);
    return ((data ?? []) as unknown as ReportRow[]).map(mapReport);
  }

  async listForReview(
    status: ReportStatus | "all",
    limit: number,
  ): Promise<readonly ReviewReportView[]> {
    const { data, error } = await this.client.rpc("list_reports_for_review", {
      p_status: status,
      p_limit: limit,
    });

    throwIfComplianceError(error);
    return ((data ?? []) as unknown as ReviewReportRow[]).map((row) => {
      const subjectMemberNumber = toNumber(row.subject_member_number);
      return {
        ...mapReport(row),
        subjectMemberNumber,
        subjectLabel: subjectMemberNumber === null
          ? null
          : memberLabel(subjectMemberNumber),
        targetExcerpt: row.target_excerpt,
      };
    });
  }

  async resolve(
    reportId: string,
    status: ReportClosedStatus,
    resolutionCode: ReportResolutionCode,
  ): Promise<ResolvedReportView> {
    const { data, error } = await this.client
      .rpc("resolve_report", {
        p_report_id: reportId,
        p_status: status,
        p_resolution_code: resolutionCode,
      })
      .single();

    throwIfComplianceError(error);
    const row = data as unknown as ResolvedReportRow;
    return {
      id: row.id,
      status: row.status,
      resolutionCode: row.resolution_code,
      resolvedAt: row.resolved_at,
    };
  }
}
