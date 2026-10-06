import { forbidden } from "@soulbound/core";
import { makeSupabaseMembershipRepository } from "@soulbound/adapters";
import type { SupabaseAdapterClient } from "@soulbound/adapters";
import { resolveUserContext } from "./auth";
import { appErrorResponse, unauthorized } from "./http";

export type MemberContextResult =
  | { readonly response: Response }
  | { readonly userId: string; readonly client: SupabaseAdapterClient };

export async function requireUserContext(
  request: Request,
): Promise<MemberContextResult> {
  const context = await resolveUserContext(request);
  if (!context) {
    return { response: unauthorized() };
  }
  return { userId: context.userId, client: context.client };
}

export async function requireActiveMemberContext(
  request: Request,
): Promise<MemberContextResult> {
  const context = await requireUserContext(request);
  if ("response" in context) {
    return context;
  }

  const membership = await makeSupabaseMembershipRepository(context.client)
    .findByUserId(context.userId);
  if (membership?.status !== "active") {
    return {
      response: appErrorResponse(forbidden("active membership required")),
    };
  }
  return context;
}
