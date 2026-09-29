# Step 0: ui-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (§5 테스트)
- `/docs/UI_GUIDE.md` (§1 서체, §8 히어로 배경 이미지)
- `/.claude/skills/jeonse-design/SKILL.md` (UI 작업 절차)
- `/src/app/globals.css` (`@theme inline`의 `--font-sans`가 `var(--font-pretendard)`를 참조한다)
- `/src/app/layout.tsx`, `/package.json`, `/vitest.config.ts`, `/eslint.config.mjs` (phase 0 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

이후 UI step이 쓸 기반(컴포넌트 테스트 환경, 서체, 아이콘, 히어로 이미지)만 준비한다. 화면은 만들지 않는다.

### 1. 컴포넌트 테스트 환경

- devDependency: `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, 그리고 Vitest에서 TSX를 변환하는 데 필요하면 `@vitejs/plugin-react`.
- 기본 테스트 환경은 `node`로 둔다. jsdom은 `*.test.tsx` 파일에만 적용한다(Vitest 4의 설정 방식을 확인해 `projects` 또는 파일 단위 환경 지정 중 하나로 한다). 이유: 기존 순수 로직 테스트 82개가 jsdom 초기화 비용 없이 돌아야 한다.
- `@testing-library/jest-dom` matcher와 테스트 후 `cleanup`을 setup 파일(`src/test/setup-dom.ts`)에서 등록한다. TypeScript가 matcher 타입을 인식해야 한다.
- 설정이 동작하는지 확인하는 테스트 하나를 `src/test/dom-setup.test.tsx`에 둔다(간단한 요소를 렌더링하고 `toBeInTheDocument`로 확인).
- 이 step에서 `vitest.config.ts`를 손보는 김에 ESM 경고(`configLoader: 'native'` 관련)가 사라지는 방식이 있으면 적용한다. 예: `vitest.config.mts`로 이름 변경. 동작이 바뀌면 적용하지 마라.

### 2. Pretendard

- `pretendard` npm 패키지(devDependency)에서 가변 폰트 `PretendardVariable.woff2`를 `src/app/fonts/`로 복사한다. 라이선스(OFL) 파일도 같은 폴더에 둔다.
- `src/app/layout.tsx`에서 `next/font/local`로 불러 `variable: "--font-pretendard"`, `display: "swap"`, weight 범위 `"45 920"`으로 설정하고 `<html>`의 `className`에 변수를 붙인다.
- 복사한 뒤에는 `pretendard` 패키지를 제거한다. 이유: 빌드에 쓰지 않는 의존성이다.

### 3. 아이콘

- `lucide-react`를 dependency로 설치한다. 이 step에서 쓰지는 않는다.

### 4. 히어로 이미지

- `docs/assets/landing-hero.png`를 WebP로 변환해 `public/images/landing-hero.webp`로 둔다. `node_modules`에 있는 `sharp`(Next 의존성)를 일회성 명령(`node -e` 등)으로 써서 변환한다. 품질 80 안팎, 원본 해상도 유지.
- 원본 PNG는 `docs/assets/`에 그대로 둔다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test                               # 기존 82개 + dom-setup 테스트 통과
test -f src/app/fonts/PretendardVariable.woff2
test -f public/images/landing-hero.webp
```

## 금지사항

- `src/app/globals.css`를 수정하지 마라. 이유: 토큰 단일 원본이고, `--font-sans`가 이미 `--font-pretendard`를 참조한다.
- Google Fonts나 CDN으로 폰트를 불러오지 마라. 이유: UI_GUIDE §1이 셀프 호스팅을 정했다.
- 이미지 변환 스크립트를 저장소나 `package.json` 스크립트에 남기지 마라. 이유: 한 번만 하는 작업이다.
- `src/app/page.tsx`를 바꾸거나 `src/components/`를 만들지 마라. 이유: 다음 step 범위다.
- 모든 테스트를 jsdom 환경으로 바꾸지 마라. 이유: 순수 로직 테스트가 느려지고 서버 코드 테스트가 브라우저 전역을 볼 수 있게 된다.
- 기존 테스트를 깨뜨리지 마라.
