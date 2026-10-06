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
import ReviewQueuePage from "./page";

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

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

const queueApplication = {
  id: "application-1",
  applicantId: "applicant-1",
  applicantUsername: "applicant_one",
  status: "submitted",
  applicantStatement: "신뢰를 지키는 사람",
  reviewerId: null,
  reviewedAt: null,
  reviewSummary: null,
  applicantNotice: null,
  policyVersion: "phase1-v1",
  personaClipAssetId: "clip-1",
  personaClipHash: "clip-hash",
  createdAt: "2026-06-08T00:00:00.000Z",
  updatedAt: "2026-06-08T00:00:00.000Z",
};

describe("ReviewQueuePage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      role: "reviewer",
      session: { user: { id: "reviewer-1" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the queue and changes the status request query", async () => {
    authedFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([queueApplication]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    render(<ReviewQueuePage />);

    expect(await screen.findByText("applicant_one")).toBeTruthy();
    expect(screen.getByTitle("applicant-1")).toBeTruthy();
    expect(screen.getByRole("button", {
      name: "신청자 ID applican... 복사",
    })).toBeTruthy();
    expect(screen.getByText("클립 있음")).toBeTruthy();
    expect(screen.getByText("제출됨 1건")).toBeTruthy();
    expect(authedFetch.mock.calls[0]?.[0]).toBe(
      "/api/admin/applications?limit=50&status=submitted",
    );

    fireEvent.click(screen.getByRole("button", { name: "전체" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(2));
    expect(authedFetch.mock.calls[1]?.[0]).toBe(
      "/api/admin/applications?limit=50",
    );
  });

  it("shows the route permission response", async () => {
    authedFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

    render(<ReviewQueuePage />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "권한이 없습니다",
    );
  });

  it("defers a stale client role to the route authority", async () => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      role: "applicant",
      session: { user: { id: "applicant-1" } },
    });
    authedFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

    render(<ReviewQueuePage />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "권한이 없습니다",
    );
    expect(authedFetch).toHaveBeenCalledOnce();
    expect(routerMocks.replace).not.toHaveBeenCalledWith("/gate");
  });
});
