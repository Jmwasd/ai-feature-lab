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
}
