# TODO — M0 작업 인계

> 작업 시작 전에는 `CLAUDE.md` → `docs/PRD.md` → `docs/ARCHITECTURE.md` → `docs/ADR.md` → `docs/UI_GUIDE.md` 순으로 읽는다.

## 프로젝트 한 줄 요약

초기 지원 50개 S&P 500 종목을 검색하면 관련주를 **최대 5개**와 사업 근거·매출 성장률 상관 지표로 보여주는 정적 서비스. M0는 결과 품질을 검증하며, 로그인·리포트·DB 운영을 하지 않는다.

## 현재 결정

- [x] M0 범위를 50개 종목, 최대 5개 관련주, 재무 지표 3개로 축소했다.
- [x] 5년 재무 추이, 9개 선 차트, 전 종목쌍 상관계수, AI 리포트, OAuth, Supabase, Cron을 M1로 미뤘다.
- [x] 정적 JSON 스냅샷을 M0의 유일한 읽기 모델로 결정했다.
- [x] 법적·호스팅 조건을 “무료이므로 문제 없음”이라고 단정하지 않도록 문구를 수정했다.

**애플리케이션 코드는 아직 없다.** `package.json`은 step 0에서 만든다.

## 다음 작업: harness step 파일 생성

다음 분할로 `phases/index.json`, `phases/0-m0/index.json`, `step0.md`~`step5.md`를 만든다. 파일 형식은 `.claude/commands/harness.md`의 D-1, D-2, D-3을 따른다.

| # | name | 산출물 | AC 핵심 |
|---|------|--------|---------|
| 0 | `project-setup` | Next.js 15, TS strict, Tailwind, Vitest, Pretendard, `.env.example` | `npm run build && npm test` |
| 1 | `core-data` | `src/types/peer.ts`, JSON fixture, `xbrl.ts`·`correlation.ts`·`format.ts` TDD | `npm test` |
| 2 | `edgar-snapshot` | `edgar.ts`, `refresh-m0-data.ts`, 50개 스냅샷 생성 | 실제 CIK 1건 통합 테스트와 JSON 스키마 검증 |
| 3 | `peer-generation` | `build-m0-peers.ts`, 후보 티커 검증, 후보 쌍 상관계수 계산 | 최대 5개, 지원 목록 밖 티커 0개 |
| 4 | `static-ui` | 랜딩 검색, `/s/[ticker]` 정적 상세, `PeerTable` | `npm run build` |
| 5 | `deploy` | 데이터 기준일·면책 고지·지원 외 티커 상태·Vercel 배포 설정 | `npm run build && npm test` |

### step 작성 규칙

- 각 step은 독립 세션에서도 실행 가능하도록 필요한 맥락을 파일 안에 넣는다.
- 함수와 타입의 인터페이스는 제시하되, 요청되지 않은 추상화와 기능을 만들지 않는다.
- AC는 실제 실행 커맨드로 쓴다.
- 사용자 개입이 필요한 API 키, 비용 발생, 외부 계정, 50개 지원 종목 확정이 없으면 즉시 `blocked`로 처리하고 중단한다.
- `src/lib/` 순수 로직은 테스트를 먼저 작성한다. UI 페이지 테스트는 요구하지 않는다.

## 아직 필요한 사용자 결정

1. **초기 50개 티커 목록** — 목록을 한 번 확정해 JSON으로 커밋한다. 자동 수집이나 매일 갱신하지 않는다.
2. **관련주 수동 배치 실행 승인** — Anthropic API 키와 실제 비용이 필요하다. step 3에서만 실행한다.
3. **배포 용도** — Vercel Hobby는 개인·비상업 용도 조건을 확인한 후에만 사용한다. 공개 제품·사업 검증 성격이면 적합한 플랜을 별도로 판단한다.

## M0에서 절대 하지 말 것

- 주가·시세 데이터, 주가 차트, 주가 상관계수
- 결제·구독·로그인·프로필·사용량 카운터·Supabase 스키마
- 요청 경로의 SEC 또는 LLM 호출
- 5년 재무 추이, 8~10개 지표, 9개 선 성장률 차트
- 모든 종목쌍 상관계수 사전 계산
- 결손값을 대체 태그·0·대시로 채우기
- 매수·매도 의견, 목표가, 수익 보장 표현

## M1 진입 조건

초기 사용자가 관련주 결과를 유용하다고 평가하고, 50개 스냅샷을 넘어 전체 커버리지·더 깊은 분석을 원한다는 신호가 있을 때만 M1을 별도 설계한다. 그때 AI 리포트, 로그인, DB, Cron을 한 번에 되살리지 말고 각각의 비용·개인정보·동시성·운영 요건을 다시 검토한다.
