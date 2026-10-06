export interface AccountDeletionGateway {
  prepare(userId: string): Promise<{
    readonly personaClipAssetIds: readonly string[];
  }>;
  purgePersonaClips(
    userId: string,
    assetIds: readonly string[],
  ): Promise<{ readonly deletedAssetIds: readonly string[] }>;
  deleteAuthUser(userId: string): Promise<"deleted" | "already_deleted">;
  complete(userId: string): Promise<void>;
}

export interface AccountDeletionResult {
  readonly deleted: true;
  readonly personaClipsRemoved: number;
}

function failureDetail(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "unknown error";
}

// Order: (1) prepare writes one account.deletion_requested row, shreds the
// dossier, and returns Persona Clip ids; (2) raw clip bytes via StoragePort;
// (3) auth user deletion, which cascades owned rows; (4) complete writes
// account.deleted only after that user is gone. A failure before step 3
// aborts. A failure in step 4 is logged and the request still succeeds: the
// caller's token cannot retry, and complete_account_deletion is idempotent
// for a later service-role repair.
export async function deleteOwnAccount(
  gateway: AccountDeletionGateway,
  userId: string,
): Promise<AccountDeletionResult> {
  const prepared = await gateway.prepare(userId);
  let personaClipsRemoved = 0;
  if (prepared.personaClipAssetIds.length > 0) {
    const purged = await gateway.purgePersonaClips(
      userId,
      prepared.personaClipAssetIds,
    );
    personaClipsRemoved = purged.deletedAssetIds.length;
  }
  const outcome = await gateway.deleteAuthUser(userId);
  try {
    await gateway.complete(userId);
  } catch (error) {
    console.warn(
      `account deletion succeeded for ${userId} (${outcome}) but complete_account_deletion failed: ${failureDetail(error)}`,
    );
  }
  return { deleted: true, personaClipsRemoved };
}
