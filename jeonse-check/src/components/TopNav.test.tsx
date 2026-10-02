import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TopNav } from "./TopNav";

const links = [
  { href: "#try", label: "계산해 보기" },
  { href: "#cases", label: "사례" },
];

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  act(() => {
    fireEvent.scroll(window);
  });
}

function menuButton() {
  return screen.getByRole("button", { name: /메뉴/ });
}

afterEach(() => {
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

describe("TopNav", () => {
  it("sticky 상단 바에 워드마크 링크(/)와 action을 둔다", () => {
    render(<TopNav links={links} action={<button type="button">지금 확인하기</button>} />);

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sticky", "top-0", "bg-canvas", "border-b", "border-hairline");
    const brand = screen.getByRole("link", { name: "jeonse-check" });
    expect(brand).toHaveAttribute("href", "/");
    expect(brand).toHaveClass("text-display-lg", "text-primary");
    expect(screen.getByRole("button", { name: "지금 확인하기" })).toBeInTheDocument();
  });

  it("brand를 넘기면 기본 워드마크 대신 쓴다", () => {
    render(<TopNav links={links} brand={<span>다른 이름</span>} />);

    expect(screen.getByText("다른 이름")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "jeonse-check" })).not.toBeInTheDocument();
  });

  it("스크롤이 8px을 넘으면 shadow-float를 붙이고 돌아오면 뗀다", () => {
    render(<TopNav links={links} />);
    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("shadow-float");

    scrollTo(8);
    expect(header).not.toHaveClass("shadow-float");

    scrollTo(9);
    expect(header).toHaveClass("shadow-float");

    scrollTo(0);
    expect(header).not.toHaveClass("shadow-float");
  });

  it("처음부터 스크롤된 상태면 그림자를 붙인 채 시작한다", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    render(<TopNav links={links} />);

    expect(screen.getByRole("banner")).toHaveClass("shadow-float");
  });

  it("데스크톱 내비에 링크를 알약 호버 스타일로 둔다", () => {
    render(<TopNav links={links} />);

    const desktop = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(desktop).toHaveClass("hidden", "tablet:flex");
    const link = screen.getAllByRole("link", { name: "사례" })[0];
    expect(link).toHaveAttribute("href", "#cases");
    expect(link).toHaveClass("text-button-md", "text-body", "rounded-full", "hover:bg-surface-soft");
  });

  it("햄버거 버튼으로 모바일 메뉴를 열고 닫는다", async () => {
    const user = userEvent.setup();
    render(<TopNav links={links} />);
    const button = menuButton();
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;

    expect(button).toHaveClass("tablet:hidden");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAccessibleName("메뉴 열기");
    expect(panel).not.toBeVisible();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAccessibleName("메뉴 닫기");
    expect(panel).toBeVisible();
    expect(panel.querySelectorAll("a")).toHaveLength(links.length);

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).not.toBeVisible();
  });

  it("모바일 메뉴의 링크를 누르거나 Escape를 누르면 메뉴를 닫는다", async () => {
    const user = userEvent.setup();
    render(<TopNav links={links} />);
    const button = menuButton();
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;

    await user.click(button);
    await user.click(panel.querySelector("a")!);
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("계정 링크와 계정 버튼은 tablet 이상에서 오른쪽 바에 알약 링크·버튼으로 둔다", () => {
    render(
      <TopNav
        links={links}
        accountLinks={[{ href: "/saved", label: "저장 목록" }]}
        accountAction={<button type="button">로그아웃</button>}
      />,
    );

    const account = screen.getByRole("navigation", { name: "계정 메뉴" });
    expect(account).toHaveClass("hidden", "tablet:flex");
    const saved = within(account).getByRole("link", { name: "저장 목록" });
    expect(saved).toHaveAttribute("href", "/saved");
    expect(saved).toHaveClass("text-button-md", "text-body", "rounded-full", "hover:bg-surface-soft");
    expect(saved).not.toHaveClass("underline");
    expect(within(account).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("tablet 미만에서는 계정 링크와 계정 버튼을 햄버거 메뉴 아래쪽에 둔다", async () => {
    const user = userEvent.setup();
    render(
      <TopNav
        links={links}
        accountLinks={[{ href: "/saved", label: "저장 목록" }]}
        accountAction={<button type="button">로그아웃</button>}
      />,
    );
    await user.click(menuButton());

    const panel = screen.getByRole("navigation", { name: "모바일 메뉴" });
    const labels = within(panel).getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual(["계산해 보기", "사례", "저장 목록"]);
    expect(within(panel).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("햄버거 메뉴에 넣을 것이 없으면 햄버거 버튼을 두지 않는다", () => {
    render(<TopNav links={[]} action={<button type="button">로그인</button>} />);

    expect(screen.queryByRole("button", { name: /메뉴/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });
});
