import { describe, expect, it } from "vitest";

import { findCancelPairs } from "./cancel";
import { groupEvents } from "./events";
import { loadSampleCsv } from "./__fixtures__/load";
import { parseTossCsv } from "./parse";
import type { Transaction } from "../types/transaction";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    at: new Date("2026-08-12T20:00:00"),
    description: "테스트 가맹점",
    kind: "체크카드결제",
    amount: -10000,
    memo: "",
    balanceAfter: 0,
    ...overrides,
  };
}

describe("groupEvents", () => {
  it("groups typo-tolerant location substrings into one event", () => {
    const events = groupEvents([
      transaction({ id: "jeju-island", memo: "제주도 2일 숙박비", amount: -120000 }),
      transaction({
        id: "jeju-typo",
        at: new Date("2026-08-12T21:00:00"),
        memo: "제주고 1일 숙박비",
        amount: -50000,
      }),
    ]);

    expect(events).toEqual([
      { key: "제주", txIds: ["jeju-island", "jeju-typo"], amount: 170000 },
    ]);
  });

  it("does not create an event from a keyword found in only one transaction", () => {
    const events = groupEvents([
      transaction({ id: "busan", memo: "부산 숙소", amount: -10000 }),
      transaction({
        id: "daegu",
        at: new Date("2026-08-13T20:00:00"),
        memo: "대구 항공권",
        amount: -20000,
      }),
    ]);

    expect(events).toEqual([]);
  });

  it("does not absorb a nearby transaction beyond five minutes", () => {
    const events = groupEvents([
      transaction({ id: "jeju-stay", memo: "제주 숙박비", amount: -100000 }),
      transaction({
        id: "jeju-flight",
        at: new Date("2026-08-12T20:02:00"),
        memo: "제주 항공권",
        amount: -200000,
      }),
      transaction({
        id: "nearby-fee",
        at: new Date("2026-08-12T20:04:00"),
        memo: "예약 대행수수료",
        amount: -2000,
      }),
      transaction({
        id: "late-fee",
        at: new Date("2026-08-12T20:07:01"),
        memo: "예약 대행수수료",
        amount: -2000,
      }),
    ]);

    expect(events).toEqual([
      {
        key: "제주",
        txIds: ["jeju-stay", "jeju-flight", "nearby-fee"],
        amount: 302000,
      },
    ]);
  });
});

const sampleCsv = loadSampleCsv();

if (sampleCsv) {
  describe("groupEvents with the local Toss fixture", () => {
    const transactions = parseTossCsv(sampleCsv).transactions;
    const cancelledIds = new Set(
      findCancelPairs(transactions).flatMap((pair) => [pair.paymentId, pair.cancelId]),
    );
    const spendingTransactions = transactions.filter(
      (transaction) =>
        (transaction.kind === "체크카드결제" || transaction.kind === "출금") &&
        transaction.amount < 0 &&
        !cancelledIds.has(transaction.id),
    );
    const events = groupEvents(spendingTransactions);

    it("groups the Jeju event into seven transactions totaling 782,430 won", () => {
      expect(events).toContainEqual({
        key: "제주",
        txIds: expect.any(Array),
        amount: 782430,
      });

      expect(events.find((event) => event.key === "제주")?.txIds).toHaveLength(7);
    });

    it("does not include a cancelled Uljin rental in an event", () => {
      expect(events.some((event) => event.key.includes("울진"))).toBe(false);
    });

    it("absorbs both nearby Nol Universe booking fees into the Jeju event", () => {
      const jejuEvent = events.find((event) => event.key === "제주");
      const nolUniverseIds = spendingTransactions
        .filter((transaction) => transaction.description.includes("놀유니버스"))
        .map((transaction) => transaction.id);

      expect(nolUniverseIds).toHaveLength(2);
      expect(jejuEvent?.txIds).toEqual(expect.arrayContaining(nolUniverseIds));
    });
  });
} else {
  describe.skip("groupEvents with the local Toss fixture", () => {
    it("skips when the uncommitted fixture is unavailable", () => undefined);
  });
}
