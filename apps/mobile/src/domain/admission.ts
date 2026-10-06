import type {
  AdmissionApplication,
  AdmissionStatus,
  Membership,
  UserRole,
} from "@soulbound/core";

export type AppRoute = "/member" | "/gate" | "/apply" | "/apply/status" | "/reviewer";

export function resolveHomeRoute(
  role: UserRole,
  membership: Pick<Membership, "status"> | null,
): AppRoute {
  if (role === "reviewer" || role === "admin") {
    return "/reviewer";
  }
  if (role === "member" || membership?.status === "active") {
    return "/member";
  }
  return "/gate";
}

export interface GateStep {
  readonly title: string;
  readonly body: string;
  readonly href: AppRoute;
  readonly label: string;
  readonly currentStep: 2 | 3;
}

export function gateNextStep(
  application: Pick<AdmissionApplication, "id"> | null,
  membership: Pick<Membership, "status"> | null,
): GateStep {
  if (membership?.status === "active") {
    return {
      title: "입장이 완료되었습니다",
      body: "멤버 공간으로 이동할 수 있습니다.",
      href: "/member",
      label: "멤버 공간으로",
      currentStep: 3,
    };
  }
  if (application) {
    return {
      title: "입장 대기",
      body: "신청 상태와 안내를 확인해 주세요.",
      href: "/apply/status",
      label: "신청 현황 보기",
      currentStep: 2,
    };
  }
  return {
    title: "입장 신청",
    body: "짧은 소개와 선택 항목을 제출합니다.",
    href: "/apply",
    label: "입장 신청",
    currentStep: 2,
  };
}

const statusLabels: Record<AdmissionStatus, string> = {
  draft: "작성 중",
  submitted: "제출됨",
  under_review: "검토 중",
  needs_more_info: "추가 정보 필요",
  approved: "승인됨",
  rejected: "거부됨",
  withdrawn: "철회됨",
  expired: "만료됨",
};

export function applicantStatusLabel(status: string): string {
  if (status === "in_vote") {
    return "검토 중";
  }
  return statusLabels[status as AdmissionStatus] ?? "검토 중";
}

export interface StatusNextStep {
  readonly body: string;
  readonly href: AppRoute | null;
  readonly label: string | null;
}

export function statusNextStep(
  application: Pick<AdmissionApplication, "status" | "applicantNotice">,
): StatusNextStep {
  switch (application.status) {
    case "approved":
      return { body: "입장이 승인되었습니다.", href: "/gate", label: "입장 절차 보기" };
    case "rejected":
      return { body: "이번 신청은 거부되었습니다.", href: "/apply", label: "새로 신청하기" };
    case "expired":
      return { body: "이번 신청은 만료되었습니다.", href: "/apply", label: "새로 신청하기" };
    case "withdrawn":
      return { body: "이번 신청은 철회되었습니다.", href: "/apply", label: "새로 신청하기" };
    case "needs_more_info":
      return {
        body: application.applicantNotice
          ? "검토자 안내를 확인하고 요청된 정보를 준비해 주세요."
          : "추가 정보가 필요합니다. 검토자의 안내를 기다려 주세요.",
        href: null,
        label: null,
      };
    default:
      return { body: "검토가 끝나면 이 화면에서 결과를 안내합니다.", href: null, label: null };
  }
}

export function submitErrorMessage(status: number): string {
  switch (status) {
    case 422:
      return "입력 내용을 확인해 주세요.";
    case 403:
      return "이 신청을 제출할 권한이 없습니다.";
    case 409:
      return "이미 진행 중인 신청이 있거나 상태가 변경되었습니다.";
    case 502:
      return "서비스 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export const NETWORK_ERROR_MESSAGE = "서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
export const STATEMENT_MAX_LENGTH = 1200;
