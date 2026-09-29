import type { ReactNode } from "react";

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-sm rounded-full border border-hairline-soft bg-surface-soft px-md py-xs text-caption text-ink">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
      {children}
    </span>
  );
}
