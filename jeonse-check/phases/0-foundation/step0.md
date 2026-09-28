# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-001: Next.js App Router 풀스택)
- `/.gitignore`, `/.env.example`, `/.claude/settings.json` (Stop 훅이 `npm run lint && npm run build && npm run test`를 돌린다)
- `/src/app/globals.css` (이미 있는 디자인 토큰 파일. Tailwind v4 `@theme`)

이 step이 첫 step이다. 아직 `package.json`이 없다.

## 작업

jeonse-check 폴더(이 저장소의 `ROOT`, `scripts/execute.py`의 부모 폴더)에 Next.js App Router + TypeScript strict + ESLint + Vitest 뼈대를 세운다.

1. **Next.js 생성** — 현재 폴더는 비어 있지 않다(`CLAUDE.md`, `README.md`, `docs/`, `scripts/`, `phases/`, `.claude/`, `.gitignore`, `.env.example`, `src/app/globals.css`). `create-next-app`을 현재 폴더에 직접 실행하지 말고, 스크래치 임시 폴더에 생성한 뒤 필요한 파일만 옮긴다.
   - 옵션: TypeScript, ESLint, App Router, `src/` 디렉토리, import alias `@/*`, npm, **Tailwind CSS**.
   - 옮길 대상: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, ESLint 설정, PostCSS 설정, `src/app/`(단 `globals.css` 제외), `public/`(필요하면).
   - **기존 `src/app/globals.css`를 덮어쓰지 마라.** 생성된 globals.css는 버린다. 이유: 디자인 토큰의 단일 원본이다(`docs/UI_GUIDE.md`).
   - 기존 `.gitignore`는 덮어쓰지 말고, 생성된 `.gitignore`에만 있는 항목을 병합한다.
   - `package.json`의 `name`은 `jeonse-check`로 한다.
2. **Tailwind CSS v4** — `tailwindcss`와 `@tailwindcss/postcss`가 **v4**인지 확인한다. v3이면 v4로 올린다. `postcss.config.mjs`는 `@tailwindcss/postcss` 플러그인만 쓴다. `tailwind.config.*` 파일은 만들지 않는다(v4는 `globals.css`의 `@theme`으로 설정한다). `src/app/layout.tsx`에서 `./globals.css`를 import한다.
3. **TypeScript strict** — `tsconfig.json`에 `"strict": true`를 확인한다.
4. **lint 스크립트** — 설치된 Next 메이저 버전을 확인한다. `next lint`가 없거나 deprecated인 버전이면 `"lint": "eslint ."`처럼 ESLint CLI를 직접 호출한다. `.next/`, `node_modules/`, `scripts/`는 lint 대상에서 제외한다.
5. **Vitest** — `vitest`를 devDependency로 설치하고 `vitest.config.ts`를 만든다.
   - `@/*` → `src/*` 경로 alias를 tsconfig와 같게 맞춘다.
   - 테스트 파일 패턴: `src/**/*.test.ts`, `src/**/*.test.tsx`
   - `server-only` 모듈을 빈 모듈로 alias한다(예: `src/test/server-only-stub.ts` 또는 동등한 방식). 이유: `server-only`는 react-server 조건 밖에서 import하면 예외를 던지므로, 이후 step의 `src/server/` 파일을 테스트할 수 없다.
6. **의존성** — `server-only`를 dependency로 설치한다.
7. **npm 스크립트** — `dev`, `build`, `start`, `lint`, `test`만 둔다. `test`는 `vitest run --passWithNoTests`로 한다.
8. **랜딩 placeholder** — `src/app/page.tsx`는 서비스명과 한 줄 설명만 있는 최소 Server Component로 바꾼다. create-next-app 기본 데모 마크업·이미지·`page.module.css`는 지운다. 스타일은 토큰 클래스(`text-display-xl`, `px-gutter` 등)만 쓴다. `src/app/layout.tsx`의 `lang`은 `"ko"`, metadata title은 `jeonse-check`로 한다.
9. **스모크 테스트** — `src/app/page.test.ts` 같은 테스트는 만들지 않는다. 실제 테스트는 이후 step에서 생긴다.

## Acceptance Criteria

```bash
npm run lint    # ESLint 에러 없음
npm run build   # 컴파일 에러 없음
npm run test    # 테스트 파일이 없어도 통과
```

## 금지사항

- Auth.js, Prisma, 상태관리·UI 컴포넌트 라이브러리를 설치하지 마라. 이유: 이후 step과 phase의 범위다.
- Pretendard 폰트 파일을 추가하지 마라. 이유: UI phase에서 `next/font/local`로 붙인다. 그 전까지는 `globals.css`의 대체 폰트로 렌더링된다.
- `globals.css`의 `@theme` 값을 바꾸거나 `--*: initial` 줄을 지우지 마라. 이유: 토큰 단일 원본이고, 기본 팔레트를 비워 둔 것은 의도다.
- `npm run collect`, `npm run test:db` 스크립트를 만들지 마라. 이유: 실제 코드가 생기는 phase 1에서 추가한다.
- 랜딩 페이지를 디자인하지 마라. 이유: UI_GUIDE.md가 아직 placeholder이고, UI는 phase 2에서 가이드를 받은 뒤 만든다.
- `CLAUDE.md`, `docs/`, `scripts/`, `phases/`, `.claude/`, `.env.example`, `src/app/globals.css`를 수정하거나 덮어쓰지 마라.
- `src/` 아래에 쓰지 않는 레이어 폴더(`features/`, `server/`, `components/` 등)를 미리 만들지 마라. 이유: ARCHITECTURE.md가 빈 폴더를 금지한다.
