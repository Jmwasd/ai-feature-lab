// 전세가율의 분모인 매매 시세를 비교 거래로 추정한다.
// 클라이언트·서버 양쪽에서 쓰는 순수 로직이므로 server, Prisma, 현재 시각에 의존하지 않는다.

import { PRICE_ESTIMATE } from "@/consts/policy";
import type { ComparableTrade, HouseType } from "./types";

export type EstimateMethod = "same-building" | "dong-unit-price" | "official-price" | "none";
export type Confidence = "high" | "medium" | "low" | "none";

export interface PriceEstimate {
  price: number | null; // 원 단위 정수
  method: EstimateMethod;
  confidence: Confidence;
  comparables: ComparableTrade[]; // 추정에 실제로 쓴 거래 (근거 표시용)
  periodFrom: Date; // 비교 거래 조회 구간
  periodTo: Date;
}

export function estimateSalePrice(input: {
  target: {
    buildingKey: string;
    lawdCd: string;
    umdName: string;
    houseType: HouseType;
    exclusiveArea: number;
  };
  saleTrades: ComparableTrade[];
  officialPrice?: number; // 공시가격, 원
  asOf: Date; // 기준일. 호출자가 넘긴다
}): PriceEstimate {
  const { target, saleTrades, officialPrice, asOf } = input;
  const periodTo = new Date(asOf.getTime());
  const periodFrom = subtractMonthsUtc(asOf, PRICE_ESTIMATE.lookbackMonths);
  const period = { periodFrom, periodTo };

  const eligible = saleTrades.filter(
    (t) =>
      !t.cancelled &&
      t.houseType === target.houseType &&
      t.contractDate.getTime() >= periodFrom.getTime() &&
      t.contractDate.getTime() <= periodTo.getTime(),
  );

  const sameBuilding = eligible.filter(
    (t) =>
      t.buildingKey === target.buildingKey &&
      Math.abs(t.exclusiveArea - target.exclusiveArea) <= PRICE_ESTIMATE.areaToleranceSqm,
  );
  if (sameBuilding.length > 0) {
    return {
      price: Math.round(median(sameBuilding.map((t) => t.price))),
      method: "same-building",
      confidence: "high",
      comparables: sameBuilding,
      ...period,
    };
  }

  const sameDong = eligible.filter(
    (t) => t.lawdCd === target.lawdCd && t.umdName === target.umdName && t.exclusiveArea > 0,
  );
  if (sameDong.length >= PRICE_ESTIMATE.minTradesForUnitPrice) {
    const unitPrice = median(sameDong.map((t) => t.price / t.exclusiveArea));
    return {
      price: Math.round(unitPrice * target.exclusiveArea),
      method: "dong-unit-price",
      confidence: "medium",
      comparables: sameDong,
      ...period,
    };
  }

  if (officialPrice !== undefined && officialPrice > 0) {
    return {
      price: Math.round(officialPrice * PRICE_ESTIMATE.publicPriceMultiplier),
      method: "official-price",
      confidence: "low",
      comparables: [],
      ...period,
    };
  }

  return { price: null, method: "none", confidence: "none", comparables: [], ...period };
}

// 짝수 개면 가운데 두 값의 평균. 호출자가 비어 있지 않은 배열을 넘긴다.
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 월말에서 빼면 대상 월의 말일로 맞춘다(예: 2월 29일 - 12개월 → 2월 28일).
function subtractMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
