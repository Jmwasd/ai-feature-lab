// 판정 결과의 사용자 문구 원본이다. 화면은 이 파일의 문구만 쓴다.
// docs/UI_GUIDE.md §6 금지 표현을 쓰지 않는다. 단정 대신 기준과 근거 수치를 붙인다(CLAUDE.md CRITICAL).
// 기준 수치는 @/consts/policy에서 가져와 채운다.

import { DEBT_RATIO_THRESHOLD, HUG_GUARANTEE, JEONSE_RATIO_THRESHOLD } from "@/consts/policy";
import { formatIsoDate, formatPercent, formatWon } from "@/utils/format";
import type { Confidence, EstimateMethod } from "./price-estimate";
import type { HugReason, RatioResult } from "./ratios";
import type { RiskSignal, RiskSignalCode } from "./risk-report";
import type { RightsInput } from "./types";

export function headline(signalCount: number): string {
  return `위험 신호 ${signalCount}개`;
}

export const DISCLAIMER =
  "이 결과는 공공데이터와 사용자가 입력한 등기부 정보를 바탕으로 계산한 참고용 정보이며, 위험이 없음을 보장하지 않습니다. " +
  "근저당·신탁·소유자 변동 같은 권리관계는 사용자가 입력한 값에 의존하고, 공공데이터에는 신고 지연이 있어 최근 거래가 빠져 있을 수 있습니다. " +
  "계약 전 등기부등본을 직접 발급해 확인하고, 공인중개사나 법률 전문가의 확인을 받으세요.";

// 위험 신호가 0개일 때도 함께 보여 준다(UI_GUIDE §6 "위험 신호 0개" + 계약 당일 등기부 재확인 안내).
export const RECHECK_REGISTRY_NOTE =
  "권리관계는 입력한 등기부 기준입니다. 계약 당일 등기부등본을 다시 발급해 바뀐 권리가 없는지 확인하세요.";

export const SOURCES = [
  "국토교통부 실거래가",
  "공동주택 공시가격",
  "건축물대장",
  "사용자 입력(등기부)",
] as const;

export function reportingDelayNote(days: number): string {
  return `실거래는 계약 후 ${days}일 안에 신고하므로, 최근 ${days}일 거래는 신고가 끝나지 않아 반영되지 않았을 수 있습니다.`;
}

export function hugUnknownNote(reasons: HugReason[]): string {
  const missing = reasons.flatMap((r) =>
    r in MISSING_LABEL ? [MISSING_LABEL[r as MissingReason]] : [],
  );
  const exceeded = reasons.flatMap((r) =>
    r in EXCEED_TEXT ? [EXCEED_TEXT[r as ExceedReason]] : [],
  );
  let text = `${missing.join("·")} 정보가 없어 HUG 전세보증금반환보증 가입 기준 충족 여부를 판단하지 못했습니다.`;
  if (exceeded.length > 0) text += ` 확인된 초과 항목: ${exceeded.join(" ")}`;
  return text;
}

export const SIGNAL_COPY = {
  "jeonse-ratio-caution": {
    title: "전세가율 주의",
    detail: (ratio: number) =>
      `전세가율이 추정 시세의 ${formatPercent(ratio)}로 주의 기준 ${formatPercent(JEONSE_RATIO_THRESHOLD.caution)} 이상입니다.`,
  },
  "jeonse-ratio-danger": {
    title: "전세가율 위험",
    detail: (ratio: number) =>
      `전세가율이 추정 시세의 ${formatPercent(ratio)}로 위험 기준 ${formatPercent(JEONSE_RATIO_THRESHOLD.danger)} 이상입니다.`,
  },
  "debt-ratio-caution": {
    title: "부채비율 주의",
    detail: (input: DebtDetailInput) =>
      `${debtBasis(input)} 주의 기준 ${formatPercent(DEBT_RATIO_THRESHOLD.caution)} 이상입니다.`,
  },
  "debt-ratio-danger": {
    title: "부채비율 위험",
    detail: (input: DebtDetailInput) =>
      `${debtBasis(input)} 위험 기준 ${formatPercent(DEBT_RATIO_THRESHOLD.danger)} 이상입니다.`,
  },
  "hug-ineligible": {
    title: "HUG 보증 가입 어려움(공시가격 기준 추정)",
    detail: (reasons: HugReason[]) => {
      const exceeded = reasons.flatMap((r) =>
        r in EXCEED_TEXT ? [EXCEED_TEXT[r as ExceedReason]] : [],
      );
      return `${exceeded.join(" ")} 실제 가입 여부는 HUG 심사로 정해집니다.`.trimStart();
    },
  },
  "non-residential-use": {
    title: "주거용이 아닌 건축물 용도",
    detail: (mainPurpose: string) =>
      `건축물대장 주용도가 '${mainPurpose}'로 주거용이 아닙니다. 전세보증 가입이나 전세대출이 제한될 수 있습니다.`,
  },
  "violation-building": {
    title: "위반건축물",
    detail: () =>
      "건축물대장에 위반건축물로 표시되어 있습니다. 전세보증 가입이나 전세대출이 제한될 수 있습니다.",
  },
  "new-building": {
    title: "신축 건물",
    detail: (useApprovalDate: Date) =>
      `사용승인일이 ${formatDate(useApprovalDate)}인 신축 건물입니다. 비교할 거래가 적어 시세가 부풀려져 있을 수 있습니다.`,
  },
  "trust-registered": {
    title: "신탁 등기",
    detail: () =>
      "입력한 등기부 기준 신탁 등기가 있습니다. 임대 권한이 신탁회사에 있을 수 있어 신탁원부와 신탁회사 동의를 확인해야 합니다.",
  },
  "recent-ownership-change": {
    title: "최근 소유자 변동",
    detail: (changeDate: Date) =>
      `입력한 등기부 기준 ${formatDate(changeDate)}에 소유자가 바뀌었습니다. 새 소유자의 보증금 반환 능력을 확인해야 합니다.`,
  },
  "price-low-confidence": {
    title: "시세 추정 신뢰도 낮음",
    detail: () =>
      "비교할 실거래가 부족해 공시가격으로 시세를 추정했습니다. 전세가율과 부채비율이 실제와 다를 수 있습니다.",
  },
  "price-unavailable": {
    title: "시세 추정 불가",
    detail: () =>
      "비교할 실거래와 공시가격이 없어 시세를 추정하지 못했습니다. 전세가율과 부채비율을 계산하지 못했습니다.",
  },
} as const satisfies Record<
  RiskSignalCode,
  { title: string; detail: (...args: never[]) => string }
>;

// ---------------------------------------------------------------------------
// 결과 화면 라벨과 줄 문구
// ---------------------------------------------------------------------------

// 신호 수준 라벨. 배지는 이 두 가지뿐이다(UI_GUIDE §6).
export const LEVEL_LABEL = { caution: "주의", danger: "위험" } as const satisfies Record<
  RiskSignal["level"],
  string
>;

export const ESTIMATE_METHOD_LABEL: Record<EstimateMethod, string> = {
  "same-building": "같은 건물 실거래",
  "dong-unit-price": "같은 동 ㎡당 단가",
  "official-price": "공시가격 기준",
  none: "추정 불가",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
  none: "없음",
};

// 신호가 0개일 때 목록 자리에 둔다. 확인하지 못한 위험이 있을 수 있다는 사실을 함께 쓴다.
export const EMPTY_SIGNALS_NOTE =
  "확인한 항목에서 위험 신호가 나오지 않았어요. 입력하지 않은 권리관계나 공공데이터에 없는 위험은 반영되지 않아요.";

const CANNOT_JUDGE = "입력이 부족해 판단할 수 없어요";

export const HUG_STATUS = {
  eligible: "가입 기준 충족(공시가격 기준 추정)",
  ineligible: "가입 어려움(공시가격 기준 추정)",
  unknown: CANNOT_JUDGE,
} as const;

// normal이면 수준 대신 주의 기준 대비 사실을 쓴다(UI_GUIDE §6 "70% 미만").
export function ratioStatusText(result: RatioResult, threshold: { caution: number }): string {
  return result.level === "normal" ? `${formatPercent(threshold.caution)} 미만` : LEVEL_LABEL[result.level];
}

export function priorityRepaymentText(result: { qualifies: boolean; amount: number } | null): string {
  if (result === null) return CANNOT_JUDGE;
  if (result.qualifies)
    return `보증금이 소액임차인 기준 안이라 최우선변제 대상으로 추정돼요. 최우선변제액 최대 ${formatWon(result.amount)}`;
  return "보증금이 소액임차인 기준을 넘어 최우선변제 대상이 아니에요.";
}

// 권리 입력 값에는 근거를 붙인다(UI_GUIDE §6 "입력한 등기부 기준 근저당 0원").
export function rightsLines(rights: RightsInput): string[] {
  const basis = "입력한 등기부 기준";
  return [
    `${basis} 근저당 채권최고액 ${formatWon(rights.maxClaimAmount)}`,
    `${basis} 선순위 보증금 ${formatWon(rights.seniorDeposits)}`,
    `${basis} 신탁 등기 ${rights.isTrust ? "있음" : "없음"}`,
    rights.lastOwnershipChangeDate
      ? `${basis} 최근 소유자 변동일 ${formatIsoDate(rights.lastOwnershipChangeDate)}`
      : `${basis} 소유자 변동일 입력 없음`,
  ];
}

interface DebtDetailInput {
  ratio: number;
  maxClaimAmount: number;
  seniorDeposits: number;
  deposit: number;
}

type MissingReason = Extract<HugReason, `missing-${string}`>;
type ExceedReason = Extract<HugReason, `exceeds-${string}`>;

const MISSING_LABEL: Record<MissingReason, string> = {
  "missing-official-price": "공시가격",
  "missing-region": "수도권 여부",
};

const EXCEED_TEXT: Record<ExceedReason, string> = {
  "exceeds-price-cap": `보증금과 선순위채권 합계가 공시가격의 ${formatPercent(HUG_GUARANTEE.combinedRatio)}를 넘습니다.`,
  "exceeds-deposit-limit": `보증금이 보증 한도(수도권 ${formatWonExact(HUG_GUARANTEE.depositCap.capitalArea)}, 그 외 ${formatWonExact(HUG_GUARANTEE.depositCap.nonCapitalArea)})를 넘습니다.`,
};

function debtBasis({ ratio, maxClaimAmount, seniorDeposits, deposit }: DebtDetailInput): string {
  return (
    `입력한 등기부 기준 근저당 채권최고액 ${formatWonExact(maxClaimAmount)}, 선순위 보증금 ${formatWonExact(seniorDeposits)}에 ` +
    `보증금 ${formatWonExact(deposit)}을 더하면 추정 시세의 ${formatPercent(ratio)}로`
  );
}

// 판정 근거 문구는 금액을 원 단위까지 그대로 쓴다(예: "120,000,000원").
// 만 원 단위로 반올림하는 @/utils/format의 formatWon과 다르다.
function formatWonExact(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

// UTC 기준 YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
