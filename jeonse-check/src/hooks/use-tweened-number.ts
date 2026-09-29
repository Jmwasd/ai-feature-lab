"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./use-reveal";

const DEFAULT_DURATION_MS = 600;

// 숫자 트윈(UI_GUIDE §5): 목표값이 바뀌면 지금 보이는 값에서 목표값까지 감속하며 다가간다.
// 처음 렌더와 동작 줄이기에서는 목표값을 바로 쓴다.
export function useTweenedNumber(target: number, durationMs = DEFAULT_DURATION_MS): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const from = valueRef.current;
    const set = (next: number) => {
      valueRef.current = next;
      setValue(next);
    };

    if (from === target) return;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      set(target);
      return;
    }

    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - t) ** 3;
      set(t === 1 ? target : from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
