import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

// 랜딩 섹션 공통 틀(UI_GUIDE §3): 최대 폭 안에서 py-section px-gutter + 상단 1px hairline-soft. 내부 배치는 className으로 준다.
export function LandingSection({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`mx-auto w-full max-w-editorial scroll-mt-[100px] border-t border-hairline-soft px-gutter py-section ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

// 섹션 제목: 32px 원 안의 아이콘 + text-display-md. 설명 문단은 140ms 늦게 등장한다.
export function SectionHeading({
  id,
  icon,
  title,
  description,
  center = false,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <>
      <Reveal>
        <h2 id={`${id}-title`} className={`flex items-center gap-sm text-display-md text-ink ${center ? "justify-center" : ""}`}>
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline-soft bg-surface-soft text-ink"
          >
            {icon}
          </span>
          {title}
        </h2>
      </Reveal>
      {description ? (
        <Reveal delayMs={140}>
          <p className="text-body-md text-pretty text-body">{description}</p>
        </Reveal>
      ) : null}
    </>
  );
}
