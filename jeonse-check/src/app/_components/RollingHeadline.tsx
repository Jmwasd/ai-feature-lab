"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/hooks/use-reveal";

type Line = { lead: string; emphasis: string; tail: string };

// 강조 어절은 레드로 둔다(UI_GUIDE §2 컬러 용도). 문장은 해요체, §6 금지 표현을 쓰지 않는다.
const LINES: Line[] = [
  { lead: "도장 찍기 전에 ", emphasis: "위험 신호", tail: "부터 확인하세요" },
  { lead: "보증금이 시세의 ", emphasis: "몇 %", tail: "인지 숫자로 보여 드려요" },
  { lead: "시세가 흐린 ", emphasis: "빌라 전세", tail: "도 실거래가로 따져 봐요" },
];

// 헤드라인 롤링 간격(UI_GUIDE §5).
const ROLL_INTERVAL_MS = 3000;

export function RollingHeadline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % LINES.length), ROLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    // 모든 줄을 한 칸에 겹쳐 두어 가장 긴 줄 높이를 유지한다.
    <h1 aria-live="polite" className="grid text-hero text-ink">
      {LINES.map((line, i) => {
        const shown = i === index;
        return (
          <span
            key={line.emphasis}
            data-headline-line
            aria-hidden={shown ? undefined : true}
            className={`col-start-1 row-start-1 transition-[opacity,transform,filter] duration-340 ease-fade ${
              shown ? "opacity-100" : "pointer-events-none -translate-y-2.5 opacity-0 blur-xs"
            }`}
          >
            {line.lead}
            <span className="text-primary">{line.emphasis}</span>
            {line.tail}
          </span>
        );
      })}
    </h1>
  );
}
