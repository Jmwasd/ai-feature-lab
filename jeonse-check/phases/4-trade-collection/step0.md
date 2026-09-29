# Step 0: trade-repository

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (server 레이어: Prisma는 `src/server/db.ts`에서만 생성, raw SQL은 server 안에서만)
- `/docs/ADR.md` (ADR-003, ADR-004: 멱등 upsert)
- `/prisma/schema.prisma` (`Trade`, `CollectionLog`)
- `/src/server/db.ts`
- `/src/server/public-data/molit-trade.ts`, `trade-keys.ts` (phase 3: `RawTrade`, `TradeHouseType`, `TradeDealKind`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

실거래가 캐시 저장소를 인터페이스 + Prisma 구현 + in-memory 구현으로 만든다. 기본 `npm run test`는 DB 없이 in-memory 구현으로 돈다.

### 1. 인터페이스 (`src/server/trades/repository.ts`)

```ts
import "server-only";
export interface CollectionUnit { lawdCd: string; dealYmd: string; houseType: TradeHouseType; dealKind: TradeDealKind }
export interface StoredTrade extends RawTrade { id: string }
export interface TradeRepository {
  upsertTrades(trades: RawTrade[]): Promise<{ inserted: number; updated: number }>;
  recordCollection(unit: CollectionUnit, itemCount: number, collectedAt: Date): Promise<void>;
  getCollection(unit: CollectionUnit): Promise<{ collectedAt: Date; itemCount: number } | null>;
  findSaleTrades(query: {
    lawdCd: string; houseType: TradeHouseType; fromYmd: string; toYmd: string; umdName?: string; buildingKey?: string;
  }): Promise<StoredTrade[]>;
}
```

### 2. Prisma 구현 (`src/server/trades/prisma-repository.ts`)

- `upsertTrades`: `dedupKey` 기준 upsert. 이미 있는 행은 해제 여부(`cancelled`, `cancelledDate`)와 변할 수 있는 필드만 갱신한다. 한 번에 많은 행을 넣으므로 트랜잭션·배치(예: 500건 단위)로 나눈다. Prisma API로 느리면 `INSERT ... ON CONFLICT ("dedupKey") DO UPDATE` raw SQL을 이 파일 안에서만 쓴다(ADR-003).
- `inserted`/`updated` 개수를 정확히 센다(raw SQL이면 `xmax = 0` 같은 방법, 또는 사전 조회).
- `recordCollection`: `CollectionLog`의 unique 네 필드로 upsert.
- `findSaleTrades`: `dealKind = SALE`, 계약월 범위, 선택 조건. 해제 거래도 돌려준다(제외는 판정 단계). `exclusiveArea`(Decimal)는 number로 바꿔 돌려준다.

### 3. in-memory 구현 (`src/server/trades/memory-repository.ts`)

- 같은 인터페이스, 같은 의미(특히 `dedupKey` 멱등성과 해제 갱신). 테스트와 phase 5 서비스 테스트에서 쓴다. 제품 코드 경로에서 기본값으로 쓰지 마라.

### 4. 테스트 (`memory-repository.test.ts`)

- 계약 테스트를 함수(`describeTradeRepositoryContract(makeRepo)`)로 만들어 두고 in-memory 구현에 적용한다. step 3에서 같은 계약을 Prisma 구현에 적용한다.
- 같은 거래를 두 번 upsert → 행 1개, 두 번째는 `updated`. 해제 표시가 바뀐 재수집 → 행 1개, `cancelled: true`. 범위 조회 경계(`fromYmd`, `toYmd` 포함).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `src/server/db.ts` 밖에서 `new PrismaClient()`를 만들지 마라. 이유: ARCHITECTURE server 규칙.
- `dedupKey` 대신 `(lawdCd, dealYmd, ...)` 같은 nullable 복합키로 중복을 판별하지 마라. 이유: PostgreSQL에서 NULL끼리 다른 값이라 멱등성이 깨진다(phase 0 스키마 주석).
- 해제 거래를 삭제하지 마라. 이유: 표시만 갱신한다(ADR-004).
- 기본 `npm run test`에서 DB에 연결하지 마라. 이유: Stop 훅이 매 턴 돌리고, 하네스 세션에는 DB가 없다.
- 수집 로직(API 호출 → 저장)을 만들지 마라. 이유: step 1 범위다.
- 기존 테스트를 깨뜨리지 마라.
