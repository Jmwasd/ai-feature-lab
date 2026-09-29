# Step 2: rights-form

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (feature 레이어)
- `/docs/PRD.md` (핵심 기능 2: 권리 쪽 수동 입력)
- `/docs/UI_GUIDE.md` (§4 `TextInput`·예/아니오 선택·단계 진행 탭, §6 "사용자 입력(등기부 기준)" 표기)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/features/judgment/types.ts` (`RightsInput`: 구조를 맞출 대상. import하지 않는다)
- `/src/features/lookup-input/*`, `/src/utils/*` (step 1: `parseWonInput`, zod 사용 방식)
- `/src/components/*`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

사용자가 등기부등본을 보고 권리관계를 입력하는 폼을 만든다.

### 1. 스키마 (`src/features/rights-input/schema.ts`)

```ts
export const rightsInputSchema; // zod. 결과가 RightsInput과 구조가 같아야 한다
// maxClaimAmount: 근저당 채권최고액 합계(원, 0 이상 정수)
// seniorDeposits: 선순위 임차보증금 합계(원, 0 이상 정수)
// isTrust: 신탁 등기 여부
// lastOwnershipChangeDate: 최근 소유권 이전 등기일 (없으면 null)
```

- 미래 날짜는 오류로 처리한다. 오늘 날짜는 스키마에 넣지 말고 검증 함수 인자(`asOf`)로 받는다.

### 2. 폼 (`src/features/rights-input/RightsForm.tsx`, `"use client"`)

```ts
export type RightsFormValue = z.infer<typeof rightsInputSchema>; // judgment의 RightsInput과 구조가 같다. 그 타입을 import하지 않는다
export function RightsForm(props: {
  onSubmit: (rights: RightsFormValue) => void;
  onBack?: () => void;
  asOf: Date;
  defaultValue?: Partial<RightsFormValue>;
}): JSX.Element;
```

- 근저당은 여러 건일 수 있다. 건별 채권최고액을 추가·삭제하고 합계를 보여준 뒤 합계만 넘긴다. "근저당 없음"을 명시적으로 고를 수 있게 한다(빈칸과 0원을 구분한다).
- 필드마다 등기부 어디를 보면 되는지 짧은 도움말(예: "을구 → 근저당권설정 → 채권최고액")을 둔다.
- 신탁 여부는 예/아니오 선택(UI_GUIDE §4). 기본값을 정하지 않고 사용자가 고르게 한다. 이유: 기본값 "아니오"는 입력 누락을 위험 없음으로 만든다.
- 폼 상단에 "입력한 등기부 내용으로만 판단해요. 계약 당일 등기부를 다시 확인하세요" 안내.

### 3. 테스트

- `schema.test.ts`: 음수, 미래 날짜, 신탁 미선택 거부.
- `RightsForm.test.tsx`: 근저당 여러 건 합산, "근저당 없음" 선택 시 0, 신탁 미선택 시 제출 불가, 제출 값이 `RightsInput` 구조와 같음(테스트 파일에서만 타입 호환을 검사한다), 금지 표현 없음(`src/test/forbidden-phrases.ts`).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 입력하지 않은 값을 0이나 `false`로 조용히 채우지 마라. 이유: 누락이 위험을 가린다.
- 등기부 PDF 업로드·자동 인식 기능을 만들지 마라. 이유: PRD MVP 제외(등기부 자동 조회 없음).
- `src/features/lookup-input/`의 컴포넌트를 import하지 마라. 공용이 필요하면 `src/components/`나 `src/utils/`로 옮긴다. 이유: feature 간 직접 참조 금지.
- 페이지에 폼을 붙이지 마라. 이유: phase 5 범위다.
- 기존 테스트를 깨뜨리지 마라.
