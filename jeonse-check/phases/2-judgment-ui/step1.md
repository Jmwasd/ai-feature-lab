# Step 1: lookup-form

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (feature 레이어, 서로 다른 feature 직접 참조 금지)
- `/docs/PRD.md` (핵심 기능 1: 주소·보증금·전용면적, MVP 주택 유형)
- `/docs/UI_GUIDE.md` (§4 `SearchBarPill`·`TextInput`·선택 탭, §3 모바일 하단 고정 CTA)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/components/*`, `/src/utils/format.ts`
- `/src/features/judgment/types.ts` (`HouseType`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

조회 조건 입력 폼을 만든다. 주소 검색은 함수를 props로 받아 호출만 한다. 실제 주소 API 연결은 phase 5에서 한다.

### 1. 입력 스키마 (`src/features/lookup-input/schema.ts`)

- `zod`를 dependency로 설치한다. 같은 스키마를 클라이언트 폼 검증과 phase 5 Server Action 검증에 함께 쓴다.

```ts
export const lookupInputSchema; // zod
export type LookupInput = {
  address: AddressCandidate;   // 주소 검색에서 고른 항목
  houseType: "apartment" | "row-house";
  deposit: number;             // 원, 양의 정수
  exclusiveArea: number;       // ㎡, 0 초과
  dong?: string;               // 동 (공시가격 조회용, 선택)
  ho?: string;                 // 호 (공시가격 조회용, 선택)
};
export interface AddressCandidate {
  id: string;                  // 검색 결과 내 식별자
  roadAddress: string;
  jibunAddress: string;
  buildingName: string | null;
  admCd: string;               // 법정동코드 10자리
}
```

- 보증금은 사용자가 "2억 8000만" 또는 "28000"(만원) 같은 입력을 할 수 있다. 입력 문자열을 원 단위 정수로 바꾸는 `parseWonInput(text): number | null`을 `src/utils/`에 두고 테스트한다. 모호하면 `null`로 두고 폼 오류를 보인다.
- 동·호는 선택 입력이다. 비우면 공시가격을 조회할 수 없다는 안내를 폼에 보인다("동·호를 입력하면 공시가격으로 HUG 기준을 계산해요").

### 2. 폼 (`src/features/lookup-input/LookupForm.tsx`, `"use client"`)

```ts
export function LookupForm(props: {
  searchAddress: (keyword: string) => Promise<AddressCandidate[]>;
  onSubmit: (input: LookupInput) => void;
  defaultValue?: Partial<LookupInput>;
}): JSX.Element;
```

- 주소 검색: 입력 후 검색 버튼(또는 Enter)으로 호출. 입력마다 호출하지 마라(API 호출 한도). 결과 목록에서 하나를 골라야 다음으로 넘어간다. 로딩·결과 없음·오류 상태를 보인다.
- 주택 유형: 선택 탭(아파트 / 연립다세대). 오피스텔·다가구는 선택지에 없다.
- 데스크톱은 `SearchBarPill` 형태, 모바일은 세로 `TextInput` 스택 + 하단 고정 CTA(UI_GUIDE §3).
- 제출 전 `lookupInputSchema`로 검증하고, 필드별 오류를 `TextInput` 오류 상태로 보인다.

### 3. 테스트

- `schema.test.ts`, `parse-won-input.test.ts`: 경계 케이스.
- `LookupForm.test.tsx`: 검색 함수 호출 시점(버튼·Enter만), 후보 선택 전 제출 불가, 유효 입력 제출 시 `onSubmit` 값, 오류 표시, 동·호 비었을 때 안내.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 폼 안에서 `fetch`로 주소 API를 직접 부르지 마라. 이유: 서비스키는 서버에만 있다(CLAUDE.md CRITICAL). 검색은 props 함수로 받는다.
- 오피스텔·다가구·단독주택 선택지를 넣지 마라. 이유: PRD MVP 제외.
- `src/features/rights-input/`이나 `src/features/judgment/`의 컴포넌트를 import하지 마라. 이유: feature 간 직접 참조 금지. 타입 `HouseType`처럼 겹치는 값은 이 feature 안에서 다시 정의하거나 `src/types/`로 옮긴다.
- 폼 라이브러리(react-hook-form 등)를 설치하지 마라. 이유: 필드가 적고 zod 검증으로 충분하다.
- 페이지에 폼을 붙이지 마라. 이유: phase 5 범위다.
- 기존 테스트를 깨뜨리지 마라.
