# Step 5: risk-report

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` ("안전" 단정 표현 금지, 면책 문구·데이터 기준일·출처 표시 CRITICAL)
- `/docs/ARCHITECTURE.md` (결과 표시 규칙, feature 레이어 규칙)
- `/docs/PRD.md` (종합 판정, 데이터 제약: 최근 30일 신고 지연)
- `/src/consts/policy.ts` (step 2: 신축 기간, 소유자 변동 기간, 신고 지연 기간)
- `/src/features/judgment/types.ts`, `price-estimate.ts` (step 3)
- `/src/features/judgment/ratios.ts` (step 4)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

시세 쪽(자동)과 권리 쪽(사용자 입력) 판정을 합쳐 위험 신호 목록과 결과 요약을 만드는 순수 함수, 그리고 사용자 문구를 만든다.

### 1. 입력 타입 (`src/features/judgment/types.ts`에 추가)

```ts
export interface BuildingInfo {
  mainPurpose: string | null;     // 건축물대장 주용도명
  isViolation: boolean | null;    // 위반건축물 여부
  useApprovalDate: Date | null;   // 사용승인일
}

export interface RightsInput {     // 사용자가 등기부를 보고 입력
  maxClaimAmount: number;          // 근저당 채권최고액 합계, 원
  seniorDeposits: number;          // 선순위 임차보증금 합계, 원
  isTrust: boolean;                // 신탁 등기 여부
  lastOwnershipChangeDate: Date | null;
}
```

### 2. 보고서 (`src/features/judgment/risk-report.ts`)

```ts
export type RiskSignalCode =
  | "jeonse-ratio-caution" | "jeonse-ratio-danger"
  | "debt-ratio-caution" | "debt-ratio-danger"
  | "hug-ineligible"
  | "non-residential-use" | "violation-building" | "new-building"
  | "trust-registered" | "recent-ownership-change"
  | "price-low-confidence" | "price-unavailable";

export interface RiskSignal {
  code: RiskSignalCode;
  level: "caution" | "danger";
  title: string;
  detail: string;
}

export interface RiskReport {
  signals: RiskSignal[];
  signalCount: number;
  headline: string;           // "위험 신호 N개"
  notes: string[];            // 신고 지연 안내, HUG unknown 안내 등 신호가 아닌 참고 사항
  disclaimer: string;
  sources: string[];          // 데이터 출처 목록
  dataBaseDate: Date;         // 데이터 기준일
}

export function buildRiskReport(input: {
  deposit: number;
  priceEstimate: PriceEstimate;
  jeonseRatio: ReturnType<typeof jeonseRatio>;
  debtRatio: ReturnType<typeof debtRatio>;
  hug: ReturnType<typeof checkHugEligibility>;
  building: BuildingInfo;
  rights: RightsInput;
  asOf: Date;
  dataBaseDate: Date;
}): RiskReport;
```

신호 규칙:

- 전세가율·부채비율: level이 `caution`이면 `*-caution`, `danger`면 `*-danger` 신호 1개. `normal`이나 `null`이면 신호 없음.
- `hug-ineligible`: `eligible === false`일 때만. `"unknown"`이면 신호 대신 `notes`에 입력 부족 안내를 넣는다.
- `non-residential-use`: 주용도가 주거용(공동주택, 아파트, 연립주택, 다세대주택)이 아닐 때. 허용 용도 목록은 이 feature 안의 상수로 둔다. `null`이면 신호 없음.
- `violation-building`: `isViolation === true`
- `new-building`: 사용승인일이 `asOf` 기준 신축 기간(policy.ts) 이내
- `trust-registered`: `isTrust === true`
- `recent-ownership-change`: 소유자 변동일이 `asOf` 기준 소유자 변동 기간(policy.ts) 이내
- `price-unavailable`: 시세 추정 method가 `none`. `price-low-confidence`: confidence가 `low`
- `notes`에는 항상 "최근 {신고 지연 기간}일 거래는 신고가 끝나지 않아 반영되지 않았을 수 있다"는 안내를 넣는다(PRD 데이터 제약).
- `sources`: 국토교통부 실거래가, 공동주택 공시가격, 건축물대장, 사용자 입력(등기부). 결과에 쓴 데이터만 넣지 말고 이 네 항목을 항상 넣는다.

### 3. 문구 (`src/features/judgment/copy.ts`)

신호별 `title`·`detail`, `headline` 형식, `disclaimer`, 출처명을 이 파일에 모은다. 비율과 금액은 문구에 채워 넣는 함수로 만든다.

핵심 규칙 (CLAUDE.md CRITICAL):

- 신호가 0개여도 headline은 "위험 신호 0개"다. "안전", "문제없음", "괜찮" 같은 단정 표현을 쓰지 마라.
- disclaimer에는 참고용 정보라는 점, 권리관계는 사용자 입력에 의존한다는 점, 공공데이터에는 신고 지연이 있다는 점, 계약 전 등기부등본과 전문가 확인을 권한다는 점을 담는다. 이때 disclaimer에도 "안전"이라는 단어를 쓰지 않는다. 예: "위험이 없음을 보장하지 않는다".

### 4. 테스트 (`src/features/judgment/risk-report.test.ts`)

- 신호별 발생·미발생 조건과 경계값(신축 기간·소유자 변동 기간 경계)
- 입력이 모두 정상이면 `signalCount` 0, headline "위험 신호 0개"
- HUG `"unknown"`이면 신호가 아니라 notes로 들어간다
- notes에 신고 지연 안내가 항상 있다
- **금지 표현 검사**: 가능한 모든 신호가 켜진 보고서와 0개인 보고서에서 headline, notes, disclaimer, 모든 title·detail 문자열에 "안전"이 포함되지 않는다. `copy.ts`가 export하는 모든 문자열 템플릿도 같은 방식으로 검사한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `src/server/`나 Prisma를 import하지 마라. 이유: 순수 로직이다.
- 기간·임계치 숫자를 이 파일들에 하드코딩하지 마라. `@/consts/policy`에서 가져와라. 이유: CLAUDE.md CRITICAL.
- 결과 화면 컴포넌트를 만들지 마라. 이유: UI는 phase 2에서 UI_GUIDE를 받은 뒤 만든다.
- 함수 안에서 `new Date()`로 기준일을 만들지 마라. 이유: 기준일은 `asOf`로 받아야 테스트가 결정적이다.
- 기존 테스트를 깨뜨리지 마라.
