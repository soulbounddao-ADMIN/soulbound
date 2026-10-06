import {
  createServiceRoleSupabaseClient,
  makeSupabaseAccountDeletionAdapter,
  makeSupabaseStorageAdapter,
} from ".";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Start local Supabase and export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running adapters integration tests.`,
    );
  }
  return value;
}

describe("account deletion adapter integration", () => {
  it("purges the owner's Persona Clip bytes and deletes the auth user idempotently", async () => {
    const client = createServiceRoleSupabaseClient({
      url: requireEnv("SUPABASE_URL"),
      serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    });
    const deletion = makeSupabaseAccountDeletionAdapter(client);
    const storage = makeSupabaseStorageAdapter(client);
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const username = `acctdel_${suffix}`.slice(0, 24);

    const { data: created, error: createError } = await client.auth.admin.createUser({
      email: `${username}@soulbound.internal`,
      password: `acctdel-${suffix}!`,
      email_confirm: true,
      user_metadata: { username },
    });
    if (createError || !created.user) {
      throw createError ?? new Error("createUser returned no user");
    }
    const userId = created.user.id;
    const { error: profileError } = await client
      .from("profiles")
      .upsert({ id: userId, role: "applicant", username }, { onConflict: "id" });
    if (profileError) {
      throw profileError;
    }

    const upload = await storage.createUploadUrl({
      ownerId: userId,
      contentHash: `acctdel-${suffix}`,
      mimeType: "video/webm",
    });
    const path = `${userId}/${upload.assetId}`;
    const { error: uploadError } = await client.storage
      .from("persona-clips")
      .upload(path, "clip-bytes", { contentType: "video/webm", upsert: false });
    if (uploadError) {
      throw uploadError;
    }

    const prepared = await deletion.prepare(userId);
    expect(prepared.personaClipAssetIds).toEqual([upload.assetId]);
    await expect(deletion.complete(userId)).resolves.toBeUndefined();

    const { data: requestedOnly } = await client
      .from("audit_logs")
      .select("action")
      .eq("entity_id", userId)
      .order("created_at", { ascending: true });
    expect(requestedOnly).toEqual([{ action: "account.deletion_requested" }]);

    await expect(storage.purgeOwnerPersonaClips({
      ownerId: userId,
      assetIds: prepared.personaClipAssetIds,
    })).resolves.toEqual({ deletedAssetIds: [upload.assetId] });

    const { data: objects, error: listError } = await client.storage
      .from("persona-clips")
      .list(userId);
    expect(listError).toBeNull();
    expect(objects ?? []).toEqual([]);

    await expect(deletion.deleteAuthUser(userId)).resolves.toBe("deleted");
    await expect(deletion.complete(userId)).resolves.toBeUndefined();
    await expect(deletion.complete(userId)).resolves.toBeUndefined();
    await expect(deletion.deleteAuthUser(userId)).resolves.toBe("already_deleted");
    await expect(deletion.prepare(userId)).resolves.toEqual({ personaClipAssetIds: [] });

    const { data: assets } = await client
      .from("persona_clip_assets")
      .select("id")
      .eq("id", upload.assetId);
    expect(assets).toEqual([]);

    const { data: audit } = await client
      .from("audit_logs")
      .select("action")
      .eq("entity_id", userId);
    expect(audit?.map((row) => row.action).sort()).toEqual([
      "account.deleted",
      "account.deletion_requested",
    ]);
  });
});
