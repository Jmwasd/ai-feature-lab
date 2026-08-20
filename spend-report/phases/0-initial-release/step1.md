# Step 1: core-types

## 읽어야 할 파일

- `/docs/DESIGN.md` — 2절(입력 데이터 사양), 5.1(파이프라인), 5.2(기댓값)
- `/docs/ARCHITECTURE.md` — 데이터 흐름
- `src/lib/__fixtures__/load.ts` — step 0 산출물

## 작업

`src/types/`에 이 프로젝트의 도메인 타입을 정의한다. **타입만 만든다. 로직은 이후 step에서 붙인다.**

`src/types/transaction.ts`:

```ts
/** 거래 유형 — 파일의 `거래 유형` 컬럼 원값. 카테고리가 아니다 (DESIGN.md 2.3) */
export type TxKind = '체크카드결제' | '출금' | '입금' | '모임원송금' | '프로모션입금' | '이자입금' | string;

export interface Transaction {
  id: string;           // 안정적 식별자. 행 순번 기반으로 생성
  at: Date;             // `2026.08.14 20:32:16` 파싱 결과
  description: string;  // 적요 원문
  kind: TxKind;         // 거래 유형 원값
  amount: number;       // 음수 = 출금. 원 단위 정수
  memo: string;         // 없으면 빈 문자열
  balanceAfter: number;
}
```

`src/types/report.ts`:

```ts
export type Category = '식비' | '카페' | '배달' | '식료품' | '생활' | '교통' | '숙박' | '문화' | '의료' | '수수료/기타' | '미분류';

/** 분류가 어디서 나왔는지. 리포트에서 신뢰도 표시에 쓴다 */
export type CategorySource = 'memo' | 'rule' | 'llm' | 'user' | 'none';

/** 사용자 보정 (DESIGN.md 4.5) */
export interface Override {
  category?: Category;
  excluded?: boolean;   // true = '소비 아님'
}

export interface ClassifiedTx extends Transaction {
  category: Category;
  categorySource: CategorySource;
  displayName: string;  // PG면 메모 기반으로 치환된 이름 (DESIGN.md 5.2)
  isPg: boolean;
  cancelledWith?: string;  // 취소 쌍 상대 거래의 id
  eventKey?: string;       // 이벤트 묶음 키. 예: '제주'
}

export interface Report {
  period: { from: Date; to: Date; days: number };
  queryPeriod?: { from: Date; to: Date };  // 헤더 `조회기간`. 없을 수 있다
  totalSpend: number;
  spendCount: number;
  excludedCancels: { count: number; amount: number };
  byCategory: Array<{ category: Category; amount: number; count: number }>;
  repeats: Array<{ displayName: string; count: number; amount: number }>;
  events: Array<{ key: string; count: number; amount: number; ratio: number }>;
  concentration: { topN: number; amount: number; ratio: number; items: ClassifiedTx[] };
  unclassified: { count: number; amount: number; ratio: number };
  needsInput: ClassifiedTx[];   // 출금 + 고액 미상세 (DESIGN.md 4.5)
  notes: string[];              // 기간 한계 등 고지 문구
}
```

정확한 필드 구성은 재량이지만 **위 개념은 전부 표현돼야 한다.** 특히:

- `Transaction.amount`의 부호가 입출금을 구분한다. 별도 `type: 'in'|'out'` 필드를 두지 마라
- `ClassifiedTx.displayName`은 필수다. PG 적요를 그대로 노출하지 않기 위한 필드다
- `Report.excludedCancels`는 필수다. 뺀 사실을 반드시 표시해야 한다 (DESIGN.md 4.6)

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 타입이 전부 `src/types/`에 있는가? (`src/lib/`나 컴포넌트에 흩어놓지 않았는가)
   - `strict` 모드에서 컴파일되는가?
3. `phases/0-initial-release/index.json`의 step 1을 업데이트한다 (성공 → completed + summary, 실패 → error, 개입 필요 → blocked).

## 금지사항

- 로직을 작성하지 마라. 이 step은 타입 선언만이다. 이유: 파싱 규칙은 step 2에서 테스트와 함께 나온다
- `any`를 쓰지 마라. 이유: strict mode 프로젝트다
- 카테고리 목록에 `여행`을 넣지 마라. 이유: 여행은 카테고리가 아니라 이벤트 축이다 (ADR-006)
