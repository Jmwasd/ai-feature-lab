# Step 5: building-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (외부 API 테스트 금지 CRITICAL)
- `/docs/ARCHITECTURE.md` (server 어댑터 규칙)
- `/docs/PRD.md` (건축물대장: 용도, 위반건축물 여부, 사용승인일)
- `/src/features/judgment/types.ts` (`BuildingInfo`: 이 구조로 돌려준다. import하지 않는다)
- `/src/features/judgment/risk-report.ts` (비주거 용도·위반·신축 신호가 이 값을 쓴다)
- `/src/server/public-data/*` (step 0~4: `http.ts`, `juso.ts`의 `admCd`·`isMountain`·`mainNo`·`subNo`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

국토교통부 건축HUB 건축물대장정보 서비스(apis.data.go.kr `1613000/BldRgstHubService`) 어댑터를 만든다. 표제부(예: `getBrTitleInfo`)로 주용도·사용승인일을 받는다. 오퍼레이션·파라미터(`sigunguCd`, `bjdongCd`, `platGbCd`, `bun`, `ji` 등)·응답 필드(`mainPurpsCdNm`, `useAprDay`, `dongNm` 등)는 공식 명세로 확인한다.

### 1. 어댑터 (`src/server/public-data/building.ts`)

```ts
import "server-only";
export interface BuildingRecord {
  mainPurpose: string | null;
  isViolation: boolean | null;
  useApprovalDate: Date | null;
  dongName: string | null;
}
export interface BuildingSummary {       // BuildingInfo와 구조가 같다
  mainPurpose: string | null;
  isViolation: boolean | null;
  useApprovalDate: Date | null;
}
export async function fetchBuildingRecords(address: {
  admCd: string; isMountain: boolean; mainNo: number; subNo: number;
}, options?: HttpOptions): Promise<BuildingRecord[]>;
export function summarizeBuilding(records: BuildingRecord[], dong: string | null): BuildingSummary;
```

- **위반건축물 여부**: 명세에서 위반건축물 여부를 주는 오퍼레이션·필드를 찾는다. 공개 API로 얻을 수 없으면 `isViolation: null`로 두고, 파일 상단 주석과 step summary에 "위반건축물 여부 미제공"과 확인한 명세 근거를 적는다. `false`로 채우지 마라.
- `summarizeBuilding` 규칙(한 필지에 여러 동이 있을 때):
  - 동 이름이 주어지고 일치하는 레코드가 있으면 그 레코드를 쓴다.
  - 없으면 보수적으로 합친다: 주거용이 아닌 주용도가 하나라도 있으면 그 용도, 위반이 하나라도 `true`면 `true`, 사용승인일은 가장 최근 값. 이유: 신호를 놓치는 쪽보다 확인을 권하는 쪽이 낫다.
  - 레코드가 없으면 모든 필드 `null`.
- 날짜 `"20210315"` → UTC 자정 `Date`. 빈 문자열은 `null`.

### 2. fixture와 테스트

- `__fixtures__/building/`: 단일 동, 여러 동(주거·근린생활시설 혼재), 사용승인일 없음, 결과 없음, 오류 응답.
- `building.test.ts`: 파라미터 변환(`admCd` → 시군구 5자리 + 법정동 5자리, 번·지 4자리 0채움, 산 구분), 동 일치 선택, 보수적 합치기, 빈 결과, 오류 변환.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 테스트에서 실제 API를 호출하지 마라. 이유: CLAUDE.md CRITICAL.
- 얻을 수 없는 값을 `false`나 기본값으로 채우지 마라. 이유: "위반 아님"으로 읽혀 위험을 가린다.
- 주거용 용도 목록을 이 파일에 따로 적지 마라. 이유: 목록이 두 곳에 있으면 어긋난다. `summarizeBuilding`이 주거용 판별을 해야 하므로, 지금 `src/features/judgment/risk-report.ts` 안에 있는 허용 용도 목록을 `src/consts/policy.ts`(`RISK_SIGNAL` 근처, 출처 주석 포함)로 옮기고 `risk-report.ts`와 이 어댑터가 함께 import한다. `risk-report.test.ts`가 계속 통과해야 한다.
- 기존 테스트를 깨뜨리지 마라.
