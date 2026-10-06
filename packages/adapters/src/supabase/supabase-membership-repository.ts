import type { Membership, MembershipRepository } from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { throwIfSupabaseError } from "./errors";
import { mapMembershipRow } from "./mappers";
import type { MembershipRow } from "./mappers";

const membershipSelect = [
  "id",
  "user_id",
  "status",
  "tier",
  "issued_at",
  "expires_at",
  "revoked_at",
].join(",");

export class SupabaseMembershipRepository implements MembershipRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async findByUserId(userId: string): Promise<Membership | null> {
    const { data, error } = await this.client
      .from("memberships")
      .select(membershipSelect)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfSupabaseError(error);
    return data ? mapMembershipRow(data as unknown as MembershipRow) : null;
  }
}

export function makeSupabaseMembershipRepository(
  client: SupabaseAdapterClient,
): MembershipRepository {
  return new SupabaseMembershipRepository(client);
}
