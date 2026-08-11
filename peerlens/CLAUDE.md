# 프로젝트: PeerLens

초기 50개 S&P 500 종목 중 하나를 검색하면, 관련주를 **최대 5개**와 근거·매출 성장률 상관 지표로 한국어로 보여주는 정적 MVP다.

상세 요구사항은 `docs/PRD.md`, 현재 결정은 `docs/ADR.md`, 구현 구조는 `docs/ARCHITECTURE.md`를 따른다. M0의 목적은 관련주 품질 검증이며, 재무 대시보드나 AI 리포트 제품을 만드는 것이 아니다.

## 기술 스택

- Next.js 15 App Router (Server Components 기본)
- TypeScript strict mode
- Tailwind CSS
- 정적 데이터 JSON (`src/data/`) — 배치 스크립트가 생성하고 앱은 읽기만 한다
- SEC EDGAR — 빌드 전 수동 데이터 갱신에서만 사용
- Anthropic SDK — 관련주 후보를 만드는 수동 배치에서만 사용
- 배포: Vercel. Hobby 사용 전에는 개인·비상업 사용 조건을 별도로 확인한다.

## 아키텍처 규칙

### 데이터 · 법적 경계

- CRITICAL: **주가/시세 데이터를 도입하지 마라.** 재무 데이터는 SEC EDGAR만 사용한다. 이유: ADR-002.
- CRITICAL: **AI 출력에 매수/매도 의견과 목표가를 넣지 마라.** 관련성 근거는 사업 관계의 설명으로 한정하며 투자 판단이 아니다. 이유: ADR-003, ADR-007.
- CRITICAL: **결제·구독·로그인·프로필·사용량 제한 코드나 스키마를 만들지 마라.** M0에는 계정 기능과 온디맨드 LLM 호출이 없다. 이유: ADR-004, ADR-006.
- CRITICAL: **데이터가 없으면 "데이터 없음"으로 표시하라.** 대체 XBRL 태그로 추론해 채우거나, 0 또는 대시로 대체하지 마라. 이유: ADR-003.

### 코드 경계

- 외부 API 키는 서버 또는 로컬 배치에서만 사용한다. 앱의 요청 경로와 브라우저에서 SEC·Anthropic을 호출하면 안 된다.
- LLM 호출을 검색 경로에 넣지 마라. 관련주는 사전생성된 정적 데이터만 읽는다.
- Server Components 기본. Client Component는 검색 자동완성 하나만 허용한다.
- 디렉터리 구조는 `docs/ARCHITECTURE.md`를 따른다. 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 생성 데이터는 `src/data/`, 외부 API 래퍼는 `src/services/`에 둔다.
- SEC EDGAR 호출에는 반드시 User-Agent 헤더를 넣고 초당 10요청을 넘기지 마라.

### UI

- `docs/UI_GUIDE.md`의 색상값·컴포넌트 클래스·금지 목록을 따른다.
- 모든 숫자에 `tabular-nums`를 적용한다.
- AI 슬롭 안티패턴(글래스모피즘, 그라데이션 텍스트, 보라색 브랜드 등)을 사용하지 마라.
- 검색 결과는 **최대 5개**다. 품질 기준을 만족하지 않으면 5개를 채우지 말고 부족한 상태를 표시한다.

## 개발 프로세스

- CRITICAL: **`src/lib/`의 순수 로직은 테스트를 먼저 작성하고, 통과하는 구현을 작성하라 (TDD).** 대상: XBRL 태그 매핑, 상관계수 계산, 포맷터. 이 세 곳이 조용히 틀리면 제품 전체가 틀린다.
- UI 컴포넌트와 페이지에는 테스트를 요구하지 않는다. 3~4주 일정에서 비용 대비 가치가 낮다.
- 커밋 메시지는 conventional commits 형식을 따른다 (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- 요청받지 않은 리팩터링, 추상화, 추가 기능을 만들지 마라. 지금 필요한 가장 단순한 구현을 선택한다.

## 환경 변수

`.env.local`에 두고 절대 커밋하지 않는다.

```
ANTHROPIC_API_KEY=  # 관련주 수동 배치에만 필요
SEC_USER_AGENT=     # SEC EDGAR 요구사항: "이름 이메일" 형식
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
