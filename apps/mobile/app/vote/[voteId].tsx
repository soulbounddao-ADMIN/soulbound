import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { castVote, getVote } from "../../src/api/endpoints";
import type { AdmissionVoteDetail, VoteChoice } from "../../src/api/types";
import { useAuth } from "../../src/auth/auth-provider";
import { formatCandidateToken, formatDate, voteOutcomeLabel } from "../../src/domain/format";
import { useSessionGuard } from "../../src/lib/use-session-guard";
import {
  Badge,
  Body,
  Button,
  Card,
  Loading,
  Message,
  Row,
  Screen,
  SectionTitle,
} from "../../src/ui/components";

export default function VoteDetailScreen() {
  const router = useRouter();
  const { voteId } = useLocalSearchParams<{ voteId: string }>();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const [vote, setVote] = useState<AdmissionVoteDetail | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState<VoteChoice | null>(null);

  const load = useCallback(async () => {
    if (!voteId) {
      return;
    }
    setError("");
    try {
      const result = await getVote(api, voteId);
      if (await guard(result.status)) {
        return;
      }
      if (result.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("vote");
      }
      setVote(result.data);
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("입장 투표 상세를 불러오지 못했습니다.");
      }
    }
  }, [api, guard, router, voteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cast(choice: VoteChoice) {
    if (!vote || vote.hasVoted || vote.status !== "open") {
      return;
    }
    setSubmitting(choice);
    setError("");
    setSuccess("");
    try {
      const result = await castVote(api, vote.id, choice);
      if (await guard(result.status)) {
        return;
      }
      if (result.status === 403) {
        router.replace("/gate");
        return;
      }
      if (result.status === 409) {
        setError("이미 이 투표에 참여했습니다.");
        await load();
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("cast");
      }
      setVote(result.data);
      setSuccess("투표가 접수되었습니다. 선택은 공개되지 않습니다.");
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("투표를 반영하지 못했습니다.");
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Screen edges={["bottom", "left", "right"]} refreshing={false} onRefresh={() => void load()}>
      <Message text={error} />
      <Message text={success} tone="success" />
      {!vote && !error ? <Loading label="투표 상세를 여는 중입니다." /> : null}
      {vote ? (
        <Card>
          <Row>
            <SectionTitle>{formatCandidateToken(vote.candidateToken)}</SectionTitle>
            {vote.hasVoted ? <Badge label="투표 완료" tone="success" /> : <Badge label="비밀투표" />}
          </Row>
          <Body muted>{`마감 ${formatDate(vote.windowEndsAt)}`}</Body>
          <Body>{vote.applicantStatement ?? "결정된 신청 자료는 삭제되었습니다."}</Body>
          {vote.hasClip ? (
            <Body muted>Persona Clip은 웹에서 확인할 수 있습니다.</Body>
          ) : null}
          {vote.status === "open" ? (
            <Row>
              <Button
                label={submitting === "yes" ? "반영 중" : "찬성"}
                disabled={vote.hasVoted || submitting !== null}
                onPress={() => void cast("yes")}
              />
              <Button
                label={submitting === "no" ? "반영 중" : "반대"}
                tone="secondary"
                disabled={vote.hasVoted || submitting !== null}
                onPress={() => void cast("no")}
              />
            </Row>
          ) : (
            <Body muted>
              {`결과: 찬성 ${vote.yesCount} · 반대 ${vote.noCount}${
                voteOutcomeLabel(vote.outcome) ? ` · ${voteOutcomeLabel(vote.outcome)}` : ""}`}
            </Body>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
