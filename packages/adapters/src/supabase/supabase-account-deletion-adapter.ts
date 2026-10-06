import { dependencyFailure } from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { throwIfSupabaseError } from "./errors";

export interface PreparedAccountDeletion {
  readonly personaClipAssetIds: readonly string[];
}

export type AuthUserDeletionOutcome = "deleted" | "already_deleted";

interface PrepareAccountDeletionRow {
  readonly persona_clip_asset_id: string;
}

// Service-role only. Never construct this with a user-scoped client.
export class SupabaseAccountDeletionAdapter {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async prepare(userId: string): Promise<PreparedAccountDeletion> {
    const { data, error } = await this.client.rpc("prepare_account_deletion", {
      p_user_id: userId,
    });

    throwIfSupabaseError(error);
    return {
      personaClipAssetIds: ((data ?? []) as PrepareAccountDeletionRow[])
        .map((row) => row.persona_clip_asset_id),
    };
  }

  // No-op until the auth user and profile are both gone. A second call does
  // not append another account.deleted row.
  async complete(userId: string): Promise<void> {
    const { error } = await this.client.rpc("complete_account_deletion", {
      p_user_id: userId,
    });
    throwIfSupabaseError(error);
  }

  async deleteAuthUser(userId: string): Promise<AuthUserDeletionOutcome> {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (!error) {
      return "deleted";
    }

    const status = (error as { status?: number }).status;
    if (status === 404 || /not.?found/i.test(error.message ?? "")) {
      return "already_deleted";
    }

    throw dependencyFailure("auth user deletion failed", { status });
  }
}

export function makeSupabaseAccountDeletionAdapter(
  client: SupabaseAdapterClient,
): SupabaseAccountDeletionAdapter {
  return new SupabaseAccountDeletionAdapter(client);
}
