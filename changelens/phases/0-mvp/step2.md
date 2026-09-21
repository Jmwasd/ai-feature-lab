# Step 2: auth

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「인증 계층」, 「라우트와 환경변수」
- `/docs/ADR.md` — ADR-2, ADR-3
- Step 0 산출물: `package.json`, `vitest.config.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

구글 ID 토큰 → 서명된 세션 쿠키 → 미들웨어 게이트를 만든다. **테스트를 먼저 쓴다.**

### 1. `types/auth.ts`

```ts
export type Session = { sub: string; email: string; name: string; picture: string; exp: number }; // exp: 초 단위 epoch
```

### 2. `lib/auth/`

| 파일 | 내보내는 것 | 런타임 |
|---|---|---|
| `session.ts` | `SESSION_COOKIE = "changelens_session"`, `signSession(s: Session, secret: string): Promise<string>`, `verifySession(token: string \| undefined, secret: string, nowSec?: number): Promise<Session \| null>` | Edge·Node 공용 |
| `next.ts` | `sanitizeNext(v: string \| null \| undefined): string \| null` | Edge·Node 공용 |
| `google.ts` | `verifyGoogleIdToken(idToken: string, clientId: string): Promise<Session>` | Node 전용 |

- 토큰 형식은 `base64url(JSON).base64url(HMAC-SHA256)`. 서명·검증은 `crypto.subtle`(Web Crypto)로 하고, 비교는 `crypto.subtle.verify`로 한다(문자열 `===` 비교 금지).
- `verifySession`은 서명 불일치, 형식 오류, `exp` 경과에 모두 `null`. 예외를 던지지 않는다.
- `sanitizeNext`: `/`로 시작하는 내부 경로만 통과. `//`, `/\`, `http:`·`https:` 등 스킴, 빈 값은 `null`.
- `verifyGoogleIdToken`: `google-auth-library`의 `OAuth2Client.verifyIdToken({ idToken, audience: clientId })`. 페이로드에서 `Session` 필드만 뽑는다. 허용 계정 제한은 두지 않는다(ADR-2).

### 3. `app/api/session/route.ts`

- `POST` — 본문 `{ credential: string }`. `NEXT_PUBLIC_GOOGLE_CLIENT_ID`가 없으면 503, 본문이 틀리면 400, 토큰 검증 실패면 401. 통과하면 `signSession` 결과를 쿠키로 굽고 200 `{ email }`.
  - 쿠키: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = `exp - 현재초`. `Secure`는 붙이지 않는다(http://localhost).
- `DELETE` — 쿠키를 지우고 204.
- `AUTH_SECRET`은 `process.env`에서 읽는다.

### 4. `middleware.ts` (프로젝트 루트)

- matcher: `/repo/:path*`, `/repo`, `/api/commits`, `/api/summary/:path*`, `/api/session`.
- `/api/session`은 `DELETE`만 검사한다(`POST`는 로그인 자체라 공개).
- 세션이 유효하면 통과. 아니면:
  - `/repo` 이하 → `/?next=<원래 경로+쿼리>`로 **303**.
  - API → **401** `{ error: "unauthorized" }` JSON.
- `lib/auth/session.ts`만 import한다.

### 5. `instrumentation.ts` (프로젝트 루트)

`register()`에서 Node 런타임이고 빌드 단계가 아닐 때(`process.env.NEXT_PHASE !== "phase-production-build"`) `AUTH_SECRET`이 없으면 만드는 방법(`.env.local.example` 주석의 명령)을 담은 에러를 던져 서버 기동을 멈춘다.

### 6. 테스트

- `session`: 왕복, 서명 변조, 다른 secret, 만료, 형식 오류.
- `next`: `/repo/abc?x=1` 통과, `//evil.com`·`/\evil.com`·`https://x`·`""`·`null` 거절.
- `route`: `verifyGoogleIdToken`을 모킹하고 POST 성공 시 `Set-Cookie`에 `HttpOnly`·`SameSite=Lax`·`Path=/`, 검증 실패 401, 클라이언트 ID 없음 503, DELETE 쿠키 삭제.
- `middleware`: `NextRequest`로 호출해 쿠키 없음 → `/repo/x` 303(`next` 보존), `/api/commits` 401, `POST /api/session` 통과, 유효 쿠키 → 통과.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음 (AUTH_SECRET 유무와 관계없이)
npm test
```

## 금지사항

- `middleware.ts`나 `lib/auth/session.ts`에서 `google-auth-library`, `node:crypto`, `Buffer` 같은 Node 전용 API를 import하지 마라. 이유: 미들웨어는 Edge 런타임이라 빌드가 깨지거나 런타임에 실패한다.
- `jose` 같은 JWT 라이브러리를 추가하지 마라. 이유: 스택 고정, Web Crypto로 충분하다.
- 세션을 메모리·파일·DB에 저장하지 마라. 이유: ADR-3 — 상태는 서명된 쿠키 안에만.
- 허용 이메일·도메인 목록, 역할, 감사 로그를 만들지 마라. 이유: ADR-2 — 로그인은 접근 제어가 아니다.
- `AUTH_SECRET`을 `NEXT_PUBLIC_`으로 만들거나 클라이언트 코드에서 읽지 마라. 이유: CLAUDE.md 서버 전용 환경변수.
- 빌드 단계에서 `AUTH_SECRET` 검사로 실패하게 만들지 마라. 이유: 빌드는 `.env.local` 없이도 통과해야 한다.
- 화면(로그인 카드, GIS 스크립트)을 만들지 마라. 이유: Step 4의 범위다.
