import {
  createServiceRoleSupabaseClient,
  makeSupabaseStorageAdapter,
} from "@soulbound/adapters";
import type { SupabaseStorageAdapter } from "@soulbound/adapters";
import { userClientFromRequest } from "./auth";
import { readWebEnv } from "./env";

export function userScopedStorageAdapter(
  request: Request,
): SupabaseStorageAdapter | null {
  const client = userClientFromRequest(request);
  if (!client) {
    return null;
  }

  return makeSupabaseStorageAdapter(client);
}

export function serviceRoleStorageAdapter(): SupabaseStorageAdapter {
  const env = readWebEnv();
  const client = createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });

  return makeSupabaseStorageAdapter(client);
}
