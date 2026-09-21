const countFormatter = new Intl.NumberFormat("en-US");

export function formatCount(n: number): string {
  return countFormatter.format(n);
}

export function formatSigned(n: number, sign: "+" | "−"): string {
  return `${sign}${formatCount(n)}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${iso.slice(11, 16)}`;
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatPeriod(firstIso: string, lastIso: string): string {
  const days = Math.floor((Date.parse(lastIso) - Date.parse(firstIso)) / 86_400_000);
  return days < 30 ? `${formatCount(days)}일` : `${formatCount(Math.floor(days / 30))}개월`;
}

export function formatContributors(top: string, count: number): string {
  return count === 1 ? top : `${top} 외 ${formatCount(count - 1)}명`;
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
