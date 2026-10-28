import { CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/Badge";
import { EMPTY_SIGNALS_NOTE, LEVEL_LABEL } from "../copy";
import type { RiskSignal } from "../risk-report";

// 신호 목록(UI_GUIDE §6 필수 요소 2). 수준은 아이콘·색과 라벨로 함께 표시한다.
export function SignalList({ signals }: { signals: RiskSignal[] }) {
  return (
    <div data-testid="signal-list">
      {signals.length === 0 ? (
        <p className="rounded-md border border-data/25 bg-data/5 p-base text-body-sm text-body">{EMPTY_SIGNALS_NOTE}</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {signals.map((signal) => (
            <SignalRow key={signal.code} signal={signal} />
          ))}
        </ul>
      )}
    </div>
  );
}

// 신호 카드(UI_GUIDE §4 신호 행): 원 안의 20px 아이콘 + 제목·배지 + 설명. 위험은 레드 면, 주의는 잉크 면이다.
function SignalRow({ signal }: { signal: RiskSignal }) {
  const danger = signal.level === "danger";
  const Icon = danger ? TriangleAlert : CircleAlert;

  return (
    <li
      data-testid="signal-row"
      className={`flex gap-md rounded-md border p-base ${danger ? "border-primary/25 bg-primary/5" : "border-hairline bg-ink/5"}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${danger ? "border-error-text text-error-text" : "border-ink/40 text-ink"}`}
      >
        <Icon className="size-4" />
      </span>
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
