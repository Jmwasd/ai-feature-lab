// "사례" 섹션 예시 데이터(랜딩 시안). 가상의 조건이며 실제 매물이 아니다. 금액은 원 단위 정수다.
// 비율·수준·HUG 판단은 판정 함수(ratios.ts)로 계산하고, 신호 문구는 시안의 랜딩 예시 문구를 쓴다.
// 결과 화면 신호 문구(copy.ts)와는 따로 둔다. 기준값(80%, 126%)은 policy.ts에서 가져온다.

import { HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { checkHugEligibility, debtRatio, hugPriceCap, jeonseRatio } from "@/features/judgment/ratios";
import { formatPercent, formatWholePercent, formatWon } from "@/utils/format";

export interface LandingCase {
  id: string;
  label: string;
  kind: string; // 용도 · 전용면적
  addr: string;
  deposit: number;
  marketPrice: number; // 추정 시세
  officialPrice: number; // 공시가격
  maxClaimAmount: number; // 근저당 채권최고액
  isTrust?: boolean;
  notHousing?: boolean; // 건축물대장상 주택이 아닌 용도
  extraSignals: CaseSignal[];
}

export interface CaseSignal {
  title: string;
  body: string;
}

export const LANDING_CASES: readonly LandingCase[] = [
  {
    id: "low-ratio-villa",
    label: "비율이 낮은 빌라",
    kind: "연립다세대 · 전용 59㎡",
    addr: "마포구 망원동 빌라",
    deposit: 220_000_000,
    marketPrice: 320_000_000,
    officialPrice: 210_000_000,
    maxClaimAmount: 0,
    extraSignals: [],
  },
  {
    id: "empty-jeonse",
    label: "깡통전세",
    kind: "연립다세대 · 전용 46㎡",
    addr: "강서구 화곡동 빌라",
    deposit: 290_000_000,
    marketPrice: 300_000_000,
    officialPrice: 190_000_000,
    maxClaimAmount: 0,
    extraSignals: [],
  },
  {
    id: "heavy-mortgage",
    label: "근저당 과다",
    kind: "연립다세대 · 전용 52㎡",
    addr: "관악구 봉천동 다세대",
    deposit: 180_000_000,
    marketPrice: 310_000_000,
    officialPrice: 205_000_000,
    maxClaimAmount: 120_000_000,
    extraSignals: [],
  },
  {
    id: "trust",
    label: "신탁 등기",
    kind: "연립다세대 · 전용 49㎡",
    addr: "은평구 불광동 빌라",
    deposit: 200_000_000,
    marketPrice: 330_000_000,
    officialPrice: 220_000_000,
    maxClaimAmount: 0,
    isTrust: true,
    extraSignals: [{ title: "신탁 등기", body: "소유권이 신탁사에 있어요. 신탁사 동의 없이 맺은 계약은 효력이 없을 수 있어요." }],
  },
  {
    id: "neighborhood-facility",
    label: "근린생활시설",
    kind: "제2종 근린생활시설 · 전용 38㎡",
    addr: "송파구 방이동 빌라",
    deposit: 190_000_000,
    marketPrice: 300_000_000,
    officialPrice: 180_000_000,
    maxClaimAmount: 0,
    notHousing: true,
    extraSignals: [
      { title: "주택이 아닌 용도", body: "건축물대장상 근린생활시설이에요. 주거용으로 쓰고 있어도 HUG 보증보험에 가입할 수 없어요." },
    ],
  },
];

export function evaluateCase(c: LandingCase) {
  const jr = jeonseRatio(c.deposit, c.marketPrice)!;
  const dr = debtRatio({ deposit: c.deposit, maxClaimAmount: c.maxClaimAmount, seniorDeposits: 0, estimatedPrice: c.marketPrice })!;
  const limit = hugPriceCap(c.officialPrice);
  const priceOk =
    checkHugEligibility({ deposit: c.deposit, seniorDebt: c.maxClaimAmount, officialPrice: c.officialPrice, isCapitalArea: true })
      .eligible === true;
  const hugOk = priceOk && !c.isTrust && !c.notHousing;

  const signals: CaseSignal[] = [];
  if (jr.level === "danger") {
    signals.push({
      title: `전세가율 ${formatWholePercent(jr.ratio)}`,
      body: `보증금이 추정 시세의 ${formatPercent(JEONSE_RATIO_THRESHOLD.danger)}를 넘어요. 집값이 조금만 내려도 보증금을 돌려받기 어려울 수 있어요.`,
    });
  }
  if (dr.level === "danger" && c.maxClaimAmount > 0) {
    signals.push({
      title: `부채비율 ${formatWholePercent(dr.ratio)}`,
      body: `근저당 ${formatWon(c.maxClaimAmount)}과 보증금을 더하면 추정 시세의 ${formatWholePercent(dr.ratio)}예요.`,
    });
  }
  signals.push(...c.extraSignals);
  // 신탁·용도 사유가 있으면 그 신호가 HUG 불가 이유를 설명하므로 따로 더하지 않는다.
  if (!priceOk && !c.isTrust && !c.notHousing) {
    signals.push({
      title: "HUG 보증보험 가입 어려움",
      body: `근저당과 보증금 합계가 공시가격×${formatPercent(HUG_GUARANTEE.combinedRatio)}인 ${formatWon(limit)}을 넘어요.`,
    });
  }

  return { jr, dr, hugOk, signals };
}
