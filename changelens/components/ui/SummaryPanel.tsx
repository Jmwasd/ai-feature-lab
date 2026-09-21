import type { SummaryResult } from "@/types/summary";
import { Badge } from "./Badge";
import { Card } from "./Card";

const errorMessages = {
  auth: "요약 API 키를 확인한 뒤 다시 시도한다.",
  "rate-limit": "요약 요청이 많다. 잠시 후 다시 시도한다.",
  refusal: "요약을 불러오지 못했다. 잠시 후 다시 시도한다.",
  failed: "요약을 불러오지 못했다. 잠시 후 다시 시도한다.",
};

export function SummaryPanel({ result }: { result: SummaryResult | null }) {
  if (result?.status === "disabled") return null;
  if (result?.status === "error") {
    return <Card className="mt-6"><p role="status" className="text-sm leading-[1.6] text-body-dim">{errorMessages[result.reason]}</p></Card>;
  }

  return (
    <Card className="mt-6" role="region" aria-label="Claude 요약" aria-busy={result === null}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="summary">CLAUDE 요약</Badge>
        {result?.status === "ok" && (
          <span className="font-mono text-xs leading-[1.5] text-muted">
            {result.truncated ? "diff 일부를 읽고 생성" : "diff 전문을 읽고 생성"}
          </span>
        )}
      </div>
      {result === null ? (
        <div className="mt-4 space-y-3" role="status" aria-label="요약을 불러오는 중">
          <div aria-hidden="true" className="h-4 rounded-md bg-surface-raised" />
          <div aria-hidden="true" className="h-4 rounded-md bg-surface-raised" />
          <div aria-hidden="true" className="h-4 w-2/3 rounded-md bg-surface-raised" />
        </div>
      ) : (
        <>
          <p className="mt-4 break-words text-[15px] leading-[1.7] text-body">{result.summary}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-[1.7] text-body-dim">
            {result.points.slice(0, 3).map((point, index) => <li key={index} className="break-words">{point}</li>)}
          </ul>
          {result.truncated && <p className="mt-4 font-mono text-xs leading-[1.5] text-muted">diff 일부만 읽고 쓴 요약</p>}
        </>
      )}
    </Card>
  );
}
