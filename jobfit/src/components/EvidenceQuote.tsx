import type { ResumeEvidence } from "@/types";

interface EvidenceQuoteProps {
  evidence: ResumeEvidence;
}

export function EvidenceQuote({ evidence }: EvidenceQuoteProps) {
  const source = [evidence.company, evidence.project].filter(Boolean).join(" > ");

  return (
    <blockquote className="flex flex-col gap-1.5 border-l-2 border-hairline pl-3">
      <p className="whitespace-pre-wrap font-body text-base leading-6 font-normal text-ink">
        {evidence.text}
      </p>
      {source ? (
        <cite className="font-body text-xs leading-[1.4] font-normal text-muted not-italic">
          {source}
        </cite>
      ) : null}
    </blockquote>
  );
}
