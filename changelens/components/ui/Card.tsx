import type { ComponentProps } from "react";

export function Card({ className = "", padded = true, ...props }: ComponentProps<"div"> & { padded?: boolean }) {
  return <div {...props} className={`rounded-xl border border-hairline bg-surface ${padded ? "p-6" : ""} ${className}`} />;
}
