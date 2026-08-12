# 프로젝트: PeerLens

초기 50개 S&P 500 종목 중 하나를 검색하면, 관련주 **최대 5개**와 그 근거·매출 성장률 상관 지표, 최신 공시 재무 요약, 다음 실적 발표일을 한국어로 보여주는 서비스다. AI 분석은 공개 정보를 확인한 뒤 사용자가 명시적으로 요청하는 선택 기능이다.

상세 요구사항은 `docs/PRD.md`, 현재 결정은 `docs/ADR.md`, 구현 구조는 `docs/ARCHITECTURE.md`를 따른다. 구현의 첫 우선순위는 로그인 없이 검색·상세·관련 종목 탐색을 끝낼 수 있는 공개 사용자 여정이며, AI 리포트는 이를 가리거나 지연시키면 안 된다.

## 기술 스택

- Next.js 15 App Router (Server Components 기본)
- TypeScript strict mode
- Tailwind CSS
- 정적 데이터 JSON (`src/data/`) — 배치 스크립트가 생성하고 공개 화면은 읽기만 한다
- SEC EDGAR — 빌드 전 수동 데이터 갱신에서만 사용
- OpenAI Responses API (`gpt-5.6-terra`) — 로그인 후 AI 리포트 생성에만 사용
- 관련주 후보 생성 LLM — 로컬 배치에서만 실행한다. 제공자는 미정이며 `docs/TODO.md`의 사용자 결정 2에서 확정한다 (ADR-003)
- Auth.js(NextAuth) 기반 Google OAuth·서버 저장소 — AI 리포트 인증·캐시·한도에만 사용
- 배포: Vercel. Hobby 사용 전에는 개인·비상업 사용 조건을 별도로 확인한다.

## 아키텍처 규칙

### 데이터 · 법적 경계

- CRITICAL: **주가/시세 데이터를 도입하지 마라.** 재무 데이터는 SEC EDGAR만 사용한다. 이유: ADR-002.
- CRITICAL: **AI 출력에 매수/매도 의견과 목표가를 넣지 마라.** 관련성 근거는 사업 관계의 설명으로 한정하며 투자 판단이 아니다. 이유: ADR-003, ADR-009.
- CRITICAL: **결제·구독·프로필을 만들지 마라.** 로그인·세션·사용량 제한은 AI 리포트 생성·본문 조회에만 쓴다. 공개 검색·상세에는 장벽을 두지 않는다. 이유: ADR-007, ADR-008.
- CRITICAL: **데이터가 없으면 "데이터 없음"으로 표시하라.** 대체 XBRL 태그로 추론해 채우거나, 0 또는 대시로 대체하지 마라. 8-K 분기 매출은 허용된 경우에만 `잠정`으로 구분한다. 이유: ADR-005.

### 코드 경계

- 외부 API 키는 서버 또는 로컬 배치에서만 사용한다. 공개 요청 경로와 브라우저에서 SEC·실적 일정 제공자·OpenAI를 호출하면 안 된다.
- LLM·SEC·일정 제공자 호출을 검색 또는 공개 상세 경로에 넣지 마라. 관련주는 사전생성된 정적 데이터만 읽는다. 런타임 AI 호출은 인증된 `reports` API에서만 허용하고, 관련주 후보 생성 LLM은 로컬 배치에서만 실행한다.
- Server Components 기본. Client Component는 검색 자동완성과 AI 리포트의 인증·생성 상태에만 허용한다.
- 디렉터리 구조는 `docs/ARCHITECTURE.md`를 따른다. 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 생성 데이터는 `src/data/`, 외부 API 래퍼는 `src/services/`에 둔다.
- SEC EDGAR 호출에는 반드시 User-Agent 헤더를 넣고 초당 10요청을 넘기지 마라.

### UI

- `docs/UI_GUIDE.md`의 색상값·컴포넌트 클래스·금지 목록을 따른다.
- 모든 숫자에 `tabular-nums`를 적용한다.
- AI 슬롭 안티패턴(글래스모피즘, 그라데이션 텍스트, 보라색 브랜드 등)을 사용하지 마라.
- 관련주는 **최대 5개**다. 품질 기준을 만족하지 않으면 5개를 채우지 말고 부족한 상태를 표시한다. 검색 자동완성은 지원 50개 종목을 필터링하는 것이며 이 제한과 무관하다.
- 관련주 행은 지원된 종목의 상세로 연결한다. 미지원 티커·검색 결과 없음에는 지원 범위와 다시 검색할 수 있는 상태를 제공한다.
- 로그인 후에는 로그인 전에 명시적으로 요청한 리포트만 같은 종목·스냅샷으로 재개한다. URL 값이나 페이지 진입만으로 새 AI 호출을 시작하지 마라.

## 개발 프로세스

- CRITICAL: **`src/lib/`의 순수 로직은 테스트를 먼저 작성하고, 통과하는 구현을 작성하라 (TDD).** 대상: XBRL 태그 매핑, 상관계수 계산, 포맷터, 스냅샷·리포트 의도 검증. 이 로직이 조용히 틀리면 제품 전체가 틀린다.
- UI 컴포넌트와 페이지에는 테스트를 요구하지 않는다. 3~4주 일정에서 비용 대비 가치가 낮다.
- 커밋 메시지는 conventional commits 형식을 따른다 (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- 요청받지 않은 리팩터링, 추상화, 추가 기능을 만들지 마라. 지금 필요한 가장 단순한 구현을 선택한다.

## 환경 변수

`.env.local`에 두고 절대 커밋하지 않는다.

```
SEC_USER_AGENT=               # SEC EDGAR 요구사항: "이름 이메일" 형식
OPENAI_API_KEY=               # 로그인 후 AI 리포트 생성에만 필요
GOOGLE_CLIENT_ID=             # Google OAuth
GOOGLE_CLIENT_SECRET=         # Google OAuth
AUTH_SECRET=                  # 세션·생성 의도 서명
EARNINGS_CALENDAR_API_KEY=    # 계약한 일정 제공자 사용 시에만 필요
```

## 명령어

```
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # 린트
npm run test         # 테스트

python3 scripts/execute.py <phase-dir>          # harness step 순차 실행
python3 scripts/execute.py <phase-dir> --push   # 실행 후 push
```
