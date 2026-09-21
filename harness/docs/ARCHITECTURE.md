# 프로젝트 아키텍처 및 아키텍처 경계 규칙

이 문서는 프로젝트의 아키텍처 레이어와 모듈 간 의존성 규칙을 정의한다. 코드를 작성하거나 수정할 때 이 규칙을 반드시 준수한다.

## 1. 폴더 구조 및 레이어 정의

아래 구조는 생성 가능한 폴더와 파일의 위치를 정의한다. 프로젝트를 시작할 때 모든 폴더를 미리 만들지 않는다. 구현에 실제로 필요한 폴더만 생성하고, 빈 폴더나 사용되지 않는 레이어는 두지 않는다.

새 폴더가 필요하면 먼저 기존 레이어 중 책임에 맞는 위치를 선택한다. 기존 레이어로 표현할 수 없는 책임이 생긴 경우에만 이 문서에 레이어와 의존성 규칙을 추가한 뒤 폴더를 생성한다.

### 일반 파일 기반 라우터

| 레이어 (Type) | 패턴 (Pattern) | 설명 |
|---|---|---|
| `root` | `src/routes/_root.tsx`, `src/*.css` | 최상위 루트 구성 요소 및 전역 스타일 |
| `main` | `src/main.tsx` | 애플리케이션 엔트리 포인트 |
| `generated` | `src/routeTree.gen.ts` | 라우터 자동 생성 모듈 |
| `mock` | `src/mock/**/*` | 개발·테스트용 모의 데이터 |
| `shared` | `src/components/**/*`<br>`src/consts/**/*`<br>`src/layout/**/*`<br>`src/hooks/**/*`<br>`src/lib/**/*`<br>`src/store/**/*`<br>`src/types/**/*`<br>`src/utils/**/*`<br>`src/api/**/*` | 공통 재사용 모듈(컴포넌트, 훅, API, 타입, 유틸리티 등) |
| `feature` | `src/features/*/**/*` | 도메인·기능별 캡슐화 모듈 (`src/features/{featureName}/...`) |
| `routes` | `src/routes/*/**/*` | 라우트 페이지와 해당 라우트에서만 사용하는 내부 모듈 (`src/routes/{folderName}/...`) |

```text
src/
├── main.tsx
├── routeTree.gen.ts
├── routes/
│   ├── _root.tsx
│   └── {route}/
│       └── {page}/
│           ├── index.tsx
│           ├── -components/
│           ├── -hooks/
│           ├── -api/
│           └── -schemas/
├── features/
│   └── {featureName}/
├── components/
├── consts/
├── layout/
├── hooks/
├── lib/
├── store/
├── types/
├── utils/
├── api/
└── mock/
```

### Next.js App Router 대응

Next.js에서는 `src/routes/`, `_root.tsx`, `main.tsx`, `routeTree.gen.ts` 대신 App Router 규칙을 사용한다.

| 일반 라우터 레이어 | Next.js App Router 대응 |
|---|---|
| `root` | `src/app/layout.tsx`, `src/app/globals.css` 등 루트 구성 파일 |
| `main` | 별도 애플리케이션 엔트리 포인트 없음. Next.js가 진입점을 관리 |
| `generated` | 애플리케이션이 관리하는 route tree 생성 파일 없음 |
| `routes` | `src/app/**/*` |
| `shared`, `feature`, `mock` | 일반 라우터와 같은 위치 및 규칙 사용 |

Next.js App Router에서 `_components`처럼 이름이 `_`로 시작하는 폴더는 라우팅에서 제외되지만 아키텍처상 `routes` 레이어에 포함한다. `(group)`도 URL 경로에 영향을 주지 않는 라우트 묶음이며 동일하게 `routes` 레이어에 포함한다.

프로젝트가 Next.js를 사용하면 라우트 구조를 `src/app/` 기준으로 구성한다. 별도의 `main`과 `generated` 파일은 만들지 않는다.

## 2. 모듈 간 의존성 및 참조 규칙 (Dependency Rules)

기본 정책은 모든 의존성을 금지하는 것(`disallow`)이다. 아래에 명시된 대상만 참조할 수 있다.

| 참조 주체 | 참조 가능 대상 | 규칙 |
|---|---|---|
| `root` | `shared`, `feature` | 최상위 레이아웃 조합만 담당한다. |
| `main` | `root`, `generated`, `mock`, `shared` | 애플리케이션 초기화와 공급자 연결만 담당한다. |
| `generated` | `root`, `routes` | 생성기가 만든 참조만 허용하며 직접 수정하지 않는다. |
| `mock` | `mock`, `shared`, `feature` | 제품 코드에서 `mock`을 참조하지 않는다. |
| `shared` | `shared` | 상위 레이어를 참조하지 않는다. |
| `feature` | `shared`, 동일한 `feature` 내부 | 서로 다른 feature 간 직접 참조를 금지한다. |
| `routes` | `shared`, `feature`, 동일 라우트 내부의 `routes` | 다른 라우트 모듈을 직접 참조하지 않는다. |

주요 의존성 방향은 다음과 같다.

```text
main ──► generated ──► routes ──► feature ──► shared
 │                         │          │          │
 ├────► root ──────────────┘          │          └─► shared
 ├────► mock                          │
 └────► shared                        └─► shared
```

### shared (공통 모듈)

- `shared` 내부 모듈만 참조할 수 있다.
- `feature`, `routes` 등 상위 또는 특정 레이어를 import할 수 없다.
- 특정 도메인의 타입이나 API가 필요하면 `shared`에 억지로 두지 않고 해당 feature에 둔다.

### feature (기능 모듈)

- `shared`와 동일 feature 내부 모듈만 참조할 수 있다.
- `src/features/A/...`에서 `src/features/B/...`를 직접 참조할 수 없다.
- 여러 feature를 조합해야 하면 `routes` 또는 `root`에서 조합한다.
- 여러 feature가 공유하는 순수 책임은 `shared`로 분리한다.

### routes (라우트 페이지 모듈)

- `shared`, `feature`, 동일 라우트 내부 모듈을 참조할 수 있다.
- 라우트 모듈은 페이지 구성과 기능 조합에 집중한다.
- 다른 라우트 모듈을 직접 참조하지 않는다.
- 두 개 이상의 라우트에서 사용하는 모듈은 책임에 따라 `feature` 또는 `shared`로 이동한다.

## 3. 모듈 작성 및 위치 가이드라인 (Placement Guidelines)

### 라우트 전용 모듈

특정 라우트 페이지에서만 사용하는 컴포넌트, API 요청 함수, 훅, 액션, 스키마 등은 해당 라우트 폴더 안에서 관리하며 모두 `routes` 레이어로 분류한다.

- 일반 파일 기반 라우터에서는 라우팅 대상에서 제외할 내부 폴더에 `-*` 규칙을 사용할 수 있다.
- Next.js App Router에서는 라우팅 대상에서 제외할 내부 폴더에 `_*` 규칙을 사용한다.
- 내부 폴더는 별도 아키텍처 레이어를 만들지 않는다.

### 공유 기능 모듈

여러 페이지나 라우트에서 재사용하는 비즈니스 로직, 상태 관리, 도메인 컴포넌트, 복합 모듈은 `src/features/{featureName}/`에 작성한다.

재사용될 가능성만으로 미리 feature로 올리지 않는다. 처음에는 해당 라우트 안에 두고 실제로 다른 라우트에서 필요해질 때 이동한다.

### 순수 UI 컴포넌트

특정 도메인의 비즈니스 로직 없이 UI 표현과 디자인만 담당하는 공통 컴포넌트는 `src/components/`에 작성한다. `components`는 `shared` 레이어이므로 feature나 route 모듈을 참조할 수 없다.

컴포넌트의 시각적 디자인, 색상, 간격, 타이포그래피와 인터랙션 규칙은 [UI_GUIDE.md](./UI_GUIDE.md)를 따른다. 이 문서에는 해당 규칙을 중복해서 작성하지 않는다.

### API와 상태

- 특정 라우트에서만 쓰는 API 요청과 상태는 해당 라우트 폴더 안에 둔다.
- 한 feature의 도메인 규칙을 포함하는 API 요청과 상태는 해당 feature에 둔다.
- 도메인과 무관하게 여러 모듈에서 쓰는 API 클라이언트와 기반 설정만 `src/api/` 또는 `src/lib/`에 둔다.
- 전역 store에는 실제로 애플리케이션 전체가 공유하는 상태만 둔다.

## 4. Next.js 추가 규칙

- Server Component를 기본으로 사용하고 브라우저 API, 이벤트 처리, 로컬 상태가 필요한 경계에만 `"use client"`를 선언한다.
- `page.tsx`, `layout.tsx`, `route.ts`에는 라우팅과 조합 책임만 둔다.
- 특정 라우트 전용 Server Action은 해당 라우트 폴더 안의 `_actions/`에 두며 `routes` 레이어로 취급한다.
- 여러 라우트에서 사용하는 비즈니스 로직은 feature로 이동한다.
- Route Handler는 해당 URL 구조의 `route.ts`에 두고 핵심 로직은 feature 또는 서버 전용 모듈로 분리한다.
- 서버 전용 모듈이 Client Component의 의존성 그래프에 포함되지 않도록 경계를 유지한다.

## 5. 에이전트 준수 사항 (Checklist)

코드를 수정하거나 파일을 생성하기 전에 이 문서의 아키텍처 경계 규칙을 먼저 검토한다.

- 현재 프로젝트가 일반 파일 기반 라우터인지 Next.js App Router인지 확인했는가?
- 특정 라우트 전용 코드를 해당 라우트 폴더 안에 배치했는가?
- 재사용 가능한 기능을 `src/features/{featureName}/`에 배치했는가?
- 도메인 로직이 없는 공통 UI를 `src/components/`에 배치했는가?
- `shared`에서 상위 레이어를 import하지 않는가?
- 서로 다른 feature 간 직접 참조가 없는가?
- 다른 라우트의 모듈을 직접 import하지 않는가?
- 자동 생성 파일을 직접 수정하지 않았는가?
- Next.js 사용 시 App Router 규칙과 Server/Client Component 경계를 지켰는가?
- 실제로 사용하지 않는 폴더나 레이어를 미리 생성하지 않았는가?
