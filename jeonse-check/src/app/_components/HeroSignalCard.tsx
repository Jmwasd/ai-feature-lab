"use client";

import { CircleAlert, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

// 랜딩 히어로 예시 일러스트 전용이다. 실제 판정이 아니므로 결과 화면에 쓰거나 일반화하지 않는다(UI_GUIDE §4, §6 예외).
const EXAMPLE_SIGNALS = ["시세 대비 전세가율 92%", "근저당 설정 3건", "HUG 보증보험 가입 어려움"];
const EXAMPLE_GAUGE = "86%";

export function HeroSignalCard() {
  // 마운트 뒤 게이지를 0에서 채운다(1.2s ease-fill, 500ms 지연).
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setFilled(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      data-testid="hero-signal-card"
      aria-hidden="true"
      className="grid w-[280px] max-w-full animate-float gap-3.5 rounded-card bg-canvas p-5 shadow-float"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
          <TriangleAlert size={16} />
        </span>
        <div className="grid">
          <span className="text-caption-sm text-muted">전세 위험도</span>
          <span className="text-display-sm text-error-text">높음</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
        <div
          className="h-full rounded-full bg-primary transition-[width] delay-500 duration-1200 ease-fill"
          style={{ width: filled ? EXAMPLE_GAUGE : "0%" }}
        />
      </div>
      <ul className="grid gap-2.5">
        {EXAMPLE_SIGNALS.map((signal) => (
          <li key={signal} className="flex items-center gap-sm text-body-sm text-ink">
            <CircleAlert size={16} className="shrink-0 text-error-text" />
            {signal}
          </li>
        ))}
      </ul>
    </div>
  );
}
