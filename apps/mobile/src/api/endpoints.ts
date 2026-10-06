import type { AdmissionApplication, Membership } from "@soulbound/core";
import type { ApiClient, ApiResult } from "./client";
import type {
  AccountDeletionResponse,
  AdmissionVoteDetail,
  BlockedMember,
  BlockListResponse,
  BoardComment,
  BoardListResponse,
  BoardPost,
  BoardPostDetail,
  CreateReportRequest,
  MemberDirectoryResponse,
  ReportReceipt,
  VoteChoice,
  VoteListResponse,
} from "./types";

const id = encodeURIComponent;

export function getMyApplication(api: ApiClient): Promise<ApiResult<AdmissionApplication | null>> {
  return api.request("/api/admission/applications/me");
}

export function getApplication(api: ApiClient, applicationId: string): Promise<ApiResult<AdmissionApplication>> {
  return api.request(`/api/admission/applications/${id(applicationId)}`);
}

export function submitApplication(
  api: ApiClient,
  body: { readonly idempotencyKey: string; readonly applicantStatement?: string },
): Promise<ApiResult<AdmissionApplication>> {
  return api.request("/api/admission/applications", { method: "POST", body });
}

export function resubmitApplication(
  api: ApiClient,
  applicationId: string,
  body: { readonly idempotencyKey: string; readonly applicantStatement?: string },
): Promise<ApiResult<AdmissionApplication>> {
  return api.request(`/api/admission/applications/${id(applicationId)}/resubmit`, {
    method: "POST",
    body,
  });
}

export function getMyMembership(api: ApiClient): Promise<ApiResult<Membership | null>> {
  return api.request("/api/membership/me");
}

export function listMembers(api: ApiClient, cursor: number | null): Promise<ApiResult<MemberDirectoryResponse>> {
  return api.request("/api/members", { query: { limit: 50, cursor } });
}

export function listBoardPosts(api: ApiClient, cursor: string | null): Promise<ApiResult<BoardListResponse>> {
  return api.request("/api/board", { query: { limit: 20, cursor } });
}

export function createBoardPost(api: ApiClient, body: string): Promise<ApiResult<BoardPost>> {
  return api.request("/api/board", { method: "POST", body: { body } });
}

export function getBoardPost(api: ApiClient, postId: string): Promise<ApiResult<BoardPostDetail>> {
  return api.request(`/api/board/${id(postId)}`);
}

export function deleteBoardPost(api: ApiClient, postId: string): Promise<ApiResult<unknown>> {
  return api.request(`/api/board/${id(postId)}`, { method: "DELETE" });
}

export function addBoardComment(api: ApiClient, postId: string, body: string): Promise<ApiResult<BoardComment>> {
  return api.request(`/api/board/${id(postId)}/comments`, { method: "POST", body: { body } });
}

export function deleteBoardComment(api: ApiClient, postId: string, commentId: string): Promise<ApiResult<unknown>> {
  return api.request(`/api/board/${id(postId)}/comments/${id(commentId)}`, { method: "DELETE" });
}

export function listVotes(api: ApiClient, cursor: string | null): Promise<ApiResult<VoteListResponse>> {
  return api.request("/api/vote/applications", { query: { limit: 20, cursor } });
}

export function getVote(api: ApiClient, voteId: string): Promise<ApiResult<AdmissionVoteDetail>> {
  return api.request(`/api/vote/applications/${id(voteId)}`);
}

export function castVote(api: ApiClient, voteId: string, choice: VoteChoice): Promise<ApiResult<AdmissionVoteDetail>> {
  return api.request(`/api/vote/applications/${id(voteId)}/cast`, {
    method: "POST",
    body: { choice },
  });
}

export const ACCOUNT_DELETION_CONFIRMATION = "DELETE_MY_ACCOUNT";

export function deleteAccount(api: ApiClient): Promise<ApiResult<AccountDeletionResponse>> {
  return api.request("/api/account", {
    method: "DELETE",
    body: { confirm: ACCOUNT_DELETION_CONFIRMATION },
  });
}

export function createReport(api: ApiClient, body: CreateReportRequest): Promise<ApiResult<ReportReceipt>> {
  return api.request("/api/reports", { method: "POST", body });
}

export function listMyBlocks(api: ApiClient): Promise<ApiResult<BlockListResponse>> {
  return api.request("/api/blocks");
}

export function blockMember(api: ApiClient, memberNumber: number): Promise<ApiResult<BlockedMember>> {
  return api.request("/api/blocks", { method: "POST", body: { memberNumber } });
}

export function unblockMember(api: ApiClient, memberNumber: number): Promise<ApiResult<{ readonly unblocked: boolean }>> {
  return api.request(`/api/blocks/${id(String(memberNumber))}`, { method: "DELETE" });
}
