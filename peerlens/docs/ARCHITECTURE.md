# 아키텍처

## 원칙

공개 검색과 종목 상세는 **버전이 있는 정적 스냅샷**만 읽는다. 공시 수집·실적 일정 갱신·관련주 계산은 별도 갱신 작업에서 끝내고, AI 리포트만 로그인 후 보호된 서버 API에서 생성한다. 따라서 첫 방문자는 인증이나 외부 요청 없이 핵심 정보를 확인하고, 관련주를 선택해 다음 공개 상세로 계속 탐색할 수 있다.

따라서 사용자의 검색 요청은 SEC·일정 제공자·AI 제공자를 직접 호출하지 않는다. 인증 세션, 리포트 캐시, 사용량 제한은 재무 스냅샷과 분리된 서버 저장소에서 관리한다.

## 디렉터리 구조

```
src/
├── app/
│   ├── page.tsx                         # 랜딩 + 검색
│   ├── s/[ticker]/page.tsx              # 종목 상세 (정적 생성)
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # Google OAuth handler
│       └── reports/[ticker]/route.ts    # 로그인 필수 AI 리포트 API
├── components/
│   ├── SearchBox.tsx
│   ├── PeerTable.tsx
│   ├── FinancialStatements.tsx           # 재무제표·출처·상태
│   ├── EarningsDate.tsx                  # 다음 발표일·출처·상태
│   └── AIReport.tsx                      # 로그인 CTA, 생성 버튼, 리포트 패널·재개 상태
├── data/
│   └── market-data.json                  # 지원 종목·재무·일정·관련주 스냅샷
├── lib/
│   ├── correlation.ts
│   ├── format.ts
│   ├── xbrl.ts
│   ├── snapshot.ts                       # 버전·상태 검증
│   ├── report-intent.ts                  # 생성 의도 서명·검증
│   └── report-prompt.ts                  # 리포트 입력 구성
├── services/
│   ├── edgar.ts                          # SEC EDGAR 클라이언트
│   ├── earnings-calendar.ts              # IR/일정 제공자 어댑터
│   └── openai.ts                         # OpenAI Responses 기반 AI 리포트 생성용
├── repositories/
│   └── reports.ts                        # 세션·캐시·사용량 저장소 경계
├── auth.ts                               # Google OAuth와 세션 설정
└── types/
    ├── market.ts
    └── report.ts

scripts/
├── refresh-market-data.ts                # 10-Q·10-K·허용된 8-K → 스냅샷
├── refresh-earnings-calendar.ts          # 발표일 갱신
└── build-peers.ts                        # 후보 생성·상관계수 계산
```

## 데이터 모델

```ts
type FinancialStatement = {
  kind: "income" | "balance" | "cashflow" | "summary"
  fiscalPeriodEnd: string
  filedAt: string
  status: "final" | "preliminary" | "missing"
  sourceForm: "10-Q" | "10-K" | "8-K" | null
  sourceUrl: string | null
  values: Record<string, number | null>
}

type EarningsSchedule = {
  date: string | null
  status: "confirmed" | "estimated" | "unknown" | "rechecking"
  sourceUrl: string | null
  checkedAt: string
}

type MarketSnapshot = {
  ticker: string
  cik: string
  name: string
  dataVersion: string
  updatedAt: string
  financials: FinancialStatement[]
  nextEarnings: EarningsSchedule
  peers: Peer[]
}

type Peer = {
  peerTicker: string
  rank: number
  rationale: string
  revenueGrowthCorrelation: number | null
  sampleSize: number
}

type ReportCache = {
  ticker: string
  dataVersion: string
  promptVersion: string
  body: string
  generatedAt: string
}

type ReportIntent = {
  ticker: string
  dataVersion: string
  action: "generate"
  expiresAt: string
}
```

- `market-data.json`은 지원 종목의 `MarketSnapshot` 배열이다.
- `dataVersion`은 하나의 종목에 표시되는 재무제표·실적일·관련주·AI 리포트의 기준을 연결한다. 종목 단위로 올리며, 한 종목의 갱신이 다른 종목의 리포트 캐시를 무효화하지 않는다.
- `final`은 10-Q/10-K XBRL 값, `preliminary`는 검증된 8-K 분기 매출, `missing`은 안전하게 표시할 수 없는 값이다.
- 대체 XBRL 태그를 추론해 값을 채우지 않는다. 태그·기간이 비교 불가능하면 `null`로 저장한다.
- 상관계수는 8분기 이상 공통 표본이 있을 때만 계산·표시하며, 관련주는 최대 5개다.
- `ReportIntent`는 로그인 전에 사용자가 누른 생성 CTA를 나타내는 짧은 수명의 서버 검증 값이다. URL만으로 만들지 않으며, 만료·불일치 시 리포트 패널의 재시도 상태로 돌아간다.

## 데이터 생성·배포 흐름

```
보호된 갱신 작업
  ├─ SEC EDGAR 제출 이력 감지
  │    └─ 8-K(잠정) / 10-Q·10-K(확정) → 재무 스냅샷 갱신
  ├─ IR·일정 제공자 → 다음 실적 발표일 갱신
  ├─ 변경 종목의 후보 쌍 → 상관계수 재계산
  └─ 스냅샷 검증 성공 → market-data.json 버전 증가 → 정적 배포

사용자 요청
  └─ SearchBox → /s/[ticker] → market-data.json → 정적 HTML
```

- SEC 호출에는 User-Agent를 포함하고 초당 10회 이하로 제한한다.
- 10-Q·10-K가 들어오면 확정값으로 교체한다. 8-K 잠정값은 확정값을 덮어쓰지 않는다.
- 새 스냅샷 생성·검증 또는 배포에 실패하면 기존 JSON을 유지한다.
- 실적일이 지났는데 새 공시가 확인되지 않으면 `rechecking`으로 바꾸며, 지난 날짜를 다음 발표일로 계속 표시하지 않는다.
- 일정 제공자가 정해지지 않은 종목은 `unknown`으로 표시한다. 브라우저에서 제공자를 호출하지 않는다.

## 페이지·인증·리포트 흐름

```
SearchBox(Client) → 지원 종목 선택 → /s/[ticker]
                     └─ 결과 없음/미지원 → 지원 범위 안내 → 다시 검색

/s/[ticker] (정적 공개 상세)
  ├─ 관련주·재무제표·다음 실적 발표일
  │    └─ 관련주 선택 → /s/[peerTicker]
  └─ AI 리포트 CTA
       ├─ 비로그인 → 생성 의도 저장 → Google OAuth
       │                → 원래 /s/[ticker] 리포트 패널 → 검증된 의도만 재개
       └─ 로그인됨 → POST /api/reports/[ticker]
                        ↓
          세션 검증 → 캐시 조회 → 한도 예약 → OpenAI Terra 생성
                    → 캐시 저장 → 리포트 패널
```

- `/api/search`는 만들지 않는다. 50개 목록은 클라이언트에서 필터링한다.
- 상세 페이지는 `generateStaticParams`로 지원 티커만 생성한다. 지원하지 않는 티커는 404 또는 “현재 지원하지 않는 종목” 상태를 명확히 표시하고, 랜딩 검색으로 돌아갈 길을 제공한다.
- 관련주 행은 `peerTicker`의 지원 여부를 배치 검증한 내부 상세 링크다. 새 페이지도 같은 공개 정보 구조를 유지한다.
- Google OAuth 성공 후 콜백 URL과 `ReportIntent`를 검증해 원래 종목 상세로만 복귀시킨다. 단순한 `?report=1` 같은 URL 값이나 페이지 재방문은 새 AI 호출의 근거가 될 수 없다.
- 리포트 API는 세션 확인을 캐시 조회보다 먼저 수행한다. 브라우저에 AI 키·SEC 자격 정보·일정 제공자 키를 보내지 않는다.
- 리포트 생성은 OpenAI Responses API의 `gpt-5.6-terra`를 사용한다. 초기 버전에는 웹·파일 검색 등 OpenAI 도구를 전달하지 않고, 요청한 `ticker + dataVersion`과 일치하는 `market-data.json`의 확정 재무 데이터와 출처만 프롬프트에 넣는다.
- 동일한 `ticker + dataVersion + promptVersion` 리포트만 재사용한다. 새 확정 스냅샷이 배포되면 이전 리포트는 현재 리포트로 반환하지 않는다.

## 상태·오류 처리

| 상황 | 처리 |
| --- | --- |
| XBRL 지표 누락·비교 불가 | “데이터 없음” |
| 8-K 잠정 실적 | “잠정 · 10-Q/10-K 공시 후 확정”과 출처 표시 |
| 검색 결과 없음·미지원 티커 | 지원 범위 안내와 랜딩 검색 링크 |
| 관련주 후보 < 5개 | 실제 후보만 표시하고 부족한 상태를 알림 |
| 상관계수 공통 표본 < 8분기 | “표본 부족”, 수치 숨김 |
| 실적일 출처 누락·충돌 | “발표일 미정” |
| 지난 실적일, 새 공시 미확인 | “발표일 재확인 중” |
| 재무·일정 갱신 실패 | 마지막 정상 스냅샷 유지, 갱신 작업 재시도 |
| 비로그인 리포트 요청 | Google 로그인 CTA, 원래 종목·스냅샷의 생성 의도만 보존, 리포트 본문 미반환 |
| 만료·불일치한 리포트 생성 의도 | 리포트 패널을 열고 새 생성 CTA를 표시, 자동 호출 없음 |
| 인증 만료 | 재로그인 요구 |
| AI 키·제공자 미설정 | “리포트 기능 준비 중”, 내부 설정값 비노출 |
| AI 실패·시간 초과 | 재시도 상태 표시, 실패 결과 미캐시, 한도 예약 취소 |
| 사용자·전역 한도 초과 | 생성 제한 안내, 새 호출 차단 |

## 운영상 필요한 외부 설정

| 설정 | 용도 |
| --- | --- |
| SEC User-Agent | 공시·XBRL 갱신 작업 |
| 실적 일정 제공자 또는 IR 수집 정책 | 미래 발표일의 상태·출처 관리 |
| Google OAuth 클라이언트 ID·비밀·승인 리디렉션 URL | AI 리포트 로그인 |
| `OPENAI_API_KEY`, `gpt-5.6-terra`, 비용 상한 | OpenAI Responses 기반 리포트 생성 |
| 서버 저장소 | 인증 세션, 리포트 캐시, 사용량 제한, 오류 기록 |

구현 전에는 위 설정의 보안 저장 방식, 리포트 보존 기간, 사용자별·전역 한도를 확정한다.
