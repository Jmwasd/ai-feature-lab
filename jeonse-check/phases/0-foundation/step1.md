# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (server 레이어 규칙, `prisma/` 위치)
- `/docs/ADR.md` (ADR-002 Auth.js v5, ADR-003 Prisma, ADR-004 멱등 upsert, ADR-006 Supabase 연결 문자열)
- `/.env.example` (`DATABASE_URL`, `DIRECT_URL`)
- `/package.json`, `/vitest.config.ts`, `/.gitignore` (step 0 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

Prisma를 설치하고 MVP에 필요한 DB 스키마와 Prisma 클라이언트 진입점을 만든다. 이 step에서는 DB에 연결하지 않는다.

### 1. Prisma 설치와 버전별 설정

`prisma`(dev), `@prisma/client`를 설치하고 설치된 메이저 버전을 확인한다.

- **Prisma 7 이상**: `prisma.config.ts`가 필요하다. 마이그레이션용 datasource url에는 `DIRECT_URL`을 쓴다. 런타임 연결은 `src/server/db.ts`에서 `@prisma/adapter-pg`를 `DATABASE_URL`로 생성해 넘긴다. generator는 버전 문서가 권장하는 방식(예: `prisma-client` + `output`)을 따른다.
- **Prisma 6 이하**: `schema.prisma`의 datasource에 `url = env("DATABASE_URL")`와 `directUrl = env("DIRECT_URL")`를 둔다.

어느 쪽이든 결과는 같아야 한다. 앱 런타임은 `DATABASE_URL`(풀러)을 쓰고, 마이그레이션은 `DIRECT_URL`(직접 연결)을 쓴다. 이유: ADR-006.

생성된 클라이언트 코드를 `src/` 아래에 출력한다면 `src/server/generated/`에 두고 `.gitignore`와 ESLint 무시 대상에 추가한다. 생성 코드는 `import "server-only"` 규칙에서 예외다.

### 2. 스키마 (`prisma/schema.prisma`)

- **Auth.js v5 Prisma adapter 모델**: `User`, `Account`, `Session`, `VerificationToken`. `@auth/prisma-adapter` 공식 문서의 PostgreSQL 스키마를 따른다. adapter 패키지는 이 step에서 설치하지 않는다.
- **enum**: `HouseType { APARTMENT, ROW_HOUSE }`(아파트, 연립다세대), `DealKind { SALE, LEASE }`(매매, 전월세)
- **`Trade`** — 실거래가 캐시. 한 행이 거래 한 건이다.
  - `houseType`, `dealKind`, `lawdCd`(5자리), `dealYmd`(`YYYYMM` 문자열), `umdName`(법정동명), `jibun`, `buildingName`, `exclusiveArea`(전용면적 ㎡), `floor`, `contractDate`(date)
  - 금액은 공공데이터 원본 단위인 만원 정수로 저장하고 필드명에 단위를 붙인다: `priceManwon`(매매가, 매매일 때), `depositManwon`, `monthlyRentManwon`(전월세일 때)
  - 해제 여부 `cancelled`(boolean), `cancelledDate`(nullable)
  - `buildingKey`: 같은 건물을 식별하는 문자열(정규화 규칙은 phase 1 어댑터가 정한다). 인덱스를 건다.
  - **`dedupKey String @unique`** — 거래를 식별하는 자연키 필드들을 이어 붙인 문자열이다. 값은 phase 1 수집 로직이 채운다.
  - 조회 인덱스: `(lawdCd, dealYmd, houseType, dealKind)`, `buildingKey`
- **`CollectionLog`** — 수집 단위(`lawdCd`×`dealYmd`×`houseType`×`dealKind`)당 한 행. `collectedAt`, `itemCount`. 이 네 필드 조합에 unique를 건다.
- **`SavedResult`** — `userId`(User FK, cascade delete), `input Json`, `result Json`, `dataBaseDate`(date), `createdAt`

핵심 규칙:

- `Trade`의 중복 방지는 `dedupKey` 단일 unique로 한다. nullable 컬럼이 섞인 복합 unique를 쓰지 마라. 이유: PostgreSQL은 unique 제약에서 NULL을 서로 다른 값으로 취급하므로, 같은 거래를 다시 수집하면 중복 행이 생겨 ADR-004의 멱등성이 깨진다.
- 금액 컬럼은 만원 단위 `Int`로 둔다. 원 단위로 저장하면 21억 원 이상 거래가 Int32를 넘는다.

### 3. 초기 마이그레이션

DB 없이 SQL을 생성한다. `npx prisma migrate diff`로 빈 상태에서 현재 스키마까지의 SQL을 뽑아 `prisma/migrations/<timestamp>_init/migration.sql`에 저장하고 `migration_lock.toml`(provider postgresql)을 만든다. 플래그 이름은 버전마다 다르니 `npx prisma migrate diff --help`로 확인한다.

### 4. `src/server/db.ts`

```ts
import "server-only";
export const db: PrismaClient; // 개발 모드 핫리로드에서 인스턴스가 늘지 않도록 globalThis 싱글턴
```

Prisma 클라이언트는 이 파일 한 곳에서만 생성한다. 이유: ARCHITECTURE.md의 server 규칙이다.

### 5. 빌드 연동

- `package.json`에 `"postinstall": "prisma generate"`를 추가하고, `build`를 `prisma generate && next build`로 바꾼다.
- 빌드 시점에 DB 연결이나 `DATABASE_URL`이 없어도 `npm run build`가 성공해야 한다. `db.ts`는 모듈 로드 시 연결하지 않는다.

## Acceptance Criteria

```bash
npx prisma validate   # 스키마 유효 (DATABASE_URL/DIRECT_URL이 필요하면 .env.example 값을 환경변수로 넘겨 실행)
npm run lint
npm run build
npm run test
test -f prisma/migrations/*_init/migration.sql
```

## 금지사항

- `prisma migrate dev`, `prisma db push`, `prisma migrate deploy`를 실행하지 마라. 이유: 하네스 세션에는 DB가 없다고 가정한다.
- `.env` 파일을 만들거나 커밋하지 마라. 이유: `.gitignore` 대상이고 비밀값이 들어갈 자리다.
- repository나 수집 로직을 만들지 마라. 이유: phase 1 범위다.
- `@auth/prisma-adapter`, `next-auth`를 설치하지 마라. 이유: phase 2 범위다.
- `supabase-js`를 설치하지 마라. 이유: ADR-006은 Supabase를 DB 호스팅으로만 쓴다.
- 기존 테스트를 깨뜨리지 마라.
