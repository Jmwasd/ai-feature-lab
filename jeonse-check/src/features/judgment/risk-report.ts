// 시세 쪽(자동)과 권리 쪽(사용자 입력) 판정을 합쳐 위험 신호 목록과 결과 요약을 만든다.
// 클라이언트·서버 양쪽에서 쓰는 순수 로직이다. 기준일은 asOf로 받고 기간 기준은 @/consts/policy에서 가져온다.
// 문구는 copy.ts에만 둔다.

import { PRICE_ESTIMATE, RISK_SIGNAL } from "@/consts/policy";
import {
  DISCLAIMER,
  SIGNAL_COPY,
  SOURCES,
  headline,
  hugUnknownNote,
  reportingDelayNote,
} from "./copy";
import { subtractMonthsUtc, type PriceEstimate } from "./price-estimate";
import type { checkHugEligibility, debtRatio, jeonseRatio } from "./ratios";
import type { BuildingInfo, RightsInput } from "./types";

export type RiskSignalCode =
  | "jeonse-ratio-caution"
  | "jeonse-ratio-danger"
  | "debt-ratio-caution"
  | "debt-ratio-danger"
  | "hug-ineligible"
  | "non-residential-use"
  | "violation-building"
  | "new-building"
  | "trust-registered"
  | "recent-ownership-change"
  | "price-low-confidence"
  | "price-unavailable";

export interface RiskSignal {
  code: RiskSignalCode;
  level: "caution" | "danger";
  title: string;
  detail: string;
}

export interface RiskReport {
  signals: RiskSignal[];
  signalCount: number;
  headline: string; // "위험 신호 N개"
  notes: string[]; // 신고 지연 안내, HUG unknown 안내 등 신호가 아닌 참고 사항
  disclaimer: string;
  sources: string[]; // 데이터 출처 목록
  dataBaseDate: Date; // 데이터 기준일
}

// 건축물대장 주용도명에 이 중 하나가 들어 있으면 주거용으로 본다(예: "공동주택", "공동주택(아파트)").
const RESIDENTIAL_PURPOSES = ["공동주택", "아파트", "연립주택", "다세대주택"] as const;

export function buildRiskReport(input: {
  deposit: number;
  priceEstimate: PriceEstimate;
  jeonseRatio: ReturnType<typeof jeonseRatio>;
  debtRatio: ReturnType<typeof debtRatio>;
  hug: ReturnType<typeof checkHugEligibility>;
  building: BuildingInfo;
  rights: RightsInput;
  asOf: Date;
  dataBaseDate: Date;
}): RiskReport {
  const { deposit, priceEstimate, building, rights, asOf } = input;
  const signals: RiskSignal[] = [];
  const notes: string[] = [reportingDelayNote(PRICE_ESTIMATE.reportingDelayDays)];

  const add = (code: RiskSignalCode, level: RiskSignal["level"], detail: string) =>
    signals.push({ code, level, title: SIGNAL_COPY[code].title, detail });

  const jr = input.jeonseRatio;
  if (jr?.level === "caution")
    add("jeonse-ratio-caution", "caution", SIGNAL_COPY["jeonse-ratio-caution"].detail(jr.ratio));
  if (jr?.level === "danger")
    add("jeonse-ratio-danger", "danger", SIGNAL_COPY["jeonse-ratio-danger"].detail(jr.ratio));

  const dr = input.debtRatio;
  if (dr && dr.level !== "normal") {
    const detailInput = {
      ratio: dr.ratio,
      maxClaimAmount: rights.maxClaimAmount,
      seniorDeposits: rights.seniorDeposits,
      deposit,
    };
    if (dr.level === "caution")
      add("debt-ratio-caution", "caution", SIGNAL_COPY["debt-ratio-caution"].detail(detailInput));
    else add("debt-ratio-danger", "danger", SIGNAL_COPY["debt-ratio-danger"].detail(detailInput));
  }

  if (input.hug.eligible === false) {
    add("hug-ineligible", "danger", SIGNAL_COPY["hug-ineligible"].detail(input.hug.reasons));
  } else if (input.hug.eligible === "unknown") {
    notes.push(hugUnknownNote(input.hug.reasons));
  }

  const purpose = building.mainPurpose?.trim();
  if (purpose && !RESIDENTIAL_PURPOSES.some((p) => purpose.includes(p))) {
    add("non-residential-use", "danger", SIGNAL_COPY["non-residential-use"].detail(purpose));
  }

  if (building.isViolation === true) {
    add("violation-building", "danger", SIGNAL_COPY["violation-building"].detail());
  }

  const approval = building.useApprovalDate;
  if (approval && isOnOrAfter(approval, subtractMonthsUtc(asOf, RISK_SIGNAL.newBuildYears * 12))) {
    add("new-building", "caution", SIGNAL_COPY["new-building"].detail(approval));
  }

  if (rights.isTrust) {
    add("trust-registered", "danger", SIGNAL_COPY["trust-registered"].detail());
  }

  const ownerChange = rights.lastOwnershipChangeDate;
  if (
    ownerChange &&
    isOnOrAfter(ownerChange, subtractMonthsUtc(asOf, RISK_SIGNAL.recentOwnerChangeMonths))
  ) {
    add(
      "recent-ownership-change",
      "caution",
      SIGNAL_COPY["recent-ownership-change"].detail(ownerChange),
    );
  }

  if (priceEstimate.method === "none") {
    add("price-unavailable", "caution", SIGNAL_COPY["price-unavailable"].detail());
  } else if (priceEstimate.confidence === "low") {
    add("price-low-confidence", "caution", SIGNAL_COPY["price-low-confidence"].detail());
  }

  return {
    signals,
    signalCount: signals.length,
    headline: headline(signals.length),
    notes,
    disclaimer: DISCLAIMER,
    sources: [...SOURCES],
    dataBaseDate: input.dataBaseDate,
  };
}

function isOnOrAfter(date: Date, cutoff: Date): boolean {
  return date.getTime() >= cutoff.getTime();
}
