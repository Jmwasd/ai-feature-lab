import { describe, expect, it } from "vitest";
import { rightsInputSchema, validateRightsInput } from "./schema";

// 2026-09-30 정오(로컬). 날짜 입력은 UTC 자정 Date로 들어온다.
const asOf = new Date(2026, 8, 30, 12);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const valid = {
  maxClaimAmount: 240_000_000,
  seniorDeposits: 0,
  isTrust: false,
  lastOwnershipChangeDate: day("2024-03-15"),
};

function issuePaths(input: unknown): string[] {
  const result = validateRightsInput(input, asOf);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe("validateRightsInput", () => {
  it("유효한 입력을 그대로 통과시킨다", () => {
    const result = validateRightsInput(valid, asOf);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(valid);
  });

  it("근저당·선순위 보증금 0원과 소유권 이전일 없음(null)을 받는다", () => {
    expect(validateRightsInput({ ...valid, maxClaimAmount: 0, seniorDeposits: 0, lastOwnershipChangeDate: null }, asOf).success).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, undefined])(
    "채권최고액 합계는 0 이상 정수(원)여야 한다: %j",
    (maxClaimAmount) => {
      expect(issuePaths({ ...valid, maxClaimAmount })).toEqual(["maxClaimAmount"]);
    },
  );

  it.each([-1, -100_000_000, 0.5, Number.NaN, undefined])("선순위 보증금은 0 이상 정수(원)여야 한다: %j", (seniorDeposits) => {
    expect(issuePaths({ ...valid, seniorDeposits })).toEqual(["seniorDeposits"]);
  });

  it("신탁 여부를 고르지 않으면 거부한다", () => {
    expect(issuePaths({ ...valid, isTrust: undefined })).toEqual(["isTrust"]);
    expect(issuePaths({ ...valid, isTrust: null })).toEqual(["isTrust"]);
  });

  it("신탁 여부는 예·아니오 모두 받는다", () => {
    expect(validateRightsInput({ ...valid, isTrust: true }, asOf).success).toBe(true);
    expect(validateRightsInput({ ...valid, isTrust: false }, asOf).success).toBe(true);
  });

  it("소유권 이전일이 기준일보다 뒤(미래)면 거부한다", () => {
    expect(issuePaths({ ...valid, lastOwnershipChangeDate: day("2026-10-01") })).toEqual(["lastOwnershipChangeDate"]);
    expect(issuePaths({ ...valid, lastOwnershipChangeDate: day("2030-01-01") })).toEqual(["lastOwnershipChangeDate"]);
  });

  it("기준일 당일은 받는다", () => {
    expect(validateRightsInput({ ...valid, lastOwnershipChangeDate: day("2026-09-30") }, asOf).success).toBe(true);
  });

  it("오늘은 스키마가 아니라 인자로 정한다", () => {
    const input = { ...valid, lastOwnershipChangeDate: day("2026-10-01") };
    expect(validateRightsInput(input, new Date(2026, 9, 1, 9)).success).toBe(true);
    expect(validateRightsInput(input, asOf).success).toBe(false);
  });

  it("소유권 이전일 칸이 빠지거나 잘못된 날짜면 거부한다(null로 채우지 않는다)", () => {
    expect(issuePaths({ ...valid, lastOwnershipChangeDate: undefined })).toEqual(["lastOwnershipChangeDate"]);
    expect(issuePaths({ ...valid, lastOwnershipChangeDate: new Date("invalid") })).toEqual(["lastOwnershipChangeDate"]);
  });

  it("오류마다 사용자에게 보일 한국어 문구가 있다", () => {
    const result = validateRightsInput({}, asOf);
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((issue) => String(issue.path[0])).sort()).toEqual(
      ["isTrust", "lastOwnershipChangeDate", "maxClaimAmount", "seniorDeposits"].sort(),
    );
    for (const issue of result.error!.issues) {
      expect(issue.message).toMatch(/[가-힣]/);
    }
  });
});

describe("rightsInputSchema", () => {
  it("기준일 검사 없이 구조만 검증한다", () => {
    expect(rightsInputSchema.safeParse({ ...valid, lastOwnershipChangeDate: day("2030-01-01") }).success).toBe(true);
    expect(rightsInputSchema.safeParse({ ...valid, seniorDeposits: -1 }).success).toBe(false);
  });
});
