import { describe, expect, it } from "vitest";

import { loadSampleCsv } from "./__fixtures__/load";
import { findCancelPairs } from "./cancel";
import { parseTossCsv } from "./parse";
import type { Transaction } from "../types/transaction";

function transaction(
  id: string,
  amount: number,
  at: string,
  overrides: Partial<Pick<Transaction, "description" | "kind">> = {},
): Transaction {
  return {
    id,
    at: new Date(at),
    description: "같은 가맹점",
    kind: "체크카드결제",
    amount,
    memo: "",
    balanceAfter: 0,
    ...overrides,
  };
}

describe("findCancelPairs", () => {
  it("consumes only the closest prior payment for a many-to-many candidate key", () => {
    const transactions = [
      transaction("payment-1", -10000, "2026-08-01T09:00:00"),
      transaction("payment-2", -10000, "2026-08-01T10:00:00"),
      transaction("payment-3", -10000, "2026-08-01T11:00:00"),
      transaction("cancel-1", 10000, "2026-08-01T12:00:00"),
    ];

    expect(findCancelPairs(transactions)).toEqual([
      { paymentId: "payment-3", cancelId: "cancel-1", amount: 10000 },
    ]);
    expect(transactions.map((candidate) => candidate.id)).toEqual([
      "payment-1",
      "payment-2",
      "payment-3",
      "cancel-1",
    ]);
  });

  it("does not match a cancellation that precedes its payment", () => {
    const transactions = [
      transaction("cancel", 10000, "2026-08-01T09:00:00"),
      transaction("payment", -10000, "2026-08-01T10:00:00"),
    ];

    expect(findCancelPairs(transactions)).toEqual([]);
  });

  it("does not match partial cancellations", () => {
    const transactions = [
      transaction("payment", -10000, "2026-08-01T09:00:00"),
      transaction("cancel", 3000, "2026-08-01T10:00:00"),
    ];

    expect(findCancelPairs(transactions)).toEqual([]);
  });

  it("does not match different descriptions", () => {
    const transactions = [
      transaction("payment", -10000, "2026-08-01T09:00:00", { description: "첫 가맹점" }),
      transaction("cancel", 10000, "2026-08-01T10:00:00", { description: "다른 가맹점" }),
    ];

    expect(findCancelPairs(transactions)).toEqual([]);
  });
});

const sampleCsv = loadSampleCsv();

if (sampleCsv) {
  describe("findCancelPairs with the local Toss fixture", () => {
    const transactions = parseTossCsv(sampleCsv).transactions;
    const pairs = findCancelPairs(transactions);

    it("finds exactly the two cancelled card-payment pairs", () => {
      expect(pairs).toHaveLength(2);
    });

    it.each([
      ["롯데시네마_티켓_토스페이_TOSS", 36000],
      ["(주)그린카", 267750],
    ])("matches %s for %i won regardless of elapsed time", (description, amount) => {
      const pair = pairs.find((candidate) => candidate.amount === amount);
      const payment = transactions.find((candidate) => candidate.id === pair?.paymentId);
      const cancellation = transactions.find((candidate) => candidate.id === pair?.cancelId);

      expect(payment?.description).toBe(description);
      expect(cancellation?.description).toBe(description);
      expect(cancellation!.at.getTime()).toBeGreaterThan(payment!.at.getTime());
    });
  });
} else {
  describe.skip("findCancelPairs with the local Toss fixture", () => {
    it("skips when the uncommitted fixture is unavailable", () => undefined);
  });
}
