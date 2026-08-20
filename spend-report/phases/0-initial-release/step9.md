# Step 9: report-ui

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — **전문 필독. 안티패턴 표를 특히 확인하라**
- `/docs/DESIGN.md` — **5.3(리포트 섹션 순서) 필독**
- `/docs/PRD.md` — 디자인 방향
- `src/types/report.ts`, `src/app/api/analyze/route.ts`

## 작업

업로드 화면과 리포트 화면을 만든다. 한 페이지(`src/app/page.tsx`)에서 상태로 전환한다.

### 컴포넌트 (`src/components/`)

- `UploadPanel` — 파일 선택 + **변환 안내 3단계** (DESIGN.md 5.3의 0번). `.xlsx`를 고르면 즉시 안내를 띄운다
- `SummarySection` — 기간, 소비 총액, 건수, 제외된 취소 건, **2인 공동 계좌 합계 고지**
- `FindingsSection` — 주인공. 반복 결제 / 이벤트 / 집중도 / 미분류 비중 + **항목 간 중복 고지**
- `CategoryTable` — 카테고리별 지출 (근거로 까는 회고 정보)
- `EventSection` — 이벤트 묶음
- `NoticeSection` — 기간 한계 고지 + **데이터 처리 고지**("미분류 가맹점명이 OpenAI로 전송된다")

### 섹션 순서 (DESIGN.md 5.3 — 바꾸지 마라)

```
요약 → 발견 → 카테고리별 지출 → 이벤트 → AI 요약 → 기간 한계 고지 → 데이터 처리 고지
```

**발견이 카테고리별 지출보다 위에 온다.** 이 순서가 이 제품의 정체성이다 (PRD 목표).

### 표시 규칙

- 금액은 전부 `tabular-nums`, 천 단위 쉼표, `원` 접미
- `displayName`을 쓴다. **적요 원문을 그대로 노출하지 마라** — PG 이름이 보이면 실패다 (DESIGN.md 5.2)
- 미분류·`알 수 없음`을 회색으로 흐리지 마라. 본문 크기로 적는다 (UI_GUIDE 원칙 3)
- 취소로 제외된 건은 `line-through` + `text-neutral-400`

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

수동 확인:
```bash
npm run dev
# fixtures/toss-sample.csv 업로드 → 리포트가 위 순서대로 렌더되는지 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 컴포넌트가 `src/components/`에 있는가?
   - 컴포넌트에서 `fetch`로 OpenAI를 직접 부르지 않는가? (`/api/analyze`만 호출)
   - UI_GUIDE 안티패턴 표에 걸리는 것이 없는가? (glass morphism, gradient text, 파이차트, 이모지 아이콘, 카운트업)
   - 다크모드 대응 코드를 만들지 않았는가?
3. `phases/0-initial-release/index.json`의 step 9를 업데이트한다.

## 금지사항

- 카테고리 파이차트를 만들지 마라. 이유: 이 제품이 하지 않기로 한 회고형 표현이다 (UI_GUIDE 안티패턴)
- 섹션 순서를 바꾸지 마라. 발견이 카테고리보다 아래로 가면 제품의 정체성이 사라진다
- 적요 원문을 직접 렌더하지 마라. `displayName`을 써라. 이유: `엔에이치엔케이씨피 ㈜`는 사용자가 읽을 수 없다
- 다크모드를 만들지 마라. 이유: 인쇄 산출물이고 두 벌을 관리하면 인쇄 경로가 조용히 깨진다 (UI_GUIDE 색상)
- 사용자 보정 UI를 여기서 만들지 마라. 이유: step 10의 일이다
