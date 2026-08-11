# 프로젝트: PeerLens

미국 주식(S&P 500) 티커를 검색하면 관련주 8개를 근거와 검증 숫자와 함께 한국어로 보여주는 서비스.
상세 기획은 `docs/PRD.md`, 설계 의도는 `docs/ADR.md`를 따른다.

## 기술 스택

- Next.js 15 App Router (Server Components 기본)
- TypeScript strict mode
- Tailwind CSS
- Supabase (Auth: 구글 OAuth 단독 + Postgres)
- Anthropic SDK (`@anthropic-ai/sdk`), 모델은 `claude-opus-5`
- 배포: Vercel Hobby (Cron 1일 1회, UTC)

## 아키텍처 규칙

### 데이터 · 법적 경계

- CRITICAL: **주가/시세 데이터를 도입하지 마라.** 무료 시세 API는 웹 표시를 재배포로 간주해 약관으로 금지한다. 재무 데이터는 SEC EDGAR만 사용한다. 이유: ADR-002.
- CRITICAL: **AI 출력에 매수/매도 의견과 목표가를 넣지 마라.** 프롬프트에 금지 지시를 명시하고, 리포트 생성 프롬프트를 수정할 때마다 이 제약이 유지되는지 확인하라. 이유: 유사투자자문업 규제 회피(ADR-012).
- CRITICAL: **결제·구독·플랜 관련 코드나 스키마를 만들지 마라.** 무료 서비스이며, 결제를 붙이는 순간 규제 전제가 깨진다. 이유: ADR-004.
- CRITICAL: **데이터가 없으면 "데이터 없음"으로 표시하라.** 대체 XBRL 태그로 추론해 채우거나, 0 또는 대시로 대체하지 마라. 틀린 숫자를 자신 있게 보여주는 것이 이 제품에서 가장 치명적인 실패다. 이유: ADR-011.

### 코드 경계

- CRITICAL: **외부 API 키는 서버에서만 사용한다.** Anthropic 키, Supabase service role 키를 클라이언트 컴포넌트나 브라우저로 내려보내지 마라. 모든 외부 호출은 Route Handler(`src/app/api/`) 또는 `scripts/` 배치에서만 일어난다.
- CRITICAL: **LLM 호출을 검색 경로에 넣지 마라.** 관련주는 사전생성된 DB 행을 읽고, 리포트는 캐시 히트가 기본 경로다. 검색·재무·차트 화면에서 Anthropic API를 호출하면 안 된다. 이유: ADR-005.
- CRITICAL: **로그인은 Supabase 구글 OAuth 하나만 쓴다.** 이메일+비밀번호, 매직링크, 다른 소셜 프로바이더를 추가하지 마라. 자체 `users`/`profiles` 테이블도 만들지 마라 — 사용자 정보는 `auth.users`에만 둔다. 이유: ADR-014.
- 로그인 후 복귀 경로(`next` 파라미터)는 `/`로 시작하고 `//`로 시작하지 않는 **상대경로만** 허용하라. 오픈 리다이렉트가 된다.
- 리포트 생성 전에 반드시 사용량 상한(계정당 3건/일, 전역 20건/일)을 검사하라. LLM 호출이 실패하면 카운터를 증가시키지 마라.
- Server Components 기본. Client Component는 검색 자동완성, 성장률 차트, 리포트 게이트 세 곳만 허용한다. **구글 로그인 버튼은 Client가 아니라 서버 액션을 호출하는 `<form>`으로 만든다.**
- 디렉토리 구조는 `docs/ARCHITECTURE.md`를 따른다. 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 외부 API 래퍼는 `src/services/`.
- SEC EDGAR 호출에는 반드시 User-Agent 헤더를 넣고 초당 10요청을 넘기지 마라.

### UI

- `docs/UI_GUIDE.md`의 색상값·컴포넌트 클래스·금지 목록을 그대로 따른다.
- 모든 숫자에 `tabular-nums`를 적용한다.
- AI 슬롭 안티패턴(글래스모피즘, 그라데이션 텍스트, 보라색 브랜드 등)을 사용하지 마라.

## 개발 프로세스

- CRITICAL: **`src/lib/`의 순수 로직은 테스트를 먼저 작성하고, 통과하는 구현을 작성하라 (TDD).** 대상: XBRL 태그 매핑, 상관계수 계산, 10-K 섹션 추출, 포맷터. 이 네 곳이 조용히 틀리면 제품 전체가 틀린다.
- UI 컴포넌트와 페이지에는 테스트를 요구하지 않는다. 3~4주 일정에서 비용 대비 가치가 낮다.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, chore:)
- 요청받지 않은 리팩터링, 추상화, 추가 기능을 만들지 마라. 지금 필요한 가장 단순한 구현을 선택하라.

## 환경 변수

`.env.local`에 두고 절대 커밋하지 않는다.

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEC_USER_AGENT=          # SEC EDGAR 요구사항: "이름 이메일" 형식
CRON_SECRET=             # Vercel Cron 라우트 보호용
```

**구글 OAuth 클라이언트 ID/시크릿은 여기에 두지 않는다.** Supabase 대시보드(Authentication → Providers → Google)에만 저장하며, 토큰 교환은 Supabase가 수행한다. 로그인 콜백 URL(`/login/callback`) 등록 절차는 `docs/ARCHITECTURE.md`의 "외부 설정"을 따른다.

## 명령어

```
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # 린트
npm run test         # 테스트

python3 scripts/execute.py <phase-dir>          # harness step 순차 실행
python3 scripts/execute.py <phase-dir> --push   # 실행 후 push
```
