import { describe, expect, it } from "vitest";
import { PRICE_ESTIMATE } from "@/consts/policy";
import { estimateSalePrice } from "./price-estimate";
import type { ComparableTrade } from "./types";

const asOf = new Date("2026-09-29T00:00:00Z");

const target = {
  buildingKey: "11110-100",
  lawdCd: "11110",
  umdName: "청운동",
  houseType: "row-house" as const,
  exclusiveArea: 60,
};

function trade(overrides: Partial<ComparableTrade> = {}): ComparableTrade {
  return {
    buildingKey: target.buildingKey,
    lawdCd: target.lawdCd,
    umdName: target.umdName,
    houseType: target.houseType,
    exclusiveArea: target.exclusiveArea,
    floor: 3,
    contractDate: new Date("2026-06-15T00:00:00Z"),
    price: 300_000_000,
    cancelled: false,
    ...overrides,
  };
}

// 같은 동·유형이지만 다른 건물인 거래
function dongTrade(overrides: Partial<ComparableTrade> = {}): ComparableTrade {
  return trade({ buildingKey: "11110-999", ...overrides });
}

describe("estimateSalePrice", () => {
  describe("same-building", () => {
    it("같은 건물 거래가 있으면 매매가 중앙값을 high 신뢰도로 쓴다 (홀수 개)", () => {
      const trades = [
        trade({ price: 300_000_000 }),
        trade({ price: 100_000_000 }),
        trade({ price: 200_000_000 }),
      ];
      const result = estimateSalePrice({ target, saleTrades: trades, asOf });

      expect(result.method).toBe("same-building");
      expect(result.confidence).toBe("high");
      expect(result.price).toBe(200_000_000);
      expect(result.comparables).toHaveLength(3);
    });

    it("짝수 개면 가운데 두 값의 평균을 원 단위로 반올림한다", () => {
      const trades = [trade({ price: 100_000_001 }), trade({ price: 100_000_000 })];
      const result = estimateSalePrice({ target, saleTrades: trades, asOf });

      expect(result.price).toBe(100_000_001); // 100_000_000.5 → 반올림
      expect(Number.isInteger(result.price)).toBe(true);
    });

    it("전용면적 차이가 정확히 허용 오차면 포함하고, 초과하면 제외한다", () => {
      const tol = PRICE_ESTIMATE.areaToleranceSqm;
      const included = [
        trade({ exclusiveArea: target.exclusiveArea + tol, price: 100_000_000 }),
        trade({ exclusiveArea: target.exclusiveArea - tol, price: 200_000_000 }),
      ];
      const excluded = [
        trade({ exclusiveArea: target.exclusiveArea + tol + 0.01, price: 900_000_000 }),
        trade({ exclusiveArea: target.exclusiveArea - tol - 0.01, price: 900_000_000 }),
      ];
      const result = estimateSalePrice({ target, saleTrades: [...included, ...excluded], asOf });

      expect(result.method).toBe("same-building");
      expect(result.comparables).toEqual(included);
      expect(result.price).toBe(150_000_000);
    });

    it("다른 주택 유형 거래는 쓰지 않는다", () => {
      const result = estimateSalePrice({
        target,
        saleTrades: [trade({ houseType: "apartment" })],
        asOf,
      });
      expect(result.method).toBe("none");
    });

    it("해제 거래만 있으면 다음 단계로 폴백한다", () => {
      const trades = [
        trade({ cancelled: true, price: 900_000_000 }),
        dongTrade({ price: 180_000_000 }),
        dongTrade({ price: 240_000_000 }),
        dongTrade({ price: 300_000_000 }),
      ];
      const result = estimateSalePrice({ target, saleTrades: trades, asOf });

      expect(result.method).toBe("dong-unit-price");
      expect(result.comparables.every((t) => !t.cancelled)).toBe(true);
    });
  });

  describe("조회 기간", () => {
    it("[asOf - 조회 기간, asOf] 경계는 포함하고 밖은 제외한다", () => {
      const result0 = estimateSalePrice({ target, saleTrades: [], asOf });
      const { periodFrom, periodTo } = result0;

      expect(periodTo.getTime()).toBe(asOf.getTime());
      const expectedFrom = new Date(asOf);
      expectedFrom.setUTCMonth(expectedFrom.getUTCMonth() - PRICE_ESTIMATE.lookbackMonths);
      expect(periodFrom.getTime()).toBe(expectedFrom.getTime());

      const onFrom = trade({ contractDate: new Date(periodFrom), price: 100_000_000 });
      const onTo = trade({ contractDate: new Date(periodTo), price: 200_000_000 });
      const beforeFrom = trade({
        contractDate: new Date(periodFrom.getTime() - 1),
        price: 900_000_000,
      });
      const afterTo = trade({ contractDate: new Date(periodTo.getTime() + 1), price: 900_000_000 });

      const result = estimateSalePrice({
        target,
        saleTrades: [onFrom, onTo, beforeFrom, afterTo],
        asOf,
      });
      expect(result.comparables).toEqual([onFrom, onTo]);
      expect(result.price).toBe(150_000_000);
    });

    it("기간 밖 거래만 있으면 폴백한다", () => {
      const result = estimateSalePrice({
        target,
        saleTrades: [trade({ contractDate: new Date("2024-01-01T00:00:00Z") })],
        asOf,
      });
      expect(result.method).toBe("none");
    });
  });

  describe("dong-unit-price", () => {
    it("같은 동 거래의 ㎡당 단가 중앙값 × 대상 면적을 medium 신뢰도로 쓴다 (면적 오차 미적용)", () => {
      const trades = [
        dongTrade({ exclusiveArea: 30, price: 150_000_000 }), // 5,000,000/㎡
        dongTrade({ exclusiveArea: 100, price: 400_000_000 }), // 4,000,000/㎡
        dongTrade({ exclusiveArea: 50, price: 300_000_000 }), // 6,000,000/㎡
      ];
      const result = estimateSalePrice({ target, saleTrades: trades, asOf });

      expect(result.method).toBe("dong-unit-price");
      expect(result.confidence).toBe("medium");
      expect(result.price).toBe(5_000_000 * target.exclusiveArea);
      expect(result.comparables).toHaveLength(3);
    });

    it("짝수 개 단가는 가운데 두 값의 평균을 쓰고 결과를 정수로 반올림한다", () => {
      const trades = [
        dongTrade({ exclusiveArea: 30, price: 100_000_000 }), // 3,333,333.33/㎡
        dongTrade({ exclusiveArea: 30, price: 110_000_000 }), // 3,666,666.67/㎡
        dongTrade({ exclusiveArea: 30, price: 90_000_000 }), // 3,000,000/㎡
        dongTrade({ exclusiveArea: 30, price: 120_000_000 }), // 4,000,000/㎡
      ];
      const result = estimateSalePrice({
        target: { ...target, exclusiveArea: 61 },
        saleTrades: trades,
        asOf,
      });

      expect(result.price).toBe(Math.round(3_500_000 * 61));
    });

    it("다른 법정동·다른 lawdCd·해제·기간 밖 거래는 세지 않는다", () => {
      const trades = [
        dongTrade(),
        dongTrade(),
        dongTrade({ umdName: "효자동" }),
        dongTrade({ lawdCd: "11140" }),
        dongTrade({ cancelled: true }),
        dongTrade({ contractDate: new Date("2020-01-01T00:00:00Z") }),
        dongTrade({ houseType: "apartment" }),
      ];
      const result = estimateSalePrice({ target, saleTrades: trades, asOf });
      expect(result.method).toBe("none");
    });

    it("거래 수가 최소 거래 수 미만이면 공시가격 단계로 폴백한다", () => {
      const trades = Array.from({ length: PRICE_ESTIMATE.minTradesForUnitPrice - 1 }, () =>
        dongTrade(),
      );
      const result = estimateSalePrice({
        target,
        saleTrades: trades,
        officialPrice: 200_000_000,
        asOf,
      });
      expect(result.method).toBe("official-price");
    });
  });

  describe("official-price", () => {
    it("비교 거래가 없으면 공시가격 × 배율을 low 신뢰도로 쓰고 comparables는 비운다", () => {
      const result = estimateSalePrice({
        target,
        saleTrades: [],
        officialPrice: 200_000_001,
        asOf,
      });

      expect(result.method).toBe("official-price");
      expect(result.confidence).toBe("low");
      expect(result.price).toBe(Math.round(200_000_001 * PRICE_ESTIMATE.publicPriceMultiplier));
      expect(Number.isInteger(result.price)).toBe(true);
      expect(result.comparables).toEqual([]);
    });
  });

  describe("none", () => {
    it("아무 데이터도 없으면 price null, confidence none", () => {
      const result = estimateSalePrice({ target, saleTrades: [], asOf });

      expect(result.method).toBe("none");
      expect(result.confidence).toBe("none");
      expect(result.price).toBeNull();
      expect(result.comparables).toEqual([]);
    });
  });

  it("입력 배열과 기준일을 변경하지 않는다", () => {
    const trades = [trade({ price: 300_000_000 }), trade({ price: 100_000_000 })];
    const snapshot = structuredClone(trades);
    const asOfTime = asOf.getTime();

    estimateSalePrice({ target, saleTrades: trades, asOf });

    expect(trades).toEqual(snapshot);
    expect(asOf.getTime()).toBe(asOfTime);
  });
});
