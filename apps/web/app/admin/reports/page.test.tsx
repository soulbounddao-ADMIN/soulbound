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
import ReportQueuePage from "./page";

const authMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("../../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

const report = {
  id: "4d2a3f9e-0000-4000-8000-000000000001",
  targetType: "board_post",
  targetId: "b1000000-0000-4000-8000-000000000001",
  reason: "spam",
  detail: "광고 글",
  status: "open",
  resolutionCode: null,
  resolvedAt: null,
  createdAt: "2026-10-06T00:00:00.000Z",
  subjectMemberNumber: 2,
  subjectLabel: "soulbound-member-2",
  targetExcerpt: "buy now",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ReportQueuePage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authedFetch.mockReset();
    authMocks.useAuth.mockReturnValue({
      session: { access_token: "token" },
      loading: false,
      authedFetch,
    });
  });

  afterEach(() => cleanup());

  it("lists open reports and resolves with an enum code", async () => {
    authedFetch
      .mockResolvedValueOnce(json({ items: [report] }))
      .mockResolvedValueOnce(json({ id: report.id, status: "resolved" }))
      .mockResolvedValueOnce(json({ items: [] }));

    render(<ReportQueuePage />);

    expect(await screen.findByText("대상: soulbound-member-2")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledWith("/api/admin/reports?status=open&limit=50");

    fireEvent.click(screen.getByRole("button", { name: "조치: 콘텐츠 삭제" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(3));
    const [path, init] = authedFetch.mock.calls[1] as [string, RequestInit];
    expect(path).toBe(`/api/admin/reports/${report.id}/resolve`);
    expect(JSON.parse(String(init.body))).toEqual({
      status: "resolved",
      resolutionCode: "content_removed",
    });
  });

  it("shows a permission message for non-reviewers", async () => {
    authedFetch.mockResolvedValueOnce(json({ error: { code: "FORBIDDEN" } }, 403));

    render(<ReportQueuePage />);

    expect(await screen.findByText("검토자 권한이 필요합니다.")).toBeTruthy();
  });
});
