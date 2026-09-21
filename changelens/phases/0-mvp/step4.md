# Step 4: landing

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「인증 계층」 1번(`/`의 세 화면), 「라우트와 환경변수」
- `/.claude/skills/design/SKILL.md`, `/.claude/skills/design/guide.md` — 이 프롬프트의 「디자인 기준」에도 들어 있다. §8 「공통」·「랜딩 `/`」·「로그인 카드」·「차단 · 빈 상태」가 이 step의 화면이다.
- Step 0 산출물: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Step 2 산출물: `lib/auth/next.ts`(`sanitizeNext`), `app/api/session/route.ts`(POST 본문 `{ credential }`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

첫 UI step이다. 디자인 기반을 깔고 `/`를 만든다. 디자인 값은 전부 design 스킬을 따른다 — 이 파일에는 적지 않는다.

### 1. 디자인 기반 (SKILL.md 절차 2)

- `node .claude/skills/design/check_ui.mjs --print-tokens` 출력을 `app/globals.css`에 넣는다.
- `app/layout.tsx`에 SKILL.md가 지정한 Plex 폰트 3종을 싣는다.
- `components/ui/`에 이 화면과 이후 화면이 같이 쓸 조각을 만든다: 로고(마크만 / 마크+글자), 상단 바, 버튼(주·보조·작은 보조, `<button>`과 링크 형태 둘 다), 배지, 카드, 차단·빈 상태 틀(상태 줄·제목·설명·행동 하나). 이후 step이 가져다 쓴다.

### 2. `/` 화면 선택 — `lib/landing.ts` (테스트 먼저)

```ts
export type LandingView = { kind: "landing" } | { kind: "blocked"; next: string } | { kind: "login"; next: string | null };
export function pickLandingView(params: { next?: string | string[]; login?: string | string[] }): LandingView;
```

- `login` 키가 있으면 `login`, 없고 `next`가 `sanitizeNext`를 통과하면 `blocked`, 그 외 `landing`. 통과 못 한 `next`는 버린다.
- `lib/landing.test.ts`로 세 경우와 위험한 `next`(`//evil.com`)를 검증한다.

### 3. `app/page.tsx` (서버 컴포넌트)

- Next 15에서 `searchParams`는 `Promise`다. `pickLandingView`로 고른 화면 하나를 그린다.
- **랜딩** — guide §8 「랜딩」 구성 그대로. 상단 바 `로그인`과 주 버튼 `구글로 시작하기`는 `/?login`으로 간다.
- **차단** — guide §8 「차단 · 빈 상태」의 세션 없음 문구. 주 버튼 `로그인`은 `/?login&next=<next>`로 간다(`encodeURIComponent`).
- **로그인 카드** — guide §8 「로그인 카드」. 버튼 자리에 아래 GIS 컴포넌트.

### 4. `components/GoogleSignIn.tsx` (클라이언트 컴포넌트)

```ts
export function GoogleSignIn(props: { clientId: string | undefined; next: string | null }): React.JSX.Element;
```

- `clientId`가 없으면 버튼 대신 발급 방법 안내: Google Cloud 콘솔 OAuth 클라이언트 ID(웹) 발급, 승인된 JavaScript 원본에 `http://localhost:3000`·`http://localhost` 등록, `.env.local`의 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`에 넣고 `npm run build` 다시.
- 있으면 `https://accounts.google.com/gsi/client`를 `next/script`로 싣고 `google.accounts.id.initialize({ client_id, callback })` → `renderButton`(옵션은 guide §8 「로그인 카드」).
- callback: `POST /api/session` `{ credential }` → 성공하면 `window.location.assign(next ?? "/repo")`, 실패하면 버튼 아래 한 줄 안내(할 일을 쓴다, guide §6).
- `window.google` 타입은 이 파일 안에 최소한으로 선언한다(`any` 금지).
- `app/page.tsx`는 `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`를 읽어 prop으로 넘긴다.

## Acceptance Criteria

```bash
npm run lint
npm run build                              # 컴파일 에러 없음
npm test                                   # lib/landing 테스트 포함
node .claude/skills/design/check_ui.mjs    # 오류 0
```

SKILL.md 절차 5·6대로 검사기가 못 보는 항목(화면당 앰버 두 곳 이하 등)을 직접 확인하고, 검사기 마지막 줄과 함께 summary에 남긴다. 브라우저로 못 봤으면 못 봤다고 적는다.

## 금지사항

- guide.md의 색·크기·간격·문구를 이 step 파일, 컴포넌트 주석, 새 문서에 옮겨 적지 마라. 이유: 원본은 guide.md 하나다.
- GIS 버튼을 직접 그리거나 스타일을 덮어쓰지 마라. 이유: guide §8·§9 — 구글이 렌더한다.
- 로그인 카드를 `/login` 같은 별도 라우트로 만들지 마라. 이유: ARCHITECTURE — `/`의 쿼리로 나눈다.
- `sanitizeNext`를 거치지 않은 `next`로 이동하지 마라. 이유: 외부 사이트로 튕기는 오픈 리다이렉트가 된다.
- 컴포넌트 렌더 테스트용 라이브러리(@testing-library 등)를 추가하지 마라. 이유: ARCHITECTURE 「테스트 전략」 — 로직만 테스트한다.
- `/repo` 화면, 로그아웃 버튼을 만들지 마라. 이유: Step 5의 범위다.
