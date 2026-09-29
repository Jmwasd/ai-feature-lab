// 정책 수치와 판정 기준값의 단일 원본이다(ADR-005). 다른 파일에 같은 값을 하드코딩하지 않는다.
// 금액은 원 단위 정수, 비율은 소수로 쓴다. 값을 바꾸면 위 주석의 시행일·출처도 함께 고친다.
// 법령·공공기관 수치는 2026-09-29에 아래 출처로 현행 여부를 확인했다.

// ---------------------------------------------------------------------------
// HUG 전세보증금반환보증
// ---------------------------------------------------------------------------

export const HUG_GUARANTEE = {
  // 시행일: 2023-05-01
  // 출처: 국토교통부 「전세사기 예방 및 피해 지원방안」(2023-02-02) — 공시가격 적용비율 150% → 140%
  publicPriceRatio: 1.4,
  // 시행일: 2023-05-01
  // 출처: 국토교통부 「전세사기 예방 및 피해 지원방안」(2023-02-02) — 담보인정비율 100% → 90%
  collateralRatio: 0.9,
  // 보증금 + 선순위채권 ≤ 공시가격 × combinedRatio(126%). 위 두 값의 곱이다.
  // 부동소수 오차(1.4 × 0.9 = 1.2599…)로 경계값이 거절되지 않도록 소수 넷째 자리에서 반올림한다.
  combinedRatio: Number((1.4 * 0.9).toFixed(4)),
  // 보증 대상 전세보증금 상한
  // 시행일: 2023-05-01 기준 운영 중
  // 출처: 주택도시보증공사 전세보증금반환보증 상품개요 https://www.khug.or.kr/hug/web/ig/dr/igdr000001.jsp
  depositCap: {
    capitalArea: 700_000_000,
    nonCapitalArea: 500_000_000,
  },
} as const;

// ---------------------------------------------------------------------------
// 최우선변제(소액임차인)
// ---------------------------------------------------------------------------

// 주택임대차보호법 시행령 제10조·제11조의 지역 구분
export const PRIORITY_REPAYMENT_REGION = {
  // 서울특별시
  SEOUL: "SEOUL",
  // 「수도권정비계획법」에 따른 과밀억제권역(서울 제외), 세종, 용인, 화성, 김포
  OVERCROWDED_CAPITAL: "OVERCROWDED_CAPITAL",
  // 광역시(과밀억제권역·군 지역 제외), 안산, 광주, 파주, 이천, 평택
  METROPOLITAN: "METROPOLITAN",
  // 그 밖의 지역
  OTHER: "OTHER",
} as const;

export type PriorityRepaymentRegion =
  (typeof PRIORITY_REPAYMENT_REGION)[keyof typeof PRIORITY_REPAYMENT_REGION];

// depositCap: 소액임차인이 되는 보증금 상한(제11조), repaymentAmount: 최우선변제액(제10조 제1항)
// 시행일: 2023-02-21 (2023-02-21 전에 담보물권을 취득한 자에 대해서는 종전 규정 적용, 부칙)
// 출처: 주택임대차보호법 시행령 제10조 제1항, 제11조 https://www.law.go.kr/법령/주택임대차보호법시행령
//       찾기쉬운 생활법령정보 소액보증금 우선변제(2026-09-15 기준) https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=629&ccfNo=5&cciNo=2&cnpClsNo=2
export const PRIORITY_REPAYMENT: Readonly<
  Record<PriorityRepaymentRegion, { readonly depositCap: number; readonly repaymentAmount: number }>
> = {
  SEOUL: { depositCap: 165_000_000, repaymentAmount: 55_000_000 },
  OVERCROWDED_CAPITAL: { depositCap: 145_000_000, repaymentAmount: 48_000_000 },
  METROPOLITAN: { depositCap: 85_000_000, repaymentAmount: 28_000_000 },
  OTHER: { depositCap: 75_000_000, repaymentAmount: 25_000_000 },
} as const;

// 최우선변제액 합계는 주택가액의 1/2을 넘지 못한다.
// 시행일: 2023-02-21
// 출처: 주택임대차보호법 시행령 제10조 제2항
export const PRIORITY_REPAYMENT_HOUSE_VALUE_CAP_RATIO = 0.5;

// ---------------------------------------------------------------------------
// 전세가율 임계치
// ---------------------------------------------------------------------------

// 전세가율 = 보증금 ÷ 추정 매매가
// 출처: jeonse-check 제품 기준
export const JEONSE_RATIO_THRESHOLD = {
  caution: 0.7,
  danger: 0.8,
} as const;

// ---------------------------------------------------------------------------
// 부채비율 임계치
// ---------------------------------------------------------------------------

// 부채비율 = (근저당 채권최고액 + 선순위 보증금 + 내 보증금) ÷ 추정 매매가
// 출처: jeonse-check 제품 기준
export const DEBT_RATIO_THRESHOLD = {
  caution: 0.7,
  danger: 0.8,
} as const;

// ---------------------------------------------------------------------------
// 매매 시세 추정 파라미터
// ---------------------------------------------------------------------------

export const PRICE_ESTIMATE = {
  // 비교 거래로 인정하는 전용면적 허용 오차(±㎡)
  // 출처: jeonse-check 제품 기준
  areaToleranceSqm: 3,
  // 비교 거래 조회 기간(개월)
  // 출처: jeonse-check 제품 기준
  lookbackMonths: 12,
  // 동 단위 ㎡당 단가 추정에 필요한 최소 거래 수
  // 출처: jeonse-check 제품 기준
  minTradesForUnitPrice: 3,
  // 공시가격 기반 매매가 추정 배율. HUG 공시가격 적용비율(HUG_GUARANTEE.publicPriceRatio)을 참고했지만
  // 시세 추정용이라 용도가 다르므로 따로 둔다.
  // 출처: jeonse-check 제품 기준
  publicPriceMultiplier: 1.4,
  // 실거래 신고 지연 기간(일). 계약일로부터 30일 이내 신고하므로 최근 30일치는 덜 신고됐을 수 있다.
  // 출처: 부동산 거래신고 등에 관한 법률 제3조 제1항
  reportingDelayDays: 30,
} as const;

// ---------------------------------------------------------------------------
// 위험 신호 기준
// ---------------------------------------------------------------------------

export const RISK_SIGNAL = {
  // 사용승인일로부터 이 기간 이내면 신축으로 본다(년)
  // 출처: jeonse-check 제품 기준
  newBuildYears: 2,
  // 이 기간 이내 소유자 변동이 있으면 위험 신호로 본다(개월)
  // 출처: jeonse-check 제품 기준
  recentOwnerChangeMonths: 3,
} as const;
