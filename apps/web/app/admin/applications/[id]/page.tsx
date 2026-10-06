"use client";

import type {
  AdmissionApplication,
  AdmissionReasonCode,
  AdmissionStatus,
} from "@soulbound/core";
import { useParams, useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../../lib/auth-provider";
import { readJson } from "../../../../lib/api-response";
import {
  AppBar,
  Badge,
  Button,
  EmptyState,
  Field,
  LinkButton,
  Section,
} from "../../../../components/ui";
import styles from "../admin.module.css";

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

const reasonLabel: Record<AdmissionReasonCode, string> = {
  meets_phase1_policy: "입장 정책 충족",
  insufficient_context: "판단 정보 부족",
  mismatch_with_policy: "입장 정책과 불일치",
  needs_identity_clarification: "신원 확인 필요",
  duplicate_identity_suspected: "중복 신원 의심",
  applicant_withdrew: "신청자 철회",
  application_expired: "신청 만료",
};

type AdminApplication = Omit<AdmissionApplication, "status"> & {
  readonly status: AdmissionStatus | "in_vote";
  readonly applicantUsername?: string | null;
  readonly reviewerUsername?: string | null;
};

const decisionConfigs = [
  {
    action: "approve",
    title: "승인",
    submitLabel: "승인 확정",
    options: ["meets_phase1_policy"],
    tone: "primary",
  },
  {
    action: "reject",
    title: "거절",
    submitLabel: "거절 확정",
    options: [
      "mismatch_with_policy",
      "insufficient_context",
      "duplicate_identity_suspected",
    ],
    tone: "danger",
  },
  {
    action: "request-more-info",
    title: "추가 정보 요청",
    submitLabel: "요청 보내기",
    options: [
      "needs_identity_clarification",
      "insufficient_context",
    ],
    tone: "secondary",
  },
] as const satisfies readonly {
  readonly action: "approve" | "reject" | "request-more-info";
  readonly title: string;
  readonly submitLabel: string;
  readonly options: readonly AdmissionReasonCode[];
  readonly tone: "primary" | "secondary" | "danger";
}[];

type DecisionAction =
  typeof decisionConfigs[number]["action"];

function getDecisionConfig(action: DecisionAction) {
  return decisionConfigs.find((config) => config.action === action)
    ?? decisionConfigs[0];
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

function optionalFormText(form: FormData, name: string): string | undefined {
  const value = String(form.get(name) ?? "").trim();
  return value || undefined;
}

interface DecisionPanelProps {
  readonly busy: boolean;
  readonly onSubmit: (
    action: DecisionAction,
    input: {
      readonly reasonCode: AdmissionReasonCode;
      readonly applicantNotice?: string;
      readonly reviewSummary?: string;
    },
  ) => Promise<void>;
}

function DecisionPanel({
  busy,
  onSubmit,
}: DecisionPanelProps) {
  const [selectedAction, setSelectedAction] =
    useState<DecisionAction>("approve");
  const selectedConfig = getDecisionConfig(selectedAction);
  const [reasonCode, setReasonCode] =
    useState<AdmissionReasonCode>(selectedConfig.options[0]);

  function selectAction(action: DecisionAction) {
    const config = getDecisionConfig(action);
    setSelectedAction(action);
    setReasonCode(config.options[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const applicantNotice = optionalFormText(form, "applicantNotice");
    const reviewSummary = optionalFormText(form, "reviewSummary");
    await onSubmit(selectedAction, {
      reasonCode,
      ...(applicantNotice ? { applicantNotice } : {}),
      ...(reviewSummary ? { reviewSummary } : {}),
    });
  }

  return (
    <form
      className={styles.decisionPanel}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <fieldset className={styles.decisionSelector}>
        <legend>결정</legend>
        <div className={styles.decisionOptions}>
          {decisionConfigs.map((config) => (
            <label key={config.action}>
              <input
                type="radio"
                name="decisionAction"
                value={config.action}
                checked={selectedAction === config.action}
                onChange={() => selectAction(config.action)}
              />
              <span>{config.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="사유 코드" htmlFor="decision-reason">
        <select
          id="decision-reason"
          name="reasonCode"
          value={reasonCode}
          onChange={(event) =>
            setReasonCode(event.target.value as AdmissionReasonCode)
          }
        >
          {selectedConfig.options.map((option) => (
            <option key={option} value={option}>
              {reasonLabel[option]}
            </option>
          ))}
        </select>
      </Field>

      <div className={styles.noteGrid}>
        <div className={styles.applicantNoticeField}>
          <Field
            label="신청자 안내"
            hint="신청자에게 보여집니다."
            htmlFor="decision-applicant-notice"
          >
            <textarea
              id="decision-applicant-notice"
              name="applicantNotice"
            />
          </Field>
        </div>
        <div className={styles.internalNoticeField}>
          <Field
            label="검토자 내부 메모"
            hint="내부 전용 · 신청자 비공개"
            htmlFor="decision-review-summary"
          >
            <textarea
              id="decision-review-summary"
              name="reviewSummary"
            />
          </Field>
        </div>
      </div>

      <Button
        tone={selectedConfig.tone}
        type="submit"
        disabled={busy}
      >
        {busy ? "처리 중" : selectedConfig.submitLabel}
      </Button>
    </form>
  );
}

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [application, setApplication] =
    useState<AdminApplication | null | undefined>(undefined);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingOverride, setPendingOverride] =
    useState<"approved" | "rejected" | null>(null);

  const loadApplication = useCallback(async (signal?: AbortSignal) => {
    setErrorMessage("");
    try {
      const response = await authedFetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}`,
        signal ? { signal } : undefined,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        setApplication(null);
        return;
      }
      if (response.status === 404) {
        setApplication(null);
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load application");
      }

      setPermissionDenied(false);
      setApplication(await readJson<AdminApplication>(response));
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setErrorMessage("신청 상세를 불러오지 못했습니다.");
      }
    }
  }, [applicationId, authedFetch, router]);

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

  async function runAction(
    action: "review" | DecisionAction | "vote/open" | "vote/finalize" | "vote/override",
    body: Record<string, unknown>,
  ) {
    setBusyAction(action);
    setActionMessage("");
    setPendingOverride(null);
    try {
      const response = await authedFetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            ...body,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        return;
      }
      if (response.status === 409) {
        setActionMessage(
          "신청 상태가 이미 변경되었습니다. 최신 상태를 다시 불러왔습니다.",
        );
        await loadApplication();
        return;
      }
      if (!response.ok) {
        setActionMessage("요청을 처리하지 못했습니다.");
        return;
      }

      setActionMessage("변경사항을 반영했습니다.");
      setClipUrl(null);
      await loadApplication();
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setActionMessage("요청을 처리하지 못했습니다.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function loadClip() {
    setBusyAction("clip");
    setActionMessage("");
    try {
      const response = await authedFetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}/persona-clip-url`,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        return;
      }
      if (response.status === 404) {
        setActionMessage("재생할 Persona Clip을 찾을 수 없습니다.");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load clip URL");
      }

      const payload = await readJson<{ readonly url: string }>(response);
      setClipUrl(payload.url);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setActionMessage("Persona Clip을 불러오지 못했습니다.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  function confirmOverride(decision: "approved" | "rejected") {
    if (pendingOverride !== decision) {
      setPendingOverride(decision);
      setActionMessage(
        decision === "approved"
          ? "승인 재정의를 실행하시겠습니까? 다시 누르면 실행합니다."
          : "거절 재정의를 실행하시겠습니까? 다시 누르면 실행합니다.",
      );
      return;
    }

    void runAction("vote/override", { decision });
  }

  if (permissionDenied) {
    return (
      <main className="page-main narrow-main">
        <div className={styles.permissionState} role="alert">
          <EmptyState title="권한이 없습니다">
            검토자 또는 관리자 계정으로 접근해 주세요.
          </EmptyState>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <AppBar
        title="신청 상세"
        description={`신청 ${shortId(applicationId)}`}
        action={(
          <LinkButton tone="secondary" href="/admin/applications">
            대기열로 돌아가기
          </LinkButton>
        )}
      />

      {errorMessage ? (
        <div className="status-action-state" role="alert">
          <EmptyState>{errorMessage}</EmptyState>
          <Button
            tone="secondary"
            type="button"
            onClick={() => void loadApplication()}
          >
            다시 시도
          </Button>
        </div>
      ) : null}

      {application === undefined && !errorMessage ? (
        <EmptyState>신청 상세를 불러오는 중입니다.</EmptyState>
      ) : null}

      {application === null && !errorMessage ? (
        <EmptyState title="신청을 찾을 수 없습니다">
          대기열에서 다시 선택해 주세요.
        </EmptyState>
      ) : null}

      {application ? (
        <div className={styles.detailGrid}>
          <Section
            className={styles.dossierSection}
            title="심사 자료"
            description="심사에 필요한 신청 자료만 먼저 확인합니다."
          >
            <dl className={styles.detailList}>
              <div>
                <dt>상태</dt>
                <dd>
                  <Badge tone="brand">
                    {applicationStatusLabel(application.status)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>신청자 아이디</dt>
                <dd>{application.applicantUsername ?? "기록 없음"}</dd>
              </div>
              <div>
                <dt>신청자 ID</dt>
                <dd>{application.applicantId}</dd>
              </div>
              <div>
                <dt>한 문장 소개</dt>
                <dd>{application.applicantStatement ?? "입력 없음"}</dd>
              </div>
            </dl>

            {application.personaClipAssetId ? (
              <div className={styles.clipBlock}>
                <Button
                  tone="secondary"
                  type="button"
                  disabled={busyAction === "clip"}
                  onClick={() => void loadClip()}
                >
                  {busyAction === "clip" ? "불러오는 중" : "클립 재생"}
                </Button>
                {clipUrl ? (
                  <video
                    className={styles.clipVideo}
                    controls
                    src={clipUrl}
                    aria-label="Persona Clip 재생"
                  />
                ) : null}
              </div>
            ) : null}
          </Section>

          <div className={styles.sideColumn}>
            <Section
              className={styles.detailSection}
              title="검토 정보"
              description="심사 진행과 내부 기록입니다."
            >
              <dl className={styles.detailList}>
                <div>
                  <dt>검토자 ID</dt>
                  <dd>{application.reviewerId ?? "미배정"}</dd>
                </div>
                {application.reviewerId ? (
                  <div>
                    <dt>검토자 아이디</dt>
                    <dd>{application.reviewerUsername ?? "기록 없음"}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>검토 시각</dt>
                  <dd>
                    {application.reviewedAt
                      ? formatDate(application.reviewedAt)
                      : "미검토"}
                  </dd>
                </div>
                <div>
                  <dt>정책 버전</dt>
                  <dd>{application.policyVersion}</dd>
                </div>
                <div>
                  <dt>생성 시각</dt>
                  <dd>{formatDate(application.createdAt)}</dd>
                </div>
                <div>
                  <dt>갱신 시각</dt>
                  <dd>{formatDate(application.updatedAt)}</dd>
                </div>
              </dl>
            </Section>

            <Section
              className={styles.detailSection}
              title="결정 기록"
              description="신청자 노출 안내와 내부 전용 메모를 분리해 표시합니다."
            >
              <dl className={styles.detailList}>
              <div>
                <dt>신청자 안내</dt>
                <dd>{application.applicantNotice ?? "입력 없음"}</dd>
              </div>
              <div className={styles.internalNote}>
                <dt>검토자 내부 메모</dt>
                <dd>{application.reviewSummary ?? "입력 없음"}</dd>
              </div>
            </dl>
            </Section>

          {actionMessage ? (
            <p className={styles.actionMessage} role="status">
              {actionMessage}
            </p>
          ) : null}

          {application.status === "submitted" ? (
            <Section
              className={styles.actionSection}
              title="검토 시작"
              description="제출된 신청을 검토 중 상태로 전환합니다."
            >
              <Button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void runAction("review", {})}
              >
                {busyAction === "review" ? "처리 중" : "검토 시작"}
              </Button>
            </Section>
          ) : null}

          {application.status === "under_review" ? (
            <Section
              className={styles.actionSection}
              title="멤버 투표"
              description="활동 멤버에게 신청 자료를 열고 비밀투표를 시작합니다."
            >
              <Button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  void runAction("vote/open", {
                    windowHours: 72,
                  })}
              >
                {busyAction === "vote/open" ? "여는 중" : "투표 열기"}
              </Button>
            </Section>
          ) : null}

          {application.status === "in_vote" ? (
            <Section
              className={styles.actionSection}
              title="투표 확정"
              description="멤버 투표 결과로 확정합니다. 운영자만 재정의할 수 있습니다."
            >
              <div className={styles.actionRow}>
                <Button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void runAction("vote/finalize", {})}
                >
                  {busyAction === "vote/finalize" ? "확정 중" : "투표 결과 확정"}
                </Button>
                <Button
                  type="button"
                  tone="secondary"
                  disabled={busyAction !== null}
                  onClick={() => confirmOverride("approved")}
                >
                  {pendingOverride === "approved" ? "다시 눌러 승인 재정의" : "승인 재정의"}
                </Button>
                <Button
                  type="button"
                  tone="danger"
                  disabled={busyAction !== null}
                  onClick={() => confirmOverride("rejected")}
                >
                  {pendingOverride === "rejected" ? "다시 눌러 거절 재정의" : "거절 재정의"}
                </Button>
              </div>
            </Section>
          ) : null}

          {application.status === "under_review" ? (
            <Section
              className={styles.actionSection}
              title="검토 결정"
              description="멤버 투표를 열지 않고 검토자가 직접 결정할 때 사용합니다."
            >
              <DecisionPanel
                busy={busyAction !== null}
                onSubmit={async (action, input) => {
                  await runAction(action, input);
                }}
              />
            </Section>
          ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
