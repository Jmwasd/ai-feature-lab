import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";
import { HEADLINE_LINES, ROLL_INTERVAL_MS } from "./RollingHeadline";

function headlineLines() {
  const h1 = screen.getByRole("heading", { level: 1 });
  return { h1, lines: Array.from(h1.querySelectorAll<HTMLElement>("[data-headline-line]")) };
}

function shownIndex(lines: HTMLElement[]) {
  const shown = lines.filter((line) => line.getAttribute("aria-hidden") !== "true");
  expect(shown).toHaveLength(1);
  return lines.indexOf(shown[0]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Hero", () => {
  it("상태 알약 → 헤드라인 → 리드 → CTA 두 개 순서로 둔다", () => {
    render(<Hero />);
    const pill = screen.getByText("공공데이터로 계산하는 전세 위험도");
    const h1 = screen.getByRole("heading", { level: 1 });
    const lead = screen.getByText(/실거래가, 공시가격, 등기부 권리관계까지/);
    const primary = screen.getByRole("link", { name: "지금 위험도 확인하기" });
    const outline = screen.getByRole("link", { name: "이용 방법 보기" });

    expect(primary).toHaveAttribute("href", "/check");
    expect(primary).toHaveClass("bg-primary");
    expect(outline).toHaveAttribute("href", "#flow");
    expect(outline).toHaveClass("border-ink");
    expect(outline).not.toHaveClass("bg-primary");
    expect(lead).toHaveTextContent("돌려받기 어려운 집인지 계약 전에 한눈에 알려드려요.");
    for (const [before, after] of [
      [pill, h1],
      [h1, lead],
      [lead, primary],
      [primary, outline],
    ]) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("헤드라인은 두 줄짜리 문장 네 개이고 강조 어절을 레드로 둔다", () => {
    render(<Hero />);
    const { lines } = headlineLines();

    expect(lines.map((line) => line.textContent)).toEqual([
      "내가 살 집이니까,더 신중해야 하니까.",
      "보증금, 한두 푼하는 돈 아니잖아요.",
      "좀 더 신중하게,좀 더 확실하게.",
      "전세 위험도,내가 먼저 확인해드릴게요.",
    ]);
    const emphasis = lines.flatMap((line) => Array.from(line.querySelectorAll(".text-primary")).map((el) => el.textContent));
    expect(emphasis).toEqual(["내가 살 집", "보증금", "확실하게", "전세 위험도"]);
  });

  it("헤드라인은 aria-live polite이고 보이는 한 문장만 빼고 aria-hidden이다", () => {
    render(<Hero />);
    const { h1, lines } = headlineLines();

    expect(h1).toHaveAttribute("aria-live", "polite");
    expect(lines).toHaveLength(HEADLINE_LINES.length);
    expect(shownIndex(lines)).toBe(0);
  });

  it("3초마다 다음 문장으로 바꾸고 마지막 뒤에는 처음으로 돌아간다", () => {
    vi.useFakeTimers();
    render(<Hero />);
    const { lines } = headlineLines();
    expect(ROLL_INTERVAL_MS).toBe(3000);

    for (const expected of [1, 2, 3, 0]) {
      act(() => vi.advanceTimersByTime(ROLL_INTERVAL_MS));
      expect(shownIndex(lines)).toBe(expected);
    }
  });

  it("prefers-reduced-motion이면 헤드라인을 바꾸지 않는다", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<Hero />);
    const { lines } = headlineLines();

    act(() => vi.advanceTimersByTime(ROLL_INTERVAL_MS * 3));
    expect(shownIndex(lines)).toBe(0);
  });

  it("떠 있는 신호 카드는 aria-hidden 예시 일러스트다", () => {
    render(<Hero />);
    const card = screen.getByTestId("hero-signal-card");

    expect(card).toHaveAttribute("aria-hidden", "true");
    expect(card).toHaveClass("w-[280px]", "rounded-card", "shadow-float", "animate-float");
    for (const text of ["전세 위험도", "높음", "시세 대비 전세가율 92%", "근저당 설정 3건", "HUG 보증보험 가입 어려움"]) {
      expect(card).toHaveTextContent(text);
    }
  });

  it("아래로 스크롤 안내가 #try로 이어진다", () => {
    render(<Hero />);

    expect(screen.getByRole("link", { name: "아래로 스크롤" })).toHaveAttribute("href", "#try");
  });
});
