import { makeCoreContainer } from "@soulbound/adapters";
import { readWebEnv } from "./env";

export function getContainer() {
  const env = readWebEnv();
  return makeCoreContainer({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
}
