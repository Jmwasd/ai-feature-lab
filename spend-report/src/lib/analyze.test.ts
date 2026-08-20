import { describe, expect, it } from "vitest";

import { loadSampleCsv } from "./__fixtures__/load";
import { analyze } from "./analyze";
import { parseTossCsv } from "./parse";
import type { Transaction } from "../types/transaction";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    at: new Date("2026-08-01T12:00:00"),
    description: "알 수 없는 가맹점",
    kind: "체크카드결제",
    amount: -10000,
    memo: "",
    balanceAfter: 0,
    ...overrides,
  };
}

describe("analyze", () => {
  it("uses supplied LLM categories without allowing them to calculate amounts", () => {
    const report = analyze([transaction()], {
      llmCategories: { "알 수 없는 가맹점": "식비" },
    });

    expect(report.totalSpend).toBe(10000);
    expect(report.byCategory).toEqual([{ category: "식비", amount: 10000, count: 1 }]);
    expect(report.unclassified).toEqual({ count: 0, amount: 0, ratio: 0 });
  });

  it("requires three matching descriptions for a short file, but two for a 30-day query period", () => {
    const transactions = [
      transaction({ id: "first", amount: -12000 }),
      transaction({
        id: "second",
        amount: -8000,
        at: new Date("2026-08-15T12:00:00"),
      }),
    ];

    expect(analyze(transactions, {}).repeats).toEqual([]);

    const report = analyze(transactions, {
      queryPeriod: {
        from: new Date("2026-08-01T00:00:00"),
        to: new Date("2026-08-30T00:00:00"),
      },
    });

    expect(report.repeats).toEqual([
      { displayName: "알 수 없는 가맹점", count: 2, amount: 20000 },
    ]);
    expect(report.notes).toEqual([]);
  });
});

const sampleCsv = loadSampleCsv();

if (sampleCsv) {
  describe("analyze with the local Toss fixture", () => {
    const parsed = parseTossCsv(sampleCsv);
    const report = analyze(parsed.transactions, { queryPeriod: parsed.queryPeriod });

    it("produces the verified spend, cancellation, repeat, event, and concentration totals", () => {
      expect(report.totalSpend).toBe(2077810);
      expect(report.spendCount).toBe(23);
      expect(report.excludedCancels).toEqual({ count: 2, amount: 303750 });
      expect(report.repeats).toEqual([{ displayName: "쿠팡이츠", count: 4, amount: 102300 }]);
      expect(report.events).toEqual([
        { key: "제주", count: 7, amount: 782430, ratio: expect.closeTo(782430 / 2077810, 6) },
      ]);
      expect(report.concentration).toMatchObject({
        topN: 3,
        amount: 1263400,
        ratio: expect.closeTo(1263400 / 2077810, 6),
      });
      expect(report.concentration.items.map((item) => item.description)).toEqual([
        "쿠팡(쿠페이)",
        "대한항공",
        "엔에이치엔케이씨피 ㈜",
      ]);
    });

    it("identifies both memo-less withdrawals and the high-value unclassified Coupang payment", () => {
      // 실명이 든 적요를 테스트에 적지 않는다. 조건으로 픽스처에서 유도한다 (ADR-010)
      const memolessWithdrawals = parsed.transactions.filter(
        (candidate) => candidate.kind === "출금" && candidate.memo.trim() === "",
      );
      const topUnclassified = report.concentration.items.find(
        (item) => item.category === "미분류",
      );

      expect(memolessWithdrawals).toHaveLength(2);
      expect(topUnclassified?.description).toBe("쿠팡(쿠페이)");
      expect(report.needsInput.map((item) => item.id).sort()).toEqual(
        [...memolessWithdrawals.map((tx) => tx.id), topUnclassified!.id].sort(),
      );
    });

    it("re-aggregates immediately when a user excludes the travel-settlement withdrawal", () => {
      const travelSettlement = parsed.transactions.find(
        (candidate) => candidate.kind === "출금" && candidate.description === "여행비",
      );

      expect(travelSettlement).toBeDefined();

      const overridden = analyze(parsed.transactions, {
        queryPeriod: parsed.queryPeriod,
        overrides: { [travelSettlement!.id]: { excluded: true } },
      });

      expect(overridden.totalSpend).toBe(1877810);
      expect(overridden.spendCount).toBe(22);
    });
  });
} else {
  describe.skip("analyze with the local Toss fixture", () => {
    it("skips when the uncommitted fixture is unavailable", () => undefined);
  });
}
