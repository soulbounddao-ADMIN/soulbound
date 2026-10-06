export interface BoardAuthor {
  readonly memberNumber: number;
  readonly label: string;
  readonly isMe: boolean;
}

export interface BoardPost {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: BoardAuthor;
}

export interface BoardComment {
  readonly id: string;
  readonly postId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly author: BoardAuthor;
}

export interface BoardPostDetail {
  readonly post: BoardPost;
  readonly comments: readonly BoardComment[];
}

export interface BoardListInput {
  readonly limit: number;
  readonly cursor: string | null;
}

export interface BoardListResult {
  readonly items: readonly BoardPost[];
  readonly nextCursor: string | null;
}

export interface BoardRepository {
  getMyMemberNumber(userId: string): Promise<number | null>;
  listPosts(input: BoardListInput, myMemberNumber: number | null): Promise<BoardListResult>;
  createPost(userId: string, body: string, myMemberNumber: number | null): Promise<BoardPost>;
  getPostWithComments(postId: string, myMemberNumber: number | null): Promise<BoardPostDetail | null>;
  addComment(postId: string, userId: string, body: string, myMemberNumber: number | null): Promise<BoardComment>;
  deleteOwnPost(postId: string): Promise<boolean>;
  deleteOwnComment(commentId: string): Promise<boolean>;
  hardDeletePost(postId: string): Promise<boolean>;
  hardDeleteComment(commentId: string): Promise<boolean>;
}
