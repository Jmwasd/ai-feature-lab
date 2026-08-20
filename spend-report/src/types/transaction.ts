/** 거래 유형 — 파일의 `거래 유형` 컬럼 원값. 카테고리가 아니다 (DESIGN.md 2.3) */
export type TxKind =
  | "체크카드결제"
  | "출금"
  | "입금"
  | "모임원송금"
  | "프로모션입금"
  | "이자입금"
  | string;

export interface Transaction {
  /** 안정적 식별자. 행 순번 기반으로 생성한다. */
  id: string;
  /** `2026.08.14 20:32:16` 파싱 결과. */
  at: Date;
  /** 적요 원문. */
  description: string;
  /** 거래 유형 원값. */
  kind: TxKind;
  /** 음수는 출금이며, 원 단위 정수다. */
  amount: number;
  /** 메모가 없으면 빈 문자열이다. */
  memo: string;
  balanceAfter: number;
}
