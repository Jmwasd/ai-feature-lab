import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_SWAP_OUT_MS } from "@/hooks/use-content-swap";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { LANDING_CASES } from "./cases-data";
import { CasesSection } from "./CasesSection";

function selectTab(label: string) {
  fireEvent.click(screen.getByRole("tab", { name: label }));
  act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
  return screen.getByRole("tabpanel");
}

// 디자인 시안의 사례별 화면 값.
const EXPECTED = [
  {
    label: "비율이 낮은 빌라",
    addr: "마포구 망원동 빌라",
    meta: "보증금 2억 2,000만 · 추정 시세 3억 2,000만 · 근저당 없음",
    bars: ["69%", "69%"],
    hug: "가입 기준 충족(공시가격 기준 추정)",
    headline: "위험 신호 0개",
    rows: ["두 비율 모두 70% 아래"],
  },
  {
    label: "깡통전세",
    addr: "강서구 화곡동 빌라",
    meta: "보증금 2억 9,000만 · 추정 시세 3억 · 근저당 없음",
    bars: ["97%", "97%"],
    hug: "가입 어려움",
    headline: "위험 신호 2개",
    rows: ["전세가율 97%", "HUG 보증보험 가입 어려움"],
  },
  {
    label: "근저당 과다",
    addr: "관악구 봉천동 다세대",
    meta: "보증금 1억 8,000만 · 추정 시세 3억 1,000만 · 근저당 1억 2,000만",
    bars: ["58%", "97%"],
    hug: "가입 어려움",
    headline: "위험 신호 2개",
    rows: ["부채비율 97%", "HUG 보증보험 가입 어려움"],
  },
  {
    label: "신탁 등기",
    addr: "은평구 불광동 빌라",
    meta: "보증금 2억 · 추정 시세 3억 3,000만 · 근저당 없음",
    bars: ["61%", "61%"],
    hug: "가입 어려움",
    headline: "위험 신호 1개",
    rows: ["신탁 등기"],
  },
  {
    label: "근린생활시설",
    addr: "송파구 방이동 빌라",
    meta: "보증금 1억 9,000만 · 추정 시세 3억 · 근저당 없음",
    bars: ["63%", "63%"],
    hug: "가입 어려움",
    headline: "위험 신호 1개",
    rows: ["주택이 아닌 용도"],
  },
];

describe("CasesSection", () => {
  // 숫자 트윈을 건너뛰어 막대 값이 목표값으로 바로 보이게 한다.
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("제목과 설명, 사례 탭 다섯 개를 디자인 순서로 두고 깡통전세를 먼저 고른다", () => {
    render(<CasesSection />);
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");

    expect(screen.getByRole("heading", { level: 2, name: "이런 집은 이렇게 보여요" })).toBeInTheDocument();
    expect(screen.getByText("자주 나오는 다섯 가지 경우를 골라 보세요. 결과 화면에 실제로 뜨는 숫자와 신호예요.")).toBeInTheDocument();
    expect(tabs.map((t) => t.textContent)).toEqual(EXPECTED.map((e) => e.label));
    expect(LANDING_CASES.map((c) => c.label)).toEqual(EXPECTED.map((e) => e.label));
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("예시 데이터 표기가 있다", () => {
    const { container } = render(<CasesSection />);

    expect(within(container.querySelector<HTMLElement>("section#cases")!).getAllByText(/예시 데이터/).length).toBeGreaterThan(0);
  });

  it("사례마다 주소·조건·비교 막대·HUG·신호 행을 디자인 값으로 그린다", () => {
    render(<CasesSection />);

    for (const e of EXPECTED) {
      const panel = selectTab(e.label);
      const rows = within(panel).getAllByTestId("signal-row");

      expect(within(panel).getByText(e.addr)).toBeInTheDocument();
      expect(panel).toHaveTextContent(e.meta);
      expect(within(panel).getAllByTestId("compare-value").map((el) => el.textContent)).toEqual(e.bars);
      expect(within(panel).getByTestId("case-hug")).toHaveTextContent(`HUG 보증보험 ${e.hug}`);
      expect(within(panel).getByText(e.headline)).toBeInTheDocument();
      expect(rows.map((row) => row.querySelector("[data-signal-title]")?.textContent)).toEqual(e.rows);
    }
  });

  it("신호 설명에 policy 기준값과 금액을 쓴다", () => {
    render(<CasesSection />);

    let panel = selectTab("깡통전세");
    expect(panel).toHaveTextContent("보증금이 추정 시세의 80%를 넘어요. 집값이 조금만 내려도 보증금을 돌려받기 어려울 수 있어요.");
    expect(panel).toHaveTextContent("근저당과 보증금 합계가 공시가격×126%인 2억 3,940만을 넘어요.");

    panel = selectTab("근저당 과다");
    expect(panel).toHaveTextContent("근저당 1억 2,000만과 보증금을 더하면 추정 시세의 97%예요.");

    panel = selectTab("비율이 낮은 빌라");
    expect(panel).toHaveTextContent("그래도 계약 당일 등기부를 다시 떼어 새 근저당이 없는지 확인하세요.");
  });

  it("화살표·Home·End 키로 탭을 옮기고 선택한다", () => {
    render(<CasesSection />);
    const tabs = screen.getAllByRole("tab");

    expect(tabs[1]).toHaveAttribute("tabindex", "0");
    expect(tabs[0]).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(tabs[1], { key: "ArrowRight" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    expect(tabs[2]).toHaveFocus();

    fireEvent.keyDown(tabs[2], { key: "Home" });
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");
    expect(tabs[4]).toHaveFocus();

    fireEvent.keyDown(tabs[4], { key: "End" });
    expect(tabs[4]).toHaveFocus();
  });

  it("탭 패널이 선택된 탭을 가리킨다", () => {
    render(<CasesSection />);
    const panel = selectTab("신탁 등기");
    const tab = screen.getByRole("tab", { name: "신탁 등기" });

    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("모든 탭 패널에 금지 표현이 없다", () => {
    const { container } = render(<CasesSection />);
    const texts: string[] = [];

    for (const e of EXPECTED) {
      selectTab(e.label);
      texts.push(container.textContent ?? "");
    }

    expectNoForbiddenPhrases(texts.join("\n"));
  });
});
