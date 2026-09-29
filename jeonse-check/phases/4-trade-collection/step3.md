# Step 3: db-integration-test

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (Stop 훅이 매 턴 `npm run test`를 돌린다)
- `/docs/ADR.md` (ADR-003, ADR-006: 로컬·테스트는 Docker Postgres, 운영 Supabase에 붙여 테스트하지 않음)
- `/.env.example` (로컬 Docker Postgres 실행 예시)
- `/.claude/settings.json` (Stop 훅 명령)
- `/src/server/trades/*` (step 0~1: 계약 테스트 `describeTradeRepositoryContract`, Prisma 구현)
- `/prisma/migrations/*`, `/prisma.config.ts`, `/vitest.config.*`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

실제 PostgreSQL에 붙는 통합 테스트를 `npm run test:db`로 분리한다. 기본 `npm run test`와 Stop 훅에는 들어가지 않는다.

### 1. 설정

- 통합 테스트 파일 패턴: `src/**/*.db.test.ts`. 기본 `npm run test`의 include에서 이 패턴을 **제외**한다.
- `vitest.db.config.*`(또는 Vitest projects)로 `test:db`를 따로 둔다. `package.json`: `"test:db": "..."`.
- 대상 DB: 환경변수 `TEST_DATABASE_URL`. 없으면 테스트를 건너뛰지 말고 "TEST_DATABASE_URL이 필요하다"는 메시지로 실패한다. `.env.example`에 로컬 Docker 예시값과 설명을 추가한다.
- **안전장치**: `TEST_DATABASE_URL`의 호스트가 `localhost`/`127.0.0.1`이 아니거나 `supabase`가 들어 있으면 즉시 실패한다. 이유: ADR-006. 테스트는 테이블을 비우므로 운영 DB에 닿으면 데이터가 지워진다.
- 전역 setup에서 `prisma migrate deploy`를 `TEST_DATABASE_URL` 대상으로 실행하고, 각 테스트 전에 관련 테이블을 비운다.

### 2. 테스트 (`src/server/trades/prisma-repository.db.test.ts`)

- step 0의 `describeTradeRepositoryContract`를 Prisma 구현에 적용한다.
- 추가: 1,000건 이상 배치 upsert 후 재실행 시 행 수 불변, 해제 갱신, `inserted`/`updated` 개수 정확성.

### 3. 실행 확인

- Docker가 동작하면 `.env.example`의 예시대로 테스트용 컨테이너를 띄워 `npm run test:db`를 한 번 실행하고 결과를 summary에 적는다. 컨테이너 이름은 `jeonse-pg-test`로 하고 끝나면 정지한다.
- Docker가 없으면 실행하지 않고 summary에 "test:db 미실행(Docker 없음)"이라고 적는다. 이 경우에도 step은 완료로 둔다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test                                   # *.db.test.ts가 포함되지 않아야 한다
npm run test -- --reporter=verbose 2>&1 | grep -c '\.db\.test' | grep -qx 0
TEST_DATABASE_URL="postgresql://u:p@db.example.supabase.co:5432/postgres" npm run test:db; test $? -ne 0   # 원격 URL 거부
```

## 금지사항

- `test:db`를 Stop 훅이나 기본 `npm run test`에 넣지 마라. 이유: 매 턴 DB가 필요해진다.
- `DATABASE_URL`(개발 DB)을 테스트 대상으로 쓰지 마라. 이유: 테스트가 테이블을 비운다. `TEST_DATABASE_URL`만 쓴다.
- 원격·운영 DB 주소를 허용하지 마라. 이유: ADR-006.
- `.env`를 수정하지 마라. 이유: 사용자의 비밀값 파일이다. `.env.example`만 고친다.
- 기존 테스트를 깨뜨리지 마라.
