import type { ReactNode } from "react";

export function TopBar({ children, surface = false }: { children: ReactNode; surface?: boolean }) {
  return (
    <header className={`sticky top-0 z-10 border-b border-hairline ${surface ? "bg-surface" : "bg-canvas"}`}>
      <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-6">
        {children}
      </div>
    </header>
  );
}
