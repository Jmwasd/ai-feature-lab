# Step 4: judgment-ratios

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (feature 레이어 규칙)
- `/docs/PRD.md` (종합 판정: 부채비율, HUG 가입 가능 여부)
- `/docs/ADR.md` (ADR-005)
- `/src/consts/policy.ts` (step 2: HUG·최우선변제·임계치)
- `/src/features/judgment/types.ts`, `/src/features/judgment/price-estimate.ts` (step 3)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/features/judgment/ratios.ts`에 판정 비율과 가입 조건을 계산하는 순수 함수를 만든다. 금액 입력은 모두 원 단위 정수다.

```ts
export type RatioLevel = "normal" | "caution" | "danger";

export function jeonseRatio(deposit: number, estimatedPrice: number | null):
  { ratio: number; level: RatioLevel } | null;

export function debtRatio(input: {
  deposit: number;
  maxClaimAmount: number;   // 근저당 채권최고액 합계
  seniorDeposits: number;   // 선순위 임차보증금 합계
  estimatedPrice: number | null;
}): { ratio: number; level: RatioLevel } | null;

export function checkHugEligibility(input: {
  deposit: number;
  seniorDebt: number;              // 채권최고액 + 선순위 보증금
  officialPrice: number | null;    // 공시가격
  isCapitalArea: boolean | null;   // 수도권 여부
}): { eligible: boolean | "unknown"; reasons: HugReason[] };

export function checkPriorityRepayment(input: {
  deposit: number;
  regionTier: PriorityRegionTier | null; // policy.ts의 구간 enum
}): { qualifies: boolean; amount: number } | null;
```

`HugReason`은 판정 근거를 나타내는 코드 유니온으로 정의한다(예: `"exceeds-price-cap"`, `"exceeds-deposit-limit"`, `"missing-official-price"`, `"missing-region"`). 사용자에게 보여줄 문구는 step 5에서 붙인다.

핵심 규칙:

- 모든 비율·한도·금액 기준은 `@/consts/policy`에서만 가져온다. 이 파일에 숫자 리터럴 기준값을 쓰지 마라(CLAUDE.md CRITICAL).
- 시세나 필수 입력이 없으면 `null` 또는 `"unknown"`을 반환한다. 0으로 나누거나 누락값을 0으로 간주해 "가입 가능"으로 판정하지 마라. 이유: 입력 누락이 위험을 가리는 결과가 된다.
- level 경계: 비율이 주의 임계치 **이상**이면 `caution`, 위험 임계치 **이상**이면 `danger`.
- HUG 판정: `deposit + seniorDebt ≤ officialPrice × HUG 합산 비율`, 그리고 `deposit ≤ 지역별 보증 한도`를 둘 다 만족해야 `eligible: true`다. 판단에 필요한 입력이 하나라도 없으면 `"unknown"`이다. 결과가 true여도 실제 HUG 심사 결과를 보장하지 않으므로, 함수 JSDoc에 "공시가격 기준 추정치"라고 적는다.
- 최우선변제: 보증금이 구간 상한 이하이면 `qualifies: true`, `amount`는 구간 변제액과 보증금 중 작은 값이다. 구간을 모르면 `null`이다.

### 테스트 (`src/features/judgment/ratios.test.ts`)

- 전세가율·부채비율의 임계치 경계값(정확히 0.7, 0.8)과 시세 `null`
- HUG: 비율 초과, 한도 초과, 둘 다 통과, 각 입력 누락 시 `"unknown"`
- 최우선변제: 구간 상한 경계, 보증금이 변제액보다 작은 경우, 구간 `null`
- 테스트의 기대값은 `policy.ts` 상수로 계산해 만든다. 정책값이 바뀌어도 테스트 의도가 유지되게 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `src/server/`나 Prisma를 import하지 마라. 이유: 순수 로직이다.
- 위험 신호 목록이나 사용자 문구를 만들지 마라. 이유: step 5 범위다.
- LAWD_CD를 구간이나 수도권 여부로 변환하지 마라. 이유: phase 1 주소 계층 범위다. 이 step에서는 입력으로 받는다.
- 기존 테스트를 깨뜨리지 마라.
