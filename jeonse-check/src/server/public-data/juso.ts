import "server-only";

import { requireEnv } from "../env";
import { getJson, type HttpOptions, PublicDataError } from "./http";

// 행정안전부 도로명주소 검색 API(addrLinkApi.do) 어댑터.
// 원본 응답 필드명(lnbrMnnm 등)은 이 파일 밖으로 내보내지 않고 NormalizedAddress로 바꾼다.
const ENDPOINT = "https://business.juso.go.kr/addrlink/addrLinkApi.do";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
// 명세상 countPerPage 최대값.
const MAX_PER_PAGE = 100;

// 명세상 검색어 최소 길이.
const MIN_KEYWORD_LENGTH = 2;
// 명세에서 검색을 막는 특수문자(E0013). 보내기 전에 지운다.
const FORBIDDEN_CHARS = /[%=><[\]]/g;
// 한글·영문이 하나도 없으면 특수문자·숫자만 있는 검색어다(E0012). 호출하지 않는다.
const HAS_LETTER = /[가-힣A-Za-z]/;

// 검색어 자체가 부족·과다해서 나는 오류 코드. 결과 없음과 같게 빈 배열로 돌려준다.
// E0005 검색어 없음, E0006 시도명만 입력, E0008 두 글자 미만, E0009 문자·숫자 조합 필요,
// E0010 검색어 너무 김, E0011 숫자 너무 김, E0012 특수문자+숫자만, E0013 금지 특수문자·SQL 예약어,
// E0015 검색 범위 초과(결과 9천 건 초과).
// 그 밖의 코드(-999 시스템 오류, E0001~E0003 키·경로 오류, E0014 개발키 만료)는 api 오류다.
const KEYWORD_ERROR_CODES = new Set([
  "E0005",
  "E0006",
  "E0008",
  "E0009",
  "E0010",
  "E0011",
  "E0012",
  "E0013",
  "E0015",
]);

export interface NormalizedAddress {
  id: string; // 건물관리번호(bdMgtSn)
  roadAddress: string;
  jibunAddress: string;
  buildingName: string | null;
  admCd: string; // 법정동코드 10자리
  lawdCd: string; // admCd 앞 5자리 (실거래가 LAWD_CD)
  sidoName: string;
  sigunguName: string;
  /**
   * 법정 읍면동명. 리가 있는 주소는 "읍면 리"처럼 공백으로 이어 붙인다(예: "고촌읍 신곡리").
   * 리가 없으면 동·읍·면 이름만 쓴다(예: "망원동").
   */
  umdName: string;
  isMountain: boolean; // 산 여부
  mainNo: number; // 본번
  subNo: number; // 부번 (없으면 0)
  jibun: string; // "123-4" 또는 "123" (산 표시는 isMountain으로 따로 둔다)
  pnu: string; // 19자리: admCd(10) + 산구분(일반 "1", 산 "2") + 본번 4자리 + 부번 4자리
}

export interface SearchAddressOptions extends HttpOptions {
  page?: number;
  perPage?: number;
}

// 부번이 0이면 본번만 쓴다.
export function formatJibun(mainNo: number, subNo: number): string {
  return subNo === 0 ? String(mainNo) : `${mainNo}-${subNo}`;
}

// 필지고유번호(PNU) 19자리.
export function buildPnu(parts: {
  admCd: string;
  isMountain: boolean;
  mainNo: number;
  subNo: number;
}): string {
  const { admCd, isMountain, mainNo, subNo } = parts;
  if (!/^\d{10}$/.test(admCd)) {
    throw new RangeError(`법정동코드는 숫자 10자리여야 한다: ${admCd}`);
  }
  return `${admCd}${isMountain ? "2" : "1"}${pad4(mainNo, "본번")}${pad4(subNo, "부번")}`;
}

function pad4(value: number, label: string): string {
  if (!Number.isInteger(value) || value < 0 || value > 9999) {
    throw new RangeError(`${label}은 0~9999 정수여야 한다: ${value}`);
  }
  return String(value).padStart(4, "0");
}

/**
 * 주소 검색. 검색어는 앞뒤 공백을 자르고 금지 특수문자(%=><[])를 지운다.
 * 그 결과가 두 글자 미만이거나 한글·영문이 없으면(특수문자·숫자만) 호출하지 않고 빈 배열을 돌려준다.
 */
export async function searchAddress(
  keyword: string,
  options: SearchAddressOptions = {},
): Promise<NormalizedAddress[]> {
  const { page = DEFAULT_PAGE, perPage = DEFAULT_PER_PAGE, ...http } = options;
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`page는 1 이상 정수여야 한다: ${page}`);
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_PER_PAGE) {
    throw new RangeError(`perPage는 1~${MAX_PER_PAGE} 정수여야 한다: ${perPage}`);
  }

  const cleaned = keyword.replace(FORBIDDEN_CHARS, "").trim();
  if (cleaned.length < MIN_KEYWORD_LENGTH || !HAS_LETTER.test(cleaned)) {
    return [];
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("confmKey", requireEnv("JUSO_API_KEY"));
  url.searchParams.set("keyword", cleaned);
  url.searchParams.set("resultType", "json");
  url.searchParams.set("currentPage", String(page));
  url.searchParams.set("countPerPage", String(perPage));

  const body = await getJson<unknown>(url, { ...http, source: "juso" });
  const { common, juso } = readResults(body, url);

  if (common.errorCode !== "0") {
    if (KEYWORD_ERROR_CODES.has(common.errorCode)) return [];
    throw new PublicDataError("api", "juso", `${common.errorCode} ${common.errorMessage}`, { url });
  }
  return juso.map((item) => normalize(item, url));
}

// 명세상 응답 값은 모두 문자열이다.
interface RawCommon {
  errorCode: string;
  errorMessage: string;
}

type RawJuso = Record<
  | "roadAddr"
  | "jibunAddr"
  | "admCd"
  | "bdMgtSn"
  | "bdNm"
  | "siNm"
  | "sggNm"
  | "emdNm"
  | "liNm"
  | "mtYn"
  | "lnbrMnnm"
  | "lnbrSlno",
  string
>;

function readResults(body: unknown, url: URL): { common: RawCommon; juso: unknown[] } {
  const results = isRecord(body) ? body.results : undefined;
  const common = isRecord(results) ? results.common : undefined;
  if (!isRecord(results) || !isRecord(common) || typeof common.errorCode !== "string") {
    throw new PublicDataError("parse", "juso", "응답에 results.common이 없다", { url });
  }
  // 결과가 없거나 오류면 juso가 null·빈 배열로 온다.
  const juso = results.juso ?? [];
  if (!Array.isArray(juso)) {
    throw new PublicDataError("parse", "juso", "results.juso가 배열이 아니다", { url });
  }
  return {
    common: { errorCode: common.errorCode, errorMessage: String(common.errorMessage ?? "") },
    juso,
  };
}

function normalize(item: unknown, url: URL): NormalizedAddress {
  const raw = readRawJuso(item, url);
  if (!/^\d{10}$/.test(raw.admCd)) {
    throw new PublicDataError("parse", "juso", `법정동코드 형식 오류: ${raw.admCd}`, { url });
  }
  const mainNo = parseLotNumber(raw.lnbrMnnm, "lnbrMnnm", url);
  // 부번이 없으면 "0" 또는 빈 문자열로 온다.
  const subNo = raw.lnbrSlno === "" ? 0 : parseLotNumber(raw.lnbrSlno, "lnbrSlno", url);
  const isMountain = raw.mtYn === "1";

  return {
    id: raw.bdMgtSn,
    roadAddress: raw.roadAddr,
    jibunAddress: raw.jibunAddr,
    buildingName: raw.bdNm.trim() === "" ? null : raw.bdNm.trim(),
    admCd: raw.admCd,
    lawdCd: raw.admCd.slice(0, 5),
    sidoName: raw.siNm,
    sigunguName: raw.sggNm,
    umdName: raw.liNm ? `${raw.emdNm} ${raw.liNm}` : raw.emdNm,
    isMountain,
    mainNo,
    subNo,
    jibun: formatJibun(mainNo, subNo),
    pnu: buildPnu({ admCd: raw.admCd, isMountain, mainNo, subNo }),
  };
}

const REQUIRED_FIELDS = [
  "roadAddr",
  "jibunAddr",
  "admCd",
  "bdMgtSn",
  "siNm",
  "sggNm",
  "emdNm",
  "mtYn",
  "lnbrMnnm",
] as const;
const OPTIONAL_FIELDS = ["bdNm", "liNm", "lnbrSlno"] as const;

function readRawJuso(item: unknown, url: URL): RawJuso {
  if (!isRecord(item)) {
    throw new PublicDataError("parse", "juso", "주소 항목이 객체가 아니다", { url });
  }
  const raw = {} as RawJuso;
  for (const field of REQUIRED_FIELDS) {
    const value = item[field];
    if (typeof value !== "string" || value === "") {
      throw new PublicDataError("parse", "juso", `주소 항목에 ${field}가 없다`, { url });
    }
    raw[field] = value;
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = item[field];
    raw[field] = typeof value === "string" ? value : "";
  }
  return raw;
}

function parseLotNumber(value: string, field: string, url: URL): number {
  if (!/^\d{1,4}$/.test(value)) {
    throw new PublicDataError("parse", "juso", `${field} 형식 오류: ${value}`, { url });
  }
  return Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
