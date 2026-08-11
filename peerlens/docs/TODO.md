# TODO — 다음 작업 인계

> 이 문서는 새 세션이 맥락 없이 읽고 바로 이어갈 수 있도록 작성됐다.
> 작업 시작 전에 `CLAUDE.md` → `docs/PRD.md` → `docs/ARCHITECTURE.md` → `docs/ADR.md` → `docs/UI_GUIDE.md` 순으로 읽어라.

## 프로젝트 한 줄 요약

미국 주식(S&P 500) 티커를 검색하면 **관련주 8개를 근거와 검증 숫자와 함께** 한국어로 보여주는 무료 서비스. 성공 기준은 배포 후 이메일 가입 30명.

## 지금까지 완료된 것

- [x] 기획 확정 (8라운드 인터뷰로 모든 설계 결정 완료 — 근거는 `docs/ADR.md`의 ADR-001~014에 전부 기록)
- [x] `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`, `docs/UI_GUIDE.md` 작성
- [x] `CLAUDE.md` 작성 (CRITICAL 규칙 8개)
- [x] 로그인 수단 확정 — **구글 OAuth 단독**(ADR-014). 매직링크·이메일 비밀번호는 만들지 않는다
- [x] harness 실행 파일 복사 (`scripts/execute.py`, `.claude/commands/`, `.claude/settings.json`)
- [x] `.gitignore` 작성, 루트 `README.md`에 프로젝트 등록

**코드는 아직 한 줄도 없다.** `package.json`조차 없으며 step 0에서 만든다.

---

## 다음 작업: harness step 파일 생성

### 상태: 아래 분할은 **초안이며 사용자 승인을 받지 않았다.**

새 세션에서 먼저 이 분할을 사용자에게 보여주고 확인을 받아라. 승인되면 아래 3종을 생성한다. 파일 형식은 `.claude/commands/harness.md`의 **D-1, D-2, D-3 섹션**에 정확히 명시돼 있으니 그대로 따를 것.

1. `phases/index.json` — `{"phases": [{"dir": "0-mvp", "status": "pending"}]}`
2. `phases/0-mvp/index.json` — `project: "PeerLens"`, `phase: "0-mvp"`, steps 16개 모두 `"pending"`
3. `phases/0-mvp/step0.md` ~ `step15.md`

### step 작성 시 반드시 지킬 것 (harness.md C섹션 원칙)

- **자기완결성**: 각 step 파일은 독립된 세션에서 실행된다. "앞서 논의한 대로" 같은 외부 참조 금지. 필요한 정보는 파일 안에 전부 적는다.
- **시그니처 수준 지시**: 함수/타입 인터페이스만 제시하고 구현은 에이전트에게 맡긴다. 단 CRITICAL 규칙은 명시적으로 박는다.
- **AC는 실행 가능한 커맨드**: "동작해야 한다"가 아니라 `npm run build && npm test` 같은 실제 커맨드.
- **금지사항은 "X를 하지 마라. 이유: Y" 형식**으로 적는다.
- 모든 step 파일에 "사용자 개입이 필요하면(API 키, 외부 계정, 수동 설정) 즉시 `blocked` 처리하고 중단하라"를 넣는다.

---

## step 분할 초안 (phase: `0-mvp`, 총 16개)

### 데이터 레이어 (0~7) — 이것이 없으면 화면을 만들 수 없다

| # | name | 산출물 | AC 핵심 |
|---|------|--------|---------|
| 0 | `project-setup` | Next.js 15 App Router + TS strict + Tailwind + vitest, `.env.example`, UI_GUIDE 색상 토큰, Pretendard 폰트 | `npm run build && npm test` |
| 1 | `db-schema` | Supabase 마이그레이션 SQL (테이블 7종), RLS 정책, 생성된 TS 타입 | 마이그레이션 적용 + 타입 컴파일 |
| 2 | `edgar-client` | `src/services/edgar.ts` — companyfacts / submissions / 10-K 원문. User-Agent 필수, 10 req/s 제한 | 실제 CIK 1건 fetch 통합 테스트 |
| 3 | `xbrl-mapping` | `src/lib/xbrl.ts` — XBRL 태그 → 표준 지표 10종 매핑. **TDD**. 누락은 `null` 반환 | 태그 변형 케이스 단위테스트 |
| 4 | `seed-companies` | `scripts/seed-companies.ts` — S&P 500 목록 + CIK 적재 | `companies` 테이블 500행 |
| 5 | `sync-financials` | `scripts/sync-financials.ts` — 분기·연 지표 upsert | 실행 후 **결손율 리포트 출력** |
| 6 | `correlation` | `src/lib/correlation.ts` + `scripts/build-correlations.ts` — 분기 매출 성장률 상관계수 + 표본 수. **TDD** | 알려진 입력의 계수 검증 |
| 7 | `peer-generation` | `scripts/build-peers.ts` — Claude Batch API 후보 생성 → 종목 마스터 대조 환각 필터 → `peer_map` | 500종목 × 8개, 마스터 밖 티커 0건 |

### 읽기 UI (8~10)

| # | name | 산출물 |
|---|------|--------|
| 8 | `search-api` | `/api/search` + `SearchBox` 자동완성 (Client) |
| 9 | `stock-page` | `/s/[ticker]` — 관련주 + 지표 비교표 (Server Component) |
| 10 | `growth-chart` | `GrowthChart` — 분기 성장률 오버레이. 관련주는 **색이 아니라 명도로만** 구분 |

### 리포트 (11~13) — 유일한 과금·인증 경로

| # | name | 산출물 |
|---|------|--------|
| 11 | `auth` | Supabase Auth **구글 OAuth 단독**(ADR-014) — `signInWithGoogle` 서버 액션 + `/login/callback` 코드 교환 + `middleware.ts` 세션 갱신 + `/api/logout`. 다른 로그인 수단을 만들지 않는다 |
| 12 | `report-pipeline` | `src/lib/tenk.ts` 10-K 섹션 추출(**TDD**) + `src/services/anthropic.ts` + Opus 5 리포트 생성 |
| 13 | `report-gate` | `/api/report` — 캐시 → 인증 → 상한 검사 순서. `ReportGate` 미리보기 + 블러 |

### 마감 (14~15)

| # | name | 산출물 |
|---|------|--------|
| 14 | `landing` | 랜딩 페이지 + 전 페이지 면책 고지 + 이용약관 + **개인정보처리방침**(구글 OAuth 동의 화면 게시에 URL이 필요하다) |
| 15 | `cron-deploy` | `vercel.json` 크론(일 1회, UTC) + 배포 설정 |

---

## 실행 방법 (step 파일 생성 후)

```bash
cd peerlens
python3 scripts/execute.py 0-mvp          # 순차 실행
python3 scripts/execute.py 0-mvp --push   # 실행 후 push
```

에러/차단 복구는 `.claude/commands/harness.md`의 E섹션 참조.

---

## 반드시 알아야 할 주의사항

### 1. `git add -A`가 저장소 전체를 스테이징한다

`execute.py`는 `cwd=peerlens/`에서 `git add -A`를 실행하지만, git 특성상 **저장소 루트(`lab-ai/`) 전체**가 스테이징된다. 다른 하위 프로젝트(`harness/`, `whiteboard-editor/`)에 미커밋 변경이 있으면 step 커밋에 딸려 들어간다.

**실행 전에 `git status`로 작업 트리를 깨끗하게 만들어라.**

### 2. `blocked`로 떨어질 가능성이 높은 step

- **step 4** — S&P 500 구성종목 목록에 **공식 무료 API가 없다.** 조달처가 미확정 상태다(아래 미확정 사항 참조).
- **step 7** — 실제 LLM 비용 $2~5가 발생하고 `ANTHROPIC_API_KEY`가 필요하다.
- **step 1, 11** — Supabase 프로젝트 생성과 키 발급이 선행되어야 한다.
- **step 11** — 위에 더해 **Google Cloud Console 작업이 전부 수동이다.** OAuth 동의 화면 구성 → 웹 클라이언트 ID/시크릿 발급 → Supabase Google provider에 입력 → Redirect URLs에 `http://localhost:3000/login/callback`과 운영 도메인 등록. 절차는 `docs/ARCHITECTURE.md`의 "외부 설정"에 있다. 에이전트가 대신할 수 없으므로 **콘솔 설정이 끝나지 않았으면 즉시 `blocked` 처리하라.**

### 3. step 5가 진짜 위험 지점이다

XBRL 계정과목 정규화의 실제 커버리지는 여기서 처음 드러난다. **결손율이 30%를 넘으면 지표 목록(10종) 자체를 재조정**해야 하므로, 자동으로 다음 step으로 넘어가지 않도록 결손율 출력을 AC에 포함시킬 것.

### 4. 절대 하지 말아야 할 것 (CLAUDE.md CRITICAL 재확인)

- 주가/시세 데이터 도입 금지 — 무료 API는 웹 표시를 약관으로 금지한다 (ADR-002)
- 결제/구독 코드나 스키마 생성 금지 — 규제 전제가 깨진다 (ADR-004)
- AI 출력에 매수/매도 의견·목표가 금지 (ADR-012)
- 데이터 결손을 대체 태그로 추론해 채우기 금지 — "데이터 없음"으로 표시 (ADR-011)
- 검색 경로에 LLM 호출 금지 (ADR-005)
- 구글 외 로그인 수단 추가 금지, 자체 사용자/프로필 테이블 생성 금지 (ADR-014)

---

## 미확정 사항 (구현 중 결정 필요)

1. **S&P 500 구성종목 목록 조달처.** 공식 무료 API가 없다. 현실적 후보는 Wikipedia의 S&P 500 목록 파싱, 또는 목록을 1회 확보해 JSON으로 커밋하고 분기마다 수동 갱신하는 방식. **step 4 진행 시 사용자에게 확인할 것.**
2. **리포트 프롬프트 본문.** 매수/매도·목표가 금지 제약을 어떤 문장으로 넣을지는 step 12에서 작성한다.
3. **`name_ko`(한국어 회사명) 조달.** `companies` 스키마에는 있으나 채우는 방법이 미정. 비어 있어도 서비스는 동작하므로 우선순위 낮음.

---

## 이후 로드맵 (MVP 이후, 지금은 하지 않음)

MVP에서 의도적으로 제외한 항목은 `docs/PRD.md`의 "MVP 제외 사항"에 이유와 함께 정리돼 있다. 특히 **결제 도입은 규제 전제를 바꾸므로 ADR-004와 ADR-012를 함께 다시 열어야 한다.**
