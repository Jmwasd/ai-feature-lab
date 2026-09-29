// 판정 도메인 타입. server 어댑터 출력은 구조적으로 이 타입에 맞추고, 둘을 잇는 조합은 routes가 한다.

export type HouseType = "apartment" | "row-house"; // 아파트, 연립다세대

export interface ComparableTrade {
  buildingKey: string;
  lawdCd: string;
  umdName: string; // 법정동명
  houseType: HouseType;
  exclusiveArea: number; // ㎡
  floor: number | null;
  contractDate: Date;
  price: number; // 매매가, 원 단위 정수
  cancelled: boolean;
  buildingName?: string | null; // 단지·건물명. 결과 화면 근거 표시용
}

export interface BuildingInfo {
  mainPurpose: string | null; // 건축물대장 주용도명
  isViolation: boolean | null; // 위반건축물 여부
  useApprovalDate: Date | null; // 사용승인일
}

// 사용자가 등기부를 보고 입력한다
export interface RightsInput {
  maxClaimAmount: number; // 근저당 채권최고액 합계, 원
  seniorDeposits: number; // 선순위 임차보증금 합계, 원
  isTrust: boolean; // 신탁 등기 여부
  lastOwnershipChangeDate: Date | null;
}

// 공공데이터 부분 실패. server 조회 결과의 warnings와 구조가 같다.
export type JudgmentWarning =
  | { kind: "trades-partial"; failedMonths: string[] } // YYYYMM
  | { kind: "trades-quota" }
  | { kind: "official-price-unavailable"; reason: "no-ho" | "not-found" | "error" }
  | { kind: "building-unavailable" };
