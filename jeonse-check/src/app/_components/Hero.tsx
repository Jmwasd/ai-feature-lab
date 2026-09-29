import { Button } from "@/components/Button";
import { StatusPill } from "@/components/StatusPill";
import { HeroBackground } from "./HeroBackground";
import { HeroSignalCard } from "./HeroSignalCard";
import { Reveal } from "./Reveal";
import { RollingHeadline } from "./RollingHeadline";

export function Hero() {
  return (
    <section id="hero" className="relative flex min-h-[max(640px,100vh_-_80px)] items-center overflow-hidden px-gutter py-section">
      <HeroBackground />
      <div className="relative mx-auto flex w-full max-w-editorial flex-col gap-xxl desktop:flex-row desktop:items-center desktop:justify-between">
        <div className="flex max-w-prose flex-col items-start gap-lg">
          <Reveal>
            <StatusPill>공공데이터로 계산하는 전세 위험 신호</StatusPill>
          </Reveal>
          <Reveal delayMs={100}>
            <RollingHeadline />
          </Reveal>
          <Reveal delayMs={200}>
            <p className="text-lead text-body">
              주소와 보증금을 넣으면 실거래가·공시가격·건축물대장으로 전세가율과 건물 위험 신호를 계산해요. 등기부를 보고
              근저당을 입력하면 부채비율과 HUG 보증 가입 기준도 함께 볼 수 있어요.
            </p>
          </Reveal>
          <Reveal delayMs={300} className="flex flex-wrap gap-md">
            <Button href="/check">지금 확인하기</Button>
            <Button href="#flow" variant="secondary">
              이용 방법 보기
            </Button>
          </Reveal>
        </div>
        <Reveal delayMs={400} className="self-center">
          <HeroSignalCard />
        </Reveal>
      </div>
    </section>
  );
}
