import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateSalePrice } from "@/features/judgment/price-estimate";
import { checkHugEligibility, debtRatio, jeonseRatio } from "@/features/judgment/ratios";
import { buildRiskReport } from "@/features/judgment/risk-report";
import { CONTENT_SWAP_OUT_MS } from "@/hooks/use-content-swap";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { CASE_AS_OF, CASE_DATA_BASE_DATE, LANDING_CASES, type LandingCase } from "./cases-data";
import { CasesSection } from "./CasesSection";

// 화면과 별개로 판정 로직을 직접 호출해 기대값을 만든다.
function reportOf(c: LandingCase) {
  const priceEstimate = estimateSalePrice({
    target: c.target,
    saleTrades: c.saleTrades,
    officialPrice: c.officialPrice,
    asOf: CASE_AS_OF,
  });
  const seniorDebt = c.rights.maxClaimAmount + c.rights.seniorDeposits;
  return buildRiskReport({
    deposit: c.deposit,
    priceEstimate,
    jeonseRatio: jeonseRatio(c.deposit, priceEstimate.price),
    debtRatio: debtRatio({
      deposit: c.deposit,
      maxClaimAmount: c.rights.maxClaimAmount,
      seniorDeposits: c.rights.seniorDeposits,
      estimatedPrice: priceEstimate.price,
    }),
    hug: checkHugEligibility({
      deposit: c.deposit,
      seniorDebt,
      officialPrice: c.officialPrice,
      isCapitalArea: c.isCapitalArea,
    }),
    building: c.building,
    rights: c.rights,
    asOf: CASE_AS_OF,
    dataBaseDate: CASE_DATA_BASE_DATE,
  });
}

function selectTab(label: string) {
  fireEvent.click(screen.getByRole("tab", { name: label }));
  act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
}

describe("CasesSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("사례 탭 다섯 개를 UI_GUIDE §8 순서로 둔다", () => {
    render(<CasesSection />);
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab").map((t) => t.textContent);

    expect(tabs).toEqual(["깡통전세", "근저당 과다", "신탁 등기", "근린생활시설", "비율이 낮은 빌라"]);
    expect(LANDING_CASES.map((c) => c.label)).toEqual(tabs);
  });

  it("예시 데이터 표기가 있다", () => {
    const { container } = render(<CasesSection />);

    expect(within(container.querySelector<HTMLElement>("section#cases")!).getAllByText(/예시 데이터/).length).toBeGreaterThan(0);
  });

  it("사례마다 buildRiskReport와 같은 신호 개수·제목을 렌더링한다", () => {
    render(<CasesSection />);

    for (const c of LANDING_CASES) {
      selectTab(c.label);
      const report = reportOf(c);
      const panel = screen.getByRole("tabpanel");
      const rows = within(panel).queryAllByTestId("signal-row");

      expect(screen.getByRole("tab", { name: c.label })).toHaveAttribute("aria-selected", "true");
      expect(within(panel).getByText(report.headline)).toBeInTheDocument();
      expect(within(panel).getByTestId("signal-count")).toHaveTextContent(String(report.signalCount));
      expect(rows).toHaveLength(report.signalCount);
      rows.forEach((row, i) => {
        expect(row).toHaveTextContent(report.signals[i].title);
        expect(row).toHaveTextContent(report.signals[i].detail);
      });
    }
  });

  it("비율이 낮은 빌라도 '위험 신호 0개'로 쓴다", () => {
    render(<CasesSection />);
    selectTab("비율이 낮은 빌라");

    expect(reportOf(LANDING_CASES[4]).signalCount).toBe(0);
    expect(within(screen.getByRole("tabpanel")).getByText("위험 신호 0개")).toBeInTheDocument();
  });

  it("화살표·Home·End 키로 탭을 옮기고 선택한다", () => {
    render(<CasesSection />);
    const tabs = screen.getAllByRole("tab");

    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveFocus();

    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");
    expect(tabs[4]).toHaveFocus();

    fireEvent.keyDown(tabs[4], { key: "Home" });
    expect(tabs[0]).toHaveFocus();
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");
  });

  it("탭 패널이 선택된 탭을 가리킨다", () => {
    render(<CasesSection />);
    selectTab("신탁 등기");
    const tab = screen.getByRole("tab", { name: "신탁 등기" });
    const panel = screen.getByRole("tabpanel");

    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("모든 탭 패널에 금지 표현이 없다", () => {
    const { container } = render(<CasesSection />);
    const texts: string[] = [];

    for (const c of LANDING_CASES) {
      selectTab(c.label);
      texts.push(container.textContent ?? "");
      container.querySelectorAll("[aria-label],[aria-valuetext],[title]").forEach((el) => {
        for (const name of ["aria-label", "aria-valuetext", "title"]) texts.push(el.getAttribute(name) ?? "");
      });
    }

    expectNoForbiddenPhrases(texts.join("\n"));
  });
});
