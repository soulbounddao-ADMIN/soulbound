import { SupabaseStorageAdapter } from "./supabase-storage-adapter";
import type { SupabaseAdapterClient } from "./clients";

interface InsertedClip {
  readonly id: string;
  readonly applicant_id: string;
  readonly storage_path: string;
  readonly content_hash: string;
  readonly mime_type: string;
  readonly duration_seconds: number | null;
  readonly status: string;
  readonly deletion_reason: string | null;
  readonly delete_after: string;
}

function makeCreateUploadClient(
  inserted: InsertedClip[],
  signedPaths: string[],
): SupabaseAdapterClient {
  return {
    from: (table: string) => {
      if (table !== "persona_clip_assets") {
        throw new Error(`unexpected table: ${table}`);
      }

      return {
        insert: (value: InsertedClip) => {
          inserted.push(value);
          return {
            select: (columns: string) => {
              expect(columns).toBe("id");
              return {
                single: async () => ({
                  data: { id: value.id },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("persona-clips");
        return {
          createSignedUploadUrl: async (path: string) => {
            signedPaths.push(path);
            return {
              data: {
                signedUrl: `http://storage.local/upload?token=token-1&path=${encodeURIComponent(path)}`,
                path,
                token: "token-1",
              },
              error: null,
            };
          },
        };
      },
    },
  } as unknown as SupabaseAdapterClient;
}

function makeDeletionClient() {
  const calls: Array<readonly [string, string]> = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("persona_clip_assets");
      return {
        update: (value: Record<string, unknown>) => {
          expect(value.deletion_reason).toBe("policy_cleanup");
          expect(typeof value.delete_after).toBe("string");
          return {
            eq: (column: string, value: string) => {
              calls.push([column, value]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push([column2, value2]);
                  return {
                    eq: (column3: string, value3: string) => {
                      calls.push([column3, value3]);
                      return {
                        select: (columns: string) => {
                          expect(columns).toBe("id");
                          return {
                            maybeSingle: async () => ({
                              data: { id: "asset-1" },
                              error: null,
                            }),
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseAdapterClient;

  return { client, calls };
}

function makeRetentionClearClient() {
  const calls: Array<readonly [string, string]> = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("persona_clip_assets");
      return {
        update: (value: Record<string, unknown>) => {
          expect(value).toEqual({
            delete_after: null,
            deletion_reason: null,
          });
          return {
            eq: (column: string, value: string) => {
              calls.push([column, value]);
              return {
                eq: (column2: string, value2: string) => {
                  calls.push([column2, value2]);
                  return {
                    eq: (column3: string, value3: string) => {
                      calls.push([column3, value3]);
                      return {
                        eq: (column4: string, value4: string) => {
                          calls.push([column4, value4]);
                          return {
                            select: (columns: string) => {
                              expect(columns).toBe("id");
                              return {
                                maybeSingle: async () => ({
                                  data: { id: "asset-1" },
                                  error: null,
                                }),
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseAdapterClient;

  return { client, calls };
}

function makeReapClient(
  remove:
    | { readonly data: unknown; readonly error: unknown }
    | Error,
) {
  const storagePath = "private-owner/raw-clip.webm";
  const updates: Record<string, unknown>[] = [];
  const rpcCalls: Array<readonly [string, Record<string, unknown>]> = [];
  const clip = {
    id: "asset-1",
    storage_path: storagePath,
    status: "attached",
    deletion_reason: "application_approved",
    delete_after: "2026-01-01T00:00:00.000Z",
  };

  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push([name, args]);
      if (name === "list_deletable_persona_clips") {
        return {
          data: [clip],
          error: null,
        };
      }
      if (name === "mark_persona_clip_deleted") {
        updates.push(args);
        return {
          data: "asset-1",
          error: null,
        };
      }
      throw new Error(`unexpected rpc: ${name}`);
    },
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("persona-clips");
        return {
          remove: async (paths: string[]) => {
            expect(paths).toEqual([storagePath]);
            if (remove instanceof Error) {
              throw remove;
            }
            return remove;
          },
        };
      },
    },
  } as unknown as SupabaseAdapterClient;

  return { client, updates, rpcCalls, storagePath };
}

describe("SupabaseStorageAdapter", () => {
  it("creates draft persona clip rows and a plain-fetch upload contract", async () => {
    const inserted: InsertedClip[] = [];
    const signedPaths: string[] = [];
    const adapter = new SupabaseStorageAdapter(
      makeCreateUploadClient(inserted, signedPaths),
    );

    const result = await adapter.createUploadUrl({
      ownerId: "user-1",
      contentHash: "hash-1",
      mimeType: "video/webm",
      durationSeconds: 9,
    });

    expect(result).toEqual({
      assetId: inserted[0]?.id,
      upload: {
        url: `http://storage.local/upload?token=token-1&path=${encodeURIComponent(`user-1/${inserted[0]?.id}`)}`,
        method: "PUT",
        headers: {
          "cache-control": "max-age=3600",
          "content-type": "video/webm",
          "x-upsert": "false",
        },
      },
    });

    expect(inserted).toHaveLength(1);
    const [insertedClip] = inserted;
    if (!insertedClip) {
      throw new Error("expected inserted persona clip row");
    }
    expect(insertedClip).toMatchObject({
      applicant_id: "user-1",
      storage_path: `user-1/${insertedClip.id}`,
      content_hash: "hash-1",
      mime_type: "video/webm",
      duration_seconds: 9,
      status: "draft",
      deletion_reason: null,
    });
    expect(Date.parse(insertedClip.delete_after)).not.toBeNaN();
    expect(signedPaths).toEqual([`user-1/${insertedClip.id}`]);
  });

  it("uses distinct asset-owned paths for repeated content hashes", async () => {
    const inserted: InsertedClip[] = [];
    const signedPaths: string[] = [];
    const adapter = new SupabaseStorageAdapter(
      makeCreateUploadClient(inserted, signedPaths),
    );

    const first = await adapter.createUploadUrl({
      ownerId: "user-1",
      contentHash: "same-hash",
      mimeType: "video/webm",
    });
    const second = await adapter.createUploadUrl({
      ownerId: "user-1",
      contentHash: "same-hash",
      mimeType: "video/webm",
    });

    expect(first.assetId).not.toBe(second.assetId);
    expect(signedPaths).toEqual([
      `user-1/${first.assetId}`,
      `user-1/${second.assetId}`,
    ]);
    expect(new Set(signedPaths).size).toBe(2);
    expect(inserted.map((clip) => clip.content_hash)).toEqual([
      "same-hash",
      "same-hash",
    ]);
  });

  it("marks only the caller-owned draft row for deletion", async () => {
    const { client, calls } = makeDeletionClient();
    const adapter = new SupabaseStorageAdapter(client);

    await expect(adapter.markOwnDraftForDeletion({
      ownerId: "user-1",
      assetId: "asset-1",
    })).resolves.toBe(true);

    expect(calls).toEqual([
      ["id", "asset-1"],
      ["applicant_id", "user-1"],
      ["status", "draft"],
    ]);
  });

  it("clears only the submitted attached clip retention columns", async () => {
    const { client, calls } = makeRetentionClearClient();
    const adapter = new SupabaseStorageAdapter(client);

    await expect(adapter.clearSubmittedRetention({
      ownerId: "user-1",
      assetId: "asset-1",
      applicationId: "app-1",
    })).resolves.toBe(true);

    expect(calls).toEqual([
      ["id", "asset-1"],
      ["applicant_id", "user-1"],
      ["application_id", "app-1"],
      ["status", "attached"],
    ]);
  });

  it("does not mark an asset deleted when Storage returns an error", async () => {
    const { client, updates, rpcCalls } = makeReapClient({
      data: null,
      error: { message: "temporary Storage failure" },
    });
    const adapter = new SupabaseStorageAdapter(client);

    await expect(adapter.reapDeletablePersonaClips()).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 1,
      deletedAssetIds: [],
    });

    expect(rpcCalls).toEqual([
      [
        "list_deletable_persona_clips",
        { p_limit: 100, p_asset_id: null },
      ],
      [
        "list_deletable_persona_clips",
        { p_limit: 1, p_asset_id: "asset-1" },
      ],
    ]);
    expect(updates).toEqual([]);
  });

  it("does not mark an asset deleted when Storage throws", async () => {
    const { client, updates } = makeReapClient(
      new Error("transport unavailable"),
    );
    const adapter = new SupabaseStorageAdapter(client);

    await expect(adapter.reapDeletablePersonaClips()).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: 1,
      deletedAssetIds: [],
    });

    expect(updates).toEqual([]);
  });

  it("returns no Storage path, URL, or token on successful deletion", async () => {
    const { client, updates, rpcCalls, storagePath } = makeReapClient({
      data: [{ name: "removed-object" }],
      error: null,
    });
    const adapter = new SupabaseStorageAdapter(client);

    const result = await adapter.reapDeletablePersonaClips();
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      scanned: 1,
      deleted: 1,
      failed: 0,
      deletedAssetIds: ["asset-1"],
    });
    expect(updates).toHaveLength(1);
    expect(rpcCalls).toEqual([
      [
        "list_deletable_persona_clips",
        { p_limit: 100, p_asset_id: null },
      ],
      [
        "list_deletable_persona_clips",
        { p_limit: 1, p_asset_id: "asset-1" },
      ],
      [
        "mark_persona_clip_deleted",
        { p_asset_id: "asset-1" },
      ],
    ]);
    expect(serialized).not.toContain(storagePath);
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("token");
  });
});
