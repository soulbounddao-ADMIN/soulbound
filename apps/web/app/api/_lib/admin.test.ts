import type { Actor } from "@soulbound/core";
import { requireReviewer } from "./admin";

function actor(role: Actor["role"]): Actor {
  return {
    id: `${role}-id`,
    role,
  };
}

describe("admin helpers", () => {
  it("allows reviewer and admin actors", () => {
    expect(requireReviewer(actor("reviewer"))).toBeNull();
    expect(requireReviewer(actor("admin"))).toBeNull();
  });

  it("rejects applicant and member actors", async () => {
    const applicantResponse = requireReviewer(actor("applicant"));
    const memberResponse = requireReviewer(actor("member"));

    expect(applicantResponse?.status).toBe(403);
    expect(memberResponse?.status).toBe(403);
    await expect(applicantResponse?.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });
});
