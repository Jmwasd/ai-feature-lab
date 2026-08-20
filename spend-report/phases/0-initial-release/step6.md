# Step 6: analyze

## 읽어야 할 파일

- `/docs/DESIGN.md` — **4.5, 4.7, 4.10(반복 결제 임계값), 5.1(파이프라인), 5.2(기댓값 전체) 필독**
- `src/lib/parse.ts`, `cancel.ts`, `categorize.ts`, `events.ts` — 전부 읽어라
- `src/types/report.ts`

## 작업

`src/lib/analyze.ts`를 TDD로 만든다. **이 프로젝트에서 가장 중요한 파일이다.** 여기가 틀리면 리포트 전체가 틀린다.

```ts
/** 파이프라인 전체를 묶어 리포트를 만든다. 서버와 클라이언트 양쪽에서 호출된다 */
export function analyze(
  txs: Transaction[],
  opts: {
    queryPeriod?: { from: Date; to: Date } | null;
    llmCategories?: Record<string, Category>;  // 적요 → 카테고리. step 7이 채운다
    overrides?: Record<string, Override>;      // 사용자 보정. step 10이 채운다
  }
): Report
```

### 순서 (DESIGN.md 5.1 — 이 순서를 바꾸지 마라)

```
취소 쌍 탐지  →  소비 필터  →  분류  →  이벤트 묶음  →  집계
```

취소 탐지가 소비 필터보다 **앞선다.** 취소 행은 양수라 소비 필터를 먼저 돌리면 사라져서 매칭할 수 없다.

### 소비 정의 (DESIGN.md 4.7)

`체크카드결제` + `출금` 중 **음수만**. 취소 쌍으로 판정된 거래는 양쪽 다 제외. `overrides[id].excluded === true`인 것도 제외.

### 집계 항목

- **반복 결제** — **묶는 키는 `description`(적요 원문)이다.** 임계값: 같은 적요 **3회 이상**, 또는 2회이면서 파일 기간이 **30일 이상**. `isPg`인 것은 제외한다 (DESIGN.md 4.10, 4.4)
  - `displayName`으로 묶지 마라. `displayName`은 메모가 있으면 `"{메모} ({적요})"`가 되므로(step 4), 같은 가맹점이라도 메모가 매번 다르면 각각 1회로 흩어져 반복이 영영 안 잡힌다
  - **표시만** `displayName`을 쓴다. 그룹 대표 표시명은 그 적요를 가진 거래 중 첫 건의 `displayName`으로 삼는다
- **집중도** — 상위 3건의 합과 비율
- **이벤트** — `groupEvents()` 결과. 비율은 "같은 파일 기간 소비 대비"임을 `Report`에 드러낸다
- **미분류 비중** — 건수·금액·비율
- **사용자 입력 필요** (`needsInput`) — ① 메모 없는 `출금` 전부, ② 상위 지출 중 `category === '미분류'`인 고액 건 (DESIGN.md 4.5)
- **notes** — `queryPeriod`가 30일 미만이면 "반복 결제 탐지 불가" 고지를 넣는다 (DESIGN.md 4.10)

### 테스트 (`src/lib/analyze.test.ts`)

픽스처 기반 (없으면 skip). **DESIGN.md 5.2의 값이 그대로 나와야 한다:**

```
소비 총액      2,077,810원 / 23건
취소 제외      2건 303,750원
반복 결제      쿠팡이츠 4회 102,300원  — 이 1건만. 2회짜리는 임계값 미달
이벤트         제주 7건 782,430원 (37.7%) / 울진 0건
집중도         상위 3건 1,263,400원 = 60.8%
사용자 입력    출금 2건 + 고액 미분류(쿠팡(쿠페이) 769,900)
```

`overrides`로 `여행비 -200,000`을 `excluded: true` 처리하면 총액이 **1,877,810원 / 22건**이 되는지도 검증한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `analyze.ts`가 순수 함수인가? React·Next·fs·fetch를 import하지 않았는가? **클라이언트에서도 import된다** (ADR-003)
   - 같은 입력에 같은 출력인가? (`Date.now()`·`Math.random()` 사용 금지)
3. `phases/0-initial-release/index.json`의 step 6을 업데이트한다.

## 금지사항

- 파이프라인 순서를 바꾸지 마라. 이유: 취소 탐지가 소비 필터 뒤로 가면 취소 행이 이미 걸러져 매칭이 깨진다
- 반복 결제에 PG를 넣지 마라. 이유: PG는 가맹점이 아니라 결제 경로다. 샘플에서 `토스페이_TOSS 2회`가 발견으로 올라오면 실패다 (DESIGN.md 2.4)
- 반복 결제를 `displayName`으로 그룹핑하지 마라. 이유: 메모가 섞인 표시명은 같은 가맹점을 쪼갠다. 묶기는 `description`, 표시만 `displayName`이다
- 이벤트 비율과 집중도 비율을 더할 수 있는 것처럼 표현하지 마라. 같은 돈이 중복 계상된다. 이유: 상위 3건 중 2건이 여행 이벤트에 포함돼 있다 (DESIGN.md 5.2)
- `Date.now()`를 쓰지 마라. 이유: 테스트가 불안정해진다. 기간은 거래 데이터와 `queryPeriod`에서만 얻는다
