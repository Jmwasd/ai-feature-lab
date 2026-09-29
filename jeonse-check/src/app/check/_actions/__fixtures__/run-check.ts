import type { PublicInputs } from "@/server/lookup/collect-inputs";
import type { NormalizedAddress } from "@/server/public-data/juso";

// run-check·save-result 액션 테스트가 함께 쓰는 세션·주소·공공데이터 fixture.

export const SESSION = { user: { id: "u1" }, expires: "2099-01-01T00:00:00.000Z" };

export const ADDRESS: NormalizedAddress = {
  id: "1144012400100120004000001",
  roadAddress: "서울특별시 마포구 망원로 12",
  jibunAddress: "서울특별시 마포구 망원동 123-4 망원빌라",
  buildingName: "망원빌라",
  admCd: "1144012400",
  lawdCd: "11440",
  sidoName: "서울특별시",
  sigunguName: "마포구",
  umdName: "망원동",
  isMountain: false,
  mainNo: 123,
  subNo: 4,
  jibun: "123-4",
  pnu: "1144012400101230004",
};

// 같은 도로명주소로 검색되는 다른 건물
export const OTHER_ADDRESS: NormalizedAddress = { ...ADDRESS, id: "9999999999999999999999999" };

export const PUBLIC_INPUTS: PublicInputs = {
  target: {
    buildingKey: "11440-망원동-123-4",
    lawdCd: "11440",
    umdName: "망원동",
    houseType: "row-house",
    exclusiveArea: 59.8,
  },
  saleTrades: [
    {
      buildingKey: "11440-망원동-123-4",
      lawdCd: "11440",
      umdName: "망원동",
      houseType: "row-house",
      exclusiveArea: 59.8,
      floor: 3,
      contractDate: new Date("2026-05-10T00:00:00Z"),
      price: 300_000_000,
      cancelled: false,
      buildingName: "망원빌라",
    },
  ],
  officialPrice: 250_000_000,
  officialPriceBaseYear: 2026,
  building: {
    mainPurpose: "공동주택(다세대주택)",
    isViolation: false,
    useApprovalDate: new Date("2012-04-10T00:00:00Z"),
  },
  dataBaseDate: new Date("2026-09-01T00:00:00Z"),
  warnings: [{ kind: "building-unavailable" }],
};

export function checkPayload(overrides: { lookup?: Record<string, unknown>; rights?: Record<string, unknown> } = {}) {
  return {
    lookup: {
      address: {
        id: ADDRESS.id,
        roadAddress: ADDRESS.roadAddress,
        jibunAddress: ADDRESS.jibunAddress,
        buildingName: ADDRESS.buildingName,
        admCd: ADDRESS.admCd,
      },
      houseType: "row-house",
      deposit: 150_000_000,
      exclusiveArea: 59.8,
      dong: "1동",
      ho: "201호",
      ...overrides.lookup,
    },
    rights: {
      maxClaimAmount: 0,
      seniorDeposits: 0,
      isTrust: false,
      lastOwnershipChangeDate: new Date("2019-03-15T00:00:00Z"),
      ...overrides.rights,
    },
  };
}
