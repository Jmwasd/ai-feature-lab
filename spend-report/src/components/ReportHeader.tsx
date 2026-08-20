import type { Report } from "../types/report";
import { formatPeriod } from "./format";

interface ReportHeaderProps {
  report: Report;
  onReset: () => void;
  onPrint: () => void;
}

export default function ReportHeader({ report, onReset, onPrint }: ReportHeaderProps) {
  return (
    <header className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-fill-subtle px-3 py-1 text-[12px] font-semibold tracking-[0.4px] text-ink">
            소비 발견
          </span>
          <span className="rounded-full bg-fill-subtle px-3 py-1 font-mono text-[12px] font-medium tabular-nums tracking-[0.4px] text-ink">
            {report.period.days}일
          </span>
        </div>
        <p className="mt-5 text-[13px] text-text-muted">공동 계좌 · {formatPeriod(report.period.from, report.period.to)}</p>
        <h1 className="mt-2 text-[44px] font-normal leading-[1.05] tracking-[-1.3px] text-ink sm:text-[52px]">
          소비 리포트
        </h1>
      </div>
      <div className="no-print flex shrink-0 flex-wrap gap-3">
        <button
          className="rounded-full bg-fill-subtle px-5 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
          type="button"
          onClick={onReset}
        >
          다시 업로드
        </button>
        <button
          className="rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-bg transition-colors hover:bg-surface-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
          type="button"
          onClick={onPrint}
        >
          PDF로 내보내기
        </button>
      </div>
    </header>
  );
}
