import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "small";

const variants: Record<Variant, string> = {
  primary: "h-12 bg-accent px-6 text-accent-ink",
  secondary: "h-10 border border-hairline px-4 text-body",
  small: "h-8 border border-hairline px-3 text-body",
};

function buttonClassName(variant: Variant, className: string) {
  return `inline-flex shrink-0 items-center justify-center rounded-md text-sm font-semibold ${variants[variant]} ${className}`;
}

export function Button({ variant = "secondary", className = "", type = "button", ...props }:
  ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      {...props}
      type={type}
      className={`${buttonClassName(variant, className)} cursor-pointer disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted`}
    />
  );
}

export function ButtonLink({ variant = "secondary", className = "", ...props }:
  ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClassName(variant, className)} />;
}
