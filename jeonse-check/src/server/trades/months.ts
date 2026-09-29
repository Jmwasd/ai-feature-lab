import "server-only";

// 계약월(DEAL_YMD, YYYYMM) 범위 유틸. 날짜는 price-estimate와 같이 UTC 기준으로 다룬다.

const YMD_PATTERN = /^\d{4}(0[1-9]|1[0-2])$/;

/** from~to(양 끝 포함) 계약월을 오름차순으로 돌려준다. */
export function monthRange(from: string, to: string): string[] {
  for (const ymd of [from, to]) {
    if (!YMD_PATTERN.test(ymd)) throw new RangeError(`계약월은 YYYYMM이어야 한다: ${ymd}`);
  }
  if (from > to) throw new RangeError(`from(${from})이 to(${to})보다 뒤다`);

  const months: string[] = [];
  let index = monthIndex(from);
  const last = monthIndex(to);
  for (; index <= last; index += 1) months.push(ymdOf(index));
  return months;
}

/** asOf가 속한 달을 포함해 거슬러 올라간 months개 계약월을 오름차순으로 돌려준다. */
export function lookbackMonths(asOf: Date, months: number): string[] {
  if (!Number.isInteger(months) || months < 1) {
    throw new RangeError(`months는 1 이상 정수여야 한다: ${months}`);
  }
  const last = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  return monthRange(ymdOf(last - months + 1), ymdOf(last));
}

// 0년 1월부터 센 월 번호
function monthIndex(ymd: string): number {
  return Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(4, 6)) - 1;
}

function ymdOf(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}${String(month).padStart(2, "0")}`;
}
