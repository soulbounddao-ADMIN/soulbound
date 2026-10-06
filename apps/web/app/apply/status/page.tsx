"use client";

import type {
  AdmissionApplication,
  AdmissionStatus,
} from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "../../../components/ui";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../lib/auth-provider";
import { readRememberedApplicationId } from "../../../lib/application-state";
import { readJson, submitErrorMessage } from "../../../lib/api-response";

const statusLabel: Record<AdmissionStatus, string> = {
  draft: "작성 중",
  submitted: "제출됨",
  under_review: "검토 중",
  needs_more_info: "추가 정보 필요",
  approved: "승인됨",
  rejected: "거부됨",
  withdrawn: "철회됨",
  expired: "만료됨",
};

type ApplicantApplicationView = AdmissionApplication;

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

function applicantStatusLabel(status: string): string {
  if (status === "in_vote") {
    return "검토 중";
  }

  return statusLabel[status as AdmissionStatus] ?? "검토 중";
}

function statusNextStep(application: ApplicantApplicationView) {
  if (application.status === "approved") {
    return {
      body: "입장이 승인되었습니다.",
      href: "/gate",
      label: "입장 절차 보기",
    };
  }

  if (
    application.status === "rejected"
    || application.status === "expired"
    || application.status === "withdrawn"
  ) {
    const body = application.status === "rejected"
      ? "이번 신청은 거부되었습니다."
      : application.status === "expired"
        ? "이번 신청은 만료되었습니다."
        : "이번 신청은 철회되었습니다.";
    return {
      body,
      href: "/apply",
      label: "새로 신청하기",
    };
  }

  if (application.status === "needs_more_info") {
    return {
      body: application.applicantNotice
        ? "검토자 안내를 확인하고 요청된 정보를 준비해 주세요."
        : "추가 정보가 필요합니다. 검토자의 안내를 기다려 주세요.",
      href: null,
      label: null,
    };
  }

  return {
    body: "검토가 끝나면 이 화면에서 결과를 안내합니다.",
    href: null,
    label: null,
  };
}

export default function ApplicationStatusPage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [application, setApplication] =
    useState<ApplicantApplicationView | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState("");
  const [resubmitErrorMessage, setResubmitErrorMessage] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const resubmitIdempotencyKeyRef = useRef<string | null>(null);

  const loadApplication = useCallback(async (signal?: AbortSignal) => {
    setErrorMessage("");
    setResubmitErrorMessage("");
    setApplication(undefined);
    try {
      const activeResponse = await authedFetch(
        "/api/admission/applications/me",
        signal ? { signal } : undefined,
      );
      if (activeResponse.status === 401) {
        router.replace("/login");
        return;
      }
      if (!activeResponse.ok) {
        throw new Error("Unable to load application");
      }

      let nextApplication =
        await readJson<ApplicantApplicationView | null>(activeResponse);
      if (!nextApplication) {
        const rememberedId = readRememberedApplicationId();
        if (rememberedId) {
          const detailResponse = await authedFetch(
            `/api/admission/applications/${encodeURIComponent(rememberedId)}`,
            signal ? { signal } : undefined,
          );
          if (detailResponse.status === 401) {
            router.replace("/login");
            return;
          }
          if (detailResponse.ok) {
            nextApplication =
              await readJson<ApplicantApplicationView>(detailResponse);
          }
        }
      }
      setApplication(nextApplication);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setErrorMessage("신청 현황을 불러오지 못했습니다.");
      }
    }
  }, [authedFetch, router]);

  const handleResubmit = useCallback(async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!application || application.status !== "needs_more_info") {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const applicantStatement =
      String(formData.get("applicantStatement") ?? "").trim();

    resubmitIdempotencyKeyRef.current ??= createIdempotencyKey();

    setResubmitting(true);
    setResubmitErrorMessage("");
    try {
      const response = await authedFetch(
        `/api/admission/applications/${encodeURIComponent(application.id)}/resubmit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: resubmitIdempotencyKeyRef.current,
            ...(applicantStatement ? { applicantStatement } : {}),
          }),
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        if (response.status === 409) {
          resubmitIdempotencyKeyRef.current = null;
          await loadApplication();
          return;
        }

        setResubmitErrorMessage(submitErrorMessage(response.status));
        return;
      }

      resubmitIdempotencyKeyRef.current = null;
      await loadApplication();
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setResubmitErrorMessage(
          "서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      setResubmitting(false);
    }
  }, [application, authedFetch, loadApplication, router]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    void loadApplication(controller.signal);
    return () => controller.abort();
  }, [loadApplication, loading, router, session]);
  const nextStep = application ? statusNextStep(application) : null;

  return (
    <main className="page-main narrow-main">
      <header className="page-heading">
        <h1>내 신청 현황</h1>
      </header>

      {errorMessage ? (
        <div className="status-action-state" role="alert">
          <EmptyState>{errorMessage}</EmptyState>
          <button
            className="button-secondary"
            type="button"
            onClick={() => void loadApplication()}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      <section className="status-panel" aria-live="polite">
        {application === undefined && !errorMessage ? (
          <EmptyState>신청 현황을 확인하는 중입니다.</EmptyState>
        ) : null}

        {application === null ? (
          <div className="status-content-state">
            <EmptyState title="진행 중인 신청이 없습니다">
              새 입장 신청을 시작할 수 있습니다.
            </EmptyState>
            <Link className="button" href="/apply">입장 신청</Link>
          </div>
        ) : null}

        {application ? (
          <>
            <span className="status-badge">
              {applicantStatusLabel(application.status)}
            </span>
            <p>{nextStep?.body}</p>
            {application.applicantNotice ? (
              <dl className="status-details">
                <div>
                  <dt>검토자 안내</dt>
                  <dd className="prose-text">{application.applicantNotice}</dd>
                </div>
              </dl>
            ) : null}
            {nextStep?.href && nextStep.label ? (
              <Link className="button" href={nextStep.href}>
                {nextStep.label}
              </Link>
            ) : null}
            {application.status === "needs_more_info" ? (
              <form
                className="status-resubmit-form form-grid"
                onSubmit={handleResubmit}
              >
                <div className="field">
                  <label htmlFor="resubmit-statement">보완 내용</label>
                  <p className="field-hint">
                    요청된 정보를 적어 주세요. 최대 1,200자.
                  </p>
                  <textarea
                    id="resubmit-statement"
                    name="applicantStatement"
                    maxLength={1200}
                    disabled={resubmitting}
                  />
                </div>
                {resubmitErrorMessage ? (
                  <p className="form-message" role="alert">
                    {resubmitErrorMessage}
                  </p>
                ) : null}
                <div className="button-row">
                  <button
                    className="button"
                    type="submit"
                    disabled={resubmitting}
                  >
                    {resubmitting ? "제출 중" : "보완 제출"}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
