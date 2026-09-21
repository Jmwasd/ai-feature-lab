import type { ReactNode } from "react";
import { Card } from "./Card";

export function MetricCard({ label, value, detail }: {
  label: string;
  value: string;
  detail: ReactNode;
}) {
  return (
    <Card className="min-w-0 py-5">
      <h2 className="text-xs font-normal leading-[1.5] text-muted">{label}</h2>
      <p className="mt-2 break-words font-mono text-[28px] font-semibold leading-[1.1] text-ink">{value}</p>
      <p className="mt-1 break-words font-mono text-xs leading-[1.5] text-muted">{detail}</p>
    </Card>
  );
}
