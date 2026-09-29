import { describe, expect, it } from "vitest";
import type { RawTrade } from "./molit-trade";
import { buildingKeyOf, dedupKeyOf, normalizeJibun } from "./trade-keys";

type TradeFields = Omit<RawTrade, "buildingKey" | "dedupKey">;

const base: TradeFields = {
  houseType: "ROW_HOUSE",
  dealKind: "SALE",
  lawdCd: "11440",
  dealYmd: "202408",
  umdName: "망원동",
  jibun: "412-7",
  buildingName: "망원하이빌",
  exclusiveArea: 59.9,
  floor: -1,
  contractDate: new Date(Date.UTC(2024, 7, 12)),
  priceManwon: 45000,
  depositManwon: null,
  monthlyRentManwon: null,
  cancelled: false,
  cancelledDate: null,
};

describe("normalizeJibun", () => {
  it.each([
    ["412-3", "412-3"],
    [" 412 - 3 ", "412-3"],
    ["0412-0003", "412-3"],
    ["412-0", "412"],
    ["412번지", "412"],
    ["412번지 3", "412-3"],
    ["412", "412"],
    ["산10-5", "산10-5"],
    ["산 10-5", "산10-5"],
    ["산 010-05번지", "산10-5"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeJibun(input)).toBe(expected);
  });

  it.each([null, "", "  ", "번지"])("비어 있으면 null (%o)", (input) => {
    expect(normalizeJibun(input)).toBeNull();
  });

  it("숫자 형식이 아니면(마스킹 등) 공백만 지운다", () => {
    expect(normalizeJibun("1** ")).toBe("1**");
  });
});

describe("buildingKeyOf", () => {
  it("lawdCd|umdName|정규화 지번", () => {
    expect(
      buildingKeyOf({ lawdCd: "11440", umdName: "망원동", jibun: "0412-3", buildingName: "x" }),
    ).toBe("11440|망원동|412-3");
  });

  it("umdName 공백을 하나로 줄인다(리 단위)", () => {
    expect(
      buildingKeyOf({ lawdCd: "41570", umdName: " 고촌읍  신곡리", jibun: "1040-2", buildingName: null }),
    ).toBe("41570|고촌읍 신곡리|1040-2");
  });

  it("지번이 없으면 정규화 건물명을 쓴다", () => {
    expect(
      buildingKeyOf({ lawdCd: "11440", umdName: "망원동", jibun: " ", buildingName: " 망원 하이빌 " }),
    ).toBe("11440|망원동|name:망원하이빌");
  });

  it("지번과 건물명이 모두 없으면 name:만 남는다", () => {
    expect(buildingKeyOf({ lawdCd: "11440", umdName: "망원동", jibun: null, buildingName: null })).toBe(
      "11440|망원동|name:",
    );
  });

  it("산 표기가 달라도 같은 키", () => {
    const a = buildingKeyOf({ lawdCd: "26380", umdName: "감천동", jibun: "산10-5", buildingName: null });
    const b = buildingKeyOf({ lawdCd: "26380", umdName: "감천동", jibun: "산 10-5", buildingName: null });
    expect(a).toBe(b);
  });
});

describe("dedupKeyOf", () => {
  it("식별 필드를 고정 순서로 잇고 null은 빈 문자열, 면적은 소수 넷째 자리", () => {
    expect(dedupKeyOf(base)).toBe(
      "ROW_HOUSE|SALE|11440|망원동|2024-08-12|412-7|망원하이빌|59.9000|-1|45000||",
    );
  });

  it("해제 여부·해제일이 바뀌어도 같다", () => {
    const cancelled = { ...base, cancelled: true, cancelledDate: new Date(Date.UTC(2024, 8, 2)) };
    expect(dedupKeyOf(cancelled)).toBe(dedupKeyOf(base));
  });

  it("지번·면적 표기 차이는 같은 키로 모은다", () => {
    expect(dedupKeyOf({ ...base, jibun: "0412-07", exclusiveArea: 59.90001 })).toBe(dedupKeyOf(base));
  });

  it.each<[string, Partial<TradeFields>]>([
    ["거래 종류", { dealKind: "LEASE" }],
    ["계약일", { contractDate: new Date(Date.UTC(2024, 7, 13)) }],
    ["층", { floor: 2 }],
    ["면적", { exclusiveArea: 59.91 }],
    ["매매가", { priceManwon: 45001 }],
    ["보증금", { depositManwon: 1000 }],
    ["월세", { monthlyRentManwon: 50 }],
    ["건물명", { buildingName: null }],
  ])("%s가 다르면 다른 키", (_label, change) => {
    expect(dedupKeyOf({ ...base, ...change })).not.toBe(dedupKeyOf(base));
  });
});
