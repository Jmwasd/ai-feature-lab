import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatioBar } from "./RatioBar";

const TRACK_MAX = 1.2;

function renderBar(ratio: number | null, extra: Partial<Parameters<typeof RatioBar>[0]> = {}) {
  return render(
    <RatioBar label="전세가율" ratio={ratio} dangerThreshold={0.8} thresholdLabel="기준 문구" statusText="상태" {...extra} />,
  );
}

describe("RatioBar", () => {
  it("라벨·상태·퍼센트·기준 문구·계산식을 보여준다", () => {
    renderBar(0.745, { formula: "보증금 ÷ 추정 매매가" });

    expect(screen.getByText("전세가율")).toHaveClass("text-title-md");
    expect(screen.getByText("상태")).toHaveClass("text-caption");
    expect(screen.getByText("74.5%")).toHaveClass("text-ratio-display", "tabular-nums");
    expect(screen.getByText("기준 문구")).toHaveClass("text-caption-sm", "text-muted");
    expect(screen.getByText("보증금 ÷ 추정 매매가")).toBeInTheDocument();
  });

  it("meter 역할과 값을 접근성 속성으로 알린다", () => {
    renderBar(0.745);
    const meter = screen.getByRole("meter", { name: "전세가율" });

    expect(meter).toHaveAttribute("aria-valuenow", "74.5");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "120");
    expect(meter).toHaveAttribute("aria-valuetext", "74.5%");
  });

  it("임계치 미만이면 잉크로 채운다", () => {
    renderBar(0.79);
    const fill = screen.getByTestId("ratio-fill");

    expect(fill).toHaveClass("bg-ink");
    expect(fill).not.toHaveClass("bg-error-text");
    expect(fill.style.width).toBe(`${(0.79 / TRACK_MAX) * 100}%`);
  });

  it("임계치 이상이면 error-text로 채운다", () => {
    renderBar(0.8);
    const fill = screen.getByTestId("ratio-fill");

    expect(fill).toHaveClass("bg-error-text");
    expect(fill).not.toHaveClass("bg-ink");
  });

  it("임계치 위치에 1px muted 기준선을 둔다", () => {
    renderBar(0.5);
    const line = screen.getByTestId("ratio-threshold");

    expect(line).toHaveClass("w-px", "bg-muted");
    expect(line.style.left).toBe(`${(0.8 / TRACK_MAX) * 100}%`);
  });

  it("120%를 넘으면 막대는 끝까지 채우고 숫자는 실제 값을 보여준다", () => {
    renderBar(1.5);

    expect(screen.getByTestId("ratio-fill").style.width).toBe("100%");
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "150%");
  });

  it("비율이 null이면 값 대신 안내를 보여주고 막대를 채우지 않는다", () => {
    renderBar(null);

    expect(screen.getByText("계산할 수 없어요")).toBeInTheDocument();
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ratio-fill")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("statusText가 없으면 상태 자리를 비운다", () => {
    render(<RatioBar label="부채비율" ratio={0.5} dangerThreshold={0.8} thresholdLabel="기준" />);

    expect(screen.queryByText("상태")).not.toBeInTheDocument();
  });

  it("icon을 라벨 앞에 둔다", () => {
    renderBar(0.5, { icon: <svg data-testid="bar-icon" /> });

    expect(screen.getByText("전세가율")).toContainElement(screen.getByTestId("bar-icon"));
  });

  it("shownRatio를 넘기면 숫자·막대·채움 색을 그 값으로 그리고 접근성 값은 실제 비율을 쓴다", () => {
    renderBar(0.9, { shownRatio: 0.6 });
    const fill = screen.getByTestId("ratio-fill");

    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(fill.style.width).toBe(`${(0.6 / TRACK_MAX) * 100}%`);
    expect(fill).toHaveClass("bg-ink");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "90%");
  });
});
