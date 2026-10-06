import { useRouter } from "expo-router";
import React from "react";
import { Body, Button, Card, Loading, Message, SectionTitle } from "../ui/components";
import type { MembershipState } from "./use-active-membership";

export function MemberGate({ state, onRetry }: { readonly state: MembershipState; readonly onRetry: () => void }) {
  const router = useRouter();
  if (state.kind === "loading") {
    return <Loading label="멤버십을 확인하는 중입니다" />;
  }
  if (state.kind === "error") {
    return (
      <>
        <Message text="멤버십을 확인하지 못했습니다." />
        <Button label="다시 시도" tone="secondary" onPress={onRetry} />
      </>
    );
  }
  return (
    <Card>
      <SectionTitle>멤버 전용 공간입니다</SectionTitle>
      <Body>입장이 확인되면 멤버 명부와 게시판을 사용할 수 있습니다.</Body>
      <Button label="입장 절차 보기" onPress={() => router.replace("/gate")} />
    </Card>
  );
}
