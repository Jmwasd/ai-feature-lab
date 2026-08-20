import type { Transaction } from "../types/transaction";

export interface EventGroup {
  key: string;
  txIds: string[];
  amount: number;
}

interface EventCandidate {
  key: string;
  txIds: Set<string>;
}

const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
const MIN_KEYWORD_LENGTH = 2;

/**
 * 지명·고유명사 대신 거래 성격을 이벤트로 오인하지 않도록 제외하는 메모 조각.
 * 이벤트 키를 보수적으로 남겨, 모르는 것은 이벤트로 만들지 않는다.
 */
const GENERIC_EVENT_FRAGMENTS = [
  "숙박비",
  "숙박",
  "숙소",
  "항공권예약",
  "항공권",
  "항공",
  "렌트카비",
  "렌트카",
  "렌트",
  "대행수수료",
  "수수료",
  "대행",
  "예약",
  "여행",
  "왕복",
  "비용",
  "생활비",
  "카드",
  "결제",
  "입금",
  "출금",
  "교통",
  "식사",
  "식비",
  "구매",
] as const;

/** 메모의 반복 키워드와 씨앗 거래 전후 5분 이내 거래를 이벤트로 묶는다. */
export function groupEvents(txs: Transaction[]): EventGroup[] {
  const candidates = collectRepeatedCandidates(txs);
  const assignedIds = new Set<string>();
  const events: EventGroup[] = [];

  for (const candidate of candidates) {
    const seedTransactions = txs.filter(
      (transaction) => candidate.txIds.has(transaction.id) && !assignedIds.has(transaction.id),
    );

    if (seedTransactions.length < 2) {
      continue;
    }

    const eventTransactions = txs.filter(
      (transaction) =>
        !assignedIds.has(transaction.id) &&
        seedTransactions.some(
          (seed) => Math.abs(transaction.at.getTime() - seed.at.getTime()) <= FIVE_MINUTES_IN_MS,
        ),
    );

    for (const transaction of eventTransactions) {
      assignedIds.add(transaction.id);
    }

    events.push({
      key: candidate.key,
      txIds: eventTransactions.map((transaction) => transaction.id),
      amount: eventTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    });
  }

  return events;
}

function collectRepeatedCandidates(txs: Transaction[]): EventCandidate[] {
  const candidates = new Map<string, EventCandidate>();

  for (const transaction of txs) {
    for (const key of memoKeywordFragments(transaction.memo)) {
      const normalizedKey = key.toLocaleLowerCase();
      const candidate = candidates.get(normalizedKey) ?? { key, txIds: new Set<string>() };

      candidate.txIds.add(transaction.id);
      candidates.set(normalizedKey, candidate);
    }
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.txIds.size >= 2)
    .sort(
      (left, right) =>
        right.txIds.size - left.txIds.size || right.key.length - left.key.length || left.key.localeCompare(right.key),
    );
}

function memoKeywordFragments(memo: string): Set<string> {
  const fragments = new Set<string>();
  const runs = memo.match(/[가-힣A-Za-z]{2,}/g) ?? [];

  for (const run of runs) {
    for (let start = 0; start <= run.length - MIN_KEYWORD_LENGTH; start += 1) {
      for (let end = start + MIN_KEYWORD_LENGTH; end <= run.length; end += 1) {
        const fragment = run.slice(start, end);

        if (isEventKeyword(fragment)) {
          fragments.add(fragment);
        }
      }
    }
  }

  return fragments;
}

function isEventKeyword(fragment: string): boolean {
  const normalized = fragment.toLocaleLowerCase();

  return !GENERIC_EVENT_FRAGMENTS.some((genericFragment) => {
    const normalizedGeneric = genericFragment.toLocaleLowerCase();
    return normalized.includes(normalizedGeneric) || normalizedGeneric.includes(normalized);
  });
}
