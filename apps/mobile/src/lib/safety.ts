import type { CreateReportRequest, ReportReason, ReportTargetType } from "../api/types";

export type ReportTargetKind = "post" | "comment" | "member";

export interface ReportTarget {
  readonly kind: ReportTargetKind;
  readonly id: string;
  readonly memberLabel?: string;
}

const kindLabel: Record<ReportTargetKind, string> = {
  post: "게시글",
  comment: "댓글",
  member: "멤버",
};

export function buildReportLink(baseUrl: string, target: ReportTarget): string | null {
  const destination = baseUrl.trim();
  if (!destination) {
    return null;
  }
  const subject = `[SoulBound 신고] ${kindLabel[target.kind]}`;
  const lines = [
    `대상: ${kindLabel[target.kind]}`,
    `ID: ${target.id}`,
    ...(target.memberLabel ? [`작성자: ${target.memberLabel}`] : []),
    "",
    "신고 사유:",
  ];
  const body = lines.join("\n");

  if (destination.startsWith("mailto:")) {
    const separator = destination.includes("?") ? "&" : "?";
    return `${destination}${separator}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}type=${encodeURIComponent(target.kind)}&id=${encodeURIComponent(target.id)}`;
}

export function parseBlockedMembers(raw: string | null): readonly number[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...new Set(parsed.filter((value): value is number =>
      typeof value === "number" && Number.isInteger(value) && value > 0))];
  } catch {
    return [];
  }
}

export function toggleBlocked(list: readonly number[], memberNumber: number): readonly number[] {
  return list.includes(memberNumber)
    ? list.filter((value) => value !== memberNumber)
    : [...list, memberNumber];
}

export function filterBlocked<T extends { readonly author: { readonly memberNumber: number; readonly isMe: boolean } }>(
  items: readonly T[],
  blocked: readonly number[],
): readonly T[] {
  return items.filter((item) => item.author.isMe || !blocked.includes(item.author.memberNumber));
}

export const REPORT_DETAIL_MAX_LENGTH = 500;

export const reportReasons: readonly { readonly value: ReportReason; readonly label: string }[] = [
  { value: "spam", label: "스팸·광고" },
  { value: "harassment", label: "괴롭힘·따돌림" },
  { value: "hate", label: "혐오 표현" },
  { value: "sexual", label: "성적인 내용" },
  { value: "violence", label: "폭력·위협" },
  { value: "illegal", label: "불법 정보" },
  { value: "impersonation", label: "사칭" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "other", label: "기타" },
];

const apiTargetType: Record<ReportTargetKind, ReportTargetType> = {
  post: "board_post",
  comment: "board_comment",
  member: "member",
};

export function toReportRequest(
  target: ReportTarget,
  reason: ReportReason,
  detail?: string | null,
): CreateReportRequest {
  const trimmed = (detail ?? "").trim().slice(0, REPORT_DETAIL_MAX_LENGTH);
  return {
    targetType: apiTargetType[target.kind],
    targetId: target.id,
    reason,
    ...(trimmed ? { detail: trimmed } : {}),
  };
}

export function reportResultMessage(status: number): string {
  if (status === 201 || status === 200) {
    return "신고가 접수되었습니다. 운영진이 확인 후 조치합니다.";
  }
  if (status === 409) {
    return "이미 접수된 신고입니다. 운영진이 확인 중입니다.";
  }
  if (status === 429) {
    return "신고가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (status === 403) {
    return "활성 멤버만 신고할 수 있습니다.";
  }
  if (status === 404) {
    return "신고 대상을 찾을 수 없습니다.";
  }
  if (status === 422) {
    return "신고 내용을 확인해 주세요. 내 글이나 나 자신은 신고할 수 없습니다.";
  }
  return "신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
