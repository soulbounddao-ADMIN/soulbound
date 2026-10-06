import { resolveActor } from "../../_lib/auth";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
  unauthorized,
  validationError,
} from "../../_lib/http";
import {
  createPersonaClipSchema,
  deletePersonaClipQuerySchema,
} from "../../_lib/schemas";
import { serviceRoleStorageAdapter, userScopedStorageAdapter } from "../../_lib/storage";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const parsed = createPersonaClipSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const storage = userScopedStorageAdapter(request);
    if (!storage) {
      return unauthorized();
    }

    const result = await storage.createUploadUrl({
      ownerId: actor.id,
      contentHash: parsed.data.contentHash,
      mimeType: parsed.data.mimeType,
      ...(parsed.data.durationSeconds !== undefined
        ? { durationSeconds: parsed.data.durationSeconds }
        : {}),
    });

    return jsonResponse(result);
  } catch (error) {
    return dependencyFailure(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const actor = await resolveActor(request);
    if (!actor) {
      return unauthorized();
    }

    const url = new URL(request.url);
    const parsed = deletePersonaClipQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      return validationError(parsed.error.message);
    }

    const marked = await serviceRoleStorageAdapter().markOwnDraftForDeletion({
      ownerId: actor.id,
      assetId: parsed.data.assetId,
    });
    if (!marked) {
      return notFound();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return dependencyFailure(error);
  }
}
