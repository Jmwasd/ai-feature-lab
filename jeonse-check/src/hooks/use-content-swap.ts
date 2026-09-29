"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./use-reveal";

// 내용 교체(UI_GUIDE §5): 이전 내용을 이 시간 동안 페이드아웃한 뒤 교체한다.
export const CONTENT_SWAP_OUT_MS = 340;

// value가 바뀌면 이전 내용(shown)을 hidden으로 숨기고, 숨긴 뒤 shown을 새 값으로 바꾼다.
// 새 내용은 숨긴 채로 한 프레임 그린 뒤 보여 등장 전환이 걸리게 한다. 동작 줄이기에서는 바로 바꾼다.
export function useContentSwap<T>(value: T): { shown: T; hidden: boolean } {
  const [shown, setShown] = useState(value);
  const [entering, setEntering] = useState(false);
  const changed = !Object.is(value, shown);

  if (changed && prefersReducedMotion()) setShown(value);

  useEffect(() => {
    if (Object.is(value, shown)) return;
    const timer = setTimeout(() => {
      setShown(value);
      setEntering(true);
    }, CONTENT_SWAP_OUT_MS);
    return () => clearTimeout(timer);
  }, [value, shown]);

  useEffect(() => {
    if (!entering) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntering(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [entering]);

  return { shown, hidden: changed || entering };
}
