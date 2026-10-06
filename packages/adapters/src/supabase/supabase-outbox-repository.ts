import type {
  EnqueueOutboxInput,
  OutboxEvent,
  OutboxRepository,
} from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { throwIfSupabaseError } from "./errors";
import { mapOutboxEventRow } from "./mappers";
import type { OutboxEventRow } from "./mappers";

export class SupabaseOutboxRepository implements OutboxRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async enqueue(input: EnqueueOutboxInput): Promise<OutboxEvent> {
    const { data, error } = await this.client
      .from("outbox_events")
      .insert({
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId,
        event_type: input.eventType,
        payload: input.payload,
        target: input.target,
        idempotency_key: input.idempotencyKey,
      })
      .select("*")
      .single();

    throwIfSupabaseError(error);
    return mapOutboxEventRow(data as OutboxEventRow);
  }

  async claimPending(limit: number): Promise<readonly OutboxEvent[]> {
    const { data: pending, error: selectError } = await this.client
      .from("outbox_events")
      .select("id")
      .eq("status", "pending")
      .eq("target", "internal")
      .order("created_at", { ascending: true })
      .limit(limit);

    throwIfSupabaseError(selectError);

    const ids = (pending ?? []).map((row) => row.id as string);
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from("outbox_events")
      .update({ status: "processing" })
      .in("id", ids)
      .select("*");

    throwIfSupabaseError(error);
    return (data ?? []).map((row) => mapOutboxEventRow(row as OutboxEventRow));
  }

  async markSucceeded(id: string): Promise<void> {
    const { error } = await this.client
      .from("outbox_events")
      .update({
        status: "succeeded",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", id);

    throwIfSupabaseError(error);
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const { data: existing, error: selectError } = await this.client
      .from("outbox_events")
      .select("attempt_count")
      .eq("id", id)
      .maybeSingle();

    throwIfSupabaseError(selectError);

    const attemptCount =
      typeof existing?.attempt_count === "number" ? existing.attempt_count + 1 : 1;

    const { error } = await this.client
      .from("outbox_events")
      .update({
        status: "failed",
        last_error: errorMessage,
        attempt_count: attemptCount,
      })
      .eq("id", id);

    throwIfSupabaseError(error);
  }
}

export function makeSupabaseOutboxRepository(
  client: SupabaseAdapterClient,
): OutboxRepository {
  return new SupabaseOutboxRepository(client);
}
