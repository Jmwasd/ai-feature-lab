import "server-only";

import { XMLParser, XMLValidator } from "fast-xml-parser";

import { PublicDataError, type PublicDataSource } from "./http";

// 공공데이터 XML 공용 파서. 값은 모두 문자열로 둔다.
// 숫자 자동 변환을 끄는 이유: "82,500" 같은 콤마 금액, "01110"처럼 앞자리 0이 있는 코드가 깨진다.
// 숫자 변환은 각 어댑터가 필드 의미를 알고 한다.
const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

export function parseXml(text: string, source: PublicDataSource): unknown {
  if (XMLValidator.validate(text) !== true) {
    throw new PublicDataError("parse", source, "XML 파싱 실패");
  }
  return parser.parse(text);
}

// 항목이 하나면 배열이 아닌 객체로, 없으면 빈 문자열(<items></items>)이나 undefined로 온다. 항상 배열로 맞춘다.
export function toArray<T>(value: T | T[] | "" | null | undefined): T[] {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}
