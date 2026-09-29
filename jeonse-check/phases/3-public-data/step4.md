# Step 4: official-price-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (외부 API 테스트 금지 CRITICAL)
- `/docs/ARCHITECTURE.md` (server 어댑터 규칙)
- `/.env.example` (`VWORLD_API_KEY`: 디지털트윈국토, data.go.kr 키와 별개)
- `/src/server/public-data/*` (step 0~3: `http.ts`, `juso.ts`의 `pnu`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

디지털트윈국토(vworld) 공동주택가격 속성조회 API 어댑터를 만든다. 공시가격은 호(세대) 단위라 PNU와 동·호가 필요하다. 엔드포인트(예: `api.vworld.kr/ned/data/getApartHousingPriceAttr`)·파라미터(`pnu`, `stdrYear`, `dongNm`, `hoNm`, `format`, `key`, `domain` 등)·응답 필드는 vworld 공식 명세로 확인한다.

### 1. 어댑터 (`src/server/public-data/official-price.ts`)

```ts
import "server-only";
export interface OfficialPrice {
  price: number;          // 공시가격, 원
  baseYear: number;       // 기준연도
  dongName: string | null;
  hoName: string | null;
  exclusiveArea: number | null;
}
export async function fetchOfficialPrice(params: {
  pnu: string; dong: string | null; ho: string; asOf: Date;
}, options?: HttpOptions): Promise<OfficialPrice | null>;
```

- 기준연도: `asOf`의 연도부터 조회하고, 결과가 없으면 한 해 전을 조회한다(공시 발표 전 기간). 두 해 모두 없으면 `null`.
- 동·호 문자열은 정규화해 비교한다("101동" vs "101", "1001호" vs "1001", 앞자리 0). 규칙을 순수 함수로 분리해 테스트한다.
- 동이 `null`이면 호만으로 찾되, 같은 호가 여러 동에 있으면 `null`을 돌려준다. 이유: 다른 세대의 공시가격을 쓰면 HUG 판정이 틀린다.
- vworld 키가 도메인에 묶여 서버 호출에 `domain` 파라미터가 필요하면, 값은 새 환경변수(`VWORLD_API_DOMAIN`)로 받고 `.env.example`에 발급처 설명과 함께 추가한다(CLAUDE.md).

### 2. fixture와 테스트

- `__fixtures__/vworld/`: 정상(단일·복수 세대), 당해 연도 없음 → 전년도, 결과 없음, 오류 응답.
- `official-price.test.ts`: 금액 매핑, 연도 폴백, 동·호 정규화 일치, 모호한 호 → `null`, 오류 변환.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 테스트에서 실제 vworld API를 호출하지 마라. 이유: CLAUDE.md CRITICAL.
- 동·호가 정확히 맞지 않을 때 같은 건물의 다른 세대나 평균값으로 대신하지 마라. 이유: HUG 기준(공시가격 × 비율)이 세대 단위다. `null`로 둔다.
- 공시가격에 배율(1.26, 1.4)을 곱하지 마라. 이유: 판정 feature가 `policy.ts`로 계산한다.
- `VWORLD_API_KEY`를 `DATA_GO_KR_SERVICE_KEY`로 대신하지 마라. 이유: 발급처가 다른 별개의 키다.
- 기존 테스트를 깨뜨리지 마라.
