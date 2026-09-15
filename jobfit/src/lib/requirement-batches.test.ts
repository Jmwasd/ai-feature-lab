import { describe, expect, it } from "vitest";

import type { Requirement } from "@/types";
import { batchRequirements } from "./requirement-batches";

function requirements(count: number): Requirement[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `req-${index + 1}`,
    text: `요구사항 ${index + 1}`,
    kind: "must",
  }));
}

describe("batchRequirements", () => {
  it("makes no calls for an empty input", () => {
    expect(batchRequirements([])).toEqual([]);
  });

  it("keeps up to four requirements in one batch", () => {
    const input = requirements(4);
    expect(batchRequirements(input)).toEqual([input]);
  });

  it.each([5, 8, 11, 12, 20, 100])(
    "balances %i requirements with at most four per batch without omissions or reordering",
    (count) => {
      const input = requirements(count);
      const original = [...input];
      const batches = batchRequirements(input);
      const sizes = batches.map((batch) => batch.length);

      expect(batches).toHaveLength(Math.ceil(count / 4));
      expect(Math.max(...sizes)).toBeLessThanOrEqual(4);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(batches.flat()).toEqual(original);
      expect(input).toEqual(original);
    },
  );
});
