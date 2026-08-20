import { describe, expect, it } from "vitest";

import { loadSampleCsv } from "./__fixtures__/load";
import { categorize, collectUnclassified } from "./categorize";
import { parseTossCsv } from "./parse";
import type { Transaction } from "../types/transaction";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    at: new Date("2026-08-12T20:08:19"),
    description: "테스트 가맹점",
    kind: "체크카드결제",
    amount: -10000,
    memo: "",
    balanceAfter: 0,
    ...overrides,
  };
}

describe("categorize", () => {
  it("uses a matching memo before the merchant rule", () => {
    const result = categorize(
      transaction({ description: "쿠팡이츠", memo: "제주도 2일 숙박비" }),
    );

    expect(result).toMatchObject({
      category: "숙박",
      source: "memo",
      displayName: "제주도 2일 숙박비 (쿠팡이츠)",
      isPg: false,
    });
  });

  it("treats an explicit fee memo as a fee even when it also mentions a flight", () => {
    expect(categorize(transaction({ memo: "항공권예약 대행수수료" }))).toMatchObject({
      category: "수수료/기타",
      source: "memo",
    });
  });

  it("classifies known merchants with the rule dictionary", () => {
    expect(categorize(transaction({ description: "쿠팡이츠" }))).toMatchObject({
      category: "배달",
      source: "rule",
    });
    expect(categorize(transaction({ description: "(주)이마트 구로점" }))).toMatchObject({
      category: "식료품",
      source: "rule",
    });
    expect(categorize(transaction({ description: "세계과자할인점" }))).toMatchObject({
      category: "식료품",
      source: "rule",
    });
    expect(categorize(transaction({ description: "씨제이올리브영(주)신림중앙점" }))).toMatchObject({
      category: "생활",
      source: "rule",
    });
    expect(categorize(transaction({ description: "탐앤탐스삼모타워신림역점" }))).toMatchObject({
      category: "카페",
      source: "rule",
    });
  });

  it.each(["막불감동", "영광과일", "열매상회", "신주옥미 신림역점"])(
    "leaves an unknown merchant unclassified: %s",
    (description) => {
      expect(categorize(transaction({ description }))).toMatchObject({
        category: "미분류",
        source: "none",
        isPg: false,
      });
    },
  );

  it("does not apply merchant rules to a PG description without a memo", () => {
    expect(categorize(transaction({ description: "토스페이_TOSS" }))).toEqual({
      category: "미분류",
      source: "none",
      displayName: "토스페이_TOSS",
      isPg: true,
    });
  });
});

describe("collectUnclassified", () => {
  it("returns unique, unclassified card merchant descriptions without amounts or non-merchant data", () => {
    const candidates = collectUnclassified([
      transaction({ id: "unknown-1", description: "막불감동", amount: -12345 }),
      transaction({ id: "unknown-2", description: "막불감동", amount: -67890 }),
      transaction({ id: "classified", description: "쿠팡이츠", amount: -39000 }),
      transaction({ id: "pg", description: "토스페이_TOSS", amount: -71300 }),
      transaction({
        id: "cash-with-name",
        kind: "출금",
        description: "가상의개인",
        amount: -6000,
      }),
    ]);

    expect(candidates).toEqual(["막불감동"]);
    expect(candidates.every((candidate) => typeof candidate === "string")).toBe(true);
    expect(candidates.join(" ")).not.toContain("12345");
    expect(candidates.join(" ")).not.toContain("67890");
    expect(candidates.join(" ")).not.toContain("가상의개인");
  });
});

const sampleCsv = loadSampleCsv();

if (sampleCsv) {
  describe("categorize with the local Toss fixture", () => {
    const transactions = parseTossCsv(sampleCsv).transactions;

    it("uses a PG transaction memo to classify lodging and form its display name", () => {
      const kcpTransaction = transactions.find(
        (candidate) => candidate.description.includes("엔에이치엔케이씨피") && candidate.memo.includes("숙박비"),
      );

      expect(kcpTransaction).toBeDefined();
      expect(categorize(kcpTransaction!)).toEqual({
        category: "숙박",
        source: "memo",
        displayName: `${kcpTransaction!.memo} (${kcpTransaction!.description})`,
        isPg: true,
      });
    });
  });
} else {
  describe.skip("categorize with the local Toss fixture", () => {
    it("skips when the uncommitted fixture is unavailable", () => undefined);
  });
}
