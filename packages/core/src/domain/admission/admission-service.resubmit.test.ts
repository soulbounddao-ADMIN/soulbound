import { describe, expect, it } from "vitest";

import { isErr, isOk } from "../../application/result";
import { createMocks, makeApplication } from "../../test-support/mock-ports";
import { DefaultAdmissionService } from "./admission-service";

const command = {
  applicantId: "user-1",
  applicationId: "app-1",
  applicantStatement: "보완된 소개입니다.",
  idempotencyKey: "idem-resubmit",
};

describe("AdmissionService.resubmitApplication", () => {
  it("resubmits a needs_more_info application through one atomic tx", async () => {
    const m = createMocks({
      application: makeApplication({
        applicantId: "user-1",
        status: "needs_more_info",
        applicantNotice: "정보를 보완해 주세요.",
        reviewerId: "rev-1",
        reviewedAt: "2026-05-29T01:00:00.000Z",
        reviewSummary: "internal reviewer note",
      }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.resubmitApplication(command);

    expect(isOk(res)).toBe(true);
    expect(m.admissionRepo.resubmitApplicationTx).toHaveBeenCalledTimes(1);
    expect(m.admissionRepo.resubmitApplicationTx).toHaveBeenCalledWith({
      applicationId: "app-1",
      applicantId: "user-1",
      applicantStatement: "보완된 소개입니다.",
      idempotencyKey: "idem-resubmit",
    });
  });

  it("returns NOT_FOUND when the application is missing", async () => {
    const m = createMocks({ application: null });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.resubmitApplication(command);

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("NOT_FOUND");
    expect(m.admissionRepo.resubmitApplicationTx).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when the application belongs to another applicant", async () => {
    const m = createMocks({
      application: makeApplication({
        applicantId: "other-user",
        status: "needs_more_info",
      }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.resubmitApplication(command);

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("FORBIDDEN");
    expect(m.admissionRepo.resubmitApplicationTx).not.toHaveBeenCalled();
  });

  it("returns INVALID_STATE_TRANSITION for terminal states", async () => {
    const m = createMocks({
      application: makeApplication({
        applicantId: "user-1",
        status: "approved",
      }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.resubmitApplication(command);

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INVALID_STATE_TRANSITION");
    expect(m.admissionRepo.resubmitApplicationTx).not.toHaveBeenCalled();
  });

  it("returns INVALID_STATE_TRANSITION after the application is already submitted", async () => {
    const m = createMocks({
      application: makeApplication({
        applicantId: "user-1",
        status: "submitted",
      }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.resubmitApplication(command);

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INVALID_STATE_TRANSITION");
    expect(m.admissionRepo.resubmitApplicationTx).not.toHaveBeenCalled();
  });

  it("also rejects different-key resubmits after the application is submitted", async () => {
    const m = createMocks({
      application: makeApplication({
        applicantId: "user-1",
        status: "submitted",
      }),
    });
    const svc = new DefaultAdmissionService(m.deps);

    const res = await svc.resubmitApplication({
      ...command,
      idempotencyKey: "different-key",
    });

    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.code).toBe("INVALID_STATE_TRANSITION");
    expect(m.admissionRepo.resubmitApplicationTx).not.toHaveBeenCalled();
  });
});
