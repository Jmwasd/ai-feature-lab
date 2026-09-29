import { formatIsoDate } from "@/utils/format";
import type { RiskReport } from "../risk-report";

// 데이터 기준일·출처·면책 문구(UI_GUIDE §6 필수 요소 4·5). 접지 않고, 등장 모션을 주지 않는다(§5).
export function ReportFooter({ report }: { report: RiskReport }) {
  return (
    <footer data-testid="report-footer" className="flex flex-col gap-sm border-t border-hairline-soft pt-lg">
      <p className="text-caption-sm tabular-nums text-muted">데이터 기준일 {formatIsoDate(report.dataBaseDate)}</p>
      <p className="text-caption-sm text-muted">출처 {report.sources.join(" · ")}</p>
      <p className="text-body-sm text-body">{report.disclaimer}</p>
    </footer>
  );
}
