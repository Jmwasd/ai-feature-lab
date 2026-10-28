// 랜딩 "03 결과" 장면의 예시 집과 지표. 실제 판정과 같은 계산(ratios.ts)과 문구(copy.ts)를 쓴다.
// 예시 금액은 일러스트용 가정값이라 정책 수치가 아니다. 기준값은 모두 ratios.ts가 @/consts/policy에서 가져온다.

import { DEBT_RATIO_THRESHOLD, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { ratioStatusText } from "@/features/judgment/copy";
import { checkHugEligibility, debtRatio, jeonseRatio, type RatioLevel, type RatioResult } from "@/features/judgment/ratios";
import { formatWholePercent } from "@/utils/format";

export const DEMO_HOUSE = {
  marketPrice: 318_000_000, // 추정 시세(실거래 6건 기준이라는 가정)
  maxClaimAmount: 40_000_000, // 근저당 채권최고액
  officialPrice: 210_000_000, // 공시가격
} as const;

export const DEMO_DEPOSIT = { min: 100_000_000, max: 360_000_000, step: 5_000_000, initial: 200_000_000 } as const;

export type DemoMetric = { label: string; value: string; status: string; level: RatioLevel };

export function demoMetrics(deposit: number): DemoMetric[] {
  const { marketPrice, maxClaimAmount, officialPrice } = DEMO_HOUSE;
  // 시세가 양수인 예시라 null이 되지 않는다.
  const jeonse = jeonseRatio(deposit, marketPrice) as RatioResult;
  const debt = debtRatio({ deposit, maxClaimAmount, seniorDeposits: 0, estimatedPrice: marketPrice }) as RatioResult;
  const hug = checkHugEligibility({ deposit, seniorDebt: maxClaimAmount, officialPrice, isCapitalArea: true });

  return [
    { label: "전세가율", value: formatWholePercent(jeonse.ratio), status: ratioStatusText(jeonse, JEONSE_RATIO_THRESHOLD), level: jeonse.level },
    { label: "부채비율", value: formatWholePercent(debt.ratio), status: ratioStatusText(debt, DEBT_RATIO_THRESHOLD), level: debt.level },
    hug.eligible === true
      ? { label: "HUG 보증", value: "기준 충족", status: "공시가격 기준 추정", level: "normal" }
      : { label: "HUG 보증", value: "가입 어려움", status: "공시가격 기준 추정", level: "danger" },
  ];
}
