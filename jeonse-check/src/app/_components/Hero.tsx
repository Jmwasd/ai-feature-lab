import { ArrowRight, CirclePlay, Radar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { StatusPill } from "@/components/StatusPill";
import { HeroBackground } from "./HeroBackground";
import { HeroSignalCard } from "./HeroSignalCard";
import { Reveal } from "./Reveal";
import { RollingHeadline } from "./RollingHeadline";

// 랜딩 히어로(UI_GUIDE §8). 등장 지연은 시안 값(0·80·160·240·300·400ms)이다.
export function Hero() {
  return (
    <section id="hero" className="relative flex min-h-[max(640px,calc(100vh-80px))] flex-col overflow-hidden bg-canvas">
      <HeroBackground />
      <div className="relative mx-auto grid w-full max-w-editorial flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-center gap-x-14 gap-y-xxl px-gutter pt-18 pb-xl">
        <div className="grid max-w-prose gap-7">
          <Reveal className="justify-self-start">
            <StatusPill>
              <Radar aria-hidden="true" size={14} className="shrink-0 text-primary" />
              공공데이터로 계산하는 전세 위험도
            </StatusPill>
          </Reveal>
          <Reveal delayMs={80}>
            <RollingHeadline />
          </Reveal>
          <Reveal delayMs={160}>
            <p className="text-lead text-pretty text-body">
              실거래가, 공시가격, 등기부 권리관계까지. 보증금이 시세의 몇 %인지,
              <br />
              돌려받기 어려운 집인지 계약 전에 한눈에 알려드려요.
            </p>
          </Reveal>
          <Reveal delayMs={240} className="flex flex-wrap items-center gap-md">
            <Button href="/check">
              지금 위험도 확인하기
              <ArrowRight aria-hidden="true" size={16} />
            </Button>
            <Link
              href="#flow"
              className="inline-flex min-h-control items-center gap-sm rounded-button border border-ink px-5 text-button-md text-ink transition-colors ease-linear hover:bg-surface-soft hover:no-underline"
            >
              <CirclePlay aria-hidden="true" size={16} />
              이용 방법 보기
            </Link>
          </Reveal>
        </div>
        <Reveal delayMs={300} className="mt-[4%] self-start justify-self-end">
          <HeroSignalCard />
        </Reveal>
      </div>
      <div className="relative flex justify-center px-gutter pb-7">
        <Reveal delayMs={400} onMount>
          <Link href="#try" className="grid justify-items-center gap-1.5 text-muted hover:no-underline">
            <span aria-hidden="true" className="flex h-[34px] w-[22px] justify-center rounded-full border-[1.5px] border-border-strong pt-1.5">
              <span className="h-[7px] w-[3px] animate-wheel rounded-full bg-muted" />
            </span>
            <span className="text-caption-sm">아래로 스크롤</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
