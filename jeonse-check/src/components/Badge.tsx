import type { ReactNode } from "react";

// 상태 배지(UI_GUIDE §4): 흰 알약, text-badge, shadow-float. 색만으로 뜻을 전하지 않도록 내용은 항상 글자로 받는다.
export function Badge({ tone = "ink", children }: { tone?: "ink" | "error"; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-canvas px-sm py-xxs text-badge shadow-float ${
        tone === "error" ? "text-error-text" : "text-ink"
      }`}
    >
      {children}
    </span>
  );
}
