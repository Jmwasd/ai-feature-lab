import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonCircleProps = { label: string; icon: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButtonCircle({ label, icon, className, type, ...rest }: IconButtonCircleProps) {
  const classes = [
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-strong text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-muted-soft",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type ?? "button"} aria-label={label} className={classes} {...rest}>
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </button>
  );
}
