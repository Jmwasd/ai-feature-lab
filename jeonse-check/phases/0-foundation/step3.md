# Step 3: price-estimate

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (feature 레이어 규칙: 순수 로직은 `server`를 import하지 않는다)
- `/docs/PRD.md` (시세 추정 근거·신뢰도 표시, 데이터 제약)
- `/docs/ADR.md` (ADR-005)
- `/src/consts/policy.ts` (step 2: 시세 추정 파라미터)
- `/prisma/schema.prisma` (step 1: `Trade` 필드 구성 참고용. import하지 않는다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

전세가율의 분모인 **매매 시세**를 비교 거래로 추정하는 순수 함수를 만든다. 네트워크, DB, 시계(`new Date()`)에 의존하지 않는다.

### 1. 도메인 타입 (`src/features/judgment/types.ts`)

```ts
export type HouseType = "apartment" | "row-house"; // 아파트, 연립다세대

export interface ComparableTrade {
  buildingKey: string;
  lawdCd: string;
  umdName: string;        // 법정동명
  houseType: HouseType;
  exclusiveArea: number;  // ㎡
  floor: number | null;
  contractDate: Date;
  price: number;          // 매매가, 원 단위 정수
  cancelled: boolean;
}
```

이 타입들은 feature 안에 정의한다. phase 1의 `src/server/` 어댑터 출력은 구조적으로 이 타입에 맞추고, 둘을 잇는 조합은 routes 레이어가 한다. 이유: server는 feature를 import할 수 없고, 순수 로직은 server를 import하지 않는다(ARCHITECTURE.md).

### 2. 추정 함수 (`src/features/judgment/price-estimate.ts`)

```ts
export type EstimateMethod = "same-building" | "dong-unit-price" | "official-price" | "none";
export type Confidence = "high" | "medium" | "low" | "none";

export interface PriceEstimate {
  price: number | null;          // 원 단위 정수
  method: EstimateMethod;
  confidence: Confidence;
  comparables: ComparableTrade[]; // 추정에 실제로 쓴 거래 (근거 표시용)
  periodFrom: Date;               // 비교 거래 조회 구간
  periodTo: Date;
}

export function estimateSalePrice(input: {
  target: { buildingKey: string; lawdCd: string; umdName: string; houseType: HouseType; exclusiveArea: number };
  saleTrades: ComparableTrade[];
  officialPrice?: number;         // 공시가격, 원
  asOf: Date;                     // 기준일. 호출자가 넘긴다
}): PriceEstimate;
```

추정 순서 (앞 단계에서 결과가 나오면 멈춘다):

1. **same-building** → confidence `high`: 같은 `buildingKey`, 같은 `houseType`, 전용면적 차이가 허용 오차 이내, 계약일이 `[asOf - 조회 기간, asOf]` 안에 있는 거래가 1건 이상이면 매매가의 중앙값을 쓴다.
2. **dong-unit-price** → confidence `medium`: 같은 `lawdCd`·`umdName`·`houseType`이고 조회 기간 안의 거래가 최소 거래 수 이상이면, ㎡당 단가의 중앙값 × 대상 전용면적을 쓴다. 이 단계에는 면적 허용 오차를 적용하지 않는다.
3. **official-price** → confidence `low`: `officialPrice`가 있으면 `officialPrice × 공시가격 기반 추정 배율`을 쓴다. `comparables`는 빈 배열이다.
4. **none** → `price: null`, confidence `none`

핵심 규칙:

- 해제된 거래(`cancelled: true`)는 모든 단계에서 제외한다.
- 모든 파라미터(허용 오차, 기간, 최소 거래 수, 배율)는 `@/consts/policy`에서 가져온다.
- 짝수 개 중앙값은 가운데 두 값의 평균으로 하고, 결과 금액은 원 단위 정수로 반올림한다.
- 추정할 수 없으면 `price: null`을 반환한다. 0이나 임의의 값으로 채우지 마라. 이유: 잘못된 시세는 전세가율을 왜곡해 위험을 가린다.
- 입력 배열을 변경하지 않는다.

### 3. 테스트 (`src/features/judgment/price-estimate.test.ts`)

- 각 단계가 선택되는 경우와 다음 단계로 폴백하는 경우
- 해제 거래 제외 (해제 거래만 있으면 다음 단계로 폴백)
- 면적 허용 오차 경계값 (정확히 3㎡ 차이는 포함, 초과는 제외)
- 조회 기간 경계 (기간 밖 거래 제외)
- 홀수·짝수 개 중앙값
- dong 단계에서 거래 수가 최소 거래 수 미만이면 폴백
- 아무 데이터도 없으면 `none`

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `src/server/`, `@prisma/client`, 생성된 Prisma 타입을 import하지 마라. 이유: 이 파일은 클라이언트와 서버 양쪽에서 쓰는 순수 로직이다.
- 함수 안에서 `new Date()`나 `Date.now()`로 기준일을 만들지 마라. 이유: 테스트가 날짜에 따라 흔들린다. 기준일은 `asOf`로 받는다.
- 전세가율이나 위험 신호를 이 파일에서 계산하지 마라. 이유: step 4, 5 범위다.
- 기존 테스트를 깨뜨리지 마라.
