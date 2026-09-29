import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButtonCircle } from "./IconButtonCircle";

describe("IconButtonCircle", () => {
  it("label을 접근성 이름으로 쓰고 아이콘은 읽지 않는다", () => {
    render(<IconButtonCircle label="뒤로 가기" icon={<svg data-testid="icon" />} />);
    const button = screen.getByRole("button", { name: "뒤로 가기" });

    expect(button).toHaveAttribute("aria-label", "뒤로 가기");
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("32px 원에 surface-strong 바탕과 1px hairline 테두리다", () => {
    render(<IconButtonCircle label="닫기" icon={<svg />} />);
    const button = screen.getByRole("button", { name: "닫기" });

    expect(button).toHaveClass("size-8", "rounded-full", "bg-surface-strong", "border", "border-hairline");
    expect(button).toHaveAttribute("type", "button");
  });

  it("버튼 속성과 이벤트를 넘긴다", async () => {
    const onClick = vi.fn();
    render(<IconButtonCircle label="닫기" icon={<svg />} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
