// "계산해 보기" 예시값(랜딩 시안). 정책 수치가 아니라 화면용 예시라서 policy.ts에 두지 않는다.
// 금액은 원 단위 정수다. 프리셋 금액은 슬라이더 step에 맞춘다.

// 예시 집: 시세 3억 2,000만, 공시가격 2억 1,000만인 망원동 빌라.
export const TRY_EXAMPLE = {
  estimatedPrice: 320_000_000, // 추정 매매가
  officialPrice: 210_000_000, // 공시가격
  isCapitalArea: true,
} as const;

export const TRY_INITIAL = { deposit: 280_000_000, maxClaimAmount: 60_000_000 } as const;

export interface TryPreset {
  label: string;
  deposit: number;
  maxClaimAmount: number; // 근저당 채권최고액
}

export const TRY_PRESETS: readonly TryPreset[] = [
  { label: "보증금이 낮을 때", deposit: 200_000_000, maxClaimAmount: 0 },
  { label: "보증금이 높을 때", deposit: 300_000_000, maxClaimAmount: 0 },
  { label: "근저당이 있을 때", deposit: 220_000_000, maxClaimAmount: 120_000_000 },
];

export const DEPOSIT_RANGE = { min: 100_000_000, max: 360_000_000, step: 5_000_000 } as const;
export const MAX_CLAIM_RANGE = { min: 0, max: 160_000_000, step: 5_000_000 } as const;
