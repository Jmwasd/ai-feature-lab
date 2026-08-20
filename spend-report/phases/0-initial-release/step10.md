# Step 10: user-override

## 읽어야 할 파일

- `/docs/DESIGN.md` — **4.2(재집계 경로), 4.5(사용자 입력) 필독**
- `/docs/ADR.md` — ADR-003
- `/docs/ARCHITECTURE.md` — 상태 관리
- `src/lib/analyze.ts`, `src/app/page.tsx`, `src/components/`

## 작업

사용자가 분류를 보정하면 **서버 왕복 없이** 리포트가 갱신되게 만든다.

### 상태

`page.tsx`(Client Component)가 두 가지만 들고 있는다:

```ts
const [transactions, setTransactions] = useState<Transaction[]>([]);   // 서버 응답
const [overrides, setOverrides] = useState<Record<string, Override>>({});
```

리포트는 상태가 아니다. 매번 파생시킨다:

```ts
const report = useMemo(() => analyze(transactions, { overrides, ... }), [transactions, overrides]);
```

**`src/lib/analyze.ts`를 클라이언트에서 import한다.** 이것이 `lib/`을 순수 함수로 유지한 이유다 (ADR-003).

### 컴포넌트

`OverrideControl` — `report.needsInput`의 각 항목에 붙는다:

- 카테고리 선택 (`Category` 목록)
- **`소비 아님(제외)` 선택지** — 필수다. 이게 없으면 `여행비 -200,000` 같은 정산 이체를 뺄 수 없다 (DESIGN.md 4.5)
- 선택 즉시 총액과 모든 발견이 다시 계산돼 보인다

대상 (DESIGN.md 4.5):
1. 메모 없는 `출금` — 샘플에서 `박상은서울주민 6,000`, `여행비 200,000`
2. 상위 지출 중 미분류 고액 건 — 샘플에서 `쿠팡(쿠페이) 769,900`

### 검증 시나리오

`여행비 -200,000`을 `소비 아님`으로 지정하면:
```
2,077,810원 / 23건  →  1,877,810원 / 22건
```
집중도·이벤트 비율도 함께 갱신돼야 한다. 총액만 바뀌고 비율이 그대로면 파생이 아니라 상태로 들고 있는 것이다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

수동 확인:
```bash
npm run dev
# 업로드 → '여행비 200,000'을 '소비 아님'으로 → 총액 1,877,810원 / 22건
# → 재업로드 없이 즉시 반영되는지, 집중도 비율도 바뀌는지 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `analyze()`가 클라이언트에서 호출되는가? 서버 재요청이 없는가?
   - 리포트를 `useState`로 들고 있지 않은가? (파생값이어야 한다)
   - 보정 후 집중도·이벤트 비율까지 갱신되는가?
3. `phases/0-initial-release/index.json`의 step 10을 업데이트한다.

## 금지사항

- 보정할 때마다 파일을 서버로 재전송하지 마라. 이유: 서버는 원본을 이미 버렸다. 클라이언트 재집계가 설계다 (ADR-003)
- 리포트를 `useState`로 들고 부분 갱신하지 마라. 이유: 총액만 맞고 비율이 틀어지는 버그가 생긴다. `useMemo` 파생으로 통째로 다시 계산해라
- 보정값을 `localStorage`에 저장하지 마라. 이유: 저장하지 않는 정책이 브라우저 저장소에도 적용된다 (ADR-002)
- 상태 관리 라이브러리를 도입하지 마라. 이유: 상태가 두 개뿐이다 (ARCHITECTURE.md)
