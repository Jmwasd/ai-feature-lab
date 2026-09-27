# 프로젝트: jeonse-check

## 기술 스택
- Next.js (App Router) 풀스택 — 화면과 Route Handler·Server Action을 한 앱에 둔다
- TypeScript strict mode
- Auth.js v5 (NextAuth) — Google OAuth
- PostgreSQL + Prisma
- Vitest
- npm

## 아키텍처 규칙
- CRITICAL: 공공데이터 서비스키, 외부 API 호출, DB(Prisma) 접근은 `src/server/`에서만 한다. Client Component와 `shared` 레이어에서 이들을 import하지 마라. 이유: 서비스키가 클라이언트 번들로 새는 것을 폴더 경계로 막는다.
- CRITICAL: 결과 문구에 "안전"처럼 단정하는 표현을 쓰지 마라. "위험 신호 N개" 형식으로 쓰고, 결과 화면에는 항상 면책 문구·데이터 기준일·출처를 함께 표시한다. 이유: 권리관계는 사용자 입력에 의존하고 공공데이터에는 신고 지연이 있어 안전을 보장할 수 없다.
- CRITICAL: 정책 수치(HUG 보증 기준 공시가격×126%, 최우선변제금, 전세가율 임계치 등)는 `src/consts/policy.ts` 밖에 하드코딩하지 마라. 이유: 정책이 자주 바뀌고, 한 곳에서 시행일·출처와 함께 관리해야 한다.
- 세부 레이어와 의존성 규칙은 `docs/ARCHITECTURE.md`를, 되돌리기 어려운 결정은 `docs/ADR.md`를 따른다.
- UI 작업 시 `docs/UI_GUIDE.md`가 있으면 작업 전에 읽고 따른다. 세부 디자인 규칙은 이 파일에 중복해서 작성하지 않는다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- CRITICAL: 테스트에서 실제 외부 API(공공데이터포털 등)를 호출하지 마라. 응답은 fixture(XML/JSON 파일)로 대체한다. 이유: Stop 훅이 매 턴 테스트를 돌리므로 호출 한도와 네트워크 불안정성에 테스트가 흔들리면 안 된다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (Vitest)
npm run collect  # 실거래가 배치 수집 CLI (지역코드·계약월 단위)
