import { createServiceRoleSupabaseClient } from "@soulbound/adapters";

import { readWebEnv } from "../../../../_lib/env";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
} from "../../../../_lib/http";
import { serviceRoleStorageAdapter } from "../../../../_lib/storage";
import {
  requireActiveVoteContext,
  voteErrorResponse,
} from "../../../_lib/vote-context";

interface RouteContext {
  readonly params: Promise<{
    readonly voteId: string;
  }>;
}

interface ClipVoteRow {
  readonly id: string;
  readonly status: string;
  readonly admission_applications?: {
    readonly status?: string;
    readonly persona_clip_asset_id?: string | null;
  } | null;
}

function serviceRoleClient() {
  const env = readWebEnv();
  return createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveVoteContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const { voteId } = await context.params;
    const client = serviceRoleClient();
    const { data, error } = await client
      .from("admission_votes")
      .select("id,status,admission_applications(status,persona_clip_asset_id)")
      .eq("id", voteId)
      .maybeSingle();
    if (error) {
      throw error;
    }

    const row = data as unknown as ClipVoteRow | null;
    const application = row?.admission_applications ?? null;
    if (
      !row
      || row.status !== "open"
      || application?.status !== "in_vote"
      || !application.persona_clip_asset_id
    ) {
      return notFound();
    }

    const { error: accessError } = await client.from("admission_vote_clip_accesses").insert({
      vote_id: voteId,
      voter_id: authorized.userId,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (accessError) {
      throw accessError;
    }

    const url = await serviceRoleStorageAdapter().getSignedUrl(
      application.persona_clip_asset_id,
    );
    return jsonResponse({ url });
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
