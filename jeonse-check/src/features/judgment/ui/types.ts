// 결과 화면이 받는 뷰 모델. 판정 함수의 결과를 그대로 담고, 화면은 이 값을 다시 계산하지 않는다.

import type { PriceEstimate } from "../price-estimate";
import type { HugEligibility, RatioResult } from "../ratios";
import type { RiskReport } from "../risk-report";
import type { RightsInput } from "../types";

export interface JudgmentView {
  address: { display: string; dong?: string; ho?: string };
  deposit: number; // 원
  exclusiveArea: number; // ㎡
  report: RiskReport;
  priceEstimate: PriceEstimate;
  jeonseRatio: RatioResult | null;
  debtRatio: RatioResult | null;
  hug: HugEligibility;
  priorityRepayment: { qualifies: boolean; amount: number } | null;
  rights: RightsInput;
}
