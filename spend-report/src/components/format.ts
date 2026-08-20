export function formatCurrency(amount: number): string {
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.abs(amount))}`;
}

export function formatCount(count: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(count)}건`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(date))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

export function formatPeriod(from: Date, to: Date): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}
