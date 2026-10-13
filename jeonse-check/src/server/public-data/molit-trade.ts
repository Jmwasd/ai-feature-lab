import "server-only";

import { requireEnv } from "../env";
import { fetchAllItems, readField, utcDate } from "./data-go-kr";
import { type HttpOptions, PublicDataError } from "./http";
import { buildingKeyOf, dedupKeyOf, normalizeJibun } from "./trade-keys";

// 국토교통부 실거래가 API(apis.data.go.kr/1613000) 어댑터. 아파트·연립다세대 × 매매·전월세 4개 오퍼레이션.
// 원본 응답 필드명(excluUseAr 등)은 이 파일 밖으로 내보내지 않고 RawTrade로 바꾼다.
const BASE_URL = "https://apis.data.go.kr/1613000";

// 한 페이지 크기. 명세상 numOfRows 최대값.
const PAGE_SIZE = 1000;

// 해제 거래의 cdealType 값.
const CANCELLED_MARK = "O";

export type TradeHouseType = "APARTMENT" | "ROW_HOUSE"; // Prisma enum과 같은 값
export type TradeDealKind = "SALE" | "LEASE";

// Prisma Trade 생성 입력과 구조가 같다(id, 타임스탬프 제외). 금액은 만원 단위다.
export interface RawTrade {
  houseType: TradeHouseType;
  dealKind: TradeDealKind;
  lawdCd: string;
  dealYmd: string;
  umdName: string;
  jibun: string | null;
  buildingName: string | null;
  exclusiveArea: number;
  floor: number | null;
  contractDate: Date;
  priceManwon: number | null;
  depositManwon: number | null;
  monthlyRentManwon: number | null;
  cancelled: boolean;
  cancelledDate: Date | null;
  buildingKey: string;
  dedupKey: string;
}

export interface FetchTradesParams {
  houseType: TradeHouseType;
  dealKind: TradeDealKind;
  lawdCd: string; // 법정동코드 앞 5자리
  dealYmd: string; // 계약월 YYYYMM
}

const OPERATIONS: Record<TradeHouseType, Record<TradeDealKind, string>> = {
  APARTMENT: { SALE: "AptTrade", LEASE: "AptRent" },
  ROW_HOUSE: { SALE: "RHTrade", LEASE: "RHRent" },
};

// 건물명 필드. 아파트는 단지명, 연립다세대는 연립다세대명이다.
const NAME_FIELD: Record<TradeHouseType, string> = {
  APARTMENT: "aptNm",
  ROW_HOUSE: "mhouseNm",
};

/**
 * 지역(LAWD_CD)·계약월(DEAL_YMD) 한 단위의 거래를 모든 페이지에 걸쳐 받는다.
 * 해제 거래도 버리지 않고 cancelled로 표시만 한다. 이미 저장된 거래의 해제를 upsert로 반영하기 위해서다(ADR-004).
 */
export async function fetchTrades(
  params: FetchTradesParams,
  options: HttpOptions = {},
): Promise<RawTrade[]> {
  const { houseType, dealKind, lawdCd, dealYmd } = params;
  if (!/^\d{5}$/.test(lawdCd)) {
    throw new RangeError(`lawdCd는 숫자 5자리여야 한다: ${lawdCd}`);
  }
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(dealYmd)) {
    throw new RangeError(`dealYmd는 YYYYMM이어야 한다: ${dealYmd}`);
  }

  const operation = OPERATIONS[houseType][dealKind];
  const serviceKey = requireEnv("DATA_GO_KR_SERVICE_KEY");
  const pageUrl = (pageNo: number): URL => {
    const url = new URL(`${BASE_URL}/RTMSDataSvc${operation}/getRTMSDataSvc${operation}`);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("LAWD_CD", lawdCd);
    url.searchParams.set("DEAL_YMD", dealYmd);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    return url;
  };

  const items = await fetchAllItems(pageUrl, PAGE_SIZE, "molit-trade", options);
  return items.map(({ item, url }) => toRawTrade(item, params, url));
}

function toRawTrade(item: Record<string, unknown>, params: FetchTradesParams, url: URL): RawTrade {
  const { houseType, dealKind, lawdCd, dealYmd } = params;
  const read = (field: string): string => readField(item, field);
  const fail = (detail: string): never => {
    throw new PublicDataError("parse", "molit-trade", detail, { url });
  };

  const umdName = read("umdNm").replace(/\s+/g, " ");
  if (umdName === "") fail("거래 항목에 umdNm이 없다");

  const areaText = read("excluUseAr");
  const exclusiveArea = Number(areaText);
  if (!/^\d+(\.\d+)?$/.test(areaText) || exclusiveArea <= 0) fail(`excluUseAr 형식 오류: ${areaText}`);

  const floorText = read("floor");
  if (floorText !== "" && !/^-?\d+$/.test(floorText)) fail(`floor 형식 오류: ${floorText}`);

  const contractDate =
    utcDate(Number(read("dealYear")), Number(read("dealMonth")), Number(read("dealDay"))) ??
    fail(`계약일 형식 오류: ${read("dealYear")}-${read("dealMonth")}-${read("dealDay")}`);

  const manwon = (field: string): number => {
    const text = read(field);
    const digits = text.replace(/,/g, "");
    return /^\d+$/.test(digits) ? Number(digits) : fail(`${field} 금액 형식 오류: ${text}`);
  };

  const cancelled = read("cdealType") === CANCELLED_MARK;
  const name = read(NAME_FIELD[houseType]);
  const fields: Omit<RawTrade, "buildingKey" | "dedupKey"> = {
    houseType,
    dealKind,
    lawdCd,
    dealYmd,
    umdName,
    jibun: normalizeJibun(read("jibun")),
    buildingName: name === "" ? null : name,
    exclusiveArea,
    floor: floorText === "" ? null : Number(floorText),
    contractDate,
    priceManwon: dealKind === "SALE" ? manwon("dealAmount") : null,
    depositManwon: dealKind === "LEASE" ? manwon("deposit") : null,
    monthlyRentManwon: dealKind === "LEASE" ? manwon("monthlyRent") : null,
    cancelled,
    // 해제일 형식이 틀려도 해제 표시는 살린다. 날짜만 비운다.
    cancelledDate: cancelled ? parseCancelDay(read("cdealDay")) : null,
  };

  return {
    ...fields,
    buildingKey: buildingKeyOf(fields),
    dedupKey: dedupKeyOf(fields),
  };
}

// 해제사유발생일. 명세 형식은 "YY.MM.DD"(예: "24.09.02")다.
function parseCancelDay(text: string): Date | null {
  const match = /^(\d{2}|\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  const fullYear = year!.length === 2 ? 2000 + Number(year) : Number(year);
  return utcDate(fullYear, Number(month), Number(day));
}
