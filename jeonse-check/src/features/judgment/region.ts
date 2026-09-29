// 법정동코드(10자리)로 최우선변제 지역 구간과 수도권 여부를 판별한다.
// 클라이언트·서버 양쪽에서 쓰는 순수 로직이다. 지역 목록은 모두 @/consts/policy에서 가져온다.
// 판별할 수 없으면 null을 돌려준다. 추측한 구간으로 최우선변제 금액을 계산하면 결과가 틀린다.

import {
  CAPITAL_AREA_SIDO_CODES,
  PRIORITY_REPAYMENT_REGION_CODES,
  SIDO_CODES,
  type PriorityRepaymentRegion,
} from "@/consts/policy";

type RegionMatch = PriorityRepaymentRegion | "AMBIGUOUS";

// 가장 구체적인 코드부터 맞춘다: 리(10) → 읍면동(8) → 시군구(5) → 시도(2)
const PREFIX_LENGTHS = [10, 8, 5, 2] as const;

const REGION_BY_CODE: ReadonlyMap<string, RegionMatch> = new Map(
  (Object.entries(PRIORITY_REPAYMENT_REGION_CODES) as [RegionMatch, readonly string[]][]).flatMap(
    ([region, codes]) => codes.map((code) => [code, region] as const),
  ),
);

const SIDO: ReadonlySet<string> = new Set(SIDO_CODES);
const CAPITAL_AREA_SIDO: ReadonlySet<string> = new Set(CAPITAL_AREA_SIDO_CODES);

/** 최우선변제 지역 구간. 모호 지역, 목록에 없는 지역, 형식이 잘못된 코드는 null. */
export function priorityRegionTier(admCd: string): PriorityRepaymentRegion | null {
  if (!isAdmCd(admCd)) return null;
  for (const length of PREFIX_LENGTHS) {
    const region = REGION_BY_CODE.get(admCd.slice(0, length));
    if (region === undefined) continue;
    return region === "AMBIGUOUS" ? null : region;
  }
  return null;
}

/** 수도권(서울·인천·경기) 여부. 형식이 잘못됐거나 현행 시도코드가 아니면 null. */
export function isCapitalArea(admCd: string): boolean | null {
  if (!isAdmCd(admCd)) return null;
  const sido = admCd.slice(0, 2);
  if (!SIDO.has(sido)) return null;
  return CAPITAL_AREA_SIDO.has(sido);
}

function isAdmCd(value: string): boolean {
  return /^\d{10}$/.test(value);
}
