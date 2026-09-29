# Step 6: auth-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (routes 레이어, `_actions/`, Server/Client 경계)
- `/docs/ADR.md` (ADR-002: 보호 페이지는 서버에서 `auth()`로 다시 확인)
- `/docs/UI_GUIDE.md` (§1 레드 CTA 개수, §3 레이아웃, §4 TopNav·Button)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/server/auth.ts`, `/src/server/protected-paths.ts`, `/src/proxy.ts` (step 5)
- `/src/components/TopNav.tsx`, `/src/components/Button.tsx` (step 1)
- `/src/app/page.tsx`, `/src/app/_components/*` (step 2~4)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

로그인·로그아웃 흐름과 보호 페이지 `/check`의 자리를 만든다.

### 1. 로그인·로그아웃 액션

- 두 개 이상의 라우트(랜딩, `/check`)에서 쓰므로 `src/features/auth/`에 둔다. 서버에서만 실행되는 파일이다.

  ```ts
  "use server";
  export async function signInWithGoogle(formData: FormData): Promise<void>; // callbackUrl 기본값 "/check"
  export async function signOutAction(): Promise<void>;                      // 로그아웃 후 "/"
  ```

- `callbackUrl`은 같은 사이트 상대 경로(`/`로 시작하고 `//`로 시작하지 않는 값)만 허용하고, 아니면 `/check`로 바꾼다. 이유: 오픈 리다이렉트를 막는다. 이 검사는 순수 함수로 분리해 테스트한다.

### 2. TopNav 인증 영역

- `src/features/auth/AuthNavAction.tsx`(Server Component): `auth()`로 세션을 읽어, 비로그인이면 "지금 확인하기"(secondary, `/check`), 로그인 상태면 "내 조회"(`/check`)와 로그아웃 버튼(`tertiary-text`)을 `TopNav`의 `action`으로 넘긴다.
- 랜딩 `page.tsx`가 이 컴포넌트를 조합한다. `TopNav`(shared)가 `auth`를 직접 import하지 않게 한다.

### 3. `/check` 보호 페이지

- `src/app/check/page.tsx`(Server Component): 첫 줄에서 `auth()`로 세션을 확인하고 없으면 `redirect("/?callbackUrl=/check")`. proxy가 이미 막더라도 이 확인을 지우지 마라(ADR-002).
- 내용은 자리만: 헤드라인 "주소와 보증금을 입력해 주세요"와 "조회 화면은 준비 중이에요" 안내, 로그인한 사용자 이름.
- 랜딩의 `callbackUrl` 쿼리가 있으면 로그인 CTA가 그 값을 `signInWithGoogle`에 넘긴다.

### 4. 로그인 진입

- 비로그인 사용자가 `/check`로 가면 proxy가 `/?callbackUrl=/check`로 보낸다. 랜딩에서 `callbackUrl` 쿼리가 있으면 히어로 근처에 "로그인이 필요해요" 안내와 Google 로그인 버튼(primary)을 보여준다. 이때도 뷰포트당 레드 CTA는 1~2개를 지킨다(UI_GUIDE §1).

### 5. 테스트

- `callbackUrl` 검사 함수: 상대 경로 허용, 절대 URL·`//evil.com`·빈 값은 `/check`.
- `/check` 페이지: `auth`를 모킹해 세션이 없으면 `redirect`가 호출된다(`next/navigation` 모킹). Google을 실제로 호출하지 않는다.
- `AuthNavAction`: 세션 유무에 따라 버튼이 바뀐다(`auth` 모킹).

## Acceptance Criteria

```bash
npm run lint
env -u DATABASE_URL -u DIRECT_URL -u AUTH_SECRET -u AUTH_GOOGLE_ID -u AUTH_GOOGLE_SECRET npm run build
npm run test
grep -n 'auth()' src/app/check/page.tsx   # 페이지 안 세션 확인이 있어야 한다
```

## 금지사항

- `/check` 페이지의 세션 확인을 proxy에만 맡기지 마라. 이유: ADR-002. proxy matcher 실수나 우회가 생겨도 페이지가 막아야 한다.
- `src/components/`에서 `@/server/auth`나 `@/features/auth`를 import하지 마라. 이유: shared는 상위 레이어를 참조하지 않는다.
- Client Component에서 `@/server/*`를 import하지 마라. 이유: CLAUDE.md CRITICAL.
- 조회 폼이나 결과 화면을 만들지 마라. 이유: phase 2 범위다.
- `/saved` 페이지를 만들지 마라. 이유: phase 6 범위다. 보호 경로 목록에만 있다.
- 기존 테스트를 깨뜨리지 마라.
