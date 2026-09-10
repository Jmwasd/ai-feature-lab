# Step 4: analyze-route-full

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 7절 "호출 구조와 실패 처리"
- `docs/ARCHITECTURE.md` — "데이터 흐름" 절의 6단계
- `docs/ADR.md` — ADR-005 · ADR-007
- `src/app/api/analyze/route.ts` — **이전 phase에서 만든 1·2단계. 여기에 3~6단계를 잇는다**
- `src/types/api.ts` — `AnalyzeRequest` · `AnalyzeResponse`
- `src/types/index.ts` — `AnalysisResult` · `AnalysisItem`
- `src/services/posting.ts` · `src/services/notion.ts` · `src/services/openai.ts`
- `src/lib/verdicts.ts` — `buildAnalysis`
- `src/app/page.tsx` — 현재 응답을 어떻게 소비하는지

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/app/api/analyze/route.ts`를 완성한다. `docs/ARCHITECTURE.md`의 6단계 흐름을 끝까지 잇는다.

```
{ url } 또는 { text }
 1. 공고 본문 확보          (이미 있음)
 2. 이력서 읽기             (이미 있음)
 3. LLM ①  공고 → Requirement[]
 4. LLM ②  Requirement[] × ResumeEvidence[] → Verdict[]
 5. 코드    실재하지 않는 blockId 폐기 · 3분할 집계
 6. 응답    원문 근거와 함께 반환
```

### 응답 타입 확장

`src/types/api.ts`의 `AnalyzeResponse`에서 `status: 'ok'` 갈래를 확장한다.

```ts
| {
    status: 'ok';
    posting: { title: string; sourceUrl?: string };
    requirementCount: number;
    result: AnalysisResult;
  }
```

`evidenceCount`는 화면이 쓰지 않으면 빼도 된다. `requirementCount`는 결과 헤더의 `요구사항 N개` 표시에 쓴다.

### 처리

3. `extractRequirements(posting.rawText)`
   - 요구사항이 0개면 500 `{ status: 'error' }`. 메시지: 공고에서 요구사항을 찾지 못했다는 안내. **빈 결과를 `ok`로 내려보내지 마라**
4. `matchVerdicts(requirements, evidence)`
5. `buildAnalysis(requirements, verdicts, evidence)`
6. `{ status: 'ok', posting, requirementCount, result }`

**순서를 바꾸지 마라.** 5단계(집계·검증)를 건너뛰고 `verdicts`를 그대로 응답에 담으면 실재하지 않는 블록 ID가 화면까지 나간다.

### 에러와 로그

- OpenAI 호출 실패(네트워크·인증·rate limit) → 500 `{ status: 'error', message }`. 무엇이 실패했는지 담되 **키 값은 절대 담지 마라**
- `extractRequirements` · `matchVerdicts`가 돌려준 `errors` 배열은 **서버 콘솔에만** 남긴다. 응답 body에 넣지 마라 — 화면에 보여줄 것은 판정 결과이지 파싱 로그가 아니다
- `unjudged` 항목이 있으면 그 개수를 서버 콘솔에 남긴다. 프롬프트를 고칠 때 볼 신호다

### 화면 연결

`src/app/page.tsx`의 임시 `<pre>` 블록은 **그대로 둔다.** 3분할 결과 화면은 `3-result-ui` phase가 만든다. 지금은 `result`가 JSON으로 찍히기만 하면 된다.

타입이 바뀌었으니 `page.tsx`가 컴파일되도록 최소한만 맞춘다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 기존 테스트 전부 통과
```

추가로 확인한다:

```bash
grep -n "buildAnalysis" src/app/api/analyze/route.ts          # 집계를 거친다
grep -rn "process.env" src/app/ src/components/                # 결과 없음
grep -rn "NEXT_PUBLIC" src/                                    # 결과 없음
grep -rn "gpt-" src/ --include=*.ts | grep -v constants.ts     # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 레이어 방향(`app → services → 외부`)을 지켰는가? Route Handler가 OpenAI SDK를 직접 부르지 않는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - **`verdicts`를 `buildAnalysis` 없이 응답에 담지 않았는가** (실재 검증을 반드시 거친다)
     - **집계를 LLM에 시키지 않았는가**
     - **비밀값이 응답·로그로 새지 않았는가**
     - **저장 계층을 만들지 않았는가** (캐시 헤더·메모리 캐시 없음)
     - **누락을 `missing`으로 만들지 않았는가** (`unjudged`가 그대로 응답에 실린다)
3. 결과에 따라 `phases/2-llm-matching/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

**이 step은 `blocked`가 되면 안 된다.** 빌드와 타입 체크로 완료된다. 실제 분석 실행에 키가 필요한 것과 코드를 완성하는 것은 별개다.

`summary`에 최종 `AnalyzeResponse`의 형태를 적어라. `3-result-ui`가 이것을 렌더한다.

## 금지사항

- **`verdicts`를 집계 없이 응답에 담지 마라.** 이유: `CLAUDE.md` CRITICAL / ADR-003 — 5단계가 실재하지 않는 블록 ID를 버리는 유일한 지점이다. 건너뛰면 지어낸 근거가 화면에 나간다
- **요구사항이 0개일 때 `ok`로 내려보내지 마라.** 이유: 빈 3분할 화면은 "당신에게 아무것도 없다"처럼 읽힌다. 실제로는 공고를 못 읽은 것이다
- **파싱 `errors`를 응답 body에 담지 마라.** 이유: 화면은 판정 결과를 보여주는 곳이다. 파싱 로그는 서버 콘솔에서 본다
- **결과를 캐시하거나 저장하지 마라.** 이유: ADR-005 — 새로고침하면 사라지는 것이 결정이다
- **Route Handler에서 OpenAI SDK를 직접 부르지 마라.** 이유: 외부 호출은 `src/services/`에서만 한다
- **판정과 제안을 두 번에 나눠 부르지 마라.** 이유: ADR-007
- **3분할 결과 화면을 만들지 마라.** 이유: `3-result-ui` phase 소관이다
- **에러 메시지에 API 키·토큰 값을 담지 마라**
- 기존 테스트를 깨뜨리지 마라
