"use client";

import { useEffect, useId, useState } from "react";
import { useContentSwap } from "@/hooks/use-content-swap";
import { prefersReducedMotion } from "@/hooks/use-reveal";
import { LandingSection } from "./LandingSection";
import { Reveal } from "./Reveal";
import { useRovingTabs } from "./use-roving-tabs";

// 단계 진행 탭 자동 진행 간격(UI_GUIDE §8).
export const FLOW_AUTO_ADVANCE_MS = 4500;

// 미리보기 판은 단계 설명 카드다. 결과 화면을 흉내 낸 수치나 판정을 넣지 않는다.
const FLOW_STEPS = [
  {
    title: "주소·보증금 입력",
    summary: "주소, 보증금, 전용면적을 넣어요.",
    points: [
      "아파트·연립다세대 주소를 도로명이나 지번으로 찾아요.",
      "보증금과 전용면적을 넣으면 같은 건물·같은 동 실거래로 시세를 추정해요.",
      "건축물대장의 용도, 위반건축물 여부, 사용승인일도 함께 불러와요.",
    ],
  },
  {
    title: "등기부 권리 입력",
    summary: "등기부등본을 보고 권리관계를 직접 넣어요.",
    points: [
      "을구의 근저당 채권최고액 합계와 선순위 보증금을 넣어요.",
      "갑구에서 신탁 등기가 있는지, 최근 소유자가 언제 바뀌었는지 넣어요.",
      "등기부는 공개 API가 없어 입력한 값을 그대로 판정에 써요.",
    ],
  },
  {
    title: "결과 확인",
    summary: "위험 신호 개수와 근거를 함께 봐요.",
    points: [
      "신호마다 주의·위험 수준과 근거 수치를 보여 줘요.",
      "시세 추정 방식과 신뢰도, 비교한 거래 목록을 함께 보여 줘요.",
      "데이터 기준일·출처와 면책 문구를 확인하고, 로그인하면 결과를 저장할 수 있어요.",
    ],
  },
] as const;

export function FlowSection() {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const [auto, setAuto] = useState(true);
  const { shown, hidden } = useContentSwap(selected);
  const choose = (index: number) => {
    setAuto(false);
    setSelected(index);
  };
  const { tabRef, onKeyDown } = useRovingTabs(FLOW_STEPS.length, choose);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;
  const step = FLOW_STEPS[shown];

  // 사용자가 탭을 고르면 멈춘다. 동작 줄이기면 처음부터 진행하지 않는다.
  useEffect(() => {
    if (!auto || prefersReducedMotion()) return;
    const timer = setTimeout(() => setSelected((i) => (i + 1) % FLOW_STEPS.length), FLOW_AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [auto, selected]);

  return (
    <LandingSection id="flow" title="이용 방법">
      <p className="mt-sm text-body-md text-body">세 단계면 결과를 볼 수 있어요.</p>
      <div className="mt-xl grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-xxl">
        <Reveal>
          <div role="tablist" aria-label="이용 단계" aria-orientation="vertical" className="flex flex-col gap-lg">
            {FLOW_STEPS.map((item, i) => {
              const current = i === selected;
              return (
                <button
                  key={item.title}
                  ref={tabRef(i)}
                  id={tabId(i)}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  aria-controls={panelId}
                  tabIndex={current ? 0 : -1}
                  onClick={() => choose(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className="flex flex-col gap-sm text-left"
                >
                  <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-surface-strong">
                    {current ? <ProgressFill key={`${i}-${auto}`} running={auto} /> : null}
                  </span>
                  <span className={`text-title-md ${current ? "text-ink" : "text-muted"}`}>
                    {i + 1}. {item.title}
                  </span>
                  <span className="text-body-sm text-muted">{item.summary}</span>
                </button>
              );
            })}
          </div>
        </Reveal>
        <Reveal delayMs={100} className="rounded-card bg-surface-soft p-lg">
          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId(shown)}
            tabIndex={0}
            className={`mx-auto flex max-w-[520px] flex-col gap-base rounded-card bg-canvas p-lg shadow-float transition-[opacity,transform,filter] duration-340 ease-fade ${
              hidden ? "translate-y-2.5 opacity-0 blur-xs" : ""
            }`}
          >
            <p className="text-caption text-muted">{shown + 1}단계</p>
            <p className="text-title-md text-ink">{step.title}</p>
            <ul className="flex flex-col gap-sm">
              {step.points.map((point, i) => (
                <li
                  key={point}
                  className={`border-t border-hairline-soft pt-sm text-body-sm text-body transition-[opacity,transform,filter] duration-340 ease-fade ${
                    hidden ? "translate-y-2.5 opacity-0 blur-xs" : ""
                  }`}
                  style={{ transitionDelay: hidden ? "0ms" : `${i * 100}ms` }}
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </LandingSection>
  );
}

// 현재 단계 진행 막대. 자동 진행 중이면 한 프레임 뒤 0→100%로 채우고, 멈추면 채운 채로 둔다.
function ProgressFill({ running }: { running: boolean }) {
  const [filled, setFilled] = useState(!running);

  useEffect(() => {
    if (filled) return;
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, [filled]);

  return (
    <span
      className="absolute inset-y-0 left-0 bg-ink"
      style={{
        width: filled ? "100%" : "0%",
        transitionProperty: running ? "width" : "none",
        transitionDuration: `${FLOW_AUTO_ADVANCE_MS}ms`,
        transitionTimingFunction: "linear",
      }}
    />
  );
}
