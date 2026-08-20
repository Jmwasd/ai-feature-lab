# Step 4: categorize

## 읽어야 할 파일

- `/docs/DESIGN.md` — **2.4(적요 실제 모습), 2.5(메모가 PG를 푼다), 4.4(분류 파이프라인), 8.3(미정 사항) 필독**
- `/docs/ADR.md` — ADR-004
- `src/types/report.ts` (Category, CategorySource), `src/lib/parse.ts`

## 작업

`src/lib/categorize.ts`를 TDD로 만든다. **LLM 호출은 이 파일에 넣지 마라** — 여기는 순수 함수만이고, LLM은 step 7의 `services/openai.ts`다.

```ts
export interface CategorizeResult {
  category: Category;
  source: CategorySource;   // 'memo' | 'rule' | 'none'
  displayName: string;
  isPg: boolean;
}

/** 메모 → 규칙 → 미분류. LLM 단계는 호출자가 별도로 채운다 */
export function categorize(tx: Transaction): CategorizeResult

/** LLM에 보낼 미분류 적요 목록. 중복 제거, 금액은 포함하지 않는다 */
export function collectUnclassified(txs: Transaction[]): string[]
```

### 우선순위 (DESIGN.md 4.4)

1. **메모** — 메모가 있으면 메모 문자열로 카테고리를 정한다. 키워드 규칙을 만든다:
   `숙박비`·`숙소` → 숙박 / `렌트`·`항공권`·`교통` → 교통 / `수수료` → 수수료/기타 등.
   메모 키워드 규칙은 **이 step에서 정의한다.** DESIGN.md 8.3(b)가 미정으로 남겨둔 부분이다
2. **규칙 사전** — 적요 문자열 매칭. 최소한 샘플에 나오는 것은 잡아야 한다:
   쿠팡이츠 → 배달 / 이마트·세계과자할인점 → 식료품 / 올리브영 → 생활 / 탐앤탐스 → 카페
3. **미분류** — 모르면 `미분류`, source `none`. **추측으로 채우지 마라**

### PG 처리 (DESIGN.md 2.4, 4.4)

PG 사전을 둔다: `토스페이_TOSS`, `엔에이치엔케이씨피`, `KG이니시스`, `나이스페이` 등.

- PG로 판정되면 `isPg: true`
- **PG는 규칙 사전 단계로 내려보내지 마라.** 적요에 업종 정보가 없으므로 메모가 없으면 바로 `미분류`다
- `displayName` — 메모가 있으면 `"{메모} ({적요})"` 형태로 치환한다. 예: `제주 2일 숙박비 (엔에이치엔케이씨피 ㈜)`. 메모가 없으면 적요 그대로

### 테스트 (`src/lib/categorize.test.ts`)

픽스처 기반 (없으면 skip):
- `엔에이치엔케이씨피 ㈜` + 메모 `제주도 2일 숙박비` → 숙박, source `memo`, isPg true
- 메모가 적요보다 **우선**한다 (메모와 적요가 서로 다른 카테고리를 가리키는 케이스를 인라인으로 만들어 검증)
- `쿠팡이츠` → 배달, source `rule`
- `막불감동`·`영광과일`·`열매상회`·`신주옥미 신림역점` → 미분류, source `none`
- `collectUnclassified()` 결과에 금액이 포함되지 않는다 (문자열 배열이다)
- `토스페이_TOSS`(메모 없음)가 규칙 단계를 타지 않고 미분류로 떨어진다

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `categorize.ts`에 네트워크 호출이나 `services/` import가 없는가?
   - `Category`에 `여행`이 없는가?
3. `phases/0-initial-release/index.json`의 step 4를 업데이트한다.

## 금지사항

- LLM을 호출하지 마라. 이유: `src/lib/`는 순수 함수만이다. LLM은 step 7
- `거래 유형`을 카테고리로 쓰지 마라. 이유: 결제 수단이지 업종이 아니다 (DESIGN.md 2.3)
- 모르는 가맹점을 그럴듯한 카테고리로 추측하지 마라. `미분류`로 남겨라. 이유: 틀린 숫자보다 없는 숫자가 낫다 (ADR 철학)
- `collectUnclassified()`에 금액·계좌번호·성명을 담지 마라. 이유: 이 배열이 그대로 OpenAI로 나간다 (CLAUDE.md CRITICAL)
