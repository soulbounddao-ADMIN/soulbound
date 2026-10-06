// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("../../components/pwa/install-prompt", () => ({
  InstallPrompt: () => <span>설치</span>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function activeMembership() {
  return {
    id: "membership-1",
    userId: "member-1",
    status: "active",
    tier: "basic",
    issuedAt: "2026-06-08T00:00:00.000Z",
    revokedAt: null,
  };
}

function emptyDirectory() {
  return {
    myMemberNumber: 7,
    myLabel: "soulbound-member-7",
    items: [],
    nextCursor: null,
  };
}

function emptyVotes() {
  return {
    items: [],
    nextCursor: null,
  };
}

describe("MemberPage", () => {
  const authedFetch = vi.fn();
  const signOut = vi.fn(async () => undefined);

  beforeEach(() => {
    authedFetch.mockReset();
    routerMocks.push.mockClear();
    routerMocks.replace.mockClear();
    signOut.mockClear();
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "member-1" } },
      signOut,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the member-number directory for an active membership", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "membership-1",
      userId: "member-1",
      status: "active",
      tier: "basic",
      issuedAt: "2026-06-08T00:00:00.000Z",
      revokedAt: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      myMemberNumber: 7,
      myLabel: "soulbound-member-7",
      items: [
        {
          memberNumber: 7,
          label: "soulbound-member-7",
          createdAt: "2026-06-08T00:00:00.000Z",
          isMe: true,
        },
        {
          memberNumber: 8,
          label: "soulbound-member-8",
          createdAt: "2026-06-09T00:00:00.000Z",
          isMe: false,
        },
      ],
      nextCursor: 8,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(jsonResponse(emptyVotes()));

    render(<MemberPage />);

    expect(await screen.findAllByText("soulbound-member-7"))
      .toHaveLength(2);
    expect(screen.getByRole("tab", { name: "투표" }).textContent).toBe("투표");
    expect(screen.getByText("soulbound-member-8")).toBeTruthy();
    expect(screen.getByText("50+")).toBeTruthy();
    expect(screen.queryByText("My Persona")).toBeNull();
    expect(screen.queryByText("내 프로필 (페르소나)")).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText("username")).toBeNull();
    expect(screen.queryByText("이메일")).toBeNull();
    expect(screen.getByRole("button", { name: "더 보기" })).toBeTruthy();

    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      myMemberNumber: 7,
      myLabel: "soulbound-member-7",
      items: [
        {
          memberNumber: 9,
          label: "soulbound-member-9",
          createdAt: "2026-06-10T00:00:00.000Z",
          isMe: false,
        },
      ],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByText("soulbound-member-9")).toBeTruthy();

    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [
        {
          id: "post-1",
          body: "첫 게시글입니다.",
          createdAt: "2026-06-11T00:00:00.000Z",
          author: {
            memberNumber: 8,
            label: "soulbound-member-8",
            isMe: false,
          },
        },
      ],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    fireEvent.click(screen.getByRole("tab", { name: "게시판" }));
    expect(await screen.findByText("첫 게시글입니다.")).toBeTruthy();
    expect(screen.getByText(/멤버 번호만 보이는 공용 게시판/)).toBeTruthy();
    expect(screen.queryByText("username")).toBeNull();
    expect(screen.queryByText("이메일")).toBeNull();

    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      post: {
        id: "post-1",
        body: "첫 게시글입니다.",
        createdAt: "2026-06-11T00:00:00.000Z",
        author: {
          memberNumber: 8,
          label: "soulbound-member-8",
          isMe: false,
        },
      },
      comments: [],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const postButton = screen.getByText("첫 게시글입니다.").closest("button");
    expect(postButton).toBeTruthy();
    fireEvent.click(postButton as HTMLButtonElement);
    expect(await screen.findByText("아직 댓글이 없습니다.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "더보기" }));
    [
      "입장 현황",
      "내 멤버십",
      "소울바운드 신원 / 온체인 크리덴셜",
      "SOUL 잔액 · 스테이킹 · 원장",
      "지갑 연결",
      "신고 · 모더레이션",
      "지원 / 이의 제기",
      "심사 권한",
      "프라이버시 / 데이터 보관 정책",
      "종단 간 암호화(E2EE) 안내",
      "설정 (계정/화면)",
      "앱 설치",
      "앱 정보 / 버전",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    expect(screen.queryByText("대화 / 다이렉트 메시지 (E2EE)")).toBeNull();
    expect(screen.queryByText("알림")).toBeNull();
    expect(screen.getByText("자격 획득 필요")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/membership/me",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(authedFetch).toHaveBeenCalledWith("/api/members?limit=50");
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/members?limit=50&cursor=8",
    );
    expect(authedFetch).toHaveBeenCalledWith("/api/board?limit=20");
    expect(authedFetch).toHaveBeenCalledWith("/api/board/post-1");
  });

  it("prefetches votes, shows a pending badge, and marks votes closing soon", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            id: "vote-1",
            candidateToken: "candidate-1234",
            applicantStatement: "곧 마감되는 신청입니다.",
            hasClip: false,
            windowEndsAt: soon,
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: false,
          },
          {
            id: "vote-2",
            candidateToken: "candidate-5678",
            applicantStatement: "나중에 마감되는 신청입니다.",
            hasClip: false,
            windowEndsAt: later,
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: false,
          },
          {
            id: "vote-3",
            candidateToken: "candidate-9012",
            applicantStatement: "이미 참여한 신청입니다.",
            hasClip: false,
            windowEndsAt: later,
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: true,
          },
        ],
        nextCursor: null,
      }));

    render(<MemberPage />);

    const voteTab = await screen.findByRole("tab", { name: "투표" });
    await waitFor(() => expect(voteTab.textContent).toContain("2"));
    expect(screen.getByRole("tab", { name: "투표" })).toBe(voteTab);

    fireEvent.click(voteTab);

    expect(await screen.findByText("곧 마감되는 신청입니다.")).toBeTruthy();
    expect(screen.getByText("마감 임박")).toBeTruthy();
    expect(screen.getByText("이미 참여한 신청입니다.")).toBeTruthy();
    expect(screen.getByText("투표 완료")).toBeTruthy();
  });

  it("does not reset the vote list when the session object changes", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()))
      .mockResolvedValueOnce(jsonResponse(emptyVotes()));

    const { rerender } = render(<MemberPage />);

    await waitFor(() =>
      expect(authedFetch).toHaveBeenCalledWith("/api/vote/applications?limit=20")
    );
    expect(authedFetch.mock.calls.filter(([url]) =>
      url === "/api/vote/applications?limit=20"
    )).toHaveLength(1);

    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "member-1" }, refreshed: true },
      signOut,
    });
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()));

    rerender(<MemberPage />);

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(5));
    expect(authedFetch.mock.calls.filter(([url]) =>
      url === "/api/vote/applications?limit=20"
    )).toHaveLength(1);
  });

  it("caps the pending vote badge at 9+", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()))
      .mockResolvedValueOnce(jsonResponse({
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `vote-${index}`,
          candidateToken: `candidate-${index}`,
          applicantStatement: `신청 ${index}`,
          hasClip: false,
          windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
            .toISOString(),
          openedAt: "2026-06-10T00:00:00.000Z",
          hasVoted: false,
        })),
        nextCursor: null,
      }));

    render(<MemberPage />);

    const voteTab = await screen.findByRole("tab", { name: "투표" });
    await waitFor(() => expect(voteTab.textContent).toContain("9+"));
    expect(voteTab.textContent).not.toContain("candidate");
  });

  it("updates the pending vote badge after casting", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            id: "vote-1",
            candidateToken: "candidate-1234",
            applicantStatement: "첫 신청입니다.",
            hasClip: false,
            windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
              .toISOString(),
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: false,
          },
          {
            id: "vote-2",
            candidateToken: "candidate-5678",
            applicantStatement: "둘째 신청입니다.",
            hasClip: false,
            windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
              .toISOString(),
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: false,
          },
        ],
        nextCursor: null,
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "vote-1",
        candidateToken: "candidate-1234",
        applicantStatement: "첫 신청입니다.",
        hasClip: false,
        windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
          .toISOString(),
        openedAt: "2026-06-10T00:00:00.000Z",
        hasVoted: false,
        status: "open",
        outcome: null,
        yesCount: 0,
        noCount: 0,
        turnoutCount: 0,
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "vote-1",
        candidateToken: "candidate-1234",
        applicantStatement: "첫 신청입니다.",
        hasClip: false,
        windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
          .toISOString(),
        openedAt: "2026-06-10T00:00:00.000Z",
        hasVoted: true,
        status: "open",
        outcome: null,
        yesCount: 1,
        noCount: 0,
        turnoutCount: 1,
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            id: "vote-1",
            candidateToken: "candidate-1234",
            applicantStatement: "첫 신청입니다.",
            hasClip: false,
            windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
              .toISOString(),
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: true,
          },
          {
            id: "vote-2",
            candidateToken: "candidate-5678",
            applicantStatement: "둘째 신청입니다.",
            hasClip: false,
            windowEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
              .toISOString(),
            openedAt: "2026-06-10T00:00:00.000Z",
            hasVoted: false,
          },
        ],
        nextCursor: null,
      }));

    render(<MemberPage />);

    const voteTab = await screen.findByRole("tab", { name: "투표" });
    await waitFor(() => expect(voteTab.textContent).toContain("2"));
    fireEvent.click(voteTab);
    fireEvent.click(await screen.findByText("첫 신청입니다."));
    fireEvent.click(await screen.findByRole("button", { name: "찬성" }));

    await waitFor(() => {
      expect(voteTab.textContent).toContain("1");
      expect(voteTab.textContent).not.toContain("2");
    });
    expect(await screen.findByText("투표가 접수되었습니다. 선택은 공개되지 않습니다."))
      .toBeTruthy();
  });

  it("hides cast buttons after an admission vote closes", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "membership-1",
      userId: "member-1",
      status: "active",
      tier: "basic",
      issuedAt: "2026-06-08T00:00:00.000Z",
      revokedAt: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      myMemberNumber: 7,
      myLabel: "soulbound-member-7",
      items: [],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      items: [{
        id: "vote-1",
        candidateToken: "candidate-1234",
        applicantStatement: "새 멤버 신청입니다.",
        hasClip: false,
        windowEndsAt: "2026-06-12T00:00:00.000Z",
        openedAt: "2026-06-10T00:00:00.000Z",
        hasVoted: false,
      }],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "vote-1",
      candidateToken: "candidate-1234",
      applicantStatement: "새 멤버 신청입니다.",
      hasClip: false,
      windowEndsAt: "2026-06-12T00:00:00.000Z",
      openedAt: "2026-06-10T00:00:00.000Z",
      hasVoted: false,
      status: "closed",
      outcome: "approved",
      yesCount: 3,
      noCount: 1,
      turnoutCount: 4,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "투표" }));
    fireEvent.click(await screen.findByText("새 멤버 신청입니다."));

    expect(await screen.findByText("결과: 찬성 3 · 반대 1 · 가결"))
      .toBeTruthy();
    expect(screen.queryByRole("button", { name: "찬성" })).toBeNull();
    expect(screen.queryByRole("button", { name: "반대" })).toBeNull();
  });

  it("stops automatic vote reloads after an error until retry is clicked", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    render(<MemberPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "투표" }));

    expect(await screen.findByText("입장 투표를 불러오지 못했습니다."))
      .toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(authedFetch).toHaveBeenCalledTimes(3);

    authedFetch.mockResolvedValueOnce(jsonResponse({
      items: [],
      nextCursor: null,
    }));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(4));
    expect(await screen.findByText("열린 입장 투표가 없습니다.")).toBeTruthy();
  });

  it("stops automatic board reloads after an error until retry is clicked", async () => {
    authedFetch
      .mockResolvedValueOnce(jsonResponse(activeMembership()))
      .mockResolvedValueOnce(jsonResponse(emptyDirectory()))
      .mockResolvedValueOnce(jsonResponse(emptyVotes()))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    render(<MemberPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "게시판" }));

    expect(await screen.findByText("게시글을 불러오지 못했습니다."))
      .toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(authedFetch).toHaveBeenCalledTimes(4);

    authedFetch.mockResolvedValueOnce(jsonResponse({
      items: [],
      nextCursor: null,
    }));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(5));
    expect(await screen.findByText("아직 게시글이 없습니다.")).toBeTruthy();
  });

  it("requires a second click before deleting a board post", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "membership-1",
      userId: "member-1",
      status: "active",
      tier: "basic",
      issuedAt: "2026-06-08T00:00:00.000Z",
      revokedAt: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      myMemberNumber: 7,
      myLabel: "soulbound-member-7",
      items: [],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(jsonResponse(emptyVotes()))
      .mockResolvedValueOnce(new Response(JSON.stringify({
      items: [{
        id: "post-1",
        body: "내 게시글입니다.",
        createdAt: "2026-06-11T00:00:00.000Z",
        author: {
          memberNumber: 7,
          label: "soulbound-member-7",
          isMe: true,
        },
      }],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      post: {
        id: "post-1",
        body: "내 게시글입니다.",
        createdAt: "2026-06-11T00:00:00.000Z",
        author: {
          memberNumber: 7,
          label: "soulbound-member-7",
          isMe: true,
        },
      },
      comments: [],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "게시판" }));
    fireEvent.click(await screen.findByText("내 게시글입니다."));

    const callsBeforeDelete = authedFetch.mock.calls.length;
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

    expect(screen.getByRole("button", { name: "다시 눌러 삭제" }))
      .toBeTruthy();
    expect(authedFetch).toHaveBeenCalledTimes(callsBeforeDelete);

    authedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole("button", { name: "다시 눌러 삭제" }));

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(
      callsBeforeDelete + 1,
    ));
    expect(authedFetch.mock.calls[callsBeforeDelete]?.[0]).toBe(
      "/api/board/post-1",
    );
    expect((authedFetch.mock.calls[callsBeforeDelete]?.[1] as RequestInit).method)
      .toBe("DELETE");
  });

  it("returns a non-member to the gate", async () => {
    authedFetch.mockResolvedValueOnce(new Response("null", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/gate")
    );
  });
});
