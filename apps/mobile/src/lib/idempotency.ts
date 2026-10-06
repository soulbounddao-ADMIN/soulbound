import { randomUUID } from "expo-crypto";

export function createIdempotencyKey(): string {
  return randomUUID();
}
