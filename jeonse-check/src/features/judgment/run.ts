// 공공데이터와 사용자 입력을 받아 결과 화면의 판정 결과 전체를 만든다.
// 개별 판정 함수를 순서대로 호출하는 조립점이다. 판정 규칙은 각 함수에만 두고 여기서 다시 계산하지 않는다.
// 클라이언트·서버 양쪽에서 쓰는 순수 로직이다. 날짜는 asOf와 dataBaseDate로만 계산한다.

import { lookupWarningNote } from "./copy";
import { estimateSalePrice } from "./price-estimate";
import { checkHugEligibility, checkPriorityRepayment, debtRatio, jeonseRatio } from "./ratios";
import { isCapitalArea, priorityRegionTier } from "./region";
import { buildRiskReport } from "./risk-report";
import type { BuildingInfo, ComparableTrade, JudgmentWarning, RightsInput } from "./types";
import type { JudgmentView } from "./ui/types";

export interface JudgmentInput {
  address: { display: string; admCd: string; dong?: string; ho?: string };
  deposit: number; // 원
  exclusiveArea: number; // ㎡
  rights: RightsInput;
  // server 조회 결과(PublicInputs)와 구조가 같다
  publicData: {
    target: Parameters<typeof estimateSalePrice>[0]["target"];
    saleTrades: ComparableTrade[];
    officialPrice: number | null; // 원
    building: BuildingInfo;
    dataBaseDate: Date;
    warnings: JudgmentWarning[];
  };
  asOf: Date;
}

export function runJudgment(input: JudgmentInput): JudgmentView & { warnings: JudgmentWarning[] } {
  const { address, deposit, exclusiveArea, rights, publicData, asOf } = input;

  const priceEstimate = estimateSalePrice({
    target: publicData.target,
    saleTrades: publicData.saleTrades,
    officialPrice: publicData.officialPrice ?? undefined,
    asOf,
  });

  const jeonse = jeonseRatio(deposit, priceEstimate.price);
  const debt = debtRatio({
    deposit,
    maxClaimAmount: rights.maxClaimAmount,
    seniorDeposits: rights.seniorDeposits,
    estimatedPrice: priceEstimate.price,
  });

  const regionTier = priorityRegionTier(address.admCd);
  const capitalArea = isCapitalArea(address.admCd);

  // 부채비율과 같은 rights 값으로 만든다
  const hug = checkHugEligibility({
    deposit,
    seniorDebt: rights.maxClaimAmount + rights.seniorDeposits,
    officialPrice: publicData.officialPrice,
    isCapitalArea: capitalArea,
  });
  const priorityRepayment = checkPriorityRepayment({ deposit, regionTier });

  const report = buildRiskReport({
    deposit,
    priceEstimate,
    jeonseRatio: jeonse,
    debtRatio: debt,
    hug,
    building: publicData.building,
    rights,
    asOf,
    dataBaseDate: publicData.dataBaseDate,
  });

  return {
    address: { display: address.display, dong: address.dong, ho: address.ho },
    deposit,
    exclusiveArea,
    report: { ...report, notes: [...report.notes, ...publicData.warnings.map(lookupWarningNote)] },
    priceEstimate,
    jeonseRatio: jeonse,
    debtRatio: debt,
    hug,
    priorityRepayment,
    rights,
    warnings: publicData.warnings,
  };
}
