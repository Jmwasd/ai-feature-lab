"use client";

import { CircleCheck, CircleX, Landmark, Percent, Scale, SlidersHorizontal, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { RatioBar } from "@/components/RatioBar";
import { DEBT_RATIO_THRESHOLD, HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { HUG_STATUS, ratioStatusText } from "@/features/judgment/copy";
import { checkHugEligibility, debtRatio, hugPriceCap, jeonseRatio, type RatioResult } from "@/features/judgment/ratios";
import { useApproach } from "@/hooks/use-approach";
import { useReveal } from "@/hooks/use-reveal";
import { formatPercent, formatWon } from "@/utils/format";
import { LandingSection, SectionHeading } from "./LandingSection";
import { Reveal } from "./Reveal";
import { DEPOSIT_RANGE, MAX_CLAIM_RANGE, TRY_EXAMPLE, TRY_INITIAL, TRY_PRESETS } from "./try-examples";

const PRESET_ICONS = [TrendingDown, TrendingUp, Landmark];

// 화면에는 퍼센트를 정수로 보여 준다(시안). 접근성 값은 RatioBar가 실제 비율로 알린다.
function toShownRatio(percent: number): number {
  return Math.round(percent) / 100;
}

export function TrySection() {
  const [deposit, setDeposit] = useState<number>(TRY_INITIAL.deposit);
  const [maxClaimAmount, setMaxClaimAmount] = useState<number>(TRY_INITIAL.maxClaimAmount);
  // 섹션이 뷰포트에 들어오면 0에서 숫자를 올린다.
  const { ref, visible } = useReveal<HTMLDivElement>();

  // 계산은 판정 로직을 그대로 쓴다. 이 컴포넌트에서 비율을 다시 계산하거나 임계치와 비교하지 않는다.
  const { estimatedPrice, officialPrice, isCapitalArea } = TRY_EXAMPLE;
  // 예시 집은 공시가격과 지역이 정해져 있어 결과가 "unknown"이 되지 않는다.
  const hugOk = checkHugEligibility({ deposit, seniorDebt: maxClaimAmount, officialPrice, isCapitalArea }).eligible === true;

  return (
    <LandingSection id="try" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-xxl">
      <div ref={ref} className="grid gap-xl">
        <div className="grid gap-sm">
          <SectionHeading
            id="try"
            icon={<SlidersHorizontal size={18} />}
            title="보증금을 움직여 보세요"
            description="시세 3억 2,000만, 공시가격 2억 1,000만인 망원동 빌라 한 채를 예로 들어요. 보증금과 근저당이 바뀌면 두 비율과 HUG 기준이 함께 움직여요."
          />
        </div>
        <Slider label="보증금" icon={<Wallet aria-hidden="true" size={16} />} value={deposit} range={DEPOSIT_RANGE} onChange={setDeposit} />
        <Slider
          label="근저당 채권최고액"
          icon={<Landmark aria-hidden="true" size={16} />}
          value={maxClaimAmount}
          range={MAX_CLAIM_RANGE}
          onChange={setMaxClaimAmount}
        />
        <PresetButtons
          onPick={(preset) => {
            setDeposit(preset.deposit);
            setMaxClaimAmount(preset.maxClaimAmount);
          }}
        />
      </div>
      <Reveal
        delayMs={280}
        className="grid gap-lg rounded-card border border-hairline p-lg shadow-float hover:border-border-strong"
      >
        <TryRatioBar
          label="전세가율"
          icon={<Percent aria-hidden="true" size={16} />}
          result={jeonseRatio(deposit, estimatedPrice)}
          threshold={JEONSE_RATIO_THRESHOLD}
          formula="보증금 ÷ 시세"
          visible={visible}
        />
        <TryRatioBar
          label="부채비율"
          icon={<Scale aria-hidden="true" size={16} />}
          result={debtRatio({ deposit, maxClaimAmount, seniorDeposits: 0, estimatedPrice })}
          threshold={DEBT_RATIO_THRESHOLD}
          formula="(근저당 + 보증금) ÷ 시세"
          visible={visible}
        />
        <HugRow ok={hugOk} combined={deposit + maxClaimAmount} officialPrice={officialPrice} />
      </Reveal>
    </LandingSection>
  );
}

function PresetButtons({ onPick }: { onPick: (preset: (typeof TRY_PRESETS)[number]) => void }) {
  return (
    <div role="group" aria-label="예시 조건" className="flex flex-wrap gap-sm">
      {TRY_PRESETS.map((preset, i) => {
        const Icon = PRESET_ICONS[i];
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onPick(preset)}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-hairline px-base text-caption text-ink transition-colors ease-linear hover:border-ink hover:bg-surface-soft"
          >
            <Icon aria-hidden="true" size={14} />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

// 비율 막대 하나. 섹션이 보이면 0에서 실제 비율까지 숫자를 올린다.
function TryRatioBar({
  label,
  icon,
  result,
  threshold,
  formula,
  visible,
}: {
  label: string;
  icon: ReactNode;
  result: RatioResult | null;
  threshold: { caution: number; danger: number };
  formula: string;
  visible: boolean;
}) {
  const shown = useApproach((result?.ratio ?? 0) * 100, visible);
  return (
    <RatioBar
      label={label}
      icon={icon}
      ratio={result?.ratio ?? null}
      shownRatio={toShownRatio(shown)}
      dangerThreshold={threshold.danger}
      statusText={result ? ratioStatusText(result, threshold) : undefined}
      formula={formula}
      thresholdLabel={`${formatPercent(threshold.danger)} 기준`}
    />
  );
}

function HugRow({ ok, combined, officialPrice }: { ok: boolean; combined: number; officialPrice: number }) {
  const tone = ok ? "text-ink" : "text-error-text";
  return (
    <div data-testid="hug-row" className="flex items-start gap-md border-t border-hairline-soft pt-base">
      {/* 기준 충족은 잉크색 circle-check만 쓴다(UI_GUIDE §7). */}
      <span className={`shrink-0 pt-xxs ${tone}`}>
        {ok ? <CircleCheck aria-hidden="true" size={24} /> : <CircleX aria-hidden="true" size={24} />}
      </span>
      <div className="grid gap-xxs">
        <p className="text-title-md text-ink">
          HUG 보증보험 <span className={`font-bold ${tone}`}>{ok ? HUG_STATUS.eligible : "가입 어려움"}</span>
        </p>
        <p className="text-body-sm tabular-nums text-body">
          근저당 + 보증금 {formatWon(combined)} / 기준 {formatWon(hugPriceCap(officialPrice))} (공시가격 ×{" "}
          {formatPercent(HUG_GUARANTEE.combinedRatio)})
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  icon,
  value,
  range,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  range: { min: number; max: number; step: number };
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="grid gap-md">
      <div className="flex items-baseline justify-between gap-md">
        <label htmlFor={id} className="flex items-center gap-1.5 text-caption text-ink">
          {icon}
          {label}
        </label>
        <span className="text-title-md tabular-nums text-ink">{formatWon(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        aria-valuetext={formatWon(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
