// 전세가율·부채비율, HUG 보증 가입 조건, 최우선변제 대상 여부를 계산한다.
// 클라이언트·서버 양쪽에서 쓰는 순수 로직이다. 기준값은 모두 @/consts/policy에서 가져온다.
// 입력이 없으면 null 또는 "unknown"을 돌려준다. 누락값을 0으로 간주하면 위험을 가리는 결과가 된다.

import {
  DEBT_RATIO_THRESHOLD,
  HUG_GUARANTEE,
  JEONSE_RATIO_THRESHOLD,
  PRIORITY_REPAYMENT,
  type PriorityRepaymentRegion,
} from "@/consts/policy";

export type RatioLevel = "normal" | "caution" | "danger";

export interface RatioResult {
  ratio: number;
  level: RatioLevel;
}

export type HugReason =
  | "exceeds-price-cap" // 보증금 + 선순위채권 > 공시가격 × 합산 비율
  | "exceeds-deposit-limit" // 보증금 > 지역별 보증 한도
  | "missing-official-price"
  | "missing-region";

export interface HugEligibility {
  eligible: boolean | "unknown";
  reasons: HugReason[]; // 불가 또는 판단 불가의 근거. eligible이 true면 비어 있다
}

// 금액은 모두 원 단위 정수다.

/** 전세가율 = 보증금 ÷ 추정 매매가. 시세가 없거나 0 이하면 null. */
export function jeonseRatio(deposit: number, estimatedPrice: number | null): RatioResult | null {
  if (!isPositive(estimatedPrice)) return null;
  const ratio = deposit / estimatedPrice;
  return { ratio, level: levelOf(ratio, JEONSE_RATIO_THRESHOLD) };
}

/** 부채비율 = (근저당 채권최고액 + 선순위 보증금 + 내 보증금) ÷ 추정 매매가. 시세가 없거나 0 이하면 null. */
export function debtRatio(input: {
  deposit: number;
  maxClaimAmount: number; // 근저당 채권최고액 합계
  seniorDeposits: number; // 선순위 임차보증금 합계
  estimatedPrice: number | null;
}): RatioResult | null {
  const { deposit, maxClaimAmount, seniorDeposits, estimatedPrice } = input;
  if (!isPositive(estimatedPrice)) return null;
  const ratio = (maxClaimAmount + seniorDeposits + deposit) / estimatedPrice;
  return { ratio, level: levelOf(ratio, DEBT_RATIO_THRESHOLD) };
}

/**
 * HUG 전세보증금반환보증 가입 가능 여부의 공시가격 기준 추정치다. 실제 HUG 심사 결과를 보장하지 않는다.
 *
 * `보증금 + 선순위채권 ≤ 공시가격 × 합산 비율`과 `보증금 ≤ 지역별 보증 한도`를 둘 다 만족해야 true다.
 * 공시가격이나 수도권 여부가 없으면 "unknown"이고, 확인할 수 있었던 초과 근거는 reasons에 함께 담는다.
 */
export function checkHugEligibility(input: {
  deposit: number;
  seniorDebt: number; // 채권최고액 + 선순위 보증금
  officialPrice: number | null; // 공시가격
  isCapitalArea: boolean | null; // 수도권 여부
}): HugEligibility {
  const { deposit, seniorDebt, officialPrice, isCapitalArea } = input;
  const reasons: HugReason[] = [];
  let missing = false;

  if (isPositive(officialPrice)) {
    if (deposit + seniorDebt > hugPriceCap(officialPrice)) reasons.push("exceeds-price-cap");
  } else {
    reasons.push("missing-official-price");
    missing = true;
  }

  if (isCapitalArea === null) {
    reasons.push("missing-region");
    missing = true;
  } else {
    const limit = isCapitalArea
      ? HUG_GUARANTEE.depositCap.capitalArea
      : HUG_GUARANTEE.depositCap.nonCapitalArea;
    if (deposit > limit) reasons.push("exceeds-deposit-limit");
  }

  if (missing) return { eligible: "unknown", reasons };
  return { eligible: reasons.length === 0, reasons };
}

/**
 * 최우선변제(소액임차인) 대상 여부와 변제액. 구간을 모르면 null.
 * 주택가액 1/2 상한(PRIORITY_REPAYMENT_HOUSE_VALUE_CAP_RATIO)은 주택가액 입력이 없어 여기서 적용하지 않는다.
 */
export function checkPriorityRepayment(input: {
  deposit: number;
  regionTier: PriorityRepaymentRegion | null;
}): { qualifies: boolean; amount: number } | null {
  const { deposit, regionTier } = input;
  if (regionTier === null) return null;
  const tier = PRIORITY_REPAYMENT[regionTier];
  if (deposit > tier.depositCap) return { qualifies: false, amount: 0 };
  return { qualifies: true, amount: Math.min(tier.repaymentAmount, deposit) };
}

function levelOf(ratio: number, threshold: { caution: number; danger: number }): RatioLevel {
  if (ratio >= threshold.danger) return "danger";
  if (ratio >= threshold.caution) return "caution";
  return "normal";
}

function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

// 공시가격 × 합산 비율을 원 단위로 내린다. 부동소수 오차(예: 377999999.99999994)로
// 정확히 상한인 금액이 거절되지 않도록 소수 둘째 자리에서 먼저 반올림한다.
export function hugPriceCap(officialPrice: number): number {
  return Math.floor(Number((officialPrice * HUG_GUARANTEE.combinedRatio).toFixed(2)));
}
