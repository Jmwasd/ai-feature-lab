import { describe, expect, it } from "vitest";

import { loadSampleCsv } from "./__fixtures__/load";
import { parseTossCsv } from "./parse";

function expectDateParts(
  actual: Date,
  expected: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
) {
  expect(actual.getFullYear()).toBe(expected.year);
  expect(actual.getMonth() + 1).toBe(expected.month);
  expect(actual.getDate()).toBe(expected.day);
  expect(actual.getHours()).toBe(expected.hour ?? 0);
  expect(actual.getMinutes()).toBe(expected.minute ?? 0);
  expect(actual.getSeconds()).toBe(expected.second ?? 0);
}

function buildCsvWithPreamble(lineCount: number): string {
  const preamble = Array.from({ length: lineCount }, (_, index) => `안내 ${index + 1}`).join("\n");

  return `${preamble}\n,거래 일시,적요,거래 유형,거래 기관,계좌번호,거래 금액,거래 후 잔액,메모\n,2026.08.14 20:32:16,테스트 가맹점,체크카드결제,,****-1234,"-39,000","6,769,423",`;
}

describe("parseTossCsv", () => {
  it.each([6, 10])("finds the header after %i preamble rows", (preambleLineCount) => {
    const result = parseTossCsv(buildCsvWithPreamble(preambleLineCount));

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      description: "테스트 가맹점",
      kind: "체크카드결제",
      amount: -39000,
      memo: "",
      balanceAfter: 6769423,
    });
    expectDateParts(result.transactions[0].at, {
      year: 2026,
      month: 8,
      day: 14,
      hour: 20,
      minute: 32,
      second: 16,
    });
  });

  it("preserves commas, line breaks, and escaped quotes inside quoted fields", () => {
    const csv = [
      ",거래 일시,적요,거래 유형,거래 기관,계좌번호,거래 금액,거래 후 잔액,메모",
      ',2026.08.14 20:32:16,"복합, 가맹점",체크카드결제,,,"-1,000","6,769,423","첫 줄',
      '둘째 ""메모"""',
    ].join("\r\n");

    const [transaction] = parseTossCsv(csv).transactions;

    expect(transaction).toMatchObject({
      description: "복합, 가맹점",
      amount: -1000,
      balanceAfter: 6769423,
      memo: '첫 줄\r\n둘째 "메모"',
    });
  });
});

const sampleCsv = loadSampleCsv();

if (sampleCsv) {
  describe("parseTossCsv with the local Toss fixture", () => {
    const result = parseTossCsv(sampleCsv);

    it("parses all 34 data rows after the ninth-row header", () => {
      expect(sampleCsv.split(/\r?\n/)[8]).toContain("거래 일시");
      expect(result.transactions).toHaveLength(34);
      expect(result.transactions.every((transaction) => transaction.description.length > 0)).toBe(true);
    });

    it("preserves the transaction kind distribution without treating it as a category", () => {
      const kindCounts = result.transactions.reduce<Record<string, number>>((counts, transaction) => {
        counts[transaction.kind] = (counts[transaction.kind] ?? 0) + 1;
        return counts;
      }, {});

      expect(kindCounts).toEqual({
        체크카드결제: 25,
        입금: 3,
        출금: 2,
        프로모션입금: 2,
        모임원송금: 1,
        이자입금: 1,
      });
    });

    it("normalizes a dotted timestamp and signed comma-formatted amount", () => {
      const timestampedTransaction = result.transactions.find(
        (candidate) =>
          candidate.at.getFullYear() === 2026 &&
          candidate.at.getMonth() === 7 &&
          candidate.at.getDate() === 14 &&
          candidate.at.getHours() === 20 &&
          candidate.at.getMinutes() === 32 &&
          candidate.at.getSeconds() === 16,
      );
      const commaFormattedAmountTransaction = result.transactions.find(
        (candidate) => candidate.amount === -39000,
      );

      expect(timestampedTransaction).toBeDefined();
      expect(commaFormattedAmountTransaction?.amount).toBe(-39000);
      expectDateParts(timestampedTransaction!.at, {
        year: 2026,
        month: 8,
        day: 14,
        hour: 20,
        minute: 32,
        second: 16,
      });
    });

    it("extracts the query period without retaining name or account-number header metadata", () => {
      expect(result.queryPeriod).not.toBeNull();
      expectDateParts(result.queryPeriod!.from, { year: 2026, month: 8, day: 1 });
      expectDateParts(result.queryPeriod!.to, { year: 2026, month: 8, day: 15 });

      // 실명·계좌번호를 테스트에 적지 않는다. 픽스처 헤더에서 뽑아 쓴다 (ADR-010)
      const headerLines = sampleCsv.split(/\r?\n/).slice(0, 8);
      const headerValue = (label: string): string => {
        const line = headerLines.find((candidate) => candidate.includes(label));
        return line!.split(",")[2];
      };

      const accountHolder = headerValue("성명");
      const accountNumber = headerValue("계좌번호");

      expect(accountHolder.length).toBeGreaterThan(0);
      expect(accountNumber.length).toBeGreaterThan(0);

      const serializedResult = JSON.stringify(result);
      expect(serializedResult).not.toContain(accountHolder);
      expect(serializedResult).not.toContain(accountNumber);
    });
  });
} else {
  describe.skip("parseTossCsv with the local Toss fixture", () => {
    it("skips when the uncommitted fixture is unavailable", () => undefined);
  });
}
