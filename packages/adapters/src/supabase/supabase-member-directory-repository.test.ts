import { memberDirectorySelect } from "./supabase-member-directory-repository";

describe("SupabaseMemberDirectoryRepository helpers", () => {
  it("selects only public member-number directory columns", () => {
    expect(memberDirectorySelect.split(",")).toEqual([
      "member_number",
      "created_at",
    ]);
    expect(memberDirectorySelect).not.toContain("username");
    expect(memberDirectorySelect).not.toContain("email");
    expect(memberDirectorySelect).not.toContain("handle");
    expect(memberDirectorySelect).not.toContain("display_name");
    expect(memberDirectorySelect).not.toContain("bio");
    expect(memberDirectorySelect).not.toContain("avatar_url");
    expect(memberDirectorySelect).not.toContain("role");
    expect(memberDirectorySelect).not.toContain("wallet");
    expect(memberDirectorySelect).not.toContain("id");
  });
});
