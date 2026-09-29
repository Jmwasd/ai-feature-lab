// 사용자가 쓴 금액 문자열을 원 단위 정수로 바꾼다. 도메인과 무관한 순수 함수다.

import { formatWon } from "./format";

const WON_PER_MAN = 10_000;
const MAN_PER_EOK = 10_000;
// 단위 없는 숫자는 만원으로 읽는다. 이 값(100억) 이상이면 원 단위로 쓴 것일 수 있어 모호하다.
const BARE_MAN_LIMIT = 1_000_000;

// "2억", "2.85억", "8000만", "8천만", "2억 8000만" (+ 선택적 "원"). 공백·쉼표는 미리 지운다.
const UNIT_PATTERN = /^(?:(\d+(?:\.\d{1,4})?)억)?(?:(\d+)(천)?만)?원?$/;

/**
 * 금액 입력을 원 단위 정수로 읽는다. 읽을 수 없거나 모호하면 `null`.
 *
 * - "2억 8000만", "2억 8천만", "2.8억", "8000만" → 단위대로
 * - "28000", "28,000" → 만원 단위(2억 8,000만)
 * - "280,000,000원" → 숫자 뒤에 "원"이 붙으면 원 단위
 * - "2억 8천"(천만인지 천원인지), 억 뒤 만 단위가 1억 이상, 만원 단위 소수 → `null`
 */
export function parseWonInput(text: string): number | null {
  const compact = text.replace(/[\s,]/g, "");
  if (compact === "") return null;

  if (/^\d+원$/.test(compact)) return toSafeInteger(Number(compact.slice(0, -1)));
  if (/^\d+$/.test(compact)) {
    const man = Number(compact);
    return man < BARE_MAN_LIMIT ? toSafeInteger(man * WON_PER_MAN) : null;
  }

  const match = UNIT_PATTERN.exec(compact);
  if (!match) return null;
  const [, eokText, manDigits, cheon] = match;
  if (eokText === undefined && manDigits === undefined) return null;

  // 억의 소수 넷째 자리까지는 만원 단위 정수가 된다. 부동소수 오차는 반올림으로 없앤다.
  const eokInMan = eokText === undefined ? 0 : Math.round(Number(eokText) * MAN_PER_EOK);
  const man = manDigits === undefined ? 0 : Number(manDigits) * (cheon ? 1_000 : 1);
  if (eokText !== undefined && man >= MAN_PER_EOK) return null;

  return toSafeInteger((eokInMan + man) * WON_PER_MAN);
}

function toSafeInteger(value: number): number | null {
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * 원 단위 금액을 금액 입력창에 채울 문자열로 되돌린다. `parseWonInput`으로 다시 읽으면 같은 금액이 된다.
 * 만원 단위로 떨어지면 "2억 8,000만", 아니면(0 포함) "12345원"처럼 원 단위 그대로 쓴다.
 */
export function wonToInputText(amount: number): string {
  return amount > 0 && amount % WON_PER_MAN === 0 ? formatWon(amount) : `${amount}원`;
}
