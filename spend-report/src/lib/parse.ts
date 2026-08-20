import type { Transaction } from "../types/transaction";

export interface ParseResult {
  transactions: Transaction[];
  queryPeriod: { from: Date; to: Date } | null;
}

type CsvRow = string[];

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

/** 토스뱅크 거래내역 CSV 원문 → 거래 배열 */
export function parseTossCsv(csv: string): ParseResult {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim() === "거래 일시"));

  if (headerIndex === -1) {
    throw new Error("거래 일시 헤더를 찾을 수 없습니다.");
  }

  const columnIndexes = indexColumns(rows[headerIndex]);
  const queryPeriod = findQueryPeriod(rows.slice(0, headerIndex));
  const transactions = rows.slice(headerIndex + 1).flatMap((row, dataIndex) => {
    const at = parseTransactionDate(readColumn(row, columnIndexes, "거래 일시"));

    if (!at) {
      return [];
    }

    return [
      {
        id: `tx-${dataIndex + 1}`,
        at,
        description: readColumn(row, columnIndexes, "적요"),
        kind: readColumn(row, columnIndexes, "거래 유형"),
        amount: parseAmount(readColumn(row, columnIndexes, "거래 금액"), "거래 금액"),
        memo: readColumn(row, columnIndexes, "메모"),
        balanceAfter: parseAmount(readColumn(row, columnIndexes, "거래 후 잔액"), "거래 후 잔액"),
      } satisfies Transaction,
    ];
  });

  return { transactions, queryPeriod };
}

function parseCsv(csv: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let value = "";
  let isQuoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (isQuoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (character === "," && !isQuoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !isQuoted) {
      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function indexColumns(header: CsvRow): Map<string, number> {
  const indexes = new Map<string, number>();

  header.forEach((cell, index) => {
    indexes.set(cell.trim().replace(/^\uFEFF/, ""), index);
  });

  for (const requiredColumn of ["거래 일시", "적요", "거래 유형", "거래 금액", "거래 후 잔액", "메모"]) {
    if (!indexes.has(requiredColumn)) {
      throw new Error(`필수 컬럼이 없습니다: ${requiredColumn}`);
    }
  }

  return indexes;
}

function readColumn(row: CsvRow, indexes: Map<string, number>, column: string): string {
  return row[indexes.get(column)!]?.trim() ?? "";
}

function parseTransactionDate(value: string): Date | null {
  const match = value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  return createDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  });
}

function findQueryPeriod(rows: CsvRow[]): ParseResult["queryPeriod"] {
  for (const row of rows) {
    const periodLabelIndex = row.findIndex((cell) => cell.trim() === "조회기간");

    if (periodLabelIndex === -1) {
      continue;
    }

    const periodText = row.slice(periodLabelIndex + 1).join(" ");
    const match = periodText.match(
      /(\d{4})\.(\d{1,2})\.(\d{1,2})\s*-\s*(\d{4})\.(\d{1,2})\.(\d{1,2})/,
    );

    if (!match) {
      continue;
    }

    const from = createDate({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
    const to = createDate({ year: Number(match[4]), month: Number(match[5]), day: Number(match[6]) });

    if (from && to) {
      return { from, to };
    }
  }

  return null;
}

function createDate({ year, month, day, hour = 0, minute = 0, second = 0 }: DateParts): Date | null {
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date;
}

function parseAmount(value: string, column: string): number {
  const normalized = value.replaceAll(",", "").replaceAll(" ", "");
  const amount = Number(normalized);

  if (!Number.isInteger(amount)) {
    throw new Error(`${column} 값이 올바르지 않습니다.`);
  }

  return amount;
}
