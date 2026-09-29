"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// 로드 시 scale 1.06→1(UI_GUIDE §5 히어로 배경). 동작 줄이기는 globals.css의 전역 처리로 전환이 사라진다.
export function HeroBackground() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <Image
        src="/images/landing-hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className={`object-cover object-left transition-transform duration-1200 ease-rise tablet:object-center ${
          loaded ? "scale-100" : "scale-106"
        }`}
      />
    </div>
  );
}
