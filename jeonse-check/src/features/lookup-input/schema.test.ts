import { describe, expect, it } from "vitest";
import { lookupInputSchema, type AddressCandidate } from "./schema";

const address: AddressCandidate = {
  id: "1",
  roadAddress: "서울특별시 마포구 월드컵북로 100",
  jibunAddress: "서울특별시 마포구 성산동 100",
  buildingName: "성산빌라",
  admCd: "1144012500",
};

const valid = { address, houseType: "row-house", deposit: 280_000_000, exclusiveArea: 59.8 };

function issuePaths(input: unknown): string[] {
  const result = lookupInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe("lookupInputSchema", () => {
  it("유효한 입력을 통과시킨다", () => {
    expect(lookupInputSchema.parse(valid)).toEqual(valid);
  });

  it("주소 후보가 없으면 address 오류다", () => {
    expect(issuePaths({ ...valid, address: undefined })).toEqual(["address"]);
  });

  it.each(["114401250", "11440125000", "114401250a", ""])("법정동코드는 숫자 10자리여야 한다: %j", (admCd) => {
    expect(issuePaths({ ...valid, address: { ...address, admCd } })).toEqual(["address"]);
  });

  it("건물명은 null일 수 있다", () => {
    expect(lookupInputSchema.safeParse({ ...valid, address: { ...address, buildingName: null } }).success).toBe(true);
  });

  it.each(["apartment", "row-house"])("주택 유형 %s를 받는다", (houseType) => {
    expect(lookupInputSchema.safeParse({ ...valid, houseType }).success).toBe(true);
  });

  it.each(["officetel", "multi-family", "detached", undefined])("MVP 밖 주택 유형 %j는 거부한다", (houseType) => {
    expect(issuePaths({ ...valid, houseType })).toEqual(["houseType"]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "보증금은 양의 정수(원)여야 한다: %d",
    (deposit) => {
      expect(issuePaths({ ...valid, deposit })).toEqual(["deposit"]);
    },
  );

  it("보증금 1원은 경계상 통과한다", () => {
    expect(lookupInputSchema.safeParse({ ...valid, deposit: 1 }).success).toBe(true);
  });

  it.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY])("전용면적은 0 초과 유한수여야 한다: %d", (exclusiveArea) => {
    expect(issuePaths({ ...valid, exclusiveArea })).toEqual(["exclusiveArea"]);
  });

  it("전용면적 0.01㎡는 경계상 통과한다", () => {
    expect(lookupInputSchema.safeParse({ ...valid, exclusiveArea: 0.01 }).success).toBe(true);
  });

  it("동·호는 앞뒤 공백을 자르고, 비어 있으면 없는 값으로 둔다", () => {
    expect(lookupInputSchema.parse({ ...valid, dong: " 101동 ", ho: "1203" })).toEqual({ ...valid, dong: "101동", ho: "1203" });

    const blank = lookupInputSchema.parse({ ...valid, dong: "  ", ho: "" });
    expect(blank).not.toHaveProperty("dong", expect.anything());
    expect(blank.dong).toBeUndefined();
    expect(blank.ho).toBeUndefined();
  });

  it("오류마다 사용자에게 보일 한국어 문구가 있다", () => {
    const result = lookupInputSchema.safeParse({});
    expect(result.success).toBe(false);
    for (const issue of result.error!.issues) {
      expect(issue.message).toMatch(/[가-힣]/);
    }
  });
});

describe("lookupInputSchema 주소 오류 문구", () => {
  it("후보 안쪽 필드가 잘못돼도 같은 안내 문구를 쓴다", () => {
    const result = lookupInputSchema.safeParse({ ...valid, address: { ...address, admCd: "1" } });
    expect(result.error?.issues[0].message).toBe("주소를 검색해서 목록에서 골라 주세요");
  });
});
