# Step 0: project-setup

## 읽어야 할 파일

- `/CLAUDE.md` — 기술 스택, CRITICAL 규칙
- `/docs/ARCHITECTURE.md` — 디렉토리 구조
- `/docs/ADR.md` — ADR-009(테스트 범위), ADR-010(픽스처 정책)

## 작업

`spend-report/` 안에 Next.js 15 App Router 프로젝트를 초기화한다. **이 폴더가 프로젝트 루트다.** 하위에 새 폴더를 만들어 그 안에 앱을 넣지 마라.

1. `package.json` — 아래 4개 스크립트를 **반드시** 이 이름으로 만든다. `.claude/settings.json`의 Stop 훅이 이 이름을 호출한다.
   ```
   dev   : next dev
   build : next build
   lint  : next lint
   test  : vitest run --passWithNoTests
   ```
   `--passWithNoTests`는 필수다. 이 step에는 아직 테스트가 없는데 훅이 `npm run test`를 돌린다.

2. TypeScript **strict mode**. `tsconfig.json`에 `"strict": true`.

3. Tailwind CSS 설정. `src/app/globals.css`에 Tailwind 지시문.

4. Vitest 설정 (`vitest.config.ts`). `src/` 하위 `*.test.ts`를 찾도록 한다. 환경은 `node`로 충분하다 — `src/lib/`가 순수 함수라 DOM이 필요 없다.

5. `/docs/ARCHITECTURE.md`의 디렉토리 구조대로 빈 폴더를 만든다: `src/app/`, `src/components/`, `src/types/`, `src/lib/`, `src/services/`.

6. `src/app/page.tsx`, `src/app/layout.tsx`를 최소 형태로 만든다. 페이지는 제목 한 줄만 렌더한다. 업로드 UI는 step 9에서 만든다.

7. **픽스처 로더**를 `src/lib/__fixtures__/load.ts`에 만든다. 이후 모든 step의 테스트가 이걸 쓴다.
   ```ts
   /** fixtures/toss-sample.csv 의 원문. 파일이 없으면 null. */
   export function loadSampleCsv(): string | null
   ```
   `fixtures/toss-sample.csv`는 gitignore돼 있어 없을 수 있다(ADR-010). 없으면 예외를 던지지 말고 `null`을 반환한다. 테스트는 `null`이면 `it.skip`으로 넘긴다.

8. `.env.example`에 `OPENAI_API_KEY=` 한 줄. `.env.local`은 만들지 말고 gitignore에 이미 있는지 확인한다.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다. 전부 에러 없이 통과해야 한다.
2. 아키텍처 체크리스트:
   - `/docs/ARCHITECTURE.md`의 디렉토리 구조와 일치하는가?
   - `tsconfig.json`에 `"strict": true`가 있는가?
   - `package.json`의 스크립트 이름이 `dev`/`build`/`lint`/`test`인가?
3. `phases/0-initial-release/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "Next.js 15 + TS strict + Tailwind + Vitest 초기화. 픽스처 로더 src/lib/__fixtures__/load.ts 추가"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- 하위 폴더에 앱을 만들지 마라. 이유: `scripts/execute.py`의 ROOT가 `spend-report/`이고 `docs/`·`phases/`가 이미 여기 있다
- `fixtures/`에 파일을 만들거나 커밋하지 마라. 이유: 실명·계좌번호가 든 실제 거래내역 자리다 (ADR-010)
- 상태 관리 라이브러리(zustand, redux, jotai)를 설치하지 마라. 이유: ARCHITECTURE.md에서 `useState`/`useReducer`만 쓰기로 했다
- CSV·xlsx 파싱 라이브러리를 아직 설치하지 마라. 이유: step 2에서 필요한 것만 고른다
- UI 컴포넌트 라이브러리(shadcn, MUI 등)를 설치하지 마라. 이유: `/docs/UI_GUIDE.md`가 직접 스타일을 규정한다
