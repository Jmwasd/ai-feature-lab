import type { Category, CategorySource } from "../types/report";
import type { Transaction } from "../types/transaction";

export interface CategorizeResult {
  category: Category;
  source: CategorySource;
  displayName: string;
  isPg: boolean;
}

type CategoryRule = readonly [keyword: string, category: Category];

const MEMO_RULES: readonly CategoryRule[] = [
  ["숙박비", "숙박"],
  ["숙소", "숙박"],
  ["숙박", "숙박"],
  // 항공권 예약 대행수수료처럼 교통 키워드도 함께 쓸 수 있어 수수료를 먼저 확인한다.
  ["수수료", "수수료/기타"],
  ["대행료", "수수료/기타"],
  ["렌트", "교통"],
  ["항공권", "교통"],
  ["교통", "교통"],
  ["배달", "배달"],
  ["카페", "카페"],
  ["식료품", "식료품"],
  ["장보기", "식료품"],
  ["생활용품", "생활"],
  ["영화", "문화"],
  ["공연", "문화"],
  ["도서", "문화"],
  ["병원", "의료"],
  ["약국", "의료"],
  ["의료", "의료"],
  ["식사", "식비"],
  ["외식", "식비"],
  ["음식", "식비"],
];

const MERCHANT_RULES: readonly CategoryRule[] = [
  ["쿠팡이츠", "배달"],
  ["이마트", "식료품"],
  ["세계과자할인점", "식료품"],
  ["올리브영", "생활"],
  ["탐앤탐스", "카페"],
];

const PG_KEYWORDS = ["토스페이_toss", "토스페이", "엔에이치엔케이씨피", "nhn kcp", "kg이니시스", "나이스페이"];

/** 메모 → 적요 규칙 → 미분류. LLM 분류는 호출자가 별도로 적용한다. */
export function categorize(tx: Transaction): CategorizeResult {
  const memo = tx.memo.trim();
  const description = tx.description.trim();
  const isPg = isPaymentGateway(description);
  const displayName = memo ? `${memo} (${description})` : description;
  const memoCategory = findCategory(memo, MEMO_RULES);

  if (memoCategory) {
    return result(memoCategory, "memo", displayName, isPg);
  }

  if (!isPg) {
    const merchantCategory = findCategory(description, MERCHANT_RULES);

    if (merchantCategory) {
      return result(merchantCategory, "rule", displayName, false);
    }
  }

  return result("미분류", "none", displayName, isPg);
}

/** LLM에 보낼 미분류 카드 가맹점 적요 목록. 중복과 PG·비가맹점 거래는 제외한다. */
export function collectUnclassified(txs: Transaction[]): string[] {
  const descriptions = new Set<string>();

  for (const tx of txs) {
    if (tx.kind !== "체크카드결제") {
      continue;
    }

    const categorized = categorize(tx);

    if (categorized.category !== "미분류" || categorized.isPg) {
      continue;
    }

    const description = tx.description.trim();

    if (description) {
      descriptions.add(description);
    }
  }

  return [...descriptions];
}

function findCategory(value: string, rules: readonly CategoryRule[]): Category | null {
  const normalized = value.toLowerCase();
  const rule = rules.find(([keyword]) => normalized.includes(keyword.toLowerCase()));

  return rule?.[1] ?? null;
}

function isPaymentGateway(description: string): boolean {
  const normalized = description.toLowerCase();

  return PG_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function result(
  category: Category,
  source: CategorySource,
  displayName: string,
  isPg: boolean,
): CategorizeResult {
  return { category, source, displayName, isPg };
}
