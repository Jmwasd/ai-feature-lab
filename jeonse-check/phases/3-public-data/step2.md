# Step 2: region-tiers

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (정책 수치는 `src/consts/policy.ts` 밖에 두지 않는다 CRITICAL)
- `/docs/ARCHITECTURE.md` (feature 순수 로직, shared `consts`)
- `/docs/ADR.md` (ADR-005: 값마다 시행일·출처 주석)
- `/src/consts/policy.ts` (`PRIORITY_REPAYMENT_REGION`, `PRIORITY_REPAYMENT`, `HUG_GUARANTEE`의 수도권·그 외 한도)
- `/src/features/judgment/ratios.ts` (`checkPriorityRepayment`, `checkHugEligibility`의 `regionTier`·`isCapitalArea` 입력)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

법정동코드(10자리)로 최우선변제 지역 구간과 수도권 여부를 판별한다. 지역 목록은 `policy.ts`에, 판별 함수는 판정 feature에 둔다.

### 1. 지역 목록 (`src/consts/policy.ts`에 추가)

- 수도권: 시도코드(법정동코드 앞 2자리) 서울·인천·경기. 출처: 수도권정비계획법 제2조.
- 최우선변제 구간별 지역(주택임대차보호법 시행령 제10조 제1항, 과밀억제권역은 수도권정비계획법 시행령 별표 1):
  - 시도·시군구 단위로 끝나는 지역은 법정동코드 앞 2자리 또는 5자리로 적는다.
  - **일부 지역만 과밀억제권역에 속하는 시군구**(예: 인천의 일부 구역, 남양주의 일부 동)는 해당 법정동코드(10자리 또는 8자리 읍면동 단위)로 적고, 확정하기 어려운 지역은 `AMBIGUOUS` 목록에 둔다.
- 값마다 시행일·출처 주석을 단다. 법령 원문(국가법령정보센터)을 확인하고, 확인하지 못한 항목은 `// 미확인: <사유>`를 단다.
- 광역시 구간에서 "군 지역 제외" 규칙도 코드 목록으로 반영한다.

### 2. 판별 함수 (`src/features/judgment/region.ts`)

```ts
export function priorityRegionTier(admCd: string): PriorityRepaymentRegion | null;
export function isCapitalArea(admCd: string): boolean | null;
```

- 가장 구체적인 코드(10자리 → 8자리 → 5자리 → 2자리)부터 맞춘다.
- `AMBIGUOUS`에 걸리거나 형식이 잘못된 코드는 `null`을 돌려준다. 이유: 추측으로 구간을 정하면 최우선변제 금액이 틀린다. `null`이면 판정은 "판단할 수 없음"으로 간다(ratios.ts).
- 순수 함수. `src/server/`를 import하지 않는다.

### 3. 테스트 (`region.test.ts`)

- 서울 구, 인천 과밀억제권역·비과밀 구역, 경기 과밀억제권역 시, 세종·용인·화성·김포, 광역시 구·군, 안산·광주·파주·이천·평택, 그 밖의 지역 대표 코드.
- 모호 지역과 잘못된 형식은 `null`.
- 수도권 여부.
- 기대 구간은 `PRIORITY_REPAYMENT_REGION` 상수로 적는다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 지역 코드 목록을 `region.ts`나 다른 파일에 두지 마라. 이유: ADR-005, CLAUDE.md CRITICAL.
- 판별이 애매한 지역을 가장 가까운 구간으로 추정하지 마라. 이유: 금액 오판이 사용자 판단을 왜곡한다. `null`로 둔다.
- `policy.ts`의 기존 금액·비율을 바꾸지 마라. 이유: 이 step 범위가 아니다.
- 기존 테스트를 깨뜨리지 마라.
