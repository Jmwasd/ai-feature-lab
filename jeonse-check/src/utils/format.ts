// 화면에 쓰는 금액·비율 포맷터. 도메인과 무관한 순수 함수만 둔다.

const MAN = 10_000;
const EOK_IN_MAN = 10_000;
const grouping = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/**
 * 원 단위 금액을 억·만 단위로 쓴다. 예: 280,000,000 → "2억 8,000만", 55,000,000 → "5,500만", 0 → "0원".
 *
 * 1만 원 미만은 버리지 않고 **만 원 단위로 반올림**한다(5,000원 이상 올림).
 * 예: 55,005,000 → "5,501만", 4,999 → "0원", 5,000 → "1만".
 *
 * @throws {RangeError} 음수, NaN, 무한대
 */
export function formatWon(amount: number): string {
  assertNonNegative(amount, "amount");
  const totalMan = Math.round(amount / MAN);
  const eok = Math.floor(totalMan / EOK_IN_MAN);
  const man = totalMan % EOK_IN_MAN;

  const parts: string[] = [];
  if (eok > 0) parts.push(`${grouping.format(eok)}억`);
  if (man > 0) parts.push(`${grouping.format(man)}만`);
  return parts.length > 0 ? parts.join(" ") : "0원";
}

/**
 * 비율을 소수 첫째 자리까지의 퍼센트로 쓴다. 끝자리 0은 생략한다. 예: 0.745 → "74.5%", 0.7 → "70%".
 *
 * @throws {RangeError} 음수, NaN, 무한대
 */
export function formatPercent(ratio: number): string {
  assertNonNegative(ratio, "ratio");
  return `${Math.round(ratio * 1000) / 10}%`;
}

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name}는 0 이상의 유한한 수여야 합니다: ${value}`);
  }
}
