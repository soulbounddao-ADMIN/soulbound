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
import ApplyPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock(
  "../../components/admission/persona-clip-recorder",
  async () => {
    const ReactModule = await import("react");
    return {
      PersonaClipRecorder: ({
        onComplete,
        onSkip,
      }: {
        onComplete: (value: {
          assetId: string;
          contentHash: string;
        }) => void;
        onSkip: () => void;
      }) => ReactModule.createElement(
        "div",
        null,
        ReactModule.createElement(
          "button",
          {
            type: "button",
            onClick: () => onComplete({
              assetId: "clip-asset",
              contentHash: "clip-hash",
            }),
          },
          "complete clip",
        ),
        ReactModule.createElement(
          "button",
          { type: "button", onClick: onSkip },
          "skip clip",
        ),
      ),
    };
  },
);

describe("ApplyPage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "applicant-1" } },
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "idempotency-key"),
    });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("submits completed clip references with an idempotency key", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "application-1",
      applicantId: "applicant-1",
      status: "submitted",
      policyVersion: "phase1-v1",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    render(<ApplyPage />);

    expect(screen.queryByLabelText("추천 코드")).toBeNull();
    expect(screen.queryByLabelText("이 공간에 들어오려는 이유")).toBeNull();
    expect(screen.getByText("한두 문장이면 충분합니다. 최대 1,200자."))
      .toBeTruthy();
    fireEvent.change(
      screen.getByLabelText("자기소개"),
      { target: { value: "신뢰를 지키는 사람" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "complete clip" }));
    fireEvent.click(screen.getByRole("button", { name: "입장 신청" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledOnce());
    const [url, init] = authedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admission/applications");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      idempotencyKey: "idempotency-key",
      applicantStatement: "신뢰를 지키는 사람",
      personaClipAssetId: "clip-asset",
      personaClipHash: "clip-hash",
    });
    await waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith("/apply/status")
    );
    expect(window.sessionStorage.getItem("soulbound:last-application-id"))
      .toBe("application-1");
  });

  it("still submits after clip skip and omits clip fields", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "application-2",
      applicantId: "applicant-1",
      status: "submitted",
      policyVersion: "phase1-v1",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    render(<ApplyPage />);

    fireEvent.click(screen.getByRole("button", { name: "complete clip" }));
    fireEvent.click(screen.getByRole("button", { name: "skip clip" }));
    fireEvent.click(screen.getByRole("button", { name: "입장 신청" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledOnce());
    const [, init] = authedFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.idempotencyKey).toBe("idempotency-key");
    expect(body).not.toHaveProperty("personaClipAssetId");
    expect(body).not.toHaveProperty("personaClipHash");
  });

  it("redirects an unauthenticated submit to login", async () => {
    authedFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    render(<ApplyPage />);

    fireEvent.click(screen.getByRole("button", { name: "입장 신청" }));

    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/login")
    );
  });

  it.each([
    [422, "입력 내용을 확인해 주세요."],
    [403, "이 신청을 제출할 권한이 없습니다."],
    [409, "이미 진행 중인 신청이 있거나 상태가 변경되었습니다."],
  ])("maps status %s to an applicant-facing message", async (
    status,
    expectedMessage,
  ) => {
    authedFetch.mockResolvedValueOnce(new Response(null, { status }));
    render(<ApplyPage />);

    fireEvent.click(screen.getByRole("button", { name: "입장 신청" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(expectedMessage)
    );
  });
});
