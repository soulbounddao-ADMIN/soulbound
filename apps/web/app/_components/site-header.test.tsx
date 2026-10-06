// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("../../components/pwa/install-prompt", () => ({
  InstallPrompt: () => <span>설치</span>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({
    push: navigationMocks.push,
  }),
}));

describe("SiteHeader", () => {
  const signOut = vi.fn(async () => undefined);

  beforeEach(() => {
    navigationMocks.pathname = "/";
    navigationMocks.push.mockClear();
    signOut.mockClear();
    authMocks.useAuth.mockReturnValue({
      loading: false,
      session: null,
      signOut,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows public auth links and install entry for anonymous visitors", () => {
    render(<SiteHeader />);

    expect(screen.getByLabelText("SoulBound 홈")).toBeTruthy();
    expect(screen.getByText("로그인")).toBeTruthy();
    expect(screen.getByText("가입하기")).toBeTruthy();
    expect(screen.getByText("설치")).toBeTruthy();
  });

  it("keeps logged-in non-member context to logout plus install only", async () => {
    authMocks.useAuth.mockReturnValue({
      loading: false,
      session: { user: { id: "applicant-1" } },
      signOut,
    });

    render(<SiteHeader />);

    expect(screen.queryByText("멤버")).toBeNull();
    expect(screen.queryByText("입장")).toBeNull();
    expect(screen.getByText("설치")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(navigationMocks.push).toHaveBeenCalledWith("/");
  });

  it("does not render the global header inside the member shell", () => {
    navigationMocks.pathname = "/member";
    authMocks.useAuth.mockReturnValue({
      loading: false,
      session: { user: { id: "member-1" } },
      signOut,
    });

    const { container } = render(<SiteHeader />);

    expect(container.firstChild).toBeNull();
  });
});
