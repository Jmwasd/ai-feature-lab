import { KindBadge } from "@/components/KindBadge";
import { formatConfidence, formatRequiredMonths } from "@/lib/format";
import type { AnalysisItem } from "@/types";

interface MissingRowProps {
  item: AnalysisItem;
}

export function MissingRow({ item }: MissingRowProps) {
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
      <span className="font-body text-sm leading-[1.4] font-normal text-muted">근거 없음</span>
      {item.confidence === null ? null : (
        <span className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted">
          {formatConfidence(item.confidence)}
        </span>
      )}
    </article>
  );
}
