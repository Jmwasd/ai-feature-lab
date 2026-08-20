import type { Report } from "../types/report";
import { formatCurrency, formatPercent } from "./format";

interface CategoryTableProps {
  report: Report;
}

const barColors = [
  "bg-blue",
  "bg-ink",
  "bg-line-dark",
  "bg-text-body",
  "bg-text-muted",
  "bg-text-ondark",
  "bg-ramp",
] as const;

function widthFor(amount: number, total: number): string {
  return `${total === 0 ? 0 : Math.round((amount / total) * 100)}%`;
}

export default function CategoryTable({ report }: CategoryTableProps) {
  return (
    <section className="mt-[72px]" aria-labelledby="category-title">
      <div className="flex items-baseline gap-3">
        <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">CATEGORIES</p>
        <h2 id="category-title" className="text-[36px] font-normal tracking-[-0.5px] text-ink">
          카테고리별 소비
        </h2>
      </div>
      <div className="mt-6 rounded-3xl border border-line p-8 sm:p-10">
        {report.byCategory.length > 0 ? (
          <div className="space-y-6">
            {report.byCategory.map((category, index) => {
              const ratio = report.totalSpend === 0 ? 0 : category.amount / report.totalSpend;
              const barColor = barColors[Math.min(index, barColors.length - 1)];

              return (
                <div key={category.category}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[15px] font-semibold text-ink">{category.category}</p>
                    <p className="shrink-0 font-mono text-[14px] font-medium tabular-nums text-text-body">
                      {formatCurrency(category.amount)} · {formatPercent(ratio)}
                    </p>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fill-quiet">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: widthFor(category.amount, report.totalSpend) }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[15px] leading-6 text-text-body">표시할 소비 항목이 없습니다.</p>
        )}
        <p className="mt-8 border-t border-fill-subtle pt-5 text-[13px] leading-5 text-text-muted">
          메모를 먼저 확인하고, 알려진 가맹점 규칙과 선택적 AI 분류를 차례로 적용합니다. 모르는 항목은 미분류로 남깁니다.
        </p>
      </div>
    </section>
  );
}
