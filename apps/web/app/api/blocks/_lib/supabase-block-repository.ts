import type { SupabaseAdapterClient } from "@soulbound/adapters";
import { notFound } from "@soulbound/core";
import { throwIfComplianceError } from "../../_lib/compliance-errors";
import {
  BlockService,
  type BlockRepository,
  type BlockRow,
} from "./block-service";

interface BlockRpcRow {
  readonly member_number: number | string;
  readonly created_at: string;
}

function mapRow(row: BlockRpcRow): BlockRow {
  return {
    memberNumber: typeof row.member_number === "number"
      ? row.member_number
      : Number.parseInt(row.member_number, 10),
    createdAt: row.created_at,
  };
}

export class SupabaseBlockRepository implements BlockRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async block(memberNumber: number): Promise<BlockRow> {
    const { data, error } = await this.client.rpc("block_member", {
      p_member_number: memberNumber,
    });
    throwIfComplianceError(error);
    const [row] = (data ?? []) as BlockRpcRow[];
    if (!row) {
      throw notFound("member not found");
    }
    return mapRow(row);
  }

  async unblock(memberNumber: number): Promise<boolean> {
    const { data, error } = await this.client.rpc("unblock_member", {
      p_member_number: memberNumber,
    });
    throwIfComplianceError(error);
    return data === true;
  }

  async listMine(): Promise<readonly BlockRow[]> {
    const { data, error } = await this.client.rpc("list_my_blocks");
    throwIfComplianceError(error);
    return ((data ?? []) as BlockRpcRow[]).map(mapRow);
  }
}

export function makeBlockService(client: SupabaseAdapterClient): BlockService {
  return new BlockService(new SupabaseBlockRepository(client));
}
