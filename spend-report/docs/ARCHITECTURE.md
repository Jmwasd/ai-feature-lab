# 아키텍처

## 디렉토리 구조
```
src/
├── app/               # 페이지 + API 라우트
│   ├── page.tsx           # 업로드 + 리포트 (단일 화면)
│   └── api/analyze/route.ts
├── components/        # UI 컴포넌트
├── types/             # TypeScript 타입 정의
├── lib/               # 순수 로직 — TDD 대상. 서버·클라이언트 공유
│   ├── parse.ts           # csv → Transaction[]
│   ├── cancel.ts          # 취소 쌍 탐지
│   ├── categorize.ts      # 메모 → 규칙 → 미분류, PG 사전
│   ├── events.ts          # 메모 키워드 + 시간 근접 이벤트 묶음
│   └── analyze.ts         # 집계·발견 산출
└── services/openai.ts # 외부 API 래퍼 (LLM 분류 + 요약)
```

`lib/`의 5개 모듈은 처리 파이프라인 단계와 1:1로 대응한다. TDD 단위를 명확히 하기 위해서다.

## 패턴

- Server Components 기본. 인터랙션이 필요한 곳만 Client Component
- 업로드·리포트가 한 화면이고 사용자 보정이 클라이언트 상태이므로, `page.tsx`의 리포트 영역은 Client Component다
- `lib/`는 **순수 함수만** 둔다. React·Next·fs·네트워크를 import하지 않는다. 서버(최초 분석)와 클라이언트(재집계) 양쪽에서 같은 코드를 쓰기 때문이다
- 외부 API 호출은 `services/`에서만 한다

## 데이터 흐름

```
[클라이언트] CSV 선택
    │  multipart/form-data (원본 파일 전체)
    ▼
[서버] POST /api/analyze
    │  parse.ts     헤더 탐색 → 더미 컬럼 제거 → 날짜·금액 정규화
    │  cancel.ts    취소 쌍 1:1 매칭 → 양쪽 제외 표시
    │  categorize.ts 메모 → 규칙 → (미분류만) OpenAI → 미분류
    │  events.ts    메모 키워드 + 시간 근접으로 이벤트 묶음
    │  analyze.ts   집계·발견 산출
    │  openai.ts    집계 결과만 받아 요약 문장 생성
    │
    │  ※ 원본 파일은 여기서 폐기한다. 저장하지 않는다.
    ▼
    응답: { transactions: Transaction[], report: Report }
    │
    ▼
[클라이언트] 리포트 렌더
    │
    │  사용자가 출금/고액 미상세 건의 카테고리 또는 `소비 아님`을 지정
    ▼
    analyze.ts 재호출 (클라이언트에서, 서버 왕복 없이) → 리포트 갱신
```

**서버가 거래 배열까지 함께 응답하는 이유:** 저장하지 않으므로 재집계할 원본이 서버에 없다. 클라이언트가 배열을 들고 있어야 사용자 보정을 재업로드 없이 반영할 수 있다 (DESIGN.md 4.2).

## 상태 관리

- 서버 상태 없음. 저장하지 않는 것이 설계 전제다
- 클라이언트 상태는 `useState`/`useReducer`. 외부 상태 라이브러리를 쓰지 않는다
- 보관하는 상태는 둘뿐: 서버가 준 `Transaction[]`, 사용자가 지정한 보정값 `Record<txId, Override>`
- 리포트는 이 둘로부터 `analyze.ts`가 매번 파생시킨다. 리포트 자체를 상태로 두지 않는다

## 외부 의존성

| 대상 | 용도 | 없으면 |
|---|---|---|
| OpenAI API | 미분류 적요 분류, 요약 문장 | 규칙 분류까지만 동작하고 LLM 단계를 건너뛴다. 앱은 정상 작동해야 한다 |

API 키가 없는 상태도 정상 경로다. 키 부재를 에러로 처리하지 마라.
