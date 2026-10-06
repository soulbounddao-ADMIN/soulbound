import { createServiceRoleSupabaseClient } from "@soulbound/adapters";
import {
  createActiveMember,
  createAdmin,
  createApplicant,
  createReviewer,
  deleteFixtureUsers,
  readIntegrationConfig,
  type TestSession,
} from "./_integration/fixtures";
import {
  DELETE as deleteAdminComment,
} from "./admin/board/comments/[commentId]/route";
import {
  DELETE as deleteAdminPost,
} from "./admin/board/posts/[postId]/route";
import {
  GET as getBoard,
  POST as postBoard,
} from "./board/route";
import {
  DELETE as deleteBoardPost,
  GET as getBoardPost,
} from "./board/[postId]/route";
import {
  POST as postBoardComment,
} from "./board/[postId]/comments/route";
import {
  DELETE as deleteBoardComment,
} from "./board/[postId]/comments/[commentId]/route";

function authedRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

function postContext(postId: string) {
  return { params: Promise.resolve({ postId }) };
}

function commentContext(commentId: string) {
  return { params: Promise.resolve({ commentId }) };
}

function postCommentContext(postId: string, commentId: string) {
  return { params: Promise.resolve({ postId, commentId }) };
}

function expectAuthorShape(value: Record<string, unknown>) {
  expect(Object.keys(value).sort()).toEqual([
    "isMe",
    "label",
    "memberNumber",
  ]);
  expect(value.label).toMatch(/^soulbound-member-\d+$/);
  for (const key of [
    "id",
    "userId",
    "authorId",
    "username",
    "email",
    "role",
    "membership_status",
    "wallet_address",
    "handle",
    "displayName",
    "bio",
    "statement",
    "motivation",
    "referralCode",
    "personaClipAssetId",
    "personaClipHash",
  ]) {
    expect(key in value).toBe(false);
  }
}

function expectPostShape(value: Record<string, unknown>) {
  expect(Object.keys(value).sort()).toEqual([
    "author",
    "body",
    "createdAt",
    "id",
  ]);
  expect(typeof value.id).toBe("string");
  expect(typeof value.body).toBe("string");
  expectAuthorShape(value.author as Record<string, unknown>);
  for (const key of [
    "authorId",
    "username",
    "email",
    "role",
    "membership_status",
    "wallet_address",
    "content_hash",
    "contentHash",
    "previous_hash",
    "storage_ref",
    "deleted_at",
    "statement",
    "motivation",
    "reviewSummary",
    "applicantNotice",
  ]) {
    expect(key in value).toBe(false);
  }
}

function expectCommentShape(value: Record<string, unknown>) {
  expect(Object.keys(value).sort()).toEqual([
    "author",
    "body",
    "createdAt",
    "id",
    "postId",
  ]);
  expectAuthorShape(value.author as Record<string, unknown>);
  for (const key of [
    "authorId",
    "username",
    "email",
    "role",
    "membership_status",
    "wallet_address",
    "content_hash",
    "contentHash",
    "previous_hash",
    "statement",
    "motivation",
  ]) {
    expect(key in value).toBe(false);
  }
}

async function expectPostHashMatches(postId: string): Promise<void> {
  const config = readIntegrationConfig();
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const { data: postRow, error: postError } = await serviceRoleClient
    .from("board_posts")
    .select("author_id,body,created_at,content_hash")
    .eq("id", postId)
    .single();
  if (postError) {
    throw postError;
  }

  const { data: payload, error: payloadError } = await serviceRoleClient.rpc(
    "board_canonical_post_payload",
    {
      p_author_id: postRow.author_id,
      p_body: postRow.body,
      p_created_at: postRow.created_at,
    },
  );
  if (payloadError) {
    throw payloadError;
  }

  const { data: expectedHash, error: hashError } =
    await serviceRoleClient.rpc("board_content_hash", {
      p_payload: payload,
    });
  if (hashError) {
    throw hashError;
  }

  expect(postRow.content_hash).toBe(expectedHash);
}

describe("board route handlers", () => {
  const fixtureUsers: TestSession[] = [];

  afterEach(async () => {
    if (fixtureUsers.length === 0) {
      return;
    }

    try {
      await deleteFixtureUsers(readIntegrationConfig(), fixtureUsers);
    } finally {
      fixtureUsers.length = 0;
    }
  });

  it("handles member-N-only board posting, comments, and moderation gates", async () => {
    const config = readIntegrationConfig();
    const author = await createActiveMember(config, "board-author");
    const other = await createActiveMember(config, "board-other");
    const applicant = await createApplicant(config, "board-applicant");
    const admin = await createAdmin(config, "board-admin");
    const reviewer = await createReviewer(config, "board-reviewer");
    fixtureUsers.push(author, other, applicant, admin, reviewer);

    const nonMemberList = await getBoard(
      authedRequest(applicant.accessToken, "/api/board"),
    );
    expect(nonMemberList.status).toBe(403);

    const createResponse = await postBoard(
      authedRequest(author.accessToken, "/api/board", {
        method: "POST",
        body: JSON.stringify({ body: "hello members" }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const createdPost = await createResponse.json() as Record<string, unknown>;
    expectPostShape(createdPost);
    expect((createdPost.author as { readonly isMe: boolean }).isMe).toBe(true);
    await expectPostHashMatches(createdPost.id as string);

    const nonMemberPost = await postBoard(
      authedRequest(applicant.accessToken, "/api/board", {
        method: "POST",
        body: JSON.stringify({ body: "blocked" }),
      }),
    );
    expect(nonMemberPost.status).toBe(403);

    const listResponse = await getBoard(
      authedRequest(other.accessToken, "/api/board?limit=1"),
    );
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: string | null;
    };
    expect(list.items).toHaveLength(1);
    const listedPost = list.items[0];
    expect(listedPost).toBeDefined();
    expectPostShape(listedPost as Record<string, unknown>);
    expect(((listedPost as Record<string, unknown>).author as { readonly isMe: boolean }).isMe)
      .toBe(false);

    const detailResponse = await getBoardPost(
      authedRequest(other.accessToken, `/api/board/${createdPost.id}`),
      postContext(createdPost.id as string),
    );
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as {
      readonly post: Record<string, unknown>;
      readonly comments: readonly Record<string, unknown>[];
    };
    expectPostShape(detail.post);
    expect(detail.comments).toHaveLength(0);

    const commentResponse = await postBoardComment(
      authedRequest(other.accessToken, `/api/board/${createdPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: "reply as member" }),
      }),
      postContext(createdPost.id as string),
    );
    expect(commentResponse.status).toBe(201);
    const createdComment =
      await commentResponse.json() as Record<string, unknown>;
    expectCommentShape(createdComment);
    expect((createdComment.author as { readonly isMe: boolean }).isMe)
      .toBe(true);

    const otherDeletesPost = await deleteBoardPost(
      authedRequest(other.accessToken, `/api/board/${createdPost.id}`, {
        method: "DELETE",
      }),
      postContext(createdPost.id as string),
    );
    expect(otherDeletesPost.status).toBe(404);

    const authorDeletesOthersComment = await deleteBoardComment(
      authedRequest(
        author.accessToken,
        `/api/board/${createdPost.id}/comments/${createdComment.id}`,
        { method: "DELETE" },
      ),
      postCommentContext(
        createdPost.id as string,
        createdComment.id as string,
      ),
    );
    expect(authorDeletesOthersComment.status).toBe(404);

    const otherDeletesOwnComment = await deleteBoardComment(
      authedRequest(
        other.accessToken,
        `/api/board/${createdPost.id}/comments/${createdComment.id}`,
        { method: "DELETE" },
      ),
      postCommentContext(
        createdPost.id as string,
        createdComment.id as string,
      ),
    );
    expect(otherDeletesOwnComment.status).toBe(200);

    const authorDeletesOwnPost = await deleteBoardPost(
      authedRequest(author.accessToken, `/api/board/${createdPost.id}`, {
        method: "DELETE",
      }),
      postContext(createdPost.id as string),
    );
    expect(authorDeletesOwnPost.status).toBe(200);

    const moderationPostResponse = await postBoard(
      authedRequest(author.accessToken, "/api/board", {
        method: "POST",
        body: JSON.stringify({ body: "moderation target" }),
      }),
    );
    const moderationPost =
      await moderationPostResponse.json() as Record<string, unknown>;

    const reviewerModeration = await deleteAdminPost(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/board/posts/${moderationPost.id}`,
        { method: "DELETE" },
      ),
      postContext(moderationPost.id as string),
    );
    expect(reviewerModeration.status).toBe(403);

    const adminModeration = await deleteAdminPost(
      authedRequest(
        admin.accessToken,
        `/api/admin/board/posts/${moderationPost.id}`,
        { method: "DELETE" },
      ),
      postContext(moderationPost.id as string),
    );
    expect(adminModeration.status).toBe(200);
  });

  it("lets admins hard-delete comments while reviewers cannot", async () => {
    const config = readIntegrationConfig();
    const author = await createActiveMember(config, "board-comment-author");
    const admin = await createAdmin(config, "board-comment-admin");
    const reviewer = await createReviewer(config, "board-comment-reviewer");
    fixtureUsers.push(author, admin, reviewer);

    const createResponse = await postBoard(
      authedRequest(author.accessToken, "/api/board", {
        method: "POST",
        body: JSON.stringify({ body: "comment moderation target" }),
      }),
    );
    const post = await createResponse.json() as Record<string, unknown>;
    const commentResponse = await postBoardComment(
      authedRequest(author.accessToken, `/api/board/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: "remove this comment" }),
      }),
      postContext(post.id as string),
    );
    const comment = await commentResponse.json() as Record<string, unknown>;

    const reviewerModeration = await deleteAdminComment(
      authedRequest(
        reviewer.accessToken,
        `/api/admin/board/comments/${comment.id}`,
        { method: "DELETE" },
      ),
      commentContext(comment.id as string),
    );
    expect(reviewerModeration.status).toBe(403);

    const adminModeration = await deleteAdminComment(
      authedRequest(
        admin.accessToken,
        `/api/admin/board/comments/${comment.id}`,
        { method: "DELETE" },
      ),
      commentContext(comment.id as string),
    );
    expect(adminModeration.status).toBe(200);
  });
});
