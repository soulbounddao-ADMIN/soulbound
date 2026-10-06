import type { SupabaseAdapterClient } from "./clients";
import { SupabaseStorageAdapter } from "./supabase-storage-adapter";

interface ClipRow {
  id: string;
  applicant_id: string;
  storage_path: string;
  status: string;
  deletion_reason: string | null;
  delete_after: string | null;
}

function makeClient(rows: ClipRow[], removed: string[], removeFails = false) {
  return {
    from: (table: string) => {
      expect(table).toBe("persona_clip_assets");
      const filters: Record<string, string> = {};
      const builder = {
        select: () => builder,
        update: (patch: Partial<ClipRow>) => ({
          eq: async (column: string, value: string) => {
            for (const row of rows) {
              if ((row as unknown as Record<string, string>)[column] === value) {
                Object.assign(row, patch);
              }
            }
            return { error: null };
          },
        }),
        eq: (column: string, value: string) => {
          filters[column] = value;
          return builder;
        },
        maybeSingle: async () => ({
          data: rows.find((row) => Object.entries(filters)
            .every(([key, value]) => (row as unknown as Record<string, string>)[key] === value)) ?? null,
          error: null,
        }),
      };
      return builder;
    },
    rpc: async (name: string, args: { p_asset_id: string }) => {
      const row = rows.find((candidate) => candidate.id === args.p_asset_id);
      const eligible = row
        && row.status !== "deleted"
        && row.delete_after !== null
        && row.deletion_reason !== null;
      if (name === "list_deletable_persona_clips") {
        return { data: eligible ? [row] : [], error: null };
      }
      if (name === "mark_persona_clip_deleted") {
        if (eligible && row) {
          row.status = "deleted";
        }
        return { data: eligible ? row?.id : null, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("persona-clips");
        return {
          remove: async (paths: string[]) => {
            if (removeFails) {
              return { data: null, error: { message: "storage down" } };
            }
            removed.push(...paths);
            return { data: [], error: null };
          },
        };
      },
    },
  } as unknown as SupabaseAdapterClient;
}

function clip(id: string, applicantId: string, status = "attached"): ClipRow {
  return {
    id,
    applicant_id: applicantId,
    storage_path: `${applicantId}/${id}`,
    status,
    deletion_reason: null,
    delete_after: null,
  };
}

describe("SupabaseStorageAdapter.purgeOwnerPersonaClips", () => {
  it("marks via StoragePort, removes bytes, then marks rows deleted", async () => {
    const rows = [clip("clip-1", "owner"), clip("clip-2", "owner", "draft")];
    const removed: string[] = [];
    const adapter = new SupabaseStorageAdapter(makeClient(rows, removed));

    const result = await adapter.purgeOwnerPersonaClips({
      ownerId: "owner",
      assetIds: ["clip-1", "clip-2"],
    });

    expect(result.deletedAssetIds).toEqual(["clip-1", "clip-2"]);
    expect(removed).toEqual(["owner/clip-1", "owner/clip-2"]);
    expect(rows.map((row) => [row.status, row.deletion_reason])).toEqual([
      ["deleted", "policy_cleanup"],
      ["deleted", "policy_cleanup"],
    ]);
  });

  it("never touches another owner's clip and skips already deleted clips", async () => {
    const rows = [clip("clip-1", "someone-else"), clip("clip-2", "owner", "deleted")];
    const removed: string[] = [];
    const adapter = new SupabaseStorageAdapter(makeClient(rows, removed));

    const result = await adapter.purgeOwnerPersonaClips({
      ownerId: "owner",
      assetIds: ["clip-1", "clip-2"],
    });

    expect(result.deletedAssetIds).toEqual([]);
    expect(removed).toEqual([]);
    expect(rows[0]?.deletion_reason).toBeNull();
  });

  it("fails closed when storage removal fails", async () => {
    const rows = [clip("clip-1", "owner")];
    const adapter = new SupabaseStorageAdapter(makeClient(rows, [], true));

    await expect(adapter.purgeOwnerPersonaClips({
      ownerId: "owner",
      assetIds: ["clip-1"],
    })).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
    expect(rows[0]?.status).toBe("attached");
  });
});
