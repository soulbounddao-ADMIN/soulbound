import {
  createServiceRoleSupabaseClient,
  makeSupabaseStorageAdapter,
} from "../index";
import type { ReapDeletablePersonaClipsResult } from "../index";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

declare const console: {
  log(line: string): void;
};

interface ReapPersonaClipsCliDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly writeLine?: (line: string) => void;
  readonly reap?: () => Promise<ReapDeletablePersonaClipsResult>;
}

function requireEnv(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

export async function runReapPersonaClipsCli(
  dependencies: ReapPersonaClipsCliDependencies = {},
): Promise<ReapDeletablePersonaClipsResult> {
  const env = dependencies.env ?? process.env;
  const writeLine = dependencies.writeLine ?? console.log;
  const reap = dependencies.reap ?? (() => {
    const client = createServiceRoleSupabaseClient({
      url: requireEnv(env, "SUPABASE_URL"),
      serviceRoleKey: requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    });

    return makeSupabaseStorageAdapter(client).reapDeletablePersonaClips({});
  });

  const result = await reap();
  writeLine(
    `persona-clip reap scanned=${result.scanned} deleted=${result.deleted} failed=${result.failed} deletedAssetIds=${JSON.stringify(result.deletedAssetIds)}`,
  );
  return result;
}
