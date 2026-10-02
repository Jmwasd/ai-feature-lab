"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/hooks/use-reveal";

const INTRO_MS = 1400;
// 패럴랙스는 스크롤 600px까지만 따라간다.
const PARALLAX_MAX_Y = 600;

// 히어로 배경(UI_GUIDE §5): 로드 시 scale 1.06→1(1.4s ease-fill), 그 뒤 스크롤 패럴랙스. 동작 줄이기면 둘 다 끈다.
export function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let introDone = false;
    let scrollFrame = 0;
    const parallax = () => {
      scrollFrame = 0;
      if (!introDone) return;
      const y = Math.min(window.scrollY, PARALLAX_MAX_Y);
      el.style.transform = `translateY(${y * 0.08}px) scale(${1 + y / 12000})`;
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(parallax);
    };

    el.style.transform = "scale(1.06)";
    el.style.transition = `transform ${INTRO_MS}ms var(--ease-fill)`;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        el.style.transform = "scale(1)";
      });
    });
    const timer = setTimeout(() => {
      el.style.transition = "none";
      introDone = true;
      parallax();
    }, INTRO_MS + 50);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 will-change-transform">
      <Image
        src="/images/landing-hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[70%_60%]"
      />
    </div>
  );
}
