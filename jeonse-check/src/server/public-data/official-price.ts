import "server-only";

import { requireEnv } from "../env";
import { getJson, type HttpOptions, PublicDataError } from "./http";

// 디지털트윈국토(vworld) 공동주택가격속성조회 API 어댑터. 공시가격은 호(세대) 단위다.
// 원본 응답 필드명(pblntfPc 등)은 이 파일 밖으로 내보내지 않고 OfficialPrice로 바꾼다.
// 배율(HUG 기준 등)은 곱하지 않는다. 판정 feature가 policy.ts로 계산한다.
const ENDPOINT = "https://api.vworld.kr/ned/data/getApartHousingPriceAttr";

// 한 페이지 크기. 명세상 numOfRows 최대값(1~1000).
const PAGE_SIZE = 1000;
// 일일 사용량 초과 오류 코드.
const QUOTA_RESULT_CODE = "OVER_REQUEST_LIMIT";
// 기준연도는 한국 시간(UTC+9)으로 정한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface OfficialPrice {
  price: number; // 공시가격, 원
  baseYear: number; // 기준연도
  dongName: string | null; // 응답의 동 이름. 동 없는 건물은 null
  hoName: string | null; // 응답의 호 이름
  exclusiveArea: number | null; // 전용면적(㎡)
}

export interface FetchOfficialPriceParams {
  pnu: string; // 필지고유번호 19자리
  dong: string | null; // 사용자가 입력한 동. 모르면 null
  ho: string; // 사용자가 입력한 호
  asOf: Date; // 조회 기준 시점. 이 연도부터 조회한다
}

// 동 비교용 정규화: 공백·앞의 "제"·끝의 "동"을 지우고, 영문은 대문자로, 숫자만 있으면 앞자리 0을 뗀다.
// "제101동"·"0101" → "101", "a동" → "A". "에이"와 "A"처럼 표기가 다른 이름은 같게 보지 않는다.
export function normalizeDong(value: string): string {
  let text = value.replace(/\s+/g, "").toUpperCase();
  if (text.startsWith("제") && text.length > 1) text = text.slice(1);
  if (text.endsWith("동") && text.length > 1) text = text.slice(0, -1);
  return stripLeadingZeros(text);
}

// 호 비교용 정규화: 공백·앞의 "제"·끝의 "호"를 지우고, 숫자만 있으면 앞자리 0을 뗀다.
// 지하 표기("지하101"·"지층101"·"B101")는 숫자 앞에 올 때 "B"로 맞춘다. "지하 101호" → "B101", "B01" → "B1".
export function normalizeHo(value: string): string {
  let text = value.replace(/\s+/g, "").toUpperCase();
  if (text.startsWith("제") && text.length > 1) text = text.slice(1);
  if (text.endsWith("호")) text = text.slice(0, -1);
  const basement = /^(?:지하|지층|B)(\d+)$/.exec(text);
  if (basement) return `B${stripLeadingZeros(basement[1]!)}`;
  return stripLeadingZeros(text);
}

function stripLeadingZeros(text: string): string {
  return /^\d+$/.test(text) ? String(Number(text)) : text;
}

/**
 * 세대 하나의 공동주택 공시가격. asOf 연도(한국 시간)부터 조회하고, 그 해에 세대가 없으면 한 해 전을 조회한다(공시 발표 전 기간).
 * 동·호가 정확히 맞는 세대가 없거나, 동을 모르는데 같은 호가 여러 동에 있으면 null이다.
 * 다른 세대의 값으로 대신하면 HUG 판정이 틀리기 때문이다.
 */
export async function fetchOfficialPrice(
  params: FetchOfficialPriceParams,
  options: HttpOptions = {},
): Promise<OfficialPrice | null> {
  const { pnu, dong, ho, asOf } = params;
  if (!/^\d{19}$/.test(pnu)) {
    throw new RangeError(`pnu는 숫자 19자리여야 한다: ${pnu}`);
  }
  const targetHo = normalizeHo(ho);
  if (targetHo === "") {
    throw new RangeError(`호가 비어 있다: ${ho}`);
  }
  if (Number.isNaN(asOf.getTime())) {
    throw new RangeError("asOf가 유효한 날짜가 아니다");
  }

  const auth = { key: requireEnv("VWORLD_API_KEY"), domain: requireEnv("VWORLD_API_DOMAIN") };
  const year = new Date(asOf.getTime() + KST_OFFSET_MS).getUTCFullYear();
  const target = { dong: dong === null ? null : normalizeDong(dong), ho: targetHo };

  for (const stdrYear of [year, year - 1]) {
    const rows = await fetchYear({ pnu, stdrYear, ho: targetHo }, auth, options);
    const unit = pickUnit(rows, target);
    if (unit === "ambiguous") return null;
    if (unit !== null) return unit;
  }
  return null;
}

interface PriceRow {
  baseYear: number;
  price: number;
  dongName: string;
  hoName: string;
  exclusiveArea: number | null;
  lastUpdated: string; // YYYY-MM-DD. 없으면 빈 문자열
}

async function fetchYear(
  query: { pnu: string; stdrYear: number; ho: string },
  auth: { key: string; domain: string },
  options: HttpOptions,
): Promise<PriceRow[]> {
  const pageUrl = (pageNo: number): URL => {
    const url = new URL(ENDPOINT);
    url.searchParams.set("key", auth.key);
    // 인증키가 발급 시 등록한 도메인에 묶여 있어 서버 호출에도 필요하다.
    url.searchParams.set("domain", auth.domain);
    url.searchParams.set("pnu", query.pnu);
    url.searchParams.set("stdrYear", String(query.stdrYear));
    url.searchParams.set("format", "json");
    url.searchParams.set("numOfRows", String(PAGE_SIZE));
    url.searchParams.set("pageNo", String(pageNo));
    // hoNm은 정확 일치 필터다. 숫자 호는 응답도 "1207"처럼 숫자만 있어 서버에서 좁힌다.
    // 지하 호는 "지하101"·"지층101"·"B01"처럼 표기가 제각각이라 전체를 받아 정규화해 비교한다.
    // dongNm도 "에이"·"가"·건물명처럼 제각각이라 보내지 않는다.
    if (/^\d+$/.test(query.ho)) url.searchParams.set("hoNm", query.ho);
    return url;
  };

  const first = await fetchPage(pageUrl(1));
  const rows = [...first.rows];
  const totalPages = Math.ceil(first.totalCount / PAGE_SIZE);
  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    rows.push(...(await fetchPage(pageUrl(pageNo))).rows);
  }
  return rows;

  async function fetchPage(url: URL): Promise<{ totalCount: number; rows: PriceRow[] }> {
    const body = await getJson<unknown>(url, { ...options, source: "vworld" });
    // 결과가 있거나 오류면 apartHousingPrices, 결과가 없으면 response 루트로 온다.
    const root = isRecord(body) ? (body.apartHousingPrices ?? body.response) : undefined;
    if (!isRecord(root)) {
      throw new PublicDataError("parse", "vworld", "응답에 apartHousingPrices가 없다", { url });
    }

    const resultCode = typeof root.resultCode === "string" ? root.resultCode : "";
    if (resultCode !== "") {
      const kind = resultCode === QUOTA_RESULT_CODE ? "quota" : "api";
      throw new PublicDataError(kind, "vworld", `${resultCode} ${String(root.resultMsg ?? "")}`, {
        url,
      });
    }

    const totalCount = String(root.totalCount ?? "");
    if (!/^\d+$/.test(totalCount)) {
      throw new PublicDataError("parse", "vworld", `totalCount 형식 오류: ${totalCount}`, { url });
    }
    const field = root.field ?? [];
    if (!Array.isArray(field)) {
      throw new PublicDataError("parse", "vworld", "field가 배열이 아니다", { url });
    }
    return { totalCount: Number(totalCount), rows: field.map((item) => toRow(item, url)) };
  }
}

function toRow(item: unknown, url: URL): PriceRow {
  const fail = (detail: string): never => {
    throw new PublicDataError("parse", "vworld", detail, { url });
  };
  if (!isRecord(item)) fail("공시가격 항목이 객체가 아니다");
  const record = item as Record<string, unknown>;
  const read = (name: string): string => {
    const value = record[name];
    return typeof value === "string" ? value.trim() : "";
  };

  const priceText = read("pblntfPc");
  if (!/^\d+$/.test(priceText)) fail(`pblntfPc 형식 오류: ${priceText}`);
  const yearText = read("stdrYear");
  if (!/^\d{4}$/.test(yearText)) fail(`stdrYear 형식 오류: ${yearText}`);
  const hoName = read("hoNm");
  if (hoName === "") fail("공시가격 항목에 hoNm이 없다");

  const areaText = read("prvuseAr");
  const area = Number(areaText);
  return {
    baseYear: Number(yearText),
    price: Number(priceText),
    dongName: read("dongNm"),
    hoName,
    exclusiveArea: /^\d+(\.\d+)?$/.test(areaText) && area > 0 ? area : null,
    lastUpdated: read("lastUpdtDt"),
  };
}

// 동·호가 맞는 세대 하나를 고른다. 없으면 null, 여러 세대로 갈리면 "ambiguous".
function pickUnit(
  rows: PriceRow[],
  target: { dong: string | null; ho: string },
): OfficialPrice | "ambiguous" | null {
  let candidates = rows.filter((row) => normalizeHo(row.hoName) === target.ho);
  if (target.dong !== null) {
    const byDong = candidates.filter((row) => normalizeDong(row.dongName) === target.dong);
    // 응답에 동이 아예 없는 건물(단일 동 다세대 등)은 사용자가 적은 동과 상관없이 호로만 찾는다.
    const dongless = candidates.length > 0 && candidates.every((row) => row.dongName === "");
    candidates = byDong.length === 0 && dongless ? candidates : byDong;
  }
  if (candidates.length === 0) return null;

  // 같은 세대가 여러 행(갱신 이력)으로 온다. 동이 둘 이상이면 서로 다른 세대다.
  const dongs = new Set(candidates.map((row) => normalizeDong(row.dongName)));
  if (dongs.size > 1) return "ambiguous";

  // 최종 갱신일이 가장 늦은 행을 쓴다. 그 행들끼리 금액이 다르면 어느 값인지 알 수 없다.
  const latest = candidates.reduce((max, row) => (row.lastUpdated > max ? row.lastUpdated : max), "");
  const newest = candidates.filter((row) => row.lastUpdated === latest);
  if (new Set(newest.map((row) => row.price)).size > 1) return "ambiguous";

  const row = newest[0]!;
  return {
    price: row.price,
    baseYear: row.baseYear,
    dongName: row.dongName === "" ? null : row.dongName,
    hoName: row.hoName,
    exclusiveArea: row.exclusiveArea,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
