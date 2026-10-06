import { forbidden } from "@soulbound/core";
import {
  createServiceRoleSupabaseClient,
  makeSupabaseMembershipRepository,
} from "@soulbound/adapters";

import { resolveUserContext } from "../../_lib/auth";
import { readWebEnv } from "../../_lib/env";
import {
  appErrorResponse,
  jsonResponse,
  unauthorized,
} from "../../_lib/http";
import {
  SupabaseVoteRepository,
  VoteRepositoryError,
} from "./supabase-vote-repository";

export async function requireActiveVoteContext(request: Request) {
  const context = await resolveUserContext(request);
  if (!context) {
    return { response: unauthorized() } as const;
  }

  const membership = await makeSupabaseMembershipRepository(context.client)
    .findByUserId(context.userId);
  if (membership?.status !== "active") {
    return {
      response: appErrorResponse(forbidden("active membership required")),
    } as const;
  }

  return {
    userId: context.userId,
    voteRepo: new SupabaseVoteRepository(context.client),
  } as const;
}

export function serviceRoleVoteRepository(): SupabaseVoteRepository {
  const env = readWebEnv();
  const client = createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
  return new SupabaseVoteRepository(client);
}

export function voteErrorResponse(error: unknown): Response | null {
  if (!(error instanceof VoteRepositoryError)) {
    return null;
  }

  return jsonResponse({
    error: {
      code: error.code,
      message: error.message,
    },
  }, error.status);
}
