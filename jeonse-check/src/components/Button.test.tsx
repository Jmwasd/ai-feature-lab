import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("기본 변형은 primary이고 공통 사양 클래스를 가진다", () => {
    render(<Button>지금 확인하기</Button>);
    const button = screen.getByRole("button", { name: "지금 확인하기" });

    expect(button).toHaveClass("min-h-control", "px-lg", "rounded-button", "text-button-md");
    expect(button).toHaveClass("bg-primary", "text-on-primary", "active:bg-primary-active", "disabled:bg-primary-disabled");
    expect(button).toHaveAttribute("type", "button");
  });

  it("secondary는 흰 바탕에 1px 잉크 테두리다", () => {
    render(<Button variant="secondary">이용 방법 보기</Button>);
    const button = screen.getByRole("button");

    expect(button).toHaveClass("bg-canvas", "text-ink", "border", "border-ink", "rounded-button");
    expect(button).not.toHaveClass("bg-primary");
  });

  it("tertiary-text는 밑줄이고 패딩이 없다", () => {
    render(<Button variant="tertiary-text">더 보기</Button>);
    const button = screen.getByRole("button");

    expect(button).toHaveClass("underline", "p-0", "text-button-md");
    expect(button).not.toHaveClass("px-lg", "bg-primary");
  });

  it("pill-primary는 알약 모양에 작은 버튼 글자다", () => {
    render(<Button variant="pill-primary">저장</Button>);
    const button = screen.getByRole("button");

    expect(button).toHaveClass("rounded-full", "text-button-sm", "bg-primary", "min-h-control", "px-lg");
    expect(button).not.toHaveClass("rounded-button", "text-button-md");
  });

  it("href가 없으면 button 요소로 렌더링하고 속성을 넘긴다", () => {
    render(
      <Button type="submit" disabled>
        저장
      </Button>,
    );
    const button = screen.getByRole("button", { name: "저장" });

    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
  });

  it("href가 있으면 링크로 렌더링한다", () => {
    render(
      <Button href="/#flow" variant="secondary">
        이용 방법 보기
      </Button>,
    );
    const link = screen.getByRole("link", { name: "이용 방법 보기" });

    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/#flow");
    expect(link).toHaveClass("border-ink");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("className을 사양 클래스 뒤에 덧붙인다", () => {
    render(<Button className="w-full">확인</Button>);

    expect(screen.getByRole("button")).toHaveClass("w-full", "bg-primary");
  });
});
