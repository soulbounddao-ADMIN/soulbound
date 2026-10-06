import { memberLabel } from "../../_lib/compliance-schemas";

export interface BlockRow {
  readonly memberNumber: number;
  readonly createdAt: string;
}

export interface BlockedMember extends BlockRow {
  readonly label: string;
}

export interface BlockRepository {
  block(memberNumber: number): Promise<BlockRow>;
  unblock(memberNumber: number): Promise<boolean>;
  listMine(): Promise<readonly BlockRow[]>;
}

function withLabel(row: BlockRow): BlockedMember {
  return { ...row, label: memberLabel(row.memberNumber) };
}

// Blocks are always scoped to auth.uid() inside the RPCs; the API surface is
// member-number only (no profile/user ids).
export class BlockService {
  constructor(private readonly repo: BlockRepository) {}

  async block(memberNumber: number): Promise<BlockedMember> {
    return withLabel(await this.repo.block(memberNumber));
  }

  async unblock(memberNumber: number): Promise<{ readonly unblocked: boolean }> {
    return { unblocked: await this.repo.unblock(memberNumber) };
  }

  async listMine(): Promise<{ readonly items: readonly BlockedMember[] }> {
    return { items: (await this.repo.listMine()).map(withLabel) };
  }
}
