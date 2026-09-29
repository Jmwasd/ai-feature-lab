import { describe, expect, it } from "vitest";
import {
  DEBT_RATIO_THRESHOLD,
  HUG_GUARANTEE,
  JEONSE_RATIO_THRESHOLD,
  PRIORITY_REPAYMENT,
} from "@/consts/policy";
import { checkHugEligibility, checkPriorityRepayment, debtRatio, jeonseRatio } from "./ratios";

const price = 100_000_000;

describe("jeonseRatio", () => {
  it("주의 임계치 바로 아래는 normal이다", () => {
    const deposit = price * JEONSE_RATIO_THRESHOLD.caution - 1;
    expect(jeonseRatio(deposit, price)).toEqual({ ratio: deposit / price, level: "normal" });
  });

  it("정확히 주의 임계치면 caution이다", () => {
    const result = jeonseRatio(price * JEONSE_RATIO_THRESHOLD.caution, price);
    expect(result).toEqual({ ratio: JEONSE_RATIO_THRESHOLD.caution, level: "caution" });
  });

  it("위험 임계치 바로 아래는 caution이다", () => {
    const deposit = price * JEONSE_RATIO_THRESHOLD.danger - 1;
    expect(jeonseRatio(deposit, price)?.level).toBe("caution");
  });

  it("정확히 위험 임계치면 danger다", () => {
    const result = jeonseRatio(price * JEONSE_RATIO_THRESHOLD.danger, price);
    expect(result).toEqual({ ratio: JEONSE_RATIO_THRESHOLD.danger, level: "danger" });
  });

  it("시세가 null이면 null이다", () => {
    expect(jeonseRatio(price, null)).toBeNull();
  });

  it("시세가 0 이하면 0으로 나누지 않고 null이다", () => {
    expect(jeonseRatio(price, 0)).toBeNull();
    expect(jeonseRatio(price, -1)).toBeNull();
  });
});

describe("debtRatio", () => {
  // 채권최고액·선순위 보증금·내 보증금을 합쳐 목표 비율을 만든다
  function inputFor(ratio: number) {
    const total = price * ratio;
    const maxClaimAmount = 20_000_000;
    const seniorDeposits = 10_000_000;
    return {
      deposit: total - maxClaimAmount - seniorDeposits,
      maxClaimAmount,
      seniorDeposits,
      estimatedPrice: price,
    };
  }

  it("근저당·선순위 보증금·내 보증금을 모두 분자에 합산한다", () => {
    const result = debtRatio({
      deposit: 30_000_000,
      maxClaimAmount: 20_000_000,
      seniorDeposits: 10_000_000,
      estimatedPrice: price,
    });
    expect(result?.ratio).toBe(60_000_000 / price);
  });

  it("주의 임계치 바로 아래는 normal이다", () => {
    const input = inputFor(DEBT_RATIO_THRESHOLD.caution);
    expect(debtRatio({ ...input, deposit: input.deposit - 1 })?.level).toBe("normal");
  });

  it("정확히 주의 임계치면 caution이다", () => {
    expect(debtRatio(inputFor(DEBT_RATIO_THRESHOLD.caution))).toEqual({
      ratio: DEBT_RATIO_THRESHOLD.caution,
      level: "caution",
    });
  });

  it("위험 임계치 바로 아래는 caution이다", () => {
    const input = inputFor(DEBT_RATIO_THRESHOLD.danger);
    expect(debtRatio({ ...input, deposit: input.deposit - 1 })?.level).toBe("caution");
  });

  it("정확히 위험 임계치면 danger다", () => {
    expect(debtRatio(inputFor(DEBT_RATIO_THRESHOLD.danger))).toEqual({
      ratio: DEBT_RATIO_THRESHOLD.danger,
      level: "danger",
    });
  });

  it("시세가 null이거나 0 이하면 null이다", () => {
    const input = inputFor(DEBT_RATIO_THRESHOLD.caution);
    expect(debtRatio({ ...input, estimatedPrice: null })).toBeNull();
    expect(debtRatio({ ...input, estimatedPrice: 0 })).toBeNull();
  });
});

describe("checkHugEligibility", () => {
  const officialPrice = 300_000_000;
  const priceCap = Math.round(officialPrice * HUG_GUARANTEE.combinedRatio); // 3억 × 비율은 정수 원
  const seniorDebt = 100_000_000;

  it("합산 비율과 지역 한도를 둘 다 만족하면 eligible이다 (합산이 정확히 상한)", () => {
    const result = checkHugEligibility({
      deposit: priceCap - seniorDebt,
      seniorDebt,
      officialPrice,
      isCapitalArea: true,
    });
    expect(result).toEqual({ eligible: true, reasons: [] });
  });

  it("보증금 + 선순위채권이 공시가격 × 합산 비율을 넘으면 불가다", () => {
    const result = checkHugEligibility({
      deposit: priceCap - seniorDebt + 1,
      seniorDebt,
      officialPrice,
      isCapitalArea: true,
    });
    expect(result).toEqual({ eligible: false, reasons: ["exceeds-price-cap"] });
  });

  it("보증금이 정확히 지역 한도면 통과, 1원이라도 넘으면 불가다 (비수도권)", () => {
    const limit = HUG_GUARANTEE.depositCap.nonCapitalArea;
    const bigOfficialPrice = limit * 2;
    const base = { seniorDebt: 0, officialPrice: bigOfficialPrice, isCapitalArea: false };
    expect(checkHugEligibility({ ...base, deposit: limit }).eligible).toBe(true);
    expect(checkHugEligibility({ ...base, deposit: limit + 1 })).toEqual({
      eligible: false,
      reasons: ["exceeds-deposit-limit"],
    });
  });

  it("수도권은 수도권 한도를 적용한다", () => {
    const deposit = HUG_GUARANTEE.depositCap.nonCapitalArea + 1;
    const base = { deposit, seniorDebt: 0, officialPrice: deposit * 2 };
    expect(checkHugEligibility({ ...base, isCapitalArea: true }).eligible).toBe(true);
    expect(checkHugEligibility({ ...base, isCapitalArea: false }).eligible).toBe(false);
  });

  it("비율과 한도를 둘 다 넘으면 두 근거를 모두 반환한다", () => {
    const deposit = HUG_GUARANTEE.depositCap.capitalArea + 1;
    const result = checkHugEligibility({
      deposit,
      seniorDebt: 0,
      officialPrice: 100_000_000,
      isCapitalArea: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["exceeds-price-cap", "exceeds-deposit-limit"]);
  });

  it("공시가격이 없으면 unknown이다", () => {
    const result = checkHugEligibility({
      deposit: 1,
      seniorDebt: 0,
      officialPrice: null,
      isCapitalArea: true,
    });
    expect(result).toEqual({ eligible: "unknown", reasons: ["missing-official-price"] });
  });

  it("공시가격이 0 이하면 누락으로 보고 unknown이다", () => {
    const result = checkHugEligibility({
      deposit: 0,
      seniorDebt: 0,
      officialPrice: 0,
      isCapitalArea: true,
    });
    expect(result.eligible).toBe("unknown");
    expect(result.reasons).toContain("missing-official-price");
  });

  it("수도권 여부가 없으면 unknown이다", () => {
    const result = checkHugEligibility({
      deposit: 1,
      seniorDebt: 0,
      officialPrice,
      isCapitalArea: null,
    });
    expect(result).toEqual({ eligible: "unknown", reasons: ["missing-region"] });
  });

  it("입력이 누락돼도 확인 가능한 초과 근거는 함께 반환한다", () => {
    const result = checkHugEligibility({
      deposit: priceCap + 1,
      seniorDebt: 0,
      officialPrice,
      isCapitalArea: null,
    });
    expect(result.eligible).toBe("unknown");
    expect(result.reasons).toEqual(["exceeds-price-cap", "missing-region"]);
  });

  it("둘 다 없으면 두 누락 근거를 모두 반환한다", () => {
    const result = checkHugEligibility({
      deposit: 1,
      seniorDebt: 0,
      officialPrice: null,
      isCapitalArea: null,
    });
    expect(result).toEqual({
      eligible: "unknown",
      reasons: ["missing-official-price", "missing-region"],
    });
  });
});

describe("checkPriorityRepayment", () => {
  const tier = PRIORITY_REPAYMENT.SEOUL;

  it("보증금이 정확히 구간 상한이면 대상이고 변제액은 구간 변제액이다", () => {
    expect(checkPriorityRepayment({ deposit: tier.depositCap, regionTier: "SEOUL" })).toEqual({
      qualifies: true,
      amount: tier.repaymentAmount,
    });
  });

  it("보증금이 구간 상한을 1원이라도 넘으면 대상이 아니다", () => {
    expect(checkPriorityRepayment({ deposit: tier.depositCap + 1, regionTier: "SEOUL" })).toEqual(
      { qualifies: false, amount: 0 },
    );
  });

  it("보증금이 구간 변제액보다 작으면 보증금만큼만 변제된다", () => {
    const deposit = tier.repaymentAmount - 1;
    expect(checkPriorityRepayment({ deposit, regionTier: "SEOUL" })).toEqual({
      qualifies: true,
      amount: deposit,
    });
  });

  it("구간별 상한과 변제액을 적용한다", () => {
    const other = PRIORITY_REPAYMENT.OTHER;
    expect(checkPriorityRepayment({ deposit: other.depositCap, regionTier: "OTHER" })).toEqual({
      qualifies: true,
      amount: other.repaymentAmount,
    });
    expect(checkPriorityRepayment({ deposit: other.depositCap + 1, regionTier: "OTHER" })?.qualifies)
      .toBe(false);
  });

  it("구간을 모르면 null이다", () => {
    expect(checkPriorityRepayment({ deposit: 1, regionTier: null })).toBeNull();
  });
});
