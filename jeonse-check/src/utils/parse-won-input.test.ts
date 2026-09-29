import { describe, expect, it } from "vitest";
import { parseWonInput, wonToInputText } from "./parse-won-input";

describe("parseWonInput", () => {
  it.each([
    ["2억 8000만", 280_000_000],
    ["2억8000만", 280_000_000],
    ["2억 8,000만", 280_000_000],
    ["2억 8천만", 280_000_000],
    ["2억", 200_000_000],
    ["2.8억", 280_000_000],
    ["2.85억", 285_000_000],
    ["8000만", 80_000_000],
    ["5천만", 50_000_000],
    ["2억 8000만원", 280_000_000],
    ["2억 8000만 원", 280_000_000],
    ["  2억 8000만  ", 280_000_000],
  ])("단위가 있는 입력 %s → %d원", (text, expected) => {
    expect(parseWonInput(text)).toBe(expected);
  });

  it("단위 없는 숫자는 만원 단위로 읽는다", () => {
    expect(parseWonInput("28000")).toBe(280_000_000);
    expect(parseWonInput("28,000")).toBe(280_000_000);
    expect(parseWonInput("500")).toBe(5_000_000);
  });

  it("숫자 뒤에 '원'이 붙으면 원 단위로 읽는다", () => {
    expect(parseWonInput("280,000,000원")).toBe(280_000_000);
    expect(parseWonInput("280000000 원")).toBe(280_000_000);
  });

  it("0은 그대로 0을 돌려준다(양수 검증은 스키마가 한다)", () => {
    expect(parseWonInput("0")).toBe(0);
  });

  it.each([
    [""],
    ["   "],
    ["abc"],
    ["2억 8천"], // 천만인지 천원인지 모호하다
    ["2억 12000만"], // 억 뒤의 만 단위가 1억 이상이다
    ["억"],
    ["만"],
    ["28000.5"], // 만원 단위 소수는 모호하다
    ["2.12345억"], // 1원 미만이 생긴다
    ["-28000"],
    ["1,000,000"], // 만원 단위로 100억 — 원 단위로 쓴 것일 수 있다
    ["8000만 2억"],
    ["2억 8000만 3000"],
    ["1e5"],
  ])("모호하거나 형식이 다른 입력 %j → null", (text) => {
    expect(parseWonInput(text)).toBeNull();
  });
});

describe("wonToInputText", () => {
  it("만원 단위로 떨어지면 억·만 표기로 쓴다", () => {
    expect(wonToInputText(280_000_000)).toBe("2억 8,000만");
    expect(wonToInputText(50_000_000)).toBe("5,000만");
  });

  it("0원과 만원 단위로 떨어지지 않는 금액은 원 단위 그대로 쓴다", () => {
    expect(wonToInputText(0)).toBe("0원");
    expect(wonToInputText(12_345)).toBe("12345원");
  });

  it.each([0, 12_345, 50_000_000, 280_000_000, 1_234_560_000])("다시 읽으면 같은 금액이 된다: %d", (amount) => {
    expect(parseWonInput(wonToInputText(amount))).toBe(amount);
  });
});
