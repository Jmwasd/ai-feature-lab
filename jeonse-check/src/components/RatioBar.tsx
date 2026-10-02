"use client";

import type { ReactNode } from "react";
import { useTweenedNumber } from "@/hooks/use-tweened-number";
import { formatPercent } from "@/utils/format";

// 트랙 끝이 나타내는 비율. 이보다 큰 값은 막대를 끝까지 채우고 숫자로 실제 값을 보여준다.
const TRACK_MAX = 1.2;

function trackPercent(ratio: number): string {
  return `${(Math.min(ratio, TRACK_MAX) / TRACK_MAX) * 100}%`;
}

// 비율 막대(UI_GUIDE §4). 도메인 기준값은 props로 받는다.
// shownRatio를 넘기면 숫자와 막대를 그 값으로 그린다(호출부가 트윈을 맡는다). 없으면 자체 트윈 + 막대 채움 전환을 쓴다.
export function RatioBar({
  label,
  icon,
  ratio,
  shownRatio,
  dangerThreshold,
  statusText,
  formula,
  thresholdLabel,
}: {
  label: string;
  icon?: ReactNode;
  ratio: number | null;
  shownRatio?: number;
  dangerThreshold: number;
  statusText?: string;
  formula?: ReactNode;
  thresholdLabel: string;
}) {
  const tweened = useTweenedNumber(ratio ?? 0);
  const shown = shownRatio ?? tweened;
  const danger = ratio !== null && ratio >= dangerThreshold;
  // 트윈을 호출부가 맡으면 채움 색도 지금 보이는 값을 따른다.
  const fillDanger = shownRatio === undefined ? danger : shown >= dangerThreshold;
  const meterProps =
    ratio === null
      ? {}
      : {
          role: "meter",
          "aria-label": label,
          "aria-valuemin": 0,
          "aria-valuemax": TRACK_MAX * 100,
          "aria-valuenow": Math.round(Math.min(ratio, TRACK_MAX) * 1000) / 10,
          "aria-valuetext": formatPercent(ratio),
        };

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-baseline justify-between gap-md">
        <span className="flex items-center gap-sm text-title-md text-ink">
          {icon}
          {label}
        </span>
        <span className="flex items-baseline gap-sm">
          {statusText ? (
            <span className={`text-caption font-bold ${danger ? "text-error-text" : "text-ink"}`}>{statusText}</span>
          ) : null}
          {ratio === null ? (
            <span className="text-body-md text-muted">계산할 수 없어요</span>
          ) : (
            <span className="text-ratio-display tabular-nums text-ink">{formatPercent(shown)}</span>
          )}
        </span>
      </div>
      <div {...meterProps} className="relative h-2.5 rounded-full bg-surface-strong">
        {ratio === null ? null : (
          <div
            data-testid="ratio-fill"
            className={`absolute inset-y-0 left-0 rounded-full ${shownRatio === undefined ? "transition-[width] duration-1200 ease-fill" : "transition-colors ease-linear"} ${
              fillDanger ? "bg-error-text" : "bg-ink"
            }`}
            style={{ width: trackPercent(shownRatio === undefined ? ratio : shown) }}
          />
        )}
        <div
          data-testid="ratio-threshold"
          aria-hidden="true"
          className="absolute -inset-y-[5px] w-px bg-muted"
          style={{ left: trackPercent(dangerThreshold) }}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        {formula ? <span className="text-caption-sm tabular-nums text-muted">{formula}</span> : null}
        <span className="text-caption-sm text-muted">{thresholdLabel}</span>
      </div>
    </div>
  );
}
