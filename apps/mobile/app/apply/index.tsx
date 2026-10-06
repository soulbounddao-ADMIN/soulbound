import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { submitApplication } from "../../src/api/endpoints";
import { useAuth } from "../../src/auth/auth-provider";
import {
  NETWORK_ERROR_MESSAGE,
  STATEMENT_MAX_LENGTH,
  submitErrorMessage,
} from "../../src/domain/admission";
import { rememberApplicationId } from "../../src/lib/application-memory";
import { createIdempotencyKey } from "../../src/lib/idempotency";
import { useSessionGuard } from "../../src/lib/use-session-guard";
import { Body, Button, Card, Field, Heading, Message, Screen } from "../../src/ui/components";

export default function ApplyScreen() {
  const router = useRouter();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMessage("");
    idempotencyKeyRef.current ??= createIdempotencyKey();
    const applicantStatement = statement.trim();
    try {
      const result = await submitApplication(api, {
        idempotencyKey: idempotencyKeyRef.current,
        ...(applicantStatement ? { applicantStatement } : {}),
      });
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok || !result.data) {
        setErrorMessage(submitErrorMessage(result.status));
        return;
      }
      rememberApplicationId(result.data.id);
      idempotencyKeyRef.current = null;
      router.replace("/apply/status");
    } catch (error) {
      if (!(await guard(error))) {
        setErrorMessage(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={["bottom", "left", "right"]}>
      <Heading
        title="입장 신청"
        description="제출 정보는 심사 동안만 보관하고, 승인 또는 거부 즉시 파기합니다. Persona Clip은 선택 사항입니다."
      />
      <Field
        label="자기소개"
        hint="한두 문장이면 충분합니다. 최대 1,200자."
        value={statement}
        onChangeText={setStatement}
        multiline
        maxLength={STATEMENT_MAX_LENGTH}
      />
      <Card>
        <Body muted>
          Persona Clip 녹화는 iPhone 앱에서 아직 제공하지 않습니다. Persona Clip 없이도 신청할 수 있습니다.
        </Body>
      </Card>
      <Message text={errorMessage} />
      <Button
        label={submitting ? "제출 중" : "입장 신청"}
        onPress={() => void handleSubmit()}
        disabled={submitting}
      />
    </Screen>
  );
}
