import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary-text" | "pill-primary";

type ButtonProps = { variant?: ButtonVariant; href?: string } & ButtonHTMLAttributes<HTMLButtonElement>;

// 전환은 배경·글자색만 준다(UI_GUIDE §4 Button).
const BASE = "inline-flex items-center justify-center gap-sm transition-colors disabled:cursor-not-allowed";
const CONTROL = "min-h-control px-lg";
const FILLED_PRIMARY = "bg-primary text-on-primary active:bg-primary-active disabled:bg-primary-disabled";

const BUTTON_ONLY_ATTRS = ["disabled", "form", "formAction", "formEncType", "formMethod", "formNoValidate", "formTarget", "name", "value"] as const;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: `${CONTROL} rounded-button text-button-md ${FILLED_PRIMARY}`,
  secondary: `${CONTROL} rounded-button text-button-md bg-canvas text-ink border border-ink hover:bg-surface-soft active:bg-surface-strong disabled:border-border-strong disabled:text-muted-soft disabled:bg-canvas`,
  "tertiary-text": "p-0 text-button-md text-ink underline disabled:text-muted-soft",
  "pill-primary": `${CONTROL} rounded-full text-button-sm ${FILLED_PRIMARY}`,
};

export function Button({ variant = "primary", href, className, type, children, ...rest }: ButtonProps) {
  const classes = [BASE, VARIANT_CLASS[variant], className].filter(Boolean).join(" ");

  if (href !== undefined) {
    // 링크에 없는 버튼 전용 속성(disabled, form 등)은 넘기지 않는다.
    const anchorRest: Record<string, unknown> = { ...rest };
    for (const key of BUTTON_ONLY_ATTRS) delete anchorRest[key];
    return (
      <Link href={href} className={variant === "tertiary-text" ? classes : `${classes} hover:no-underline`} {...(anchorRest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {children}
    </button>
  );
}
