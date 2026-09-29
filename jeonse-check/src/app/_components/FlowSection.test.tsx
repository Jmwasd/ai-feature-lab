import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_SWAP_OUT_MS } from "@/hooks/use-content-swap";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { FLOW_AUTO_ADVANCE_MS, FlowSection } from "./FlowSection";

const STEPS = ["주소·보증금 입력", "등기부 권리 입력", "결과 확인"];

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function selected() {
  return screen.getAllByRole("tab").findIndex((t) => t.getAttribute("aria-selected") === "true");
}

describe("FlowSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("단계 탭 세 개를 순서대로 둔다", () => {
    const { container } = render(<FlowSection />);
    const tabs = screen.getAllByRole("tab");

    expect(container.querySelector("section#flow")).not.toBeNull();
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab, i) => expect(tab).toHaveTextContent(STEPS[i]));
  });

  it("4.5초마다 다음 단계로 넘어가고 마지막 뒤에는 처음으로 돌아간다", () => {
    render(<FlowSection />);
    expect(FLOW_AUTO_ADVANCE_MS).toBe(4500);
    expect(selected()).toBe(0);

    act(() => vi.advanceTimersByTime(FLOW_AUTO_ADVANCE_MS));
    expect(selected()).toBe(1);
    act(() => vi.advanceTimersByTime(FLOW_AUTO_ADVANCE_MS));
    expect(selected()).toBe(2);
    act(() => vi.advanceTimersByTime(FLOW_AUTO_ADVANCE_MS));
    expect(selected()).toBe(0);
  });

  it("사용자가 탭을 누르면 자동 진행을 멈춘다", () => {
    render(<FlowSection />);

    fireEvent.click(screen.getAllByRole("tab")[2]);
    expect(selected()).toBe(2);

    act(() => vi.advanceTimersByTime(FLOW_AUTO_ADVANCE_MS * 3));
    expect(selected()).toBe(2);
  });

  it("키보드로 탭을 옮겨도 자동 진행을 멈춘다", () => {
    render(<FlowSection />);
    const tabs = screen.getAllByRole("tab");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(selected()).toBe(1);
    expect(tabs[1]).toHaveFocus();

    act(() => vi.advanceTimersByTime(FLOW_AUTO_ADVANCE_MS * 3));
    expect(selected()).toBe(1);
  });

  it("동작 줄이기면 자동 진행하지 않는다", () => {
    stubReducedMotion(true);
    render(<FlowSection />);

    act(() => vi.advanceTimersByTime(FLOW_AUTO_ADVANCE_MS * 3));
    expect(selected()).toBe(0);
  });

  it("미리보기 판이 선택한 단계 설명을 보여 준다", () => {
    render(<FlowSection />);

    fireEvent.click(screen.getByRole("tab", { name: /등기부 권리 입력/ }));
    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));

    expect(within(screen.getByRole("tabpanel")).getByText(/채권최고액/)).toBeInTheDocument();
  });

  it("모든 단계에 금지 표현이 없다", () => {
    const { container } = render(<FlowSection />);
    const texts: string[] = [];

    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.click(tab);
      act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
      texts.push(container.textContent ?? "");
    }

    expectNoForbiddenPhrases(texts.join("\n"));
  });
});
