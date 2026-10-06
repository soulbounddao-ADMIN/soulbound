// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewDetailPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("../../../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "application-1" }),
  useRouter: () => routerMocks,
}));

function application(status: string, withClip = true) {
  return {
    id: "application-1",
    applicantId: "applicant-1",
    applicantUsername: "applicant_one",
    status,
    applicantStatement: "신뢰를 지키는 사람",
    reviewerId: "reviewer-1",
    reviewerUsername: "reviewer_one",
    reviewedAt: "2026-06-08T01:00:00.000Z",
    reviewSummary: "검토자만 보는 내부 메모",
    applicantNotice: "신청자에게 보이는 안내",
    policyVersion: "phase1-v1",
    personaClipAssetId: withClip ? "clip-1" : null,
    personaClipHash: withClip ? "clip-hash" : null,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T01:00:00.000Z",
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function optionValues(select: HTMLElement): readonly string[] {
  return within(select).getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value);
}

describe("ReviewDetailPage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      role: "reviewer",
      session: { user: { id: "reviewer-1" } },
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "idempotency-key"),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders reviewer-only fields and fetches a clip URL on demand", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(application("under_review")))
      .mockResolvedValueOnce(jsonResponse({
        url: "https://storage.test/signed-clip",
      }));

    const { container } = render(<ReviewDetailPage />);

    expect(
      await screen.findByText("검토자만 보는 내부 메모"),
    ).toBeTruthy();
    expect(screen.getByText("applicant_one")).toBeTruthy();
    expect(screen.getByText("reviewer_one")).toBeTruthy();
    expect(screen.queryByText("추천 코드")).toBeNull();
    expect(screen.queryByText("신청 동기")).toBeNull();
    expect(screen.getByText("신청자에게 보이는 안내")).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "클립 재생" }));

    await waitFor(() =>
      expect(authedFetch).toHaveBeenCalledWith(
        "/api/admin/applications/application-1/persona-clip-url",
      )
    );
    const video = await screen.findByLabelText("Persona Clip 재생");
    expect(video.getAttribute("src")).toBe(
      "https://storage.test/signed-clip",
    );
  });

  it("shows review start only for submitted and posts a fresh idempotency key", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(application("submitted", false)))
      .mockResolvedValueOnce(jsonResponse(application("under_review", false)))
      .mockResolvedValueOnce(jsonResponse(application("under_review", false)));

    render(<ReviewDetailPage />);

    fireEvent.click(await screen.findByRole("button", {
      name: "검토 시작",
    }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(3));
    expect(authedFetch.mock.calls[1]?.[0]).toBe(
      "/api/admin/applications/application-1/review",
    );
    const init = authedFetch.mock.calls[1]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      idempotencyKey: "idempotency-key",
    });
  });

  it("keeps decision reason options scoped to the selected action", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("under_review")));

    render(<ReviewDetailPage />);

    const reasonSelect = await screen.findByLabelText("사유 코드");
    expect(optionValues(reasonSelect)).toEqual(["meets_phase1_policy"]);

    fireEvent.click(screen.getByRole("radio", { name: "거절" }));
    expect(optionValues(reasonSelect)).toEqual([
      "mismatch_with_policy",
      "insufficient_context",
      "duplicate_identity_suspected",
    ]);

    fireEvent.click(screen.getByRole("radio", { name: "추가 정보 요청" }));
    expect(optionValues(reasonSelect)).toEqual([
      "needs_identity_clarification",
      "insufficient_context",
    ]);
  });

  it.each([
    ["승인", "approve", "meets_phase1_policy", "승인 확정"],
    ["거절", "reject", "mismatch_with_policy", "거절 확정"],
    [
      "추가 정보 요청",
      "request-more-info",
      "needs_identity_clarification",
      "요청 보내기",
    ],
  ])("posts the %s decision to the matching route", async (
    title,
    action,
    reasonCode,
    submitLabel,
  ) => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(application("under_review")))
      .mockResolvedValueOnce(jsonResponse(application("approved")))
      .mockResolvedValueOnce(jsonResponse(application("approved")));

    render(<ReviewDetailPage />);

    await screen.findByRole("heading", { name: "검토 결정" });
    if (title !== "승인") {
      fireEvent.click(screen.getByRole("radio", { name: title }));
    }
    const form = screen.getByRole("button", { name: submitLabel })
      .closest("form");
    if (!form) {
      throw new Error(`Missing ${title} decision panel`);
    }
    fireEvent.change(within(form).getByLabelText("신청자 안내"), {
      target: { value: "신청자 안내" },
    });
    fireEvent.change(within(form).getByLabelText("검토자 내부 메모"), {
      target: { value: "내부 메모" },
    });
    fireEvent.click(within(form).getByRole("button", { name: submitLabel }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(3));
    expect(authedFetch.mock.calls[1]?.[0]).toBe(
      `/api/admin/applications/application-1/${action}`,
    );
    const init = authedFetch.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      reasonCode,
      applicantNotice: "신청자 안내",
      reviewSummary: "내부 메모",
      idempotencyKey: "idempotency-key",
    });
  });

  it("keeps terminal applications read-only", async () => {
    authedFetch.mockResolvedValueOnce(
      jsonResponse(application("rejected", false)),
    );

    render(<ReviewDetailPage />);

    expect(await screen.findByText("거절됨")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "검토 시작" })).toBeNull();
    expect(screen.queryByRole("button", { name: "승인 확정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "거절 확정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "요청 보내기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "클립 재생" })).toBeNull();
  });

  it("requires an explicit second click before admin vote override", async () => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      role: "admin",
      session: { user: { id: "admin-1" } },
    });
    authedFetch
      .mockResolvedValueOnce(jsonResponse(application("in_vote", false)))
      .mockResolvedValueOnce(jsonResponse(application("approved", false)))
      .mockResolvedValueOnce(jsonResponse(application("approved", false)));

    render(<ReviewDetailPage />);

    const overrideButton = await screen.findByRole("button", {
      name: "승인 재정의",
    });
    fireEvent.click(overrideButton);

    expect(await screen.findByText(
      "승인 재정의를 실행하시겠습니까? 다시 누르면 실행합니다.",
    )).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", {
      name: "다시 눌러 승인 재정의",
    }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(3));
    expect(authedFetch.mock.calls[1]?.[0]).toBe(
      "/api/admin/applications/application-1/vote/override",
    );
    const init = authedFetch.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      decision: "approved",
      idempotencyKey: "idempotency-key",
    });
  });

  it("uses consistent rejection wording for admin vote override", async () => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      role: "admin",
      session: { user: { id: "admin-1" } },
    });
    authedFetch.mockResolvedValueOnce(jsonResponse(application("in_vote", false)));

    render(<ReviewDetailPage />);

    const overrideButton = await screen.findByRole("button", {
      name: "거절 재정의",
    });
    fireEvent.click(overrideButton);

    expect(await screen.findByText(
      "거절 재정의를 실행하시겠습니까? 다시 누르면 실행합니다.",
    )).toBeTruthy();
    expect(screen.getByRole("button", {
      name: "다시 눌러 거절 재정의",
    })).toBeTruthy();
    expect(screen.queryByText(/거부 재정의/)).toBeNull();
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces a 409 and re-fetches the authoritative detail", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(application("submitted", false)))
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(jsonResponse(application("under_review", false)));

    render(<ReviewDetailPage />);

    fireEvent.click(await screen.findByRole("button", {
      name: "검토 시작",
    }));

    expect(await screen.findByText(
      "신청 상태가 이미 변경되었습니다. 최신 상태를 다시 불러왔습니다.",
    )).toBeTruthy();
    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(3));
  });

  it("shows the route 403 even when the client role is stale", async () => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      role: "applicant",
      session: { user: { id: "reviewer-1" } },
    });
    authedFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

    render(<ReviewDetailPage />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "권한이 없습니다",
    );
    expect(authedFetch).toHaveBeenCalledOnce();
    expect(routerMocks.replace).not.toHaveBeenCalledWith("/gate");
  });
});
