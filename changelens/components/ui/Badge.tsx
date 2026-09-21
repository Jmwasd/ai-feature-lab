import type { ComponentProps } from "react";

export function Badge({ className = "", variant = "default", ...props }:
  ComponentProps<"span"> & { variant?: "default" | "summary" }) {
  const size = variant === "summary" ? "px-2 text-[11px] font-semibold tracking-[0.4px]" : "px-3 text-xs";
  return <span {...props} className={`inline-flex items-center rounded-full bg-accent py-1 font-mono text-accent-ink ${size} ${className}`} />;
}
