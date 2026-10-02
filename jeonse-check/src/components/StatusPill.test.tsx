import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("soft 알약 안에 내용만 둔다", () => {
    render(<StatusPill>공공데이터로 계산하는 전세 위험도</StatusPill>);
    const pill = screen.getByText("공공데이터로 계산하는 전세 위험도");

    expect(pill).toHaveClass("rounded-full", "bg-surface-soft", "border", "border-hairline-soft", "text-caption");
    expect(pill.children).toHaveLength(0);
  });
});
