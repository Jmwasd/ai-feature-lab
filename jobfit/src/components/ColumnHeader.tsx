interface ColumnHeaderProps {
  title: string;
  count: number;
  variant?: "default" | "accent";
  description?: string;
}

export function ColumnHeader({
  title,
  count,
  variant = "default",
  description,
}: ColumnHeaderProps) {
  const borderClass = variant === "accent" ? "border-coral" : "border-hairline";

  return (
    <>
      <div
        className={`flex items-baseline justify-between border-t-2 pt-3 ${borderClass}`}
      >
        <h2 className="font-body text-[18px] leading-[1.3] font-normal text-ink">{title}</h2>
        <span className="font-mono text-xs leading-[1.4] font-normal tracking-[0.28px] text-muted">
          {count}
        </span>
      </div>
      {description ? (
        <p className="font-body text-sm leading-[1.4] font-normal text-slate">{description}</p>
      ) : null}
    </>
  );
}
