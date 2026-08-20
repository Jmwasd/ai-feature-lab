import { findCancelPairs } from "./cancel";
import { categorize } from "./categorize";
import { groupEvents } from "./events";
import type { Category, ClassifiedTx, Override, Report } from "../types/report";
import type { Transaction } from "../types/transaction";

interface AnalyzeOptions {
  queryPeriod?: { from: Date; to: Date } | null;
  llmCategories?: Record<string, Category>;
  overrides?: Record<string, Override>;
}

interface RepeatGroup {
  displayName: string;
  count: number;
  amount: number;
}

const REPEAT_THRESHOLD_DAYS = 30;
const CONCENTRATION_SIZE = 3;

/** 파이프라인 전체를 묶어 리포트를 만든다. 서버와 클라이언트 양쪽에서 호출된다. */
export function analyze(txs: Transaction[], opts: AnalyzeOptions): Report {
  const cancelPairs = findCancelPairs(txs);
  const cancelledWith = cancelledTransactionMap(cancelPairs);
  const cancelledIds = new Set(cancelledWith.keys());
  const period = derivePeriod(txs, opts.queryPeriod ?? null);
  const repeatPeriodDays = opts.queryPeriod
    ? calendarDays(opts.queryPeriod.from, opts.queryPeriod.to)
    : period.days;

  const classifiedCandidates = txs
    .filter(isSpendingTransaction)
    .filter((transaction) => !cancelledIds.has(transaction.id))
    .map((transaction) => classify(transaction, cancelledWith, opts));
  const spending = classifiedCandidates.filter((transaction) => !opts.overrides?.[transaction.id]?.excluded);
  const events = groupEvents(spending);
  const spendingWithEventKeys = attachEventKeys(spending, events);
  const totalSpend = sumAmounts(spendingWithEventKeys);
  const concentrationItems = sortByAmount(spendingWithEventKeys).slice(0, CONCENTRATION_SIZE);

  return {
    period,
    ...(opts.queryPeriod ? { queryPeriod: cloneRange(opts.queryPeriod) } : {}),
    totalSpend,
    spendCount: spendingWithEventKeys.length,
    excludedCancels: {
      count: cancelPairs.length,
      amount: cancelPairs.reduce((sum, pair) => sum + pair.amount, 0),
    },
    byCategory: summarizeCategories(spendingWithEventKeys),
    repeats: summarizeRepeats(spendingWithEventKeys, repeatPeriodDays),
    events: events.map((event) => ({
      key: event.key,
      count: event.txIds.length,
      amount: event.amount,
      ratio: ratio(event.amount, totalSpend),
    })),
    concentration: {
      topN: concentrationItems.length,
      amount: sumAmounts(concentrationItems),
      ratio: ratio(sumAmounts(concentrationItems), totalSpend),
      items: concentrationItems,
    },
    unclassified: summarizeUnclassified(spendingWithEventKeys),
    needsInput: collectNeedsInput(classifiedCandidates, concentrationItems),
    notes:
      repeatPeriodDays < REPEAT_THRESHOLD_DAYS
        ? ["조회기간이 30일 미만이라 반복 결제 탐지 불가: 3개월 이상 기간을 권장합니다."]
        : [],
  };
}

function isSpendingTransaction(transaction: Transaction): boolean {
  return (
    (transaction.kind === "체크카드결제" || transaction.kind === "출금") && transaction.amount < 0
  );
}

function classify(
  transaction: Transaction,
  cancelledWith: ReadonlyMap<string, string>,
  opts: AnalyzeOptions,
): ClassifiedTx {
  const categorized = categorize(transaction);
  const llmCategory =
    categorized.category === "미분류" && !categorized.isPg
      ? opts.llmCategories?.[transaction.description]
      : undefined;
  const overrideCategory = opts.overrides?.[transaction.id]?.category;

  return {
    ...transaction,
    category: overrideCategory ?? llmCategory ?? categorized.category,
    categorySource: overrideCategory ? "user" : llmCategory ? "llm" : categorized.source,
    displayName: categorized.displayName,
    isPg: categorized.isPg,
    ...(cancelledWith.has(transaction.id) ? { cancelledWith: cancelledWith.get(transaction.id) } : {}),
  };
}

function cancelledTransactionMap(
  pairs: ReturnType<typeof findCancelPairs>,
): Map<string, string> {
  const cancelledWith = new Map<string, string>();

  for (const pair of pairs) {
    cancelledWith.set(pair.paymentId, pair.cancelId);
    cancelledWith.set(pair.cancelId, pair.paymentId);
  }

  return cancelledWith;
}

function attachEventKeys(
  transactions: ClassifiedTx[],
  events: ReturnType<typeof groupEvents>,
): ClassifiedTx[] {
  const eventKeys = new Map<string, string>();

  for (const event of events) {
    for (const txId of event.txIds) {
      eventKeys.set(txId, event.key);
    }
  }

  return transactions.map((transaction) => {
    const eventKey = eventKeys.get(transaction.id);
    return eventKey ? { ...transaction, eventKey } : transaction;
  });
}

function summarizeCategories(
  transactions: ClassifiedTx[],
): Report["byCategory"] {
  const categories = new Map<Category, { amount: number; count: number }>();

  for (const transaction of transactions) {
    const current = categories.get(transaction.category) ?? { amount: 0, count: 0 };
    current.amount += Math.abs(transaction.amount);
    current.count += 1;
    categories.set(transaction.category, current);
  }

  return [...categories.entries()]
    .map(([category, summary]) => ({ category, ...summary }))
    .sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category));
}

function summarizeRepeats(transactions: ClassifiedTx[], periodDays: number): RepeatGroup[] {
  const groups = new Map<string, ClassifiedTx[]>();

  for (const transaction of transactions) {
    if (transaction.isPg) {
      continue;
    }

    const group = groups.get(transaction.description) ?? [];
    group.push(transaction);
    groups.set(transaction.description, group);
  }

  return [...groups.values()]
    .filter(
      (group) =>
        group.length >= 3 || (group.length === 2 && periodDays >= REPEAT_THRESHOLD_DAYS),
    )
    .map((group) => ({
      displayName: group[0].displayName,
      count: group.length,
      amount: sumAmounts(group),
    }))
    .sort((left, right) => right.count - left.count || right.amount - left.amount || left.displayName.localeCompare(right.displayName));
}

function summarizeUnclassified(transactions: ClassifiedTx[]): Report["unclassified"] {
  const unclassified = transactions.filter((transaction) => transaction.category === "미분류");
  const amount = sumAmounts(unclassified);

  return { count: unclassified.length, amount, ratio: ratio(amount, sumAmounts(transactions)) };
}

function collectNeedsInput(
  candidates: ClassifiedTx[],
  concentrationItems: ClassifiedTx[],
): ClassifiedTx[] {
  const needsInput = new Map<string, ClassifiedTx>();

  for (const transaction of candidates) {
    if (transaction.kind === "출금" && !transaction.memo.trim()) {
      needsInput.set(transaction.id, transaction);
    }
  }

  for (const transaction of concentrationItems) {
    if (transaction.category === "미분류") {
      needsInput.set(transaction.id, transaction);
    }
  }

  return sortByAmount([...needsInput.values()]);
}

function sortByAmount(transactions: ClassifiedTx[]): ClassifiedTx[] {
  return [...transactions].sort(
    (left, right) =>
      Math.abs(right.amount) - Math.abs(left.amount) || left.id.localeCompare(right.id),
  );
}

function sumAmounts(transactions: ReadonlyArray<Pick<Transaction, "amount">>): number {
  return transactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

function ratio(amount: number, total: number): number {
  return total === 0 ? 0 : amount / total;
}

function derivePeriod(
  transactions: Transaction[],
  queryPeriod: AnalyzeOptions["queryPeriod"],
): Report["period"] {
  if (transactions.length === 0) {
    if (queryPeriod) {
      return { ...cloneRange(queryPeriod), days: calendarDays(queryPeriod.from, queryPeriod.to) };
    }

    const emptyDate = new Date(0);
    return { from: emptyDate, to: new Date(emptyDate), days: 0 };
  }

  const dates = transactions.map((transaction) => transaction.at.getTime());
  const from = new Date(Math.min(...dates));
  const to = new Date(Math.max(...dates));

  return { from, to, days: calendarDays(from, to) };
}

function cloneRange(range: { from: Date; to: Date }): { from: Date; to: Date } {
  return { from: new Date(range.from), to: new Date(range.to) };
}

function calendarDays(from: Date, to: Date): number {
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.max(0, Math.floor((toDay - fromDay) / 86400000) + 1);
}
