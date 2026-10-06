// Response shapes mirrored from apps/web/app/api/** (board-types.ts,
// vote-types.ts, members/route.ts). Kept local so no server code is imported.
export interface MemberDirectoryItem {
  readonly memberNumber: number;
  readonly label: string;
  readonly createdAt: string;
  readonly isMe: boolean;
}

export interface MemberDirectoryResponse {
  readonly myMemberNumber: number | null;
  readonly myLabel: string | null;
  readonly items: readonly MemberDirectoryItem[];
  readonly nextCursor: number | null;
}

export interface BoardAuthor {
  readonly memberNumber: number;
  readonly label: string;
  readonly isMe: boolean;
}

export interface BoardPost {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: BoardAuthor;
}

export interface BoardComment {
  readonly id: string;
  readonly postId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: BoardAuthor;
}

export interface BoardPostDetail {
  readonly post: BoardPost;
  readonly comments: readonly BoardComment[];
}

export interface BoardListResponse {
  readonly items: readonly BoardPost[];
  readonly nextCursor: string | null;
}

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

export interface VoteListResponse {
  readonly items: readonly AdmissionVoteSummary[];
  readonly nextCursor: string | null;
}

export type ReportTargetType = "board_post" | "board_comment" | "member";
export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "sexual"
  | "violence"
  | "illegal"
  | "impersonation"
  | "privacy"
  | "other";

export interface CreateReportRequest {
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly detail?: string;
}

export interface ReportReceipt {
  readonly id: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly status: "open" | "resolved" | "dismissed";
  readonly createdAt: string;
}

export interface BlockedMember {
  readonly memberNumber: number;
  readonly label: string;
  readonly createdAt: string;
}

export interface BlockListResponse {
  readonly items: readonly BlockedMember[];
}

export interface AccountDeletionResponse {
  readonly deleted: true;
  readonly personaClipsRemoved: number;
}
