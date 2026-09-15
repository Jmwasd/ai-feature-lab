import { EvidenceQuote } from "@/components/EvidenceQuote";
import { KindBadge } from "@/components/KindBadge";
import { formatConfidence, formatRequiredMonths } from "@/lib/format";
import type { AnalysisItem } from "@/types";

interface CoveredCardProps {
  item: AnalysisItem;
}

export function CoveredCard({ item }: CoveredCardProps) {
  const requiredMonths =
    item.requirement.requiredMonths === undefined
      ? ""
      : formatRequiredMonths(item.requirement.requiredMonths);

  return (
    <article className="flex flex-col gap-3 rounded-sm border border-card-border p-4">
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
      {item.evidence.map((evidence) => (
        <EvidenceQuote key={evidence.blockId} evidence={evidence} />
      ))}
      {item.confidence === null ? null : (
        <span className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted">
          {formatConfidence(item.confidence)}
        </span>
      )}
    </article>
  );
}
