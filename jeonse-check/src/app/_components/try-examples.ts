// "계산해 보기" 예시값. 정책 수치가 아니라 화면용 예시라서 policy.ts에 두지 않는다.
// 금액은 원 단위 정수다. 프리셋 금액은 슬라이더 step에 맞춘다.

export interface TryPreset {
  label: string;
  estimatedPrice: number; // 추정 매매가
  officialPrice: number; // 공시가격
  isCapitalArea: boolean;
  deposit: number;
  maxClaimAmount: number; // 근저당 채권최고액
}

export const TRY_PRESETS: readonly TryPreset[] = [
  {
    label: "보증금이 낮을 때",
    estimatedPrice: 300_000_000,
    officialPrice: 200_000_000,
    isCapitalArea: true,
    deposit: 180_000_000,
    maxClaimAmount: 0,
  },
  {
    label: "근저당이 많을 때",
    estimatedPrice: 300_000_000,
    officialPrice: 200_000_000,
    isCapitalArea: true,
    deposit: 150_000_000,
    maxClaimAmount: 120_000_000,
  },
  {
    label: "깡통전세에 가까울 때",
    estimatedPrice: 250_000_000,
    officialPrice: 160_000_000,
    isCapitalArea: true,
    deposit: 230_000_000,
    maxClaimAmount: 0,
  },
];

export const DEPOSIT_RANGE = { min: 50_000_000, max: 350_000_000, step: 5_000_000 } as const;
export const MAX_CLAIM_RANGE = { min: 0, max: 200_000_000, step: 5_000_000 } as const;
