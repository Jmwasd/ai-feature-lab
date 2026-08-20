import type { Report } from "../types/report";
import { formatCount, formatCurrency, formatPercent } from "./format";

interface FindingsSectionProps {
  report: Report;
}

function widthFor(amount: number, total: number): string {
  return `${total === 0 ? 0 : Math.round((amount / total) * 100)}%`;
}

export default function FindingsSection({ report }: FindingsSectionProps) {
  const mainEvent = report.events[0];

  return (
    <section className="mt-[72px]" aria-labelledby="findings-title">
      <div className="flex items-baseline gap-3">
        <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">DISCOVERIES</p>
        <h2 id="findings-title" className="text-[36px] font-normal tracking-[-0.5px] text-ink">
          네 가지 사실
        </h2>
      </div>

      <article className="surface-dark mt-6 grid gap-8 rounded-3xl bg-ink p-8 text-bg sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.4px] text-text-ondark">01 · 반복 결제</p>
          <h3 className="mt-5 text-[24px] font-semibold">의식하지 못한 반복을 확인하세요</h3>
          <p className="mt-4 max-w-sm text-[15px] leading-6 text-text-ondark">
            반복 여부는 더 긴 조회기간에서 더 선명해집니다. 월 → 연간 관점은 3개월 이상 자료에서 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-2xl bg-surface-dark">
          {report.repeats.length > 0 ? (
            report.repeats.map((repeat, index) => (
              <div
                className="flex items-center justify-between gap-5 border-b border-ink px-5 py-4 last:border-b-0"
                key={`${repeat.displayName}-${index}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-bg">{repeat.displayName}</p>
                  <p className="mt-1 font-mono text-[13px] font-medium tabular-nums text-text-ondark">
                    {formatCount(repeat.count)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-[15px] font-medium tabular-nums text-bg">
                  {formatCurrency(repeat.amount)}
                </p>
              </div>
            ))
          ) : (
            <p className="px-5 py-6 text-[15px] leading-6 text-text-ondark">
              반복 결제 기준을 만족한 항목이 없습니다.
            </p>
          )}
        </div>
      </article>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-line p-8">
          <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">02 · 이벤트 묶음</p>
          {mainEvent ? (
            <>
              <h3 className="mt-6 text-xl font-semibold text-ink">{mainEvent.key} 여행</h3>
              <p className="mt-2 font-mono text-[36px] font-medium tabular-nums tracking-[-1px] text-ink">
                {formatCurrency(mainEvent.amount)}
              </p>
              <p className="mt-2 text-[15px] leading-6 text-text-body">
                {formatCount(mainEvent.count)} · 같은 파일 기간 소비의 {formatPercent(mainEvent.ratio)}
              </p>
              <div className="mt-7 border-t border-fill-subtle pt-4">
                {report.events.map((event) => (
                  <div className="flex items-center justify-between gap-4 py-2" key={event.key}>
                    <p className="text-[15px] font-semibold text-ink">{event.key} 여행</p>
                    <p className="font-mono text-[13px] font-medium tabular-nums text-text-body">
                      {formatCurrency(event.amount)} · {formatCount(event.count)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-6 text-xl font-semibold text-ink">묶인 이벤트가 없습니다</h3>
              <p className="mt-3 text-[15px] leading-6 text-text-body">
                메모에 반복된 장소나 목적이 있으면 이곳에서 카테고리와 별개로 보여 줍니다.
              </p>
            </>
          )}
        </article>

        <article className="rounded-3xl border border-line p-8">
          <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">03 · 지출 집중도</p>
          <h3 className="mt-6 text-xl font-semibold text-ink">상위 {report.concentration.topN}건의 영향</h3>
          <p className="mt-2 font-mono text-[36px] font-medium tabular-nums tracking-[-1px] text-blue">
            {formatPercent(report.concentration.ratio)}
          </p>
          <div className="mt-7 space-y-4">
            {report.concentration.items.map((item) => (
              <div key={item.id}>
                <div className="flex items-start justify-between gap-4 text-[14px]">
                  <p className="min-w-0 font-semibold text-ink">{item.displayName}</p>
                  <p className="shrink-0 font-mono font-medium tabular-nums text-text-body">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill-subtle">
                  <div
                    className="h-full rounded-full bg-blue"
                    style={{ width: widthFor(Math.abs(item.amount), report.totalSpend) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <p className="mt-4 text-[13px] leading-5 text-text-muted">
        이벤트와 집중도는 같은 지출을 함께 포함할 수 있습니다. 발견 항목끼리 합산하지 마세요.
      </p>

      <article className="mt-6 grid gap-8 rounded-3xl border border-line p-8 lg:grid-cols-[0.65fr_1.35fr]">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">04 · 미분류 비중</p>
          <p className="mt-5 font-mono text-[44px] font-medium tabular-nums tracking-[-1.5px] text-ink">
            {formatPercent(report.unclassified.ratio)}
          </p>
          <p className="mt-2 text-[15px] leading-6 text-text-body">
            {formatCurrency(report.unclassified.amount)} · {formatCount(report.unclassified.count)}
          </p>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-ink">보정이 필요한 항목</p>
          {report.needsInput.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-fill-subtle">
              {report.needsInput.map((item) => (
                <div className="flex items-center justify-between gap-4 border-b border-fill-subtle px-5 py-4 last:border-b-0" key={item.id}>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{item.displayName}</p>
                    <p className="mt-1 text-[13px] text-text-body">{item.category === "미분류" ? "미분류" : "입력 필요"}</p>
                  </div>
                  <p className="shrink-0 font-mono text-[14px] font-medium tabular-nums text-ink">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[15px] leading-6 text-text-body">지금 보정이 필요한 항목은 없습니다.</p>
          )}
        </div>
      </article>
    </section>
  );
}
