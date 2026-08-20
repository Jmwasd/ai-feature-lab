# Step 2: csv-parse

## 읽어야 할 파일

- `/docs/DESIGN.md` — **2.1, 2.2, 2.3 필독.** 파일 구조와 파서 요구사항이 전부 거기 있다
- `src/types/transaction.ts` — step 1 산출물
- `src/lib/__fixtures__/load.ts` — step 0 산출물

## 작업

`src/lib/parse.ts`를 TDD로 만든다. **테스트를 먼저 쓴다.**

```ts
export interface ParseResult {
  transactions: Transaction[];
  queryPeriod: { from: Date; to: Date } | null;  // 헤더의 `조회기간`
}

/** 토스뱅크 거래내역 CSV 원문 → 거래 배열 */
export function parseTossCsv(csv: string): ParseResult
```

### 반드시 처리할 것 (DESIGN.md 2.2)

1. **첫 컬럼은 빈 더미다.** 모든 행이 `,`로 시작한다. 실데이터는 2~9번째 컬럼
2. **헤더 줄 번호를 고정하지 마라.** `거래 일시`가 포함된 행을 찾아 헤더로 삼는다. 샘플에서는 9번째 줄이지만 조회기간·계좌 종류에 따라 달라질 수 있다
3. **날짜** `2026.08.14 20:32:16` — 점 구분. `new Date(문자열)`이 그냥은 안 된다. 직접 파싱하라
4. **금액은 콤마 포함 문자열** `"-39,000"` — 콤마 제거 후 정수. **부호를 유지하라.** 절대값으로 바꾸지 마라
5. **성명·계좌번호는 버린다.** `ParseResult`에 담지 마라 (CLAUDE.md CRITICAL, DESIGN.md 8.1)
6. **`조회기간` 행**은 파싱해서 `queryPeriod`로 돌려준다. 리포트의 기간 한계 고지에 쓴다 (DESIGN.md 4.10)

### 테스트 (`src/lib/parse.test.ts`)

`loadSampleCsv()`가 `null`이면 `it.skip`으로 넘긴다. 픽스처가 있을 때 검증할 것:

- 데이터 행이 **34건**
- 헤더가 **9번째 줄**에서 발견된다
- 더미 첫 컬럼이 무시된다 (`description`에 빈 문자열이 들어가지 않는다)
- 거래 유형 분포: 체크카드결제 25 / 입금 3 / 출금 2 / 프로모션입금 2 / 모임원송금 1 / 이자입금 1
- `2026.08.14 20:32:16` 행의 `at`이 정확히 그 시각으로 파싱된다
- `"-39,000"` → `-39000`
- `queryPeriod`가 `2026.08.01 ~ 2026.08.15`
- 성명(`장민우 외 1인`)·계좌번호(`****-****-8269`)가 결과 어디에도 없다

픽스처와 무관하게 항상 도는 테스트도 만든다 — 안내행 수를 6줄/10줄로 바꾼 **인라인 CSV 문자열**로 헤더 탐색이 동작하는지 검증한다. CI에서 픽스처 없이도 이 부분은 돌아야 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `src/lib/parse.ts`가 순수 함수인가? `fs`·`fetch`·React를 import하지 않았는가? (파일 읽기는 호출자 책임)
   - 테스트가 픽스처 없이도 일부는 통과하는가?
3. `phases/0-initial-release/index.json`의 step 2를 업데이트한다.

## 금지사항

- xlsx 파싱을 구현하지 마라. 이유: 원본 xlsx는 암호화돼 있어 지원하지 않기로 했다 (ADR-001)
- `거래 유형`을 카테고리로 매핑하지 마라. 이유: 그건 결제 수단이지 업종이 아니다 (DESIGN.md 2.3). 분류는 step 4다
- 이 step에서 취소 쌍을 걸러내지 마라. 이유: step 3의 일이고, 취소 행(양수)이 살아 있어야 매칭할 수 있다
- 금액을 `Math.abs()`로 바꾸지 마라. 이유: 부호가 입출금 구분의 유일한 근거다
- `fs.readFileSync`로 픽스처를 직접 읽지 마라. 이유: `parse.ts`는 순수 함수여야 클라이언트에서도 import된다. 파일 읽기는 `__fixtures__/load.ts`가 한다
