// "사례" 섹션 예시 입력. 가상의 조건이며 실제 매물이 아니다. 정책 수치가 아니라서 policy.ts에 두지 않는다.
// 신호 제목·설명·개수는 여기 적지 않는다. CasesSection이 이 입력을 판정 로직에 넣어 만든다.
// 금액은 원 단위 정수다.

import type { BuildingInfo, ComparableTrade, HouseType, RightsInput } from "@/features/judgment/types";

// 판정 기준일과 데이터 기준일을 고정한다. 현재 시각을 쓰면 빌드·테스트 시점마다 신축·소유자 변동 신호가 달라진다.
export const CASE_AS_OF = utc(2026, 9, 1);
export const CASE_DATA_BASE_DATE = utc(2026, 8, 31);

export interface LandingCase {
  id: string;
  label: string;
  description: string;
  target: { buildingKey: string; lawdCd: string; umdName: string; houseType: HouseType; exclusiveArea: number };
  saleTrades: ComparableTrade[]; // 비교 매매 실거래
  officialPrice: number; // 공시가격
  isCapitalArea: boolean;
  deposit: number;
  building: BuildingInfo;
  rights: RightsInput;
}

const NO_RIGHTS: RightsInput = { maxClaimAmount: 0, seniorDeposits: 0, isTrust: false, lastOwnershipChangeDate: null };

export const LANDING_CASES: readonly LandingCase[] = [
  {
    id: "empty-jeonse",
    label: "깡통전세",
    description: "보증금이 추정 시세에 거의 닿은 신축 빌라예요.",
    target: { buildingKey: "case-a", lawdCd: "11500", umdName: "화곡동", houseType: "row-house", exclusiveArea: 59 },
    saleTrades: [
      trade("case-a", "11500", "화곡동", "row-house", 59, 245_000_000, utc(2026, 3, 12)),
      trade("case-a", "11500", "화곡동", "row-house", 58.5, 250_000_000, utc(2026, 5, 3)),
      trade("case-a", "11500", "화곡동", "row-house", 59.8, 255_000_000, utc(2026, 6, 21)),
    ],
    officialPrice: 170_000_000,
    isCapitalArea: true,
    deposit: 240_000_000,
    building: { mainPurpose: "공동주택(다세대주택)", isViolation: false, useApprovalDate: utc(2025, 5, 20) },
    rights: { ...NO_RIGHTS, lastOwnershipChangeDate: utc(2025, 6, 10) },
  },
  {
    id: "heavy-mortgage",
    label: "근저당 과다",
    description: "보증금은 시세의 절반이지만 근저당이 크게 잡힌 아파트예요.",
    target: { buildingKey: "case-b", lawdCd: "41135", umdName: "정자동", houseType: "apartment", exclusiveArea: 84 },
    saleTrades: [
      trade("case-b", "41135", "정자동", "apartment", 84.9, 490_000_000, utc(2026, 2, 8)),
      trade("case-b", "41135", "정자동", "apartment", 84, 500_000_000, utc(2026, 4, 17)),
      trade("case-b", "41135", "정자동", "apartment", 83.5, 510_000_000, utc(2026, 7, 2)),
    ],
    officialPrice: 350_000_000,
    isCapitalArea: true,
    deposit: 250_000_000,
    building: { mainPurpose: "공동주택(아파트)", isViolation: false, useApprovalDate: utc(2008, 11, 25) },
    rights: { ...NO_RIGHTS, maxClaimAmount: 200_000_000, lastOwnershipChangeDate: utc(2019, 4, 2) },
  },
  {
    id: "trust",
    label: "신탁 등기",
    description: "등기부에 신탁 등기가 있고 최근 소유자가 바뀐 빌라예요.",
    target: { buildingKey: "case-c", lawdCd: "11620", umdName: "신림동", houseType: "row-house", exclusiveArea: 60 },
    saleTrades: [
      trade("case-c-1", "11620", "신림동", "row-house", 50, 250_000_000, utc(2026, 1, 15)),
      trade("case-c-2", "11620", "신림동", "row-house", 60, 300_000_000, utc(2026, 4, 9)),
      trade("case-c-3", "11620", "신림동", "row-house", 45, 230_000_000, utc(2026, 6, 28)),
    ],
    officialPrice: 200_000_000,
    isCapitalArea: true,
    deposit: 180_000_000,
    building: { mainPurpose: "공동주택(다세대주택)", isViolation: false, useApprovalDate: utc(2016, 8, 30) },
    rights: { ...NO_RIGHTS, isTrust: true, lastOwnershipChangeDate: utc(2026, 7, 10) },
  },
  {
    id: "neighborhood-facility",
    label: "근린생활시설",
    description: "주택처럼 쓰지만 건축물대장 용도가 근린생활시설인 호실이에요.",
    target: { buildingKey: "case-d", lawdCd: "11290", umdName: "장위동", houseType: "row-house", exclusiveArea: 42 },
    saleTrades: [],
    officialPrice: 150_000_000,
    isCapitalArea: true,
    deposit: 160_000_000,
    building: { mainPurpose: "제2종근린생활시설", isViolation: false, useApprovalDate: utc(2019, 3, 14) },
    rights: { ...NO_RIGHTS, lastOwnershipChangeDate: utc(2021, 10, 5) },
  },
  {
    id: "low-ratio-villa",
    label: "비율이 낮은 빌라",
    description: "보증금이 추정 시세의 절반 정도이고 근저당이 없는 빌라예요.",
    target: { buildingKey: "case-e", lawdCd: "11440", umdName: "망원동", houseType: "row-house", exclusiveArea: 55 },
    saleTrades: [
      trade("case-e-1", "11440", "망원동", "row-house", 50, 275_000_000, utc(2025, 12, 4)),
      trade("case-e-2", "11440", "망원동", "row-house", 60, 330_000_000, utc(2026, 3, 22)),
      trade("case-e-3", "11440", "망원동", "row-house", 48, 270_000_000, utc(2026, 6, 11)),
    ],
    officialPrice: 210_000_000,
    isCapitalArea: true,
    deposit: 150_000_000,
    building: { mainPurpose: "공동주택(다세대주택)", isViolation: false, useApprovalDate: utc(2014, 6, 18) },
    rights: { ...NO_RIGHTS, lastOwnershipChangeDate: utc(2019, 9, 27) },
  },
];

function trade(
  buildingKey: string,
  lawdCd: string,
  umdName: string,
  houseType: HouseType,
  exclusiveArea: number,
  price: number,
  contractDate: Date,
): ComparableTrade {
  return { buildingKey, lawdCd, umdName, houseType, exclusiveArea, floor: null, contractDate, price, cancelled: false };
}

// month는 1부터 센다.
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
