// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationStatusPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("../../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("../../../lib/application-state", () => ({
  readRememberedApplicationId: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deferredResponse() {
  let resolve: (value: Response) => void = () => undefined;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function application(status: string, applicantNotice: string | null = null) {
  return {
    id: "application-1",
    applicantId: "applicant-1",
    status,
    policyVersion: "phase1-v1",
    reasonCode: "needs_identity_clarification",
    applicantNotice,
    reviewSummary: "검토자만 보는 내부 메모입니다.",
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
  };
}

describe("ApplicationStatusPage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "resubmit-key"),
    });
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "applicant-1" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows applicant notice without exposing review summary", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(
      application("needs_more_info", "신청자에게 보이는 안내입니다."),
    ));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("신청자에게 보이는 안내입니다."))
      .toBeTruthy();
    expect(screen.getByText("검토자 안내를 확인하고 요청된 정보를 준비해 주세요."))
      .toBeTruthy();
    expect(screen.queryByText("검토자만 보는 내부 메모입니다.")).toBeNull();
    expect(screen.queryByText("검토자 내부 메모")).toBeNull();
    expect(screen.queryByText("사유")).toBeNull();
    expect(screen.queryByText("신원 확인 필요")).toBeNull();
  });

  it("submits requested information and reloads the status", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(
        application("needs_more_info", "신청자에게 보이는 안내입니다."),
      ))
      .mockResolvedValueOnce(jsonResponse(application("submitted")))
      .mockResolvedValueOnce(jsonResponse(application("submitted")));

    render(<ApplicationStatusPage />);

    const textarea = await screen.findByLabelText("보완 내용");
    fireEvent.change(textarea, {
      target: { value: " 보완된 내용입니다. " },
    });
    fireEvent.click(screen.getByRole("button", { name: "보완 제출" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(3));
    expect(authedFetch.mock.calls[1]?.[0])
      .toBe("/api/admission/applications/application-1/resubmit");
    expect(authedFetch.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(authedFetch.mock.calls[1]?.[1]?.body)))
      .toEqual({
        applicantStatement: "보완된 내용입니다.",
        idempotencyKey: "resubmit-key",
      });
    expect(await screen.findByText(
      "검토가 끝나면 이 화면에서 결과를 안내합니다.",
    )).toBeTruthy();
  });

  it("disables the resubmit button while submission is pending", async () => {
    const pending = deferredResponse();
    authedFetch
      .mockResolvedValueOnce(jsonResponse(
        application("needs_more_info", "신청자에게 보이는 안내입니다."),
      ))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(jsonResponse(application("submitted")));

    render(<ApplicationStatusPage />);

    fireEvent.change(await screen.findByLabelText("보완 내용"), {
      target: { value: "보완된 내용입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "보완 제출" }));

    const pendingButton = await screen.findByRole("button", {
      name: "제출 중",
    });
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);

    pending.resolve(jsonResponse(application("submitted")));
    expect(await screen.findByText(
      "검토가 끝나면 이 화면에서 결과를 안내합니다.",
    )).toBeTruthy();
  });

  it("uses status-specific copy when resubmit fails", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(
        application("needs_more_info", "신청자에게 보이는 안내입니다."),
      ))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "DEPENDENCY_FAILURE" } }, 502));

    render(<ApplicationStatusPage />);

    fireEvent.change(await screen.findByLabelText("보완 내용"), {
      target: { value: "보완된 내용입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "보완 제출" }));

    expect(await screen.findByText(
      "서비스 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
    )).toBeTruthy();
    expect(screen.getByRole("button", { name: "보완 제출" })).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledTimes(2);
  });

  it("reloads status after a 409 resubmit response", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(
        application("needs_more_info", "신청자에게 보이는 안내입니다."),
      ))
      .mockResolvedValueOnce(jsonResponse({
        error: { code: "INVALID_STATE_TRANSITION" },
      }, 409))
      .mockResolvedValueOnce(jsonResponse(application("submitted")));

    render(<ApplicationStatusPage />);

    fireEvent.change(await screen.findByLabelText("보완 내용"), {
      target: { value: "보완된 내용입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "보완 제출" }));

    expect(await screen.findByText(
      "검토가 끝나면 이 화면에서 결과를 안내합니다.",
    )).toBeTruthy();
    expect(screen.queryByRole("button", { name: "보완 제출" })).toBeNull();
    expect(authedFetch).toHaveBeenCalledTimes(3);
  });

  it("shows the approved next action without loading membership", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("approved")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("입장이 승인되었습니다.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "입장 절차 보기" })
      .getAttribute("href")).toBe("/gate");
    expect(authedFetch).toHaveBeenCalledOnce();
  });

  it("waits for reviewer guidance when more info is requested without notice", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("needs_more_info")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText(
      "추가 정보가 필요합니다. 검토자의 안내를 기다려 주세요.",
    )).toBeTruthy();
    expect(screen.queryByText("검토자 안내를 확인하고 요청된 정보를 준비해 주세요."))
      .toBeNull();
  });

  it("does not show the resubmit form outside needs_more_info", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("submitted")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText(
      "검토가 끝나면 이 화면에서 결과를 안내합니다.",
    )).toBeTruthy();
    expect(screen.queryByLabelText("보완 내용")).toBeNull();
    expect(screen.queryByRole("button", { name: "보완 제출" })).toBeNull();
  });

  it.each([
    ["rejected", "이번 신청은 거부되었습니다."],
    ["expired", "이번 신청은 만료되었습니다."],
    ["withdrawn", "이번 신청은 철회되었습니다."],
  ])("shows the reapply action for %s", async (status, message) => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application(status)));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole("link", { name: "새로 신청하기" })
      .getAttribute("href")).toBe("/apply");
  });

  it("keeps in-vote hidden as review in progress", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("in_vote")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("검토가 끝나면 이 화면에서 결과를 안내합니다."))
      .toBeTruthy();
    expect(screen.getByText("검토 중")).toBeTruthy();
    expect(screen.queryByText("멤버 투표 중")).toBeNull();
    expect(screen.queryByText("in_vote")).toBeNull();
  });

  it("retries a failed status load", async () => {
    authedFetch
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(application("approved")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("신청 현황을 불러오지 못했습니다."))
      .toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("입장이 승인되었습니다.")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledTimes(2);
  });
});
