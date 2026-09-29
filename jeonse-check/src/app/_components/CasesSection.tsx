"use client";

import { CircleAlert, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { DEBT_RATIO_THRESHOLD, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { RECHECK_REGISTRY_NOTE } from "@/features/judgment/copy";
import { estimateSalePrice, type Confidence, type EstimateMethod } from "@/features/judgment/price-estimate";
import { checkHugEligibility, debtRatio, jeonseRatio, type RatioResult } from "@/features/judgment/ratios";
import { buildRiskReport, type RiskSignal } from "@/features/judgment/risk-report";
import { useContentSwap } from "@/hooks/use-content-swap";
import { formatPercent, formatWon } from "@/utils/format";
import { CASE_AS_OF, CASE_DATA_BASE_DATE, LANDING_CASES, type LandingCase } from "./cases-data";
import { LandingSection } from "./LandingSection";
import { Reveal } from "./Reveal";
import { useRovingTabs } from "./use-roving-tabs";

const HOUSE_TYPE_TEXT = { apartment: "아파트", "row-house": "연립다세대" } as const;
const METHOD_TEXT: Record<EstimateMethod, string> = {
  "same-building": "같은 건물 실거래",
  "dong-unit-price": "같은 동 ㎡당 단가",
  "official-price": "공시가격 기준",
  none: "추정 불가",
};
const CONFIDENCE_TEXT: Record<Confidence, string> = { high: "높음", medium: "보통", low: "낮음", none: "없음" };
const LEVEL_TEXT = { caution: "주의", danger: "위험" } as const;

// 비교 막대 트랙 끝이 나타내는 추정 시세 대비 비율. 넘는 값은 끝까지 채우고 숫자로 실제 값을 보여 준다.
const COMPARE_TRACK_MAX = 1.2;

// 예시 입력을 판정 로직에 그대로 넣는다. 이 섹션에서 비율이나 신호를 다시 계산하지 않는다.
function judge(c: LandingCase) {
  const priceEstimate = estimateSalePrice({
    target: c.target,
    saleTrades: c.saleTrades,
    officialPrice: c.officialPrice,
    asOf: CASE_AS_OF,
  });
  const jr = jeonseRatio(c.deposit, priceEstimate.price);
  const dr = debtRatio({
    deposit: c.deposit,
    maxClaimAmount: c.rights.maxClaimAmount,
    seniorDeposits: c.rights.seniorDeposits,
    estimatedPrice: priceEstimate.price,
  });
  const report = buildRiskReport({
    deposit: c.deposit,
    priceEstimate,
    jeonseRatio: jr,
    debtRatio: dr,
    hug: checkHugEligibility({
      deposit: c.deposit,
      seniorDebt: c.rights.maxClaimAmount + c.rights.seniorDeposits,
      officialPrice: c.officialPrice,
      isCapitalArea: c.isCapitalArea,
    }),
    building: c.building,
    rights: c.rights,
    asOf: CASE_AS_OF,
    dataBaseDate: CASE_DATA_BASE_DATE,
  });
  return { priceEstimate, jr, dr, report };
}

const JUDGED = LANDING_CASES.map((c) => ({ case: c, ...judge(c) }));

export function CasesSection() {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const { shown, hidden } = useContentSwap(selected);
  const { tabRef, onKeyDown } = useRovingTabs(JUDGED.length, setSelected);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;
  const { case: c, priceEstimate, jr, dr, report } = JUDGED[shown];

  return (
    <LandingSection id="cases" title="사례">
      <p className="mt-sm text-body-md text-body">
        자주 문제가 되는 조건을 실제 판정 로직에 넣어 봤어요.{" "}
        <span className="text-caption text-muted">예시 데이터</span>
      </p>
      <Reveal className="mt-xl">
        <div role="tablist" aria-label="사례" className="-mx-gutter flex gap-sm overflow-x-auto px-gutter pb-xs">
          {JUDGED.map(({ case: item }, i) => (
            <button
              key={item.id}
              ref={tabRef(i)}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={i === selected}
              aria-controls={panelId}
              tabIndex={i === selected ? 0 : -1}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`h-11 shrink-0 rounded-full px-base text-button-sm transition-colors ${
                i === selected ? "bg-ink text-canvas" : "border border-hairline bg-canvas text-ink hover:bg-surface-soft"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Reveal>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(shown)}
        tabIndex={0}
        className={`mt-xl grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-xxl transition-[opacity,transform,filter] duration-340 ease-fade ${
          hidden ? "translate-y-2.5 opacity-0 blur-xs" : ""
        }`}
      >
        <div className="flex flex-col gap-xl">
          <div className="flex flex-col gap-xs">
            <p className="text-caption text-muted">예시 데이터 · {HOUSE_TYPE_TEXT[c.target.houseType]}</p>
            <p className="text-body-md text-body">{c.description}</p>
          </div>
          <dl className="flex flex-col gap-xs text-body-sm">
            <SummaryRow term="보증금" value={formatWon(c.deposit)} />
            <SummaryRow
              term="추정 시세"
              value={
                priceEstimate.price === null
                  ? METHOD_TEXT.none
                  : `${formatWon(priceEstimate.price)} · ${METHOD_TEXT[priceEstimate.method]} · 신뢰도 ${CONFIDENCE_TEXT[priceEstimate.confidence]}`
              }
            />
            <SummaryRow term="공시가격" value={formatWon(c.officialPrice)} />
            <SummaryRow term="건축물 용도" value={c.building.mainPurpose ?? "확인 안 됨"} />
            <SummaryRow term="사용승인일" value={c.building.useApprovalDate ? isoDate(c.building.useApprovalDate) : "확인 안 됨"} />
            <SummaryRow term="위반건축물" value={c.building.isViolation ? "표시 있음" : "표시 없음"} />
            <SummaryRow term="채권최고액(입력)" value={formatWon(c.rights.maxClaimAmount)} />
            <SummaryRow term="신탁 등기(입력)" value={c.rights.isTrust ? "있음" : "없음"} />
            <SummaryRow
              term="소유자 변동(입력)"
              value={c.rights.lastOwnershipChangeDate ? isoDate(c.rights.lastOwnershipChangeDate) : "없음"}
            />
          </dl>
          <CompareBars price={priceEstimate.price} jr={jr} dr={dr} />
        </div>
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <p data-testid="signal-count" className="text-rating-display tabular-nums text-ink">
              {report.signalCount}
            </p>
            <p className="text-display-sm text-ink">{report.headline}</p>
          </div>
          {report.signals.length > 0 ? (
            <ul>
              {report.signals.map((signal, i) => (
                <SignalRow key={signal.code} signal={signal} index={i} hidden={hidden} />
              ))}
            </ul>
          ) : null}
          <p className="text-body-sm text-body">{RECHECK_REGISTRY_NOTE}</p>
          <p className="text-caption-sm text-muted">
            예시 데이터 · 가상의 조건을 실제 판정 로직에 넣은 결과예요. 데이터 기준일 {isoDate(report.dataBaseDate)}
          </p>
        </div>
      </div>
    </LandingSection>
  );
}

function SummaryRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-md border-t border-hairline-soft pt-xs">
      <dt className="shrink-0 text-muted">{term}</dt>
      <dd className="text-right tabular-nums text-ink">{value}</dd>
    </div>
  );
}

// 비교 막대(UI_GUIDE §4): 추정 시세를 100%로 두고 보증금(전세가율)과 보증금+근저당(부채비율)을 견준다.
// 막대 값은 ratios.ts 결과이고, 세로 기준선은 policy.ts의 위험 기준이다.
function CompareBars({ price, jr, dr }: { price: number | null; jr: RatioResult | null; dr: RatioResult | null }) {
  if (price === null || !jr || !dr) {
    return <p className="text-body-sm text-muted">추정 시세가 없어 비율을 계산할 수 없어요.</p>;
  }

  return (
    <div className="flex flex-col gap-sm">
      <CompareBar label="추정 시세" ratio={1} fill="bg-muted-soft" />
      <CompareBar
        label="보증금"
        ratio={jr.ratio}
        threshold={JEONSE_RATIO_THRESHOLD.danger}
        fill={jr.level === "danger" ? "bg-error-text" : "bg-ink"}
      />
      <CompareBar
        label="부채 합계"
        ratio={dr.ratio}
        threshold={DEBT_RATIO_THRESHOLD.danger}
        fill={dr.level === "danger" ? "bg-error-text" : "bg-ink"}
      />
      <p className="text-caption-sm text-muted">
        추정 시세 대비 비율이에요. 부채 합계는 보증금에 입력한 근저당 채권최고액을 더한 값이에요. 세로선은 위험 기준(전세가율{" "}
        {formatPercent(JEONSE_RATIO_THRESHOLD.danger)}, 부채비율 {formatPercent(DEBT_RATIO_THRESHOLD.danger)})이에요.
      </p>
    </div>
  );
}

function CompareBar({ label, ratio, threshold, fill }: { label: string; ratio: number; threshold?: number; fill: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr_56px] items-center gap-sm">
      <span className="text-caption text-body">{label}</span>
      <div className="relative h-7 rounded-sm bg-surface-soft">
        <div
          className={`absolute inset-y-0 left-0 rounded-sm transition-[width] duration-1200 ease-fill ${fill}`}
          style={{ width: trackPercent(ratio) }}
        />
        {threshold === undefined ? null : (
          <div aria-hidden="true" className="absolute inset-y-0 w-px bg-border-strong" style={{ left: trackPercent(threshold) }} />
        )}
      </div>
      <span className="text-right text-caption tabular-nums text-ink">{formatPercent(ratio)}</span>
    </div>
  );
}

// 신호 행(UI_GUIDE §4). 수준은 아이콘과 라벨로 함께 표시한다(§6). 교체 후 행마다 100ms씩 늦게 나타난다(§5).
function SignalRow({ signal, index, hidden }: { signal: RiskSignal; index: number; hidden: boolean }) {
  const danger = signal.level === "danger";
  const Icon = danger ? TriangleAlert : CircleAlert;

  return (
    <li
      data-testid="signal-row"
      className={`flex gap-md border-t border-hairline-soft py-base transition-[opacity,transform,filter] duration-340 ease-fade ${
        hidden ? "translate-y-2.5 opacity-0 blur-xs" : ""
      }`}
      style={{ transitionDelay: hidden ? "0ms" : `${index * 100}ms` }}
    >
      <Icon aria-hidden="true" className={`mt-xxs size-5 shrink-0 ${danger ? "text-error-text" : "text-ink"}`} />
      <div className="flex flex-col gap-xs">
        <p className="flex flex-wrap items-baseline gap-sm">
          <span className="text-title-md text-ink">{signal.title}</span>
          <span className={`text-caption ${danger ? "text-error-text" : "text-ink"}`}>{LEVEL_TEXT[signal.level]}</span>
        </p>
        <p className="text-body-sm text-body">{signal.detail}</p>
      </div>
    </li>
  );
}

function trackPercent(ratio: number): string {
  return `${(Math.min(ratio, COMPARE_TRACK_MAX) / COMPARE_TRACK_MAX) * 100}%`;
}

// UTC 기준 YYYY-MM-DD
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
