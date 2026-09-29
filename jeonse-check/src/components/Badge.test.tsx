import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("흰 알약에 text-badge와 shadow-float를 쓴다", () => {
    render(<Badge>주의</Badge>);
    const badge = screen.getByText("주의");

    expect(badge).toHaveClass("rounded-full", "bg-canvas", "text-badge", "shadow-float", "text-ink");
  });

  it("error 톤이면 글자를 error-text로 쓴다", () => {
    render(<Badge tone="error">위험</Badge>);

    expect(screen.getByText("위험")).toHaveClass("text-error-text");
    expect(screen.getByText("위험")).not.toHaveClass("text-ink");
  });
});
