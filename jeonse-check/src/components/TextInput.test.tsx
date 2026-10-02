import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { TextInput } from "./TextInput";

describe("TextInput", () => {
  it("라벨을 필드 안 위에 쌓고 input과 연결한다", () => {
    render(<TextInput label="보증금" defaultValue="2억" />);
    const input = screen.getByLabelText("보증금");

    expect(input).toHaveValue("2억");
    expect(input).toHaveClass("text-body-md");
    expect(screen.getByText("보증금")).toHaveClass("text-caption", "text-muted");
  });

  it("기본 테두리는 1px hairline이고 포커스는 2px 잉크 테두리다", () => {
    render(<TextInput label="주소" />);
    const box = screen.getByTestId("text-input-box");

    expect(box).toHaveClass("h-input", "rounded-input", "border", "border-hairline", "focus-within:border-2", "focus-within:border-ink");
    expect(box.className).not.toMatch(/\bring\b|ring-/);
  });

  it("오류가 있으면 테두리와 아래 문구를 error-text로 표시하고 input에 연결한다", () => {
    render(<TextInput label="보증금" error="금액을 확인해 주세요" />);
    const input = screen.getByLabelText("보증금");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("금액을 확인해 주세요");
    expect(screen.getByText("금액을 확인해 주세요")).toHaveClass("text-error-text");
    expect(screen.getByTestId("text-input-box")).toHaveClass("border-error-text");
  });

  it("오류가 없으면 도움말을 설명으로 연결한다", () => {
    render(<TextInput label="보증금" hint="= 2억 8,000만" />);

    expect(screen.getByLabelText("보증금")).toHaveAccessibleDescription("= 2억 8,000만");
    expect(screen.getByLabelText("보증금")).not.toHaveAttribute("aria-invalid");
  });

  it("비활성이면 surface-soft 배경이다", () => {
    render(<TextInput label="주소" disabled />);

    expect(screen.getByLabelText("주소")).toBeDisabled();
    expect(screen.getByTestId("text-input-box")).toHaveClass("bg-surface-soft");
  });

  it("오른쪽 끝에 보조 요소를 둘 수 있다", () => {
    render(<TextInput label="주소" trailing={<button type="button">검색</button>} />);

    expect(screen.getByRole("button", { name: "검색" })).toBeInTheDocument();
  });

  it("segment 모양은 desktop에서 테두리 없는 알약 세그먼트가 된다", () => {
    render(<TextInput label="주소" segment />);
    const box = screen.getByTestId("text-input-box");

    expect(box).toHaveClass("desktop:rounded-full", "desktop:border-0", "desktop:focus-within:bg-surface-soft");
  });

  it("ref는 안쪽 input에 붙는다", () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextInput label="보증금" ref={ref} />);

    expect(ref.current).toBe(screen.getByLabelText("보증금"));
  });
});
