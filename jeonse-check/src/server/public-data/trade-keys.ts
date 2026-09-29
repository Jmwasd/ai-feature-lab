import "server-only";

import type { RawTrade } from "./molit-trade";

// 실거래가 저장 키 규칙. 입출력만 있는 순수 함수다.
// buildingKey는 실거래가 어댑터와 juso 주소(phase 5) 양쪽에서 같은 함수로 만든다.

const KEY_SEPARATOR = "|";
// 전용면적 고정 표기 자릿수. 스키마 Decimal(10, 4)와 같다.
const AREA_DIGITS = 4;

// "412-3", "412", "산10-5" 꼴(공백·"번지"를 지운 뒤). 부번 앞 "-"는 "번지 3"처럼 빠질 수 있다.
const JIBUN_PATTERN = /^(산)?(\d+)(?:-(\d+))?$/;

/**
 * 지번 정규화. 공백·"번지"를 지우고 본번·부번의 앞자리 0을 없앤다. 부번이 0이면 본번만 남긴다.
 * 산 지번은 "산" 접두어를 붙여 "산10-5"로 통일한다. 숫자 꼴이 아니면(마스킹 등) 공백만 지운다.
 */
export function normalizeJibun(jibun: string | null): string | null {
  if (jibun === null) return null;
  // "412번지 3"은 "412-3"으로 본다.
  const compact = jibun
    .replace(/번지\s*(?=\d)/g, "-")
    .replace(/번지/g, "")
    .replace(/\s+/g, "");
  if (compact === "") return null;

  const match = JIBUN_PATTERN.exec(compact);
  if (!match) return compact;
  const [, mountain = "", main, sub] = match;
  const mainNo = Number(main);
  const subNo = sub === undefined ? 0 : Number(sub);
  return `${mountain}${mainNo}${subNo === 0 ? "" : `-${subNo}`}`;
}

/**
 * 같은 건물 식별 키. `lawdCd|umdName|정규화 지번`, 지번이 없으면 `lawdCd|umdName|name:정규화 건물명`.
 * umdName은 juso와 실거래가 모두 리 단위를 "읍면 리"로 쓴다(공백은 하나로 줄인다).
 * juso 주소(NormalizedAddress)는 산 여부를 jibun이 아닌 isMountain으로 주므로 그 값을 함께 넘기면 "산"을 붙인다.
 */
export function buildingKeyOf(input: {
  lawdCd: string;
  umdName: string;
  jibun: string | null;
  buildingName: string | null;
  isMountain?: boolean;
}): string {
  const { lawdCd, umdName, jibun, buildingName, isMountain = false } = input;
  const normalized = normalizeJibun(isMountain && jibun !== null ? `산${jibun}` : jibun);
  const place = normalized ?? `name:${normalizeName(buildingName)}`;
  return [lawdCd, normalizeUmdName(umdName), place].join(KEY_SEPARATOR);
}

/**
 * 거래 식별 키. 유형·거래 종류·지역·계약일·지번·건물명·전용면적·층·금액을 고정 순서로 잇는다.
 * 해제 여부·해제일은 넣지 않는다. 해제되면 같은 행의 표시만 바뀌어야 한다(ADR-004 멱등 upsert).
 * 동·호가 응답에 없어 같은 날 같은 층·면적·금액의 거래 두 건은 구분하지 못한다.
 */
export function dedupKeyOf(trade: Omit<RawTrade, "buildingKey" | "dedupKey">): string {
  return [
    trade.houseType,
    trade.dealKind,
    trade.lawdCd,
    normalizeUmdName(trade.umdName),
    trade.contractDate.toISOString().slice(0, 10),
    normalizeJibun(trade.jibun) ?? "",
    trade.buildingName?.trim() ?? "",
    trade.exclusiveArea.toFixed(AREA_DIGITS),
    trade.floor ?? "",
    trade.priceManwon ?? "",
    trade.depositManwon ?? "",
    trade.monthlyRentManwon ?? "",
  ].join(KEY_SEPARATOR);
}

function normalizeUmdName(umdName: string): string {
  return umdName.trim().replace(/\s+/g, " ");
}

// 건물명은 띄어쓰기가 응답마다 달라 공백을 모두 지운다.
function normalizeName(name: string | null): string {
  return (name ?? "").replace(/\s+/g, "");
}
