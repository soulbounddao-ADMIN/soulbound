import { AppError } from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { SupabaseAccountDeletionAdapter } from "./supabase-account-deletion-adapter";

function makeClient(options: {
  rpcData?: unknown;
  rpcError?: { code?: string; message?: string } | null;
  deleteError?: { status?: number; message?: string } | null;
  calls?: unknown[];
}): SupabaseAdapterClient {
  const calls = options.calls ?? [];
  return {
    rpc: async (name: string, args: unknown) => {
      calls.push(["rpc", name, args]);
      return { data: options.rpcData ?? null, error: options.rpcError ?? null };
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(["deleteUser", id]);
          return { data: null, error: options.deleteError ?? null };
        },
      },
    },
  } as unknown as SupabaseAdapterClient;
}

describe("SupabaseAccountDeletionAdapter", () => {
  it("prepares deletion through the service-role RPC", async () => {
    const calls: unknown[] = [];
    const adapter = new SupabaseAccountDeletionAdapter(makeClient({
      rpcData: [{ persona_clip_asset_id: "clip-1" }],
      calls,
    }));

    await expect(adapter.prepare("user-1")).resolves.toEqual({
      personaClipAssetIds: ["clip-1"],
    });
    expect(calls).toEqual([
      ["rpc", "prepare_account_deletion", { p_user_id: "user-1" }],
    ]);
  });

  it("records completion through the service-role RPC", async () => {
    const calls: unknown[] = [];
    const adapter = new SupabaseAccountDeletionAdapter(makeClient({ calls }));

    await expect(adapter.complete("user-1")).resolves.toBeUndefined();
    expect(calls).toEqual([
      ["rpc", "complete_account_deletion", { p_user_id: "user-1" }],
    ]);
  });

  it("maps RPC failures to AppError", async () => {
    const adapter = new SupabaseAccountDeletionAdapter(makeClient({
      rpcError: { code: "42501", message: "denied" },
    }));

    await expect(adapter.prepare("user-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(adapter.complete("user-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("deletes the auth user and treats a missing user as already deleted", async () => {
    const calls: unknown[] = [];
    await expect(new SupabaseAccountDeletionAdapter(makeClient({ calls }))
      .deleteAuthUser("user-1")).resolves.toBe("deleted");
    expect(calls).toEqual([["deleteUser", "user-1"]]);

    await expect(new SupabaseAccountDeletionAdapter(makeClient({
      deleteError: { status: 404, message: "User not found" },
    })).deleteAuthUser("user-1")).resolves.toBe("already_deleted");
  });

  it("fails closed on other auth deletion errors", async () => {
    const error = await new SupabaseAccountDeletionAdapter(makeClient({
      deleteError: { status: 500, message: "boom" },
    })).deleteAuthUser("user-1").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("DEPENDENCY_FAILURE");
  });
});
