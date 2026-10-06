import {
  createPersonaClipSchema,
  deletePersonaClipQuerySchema,
  memberDirectoryQuerySchema,
  boardListQuerySchema,
  createBoardCommentSchema,
  createBoardPostSchema,
  reviewDecisionSchema,
  reviewQueueQuerySchema,
  resubmitApplicationSchema,
  startReviewSchema,
  submitApplicationSchema,
} from "./schemas";

describe("submitApplicationSchema", () => {
  it("requires an idempotency key", () => {
    const parsed = submitApplicationSchema.safeParse({
      applicantStatement: "hello",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects actor and dormant dossier fields from callers", () => {
    const parsed = submitApplicationSchema.parse({
      idempotencyKey: "idem",
    });

    expect(parsed.idempotencyKey).toBe("idem");
    expect(submitApplicationSchema.safeParse({
      applicantId: "not-the-actor",
      idempotencyKey: "idem",
    }).success).toBe(false);
    expect(submitApplicationSchema.safeParse({
      motivation: "hello",
      idempotencyKey: "idem",
    }).success).toBe(false);
    expect(submitApplicationSchema.safeParse({
      referralCode: "REF",
      idempotencyKey: "idem",
    }).success).toBe(false);
  });
});

describe("resubmitApplicationSchema", () => {
  it("requires idempotency and rejects caller-supplied applicant identity", () => {
    expect(resubmitApplicationSchema.safeParse({
      applicantStatement: "보완 내용",
    }).success).toBe(false);

    expect(resubmitApplicationSchema.safeParse({
      applicantId: "not-the-actor",
      applicantStatement: "보완 내용",
      idempotencyKey: "resubmit-1",
    }).success).toBe(false);
  });

  it("trims and bounds the optional applicant statement", () => {
    expect(resubmitApplicationSchema.parse({
      applicantStatement: " 보완 내용 ",
      idempotencyKey: "resubmit-1",
    })).toEqual({
      applicantStatement: "보완 내용",
      idempotencyKey: "resubmit-1",
    });

    expect(resubmitApplicationSchema.safeParse({
      applicantStatement: "a".repeat(1201),
      idempotencyKey: "resubmit-1",
    }).success).toBe(false);
  });
});

describe("board schemas", () => {
  it("coerces bounded board list query params", () => {
    expect(boardListQuerySchema.parse({})).toEqual({
      limit: 20,
      cursor: null,
    });
    expect(boardListQuerySchema.parse({
      limit: "10",
      cursor: "2026-06-25T00%3A00%3A00.000Z_11111111-1111-4111-8111-111111111111",
    })).toEqual({
      limit: 10,
      cursor: "2026-06-25T00%3A00%3A00.000Z_11111111-1111-4111-8111-111111111111",
    });
    expect(boardListQuerySchema.safeParse({ limit: "51" }).success)
      .toBe(false);
  });

  it("validates board post and comment bodies", () => {
    expect(createBoardPostSchema.parse({ body: " hello " }))
      .toEqual({ body: "hello" });
    expect(createBoardCommentSchema.parse({ body: " reply " }))
      .toEqual({ body: "reply" });
    expect(createBoardPostSchema.safeParse({
      body: "",
    }).success).toBe(false);
    expect(createBoardCommentSchema.safeParse({
      body: "",
      authorId: "not-allowed",
    }).success).toBe(false);
  });
});

describe("admin route schemas", () => {
  it("validates review start and decision bodies", () => {
    expect(startReviewSchema.parse({ idempotencyKey: "review-1" }))
      .toEqual({ idempotencyKey: "review-1" });

    expect(reviewDecisionSchema.parse({
      reasonCode: "meets_phase1_policy",
      reviewSummary: "internal",
      idempotencyKey: "approve-1",
    })).toEqual({
      reasonCode: "meets_phase1_policy",
      reviewSummary: "internal",
      idempotencyKey: "approve-1",
    });
  });

  it("rejects unknown reason codes and statuses", () => {
    expect(reviewDecisionSchema.safeParse({
      reasonCode: "free_text_reason",
      idempotencyKey: "bad-reason",
    }).success).toBe(false);

    expect(reviewQueueQuerySchema.safeParse({
      status: "not_a_status",
    }).success).toBe(false);
  });

  it("coerces and bounds review queue query params", () => {
    expect(reviewQueueQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(reviewQueueQuerySchema.parse({
      status: "submitted",
      limit: "25",
      cursor: "2026-01-01T00:00:00.000Z",
    })).toEqual({
      status: "submitted",
      limit: 25,
      cursor: "2026-01-01T00:00:00.000Z",
    });
    expect(reviewQueueQuerySchema.safeParse({ limit: "101" }).success)
      .toBe(false);
  });
});

describe("persona clip schemas", () => {
  it("accepts supported private-bucket mime types", () => {
    expect(createPersonaClipSchema.parse({
      contentHash: "abc12345",
      mimeType: "video/webm",
      durationSeconds: 12,
    })).toEqual({
      contentHash: "abc12345",
      mimeType: "video/webm",
      durationSeconds: 12,
    });
  });

  it("rejects path-like hashes and unsupported mime types", () => {
    expect(createPersonaClipSchema.safeParse({
      contentHash: "../abc12345",
      mimeType: "video/webm",
    }).success).toBe(false);

    expect(createPersonaClipSchema.safeParse({
      contentHash: "abc12345",
      mimeType: "image/png",
    }).success).toBe(false);
  });

  it("validates persona clip delete query params", () => {
    expect(deletePersonaClipQuerySchema.parse({
      assetId: "11111111-1111-4111-8111-111111111111",
    })).toEqual({
      assetId: "11111111-1111-4111-8111-111111111111",
    });
    expect(deletePersonaClipQuerySchema.safeParse({
      assetId: "not-a-uuid",
    }).success).toBe(false);
  });
});

describe("member directory schemas", () => {
  it("coerces bounded list query params and numeric cursors", () => {
    expect(memberDirectoryQuerySchema.parse({})).toEqual({
      limit: 50,
      cursor: null,
    });
    expect(memberDirectoryQuerySchema.parse({
      limit: "25",
      cursor: "12",
    })).toEqual({
      limit: 25,
      cursor: 12,
    });
    expect(memberDirectoryQuerySchema.safeParse({ limit: "51" }).success)
      .toBe(false);
    expect(memberDirectoryQuerySchema.safeParse({ cursor: "member_1" }).success)
      .toBe(false);
  });
});
