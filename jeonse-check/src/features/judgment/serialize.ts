// JudgmentView의 Date를 ISO 문자열로 바꾼 직렬화 형식. Server Action 응답과 결과 저장(phase 6)이 같은 형식을 쓴다.
// 형식을 바꾸면 version을 올리고 이전 버전 역직렬화를 남긴다. 저장된 결과가 이 형식으로 남아 있다.

import type { PriceEstimate } from "./price-estimate";
import type { RiskReport } from "./risk-report";
import type { ComparableTrade, RightsInput } from "./types";
import type { JudgmentView } from "./ui/types";

export const SERIALIZED_VIEW_VERSION = 1;

type SerializedComparableTrade = Omit<ComparableTrade, "contractDate"> & { contractDate: string };

export interface SerializedJudgmentView
  extends Omit<JudgmentView, "report" | "priceEstimate" | "rights"> {
  version: typeof SERIALIZED_VIEW_VERSION;
  report: Omit<RiskReport, "dataBaseDate"> & { dataBaseDate: string };
  priceEstimate: Omit<PriceEstimate, "comparables" | "periodFrom" | "periodTo"> & {
    comparables: SerializedComparableTrade[];
    periodFrom: string;
    periodTo: string;
  };
  rights: Omit<RightsInput, "lastOwnershipChangeDate"> & { lastOwnershipChangeDate: string | null };
}

// 필드를 하나씩 옮긴다. runJudgment 결과처럼 뷰 밖의 필드가 붙어 와도 싣지 않는다.
export function serializeJudgmentView(view: JudgmentView): SerializedJudgmentView {
  const { priceEstimate, report, rights } = view;
  return {
    version: SERIALIZED_VIEW_VERSION,
    address: view.address,
    deposit: view.deposit,
    exclusiveArea: view.exclusiveArea,
    report: { ...report, dataBaseDate: report.dataBaseDate.toISOString() },
    priceEstimate: {
      ...priceEstimate,
      comparables: priceEstimate.comparables.map((trade) => ({
        ...trade,
        contractDate: trade.contractDate.toISOString(),
      })),
      periodFrom: priceEstimate.periodFrom.toISOString(),
      periodTo: priceEstimate.periodTo.toISOString(),
    },
    jeonseRatio: view.jeonseRatio,
    debtRatio: view.debtRatio,
    hug: view.hug,
    priorityRepayment: view.priorityRepayment,
    rights: { ...rights, lastOwnershipChangeDate: rights.lastOwnershipChangeDate?.toISOString() ?? null },
  };
}

/** 알 수 없는 버전이거나 날짜 문자열이 올바르지 않으면 예외를 던진다. */
export function deserializeJudgmentView(serialized: SerializedJudgmentView): JudgmentView {
  if (serialized.version !== SERIALIZED_VIEW_VERSION) {
    throw new Error(`지원하지 않는 결과 형식 버전: ${String(serialized.version)}`);
  }
  const { priceEstimate, report, rights } = serialized;
  return {
    address: serialized.address,
    deposit: serialized.deposit,
    exclusiveArea: serialized.exclusiveArea,
    report: { ...report, dataBaseDate: parseIso(report.dataBaseDate) },
    priceEstimate: {
      ...priceEstimate,
      comparables: priceEstimate.comparables.map((trade) => ({
        ...trade,
        contractDate: parseIso(trade.contractDate),
      })),
      periodFrom: parseIso(priceEstimate.periodFrom),
      periodTo: parseIso(priceEstimate.periodTo),
    },
    jeonseRatio: serialized.jeonseRatio,
    debtRatio: serialized.debtRatio,
    hug: serialized.hug,
    priorityRepayment: serialized.priorityRepayment,
    rights: {
      ...rights,
      lastOwnershipChangeDate: rights.lastOwnershipChangeDate === null ? null : parseIso(rights.lastOwnershipChangeDate),
    },
  };
}

function parseIso(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`날짜 형식 오류: ${value}`);
  return date;
}
