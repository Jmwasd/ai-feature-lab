import { Children, Fragment, type ReactNode } from "react";

// 조회 입력 바(UI_GUIDE §4 SearchBarPill). 모바일은 세로 스택, desktop은 세그먼트가 가로로 이어진 알약이다.
// 세그먼트는 `TextInput segment`를 children으로 받는다. 오브(레드 원형 버튼)는 desktop에서만 보인다.
export function SearchBarPill({ children, orb }: { children: ReactNode; orb?: ReactNode }) {
  const segments = Children.toArray(children);

  return (
    <div
      data-testid="search-bar-pill"
      className="flex flex-col gap-md desktop:h-search desktop:flex-row desktop:items-center desktop:gap-0 desktop:rounded-full desktop:border desktop:border-hairline desktop:bg-canvas desktop:p-sm desktop:shadow-float"
    >
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span data-testid="search-bar-divider" aria-hidden="true" className="hidden h-xl w-px shrink-0 bg-hairline desktop:block" />
          ) : null}
          {segment}
        </Fragment>
      ))}
      {orb ? <div className="hidden shrink-0 desktop:flex desktop:pl-sm">{orb}</div> : null}
    </div>
  );
}
