import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("컴포넌트 테스트 환경", () => {
  it("jsdom에서 요소를 렌더링하고 jest-dom matcher로 확인한다", () => {
    render(<p>위험 신호 0개</p>);

    expect(screen.getByText("위험 신호 0개")).toBeInTheDocument();
  });
});
