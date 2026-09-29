import { describe, expect, it } from "vitest";

import {
  DEBT_RATIO_THRESHOLD,
  HUG_GUARANTEE,
  JEONSE_RATIO_THRESHOLD,
  PRIORITY_REPAYMENT,
  PRIORITY_REPAYMENT_HOUSE_VALUE_CAP_RATIO,
  PRIORITY_REPAYMENT_REGION,
} from "./policy";

describe("policy", () => {
  it("전세가율과 부채비율 모두 주의 임계치가 위험 임계치보다 작다", () => {
    expect(JEONSE_RATIO_THRESHOLD.caution).toBeLessThan(JEONSE_RATIO_THRESHOLD.danger);
    expect(DEBT_RATIO_THRESHOLD.caution).toBeLessThan(DEBT_RATIO_THRESHOLD.danger);
  });

  it("HUG 합산 비율이 공시가격 적용비율 × 담보인정비율과 같다", () => {
    expect(HUG_GUARANTEE.combinedRatio).toBeCloseTo(
      HUG_GUARANTEE.publicPriceRatio * HUG_GUARANTEE.collateralRatio,
      10,
    );
  });

  it("최우선변제 구간이 4개이고, 구간마다 변제액이 보증금 상한보다 작다", () => {
    const regions = Object.values(PRIORITY_REPAYMENT_REGION);
    expect(regions).toHaveLength(4);
    expect(Object.keys(PRIORITY_REPAYMENT).sort()).toEqual([...regions].sort());

    for (const region of regions) {
      const { depositCap, repaymentAmount } = PRIORITY_REPAYMENT[region];
      expect(repaymentAmount).toBeLessThan(depositCap);
    }
  });

  it("최우선변제 주택가액 상한 비율은 0과 1 사이다", () => {
    expect(PRIORITY_REPAYMENT_HOUSE_VALUE_CAP_RATIO).toBeGreaterThan(0);
    expect(PRIORITY_REPAYMENT_HOUSE_VALUE_CAP_RATIO).toBeLessThan(1);
  });

  it("모든 금액이 양의 정수다", () => {
    const amounts = [
      HUG_GUARANTEE.depositCap.capitalArea,
      HUG_GUARANTEE.depositCap.nonCapitalArea,
      ...Object.values(PRIORITY_REPAYMENT).flatMap((tier) => [
        tier.depositCap,
        tier.repaymentAmount,
      ]),
    ];

    for (const amount of amounts) {
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
    }
  });
});
