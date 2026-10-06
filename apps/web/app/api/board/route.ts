import {
  dependencyFailure,
  jsonResponse,
  validationError,
} from "../_lib/http";
import {
  boardListQuerySchema,
  createBoardPostSchema,
} from "../_lib/schemas";
import { requireActiveBoardContext } from "./_lib/board-context";

export async function GET(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveBoardContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const query = boardListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return validationError(query.error.message);
    }

    return jsonResponse(await authorized.boardRepo.listPosts(
      query.data,
      authorized.myMemberNumber,
    ));
  } catch (error) {
    return dependencyFailure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveBoardContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const body = createBoardPostSchema.safeParse(await request.json());
    if (!body.success) {
      return validationError(body.error.message);
    }

    return jsonResponse(await authorized.boardRepo.createPost(
      authorized.userId,
      body.data.body,
      authorized.myMemberNumber,
    ), 201);
  } catch (error) {
    return dependencyFailure(error);
  }
}
