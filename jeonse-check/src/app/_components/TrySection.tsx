"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { RatioBar } from "@/components/RatioBar";
import { DEBT_RATIO_THRESHOLD, HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { SIGNAL_COPY, hugUnknownNote } from "@/features/judgment/copy";
import { checkHugEligibility, debtRatio, jeonseRatio, type RatioResult } from "@/features/judgment/ratios";
import { formatPercent, formatWon } from "@/utils/format";
import { LandingSection } from "./LandingSection";
import { Reveal } from "./Reveal";
import { DEPOSIT_RANGE, MAX_CLAIM_RANGE, TRY_PRESETS } from "./try-examples";

const LEVEL_TEXT = { caution: "주의", danger: "위험" } as const;

// normal이면 주의 임계치 "미만"처럼 기준 대비 사실을 쓴다(UI_GUIDE §6).
function statusText(result: RatioResult | null, threshold: { caution: number }): string | undefined {
  if (!result) return undefined;
  return result.level === "normal" ? `${formatPercent(threshold.caution)} 미만` : LEVEL_TEXT[result.level];
}

export function TrySection() {
  const [presetIndex, setPresetIndex] = useState(0);
  const preset = TRY_PRESETS[presetIndex];
  const [deposit, setDeposit] = useState(preset.deposit);
  const [maxClaimAmount, setMaxClaimAmount] = useState(preset.maxClaimAmount);

  const choosePreset = (index: number) => {
    setPresetIndex(index);
    setDeposit(TRY_PRESETS[index].deposit);
    setMaxClaimAmount(TRY_PRESETS[index].maxClaimAmount);
  };

  // 계산은 판정 로직을 그대로 쓴다. 이 컴포넌트에서 비율을 다시 계산하거나 임계치와 비교하지 않는다.
  const jr = jeonseRatio(deposit, preset.estimatedPrice);
  const dr = debtRatio({ deposit, maxClaimAmount, seniorDeposits: 0, estimatedPrice: preset.estimatedPrice });
  const hug = checkHugEligibility({
    deposit,
    seniorDebt: maxClaimAmount,
    officialPrice: preset.officialPrice,
    isCapitalArea: preset.isCapitalArea,
  });

  return (
    <LandingSection id="try" title="계산해 보기">
      <p className="mt-sm text-body-md text-body">보증금과 근저당을 움직이면 비율과 HUG 보증 가입 기준이 바로 바뀌어요.</p>
      <div className="mt-xl grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-xxl">
        <Reveal className="flex flex-col gap-xl">
          <div role="group" aria-label="예시 조건" className="flex flex-wrap gap-sm">
            {TRY_PRESETS.map((p, index) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={index === presetIndex}
                onClick={() => choosePreset(index)}
                className="h-10 rounded-full border border-hairline px-base text-caption text-ink transition-colors hover:border-ink hover:bg-surface-soft aria-pressed:border-ink aria-pressed:bg-surface-soft"
              >
                {p.label}
              </button>
            ))}
          </div>
          <Slider label="보증금" value={deposit} range={DEPOSIT_RANGE} onChange={setDeposit} />
          <Slider label="근저당 채권최고액" value={maxClaimAmount} range={MAX_CLAIM_RANGE} onChange={setMaxClaimAmount} />
          <dl className="flex flex-col gap-xs text-body-sm text-muted">
            <div className="flex justify-between gap-md">
              <dt>예시 추정 매매가</dt>
              <dd className="tabular-nums text-ink">{formatWon(preset.estimatedPrice)}</dd>
            </div>
            <div className="flex justify-between gap-md">
              <dt>예시 공시가격</dt>
              <dd className="tabular-nums text-ink">{formatWon(preset.officialPrice)}</dd>
            </div>
          </dl>
          <p className="text-caption-sm text-muted">
            예시 계산이며 실제 시세가 아니에요. 실제 확인에서는 주소로 조회한 공공데이터와 입력한 등기부 정보로 계산해요.
          </p>
        </Reveal>
        <Reveal delayMs={100} className="flex flex-col gap-xl rounded-card border border-hairline p-lg">
          <RatioBar
            label="전세가율"
            ratio={jr?.ratio ?? null}
            dangerThreshold={JEONSE_RATIO_THRESHOLD.danger}
            statusText={statusText(jr, JEONSE_RATIO_THRESHOLD)}
            formula={`보증금 ${formatWon(deposit)} ÷ 추정 매매가 ${formatWon(preset.estimatedPrice)}`}
            thresholdLabel={`${formatPercent(JEONSE_RATIO_THRESHOLD.danger)} 기준`}
          />
          <RatioBar
            label="부채비율"
            ratio={dr?.ratio ?? null}
            dangerThreshold={DEBT_RATIO_THRESHOLD.danger}
            statusText={statusText(dr, DEBT_RATIO_THRESHOLD)}
            formula={`(채권최고액 ${formatWon(maxClaimAmount)} + 보증금 ${formatWon(deposit)}) ÷ 추정 매매가 ${formatWon(preset.estimatedPrice)}`}
            thresholdLabel={`${formatPercent(DEBT_RATIO_THRESHOLD.danger)} 기준`}
          />
          <div data-testid="hug-row" className="flex flex-col gap-xs border-t border-hairline-soft pt-base">
            <div className="flex items-center justify-between gap-md">
              <span className="text-title-md text-ink">HUG 전세보증</span>
              {hug.eligible === true ? (
                <span className="flex items-center gap-xs text-caption text-ink">
                  <CircleCheck aria-hidden="true" className="size-5" />
                  가입 기준 충족(공시가격 기준 추정)
                </span>
              ) : hug.eligible === false ? (
                <span className="flex items-center gap-xs text-caption text-error-text">
                  <TriangleAlert aria-hidden="true" className="size-5" />
                  가입 어려움
                </span>
              ) : null}
            </div>
            {hug.eligible !== true ? (
              <p className="text-body-sm text-body">
                {hug.eligible === false ? SIGNAL_COPY["hug-ineligible"].detail(hug.reasons) : hugUnknownNote(hug.reasons)}
              </p>
            ) : null}
            <p className="text-caption-sm tabular-nums text-muted">
              보증금 {formatWon(deposit)} + 채권최고액 {formatWon(maxClaimAmount)} ≤ 공시가격 {formatWon(preset.officialPrice)} ×{" "}
              {formatPercent(HUG_GUARANTEE.combinedRatio)}
            </p>
          </div>
        </Reveal>
      </div>
    </LandingSection>
  );
}

function Slider({
  label,
  value,
  range,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-baseline justify-between gap-md">
        <label htmlFor={id} className="text-caption text-body">
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
