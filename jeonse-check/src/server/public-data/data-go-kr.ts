import "server-only";

import { getText, type HttpOptions, PublicDataError, type PublicDataSource } from "./http";
import { parseXml, toArray } from "./xml";

// apis.data.go.kr XML 응답 공용 처리. 실거래가·건축물대장 어댑터가 같은 응답 봉투와 페이지 방식을 쓴다.

// 정상 resultCode. 개편된 API는 "000", 이전 API는 "00"을 쓴다.
const OK_RESULT_CODES = new Set(["00", "000"]);
// 게이트웨이 오류(OpenAPI_ServiceResponse)의 한도 초과 코드(LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR).
const QUOTA_REASON_CODE = "22";

export interface DataGoKrItem {
  item: Record<string, unknown>;
  url: URL; // 이 항목을 받은 페이지 URL. 항목 단위 오류 메시지에 싣는다.
}

/**
 * 1페이지의 totalCount를 보고 나머지 페이지까지 모두 받아 항목을 이어 붙인다.
 * 결과가 없으면 빈 배열이다.
 */
export async function fetchAllItems(
  pageUrl: (pageNo: number) => URL,
  pageSize: number,
  source: PublicDataSource,
  options: HttpOptions,
): Promise<DataGoKrItem[]> {
  const first = await fetchPage(pageUrl(1), source, options);
  const items = [...first.items];
  const totalPages = Math.ceil(first.totalCount / pageSize);
  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const page = await fetchPage(pageUrl(pageNo), source, options);
    items.push(...page.items);
  }
  return items;
}

// 빈 값은 " "(공백 한 칸)으로 온다. 앞뒤 공백을 지워 빈 문자열로 맞춘다.
export function readField(item: Record<string, unknown>, field: string): string {
  const value = item[field];
  return typeof value === "string" ? value.trim() : "";
}

// 존재하지 않는 날짜(2월 30일 등)는 null.
export function utcDate(year: number, month: number, day: number): Date | null {
  if (![year, month, day].every(Number.isInteger)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : null;
}

interface Page {
  totalCount: number;
  items: DataGoKrItem[];
}

async function fetchPage(url: URL, source: PublicDataSource, options: HttpOptions): Promise<Page> {
  const text = await getText(url, { ...options, source });
  const root = asRecord(parseXml(text, source));

  // 게이트웨이 오류(키 미등록·한도 초과 등)는 다른 루트 요소로 온다.
  const gateway = asRecord(asRecord(root.OpenAPI_ServiceResponse).cmmMsgHeader);
  if (Object.keys(gateway).length > 0) {
    const code = String(gateway.returnReasonCode ?? "");
    const detail = [code, gateway.errMsg, gateway.returnAuthMsg].filter(Boolean).join(" ");
    throw new PublicDataError(code === QUOTA_REASON_CODE ? "quota" : "api", source, detail, { url });
  }

  const response = asRecord(root.response);
  const header = asRecord(response.header);
  if (typeof header.resultCode !== "string") {
    throw new PublicDataError("parse", source, "응답에 response.header가 없다", { url });
  }
  if (!OK_RESULT_CODES.has(header.resultCode)) {
    const kind = header.resultCode === QUOTA_REASON_CODE ? "quota" : "api";
    throw new PublicDataError(kind, source, `${header.resultCode} ${String(header.resultMsg ?? "")}`, {
      url,
    });
  }

  const body = asRecord(response.body);
  const totalCount = String(body.totalCount ?? "");
  if (!/^\d+$/.test(totalCount)) {
    throw new PublicDataError("parse", source, `totalCount 형식 오류: ${totalCount}`, { url });
  }
  // 결과가 없으면 <items></items>(빈 문자열), 하나면 객체로 온다.
  const rawItems = toArray(asRecord(body.items).item as unknown);
  return {
    totalCount: Number(totalCount),
    items: rawItems.map((item) => {
      if (!isRecord(item)) {
        throw new PublicDataError("parse", source, "응답 항목이 객체가 아니다", { url });
      }
      return { item, url };
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
