// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./tab-bar";

describe("TabBar", () => {
  afterEach(() => cleanup());

  it("renders visible labels and keeps accessible tab names", () => {
    const onChange = vi.fn();

    render(
      <TabBar
        label="멤버 탐색"
        activeId="members"
        onChange={onChange}
        items={[
          { id: "members", label: "멤버", icon: <span>M</span> },
          { id: "votes", label: "투표", icon: <span>V</span>, badge: "3" },
          { id: "board", label: "게시판", icon: <span>B</span> },
          { id: "more", label: "더보기", icon: <span>O</span> },
        ]}
      />,
    );

    const members = screen.getByRole("tab", { name: "멤버" });
    expect(members.textContent).toContain("M");
    expect(members.textContent).toContain("멤버");
    expect(members.hasAttribute("aria-label")).toBe(false);
    expect(members.getAttribute("aria-selected")).toBe("true");
    const votes = screen.getByRole("tab", { name: "투표" });
    expect(votes.textContent).toContain("3");
    expect(votes.getAttribute("aria-label")).toBeNull();
    expect(
      screen.getByRole("tablist", { name: "멤버 탐색" })
        .getAttribute("style"),
    ).toContain("--tab-count: 4");

    fireEvent.click(screen.getByRole("tab", { name: "더보기" }));
    expect(onChange).toHaveBeenCalledWith("more");
  });
});
