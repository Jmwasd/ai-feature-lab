# Step 7: openai-service

## 읽어야 할 파일

- `/docs/DESIGN.md` — **4.3(통계가 주인공), 4.4(LLM에 무엇을 보내나), 8.1(프라이버시) 필독**
- `/docs/ADR.md` — ADR-004
- `/CLAUDE.md` — CRITICAL 규칙
- `src/lib/categorize.ts` (`collectUnclassified`), `src/lib/analyze.ts`

## 작업

`src/services/openai.ts`를 만든다. **이 프로젝트에서 유일하게 외부 네트워크를 호출하는 파일이다.**

```ts
/** 미분류 적요를 카테고리로 분류한다. 키가 없으면 빈 객체를 반환한다 */
export async function classifyMerchants(names: string[]): Promise<Record<string, Category>>

/** 계산이 끝난 리포트를 문장 몇 줄로 옮긴다. 키가 없으면 null */
export async function summarize(report: Report): Promise<string | null>
```

### 규칙

- **`OPENAI_API_KEY`가 없으면 에러를 던지지 마라.** `classifyMerchants`는 `{}`, `summarize`는 `null`을 반환한다. 키 부재는 정상 경로다 (ARCHITECTURE.md 외부 의존성)
- **`classifyMerchants`에는 적요 문자열만 보낸다.** 금액·계좌번호·성명·날짜를 프롬프트에 넣지 마라 (CLAUDE.md CRITICAL)
- **`summarize`는 이미 계산된 집계치만 받는다.** LLM에게 덧셈·비율 계산을 시키지 마라. 프롬프트에 "숫자를 새로 계산하지 말고 주어진 값만 사용하라"를 명시한다
- 응답이 `Category` 목록에 없는 값을 주면 `미분류`로 떨어뜨린다. LLM 출력을 그대로 믿지 마라
- 네트워크 실패·타임아웃 시 예외를 밖으로 던지지 말고 빈 결과로 degrade한다. 리포트는 LLM 없이도 완성돼야 한다
- 모델 ID는 이 파일 상단 상수 하나로 격리한다 (DESIGN.md 9절)

### 테스트 (`src/services/openai.test.ts`)

- `OPENAI_API_KEY`가 없을 때 `classifyMerchants([...])`가 `{}`를 반환하고 **예외를 던지지 않는다**
- `summarize(report)`가 `null`을 반환한다
- fetch를 mock해 네트워크 에러를 주입했을 때도 예외가 밖으로 나오지 않는다
- 응답에 `Category`에 없는 문자열이 오면 `미분류`로 정규화된다

실제 API를 호출하는 테스트는 만들지 마라.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. **키 없이 통과해야 한다.**
2. 아키텍처 체크리스트:
   - `src/lib/` 안의 파일이 `services/openai.ts`를 import하지 않는가? (의존 방향은 lib ← services가 아니라 route ← 둘 다)
   - `NEXT_PUBLIC_` 접두사로 키를 읽지 않는가?
   - 프롬프트에 금액·계좌·성명이 들어가지 않는가?
3. `phases/0-initial-release/index.json`의 step 7을 업데이트한다.

## 금지사항

- LLM에게 금액을 계산시키지 마라. 이유: 없는 합계를 지어내는 실패가 치명적이다 (ADR-004)
- 키가 없을 때 예외를 던지거나 앱을 막지 마라. 이유: 규칙 분류까지만으로도 리포트가 나와야 한다
- `src/lib/`에서 이 파일을 import하지 마라. 이유: `lib`은 클라이언트에서도 import되는 순수 함수 영역이다 (ADR-003)
- 사용자 데이터를 로깅하지 마라. 이유: 저장하지 않는 정책이 로그에도 적용된다 (ADR-002)
