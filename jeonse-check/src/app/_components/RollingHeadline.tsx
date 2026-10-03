"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "@/hooks/use-reveal";

// 한 줄 = [앞, 강조, 뒤]. 강조 어절은 레드로 둔다(UI_GUIDE §2 컬러 용도).
type Row = readonly [lead: string, emphasis: string, tail: string];

// 랜딩 시안의 두 줄짜리 문장 네 개. 문장은 해요체, §6 금지 표현을 쓰지 않는다.
export const HEADLINE_LINES: readonly (readonly [Row, Row])[] = [
  [
    ["", "내가 살 집", "이니까,"],
    ["더 신중해야 하니까.", "", ""],
  ],
  [
    ["", "보증금", ", 한두 푼"],
    ["하는 돈 아니잖아요.", "", ""],
  ],
  [
    ["좀 더 신중하게,", "", ""],
    ["좀 더 ", "확실하게", "."],
  ],
  [
    ["", "전세 위험도", ","],
    ["내가 먼저 확인해드릴게요.", "", ""],
  ],
];

// 헤드라인 롤링 간격(랜딩 시안).
export const ROLL_INTERVAL_MS = 3000;

// 들어오는 문장은 첫 줄 350ms, 둘째 줄 650ms 늦게, 나가는 문장은 첫 줄 바로, 둘째 줄 120ms 늦게 움직인다.
const ROW_DELAY_MS = { in: [350, 650], out: [0, 120] } as const;

function rowStyle(state: "in" | "out" | "waiting", row: 0 | 1): CSSProperties {
  const shown = state === "in";
  const delay = `${ROW_DELAY_MS[shown ? "in" : "out"][row]}ms`;
  return {
    display: "block",
    opacity: shown ? 1 : 0,
    // 나가는 문장은 위로, 다음 차례를 기다리는 문장은 아래에서 대기한다.
    transform: shown ? "translateY(0)" : state === "out" ? "translateY(-10px)" : "translateY(14px)",
    filter: shown ? "blur(0)" : "blur(8px)",
    transition: `opacity 1400ms var(--ease-fade) ${delay}, transform 1600ms var(--ease-rise) ${delay}, filter 1400ms ease ${delay}`,
  };
}

export function RollingHeadline() {
  const [{ index, prev }, setRoll] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null });

  // 동작 줄이기면 첫 문장에 머문다. 전환 시간은 globals.css의 전역 처리로 사라진다.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(
      () => setRoll(({ index: i }) => ({ index: (i + 1) % HEADLINE_LINES.length, prev: i })),
      ROLL_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    // 모든 문장을 한 칸에 겹쳐 두어 가장 긴 문장 높이를 유지한다.
    <h1 aria-live="polite" className="grid text-hero text-ink tablet:whitespace-nowrap">
      {HEADLINE_LINES.map((rows, i) => {
        const state = i === index ? "in" : i === prev ? "out" : "waiting";
        return (
          <span
            key={rows[0].join("")}
            data-headline-line
            aria-hidden={state === "in" ? undefined : true}
            className={`col-start-1 row-start-1 grid ${state === "in" ? "" : "pointer-events-none"}`}
          >
            {rows.map((row, r) => (
              <span key={r} style={rowStyle(state, r as 0 | 1)}>
                {row[0]}
                {row[1] ? <span className="text-primary">{row[1]}</span> : null}
                {row[2]}
              </span>
            ))}
          </span>
        );
      })}
    </h1>
  );
}
