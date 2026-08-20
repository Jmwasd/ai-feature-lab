# Step 8: api-route

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **데이터 흐름 절 필독**
- `/docs/DESIGN.md` — 4.1(저장 안 함), 4.2(응답에 거래 배열 포함), 5.1
- `/docs/ADR.md` — ADR-002, ADR-003
- `src/lib/*.ts` 전부, `src/services/openai.ts`

## 작업

`src/app/api/analyze/route.ts`를 만든다. 지금까지의 순수 로직을 하나로 엮는 유일한 지점이다.

```ts
export async function POST(req: Request): Promise<Response>
```

### 흐름

1. `multipart/form-data`에서 CSV 파일을 받는다
2. `parseTossCsv()` — 텍스트로 읽어 파싱
3. `analyze()` 1차 호출 — 규칙 분류까지
4. `collectUnclassified()` → `classifyMerchants()` — LLM 분류
5. `analyze()` 재호출 — `llmCategories`를 넣어 최종 리포트
6. `summarize()` — 요약 문장
7. 응답 `{ transactions, report, summary }`

### 규칙

- **파일을 디스크에 쓰지 마라.** 메모리에서만 다루고 응답 후 참조를 버린다 (CLAUDE.md CRITICAL)
- **거래 배열을 응답에 포함한다.** 클라이언트가 재집계하려면 필요하다 (ADR-003)
- 파일이 CSV가 아니면(확장자·매직바이트) **변환 안내 메시지**를 담은 400을 반환한다. 특히 `.xlsx`가 오면 "암호화된 파일이라 열 수 없다. 엑셀로 열어 CSV로 내보내라"는 취지의 메시지를 준다 (DESIGN.md 2.8, 5.3)
- 파싱 실패 시 스택 트레이스나 파일 내용을 응답에 담지 마라
- 요청 로그에 파일 내용·적요·금액을 남기지 마라

### 테스트

Route Handler에는 테스트를 요구하지 않는다 (ADR-009). 다만 `npm run build`가 통과해야 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - 파일 저장(`fs.writeFile`, `/tmp`) 코드가 없는가?
   - 응답에 `transactions`가 포함되는가?
   - 비즈니스 로직이 route에 새로 작성되지 않았는가? (`lib/`의 함수를 호출만 해야 한다)
   - `OPENAI_API_KEY`가 없어도 200을 반환하는가?
3. `phases/0-initial-release/index.json`의 step 8을 업데이트한다.

## 금지사항

- 업로드 파일을 디스크·DB·캐시·로그에 쓰지 마라. 이유: 저장하지 않는 것이 이 프로젝트의 전제다 (ADR-002)
- route에 집계·분류 로직을 새로 작성하지 마라. `lib/`를 호출만 해라. 이유: 그 로직은 클라이언트도 써야 하고 테스트 대상이다 (ADR-003)
- xlsx 파싱을 시도하지 마라. 명확한 안내 메시지로 거절해라. 이유: 암호화돼 있어 열리지 않는다 (ADR-001)
- 에러 응답에 파일 내용이나 적요를 담지 마라. 이유: 개인정보가 에러 로그로 새는 가장 흔한 경로다
