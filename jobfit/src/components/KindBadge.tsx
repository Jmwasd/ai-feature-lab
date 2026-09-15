import type { RequirementKind } from "@/types";

interface KindBadgeProps {
  kind: RequirementKind;
  variant?: "default" | "accent";
}

export function KindBadge({ kind, variant = "default" }: KindBadgeProps) {
  const variantClass =
    variant === "accent"
      ? "bg-coral text-near-black"
      : "border border-hairline text-ink";

  return (
    <span
      className={`rounded-xl px-2.5 py-0.5 font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] uppercase ${variantClass}`}
    >
      {kind}
    </span>
  );
}
