# 아키텍처

## 디렉토리 구조

```
src/
├── app/                      # 페이지 + API 라우트
│   ├── page.tsx              # 랜딩 (정적 생성, SEO)
│   ├── s/[ticker]/page.tsx   # 종목 상세 — 관련주·재무·차트 (Server Component)
│   ├── login/                # 구글 OAuth 시작 — "Google로 계속하기" 버튼 하나
│   │   ├── actions.ts        # signInWithGoogle 서버 액션 (동의 화면으로 redirect)
│   │   └── callback/route.ts # OAuth code → 세션 교환 후 `next`로 원위치 복귀
│   └── api/
│       ├── search/           # 자동완성 (종목 마스터 조회)
│       ├── report/           # 리포트 조회·생성 (상한 검사 포함)
│       └── logout/           # 세션 종료 (POST)
├── components/               # UI 컴포넌트
│   ├── PeerTable.tsx         # 관련주 + 지표 비교표
│   ├── GrowthChart.tsx       # 분기 매출 성장률 오버레이 (Client)
│   ├── SearchBox.tsx         # 자동완성 (Client)
│   ├── ReportGate.tsx        # 미리보기 + 블러 + 구글 로그인 CTA
│   └── GoogleSignInButton.tsx # <form action={signInWithGoogle}> — Server Component
├── types/                    # TypeScript 타입 정의
├── lib/                      # 유틸리티 + 헬퍼
│   ├── xbrl.ts               # XBRL 태그 → 표준 지표 매핑
│   ├── correlation.ts        # 분기 성장률 상관계수 (표본 수 반환)
│   ├── tenk.ts               # 10-K에서 Item 1 / 1A / 7 섹션 추출
│   └── format.ts             # 숫자·통화·비율 포맷터
├── services/                 # 외부 API 래퍼
│   ├── edgar.ts              # SEC EDGAR (companyfacts, submissions, 10-K 원문)
│   ├── anthropic.ts          # Claude API
│   └── supabase/             # 서버/클라이언트 클라이언트 분리
└── middleware.ts             # Supabase 세션 쿠키 갱신 (@supabase/ssr)

scripts/                      # 배치 (Vercel Cron 또는 수동 실행)
├── seed-companies.ts         # S&P 500 목록 + CIK 매핑 초기 적재
├── sync-financials.ts        # EDGAR companyfacts 수집 → 지표 정규화 (일 1회)
├── build-peers.ts            # 관련주 사전생성 (분기 1회, Batch API)
└── build-correlations.ts     # 분기 매출 성장률 상관계수 재계산 (분기 1회)
```

## 패턴

- **Server Components 기본.** 검색 결과 화면은 전부 DB 조회이므로 서버에서 렌더링해 클라이언트 번들과 워터폴을 최소화한다.
- **Client Component는 세 곳만** — 검색 자동완성, 성장률 차트(툴팁·호버), 리포트 게이트(모달).
- **외부 API 키는 서버에서만.** EDGAR는 키가 없지만 User-Agent 헤더가 필수이고, Anthropic 키와 Supabase service role 키는 절대 클라이언트로 내려가지 않는다. 모든 외부 호출은 Route Handler 또는 배치 스크립트에서만 일어난다.
- **LLM은 요청 경로에서 최대한 배제한다.** 관련주는 사전생성된 DB 행이고, 리포트는 캐시 히트가 기본 경로다. 캐시 미스 시에만 실시간 생성한다.
- **로그인 수단은 구글 OAuth 하나뿐이다(ADR-014).** 로그인 버튼은 Client Component가 아니라 서버 액션을 호출하는 `<form>`이다 — Client 허용 세 곳(자동완성·차트·리포트 게이트)을 늘리지 않기 위해서다. 브라우저에는 `NEXT_PUBLIC_*` 두 개 외에 어떤 인증 비밀도 내려가지 않는다.
- **미들웨어는 세션 쿠키 갱신만 한다.** 미들웨어에서 접근을 막지 않는다 — 보호 대상이 `/api/report` 하나뿐이라 그 라우트 안에서 직접 검사하는 편이 경로가 짧고, 검색·재무·차트를 실수로 잠글 위험도 없다.

## 데이터 흐름

### 1. 검색 → 종목 상세 (읽기 전용, 비용 0)

```
사용자 입력 → SearchBox(Client) → /api/search → Supabase companies
                                                      ↓
                                              /s/[ticker] 이동
                                                      ↓
   Server Component → Supabase (peer_map + financials + correlations) → HTML 렌더
```

LLM 호출 없음, 외부 API 호출 없음. 그래서 **로그인도 사용량 제한도 걸지 않는다.**

### 2. AI 리포트 (로그인 필요, 비용 발생 지점)

```
"AI 심층 분석 보기" 클릭
        ↓
/api/report?ticker=X
        ↓
① 캐시 조회 (reports 테이블) ──── HIT ──→ 전체 반환 (비용 0)
        │ MISS
        ↓
② 인증 확인 ─── 미로그인 ──→ 첫 문단 미리보기 + 블러 + "Google로 계속하기"
        ↓
③ 사용량 검사
   ├─ 계정당 3건/일 초과 ──→ 429 "오늘 분석 한도 소진"
   └─ 전역 20건/일 초과 ───→ 429 "오늘 신규 분석 마감 (기존 분석은 열람 가능)"
        ↓
④ EDGAR에서 최신 10-K 원문 → Item 1 / 1A / 7 추출 (약 40k 토큰)
        ↓
⑤ Claude Opus 5 호출
        ↓
⑥ reports 테이블에 영구 저장 (모든 사용자 공유) → 응답
```

**캐시는 사용자별이 아니라 종목별이다.** 한 번 생성된 리포트는 이후 모든 사용자가 비용 없이 본다. 그래서 총비용이 사용자 수가 아니라 **고유 종목 수에 비례**한다(누적 상한 구조).

### 3. 로그인 (구글 OAuth 단독, ADR-014)

```
"Google로 계속하기" 클릭 — 리포트 게이트 또는 /login
        ↓
signInWithGoogle 서버 액션
   └─ signInWithOAuth({ provider: 'google',
        redirectTo: `${origin}/login/callback?next=/s/AAPL` })
        ↓
구글 동의 화면 (최초 1회) → /login/callback?code=…&next=/s/AAPL
        ↓
exchangeCodeForSession(code) → 세션 쿠키 설정 (httpOnly)
        ↓
next 경로로 redirect ── 읽던 종목 페이지로 복귀, 리포트 즉시 열림
```

- **계정 생성 단계가 따로 없다.** 최초 구글 로그인 시 `auth.users`에 행이 생기고, 그 `id`가 `usage_user.user_id`가 된다. 프로필 테이블을 만들지 않는다 — 필요한 정보(이메일)는 전부 `auth.users`에 있다.
- **`next`는 자기 사이트 상대경로만 허용한다.** `/`로 시작하고 `//`가 아닌 값만 통과시키고, 아니면 `/`로 보낸다. 오픈 리다이렉트를 막기 위해서다.
- **콜백 실패(사용자가 동의 거부, `code` 없음, 교환 실패)는 원래 페이지로 되돌리고 배너 한 줄로 알린다.** 별도 에러 페이지를 만들지 않는다.
- 세션 갱신은 `middleware.ts`가 담당하고, 로그아웃은 `/api/logout`(POST)에서 `signOut()` 후 홈으로 보낸다.

### 4. 배치 (Vercel Cron, 1일 1회 UTC)

```
[일 1회]  sync-financials → EDGAR companyfacts (10 req/s 준수)
                          → XBRL 태그 정규화 → financials 테이블 upsert

[분기 1회] build-correlations → financials에서 분기 매출 성장률 산출
                              → 종목쌍 상관계수 + 표본 수 → correlations 테이블

[분기 1회] build-peers → Claude Batch API로 500종목 관련주 후보 생성
                       → companies 테이블 대조로 환각 필터
                       → correlations 조인 → peer_map 테이블
```

Vercel Hobby 크론은 **1일 1회·UTC 고정·실행 시각이 해당 시(hour) 내에서 분산**된다. 미국 장 마감 후 일봉이 아닌 공시 데이터를 받는 용도이므로 이 제약이 문제되지 않는다. 분기 배치는 크론이 아니라 **수동 실행**한다(연 4회뿐이고, 비용이 발생하므로 자동 실행시키지 않는다).

## 데이터 모델

| 테이블 | 역할 | 주요 컬럼 |
|--------|------|-----------|
| `companies` | 종목 마스터 | `ticker`(PK), `cik`, `name`, `name_ko`, `sic`, `is_sp500` |
| `financials` | 정규화된 재무 지표 | `cik`, `period`(분기/연), `metric`, `value` — 지표 10종만 |
| `correlations` | 종목쌍 상관계수 | `ticker_a`, `ticker_b`, `coefficient`, `sample_size`, `computed_at` |
| `peer_map` | 관련주 매핑 | `ticker`, `peer_ticker`, `rank`, `rationale`, `generated_at` |
| `reports` | 리포트 캐시 | `ticker`(UNIQUE), `content`, `model`, `accession_no`, `generated_at` |
| `usage_global` | 전역 일일 카운터 | `date`(PK), `report_count` |
| `usage_user` | 계정별 일일 카운터 | `user_id`, `date`, `report_count` |

- `reports.accession_no`는 리포트 근거가 된 10-K의 공시 번호다. **새 10-K가 공시되면(연 1회) 이 값이 달라지므로 캐시를 무효화**한다.
- `correlations`는 종목쌍 대칭이므로 `ticker_a < ticker_b` 제약으로 중복 저장을 막는다.
- 사용량 카운터는 서버 라우트에서만 갱신하며, RLS로 클라이언트 쓰기를 차단한다.
- `usage_user.user_id`는 `auth.users.id`를 참조한다. **자체 사용자·프로필 테이블을 만들지 않는다** — 구글이 넘겨주는 이메일과 `auth.users`만으로 충분하다(ADR-014).

## 상태 관리

- **서버 상태는 Server Components가 직접 조회한다.** 데이터 페칭 라이브러리를 도입하지 않는다 — 화면 대부분이 정적에 가깝고, 재검증은 라우트 이동으로 충분하다.
- **클라이언트 상태는 `useState`만** — 자동완성 입력값, 차트 호버 대상, 리포트 모달 열림 여부. 전역 상태 관리자를 두지 않는다.
- **인증 상태는 Supabase Auth 헬퍼의 서버 세션**으로 읽는다. 클라이언트에서 세션을 들고 있지 않는다. 로그인 여부는 Server Component가 렌더 시점에 판정하므로, "로그인했는데 블러가 남아 있는" 중간 상태가 존재하지 않는다.

## 에러 처리 원칙

| 상황 | 처리 |
|------|------|
| EDGAR 지표 누락 | 해당 칸에 **"데이터 없음"** 명시. 대체 태그로 추론해 채우지 않는다 |
| 상관계수 표본 부족(< 8분기) | 수치를 숨기고 "표본 부족"으로 표시 |
| 구글 OAuth 취소·콜백 실패 | 원래 보던 경로로 되돌리고 "로그인이 완료되지 않았습니다" 배너 표시. 리포트는 미리보기 상태 유지 |
| LLM 호출 실패 | 캐시에 저장하지 않고 재시도 가능 상태로 둔다. 사용량 카운터도 증가시키지 않는다 |
| 전역 상한 도달 | 신규 생성만 차단. **이미 캐시된 리포트는 계속 열람 가능** |
| EDGAR 429/5xx | 배치는 지수 백오프 후 다음 날로 미룬다. 부분 실패해도 기존 데이터를 지우지 않는다 |

원칙: **빈 값을 그럴듯한 추정치로 채우지 않는다.** 금융 데이터에서 조용히 틀린 숫자를 보여주는 것은 신뢰를 한 번에 잃는 가장 빠른 길이다.

## 외부 설정 (코드로 대신할 수 없는 선결 작업)

구글 로그인은 콘솔 작업이 끝나야 동작한다. 코드만 작성하고 넘어가면 런타임에 `redirect_uri_mismatch`로만 드러나므로, 아래를 먼저 끝낸다.

1. **Google Cloud Console** — OAuth 동의 화면(외부, 앱 이름·지원 이메일·개인정보처리방침 URL) 구성 후 "웹 애플리케이션" 클라이언트 ID/시크릿 발급. 승인된 리디렉션 URI는 **Supabase가 주는 콜백 주소** `https://<project-ref>.supabase.co/auth/v1/callback` 하나다.
2. **Supabase Dashboard → Authentication → Providers → Google** — 위 클라이언트 ID/시크릿 입력 후 활성화.
3. **Supabase Dashboard → Authentication → URL Configuration** — Site URL(운영 도메인)과 Redirect URLs에 `http://localhost:3000/login/callback`, `https://<운영도메인>/login/callback`을 등록. 등록되지 않은 주소로는 되돌아오지 못한다.

클라이언트 시크릿은 **Supabase에만 저장한다.** 앱 코드나 `.env.local`에 두지 않는다 — 토큰 교환은 Supabase가 대신하므로 애플리케이션이 시크릿을 알 필요가 없다.

**개발 중에는 동의 화면을 "테스트" 상태로 두고 본인 계정을 테스트 사용자로 등록하면 된다.** 다만 공개 배포 전에는 동의 화면을 게시해야 하고, 게시에는 **개인정보처리방침 URL이 필요하다** — 이 페이지는 마감 step(랜딩·약관)에서 만들므로, 로그인 step에서 미리 만들려 하지 말고 배포 직전에 게시 절차를 밟는다.
