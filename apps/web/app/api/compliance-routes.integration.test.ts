import { createServiceRoleSupabaseClient } from "@soulbound/adapters";
import {
  createActiveMember,
  createApplicant,
  createReviewer,
  deleteFixtureUsers,
  readIntegrationConfig,
  type TestSession,
} from "./_integration/fixtures";
import { DELETE as deleteAccount } from "./account/route";
import { GET as listReviewReports } from "./admin/reports/route";
import { POST as resolveReport } from "./admin/reports/[reportId]/resolve/route";
import { GET as getBoard, POST as postBoard } from "./board/route";
import { GET as getBoardPost } from "./board/[postId]/route";
import { POST as postBoardComment } from "./board/[postId]/comments/route";
import { GET as listBlocks, POST as blockMember } from "./blocks/route";
import { DELETE as unblockMember } from "./blocks/[memberNumber]/route";
import { GET as listMembers } from "./members/route";
import { GET as listMyReports, POST as createReport } from "./reports/route";

function authedRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, { ...init, headers });
}

function jsonBody(value: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(value) };
}

interface PostResponse {
  readonly id: string;
  readonly author: { readonly memberNumber: number };
}

async function createPost(session: TestSession, body: string): Promise<PostResponse> {
  const response = await postBoard(
    authedRequest(session.accessToken, "/api/board", jsonBody({ body })),
  );
  expect(response.status).toBe(201);
  return await response.json() as PostResponse;
}

async function boardPostIds(session: TestSession): Promise<string[]> {
  const response = await getBoard(authedRequest(session.accessToken, "/api/board?limit=50"));
  expect(response.status).toBe(200);
  const body = await response.json() as { items: { id: string }[] };
  return body.items.map((item) => item.id);
}

async function memberNumbers(session: TestSession, from: number): Promise<number[]> {
  const response = await listMembers(
    authedRequest(session.accessToken, `/api/members?limit=5&cursor=${from - 1}`),
  );
  expect(response.status).toBe(200);
  const body = await response.json() as { items: { memberNumber: number }[] };
  return body.items.map((item) => item.memberNumber);
}

describe("store compliance routes integration", () => {
  const config = readIntegrationConfig();
  const service = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const fixtures: TestSession[] = [];

  afterAll(async () => {
    await deleteFixtureUsers(config, fixtures);
  });

  it("blocks filter board, comments and the member directory for the blocker only", async () => {
    const blocker = await createActiveMember(config, "blk_a");
    const blocked = await createActiveMember(config, "blk_b");
    fixtures.push(blocker, blocked);

    const blockerPost = await createPost(blocker, "blocker post");
    const blockedPost = await createPost(blocked, "blocked post");
    const blockedNumber = blockedPost.author.memberNumber;
    const commentResponse = await postBoardComment(
      authedRequest(blocked.accessToken, `/api/board/${blockerPost.id}/comments`, jsonBody({ body: "blocked comment" })),
      { params: Promise.resolve({ postId: blockerPost.id }) },
    );
    expect(commentResponse.status).toBe(201);

    expect(await boardPostIds(blocker)).toContain(blockedPost.id);
    expect(await memberNumbers(blocker, blockedNumber)).toContain(blockedNumber);

    const selfBlock = await blockMember(authedRequest(
      blocker.accessToken,
      "/api/blocks",
      jsonBody({ memberNumber: blockerPost.author.memberNumber }),
    ));
    expect(selfBlock.status).toBe(422);

    const blockResponse = await blockMember(authedRequest(
      blocker.accessToken,
      "/api/blocks",
      jsonBody({ memberNumber: blockedNumber }),
    ));
    expect(blockResponse.status).toBe(201);

    const mine = await listBlocks(authedRequest(blocker.accessToken, "/api/blocks"));
    expect((await mine.json() as { items: { memberNumber: number }[] }).items)
      .toEqual([expect.objectContaining({ memberNumber: blockedNumber })]);

    const theirs = await listBlocks(authedRequest(blocked.accessToken, "/api/blocks"));
    expect(await theirs.json()).toEqual({ items: [] });

    expect(await boardPostIds(blocker)).not.toContain(blockedPost.id);
    expect(await memberNumbers(blocker, blockedNumber)).not.toContain(blockedNumber);
    const detail = await getBoardPost(
      authedRequest(blocker.accessToken, `/api/board/${blockedPost.id}`),
      { params: Promise.resolve({ postId: blockedPost.id }) },
    );
    expect(detail.status).toBe(404);
    const ownDetail = await getBoardPost(
      authedRequest(blocker.accessToken, `/api/board/${blockerPost.id}`),
      { params: Promise.resolve({ postId: blockerPost.id }) },
    );
    const ownDetailBody = await ownDetail.json() as { comments?: unknown[] };
    expect(JSON.stringify(ownDetailBody)).not.toContain("blocked comment");

    expect(await boardPostIds(blocked)).toContain(blockerPost.id);

    const unblock = await unblockMember(
      authedRequest(blocker.accessToken, `/api/blocks/${blockedNumber}`, { method: "DELETE" }),
      { params: Promise.resolve({ memberNumber: String(blockedNumber) }) },
    );
    expect(await unblock.json()).toEqual({ unblocked: true });
    expect(await boardPostIds(blocker)).toContain(blockedPost.id);
  });

  it("reports are own-only for reporters and reviewer-resolvable with an audit row", async () => {
    const reporter = await createActiveMember(config, "rpt_a");
    const author = await createActiveMember(config, "rpt_b");
    const reviewer = await createReviewer(config, "rpt_rv");
    const applicant = await createApplicant(config, "rpt_ap");
    fixtures.push(reporter, author, reviewer, applicant);

    const post = await createPost(author, "reportable post");
    const payload = { targetType: "board_post", targetId: post.id, reason: "spam", detail: "광고" };

    const created = await createReport(authedRequest(reporter.accessToken, "/api/reports", jsonBody(payload)));
    expect(created.status).toBe(201);
    const report = await created.json() as { id: string; status: string };
    expect(report.status).toBe("open");

    const duplicate = await createReport(authedRequest(reporter.accessToken, "/api/reports", jsonBody(payload)));
    expect(duplicate.status).toBe(409);

    const applicantReport = await createReport(authedRequest(applicant.accessToken, "/api/reports", jsonBody(payload)));
    expect(applicantReport.status).toBe(403);

    const mine = await listMyReports(authedRequest(reporter.accessToken, "/api/reports"));
    expect((await mine.json() as { items: { id: string }[] }).items.map((item) => item.id)).toEqual([report.id]);
    const others = await listMyReports(authedRequest(author.accessToken, "/api/reports"));
    expect(await others.json()).toEqual({ items: [] });

    const memberList = await listReviewReports(authedRequest(reporter.accessToken, "/api/admin/reports"));
    expect(memberList.status).toBe(403);
    const memberResolve = await resolveReport(
      authedRequest(reporter.accessToken, `/api/admin/reports/${report.id}/resolve`, jsonBody({ status: "dismissed", resolutionCode: "no_violation" })),
      { params: Promise.resolve({ reportId: report.id }) },
    );
    expect(memberResolve.status).toBe(403);

    const reviewList = await listReviewReports(authedRequest(reviewer.accessToken, "/api/admin/reports?status=open"));
    expect(reviewList.status).toBe(200);
    const queue = await reviewList.json() as { items: { id: string; subjectLabel: string | null }[] };
    expect(queue.items.find((item) => item.id === report.id)?.subjectLabel)
      .toBe(`soulbound-member-${post.author.memberNumber}`);

    const resolved = await resolveReport(
      authedRequest(reviewer.accessToken, `/api/admin/reports/${report.id}/resolve`, jsonBody({ status: "resolved", resolutionCode: "content_removed" })),
      { params: Promise.resolve({ reportId: report.id }) },
    );
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toMatchObject({ id: report.id, status: "resolved", resolutionCode: "content_removed" });

    const { data: audit, error } = await service
      .from("audit_logs")
      .select("actor_id, action, reason_code")
      .eq("entity_id", report.id);
    expect(error).toBeNull();
    expect(audit).toEqual([{ actor_id: reviewer.id, action: "report.resolved", reason_code: "content_removed" }]);
  });

  it("deletes only the caller's account and is safe to retry", async () => {
    const deleting = await createActiveMember(config, "del_a");
    const bystander = await createActiveMember(config, "del_b");
    fixtures.push(bystander);

    const bystanderPost = await createPost(bystander, "bystander post");
    const ownPost = await createPost(deleting, "soon gone");
    expect((await blockMember(authedRequest(
      deleting.accessToken,
      "/api/blocks",
      jsonBody({ memberNumber: bystanderPost.author.memberNumber }),
    ))).status).toBe(201);
    const reportResponse = await createReport(authedRequest(
      deleting.accessToken,
      "/api/reports",
      jsonBody({ targetType: "board_post", targetId: bystanderPost.id, reason: "other" }),
    ));
    const report = await reportResponse.json() as { id: string };

    const unconfirmed = await deleteAccount(authedRequest(deleting.accessToken, "/api/account", { method: "DELETE", body: "{}" }));
    expect(unconfirmed.status).toBe(422);

    const deleted = await deleteAccount(authedRequest(
      deleting.accessToken,
      "/api/account",
      { method: "DELETE", body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }) },
    ));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ deleted: true, personaClipsRemoved: 0 });

    const { data: authUser } = await service.auth.admin.getUserById(deleting.id);
    expect(authUser.user).toBeNull();
    const { data: profiles } = await service.from("profiles").select("id").eq("id", deleting.id);
    expect(profiles).toEqual([]);
    const { data: posts } = await service.from("board_posts").select("id").eq("id", ownPost.id);
    expect(posts).toEqual([]);
    const { data: blocks } = await service.from("blocks").select("blocker_id").eq("blocker_id", deleting.id);
    expect(blocks).toEqual([]);
    const { data: reports } = await service.from("reports").select("reporter_id").eq("id", report.id);
    expect(reports).toEqual([{ reporter_id: null }]);
    const { data: requested } = await service
      .from("audit_logs")
      .select("action, reason_code")
      .eq("entity_id", deleting.id)
      .eq("action", "account.deletion_requested");
    expect(requested).toEqual([{
      action: "account.deletion_requested",
      reason_code: "user_requested",
    }]);
    const { data: audit } = await service
      .from("audit_logs")
      .select("action, reason_code, metadata")
      .eq("entity_id", deleting.id)
      .eq("action", "account.deleted");
    expect(audit).toHaveLength(1);
    expect(audit?.[0]?.reason_code).toBe("user_requested");

    const { data: bystanderProfile } = await service.from("profiles").select("id").eq("id", bystander.id);
    expect(bystanderProfile).toHaveLength(1);
    expect(await boardPostIds(bystander)).toContain(bystanderPost.id);

    const retry = await deleteAccount(authedRequest(
      deleting.accessToken,
      "/api/account",
      { method: "DELETE", body: JSON.stringify({ confirm: "DELETE_MY_ACCOUNT" }) },
    ));
    expect(retry.status).toBe(401);
  });
});
