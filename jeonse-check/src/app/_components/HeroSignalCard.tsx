import { CircleAlert, TriangleAlert } from "lucide-react";

// 랜딩 히어로 예시 일러스트 전용이다. 실제 판정이 아니므로 결과 화면에 쓰거나 일반화하지 않는다(UI_GUIDE §4, §6 예외).
const EXAMPLE_SIGNALS = ["근저당 채권최고액이 커요", "신탁 등기가 있어요", "위반건축물로 표시돼 있어요"];

export function HeroSignalCard() {
  return (
    <div data-testid="hero-signal-card" aria-hidden="true" className="w-[280px] animate-float rounded-card bg-canvas p-lg shadow-float">
      <div className="flex items-center gap-md">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <TriangleAlert size={20} />
        </span>
        <div>
          <p className="text-caption text-muted">전세 위험도</p>
          <p className="text-title-md text-error-text">높음</p>
        </div>
      </div>
      <div className="mt-base h-1.5 rounded-full bg-surface-strong">
        <div className="h-full w-4/5 rounded-full bg-error-text" />
      </div>
      <ul className="mt-base flex flex-col gap-sm">
        {EXAMPLE_SIGNALS.map((signal) => (
          <li key={signal} className="flex items-center gap-sm text-body-sm text-body">
            <CircleAlert size={16} className="shrink-0 text-ink" />
            {signal}
          </li>
        ))}
      </ul>
    </div>
  );
}
