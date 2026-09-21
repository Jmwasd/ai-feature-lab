import type { ComponentProps } from "react";

export function Badge({ className = "", ...props }: ComponentProps<"span">) {
  return <span {...props} className={`inline-flex items-center rounded-full bg-accent px-3 py-1 font-mono text-xs text-accent-ink ${className}`} />;
}
