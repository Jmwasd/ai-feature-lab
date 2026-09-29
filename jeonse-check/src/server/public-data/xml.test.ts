import { describe, expect, it } from "vitest";
import { PublicDataError } from "./http";
import { parseXml, toArray } from "./xml";

describe("parseXml", () => {
  it("숫자처럼 보이는 값을 문자열 그대로 둔다", () => {
    const xml =
      "<response><item><deposit>82,500</deposit><sggCd>01110</sggCd><floor>3</floor></item></response>";
    expect(parseXml(xml, "molit-trade")).toEqual({
      response: { item: { deposit: "82,500", sggCd: "01110", floor: "3" } },
    });
  });

  it("잘못된 XML이면 kind parse로 실패한다", () => {
    try {
      parseXml("<response><item></response>", "building");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PublicDataError);
      expect((error as PublicDataError).kind).toBe("parse");
      expect((error as PublicDataError).source).toBe("building");
    }
  });
});

describe("toArray", () => {
  it("단일 객체를 배열로 감싼다", () => {
    expect(toArray({ a: "1" })).toEqual([{ a: "1" }]);
  });

  it("배열은 그대로 돌려준다", () => {
    expect(toArray([{ a: "1" }, { a: "2" }])).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("없거나 빈 문자열이면 빈 배열이다", () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
    expect(toArray("")).toEqual([]);
  });
});
