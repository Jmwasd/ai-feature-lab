"use client";

import { useRef, type KeyboardEvent } from "react";

// 랜딩 탭(사례·이용 방법·데이터 출처) 공통 키보드 이동: 화살표는 순환(가로·세로 탭 모두), Home·End는 처음·끝.
// 옮긴 탭을 바로 선택하고 포커스한다(WAI-ARIA 탭 자동 활성화).
export function useRovingTabs(count: number, onSelect: (index: number) => void) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabRef = (index: number) => (el: HTMLButtonElement | null) => {
    tabs.current[index] = el;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (index + 1) % count
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (index - 1 + count) % count
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
    tabs.current[next]?.focus();
  };

  return { tabRef, onKeyDown };
}
