"use client";

import {
  ClipboardCheck,
  Clock,
  FileLock,
  FileText,
  Landmark,
  MapPin,
  Percent,
  RefreshCw,
  Ruler,
  Scale,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DEBT_RATIO_THRESHOLD, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { ratioStatusText } from "@/features/judgment/copy";
import { debtRatio, jeonseRatio } from "@/features/judgment/ratios";
import { useContentSwap } from "@/hooks/use-content-swap";
import { prefersReducedMotion } from "@/hooks/use-reveal";
import { formatWholePercent, formatWon } from "@/utils/format";
import { LandingSection, SectionHeading } from "./LandingSection";
import { Reveal } from "./Reveal";
import { swapStyle } from "./swap-style";
import { TRY_EXAMPLE, TRY_INITIAL } from "./try-examples";
import { useRovingTabs } from "./use-roving-tabs";

// 단계 진행 탭 자동 진행 간격(UI_GUIDE §8)과 진행 막대 갱신 간격.
export const FLOW_AUTO_ADVANCE_MS = 4500;
const TICK_MS = 100;

const FLOW_STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "주소와 보증금", body: "공공데이터로 시세와 건물 정보를 찾아요", icon: MapPin },
  { title: "등기부 입력", body: "근저당, 신탁, 소유자 변동을 입력해요", icon: FileText },
  { title: "종합 판정", body: "두 비율과 HUG 가입 가능 여부를 봐요", icon: ClipboardCheck },
];


export function FlowSection() {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const { shown, hidden } = useContentSwap(selected);
  const choose = (index: number) => {
    elapsedRef.current = 0;
    setElapsed(0);
    setSelected(index);
  };
  const { tabRef, onKeyDown } = useRovingTabs(FLOW_STEPS.length, choose);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;
  const swapping = selected !== shown;

  // 진행 막대를 100ms마다 채우고 다 차면 다음 단계로 간다. 탭을 고르면 그 단계부터 다시 센다.
  // 내용 교체 중에는 멈춘다. 동작 줄이기면 자동 진행하지 않는다.
  useEffect(() => {
    if (swapping || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      const next = elapsedRef.current + TICK_MS;
      if (next >= FLOW_AUTO_ADVANCE_MS) {
        elapsedRef.current = 0;
        setElapsed(0);
        setSelected((i) => (i + 1) % FLOW_STEPS.length);
      } else {
        elapsedRef.current = next;
        setElapsed(next);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [swapping]);

  return (
    <LandingSection id="flow" className="grid grid-cols-1 gap-xl">
      <div className="grid max-w-prose gap-sm">
        <SectionHeading
          id="flow"
          icon={<Clock size={18} />}
          title="3분이면 끝나요"
          description="주소를 넣는 것부터 결과를 받기까지의 과정이에요."
        />
      </div>
      <Reveal delayMs={260}>
        <div role="tablist" aria-label="이용 단계" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-base">
          {FLOW_STEPS.map((step, i) => {
            const current = i === selected;
            const Icon = step.icon;
            const progress = i < selected ? 100 : current ? (elapsed / FLOW_AUTO_ADVANCE_MS) * 100 : 0;
            return (
              <button
                key={step.title}
                ref={tabRef(i)}
                id={tabId(i)}
                type="button"
                role="tab"
                aria-selected={current}
                aria-controls={panelId}
                tabIndex={current ? 0 : -1}
                onClick={() => choose(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className="grid gap-2.5 text-left"
              >
                <span className="block h-[3px] overflow-hidden rounded-full bg-surface-strong">
                  {/* 그라디언트는 진행 막대에만 쓴다(랜딩 시안, UI_GUIDE §7 예외). 동작 줄이기면 현재 단계를 꽉 채운다. */}
                  <span
                    className={`block h-full rounded-full bg-linear-to-r from-primary-disabled to-primary ${current ? "motion-reduce:w-full!" : ""}`}
                    style={{
                      width: `${progress}%`,
                      // 100ms마다 바뀌는 값 사이를 같은 시간의 linear 전환으로 메워 끊김 없이 채운다. 0으로 돌아갈 때는 전환하지 않는다.
                      transition: current && elapsed > 0 ? `width ${TICK_MS}ms linear` : "none",
                    }}
                  />
                </span>
                <span className="grid gap-xxs">
                  <span
                    className={`flex items-center gap-sm text-title-md transition-colors duration-320 ${current ? "text-ink" : "text-muted"}`}
                  >
                    <Icon aria-hidden="true" size={18} />
                    {step.title}
                  </span>
                  <span className="text-body-sm text-pretty text-muted">{step.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Reveal>
      <Reveal delayMs={400} className="grid min-h-[360px] place-items-center rounded-card bg-surface-soft p-[clamp(16px,4vw,48px)]">
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(shown)}
          tabIndex={0}
          className="grid w-full max-w-[520px] gap-base rounded-card bg-canvas p-lg shadow-float"
          style={swapStyle(hidden, { fadeMs: 480, riseMs: 720 })}
        >
          {shown === 0 ? <AddressPreview /> : shown === 1 ? <RightsPreview /> : <VerdictPreview />}
        </div>
      </Reveal>
    </LandingSection>
  );
}

// 미리보기 카드는 실제 화면을 흉내 낸 예시다. 금액과 비율은 "계산해 보기" 예시 집 값으로 맞춘다.
function PreviewField({ label, value, icon, focused = false }: { label: string; value: string; icon: ReactNode; focused?: boolean }) {
  return (
    <div className={`grid gap-xxs rounded-sm px-md py-2.5 ${focused ? "border-2 border-ink" : "border border-hairline"}`}>
      <span className="flex items-center gap-xs text-caption-sm text-muted">
        {icon}
        {label}
      </span>
      <span className="text-body-md text-ink">{value}</span>
    </div>
  );
}

function AddressPreview() {
  return (
    <div className="grid gap-base">
      <p className="text-caption text-muted">1 / 2 시세 쪽 판정</p>
      <PreviewField label="주소" value="서울 마포구 망원로 97, 302호" icon={<MapPin aria-hidden="true" size={12} />} focused />
      <div className="grid grid-cols-2 gap-md">
        <PreviewField label="전용면적" value="59.4㎡" icon={<Ruler aria-hidden="true" size={12} />} />
        <PreviewField label="보증금" value={formatWon(TRY_INITIAL.deposit)} icon={<Wallet aria-hidden="true" size={12} />} />
      </div>
      <p className="flex items-center gap-1.5 text-body-sm text-muted">
        <RefreshCw aria-hidden="true" size={14} />
        실거래가 6건 · 공시가격 · 건축물대장 자동 조회
      </p>
    </div>
  );
}

function RightsPreview() {
  return (
    <div className="grid gap-base">
      <p className="text-caption text-muted">2 / 2 등기부 권리 입력</p>
      <PreviewField
        label="근저당 채권최고액 합계"
        value={formatWon(TRY_INITIAL.maxClaimAmount)}
        icon={<Landmark aria-hidden="true" size={12} />}
        focused
      />
      <div className="grid gap-sm">
        <span className="flex items-center gap-1.5 text-caption text-ink">
          <FileLock aria-hidden="true" size={14} />
          신탁 등기가 있나요
        </span>
        <div className="flex gap-sm">
          <span className="rounded-sm border-2 border-ink px-4.5 py-2.5 text-button-sm text-ink">아니오</span>
          <span className="rounded-sm border border-hairline px-4.5 py-2.5 text-button-sm text-ink">예</span>
        </div>
      </div>
      <p className="flex items-start gap-1.5 text-body-sm text-muted">
        <FileText aria-hidden="true" size={14} className="mt-xxs shrink-0" />
        인터넷등기소에서 뗀 등기부 을구·갑구를 보고 입력해요
      </p>
    </div>
  );
}

function VerdictPreview() {
  const { estimatedPrice } = TRY_EXAMPLE;
  const { deposit, maxClaimAmount } = TRY_INITIAL;
  const jr = jeonseRatio(deposit, estimatedPrice)!;
  const dr = debtRatio({ deposit, maxClaimAmount, seniorDeposits: 0, estimatedPrice })!;
  const ratios = [
    { label: "전세가율", icon: Percent, result: jr, threshold: JEONSE_RATIO_THRESHOLD },
    { label: "부채비율", icon: Scale, result: dr, threshold: DEBT_RATIO_THRESHOLD },
  ];

  return (
    <div className="grid gap-base">
      <p className="text-caption text-muted">종합 판정</p>
      <div className="grid grid-cols-2 gap-base">
        {ratios.map(({ label, icon: Icon, result, threshold }) => (
          <div key={label} className="grid gap-xxs">
            <span className="flex items-center gap-xs text-caption text-muted">
              <Icon aria-hidden="true" size={14} />
              {label}
            </span>
            <span className="text-display-xl tabular-nums text-ink">{formatWholePercent(result.ratio)}</span>
            <span className={`text-caption ${result.level === "danger" ? "text-error-text" : "text-ink"}`}>
              {ratioStatusText(result, threshold)}
            </span>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 border-t border-hairline-soft pt-md text-body-sm text-error-text">
        <TriangleAlert aria-hidden="true" size={14} />
        위험 신호 3개 · HUG 보증보험 가입 어려움
      </p>
    </div>
  );
}
