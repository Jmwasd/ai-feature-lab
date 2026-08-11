# 아키텍처 — M0

## 원칙

M0는 **정적 읽기 서비스**다. 실행 중에는 이미 생성된 JSON만 읽고, 데이터 수집·상관계수 계산·LLM 호출은 개발자가 수동으로 실행하는 배치에서 끝낸다. 따라서 데이터베이스, 인증, API Route, 크론이 필요 없다.

## 디렉터리 구조

```
src/
├── app/
│   ├── page.tsx              # 랜딩 + 검색
│   └── s/[ticker]/page.tsx   # 종목 상세 (Server Component, 정적 생성)
├── components/
│   ├── SearchBox.tsx         # 자동완성 (유일한 Client Component)
│   └── PeerTable.tsx         # 관련주 + 3개 지표 비교표
├── data/
│   └── m0-data.json          # 배치가 생성한 지원 종목·재무·관련주 스냅샷
├── lib/
│   ├── correlation.ts        # 분기 매출 성장률 상관계수와 표본 수
│   ├── format.ts             # 숫자·통화·비율 포맷터
│   └── xbrl.ts               # 세 지표의 엄격한 XBRL 매핑
├── services/
│   ├── anthropic.ts          # 관련주 후보 수동 생성용
│   └── edgar.ts              # 수동 수집용 SEC EDGAR 클라이언트
└── types/
    └── peer.ts               # JSON 스냅샷 타입

scripts/
├── refresh-m0-data.ts        # 50개 종목의 SEC 데이터 수집 → JSON 스냅샷
└── build-m0-peers.ts         # 후보 생성 → 유효 티커 대조 → 후보 쌍 상관계수 → JSON 갱신
```

`m0-data.json`은 앱의 유일한 읽기 모델이다. 별도 저장소·마이그레이션·RLS·세션을 만들지 않는다.

## 데이터 모델

```ts
type M0Company = {
  ticker: string
  cik: string
  name: string
  asOf: string
  latestQuarterRevenue: number | null
  revenueGrowthYoY: number | null
  annualOperatingCashFlow: number | null
  quarterlyRevenueGrowth: Array<{ end: string; value: number | null }>
}

type M0Peer = {
  ticker: string
  peerTicker: string
  rank: number
  rationale: string
  revenueGrowthCorrelation: number | null
  sampleSize: number
}
```

- 표준 지표는 최신 분기 매출, 전년 동기 대비 매출 성장률, 최근 연간 영업현금흐름의 세 개뿐이다.
- 해당 XBRL 태그가 없으면 `null`을 저장한다. 대체 태그를 추론하지 않는다.
- 상관계수는 8분기 이상 공통 표본이 있을 때만 계산·표시한다.
- `M0Peer`는 최대 5개다. 화면 표현을 위해 빈약한 후보를 추가하지 않는다.

## 데이터 생성 흐름

```
개발자 수동 실행
  ├─ refresh-m0-data
  │    └─ SEC EDGAR → 50개 종목의 세 지표·분기 매출 성장률 → m0-data.json
  └─ build-m0-peers
       └─ LLM 후보 → 지원 50개 티커 대조 → 후보 쌍만 상관계수 계산 → m0-data.json
```

- SEC 호출은 User-Agent를 포함하고 초당 10회 이하로 제한한다.
- LLM은 배치에만 존재한다. 페이지, 검색, 브라우저에서 호출하면 안 된다.
- 데이터 기준일과 배치 실행 결과를 검토한 후 JSON을 커밋·배포한다.
- 부분 실패 시 기존 JSON을 유지한다. 빈 값은 `null`로 보존하며 화면에서 “데이터 없음”으로 렌더한다.

## 페이지 흐름

```
SearchBox(Client) → 지원 종목 선택 → /s/[ticker]
                                        ↓
                  Server Component → m0-data.json → 정적 HTML
```

- `/api/search`는 만들지 않는다. 50개 목록은 클라이언트에서 필터링해도 충분히 작다.
- 상세 페이지는 `generateStaticParams`로 지원 티커만 생성한다.
- 지원하지 않는 티커는 404 또는 “현재 지원하지 않는 종목” 상태를 명확히 표시한다.

## 상태·오류 처리

- Client 상태는 `SearchBox`의 입력값·선택 상태에 대한 `useState`뿐이다.
- 전역 상태 관리자, 데이터 페칭 라이브러리, 인증 미들웨어를 도입하지 않는다.

| 상황 | 처리 |
|------|------|
| XBRL 지표 누락 | “데이터 없음” |
| 상관계수 공통 표본 < 8분기 | “표본 부족”, 수치 숨김 |
| 관련주 후보 < 5개 | 실제 후보만 표시하고 부족한 상태를 알림 |
| 배치의 SEC/LLM 실패 | 기존 스냅샷을 유지하고 수동 재실행 |

## M1로 미룬 항목

전체 S&P 500, Supabase, Google OAuth, AI 10-K 리포트, 리포트 캐시·미리보기·사용량 카운터, Vercel Cron, 재무 5년 추이, 성장률 차트는 M0 결과를 검토한 뒤 독립적으로 설계한다.

리포트를 도입할 때는 다음을 새 설계의 필수 조건으로 둔다.

1. 로그인 확인은 캐시 조회와 관계없이 전체 본문 반환보다 먼저 적용한다.
2. 캐시 미스·비로그인 상태에서는 생성되지 않은 “첫 문단”을 가장하지 않고 정적 CTA만 보인다.
3. 전역 상한은 DB의 원자적 예약으로 처리하고 LLM 실패 시 예약을 취소한다.
4. Vercel Cron을 쓴다면 보호된 HTTP Route와 함수 실행 제한을 명시한다.
