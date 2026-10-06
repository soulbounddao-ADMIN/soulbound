import type { SupabaseAdapterClient } from "@soulbound/adapters";

import type {
  BoardComment,
  BoardListInput,
  BoardListResult,
  BoardPost,
  BoardPostDetail,
  BoardRepository,
} from "./board-types";

interface BoardPostRow {
  readonly id: string;
  readonly body: string;
  readonly created_at: string;
  readonly member_number?: number | string | null;
}

interface BoardCommentRow {
  readonly id: string;
  readonly post_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly member_number?: number | string | null;
}

interface MyMemberNumberRow {
  readonly member_number?: number | string | null;
}

interface BoardCursor {
  readonly createdAt: string;
  readonly id: string;
}

function throwIfError(error: unknown): void {
  if (error) {
    throw error;
  }
}

function toMemberNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error("board row requires author member_number");
}

function maybeMemberNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function boardMemberLabel(memberNumber: number): string {
  return `soulbound-member-${memberNumber}`;
}

function encodeCursor(cursor: BoardCursor): string {
  return `${encodeURIComponent(cursor.createdAt)}_${cursor.id}`;
}

function decodeCursor(value: string | null): BoardCursor | null {
  if (!value) {
    return null;
  }

  const separator = value.lastIndexOf("_");
  if (separator <= 0 || separator >= value.length - 1) {
    throw new Error("invalid board cursor");
  }

  return {
    createdAt: decodeURIComponent(value.slice(0, separator)),
    id: value.slice(separator + 1),
  };
}

function mapPost(row: BoardPostRow, myMemberNumber: number | null): BoardPost {
  const memberNumber = toMemberNumber(row.member_number);
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      memberNumber,
      label: boardMemberLabel(memberNumber),
      isMe: myMemberNumber !== null && memberNumber === myMemberNumber,
    },
  };
}

function mapComment(
  row: BoardCommentRow,
  myMemberNumber: number | null,
): BoardComment {
  const memberNumber = toMemberNumber(row.member_number);
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      memberNumber,
      label: boardMemberLabel(memberNumber),
      isMe: myMemberNumber !== null && memberNumber === myMemberNumber,
    },
  };
}

export class SupabaseBoardRepository implements BoardRepository {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async getMyMemberNumber(userId: string): Promise<number | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("member_number")
      .eq("id", userId)
      .maybeSingle();

    throwIfError(error);
    return maybeMemberNumber(
      (data as unknown as MyMemberNumberRow | null)?.member_number,
    );
  }

  async listPosts(
    input: BoardListInput,
    myMemberNumber: number | null,
  ): Promise<BoardListResult> {
    const cursor = decodeCursor(input.cursor);
    const { data, error } = await this.client.rpc("list_board_posts", {
      p_limit: input.limit + 1,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    });
    throwIfError(error);

    const rows = (data ?? []) as unknown as BoardPostRow[];
    const pageRows = rows.slice(0, input.limit);
    const items = pageRows.map((row) => mapPost(row, myMemberNumber));
    const lastRow = pageRows[pageRows.length - 1];
    return {
      items,
      nextCursor: rows.length > input.limit && lastRow
        ? encodeCursor({ createdAt: lastRow.created_at, id: lastRow.id })
        : null,
    };
  }

  async createPost(
    userId: string,
    body: string,
    myMemberNumber: number | null,
  ): Promise<BoardPost> {
    const id = crypto.randomUUID();
    const { error } = await this.client
      .from("board_posts")
      .insert({ id, author_id: userId, body });

    throwIfError(error);
    const { data: postData, error: postError } = await this.client
      .rpc("get_board_post", { p_post_id: id })
      .single();

    throwIfError(postError);
    return mapPost(postData as unknown as BoardPostRow, myMemberNumber);
  }

  async getPostWithComments(
    postId: string,
    myMemberNumber: number | null,
  ): Promise<BoardPostDetail | null> {
    const { data: postData, error: postError } = await this.client
      .rpc("get_board_post", { p_post_id: postId })
      .maybeSingle();

    throwIfError(postError);
    if (!postData) {
      return null;
    }

    const { data: commentData, error: commentError } = await this.client
      .rpc("list_board_comments", { p_post_id: postId });

    throwIfError(commentError);
    return {
      post: mapPost(postData as unknown as BoardPostRow, myMemberNumber),
      comments: ((commentData ?? []) as unknown as BoardCommentRow[])
        .map((row) => mapComment(row, myMemberNumber)),
    };
  }

  async addComment(
    postId: string,
    userId: string,
    body: string,
    myMemberNumber: number | null,
  ): Promise<BoardComment> {
    const id = crypto.randomUUID();
    const { error } = await this.client
      .from("board_comments")
      .insert({ id, post_id: postId, author_id: userId, body });

    throwIfError(error);
    const { data: commentData, error: commentError } = await this.client
      .rpc("list_board_comments", { p_post_id: postId });

    throwIfError(commentError);
    const nextComment = ((commentData ?? []) as unknown as BoardCommentRow[])
      .find((row) => row.id === id);
    if (!nextComment) {
      throw new Error("inserted board comment was not visible");
    }
    return mapComment(
      nextComment,
      myMemberNumber,
    );
  }

  async deleteOwnPost(postId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("board_posts")
      .delete()
      .eq("id", postId)
      .select("id");

    throwIfError(error);
    return (data ?? []).length > 0;
  }

  async deleteOwnComment(commentId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("board_comments")
      .delete()
      .eq("id", commentId)
      .select("id");

    throwIfError(error);
    return (data ?? []).length > 0;
  }

  async hardDeletePost(postId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("board_posts")
      .delete()
      .eq("id", postId)
      .select("id");

    throwIfError(error);
    return (data ?? []).length > 0;
  }

  async hardDeleteComment(commentId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("board_comments")
      .delete()
      .eq("id", commentId)
      .select("id");

    throwIfError(error);
    return (data ?? []).length > 0;
  }
}
