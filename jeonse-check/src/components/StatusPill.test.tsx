import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("알약 안에 6px 레드 점과 내용을 둔다", () => {
    render(<StatusPill>공공데이터 3종 자동 조회</StatusPill>);
    const pill = screen.getByText("공공데이터 3종 자동 조회");

    expect(pill).toHaveClass("rounded-full", "bg-surface-soft", "border", "border-hairline-soft", "text-caption");
    const dot = pill.querySelector("[aria-hidden='true']");
    expect(dot).toHaveClass("size-1.5", "rounded-full", "bg-primary");
    expect(pill.firstElementChild).toBe(dot);
  });
});
