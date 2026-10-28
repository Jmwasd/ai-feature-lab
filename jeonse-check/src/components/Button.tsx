import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "tertiary-text" | "pill-primary";

type ButtonProps = { variant?: ButtonVariant; href?: string } & ButtonHTMLAttributes<HTMLButtonElement>;

// 전환은 배경·글자색만 준다(UI_GUIDE §4 Button).
const BASE = "inline-flex items-center justify-center gap-sm transition-colors disabled:cursor-not-allowed";
const CONTROL = "min-h-control px-lg";
// 다크 캔버스 위 주요 CTA는 흰 알약이다. 레드는 강조·위험 신호에 남겨 둔다.
const FILLED_PRIMARY = "bg-ink font-bold text-canvas hover:bg-body active:bg-body disabled:bg-surface-strong disabled:text-muted-soft";

const BUTTON_ONLY_ATTRS = ["disabled", "form", "formAction", "formEncType", "formMethod", "formNoValidate", "formTarget", "name", "value"] as const;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: `${CONTROL} rounded-button text-button-md ${FILLED_PRIMARY}`,
  secondary: `${CONTROL} rounded-button text-button-md bg-ink/5 text-ink border border-ink/15 hover:bg-ink/10 active:bg-ink/15 disabled:border-hairline disabled:text-muted-soft disabled:bg-transparent`,
  ghost: `${CONTROL} rounded-button text-button-md text-body hover:bg-ink/5 active:bg-ink/10 disabled:text-muted-soft`,
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
