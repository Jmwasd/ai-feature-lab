import { DATA_LIMITED_NOTE, ESTIMATE_METHOD_LABEL, RECHECK_REGISTRY_NOTE } from "../copy";
import type { RiskReport } from "../risk-report";
import { Panel } from "@/components/Panel";
import { formatWon } from "@/utils/format";
import type { JudgmentView } from "./types";

// 결과 최상단 요약(UI_GUIDE §4). 큰 숫자는 위험 신호 개수뿐이다(§6).
export function SignalSummary({ report, view }: { report: RiskReport; view: JudgmentView }) {
  const { address, priceEstimate } = view;
  const unit = [address.dong, address.ho].filter(Boolean).join(" ");

  return (
    <Panel tone={report.signalCount > 0 ? "danger" : "data"} role="region" aria-label="결과 요약" className="flex flex-col items-center gap-sm text-center">
      <p className="text-body-sm text-muted">
        {address.display}
        {unit ? ` ${unit}` : null}
      </p>
      <p data-testid="signal-count" className={`mt-base font-mono text-rating-display tabular-nums ${report.signalCount > 0 ? "text-primary" : "text-ink"}`}>
        {report.signalCount}
      </p>
      <h2 className="text-display-sm text-ink">{report.headline}</h2>
      {isDataLimited(view) ? (
        <p data-testid="data-limited" className="max-w-detail text-body-md text-ink">
          {DATA_LIMITED_NOTE}
        </p>
      ) : null}
      <p className="max-w-detail text-body-sm text-muted">{RECHECK_REGISTRY_NOTE}</p>
      <dl className="mt-lg grid w-full grid-cols-1 gap-sm tablet:grid-cols-3">
        <SummaryFigure label="보증금" value={formatWon(view.deposit)} />
        <SummaryFigure label="전용면적" value={`${view.exclusiveArea}㎡`} />
        <SummaryFigure
          label="추정 시세"
          value={priceEstimate.price === null ? ESTIMATE_METHOD_LABEL.none : formatWon(priceEstimate.price)}
        />
      </dl>
    </Panel>
  );
}

// 시세를 추정하지 못했거나 HUG 판단에 필요한 값이 없으면 판단이 제한된 결과다.
// 공공데이터 부분 실패(warnings)는 직렬화 뷰에 실리지 않으므로 notes로만 보인다.
function isDataLimited(view: JudgmentView): boolean {
  return view.priceEstimate.method === "none" || view.hug.eligible === "unknown";
}

function SummaryFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-hairline bg-ink/5 p-md text-left">
      <dt className="font-mono text-badge tracking-wider text-data-soft">{label}</dt>
      <dd className="font-mono text-display-sm font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
