"use client";

import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";

// 등장 모션(UI_GUIDE §5): opacity 0→1, translateY 16px→0, blur 6px→0.
// 면책 문구·데이터 기준일·출처는 이 컴포넌트로 감싸지 않는다.
const TRANSITION: CSSProperties = {
  transitionProperty: "opacity, transform, filter",
  transitionDuration: "1.2s",
  transitionTimingFunction: "var(--ease-fade), var(--ease-rise), var(--ease-fade)",
};

const HIDDEN: CSSProperties = { opacity: 0, transform: "translateY(16px)", filter: "blur(6px)" };

export function Reveal({ delayMs, className, children }: { delayMs?: number; className?: string; children: ReactNode }) {
  const { ref, visible } = useReveal<HTMLDivElement>({ delayMs });

  return (
    <div ref={ref} className={className} style={visible ? TRANSITION : { ...TRANSITION, ...HIDDEN }}>
      {children}
    </div>
  );
}
