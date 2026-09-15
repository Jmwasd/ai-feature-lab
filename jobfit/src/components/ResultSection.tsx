import { KindBadge } from "@/components/KindBadge";
import { ResultColumns } from "@/components/ResultColumns";
import { formatRequiredMonths } from "@/lib/format";
import type { AnalysisItem } from "@/types";
import type { AnalyzeResponse } from "@/types/api";

type SuccessfulAnalyzeResponse = Extract<AnalyzeResponse, { status: "ok" }>;

interface ResultSectionProps {
  response: SuccessfulAnalyzeResponse;
}

function getPostingSource(sourceUrl?: string) {
  if (!sourceUrl) {
    return "붙여넣은 본문";
  }

  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return sourceUrl;
  }
}

function UnjudgedRow({ item }: { item: AnalysisItem }) {
  const requiredMonths =
    item.requirement.requiredMonths === undefined
      ? ""
      : formatRequiredMonths(item.requirement.requiredMonths);

  return (
    <article className="flex flex-col gap-2.5 border-b border-hairline pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={item.requirement.kind} />
        {requiredMonths ? (
          <span className="rounded-xl border border-border-light px-2.5 py-0.5 font-body text-xs leading-[1.4] font-normal text-slate">
            {requiredMonths}
          </span>
        ) : null}
      </div>
      <p className="font-body text-base leading-6 font-normal text-ink">
        {item.requirement.text}
      </p>
      <span className="font-body text-sm leading-[1.4] font-normal text-muted">
        판정 없음
      </span>
    </article>
  );
}

export function ResultSection({ response }: ResultSectionProps) {
  const { posting, requirementCount, result } = response;

  return (
    <section className="result-fade-in mt-16 flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-5">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted uppercase">
            {getPostingSource(posting.sourceUrl)}
          </span>
          <h1 className="font-display text-[32px] leading-[1.2] font-normal tracking-[-0.32px] text-ink">
            {posting.title}
          </h1>
        </div>
        <span className="font-body text-sm leading-[1.4] font-normal text-muted">
          요구사항 {requirementCount}개 · 저장하지 않음
        </span>
      </div>

      <ResultColumns result={result} />

      {result.unjudged.length > 0 ? (
        <section className="flex flex-col gap-4" aria-labelledby="unjudged-heading">
          <div className="flex flex-col gap-1.5">
            <h2
              className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted uppercase"
              id="unjudged-heading"
            >
              판정 없음
            </h2>
            <p className="font-body text-sm leading-[1.4] font-normal text-slate">
              모델이 이 요구사항에 답하지 않았다. 근거가 없다는 뜻은 아니다.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {result.unjudged.map((item) => (
              <UnjudgedRow key={item.requirement.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="border-t border-hairline pt-4 font-body text-sm leading-[1.4] font-normal text-muted">
        신뢰도는 모델의 자기평가다. 보정된 확률이 아니고 검토 필요 신호로만 쓴다.
        새로고침하면 결과는 사라진다.
      </p>
    </section>
  );
}
