# Step 0: lookup-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (server는 feature를 import하지 않는다. 조합은 routes에서)
- `/docs/ADR.md` (ADR-004: 캐시 미스 시 같은 수집 함수로 온디맨드 보충)
- `/docs/PRD.md`
- `/src/consts/policy.ts` (`PRICE_ESTIMATE.lookbackMonths`)
- `/src/server/public-data/*` (phase 3: `juso.ts`, `molit-trade.ts`, `trade-keys.ts`, `official-price.ts`, `building.ts`)
- `/src/server/trades/*` (phase 4: `TradeRepository`, `ensureCollected`, `lookbackMonths`)
- `/src/features/judgment/types.ts` (`ComparableTrade`, `BuildingInfo`: 출력 구조를 맞출 대상. import하지 않는다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

주소 하나에 대해 판정에 필요한 공공데이터를 모두 모으는 서버 서비스를 만든다. 판정 계산은 하지 않는다.

### 1. 서비스 (`src/server/lookup/collect-inputs.ts`)

```ts
import "server-only";
export interface LookupTarget {
  address: NormalizedAddress;          // juso 결과
  houseType: TradeHouseType;
  exclusiveArea: number;
  dong: string | null;
  ho: string | null;
}
export interface PublicInputs {
  target: { buildingKey: string; lawdCd: string; umdName: string; houseType: "apartment" | "row-house"; exclusiveArea: number };
  saleTrades: Array<{ buildingKey: string; lawdCd: string; umdName: string; houseType: "apartment" | "row-house";
    exclusiveArea: number; floor: number | null; contractDate: Date; price: number; cancelled: boolean }>;  // price는 원
  officialPrice: number | null;         // 원
  officialPriceBaseYear: number | null;
  building: { mainPurpose: string | null; isViolation: boolean | null; useApprovalDate: Date | null };
  dataBaseDate: Date;                   // 사용한 실거래 캐시의 가장 오래된 수집일(없으면 asOf)
  warnings: LookupWarning[];            // 부분 실패
}
export type LookupWarning =
  | { kind: "trades-partial"; failedMonths: string[] }
  | { kind: "trades-quota" }
  | { kind: "official-price-unavailable"; reason: "no-ho" | "not-found" | "error" }
  | { kind: "building-unavailable" };
export async function collectPublicInputs(target: LookupTarget, deps: LookupDeps, asOf: Date): Promise<PublicInputs>;
```

- `saleTrades` 구조는 `ComparableTrade`와 같게 맞춘다(원 단위 = 만원 × 10,000, houseType 소문자 변환).
- 실거래: `lookbackMonths(asOf, PRICE_ESTIMATE.lookbackMonths)` 범위의 SALE 단위를 `ensureCollected`로 채운 뒤 repo에서 조회한다. 같은 법정동 전체를 조회해 same-building과 dong 단계 모두에 쓸 수 있게 한다.
- 대상 `buildingKey`는 `buildingKeyOf`(phase 3)로 juso 주소에서 만든다.
- 공시가격: 호가 없으면 호출하지 않고 경고. 건축물대장: 실패하면 모든 필드 `null` + 경고.
- **부분 실패는 예외가 아니라 `warnings`로 돌려준다.** 단, 실거래·공시가격·건축물대장이 모두 실패하면 `LookupFailedError`를 던진다.
- 세 API 호출은 서로 독립이므로 병렬로 한다.
- 의존성(`LookupDeps`: repo, 어댑터 함수들, now)은 주입받는다. 기본 의존성을 조립하는 `defaultLookupDeps()`를 따로 둔다(Prisma repo + 실제 어댑터).

### 2. 테스트 (`collect-inputs.test.ts`)

- in-memory repo + 가짜 어댑터로: 캐시 미스 → 수집 후 조회, 캐시 적중 → API 미호출, 만원→원 변환, 호 없음 경고, 건축물대장 실패 경고, 전부 실패 시 예외, `dataBaseDate` 계산, 병렬 호출.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `src/features/*`를 import하지 마라. 이유: server는 feature를 참조하지 않는다(ARCHITECTURE). 구조만 맞춘다.
- 판정 함수(`estimateSalePrice` 등)를 호출하지 마라. 이유: 조합은 routes 레이어(step 1~2)가 한다.
- 수집 로직을 다시 구현하지 마라. `ensureCollected`를 쓴다. 이유: ADR-004.
- 누락 데이터를 0이나 기본값으로 채우지 마라. 이유: 위험을 가린다.
- 기존 테스트를 깨뜨리지 마라.
