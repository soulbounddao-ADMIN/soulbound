// The ONLY module that talks to Supabase. Used strictly for password auth,
// session persistence/refresh and role resolution. Screens never import this.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@soulbound/core";
import { appConfig } from "../config";
import { secureSessionStorage } from "./secure-store";

export type AuthSession = Session;

let client: SupabaseClient | null = null;

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Supabase URL / anon key are not configured");
    this.name = "AuthNotConfiguredError";
  }
}

export function isAuthConfigured(): boolean {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}

export function getAuthClient(): SupabaseClient {
  if (!isAuthConfigured()) {
    throw new AuthNotConfiguredError();
  }
  client ??= createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      storage: secureSessionStorage,
      storageKey: "soulbound-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

const roles: readonly UserRole[] = ["applicant", "member", "reviewer", "admin"];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export async function resolveCurrentRole(): Promise<UserRole> {
  const { data, error } = await getAuthClient().rpc("current_user_role");
  return !error && isUserRole(data) ? data : "applicant";
}

export function isUserAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { readonly code?: unknown; readonly name?: unknown };
  return candidate.name === "AuthApiError" && candidate.code === "user_already_exists";
}
