import type { SupabaseAdapterClient } from "./clients";
import { throwIfSupabaseError } from "./errors";

export interface MemberDirectoryEntry {
  readonly memberNumber: number;
  readonly label: string;
  readonly createdAt: string;
}

export interface ListActiveMembersInput {
  readonly limit: number;
  readonly cursor: number | null;
}

export interface ListActiveMembersResult {
  readonly items: readonly MemberDirectoryEntry[];
  readonly nextCursor: number | null;
}

interface MemberDirectoryRow {
  readonly member_number: number | string | null;
  readonly created_at: string;
}

interface MyMemberNumberRow {
  readonly member_number: number | string | null;
}

export const memberDirectorySelect = [
  "member_number",
  "created_at",
].join(",");

function toMemberNumber(value: number | string | null): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function memberLabel(memberNumber: number): string {
  return `soulbound-member-${memberNumber}`;
}

function mapMemberDirectoryRow(row: MemberDirectoryRow): MemberDirectoryEntry {
  const memberNumber = toMemberNumber(row.member_number);
  if (memberNumber === null) {
    throw new Error("member directory row requires member_number");
  }

  return {
    memberNumber,
    label: memberLabel(memberNumber),
    createdAt: row.created_at,
  };
}

export class SupabaseMemberDirectoryRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async getMyMemberNumber(userId: string): Promise<number | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("member_number")
      .eq("id", userId)
      .maybeSingle();

    throwIfSupabaseError(error);
    return toMemberNumber(
      (data as unknown as MyMemberNumberRow | null)?.member_number ?? null,
    );
  }

  async listActiveMembers(
    input: ListActiveMembersInput,
  ): Promise<ListActiveMembersResult> {
    let query = this.client
      .from("profiles")
      .select(memberDirectorySelect)
      .not("member_number", "is", null)
      .order("member_number", { ascending: true })
      .limit(input.limit + 1);

    if (input.cursor !== null) {
      query = query.gt("member_number", input.cursor);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);

    const rows = (data ?? []) as unknown as MemberDirectoryRow[];
    const page = rows.slice(0, input.limit).map(mapMemberDirectoryRow);
    const hasMore = rows.length > input.limit;

    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]?.memberNumber ?? null : null,
    };
  }
}

export function makeUserScopedMemberDirectoryRepository(
  client: SupabaseAdapterClient,
): SupabaseMemberDirectoryRepository {
  return new SupabaseMemberDirectoryRepository(client);
}
