"use client";

import { House, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type NavLink = { href: string; label: string; icon?: ReactNode };

type TopNavProps = {
  links: NavLink[];
  action?: ReactNode;
  // 기본은 워드마크(house 아이콘 + "jeonse-check")다.
  brand?: ReactNode;
};

// 이 값을 넘게 스크롤하면 그림자를 붙인다(UI_GUIDE §4 TopNav).
const SHADOW_SCROLL_Y = 8;

const LINK_CLASS =
  "items-center gap-1.5 rounded-full px-3.5 py-2.5 text-button-md leading-none text-body transition-colors ease-linear hover:bg-surface-soft hover:no-underline";

export function TopNav({ links, action, brand }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SHADOW_SCROLL_Y);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-10 border-b border-hairline bg-canvas transition-shadow duration-200 ease-linear ${scrolled ? "shadow-float" : ""}`}
    >
      <div className="flex h-nav items-center justify-between gap-base px-gutter">
        {brand ?? <Wordmark />}

        <nav aria-label="주요 메뉴" className="hidden flex-1 flex-wrap items-center justify-center gap-xs tablet:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`inline-flex ${LINK_CLASS}`}>
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-sm">
          {action}
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-control items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-soft tablet:hidden"
          >
            {open ? <X aria-hidden="true" size={24} /> : <Menu aria-hidden="true" size={24} />}
          </button>
        </div>
      </div>

      <nav id={menuId} aria-label="모바일 메뉴" hidden={!open} className="border-t border-hairline-soft px-gutter py-sm tablet:hidden">
        <ul className="flex flex-col gap-xs">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)} className={`flex ${LINK_CLASS}`}>
                {link.icon}
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-sm text-display-lg leading-none text-primary hover:no-underline">
      <House aria-hidden="true" size={24} />
      jeonse-check
    </Link>
  );
}
