import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEBT_RATIO_THRESHOLD, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { formatPercent, formatWon } from "@/utils/format";
import {
  CONFIDENCE_LABEL,
  DATA_LIMITED_NOTE,
  DISCLAIMER,
  ESTIMATE_METHOD_LABEL,
  HUG_STATUS,
  LEVEL_LABEL,
  SOURCES,
} from "../copy";
import { ALL_VIEWS, allSignalsView, hugUnknownView, noSignalsView, priceNoneView } from "./__fixtures__/views";
import { ReportFooter } from "./ReportFooter";
import { ResultView } from "./ResultView";

const TRACK_MAX = 1.2;

describe.each(Object.entries(ALL_VIEWS))("ResultView — %s", (_name, view) => {
  it("필수 요소 1: 위험 신호 개수와 '위험 신호 N개'", () => {
    render(<ResultView view={view} />);

    expect(screen.getByTestId("signal-count")).toHaveTextContent(String(view.report.signalCount));
  });

  it("필수 요소 2: 신호 목록 — 신호마다 수준 라벨·제목·근거", () => {
    render(<ResultView view={view} />);
    const list = screen.getByTestId("signal-list");
    const rows = within(list).queryAllByTestId("signal-row");

    expect(rows).toHaveLength(view.report.signals.length);
    view.report.signals.forEach((signal, i) => {
      expect(within(rows[i]).getByText(signal.title)).toBeInTheDocument();
      expect(within(rows[i]).getByText(signal.detail)).toBeInTheDocument();
      expect(within(rows[i]).getByText(LEVEL_LABEL[signal.level])).toBeInTheDocument();
    });
  });

  it("필수 요소 3: 시세 추정 근거 — 방식, 신뢰도, 비교 거래 목록", () => {
    render(<ResultView view={view} />);
    const evidence = screen.getByTestId("price-evidence");
    const { priceEstimate } = view;

    expect(within(evidence).getByText(ESTIMATE_METHOD_LABEL[priceEstimate.method])).toBeInTheDocument();
    expect(within(evidence).getByText(CONFIDENCE_LABEL[priceEstimate.confidence])).toBeInTheDocument();
    expect(within(evidence).getByTestId("comparables")).toBeInTheDocument();
    expect(within(evidence).queryAllByTestId("comparable-row")).toHaveLength(priceEstimate.comparables.length);
  });

  it("필수 요소 4: 데이터 기준일과 출처 4종", () => {
    render(<ResultView view={view} />);
    const footer = screen.getByTestId("report-footer");

    expect(within(footer).getByText(/데이터 기준일/)).toHaveTextContent("2026-09-01");
    for (const source of SOURCES) expect(footer).toHaveTextContent(source);
  });

  it("필수 요소 5: 면책 문구 전문을 접지 않고 보여 준다", () => {
    render(<ResultView view={view} />);
    const disclaimer = screen.getByText(DISCLAIMER);

    expect(disclaimer).toBeVisible();
    expect(disclaimer.closest("details")).toBeNull();
  });

  it("렌더링 텍스트에 금지 표현이 없다", () => {
    const { container } = render(<ResultView view={view} />);

    expectNoForbiddenPhrases(container.textContent ?? "");
  });

  it("점수·등급을 만들지 않는다", () => {
    const { container } = render(<ResultView view={view} />);

    expect(container.textContent).not.toMatch(/점수|등급/);
  });

  it("권리 입력 값에 '입력한 등기부 기준' 근거를 붙인다", () => {
    render(<ResultView view={view} />);

    expect(
      screen.getByText(`입력한 등기부 기준 근저당 채권최고액 ${formatWon(view.rights.maxClaimAmount)}`),
    ).toBeInTheDocument();
  });

  it("notes를 모두 보여 준다", () => {
    render(<ResultView view={view} />);

    for (const note of view.report.notes) expect(screen.getByText(note)).toBeInTheDocument();
  });
});

describe("SignalList — 수준 표시", () => {
  it("신호마다 수준 라벨(위험·주의)을 함께 둔다", () => {
    render(<ResultView view={allSignalsView} />);
    const rows = screen.getAllByTestId("signal-row");
    const levels = new Set(allSignalsView.report.signals.map((s) => s.level));
    expect(levels).toEqual(new Set(["danger", "caution"]));

    allSignalsView.report.signals.forEach((signal, i) => {
      expect(within(rows[i]).getByText(LEVEL_LABEL[signal.level])).toBeInTheDocument();
    });
  });

  it("신호가 0개여도 목록 자리에 안내를 둔다", () => {
    render(<ResultView view={noSignalsView} />);

    expect(screen.getByTestId("signal-list")).not.toBeEmptyDOMElement();
    expect(screen.getByRole("heading", { name: "위험 신호 0개" })).toBeInTheDocument();
  });
});

describe("RatioPanel", () => {
  it("비율 막대 기준선은 policy.ts의 위험 임계치 위치에 있고 기준 문구도 거기서 온다", () => {
    render(<ResultView view={noSignalsView} />);
    const lines = screen.getAllByTestId("ratio-threshold");

    expect(lines[0].style.left).toBe(`${(JEONSE_RATIO_THRESHOLD.danger / TRACK_MAX) * 100}%`);
    expect(lines[1].style.left).toBe(`${(DEBT_RATIO_THRESHOLD.danger / TRACK_MAX) * 100}%`);
    expect(screen.getAllByText(`${formatPercent(JEONSE_RATIO_THRESHOLD.danger)} 기준`)).toHaveLength(2);
  });

  it("HUG 가입 기준 충족이면 추정 표기를 쓴다", () => {
    render(<ResultView view={noSignalsView} />);

    expect(within(screen.getByTestId("hug-row")).getByText(HUG_STATUS.eligible)).toBeInTheDocument();
  });

  it("HUG 가입 어려움이면 그 상태를 쓴다", () => {
    render(<ResultView view={allSignalsView} />);

    expect(within(screen.getByTestId("hug-row")).getByText(HUG_STATUS.ineligible)).toBeInTheDocument();
  });

  it("HUG unknown이면 '입력이 부족해 판단할 수 없어요'라고 사실만 쓴다", () => {
    render(<ResultView view={hugUnknownView} />);
    const row = screen.getByTestId("hug-row");

    expect(within(row).getByText(HUG_STATUS.unknown)).toBeInTheDocument();
    expect(row.querySelector(".lucide-circle-check")).toBeNull();
  });

  it("최우선변제 줄을 보여 준다", () => {
    render(<ResultView view={noSignalsView} />);

    expect(screen.getByTestId("priority-row")).toHaveTextContent(formatWon(noSignalsView.priorityRepayment!.amount));
  });

  it("시세가 none이면 비율 대신 계산 불가 안내를 보여 준다", () => {
    render(<ResultView view={priceNoneView} />);

    expect(screen.getAllByText("계산할 수 없어요")).toHaveLength(2);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("PriceEvidence", () => {
  it("비교 거래 표에 계약일·전용면적·층·매매가·건물명을 쓴다", () => {
    render(<ResultView view={noSignalsView} />);
    const rows = screen.getAllByTestId("comparable-row");
    const first = noSignalsView.priceEstimate.comparables[0];

    expect(rows[0]).toHaveTextContent("2026-02-14");
    expect(rows[0]).toHaveTextContent(`${first.exclusiveArea}㎡`);
    expect(rows[0]).toHaveTextContent("3층");
    expect(rows[0]).toHaveTextContent(formatWon(first.price));
    expect(rows[0]).toHaveTextContent("망원빌라");
  });

  it("조회 구간을 보여 준다", () => {
    render(<ResultView view={noSignalsView} />);

    expect(screen.getByTestId("price-evidence")).toHaveTextContent("2025-09-29 ~ 2026-09-29");
  });
});

describe("ReportFooter", () => {
  it("등장 모션을 주지 않는다", () => {
    render(<ReportFooter report={noSignalsView.report} />);
    const footer = screen.getByTestId("report-footer");

    for (const el of [footer, ...footer.querySelectorAll("*")]) {
      expect((el as HTMLElement).style.opacity).toBe("");
      expect(el.className).not.toMatch(/transition|opacity-0|animate/);
    }
  });
});

describe("SignalSummary — 데이터 부족 요약 줄", () => {
  it.each([
    ["시세 none", priceNoneView],
    ["HUG unknown", hugUnknownView],
  ])("%s이면 헤드라인 아래에 판단이 제한된다는 줄을 보여 준다", (_name, view) => {
    render(<ResultView view={view} />);

    expect(screen.getByTestId("data-limited")).toHaveTextContent(DATA_LIMITED_NOTE);
  });

  it("시세와 HUG 판단에 필요한 데이터가 모두 있으면 보여 주지 않는다", () => {
    render(<ResultView view={noSignalsView} />);

    expect(screen.queryByTestId("data-limited")).not.toBeInTheDocument();
  });
});
