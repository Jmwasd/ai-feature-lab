import type { ReactNode } from "react";

// 랜딩 섹션 공통 틀: py-section px-gutter + 상단 1px hairline-soft(UI_GUIDE §3).
export function LandingSection({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  const titleId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-nav border-t border-hairline-soft px-gutter py-section">
      <div className="mx-auto max-w-editorial">
        <h2 id={titleId} className="text-display-md text-ink">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
