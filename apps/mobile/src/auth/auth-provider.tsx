import type { UserRole } from "@soulbound/core";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { createApiClient, type ApiClient } from "../api/client";
import { appConfig } from "../config";
import {
  getAuthClient,
  isAuthConfigured,
  isUserAlreadyExistsError,
  resolveCurrentRole,
  type AuthSession,
} from "./supabase-auth-client";
import { normalizeUsername, usernameToSyntheticEmail } from "./username";

export class UsernameAlreadyExistsError extends Error {
  constructor() {
    super("Username already exists");
    this.name = "UsernameAlreadyExistsError";
  }
}

interface AuthContextValue {
  readonly configured: boolean;
  readonly loading: boolean;
  readonly signedIn: boolean;
  readonly role: UserRole;
  readonly api: ApiClient;
  readonly signIn: (username: string, password: string) => Promise<UserRole>;
  readonly signUp: (username: string, password: string) => Promise<UserRole>;
  readonly signOut: () => Promise<void>;
  readonly expireSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const configured = isAuthConfigured();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [role, setRole] = useState<UserRole>("applicant");
  const [loading, setLoading] = useState(configured);
  const sessionRef = useRef<AuthSession | null>(null);
  const revisionRef = useRef(0);

  const clearSession = useCallback(() => {
    revisionRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    setRole("applicant");
  }, []);

  const applySession = useCallback(async (next: AuthSession): Promise<UserRole> => {
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    sessionRef.current = next;
    setSession(next);
    const nextRole = await resolveCurrentRole();
    if (revisionRef.current === revision) {
      setRole(nextRole);
    }
    return nextRole;
  }, []);

  useEffect(() => {
    if (!configured) {
      return;
    }
    let active = true;
    const client = getAuthClient();

    void (async () => {
      const { data, error } = await client.auth.getSession();
      if (!active) {
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
    })();

    const { data: listener } = client.auth.onAuthStateChange((event, next) => {
      setTimeout(() => {
        if (!active) {
          return;
        }
        if (event === "SIGNED_OUT" || !next) {
          clearSession();
        } else if (event === "TOKEN_REFRESHED") {
          sessionRef.current = next;
          setSession(next);
        } else if (sessionRef.current?.access_token !== next.access_token) {
          void applySession(next);
        }
      }, 0);
    });

    if (AppState.currentState === "active") {
      void client.auth.startAutoRefresh();
    }
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, [applySession, clearSession, configured]);

  const signIn = useCallback(async (username: string, password: string) => {
    const email = usernameToSyntheticEmail(username);
    const { data, error } = await getAuthClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      throw error ?? new Error("Sign-in did not return a session");
    }
    return applySession(data.session);
  }, [applySession]);

  const signUp = useCallback(async (username: string, password: string) => {
    const normalized = normalizeUsername(username);
    const email = usernameToSyntheticEmail(normalized);
    const { data, error } = await getAuthClient().auth.signUp({
      email,
      password,
      options: { data: { username: normalized } },
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
    return applySession(data.session);
  }, [applySession, clearSession]);

  const signOut = useCallback(async () => {
    const { error } = await getAuthClient().auth.signOut();
    if (error) {
      throw error;
    }
    clearSession();
  }, [clearSession]);

  const expireSession = useCallback(async () => {
    try {
      await getAuthClient().auth.signOut({ scope: "local" });
    } catch {
      // Local session is cleared below regardless.
    }
    clearSession();
  }, [clearSession]);

  const api = useMemo(
    () => createApiClient({
      baseUrl: appConfig.apiBaseUrl,
      getAccessToken: () => sessionRef.current?.access_token ?? null,
    }),
    [],
  );

  const value = useMemo<AuthContextValue>(() => ({
    configured,
    loading,
    signedIn: session !== null,
    role,
    api,
    signIn,
    signUp,
    signOut,
    expireSession,
  }), [api, configured, expireSession, loading, role, session, signIn, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
