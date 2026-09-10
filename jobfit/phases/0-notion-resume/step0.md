# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 설계 근거 전문. 다른 문서와 충돌하면 이것이 우선이다
- `docs/ARCHITECTURE.md` — 디렉토리 구조와 레이어 방향
- `docs/ADR.md` — ADR-001(로컬 전용) · ADR-005(저장 없음)
- `docs/UI_GUIDE.md` — 디자인 원칙과 결정 이력
- `.claude/skills/jobfit-design/SKILL.md` — **"프로젝트에 심는 법" 절에 토큰 심는 방법이 있다**
- `.claude/skills/jobfit-design/references/tokens.css` — **토큰 원본. 값을 바꾸지 마라**

이 step은 UI 컴포넌트를 만들지 않지만 디자인 토큰과 폰트를 프로젝트에 심으므로 위 두 파일을 반드시 읽어라. 하네스는 Claude Code 스킬을 자동으로 불러오지 못하니 경로대로 직접 열어야 한다.

## 현재 상태

프로젝트 루트(`jobfit/`)에 Next.js 프로젝트가 **아직 없다.** 존재하는 것은 이것뿐이다:

```
CLAUDE.md
.gitignore
docs/          PLAN.md · PRD.md · ARCHITECTURE.md · ADR.md · UI_GUIDE.md
scripts/       execute.py · test_execute.py       (하네스. 건드리지 마라)
phases/        하네스 phase 정의                    (건드리지 마라)
.claude/       settings.json · commands/ · skills/jobfit-design/
```

## 작업

### 1. Next.js 스캐폴딩

`create-next-app`은 비어 있지 않은 디렉토리에서 기존 파일과 충돌하면 중단한다. **임시 디렉토리에 생성한 뒤 산출물만 옮겨라.**

```bash
npx --yes create-next-app@latest /tmp/jobfit-scaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes
```

플래그 이름이 설치된 버전과 다르면 `npx create-next-app@latest --help`로 확인해 맞춰라. 결과가 **Next.js 15 App Router + TypeScript + Tailwind v4 + src 디렉토리**이기만 하면 된다.

옮길 때 지켜라:

- **`CLAUDE.md` · `docs/` · `scripts/` · `phases/` · `.claude/`를 덮어쓰거나 지우지 마라.** 이것들이 사라지면 하네스가 다음 step을 실행하지 못한다
- `.gitignore`는 **덮어쓰지 말고 병합한다.** 현재 파일의 `.env*.local` · `phases/**/step*-output.json` · `__pycache__/` · `.pytest_cache/` 항목이 사라지면 안 된다
- create-next-app이 만든 `README.md`는 버린다. 이 프로젝트의 설명은 `CLAUDE.md`와 `docs/`에 있다
- create-next-app이 만든 `public/` 안의 샘플 SVG(`next.svg`, `vercel.svg` 등)는 지운다
- 다 옮긴 뒤 `/tmp/jobfit-scaffold`를 지운다

### 2. TypeScript strict

`tsconfig.json`에 `"strict": true`가 켜져 있는지 확인한다. `paths`에 `"@/*": ["./src/*"]`가 있어야 한다.

### 3. 디렉토리 골격

`docs/ARCHITECTURE.md`의 구조를 만든다. 아직 코드가 없는 디렉토리는 `.gitkeep`을 둔다:

```
src/
├── app/
├── components/
├── types/
├── lib/
├── prompts/
└── services/
```

### 4. 폰트

`src/app/layout.tsx`에서 `next/font/google`로 세 벌을 불러온다. 아트보드가 쓰는 weight는 400과 500뿐이다.

| 폰트 | next/font 변수 |
|---|---|
| Space Grotesk | `--font-space-grotesk` |
| Inter | `--font-inter` |
| IBM Plex Mono | `--font-ibm-plex-mono` |

`tokens.css`의 `--font-display` / `--font-body` / `--font-mono`는 폰트 **스택**이고 next/font 변수는 패밀리 **이름 하나**다. 둘을 같은 이름으로 쓰면 충돌하므로, 스택의 첫 항목만 next/font 변수로 치환한다:

```css
--font-display: var(--font-space-grotesk), Inter, ui-sans-serif, system-ui, sans-serif;
--font-body: var(--font-inter), Arial, ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-ibm-plex-mono), Arial, ui-monospace, monospace;
```

세 변수 클래스를 `<html>`이나 `<body>`에 붙여야 값이 살아난다.

`layout.tsx`의 `metadata`는 `title: "jobfit"` 정도로 최소화한다. `lang="ko"`로 둔다.

### 5. 토큰 심기

`.claude/skills/jobfit-design/references/tokens.css`의 내용을 `src/app/globals.css`에 심는다. **값을 바꾸지 마라.** 구조만 Tailwind v4에 맞춘다.

- Tailwind v4는 `@theme` 블록에 정의한 변수로 유틸리티를 만들고 `:root`에 그 변수를 내보낸다. 그러니 `tokens.css`의 `--color-*` · `--font-*` · `--radius-*` · `--space-*` 정의를 `@theme` 블록으로 옮긴다
- `--surface-page: var(--color-canvas)` 같은 **alias**, `--type-*` 타이포 스케일, `.t-*` 유틸 클래스, `body`/`h1`/`a`/`:focus-visible` base 규칙은 `@theme` 밖 일반 CSS로 그대로 둔다
- `--color-*`를 `@theme`에 넣으면 순환 참조가 되지 않도록 **리터럴 값**을 그대로 적는다(`--color-coral: #ff7759;`). `var(--color-coral)`을 자기 자신에 대입하지 마라

### 6. 다크 모드 제거

create-next-app 기본 `globals.css`에는 `@media (prefers-color-scheme: dark)` 블록과 `--background`/`--foreground` 변수가 들어 있다. **전부 지운다.** `SKILL.md`의 "하지 마라" 표가 다크 모드를 금지하고, `docs/UI_GUIDE.md`가 "라이트 한 벌만 유지한다"고 못박았다.

### 7. Vitest

`vitest`를 devDependency로 설치하고 `vitest.config.ts`를 만든다.

- `test.environment`는 `'node'`. `src/lib/`은 순수 함수라 DOM이 필요 없다
- `test.include`는 `['src/**/*.test.ts']`
- `resolve.alias`에 `'@'` → `./src`를 넣어 `@/types` 같은 import가 테스트에서도 동작하게 한다

`package.json` scripts:

```
"dev": "next dev",
"build": "next build",
"lint": "next lint" 또는 eslint (create-next-app이 만든 것을 유지),
"test": "vitest run --passWithNoTests"
```

`--passWithNoTests`를 붙이는 이유: 이 step에는 아직 테스트가 없어서 `vitest run`이 실패한다. 다음 step부터 실제 테스트가 생긴다.

### 8. 환경 변수 예시 파일

`.env.local.example`을 만든다:

```
OPENAI_API_KEY=
NOTION_TOKEN=
NOTION_RESUME_PAGE_ID=7301b1c4-c17b-47af-918b-626c1fd37f0e
```

**`.env.local`은 만들지 마라.** 키가 없고, 실수로 커밋될 위험만 생긴다.

### 9. 헤더와 빈 페이지

create-next-app이 만든 `src/app/page.tsx`의 기본 랜딩(Next.js 로고·링크 카드)을 전부 지운다.

`src/components/Header.tsx`를 만들고 `layout.tsx`에서 렌더한다. 규격은 `SKILL.md`의 "헤더" 절과 `references/artboard.html`의 `<header>` 요소를 그대로 따른다 — 높이 56px, `border-bottom 1px #d9d9dd`, `padding 0 24px`, 양끝 정렬, 왼쪽 워드마크 `jobfit`(display 18px), 오른쪽 mono 라벨 `LOCAL · 저장 없음`.

`page.tsx`는 컨테이너(`max-width 1180px`, `padding 40px 24px 80px`)만 있는 빈 `main`으로 둔다. 입력 폼은 `1-job-posting` phase에서 만든다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 통과 (테스트 0개 + --passWithNoTests)
```

추가로 아래를 눈으로 확인한다:

```bash
ls CLAUDE.md docs/PLAN.md scripts/execute.py phases/index.json   # 전부 살아 있어야 한다
grep -c "env\*.local" .gitignore                                  # 1 이상
grep -c "prefers-color-scheme" src/app/globals.css                # 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/ARCHITECTURE.md`의 디렉토리 구조(`app` / `components` / `types` / `lib` / `prompts` / `services`)를 만들었는가?
   - `docs/ADR.md`의 스택(Next.js 15 App Router · TS strict · Tailwind · Vitest)을 벗어나지 않았는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히 저장 계층(IndexedDB·DB·파일 캐시)을 만들지 않았는가
   - `SKILL.md`의 "하지 마라" 표를 어기지 않았는가? 토큰에 없는 색을 새로 만들지 않았는가?
3. 결과에 따라 `phases/0-notion-resume/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에는 최소한 이것을 담아라: Tailwind 버전, 토큰을 심은 파일 경로, 폰트 변수 이름 세 개, 테스트 커맨드.

## 금지사항

- **`CLAUDE.md` · `docs/` · `scripts/` · `phases/` · `.claude/`를 옮기거나 덮어쓰거나 지우지 마라.** 이유: 하네스가 이 파일들을 읽어 다음 step을 실행한다. 사라지면 phase 전체가 죽는다
- **`.env.local`을 만들지 마라.** 이유: 값이 비어 있어 쓸모가 없고, `.gitignore`가 있어도 실수로 커밋될 위험만 생긴다
- **`src/lib/` · `src/services/` · `src/types/`에 코드를 쓰지 마라.** 이유: 다음 step들의 범위다. 여기서 미리 쓰면 설계가 어긋난다
- **Tailwind 설정 파일에 컴포넌트 클래스를 만들지 마라.** 이유: `SKILL.md` "프로젝트에 심는 법" 2번 — 규격의 사본이 둘이 되면 어느 쪽이 최신인지 알 수 없다
- **Tailwind 기본 팔레트 색(`bg-blue-500`, `text-gray-700` 등)을 쓰지 마라.** 이유: 토큰에 없는 색이다. 색이 필요하면 `SKILL.md`의 색 표에서 고른다
- **`@media (prefers-color-scheme: dark)`를 남기지 마라.** 이유: 라이트 한 벌만 유지한다
- **`box-shadow` · `backdrop-filter` · gradient를 쓰지 마라.** 이유: 이 시스템에 그림자는 아예 없고, 경계는 전부 1~2px 선이다
- 기존 테스트를 깨뜨리지 마라
