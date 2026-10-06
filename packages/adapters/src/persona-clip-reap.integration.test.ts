import {
  createServiceRoleSupabaseClient,
  makeSupabaseStorageAdapter,
} from ".";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

const seededApplicantId = "a0000000-0000-0000-0000-000000000003";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Start local Supabase and export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running adapters integration tests.`,
    );
  }

  return value;
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("Persona Clip reaper integration", () => {
  it("keeps same-hash uploads on distinct object paths", async () => {
    const client = createServiceRoleSupabaseClient({
      url: requireEnv("SUPABASE_URL"),
      serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    });
    const adapter = makeSupabaseStorageAdapter(client);
    const contentHash = `same-hash-${uniqueSuffix()}`;
    const past = new Date(Date.now() - 60_000).toISOString();
    const assetIds: string[] = [];
    const storagePaths: string[] = [];

    try {
      const due = await adapter.createUploadUrl({
        ownerId: seededApplicantId,
        contentHash,
        mimeType: "video/webm",
      });
      const protectedClip = await adapter.createUploadUrl({
        ownerId: seededApplicantId,
        contentHash,
        mimeType: "video/webm",
      });
      assetIds.push(due.assetId, protectedClip.assetId);

      const { data: rows, error: rowsError } = await client
        .from("persona_clip_assets")
        .select("id, storage_path")
        .in("id", assetIds);
      if (rowsError) {
        throw rowsError;
      }

      const pathById = new Map(
        (rows ?? []).map((row) => [row.id, row.storage_path]),
      );
      const duePath = pathById.get(due.assetId);
      const protectedPath = pathById.get(protectedClip.assetId);
      if (!duePath || !protectedPath) {
        throw new Error("same-hash upload rows returned no Storage path");
      }
      storagePaths.push(duePath, protectedPath);

      expect(duePath).toBe(`${seededApplicantId}/${due.assetId}`);
      expect(protectedPath).toBe(
        `${seededApplicantId}/${protectedClip.assetId}`,
      );
      expect(duePath).not.toBe(protectedPath);

      for (const [path, body] of [
        [duePath, "due-same-hash"],
        [protectedPath, "protected-same-hash"],
      ] as const) {
        const { error } = await client.storage
          .from("persona-clips")
          .upload(path, body, {
            contentType: "video/webm",
            upsert: false,
          });
        if (error) {
          throw error;
        }
      }

      const { error: dueError } = await client
        .from("persona_clip_assets")
        .update({
          status: "draft",
          deletion_reason: null,
          delete_after: past,
        })
        .eq("id", due.assetId);
      if (dueError) {
        throw dueError;
      }

      const { error: protectedError } = await client
        .from("persona_clip_assets")
        .update({
          status: "attached",
          deletion_reason: null,
          delete_after: past,
        })
        .eq("id", protectedClip.assetId);
      if (protectedError) {
        throw protectedError;
      }

      await expect(
        adapter.reapDeletablePersonaClips({ limit: 100 }),
      ).resolves.toEqual({
        scanned: 1,
        deleted: 1,
        failed: 0,
        deletedAssetIds: [due.assetId],
      });

      const { data: reapedRows, error: reapedRowsError } = await client
        .from("persona_clip_assets")
        .select("id, status, deletion_reason, deleted_at")
        .in("id", assetIds);
      if (reapedRowsError) {
        throw reapedRowsError;
      }

      const rowById = new Map((reapedRows ?? []).map((row) => [row.id, row]));
      expect(rowById.get(due.assetId)).toMatchObject({
        status: "deleted",
        deletion_reason: "draft_abandoned",
      });
      expect(rowById.get(protectedClip.assetId)).toMatchObject({
        status: "attached",
        deletion_reason: null,
        deleted_at: null,
      });

      const { error: dueDownloadError } = await client.storage
        .from("persona-clips")
        .download(duePath);
      expect(dueDownloadError).not.toBeNull();

      const { data: protectedBytes, error: protectedDownloadError } =
        await client.storage
          .from("persona-clips")
          .download(protectedPath);
      expect(protectedDownloadError).toBeNull();
      expect(await protectedBytes?.text()).toBe("protected-same-hash");
    } finally {
      if (storagePaths.length > 0) {
        await client.storage.from("persona-clips").remove(storagePaths);
      }
      if (assetIds.length > 0) {
        await client.from("persona_clip_assets").delete().in("id", assetIds);
      }
    }
  }, 30_000);

  it("deletes only due terminal clips and abandoned drafts", async () => {
    const client = createServiceRoleSupabaseClient({
      url: requireEnv("SUPABASE_URL"),
      serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    });
    const adapter = makeSupabaseStorageAdapter(client);
    const suffix = uniqueSuffix();
    const past = new Date(Date.now() - 60_000).toISOString();
    const definitions = [
      {
        label: "approved",
        status: "attached",
        deletion_reason: "application_approved",
        delete_after: past,
        upload: true,
      },
      {
        label: "rejected",
        status: "attached",
        deletion_reason: "application_rejected",
        delete_after: past,
        upload: true,
      },
      {
        label: "draft",
        status: "draft",
        deletion_reason: null,
        delete_after: past,
        upload: true,
      },
      {
        label: "safeguard",
        status: "attached",
        deletion_reason: null,
        delete_after: past,
        upload: true,
      },
      {
        label: "already-deleted",
        status: "deleted",
        deletion_reason: "application_approved",
        delete_after: past,
        deleted_at: past,
        upload: true,
      },
      {
        label: "absent",
        status: "attached",
        deletion_reason: "application_approved",
        delete_after: past,
        upload: false,
      },
    ] as const;
    const storagePaths = definitions.map(
      ({ label }) => `${seededApplicantId}/task9a-${suffix}-${label}.webm`,
    );
    const insertedIds: string[] = [];

    try {
      for (const [index, definition] of definitions.entries()) {
        const storagePath = storagePaths[index];
        if (!storagePath) {
          throw new Error("missing generated Storage path");
        }

        if (definition.upload) {
          const { error: uploadError } = await client.storage
            .from("persona-clips")
            .upload(storagePath, `task9a-${definition.label}`, {
              contentType: "video/webm",
              upsert: false,
            });
          if (uploadError) {
            throw uploadError;
          }
        }

        const { data, error } = await client
          .from("persona_clip_assets")
          .insert({
            applicant_id: seededApplicantId,
            application_id: null,
            storage_provider: "supabase",
            storage_path: storagePath,
            content_hash: `task9a-${suffix}-${definition.label}`,
            mime_type: "video/webm",
            size_bytes: 16,
            status: definition.status,
            deletion_reason: definition.deletion_reason,
            delete_after: definition.delete_after,
            deleted_at:
              "deleted_at" in definition ? definition.deleted_at : null,
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }
        if (!data?.id) {
          throw new Error("insert returned no persona clip asset id");
        }
        insertedIds.push(data.id);
      }

      const first = await adapter.reapDeletablePersonaClips({ limit: 100 });
      expect(first).toMatchObject({
        scanned: 4,
        deleted: 4,
        failed: 0,
      });
      expect(first.deletedAssetIds).toHaveLength(4);

      const { data: rows, error: rowsError } = await client
        .from("persona_clip_assets")
        .select("id, status, deletion_reason, deleted_at, storage_path")
        .in("id", insertedIds);
      if (rowsError) {
        throw rowsError;
      }

      const byPath = new Map(
        (rows ?? []).map((row) => [row.storage_path, row]),
      );
      const rowFor = (label: string) => {
        const path = `${seededApplicantId}/task9a-${suffix}-${label}.webm`;
        const row = byPath.get(path);
        if (!row) {
          throw new Error(`missing ${label} persona clip row`);
        }
        return row;
      };

      expect(rowFor("approved")).toMatchObject({
        status: "deleted",
        deletion_reason: "application_approved",
      });
      expect(rowFor("approved").deleted_at).not.toBeNull();
      expect(rowFor("rejected")).toMatchObject({
        status: "deleted",
        deletion_reason: "application_rejected",
      });
      expect(rowFor("draft")).toMatchObject({
        status: "deleted",
        deletion_reason: "draft_abandoned",
      });
      expect(rowFor("safeguard")).toMatchObject({
        status: "attached",
        deletion_reason: null,
        deleted_at: null,
      });
      expect(rowFor("already-deleted")).toMatchObject({
        status: "deleted",
        deletion_reason: "application_approved",
      });
      expect(Date.parse(rowFor("already-deleted").deleted_at ?? "")).toBe(
        Date.parse(past),
      );
      expect(rowFor("absent")).toMatchObject({
        status: "deleted",
        deletion_reason: "application_approved",
      });

      for (const label of ["approved", "rejected", "draft", "absent"]) {
        const { error } = await client.storage
          .from("persona-clips")
          .download(`${seededApplicantId}/task9a-${suffix}-${label}.webm`);
        expect(error).not.toBeNull();
      }

      for (const label of ["safeguard", "already-deleted"]) {
        const { error } = await client.storage
          .from("persona-clips")
          .download(`${seededApplicantId}/task9a-${suffix}-${label}.webm`);
        expect(error).toBeNull();
      }

      await expect(
        adapter.reapDeletablePersonaClips({ limit: 100 }),
      ).resolves.toEqual({
        scanned: 0,
        deleted: 0,
        failed: 0,
        deletedAssetIds: [],
      });
    } finally {
      await client.storage.from("persona-clips").remove(storagePaths);
      if (insertedIds.length > 0) {
        await client.from("persona_clip_assets").delete().in("id", insertedIds);
      }
    }
  }, 30_000);
});
