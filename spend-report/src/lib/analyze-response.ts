import { isCategory, type Category } from "../types/report";
import type { Transaction } from "../types/transaction";

export interface AnalyzeResponse {
  transactions: Transaction[];
  queryPeriod: { from: Date; to: Date } | null;
  llmCategories: Record<string, Category>;
  summary: string | null;
}

interface AnalyzeResponsePayload {
  transactions: unknown[];
  queryPeriod: unknown;
  llmCategories: Record<string, unknown>;
  summary: string | null;
}

interface TransactionPayload {
  id: string;
  at: string;
  description: string;
  kind: string;
  amount: number;
  memo: string;
  balanceAfter: number;
}

export function parseAnalyzeResponse(value: unknown): AnalyzeResponse | null {
  const payload = parsePayload(value);

  if (!payload) {
    return null;
  }

  const transactions = parseTransactions(payload.transactions);
  const llmCategories = parseLlmCategories(payload.llmCategories);

  if (!transactions || !llmCategories) {
    return null;
  }

  return {
    transactions,
    queryPeriod: parseDateRange(payload.queryPeriod),
    llmCategories,
    summary: payload.summary,
  };
}

export function responseError(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "파일 분석 중 오류가 발생했습니다.";
}

function parsePayload(value: unknown): AnalyzeResponsePayload | null {
  if (
    !isRecord(value) ||
    !isRecord(value.report) ||
    !Array.isArray(value.transactions) ||
    !isRecord(value.llmCategories) ||
    (value.summary !== null && typeof value.summary !== "string")
  ) {
    return null;
  }

  return {
    transactions: value.transactions,
    queryPeriod: value.queryPeriod,
    llmCategories: value.llmCategories,
    summary: value.summary,
  };
}

function parseTransactions(values: unknown[]): Transaction[] | null {
  const transactions = values.map(parseTransaction);

  return transactions.every(isTransaction) ? transactions : null;
}

function parseTransaction(value: unknown): Transaction | null {
  if (!hasTransactionFields(value)) {
    return null;
  }

  const at = parseDate(value.at);

  return at
    ? {
        id: value.id,
        at,
        description: value.description,
        kind: value.kind,
        amount: value.amount,
        memo: value.memo,
        balanceAfter: value.balanceAfter,
      }
    : null;
}

function hasTransactionFields(value: unknown): value is TransactionPayload {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "at", "description", "kind", "memo"]) &&
    hasNumberFields(value, ["amount", "balanceAfter"])
  );
}

function hasStringFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function hasNumberFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "number");
}

function parseDateRange(value: unknown): { from: Date; to: Date } | null {
  if (!isRecord(value)) {
    return null;
  }

  const from = parseDate(value.from);
  const to = parseDate(value.to);

  return from && to ? { from, to } : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLlmCategories(value: Record<string, unknown>): Record<string, Category> | null {
  const entries = Object.entries(value);

  return entries.every(([, category]) => isCategory(category))
    ? Object.fromEntries(entries) as Record<string, Category>
    : null;
}

function isTransaction(value: Transaction | null): value is Transaction {
  return value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
