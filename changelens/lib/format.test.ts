import { describe, expect, it } from "vitest";
import {
  formatContributors, formatCount, formatDate, formatDateTime,
  formatPeriod, formatSigned, shortSha,
} from "./format";

describe("count and change formatting", () => {
  it.each([[0, "0"], [1284, "1,284"], [96412, "96,412"], [1000000, "1,000,000"]])(
    "formats %i with fixed comma separators", (value, expected) => {
      expect(formatCount(value as number)).toBe(expected);
    },
  );

  it("uses an explicit plus or Unicode minus, including zero", () => {
    expect(formatSigned(96412, "+")).toBe("+96,412");
    expect(formatSigned(41077, "−")).toBe("−41,077");
    expect(formatSigned(0, "+")).toBe("+0");
    expect(formatSigned(0, "−")).toBe("−0");
    expect(formatSigned(1, "−").codePointAt(0)).toBe(0x2212);
    expect(formatSigned(1, "−")).not.toContain("-");
  });
});

describe("recorded dates", () => {
  it.each([
    ["2026-09-19T14:22:05+09:00", "2026-09-19 14:22", "2026-09-19"],
    ["2026-09-19T23:59:59-07:00", "2026-09-19 23:59", "2026-09-19"],
    ["2026-01-01T00:01:00+14:00", "2026-01-01 00:01", "2026-01-01"],
    ["2026-09-19T14:22:05Z", "2026-09-19 14:22", "2026-09-19"],
  ])("preserves the written time and day for %s", (iso, time, date) => {
    expect(formatDateTime(iso)).toBe(time);
    expect(formatDate(iso)).toBe(date);
  });
});

describe("elapsed period", () => {
  it.each([
    ["2026-01-01T12:00:00+09:00", "0일"],
    ["2026-01-02T11:59:59+09:00", "0일"],
    ["2026-01-02T12:00:00+09:00", "1일"],
    ["2026-01-31T11:59:59+09:00", "29일"],
    ["2026-01-31T12:00:00+09:00", "1개월"],
    ["2026-03-01T12:00:00+09:00", "1개월"],
    ["2026-03-02T12:00:00+09:00", "2개월"],
  ])("formats the completed days/months through %s", (last, expected) => {
    expect(formatPeriod("2026-01-01T12:00:00+09:00", last)).toBe(expected);
  });

  it("compares instants across offsets without depending on the machine timezone", () => {
    expect(formatPeriod("2026-01-01T12:00:00+09:00", "2026-01-01T22:00:00-05:00")).toBe("1일");
  });

  it("matches the example history period", () => {
    expect(formatPeriod("2025-07-02T12:00:00+09:00", "2026-09-19T12:00:00+09:00")).toBe("14개월");
  });
});

describe("commit labels", () => {
  it("omits the remainder for a single contributor", () => {
    expect(formatContributors("서연", 1)).toBe("서연");
    expect(formatContributors("서연", 7)).toBe("서연 외 6명");
    expect(formatContributors("서연", 1285)).toBe("서연 외 1,284명");
  });

  it("shows the first seven characters of a SHA", () => {
    expect(shortSha("8f2c10a1234567890abcdef1234567890abcdef123")).toBe("8f2c10a");
    expect(shortSha("8f2c10a")).toBe("8f2c10a");
  });
});
