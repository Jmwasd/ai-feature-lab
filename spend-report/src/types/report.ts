import type { Transaction } from "./transaction";

const CATEGORIES = [
  "식비",
  "카페",
  "배달",
  "식료품",
  "생활",
  "교통",
  "숙박",
  "문화",
  "의료",
  "수수료/기타",
  "미분류",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SELECTABLE_CATEGORIES = CATEGORIES.filter(
  (category): category is Exclude<Category, "미분류"> => category !== "미분류",
);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((category) => category === value);
}

/** 분류가 어디서 나왔는지. 리포트에서 신뢰도 표시에 쓴다. */
export type CategorySource = "memo" | "rule" | "llm" | "user" | "none";

/** 사용자 보정 (DESIGN.md 4.5). */
export interface Override {
  category?: Category;
  /** true면 소비가 아닌 항목으로 리포트에서 제외한다. */
  excluded?: boolean;
}

export interface ClassifiedTx extends Transaction {
  category: Category;
  categorySource: CategorySource;
  /** PG 적요는 메모 기반 이름으로 치환한다 (DESIGN.md 5.2). */
  displayName: string;
  isPg: boolean;
  /** 취소 쌍 상대 거래의 id. */
  cancelledWith?: string;
  /** 이벤트 묶음 키. 예: "제주". */
  eventKey?: string;
}

export interface Report {
  period: { from: Date; to: Date; days: number };
  /** 헤더의 조회기간. 파일에 없을 수 있다. */
  queryPeriod?: { from: Date; to: Date };
  totalSpend: number;
  spendCount: number;
  /** 취소 쌍으로 제외한 양쪽 거래의 건수와 결제 금액. */
  excludedCancels: { count: number; amount: number };
  byCategory: Array<{ category: Category; amount: number; count: number }>;
  repeats: Array<{ displayName: string; count: number; amount: number }>;
  events: Array<{ key: string; count: number; amount: number; ratio: number }>;
  concentration: {
    topN: number;
    amount: number;
    ratio: number;
    items: ClassifiedTx[];
  };
  unclassified: { count: number; amount: number; ratio: number };
  /** 출금과 고액 미상세 거래 (DESIGN.md 4.5). */
  needsInput: ClassifiedTx[];
  /** 기간 한계 등 사용자 고지 문구. */
  notes: string[];
}
