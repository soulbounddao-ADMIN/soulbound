export type VoteChoice = "yes" | "no";
export type VoteOutcome = "approved" | "rejected";
export type VoteStatus = "open" | "closed" | "overridden";

export interface AdmissionVoteSummary {
  readonly id: string;
  readonly candidateToken: string;
  readonly applicantStatement: string | null;
  readonly hasClip: boolean;
  readonly windowEndsAt: string;
  readonly openedAt: string;
  readonly hasVoted: boolean;
}

export interface AdmissionVoteDetail extends AdmissionVoteSummary {
  readonly status: VoteStatus;
  readonly outcome: VoteOutcome | null;
  readonly yesCount: number;
  readonly noCount: number;
  readonly turnoutCount: number;
}

export interface VoteListInput {
  readonly limit: number;
  readonly cursor: string | null;
}

export interface VoteListResult {
  readonly items: readonly AdmissionVoteSummary[];
  readonly nextCursor: string | null;
}

export interface AdmissionVoteRepository {
  listOpenVotes(input: VoteListInput): Promise<VoteListResult>;
  getVote(voteId: string): Promise<AdmissionVoteDetail | null>;
  castVote(voteId: string, choice: VoteChoice): Promise<AdmissionVoteDetail | null>;
  openVote(input: {
    readonly applicationId: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly windowEndsAt: string;
  }): Promise<AdmissionVoteDetail | null>;
  finalizeVote(input: {
    readonly voteId: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<AdmissionVoteDetail | null>;
  overrideVote(input: {
    readonly voteId: string;
    readonly actorId: string;
    readonly decision: VoteOutcome;
    readonly idempotencyKey: string;
  }): Promise<AdmissionVoteDetail | null>;
  findOpenVoteByApplicationId(applicationId: string): Promise<string | null>;
}
