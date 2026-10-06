import type {
  EvidenceReceipt,
  PutEvidenceInput,
  StoragePort,
} from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { dependencyFailure } from "@soulbound/core";
import { throwIfSupabaseError } from "./errors";
import { mapPersonaClipAssetToEvidenceReceipt } from "./mappers";
import type { PersonaClipAssetRow } from "./mappers";

const personaClipBucket = "persona-clips";
const signedUrlTtlSeconds = 60 * 5;
const draftDeleteAfterMs = 24 * 60 * 60 * 1000;
const signedUploadCacheControlSeconds = 3600;

export interface CreatePersonaClipUploadUrlInput {
  readonly ownerId: string;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly durationSeconds?: number;
}

export interface PersonaClipUploadContract {
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
}

export interface PersonaClipUploadUrl {
  readonly assetId: string;
  readonly upload: PersonaClipUploadContract;
}

export interface MarkOwnDraftForDeletionInput {
  readonly ownerId: string;
  readonly assetId: string;
}

export interface ClearSubmittedPersonaClipRetentionInput {
  readonly ownerId: string;
  readonly assetId: string;
  readonly applicationId: string;
}

export interface ReapDeletablePersonaClipsInput {
  readonly limit?: number;
}

export interface ReapDeletablePersonaClipsResult {
  readonly scanned: number;
  readonly deleted: number;
  readonly failed: number;
  readonly deletedAssetIds: string[];
}

interface DeletablePersonaClipRow {
  readonly id: string;
  readonly storage_path: string;
  readonly status: string;
  readonly deletion_reason: string | null;
  readonly delete_after: string | null;
}

declare const crypto: {
  randomUUID(): string;
};

function buildObjectPath(ownerId: string, assetId: string): string {
  return `${ownerId}/${assetId}`;
}

function draftDeleteAfter(): string {
  return new Date(Date.now() + draftDeleteAfterMs).toISOString();
}

export class SupabaseStorageAdapter implements StoragePort {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async createUploadUrl(
    input: CreatePersonaClipUploadUrlInput,
  ): Promise<PersonaClipUploadUrl> {
    const assetId = crypto.randomUUID();
    const storagePath = buildObjectPath(input.ownerId, assetId);
    const { data: clip, error: clipError } = await this.client
      .from("persona_clip_assets")
      .insert({
        id: assetId,
        applicant_id: input.ownerId,
        application_id: null,
        storage_provider: "supabase",
        storage_path: storagePath,
        content_hash: input.contentHash,
        mime_type: input.mimeType,
        size_bytes: 0,
        duration_seconds: input.durationSeconds ?? null,
        status: "draft",
        deletion_reason: null,
        delete_after: draftDeleteAfter(),
      })
      .select("id")
      .single();

    throwIfSupabaseError(clipError);

    const insertedAssetId = (clip as { id?: string } | null)?.id;
    if (!insertedAssetId) {
      throw dependencyFailure("supabase returned no persona clip asset id");
    }

    const { data, error } = await this.client.storage
      .from(personaClipBucket)
      .createSignedUploadUrl(storagePath);

    throwIfSupabaseError(error);

    if (!data?.signedUrl) {
      throw dependencyFailure("supabase returned no signed upload URL");
    }

    // Supabase's signed-upload endpoint accepts a plain fetch PUT to signedUrl.
    // This mirrors storage-js uploadToSignedUrl's raw-body branch, without
    // requiring the browser to import the Supabase SDK.
    return {
      assetId: insertedAssetId,
      upload: {
        url: data.signedUrl,
        method: "PUT",
        headers: {
          "cache-control": `max-age=${signedUploadCacheControlSeconds}`,
          "content-type": input.mimeType,
          "x-upsert": "false",
        },
      },
    };
  }

  async put(input: PutEvidenceInput): Promise<EvidenceReceipt> {
    const assetId = crypto.randomUUID();
    const { data, error } = await this.client
      .from("persona_clip_assets")
      .insert({
        id: assetId,
        applicant_id: input.ownerId,
        application_id: input.applicationId ?? null,
        storage_provider: "supabase",
        storage_path: buildObjectPath(input.ownerId, assetId),
        content_hash: input.contentHash,
        mime_type: input.mimeType,
        size_bytes: 0,
        status: input.applicationId ? "attached" : "draft",
      })
      .select("*")
      .single();

    throwIfSupabaseError(error);
    return mapPersonaClipAssetToEvidenceReceipt(data as PersonaClipAssetRow);
  }

  async getSignedUrl(evidenceId: string): Promise<string> {
    const { data: clip, error: clipError } = await this.client
      .from("persona_clip_assets")
      .select("storage_path")
      .eq("id", evidenceId)
      .maybeSingle();

    throwIfSupabaseError(clipError);

    const storagePath = (clip as { storage_path?: string } | null)?.storage_path;
    if (!storagePath) {
      throw dependencyFailure("persona clip storage path not found");
    }

    const { data, error } = await this.client.storage
      .from(personaClipBucket)
      .createSignedUrl(storagePath, signedUrlTtlSeconds);

    throwIfSupabaseError(error);

    if (!data?.signedUrl) {
      throw dependencyFailure("supabase returned no signed URL");
    }

    return data.signedUrl;
  }

  async markForDeletion(evidenceId: string): Promise<void> {
    const { error } = await this.client
      .from("persona_clip_assets")
      .update({
        delete_after: new Date().toISOString(),
        deletion_reason: "policy_cleanup",
      })
      .eq("id", evidenceId);

    throwIfSupabaseError(error);
  }

  async markOwnDraftForDeletion(
    input: MarkOwnDraftForDeletionInput,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("persona_clip_assets")
      .update({
        delete_after: new Date().toISOString(),
        deletion_reason: "policy_cleanup",
      })
      .eq("id", input.assetId)
      .eq("applicant_id", input.ownerId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();

    throwIfSupabaseError(error);
    return Boolean((data as { id?: string } | null)?.id);
  }

  async clearSubmittedRetention(
    input: ClearSubmittedPersonaClipRetentionInput,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("persona_clip_assets")
      .update({
        delete_after: null,
        deletion_reason: null,
      })
      .eq("id", input.assetId)
      .eq("applicant_id", input.ownerId)
      .eq("application_id", input.applicationId)
      .eq("status", "attached")
      .select("id")
      .maybeSingle();

    throwIfSupabaseError(error);
    return Boolean((data as { id?: string } | null)?.id);
  }

  async reapDeletablePersonaClips(
    input: ReapDeletablePersonaClipsInput = {},
  ): Promise<ReapDeletablePersonaClipsResult> {
    const { data, error } = await this.client.rpc(
      "list_deletable_persona_clips",
      {
        p_limit: input.limit ?? 100,
        p_asset_id: null,
      },
    );

    throwIfSupabaseError(error);

    const clips = (data ?? []) as DeletablePersonaClipRow[];
    const deletedAssetIds: string[] = [];
    let failed = 0;

    for (const clip of clips) {
      try {
        const { data: currentData, error: currentError } =
          await this.client.rpc("list_deletable_persona_clips", {
            p_limit: 1,
            p_asset_id: clip.id,
          });

        throwIfSupabaseError(currentError);

        const [current] = (currentData ?? []) as DeletablePersonaClipRow[];
        if (!current) {
          continue;
        }

        const { error: removeError } = await this.client.storage
          .from(personaClipBucket)
          .remove([current.storage_path]);

        if (removeError) {
          failed += 1;
          continue;
        }

        const { data: updatedAssetId, error: updateError } =
          await this.client.rpc("mark_persona_clip_deleted", {
            p_asset_id: current.id,
          });

        throwIfSupabaseError(updateError);
        if (updatedAssetId === current.id) {
          deletedAssetIds.push(current.id);
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: clips.length,
      deleted: deletedAssetIds.length,
      failed,
      deletedAssetIds,
    };
  }
}

export function makeSupabaseStorageAdapter(
  client: SupabaseAdapterClient,
): SupabaseStorageAdapter {
  return new SupabaseStorageAdapter(client);
}
