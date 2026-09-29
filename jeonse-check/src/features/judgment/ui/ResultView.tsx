import { rightsLines } from "../copy";
import { PriceEvidence } from "./PriceEvidence";
import { RatioPanel } from "./RatioPanel";
import { ReportFooter } from "./ReportFooter";
import { SignalList } from "./SignalList";
import { SignalSummary } from "./SignalSummary";
import type { JudgmentView } from "./types";

// 결과 화면 본문. UI_GUIDE §6 필수 요소 5개(요약, 신호 목록, 시세 근거, 기준일·출처, 면책)를 항상 렌더링한다.
// 모바일 1단, desktop 이상 2단(본문 / 우측 레일)이다(§3).
export function ResultView({ view }: { view: JudgmentView }) {
  const { report } = view;

  return (
    <article className="mx-auto flex max-w-editorial flex-col gap-xxl px-gutter py-section">
      <SignalSummary report={report} view={view} />
      <div className="grid grid-cols-1 gap-xl desktop:grid-cols-3">
        <div className="flex flex-col gap-xxl desktop:col-span-2">
          <section aria-labelledby="signals-title" className="flex flex-col gap-base">
            <h3 id="signals-title" className="text-display-md text-ink">
              위험 신호
            </h3>
            <SignalList signals={report.signals} />
            <ul className="flex flex-col gap-xs">
              {report.notes.map((note) => (
                <li key={note} className="text-body-sm text-body">
                  {note}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="rights-title" className="flex flex-col gap-base">
            <h3 id="rights-title" className="text-display-md text-ink">
              권리관계
            </h3>
            <ul className="flex flex-col gap-xs">
              {rightsLines(view.rights).map((line) => (
                <li key={line} className="border-t border-hairline-soft pt-xs text-body-sm tabular-nums text-body">
                  {line}
                </li>
              ))}
            </ul>
          </section>
          <PriceEvidence estimate={view.priceEstimate} />
        </div>
        <aside aria-label="비율과 보증 기준">
          <RatioPanel view={view} />
        </aside>
      </div>
      <ReportFooter report={report} />
    </article>
  );
}
