import { buildReportLink, filterBlocked, parseBlockedMembers, toggleBlocked } from "../lib/safety";
import { formatCandidateToken, isClosingSoon, voteOutcomeLabel } from "../domain/format";

describe("report link", () => {
  it("returns null when not configured", () => {
    expect(buildReportLink("", { kind: "post", id: "p1" })).toBeNull();
  });

  it("builds a mailto with subject and body", () => {
    const link = buildReportLink("mailto:report@example.com", { kind: "comment", id: "c1", memberLabel: "soulbound-member-3" });
    expect(link).toMatch(/^mailto:report@example\.com\?subject=/);
    expect(decodeURIComponent(link ?? "")).toContain("ID: c1");
  });

  it("appends query params to a URL", () => {
    expect(buildReportLink("https://x.test/report?a=1", { kind: "member", id: "7" })).toBe(
      "https://x.test/report?a=1&type=member&id=7",
    );
  });
});

describe("local block list", () => {
  it("parses defensively and toggles", () => {
    expect(parseBlockedMembers("not json")).toEqual([]);
    expect(parseBlockedMembers("[1, 1, \"2\", 3.5, 4]")).toEqual([1, 4]);
    expect(toggleBlocked([1], 2)).toEqual([1, 2]);
    expect(toggleBlocked([1, 2], 1)).toEqual([2]);
  });

  it("hides blocked authors but never the viewer", () => {
    const items = [
      { id: "a", author: { memberNumber: 1, isMe: false } },
      { id: "b", author: { memberNumber: 2, isMe: true } },
      { id: "c", author: { memberNumber: 3, isMe: false } },
    ];
    expect(filterBlocked(items, [1, 2]).map((item) => item.id)).toEqual(["b", "c"]);
  });
});

describe("format", () => {
  it("formats votes", () => {
    expect(formatCandidateToken("candidate-42")).toBe("신청 #42");
    expect(voteOutcomeLabel("approved")).toBe("가결");
    expect(voteOutcomeLabel(null)).toBeNull();
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(isClosingSoon("2026-01-01T12:00:00Z", now)).toBe(true);
    expect(isClosingSoon("2026-01-03T00:00:00Z", now)).toBe(false);
  });
});
