import {
  mapAdmissionApplicationRow,
  mapApproveOutcomeRow,
  mapMembershipRow,
  mapOutboxEventRow,
} from "./mappers";
import type {
  AdmissionApplicationRow,
  ApproveOutcomeRow,
  MembershipRow,
  OutboxEventRow,
} from "./mappers";

const now = "2026-06-02T00:00:00.000Z";

describe("Supabase mappers", () => {
  it("maps nullable application columns without synthesizing reviewSummary", () => {
    const row: AdmissionApplicationRow = {
      id: "app-1",
      applicant_id: "user-1",
      status: "submitted",
      applicant_statement: "hello",
      motivation: null,
      referral_code: null,
      reviewer_id: null,
      reviewed_at: null,
      applicant_notice: null,
      policy_version: "phase1-v0.95",
      persona_clip_asset_id: null,
      persona_clip_hash: null,
      created_at: now,
      updated_at: now,
    };

    const mapped = mapAdmissionApplicationRow(row);

    expect(mapped).toEqual({
      id: "app-1",
      applicantId: "user-1",
      status: "submitted",
      applicantStatement: "hello",
      policyVersion: "phase1-v0.95",
      personaClipAssetId: null,
      personaClipHash: null,
      createdAt: now,
      updatedAt: now,
    });
    expect("reviewSummary" in mapped).toBe(false);
  });

  it("maps membership rows", () => {
    const row: MembershipRow = {
      id: "membership-1",
      user_id: "user-1",
      status: "active",
      tier: "basic",
      source_application_id: "app-1",
      issued_at: now,
    };

    expect(mapMembershipRow(row)).toEqual({
      id: "membership-1",
      userId: "user-1",
      status: "active",
      tier: "basic",
      sourceApplicationId: "app-1",
      issuedAt: now,
    });
  });

  it("maps approve composite rows", () => {
    const row: ApproveOutcomeRow = {
      application: {
        id: "app-1",
        applicant_id: "user-1",
        status: "approved",
        policy_version: "phase1-v0.95",
        created_at: now,
        updated_at: now,
      },
      membership: {
        id: "membership-1",
        user_id: "user-1",
        status: "active",
        tier: "basic",
        source_application_id: "app-1",
        issued_at: now,
      },
    };

    expect(mapApproveOutcomeRow(row).membership.sourceApplicationId).toBe("app-1");
  });

  it("maps outbox defaults", () => {
    const row: OutboxEventRow = {
      id: "event-1",
      aggregate_type: "admission_application",
      aggregate_id: "app-1",
      event_type: "internal.noop",
      target: "internal",
      status: "pending",
      idempotency_key: "idem-1",
      created_at: now,
    };

    expect(mapOutboxEventRow(row)).toEqual({
      id: "event-1",
      aggregateType: "admission_application",
      aggregateId: "app-1",
      eventType: "internal.noop",
      payload: {},
      target: "internal",
      status: "pending",
      idempotencyKey: "idem-1",
      attemptCount: 0,
      createdAt: now,
    });
  });
});
