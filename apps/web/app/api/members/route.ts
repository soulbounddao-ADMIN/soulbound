import {
  forbidden,
} from "@soulbound/core";
import {
  type ListActiveMembersResult,
  makeSupabaseMembershipRepository,
  makeUserScopedMemberDirectoryRepository,
} from "@soulbound/adapters";
import { resolveUserContext } from "../_lib/auth";
import {
  appErrorResponse,
  dependencyFailure,
  jsonResponse,
  unauthorized,
  validationError,
} from "../_lib/http";
import { memberDirectoryQuerySchema } from "../_lib/schemas";

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

function memberLabel(memberNumber: number): string {
  return `soulbound-member-${memberNumber}`;
}

async function requireActiveMemberDirectory(request: Request) {
  const context = await resolveUserContext(request);
  if (!context) {
    return { response: unauthorized() } as const;
  }

  const membership =
    await makeSupabaseMembershipRepository(context.client)
      .findByUserId(context.userId);
  if (membership?.status !== "active") {
    return {
      response: appErrorResponse(forbidden("active membership required")),
    } as const;
  }

  return {
    userId: context.userId,
    memberDirectoryRepo: makeUserScopedMemberDirectoryRepository(
      context.client,
    ),
  } as const;
}

function attachIsMe(
  result: ListActiveMembersResult,
  myMemberNumber: number | null,
): MemberDirectoryResponse {
  return {
    myMemberNumber,
    myLabel: myMemberNumber === null ? null : memberLabel(myMemberNumber),
    items: result.items.map((member) => ({
      memberNumber: member.memberNumber,
      label: member.label,
      createdAt: member.createdAt,
      isMe: myMemberNumber !== null
        && member.memberNumber === myMemberNumber,
    })),
    nextCursor: result.nextCursor,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const authorized = await requireActiveMemberDirectory(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const query = memberDirectoryQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success) {
      return validationError(query.error.message);
    }

    const [myMemberNumber, directory] = await Promise.all([
      authorized.memberDirectoryRepo.getMyMemberNumber(authorized.userId),
      authorized.memberDirectoryRepo.listActiveMembers({
        limit: query.data.limit,
        cursor: query.data.cursor,
      }),
    ]);

    return jsonResponse(attachIsMe(directory, myMemberNumber));
  } catch (error) {
    return dependencyFailure(error);
  }
}
