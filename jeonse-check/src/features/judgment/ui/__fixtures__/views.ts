// 결과 화면 테스트용 JudgmentView. 입력만 적고 시세·비율·신호는 판정 함수로 만든다.
// 금액은 원 단위 정수다.

import { PRIORITY_REPAYMENT_REGION, type PriorityRepaymentRegion } from "@/consts/policy";
import { estimateSalePrice } from "../../price-estimate";
import { checkHugEligibility, checkPriorityRepayment, debtRatio, jeonseRatio } from "../../ratios";
import { buildRiskReport } from "../../risk-report";
import type { BuildingInfo, ComparableTrade, RightsInput } from "../../types";
import type { JudgmentView } from "../types";

// 판정 기준일과 데이터 기준일을 고정한다. 현재 시각을 쓰면 신축·소유자 변동 신호가 실행 시점마다 달라진다.
export const FIXTURE_AS_OF = utc(2026, 9, 29);
export const FIXTURE_DATA_BASE_DATE = utc(2026, 9, 1);

const TARGET = {
  buildingKey: "fixture-building",
  lawdCd: "11440",
  umdName: "망원동",
  houseType: "row-house",
  exclusiveArea: 59,
} as const;

const NORMAL_BUILDING: BuildingInfo = {
  mainPurpose: "공동주택(다세대주택)",
  isViolation: false,
  useApprovalDate: utc(2012, 4, 10),
};

const NO_RIGHTS: RightsInput = {
  maxClaimAmount: 0,
  seniorDeposits: 0,
  isTrust: false,
  lastOwnershipChangeDate: utc(2019, 3, 15),
};

const SAME_BUILDING_TRADES: ComparableTrade[] = [
  trade(295_000_000, utc(2026, 2, 14), 59, 3, "망원빌라"),
  trade(300_000_000, utc(2026, 5, 2), 58.4, 2, "망원빌라"),
  trade(305_000_000, utc(2026, 7, 20), 59.8, null, null),
];

function makeView(input: {
  deposit: number;
  saleTrades: ComparableTrade[];
  officialPrice?: number;
  isCapitalArea: boolean | null;
  regionTier: PriorityRepaymentRegion | null;
  building: BuildingInfo;
  rights: RightsInput;
}): JudgmentView {
  const { deposit, rights } = input;
  const priceEstimate = estimateSalePrice({
    target: TARGET,
    saleTrades: input.saleTrades,
    officialPrice: input.officialPrice,
    asOf: FIXTURE_AS_OF,
  });
  const jr = jeonseRatio(deposit, priceEstimate.price);
  const dr = debtRatio({
    deposit,
    maxClaimAmount: rights.maxClaimAmount,
    seniorDeposits: rights.seniorDeposits,
    estimatedPrice: priceEstimate.price,
  });
  const hug = checkHugEligibility({
    deposit,
    seniorDebt: rights.maxClaimAmount + rights.seniorDeposits,
    officialPrice: input.officialPrice ?? null,
    isCapitalArea: input.isCapitalArea,
  });
  const report = buildRiskReport({
    deposit,
    priceEstimate,
    jeonseRatio: jr,
    debtRatio: dr,
    hug,
    building: input.building,
    rights,
    asOf: FIXTURE_AS_OF,
    dataBaseDate: FIXTURE_DATA_BASE_DATE,
  });

  return {
    address: { display: "서울특별시 마포구 망원동 123-4", dong: "1동", ho: "201호" },
    deposit,
    exclusiveArea: TARGET.exclusiveArea,
    report,
    priceEstimate,
    jeonseRatio: jr,
    debtRatio: dr,
    hug,
    priorityRepayment: checkPriorityRepayment({ deposit, regionTier: input.regionTier }),
    rights,
  };
}

// 같은 건물 실거래로 시세를 추정했고, 비율이 낮고 권리 입력도 깨끗해 신호가 0개다.
export const noSignalsView = makeView({
  deposit: 150_000_000,
  saleTrades: SAME_BUILDING_TRADES,
  officialPrice: 250_000_000,
  isCapitalArea: true,
  regionTier: PRIORITY_REPAYMENT_REGION.SEOUL,
  building: NORMAL_BUILDING,
  rights: NO_RIGHTS,
});

// 동시에 켤 수 있는 신호를 모두 켠다. 수준이 갈리는 신호는 위험 쪽, 시세 신호는 신뢰도 낮음(공시가격 추정) 쪽이다.
export const allSignalsView = makeView({
  deposit: 260_000_000,
  saleTrades: [],
  officialPrice: 200_000_000,
  isCapitalArea: true,
  regionTier: PRIORITY_REPAYMENT_REGION.SEOUL,
  building: { mainPurpose: "제2종근린생활시설", isViolation: true, useApprovalDate: utc(2026, 1, 15) },
  rights: {
    maxClaimAmount: 120_000_000,
    seniorDeposits: 30_000_000,
    isTrust: true,
    lastOwnershipChangeDate: utc(2026, 9, 1),
  },
});

// 비교 거래도 공시가격도 없어 시세를 추정하지 못했다. 비율은 null, HUG와 최우선변제는 판단 불가다.
export const priceNoneView = makeView({
  deposit: 150_000_000,
  saleTrades: [],
  isCapitalArea: true,
  regionTier: null,
  building: NORMAL_BUILDING,
  rights: NO_RIGHTS,
});

// 시세는 추정했지만 수도권 여부를 몰라 HUG 가입 기준을 판단하지 못했다.
export const hugUnknownView = makeView({
  deposit: 180_000_000,
  saleTrades: SAME_BUILDING_TRADES,
  officialPrice: 250_000_000,
  isCapitalArea: null,
  regionTier: PRIORITY_REPAYMENT_REGION.OTHER,
  building: NORMAL_BUILDING,
  rights: { ...NO_RIGHTS, maxClaimAmount: 30_000_000 },
});

export const ALL_VIEWS = {
  "신호 0개": noSignalsView,
  "모든 신호 발생": allSignalsView,
  "시세 none": priceNoneView,
  "HUG unknown": hugUnknownView,
} as const;

function trade(
  price: number,
  contractDate: Date,
  exclusiveArea: number,
  floor: number | null,
  buildingName: string | null,
): ComparableTrade {
  return {
    buildingKey: TARGET.buildingKey,
    lawdCd: TARGET.lawdCd,
    umdName: TARGET.umdName,
    houseType: TARGET.houseType,
    exclusiveArea,
    floor,
    contractDate,
    price,
    cancelled: false,
    buildingName,
  };
}

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
