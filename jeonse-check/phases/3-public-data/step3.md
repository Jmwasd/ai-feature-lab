# Step 3: trade-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (외부 API 테스트 금지 CRITICAL)
- `/docs/ARCHITECTURE.md` (server 어댑터 규칙)
- `/docs/ADR.md` (ADR-004: 멱등 upsert, 해제 거래 처리)
- `/docs/PRD.md` (데이터 제약: 유형별 API, `LAWD_CD`+`DEAL_YMD`, 해제 거래 제외, 전용면적)
- `/prisma/schema.prisma` (`Trade`: 만원 단위, `buildingKey`, `dedupKey` 주석)
- `/src/server/public-data/*` (step 0·1: `http.ts`, `xml.ts`, `juso.ts`의 `umdName`·`jibun` 형식)
- `/src/features/judgment/types.ts` (`ComparableTrade`: phase 5에서 이 구조로 변환된다. import하지 않는다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

국토교통부 실거래가 API 어댑터를 만든다. 아파트·연립다세대 × 매매·전월세 4개 오퍼레이션이다(apis.data.go.kr `1613000/RTMSDataSvcAptTrade`, `RTMSDataSvcAptRent`, `RTMSDataSvcRHTrade`, `RTMSDataSvcRHRent`). 엔드포인트·파라미터·응답 필드명은 공공데이터포털 공식 명세로 확인한다.

### 1. 어댑터 (`src/server/public-data/molit-trade.ts`)

```ts
import "server-only";
export type TradeHouseType = "APARTMENT" | "ROW_HOUSE";   // Prisma enum과 같은 값
export type TradeDealKind = "SALE" | "LEASE";
export interface RawTrade {                                 // Prisma Trade 생성 입력과 구조가 같다(id, 타임스탬프 제외)
  houseType: TradeHouseType; dealKind: TradeDealKind;
  lawdCd: string; dealYmd: string; umdName: string; jibun: string | null; buildingName: string | null;
  exclusiveArea: number; floor: number | null; contractDate: Date;
  priceManwon: number | null; depositManwon: number | null; monthlyRentManwon: number | null;
  cancelled: boolean; cancelledDate: Date | null;
  buildingKey: string; dedupKey: string;
}
export async function fetchTrades(params: {
  houseType: TradeHouseType; dealKind: TradeDealKind; lawdCd: string; dealYmd: string;
}, options?: HttpOptions): Promise<RawTrade[]>;
```

- 페이지네이션: `totalCount`를 보고 모든 페이지를 받는다. 한 페이지 크기는 명세의 최대값을 쓴다.
- 금액 `"82,500"` → 만원 정수. 날짜는 연·월·일 필드를 합쳐 UTC 자정 `Date`로 만든다.
- 해제 거래: 해제 여부·해제 사유 발생일 필드(명세 확인)로 `cancelled`, `cancelledDate`를 채운다. **어댑터는 해제 거래를 버리지 않고 표시만 한다.** 이유: 이미 저장된 거래가 나중에 해제되면 upsert로 표시를 갱신해야 한다(ADR-004). 제외는 판정 단계(`estimateSalePrice`)가 한다.
- API 오류·한도 초과 응답은 `PublicDataError`로 바꾼다.

### 2. 키 규칙 (`src/server/public-data/trade-keys.ts`, 순수 함수)

```ts
export function normalizeJibun(jibun: string | null): string | null;  // 공백·앞자리 0·"번지" 제거, "산" 표기 통일
export function buildingKeyOf(input: { lawdCd: string; umdName: string; jibun: string | null; buildingName: string | null }): string;
export function dedupKeyOf(trade: Omit<RawTrade, "buildingKey" | "dedupKey">): string;
```

- `buildingKey`: `lawdCd|umdName|정규화 지번`. 지번이 없으면 `lawdCd|umdName|name:정규화 건물명`. phase 5에서 juso 주소로 같은 함수를 호출해 대상 건물 키를 만든다. 그래서 juso의 `umdName`·`jibun` 형식과 실거래가 응답 형식이 같은 키를 내는지 fixture로 확인하는 테스트를 둔다(리 단위 주소 포함).
- `dedupKey`: 거래를 식별하는 필드(유형, 거래 종류, 지역, 계약일, 지번, 건물명, 전용면적, 층, 금액)를 고정 순서로 잇는다. **`cancelled`와 `cancelledDate`는 넣지 않는다.** 이유: 해제되면 같은 거래의 표시만 바뀌어야 하는데, 키에 들어가면 새 행이 생긴다. null은 빈 문자열로, 면적은 소수 넷째 자리까지 고정 표기한다.

### 3. fixture와 테스트

- `__fixtures__/molit/`: 4개 오퍼레이션 정상 응답, 여러 페이지, 해제 거래 포함, 단일 항목(배열 아님), 결과 0건, 한도 초과 오류, 인증 오류.
- `molit-trade.test.ts`, `trade-keys.test.ts`: 필드 매핑, 금액 파싱, 페이지 합치기, 해제 표시, 같은 거래의 해제 전후 `dedupKey`가 같음, juso 주소와 거래의 `buildingKey` 일치.
- 서비스키가 있으면 명세 확인용으로 실제 응답을 **한 번만** 받아 fixture로 저장해도 된다(키 값 제거).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -rniE "serviceKey=[^&\"<]{10,}" src/server/public-data/__fixtures__ && exit 1 || true
```

## 금지사항

- 테스트에서 실제 API를 호출하지 마라. 이유: CLAUDE.md CRITICAL.
- 어댑터에서 해제 거래를 버리지 마라. 이유: 위 1번. 해제 반영이 upsert로 되어야 한다.
- `dedupKey`에 해제 관련 필드나 수집 시각을 넣지 마라. 이유: 재수집 시 중복 행이 생겨 ADR-004 멱등성이 깨진다.
- 금액을 원 단위로 바꿔 저장 입력에 넣지 마라. 이유: 스키마가 만원 단위 Int다. 원 변환은 phase 5에서 판정 입력을 만들 때 한다.
- DB에 쓰지 마라. 이유: phase 4 범위다.
- 오피스텔·단독다가구 오퍼레이션을 만들지 마라. 이유: PRD MVP 제외.
- 기존 테스트를 깨뜨리지 마라.
