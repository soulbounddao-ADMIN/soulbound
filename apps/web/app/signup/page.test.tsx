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
import SignupPage from "./page";

const authMocks = vi.hoisted(() => {
  class UsernameAlreadyExistsError extends Error {
    constructor() {
      super("Username already exists");
      this.name = "UsernameAlreadyExistsError";
    }
  }

  return {
    UsernameAlreadyExistsError,
    useAuth: vi.fn(),
  };
});
const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  UsernameAlreadyExistsError: authMocks.UsernameAlreadyExistsError,
  useAuth: authMocks.useAuth,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("SignupPage", () => {
  const signUp = vi.fn();

  beforeEach(() => {
    signUp.mockReset();
    routerMocks.push.mockClear();
    authMocks.useAuth.mockReturnValue({ signUp });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("warns that lost credentials mean lost membership", () => {
    render(<SignupPage />);

    expect(screen.getByText((_, node) =>
      node?.textContent
        === "아이디와 비밀번호를 저장해 주세요. 복구는 제공하지 않으며, 분실하면 멤버십을 잃게 됩니다."
    )).toBeTruthy();
  });

  it("requires terms agreement and links to the terms page", () => {
    render(<SignupPage />);

    const checkbox = screen.getByLabelText(
      "이용약관에 동의합니다",
    ) as HTMLInputElement;
    expect(checkbox.type).toBe("checkbox");
    expect(checkbox.required).toBe(true);

    const link = screen.getByRole("link", { name: "약관 보기" });
    expect(link.getAttribute("href")).toBe("/terms");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("maps structured duplicate username failures to a precise message", async () => {
    signUp.mockRejectedValueOnce(new authMocks.UsernameAlreadyExistsError());
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("아이디"), {
      target: { value: "taken_id" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByLabelText("이용약관에 동의합니다"));
    fireEvent.click(screen.getByRole("button", { name: "가입하기" }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("taken_id", "password123")
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "이미 사용 중인 아이디입니다.",
    );
    expect(routerMocks.push).not.toHaveBeenCalled();
  });
});
