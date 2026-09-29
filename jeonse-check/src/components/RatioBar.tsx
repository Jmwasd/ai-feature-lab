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
export function RatioBar({
  label,
  ratio,
  dangerThreshold,
  statusText,
  formula,
  thresholdLabel,
}: {
  label: string;
  ratio: number | null;
  dangerThreshold: number;
  statusText?: string;
  formula?: ReactNode;
  thresholdLabel: string;
}) {
  const shown = useTweenedNumber(ratio ?? 0);
  const danger = ratio !== null && ratio >= dangerThreshold;
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
        <span className="text-title-md text-ink">{label}</span>
        {statusText ? (
          <span className={`text-caption ${danger ? "text-error-text" : "text-ink"}`}>{statusText}</span>
        ) : null}
      </div>
      {ratio === null ? (
        <p className="text-body-md text-muted">계산할 수 없어요</p>
      ) : (
        <p className="text-ratio-display tabular-nums text-ink">{formatPercent(shown)}</p>
      )}
      <div {...meterProps} className="relative h-2.5 rounded-full bg-surface-strong">
        {ratio === null ? null : (
          <div
            data-testid="ratio-fill"
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-1200 ease-fill ${danger ? "bg-error-text" : "bg-ink"}`}
            style={{ width: trackPercent(ratio) }}
          />
        )}
        <div
          data-testid="ratio-threshold"
          aria-hidden="true"
          className="absolute -inset-y-1 w-px bg-muted"
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
