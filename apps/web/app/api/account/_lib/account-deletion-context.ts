import {
  createServiceRoleSupabaseClient,
  makeSupabaseAccountDeletionAdapter,
  makeSupabaseStorageAdapter,
} from "@soulbound/adapters";
import { readWebEnv } from "../../_lib/env";
import type { AccountDeletionGateway } from "./account-deletion-service";

export function serviceRoleAccountDeletionGateway(): AccountDeletionGateway {
  const env = readWebEnv();
  const client = createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
  const deletion = makeSupabaseAccountDeletionAdapter(client);
  const storage = makeSupabaseStorageAdapter(client);
  return {
    prepare: (userId) => deletion.prepare(userId),
    purgePersonaClips: (ownerId, assetIds) =>
      storage.purgeOwnerPersonaClips({ ownerId, assetIds }),
    deleteAuthUser: (userId) => deletion.deleteAuthUser(userId),
    complete: (userId) => deletion.complete(userId),
  };
}
