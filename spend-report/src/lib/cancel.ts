import type { Transaction } from "../types/transaction";

export interface CancelPair {
  paymentId: string;
  cancelId: string;
  amount: number;
}

interface IndexedTransaction {
  transaction: Transaction;
  index: number;
}

/** 취소 쌍을 찾아 양쪽 거래 id를 돌려준다. 원본 배열을 변형하지 마라. */
export function findCancelPairs(txs: Transaction[]): CancelPair[] {
  const cardPayments = txs.reduce<IndexedTransaction[]>((payments, transaction, index) => {
    if (transaction.kind === "체크카드결제" && transaction.amount < 0) {
      payments.push({ transaction, index });
    }
    return payments;
  }, []);
  const cancellations = txs
    .reduce<IndexedTransaction[]>((candidates, transaction, index) => {
      if (transaction.kind === "체크카드결제" && transaction.amount > 0) {
        candidates.push({ transaction, index });
      }
      return candidates;
    }, [])
    .sort(
      (left, right) =>
        left.transaction.at.getTime() - right.transaction.at.getTime() || left.index - right.index,
    );
  const consumedPaymentIndexes = new Set<number>();
  const pairs: CancelPair[] = [];

  for (const cancellation of cancellations) {
    const payment = findClosestPriorPayment(cardPayments, cancellation, consumedPaymentIndexes);

    if (!payment) {
      continue;
    }

    consumedPaymentIndexes.add(payment.index);
    pairs.push({
      paymentId: payment.transaction.id,
      cancelId: cancellation.transaction.id,
      amount: cancellation.transaction.amount,
    });
  }

  return pairs;
}

function findClosestPriorPayment(
  payments: IndexedTransaction[],
  cancellation: IndexedTransaction,
  consumedPaymentIndexes: Set<number>,
): IndexedTransaction | null {
  return payments
    .filter((payment) => isAvailablePriorMatch(payment, cancellation, consumedPaymentIndexes))
    .reduce(selectClosestPayment, null);
}

function isAvailablePriorMatch(
  payment: IndexedTransaction,
  cancellation: IndexedTransaction,
  consumedPaymentIndexes: Set<number>,
): boolean {
  return (
    !consumedPaymentIndexes.has(payment.index) &&
    hasMatchingCancellationKey(payment, cancellation) &&
    occurredBefore(payment, cancellation)
  );
}

function hasMatchingCancellationKey(
  payment: IndexedTransaction,
  cancellation: IndexedTransaction,
): boolean {
  return (
    payment.transaction.description === cancellation.transaction.description &&
    Math.abs(payment.transaction.amount) === cancellation.transaction.amount
  );
}

function occurredBefore(left: IndexedTransaction, right: IndexedTransaction): boolean {
  return left.transaction.at.getTime() < right.transaction.at.getTime();
}

function selectClosestPayment(
  closest: IndexedTransaction | null,
  payment: IndexedTransaction,
): IndexedTransaction {
  if (!closest || payment.transaction.at.getTime() > closest.transaction.at.getTime()) {
    return payment;
  }

  return payment.transaction.at.getTime() === closest.transaction.at.getTime() && payment.index > closest.index
    ? payment
    : closest;
}
