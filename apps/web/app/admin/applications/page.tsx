"use client";

import type {
  AdmissionApplication,
  AdmissionStatus,
} from "@soulbound/core";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../lib/auth-provider";
import { readJson } from "../../../lib/api-response";
import {
  AppBar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LinkButton,
} from "../../../components/ui";
import styles from "./admin.module.css";

const QUEUE_LIMIT = 50;

interface AdminQueueApplication extends AdmissionApplication {
  readonly applicantUsername?: string | null;
}

const statusOptions: readonly {
  readonly value: AdmissionStatus | "all";
  readonly label: string;
}[] = [
  { value: "submitted", label: "제출됨" },
  { value: "under_review", label: "검토 중" },
  { value: "needs_more_info", label: "추가 정보 필요" },
  { value: "approved", label: "승인됨" },
  { value: "rejected", label: "거절됨" },
  { value: "draft", label: "작성 중" },
  { value: "withdrawn", label: "철회됨" },
  { value: "expired", label: "만료됨" },
  { value: "all", label: "전체" },
];

const quickStatusOptions: readonly {
  readonly value: AdmissionStatus | "all";
  readonly label: string;
}[] = [
  { value: "submitted", label: "제출됨" },
  { value: "under_review", label: "검토 중" },
  { value: "needs_more_info", label: "추가 정보 필요" },
  { value: "all", label: "전체" },
];

const statusLabel: Record<AdmissionStatus, string> = {
  draft: "작성 중",
  submitted: "제출됨",
  under_review: "검토 중",
  needs_more_info: "추가 정보 필요",
  approved: "승인됨",
  rejected: "거절됨",
  withdrawn: "철회됨",
  expired: "만료됨",
};

function applicationStatusLabel(status: string): string {
  if (status === "in_vote") {
    return "멤버 투표 중";
  }

  return statusLabel[status as AdmissionStatus] ?? "검토 중";
}

function statusTone(status: string): "brand" | "success" | "muted" | "danger" {
  if (status === "approved") {
    return "success";
  }
  if (status === "rejected" || status === "expired" || status === "withdrawn") {
    return "danger";
  }
  if (status === "submitted" || status === "under_review" || status === "in_vote") {
    return "brand";
  }
  return "muted";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortId(value: string): string {
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
}

function applicantLabel(application: AdminQueueApplication): string {
  return application.applicantUsername ?? shortId(application.applicantId);
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [status, setStatus] = useState<AdmissionStatus | "all">("submitted");
  const [applications, setApplications] =
    useState<readonly AdminQueueApplication[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  const loadQueue = useCallback(async (
    nextStatus: AdmissionStatus | "all",
    signal?: AbortSignal,
  ) => {
    setErrorMessage("");
    setPermissionDenied(false);
    const params = new URLSearchParams({ limit: "50" });
    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    try {
      const response = await authedFetch(
        `/api/admin/applications?${params.toString()}`,
        signal ? { signal } : undefined,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        setApplications([]);
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load review queue");
      }

      setApplications(
        await readJson<readonly AdminQueueApplication[]>(response),
      );
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setErrorMessage("검토 대기열을 불러오지 못했습니다.");
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
    const controller = new AbortController();
    void loadQueue(status, controller.signal);
    return () => controller.abort();
  }, [loadQueue, loading, router, session, status]);

  async function copyApplicantId(value: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setCopiedId(value);
    }
  }

  function selectStatus(nextStatus: AdmissionStatus | "all") {
    if (nextStatus === status) {
      return;
    }
    setApplications(null);
    setStatus(nextStatus);
  }

  const selectedStatusLabel = status === "all"
    ? "전체"
    : applicationStatusLabel(status);
  const countLabel = applications === null
    ? "불러오는 중"
    : `${selectedStatusLabel} ${applications.length}${applications.length >= QUEUE_LIMIT ? "+" : ""}건`;

  return (
    <main className="page-main">
      <AppBar
        title="입장 신청 검토"
        description="상태별 신청을 확인하고 상세 검토로 이동합니다."
      />

      <Card className={styles.toolbar} aria-label="검토 대기열 필터">
        <Field label="신청 상태" htmlFor="queue-status">
          <select
            className={styles.selectInput}
            id="queue-status"
            value={status}
            onChange={(event) =>
              selectStatus(event.target.value as AdmissionStatus | "all")
            }
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className={styles.quickFilters} aria-label="빠른 상태 필터">
          {quickStatusOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              tone={status === option.value ? "primary" : "secondary"}
              className={styles.filterChip}
              onClick={() => selectStatus(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className={styles.queueCount}>{countLabel}</p>
      </Card>

      {permissionDenied ? (
        <section className={styles.permissionState} role="alert">
          <h2>권한이 없습니다</h2>
          <p>검토자 또는 관리자 계정으로 접근해 주세요.</p>
        </section>
      ) : null}

      {errorMessage ? (
        <div className="status-action-state" role="alert">
          <EmptyState>{errorMessage}</EmptyState>
          <Button
            tone="secondary"
            type="button"
            onClick={() => void loadQueue(status)}
          >
            다시 시도
          </Button>
        </div>
      ) : null}

      {!permissionDenied && applications?.length === 0 ? (
        <EmptyState title="해당 상태의 신청이 없습니다">
          다른 상태를 선택해 대기열을 확인해 주세요.
        </EmptyState>
      ) : null}

      {!permissionDenied && applications && applications.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>신청자</th>
                <th>상태</th>
                <th>제출 시각</th>
                <th>Persona Clip</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td className={styles.idCell}>
                    <span title={application.applicantId}>
                      {applicantLabel(application)}
                    </span>
                    <button
                      className={styles.copyButton}
                      type="button"
                      aria-label={`신청자 ID ${shortId(application.applicantId)} 복사`}
                      onClick={() => void copyApplicantId(application.applicantId)}
                    >
                      {copiedId === application.applicantId ? "복사됨" : "복사"}
                    </button>
                  </td>
                  <td>
                    <Badge tone={statusTone(application.status)}>
                      {applicationStatusLabel(application.status)}
                    </Badge>
                  </td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td>
                    {application.personaClipAssetId ? (
                      <span className={styles.clipMarker}>클립 있음</span>
                    ) : "없음"}
                  </td>
                  <td>
                    <LinkButton
                      className={styles.rowLinkButton}
                      tone="secondary"
                      href={`/admin/applications/${application.id}`}
                    >
                      상세
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
