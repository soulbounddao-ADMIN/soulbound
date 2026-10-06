"use client";

import type { Membership } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { InstallPrompt } from "../../components/pwa/install-prompt";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ListRow,
  Section,
  TabBar,
} from "../../components/ui";
import {
  UnauthenticatedError,
  useAuth,
} from "../../lib/auth-provider";
import { readJson } from "../../lib/api-response";
import styles from "./page.module.css";

type MembershipState = Membership | null | undefined;
type MemberTab = "members" | "votes" | "board" | "more";

interface MemberDirectoryItem {
  readonly memberNumber: number;
  readonly label: string;
  readonly createdAt: string;
  readonly isMe: boolean;
}

interface MemberDirectoryResponse {
  readonly myMemberNumber: number | null;
  readonly myLabel: string | null;
  readonly items: readonly MemberDirectoryItem[];
  readonly nextCursor: number | null;
}

interface BoardAuthor {
  readonly memberNumber: number;
  readonly label: string;
  readonly isMe: boolean;
}

interface BoardPost {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: BoardAuthor;
}

interface BoardComment {
  readonly id: string;
  readonly postId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: BoardAuthor;
}

interface BoardListResponse {
  readonly items: readonly BoardPost[];
  readonly nextCursor: string | null;
}

interface BoardPostDetail {
  readonly post: BoardPost;
  readonly comments: readonly BoardComment[];
}

interface AdmissionVote {
  readonly id: string;
  readonly candidateToken: string;
  readonly applicantStatement: string | null;
  readonly hasClip: boolean;
  readonly windowEndsAt: string;
  readonly openedAt: string;
  readonly hasVoted: boolean;
}

interface AdmissionVoteDetail extends AdmissionVote {
  readonly status: "open" | "closed" | "overridden";
  readonly outcome: "approved" | "rejected" | null;
  readonly yesCount: number;
  readonly noCount: number;
  readonly turnoutCount: number;
}

interface VoteListResponse {
  readonly items: readonly AdmissionVote[];
  readonly nextCursor: string | null;
}

function MembersIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M8.5 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M15.75 10.75a2.75 2.75 0 1 0 0-5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M3.75 18.75c.68-2.75 2.36-4.25 4.75-4.25s4.07 1.5 4.75 4.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M14.5 14.75c1.95.22 3.31 1.57 3.75 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChatsIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M5.25 6.25h13.5v8.5H9.4L5.25 18.25v-12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 9.5h7M8.5 12h4.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M7 11.5 10.25 15 17.5 7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M5.25 4.75h13.5v14.5H5.25z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M6.5 12h.01M12 12h.01M17.5 12h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

const tabs: readonly {
  readonly id: MemberTab;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  { id: "members", label: "멤버", icon: <MembersIcon /> },
  { id: "votes", label: "투표", icon: <VoteIcon /> },
  { id: "board", label: "게시판", icon: <ChatsIcon /> },
  { id: "more", label: "더보기", icon: <MoreIcon /> },
];

const disabledMoreGroups: readonly {
  readonly title: string;
  readonly rows: readonly {
    readonly label: string;
    readonly description: string;
    readonly badge?: string;
  }[];
}[] = [
  {
    title: "신원·자산",
    rows: [
      {
        label: "소울바운드 신원 / 온체인 크리덴셜",
        description: "검증된 신원을 안전하게 보관",
      },
      {
        label: "SOUL 잔액 · 스테이킹 · 원장",
        description: "참여 상태와 원장 기록",
      },
      { label: "지갑 연결", description: "지갑과 멤버십 연결" },
    ],
  },
  {
    title: "신뢰·안전",
    rows: [
      { label: "신고 · 모더레이션", description: "문제 상황을 안전하게 알리기" },
      {
        label: "지원 / 이의 제기",
        description: "스테이크 기반 이의 제기와 지원",
      },
      {
        label: "심사 권한",
        description: "심사 역할을 얻으면 사용할 수 있습니다.",
        badge: "자격 획득 필요",
      },
    ],
  },
  {
    title: "개인정보·보안·설정",
    rows: [
      {
        label: "프라이버시 / 데이터 보관 정책",
        description: "개인정보와 보관 기준 확인",
      },
      { label: "종단 간 암호화(E2EE) 안내", description: "보안 구조 안내" },
      { label: "설정 (계정/화면)", description: "계정과 화면 설정" },
    ],
  },
];

const appInfo: readonly {
  readonly label: string;
  readonly description: string;
  readonly badge: string;
}[] = [
  {
    label: "앱 정보 / 버전",
    description: "프리알파 미리보기 버전",
    badge: "프리알파",
  },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function pendingVoteBadge(votes: VoteListResponse | null): string | undefined {
  const count = votes?.items.filter((vote) => !vote.hasVoted).length ?? 0;
  if (count === 0) {
    return undefined;
  }

  return count > 9 ? "9+" : String(count);
}

function isClosingSoon(value: string): boolean {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }

  const remainingMs = time - Date.now();
  return remainingMs > 0 && remainingMs <= 24 * 60 * 60 * 1000;
}

function memberMark(memberNumber: number | null): string {
  return memberNumber === null ? "N" : String(memberNumber);
}

function formatCandidateToken(candidateToken: string): string {
  return `신청 #${candidateToken.replace(/^candidate-/, "")}`;
}

function voteOutcomeLabel(outcome: AdmissionVoteDetail["outcome"]): string | null {
  if (outcome === "approved") {
    return "가결";
  }
  if (outcome === "rejected") {
    return "부결";
  }
  return null;
}

function DisabledMoreRow({
  label,
  description,
  badge = "준비 중",
}: {
  readonly label: string;
  readonly description: string;
  readonly badge?: string;
}) {
  return (
    <div aria-disabled="true" className={styles.moreDisabledRow}>
      <ListRow
        title={label}
        description={description}
        trailing={<Badge>{badge}</Badge>}
      />
    </div>
  );
}

export default function MemberPage() {
  const router = useRouter();
  const { session, loading, authedFetch, signOut } = useAuth();
  const [membership, setMembership] = useState<MembershipState>(undefined);
  const [activeTab, setActiveTab] = useState<MemberTab>("members");
  const [directory, setDirectory] =
    useState<MemberDirectoryResponse | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [votes, setVotes] = useState<VoteListResponse | null>(null);
  const [votesLoading, setVotesLoading] = useState(false);
  const [votesError, setVotesError] = useState("");
  const [votesLoadingMore, setVotesLoadingMore] = useState(false);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [voteDetail, setVoteDetail] = useState<AdmissionVoteDetail | null>(null);
  const [voteDetailLoading, setVoteDetailLoading] = useState(false);
  const [voteActionError, setVoteActionError] = useState("");
  const [voteActionMessage, setVoteActionMessage] = useState("");
  const [voteSubmitting, setVoteSubmitting] = useState<"yes" | "no" | null>(null);
  const [voteClipUrl, setVoteClipUrl] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardListResponse | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [boardLoadingMore, setBoardLoadingMore] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [postDetail, setPostDetail] = useState<BoardPostDetail | null>(null);
  const [postDetailLoading, setPostDetailLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [boardActionError, setBoardActionError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    readonly type: "post" | "comment";
    readonly id: string;
  } | null>(null);
  const [signOutError, setSignOutError] = useState("");
  const votesPrefetchedRef = useRef(false);

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      router.push("/login");
    } catch {
      setSignOutError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function loadDirectory(cursor: number | null = null) {
    if (cursor === null) {
      setDirectoryLoading(true);
    } else {
      setLoadingMore(true);
    }
    setDirectoryError("");

    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor !== null) {
        params.set("cursor", String(cursor));
      }
      const response = await authedFetch(`/api/members?${params.toString()}`);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load members");
      }

      const nextDirectory = await readJson<MemberDirectoryResponse>(response);
      setDirectory((current) => {
        if (cursor === null || !current) {
          return nextDirectory;
        }

        return {
          ...nextDirectory,
          items: [...current.items, ...nextDirectory.items],
        };
      });
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setDirectoryError("멤버 명부를 불러오지 못했습니다.");
      }
    } finally {
      setDirectoryLoading(false);
      setLoadingMore(false);
    }
  }

  async function loadVotes(cursor: string | null = null) {
    if (cursor === null) {
      setVotesLoading(true);
    } else {
      setVotesLoadingMore(true);
    }
    setVotesError("");

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor !== null) {
        params.set("cursor", cursor);
      }
      const response = await authedFetch(
        `/api/vote/applications?${params.toString()}`,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load votes");
      }

      const nextVotes = await readJson<VoteListResponse>(response);
      setVotes((current) => {
        if (cursor === null || !current) {
          return nextVotes;
        }

        return {
          ...nextVotes,
          items: [...current.items, ...nextVotes.items],
        };
      });
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setVotesError("입장 투표를 불러오지 못했습니다.");
      }
    } finally {
      setVotesLoading(false);
      setVotesLoadingMore(false);
    }
  }

  async function loadVoteDetail(voteId: string) {
    setSelectedVoteId(voteId);
    setVoteDetailLoading(true);
    setVoteActionError("");
    setVoteActionMessage("");
    setVoteClipUrl(null);

    try {
      const response = await authedFetch(`/api/vote/applications/${voteId}`);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load vote detail");
      }

      setVoteDetail(await readJson<AdmissionVoteDetail>(response));
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setVoteActionError("입장 투표 상세를 불러오지 못했습니다.");
      }
    } finally {
      setVoteDetailLoading(false);
    }
  }

  async function castAdmissionVote(choice: "yes" | "no") {
    if (!voteDetail) {
      return;
    }

    setVoteSubmitting(choice);
    setVoteActionError("");
    setVoteActionMessage("");
    try {
      const response = await authedFetch(
        `/api/vote/applications/${voteDetail.id}/cast`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ choice }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (response.status === 409) {
        setVoteActionError("이미 이 투표에 참여했습니다.");
        await loadVoteDetail(voteDetail.id);
        await loadVotes();
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to cast vote");
      }

      setVoteDetail(await readJson<AdmissionVoteDetail>(response));
      setVoteActionMessage("투표가 접수되었습니다. 선택은 공개되지 않습니다.");
      await loadVotes();
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setVoteActionError("투표를 반영하지 못했습니다.");
      }
    } finally {
      setVoteSubmitting(null);
    }
  }

  async function loadVoteClip(voteId: string) {
    setVoteActionError("");
    try {
      const response = await authedFetch(
        `/api/vote/applications/${voteId}/persona-clip-url`,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (response.status === 404) {
        setVoteActionError("볼 수 있는 Persona Clip이 없습니다.");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load vote clip");
      }

      const payload = await readJson<{ readonly url: string }>(response);
      setVoteClipUrl(payload.url);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setVoteActionError("Persona Clip을 불러오지 못했습니다.");
      }
    }
  }

  async function loadBoard(cursor: string | null = null) {
    if (cursor === null) {
      setBoardLoading(true);
    } else {
      setBoardLoadingMore(true);
    }
    setBoardError("");

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor !== null) {
        params.set("cursor", cursor);
      }
      const response = await authedFetch(`/api/board?${params.toString()}`);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load board");
      }

      const nextBoard = await readJson<BoardListResponse>(response);
      setBoard((current) => {
        if (cursor === null || !current) {
          return nextBoard;
        }

        return {
          ...nextBoard,
          items: [...current.items, ...nextBoard.items],
        };
      });
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setBoardError("게시글을 불러오지 못했습니다.");
      }
    } finally {
      setBoardLoading(false);
      setBoardLoadingMore(false);
    }
  }

  async function loadPostDetail(postId: string) {
    setSelectedPostId(postId);
    setPostDetailLoading(true);
    setBoardActionError("");
    setPendingDelete(null);

    try {
      const response = await authedFetch(`/api/board/${postId}`);
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load post");
      }

      setPostDetail(await readJson<BoardPostDetail>(response));
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setBoardActionError("게시글 상세를 불러오지 못했습니다.");
      }
    } finally {
      setPostDetailLoading(false);
    }
  }

  async function submitPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!postBody.trim()) {
      return;
    }

    setPostSubmitting(true);
    setBoardActionError("");
    setPendingDelete(null);
    try {
      const response = await authedFetch("/api/board", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: postBody }),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to submit post");
      }

      const nextPost = await readJson<BoardPost>(response);
      setBoard((current) => ({
        items: [nextPost, ...(current?.items ?? [])],
        nextCursor: current?.nextCursor ?? null,
      }));
      setPostBody("");
      setSelectedPostId(nextPost.id);
      setPostDetail({ post: nextPost, comments: [] });
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setBoardActionError("게시글을 올리지 못했습니다.");
      }
    } finally {
      setPostSubmitting(false);
    }
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim() || !postDetail) {
      return;
    }

    setCommentSubmitting(true);
    setBoardActionError("");
    setPendingDelete(null);
    try {
      const response = await authedFetch(
        `/api/board/${postDetail.post.id}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: commentBody }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to submit comment");
      }

      const nextComment = await readJson<BoardComment>(response);
      setPostDetail((current) => current
        ? { ...current, comments: [...current.comments, nextComment] }
        : current);
      setCommentBody("");
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setBoardActionError("댓글을 올리지 못했습니다.");
      }
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function deletePost(postId: string) {
    setBoardActionError("");
    if (pendingDelete?.type !== "post" || pendingDelete.id !== postId) {
      setPendingDelete({ type: "post", id: postId });
      return;
    }

    try {
      const response = await authedFetch(`/api/board/${postId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Unable to delete post");
      }
      setBoard((current) => current
        ? {
          ...current,
          items: current.items.filter((item) => item.id !== postId),
        }
        : current);
      if (selectedPostId === postId) {
        setSelectedPostId(null);
        setPostDetail(null);
      }
      setPendingDelete(null);
    } catch {
      setBoardActionError("게시글을 삭제하지 못했습니다.");
    }
  }

  async function deleteComment(commentId: string) {
    setBoardActionError("");
    if (pendingDelete?.type !== "comment" || pendingDelete.id !== commentId) {
      setPendingDelete({ type: "comment", id: commentId });
      return;
    }

    try {
      const response = await authedFetch(
        `/api/board/${postDetail?.post.id}/comments/${commentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error("Unable to delete comment");
      }
      setPostDetail((current) => current
        ? {
          ...current,
          comments: current.comments.filter((item) => item.id !== commentId),
        }
        : current);
      setPendingDelete(null);
    } catch {
      setBoardActionError("댓글을 삭제하지 못했습니다.");
    }
  }

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const loadMembership = async () => {
      try {
        const response = await authedFetch("/api/membership/me", {
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Unable to load membership");
        }

        const nextMembership = await readJson<Membership | null>(response);
        if (nextMembership?.status !== "active") {
          router.replace("/gate");
          return;
        }

        setMembership(nextMembership);
        void loadDirectory();
        if (!votesPrefetchedRef.current) {
          votesPrefetchedRef.current = true;
          void loadVotes();
        }
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          router.replace("/login");
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setMembership(null);
        }
      }
    };

    void loadMembership();
    return () => controller.abort();
  }, [authedFetch, loading, router, session]);

  useEffect(() => {
    if (
      activeTab !== "votes"
      || membership?.status !== "active"
      || votes
      || votesLoading
      || votesError
    ) {
      return;
    }

    void loadVotes();
  }, [activeTab, membership?.status, votes, votesError, votesLoading]);

  useEffect(() => {
    if (
      activeTab !== "board"
      || membership?.status !== "active"
      || board
      || boardLoading
      || boardError
    ) {
      return;
    }

    void loadBoard();
  }, [activeTab, board, boardError, boardLoading, membership?.status]);

  if (loading || membership === undefined) {
    return (
      <main className="page-main narrow-main">
        <div className={styles.notMember}>
          <h2>멤버십을 확인하는 중입니다</h2>
          <p>잠시만 기다려 주세요.</p>
        </div>
      </main>
    );
  }

  if (!membership || membership.status !== "active") {
    return (
      <main className="page-main narrow-main">
        <div className={styles.notMember}>
          <h2>멤버 전용 공간입니다</h2>
          <p>입장이 확인되면 멤버 명부와 게시판을 사용할 수 있습니다.</p>
          <Link className="button" href="/gate">입장 절차 보기</Link>
        </div>
      </main>
    );
  }

  const myMemberNumber = directory?.myMemberNumber ?? null;
  const myLabel = directory?.myLabel ?? "멤버 번호를 불러오는 중입니다.";
  const voteBadge = pendingVoteBadge(votes);
  const memberTabs = tabs.map((tab) =>
    tab.id === "votes" && voteBadge ? { ...tab, badge: voteBadge } : tab
  );

  return (
    <main className={`page-main ${styles.memberPage}`}>
      <div className={styles.appShell}>
        <header className={styles.phoneTop}>
          <span>soulbound</span>
          <Badge tone="success">입장 완료</Badge>
        </header>

        <div className={styles.tabPanels}>
          {activeTab === "members" ? (
            <div className={styles.tabPanel}>
              <Section
                title="내 멤버 번호"
                description="멤버끼리는 이 번호로만 보입니다."
                action={<Badge tone="success">활성</Badge>}
              >
                <ListRow
                  leading={<Avatar label={memberMark(myMemberNumber)} />}
                  title={myLabel}
                  description="복구 가능한 개인 식별 정보를 보관하지 않습니다."
                  meta={`입장일 ${formatDate(membership.issuedAt)}`}
                />
              </Section>

              <Section
                title="멤버 명부"
                description="입장한 멤버의 익명 번호 목록"
                action={directory?.nextCursor ? <Badge>50+</Badge> : null}
              >
                {directoryLoading ? (
                  <EmptyState>멤버 명부를 불러오는 중입니다.</EmptyState>
                ) : null}
                {!directoryLoading && directoryError ? (
                  <div className={styles.directoryState}>
                    <EmptyState>{directoryError}</EmptyState>
                    <Button
                      tone="secondary"
                      type="button"
                      onClick={() => void loadDirectory()}
                    >
                      다시 시도
                    </Button>
                  </div>
                ) : null}
                {!directoryLoading && !directoryError && directory
                  && directory.items.length === 0 ? (
                    <div className={styles.directoryState}>
                      <EmptyState>아직 표시할 멤버가 없습니다.</EmptyState>
                    </div>
                  ) : null}
                {!directoryLoading && !directoryError && directory
                  && directory.items.length > 0 ? (
                    <div className={styles.directoryList}>
                      {directory.items.map((member) => (
                        <ListRow
                          key={member.memberNumber}
                          leading={<Avatar label={memberMark(member.memberNumber)} />}
                          title={member.label}
                          description="익명 멤버"
                          meta={`입장일 ${formatDate(member.createdAt)}`}
                          trailing={member.isMe ? (
                            <Badge tone="success">나</Badge>
                          ) : null}
                        />
                      ))}
                    </div>
                  ) : null}
                {directory?.nextCursor ? (
                  <div className={styles.directoryActions}>
                    <Button
                      disabled={loadingMore}
                      onClick={() => void loadDirectory(directory.nextCursor)}
                      tone="secondary"
                      type="button"
                    >
                      {loadingMore ? "불러오는 중" : "더 보기"}
                    </Button>
                  </div>
                ) : null}
              </Section>
            </div>
          ) : null}

          {activeTab === "votes" ? (
            <div className={styles.quietPanel}>
              <Section
                title="입장 투표"
                description="멤버가 새 입장을 비밀투표로 결정합니다."
                action={votes?.nextCursor ? <Badge>20+</Badge> : null}
              >
                {votesLoading ? (
                  <EmptyState>입장 투표를 불러오는 중입니다.</EmptyState>
                ) : null}
                {!votesLoading && votesError ? (
                  <div className={styles.directoryState}>
                    <EmptyState>{votesError}</EmptyState>
                    <Button
                      tone="secondary"
                      type="button"
                      onClick={() => void loadVotes()}
                    >
                      다시 시도
                    </Button>
                  </div>
                ) : null}
                {!votesLoading && !votesError && votes
                  && votes.items.length === 0 ? (
                    <div className={styles.directoryState}>
                      <EmptyState>열린 입장 투표가 없습니다.</EmptyState>
                    </div>
                  ) : null}
                {!votesLoading && !votesError && votes
                  && votes.items.length > 0 ? (
                    <div className={styles.boardList}>
                      {votes.items.map((vote) => (
                        <button
                          className={`${styles.boardPostButton} ${
                            selectedVoteId === vote.id
                              ? styles.boardPostButtonActive
                              : ""
                          }`}
                          key={vote.id}
                          onClick={() => void loadVoteDetail(vote.id)}
                          type="button"
                        >
                          <span className={styles.boardPostMeta}>
                            {formatCandidateToken(vote.candidateToken)} · 마감 {formatDate(vote.windowEndsAt)}
                          </span>
                          <span className={styles.boardPostBody}>
                            {vote.applicantStatement ?? "신청 자료는 결정 후 삭제됩니다."}
                          </span>
                          {isClosingSoon(vote.windowEndsAt) ? (
                            <Badge>마감 임박</Badge>
                          ) : null}
                          {vote.hasVoted ? <Badge tone="success">투표 완료</Badge> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                {votes?.nextCursor ? (
                  <div className={styles.directoryActions}>
                    <Button
                      disabled={votesLoadingMore}
                      onClick={() => void loadVotes(votes.nextCursor)}
                      tone="secondary"
                      type="button"
                    >
                      {votesLoadingMore ? "불러오는 중" : "더 보기"}
                    </Button>
                  </div>
                ) : null}
              </Section>

              {voteActionError ? (
                <p className="form-message" role="alert">{voteActionError}</p>
              ) : null}
              {voteActionMessage ? (
                <p className="success-message" role="status">
                  {voteActionMessage}
                </p>
              ) : null}

              {selectedVoteId ? (
                <Section title="투표 상세">
                  {voteDetailLoading ? (
                    <EmptyState>투표 상세를 여는 중입니다.</EmptyState>
                  ) : null}
                  {!voteDetailLoading && voteDetail ? (
                    <div className={styles.boardDetail}>
                      <div className={styles.boardDetailHeader}>
                        <div>
                          <p>{formatCandidateToken(voteDetail.candidateToken)}</p>
                          <span>마감 {formatDate(voteDetail.windowEndsAt)}</span>
                        </div>
                        {voteDetail.hasVoted ? (
                          <Badge tone="success">투표 완료</Badge>
                        ) : (
                          <Badge>비밀투표</Badge>
                        )}
                      </div>
                      <p className={styles.boardDetailBody}>
                        {voteDetail.applicantStatement
                          ?? "결정된 신청 자료는 삭제되었습니다."}
                      </p>
                      {voteDetail.hasClip ? (
                        <div className={styles.clipBlock}>
                          <Button
                            tone="secondary"
                            type="button"
                            onClick={() => void loadVoteClip(voteDetail.id)}
                          >
                            Persona Clip 보기
                          </Button>
                          {voteClipUrl ? (
                            <video
                              aria-label="입장 투표 Persona Clip"
                              className={styles.clipVideo}
                              controls
                              src={voteClipUrl}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      {voteDetail.status === "open" ? (
                        <div className={styles.boardActions}>
                          <Button
                            disabled={voteDetail.hasVoted || voteSubmitting !== null}
                            onClick={() => void castAdmissionVote("yes")}
                            type="button"
                          >
                            {voteSubmitting === "yes" ? "반영 중" : "찬성"}
                          </Button>
                          <Button
                            disabled={voteDetail.hasVoted || voteSubmitting !== null}
                            onClick={() => void castAdmissionVote("no")}
                            tone="secondary"
                            type="button"
                          >
                            {voteSubmitting === "no" ? "반영 중" : "반대"}
                          </Button>
                        </div>
                      ) : (
                        <p className={styles.boardPostMeta}>
                          결과: 찬성 {voteDetail.yesCount} · 반대 {voteDetail.noCount}
                          {voteOutcomeLabel(voteDetail.outcome)
                            ? ` · ${voteOutcomeLabel(voteDetail.outcome)}`
                            : ""}
                        </p>
                      )}
                    </div>
                  ) : null}
                </Section>
              ) : null}
            </div>
          ) : null}

          {activeTab === "board" ? (
            <div className={styles.quietPanel}>
              <Section
                title="게시판"
                description="멤버 번호만 보이는 공용 게시판"
                action={board?.nextCursor ? <Badge>20+</Badge> : null}
              >
                <form className={styles.boardComposer} onSubmit={submitPost}>
                  <textarea
                    aria-label="게시글 내용"
                    className={styles.boardTextarea}
                    maxLength={2000}
                    onChange={(event) => setPostBody(event.target.value)}
                    placeholder="멤버들에게 남길 말을 적어 주세요."
                    rows={4}
                    value={postBody}
                  />
                  <div className={styles.boardActions}>
                    <span>{myLabel}</span>
                    <Button
                      disabled={postSubmitting || !postBody.trim()}
                      type="submit"
                    >
                      {postSubmitting ? "올리는 중" : "올리기"}
                    </Button>
                  </div>
                </form>
              </Section>

              <Section title="글 목록">
                {boardLoading ? (
                  <EmptyState>게시글을 불러오는 중입니다.</EmptyState>
                ) : null}
                {!boardLoading && boardError ? (
                  <div className={styles.directoryState}>
                    <EmptyState>{boardError}</EmptyState>
                    <Button
                      tone="secondary"
                      type="button"
                      onClick={() => void loadBoard()}
                    >
                      다시 시도
                    </Button>
                  </div>
                ) : null}
                {!boardLoading && !boardError && board
                  && board.items.length === 0 ? (
                    <div className={styles.directoryState}>
                      <EmptyState>아직 게시글이 없습니다.</EmptyState>
                    </div>
                  ) : null}
                {!boardLoading && !boardError && board
                  && board.items.length > 0 ? (
                    <div className={styles.boardList}>
                      {board.items.map((post) => (
                        <button
                          className={`${styles.boardPostButton} ${
                            selectedPostId === post.id
                              ? styles.boardPostButtonActive
                              : ""
                          }`}
                          key={post.id}
                          onClick={() => void loadPostDetail(post.id)}
                          type="button"
                        >
                          <span className={styles.boardPostMeta}>
                            {post.author.label} · {formatDate(post.createdAt)}
                          </span>
                          <span className={styles.boardPostBody}>
                            {post.body}
                          </span>
                          {post.author.isMe ? <Badge tone="success">나</Badge> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                {board?.nextCursor ? (
                  <div className={styles.directoryActions}>
                    <Button
                      disabled={boardLoadingMore}
                      onClick={() => void loadBoard(board.nextCursor)}
                      tone="secondary"
                      type="button"
                    >
                      {boardLoadingMore ? "불러오는 중" : "더 보기"}
                    </Button>
                  </div>
                ) : null}
              </Section>

              {boardActionError ? (
                <p className="form-message" role="alert">{boardActionError}</p>
              ) : null}

              {selectedPostId ? (
                <Section title="게시글">
                  {postDetailLoading ? (
                    <EmptyState>게시글을 여는 중입니다.</EmptyState>
                  ) : null}
                  {!postDetailLoading && postDetail ? (
                    <div className={styles.boardDetail}>
                      <div className={styles.boardDetailHeader}>
                        <div>
                          <p>{postDetail.post.author.label}</p>
                          <span>{formatDate(postDetail.post.createdAt)}</span>
                        </div>
                        {postDetail.post.author.isMe ? (
                          <button
                            className={styles.rowAction}
                            onClick={() => void deletePost(postDetail.post.id)}
                            type="button"
                          >
                            {pendingDelete?.type === "post"
                              && pendingDelete.id === postDetail.post.id
                              ? "다시 눌러 삭제"
                              : "삭제"}
                          </button>
                        ) : null}
                      </div>
                      <p className={styles.boardDetailBody}>
                        {postDetail.post.body}
                      </p>

                      <div className={styles.commentList}>
                        {postDetail.comments.length === 0 ? (
                          <EmptyState>아직 댓글이 없습니다.</EmptyState>
                        ) : null}
                        {postDetail.comments.map((comment) => (
                          <div className={styles.commentItem} key={comment.id}>
                            <div>
                              <p>{comment.author.label}</p>
                              <span>{formatDate(comment.createdAt)}</span>
                            </div>
                            <p>{comment.body}</p>
                            {comment.author.isMe ? (
                              <button
                                className={styles.rowAction}
                                onClick={() => void deleteComment(comment.id)}
                                type="button"
                              >
                                {pendingDelete?.type === "comment"
                                  && pendingDelete.id === comment.id
                                  ? "다시 눌러 삭제"
                                  : "삭제"}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <form
                        className={styles.commentComposer}
                        onSubmit={submitComment}
                      >
                        <textarea
                          aria-label="댓글 내용"
                          className={styles.boardTextarea}
                          maxLength={1200}
                          onChange={(event) =>
                            setCommentBody(event.target.value)}
                          placeholder="댓글을 적어 주세요."
                          rows={3}
                          value={commentBody}
                        />
                        <Button
                          disabled={commentSubmitting || !commentBody.trim()}
                          type="submit"
                        >
                          {commentSubmitting ? "올리는 중" : "댓글 달기"}
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </Section>
              ) : null}
            </div>
          ) : null}

          {activeTab === "more" ? (
            <div className={styles.morePanel}>
              <Section title="내 계정">
                <div className={styles.moreList}>
                  <ListRow
                    title="내 멤버십"
                    description={myLabel}
                    trailing={<Badge tone="success">활성</Badge>}
                  />
                  <ListRow
                    title="입장 현황"
                    description="현재 멤버로 입장했습니다."
                    trailing={<Badge tone="success">완료</Badge>}
                  />
                  <ListRow
                    title="로그아웃"
                    description="이 기기에서 나갑니다."
                    trailing={(
                      <button
                        className={styles.rowAction}
                        onClick={() => void handleSignOut()}
                        type="button"
                      >
                        로그아웃
                      </button>
                    )}
                  />
                </div>
                {signOutError ? (
                  <p className="form-message" role="alert">{signOutError}</p>
                ) : null}
              </Section>

              {disabledMoreGroups.map((group) => (
                <Section key={group.title} title={group.title}>
                  <div className={styles.moreList}>
                    {group.rows.map((row) => (
                      <DisabledMoreRow
                        description={row.description}
                        key={row.label}
                        label={row.label}
                        {...(row.badge ? { badge: row.badge } : {})}
                      />
                    ))}
                  </div>
                </Section>
              ))}

              <Section title="앱">
                <div className={styles.moreList}>
                  <ListRow
                    title="앱 설치"
                    description="홈 화면에서 바로 열기"
                    trailing={<InstallPrompt />}
                  />
                  {appInfo.map((item) => (
                    <DisabledMoreRow
                      badge={item.badge}
                      description={item.description}
                      key={item.label}
                      label={item.label}
                    />
                  ))}
                </div>
              </Section>
            </div>
          ) : null}
        </div>

        <TabBar
          activeId={activeTab}
          items={memberTabs}
          label="멤버 영역"
          onChange={setActiveTab}
        />
      </div>
    </main>
  );
}
