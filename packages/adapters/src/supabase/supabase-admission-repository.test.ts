import { vi } from "vitest";

import { SupabaseAdmissionRepository } from "./supabase-admission-repository";
import type { SupabaseAdapterClient } from "./clients";
import type { AdmissionApplicationRow } from "./mappers";

const now = "2026-07-06T00:00:00.000Z";

const row: AdmissionApplicationRow = {
  id: "app-1",
  applicant_id: "user-1",
  status: "submitted",
  applicant_statement: "updated statement",
  reviewer_id: "reviewer-1",
  reviewed_at: now,
  review_summary: "internal summary",
  applicant_notice: null,
  policy_version: "phase1-v0.95",
  persona_clip_asset_id: null,
  persona_clip_hash: null,
  created_at: now,
  updated_at: now,
};

describe("SupabaseAdmissionRepository", () => {
  it("calls admission_resubmit with applicant-scoped parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const repo = new SupabaseAdmissionRepository({
      rpc,
    } as unknown as SupabaseAdapterClient);

    const application = await repo.resubmitApplicationTx({
      applicationId: "app-1",
      applicantId: "user-1",
      applicantStatement: "updated statement",
      idempotencyKey: "resubmit-1",
    });

    expect(rpc).toHaveBeenCalledWith("admission_resubmit", {
      p_application_id: "app-1",
      p_applicant_id: "user-1",
      p_statement: "updated statement",
      p_idempotency_key: "resubmit-1",
    });
    expect(application).toMatchObject({
      id: "app-1",
      applicantId: "user-1",
      status: "submitted",
      applicantStatement: "updated statement",
      reviewSummary: "internal summary",
    });
  });
});
