"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./use-reveal";

// 프레임마다 남은 거리의 이 비율만큼 다가간다(랜딩 시안의 숫자 트윈).
export const APPROACH_RATE = 0.07;
// 남은 거리가 이보다 작으면 목표값에 붙인다. 퍼센트 값(0~120)을 다루는 기준이다.
const SNAP_DISTANCE = 0.4;

// 숫자 트윈(UI_GUIDE §5) 랜딩판: active가 되면 0에서 목표값으로, 목표가 바뀌면 지금 값에서 새 목표로 감속하며 다가간다.
// 동작 줄이기면 트윈 없이 목표값을 쓴다.
export function useApproach(target: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  // active는 처음 렌더에서 false라(관찰 전) 서버와 첫 클라이언트 렌더 모두 0을 그린다.
  const [reduced] = useState(
    () => typeof window !== "undefined" && (prefersReducedMotion() || typeof requestAnimationFrame !== "function"),
  );

  useEffect(() => {
    if (!active || reduced) return;
    let frame = 0;
    const step = () => {
      const distance = target - valueRef.current;
      const next = Math.abs(distance) < SNAP_DISTANCE ? target : valueRef.current + distance * APPROACH_RATE;
      valueRef.current = next;
      setValue(next);
      if (next !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, active, reduced]);

  if (!active) return 0;
  return reduced ? target : value;
}
