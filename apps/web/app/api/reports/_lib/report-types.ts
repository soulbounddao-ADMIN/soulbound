import type {
  ReportClosedStatus,
  ReportReason,
  ReportResolutionCode,
  ReportStatus,
  ReportTargetType,
} from "../../_lib/compliance-schemas";

export interface ReportView {
  readonly id: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly detail: string | null;
  readonly status: ReportStatus;
  readonly resolutionCode: ReportResolutionCode | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export interface ReviewReportView extends ReportView {
  readonly subjectMemberNumber: number | null;
  readonly subjectLabel: string | null;
  readonly targetExcerpt: string | null;
}

export interface ResolvedReportView {
  readonly id: string;
  readonly status: ReportClosedStatus;
  readonly resolutionCode: ReportResolutionCode;
  readonly resolvedAt: string;
}

export interface CreateReportInput {
  readonly reporterId: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly detail: string | null;
}

export interface ReportRepository {
  create(input: CreateReportInput): Promise<ReportView>;
  listMine(reporterId: string, limit: number): Promise<readonly ReportView[]>;
  listForReview(
    status: ReportStatus | "all",
    limit: number,
  ): Promise<readonly ReviewReportView[]>;
  resolve(
    reportId: string,
    status: ReportClosedStatus,
    resolutionCode: ReportResolutionCode,
  ): Promise<ResolvedReportView>;
}
