import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HUG_GUARANTEE } from "@/consts/policy";
import { CONTENT_SWAP_OUT_MS } from "@/hooks/use-content-swap";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { formatPercent } from "@/utils/format";
import { SourcesSection } from "./SourcesSection";

function select(label: string) {
  fireEvent.click(screen.getByRole("tab", { name: label }));
  act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
  return screen.getByRole("tabpanel");
}

function items(panel: HTMLElement) {
  return within(panel)
    .getAllByTestId("source-row")
    .map((row) => row.querySelector("[data-source-item]")?.textContent);
}

describe("SourcesSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("제목·설명·기관 카드 다섯 개·세그먼트 토글 세 개를 둔다", () => {
    const { container } = render(<SourcesSection />);

    expect(container.querySelector("section#sources")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "무엇을 어디서 가져오나요" })).toBeInTheDocument();
    expect(screen.getByText("공공데이터로 자동 조회하는 것과 직접 확인해야 하는 것을 나눠 둬요.")).toBeInTheDocument();
    for (const name of ["국토교통부", "공공데이터포털", "한국부동산원", "세움터", "인터넷등기소"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["자동 조회", "직접 입력", "지원 안 함"]);
  });

  it("자동 조회 항목과 HUG 기준 배율을 policy 값으로 쓴다", () => {
    render(<SourcesSection />);
    const panel = select("자동 조회");

    expect(items(panel)).toEqual(["실거래가", "공시가격", "건축물대장", "주소 정규화"]);
    expect(panel).toHaveTextContent(`HUG 주택가격 기준(×${formatPercent(HUG_GUARANTEE.combinedRatio)}) 계산에 써요.`);
  });

  it("직접 입력은 등기부 권리관계 항목이다", () => {
    render(<SourcesSection />);

    expect(items(select("직접 입력"))).toEqual(["근저당 채권최고액", "신탁 여부", "최근 소유자 변동"]);
  });

  it("지원 안 함은 PRD MVP 제외 사항이다", () => {
    render(<SourcesSection />);
    const panel = select("지원 안 함");

    expect(items(panel)).toEqual(["다가구·단독주택", "오피스텔", "등기부·확정일자·국세 체납 자동 조회", "KB시세"]);
    expect(panel).not.toHaveTextContent(/곧|예정|준비 중/);
  });

  it("화살표 키로 토글을 옮긴다", () => {
    render(<SourcesSection />);
    const tabs = screen.getAllByRole("tab");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveFocus();
  });

  it("모든 토글에 금지 표현이 없다", () => {
    const { container } = render(<SourcesSection />);
    const texts: string[] = [];

    for (const label of ["자동 조회", "직접 입력", "지원 안 함"]) {
      select(label);
      texts.push(container.textContent ?? "");
    }

    expectNoForbiddenPhrases(texts.join("\n"));
  });
});
