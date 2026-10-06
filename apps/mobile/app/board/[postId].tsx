import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import {
  addBoardComment,
  deleteBoardComment,
  deleteBoardPost,
  getBoardPost,
} from "../../src/api/endpoints";
import type { BoardAuthor, BoardComment, BoardPostDetail } from "../../src/api/types";
import { useAuth } from "../../src/auth/auth-provider";
import { formatDateTime } from "../../src/domain/format";
import { useBlocks } from "../../src/lib/block-store";
import { filterBlocked, type ReportTarget } from "../../src/lib/safety";
import { useSessionGuard } from "../../src/lib/use-session-guard";
import { openSafetyMenu } from "../../src/screens/safety-actions";
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Message,
  Row,
  Screen,
  SectionTitle,
} from "../../src/ui/components";

const COMMENT_MAX_LENGTH = 1200;

function confirmDelete(title: string, onConfirm: () => void) {
  Alert.alert(title, "삭제하면 되돌릴 수 없습니다.", [
    { text: "취소", style: "cancel" },
    { text: "삭제", style: "destructive", onPress: onConfirm },
  ]);
}

export default function BoardPostScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { api } = useAuth();
  const guard = useSessionGuard();
  const { blocked, isBlocked, toggle } = useBlocks();
  const [detail, setDetail] = useState<BoardPostDetail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!postId) {
      return;
    }
    setError("");
    try {
      const result = await getBoardPost(api, postId);
      if (await guard(result.status)) {
        return;
      }
      if (result.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("post");
      }
      setDetail(result.data);
    } catch (caught) {
      if (!(await guard(caught))) {
        setError("게시글 상세를 불러오지 못했습니다.");
      }
    }
  }, [api, guard, postId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function safetyMenu(author: BoardAuthor, target: ReportTarget) {
    openSafetyMenu({
      api,
      target,
      memberNumber: author.memberNumber,
      memberLabel: author.label,
      blocked: isBlocked(author.memberNumber),
      onToggleBlock: () => void toggle(author.memberNumber),
    });
  }

  async function removePost() {
    if (!detail) {
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const result = await deleteBoardPost(api, detail.post.id);
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok) {
        throw new Error("delete");
      }
      router.back();
    } catch (caught) {
      if (!(await guard(caught))) {
        setActionError("게시글을 삭제하지 못했습니다.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(target: BoardComment) {
    setBusy(true);
    setActionError("");
    try {
      const result = await deleteBoardComment(api, target.postId, target.id);
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok) {
        throw new Error("delete");
      }
      setDetail((current) => current
        ? { ...current, comments: current.comments.filter((item) => item.id !== target.id) }
        : current);
    } catch (caught) {
      if (!(await guard(caught))) {
        setActionError("댓글을 삭제하지 못했습니다.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    const body = comment.trim();
    if (!detail || !body) {
      return;
    }
    setCommenting(true);
    setActionError("");
    try {
      const result = await addBoardComment(api, detail.post.id, body);
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error("comment");
      }
      const created = result.data;
      setComment("");
      setDetail((current) => current ? { ...current, comments: [...current.comments, created] } : current);
    } catch (caught) {
      if (!(await guard(caught))) {
        setActionError("댓글을 올리지 못했습니다.");
      }
    } finally {
      setCommenting(false);
    }
  }

  if (error) {
    return (
      <Screen edges={["bottom", "left", "right"]}>
        <Message text={error} />
        <Button label="다시 시도" tone="secondary" onPress={() => void load()} />
      </Screen>
    );
  }
  if (!detail) {
    return (
      <Screen edges={["bottom", "left", "right"]}>
        <Loading label="게시글을 여는 중입니다." />
      </Screen>
    );
  }

  const { post } = detail;
  const postHidden = !post.author.isMe && isBlocked(post.author.memberNumber);
  const comments = filterBlocked(detail.comments, blocked);

  return (
    <Screen edges={["bottom", "left", "right"]} refreshing={false} onRefresh={() => void load()}>
      <Message text={actionError} />
      <Card>
        <Row>
          <Body muted>{`${post.author.label} · ${formatDateTime(post.createdAt)}`}</Body>
          {post.author.isMe ? <Badge label="나" tone="success" /> : null}
        </Row>
        {postHidden ? (
          <Body muted>차단한 멤버의 게시글입니다.</Body>
        ) : (
          <Body>{post.body}</Body>
        )}
        <Row>
          {post.author.isMe ? (
            <Button
              label="삭제"
              tone="danger"
              disabled={busy}
              onPress={() => confirmDelete("게시글 삭제", () => void removePost())}
            />
          ) : (
            <Button
              label="신고 · 차단"
              tone="quiet"
              onPress={() => safetyMenu(post.author, { kind: "post", id: post.id, memberLabel: post.author.label })}
            />
          )}
        </Row>
      </Card>

      <SectionTitle>댓글</SectionTitle>
      {comments.length === 0 ? <EmptyState>아직 댓글이 없습니다.</EmptyState> : null}
      {comments.map((item) => (
        <Card key={item.id}>
          <Row>
            <Body muted>{`${item.author.label} · ${formatDateTime(item.createdAt)}`}</Body>
            {item.author.isMe ? <Badge label="나" tone="success" /> : null}
          </Row>
          <Body>{item.body}</Body>
          <View style={{ alignItems: "flex-start" }}>
            {item.author.isMe ? (
              <Button
                label="삭제"
                tone="quiet"
                disabled={busy}
                onPress={() => confirmDelete("댓글 삭제", () => void removeComment(item))}
              />
            ) : (
              <Button
                label="신고 · 차단"
                tone="quiet"
                onPress={() => safetyMenu(item.author, { kind: "comment", id: item.id, memberLabel: item.author.label })}
              />
            )}
          </View>
        </Card>
      ))}

      <Card>
        <Field
          label="댓글 내용"
          placeholder="댓글을 적어 주세요."
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          editable={!commenting}
        />
        <Button
          label={commenting ? "올리는 중" : "댓글 달기"}
          onPress={() => void submitComment()}
          disabled={commenting || !comment.trim()}
        />
      </Card>
    </Screen>
  );
}
