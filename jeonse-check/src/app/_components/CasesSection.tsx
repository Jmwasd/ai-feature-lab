"use client";

import { Building2, CircleAlert, CircleCheck, CircleX, FileLock, House, Landmark, ReceiptText, Store, TrendingDown, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { DEBT_RATIO_THRESHOLD, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { HUG_STATUS } from "@/features/judgment/copy";
import { useApproach } from "@/hooks/use-approach";
import { useContentSwap } from "@/hooks/use-content-swap";
import { useReveal } from "@/hooks/use-reveal";
import { formatPercent, formatWholePercent, formatWon } from "@/utils/format";
import { LANDING_CASES, evaluateCase } from "./cases-data";
import { LandingSection, SectionHeading } from "./LandingSection";
import { Reveal } from "./Reveal";
import { swapStyle } from "./swap-style";
import { useRovingTabs } from "./use-roving-tabs";

const TAB_ICONS = [TrendingDown, CircleAlert, Landmark, FileLock, Store];
// 시안은 깡통전세를 먼저 보여 준다.
const INITIAL_CASE = 1;
// 비교 막대 트랙 끝이 나타내는 추정 시세 대비 비율. 넘는 값은 끝까지 채운다.
const COMPARE_TRACK_MAX = 1.2;

const EVALUATED = LANDING_CASES.map((c) => ({ case: c, ...evaluateCase(c) }));


export function CasesSection() {
  const baseId = useId();
  const [selected, setSelected] = useState(INITIAL_CASE);
  const { shown, hidden } = useContentSwap(selected);
  const { tabRef, onKeyDown } = useRovingTabs(EVALUATED.length, setSelected);
  const { ref, visible } = useReveal<HTMLDivElement>();
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;
  const { case: c, jr, dr, hugOk, signals } = EVALUATED[shown];
  const jrShown = useApproach(jr.ratio * 100, visible);
  const drShown = useApproach(dr.ratio * 100, visible);

  return (
    <LandingSection id="cases" className="grid grid-cols-1 gap-xl">
      <div ref={ref} className="grid max-w-prose gap-sm">
        <SectionHeading
          id="cases"
          icon={<House size={18} />}
          title="이런 집은 이렇게 보여요"
          description="자주 나오는 다섯 가지 경우를 골라 보세요. 결과 화면에 실제로 뜨는 숫자와 신호예요."
        />
      </div>
      <Reveal delayMs={260}>
        <div role="tablist" aria-label="사례" className="flex gap-sm overflow-x-auto pb-xs">
          {EVALUATED.map(({ case: item }, i) => {
            const Icon = TAB_ICONS[i];
            const current = i === selected;
            return (
              <button
                key={item.id}
                ref={tabRef(i)}
                id={tabId(i)}
                type="button"
                role="tab"
                aria-selected={current}
                aria-controls={panelId}
                tabIndex={current ? 0 : -1}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`flex min-h-11 shrink-0 items-center gap-sm rounded-full border px-4.5 text-button-sm transition-colors duration-320 ${
                  current ? "border-ink bg-ink text-canvas" : "border-hairline bg-canvas text-ink"
                }`}
              >
                <Icon aria-hidden="true" size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </Reveal>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(shown)}
        tabIndex={0}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-xxl"
        style={swapStyle(hidden, { fadeMs: 420, riseMs: 640 })}
      >
        <div className="grid gap-lg">
          <div className="grid gap-xs">
            <p className="flex items-center gap-1.5 text-caption-sm text-muted">
              <Building2 aria-hidden="true" size={14} />
              예시 데이터 · {c.kind}
            </p>
            <p className="text-display-lg text-ink">{c.addr}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-body-sm tabular-nums text-muted">
              <ReceiptText aria-hidden="true" size={14} />
              보증금 {formatWon(c.deposit)} · 추정 시세 {formatWon(c.marketPrice)} · 근저당{" "}
              {c.maxClaimAmount > 0 ? formatWon(c.maxClaimAmount) : "없음"}
            </p>
          </div>
          <div className="grid gap-base">
            <CompareBar label="전세가율" percent={jrShown} threshold={JEONSE_RATIO_THRESHOLD.danger} />
            <CompareBar label="부채비율" percent={drShown} threshold={DEBT_RATIO_THRESHOLD.danger} />
          </div>
          <p data-testid="case-hug" className={`flex items-center gap-sm text-caption ${hugOk ? "text-ink" : "text-error-text"}`}>
            {hugOk ? <CircleCheck aria-hidden="true" size={16} /> : <CircleX aria-hidden="true" size={16} />}
            <span className="text-ink">
              HUG 보증보험 <span className={`font-bold ${hugOk ? "text-ink" : "text-error-text"}`}>{hugOk ? HUG_STATUS.eligible : "가입 어려움"}</span>
            </span>
          </p>
        </div>
        <div className="grid gap-md">
          <p className="text-display-sm text-ink">위험 신호 {signals.length}개</p>
          <ul className="grid">
            {signals.length > 0 ? (
              signals.map((signal, i) => (
                <SignalRow key={signal.title} title={signal.title} body={signal.body} danger hidden={hidden} delayMs={120 + i * 110} />
              ))
            ) : (
              <SignalRow
                title={`두 비율 모두 ${formatPercent(JEONSE_RATIO_THRESHOLD.caution)} 아래`}
                body="그래도 계약 당일 등기부를 다시 떼어 새 근저당이 없는지 확인하세요."
                danger={false}
                hidden={hidden}
                delayMs={80}
              />
            )}
          </ul>
        </div>
      </div>
    </LandingSection>
  );
}

// 비교 막대(UI_GUIDE §4): 추정 시세 대비 비율. 막대와 숫자는 트윈 값을 따르고, 세로 기준선은 policy.ts의 위험 기준이다.
function CompareBar({ label, percent, threshold }: { label: string; percent: number; threshold: number }) {
  const track = (value: number) => `${(Math.min(value, COMPARE_TRACK_MAX) / COMPARE_TRACK_MAX) * 100}%`;

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-md">
      <span className="text-caption text-muted">{label}</span>
      <div className="relative h-7 overflow-hidden rounded-sm bg-surface-soft">
        <div
          className={`absolute inset-y-0 left-0 rounded-sm ${percent / 100 >= threshold ? "bg-error-text" : "bg-ink"}`}
          style={{ width: track(percent / 100) }}
        />
        <div aria-hidden="true" className="absolute inset-y-0 w-px bg-border-strong" style={{ left: track(threshold) }} />
      </div>
      <span data-testid="compare-value" className="text-right text-title-md tabular-nums text-ink">
        {formatWholePercent(percent / 100)}
      </span>
    </div>
  );
}

// 신호 행(UI_GUIDE §4). 내용 교체 뒤 120ms부터 110ms씩 늦게 다시 나타난다.
// 위험은 triangle-alert + error-text, 그 외는 잉크색 circle-check(§6·§7).
function SignalRow({ title, body, danger, hidden, delayMs }: { title: string; body: string; danger: boolean; hidden: boolean; delayMs: number }) {
  const Icon = danger ? TriangleAlert : CircleCheck;

  return (
    <li
      data-testid="signal-row"
      className="flex gap-md border-t border-hairline-soft py-base"
      style={swapStyle(hidden, { fadeMs: 520, riseMs: 720 }, delayMs)}
    >
      <Icon aria-hidden="true" className={`mt-xxs size-5 shrink-0 ${danger ? "text-error-text" : "text-ink"}`} />
      <div className="grid min-w-0 gap-xxs">
        <p data-signal-title className="text-title-md text-ink">
          {title}
        </p>
        <p className="text-body-sm text-pretty text-body">{body}</p>
      </div>
    </li>
  );
}
