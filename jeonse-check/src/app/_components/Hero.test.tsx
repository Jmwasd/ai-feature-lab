import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

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
    const h1 = screen.getByRole("heading", { level: 1 });
    const primary = screen.getByRole("link", { name: "지금 확인하기" });
    const outline = screen.getByRole("link", { name: "이용 방법 보기" });

    expect(primary).toHaveAttribute("href", "/check");
    expect(primary).toHaveClass("bg-primary");
    expect(outline).toHaveAttribute("href", "#flow");
    expect(outline).toHaveClass("border-ink");
    expect(outline).not.toHaveClass("bg-primary");
    expect(h1.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("헤드라인은 aria-live polite이고 보이는 한 줄만 빼고 aria-hidden이다", () => {
    render(<Hero />);
    const { h1, lines } = headlineLines();

    expect(h1).toHaveAttribute("aria-live", "polite");
    expect(lines).toHaveLength(3);
    expect(shownIndex(lines)).toBe(0);
  });

  it("3초마다 다음 문장으로 바꾸고 마지막 뒤에는 처음으로 돌아간다", () => {
    vi.useFakeTimers();
    render(<Hero />);
    const { lines } = headlineLines();

    act(() => vi.advanceTimersByTime(3000));
    expect(shownIndex(lines)).toBe(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(shownIndex(lines)).toBe(2);
    act(() => vi.advanceTimersByTime(3000));
    expect(shownIndex(lines)).toBe(0);
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

    act(() => vi.advanceTimersByTime(9000));
    expect(shownIndex(lines)).toBe(0);
  });

  it("떠 있는 신호 카드는 aria-hidden 예시 일러스트다", () => {
    render(<Hero />);
    const card = screen.getByTestId("hero-signal-card");

    expect(card).toHaveAttribute("aria-hidden", "true");
    expect(card).toHaveClass("w-[280px]", "rounded-card", "shadow-float", "animate-float");
    expect(card).toHaveTextContent("전세 위험도");
    expect(card).toHaveTextContent("높음");
  });
});
