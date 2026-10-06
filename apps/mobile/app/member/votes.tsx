import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { listVotes } from "../../src/api/endpoints";
import type { AdmissionVoteSummary } from "../../src/api/types";
import { useAuth } from "../../src/auth/auth-provider";
import { formatCandidateToken, formatDate, isClosingSoon } from "../../src/domain/format";
import { useSessionGuard } from "../../src/lib/use-session-guard";
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
} from "../../src/ui/components";

export default function VotesScreen() {
  const router = useRouter();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const [items, setItems] = useState<readonly AdmissionVoteSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (cursor: string | null) => {
    setError("");
    if (cursor) {
      setLoadingMore(true);
    }
    try {
      const result = await listVotes(api, cursor);
      if (await guard(result.status)) {
        return;
      }
      if (result.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("votes");
      }
      const page = result.data;
      setItems((current) => (cursor && current ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("입장 투표를 불러오지 못했습니다.");
      }
    } finally {
      setLoadingMore(false);
    }
  }, [api, guard, router]);

  useFocusEffect(useCallback(() => {
    void load(null);
  }, [load]));

  return (
    <Screen edges={["left", "right"]} refreshing={false} onRefresh={() => void load(null)}>
      <Body muted>멤버가 새 입장을 비밀투표로 결정합니다.</Body>
      {error ? (
        <>
          <Message text={error} />
          <Button label="다시 시도" tone="secondary" onPress={() => void load(null)} />
        </>
      ) : null}
      {items === null && !error ? <Loading label="입장 투표를 불러오는 중입니다." /> : null}
      {items && items.length === 0 ? <EmptyState>열린 입장 투표가 없습니다.</EmptyState> : null}
      {items && items.length > 0 ? (
        <Card>
          {items.map((vote) => (
            <ListRow
              key={vote.id}
              title={`${formatCandidateToken(vote.candidateToken)} · 마감 ${formatDate(vote.windowEndsAt)}`}
              description={vote.applicantStatement ?? "신청 자료는 결정 후 삭제됩니다."}
              onPress={() => router.push({ pathname: "/vote/[voteId]", params: { voteId: vote.id } })}
              trailing={(
                <Row>
                  {isClosingSoon(vote.windowEndsAt) ? <Badge label="마감 임박" /> : null}
                  {vote.hasVoted ? <Badge label="투표 완료" tone="success" /> : null}
                </Row>
              )}
            />
          ))}
        </Card>
      ) : null}
      {nextCursor ? (
        <Button
          label={loadingMore ? "불러오는 중" : "더 보기"}
          tone="secondary"
          disabled={loadingMore}
          onPress={() => void load(nextCursor)}
        />
      ) : null}
    </Screen>
  );
}
