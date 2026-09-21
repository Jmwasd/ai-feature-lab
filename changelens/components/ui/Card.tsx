import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-xl border border-hairline bg-surface p-6 ${className}`} />;
}
