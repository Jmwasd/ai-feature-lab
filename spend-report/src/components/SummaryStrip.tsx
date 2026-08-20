import type { Report } from "../types/report";
import { formatCount, formatCurrency } from "./format";

interface SummaryStripProps {
  report: Report;
}

export default function SummaryStrip({ report }: SummaryStripProps) {
  return (
    <section className="mt-10">
      <div className="grid overflow-hidden rounded-3xl border border-line sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="border-b border-fill-subtle px-8 py-7 sm:border-r sm:border-b-0">
          <p className="text-[13px] text-text-muted">총 지출</p>
          <p className="mt-1.5 font-mono text-[34px] font-medium tabular-nums tracking-[-1.5px] text-ink sm:text-[40px]">
            {formatCurrency(report.totalSpend)}
          </p>
        </div>
        <div className="border-b border-fill-subtle px-8 py-7 sm:border-r sm:border-b-0">
          <p className="text-[13px] text-text-muted">거래 건수</p>
          <p className="mt-1.5 font-mono text-[34px] font-medium tabular-nums tracking-[-1.5px] text-ink sm:text-[40px]">
            {formatCount(report.spendCount)}
          </p>
        </div>
        <div className="px-8 py-7">
          <p className="text-[13px] text-text-muted">자동 제외된 취소</p>
          <p className="mt-1.5 font-mono text-[34px] font-medium tabular-nums tracking-[-1.5px] text-ink sm:text-[40px]">
            {formatCount(report.excludedCancels.count)}
          </p>
          <p className="mt-1 text-[13px] text-text-body">{formatCurrency(report.excludedCancels.amount)} 제외</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-text-muted">
        이 리포트는 공동명의 계좌의 전체 소비 합계입니다. 개인별 사용 금액을 구분하지 않습니다.
      </p>
    </section>
  );
}
