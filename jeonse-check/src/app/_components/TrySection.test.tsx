import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEBT_RATIO_THRESHOLD, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { checkHugEligibility, debtRatio, jeonseRatio } from "@/features/judgment/ratios";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { formatPercent } from "@/utils/format";
import { TRY_PRESETS, type TryPreset } from "./try-examples";
import { TrySection } from "./TrySection";

const HUG_OK = "가입 기준 충족(공시가격 기준 추정)";
const HUG_NG = "가입 어려움";

function expected(preset: TryPreset, deposit: number, maxClaimAmount: number) {
  const jr = jeonseRatio(deposit, preset.estimatedPrice)!;
  const dr = debtRatio({ deposit, maxClaimAmount, seniorDeposits: 0, estimatedPrice: preset.estimatedPrice })!;
  const hug = checkHugEligibility({
    deposit,
    seniorDebt: maxClaimAmount,
    officialPrice: preset.officialPrice,
    isCapitalArea: preset.isCapitalArea,
  });
  return { jr, dr, hug };
}

function hugRow() {
  return screen.getByTestId("hug-row");
}

describe("TrySection", () => {
  it("#try 섹션에 슬라이더 두 개와 프리셋 칩, 예시 안내를 둔다", () => {
    const { container } = render(<TrySection />);

    expect(container.querySelector("section#try")).not.toBeNull();
    expect(screen.getByRole("slider", { name: "보증금" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "근저당 채권최고액" })).toBeInTheDocument();
    for (const preset of TRY_PRESETS) {
      expect(screen.getByRole("button", { name: preset.label })).toBeInTheDocument();
    }
    expect(screen.getByText(/예시 계산이며 실제 시세가 아니에요/)).toBeInTheDocument();
  });

  it("첫 프리셋 값으로 비율 막대 두 개와 기준 문구를 policy 수치로 그린다", () => {
    render(<TrySection />);
    const preset = TRY_PRESETS[0];
    const { jr, dr } = expected(preset, preset.deposit, preset.maxClaimAmount);

    expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(jr.ratio));
    expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(dr.ratio));
    expect(screen.getAllByText(`${formatPercent(JEONSE_RATIO_THRESHOLD.danger)} 기준`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${formatPercent(DEBT_RATIO_THRESHOLD.danger)} 기준`).length).toBeGreaterThan(0);
  });

  it("보증금 슬라이더를 움직이면 전세가율·부채비율·HUG 줄이 바뀐다", () => {
    render(<TrySection />);
    const preset = TRY_PRESETS[0];
    const before = expected(preset, preset.deposit, preset.maxClaimAmount);
    expect(before.hug.eligible).toBe(true);
    expect(within(hugRow()).getByText(HUG_OK)).toBeInTheDocument();

    const slider = screen.getByRole("slider", { name: "보증금" });
    const max = Number(slider.getAttribute("max"));
    fireEvent.change(slider, { target: { value: String(max) } });
    const after = expected(preset, max, preset.maxClaimAmount);

    expect(after.jr.ratio).not.toBe(before.jr.ratio);
    expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(after.jr.ratio));
    expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(after.dr.ratio));
    expect(after.hug.eligible).toBe(false);
    expect(within(hugRow()).getByText(HUG_NG)).toBeInTheDocument();
    expect(within(hugRow()).queryByText(HUG_OK)).not.toBeInTheDocument();
  });

  it("채권최고액 슬라이더를 움직이면 부채비율과 HUG 줄만 바뀐다", () => {
    render(<TrySection />);
    const preset = TRY_PRESETS[0];
    const before = expected(preset, preset.deposit, preset.maxClaimAmount);

    const slider = screen.getByRole("slider", { name: "근저당 채권최고액" });
    const max = Number(slider.getAttribute("max"));
    fireEvent.change(slider, { target: { value: String(max) } });
    const after = expected(preset, preset.deposit, max);

    expect(screen.getByRole("meter", { name: "전세가율" })).toHaveAttribute("aria-valuetext", formatPercent(before.jr.ratio));
    expect(screen.getByRole("meter", { name: "부채비율" })).toHaveAttribute("aria-valuetext", formatPercent(after.dr.ratio));
    expect(after.hug.eligible).toBe(false);
    expect(within(hugRow()).getByText(HUG_NG)).toBeInTheDocument();
  });

  it("수준 라벨은 주의·위험만 쓰고 normal이면 기준 대비 사실을 쓴다", () => {
    render(<TrySection />);
    const slider = screen.getByRole("slider", { name: "보증금" });
    const min = Number(slider.getAttribute("min"));
    const max = Number(slider.getAttribute("max"));
    const preset = TRY_PRESETS[0];

    fireEvent.change(slider, { target: { value: String(min) } });
    expect(expected(preset, min, preset.maxClaimAmount).jr.level).toBe("normal");
    expect(screen.getAllByText(`${formatPercent(JEONSE_RATIO_THRESHOLD.caution)} 미만`).length).toBeGreaterThan(0);

    fireEvent.change(slider, { target: { value: String(max) } });
    expect(expected(preset, max, preset.maxClaimAmount).jr.level).toBe("danger");
    expect(screen.getAllByText("위험").length).toBeGreaterThan(0);
  });

  it("프리셋 칩을 누르면 그 조건으로 다시 계산한다", () => {
    render(<TrySection />);

    for (const preset of TRY_PRESETS) {
      const chip = screen.getByRole("button", { name: preset.label });
      fireEvent.click(chip);
      const { jr, dr, hug } = expected(preset, preset.deposit, preset.maxClaimAmount);

      expect(chip).toHaveAttribute("aria-pressed", "true");
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

    for (const preset of TRY_PRESETS) {
      fireEvent.click(screen.getByRole("button", { name: preset.label }));
      collect();
      const slider = screen.getByRole("slider", { name: "보증금" });
      fireEvent.change(slider, { target: { value: slider.getAttribute("min") } });
      collect();
    }

    expectNoForbiddenPhrases(texts.join("\n"));
  });
});
