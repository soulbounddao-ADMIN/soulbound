import type { AdmissionApplication } from "@soulbound/core";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getApplication, getMyApplication, resubmitApplication } from "../../src/api/endpoints";
import { useAuth } from "../../src/auth/auth-provider";
import {
  applicantStatusLabel,
  NETWORK_ERROR_MESSAGE,
  STATEMENT_MAX_LENGTH,
  statusNextStep,
  submitErrorMessage,
} from "../../src/domain/admission";
import { readRememberedApplicationId } from "../../src/lib/application-memory";
import { createIdempotencyKey } from "../../src/lib/idempotency";
import { useSessionGuard } from "../../src/lib/use-session-guard";
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Message,
  Screen,
  SectionTitle,
} from "../../src/ui/components";

export default function ApplicationStatusScreen() {
  const router = useRouter();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const [application, setApplication] = useState<AdmissionApplication | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState("");
  const [resubmitError, setResubmitError] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [statement, setStatement] = useState("");
  const resubmitKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setErrorMessage("");
    setResubmitError("");
    setApplication(undefined);
    try {
      const active = await getMyApplication(api);
      if (await guard(active.status)) {
        return;
      }
      if (!active.ok) {
        throw new Error("application");
      }
      let next = active.data;
      if (!next) {
        const rememberedId = readRememberedApplicationId();
        if (rememberedId) {
          const detail = await getApplication(api, rememberedId);
          if (await guard(detail.status)) {
            return;
          }
          if (detail.ok) {
            next = detail.data;
          }
        }
      }
      setApplication(next ?? null);
    } catch (error) {
      if (!(await guard(error))) {
        setErrorMessage("신청 현황을 불러오지 못했습니다.");
      }
    }
  }, [api, guard]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResubmit() {
    if (!application || application.status !== "needs_more_info") {
      return;
    }
    resubmitKeyRef.current ??= createIdempotencyKey();
    const applicantStatement = statement.trim();
    setResubmitting(true);
    setResubmitError("");
    try {
      const result = await resubmitApplication(api, application.id, {
        idempotencyKey: resubmitKeyRef.current,
        ...(applicantStatement ? { applicantStatement } : {}),
      });
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok) {
        if (result.status === 409) {
          resubmitKeyRef.current = null;
          await load();
          return;
        }
        setResubmitError(submitErrorMessage(result.status));
        return;
      }
      resubmitKeyRef.current = null;
      setStatement("");
      await load();
    } catch (error) {
      if (!(await guard(error))) {
        setResubmitError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setResubmitting(false);
    }
  }

  const next = application ? statusNextStep(application) : null;

  return (
    <Screen edges={["bottom", "left", "right"]} refreshing={false} onRefresh={() => void load()}>
      {errorMessage ? (
        <>
          <Message text={errorMessage} />
          <Button label="다시 시도" tone="secondary" onPress={() => void load()} />
        </>
      ) : null}
      {application === undefined && !errorMessage ? <Loading label="신청 현황을 확인하는 중입니다." /> : null}
      {application === null ? (
        <>
          <EmptyState title="진행 중인 신청이 없습니다">새 입장 신청을 시작할 수 있습니다.</EmptyState>
          <Button label="입장 신청" onPress={() => router.replace("/apply")} />
        </>
      ) : null}
      {application && next ? (
        <Card>
          <Badge label={applicantStatusLabel(application.status)} tone="accent" />
          <Body>{next.body}</Body>
          {application.applicantNotice ? (
            <>
              <SectionTitle>검토자 안내</SectionTitle>
              <Body>{application.applicantNotice}</Body>
            </>
          ) : null}
          {next.href && next.label ? (
            <Button
              label={next.label}
              onPress={() => (next.href ? router.replace(next.href) : undefined)}
            />
          ) : null}
        </Card>
      ) : null}
      {application?.status === "needs_more_info" ? (
        <Card>
          <Field
            label="보완 내용"
            hint="요청된 정보를 적어 주세요. 최대 1,200자."
            value={statement}
            onChangeText={setStatement}
            multiline
            maxLength={STATEMENT_MAX_LENGTH}
            editable={!resubmitting}
          />
          <Message text={resubmitError} />
          <Button
            label={resubmitting ? "제출 중" : "보완 제출"}
            onPress={() => void handleResubmit()}
            disabled={resubmitting}
          />
        </Card>
      ) : null}
      <Button label="설정" tone="quiet" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
