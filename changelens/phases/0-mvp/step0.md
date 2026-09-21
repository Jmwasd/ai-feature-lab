# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「디렉터리」, 「테스트 전략」
- `/docs/ADR.md` — ADR-2(localhost 전용), ADR-5(포트 3000)
- `/.gitignore`, `/.env.local.example`

아직 코드가 없다. 이 step은 이후 step이 올라설 빈 Next.js 프로젝트를 만든다.

## 작업

이 폴더(changelens)를 Next.js 15 + TypeScript strict + Tailwind v4 + Vitest 프로젝트로 만든다. 설정 파일은 직접 작성한다.

1. `package.json`
   - `"private": true`, `"engines": { "node": ">=20" }`
   - dependencies: `next@15`, `react@19`, `react-dom@19`, `@anthropic-ai/sdk`, `google-auth-library`
   - devDependencies: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tailwindcss@4`, `@tailwindcss/postcss`, `eslint@9`, `eslint-config-next@15`, `@eslint/eslintrc`, `vitest`
   - scripts:
     ```
     "dev":   "next dev -p 3000 -H localhost"
     "build": "next build"
     "start": "next start -p 3000 -H localhost"
     "lint":  "eslint ."
     "test":  "vitest run"
     ```
   - `npm install`로 설치해 `package-lock.json`을 만든다.
2. `tsconfig.json` — `strict: true`, 경로 별칭 `@/*` → `./*`, Next.js 플러그인. `next-env.d.ts`는 `.gitignore`에 이미 있다.
3. `next.config.ts` — 비어 있는 기본 설정.
4. `postcss.config.mjs` — `@tailwindcss/postcss` 하나.
5. `eslint.config.mjs` — flat config. `FlatCompat`으로 `next/core-web-vitals`, `next/typescript`를 잇고 `.next/`, `node_modules/`, `next-env.d.ts`를 무시한다.
6. `vitest.config.ts` — `environment: "node"`, `@` 별칭을 프로젝트 루트로, `include: ["**/*.test.{ts,mjs}"]`(node_modules·.next 제외), `passWithNoTests: true`.
7. `app/layout.tsx` — `<html lang="ko"><body>{children}</body></html>`와 `import "./globals.css"`. 폰트·클래스는 넣지 않는다(Step 4가 design 스킬로 채운다).
8. `app/globals.css` — `@import "tailwindcss";` 한 줄.
9. `app/page.tsx` — `changelens` 텍스트만 있는 자리 표시. className 없이.

## Acceptance Criteria

```bash
npm install
npm run lint    # 오류 없음
npm run build   # 컴파일 에러 없음
npm test        # 통과 (테스트 없음 허용)
```

## 금지사항

- `create-next-app`을 이 폴더에서 돌리지 마라. 이유: 이미 있는 `CLAUDE.md`, `README.md`, `docs/`, `scripts/`, `.claude/`와 충돌해 멈추거나 덮어쓴다.
- Geist 폰트, 예제 이미지(`public/*.svg`), 예제 스타일을 넣지 마라. 이유: 폰트·색은 design 스킬이 정하고 Step 4가 넣는다.
- `-H localhost`를 빼거나 포트를 바꾸지 마라. 이유: ADR-2(localhost 전용), ADR-5(GIS 원본 등록이 3000에 묶여 있다).
- `lib/`, `components/`, `types/`에 빈 파일을 미리 만들지 마라. 이유: 쓰는 step이 만든다.
- 목록에 없는 패키지(테스트 라이브러리, UI 킷, 상태 관리, `zod`, `jose` 등)를 추가하지 마라. 이유: 스택은 CLAUDE.md에 고정돼 있다.
- `README.md`, `docs/`, `.env.local*`를 고치지 마라.
