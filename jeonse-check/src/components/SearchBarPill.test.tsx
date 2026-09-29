import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchBarPill } from "./SearchBarPill";

describe("SearchBarPill", () => {
  it("desktop에서 h-search 알약에 hairline 테두리와 shadow-float를 준다", () => {
    render(
      <SearchBarPill orb={<button type="submit">조회하기</button>}>
        <span>주소</span>
        <span>보증금</span>
      </SearchBarPill>,
    );
    const pill = screen.getByTestId("search-bar-pill");

    expect(pill).toHaveClass("desktop:h-search", "desktop:rounded-full", "desktop:border", "desktop:border-hairline", "desktop:shadow-float");
    // 모바일에서는 세로 스택이다.
    expect(pill).toHaveClass("flex-col", "desktop:flex-row");
  });

  it("세그먼트 사이에만 1px hairline 구분선을 둔다", () => {
    render(
      <SearchBarPill>
        <span>주소</span>
        <span>보증금</span>
        <span>전용면적</span>
      </SearchBarPill>,
    );
    const dividers = screen.getAllByTestId("search-bar-divider");

    expect(dividers).toHaveLength(2);
    for (const divider of dividers) {
      expect(divider).toHaveClass("hidden", "desktop:block", "w-px", "bg-hairline");
      expect(divider).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("오브는 desktop에서만 보인다", () => {
    render(
      <SearchBarPill orb={<button type="submit">조회하기</button>}>
        <span>주소</span>
      </SearchBarPill>,
    );

    expect(screen.getByRole("button", { name: "조회하기" }).parentElement).toHaveClass("hidden", "desktop:flex");
  });
});
