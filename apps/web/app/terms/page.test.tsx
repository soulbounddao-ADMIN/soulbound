// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import TermsPage from "./page";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function expectTermsText(fragment: string) {
  expect(screen.getAllByText((_, node) =>
    normalizeText(node?.textContent).includes(fragment)
  ).length).toBeGreaterThan(0);
}

describe("TermsPage", () => {
  afterEach(() => cleanup());

  it("renders the alpha terms with implemented guarantees", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", {
      level: 1,
      name: "이용약관",
    })).toBeTruthy();
    expectTermsText(
      "운영진은 회원이 실제로 누구인지 알 수 있는 정보를 보유하지 않습니다.",
    );
    expectTermsText(
      "비밀번호를 분실하면 계정과 멤버십을 복구할 수 없습니다.",
    );
    expectTermsText(
      "Persona Clip 영상 원본은 자동 삭제 절차로 지워집니다.",
    );
    expectTermsText("만 14세 미만은 가입할 수 없습니다.");
  });
});
