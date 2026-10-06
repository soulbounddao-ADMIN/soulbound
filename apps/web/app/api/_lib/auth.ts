import type { Actor, UserRole } from "@soulbound/core";
import {
  createUserSupabaseClient,
} from "@soulbound/adapters";
import type { SupabaseAdapterClient } from "@soulbound/adapters";
import { readWebEnv } from "./env";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "applicant"
    || value === "member"
    || value === "reviewer"
    || value === "admin"
  );
}

export function bearerTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function userClientFromRequest(
  request: Request,
): SupabaseAdapterClient | null {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }

  const env = readWebEnv();
  return createUserSupabaseClient({
    url: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
    accessToken,
  });
}

export interface UserContext {
  readonly userId: string;
  readonly client: SupabaseAdapterClient;
}

export async function resolveUserContext(
  request: Request,
): Promise<UserContext | null> {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }

  const client = userClientFromRequest(request);
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return {
    userId: data.user.id,
    client,
  };
}

export async function resolveActor(request: Request): Promise<Actor | null> {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }

  const client = userClientFromRequest(request);
  if (!client) {
    return null;
  }

  const { data: userData, error: userError } =
    await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return null;
  }

  const { data: roleData, error: roleError } =
    await client.rpc("current_user_role");

  return {
    id: userData.user.id,
    role: !roleError && isUserRole(roleData) ? roleData : "applicant",
  };
}
