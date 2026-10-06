// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage, { metadata } from "./page";

function pageText(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

describe("PrivacyPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("publishes the final policy with the default contact email", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL", "");
    render(<PrivacyPage />);

    expect(metadata.title).toBe("개인정보 처리방침");
    expect(screen.getByRole("heading", {
      level: 1,
      name: "개인정보 처리방침",
    }).id).toBe("privacy-title");
    expect(document.querySelector("article")?.getAttribute("aria-labelledby"))
      .toBe("privacy-title");

    const text = pageText();
    expect(text).not.toMatch(/초안/);
    expect(text).not.toMatch(/DRAFT/);
    expect(text).not.toMatch(/TODO/);
    expect(text).toContain("2026년 10월 6일");
    expect(text).toContain("soulbound.dao@gmail.com");
    expect(screen.getByRole("link", { name: "이용약관" }).getAttribute("href"))
      .toBe("/terms");
  });

  it("shows a trimmed contact email from the environment", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL", " privacy@example.com ");
    render(<PrivacyPage />);

    const text = pageText();
    expect(text).toContain("privacy@example.com");
    expect(text).not.toContain("soulbound.dao@gmail.com");
  });
});
