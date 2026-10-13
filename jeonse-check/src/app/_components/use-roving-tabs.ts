"use client";

import { useId, useRef, type KeyboardEvent } from "react";

// 랜딩 탭(사례·이용 방법·데이터 출처) 공통 키보드 이동: 화살표는 순환(가로·세로 탭 모두), Home·End는 처음·끝.
// 옮긴 탭을 바로 선택하고 포커스한다(WAI-ARIA 탭 자동 활성화).
// 탭·패널의 id와 ARIA 속성도 함께 만들어 각 섹션은 스타일만 얹는다.
export function useRovingTabs(count: number, selected: number, onSelect: (index: number) => void) {
  const baseId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const panelId = `${baseId}-panel`;

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

  const tabProps = (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      tabs.current[index] = el;
    },
    id: tabId(index),
    type: "button" as const,
    role: "tab",
    "aria-selected": index === selected,
    "aria-controls": panelId,
    tabIndex: index === selected ? 0 : -1,
    onClick: () => onSelect(index),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index),
  });

  // shown은 지금 패널에 보이는 탭이다. 내용 전환 중에는 selected보다 늦게 따라온다.
  const panelProps = (shown: number) => ({
    id: panelId,
    role: "tabpanel",
    "aria-labelledby": tabId(shown),
    tabIndex: 0,
  });

  return { tabProps, panelProps };
}
