import { forbidden } from "@soulbound/core";
import {
  createServiceRoleSupabaseClient,
  makeSupabaseMembershipRepository,
} from "@soulbound/adapters";

import { resolveUserContext } from "../../_lib/auth";
import { readWebEnv } from "../../_lib/env";
import {
  appErrorResponse,
  unauthorized,
} from "../../_lib/http";
import { SupabaseBoardRepository } from "./supabase-board-repository";

export async function requireActiveBoardContext(request: Request) {
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

  const boardRepo = new SupabaseBoardRepository(context.client);
  const myMemberNumber = await boardRepo.getMyMemberNumber(context.userId);
  return {
    userId: context.userId,
    myMemberNumber,
    boardRepo,
  } as const;
}

export function serviceRoleBoardRepository(): SupabaseBoardRepository {
  const env = readWebEnv();
  const client = createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
  return new SupabaseBoardRepository(client);
}
