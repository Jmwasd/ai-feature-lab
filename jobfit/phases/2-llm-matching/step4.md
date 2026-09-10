# Step 4: analyze-route-full

## 읽어야 할 파일

- `src/app/api/analyze/route.ts` — **이전 phase에서 만든 1·2단계. 여기에 3~6단계를 잇는다**
- `src/types/api.ts` — `AnalyzeRequest` · `AnalyzeResponse`
- `src/types/index.ts` — `AnalysisResult` · `AnalysisItem`
- `src/services/posting.ts` · `src/services/notion.ts` · `src/services/openai.ts`
- `src/lib/verdicts.ts` — `buildAnalysis`
- `src/app/page.tsx` — 현재 응답을 어떻게 소비하는지

흐름은 `docs/ARCHITECTURE.md` "데이터 흐름" 절의 6단계, 실패 처리는 `docs/PLAN.md` 7절이 정한다.

## 작업

`src/app/api/analyze/route.ts`를 완성한다.

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

`requirementCount`는 결과 헤더의 `요구사항 N개` 표시에 쓴다. 그 밖의 지표를 추가하지 마라.

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

grep -n "buildAnalysis" src/app/api/analyze/route.ts          # 집계를 거친다
grep -rn "process.env" src/app/ src/components/                # 결과 없음
grep -rn "NEXT_PUBLIC" src/                                    # 결과 없음
grep -rn "gpt-" src/ --include=*.ts | grep -v constants.ts     # 결과 없음
```

추가로 확인한다: **`verdicts`를 `buildAnalysis` 없이 응답에 담지 않았는가?** Route Handler가 OpenAI SDK를 직접 부르지 않고 `src/services/`를 통하는가? `unjudged`가 그대로 응답에 실리는가?

`summary`에 확장된 `AnalyzeResponse`의 `ok` 갈래 형태를 적어라. `3-result-ui` phase의 화면이 이것을 렌더한다.

## 금지사항

- **`buildAnalysis`를 건너뛰고 `verdicts`를 그대로 응답에 담지 마라.** 이유: ADR-003 — 실재하지 않는 블록 ID가 화면까지 나간다. 이 도구의 가장 치명적인 실패다
- **집계·개수 세기를 LLM에 시키지 마라.** 이유: `CLAUDE.md` CRITICAL — 전부 `src/lib/`의 순수 함수가 한다
- **`unjudged`를 `missing`으로 합치거나 응답에서 빼지 마라.** 이유: `CLAUDE.md` CRITICAL — 대답을 안 한 것과 근거가 없는 것은 다르다
- **파싱 `errors`를 응답 body에 넣지 마라.** 이유: 화면에 보여줄 것은 판정 결과다. 로그는 서버 콘솔에 남긴다
- **응답이나 중간 결과를 캐시하지 마라.** 이유: ADR-005
- **에러 메시지나 로그에 API 키·토큰 값을 담지 마라**
- **3분할 결과 화면을 만들지 마라.** 이유: `3-result-ui` phase 소관이다. 임시 `<pre>`를 그대로 둔다
