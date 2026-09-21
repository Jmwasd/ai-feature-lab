# 프로젝트: changelens

로컬 git 저장소를 읽어, 무엇을 언제 어떻게 바꿨는지 정리해 보여주는 로컬 실행 도구.

## 기술 스택
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS
- Vitest (테스트)
- Node.js 20 이상
- `@anthropic-ai/sdk` (커밋 요약), `google-auth-library` (ID 토큰 검증)

## 아키텍처 규칙
- CRITICAL: git 호출, Anthropic API 호출, 세션 검증은 **서버에서만** 한다. 서버 컴포넌트 또는 `app/api/` 라우트 핸들러 안에서만 실행하며, 클라이언트 컴포넌트에서 직접 호출하지 마라. 이유: 저장소 경로와 API 키가 브라우저로 새어나간다.
- CRITICAL: 저장소 경로(`CHANGELENS_REPO`), `ANTHROPIC_API_KEY`, `AUTH_SECRET`은 서버 전용 환경변수다. `NEXT_PUBLIC_` 접두사를 붙이지 마라. 클라이언트가 알아도 되는 값은 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 하나뿐이다.
- CRITICAL: git 명령에 사용자 입력을 문자열로 이어 붙이지 마라. 인자 배열로 넘기고, 커밋 해시는 `^[0-9a-f]{7,40}$`로 검증한 뒤에만 git에 전달한다.
- CRITICAL: 이 도구는 localhost 전용이다. 로그인은 접근 제어가 아니라 화면 흐름이다 (`docs/ADR.md` ADR-2). 인증을 근거로 보안 기능을 추가로 만들지 마라.
- git 접근은 `lib/git/` 한 곳에 모은다. 다른 레이어에서 `child_process`를 직접 부르지 마라.
- 타입은 `types/`, 컴포넌트는 `components/`, 서버 유틸은 `lib/`에 둔다.
- UI 작업 시 `docs/UI_GUIDE.md`가 있으면 작업 전에 읽고 따른다. 세부 디자인 규칙은 이 파일에 중복해서 작성하지 않는다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- git 출력 파서는 임시 디렉터리에 실제 저장소를 만들어(`git init` + 커밋) 검증한다. 파싱 계층을 통째로 모킹하지 마라.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버 (포트 3000 고정)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # Vitest
node bin/changelens.mjs [저장소경로]   # 빌드 결과를 띄우고 브라우저 열기
