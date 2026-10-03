"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";

// 랜딩 등장 모션(랜딩 시안): opacity 0→1(1.1s), translateY 16px→0(1.3s), blur 6px→0(1.1s). 지연은 transition-delay로 준다.
// 면책 문구·데이터 기준일·출처 문구는 이 컴포넌트로 감싸지 않는다.
function transition(delayMs: number): CSSProperties {
  return {
    transition: [
      `opacity 1100ms var(--ease-fade) ${delayMs}ms`,
      `transform 1300ms var(--ease-rise) ${delayMs}ms`,
      `filter 1100ms ease ${delayMs}ms`,
    ].join(", "),
  };
}

const HIDDEN: CSSProperties = { opacity: 0, transform: "translateY(16px)", filter: "blur(6px)" };

// onMount면 뷰포트 관찰 없이 마운트 직후 등장한다. 첫 화면 맨 아래처럼 관찰 영역(아래 8% 제외)에 들지 않는 요소에 쓴다.
export function Reveal({
  delayMs = 0,
  onMount = false,
  className,
  children,
}: {
  delayMs?: number;
  onMount?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const observed = useReveal<HTMLDivElement>();
  const [mounted, setMounted] = useState(false);
  const ref = onMount ? undefined : observed.ref;
  const visible = onMount ? mounted : observed.visible;

  useEffect(() => {
    if (!onMount) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setMounted(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [onMount]);
  const style = transition(delayMs);

  return (
    <div ref={ref} className={className} style={visible ? style : { ...style, ...HIDDEN }}>
      {children}
    </div>
  );
}
