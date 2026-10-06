import type { SupabaseAdapterClient } from "@soulbound/adapters";

import type {
  AdmissionVoteDetail,
  AdmissionVoteRepository,
  AdmissionVoteSummary,
  VoteChoice,
  VoteListInput,
  VoteListResult,
  VoteOutcome,
  VoteStatus,
} from "./vote-types";

interface VoteListRow {
  readonly id: string;
  readonly candidate_token: string;
  readonly applicant_statement: string | null;
  readonly has_clip: boolean;
  readonly window_ends_at: string;
  readonly opened_at: string;
  readonly has_voted: boolean;
}

interface VoteDetailRow extends VoteListRow {
  readonly status: VoteStatus;
  readonly outcome: VoteOutcome | null;
  readonly yes_count: number;
  readonly no_count: number;
  readonly turnout_count: number;
}

interface VoteCursor {
  readonly openedAt: string;
  readonly id: string;
}

interface OpenVoteRow {
  readonly id: string;
}

interface AdminVoteRow {
  readonly id: string;
  readonly status: VoteStatus;
  readonly outcome: VoteOutcome | null;
  readonly yes_count: number;
  readonly no_count: number;
  readonly turnout_count: number;
  readonly window_ends_at: string;
  readonly opened_at: string;
  readonly admission_applications?: {
    readonly applicant_statement?: string | null;
    readonly persona_clip_asset_id?: string | null;
  } | null;
}

export class VoteRepositoryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function throwIfError(error: { readonly code?: string; readonly message?: string } | null): void {
  if (!error) {
    return;
  }

  if (error.code === "23505") {
    throw new VoteRepositoryError(409, "CONFLICT", error.message ?? "conflict");
  }
  if (error.code === "42501") {
    throw new VoteRepositoryError(403, "FORBIDDEN", error.message ?? "forbidden");
  }
  if (error.code === "P0001") {
    throw new VoteRepositoryError(
      409,
      "INVALID_STATE_TRANSITION",
      error.message ?? "invalid state",
    );
  }
  if (error.code === "P0002") {
    throw new VoteRepositoryError(404, "NOT_FOUND", error.message ?? "not found");
  }

  throw error;
}

function encodeCursor(cursor: VoteCursor): string {
  return `${encodeURIComponent(cursor.openedAt)}_${cursor.id}`;
}

function decodeCursor(value: string | null): VoteCursor | null {
  if (!value) {
    return null;
  }

  const separator = value.lastIndexOf("_");
  if (separator <= 0 || separator >= value.length - 1) {
    throw new VoteRepositoryError(422, "VALIDATION", "invalid vote cursor");
  }

  return {
    openedAt: decodeURIComponent(value.slice(0, separator)),
    id: value.slice(separator + 1),
  };
}

function mapSummary(row: VoteListRow): AdmissionVoteSummary {
  return {
    id: row.id,
    candidateToken: row.candidate_token,
    applicantStatement: row.applicant_statement,
    hasClip: row.has_clip,
    windowEndsAt: row.window_ends_at,
    openedAt: row.opened_at,
    hasVoted: row.has_voted,
  };
}

function mapDetail(row: VoteDetailRow): AdmissionVoteDetail {
  return {
    ...mapSummary(row),
    status: row.status,
    outcome: row.outcome,
    yesCount: row.yes_count,
    noCount: row.no_count,
    turnoutCount: row.turnout_count,
  };
}

export class SupabaseVoteRepository implements AdmissionVoteRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  private async getVoteForAdmin(voteId: string): Promise<AdmissionVoteDetail | null> {
    const { data, error } = await this.client
      .from("admission_votes")
      .select(
        "id,status,outcome,yes_count,no_count,turnout_count,window_ends_at,opened_at,admission_applications(applicant_statement,persona_clip_asset_id)",
      )
      .eq("id", voteId)
      .maybeSingle();
    throwIfError(error);
    if (!data) {
      return null;
    }

    const row = data as unknown as AdminVoteRow;
    const application = row.admission_applications ?? null;
    return {
      id: row.id,
      candidateToken: `candidate-${row.id.slice(0, 8)}`,
      applicantStatement: application?.applicant_statement ?? null,
      hasClip: Boolean(application?.persona_clip_asset_id),
      windowEndsAt: row.window_ends_at,
      openedAt: row.opened_at,
      hasVoted: false,
      status: row.status,
      outcome: row.outcome,
      yesCount: row.yes_count,
      noCount: row.no_count,
      turnoutCount: row.turnout_count,
    };
  }

  async listOpenVotes(input: VoteListInput): Promise<VoteListResult> {
    const cursor = decodeCursor(input.cursor);
    const { data, error } = await this.client.rpc("list_open_admission_votes", {
      p_limit: input.limit + 1,
      p_cursor_opened_at: cursor?.openedAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    });
    throwIfError(error);

    const rows = (data ?? []) as unknown as VoteListRow[];
    const pageRows = rows.slice(0, input.limit);
    const lastRow = pageRows[pageRows.length - 1];
    return {
      items: pageRows.map(mapSummary),
      nextCursor: rows.length > input.limit && lastRow
        ? encodeCursor({ openedAt: lastRow.opened_at, id: lastRow.id })
        : null,
    };
  }

  async getVote(voteId: string): Promise<AdmissionVoteDetail | null> {
    const { data, error } = await this.client
      .rpc("get_admission_vote", { p_vote_id: voteId })
      .maybeSingle();
    throwIfError(error);
    return data ? mapDetail(data as unknown as VoteDetailRow) : null;
  }

  async castVote(
    voteId: string,
    choice: VoteChoice,
  ): Promise<AdmissionVoteDetail | null> {
    const { error } = await this.client.rpc("cast_vote_tx", {
      p_vote_id: voteId,
      p_choice: choice,
    });
    throwIfError(error);
    return await this.getVote(voteId);
  }

  async openVote(input: {
    readonly applicationId: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly windowEndsAt: string;
  }): Promise<AdmissionVoteDetail | null> {
    const { data, error } = await this.client
      .rpc("open_vote_tx", {
        p_application_id: input.applicationId,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
        p_window_ends_at: input.windowEndsAt,
      })
      .single();
    throwIfError(error);
    const voteId = (data as unknown as OpenVoteRow).id;
    return await this.getVoteForAdmin(voteId);
  }

  async finalizeVote(input: {
    readonly voteId: string;
    readonly actorId: string;
    readonly idempotencyKey: string;
  }): Promise<AdmissionVoteDetail | null> {
    const { error } = await this.client.rpc("finalize_vote_tx", {
      p_vote_id: input.voteId,
      p_actor_id: input.actorId,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
    return await this.getVoteForAdmin(input.voteId);
  }

  async overrideVote(input: {
    readonly voteId: string;
    readonly actorId: string;
    readonly decision: VoteOutcome;
    readonly idempotencyKey: string;
  }): Promise<AdmissionVoteDetail | null> {
    const { error } = await this.client.rpc("override_vote_tx", {
      p_vote_id: input.voteId,
      p_actor_id: input.actorId,
      p_decision: input.decision,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
    return await this.getVoteForAdmin(input.voteId);
  }

  async findOpenVoteByApplicationId(applicationId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("admission_votes")
      .select("id")
      .eq("application_id", applicationId)
      .eq("status", "open")
      .maybeSingle();
    throwIfError(error);
    return ((data as { readonly id?: string } | null)?.id) ?? null;
  }
}
