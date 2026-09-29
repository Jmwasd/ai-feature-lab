# Step 3: landing-try

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (정책 수치 하드코딩 금지 CRITICAL)
- `/docs/ARCHITECTURE.md` (feature 순수 로직은 클라이언트에서도 쓸 수 있다)
- `/docs/UI_GUIDE.md` (§4 비율 막대·슬라이더·프리셋 칩, §5 막대 채움·숫자 트윈, §6 HUG 표현과 임계치 규칙, §8의 3번 "계산해 보기")
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/consts/policy.ts`
- `/src/features/judgment/ratios.ts`, `/src/features/judgment/copy.ts`
- `/src/components/*`, `/src/utils/format.ts`, `/src/hooks/use-reveal.ts`
- `/src/app/page.tsx`, `/src/app/_components/*` (step 2: `#try` 자리 섹션)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩의 "계산해 보기"(`#try`) 섹션을 만든다. 사용자가 슬라이더로 값을 바꾸면 전세가율·부채비율·HUG 기준 충족 여부가 바로 바뀐다.

### 1. 비율 막대 (`src/components/RatioBar.tsx`)

결과 화면에서도 다시 쓰므로 shared에 둔다. 도메인 기준값은 props로 받는다.

```ts
export function RatioBar(props: {
  label: string;
  ratio: number | null;        // null이면 값 대신 "계산할 수 없어요" 같은 안내를 보여준다
  dangerThreshold: number;     // 기준선 위치이자 채움 색 전환 기준
  statusText?: string;         // 예: "주의", "위험". 없으면 비운다
  formula?: ReactNode;         // 막대 아래 계산식
  thresholdLabel: string;      // 예: "80% 기준"
}): JSX.Element;
```

- 트랙 최대 120%. 값이 그보다 크면 막대는 끝까지 채우고 숫자는 실제 값을 보여준다.
- 값이 위험 임계치 이상이면 `error-text`, 미만이면 `ink`로 채운다. 위험 임계치 위치에 1px `muted` 기준선.
- 퍼센트는 `formatPercent`로 표시하고 `tabular-nums`를 준다.
- `role="meter"` 또는 동등한 접근성 속성(`aria-valuenow` 등)을 둔다.

### 2. 계산기 섹션 (`src/app/_components/TrySection.tsx`, `"use client"`)

- 입력: 보증금 슬라이더, 근저당 채권최고액 슬라이더, 프리셋 칩(예시 조건 몇 개). 추정 매매가와 공시가격은 프리셋이 정하는 예시값으로 둔다.
- 계산: `jeonseRatio`, `debtRatio`, `checkHugEligibility`를 `@/features/judgment/ratios`에서 그대로 호출한다. 컴포넌트 안에서 비율을 직접 계산하거나 임계치와 비교하지 마라.
- 표시: `RatioBar` 2개(전세가율, 부채비율) + HUG 줄. `dangerThreshold`와 "80% 기준" 문구의 숫자는 `policy.ts` 상수에서 만든다.
- HUG 줄 문구는 UI_GUIDE §6을 따른다: 충족이면 "가입 기준 충족(공시가격 기준 추정)"과 잉크색 `circle-check`, 미충족이면 "가입 어려움". "가능성 높음" 같은 표현을 쓰지 마라.
- 수준 라벨은 "주의" / "위험"만 쓰고, `normal`이면 비우거나 "70% 미만"처럼 기준 대비 사실을 쓴다(숫자는 policy에서).
- 섹션 안에 "예시 계산이며 실제 시세가 아니에요" 같은 안내를 둔다.
- 슬라이더 범위와 프리셋 값(보증금·채권최고액·시세 예시)은 정책 수치가 아니므로 이 컴포넌트 옆 상수로 둔다.

### 3. 테스트

- `RatioBar.test.tsx`: 임계치 이상·미만의 채움 색, 기준선 위치, `null` 안내, 120% 초과 표시.
- `TrySection.test.tsx`: 슬라이더를 움직이면 비율과 HUG 줄이 바뀐다. 기대값은 `ratios.ts` 함수와 `policy.ts` 상수로 계산해 만든다. 렌더링 결과에 금지 표현이 없다(`src/test/forbidden-phrases.ts`).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
# 정책 수치 하드코딩 검사: 결과가 없어야 한다
grep -rnE '\b(0\.7|0\.8|1\.26|70%|80%|126%)' src/components src/app/_components --include='*.tsx' | grep -v '\.test\.tsx' || true
```

## 금지사항

- 70%, 80%, 126% 같은 기준값을 컴포넌트에 쓰지 마라. 이유: CLAUDE.md CRITICAL, UI_GUIDE §6.
- 비율·HUG 판정을 컴포넌트 안에서 다시 구현하지 마라. 이유: 랜딩 계산과 실제 판정이 어긋나면 사용자가 다른 결과를 보게 된다.
- 신호등 3색이나 초록 체크를 쓰지 마라. 이유: UI_GUIDE §7.
- `RatioBar`에서 `@/consts/policy`나 `@/features`를 import하지 마라. 이유: shared 레이어이므로 기준값은 props로 받는다.
- 사례·이용 방법·데이터 출처 섹션을 만들지 마라. 이유: step 4 범위다.
- 기존 테스트를 깨뜨리지 마라.
