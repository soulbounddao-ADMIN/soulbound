import { Alert, Platform } from "react-native";
import type { ApiClient } from "../api/client";
import { createReport } from "../api/endpoints";
import type { ReportReason } from "../api/types";
import {
  REPORT_DETAIL_MAX_LENGTH,
  reportReasons,
  reportResultMessage,
  toReportRequest,
  type ReportTarget,
} from "../lib/safety";

async function submitReport(
  api: ApiClient,
  target: ReportTarget,
  reason: ReportReason,
  detail?: string,
): Promise<void> {
  let status = 0;
  try {
    status = (await createReport(api, toReportRequest(target, reason, detail))).status;
  } catch {
    status = 0;
  }
  Alert.alert("신고", reportResultMessage(status));
}

function askDetail(api: ApiClient, target: ReportTarget, reason: ReportReason): void {
  if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
    Alert.prompt(
      "추가 설명 (선택)",
      `운영진에게 전달할 내용을 적어 주세요. 최대 ${REPORT_DETAIL_MAX_LENGTH}자.`,
      [
        { text: "취소", style: "cancel" },
        { text: "신고", style: "destructive", onPress: (text?: string) => void submitReport(api, target, reason, text) },
      ],
      "plain-text",
    );
    return;
  }
  void submitReport(api, target, reason);
}

export function reportContent(api: ApiClient, target: ReportTarget): void {
  Alert.alert("신고 사유", "해당하는 사유를 선택해 주세요.", [
    ...reportReasons.map((reason) => ({
      text: reason.label,
      onPress: () => askDetail(api, target, reason.value),
    })),
    { text: "취소", style: "cancel" as const },
  ]);
}

export function openSafetyMenu(options: {
  readonly api: ApiClient;
  readonly target: ReportTarget;
  readonly memberNumber: number;
  readonly memberLabel: string;
  readonly blocked: boolean;
  readonly onToggleBlock: () => void;
}): void {
  Alert.alert(options.memberLabel, undefined, [
    { text: "신고하기", onPress: () => reportContent(options.api, options.target) },
    {
      text: options.blocked ? "차단 해제" : "차단하기",
      style: options.blocked ? "default" : "destructive",
      onPress: options.onToggleBlock,
    },
    { text: "취소", style: "cancel" },
  ]);
}
