import { CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/Badge";
import { EMPTY_SIGNALS_NOTE, LEVEL_LABEL } from "../copy";
import type { RiskSignal } from "../risk-report";

// 신호 목록(UI_GUIDE §6 필수 요소 2). 수준은 아이콘·색과 라벨로 함께 표시한다.
export function SignalList({ signals }: { signals: RiskSignal[] }) {
  return (
    <div data-testid="signal-list">
      {signals.length === 0 ? (
        <p className="border-t border-hairline-soft py-base text-body-sm text-body">{EMPTY_SIGNALS_NOTE}</p>
      ) : (
        <ul>
          {signals.map((signal) => (
            <SignalRow key={signal.code} signal={signal} />
          ))}
        </ul>
      )}
    </div>
  );
}

// 신호 행(UI_GUIDE §4): 상단 1px hairline-soft, 20px 아이콘 + 제목 + 설명
function SignalRow({ signal }: { signal: RiskSignal }) {
  const danger = signal.level === "danger";
  const Icon = danger ? TriangleAlert : CircleAlert;

  return (
    <li data-testid="signal-row" className="flex gap-md border-t border-hairline-soft py-base">
      <Icon aria-hidden="true" className={`mt-xxs size-5 shrink-0 ${danger ? "text-error-text" : "text-ink"}`} />
      <div className="flex flex-col gap-xs">
        <p className="flex flex-wrap items-center gap-sm">
          <span className="text-title-md text-ink">{signal.title}</span>
          <Badge tone={danger ? "error" : "ink"}>{LEVEL_LABEL[signal.level]}</Badge>
        </p>
        <p className="text-body-sm text-body">{signal.detail}</p>
      </div>
    </li>
  );
}
