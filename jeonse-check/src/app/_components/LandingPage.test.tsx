import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/features/judgment/copy";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import Home from "../page";

describe("랜딩 페이지", () => {
  it("UI_GUIDE §8 순서대로 섹션을 둔다", () => {
    const { container } = render(<Home />);
    const ids = Array.from(container.querySelectorAll("main > section[id]")).map((s) => s.id);

    expect(ids).toEqual(["hero", "try", "cases", "flow", "sources", "final-cta"]);
    expect(container.querySelector("header")?.compareDocumentPosition(container.querySelector("main")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent("© 2026 jeonse-check");
  });

  it("가운데 네 섹션에 제목이 있다", () => {
    const { container } = render(<Home />);
    const titles = ["try", "cases", "flow", "sources"].map(
      (id) => within(container.querySelector<HTMLElement>(`#${id}`)!).getByRole("heading", { level: 2 }).textContent,
    );

    expect(titles).toEqual(["계산해 보기", "사례", "이용 방법", "데이터 출처"]);
  });

  it("TopNav에 앵커 링크 네 개와 /check로 가는 secondary CTA가 있다", () => {
    render(<Home />);
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    const hrefs = within(nav).getAllByRole("link").map((a) => a.getAttribute("href"));
    const header = screen.getByRole("banner");
    const cta = within(header).getByRole("link", { name: "지금 확인하기" });

    expect(hrefs).toEqual(["#try", "#cases", "#flow", "#sources"]);
    expect(cta).toHaveAttribute("href", "/check");
    expect(cta).not.toHaveClass("bg-primary");
  });

  it("/check로 가는 링크가 있다", () => {
    render(<Home />);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/check");

    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it("마지막 CTA에 copy.ts의 면책 문구가 있다", () => {
    const { container } = render(<Home />);
    const finalCta = container.querySelector<HTMLElement>("#final-cta")!;

    expect(within(finalCta).getByRole("heading", { name: "계약 전에 확인하세요" })).toBeInTheDocument();
    expect(within(finalCta).getByRole("link", { name: "지금 확인하기" })).toHaveAttribute("href", "/check");
    expect(within(finalCta).getByText(DISCLAIMER)).toBeVisible();
  });

  it("히어로 신호 카드를 뺀 모든 텍스트에 금지 표현이 없다", () => {
    const { container } = render(<Home />);
    const card = screen.getByTestId("hero-signal-card");
    expect(card).toHaveAttribute("aria-hidden", "true");

    const copy = container.cloneNode(true) as HTMLElement;
    copy.querySelector('[data-testid="hero-signal-card"]')!.remove();
    const attributeText = Array.from(copy.querySelectorAll("[alt],[aria-label],[title]")).flatMap((el) =>
      ["alt", "aria-label", "title"].map((name) => el.getAttribute(name) ?? ""),
    );

    expectNoForbiddenPhrases([copy.textContent ?? "", ...attributeText].join("\n"));
  });
});
