import {
  applicantStatusLabel,
  gateNextStep,
  resolveHomeRoute,
  statusNextStep,
  submitErrorMessage,
} from "../domain/admission";

describe("routing like web /login and /gate", () => {
  it("routes by role and membership", () => {
    expect(resolveHomeRoute("admin", null)).toBe("/reviewer");
    expect(resolveHomeRoute("reviewer", null)).toBe("/reviewer");
    expect(resolveHomeRoute("member", null)).toBe("/member");
    expect(resolveHomeRoute("applicant", { status: "active" })).toBe("/member");
    expect(resolveHomeRoute("applicant", null)).toBe("/gate");
  });

  it("chooses the gate next step", () => {
    expect(gateNextStep(null, { status: "active" }).href).toBe("/member");
    expect(gateNextStep({ id: "a" }, null).href).toBe("/apply/status");
    expect(gateNextStep(null, null)).toMatchObject({ href: "/apply", label: "입장 신청" });
  });
});

describe("application status", () => {
  it("labels statuses", () => {
    expect(applicantStatusLabel("needs_more_info")).toBe("추가 정보 필요");
    expect(applicantStatusLabel("in_vote")).toBe("검토 중");
    expect(applicantStatusLabel("unknown")).toBe("검토 중");
  });

  it("derives next steps", () => {
    expect(statusNextStep({ status: "rejected", applicantNotice: undefined }).href).toBe("/apply");
    expect(statusNextStep({ status: "approved", applicantNotice: undefined }).href).toBe("/gate");
    expect(statusNextStep({ status: "needs_more_info", applicantNotice: "x" }).body).toContain("검토자 안내");
    expect(statusNextStep({ status: "submitted", applicantNotice: undefined }).href).toBeNull();
  });

  it("maps submit errors like the web", () => {
    expect(submitErrorMessage(409)).toBe("이미 진행 중인 신청이 있거나 상태가 변경되었습니다.");
    expect(submitErrorMessage(500)).toBe("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  });
});
