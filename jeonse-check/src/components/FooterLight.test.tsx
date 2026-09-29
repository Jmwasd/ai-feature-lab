import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FooterLight } from "./FooterLight";

const columns = [
  { title: "고객지원", links: [{ href: "/help", label: "도움말" }] },
  {
    title: "서비스",
    links: [
      { href: "/#try", label: "계산해 보기" },
      { href: "/#sources", label: "데이터 출처" },
    ],
  },
];

describe("FooterLight", () => {
  it("열 제목과 링크를 props대로 렌더링한다", () => {
    render(<FooterLight columns={columns} legal="© 2026 예시" />);

    expect(screen.getByRole("heading", { name: "고객지원" })).toHaveClass("text-title-sm");
    const service = screen.getByRole("heading", { name: "서비스" }).parentElement!;
    const links = within(service).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/#try", "/#sources"]);
    expect(links[0]).toHaveClass("text-body-sm");
  });

  it("흰 바탕에 상단 hairline이고 하단에 법률 밴드를 둔다", () => {
    render(<FooterLight columns={columns} legal={<span>© 2026 예시</span>} />);

    expect(screen.getByRole("contentinfo")).toHaveClass("bg-canvas", "border-t", "border-hairline");
    expect(screen.getByText("© 2026 예시").parentElement).toHaveClass("text-caption-sm", "text-muted");
  });
});
