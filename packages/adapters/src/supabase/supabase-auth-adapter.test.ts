import { SupabaseAuthAdapter } from "./supabase-auth-adapter";
import type { SupabaseAdapterClient } from "./clients";

function makeClientWithSignInUser(user: {
  readonly id: string;
  readonly app_metadata?: Record<string, unknown>;
  readonly user_metadata?: Record<string, unknown>;
}, rpcResult: { readonly data: unknown; readonly error: unknown } = {
  data: "applicant",
  error: null,
}): SupabaseAdapterClient {
  return {
    auth: {
      signInWithPassword: async () => ({
        data: {
          user,
        },
        error: null,
      }),
    },
    rpc: async (fn: string) => {
      if (fn !== "current_user_role") {
        throw new Error(`unexpected rpc: ${fn}`);
      }

      return rpcResult;
    },
  } as unknown as SupabaseAdapterClient;
}

describe("SupabaseAuthAdapter", () => {
  it("reads role from current_user_role RPC", async () => {
    const adapter = new SupabaseAuthAdapter(
      makeClientWithSignInUser({
        id: "user-1",
      }, {
        data: "reviewer",
        error: null,
      }),
    );

    await expect(
      adapter.signIn({
        email: "reviewer@soulbound.local",
        password: "password123",
      }),
    ).resolves.toEqual({
      userId: "user-1",
      role: "reviewer",
    });
  });

  it("ignores user-editable user metadata and app metadata role claims", async () => {
    const adapter = new SupabaseAuthAdapter(
      makeClientWithSignInUser({
        id: "user-1",
        app_metadata: {
          role: "admin",
        },
        user_metadata: {
          role: "reviewer",
        },
      }, {
        data: "applicant",
        error: null,
      }),
    );

    await expect(
      adapter.signIn({
        email: "applicant@soulbound.local",
        password: "password123",
      }),
    ).resolves.toEqual({
      userId: "user-1",
      role: "applicant",
    });
  });

  it("fails closed to applicant when role RPC returns null", async () => {
    const adapter = new SupabaseAuthAdapter(
      makeClientWithSignInUser({
        id: "user-1",
      }, {
        data: null,
        error: null,
      }),
    );

    await expect(
      adapter.signIn({
        email: "applicant@soulbound.local",
        password: "password123",
      }),
    ).resolves.toEqual({
      userId: "user-1",
      role: "applicant",
    });
  });

  it("fails closed to applicant when role RPC errors", async () => {
    const adapter = new SupabaseAuthAdapter(
      makeClientWithSignInUser({
        id: "user-1",
      }, {
        data: null,
        error: { message: "rpc failed" },
      }),
    );

    await expect(
      adapter.signIn({
        email: "applicant@soulbound.local",
        password: "password123",
      }),
    ).resolves.toEqual({
      userId: "user-1",
      role: "applicant",
    });
  });
});
