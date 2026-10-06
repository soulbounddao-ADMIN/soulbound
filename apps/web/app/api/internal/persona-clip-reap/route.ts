import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import {
  dependencyFailure,
  jsonResponse,
  unauthorized,
} from "../../_lib/http";
import { serviceRoleStorageAdapter } from "../../_lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

declare const console: {
  log(line: string): void;
  error(line: string): void;
};

interface ReapCounts {
  readonly scanned: number;
  readonly deleted: number;
  readonly failed: number;
}

function readCronSecret(): string | null {
  const value = process.env.CRON_SECRET;
  return value && value.length > 0 ? value : null;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    const length = Math.max(leftBuffer.length, rightBuffer.length);
    const paddedLeft = Buffer.alloc(length);
    const paddedRight = Buffer.alloc(length);
    leftBuffer.copy(paddedLeft);
    rightBuffer.copy(paddedRight);
    timingSafeEqual(paddedLeft, paddedRight);
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: Request, cronSecret: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return false;
  }

  return timingSafeStringEqual(authorization, `Bearer ${cronSecret}`);
}

function disabled(): Response {
  return jsonResponse({ error: { code: "UNAVAILABLE" } }, 503);
}

function countsOnly(result: ReapCounts): ReapCounts {
  return {
    scanned: result.scanned,
    deleted: result.deleted,
    failed: result.failed,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown dependency failure";
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = readCronSecret();
  if (!cronSecret) {
    return disabled();
  }

  if (!authorized(request, cronSecret)) {
    return unauthorized();
  }

  try {
    const result =
      await serviceRoleStorageAdapter().reapDeletablePersonaClips({});
    console.log(
      `persona-clip reap scanned=${result.scanned} deleted=${result.deleted} failed=${result.failed} deletedAssetIds=${JSON.stringify(result.deletedAssetIds)}`,
    );

    return jsonResponse(countsOnly(result), result.failed > 0 ? 500 : 200);
  } catch (error) {
    console.error(
      `persona-clip reap dependency failure: ${errorMessage(error)}`,
    );
    return dependencyFailure(error);
  }
}
