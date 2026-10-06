/**
 * ⛔ CONTRACT-FROZEN TESTS — owned by Cowork.
 * Cline must NOT edit assertions, weaken expectations, .skip, or .todo these.
 * Cline implements service bodies (Task 2) until every test is green.
 * Audit guard: `rg "\.skip\(|\.todo\(" packages/core` must return 0.
 *
 * At freeze these tests are RED (the service stub throws NOT_IMPLEMENTED).
 * That is expected. Task 1 acceptance = typecheck/build/audit (NOT test-green).
 * Task 2 acceptance = these tests green.
 */
import { describe, expect, it } from "vitest";

import { DefaultAdmissionService } from "./admission-service";
import { isErr, isOk } from "../../application/result";
import { featureFlags } from "../../config/feature-flags";
import { createMocks, makeApplication } from "../../test-support/mock-ports";
import type { Actor } from "../shared/types";

const reviewer: Actor = { id: "rev-1", role: "reviewer" };
const admin: Actor = { id: "adm-1", role: "admin" };
const member: Actor = { id: "mem-1", role: "member" };
const applicant: Actor = { id: "app-user", role: "applicant" };

const decision = (actor: Actor) =>
  ({
    actor,
    applicationId: "app-1",
    reasonCode: "meets_phase1_policy" as const,
    applicantNotice: "welcome",
    reviewSummary: "internal note",
    idempotencyKey: "idem-1",
  });

describe("AdmissionService.submitApplication", () => {
  it("submits via a single atomic submit tx", async () => {
    const m = createMocks({ activeApplication: null });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.submitApplication({
      applicantId: "user-1",
      applicantStatement: "hello",
      idempotencyKey: "idem-submit",
    });

    expect(isOk(res)).toBe(true);
    expect(m.admissionRepo.submitApplicationTx).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate active application with CONFLICT", async () => {
    const m = createMocks({
      activeApplication: makeApplication({ status: "submitted" }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.submitApplication({
      applicantId: "user-1",
      idempotencyKey: "idem-submit",
    });

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("CONFLICT");
    expect(m.admissionRepo.submitApplicationTx).not.toHaveBeenCalled();
  });

  it("INV-PC-01: submits successfully WITHOUT a persona clip (absence is valid)", async () => {
    const m = createMocks({ activeApplication: null });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.submitApplication({
      applicantId: "user-1",
      applicantStatement: "hello",
      // no personaClipAssetId / personaClipHash
      idempotencyKey: "idem-noclip",
    });

    expect(isOk(res)).toBe(true);
    expect(m.admissionRepo.submitApplicationTx).toHaveBeenCalledTimes(1);
  });

  it("accepts an optional persona clip reference and forwards it to the tx", async () => {
    const m = createMocks({ activeApplication: null });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.submitApplication({
      applicantId: "user-1",
      personaClipAssetId: "clip-1",
      personaClipHash: "deadbeef",
      idempotencyKey: "idem-clip",
    });

    expect(isOk(res)).toBe(true);
    const arg = (m.admissionRepo.submitApplicationTx.mock.calls[0]?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(arg.personaClipAssetId).toBe("clip-1");
    expect(arg.personaClipHash).toBe("deadbeef");
  });

  it("INV-PC-01: explicit null persona clip does not fail validation", async () => {
    const m = createMocks({ activeApplication: null });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.submitApplication({
      applicantId: "user-1",
      personaClipAssetId: null,
      personaClipHash: null,
      idempotencyKey: "idem-null",
    });

    expect(isOk(res)).toBe(true);
    expect(m.admissionRepo.submitApplicationTx).toHaveBeenCalledTimes(1);
  });
});

describe("AdmissionService persona clip does not affect status transition guards", () => {
  it("INV-PC-07: approve guards ignore persona clip presence (clip is not a gate)", async () => {
    // application carries a persona clip; approval still depends only on role + state
    const m = createMocks({
      application: makeApplication({
        status: "under_review",
        personaClipAssetId: "clip-9",
        personaClipHash: "abc123",
      }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication({
      actor: { id: "rev-1", role: "reviewer" },
      applicationId: "app-1",
      reasonCode: "meets_phase1_policy",
      idempotencyKey: "idem-pc-approve",
    });

    expect(isOk(res)).toBe(true);
    expect(m.admissionRepo.approveApplicationTx).toHaveBeenCalledTimes(1);
  });
});

describe("AdmissionService.approveApplication", () => {
  it("INV-11: a member cannot approve (FORBIDDEN), tx not called", async () => {
    const m = createMocks();
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication(decision(member));

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("FORBIDDEN");
    expect(m.admissionRepo.approveApplicationTx).not.toHaveBeenCalled();
  });

  it("INV-11: an applicant cannot approve (FORBIDDEN)", async () => {
    const m = createMocks();
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication(decision(applicant));

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("FORBIDDEN");
  });

  it("returns NOT_FOUND when the application is missing", async () => {
    const m = createMocks({ application: null });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication(decision(reviewer));

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("NOT_FOUND");
    expect(m.admissionRepo.approveApplicationTx).not.toHaveBeenCalled();
  });

  it("rejects an invalid state transition (already approved)", async () => {
    const m = createMocks({ application: makeApplication({ status: "approved" }) });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication(decision(reviewer));

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INVALID_STATE_TRANSITION");
    expect(m.admissionRepo.approveApplicationTx).not.toHaveBeenCalled();
  });

  it("INV-05/06/18/22: approve commits exactly one atomic tx carrying reasonCode (no free-text reason)", async () => {
    const m = createMocks({ application: makeApplication({ status: "under_review" }) });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication(decision(reviewer));

    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.value.membership.status).toBe("active");

    // INV-18: single atomic operation (not multiple sequential writes)
    expect(m.admissionRepo.approveApplicationTx).toHaveBeenCalledTimes(1);

    const arg = (m.admissionRepo.approveApplicationTx.mock.calls[0]?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    // INV-22: reasonCode enum flows; no free-text `reason` leaks into the tx payload
    expect(arg.reasonCode).toBe("meets_phase1_policy");
    expect(arg.reason).toBeUndefined();
  });

  it("admin role is also allowed to approve", async () => {
    const m = createMocks({ application: makeApplication({ status: "needs_more_info" }) });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.approveApplication(decision(admin));

    expect(isOk(res)).toBe(true);
    expect(m.admissionRepo.approveApplicationTx).toHaveBeenCalledTimes(1);
  });

  it("INV-13: an outbox/ledger failure does NOT roll back the committed approval", async () => {
    const m = createMocks({
      application: makeApplication({ status: "under_review" }),
      flags: { ...featureFlags, externalLedgerEnabled: true },
    });
    // simulate the optional post-approve side effect blowing up
    m.outboxRepo.enqueue.mockRejectedValue(new Error("external ledger relay down"));
    m.ledger.issueMembershipCredential.mockRejectedValue(new Error("ledger down"));

    const svc = new DefaultAdmissionService(m.deps);
    const res = await svc.approveApplication(decision(reviewer));

    // approval still succeeds and membership stays active
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.value.membership.status).toBe("active");
    // the atomic approval committed before the side effect was attempted
    expect(m.admissionRepo.approveApplicationTx).toHaveBeenCalledTimes(1);
  });

  it("INV-16: the outbox payload carries ids/refs only — no free-text or PII", async () => {
    const applicantStatement = "private applicant statement";
    const motivation = "private applicant motivation";
    const reviewSummary = "private reviewer summary";
    const applicantNotice = "private applicant notice";
    const storagePath = "user-1/private/persona-clip.webm";
    const forbiddenValues = [
      applicantStatement,
      motivation,
      reviewSummary,
      applicantNotice,
      storagePath,
    ];
    const application = makeApplication({
      status: "under_review",
      applicantStatement,
      motivation,
      reviewSummary,
      applicantNotice,
      personaClipHash: storagePath,
    });
    const m = createMocks({
      application,
      flags: { ...featureFlags, externalLedgerEnabled: true },
    });
    const svc = new DefaultAdmissionService(m.deps);
    const cmd = {
      ...decision(reviewer),
      idempotencyKey: "idem-inv-16",
    };

    const res = await svc.approveApplication(cmd);

    expect(isOk(res)).toBe(true);
    expect(m.outboxRepo.enqueue).toHaveBeenCalledTimes(1);

    const event = (m.outboxRepo.enqueue.mock.calls[0]?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    const payload = event.payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "applicationId",
      "membershipId",
      "policyVersion",
      "userId",
    ]);
    expect(payload).toEqual({
      applicationId: "app-1",
      membershipId: "mem-1",
      userId: "user-1",
      policyVersion: application.policyVersion,
    });

    const serializedPayload = JSON.stringify(payload);
    expect(serializedPayload).not.toContain("storage_path");
    for (const forbiddenValue of forbiddenValues) {
      expect(serializedPayload).not.toContain(forbiddenValue);
    }
    expect(event.target).toBe("external_ledger");
    expect(event.idempotencyKey).toBe(cmd.idempotencyKey);
  });
});

describe("AdmissionService.rejectApplication", () => {
  it("INV-11: a member cannot reject (FORBIDDEN)", async () => {
    const m = createMocks();
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.rejectApplication(decision(member));

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("FORBIDDEN");
    expect(m.admissionRepo.rejectApplicationTx).not.toHaveBeenCalled();
  });

  it("INV-18/22: reject commits one atomic tx carrying reasonCode", async () => {
    const m = createMocks({ application: makeApplication({ status: "under_review" }) });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.rejectApplication(decision(reviewer));

    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.value.status).toBe("rejected");
    expect(m.admissionRepo.rejectApplicationTx).toHaveBeenCalledTimes(1);
    const arg = (m.admissionRepo.rejectApplicationTx.mock.calls[0]?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(arg.reasonCode).toBe("meets_phase1_policy");
    expect(arg.reason).toBeUndefined();
  });
});

describe("AdmissionService.requestMoreInfo", () => {
  it("INV-11: a member cannot request more info (FORBIDDEN)", async () => {
    const m = createMocks();
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.requestMoreInfo(decision(member));

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("FORBIDDEN");
    expect(m.admissionRepo.requestMoreInfoTx).not.toHaveBeenCalled();
  });

  it("transitions an under_review application and commits one atomic tx", async () => {
    const m = createMocks({ application: makeApplication({ status: "under_review" }) });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.requestMoreInfo(decision(reviewer));

    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.value.status).toBe("needs_more_info");
    expect(m.admissionRepo.requestMoreInfoTx).toHaveBeenCalledTimes(1);
  });
});
