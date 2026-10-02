import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_SWAP_OUT_MS } from "@/hooks/use-content-swap";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { FLOW_AUTO_ADVANCE_MS, FlowSection } from "./FlowSection";

const STEPS = [
  ["주소와 보증금", "공공데이터로 시세와 건물 정보를 찾아요"],
  ["등기부 입력", "근저당, 신탁, 소유자 변동을 입력해요"],
  ["종합 판정", "두 비율과 HUG 가입 가능 여부를 봐요"],
];

// 한 단계가 끝나 다음 단계 내용이 보일 때까지: 진행 시간 + 내용 교체 시간.
const ONE_STEP_MS = FLOW_AUTO_ADVANCE_MS + CONTENT_SWAP_OUT_MS + 100;

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

// act 하나 안에서는 효과가 다시 돌지 않아 타이머가 새로 걸리지 않는다. 100ms씩 나눠 흘려 실제 브라우저처럼 돌린다.
function advance(ms: number) {
  for (let t = 0; t < ms; t += 100) act(() => vi.advanceTimersByTime(100));
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

  it("제목과 단계 탭 세 개를 디자인 문구로 둔다", () => {
    const { container } = render(<FlowSection />);
    const tabs = screen.getAllByRole("tab");

    expect(container.querySelector("section#flow")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "3분이면 끝나요" })).toBeInTheDocument();
    expect(screen.getByText("주소를 넣는 것부터 결과를 받기까지의 과정이에요.")).toBeInTheDocument();
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab, i) => {
      expect(tab).toHaveTextContent(STEPS[i][0]);
      expect(tab).toHaveTextContent(STEPS[i][1]);
    });
  });

  it("4.5초마다 다음 단계로 넘어가고 마지막 뒤에는 처음으로 돌아간다", () => {
    render(<FlowSection />);
    expect(FLOW_AUTO_ADVANCE_MS).toBe(4500);
    expect(selected()).toBe(0);

    for (const expected of [1, 2, 0]) {
      advance(ONE_STEP_MS);
      expect(selected()).toBe(expected);
    }
  });

  it("탭을 누르면 그 단계부터 다시 자동 진행한다", () => {
    render(<FlowSection />);

    fireEvent.click(screen.getAllByRole("tab")[2]);
    expect(selected()).toBe(2);

    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
    expect(selected()).toBe(2);
    advance(ONE_STEP_MS);
    expect(selected()).toBe(0);
  });

  it("키보드로 탭을 옮기고 포커스한다", () => {
    render(<FlowSection />);
    const tabs = screen.getAllByRole("tab");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(selected()).toBe(1);
    expect(tabs[1]).toHaveFocus();
  });

  it("동작 줄이기면 자동 진행하지 않는다", () => {
    stubReducedMotion(true);
    render(<FlowSection />);

    advance(ONE_STEP_MS * 3);
    expect(selected()).toBe(0);
  });

  it("미리보기 판이 단계마다 디자인의 예시 화면을 보여 준다", () => {
    render(<FlowSection />);
    const panel = () => screen.getByRole("tabpanel");

    expect(panel()).toHaveTextContent("1 / 2 시세 쪽 판정");
    expect(panel()).toHaveTextContent("서울 마포구 망원로 97, 302호");
    expect(panel()).toHaveTextContent("실거래가 6건 · 공시가격 · 건축물대장 자동 조회");

    fireEvent.click(screen.getByRole("tab", { name: /등기부 입력/ }));
    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
    expect(panel()).toHaveTextContent("2 / 2 등기부 권리 입력");
    expect(panel()).toHaveTextContent("근저당 채권최고액 합계");
    expect(panel()).toHaveTextContent("신탁 등기가 있나요");

    fireEvent.click(screen.getByRole("tab", { name: /종합 판정/ }));
    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
    expect(within(panel()).getByText("88%")).toBeInTheDocument();
    expect(within(panel()).getByText("106%")).toBeInTheDocument();
    expect(within(panel()).getAllByText("위험")).toHaveLength(2);
    expect(panel()).toHaveTextContent("위험 신호 3개 · HUG 보증보험 가입 어려움");
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
