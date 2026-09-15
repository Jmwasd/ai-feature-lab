import { describe, expect, it } from "vitest";
import { formatConfidence, formatRequiredMonths } from "./format";

describe("formatRequiredMonths", () => {
  it("formats exact years", () => {
    expect(formatRequiredMonths(12)).toBe("요구 경력 1년");
    expect(formatRequiredMonths(36)).toBe("요구 경력 3년");
  });

  it("formats months and mixed years and months", () => {
    expect(formatRequiredMonths(6)).toBe("요구 경력 6개월");
    expect(formatRequiredMonths(42)).toBe("요구 경력 3년 6개월");
  });

  it("returns an empty string for non-positive or non-finite values", () => {
    expect(formatRequiredMonths(0)).toBe("");
    expect(formatRequiredMonths(-1)).toBe("");
    expect(formatRequiredMonths(Number.NaN)).toBe("");
  });
});

describe("formatConfidence", () => {
  it("formats confidence to two decimal places", () => {
    expect(formatConfidence(0.876)).toBe("신뢰도 0.88");
    expect(formatConfidence(1)).toBe("신뢰도 1.00");
  });
});
