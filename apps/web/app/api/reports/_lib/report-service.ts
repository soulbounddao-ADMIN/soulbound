import { validation } from "@soulbound/core";
import {
  isResolutionCodeFor,
  type CreateReportBody,
  type ReportReviewQuery,
  type ResolveReportBody,
} from "../../_lib/compliance-schemas";
import type {
  ReportRepository,
  ReportView,
  ResolvedReportView,
  ReviewReportView,
} from "./report-types";

export class ReportService {
  constructor(private readonly repo: ReportRepository) {}

  async create(reporterId: string, body: CreateReportBody): Promise<ReportView> {
    const detail = body.detail?.trim() ? body.detail.trim() : null;
    return await this.repo.create({
      reporterId,
      targetType: body.targetType,
      targetId: body.targetType === "member"
        ? body.targetId
        : body.targetId.toLowerCase(),
      reason: body.reason,
      detail,
    });
  }

  async listMine(reporterId: string): Promise<readonly ReportView[]> {
    return await this.repo.listMine(reporterId, 50);
  }

  async listForReview(
    query: ReportReviewQuery,
  ): Promise<readonly ReviewReportView[]> {
    return await this.repo.listForReview(query.status, query.limit);
  }

  async resolve(
    reportId: string,
    body: ResolveReportBody,
  ): Promise<ResolvedReportView> {
    if (!isResolutionCodeFor(body.status, body.resolutionCode)) {
      throw validation("resolutionCode does not match status");
    }
    return await this.repo.resolve(reportId, body.status, body.resolutionCode);
  }
}
