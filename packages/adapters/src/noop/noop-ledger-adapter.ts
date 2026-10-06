import type {
  ChainReceipt,
  IssueActivationStakeInput,
  IssueAdmissionTicketInput,
  IssueMembershipCredentialInput,
  LedgerPort,
} from "@soulbound/core";

const skippedReceipt: ChainReceipt = {
  chain: "none",
  status: "skipped",
};

export class NoopLedgerAdapter implements LedgerPort {
  async issueAdmissionTicket(
    _input: IssueAdmissionTicketInput,
  ): Promise<ChainReceipt> {
    return skippedReceipt;
  }

  async issueMembershipCredential(
    _input: IssueMembershipCredentialInput,
  ): Promise<ChainReceipt> {
    return skippedReceipt;
  }

  async issueActivationStake(
    _input: IssueActivationStakeInput,
  ): Promise<ChainReceipt> {
    return skippedReceipt;
  }
}

export function makeNoopLedgerAdapter(): LedgerPort {
  return new NoopLedgerAdapter();
}
