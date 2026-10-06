import React, { useCallback, useEffect, useState } from "react";
import { listMembers } from "../../src/api/endpoints";
import type { MemberDirectoryItem, MemberDirectoryResponse } from "../../src/api/types";
import { useAuth } from "../../src/auth/auth-provider";
import { formatDate } from "../../src/domain/format";
import { useBlocks } from "../../src/lib/block-store";
import { useSessionGuard } from "../../src/lib/use-session-guard";
import { MemberGate } from "../../src/screens/member-gate";
import { openSafetyMenu } from "../../src/screens/safety-actions";
import { useActiveMembership } from "../../src/screens/use-active-membership";
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  ListRow,
  Loading,
  Message,
  Row,
  Screen,
  SectionTitle,
} from "../../src/ui/components";

export default function MemberHomeScreen() {
  const { api } = useAuth();
  const guard = useSessionGuard();
  const { isBlocked, toggle } = useBlocks();
  const { state, reload } = useActiveMembership();
  const [directory, setDirectory] = useState<MemberDirectoryResponse | null>(null);
  const [items, setItems] = useState<readonly MemberDirectoryItem[]>([]);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const loadDirectory = useCallback(async (cursor: number | null) => {
    setError("");
    if (cursor !== null) {
      setLoadingMore(true);
    }
    try {
      const result = await listMembers(api, cursor);
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("directory");
      }
      const page = result.data;
      setDirectory(page);
      setItems((current) => (cursor === null ? page.items : [...current, ...page.items]));
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("멤버 명부를 불러오지 못했습니다.");
      }
    } finally {
      setLoadingMore(false);
    }
  }, [api, guard]);

  useEffect(() => {
    if (state.kind === "active") {
      void loadDirectory(null);
    }
  }, [loadDirectory, state.kind]);

  const refresh = () => {
    void reload();
  };

  if (state.kind !== "active") {
    return (
      <Screen edges={["left", "right"]}>
        <MemberGate state={state} onRetry={refresh} />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right"]} refreshing={false} onRefresh={refresh}>
      <Row>
        <Badge label="입장 완료" tone="success" />
      </Row>
      <Card>
        <SectionTitle>내 멤버 번호</SectionTitle>
        <Body>{directory?.myLabel ?? "멤버 번호를 불러오는 중입니다."}</Body>
        <Body muted>멤버끼리는 이 번호로만 보입니다.</Body>
        <Body muted>{`복구 가능한 개인 식별 정보를 보관하지 않습니다. · 입장일 ${formatDate(state.membership.issuedAt)}`}</Body>
      </Card>
      <Card>
        <SectionTitle>멤버 명부</SectionTitle>
        <Body muted>입장한 멤버의 익명 번호 목록</Body>
        {error ? (
          <>
            <Message text={error} />
            <Button label="다시 시도" tone="secondary" onPress={() => void loadDirectory(null)} />
          </>
        ) : null}
        {!directory && !error ? <Loading label="멤버 명부를 불러오는 중입니다." /> : null}
        {directory && items.length === 0 ? <EmptyState>아직 표시할 멤버가 없습니다.</EmptyState> : null}
        {items.map((member) => (
          <ListRow
            key={member.memberNumber}
            title={member.label}
            description={`익명 멤버 · 입장일 ${formatDate(member.createdAt)}`}
            accessibilityHint={member.isMe ? undefined : "신고 또는 차단 메뉴를 엽니다"}
            onPress={member.isMe ? undefined : () => openSafetyMenu({
              api,
              target: { kind: "member", id: String(member.memberNumber), memberLabel: member.label },
              memberNumber: member.memberNumber,
              memberLabel: member.label,
              blocked: isBlocked(member.memberNumber),
              onToggleBlock: () => void toggle(member.memberNumber),
            })}
            trailing={member.isMe
              ? <Badge label="나" tone="success" />
              : isBlocked(member.memberNumber) ? <Badge label="차단됨" /> : null}
          />
        ))}
        {directory?.nextCursor ? (
          <Button
            label={loadingMore ? "불러오는 중" : "더 보기"}
            tone="secondary"
            disabled={loadingMore}
            onPress={() => void loadDirectory(directory.nextCursor)}
          />
        ) : null}
      </Card>
    </Screen>
  );
}
