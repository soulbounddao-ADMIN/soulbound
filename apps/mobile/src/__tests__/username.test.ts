import { isValidUsername, normalizeUsername, usernameToSyntheticEmail } from "../auth/username";

describe("username", () => {
  it("normalizes and builds the synthetic email like the web", () => {
    expect(normalizeUsername("  Alice_01 ")).toBe("alice_01");
    expect(usernameToSyntheticEmail(" Alice_01 ")).toBe("alice_01@soulbound.internal");
  });

  it("rejects invalid usernames", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("-abc")).toBe(false);
    expect(isValidUsername("a".repeat(25))).toBe(false);
    expect(() => usernameToSyntheticEmail("한글")).toThrow("Invalid username");
  });
});
