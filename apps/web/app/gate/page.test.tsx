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
import GatePage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("../../lib/application-state", () => ({
  rememberApplicationId: vi.fn(),
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

describe("GatePage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "applicant-1" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("marks the member entry step when membership is active", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse({
        id: "membership-1",
        userId: "member-1",
        status: "active",
        tier: "basic",
        issuedAt: "2026-06-08T00:00:00.000Z",
        revokedAt: null,
      }));

    render(<GatePage />);

    expect(await screen.findByRole("link", { name: "멤버 공간으로" }))
      .toBeTruthy();
    expect(screen.getByText("멤버 입장").closest("li")
      ?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("지금 필요한 다음 단계를 안내합니다."))
      .toBeTruthy();
  });

  it("retries a failed gate state load", async () => {
    authedFetch
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse(null));

    render(<GatePage />);

    expect(await screen.findByText("입장 상태를 불러오지 못했습니다."))
      .toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(4));
    expect(await screen.findByRole("link", { name: "입장 신청" }))
      .toBeTruthy();
  });
});
