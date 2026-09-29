# Step 5: auth-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (root 레이어 `src/proxy.ts`, server 레이어 규칙, §4 인증)
- `/docs/ADR.md` (ADR-002: Auth.js v5, database 세션, proxy만으로 보호하지 않음. ADR-003, ADR-006)
- `/.env.example` (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`)
- `/prisma/schema.prisma` (User·Account·Session·VerificationToken), `/prisma.config.ts`
- `/src/server/db.ts` (Prisma 싱글턴, 생성 클라이언트 경로 `src/server/generated/prisma`)
- `/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (Next 16 proxy 규칙)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Auth.js v5 + Google provider + Prisma adapter로 로그인 기반을 세운다. 화면(로그인 버튼, `/check` 페이지)은 step 6에서 만든다.

### 1. 설치

- `next-auth@beta`(v5), `@auth/prisma-adapter`. 설치된 버전을 확인하고, v4 API(`getServerSession`, `pages/api/auth`)를 쓰지 마라.
- `@auth/prisma-adapter`의 peerDependency가 Prisma 7을 포함하는지 확인한다. 생성 클라이언트가 `src/server/generated/prisma`에 있어 `PrismaAdapter(db)`에서 타입이 맞지 않으면, 타입 단언은 `auth.ts` 한 곳에서 최소 범위로만 하고 이유를 주석으로 적는다.

### 2. `src/server/auth.ts`

```ts
import "server-only";
export const { handlers, auth, signIn, signOut } = NextAuth({ ... });
```

- provider: Google. 환경변수는 Auth.js v5 기본 이름(`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`)을 자동 인식하게 둔다.
- adapter: `PrismaAdapter(db)` (`@/server/db`).
- `session.strategy: "database"`. 이유: ADR-002.
- `session` 콜백에서 `session.user.id`를 채우고, 타입 확장(`next-auth` 모듈 augmentation)은 `src/types/next-auth.d.ts`에 둔다.
- 로그인 페이지는 Auth.js 기본 페이지를 쓰지 않고 `/`로 돌려보낸다(`pages.signIn`은 step 6에서 만드는 흐름에 맞춰 `/`로 둔다).

### 3. Route Handler

- `src/app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers;`

### 4. 보호 경로와 proxy

- `src/server/protected-paths.ts`(순수 함수, `server-only`를 두지 않아도 된다. 단 server 레이어에 둔다):

  ```ts
  export const PROTECTED_PREFIXES: readonly string[]; // ["/check", "/saved"]
  export function isProtectedPath(pathname: string): boolean;
  ```

  `/check`, `/check/...`는 보호, `/checkout`처럼 접두어만 같은 경로는 보호하지 않는다.
- `src/proxy.ts`: 보호 경로에 세션이 없으면 `/`로 리다이렉트하고 `callbackUrl`을 붙인다. `config.matcher`는 보호 경로로만 좁힌다. 이유: database 세션이라 확인마다 DB를 조회한다(ADR-002).
- Next 16 proxy는 Node.js 런타임이 기본이다. `runtime` 설정을 넣지 마라(문서상 오류가 난다).

### 5. 빌드·테스트

- `AUTH_*` 환경변수와 `DATABASE_URL`이 없어도 `npm run build`가 통과해야 한다. 모듈 로드 시 DB에 연결하거나 환경변수 부재로 예외를 던지지 않게 한다.
- 테스트: `src/server/protected-paths.test.ts`(경계 케이스 포함). Auth.js 내부나 Google을 호출하는 테스트는 쓰지 않는다.
- `.env.example`은 이미 필요한 변수를 담고 있다. 새 환경변수를 추가하면 이 파일도 갱신한다(CLAUDE.md).

## Acceptance Criteria

```bash
npm run lint
env -u DATABASE_URL -u DIRECT_URL -u AUTH_SECRET -u AUTH_GOOGLE_ID -u AUTH_GOOGLE_SECRET npm run build
npm run test
test -f src/proxy.ts && ! test -f src/middleware.ts
```

## 금지사항

- `src/middleware.ts`를 만들지 마라. 이유: Next 16에서 deprecated이고 `proxy.ts`로 바뀌었다(ARCHITECTURE.md).
- JWT 세션 전략을 쓰지 마라. 이유: ADR-002가 database 전략을 정했다.
- Supabase Auth나 `supabase-js`를 쓰지 마라. 이유: ADR-002, ADR-006.
- `prisma migrate dev`, `db push`를 실행하지 마라. 이유: 하네스 세션에는 DB가 없다. 스키마는 phase 0에서 이미 Auth.js 모델을 담고 있다. 스키마를 바꿔야 하면 `prisma migrate diff`로 새 마이그레이션 SQL을 만든다.
- `.env` 파일을 만들거나 수정하지 마라. 이유: 사용자의 비밀값 파일이다.
- 로그인 버튼이나 `/check` 페이지를 만들지 마라. 이유: step 6 범위다.
- 기존 테스트를 깨뜨리지 마라.
