import type { AuditAppendInput, AuditLogRepository } from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { throwIfSupabaseError } from "./errors";

export class SupabaseAuditLogRepository implements AuditLogRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async append(input: AuditAppendInput): Promise<void> {
    const { error } = await this.client
      .from("audit_logs")
      .insert({
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        reason_code: input.reasonCode,
        metadata: input.metadata ?? {},
      });

    throwIfSupabaseError(error);
  }
}

export function makeSupabaseAuditLogRepository(
  client: SupabaseAdapterClient,
): AuditLogRepository {
  return new SupabaseAuditLogRepository(client);
}
