import type { ReactNode } from "react";

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-sm rounded-full border border-hairline-soft bg-surface-soft px-3.5 py-sm text-caption text-ink">
      {children}
    </span>
  );
}
