import type { AdmissionApplication, Membership } from "@soulbound/core";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { getMyApplication, getMyMembership } from "../src/api/endpoints";
import { useAuth } from "../src/auth/auth-provider";
import { gateNextStep } from "../src/domain/admission";
import { rememberApplicationId } from "../src/lib/application-memory";
import { useSessionGuard } from "../src/lib/use-session-guard";
import {
  Badge,
  Body,
  Button,
  Card,
  Heading,
  Loading,
  Message,
  Row,
  Screen,
  SectionTitle,
} from "../src/ui/components";

interface GateState {
  readonly application: AdmissionApplication | null;
  readonly membership: Membership | null;
}

const steps = ["계정 만들기", "입장 신청", "멤버 입장"] as const;

export default function GateScreen() {
  const router = useRouter();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const [state, setState] = useState<GateState | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    setErrorMessage("");
    setState(null);
    try {
      const [application, membership] = await Promise.all([
        getMyApplication(api),
        getMyMembership(api),
      ]);
      if ((await guard(application.status)) || (await guard(membership.status))) {
        return;
      }
      if (!application.ok || !membership.ok) {
        throw new Error("gate");
      }
      if (application.data) {
        rememberApplicationId(application.data.id);
      }
      setState({ application: application.data, membership: membership.data });
    } catch (error) {
      if (!(await guard(error))) {
        setErrorMessage("입장 상태를 불러오지 못했습니다.");
      }
    }
  }, [api, guard]);

  useEffect(() => {
    void load();
  }, [load]);

  const next = state ? gateNextStep(state.application, state.membership) : null;

  return (
    <Screen edges={["bottom", "left", "right"]} refreshing={false} onRefresh={() => void load()}>
      <Heading title="입장 절차" description="지금 필요한 다음 단계를 안내합니다." />
      {errorMessage ? (
        <>
          <Message text={errorMessage} />
          <Button label="다시 시도" tone="secondary" onPress={() => void load()} />
        </>
      ) : null}
      {!state && !errorMessage ? <Loading label="현재 상태를 확인하는 중입니다." /> : null}
      {next ? (
        <Card>
          <SectionTitle>{next.title}</SectionTitle>
          <Body>{next.body}</Body>
          <Button
            label={next.label}
            onPress={() => (next.href === "/member" ? router.replace(next.href) : router.push(next.href))}
          />
        </Card>
      ) : null}
      <Card>
        <SectionTitle>절차</SectionTitle>
        {steps.map((step, index) => {
          const current = next?.currentStep === index + 1;
          return (
            <Row key={step}>
              <Body>{`${index + 1}. ${step}`}</Body>
              {current ? <Badge label="현재 단계" tone="accent" /> : null}
            </Row>
          );
        })}
      </Card>
      <Button label="설정" tone="quiet" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
