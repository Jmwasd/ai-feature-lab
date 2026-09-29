# Step 2: collect-cli

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (명령어 `npm run collect`)
- `/docs/ARCHITECTURE.md` (cli 레이어: 인자 파싱과 호출만. server 규칙: CLI는 `tsx --conditions=react-server`로 실행)
- `/docs/ADR.md` (ADR-004)
- `/.env.example`
- `/src/server/trades/*` (step 0·1: `collectUnit`, `ensureCollected`, `monthRange`, Prisma 구현)
- `/src/server/db.ts`, `/prisma.config.ts` (환경변수 로딩 방식)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`npm run collect`로 지역·기간 단위 실거래가를 배치 수집하는 CLI를 만든다.

### 1. 실행 방식

- `tsx`를 devDependency로 설치한다.
- `package.json`: `"collect": "tsx --conditions=react-server src/cli/collect.ts"`. 이유: `src/server/`의 모든 파일에 `import "server-only"`가 있고, `react-server` 조건에서는 빈 모듈로 풀린다(ARCHITECTURE server 규칙). CLI용으로 `server-only`를 지우지 마라.
- 환경변수: `src/cli/collect.ts` 첫 줄에서 `import "dotenv/config";`로 `.env`를 읽는다.

### 2. 인자 (`src/cli/collect.ts`)

```text
npm run collect -- --lawd 11680 --from 202401 --to 202412 [--type apartment,row-house] [--kind sale,lease] [--force] [--dry-run]
```

- `--lawd`는 쉼표로 여러 개. 5자리 숫자만 허용.
- `--type` 기본값 두 유형 모두, `--kind` 기본값 `sale`(판정에 쓰는 것은 매매다).
- `--force`면 신선도와 상관없이 다시 받는다. `--dry-run`이면 받을 단위 목록만 출력한다.
- 인자 파싱은 `parseCollectArgs(argv): CollectArgs`로 분리해 테스트한다. 잘못된 인자는 사용법을 출력하고 종료 코드 1.
- 실행: `ensureCollected`(또는 `--force`면 `collectUnit` 반복)를 Prisma repo와 실제 `fetchTrades`로 호출한다. 단위마다 진행 상황과 결과(받은 건수, 새로 넣은 건수, 갱신 건수)를 한 줄씩 출력하고, 끝에 실패 단위 목록을 출력한다. 실패가 하나라도 있으면 종료 코드 1.
- 끝나면 Prisma 연결을 닫는다.

### 3. CLAUDE.md

- 명령어 목록의 `npm run collect` 설명이 실제 인자와 맞는지 확인하고, 다르면 한 줄 사용 예를 고친다.

### 4. 테스트

- `src/cli/collect-args.test.ts`: 기본값, 여러 지역, 잘못된 지역 코드·월 형식·`from > to` 거부.
- CLI 본체를 실행하는 테스트는 쓰지 않는다(실제 API·DB 필요).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
npm run collect -- --lawd 11680 --from 202401 --to 202403 --dry-run   # DB·API 없이 단위 목록만 출력하고 종료 코드 0
npm run collect -- --lawd 1168 --from 202401 --to 202403 --dry-run; test $? -eq 1   # 잘못된 인자는 종료 코드 1
```

## 금지사항

- 수집 로직을 `src/cli/`에 두지 마라. 이유: ARCHITECTURE cli 규칙. 온디맨드 보충과 공유해야 한다(ADR-004).
- `src/server/` 파일에서 `import "server-only"`를 지우지 마라. 이유: react-server 조건 실행으로 해결한다.
- `--dry-run`에서 DB나 API에 연결하지 마라. 이유: AC가 DB 없는 환경에서 돈다.
- 하네스 세션에서 `--dry-run` 없이 실제 수집을 실행하지 마라. 이유: API 호출 한도를 쓰고 DB가 없다.
- cron·스케줄러 설정을 만들지 마라. 이유: 배포 환경은 이 phase 범위가 아니다(ADR-004).
- 기존 테스트를 깨뜨리지 마라.
