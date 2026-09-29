# Step 1: judgment-run

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (결과 표시 CRITICAL)
- `/docs/ARCHITECTURE.md` (feature 순수 로직)
- `/src/features/judgment/*` (`price-estimate.ts`, `ratios.ts`, `risk-report.ts`, `region.ts`, `copy.ts`, `types.ts`, `ui/types.ts`의 `JudgmentView`)
- `/src/server/lookup/collect-inputs.ts` (step 0: `PublicInputs`, `LookupWarning` 구조. import하지 않는다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

공공데이터 입력 + 사용자 입력을 받아 판정 결과 전체(`JudgmentView`)를 만드는 순수 함수를 만든다. 지금까지 따로 있던 판정 함수들을 한 번에 호출하는 조립점이다.

### 1. 함수 (`src/features/judgment/run.ts`)

```ts
export interface JudgmentInput {
  address: { display: string; admCd: string; dong?: string; ho?: string };
  deposit: number;
  exclusiveArea: number;
  rights: RightsInput;
  publicData: {                         // PublicInputs와 구조가 같다
    target: ...; saleTrades: ComparableTrade[]; officialPrice: number | null;
    building: BuildingInfo; dataBaseDate: Date; warnings: JudgmentWarning[];
  };
  asOf: Date;
}
export function runJudgment(input: JudgmentInput): JudgmentView & { warnings: JudgmentWarning[] };
```

- 순서: `estimateSalePrice` → `jeonseRatio`·`debtRatio` → `priorityRegionTier`·`isCapitalArea`(admCd) → `checkHugEligibility`·`checkPriorityRepayment` → `buildRiskReport`.
- `debtRatio`의 채권최고액·선순위 보증금과 HUG의 `seniorDebt`는 같은 `rights`에서 만든다. 둘을 다르게 계산하지 마라.
- 공공데이터 경고(부분 실패)는 `report.notes`에 사용자 문구로 더한다. 문구는 `copy.ts`에 추가하고 금지 표현 테스트 대상에 넣는다.
- 모든 날짜는 `asOf`와 `dataBaseDate`로만 계산한다.

### 2. 테스트 (`run.test.ts`)

- 대표 시나리오 3개 이상(신호 없음, 깡통전세, 입력 부족)에서 결과가 개별 함수를 직접 호출한 결과와 같다.
- 경고가 notes로 들어간다. 금지 표현 없음.
- 지역 구간 `null`이면 최우선변제 `null`, HUG는 `"unknown"`.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `src/server/*`를 import하지 마라. 이유: 순수 로직이다.
- 개별 판정 함수의 규칙을 이 파일에서 다시 구현하거나 덮어쓰지 마라. 이유: 판정이 두 곳에서 달라진다.
- `new Date()`를 쓰지 마라. 이유: `asOf`로 받는다.
- 기존 테스트를 깨뜨리지 마라.
