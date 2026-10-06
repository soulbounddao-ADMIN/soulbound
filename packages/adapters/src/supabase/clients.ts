import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseAdapterClient = SupabaseClient;

export interface SupabaseClientConfig {
  readonly url: string;
}

export interface SupabaseAnonClientConfig extends SupabaseClientConfig {
  readonly anonKey: string;
}

export interface SupabaseUserClientConfig extends SupabaseAnonClientConfig {
  readonly accessToken: string;
}

export interface SupabaseServiceRoleClientConfig extends SupabaseClientConfig {
  readonly serviceRoleKey: string;
}

export function createAnonSupabaseClient(
  config: SupabaseAnonClientConfig,
): SupabaseAdapterClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createBrowserSupabaseClient(
  config: SupabaseAnonClientConfig,
): SupabaseAdapterClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function createUserSupabaseClient(
  config: SupabaseUserClientConfig,
): SupabaseAdapterClient {
  return createClient(config.url, config.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServiceRoleSupabaseClient(
  config: SupabaseServiceRoleClientConfig,
): SupabaseAdapterClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
