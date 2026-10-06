"use client";

import type { UserRole } from "@soulbound/core";
import { createBrowserSupabaseClient } from "@soulbound/adapters";
import React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BrowserClient = ReturnType<typeof createBrowserSupabaseClient>;
type BrowserSessionResult =
  Awaited<ReturnType<BrowserClient["auth"]["getSession"]>>;
export type BrowserSession =
  NonNullable<BrowserSessionResult["data"]["session"]>;

export type AuthedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface SignInResult {
  readonly role: UserRole;
  readonly session: BrowserSession;
}

export interface SignUpResult {
  readonly session: BrowserSession | null;
}

interface AuthContextValue {
  readonly session: BrowserSession | null;
  readonly accessToken: string | null;
  readonly role: UserRole;
  readonly loading: boolean;
  readonly signUp: (username: string, password: string) => Promise<SignUpResult>;
  readonly signIn: (username: string, password: string) => Promise<SignInResult>;
  readonly signOut: () => Promise<void>;
  readonly authedFetch: AuthedFetch;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let browserClient: BrowserClient | null = null;

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "applicant"
    || value === "member"
    || value === "reviewer"
    || value === "admin"
  );
}

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required browser environment variable: ${name}`);
  }
  return value;
}

function getBrowserClient(): BrowserClient {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient({
      url: requirePublicEnv(
        "NEXT_PUBLIC_SUPABASE_URL",
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      ),
      anonKey: requirePublicEnv(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    });
  }
  return browserClient;
}

const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,23}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function usernameToSyntheticEmail(username: string): string {
  const normalized = normalizeUsername(username);
  if (!usernamePattern.test(normalized)) {
    throw new Error("Invalid username");
  }

  return `${normalized}@soulbound.internal`;
}

async function resolveCurrentRole(
  client: BrowserClient,
): Promise<UserRole> {
  const { data, error } = await client.rpc("current_user_role");
  return !error && isUserRole(data) ? data : "applicant";
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "UnauthenticatedError";
  }
}

export class UsernameAlreadyExistsError extends Error {
  constructor() {
    super("Username already exists");
    this.name = "UsernameAlreadyExistsError";
  }
}

function isUserAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    readonly code?: unknown;
    readonly name?: unknown;
  };
  return (
    candidate.name === "AuthApiError"
    && candidate.code === "user_already_exists"
  );
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [role, setRole] = useState<UserRole>("applicant");
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<BrowserSession | null>(null);
  const authRevisionRef = useRef(0);

  const clearSession = useCallback(() => {
    authRevisionRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    setRole("applicant");
  }, []);

  const applySession = useCallback(async (
    nextSession: BrowserSession,
  ): Promise<UserRole> => {
    const revision = authRevisionRef.current + 1;
    authRevisionRef.current = revision;
    sessionRef.current = nextSession;
    setSession(nextSession);

    const nextRole = await resolveCurrentRole(getBrowserClient());
    if (
      authRevisionRef.current === revision
      && sessionRef.current?.access_token === nextSession.access_token
    ) {
      setRole(nextRole);
    }
    return nextRole;
  }, []);

  useEffect(() => {
    let active = true;
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
    const client = getBrowserClient();

    const initialize = async () => {
      const revision = authRevisionRef.current;
      const { data, error } = await client.auth.getSession();
      if (!active) {
        return;
      }
      if (authRevisionRef.current !== revision) {
        setLoading(false);
        return;
      }

      if (error || !data.session) {
        clearSession();
      } else {
        await applySession(data.session);
      }

      if (active) {
        setLoading(false);
      }
    };

    const { data: listener } = client.auth.onAuthStateChange(
      (event, nextSession) => {
        const timer = setTimeout(() => {
          pendingTimers.delete(timer);
          if (!active) {
            return;
          }

          if (event === "SIGNED_OUT" || !nextSession) {
            clearSession();
            return;
          }

          if (event === "TOKEN_REFRESHED") {
            sessionRef.current = nextSession;
            setSession(nextSession);
            return;
          }

          if (sessionRef.current?.access_token !== nextSession.access_token) {
            void applySession(nextSession);
          }
        }, 0);
        pendingTimers.add(timer);
      },
    );

    void initialize();

    return () => {
      active = false;
      pendingTimers.forEach((timer) => clearTimeout(timer));
      listener.subscription.unsubscribe();
    };
  }, [applySession, clearSession]);

  const signIn = useCallback(async (
    username: string,
    password: string,
  ): Promise<SignInResult> => {
    const email = usernameToSyntheticEmail(username);
    const { data, error } = await getBrowserClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      throw error ?? new Error("Sign-in did not return a session");
    }

    const nextRole = await applySession(data.session);
    return { role: nextRole, session: data.session };
  }, [applySession]);

  const signUp = useCallback(async (
    username: string,
    password: string,
  ): Promise<SignUpResult> => {
    const normalizedUsername = normalizeUsername(username);
    const email = usernameToSyntheticEmail(normalizedUsername);
    const { data, error } = await getBrowserClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalizedUsername,
        },
      },
    });
    if (error) {
      if (isUserAlreadyExistsError(error)) {
        throw new UsernameAlreadyExistsError();
      }
      throw error;
    }

    if (!data.session) {
      clearSession();
      throw new Error("Sign-up did not return a session; email confirmation must be disabled");
    }

    await applySession(data.session);

    return {
      session: data.session,
    };
  }, [applySession, clearSession]);

  const signOut = useCallback(async () => {
    const { error } = await getBrowserClient().auth.signOut();
    if (error) {
      throw error;
    }
    clearSession();
  }, [clearSession]);

  const authedFetch = useCallback<AuthedFetch>(async (input, init = {}) => {
    const accessToken = sessionRef.current?.access_token;
    if (!accessToken) {
      throw new UnauthenticatedError();
    }

    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${accessToken}`);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return globalThis.fetch(input, {
      ...init,
      headers,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        accessToken: session?.access_token ?? null,
        role,
        loading,
        signUp,
        signIn,
        signOut,
        authedFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
