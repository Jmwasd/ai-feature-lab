# Architecture Decision Records

되돌리기 어렵거나 여러 기능과 step에 영향을 주는 기술 결정만 기록한다.
단순한 구현 선택이나 쉽게 바꿀 수 있는 세부 사항은 ADR로 만들지 않는다.

## ADR-001: Next.js App Router 풀스택

- **결정**: 프론트엔드와 서버(Route Handler·Server Action)를 Next.js App Router 한 앱에 둔다.
- **근거**: 공공데이터 서비스키를 서버에 숨기고, OAuth와 DB 접근까지 앱 하나로 처리할 수 있다. Vite SPA와 별도 API 서버로 나누면 앱 두 개, 배포 두 번, CORS와 세션 처리가 더해진다.
- **영향/제약**: 배치 수집은 Next 런타임 밖에서 돌아야 하므로 별도 CLI로 둔다(ADR-004). 서버 전용 코드는 `src/server/`에 격리한다(ARCHITECTURE.md).

## ADR-002: 인증은 Auth.js v5 + Google provider

- **결정**: Auth.js v5(NextAuth)의 Google provider와 Prisma adapter로 로그인과 세션을 처리한다.
- **근거**: App Router와 가장 널리 쓰이는 조합이고 Google provider가 내장돼 있다. Supabase Auth는 특정 BaaS에 묶이고 로컬 테스트가 어렵다.
- **영향/제약**: v4 문서와 섞지 않는다. 설정은 v5 API(`auth()`, `handlers`) 기준으로 작성한다.

## ADR-003: PostgreSQL + Prisma

- **결정**: 실거래가 캐시, 사용자, 저장 결과를 PostgreSQL에 두고 Prisma로 접근한다.
- **근거**: 스키마와 마이그레이션 흐름이 성숙했고 Auth.js Prisma adapter를 쓸 수 있다.
- **영향/제약**: 로컬에는 Postgres(예: Docker)가 필요하다. 지역·월 단위 대량 upsert나 복잡한 집계에서 Prisma API로 부족하면 `src/server/` 안에서만 raw SQL을 쓴다. `prisma generate`가 빌드 전에 돌아야 한다.

## ADR-004: 실거래가는 배치 수집 캐시 + 캐시 미스 시 온디맨드 보충

- **결정**: `npm run collect` CLI가 `LAWD_CD`×`DEAL_YMD` 단위로 실거래가를 받아 DB에 upsert한다. 조회한 지역·월이 캐시에 없으면 그 단위만 즉시 받아 저장한다.
- **근거**: API 호출 한도가 있어 매번 조회할 수 없다. CLI는 배포 환경(cron 플랫폼, 함수 실행 시간 제한)에 묶이지 않고 테스트하기 쉽다. 온디맨드로만 하면 첫 조회가 느리고 호출량을 예측할 수 없다.
- **영향/제약**: 수집과 온디맨드 보충이 같은 수집 함수(`src/server/`)를 공유해야 한다. upsert는 멱등해야 한다(같은 지역·월을 다시 수집해도 중복이 생기지 않는다). 해제된 거래는 저장 단계에서 표시하거나 제외한다.

## ADR-005: 정책 수치는 `src/consts/policy.ts` 한 곳에서 관리

- **결정**: HUG 보증 기준 비율, 최우선변제금, 전세가율 임계치 같은 정책 수치를 코드 상수 파일 하나에 모으고, 값마다 시행일과 출처를 주석으로 단다.
- **근거**: 버전 관리와 테스트가 되고, 바뀌었을 때 고칠 곳이 한 군데다. DB 설정 테이블은 관리자 UI와 시드가 필요해 MVP에는 과하다.
- **영향/제약**: 수치를 바꾸려면 배포해야 한다. 다른 파일에 같은 값을 하드코딩하지 않는다(CLAUDE.md CRITICAL).
