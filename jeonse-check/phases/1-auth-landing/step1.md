# Step 1: base-components

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (shared 레이어: `src/components/`, `src/utils/`)
- `/docs/UI_GUIDE.md` (전체. 특히 §2 토큰 사용, §3 레이아웃, §4 컴포넌트, §7 금지 패턴)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/app/globals.css` (쓸 수 있는 토큰 이름)
- `/src/app/layout.tsx`, `/vitest.config.*`, `/src/test/setup-dom.ts` (step 0 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩과 이후 서비스 화면이 함께 쓰는 표현 컴포넌트와 포맷터를 만든다. 도메인 로직과 판정 문구는 넣지 않는다.

### 1. 포맷터 (`src/utils/format.ts`)

```ts
export function formatWon(amount: number): string;   // 원 단위 정수 → "2억 8,000만", "5,500만", "3억", "0원"
export function formatPercent(ratio: number): string;  // 0.745 → "74.5%", 0.7 → "70%"
```

- 1만 원 미만 단위는 버리지 말고 반올림 규칙을 JSDoc에 적는다(만 원 단위 반올림 권장).
- 음수는 받지 않는다. 음수나 `NaN`이면 예외를 던진다.
- `src/features/judgment/copy.ts`에 비율 포맷 함수가 이미 있다. 동작이 같으면 `copy.ts`가 이 포맷터를 쓰도록 바꿔 중복을 없앤다. `copy.ts`의 출력 문자열이 바뀌면 안 된다(기존 테스트로 확인).
- 테스트: `src/utils/format.test.ts`.

### 2. 컴포넌트 (`src/components/`)

UI_GUIDE §4 사양을 따른다. 파일 하나에 컴포넌트 하나, 이름은 PascalCase.

```ts
// Button.tsx
type ButtonVariant = "primary" | "secondary" | "tertiary-text" | "pill-primary";
export function Button(props: { variant?: ButtonVariant; href?: string } & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
// href가 있으면 next/link로 렌더링한다.

// TopNav.tsx — "use client" (스크롤 8px 초과 시 shadow-float)
export function TopNav(props: { links: { href: string; label: string }[]; action?: ReactNode }): JSX.Element;
// 모바일(tablet 미만)은 햄버거 메뉴로 링크를 접는다. 메뉴 버튼에 aria-expanded, aria-controls.

// FooterLight.tsx
export function FooterLight(props: { columns: { title: string; links: { href: string; label: string }[] }[]; legal: ReactNode }): JSX.Element;

// IconButtonCircle.tsx
export function IconButtonCircle(props: { label: string; icon: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
// label은 aria-label로 쓴다.

// StatusPill.tsx — 상태 알약(앞에 6px 레드 점)
export function StatusPill(props: { children: ReactNode }): JSX.Element;
```

- 컴포넌트 안에 판정 문구, 링크 목록, 서비스명을 하드코딩하지 마라. props로 받는다. 이유: shared 레이어는 도메인과 무관해야 한다.
- 워드마크(아이콘 + "jeonse-check")는 `TopNav`의 `brand` 영역에 기본으로 둔다. 링크는 `/`.
- 테스트(`*.test.tsx`): 변형별 클래스, `href` 유무에 따른 요소 종류, TopNav 스크롤 그림자 전환, 햄버거 메뉴 열고 닫기, IconButtonCircle의 접근성 이름.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
# 토큰 우회 검색: 결과가 없어야 한다 (UI_GUIDE §2 예외 치수 제외)
grep -rnE '\b(text|bg|border|shadow|rounded|p[xytrbl]?|m[xytrbl]?|gap)-\[' src/components src/utils || true
grep -rnE '#[0-9a-fA-F]{3,8}\b' src/components || true
```

## 금지사항

- `src/app/globals.css`를 수정하거나 새 토큰을 만들지 마라. 이유: UI_GUIDE §2.
- Tailwind 기본 클래스(`text-sm`, `shadow-lg`, `bg-gray-100` 등)나 임의값을 쓰지 마라. 이유: 기본 팔레트는 비워 두었고, 쓰면 스타일이 조용히 빠진다.
- 입력 포커스에 ring·glow를 쓰지 마라. 이유: UI_GUIDE §7.
- `src/components/`에서 `src/features/`, `src/server/`를 import하지 마라. 이유: shared는 상위 레이어를 참조하지 않는다.
- UI 컴포넌트 라이브러리(shadcn, Radix, Headless UI 등)나 `clsx` 외의 스타일 유틸을 설치하지 마라. 이유: 컴포넌트 수가 적고 사양이 UI_GUIDE에 고정돼 있다.
- `src/app/page.tsx`를 바꾸지 마라. 이유: step 2 범위다.
- 기존 테스트를 깨뜨리지 마라.
