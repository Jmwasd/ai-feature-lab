import type { CSSProperties } from "react";

// 내용 교체 전환(UI_GUIDE §5) 인라인 스타일. 숨길 때는 지연 없이 바로, 다시 보일 때만 delayMs만큼 늦춘다.
export function swapStyle(
  hidden: boolean,
  motion: { fadeMs: number; riseMs: number; shiftPx?: number; blurPx?: number },
  delayMs = 0,
): CSSProperties {
  const { fadeMs, riseMs, shiftPx = 10, blurPx = 6 } = motion;
  const delay = `${hidden ? 0 : delayMs}ms`;
  return {
    opacity: hidden ? 0 : 1,
    transform: hidden ? `translateY(${shiftPx}px)` : "none",
    filter: hidden ? `blur(${blurPx}px)` : "blur(0)",
    transition: `opacity ${fadeMs}ms var(--ease-fade) ${delay}, transform ${riseMs}ms var(--ease-rise) ${delay}, filter ${fadeMs}ms ease ${delay}`,
  };
}
