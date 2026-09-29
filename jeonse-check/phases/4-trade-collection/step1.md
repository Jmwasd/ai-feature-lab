# Step 1: collect-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (정책 수치 CRITICAL)
- `/docs/ARCHITECTURE.md` (server 레이어)
- `/docs/ADR.md` (ADR-004: CLI와 온디맨드 보충이 같은 수집 함수를 공유, 멱등)
- `/docs/PRD.md` (최근 30일 신고 지연)
- `/src/consts/policy.ts` (`PRICE_ESTIMATE.reportingDelayDays`)
- `/src/server/trades/*` (step 0: `TradeRepository`, in-memory 구현, 계약 테스트)
- `/src/server/public-data/molit-trade.ts`, `http.ts` (phase 3: `fetchTrades`, `PublicDataError`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

수집 단위(지역×계약월×유형×거래 종류) 하나를 받아 API → 저장 → 로그 기록까지 하는 함수와, 캐시가 신선한지 판단하는 함수를 만든다. CLI(step 2)와 phase 5의 온디맨드 보충이 이 함수를 공유한다.

### 1. 신선도 기준 (`src/consts/policy.ts`에 추가)

- `COLLECTION.recentRefreshDays`: 계약월이 신고 지연 기간 안에 걸친 단위는 수집 후 이 일수가 지나면 다시 받는다(예: 1일). 시행일 대신 "jeonse-check 제품 기준" 출처 주석.
- 신고 지연 기간이 끝난 과거 월은 한 번 수집하면 다시 받지 않는다. 단, 해제 반영을 위해 `COLLECTION.pastRefreshDays`(예: 30일)마다 다시 받는다. 두 값 모두 정책 파일에 둔다.

### 2. 수집 함수 (`src/server/trades/collect.ts`)

```ts
import "server-only";
export interface CollectDeps { repo: TradeRepository; fetchTrades: typeof fetchTrades; now: () => Date }
export async function collectUnit(unit: CollectionUnit, deps: CollectDeps): Promise<{ fetched: number; inserted: number; updated: number }>;
export function needsRefresh(unit: CollectionUnit, log: { collectedAt: Date } | null, now: Date): boolean;
export async function ensureCollected(units: CollectionUnit[], deps: CollectDeps & { concurrency?: number }): Promise<EnsureResult>;
export interface EnsureResult {
  refreshed: CollectionUnit[]; skipped: CollectionUnit[]; failed: { unit: CollectionUnit; error: PublicDataError }[];
  oldestCollectedAt: Date | null;   // 사용한 단위 중 가장 오래된 수집 시각 → 결과의 데이터 기준일
}
```

- `collectUnit` 순서: API 호출 → `upsertTrades` → `recordCollection`. API가 실패하면 저장하지 않고 로그도 남기지 않는다. 이유: 실패한 단위가 "수집됨"으로 기록되면 다시 받지 않는다.
- 결과 0건도 정상이다. `itemCount: 0`으로 로그를 남긴다.
- `ensureCollected`는 `needsRefresh`가 참인 단위만 받는다. 한 단위가 실패해도 나머지는 계속하고 `failed`에 모은다. 동시성 기본값은 낮게(예: 2) 둔다(API 한도).
- `quota` 오류가 나면 남은 단위 호출을 멈추고 모두 `failed`로 넣는다.
- 시계는 `deps.now`로 받는다. `new Date()`를 함수 안에서 직접 쓰지 마라.

### 3. 계약월 범위 유틸 (`src/server/trades/months.ts`)

```ts
export function monthRange(from: string, to: string): string[];        // "202401"~"202403" → 3개
export function lookbackMonths(asOf: Date, months: number): string[];  // asOf가 속한 달 포함
```

### 4. 테스트

- in-memory repo + 가짜 `fetchTrades`로: 성공 시 저장·로그, 실패 시 로그 없음, 같은 단위 재수집 멱등, `needsRefresh` 경계(최근 월/과거 월, 기준 일수 전후), 부분 실패, quota 중단, `oldestCollectedAt`.
- 기대값은 `policy.ts` 상수로 계산한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 신선도 일수를 `collect.ts`에 숫자로 쓰지 마라. 이유: CLAUDE.md CRITICAL.
- API 실패 시 로그를 남기거나 부분 결과를 저장하지 마라. 이유: 위 2번.
- CLI 인자 파싱이나 Next 코드를 넣지 마라. 이유: step 2와 phase 5가 이 함수를 호출만 한다.
- 테스트에서 실제 API·DB를 쓰지 마라. 이유: CLAUDE.md CRITICAL, Stop 훅.
- 기존 테스트를 깨뜨리지 마라.
