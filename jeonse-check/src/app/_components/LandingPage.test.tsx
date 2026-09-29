import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/Button";
import { DISCLAIMER } from "@/features/judgment/copy";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import HomePage from "../page";

vi.mock("@/server/auth", () => ({ auth: vi.fn(async () => null), signIn: vi.fn(), signOut: vi.fn() }));
// 비동기 Server Component는 jsdom에서 렌더링할 수 없어 비로그인 모습으로 바꾼다. 자체 동작은 AuthNavAction.test.tsx가 검증한다.
vi.mock("@/features/auth/AuthNavAction", () => ({
  AuthNavAction: () => (
    <Button href="/check" variant="secondary">
      지금 확인하기
    </Button>
  ),
}));
vi.mock("../_components/LoginNotice", () => ({
  LoginNotice: ({ callbackUrl }: { callbackUrl: string }) => <p data-testid="login-notice">{callbackUrl}</p>,
}));

async function Home({ callbackUrl }: { callbackUrl?: string } = {}) {
  const searchParams: Record<string, string> = callbackUrl === undefined ? {} : { callbackUrl };
  return HomePage({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) });
}

describe("랜딩 페이지", () => {
  it("UI_GUIDE §8 순서대로 섹션을 둔다", async () => {
    const { container } = render(await Home());
    const ids = Array.from(container.querySelectorAll("main > section[id]")).map((s) => s.id);

    expect(ids).toEqual(["hero", "try", "cases", "flow", "sources", "final-cta"]);
    expect(container.querySelector("header")?.compareDocumentPosition(container.querySelector("main")!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent("© 2026 jeonse-check");
  });

  it("가운데 네 섹션에 제목이 있다", async () => {
    const { container } = render(await Home());
    const titles = ["try", "cases", "flow", "sources"].map(
      (id) => within(container.querySelector<HTMLElement>(`#${id}`)!).getByRole("heading", { level: 2 }).textContent,
    );

    expect(titles).toEqual(["계산해 보기", "사례", "이용 방법", "데이터 출처"]);
  });

  it("TopNav에 앵커 링크 네 개와 /check로 가는 secondary CTA가 있다", async () => {
    render(await Home());
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    const hrefs = within(nav).getAllByRole("link").map((a) => a.getAttribute("href"));
    const header = screen.getByRole("banner");
    const cta = within(header).getByRole("link", { name: "지금 확인하기" });

    expect(hrefs).toEqual(["#try", "#cases", "#flow", "#sources"]);
    expect(cta).toHaveAttribute("href", "/check");
    expect(cta).not.toHaveClass("bg-primary");
  });

  it("/check로 가는 링크가 있다", async () => {
    render(await Home());
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/check");

    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it("마지막 CTA에 copy.ts의 면책 문구가 있다", async () => {
    const { container } = render(await Home());
    const finalCta = container.querySelector<HTMLElement>("#final-cta")!;

    expect(within(finalCta).getByRole("heading", { name: "계약 전에 확인하세요" })).toBeInTheDocument();
    expect(within(finalCta).getByRole("link", { name: "지금 확인하기" })).toHaveAttribute("href", "/check");
    expect(within(finalCta).getByText(DISCLAIMER)).toBeVisible();
  });

  it("히어로 신호 카드를 뺀 모든 텍스트에 금지 표현이 없다", async () => {
    const { container } = render(await Home());
    const card = screen.getByTestId("hero-signal-card");
    expect(card).toHaveAttribute("aria-hidden", "true");

    const copy = container.cloneNode(true) as HTMLElement;
    copy.querySelector('[data-testid="hero-signal-card"]')!.remove();
    const attributeText = Array.from(copy.querySelectorAll("[alt],[aria-label],[title]")).flatMap((el) =>
      ["alt", "aria-label", "title"].map((name) => el.getAttribute(name) ?? ""),
    );

    expectNoForbiddenPhrases([copy.textContent ?? "", ...attributeText].join("\n"));
  });

  it("callbackUrl 쿼리가 없으면 로그인 안내를 두지 않는다", async () => {
    render(await Home());

    expect(screen.queryByTestId("login-notice")).not.toBeInTheDocument();
  });

  it("callbackUrl 쿼리가 있으면 히어로 바로 앞에 로그인 안내를 둔다", async () => {
    const { container } = render(await Home({ callbackUrl: "/check" }));
    const notice = screen.getByTestId("login-notice");

    expect(notice).toHaveTextContent("/check");
    expect(notice.compareDocumentPosition(container.querySelector("#hero")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
