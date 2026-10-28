import type { ComponentProps } from "react";

type PanelTone = "default" | "data" | "danger";

// 다크 화면의 기본 면(UI_GUIDE §4 Panel). 반투명 surface + 1px 테두리, 그림자 없이 테두리로 나눈다.
const TONE: Record<PanelTone, string> = {
  default: "border-hairline bg-surface-soft/70",
  data: "border-data/25 bg-surface-soft/70",
  danger: "border-primary/25 bg-primary/5",
};

export function Panel({ tone = "default", className, ...rest }: { tone?: PanelTone } & ComponentProps<"div">) {
  return <div className={["rounded-card border p-gutter tablet:p-7", TONE[tone], className].filter(Boolean).join(" ")} {...rest} />;
}
