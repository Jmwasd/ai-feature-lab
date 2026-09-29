import { describe, expect, it } from "vitest";

import { lookbackMonths, monthRange } from "./months";

describe("monthRange", () => {
  it("양 끝을 포함해 오름차순으로 돌려준다", () => {
    expect(monthRange("202401", "202403")).toEqual(["202401", "202402", "202403"]);
  });

  it("연도를 넘어간다", () => {
    expect(monthRange("202311", "202402")).toEqual(["202311", "202312", "202401", "202402"]);
  });

  it("같은 달이면 하나다", () => {
    expect(monthRange("202405", "202405")).toEqual(["202405"]);
  });

  it("from이 to보다 뒤면 RangeError", () => {
    expect(() => monthRange("202404", "202403")).toThrow(RangeError);
  });

  it("YYYYMM 형식이 아니면 RangeError", () => {
    expect(() => monthRange("2024-01", "202403")).toThrow(RangeError);
    expect(() => monthRange("202401", "202413")).toThrow(RangeError);
  });
});

describe("lookbackMonths", () => {
  it("asOf가 속한 달을 포함해 months개를 오름차순으로 돌려준다", () => {
    expect(lookbackMonths(new Date(Date.UTC(2024, 2, 15)), 3)).toEqual(["202401", "202402", "202403"]);
  });

  it("연도를 넘어간다", () => {
    expect(lookbackMonths(new Date(Date.UTC(2024, 0, 31, 23)), 2)).toEqual(["202312", "202401"]);
  });

  it("months가 1 이상 정수가 아니면 RangeError", () => {
    expect(() => lookbackMonths(new Date(Date.UTC(2024, 0, 1)), 0)).toThrow(RangeError);
    expect(() => lookbackMonths(new Date(Date.UTC(2024, 0, 1)), 1.5)).toThrow(RangeError);
  });
});
