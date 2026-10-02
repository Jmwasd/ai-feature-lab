import Link from "next/link";
import type { ReactNode } from "react";

type FooterColumn = { title: string; links: { href: string; label: string }[] };

// 열 수만큼 같은 폭으로 나눈다. 좁은 폭에서도 행 순서를 바꾸지 않는다(UI_GUIDE §3).
export function FooterLight({ columns, legal }: { columns: FooterColumn[]; legal: ReactNode }) {
  return (
    <footer className="border-t border-hairline bg-canvas px-section py-xxl">
      <div className="mx-auto max-w-editorial">
        <div
          className="grid gap-lg pb-xxl"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-base">
              <h2 className="text-title-sm text-ink">{column.title}</h2>
              <ul className="flex flex-col gap-base">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-body-sm text-ink hover:no-underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-base border-t border-hairline py-lg text-caption-sm text-muted">{legal}</div>
      </div>
    </footer>
  );
}
