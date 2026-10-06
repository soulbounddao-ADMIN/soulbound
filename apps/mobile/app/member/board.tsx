import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { createBoardPost, listBoardPosts } from "../../src/api/endpoints";
import type { BoardPost } from "../../src/api/types";
import { useAuth } from "../../src/auth/auth-provider";
import { formatDateTime } from "../../src/domain/format";
import { useBlocks } from "../../src/lib/block-store";
import { filterBlocked } from "../../src/lib/safety";
import { useSessionGuard } from "../../src/lib/use-session-guard";
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  Field,
  ListRow,
  Loading,
  Message,
  Screen,
  SectionTitle,
} from "../../src/ui/components";

const POST_MAX_LENGTH = 2000;

export default function BoardScreen() {
  const router = useRouter();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const { blocked } = useBlocks();
  const [items, setItems] = useState<readonly BoardPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async (cursor: string | null) => {
    setError("");
    if (cursor) {
      setLoadingMore(true);
    }
    try {
      const result = await listBoardPosts(api, cursor);
      if (await guard(result.status)) {
        return;
      }
      if (result.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("board");
      }
      const page = result.data;
      setItems((current) => (cursor && current ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("게시글을 불러오지 못했습니다.");
      }
    } finally {
      setLoadingMore(false);
    }
  }, [api, guard, router]);

  useFocusEffect(useCallback(() => {
    void load(null);
  }, [load]));

  async function submitPost() {
    const body = draft.trim();
    if (!body) {
      return;
    }
    setPosting(true);
    setActionError("");
    try {
      const result = await createBoardPost(api, body);
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("post");
      }
      const created = result.data;
      setDraft("");
      setItems((current) => [created, ...(current ?? [])]);
    } catch (caught) {
      if (!(await guard(caught))) {
        setActionError("게시글을 올리지 못했습니다.");
      }
    } finally {
      setPosting(false);
    }
  }

  const visible = items ? filterBlocked(items, blocked) : null;

  return (
    <Screen edges={["left", "right"]} refreshing={false} onRefresh={() => void load(null)}>
      <Body muted>멤버 번호만 보이는 공용 게시판</Body>
      <Card>
        <Field
          label="게시글 내용"
          placeholder="멤버들에게 남길 말을 적어 주세요."
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={POST_MAX_LENGTH}
          editable={!posting}
        />
        <Message text={actionError} />
        <Button
          label={posting ? "올리는 중" : "올리기"}
          onPress={() => void submitPost()}
          disabled={posting || !draft.trim()}
        />
      </Card>
      <SectionTitle>글 목록</SectionTitle>
      {error ? (
        <>
          <Message text={error} />
          <Button label="다시 시도" tone="secondary" onPress={() => void load(null)} />
        </>
      ) : null}
      {visible === null && !error ? <Loading label="게시글을 불러오는 중입니다." /> : null}
      {visible && visible.length === 0 ? <EmptyState>아직 게시글이 없습니다.</EmptyState> : null}
      {visible && visible.length > 0 ? (
        <Card>
          {visible.map((post) => (
            <ListRow
              key={post.id}
              title={post.body}
              description={`${post.author.label} · ${formatDateTime(post.createdAt)}`}
              onPress={() => router.push({ pathname: "/board/[postId]", params: { postId: post.id } })}
              trailing={post.author.isMe ? <Badge label="나" tone="success" /> : null}
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
