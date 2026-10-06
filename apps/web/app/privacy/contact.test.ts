import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRIVACY_CONTACT_EMAIL,
  privacyContactEmail,
} from "./contact";

describe("privacyContactEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the default when missing or blank", () => {
    expect(privacyContactEmail(undefined)).toBe(DEFAULT_PRIVACY_CONTACT_EMAIL);
    expect(privacyContactEmail(null)).toBe(DEFAULT_PRIVACY_CONTACT_EMAIL);
    expect(privacyContactEmail("")).toBe(DEFAULT_PRIVACY_CONTACT_EMAIL);
    expect(privacyContactEmail("   ")).toBe(DEFAULT_PRIVACY_CONTACT_EMAIL);

    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL", "  ");
    expect(privacyContactEmail()).toBe("soulbound.dao@gmail.com");
  });

  it("trims an explicit or environment override", () => {
    expect(privacyContactEmail("  privacy@example.com  ")).toBe(
      "privacy@example.com",
    );

    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL", " ops@example.com ");
    expect(privacyContactEmail()).toBe("ops@example.com");
  });
});
