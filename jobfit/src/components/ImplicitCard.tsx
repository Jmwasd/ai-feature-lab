"use client";

import { useEffect, useRef, useState } from "react";
import { EvidenceQuote } from "@/components/EvidenceQuote";
import { KindBadge } from "@/components/KindBadge";
import { formatConfidence, formatRequiredMonths } from "@/lib/format";
import type { AnalysisItem } from "@/types";

interface ImplicitCardProps {
  item: AnalysisItem;
}

type CopyLabel = "복사" | "복사됨" | "복사 실패";

export function ImplicitCard({ item }: ImplicitCardProps) {
  const [copyLabel, setCopyLabel] = useState<CopyLabel>("복사");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requiredMonths =
    item.requirement.requiredMonths === undefined
      ? ""
      : formatRequiredMonths(item.requirement.requiredMonths);

  useEffect(() => {
    return () => clearTimeout(resetTimer.current);
  }, []);

  async function copySuggestion() {
    if (item.suggestion === null) {
      return;
    }

    clearTimeout(resetTimer.current);

    try {
      await navigator.clipboard.writeText(item.suggestion);
      setCopyLabel("복사됨");
      resetTimer.current = setTimeout(() => setCopyLabel("복사"), 1600);
    } catch {
      setCopyLabel("복사 실패");
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-sm border border-coral-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={item.requirement.kind} variant="accent" />
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
      {item.suggestion === null ? null : (
        <div className="flex flex-col gap-2.5 border-t border-card-border pt-3">
          <span className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted uppercase">
            고쳐 쓴 문장
          </span>
          <p className="font-body text-base leading-6 font-normal text-ink">{item.suggestion}</p>
          <button
            className="cursor-pointer self-start rounded-pill border border-near-black bg-transparent px-4 py-1.5 font-body text-sm leading-[1.71] font-medium text-near-black transition-[background] duration-150 ease-linear"
            type="button"
            onClick={copySuggestion}
          >
            {copyLabel}
          </button>
        </div>
      )}
      {item.confidence === null ? null : (
        <span className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted">
          {formatConfidence(item.confidence)}
        </span>
      )}
    </article>
  );
}
