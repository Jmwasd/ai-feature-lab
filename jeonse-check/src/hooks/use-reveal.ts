"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// 뷰포트에 이 비율만큼 들어오면 등장시킨다(랜딩 등장 모션). 뷰포트 아래 8%는 진입으로 치지 않는다.
const REVEAL_THRESHOLD = 0.15;
const REVEAL_ROOT_MARGIN = "0px 0px -8% 0px";

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// 동작 줄이기이거나 관찰자가 없는 환경이면 바로 보인다. 관찰이 실패해 내용이 숨겨지면 안 되기 때문이다.
export function useReveal<T extends Element>(options?: { delayMs?: number }): { ref: RefObject<T | null>; visible: boolean } {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const delayMs = options?.delayMs ?? 0;

  useEffect(() => {
    const target = ref.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => setVisible(true);

    if (!target || prefersReducedMotion() || typeof IntersectionObserver !== "function") {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (delayMs > 0) timer = setTimeout(show, delayMs);
        else show();
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN },
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [delayMs]);

  return { ref, visible };
}
