import { CircleCheck, TriangleAlert } from "lucide-react";
import { RatioBar } from "@/components/RatioBar";
import { DEBT_RATIO_THRESHOLD, HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { formatPercent, formatWon } from "@/utils/format";
import { HUG_STATUS, SIGNAL_COPY, priorityRepaymentText, ratioStatusText } from "../copy";
import type { JudgmentView } from "./types";

// 우측 레일: 비율 막대 2개 + HUG 줄 + 최우선변제 줄. 값은 판정 결과를 그대로 쓰고 다시 계산하지 않는다.
// 기준값은 policy.ts에서 가져온다(UI_GUIDE §6).
export function RatioPanel({ view }: { view: JudgmentView }) {
  const { deposit, rights, hug, jeonseRatio, debtRatio } = view;
  const price = view.priceEstimate.price;
  const priceText = price === null ? null : formatWon(price);

  return (
    <div data-testid="ratio-panel" className="flex flex-col gap-xl rounded-card border border-hairline p-lg">
      <RatioBar
        label="전세가율"
        ratio={jeonseRatio?.ratio ?? null}
        dangerThreshold={JEONSE_RATIO_THRESHOLD.danger}
        statusText={jeonseRatio ? ratioStatusText(jeonseRatio, JEONSE_RATIO_THRESHOLD) : undefined}
        formula={priceText ? `보증금 ${formatWon(deposit)} ÷ 추정 매매가 ${priceText}` : undefined}
        thresholdLabel={`${formatPercent(JEONSE_RATIO_THRESHOLD.danger)} 기준`}
      />
      <RatioBar
        label="부채비율"
        ratio={debtRatio?.ratio ?? null}
        dangerThreshold={DEBT_RATIO_THRESHOLD.danger}
        statusText={debtRatio ? ratioStatusText(debtRatio, DEBT_RATIO_THRESHOLD) : undefined}
        formula={
          priceText
            ? `(채권최고액 ${formatWon(rights.maxClaimAmount)} + 선순위 보증금 ${formatWon(rights.seniorDeposits)} + 보증금 ${formatWon(deposit)}) ÷ 추정 매매가 ${priceText}`
            : undefined
        }
        thresholdLabel={`${formatPercent(DEBT_RATIO_THRESHOLD.danger)} 기준`}
      />
      <div data-testid="hug-row" className="flex flex-col gap-xs border-t border-hairline-soft pt-base">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <span className="text-title-md text-ink">HUG 전세보증</span>
          {hug.eligible === true ? (
            <span className="flex items-center gap-xs text-caption text-ink">
              <CircleCheck aria-hidden="true" className="size-5" />
              {HUG_STATUS.eligible}
            </span>
          ) : hug.eligible === false ? (
            <span className="flex items-center gap-xs text-caption text-error-text">
              <TriangleAlert aria-hidden="true" className="size-5" />
              {HUG_STATUS.ineligible}
            </span>
          ) : (
            <span className="text-caption text-muted">{HUG_STATUS.unknown}</span>
          )}
        </div>
        {/* 판단 불가 사유(hugUnknownNote)는 report.notes에 이미 있어 여기서 되풀이하지 않는다. */}
        {hug.eligible === false ? (
          <p className="text-body-sm text-body">{SIGNAL_COPY["hug-ineligible"].detail(hug.reasons)}</p>
        ) : null}
        <p className="text-caption-sm tabular-nums text-muted">
          보증금 + 선순위채권 ≤ 공시가격 × {formatPercent(HUG_GUARANTEE.combinedRatio)}
        </p>
      </div>
      <div data-testid="priority-row" className="flex flex-col gap-xs border-t border-hairline-soft pt-base">
        <span className="text-title-md text-ink">최우선변제</span>
        <p className="text-body-sm tabular-nums text-body">{priorityRepaymentText(view.priorityRepayment)}</p>
      </div>
    </div>
  );
}
