import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEBT_RATIO_THRESHOLD, HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { checkHugEligibility, debtRatio, hugPriceCap, jeonseRatio } from "@/features/judgment/ratios";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { formatPercent, formatWon } from "@/utils/format";
import { TRY_EXAMPLE, TRY_INITIAL, TRY_PRESETS } from "./try-examples";
import { TrySection } from "./TrySection";

const HUG_OK = "가입 기준 충족(공시가격 기준 추정)";
const HUG_NG = "가입 어려움";

function expected(deposit: number, maxClaimAmount: number) {
  const jr = jeonseRatio(deposit, TRY_EXAMPLE.estimatedPrice)!;
  const dr = debtRatio({ deposit, maxClaimAmount, seniorDeposits: 0, estimatedPrice: TRY_EXAMPLE.estimatedPrice })!;
  const hug = checkHugEligibility({
    deposit,
    seniorDebt: maxClaimAmount,
    officialPrice: TRY_EXAMPLE.officialPrice,
    isCapitalArea: TRY_EXAMPLE.isCapitalArea,
  });
  return { jr, dr, hug };
}

function hugRow() {
  return screen.getByTestId("hug-row");
}

describe("TrySection", () => {
  it("제목·설명·슬라이더 두 개·프리셋 칩을 디자인 문구로 둔다", () => {
    const { container } = render(<TrySection />);

    expect(container.querySelector("section#try")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "보증금을 움직여 보세요" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "시세 3억 2,000만, 공시가격 2억 1,000만인 망원동 빌라 한 채를 예로 들어요. 보증금과 근저당이 바뀌면 두 비율과 HUG 기준이 함께 움직여요.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "보증금" })).toHaveValue(String(TRY_INITIAL.deposit));
    expect(screen.getByRole("slider", { name: "근저당 채권최고액" })).toHaveValue(String(TRY_INITIAL.maxClaimAmount));
    expect(TRY_PRESETS.map((p) => p.label)).toEqual(["보증금이 낮을 때", "보증금이 높을 때", "근저당이 있을 때"]);
    for (const preset of TRY_PRESETS) expect(screen.getByRole("button", { name: preset.label })).toBeInTheDocument();
  });

  it("처음 값으로 비율 막대 두 개와 계산식·기준 문구를 그린다", () => {
    render(<TrySection />);
    const { jr, dr } = expected(TRY_INITIAL.deposit, TRY_INITIAL.maxClaimAmount);

    expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(jr.ratio));
    expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(dr.ratio));
    expect(screen.getByText("보증금 ÷ 시세")).toBeInTheDocument();
    expect(screen.getByText("(근저당 + 보증금) ÷ 시세")).toBeInTheDocument();
    expect(screen.getAllByText(`${formatPercent(JEONSE_RATIO_THRESHOLD.danger)} 기준`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${formatPercent(DEBT_RATIO_THRESHOLD.danger)} 기준`).length).toBeGreaterThan(0);
  });

  it("HUG 줄에 합계와 공시가격 × 126% 기준을 쓴다", () => {
    render(<TrySection />);
    const { deposit, maxClaimAmount } = TRY_INITIAL;
    const limit = hugPriceCap(TRY_EXAMPLE.officialPrice);

    expect(expected(deposit, maxClaimAmount).hug.eligible).toBe(false);
    expect(within(hugRow()).getByText(HUG_NG)).toBeInTheDocument();
    expect(hugRow()).toHaveTextContent(
      `근저당 + 보증금 ${formatWon(deposit + maxClaimAmount)} / 기준 ${formatWon(limit)} (공시가격 × ${formatPercent(HUG_GUARANTEE.combinedRatio)})`,
    );
  });

  it("보증금 슬라이더를 움직이면 전세가율·부채비율·HUG 줄이 바뀐다", () => {
    render(<TrySection />);
    const slider = screen.getByRole("slider", { name: "보증금" });
    const min = Number(slider.getAttribute("min"));
    fireEvent.change(slider, { target: { value: String(min) } });
    const after = expected(min, TRY_INITIAL.maxClaimAmount);

    expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(after.jr.ratio));
    expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(after.dr.ratio));
    expect(after.hug.eligible).toBe(true);
    expect(within(hugRow()).getByText(HUG_OK)).toBeInTheDocument();
  });

  it("채권최고액 슬라이더를 움직이면 부채비율만 바뀐다", () => {
    render(<TrySection />);
    const before = expected(TRY_INITIAL.deposit, TRY_INITIAL.maxClaimAmount);
    const slider = screen.getByRole("slider", { name: "근저당 채권최고액" });
    const max = Number(slider.getAttribute("max"));
    fireEvent.change(slider, { target: { value: String(max) } });
    const after = expected(TRY_INITIAL.deposit, max);

    expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(before.jr.ratio));
    expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(after.dr.ratio));
  });

  it("수준 라벨은 주의·위험만 쓰고 normal이면 기준 대비 사실을 쓴다", () => {
    render(<TrySection />);
    const slider = screen.getByRole("slider", { name: "보증금" });

    expect(screen.getAllByText("위험").length).toBeGreaterThan(0);
    fireEvent.change(slider, { target: { value: slider.getAttribute("min") } });
    expect(expected(Number(slider.getAttribute("min")), TRY_INITIAL.maxClaimAmount).jr.level).toBe("normal");
    expect(screen.getAllByText(`${formatPercent(JEONSE_RATIO_THRESHOLD.caution)} 미만`).length).toBeGreaterThan(0);
  });

  it("프리셋 칩을 누르면 그 보증금·근저당으로 다시 계산한다", () => {
    render(<TrySection />);

    for (const preset of TRY_PRESETS) {
      fireEvent.click(screen.getByRole("button", { name: preset.label }));
      const { jr, dr, hug } = expected(preset.deposit, preset.maxClaimAmount);

      expect(screen.getByRole("slider", { name: "보증금" })).toHaveValue(String(preset.deposit));
      expect(screen.getByRole("slider", { name: "근저당 채권최고액" })).toHaveValue(String(preset.maxClaimAmount));
      expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(jr.ratio));
      expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(dr.ratio));
      expect(within(hugRow()).getByText(hug.eligible === true ? HUG_OK : HUG_NG)).toBeInTheDocument();
    }
  });

  it("렌더링 결과에 금지 표현이 없다", () => {
    const { container } = render(<TrySection />);
    const texts: string[] = [];
    const collect = () => {
      texts.push(container.textContent ?? "");
      container.querySelectorAll("[aria-label],[aria-valuetext],[title]").forEach((el) => {
        for (const name of ["aria-label", "aria-valuetext", "title"]) texts.push(el.getAttribute(name) ?? "");
      });
    };

    collect();
    for (const preset of TRY_PRESETS) {
      fireEvent.click(screen.getByRole("button", { name: preset.label }));
      collect();
    }
    const slider = screen.getByRole("slider", { name: "보증금" });
    fireEvent.change(slider, { target: { value: slider.getAttribute("min") } });
    collect();

    expectNoForbiddenPhrases(texts.join("\n"));
  });
});
