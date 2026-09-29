import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOURCES } from "@/features/judgment/copy";
import { CONTENT_SWAP_OUT_MS } from "@/hooks/use-content-swap";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { SourcesSection } from "./SourcesSection";

function select(label: string) {
  fireEvent.click(screen.getByRole("tab", { name: label }));
  act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));
  return screen.getByRole("tabpanel");
}

describe("SourcesSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("세그먼트 토글 세 개를 둔다", () => {
    const { container } = render(<SourcesSection />);

    expect(container.querySelector("section#sources")).not.toBeNull();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["자동 조회", "직접 입력", "지원 안 함"]);
  });

  it("자동 조회는 copy.ts의 공공데이터 출처 세 가지다", () => {
    render(<SourcesSection />);
    const panel = select("자동 조회");

    for (const name of SOURCES.slice(0, 3)) expect(within(panel).getByText(name)).toBeInTheDocument();
  });

  it("직접 입력은 등기부 권리관계 항목이다", () => {
    render(<SourcesSection />);
    const panel = select("직접 입력");

    expect(within(panel).getByText(SOURCES[3])).toBeInTheDocument();
    for (const item of [/채권최고액/, /신탁/, /소유자 변동/]) expect(within(panel).getAllByText(item).length).toBeGreaterThan(0);
  });

  it("지원 안 함은 PRD MVP 제외 사항과 이유다", () => {
    render(<SourcesSection />);
    const panel = select("지원 안 함");

    for (const item of [/다가구·단독주택/, /오피스텔/, /등기부등본/, /확정일자/, /국세 체납/, /KB시세/]) {
      expect(within(panel).getAllByText(item).length).toBeGreaterThan(0);
    }
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
