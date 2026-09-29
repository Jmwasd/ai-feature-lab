import Link from "next/link";
import type { ReactNode } from "react";

type FooterColumn = { title: string; links: { href: string; label: string }[] };

export function FooterLight({ columns, legal }: { columns: FooterColumn[]; legal: ReactNode }) {
  return (
    <footer className="border-t border-hairline bg-canvas">
      <div className="mx-auto max-w-editorial px-gutter py-xxl">
        <div className="flex flex-col gap-xl tablet:flex-row tablet:gap-xxl">
          {columns.map((column) => (
            <div key={column.title} className="tablet:flex-1">
              <h2 className="text-title-sm text-ink">{column.title}</h2>
              <ul className="mt-md flex flex-col gap-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-body-sm text-body">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-xxl border-t border-hairline-soft pt-lg text-caption-sm text-muted">{legal}</div>
      </div>
    </footer>
  );
}
