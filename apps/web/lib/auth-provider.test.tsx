// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthProvider,
  UnauthenticatedError,
  UsernameAlreadyExistsError,
  useAuth,
} from "./auth-provider";

const adapterMocks = vi.hoisted(() => ({
  createBrowserSupabaseClient: vi.fn(),
}));

vi.mock("@soulbound/adapters", () => ({
  createBrowserSupabaseClient: adapterMocks.createBrowserSupabaseClient,
}));

const session = {
  access_token: "browser-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 2_000_000_000,
  refresh_token: "refresh-token",
  user: {
    id: "reviewer-user",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-06-08T00:00:00.000Z",
  },
};

function AuthProbe() {
  const auth = useAuth();
  const [message, setMessage] = useState("");

  return (
    <div>
      <output data-testid="loading">{String(auth.loading)}</output>
      <output data-testid="session">{auth.session?.user.id ?? "none"}</output>
      <output data-testid="role">{auth.role}</output>
      <output data-testid="message">{message}</output>
      <button
        type="button"
        onClick={() => {
          void auth.signIn("reviewer", "password123");
        }}
      >
        sign in
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.signUp("new_member", "password123")
            .then(() => setMessage("signed up"))
            .catch((error: unknown) => {
              setMessage(
                error instanceof UsernameAlreadyExistsError
                  ? "duplicate username"
                  : "sign-up failed",
              );
            });
        }}
      >
        sign up
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.authedFetch("/api/admission/applications/me")
            .then(() => setMessage("fetched"))
            .catch((error: unknown) => {
              setMessage(
                error instanceof UnauthenticatedError
                  ? "unauthenticated"
                  : "failed",
              );
            });
        }}
      >
        fetch
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.signOut();
        }}
      >
        sign out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  const unsubscribe = vi.fn();
  const getSession = vi.fn(async () => ({
    data: { session: null },
    error: null,
  }));
  const signInWithPassword = vi.fn(async () => ({
    data: { session, user: session.user },
    error: null,
  }));
  const signUp = vi.fn(async (): Promise<{
    data: {
      session: typeof session | null;
      user: typeof session.user | null;
    };
    error: null | {
      code: string;
      name: string;
      status: number;
    };
  }> => ({
    data: { session, user: session.user },
    error: null,
  }));
  const signOut = vi.fn(async () => ({ error: null }));
  const onAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe } },
  }));
  const rpc = vi.fn(async () => ({ data: "reviewer", error: null }));

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ));
    adapterMocks.createBrowserSupabaseClient.mockReturnValue({
      auth: {
        getSession,
        signInWithPassword,
        signUp,
        signOut,
        onAuthStateChange,
      },
      rpc,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("persists auth state, resolves the trusted role, and attaches bearer auth", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(adapterMocks.createBrowserSupabaseClient).toHaveBeenCalledOnce();
    expect(adapterMocks.createBrowserSupabaseClient).toHaveBeenCalledWith({
      url: "http://supabase.test",
      anonKey: "anon-key",
    });

    fireEvent.click(screen.getByRole("button", { name: "sign in" }));
    await waitFor(() =>
      expect(screen.getByTestId("session").textContent).toBe("reviewer-user")
    );
    expect(screen.getByTestId("role").textContent).toBe("reviewer");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "reviewer@soulbound.internal",
      password: "password123",
    });
    expect(rpc).toHaveBeenCalledWith("current_user_role");

    fireEvent.click(screen.getByRole("button", { name: "fetch" }));
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toBe("fetched")
    );
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, fetchInit] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(fetchInit?.headers);
    expect(headers.get("authorization")).toBe(
      "Bearer browser-access-token",
    );
    expect(headers.get("content-type")).toBe("application/json");

    fireEvent.click(screen.getByRole("button", { name: "sign out" }));
    await waitFor(() =>
      expect(screen.getByTestId("session").textContent).toBe("none")
    );
    expect(screen.getByTestId("role").textContent).toBe("applicant");

    fireEvent.click(screen.getByRole("button", { name: "fetch" }));
    await waitFor(() =>
      expect(screen.getByTestId("message").textContent).toBe("unauthenticated")
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses synthetic email plus username metadata for sign-up", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );

    fireEvent.click(screen.getByRole("button", { name: "sign up" }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith({
      email: "new_member@soulbound.internal",
      password: "password123",
      options: {
        data: {
          username: "new_member",
        },
      },
    }));
  });

  it("maps structured duplicate username failures", async () => {
    signUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: "user_already_exists",
        name: "AuthApiError",
        status: 400,
      },
    });
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );

    fireEvent.click(screen.getByRole("button", { name: "sign up" }));

    await waitFor(() =>
      expect(screen.getByTestId("message").textContent)
        .toBe("duplicate username")
    );
  });
});
