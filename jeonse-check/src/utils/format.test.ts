import { describe, expect, it } from "vitest";
import { formatIsoDate, formatPercent, formatSeoulDate, formatWon } from "./format";

describe("formatWon", () => {
  it.each([
    [280_000_000, "2억 8,000만"],
    [55_000_000, "5,500만"],
    [300_000_000, "3억"],
    [0, "0원"],
    [700_000_000, "7억"],
    [1_000_000_000_000, "10,000억"],
    [205_000_000, "2억 500만"],
  ])("%d원 → %s", (amount, expected) => {
    expect(formatWon(amount)).toBe(expected);
  });

  it("1만 원 미만은 만 원 단위로 반올림한다", () => {
    expect(formatWon(55_004_999)).toBe("5,500만");
    expect(formatWon(55_005_000)).toBe("5,501만");
    expect(formatWon(299_995_000)).toBe("3억");
    expect(formatWon(4_999)).toBe("0원");
    expect(formatWon(5_000)).toBe("1만");
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("%d는 예외를 던진다", (amount) => {
    expect(() => formatWon(amount)).toThrow(RangeError);
  });
});

describe("formatPercent", () => {
  it.each([
    [0.745, "74.5%"],
    [0.7, "70%"],
    [0, "0%"],
    [1.26, "126%"],
    [1.05, "105%"],
    [0.12345, "12.3%"],
  ])("%d → %s", (ratio, expected) => {
    expect(formatPercent(ratio)).toBe(expected);
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])("%d는 예외를 던진다", (ratio) => {
    expect(() => formatPercent(ratio)).toThrow(RangeError);
  });
});

describe("formatIsoDate", () => {
  it("UTC 기준 YYYY-MM-DD로 쓴다", () => {
    expect(formatIsoDate(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01");
    expect(formatIsoDate(new Date("2026-02-28T23:59:59Z"))).toBe("2026-02-28");
  });
});

describe("formatSeoulDate", () => {
  it("한국 시간 기준 YYYY-MM-DD로 쓴다", () => {
    // UTC로는 전날이지만 한국 시간으로는 다음 날 아침이다.
    expect(formatSeoulDate(new Date("2026-09-29T23:30:00Z"))).toBe("2026-09-30");
    expect(formatSeoulDate(new Date("2026-09-30T14:59:59Z"))).toBe("2026-09-30");
  });
});
