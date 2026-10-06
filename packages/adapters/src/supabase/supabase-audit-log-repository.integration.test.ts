import { createServiceRoleSupabaseClient } from "./clients";
import { makeSupabaseAuditLogRepository } from "./supabase-audit-log-repository";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

interface IntegrationConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Start local Supabase and export SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running adapters integration tests.`,
    );
  }

  return value;
}

function readConfig(): IntegrationConfig {
  return {
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("SupabaseAuditLogRepository integration", () => {
  it("chains adapter-written audit rows under concurrent appends", async () => {
    const config = readConfig();
    const client = createServiceRoleSupabaseClient({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const repository = makeSupabaseAuditLogRepository(client);
    const testRun = `adapter-audit-chain-${uniqueSuffix()}`;

    await Promise.all(
      Array.from({ length: 6 }, async (_, index) => repository.append({
        actorId: "a0000000-0000-0000-0000-000000000002",
        action: "role.changed",
        entityType: "profile",
        entityId: "a0000000-0000-0000-0000-000000000001",
        reasonCode: "meets_phase1_policy",
        metadata: {
          index,
          testRun,
        },
        idempotencyKey: `${testRun}-${index}`,
      })),
    );

    const { data: verified, error: verifyError } = await client.rpc(
      "audit_hash_chain_verify",
    );
    expect(verifyError).toBeNull();
    expect(verified).toBe(true);

    const { data: auditRows, error: auditError } = await client
      .from("audit_logs")
      .select("hash,previous_hash,metadata");
    expect(auditError).toBeNull();

    const matchingRows = (auditRows ?? []).filter((row) => {
      const metadata = row.metadata as Record<string, unknown> | null;
      return metadata?.testRun === testRun;
    });
    expect(matchingRows).toHaveLength(6);
    expect(matchingRows.every((row) => Boolean(row.hash))).toBe(true);
    expect(matchingRows.every((row) => Boolean(row.previous_hash))).toBe(true);
  });
});
