# 프로젝트 아키텍처 및 아키텍처 경계 규칙

이 문서는 jeonse-check의 아키텍처 레이어와 모듈 간 의존성 규칙을 정의한다. 코드를 작성하거나 수정할 때 이 규칙을 반드시 준수한다.

이 프로젝트는 **Next.js App Router** 풀스택이다(ADR-001). 일반 파일 기반 라우터용 `src/routes/`, `main.tsx`, `routeTree.gen.ts`는 쓰지 않는다.

## 1. 폴더 구조 및 레이어 정의

아래 구조는 생성 가능한 폴더와 파일의 위치를 정의한다. 프로젝트를 시작할 때 모든 폴더를 미리 만들지 않는다. 구현에 실제로 필요한 폴더만 생성하고, 빈 폴더나 사용되지 않는 레이어는 두지 않는다.

새 폴더가 필요하면 먼저 기존 레이어 중 책임에 맞는 위치를 선택한다. 기존 레이어로 표현할 수 없는 책임이 생긴 경우에만 이 문서에 레이어와 의존성 규칙을 추가한 뒤 폴더를 생성한다.

| 레이어 (Type) | 패턴 (Pattern) | 설명 |
|---|---|---|
| `root` | `src/app/layout.tsx`, `src/app/globals.css`, `src/middleware.ts` | 루트 레이아웃, 전역 스타일, 인증 미들웨어 |
| `routes` | `src/app/**/*` (root 파일 제외) | 페이지, Route Handler(`route.ts`), 라우트 전용 내부 모듈 |
| `feature` | `src/features/*/**/*` | 도메인·기능별 모듈 (`src/features/{featureName}/...`) |
| `server` | `src/server/**/*` | 서버 전용 모듈: 공공데이터 API 어댑터, Prisma 클라이언트·repository, Auth.js 설정, 실거래가 수집 로직 |
| `cli` | `src/cli/*.ts` | Next 런타임 밖에서 도는 CLI 진입점 (예: `npm run collect`) |
| `shared` | `src/components/**/*`<br>`src/consts/**/*`<br>`src/hooks/**/*`<br>`src/lib/**/*`<br>`src/types/**/*`<br>`src/utils/**/*` | 도메인과 무관한 공통 재사용 모듈 |
| `mock` | `src/mock/**/*`, `**/__fixtures__/**/*` | 개발·테스트용 모의 데이터, 공공데이터 응답 fixture |

레이어 밖 파일:

- `prisma/schema.prisma`, `prisma/migrations/` — DB 스키마. 코드는 `src/server/`를 거쳐서만 접근한다.
- `scripts/execute.py`, `scripts/test_execute.py` — 하네스 실행기. 앱 코드가 아니다.

```text
src/
├── middleware.ts
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                  # 랜딩
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts
│   └── {route}/
│       ├── page.tsx
│       ├── _components/
│       └── _actions/
├── features/
│   └── {featureName}/            # 예: judgment(판정 계산), rights-input(권리관계 입력)
├── server/
│   ├── auth.ts
│   ├── db.ts
│   ├── public-data/              # 실거래가·공시가격·건축물대장 API 어댑터
│   └── {domain}/                 # repository, 수집 로직
├── cli/
│   └── collect.ts
├── components/
├── consts/
│   └── policy.ts                 # 정책 수치 단일 원본 (ADR-005)
├── hooks/
├── lib/
├── types/
├── utils/
└── mock/
```

`_components`처럼 `_`로 시작하는 폴더는 라우팅에서 제외되지만 아키텍처상 `routes` 레이어에 포함한다. `(group)`도 URL에 영향을 주지 않는 라우트 묶음이며 `routes` 레이어에 포함한다.

## 2. 모듈 간 의존성 및 참조 규칙 (Dependency Rules)

기본 정책은 모든 의존성을 금지하는 것(`disallow`)이다. 아래에 명시된 대상만 참조할 수 있다.

| 참조 주체 | 참조 가능 대상 | 규칙 |
|---|---|---|
| `root` | `shared`, `feature`, `server` | 레이아웃 조합과 인증 미들웨어만 담당한다. |
| `routes` | `shared`, `feature`, `server`, 동일 라우트 내부의 `routes` | `server`는 Server Component, Route Handler, Server Action에서만 import한다. |
| `feature` | `shared`, `server`, 동일한 `feature` 내부 | `server` import는 서버에서만 실행되는 파일에서만 한다. 서로 다른 feature 간 직접 참조를 금지한다. |
| `server` | `shared`, 동일한 `server` 내부 | `feature`, `routes`를 참조하지 않는다. |
| `cli` | `server`, `shared` | 인자 파싱과 호출만 담당한다. 수집 로직은 `server`에 둔다. |
| `shared` | `shared` | 상위 레이어를 참조하지 않는다. |
| `mock` | `mock`, `shared`, `feature`, `server` | 제품 코드에서 `mock`을 참조하지 않는다. |

주요 의존성 방향은 다음과 같다.

```text
root ──► routes ──► feature ──► server ──► shared
            │          │          ▲
            │          └──► shared │
            └──────────────────────┘
cli ──► server
```

### server (서버 전용 모듈)

- 모든 파일 첫 줄에 `import "server-only";`를 둔다. Client Component의 의존성 그래프에 들어오면 빌드가 실패한다. 단, `cli`에서 import하는 수집 로직은 Next 런타임 밖에서 돌므로 `server-only`를 두지 않고, 대신 Client Component에서 import하지 않는다.
- 공공데이터 서비스키, OAuth secret, `DATABASE_URL` 같은 환경변수는 `server`에서만 읽는다.
- Prisma 클라이언트는 `src/server/db.ts` 하나에서만 생성한다.
- 공공데이터 API 응답(XML/JSON)을 파싱해 도메인 타입으로 바꾸는 일은 어댑터(`src/server/public-data/`)가 맡는다. 위쪽 레이어는 원본 응답 형식을 모른다.
- 실거래가 upsert는 멱등해야 한다(ADR-004).

### feature (기능 모듈)

- 판정 계산(전세가율, 부채비율, HUG 가입 가능 여부)처럼 입출력만 있는 순수 로직은 `server`를 import하지 않는 파일에 둔다. 클라이언트와 서버 양쪽에서 쓸 수 있고 테스트하기 쉽다.
- 정책 수치는 `src/consts/policy.ts`에서만 가져온다.
- `src/features/A/...`에서 `src/features/B/...`를 직접 참조할 수 없다. 여러 feature 조합은 `routes`에서 한다.

### routes (라우트 페이지 모듈)

- `page.tsx`, `layout.tsx`, `route.ts`에는 라우팅과 조합 책임만 둔다.
- 라우트 전용 Server Action은 해당 라우트의 `_actions/`에 둔다.
- 다른 라우트 모듈을 직접 참조하지 않는다. 두 개 이상의 라우트에서 쓰는 모듈은 `feature` 또는 `shared`로 옮긴다.

### shared (공통 모듈)

- `shared` 내부 모듈만 참조할 수 있다.
- 특정 도메인의 타입이나 API가 필요하면 `shared`에 억지로 두지 않고 해당 feature나 server에 둔다.

## 3. 모듈 작성 및 위치 가이드라인 (Placement Guidelines)

### 라우트 전용 모듈

특정 라우트에서만 쓰는 컴포넌트, 액션, 스키마는 해당 라우트 폴더 안의 `_*` 폴더에 두며 `routes` 레이어로 분류한다.

### 공유 기능 모듈

여러 라우트에서 재사용하는 비즈니스 로직과 도메인 컴포넌트는 `src/features/{featureName}/`에 둔다. 재사용될 가능성만으로 미리 feature로 올리지 않는다.

### 순수 UI 컴포넌트

도메인 로직 없이 표현만 담당하는 공통 컴포넌트는 `src/components/`에 둔다. 시각 디자인 규칙은 [UI_GUIDE.md](./UI_GUIDE.md)를 따르며 이 문서에 중복해서 쓰지 않는다.

### 결과 표시

판정 결과를 보여주는 컴포넌트는 항상 면책 문구, 데이터 기준일, 출처를 함께 렌더링한다. "안전" 같은 단정 표현을 쓰지 않고 "위험 신호 N개" 형식을 쓴다(CLAUDE.md CRITICAL).

## 4. Next.js 규칙

- Server Component를 기본으로 사용하고 브라우저 API, 이벤트 처리, 로컬 상태가 필요한 경계에만 `"use client"`를 선언한다.
- Route Handler는 해당 URL 구조의 `route.ts`에 두고 핵심 로직은 `feature` 또는 `server`로 분리한다.
- 인증이 필요한 페이지 보호는 `src/middleware.ts`와 `src/server/auth.ts`(Auth.js v5)로 한다(ADR-002).

## 5. 테스트

- Vitest를 쓴다. 테스트 파일은 대상 옆에 `*.test.ts(x)`로 둔다.
- 외부 API를 실제로 호출하지 않는다. 공공데이터 응답은 `__fixtures__/`의 XML/JSON 파일로 대체한다(CLAUDE.md CRITICAL).

## 6. 에이전트 준수 사항 (Checklist)

코드를 수정하거나 파일을 생성하기 전에 이 문서의 아키텍처 경계 규칙을 먼저 검토한다.

- 서비스키, 외부 API, Prisma 접근이 `src/server/` 밖에 있지 않은가?
- `src/server/` 파일에 `import "server-only";`가 있는가? (cli 전용 수집 로직 예외)
- Client Component가 `server` 레이어를 import하지 않는가?
- 정책 수치를 `src/consts/policy.ts` 밖에 하드코딩하지 않았는가?
- 특정 라우트 전용 코드를 해당 라우트 폴더 안에 배치했는가?
- `shared`와 `server`에서 상위 레이어를 import하지 않는가?
- 서로 다른 feature 간 직접 참조가 없는가?
- 테스트가 실제 외부 API를 호출하지 않는가?
- 실제로 사용하지 않는 폴더나 레이어를 미리 생성하지 않았는가?
