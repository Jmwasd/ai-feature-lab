"use client";

import { useEffect, useState, type ReactNode } from "react";

type RevealProps = {
  // true면 처음 그릴 때 등장 전환을 준다. 처음부터 있던 내용(미리 채운 값 등)은 false로 둔다.
  appear: boolean;
  className?: string;
  children: ReactNode;
};

// 입력 단계에서 다음 칸이 새로 나타날 때 쓰는 등장 전환(UI_GUIDE §5 등장).
// 폼 안에서 쓰므로 등장보다 짧게 500ms로 opacity·translateY 16px·blur를 함께 바꾼다.
export function Reveal({ appear, className, children }: RevealProps) {
  const [shown, setShown] = useState(!appear);

  useEffect(() => {
    if (shown) return;
    // 숨긴 상태가 한 번 그려진 다음 프레임에 바꿔야 전환이 일어난다.
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  const state = shown ? "translate-y-0 opacity-100 blur-none" : "translate-y-4 opacity-0 blur-xs";
  return <div className={["transition-[opacity,translate,filter] duration-500 ease-rise", state, className].filter(Boolean).join(" ")}>{children}</div>;
}
