"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { UnauthenticatedError, useAuth } from "../../../lib/auth-provider";
import { readJson } from "../../../lib/api-response";
import {
  AppBar,
  Badge,
  Button,
  Card,
  EmptyState,
} from "../../../components/ui";

type ReportStatus = "open" | "resolved" | "dismissed";

interface ReviewReport {
  readonly id: string;
  readonly targetType: "board_post" | "board_comment" | "member";
  readonly targetId: string;
  readonly reason: string;
  readonly detail: string | null;
  readonly status: ReportStatus;
  readonly resolutionCode: string | null;
  readonly createdAt: string;
  readonly subjectLabel: string | null;
  readonly targetExcerpt: string | null;
}

const targetLabel: Record<ReviewReport["targetType"], string> = {
  board_post: "게시글",
  board_comment: "댓글",
  member: "멤버",
};

const reasonLabel: Record<string, string> = {
  spam: "스팸·광고",
  harassment: "괴롭힘",
  hate: "혐오 표현",
  sexual: "성적인 내용",
  violence: "폭력·위협",
  illegal: "불법 정보",
  impersonation: "사칭",
  privacy: "개인정보 노출",
  other: "기타",
};

const decisions = [
  { status: "resolved", code: "content_removed", label: "조치: 콘텐츠 삭제" },
  { status: "resolved", code: "warning_issued", label: "조치: 경고" },
  { status: "resolved", code: "member_sanctioned", label: "조치: 제재" },
  { status: "dismissed", code: "no_violation", label: "기각: 위반 없음" },
  { status: "dismissed", code: "duplicate_report", label: "기각: 중복" },
  { status: "dismissed", code: "insufficient_information", label: "기각: 정보 부족" },
] as const;

const statusFilters: readonly { value: ReportStatus | "all"; label: string }[] = [
  { value: "open", label: "접수됨" },
  { value: "resolved", label: "조치됨" },
  { value: "dismissed", label: "기각됨" },
  { value: "all", label: "전체" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ReportQueuePage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [status, setStatus] = useState<ReportStatus | "all">("open");
  const [reports, setReports] = useState<readonly ReviewReport[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (nextStatus: ReportStatus | "all") => {
    setErrorMessage("");
    setPermissionDenied(false);
    try {
      const response = await authedFetch(
        `/api/admin/reports?status=${nextStatus}&limit=50`,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        setReports([]);
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load reports");
      }
      const body = await readJson<{ items: readonly ReviewReport[] }>(response);
      setReports(body.items);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setErrorMessage("신고 목록을 불러오지 못했습니다.");
      }
    }
  }, [authedFetch, router]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }
    void load(status);
  }, [load, loading, router, session, status]);

  async function decide(
    report: ReviewReport,
    decision: (typeof decisions)[number],
  ) {
    setBusyId(report.id);
    setErrorMessage("");
    try {
      const response = await authedFetch(
        `/api/admin/reports/${report.id}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: decision.status,
            resolutionCode: decision.code,
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Unable to resolve report");
      }
      await load(status);
    } catch {
      setErrorMessage("신고를 처리하지 못했습니다.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="page-main">
      <AppBar
        title="신고 처리"
        description="멤버가 접수한 게시글·댓글·멤버 신고를 확인하고 처리합니다. 처리 결과는 감사 로그에 사유 코드로 남습니다."
      />
      <Card aria-label="신고 상태 필터">
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            tone={filter.value === status ? "primary" : "secondary"}
            onClick={() => {
              setReports(null);
              setStatus(filter.value);
            }}
          >
            {filter.label}
          </Button>
        ))}
      </Card>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {permissionDenied ? (
        <EmptyState title="검토자 권한이 필요합니다.">
          reviewer 또는 admin 계정으로 로그인해 주세요.
        </EmptyState>
      ) : null}
      {reports === null ? <p>불러오는 중</p> : null}
      {reports && reports.length === 0 && !permissionDenied ? (
        <EmptyState title="표시할 신고가 없습니다.">
          선택한 상태의 신고가 없습니다.
        </EmptyState>
      ) : null}
      {reports?.map((report) => (
        <Card key={report.id} aria-label={`신고 ${report.id}`}>
          <p>
            <Badge tone={report.status === "open" ? "brand" : "muted"}>
              {statusFilters.find((item) => item.value === report.status)?.label}
            </Badge>{" "}
            {targetLabel[report.targetType]} · {reasonLabel[report.reason] ?? report.reason}
            {" · "}
            {formatDate(report.createdAt)}
          </p>
          <p>대상: {report.subjectLabel ?? "삭제된 계정"}</p>
          {report.targetExcerpt ? <blockquote>{report.targetExcerpt}</blockquote> : null}
          {report.detail ? <p>신고 설명: {report.detail}</p> : null}
          {report.resolutionCode ? <p>처리 코드: {report.resolutionCode}</p> : null}
          {report.status === "open" ? (
            <div>
              {decisions.map((decision) => (
                <Button
                  key={decision.code}
                  tone={decision.status === "resolved" ? "danger" : "secondary"}
                  disabled={busyId === report.id}
                  onClick={() => void decide(report, decision)}
                >
                  {decision.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
    </main>
  );
}
